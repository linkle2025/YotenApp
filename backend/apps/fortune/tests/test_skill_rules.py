# -*- coding: utf-8 -*-
"""
解釈ルール設定（rules/skill_rules.toml）のテスト

- 設定ファイルの読み込み・書式チェック
- 条件判定と点数補正
- 実在の鑑定事例2件（Sさん・Oさん）で、日干を起点にした補正が効いていること
仕様: doc/解釈ルール設定.md
"""
import os
import tempfile
from decimal import Decimal
from pathlib import Path

from django.test import SimpleTestCase

from apps.fortune import skill_rules as sr
from apps.fortune.skill_sheet import calculate_skill_sheet


def _pillars(year, month, day, hour):
    def p(gz):
        return {'heavenly_stem': gz[0], 'earthly_branch': gz[1]} if gz else {}
    return {'year_pillar': p(year), 'month_pillar': p(month), 'day_pillar': p(day), 'hour_pillar': p(hour)}


# 事例S：庚日干・身旺・印綬格。本人の実感：お金の管理とチームをまとめるのが苦手、設計と体力は得意
CASE_S = dict(
    pillars=_pillars('甲寅', '辛未', '庚申', '己卯'),
    day_stem='庚',
    five_element_scores={'wood': 45.0, 'fire': 5.0, 'earth': 60.0, 'metal': 30.0, 'water': 1.25},
    kakukyoku='印綬格',
)

# 事例O：癸日干・身弱・偏官格。本人の実感：体力・持続力がなく、自ら引っ張るタイプでもない、管理は得意
CASE_O = dict(
    pillars=_pillars('庚戌', '己丑', '癸卯', '己未'),
    day_stem='癸',
    five_element_scores={'wood': 12.5, 'fire': 5.0, 'earth': 100.0, 'metal': 20.0, 'water': 7.5},
    kakukyoku='偏官格',
)

MINIMAL_ROLES = """
[strength_roles."身旺"]
"比劫" = "忌"
"印" = "忌"
"食傷" = "喜"
"財" = "喜"
"官" = "中"
[strength_roles."身弱"]
"比劫" = "喜"
"印" = "喜"
"食傷" = "忌"
"財" = "忌"
"官" = "中"
[strength_roles."中和"]
"比劫" = "中"
"印" = "中"
"食傷" = "中"
"財" = "中"
"官" = "中"
"""


def _scores(sheet):
    return {a['name']: a['score'] for a in sheet['abilities']}


class RulesFileTests(SimpleTestCase):

    def test_bundled_rules_file_is_valid(self):
        ruleset = sr.load_rules()
        self.assertTrue(ruleset.version)
        self.assertTrue(ruleset.principles)
        self.assertEqual(set(ruleset.day_stems), set(sr.STEMS))
        self.assertIn('mijaku_kan_heavy', [r.id for r in ruleset.rules])

    def test_fingerprint_changes_with_content(self):
        a = sr.parse_rules('version = "x"\n' + MINIMAL_ROLES)
        b = sr.parse_rules('version = "x"\nprinciples = ["追加"]\n' + MINIMAL_ROLES)
        self.assertNotEqual(a.fingerprint, b.fingerprint)
        self.assertTrue(a.fingerprint.startswith('x-'))

    def test_reload_when_file_changes(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / 'rules.toml'
            path.write_text('version = "1"\n' + MINIMAL_ROLES, encoding='utf-8')
            self.assertEqual(sr.load_rules(path).version, '1')
            path.write_text('version = "2"\n' + MINIMAL_ROLES, encoding='utf-8')
            st = path.stat()
            os.utime(path, ns=(st.st_atime_ns, st.st_mtime_ns + 1_000_000_000))
            self.assertEqual(sr.load_rules(path).version, '2')

    def test_config_errors_point_to_the_rule(self):
        cases = {
            '不明な条件': '[[rules]]\nid = "a"\ntitle = "A"\nwhen = { foo = 1 }\n',
            '五行グループ名が不正': '[[rules]]\nid = "a"\ntitle = "A"\nwhen = { group_below = { "火" = 1 } }\n',
            'ability が不正': '[[rules]]\nid = "a"\ntitle = "A"\nadjust = [{ ability = "x", value = 1 }]\n',
            'per に使えない名前': '[[rules]]\nid = "a"\ntitle = "A"\nadjust = [{ ability = "kanri", value = 1, per = "火" }]\n',
            '差し込み名': '[[rules]]\nid = "a"\ntitle = "A"\ninterpretation = "{名前}"\n',
            'id が重複': '[[rules]]\nid = "a"\ntitle = "A"\n[[rules]]\nid = "a"\ntitle = "B"\n',
            'TOMLの書式': '[[rules]\n',
        }
        for message, rules in cases.items():
            with self.subTest(message=message):
                with self.assertRaisesRegex(sr.RulesConfigError, message):
                    sr.parse_rules(MINIMAL_ROLES + rules)

    def test_strength_roles_required(self):
        with self.assertRaisesRegex(sr.RulesConfigError, 'strength_roles'):
            sr.parse_rules('version = "x"\n')

    def test_config_error_is_not_value_error(self):
        # 計算エラー（ValueError）と一緒に握りつぶされないこと
        self.assertFalse(issubclass(sr.RulesConfigError, ValueError))


class RuleEvaluationTests(SimpleTestCase):

    def ctx(self, **kw):
        base = dict(day_stem='癸', strength_label='身弱', strength_diff=-90, star_points={'偏官': 40, '正官': 10},
                    element_groups={'比劫': 7.5, '印': 20, '食傷': 12.5, '財': 5, '官': 100})
        base.update(kw)
        return sr.RuleContext(**base)

    def test_conditions(self):
        c = self.ctx()
        self.assertTrue(sr.matches({'strength': ['身弱'], 'top_group': '官'}, c))
        self.assertFalse(sr.matches({'strength': ['身旺']}, c))
        self.assertTrue(sr.matches({'day_element': ['水'], 'day_stem': ['癸']}, c))
        self.assertTrue(sr.matches({'group_at_least': {'官': 100}, 'group_below': {'財': 5.1}}, c))
        self.assertFalse(sr.matches({'group_below': {'財': 5}}, c))
        self.assertTrue(sr.matches({'group_rank_within': {'印': 2}}, c))
        self.assertTrue(sr.matches({'strength_diff_below': -50}, c))
        self.assertFalse(sr.matches({'strength_diff_at_least': 0}, c))
        self.assertFalse(sr.matches({'kakukyoku_any': ['偏官格']}, c))
        self.assertTrue(sr.matches({'kakukyoku_any': ['偏官格']}, self.ctx(kakukyoku='偏官格')))

    def test_adjustment_amount_with_per_and_limits(self):
        c = self.ctx()
        amount = sr.adjustment_amount
        self.assertEqual(amount(sr.Adjustment('kanri', Decimal('-10')), c), Decimal('-10'))
        self.assertEqual(amount(sr.Adjustment('touritsu', Decimal('-1.0'), per=('官',)), c), Decimal('-100'))
        self.assertEqual(amount(sr.Adjustment('touritsu', Decimal('-0.3'), per=('正官', '偏官')), c), Decimal('-15'))
        self.assertEqual(amount(sr.Adjustment('kanri', Decimal('0.3'), per=('官',), max=Decimal('25')), c),
                         Decimal('25'))
        self.assertEqual(amount(sr.Adjustment('tairyoku', Decimal('0.3'), per=('身旺度',), min=Decimal('-20')), c),
                         Decimal('-20'))

    def test_interpretation_placeholders(self):
        text = sr.format_interpretation('官 {官}・身旺度 {身旺度}・{日干}', self.ctx())
        self.assertEqual(text, '官 100・身旺度 -90・癸')

    def test_day_stem_adjust(self):
        ruleset = sr.parse_rules(
            MINIMAL_ROLES + '[day_stems."癸"]\nnature = "雨"\nadjust = [{ ability = "jinbou", value = 5 }]\n'
        )
        applied = sr.evaluate(self.ctx(), ruleset)
        self.assertEqual(applied[0]['id'], 'day_stem_癸')
        self.assertEqual(applied[0]['adjustments'], [{'ability': 'jinbou', 'value': Decimal('5')}])

    def test_element_relations_follow_day_stem(self):
        relations = {r['group']: r for r in sr.element_relations(
            '癸', {'比劫': 7.5, '印': 20, '食傷': 12.5, '財': 5, '官': 100}, '身弱')}
        self.assertEqual({g: r['element'] for g, r in relations.items()},
                         {'比劫': '水', '印': '金', '食傷': '木', '財': '火', '官': '土'})
        self.assertEqual(relations['官']['rank'], 1)
        self.assertEqual(relations['印']['role'], '喜')
        self.assertEqual(relations['財']['role'], '忌')


class CaseStudyTests(SimpleTestCase):
    """実際の鑑定事例で、日干を起点にした補正が本人の実感の方向に効いていること"""

    def test_case_o_mijaku_kan_heavy(self):
        sheet = calculate_skill_sheet(**CASE_O)
        self.assertEqual(sheet['strength']['label'], '身弱')
        titles = [r['title'] for r in sheet['applied_rules']]
        self.assertIn('身弱で官が重い（身弱殺重）', titles)
        self.assertIn('身弱による体力・持続力の補正', titles)
        scores = _scores(sheet)
        # 補正前は 統率100・体力69・実行45・管理35
        self.assertEqual(scores['統率'], 45)
        self.assertEqual(scores['体力'], 42)
        self.assertEqual(scores['実行'], 36)
        self.assertEqual(scores['管理'], 60)
        self.assertGreater(scores['管理'], scores['統率'])
        effects = {r['title']: r['effects'] for r in sheet['applied_rules']}
        self.assertEqual(effects['身弱で官が重い（身弱殺重）'], {'統率': -115.0, '開拓': -20.0, '管理': 25.0})

    def test_case_s_zai_in_conflict(self):
        sheet = calculate_skill_sheet(**CASE_S)
        self.assertEqual(sheet['strength']['label'], '身旺')
        titles = [r['title'] for r in sheet['applied_rules']]
        self.assertIn('財と印がともに強い（財印相剋）', titles)
        self.assertIn('官が弱い', titles)
        scores = _scores(sheet)
        # 補正前は 商才98・管理55・統率45。設計（知略）と体力は高いまま
        self.assertEqual(scores['商才'], 71)
        self.assertEqual(scores['管理'], 35)
        self.assertEqual(scores['統率'], 40)
        self.assertEqual(scores['知略'], 100)
        self.assertEqual(scores['体力'], 100)

    def test_breakdown_records_rule_titles_and_sums_to_score(self):
        sheet = calculate_skill_sheet(**CASE_O)
        touritsu = next(a for a in sheet['abilities'] if a['key'] == 'touritsu')
        factors = [i['factor'] for i in touritsu['breakdown']]
        self.assertEqual(factors.count('身弱で官が重い（身弱殺重）'), 2)
        self.assertEqual(round(sum(i['value'] for i in touritsu['breakdown'])), touritsu['score'])
        self.assertEqual(sheet['version'], 'alpha-2')
        self.assertTrue(sheet['rules_version'])
