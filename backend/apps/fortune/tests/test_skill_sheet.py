# -*- coding: utf-8 -*-
"""
鑑定スキル表（現代ビジネス版）α版のテスト
仕様: doc/鑑定スキル表.md
"""
from django.contrib.auth.models import User
from django.test import SimpleTestCase, TestCase

from apps.fortune import skill_sheet as ss
from apps.fortune.calculators import calculate_fortune
from apps.fortune.models import FortuneCalculation
from apps.fortune.serializers import FortuneCalculationSerializer


def _ishikawa_result():
    """石川憂樹 1985年5月10日 11時30分 男性 岐阜県"""
    return calculate_fortune(1985, 5, 10, 11, prefecture='岐阜県', birth_minute=30, gender='male')


def _sheet_from_result(result, hour_unknown=False):
    return ss.calculate_skill_sheet(
        result,
        result['day_pillar']['heavenly_stem'],
        result['five_elements_balance']['scores'],
        result['kakukyoku'],
        hour_unknown=hour_unknown,
    )


def _abilities(sheet):
    return {a['name']: a['score'] for a in sheet['abilities']}


def _jobs(sheet):
    return {j['name']: (j['score'], j['rank']) for j in sheet['jobs']}


def _frontend_strength_label(day_stem, scores):
    """DetailPage.js の getOrderedElements / getStrengthLabel をそのまま移植した参照実装"""
    order = ['wood', 'fire', 'earth', 'metal', 'water']
    start = order.index(ss.STEM_TO_ELEMENT[day_stem])
    ordered = [order[(start + i) % 5] for i in range(5)]
    top_left = scores.get(ordered[0], 0) + scores.get(ordered[4], 0)
    bottom_right = scores.get(ordered[1], 0) + scores.get(ordered[2], 0) + scores.get(ordered[3], 0)
    if top_left > bottom_right:
        return '身旺'
    if top_left < bottom_right:
        return '身弱'
    return '中和'  # フロントでは '-' と表示


class IshikawaReferenceCaseTests(SimpleTestCase):
    """§7-1 基準ケース（完全一致必須）"""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.result = _ishikawa_result()
        cls.sheet = _sheet_from_result(cls.result)

    def test_pillars(self):
        r = self.result
        self.assertEqual(
            [r[k]['heavenly_stem'] + r[k]['earthly_branch']
             for k in ('year_pillar', 'month_pillar', 'day_pillar', 'hour_pillar')],
            ['乙丑', '辛巳', '己酉', '庚午'],
        )

    def test_element_groups(self):
        self.assertEqual(
            self.sheet['inputs']['element_groups'],
            {'比劫': 25.0, '印': 30.0, '食傷': 25.0, '財': 2.5, '官': 10.0},
        )

    def test_star_points(self):
        self.assertEqual(
            self.sheet['inputs']['star_points'],
            {'食神': 35, '偏印': 20, '傷官': 15, '偏官': 10, '比肩': 10,
             '印綬': 10, '劫財': 5, '偏財': 5, '正官': 0, '正財': 0},
        )

    def test_strength_and_kakukyoku(self):
        self.assertEqual(self.sheet['strength'], {'label': '身旺', 'diff': 17.5})
        self.assertEqual(self.sheet['kakukyoku'], '傷官格')
        self.assertFalse(self.sheet['is_reference'])

    def test_abilities(self):
        self.assertEqual(
            _abilities(self.sheet),
            {'企画': 90, '知略': 82, '実行': 80, '体力': 85, '人望': 65,
             '統率': 50, '開拓': 50, '商才': 35, '管理': 25},
        )

    def test_jobs(self):
        self.assertEqual(
            _jobs(self.sheet),
            {'教官': (86, 'S'), '軍師': (82, 'A+'), '専門職': (81, 'A+'), '現場L': (65, 'B'),
             '営業': (63, 'B-'), '将軍': (58, 'C+'), '総務': (29, 'D')},
        )

    def test_display_order(self):
        self.assertEqual([a['key'] for a in self.sheet['abilities']], [a['key'] for a in ss.ABILITIES])
        self.assertEqual([j['key'] for j in self.sheet['jobs']], [j['key'] for j in ss.JOBS])
        self.assertEqual(self.sheet['abilities'][0]['meaning'], 'ゼロから構想を描く')


class ElementGroupTests(SimpleTestCase):

    def test_all_ten_day_stems(self):
        expected = {
            '甲': ('wood', 'water', 'fire', 'earth', 'metal'),
            '乙': ('wood', 'water', 'fire', 'earth', 'metal'),
            '丙': ('fire', 'wood', 'earth', 'metal', 'water'),
            '丁': ('fire', 'wood', 'earth', 'metal', 'water'),
            '戊': ('earth', 'fire', 'metal', 'water', 'wood'),
            '己': ('earth', 'fire', 'metal', 'water', 'wood'),
            '庚': ('metal', 'earth', 'water', 'wood', 'fire'),
            '辛': ('metal', 'earth', 'water', 'wood', 'fire'),
            '壬': ('water', 'metal', 'wood', 'fire', 'earth'),
            '癸': ('water', 'metal', 'wood', 'fire', 'earth'),
        }
        for stem, (hikou, in_, shokushou, zai, kan) in expected.items():
            with self.subTest(stem=stem):
                self.assertEqual(
                    ss.get_element_groups(stem),
                    {'比劫': hikou, '印': in_, '食傷': shokushou, '財': zai, '官': kan},
                )

    def test_invalid_stem(self):
        with self.assertRaises(ValueError):
            ss.get_element_groups('')


class StrengthTests(SimpleTestCase):

    def _groups(self, hikou, in_, shokushou, zai, kan):
        return {'比劫': hikou, '印': in_, '食傷': shokushou, '財': zai, '官': kan}

    def test_labels(self):
        self.assertEqual(ss.calculate_strength(self._groups(20, 20, 10, 10, 10)), (10.0, '身旺'))
        self.assertEqual(ss.calculate_strength(self._groups(10, 10, 10, 10, 10)), (-10.0, '身弱'))
        self.assertEqual(ss.calculate_strength(self._groups(15, 15, 10, 10, 10)), (0.0, '中和'))

    def test_matches_frontend_logic(self):
        samples = [
            {'wood': 10, 'fire': 30, 'earth': 25, 'metal': 25, 'water': 2.5},
            {'wood': 40, 'fire': 5, 'earth': 7.5, 'metal': 15, 'water': 10},
            {'wood': 10, 'fire': 10, 'earth': 10, 'metal': 10, 'water': 10},
            {'wood': 20, 'fire': 15, 'earth': 10, 'metal': 5, 'water': 25},
            {'wood': 0, 'fire': 0, 'earth': 0, 'metal': 0, 'water': 0},
        ]
        for scores in samples:
            for stem in ss.STEM_TO_ELEMENT:
                with self.subTest(stem=stem, scores=scores):
                    groups = ss.calculate_element_group_scores(stem, scores)
                    _, label = ss.calculate_strength(groups)
                    self.assertEqual(label, _frontend_strength_label(stem, scores))

    def test_strength_bonus_applied(self):
        stars = {s: 0 for s in ss.ALL_STARS}
        groups = self._groups(0, 0, 0, 0, 0)
        base = ss.BASE_POINTS
        for label, jikkou_bonus, touritsu_bonus in [('身旺', 10, 5), ('身弱', -10, -5), ('中和', 0, 0)]:
            with self.subTest(label=label):
                scores = ss.calculate_ability_scores(groups, stars, label, '')
                self.assertEqual(scores['jikkou'], base['jikkou'] + jikkou_bonus)
                self.assertEqual(scores['touritsu'], base['touritsu'] + touritsu_bonus)


class KakuBonusTests(SimpleTestCase):

    def setUp(self):
        self.groups = {'比劫': 0, '印': 0, '食傷': 0, '財': 0, '官': 0}
        self.stars = {s: 0 for s in ss.ALL_STARS}

    def test_single_kaku(self):
        scores = ss.calculate_ability_scores(self.groups, self.stars, '中和', '偏財格')
        self.assertEqual(scores['shousai'], ss.BASE_POINTS['shousai'] + 10)
        self.assertEqual(scores['kikaku'], ss.BASE_POINTS['kikaku'])

    def test_or_kaku_both_abilities(self):
        scores = ss.calculate_ability_scores(self.groups, self.stars, '中和', '食神格または偏財格')
        self.assertEqual(scores['kikaku'], ss.BASE_POINTS['kikaku'] + 10)
        self.assertEqual(scores['shousai'], ss.BASE_POINTS['shousai'] + 10)

    def test_or_kaku_no_double_bonus(self):
        scores = ss.calculate_ability_scores(self.groups, self.stars, '中和', '食神格または傷官格')
        self.assertEqual(scores['kikaku'], ss.BASE_POINTS['kikaku'] + 10)

    def test_empty_kakukyoku(self):
        for kaku in ('', None):
            with self.subTest(kaku=kaku):
                scores = ss.calculate_ability_scores(self.groups, self.stars, '中和', kaku)
                self.assertEqual(scores, ss.BASE_POINTS)


class StarPointsTests(SimpleTestCase):

    def test_hour_unknown_excludes_hour_pillar(self):
        result = _ishikawa_result()
        with_hour = ss.calculate_star_points(result, '己', hour_unknown=False)
        without_hour = ss.calculate_star_points(result, '己', hour_unknown=True)
        # 時柱 庚午：庚=傷官10、午 本気丁=偏印20、中気己=0
        self.assertEqual(with_hour['傷官'] - without_hour['傷官'], 10)
        self.assertEqual(with_hour['偏印'] - without_hour['偏印'], 20)
        self.assertEqual(with_hour['比肩'], without_hour['比肩'])

    def test_day_stem_itself_excluded(self):
        pillars = {'day_pillar': {'heavenly_stem': '甲', 'earthly_branch': ''}}
        self.assertEqual(sum(ss.calculate_star_points(pillars, '甲').values()), 0)

    def test_special_branch_weights(self):
        # 甲日干：子(癸=印綬20)、卯(乙=劫財20)、酉(辛=正官20)、午(丁=傷官20, 己=0)
        pillars = {
            'year_pillar': {'heavenly_stem': '', 'earthly_branch': '子'},
            'month_pillar': {'heavenly_stem': '', 'earthly_branch': '卯'},
            'day_pillar': {'heavenly_stem': '甲', 'earthly_branch': '酉'},
            'hour_pillar': {'heavenly_stem': '', 'earthly_branch': '午'},
        }
        points = ss.calculate_star_points(pillars, '甲')
        self.assertEqual(points['印綬'], 20)
        self.assertEqual(points['劫財'], 20)
        self.assertEqual(points['正官'], 20)
        self.assertEqual(points['傷官'], 20)
        self.assertEqual(points['正財'], 0)  # 午の己は0点

    def test_normal_branch_weights(self):
        # 甲日干・寅：本気甲=比肩10、中気丙=食神5、余気戊=偏財5
        pillars = {'year_pillar': {'heavenly_stem': '', 'earthly_branch': '寅'}}
        points = ss.calculate_star_points(pillars, '甲')
        self.assertEqual((points['比肩'], points['食神'], points['偏財']), (10, 5, 5))

    def test_hour_unknown_sets_is_reference(self):
        sheet = _sheet_from_result(_ishikawa_result(), hour_unknown=True)
        self.assertTrue(sheet['is_reference'])


class RoundingAndClampTests(SimpleTestCase):

    def test_round_half_up(self):
        self.assertEqual(ss.round_half_up(57.5), 58)
        self.assertEqual(ss.round_half_up(62.5), 63)  # round() だと 62
        self.assertEqual(ss.round_half_up(2.5), 3)
        self.assertEqual(ss.round_half_up(81.8), 82)
        self.assertEqual(ss.round_half_up(81.4), 81)

    def test_float_error_does_not_break_rounding(self):
        # 0.3*50 + 0.3*85 + 0.2*50 + 0.2*35 は float だと 57.49999... になりうる
        self.assertEqual(ss.calculate_job_scores(
            {'touritsu': 50, 'tairyoku': 85, 'kaitaku': 50, 'shousai': 35,
             'chiryaku': 0, 'kikaku': 0, 'jinbou': 0, 'jikkou': 0, 'kanri': 0}
        )['shogun'], 58)

    def test_clamp_upper(self):
        groups = {'比劫': 0, '印': 200, '食傷': 0, '財': 0, '官': 0}
        stars = {**{s: 0 for s in ss.ALL_STARS}, '偏印': 100}
        scores = ss.calculate_ability_scores(groups, stars, '身旺', '偏印格')
        self.assertEqual(scores['chiryaku'], 100)

    def test_clamp_lower(self):
        self.assertEqual(ss.clamp_score(-5), 0)
        self.assertEqual(ss.clamp_score(120), 100)

    def test_rank_bands(self):
        cases = [(100, 'S'), (85, 'S'), (84, 'A+'), (80, 'A+'), (79, 'A'), (75, 'A'),
                 (74, 'B+'), (70, 'B+'), (69, 'B'), (65, 'B'), (64, 'B-'), (60, 'B-'),
                 (59, 'C+'), (55, 'C+'), (54, 'C'), (50, 'C'), (49, 'C-'), (45, 'C-'),
                 (44, 'D'), (0, 'D')]
        for score, rank in cases:
            with self.subTest(score=score):
                self.assertEqual(ss.get_rank(score), rank)


class SkillSheetSerializerTests(TestCase):

    def setUp(self):
        self.user = User.objects.create_user(username='skilluser', password='TestPass123!')

    def _create(self, **overrides):
        result = _ishikawa_result()
        data = dict(
            user=self.user, name='石川憂樹',
            birth_year=1985, birth_month=5, birth_day=10, birth_hour=11, birth_minute=30,
            prefecture='岐阜県', gender='male',
            five_elements_balance_data=result['five_elements_balance'],
            kakukyoku=result['kakukyoku'],
        )
        for key in ('year_pillar', 'month_pillar', 'day_pillar', 'hour_pillar'):
            data[f'{key}_heavenly_stem'] = result[key]['heavenly_stem']
            data[f'{key}_earthly_branch'] = result[key]['earthly_branch']
        data.update(overrides)
        return FortuneCalculation.objects.create(**data)

    def test_skill_sheet_in_response(self):
        sheet = FortuneCalculationSerializer(self._create()).data['skill_sheet']
        self.assertEqual(_abilities(sheet)['企画'], 90)
        self.assertEqual(_jobs(sheet)['教官'], (86, 'S'))
        self.assertEqual(sheet['day_stem'], '己')

    def test_old_record_without_balance_returns_none(self):
        obj = self._create(five_elements_balance_data={})
        self.assertIsNone(FortuneCalculationSerializer(obj).data['skill_sheet'])

    def test_hour_unknown_record(self):
        obj = self._create(
            hour_unknown=True,
            hour_pillar_heavenly_stem='', hour_pillar_earthly_branch='',
        )
        sheet = FortuneCalculationSerializer(obj).data['skill_sheet']
        self.assertTrue(sheet['is_reference'])
