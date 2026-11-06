# -*- coding: utf-8 -*-
"""
判定の要点（LLM生成）サービス層

鑑定スキル表（skill_sheet）の点数・ランクを正とし、Gemini API には根拠の説明文だけを書かせる。
仕様: doc/判定の要点生成.md

- 個人情報を扱うため、Gemini は有料枠のキーでのみ使う。
  settings.GEMINI_PAID_TIER_CONFIRMED / SKILL_INSIGHT_ENABLED / GEMINI_API_KEY がそろったときだけ有効。
- 氏名・ユーザー名・生年月日・出生時刻・出生地は Gemini に送らない。
- APIキーはログ・エラーメッセージ・レスポンスに出さない。
"""

import enum
import hashlib
import json
import logging
import re
from datetime import timedelta
from functools import lru_cache
from pathlib import Path
from typing import List

from django.conf import settings
from django.utils import timezone
from pydantic import BaseModel

from .calculators import get_heavenly_star, get_hidden_stems_full
from .models import SkillInsight
from .serializers import build_skill_sheet, pillars_from_calculation
from . import skill_rules
from .skill_sheet import ABILITIES, JOBS

logger = logging.getLogger(__name__)

PROMPT_VERSION = 'v2'
PROMPT_DIR = Path(__file__).resolve().parent / 'prompts'

MAX_TEXT_LENGTH = 400
MAX_ATTEMPTS = 2  # 検証に失敗したら1回だけ再試行する
GENERATION_TEMPERATURE = 0.4

# 本人コンテキスト（将来対応）で受け付ける項目
CONTEXT_STRING_FIELDS = ('occupation', 'position', 'industry', 'note')
CONTEXT_MAX_STRING_LENGTH = 500
CONTEXT_MAX_AGE = 130

PILLAR_LABELS = (
    ('year', 'year_pillar'),
    ('month', 'month_pillar'),
    ('day', 'day_pillar'),
    ('hour', 'hour_pillar'),
)
HIDDEN_KINDS = ('本気', '中気', '余気')

JOB_KEYS = [j['key'] for j in JOBS]
ABILITY_KEYS = [a['key'] for a in ABILITIES]


# ---------------------------------------------------------------------------
# 例外（ビューで HTTP ステータスに変換する）
# ---------------------------------------------------------------------------

class InsightError(Exception):
    status_code = 500
    message = '判定の要点を処理できませんでした'

    def __init__(self, message=None):
        super().__init__(message or self.message)
        self.message = message or self.message


class InsightUnavailable(InsightError):
    status_code = 503
    message = '現在、判定の要点は生成できません'


class InsightRateLimited(InsightError):
    status_code = 429
    message = '本日の生成回数の上限に達しました'


class InsightGenerationFailed(InsightError):
    status_code = 502
    message = '生成に失敗しました。時間をおいて再度お試しください'


class InsightNotApplicable(InsightError):
    status_code = 400
    message = 'この鑑定表では判定の要点を生成できません'


class InsightValidationError(Exception):
    """LLM の応答が検証に通らない（内部用。再試行の判定に使う）"""


# ---------------------------------------------------------------------------
# 設定・有効判定
# ---------------------------------------------------------------------------

_paid_tier_warning_logged = False


def get_model_name():
    return settings.GEMINI_MODEL


def is_available():
    """
    機能が使えるかどうか。
    有料枠の確認（GEMINI_PAID_TIER_CONFIRMED=True）・機能オン・APIキー設定済みのときだけ True。
    """
    global _paid_tier_warning_logged
    if not getattr(settings, 'GEMINI_PAID_TIER_CONFIRMED', False):
        if not _paid_tier_warning_logged:
            logger.warning(
                '判定の要点: GEMINI_PAID_TIER_CONFIRMED が True ではないため、機能を無効にしています。'
                '有料枠（課金を有効にしたプロジェクト）のキーであることを確認してから True にしてください。'
            )
            _paid_tier_warning_logged = True
        return False
    if not getattr(settings, 'SKILL_INSIGHT_ENABLED', False):
        return False
    if not getattr(settings, 'GEMINI_API_KEY', ''):
        return False
    return True


def _redact(text):
    """ログに出す文字列から APIキーを取り除く"""
    text = str(text)
    key = getattr(settings, 'GEMINI_API_KEY', '')
    if key:
        text = text.replace(key, '[REDACTED]')
    # Google APIキーの形式（AIza...）も念のため伏せる
    return re.sub(r'AIza[0-9A-Za-z_\-]{20,}', '[REDACTED]', text)


# ---------------------------------------------------------------------------
# 入力JSONの組み立て
# ---------------------------------------------------------------------------

def validate_context(context):
    """
    本人コンテキストを検証して正規化する（α版はUIなし。構造のみ）

    Returns:
        dict or None
    Raises:
        ValueError: 形式が不正な場合
    """
    if context is None:
        return None
    if not isinstance(context, dict):
        raise ValueError('context はオブジェクトで指定してください')
    unknown = set(context) - set(CONTEXT_STRING_FIELDS) - {'age'}
    if unknown:
        raise ValueError(f'context に未対応の項目があります: {", ".join(sorted(unknown))}')

    result = {}
    age = context.get('age')
    if age is not None:
        if isinstance(age, bool) or not isinstance(age, int) or not 0 <= age <= CONTEXT_MAX_AGE:
            raise ValueError('context.age は 0〜130 の整数で指定してください')
        result['age'] = age
    for field in CONTEXT_STRING_FIELDS:
        value = context.get(field)
        if value is None:
            continue
        if not isinstance(value, str):
            raise ValueError(f'context.{field} は文字列で指定してください')
        value = value.strip()
        if len(value) > CONTEXT_MAX_STRING_LENGTH:
            raise ValueError(f'context.{field} は{CONTEXT_MAX_STRING_LENGTH}文字以内で指定してください')
        if value:
            result[field] = value
    return result or None


def _pillar_input(pillar, day_stem, is_day):
    stem = pillar.get('heavenly_stem') or ''
    branch = pillar.get('earthly_branch') or ''
    hidden_full = get_hidden_stems_full(branch) if branch else {}
    hidden = [
        {'stem': hidden_full[kind], 'kind': kind, 'star': get_heavenly_star(day_stem, hidden_full[kind])}
        for kind in HIDDEN_KINDS
        if hidden_full.get(kind)
    ]
    return {
        'stem': stem,
        'branch': branch,
        'stem_star': '日干' if is_day else get_heavenly_star(day_stem, stem),
        'hidden': hidden,
    }


def build_insight_input(calculation, context=None, skill_sheet=None):
    """
    Gemini に渡す入力JSONを組み立てる。
    氏名・ユーザー名・生年月日・出生時刻・出生地は含めない。

    Raises:
        InsightNotApplicable: スキル表を算出できない古いレコード
    """
    sheet = skill_sheet or build_skill_sheet(calculation)
    if sheet is None:
        raise InsightNotApplicable()

    day_stem = calculation.day_pillar_heavenly_stem
    hour_unknown = bool(calculation.hour_unknown)
    pillars = pillars_from_calculation(calculation)

    pillar_input = {}
    for label, key in PILLAR_LABELS:
        if key == 'hour_pillar' and hour_unknown:
            pillar_input[label] = None
            continue
        pillar_input[label] = _pillar_input(pillars[key], day_stem, is_day=(key == 'day_pillar'))

    ruleset = skill_rules.load_rules()
    strength_label = sheet['strength']['label']

    # 日干を起点に読ませるため、日干の性質 → 日干から見た五行の関係 → 適用ルール の順で渡す
    return {
        'rules_version': sheet.get('rules_version', ruleset.fingerprint),
        'day_stem': skill_rules.day_stem_info(day_stem, sheet.get('day_stem_type', ''), ruleset),
        'strength': sheet['strength'],
        'element_relations': skill_rules.element_relations(
            day_stem, sheet['inputs']['element_groups'], strength_label, ruleset
        ),
        'kakukyoku': sheet['kakukyoku'],
        'pillars': pillar_input,
        'hour_unknown': hour_unknown,
        'star_points': sheet['inputs']['star_points'],
        'applied_rules': [
            {k: r[k] for k in ('title', 'interpretation', 'effects')}
            for r in sheet.get('applied_rules', [])
        ],
        'abilities': [
            {k: a[k] for k in ('key', 'name', 'meaning', 'score', 'breakdown')}
            for a in sheet['abilities']
        ],
        'jobs': [
            {k: j[k] for k in ('key', 'name', 'meaning', 'score', 'rank', 'weights')}
            for j in sheet['jobs']
        ],
        'context': validate_context(context),
    }


def compute_input_hash(input_json, prompt_version, model_name):
    """入力JSON（context を含む）+ プロンプト版数 + モデル名の SHA-256"""
    payload = json.dumps(
        {'input': input_json, 'prompt_version': prompt_version, 'model_name': model_name},
        sort_keys=True,
        ensure_ascii=False,
        separators=(',', ':'),
    )
    return hashlib.sha256(payload.encode('utf-8')).hexdigest()


# ---------------------------------------------------------------------------
# プロンプト
# ---------------------------------------------------------------------------

_SECTION_RE = re.compile(r'^<!-- section: (\w+) -->\s*$', re.MULTILINE)


@lru_cache(maxsize=None)
def load_prompt(version=PROMPT_VERSION):
    """prompts/skill_insight_<version>.md を読み、セクションごとの dict を返す"""
    text = (PROMPT_DIR / f'skill_insight_{version}.md').read_text(encoding='utf-8')
    parts = _SECTION_RE.split(text)
    # parts = [前置き, 名前1, 本文1, 名前2, 本文2, ...]
    sections = {parts[i]: parts[i + 1].strip() for i in range(1, len(parts) - 1, 2)}
    for name in ('system', 'user', 'context'):
        if name not in sections:
            raise RuntimeError(f'プロンプトに section: {name} がありません（{version}）')
    return sections


def render_system_prompt(version=PROMPT_VERSION, ruleset=None):
    """システム指示。{{principles}} を解釈ルール設定の principles（番号付き）に置き換える"""
    ruleset = ruleset or skill_rules.load_rules()
    principles = '\n'.join(f'{i}. {p}' for i, p in enumerate(ruleset.principles, 1))
    return load_prompt(version)['system'].replace('{{principles}}', principles or '（なし）')


def render_user_prompt(input_json, version=PROMPT_VERSION):
    sections = load_prompt(version)
    context = input_json.get('context')
    context_block = ''
    if context:
        context_block = '\n' + sections['context'].replace(
            '{{context_json}}', json.dumps(context, ensure_ascii=False, indent=2)
        )
    return (
        sections['user']
        .replace('{{input_json}}', json.dumps(input_json, ensure_ascii=False, indent=2))
        .replace('{{context_block}}', context_block)
    )


# ---------------------------------------------------------------------------
# Gemini 呼び出し
# ---------------------------------------------------------------------------

JobKey = enum.Enum('JobKey', {k: k for k in JOB_KEYS}, type=str)
AbilityKey = enum.Enum('AbilityKey', {k: k for k in ABILITY_KEYS}, type=str)


class JobText(BaseModel):
    key: JobKey
    text: str


class AbilityText(BaseModel):
    key: AbilityKey
    text: str


class InsightResponse(BaseModel):
    """構造化出力のスキーマ（§5-2）"""
    summary: str
    jobs: List[JobText]
    abilities: List[AbilityText]
    advice: str


def _get_client(api_key, timeout_seconds):
    """Gemini クライアントを作る（テストではこの関数を差し替える）"""
    from google import genai
    from google.genai import types

    return genai.Client(
        api_key=api_key,
        http_options=types.HttpOptions(timeout=int(timeout_seconds * 1000)),
    )


def call_gemini(input_json):
    """
    Gemini で判定の要点を生成する

    Returns:
        (content, usage): content は応答テキスト（JSON文字列）、usage は
        {'input_tokens': int|None, 'output_tokens': int|None}
    """
    from google.genai import types

    system_prompt = render_system_prompt(PROMPT_VERSION)
    client = _get_client(settings.GEMINI_API_KEY, settings.GEMINI_TIMEOUT_SECONDS)
    response = client.models.generate_content(
        model=get_model_name(),
        contents=render_user_prompt(input_json),
        config=types.GenerateContentConfig(
            system_instruction=system_prompt,
            response_mime_type='application/json',
            response_schema=InsightResponse,
            temperature=GENERATION_TEMPERATURE,
        ),
    )
    usage_meta = getattr(response, 'usage_metadata', None)
    usage = {
        'input_tokens': getattr(usage_meta, 'prompt_token_count', None),
        'output_tokens': getattr(usage_meta, 'candidates_token_count', None),
    }
    return response.text, usage


# ---------------------------------------------------------------------------
# 応答の検証
# ---------------------------------------------------------------------------

def _check_text(value, label):
    if not isinstance(value, str) or not value.strip():
        raise InsightValidationError(f'{label} が空です')
    value = value.strip()
    if len(value) > MAX_TEXT_LENGTH:
        raise InsightValidationError(f'{label} が{MAX_TEXT_LENGTH}字を超えています')
    return value


def _check_items(items, allowed_keys, label, require_all):
    if not isinstance(items, list):
        raise InsightValidationError(f'{label} が配列ではありません')
    texts = {}
    for item in items:
        if not isinstance(item, dict):
            raise InsightValidationError(f'{label} の要素がオブジェクトではありません')
        key = item.get('key')
        if key not in allowed_keys:
            raise InsightValidationError(f'{label} に不明な key があります: {key!r}')
        if key in texts:
            raise InsightValidationError(f'{label} の key が重複しています: {key}')
        texts[key] = _check_text(item.get('text'), f'{label}.{key}')
    if require_all:
        missing = [k for k in allowed_keys if k not in texts]
        if missing:
            raise InsightValidationError(f'{label} に不足があります: {", ".join(missing)}')
    # 表示順（skill_sheet の順）にそろえる
    return [{'key': k, 'text': texts[k]} for k in allowed_keys if k in texts]


def validate_content(content, skill_sheet):
    """
    LLM の応答を検証し、正規化した content を返す

    - JSONとして解釈でき、スキーマに合うこと
    - jobs の key が7職種すべてそろい、余分な key がないこと（abilities は任意）
    - text が空でなく、1項目400字以内
    """
    if isinstance(content, str):
        try:
            content = json.loads(content)
        except (TypeError, ValueError):
            raise InsightValidationError('JSONとして解釈できません')
    if not isinstance(content, dict):
        raise InsightValidationError('応答がオブジェクトではありません')

    job_keys = [j['key'] for j in skill_sheet['jobs']]
    ability_keys = [a['key'] for a in skill_sheet['abilities']]
    return {
        'summary': _check_text(content.get('summary'), 'summary'),
        'jobs': _check_items(content.get('jobs'), job_keys, 'jobs', require_all=True),
        'abilities': _check_items(content.get('abilities', []), ability_keys, 'abilities', require_all=False),
        'advice': _check_text(content.get('advice'), 'advice'),
    }


# ---------------------------------------------------------------------------
# 生成の全体フロー
# ---------------------------------------------------------------------------

def get_current_insight(calculation, skill_sheet=None, max_candidates=10):
    """
    今の鑑定スキル表と一致する入力で生成された判定の要点のうち、最新のものを返す

    解釈ルールやプロンプトを変えて点数・入力が変わった場合、古い解説は点数と食い違うので返さない
    （画面には生成ボタンが出て、新しい点数で生成し直せる）。
    """
    skill_sheet = skill_sheet or build_skill_sheet(calculation)
    if skill_sheet is None:
        return None
    candidates = SkillInsight.objects.filter(
        calculation=calculation, prompt_version=PROMPT_VERSION
    )[:max_candidates]
    inputs = {}
    for insight in candidates:
        key = json.dumps(insight.context, sort_keys=True, ensure_ascii=False)
        if key not in inputs:
            try:
                inputs[key] = build_insight_input(calculation, context=insight.context, skill_sheet=skill_sheet)
            except ValueError:
                continue
        if compute_input_hash(inputs[key], insight.prompt_version, insight.model_name) == insight.input_hash:
            return insight
    return None


def count_today_generations(user):
    start = timezone.localtime().replace(hour=0, minute=0, second=0, microsecond=0)
    return SkillInsight.objects.filter(
        created_by=user, created_at__gte=start, created_at__lt=start + timedelta(days=1)
    ).count()


def _generate_with_retry(input_json, skill_sheet):
    total = {'input_tokens': None, 'output_tokens': None}

    def add_usage(usage):
        for k in total:
            if usage.get(k) is not None:
                total[k] = (total[k] or 0) + usage[k]

    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            raw, usage = call_gemini(input_json)
        except Exception as e:  # SDK の各種エラー・タイムアウト
            logger.error('判定の要点: Gemini 呼び出しに失敗しました（%s）: %s',
                         type(e).__name__, _redact(e))
            raise InsightGenerationFailed()
        add_usage(usage or {})
        try:
            return validate_content(raw, skill_sheet), total
        except InsightValidationError as e:
            logger.warning('判定の要点: 応答の検証に失敗しました（%d/%d回目）: %s',
                           attempt, MAX_ATTEMPTS, e)
    raise InsightGenerationFailed()


def generate_insight(calculation, user, regenerate=False, context=None):
    """
    判定の要点を返す（キャッシュがあればそれを、なければ生成して保存）

    Returns:
        (SkillInsight, is_cached)
    Raises:
        InsightUnavailable / InsightNotApplicable / InsightRateLimited / InsightGenerationFailed
        ValueError: context の形式が不正
    """
    if not is_available():
        raise InsightUnavailable()

    context = validate_context(context)
    skill_sheet = build_skill_sheet(calculation)
    if skill_sheet is None:
        raise InsightNotApplicable()
    input_json = build_insight_input(calculation, context=context, skill_sheet=skill_sheet)
    model_name = get_model_name()
    input_hash = compute_input_hash(input_json, PROMPT_VERSION, model_name)

    if not regenerate:
        cached = SkillInsight.objects.filter(calculation=calculation, input_hash=input_hash).first()
        if cached:
            return cached, True

    if count_today_generations(user) >= settings.SKILL_INSIGHT_DAILY_LIMIT:
        raise InsightRateLimited()

    content, usage = _generate_with_retry(input_json, skill_sheet)
    insight = SkillInsight.objects.create(
        calculation=calculation,
        input_hash=input_hash,
        prompt_version=PROMPT_VERSION,
        model_name=model_name,
        context=context,
        content=content,
        input_tokens=usage['input_tokens'],
        output_tokens=usage['output_tokens'],
        created_by=user,
    )
    logger.info('判定の要点を生成しました（calculation=%s, model=%s, tokens=%s/%s）',
                calculation.pk, model_name, usage['input_tokens'], usage['output_tokens'])
    return insight, False


def insight_to_dict(insight, is_cached):
    content = insight.content or {}
    return {
        'summary': content.get('summary', ''),
        'jobs': content.get('jobs', []),
        'abilities': content.get('abilities', []),
        'advice': content.get('advice', ''),
        'model_name': insight.model_name,
        'prompt_version': insight.prompt_version,
        'created_at': insight.created_at.isoformat(),
        'is_cached': is_cached,
    }
