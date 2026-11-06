# -*- coding: utf-8 -*-
"""
解釈ルール（rules/skill_rules.toml）の読み込みと判定

- 鑑定スキル表の点数補正（adjust）と、判定の要点（LLM）に渡す解釈の両方に使う。
- ファイルの更新時刻を見て読み直すため、書き換えはサーバーを再起動せずに反映される。
- 書式の誤りは RulesConfigError（どのルールのどの項目かを含む）で知らせる。
- Django 非依存。仕様: doc/解釈ルール設定.md
"""

import hashlib
import string
import threading
import tomllib
from dataclasses import dataclass, field
from decimal import Decimal
from pathlib import Path

from .calculators import STEM_TO_ELEMENT, get_heavenly_star

RULES_PATH = Path(__file__).resolve().parent / 'rules' / 'skill_rules.toml'

ELEMENT_GROUPS = ['比劫', '印', '食傷', '財', '官']
ALL_STARS = ['比肩', '劫財', '食神', '傷官', '偏財', '正財', '偏官', '正官', '偏印', '印綬']
STRENGTH_LABELS = ['身旺', '身弱', '中和']
ROLES = ['喜', '忌', '中']
ABILITY_KEYS = ['kikaku', 'chiryaku', 'jikkou', 'tairyoku', 'jinbou', 'touritsu', 'kaitaku', 'shousai', 'kanri']
STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']
YANG_STEMS = ('甲', '丙', '戊', '庚', '壬')
STRENGTH_DIFF_NAME = '身旺度'

ELEMENT_KANJI = {'wood': '木', 'fire': '火', 'earth': '土', 'metal': '金', 'water': '水'}
ELEMENT_CYCLE = ['wood', 'fire', 'earth', 'metal', 'water']

# 日干から見た各グループの関係（相生・相剋）
GROUP_RELATIONS = {
    '比劫': '日干と同じ五行（自分自身の力・仲間）',
    '印': '日干を生じる（支え・学び・吸収）',
    '食傷': '日干が生じる（表現・出力・形にする力）',
    '財': '日干が剋す（扱う対象・お金・成果）',
    '官': '日干を剋す（規律・組織・プレッシャー）',
}
GROUP_OFFSETS = {'比劫': 0, '食傷': 1, '財': 2, '官': 3, '印': 4}

# 天干として見る柱（日干そのものは除く）
STEM_PILLARS = ['year_pillar', 'month_pillar', 'hour_pillar']

CONDITION_KEYS = {
    'strength', 'day_stem', 'day_element', 'top_group', 'group_at_least', 'group_below',
    'group_rank_within', 'strength_diff_at_least', 'strength_diff_below', 'kakukyoku_any', 'stem_stars',
}
ADJUST_KEYS = {'ability', 'value', 'per', 'min', 'max'}
PER_NAMES = set(ELEMENT_GROUPS) | set(ALL_STARS) | {STRENGTH_DIFF_NAME}


class RulesConfigError(Exception):
    """設定ファイルの書式の誤り（ValueError ではないので、計算エラーと混同して握りつぶされない）"""


@dataclass
class Adjustment:
    ability: str
    value: Decimal
    per: tuple = ()
    min: Decimal = None
    max: Decimal = None


@dataclass
class Rule:
    id: str
    title: str
    when: dict
    interpretation: str = ''
    adjust: list = field(default_factory=list)


@dataclass
class RuleSet:
    version: str
    fingerprint: str
    principles: list
    strength_roles: dict
    day_stems: dict
    rules: list


@dataclass
class RuleContext:
    day_stem: str
    strength_label: str
    strength_diff: float
    element_groups: dict
    star_points: dict
    kakukyoku: str = ''
    stem_stars: list = field(default_factory=list)


# ---------------------------------------------------------------------------
# 読み込み・検証
# ---------------------------------------------------------------------------

def _err(where, message):
    raise RulesConfigError(f'解釈ルール設定の誤り（{where}）: {message}')


def _as_decimal(value, where):
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        _err(where, f'数値で指定してください: {value!r}')
    return Decimal(str(value))


def _check_list(value, allowed, where):
    if isinstance(value, str):
        value = [value]
    if not isinstance(value, list) or not value:
        _err(where, 'リストで指定してください')
    for v in value:
        if v not in allowed:
            _err(where, f'使えない値です: {v!r}（使える値: {"・".join(allowed)}）')
    return value


def _check_group_map(value, where, cast=_as_decimal):
    if not isinstance(value, dict) or not value:
        _err(where, '{ "財" = 30 } の形で指定してください')
    for k, v in value.items():
        if k not in ELEMENT_GROUPS:
            _err(where, f'五行グループ名が不正です: {k!r}')
        cast(v, where)
    return value


def _check_when(when, where):
    if not isinstance(when, dict):
        _err(where, 'when は { ... } の形で指定してください')
    for key, value in when.items():
        w = f'{where} の when.{key}'
        if key not in CONDITION_KEYS:
            _err(w, f'不明な条件です（使える条件: {"・".join(sorted(CONDITION_KEYS))}）')
        if key == 'strength':
            _check_list(value, STRENGTH_LABELS, w)
        elif key == 'day_stem':
            _check_list(value, STEMS, w)
        elif key == 'day_element':
            _check_list(value, list(ELEMENT_KANJI.values()), w)
        elif key == 'top_group':
            _check_list(value, ELEMENT_GROUPS, w)
        elif key in ('group_at_least', 'group_below', 'group_rank_within'):
            _check_group_map(value, w)
        elif key in ('strength_diff_at_least', 'strength_diff_below'):
            _as_decimal(value, w)
        elif key == 'kakukyoku_any':
            if not isinstance(value, list) or not all(isinstance(v, str) and v for v in value):
                _err(w, '格名のリストで指定してください')
        elif key == 'stem_stars':
            if not isinstance(value, list) or not value:
                _err(w, '[["傷官"], ["正官", "偏官"]] の形で指定してください')
            for group in value:
                _check_list(group, ALL_STARS, w)
    return when


def _parse_adjust(items, where):
    if items is None:
        return []
    if not isinstance(items, list):
        _err(where, 'adjust はリストで指定してください')
    result = []
    for i, item in enumerate(items, 1):
        w = f'{where} の adjust {i}件目'
        if not isinstance(item, dict):
            _err(w, '{ ability = "...", value = ... } の形で指定してください')
        unknown = set(item) - ADJUST_KEYS
        if unknown:
            _err(w, f'不明な項目です: {", ".join(sorted(unknown))}')
        if item.get('ability') not in ABILITY_KEYS:
            _err(w, f'ability が不正です: {item.get("ability")!r}（使える値: {", ".join(ABILITY_KEYS)}）')
        if 'value' not in item:
            _err(w, 'value がありません')
        per = item.get('per', [])
        per = [per] if isinstance(per, str) else per
        if not isinstance(per, list):
            _err(w, 'per は名前、または名前のリストで指定してください')
        for name in per:
            if name not in PER_NAMES:
                _err(w, f'per に使えない名前です: {name!r}')
        result.append(Adjustment(
            ability=item['ability'],
            value=_as_decimal(item['value'], w),
            per=tuple(per),
            min=_as_decimal(item['min'], w) if 'min' in item else None,
            max=_as_decimal(item['max'], w) if 'max' in item else None,
        ))
    return result


_FORMAT_NAMES = set(ELEMENT_GROUPS) | set(ALL_STARS) | {STRENGTH_DIFF_NAME, '日干'}


def _check_interpretation(text, where):
    if not isinstance(text, str):
        _err(where, 'interpretation は文字列で指定してください')
    try:
        names = [name for _, name, _, _ in string.Formatter().parse(text) if name is not None]
    except ValueError as e:
        _err(where, f'interpretation の {{ }} の書き方が不正です: {e}')
    for name in names:
        if name not in _FORMAT_NAMES:
            _err(where, f'interpretation で使えない差し込み名です: {{{name}}}')
    return text


def parse_rules(text):
    """TOML 文字列を検証して RuleSet にする"""
    try:
        data = tomllib.loads(text)
    except tomllib.TOMLDecodeError as e:
        raise RulesConfigError(f'解釈ルール設定を読み込めません（TOMLの書式）: {e}')

    principles = data.get('principles', [])
    if not isinstance(principles, list) or not all(isinstance(p, str) for p in principles):
        _err('principles', '文字列のリストで指定してください')

    strength_roles = data.get('strength_roles', {})
    for label in STRENGTH_LABELS:
        roles = strength_roles.get(label)
        if not isinstance(roles, dict):
            _err(f'strength_roles.{label}', '5つの五行グループの役割を指定してください')
        for group in ELEMENT_GROUPS:
            if roles.get(group) not in ROLES:
                _err(f'strength_roles.{label}.{group}', f'喜・忌・中のいずれかで指定してください: {roles.get(group)!r}')

    day_stems = {}
    for stem, profile in (data.get('day_stems') or {}).items():
        where = f'day_stems.{stem}'
        if stem not in STEMS:
            _err(where, '日干名が不正です')
        if not isinstance(profile, dict):
            _err(where, 'nature・strengths・cautions を指定してください')
        for key in ('nature', 'strengths', 'cautions'):
            if not isinstance(profile.get(key, ''), str):
                _err(f'{where}.{key}', '文字列で指定してください')
        day_stems[stem] = {
            'nature': profile.get('nature', ''),
            'strengths': profile.get('strengths', ''),
            'cautions': profile.get('cautions', ''),
            'adjust': _parse_adjust(profile.get('adjust'), where),
        }

    rules = []
    seen = set()
    for i, raw in enumerate(data.get('rules', []), 1):
        rule_id = raw.get('id') if isinstance(raw, dict) else None
        where = f'rules {i}件目（id={rule_id}）'
        if not isinstance(rule_id, str) or not rule_id:
            _err(where, 'id がありません')
        if rule_id in seen:
            _err(where, 'id が重複しています')
        seen.add(rule_id)
        if not isinstance(raw.get('title'), str) or not raw['title']:
            _err(where, 'title がありません')
        rules.append(Rule(
            id=rule_id,
            title=raw['title'],
            when=_check_when(raw.get('when', {}), where),
            interpretation=_check_interpretation(raw.get('interpretation', ''), where),
            adjust=_parse_adjust(raw.get('adjust'), where),
        ))

    version = str(data.get('version', ''))
    digest = hashlib.sha256(text.encode('utf-8')).hexdigest()[:12]
    return RuleSet(
        version=version,
        fingerprint=f'{version}-{digest}',
        principles=principles,
        strength_roles=strength_roles,
        day_stems=day_stems,
        rules=rules,
    )


_cache = {'key': None, 'ruleset': None}
_lock = threading.Lock()


def load_rules(path=RULES_PATH):
    """設定ファイルを読み込む（更新時刻が変わったときだけ読み直す）"""
    path = Path(path)
    stat = path.stat()
    key = (str(path), stat.st_mtime_ns, stat.st_size)
    with _lock:
        if _cache['key'] != key:
            _cache['ruleset'] = parse_rules(path.read_text(encoding='utf-8'))
            _cache['key'] = key
        return _cache['ruleset']


# ---------------------------------------------------------------------------
# 判定
# ---------------------------------------------------------------------------

def collect_stem_stars(pillars, day_stem, hour_unknown=False):
    """天干（日干を除く）の通変星のリスト"""
    stars = []
    for key in STEM_PILLARS:
        if hour_unknown and key == 'hour_pillar':
            continue
        stem = (pillars.get(key) or {}).get('heavenly_stem')
        star = get_heavenly_star(day_stem, stem) if stem else None
        if star:
            stars.append(star)
    return stars


def _rank_of(groups, group):
    value = groups.get(group, 0)
    return 1 + sum(1 for g in ELEMENT_GROUPS if groups.get(g, 0) > value)


def _d(value):
    return Decimal(str(value or 0))


def matches(when, ctx):
    """条件をすべて満たすか"""
    groups = ctx.element_groups

    def as_list(v):
        return [v] if isinstance(v, str) else v

    for key, value in when.items():
        if key == 'strength' and ctx.strength_label not in as_list(value):
            return False
        if key == 'day_stem' and ctx.day_stem not in as_list(value):
            return False
        if key == 'day_element' and ELEMENT_KANJI.get(STEM_TO_ELEMENT.get(ctx.day_stem)) not in as_list(value):
            return False
        if key == 'top_group' and not any(_rank_of(groups, g) == 1 for g in as_list(value)):
            return False
        if key == 'group_at_least' and any(_d(groups.get(g)) < _d(v) for g, v in value.items()):
            return False
        if key == 'group_below' and any(_d(groups.get(g)) >= _d(v) for g, v in value.items()):
            return False
        if key == 'group_rank_within' and any(_rank_of(groups, g) > v for g, v in value.items()):
            return False
        if key == 'strength_diff_at_least' and _d(ctx.strength_diff) < _d(value):
            return False
        if key == 'strength_diff_below' and _d(ctx.strength_diff) >= _d(value):
            return False
        if key == 'kakukyoku_any' and not any(k in (ctx.kakukyoku or '') for k in value):
            return False
        if key == 'stem_stars' and not all(any(s in ctx.stem_stars for s in as_list(g)) for g in value):
            return False
    return True


def _base_value(name, ctx):
    if name in ELEMENT_GROUPS:
        return _d(ctx.element_groups.get(name))
    if name == STRENGTH_DIFF_NAME:
        return _d(ctx.strength_diff)
    return _d(ctx.star_points.get(name))


def adjustment_amount(adj, ctx):
    """補正量（Decimal）。per があれば value × 合計、min/max で範囲を制限"""
    if adj.per:
        amount = adj.value * sum((_base_value(n, ctx) for n in adj.per), Decimal('0'))
    else:
        amount = adj.value
    if adj.min is not None:
        amount = max(adj.min, amount)
    if adj.max is not None:
        amount = min(adj.max, amount)
    return amount


def _fmt(value):
    value = float(value)
    return f'{value:.0f}' if value.is_integer() else f'{value:g}'


def format_interpretation(text, ctx):
    values = {g: _fmt(ctx.element_groups.get(g, 0)) for g in ELEMENT_GROUPS}
    values.update({s: _fmt(ctx.star_points.get(s, 0)) for s in ALL_STARS})
    values[STRENGTH_DIFF_NAME] = _fmt(ctx.strength_diff)
    values['日干'] = ctx.day_stem
    return text.format_map(values)


def evaluate(ctx, ruleset=None):
    """
    条件に合うルールを返す（日干の補正 → [[rules]] の順）

    Returns:
        list[dict]: [{'id', 'title', 'interpretation', 'adjustments': [{'ability', 'value': Decimal}]}]
    """
    ruleset = ruleset or load_rules()
    applied = []

    stem_profile = ruleset.day_stems.get(ctx.day_stem)
    if stem_profile and stem_profile['adjust']:
        applied.append({
            'id': f'day_stem_{ctx.day_stem}',
            'title': f'日干{ctx.day_stem}の性質',
            'interpretation': '',
            'adjustments': [
                {'ability': a.ability, 'value': adjustment_amount(a, ctx)} for a in stem_profile['adjust']
            ],
        })

    for rule in ruleset.rules:
        if not matches(rule.when, ctx):
            continue
        applied.append({
            'id': rule.id,
            'title': rule.title,
            'interpretation': format_interpretation(rule.interpretation, ctx),
            'adjustments': [{'ability': a.ability, 'value': adjustment_amount(a, ctx)} for a in rule.adjust],
        })
    return applied


# ---------------------------------------------------------------------------
# AI解説向けの日干・五行の情報
# ---------------------------------------------------------------------------

def day_stem_info(day_stem, stem_type='', ruleset=None):
    ruleset = ruleset or load_rules()
    profile = ruleset.day_stems.get(day_stem, {})
    return {
        'stem': day_stem,
        'element': ELEMENT_KANJI.get(STEM_TO_ELEMENT.get(day_stem), ''),
        'yin_yang': '陽' if day_stem in YANG_STEMS else '陰',
        'type': stem_type or '',
        'nature': profile.get('nature', ''),
        'strengths': profile.get('strengths', ''),
        'cautions': profile.get('cautions', ''),
    }


def element_relations(day_stem, element_groups, strength_label, ruleset=None):
    """日干から見た5グループの関係・点数・役割（喜忌）"""
    ruleset = ruleset or load_rules()
    roles = ruleset.strength_roles.get(strength_label, {})
    self_index = ELEMENT_CYCLE.index(STEM_TO_ELEMENT[day_stem])
    return [
        {
            'group': group,
            'element': ELEMENT_KANJI[ELEMENT_CYCLE[(self_index + GROUP_OFFSETS[group]) % 5]],
            'relation': GROUP_RELATIONS[group],
            'score': element_groups.get(group, 0),
            'rank': _rank_of(element_groups, group),
            'role': roles.get(group, '中'),
        }
        for group in ELEMENT_GROUPS
    ]
