# -*- coding: utf-8 -*-
"""
判定の要点（LLM生成）のテスト
Gemini API はすべてモックし、実際の通信は一切しない。
仕様: doc/判定の要点生成.md
"""
import json
from unittest import mock

from django.contrib.auth.models import User
from django.test import SimpleTestCase, TestCase, override_settings
from rest_framework.test import APIClient

from apps.fortune import insight_service as svc
from apps.fortune import skill_sheet as ss
from apps.fortune.calculators import calculate_fortune
from apps.fortune.models import FortuneCalculation, SkillInsight
from apps.fortune.serializers import build_skill_sheet
from apps.fortune import skill_rules

FAKE_KEY = 'AIzaFAKEkeyForUnitTests_0123456789abc'

ENABLED_SETTINGS = dict(
    GEMINI_API_KEY=FAKE_KEY,
    GEMINI_MODEL='gemini-test-model',
    GEMINI_PAID_TIER_CONFIRMED=True,
    SKILL_INSIGHT_ENABLED=True,
    SKILL_INSIGHT_DAILY_LIMIT=20,
    GEMINI_TIMEOUT_SECONDS=40,
)


def make_valid_content(job_keys=None, ability_keys=None):
    job_keys = job_keys if job_keys is not None else svc.JOB_KEYS
    ability_keys = ability_keys if ability_keys is not None else svc.ABILITY_KEYS
    return {
        'summary': '印と食傷が強い命式です。',
        'jobs': [{'key': k, 'text': f'{k}の説明です。'} for k in job_keys],
        'abilities': [{'key': k, 'text': f'{k}の説明です。'} for k in ability_keys],
        'advice': '学んだことを形にすると活きます。',
    }


class FakeResponse:
    def __init__(self, text, input_tokens=1200, output_tokens=800):
        self.text = text
        self.usage_metadata = mock.Mock(prompt_token_count=input_tokens, candidates_token_count=output_tokens)


class FakeClient:
    """genai.Client の代わり。responses を順に返す（例外なら送出）"""

    def __init__(self, responses):
        self._responses = list(responses)
        self.calls = []
        self.models = self

    def generate_content(self, **kwargs):
        self.calls.append(kwargs)
        item = self._responses.pop(0)
        if isinstance(item, Exception):
            raise item
        return item


def create_ishikawa_calculation(user, **overrides):
    result = calculate_fortune(1985, 5, 10, 11, prefecture='岐阜県', birth_minute=30, gender='male')
    data = dict(
        user=user, name='石川憂樹',
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


class NoNetworkMixin:
    """テスト中に本物の Gemini クライアントが作られないようにする"""

    def setUp(self):
        super().setUp()
        patcher = mock.patch.object(
            svc, '_get_client', side_effect=AssertionError('テストで実際の Gemini クライアントを作ろうとしました')
        )
        self.get_client_mock = patcher.start()
        self.addCleanup(patcher.stop)

    def use_fake(self, *responses):
        client = FakeClient(responses)
        self.get_client_mock.side_effect = None
        self.get_client_mock.return_value = client
        return client


# ---------------------------------------------------------------------------
# 入力JSON・注記ファクト・スキル表の拡張
# ---------------------------------------------------------------------------

class BuildInsightInputTests(TestCase):

    def setUp(self):
        self.user = User.objects.create_user(username='insight_user', email='me@example.com', password='x')
        self.calc = create_ishikawa_calculation(self.user)

    def test_no_personal_information(self):
        payload = json.dumps(svc.build_insight_input(self.calc), ensure_ascii=False)
        for forbidden in ('石川憂樹', 'insight_user', 'me@example.com', '岐阜', '1985'):
            self.assertNotIn(forbidden, payload)
        # "name" は能力名・職種名のキーとして使うため、ここでは出生情報系のキーだけ確認する
        for key in ('birth_year', 'birth_month', 'birth_day', 'birth_hour', 'prefecture', 'gender'):
            self.assertNotIn(f'"{key}"', payload)

    def test_input_structure(self):
        data = svc.build_insight_input(self.calc)
        self.assertEqual(data['day_stem']['stem'], '己')
        self.assertEqual(data['day_stem']['element'], '土')
        self.assertEqual(data['day_stem']['yin_yang'], '陰')
        self.assertIn('田畑', data['day_stem']['nature'])
        self.assertTrue(data['rules_version'])
        # 日干から見た5グループの関係と喜忌（身旺：食傷・財が喜、比劫・印が忌、官は中）
        relations = {r['group']: r for r in data['element_relations']}
        self.assertEqual([r['group'] for r in data['element_relations']], ['比劫', '印', '食傷', '財', '官'])
        self.assertEqual(relations['印']['element'], '火')
        self.assertEqual(relations['財']['element'], '水')
        self.assertEqual(relations['印']['rank'], 1)
        self.assertEqual({g: r['role'] for g, r in relations.items()},
                         {'比劫': '忌', '印': '忌', '食傷': '喜', '財': '喜', '官': '中'})
        self.assertNotIn('notable_facts', data)
        self.assertNotIn('element_groups', data)
        self.assertEqual(data['pillars']['year']['stem'], '乙')
        self.assertEqual(data['pillars']['year']['stem_star'], '偏官')
        self.assertEqual(data['pillars']['day']['stem_star'], '日干')
        self.assertIn({'stem': '己', 'kind': '本気', 'star': '比肩'}, data['pillars']['year']['hidden'])
        self.assertEqual(data['strength'], {'label': '身旺', 'diff': 17.5})
        self.assertEqual(data['kakukyoku'], '傷官格')
        self.assertEqual([a['key'] for a in data['abilities']], svc.ABILITY_KEYS)
        self.assertEqual(data['jobs'][2]['weights'], {'企画': 0.5, '知略': 0.5})
        self.assertIsNone(data['context'])
        self.assertNotIn('inputs', data)

    def test_applied_rules_for_ishikawa(self):
        rules = svc.build_insight_input(self.calc)['applied_rules']
        titles = [r['title'] for r in rules]
        self.assertIn('傷官見官', titles)
        self.assertIn('財星がほぼない', titles)
        self.assertIn('印が最も強い身旺', titles)
        self.assertIn('食傷が強い', titles)
        self.assertNotIn('官星がほぼない', titles)
        self.assertIn('財星がほぼない（財 2.5）', ' '.join(r['interpretation'] for r in rules))
        # 石川さんには点数補正のあるルールは当たらない（基準ケースの点数を保つ）
        self.assertTrue(all(r['effects'] == {} for r in rules))

    def test_hour_unknown_drops_hour_pillar(self):
        calc = create_ishikawa_calculation(
            self.user, hour_unknown=True, hour_pillar_heavenly_stem='', hour_pillar_earthly_branch='',
        )
        data = svc.build_insight_input(calc)
        self.assertIsNone(data['pillars']['hour'])
        self.assertTrue(data['hour_unknown'])
        # 時干の傷官がないので傷官見官は検出されない
        self.assertNotIn('傷官見官', [r['title'] for r in data['applied_rules']])

    def test_old_record_not_applicable(self):
        calc = create_ishikawa_calculation(self.user, five_elements_balance_data={})
        with self.assertRaises(svc.InsightNotApplicable):
            svc.build_insight_input(calc)

    def test_context_changes_hash(self):
        a = svc.build_insight_input(self.calc)
        b = svc.build_insight_input(self.calc, context={'occupation': '教室経営'})
        self.assertEqual(b['context'], {'occupation': '教室経営'})
        self.assertNotEqual(
            svc.compute_input_hash(a, 'v1', 'm'), svc.compute_input_hash(b, 'v1', 'm')
        )

    def test_hash_depends_on_prompt_version_and_model(self):
        data = svc.build_insight_input(self.calc)
        base = svc.compute_input_hash(data, 'v1', 'm')
        self.assertEqual(base, svc.compute_input_hash(json.loads(json.dumps(data)), 'v1', 'm'))
        self.assertNotEqual(base, svc.compute_input_hash(data, 'v2', 'm'))
        self.assertNotEqual(base, svc.compute_input_hash(data, 'v1', 'other'))


class NotableRuleTests(SimpleTestCase):
    """注記ルール（旧 skill_facts）が設定ファイルに移っても同じ条件で当たること"""

    def _detect(self, groups, label='身旺', stems=('', '', ''), day_stem='己'):
        pillars = {
            'year_pillar': {'heavenly_stem': stems[0]},
            'month_pillar': {'heavenly_stem': stems[1]},
            'day_pillar': {'heavenly_stem': day_stem},
            'hour_pillar': {'heavenly_stem': stems[2]},
        }
        ctx = skill_rules.RuleContext(
            day_stem=day_stem, strength_label=label, strength_diff=0, element_groups=groups,
            star_points={}, stem_stars=skill_rules.collect_stem_stars(pillars, day_stem),
        )
        return [r['id'] for r in skill_rules.evaluate(ctx)]

    def test_shokan_with_seikan(self):
        # 己日干：庚=傷官、甲=正官
        self.assertIn('shokan_kenkan', self._detect({'比劫': 10, '印': 10, '食傷': 10, '財': 10, '官': 10},
                                                    stems=('甲', '', '庚')))

    def test_no_shokan_kenkan_without_kan(self):
        self.assertNotIn('shokan_kenkan', self._detect({'比劫': 10, '印': 10, '食傷': 10, '財': 10, '官': 10},
                                                       stems=('', '', '庚')))

    def test_in_dominant_requires_mio(self):
        groups = {'比劫': 10, '印': 30, '食傷': 5, '財': 5, '官': 5}
        self.assertIn('in_dominant', self._detect(groups, '身旺'))
        self.assertNotIn('in_dominant', self._detect(groups, '身弱'))

    def test_scarce_and_strong(self):
        ids = self._detect({'比劫': 10, '印': 10, '食傷': 25, '財': 4.9, '官': 0}, '中和')
        self.assertIn('zai_scarce', ids)
        self.assertIn('kan_scarce', ids)
        self.assertIn('shokushou_strong', ids)

    def test_shokushou_not_strong_when_third(self):
        ids = self._detect({'比劫': 30, '印': 30, '食傷': 25, '財': 10, '官': 10}, '身旺')
        self.assertNotIn('shokushou_strong', ids)


class SkillSheetBreakdownTests(TestCase):

    def setUp(self):
        user = User.objects.create_user(username='bd_user', password='x')
        self.sheet = build_skill_sheet(create_ishikawa_calculation(user))

    def test_breakdown_sum_matches_score(self):
        for ability in self.sheet['abilities']:
            with self.subTest(ability=ability['key']):
                raw = sum(item['value'] for item in ability['breakdown'])
                self.assertEqual(ss.clamp_score(ss.round_half_up(raw)), ability['score'])

    def test_kikaku_breakdown(self):
        kikaku = self.sheet['abilities'][0]['breakdown']
        self.assertEqual(kikaku, [
            {'factor': '基礎点', 'value': 30.0},
            {'factor': '食傷の五行', 'value': 25.0},
            {'factor': '食神・傷官の星', 'value': 25.0},
            {'factor': '傷官格', 'value': 10.0},
        ])

    def test_scores_unchanged(self):
        self.assertEqual(
            {a['name']: a['score'] for a in self.sheet['abilities']},
            {'企画': 90, '知略': 82, '実行': 80, '体力': 85, '人望': 65,
             '統率': 50, '開拓': 50, '商才': 35, '管理': 25},
        )
        self.assertEqual(
            {j['name']: (j['score'], j['rank']) for j in self.sheet['jobs']},
            {'教官': (86, 'S'), '軍師': (82, 'A+'), '専門職': (81, 'A+'), '現場L': (65, 'B'),
             '営業': (63, 'B-'), '将軍': (58, 'C+'), '総務': (29, 'D')},
        )

    def test_job_weights(self):
        for job in self.sheet['jobs']:
            with self.subTest(job=job['key']):
                self.assertAlmostEqual(sum(job['weights'].values()), 1.0)


# ---------------------------------------------------------------------------
# 検証・プロンプト
# ---------------------------------------------------------------------------

class ValidateContentTests(SimpleTestCase):

    sheet = {'jobs': [{'key': k} for k in svc.JOB_KEYS], 'abilities': [{'key': k} for k in svc.ABILITY_KEYS]}

    def test_valid_and_normalized_order(self):
        content = make_valid_content(job_keys=list(reversed(svc.JOB_KEYS)))
        result = svc.validate_content(json.dumps(content, ensure_ascii=False), self.sheet)
        self.assertEqual([j['key'] for j in result['jobs']], svc.JOB_KEYS)

    def test_abilities_optional(self):
        result = svc.validate_content(make_valid_content(ability_keys=['kikaku']), self.sheet)
        self.assertEqual([a['key'] for a in result['abilities']], ['kikaku'])

    def test_invalid_cases(self):
        too_long = make_valid_content()
        too_long['jobs'][0]['text'] = 'あ' * 401
        empty = make_valid_content()
        empty['summary'] = '  '
        dup = make_valid_content()
        dup['jobs'].append({'key': 'shogun', 'text': '重複'})
        cases = {
            'not json': '{broken',
            'missing job': make_valid_content(job_keys=svc.JOB_KEYS[:-1]),
            'extra job': make_valid_content(job_keys=svc.JOB_KEYS + ['ceo']),
            'duplicate job': dup,
            'too long': too_long,
            'empty summary': empty,
            'not object': [],
        }
        for name, content in cases.items():
            with self.subTest(name=name):
                with self.assertRaises(svc.InsightValidationError):
                    svc.validate_content(content, self.sheet)


class PromptTests(SimpleTestCase):

    def test_prompt_sections(self):
        for version in ('v1', 'v2'):
            with self.subTest(version=version):
                sections = svc.load_prompt(version)
                self.assertIn('点数・ランクは入力の値をそのまま', sections['system'])
                self.assertIn('{{input_json}}', sections['user'])

    def test_system_prompt_includes_principles_from_rules_file(self):
        system = svc.render_system_prompt('v2')
        self.assertNotIn('{{', system)
        first = skill_rules.load_rules().principles[0]
        self.assertIn(f'1. {first}', system)
        self.assertIn('日干を最重要の起点', system)

    def test_context_block_only_when_context(self):
        without = svc.render_user_prompt({'context': None, 'x': 1})
        self.assertNotIn('本人について', without)
        self.assertNotIn('{{', without)
        with_ctx = svc.render_user_prompt({'context': {'occupation': '教室経営'}, 'x': 1})
        self.assertIn('本人について', with_ctx)
        self.assertIn('教室経営', with_ctx)
        self.assertNotIn('{{', with_ctx)

    def test_validate_context(self):
        self.assertIsNone(svc.validate_context(None))
        self.assertIsNone(svc.validate_context({}))
        self.assertEqual(svc.validate_context({'age': 41, 'note': ' 参謀役 '}), {'age': 41, 'note': '参謀役'})
        for bad in ({'age': '41'}, {'age': True}, {'salary': 1}, {'note': 1}, 'text'):
            with self.subTest(bad=bad):
                with self.assertRaises(ValueError):
                    svc.validate_context(bad)


# ---------------------------------------------------------------------------
# API
# ---------------------------------------------------------------------------

@override_settings(**ENABLED_SETTINGS)
class SkillInsightApiTests(NoNetworkMixin, TestCase):

    def setUp(self):
        super().setUp()
        self.user = User.objects.create_user(username='api_user', password='TestPass123!')
        self.calc = create_ishikawa_calculation(self.user)
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.url = f'/api/fortune/history/{self.calc.pk}/skill-insight/'

    def ok(self, **kwargs):
        return FakeResponse(json.dumps(make_valid_content(**kwargs), ensure_ascii=False))

    def test_get_without_insight(self):
        res = self.client.get(self.url)
        self.assertEqual(res.status_code, 200)
        self.assertIsNone(res.data['insight'])
        self.assertTrue(res.data['available'])

    def test_generate_and_save(self):
        fake = self.use_fake(self.ok())
        res = self.client.post(self.url, {'regenerate': False, 'context': None}, format='json')
        self.assertEqual(res.status_code, 200)
        insight = res.data['insight']
        self.assertFalse(insight['is_cached'])
        self.assertEqual(insight['model_name'], 'gemini-test-model')
        self.assertEqual(insight['prompt_version'], svc.PROMPT_VERSION)
        self.assertEqual(len(insight['jobs']), 7)
        saved = SkillInsight.objects.get()
        self.assertEqual((saved.input_tokens, saved.output_tokens), (1200, 800))
        self.assertEqual(saved.created_by, self.user)
        # 送信内容：構造化出力の指定と、個人情報を含まないこと
        call = fake.calls[0]
        self.assertEqual(call['model'], 'gemini-test-model')
        self.assertEqual(call['config'].response_mime_type, 'application/json')
        self.assertIs(call['config'].response_schema, svc.InsightResponse)
        self.assertNotIn('石川憂樹', call['contents'])
        self.assertNotIn('岐阜', call['contents'])
        self.assertIn('傷官見官', call['contents'])
        # GET で最新キャッシュが返る
        res = self.client.get(self.url)
        self.assertTrue(res.data['insight']['is_cached'])
        self.assertEqual(res.data['insight']['summary'], insight['summary'])

    def test_skill_sheet_scores_not_changed_by_llm(self):
        self.use_fake(self.ok())
        before = self.client.get(f'/api/fortune/history/{self.calc.pk}/').data['skill_sheet']
        self.client.post(self.url, {}, format='json')
        after = self.client.get(f'/api/fortune/history/{self.calc.pk}/').data['skill_sheet']
        self.assertEqual(before, after)

    def test_cache_hit_calls_gemini_once(self):
        fake = self.use_fake(self.ok())
        first = self.client.post(self.url, {'regenerate': False}, format='json')
        second = self.client.post(self.url, {'regenerate': False}, format='json')
        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertTrue(second.data['insight']['is_cached'])
        self.assertEqual(len(fake.calls), 1)
        self.assertEqual(SkillInsight.objects.count(), 1)

    def test_get_returns_insight_matching_current_scores(self):
        self.use_fake(self.ok())
        self.client.post(self.url, {'regenerate': False}, format='json')
        res = self.client.get(self.url)
        self.assertIsNotNone(res.data['insight'])
        self.assertEqual(res.data['insight']['summary'], '印と食傷が強い命式です。')

    def test_get_hides_insight_when_rules_or_scores_changed(self):
        self.use_fake(self.ok())
        self.client.post(self.url, {'regenerate': False}, format='json')
        # 解釈ルールの変更などで入力が変わった状態（保存済みの input_hash と一致しない）
        SkillInsight.objects.update(input_hash='0' * 64)
        res = self.client.get(self.url)
        self.assertIsNone(res.data['insight'])

    def test_get_ignores_insight_from_old_prompt_version(self):
        self.use_fake(self.ok())
        self.client.post(self.url, {'regenerate': False}, format='json')
        SkillInsight.objects.update(prompt_version='v1')
        self.assertIsNone(self.client.get(self.url).data['insight'])

    def test_system_prompt_sent_to_gemini_has_principles(self):
        fake = self.use_fake(self.ok())
        self.client.post(self.url, {'regenerate': False}, format='json')
        system = fake.calls[0]['config'].system_instruction
        self.assertIn('日干を最重要の起点', system)
        self.assertNotIn('{{principles}}', system)

    def test_regenerate_ignores_cache(self):
        fake = self.use_fake(self.ok(), self.ok())
        self.client.post(self.url, {}, format='json')
        res = self.client.post(self.url, {'regenerate': True}, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertFalse(res.data['insight']['is_cached'])
        self.assertEqual(len(fake.calls), 2)
        self.assertEqual(SkillInsight.objects.count(), 2)

    def test_daily_limit(self):
        fake = self.use_fake(self.ok(), self.ok())
        with self.settings(SKILL_INSIGHT_DAILY_LIMIT=2):
            self.assertEqual(self.client.post(self.url, {}, format='json').status_code, 200)
            # キャッシュ命中は上限に数えない
            self.assertEqual(self.client.post(self.url, {}, format='json').status_code, 200)
            self.assertEqual(self.client.post(self.url, {'regenerate': True}, format='json').status_code, 200)
            res = self.client.post(self.url, {'regenerate': True}, format='json')
            self.assertEqual(res.status_code, 429)
            self.assertEqual(res.data['detail'], '本日の生成回数の上限に達しました')
            # 上限到達後もキャッシュ命中なら返せる
            self.assertEqual(self.client.post(self.url, {}, format='json').status_code, 200)
        self.assertEqual(len(fake.calls), 2)

    def test_validation_retry_then_success(self):
        fake = self.use_fake(FakeResponse('{broken'), self.ok())
        res = self.client.post(self.url, {}, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(fake.calls), 2)
        saved = SkillInsight.objects.get()
        self.assertEqual((saved.input_tokens, saved.output_tokens), (2400, 1600))  # 2回分の合計

    def test_validation_fails_twice_returns_502(self):
        fake = self.use_fake(FakeResponse('{broken'), self.ok(job_keys=svc.JOB_KEYS[:3]), self.ok())
        res = self.client.post(self.url, {}, format='json')
        self.assertEqual(res.status_code, 502)
        self.assertEqual(res.data['detail'], '生成に失敗しました。時間をおいて再度お試しください')
        self.assertEqual(len(fake.calls), 2)  # 再試行は1回だけ
        self.assertEqual(SkillInsight.objects.count(), 0)

    def test_gemini_error_returns_502_and_key_not_logged(self):
        self.use_fake(RuntimeError(f'403 PERMISSION_DENIED for key={FAKE_KEY}'))
        with self.assertLogs('apps.fortune.insight_service', level='WARNING') as logs:
            res = self.client.post(self.url, {}, format='json')
        self.assertEqual(res.status_code, 502)
        output = '\n'.join(logs.output)
        self.assertIn('RuntimeError', output)
        self.assertNotIn(FAKE_KEY, output)
        self.assertNotIn(FAKE_KEY, json.dumps(res.data))
        self.assertEqual(SkillInsight.objects.count(), 0)

    def test_other_users_record_404(self):
        other = User.objects.create_user(username='other', password='x')
        other_calc = create_ishikawa_calculation(other)
        url = f'/api/fortune/history/{other_calc.pk}/skill-insight/'
        self.assertEqual(self.client.get(url).status_code, 404)
        self.assertEqual(self.client.post(url, {}, format='json').status_code, 404)

    def test_requires_authentication(self):
        anon = APIClient()
        self.assertEqual(anon.get(self.url).status_code, 401)
        self.assertEqual(anon.post(self.url, {}, format='json').status_code, 401)

    def test_old_record_returns_400(self):
        calc = create_ishikawa_calculation(self.user, five_elements_balance_data={})
        res = self.client.post(f'/api/fortune/history/{calc.pk}/skill-insight/', {}, format='json')
        self.assertEqual(res.status_code, 400)
        self.get_client_mock.assert_not_called()

    def test_invalid_body_returns_400(self):
        self.assertEqual(self.client.post(self.url, {'regenerate': 'yes'}, format='json').status_code, 400)
        self.assertEqual(self.client.post(self.url, {'context': {'salary': 1}}, format='json').status_code, 400)
        self.get_client_mock.assert_not_called()

    def test_context_creates_separate_cache(self):
        fake = self.use_fake(self.ok(), self.ok())
        self.client.post(self.url, {}, format='json')
        res = self.client.post(self.url, {'context': {'occupation': '教室経営'}}, format='json')
        self.assertFalse(res.data['insight']['is_cached'])
        self.assertEqual(len(fake.calls), 2)
        self.assertIn('本人について', fake.calls[1]['contents'])
        self.assertEqual(SkillInsight.objects.first().context, {'occupation': '教室経営'})

    def test_api_key_not_in_responses(self):
        self.use_fake(self.ok())
        for res in (self.client.get(self.url), self.client.post(self.url, {}, format='json'),
                    self.client.get(f'/api/fortune/history/{self.calc.pk}/')):
            self.assertNotIn(FAKE_KEY, json.dumps(res.data, ensure_ascii=False, default=str))


class SkillInsightUnavailableTests(NoNetworkMixin, TestCase):

    def setUp(self):
        super().setUp()
        self.user = User.objects.create_user(username='na_user', password='x')
        self.calc = create_ishikawa_calculation(self.user)
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.url = f'/api/fortune/history/{self.calc.pk}/skill-insight/'

    def assert_unavailable(self, **overrides):
        with self.settings(**{**ENABLED_SETTINGS, **overrides}):
            res = self.client.post(self.url, {}, format='json')
            self.assertEqual(res.status_code, 503)
            self.assertEqual(res.data['detail'], '現在、判定の要点は生成できません')
            self.assertFalse(self.client.get(self.url).data['available'])
        self.get_client_mock.assert_not_called()

    def test_api_key_missing(self):
        self.assert_unavailable(GEMINI_API_KEY='')

    def test_paid_tier_not_confirmed(self):
        svc._paid_tier_warning_logged = False
        with self.assertLogs('apps.fortune.insight_service', level='WARNING') as logs:
            self.assert_unavailable(GEMINI_PAID_TIER_CONFIRMED=False)
        output = '\n'.join(logs.output)
        self.assertIn('GEMINI_PAID_TIER_CONFIRMED', output)
        self.assertNotIn(FAKE_KEY, output)

    def test_feature_disabled(self):
        self.assert_unavailable(SKILL_INSIGHT_ENABLED=False)
