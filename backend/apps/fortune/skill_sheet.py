# -*- coding: utf-8 -*-
"""
鑑定スキル表（現代ビジネス版）α版

命式（通変星・五行バランス・身旺身弱・格局）から、
9つの能力値と7つの職種ランクを算出する。

- Django 非依存の純粋関数のみで構成する。
- 既存の計算ロジック（calculators.py）は参照のみ。
- 用語・基礎点・重み・ランク帯はこのファイルの定数で調整する。
- 日干と五行の関係による補正は、解釈ルール設定（rules/skill_rules.toml）の adjust で行う。
- 仕様: doc/鑑定スキル表.md、doc/解釈ルール設定.md
"""

from decimal import Decimal, ROUND_HALF_UP

from . import skill_rules
from .calculators import STEM_TO_ELEMENT, get_hidden_stems_full, get_heavenly_star


SKILL_SHEET_VERSION = 'alpha-2'

# ---------------------------------------------------------------------------
# 用語定数（表示順）
# ---------------------------------------------------------------------------

ABILITIES = [
    {'key': 'kikaku', 'name': '企画', 'meaning': 'ゼロから構想を描く'},
    {'key': 'chiryaku', 'name': '知略', 'meaning': '情報を整理し本質を見抜く'},
    {'key': 'jikkou', 'name': '実行', 'meaning': '決めたことを形にしてやり切る'},
    {'key': 'tairyoku', 'name': '体力', 'meaning': '長く集中して動き続ける'},
    {'key': 'jinbou', 'name': '人望', 'meaning': '人に頼られ、集まってもらえる'},
    {'key': 'touritsu', 'name': '統率', 'meaning': 'チームを率いて動かす'},
    {'key': 'kaitaku', 'name': '開拓', 'meaning': '新しい市場や関係に切り込む'},
    {'key': 'shousai', 'name': '商才', 'meaning': '値付け・集金・稼ぐ仕組みづくり'},
    {'key': 'kanri', 'name': '管理', 'meaning': '経理・期限・規程・書類'},
]

JOBS = [
    {'key': 'shogun', 'name': '将軍', 'meaning': '方針を決め、責任を取る経営者'},
    {'key': 'gunshi', 'name': '軍師', 'meaning': '選択肢と勝ち筋を設計する参謀'},
    {'key': 'kyoukan', 'name': '教官', 'meaning': '学びを設計し、人を育てる'},
    {'key': 'senmon', 'name': '専門職', 'meaning': '専門技術で価値を届ける'},
    {'key': 'eigyou', 'name': '営業', 'meaning': '新規顧客や提携先を開拓する'},
    {'key': 'genba', 'name': '現場L', 'meaning': '現場のチームを堅実に回す'},
    {'key': 'soumu', 'name': '総務', 'meaning': 'お金と運営の裏方を支える'},
]

# ---------------------------------------------------------------------------
# 算出用定数
# ---------------------------------------------------------------------------

# 能力値の基礎点（石川さんのサンプル1名で校正した値。α版公開後に見直す前提）
BASE_POINTS = {
    'kikaku': 30,
    'chiryaku': 37,
    'jikkou': 45,
    'tairyoku': 52,
    'jinbou': 40,
    'touritsu': 30,
    'kaitaku': 35,
    'shousai': 30,
    'kanri': 25,
}

# 身旺度による補正 S（実行・統率）
STRENGTH_BONUS = {
    'jikkou': {'身旺': 10, '身弱': -10, '中和': 0},
    'touritsu': {'身旺': 5, '身弱': -5, '中和': 0},
}

# 格補正 K：該当の格名が格局文字列に含まれる場合に加算（同じ能力へは最大1回）
KAKU_BONUS_POINTS = 10
KAKU_BONUS_TARGETS = {
    'kikaku': ['食神格', '傷官格'],
    'chiryaku': ['偏印格', '印綬格'],
    'touritsu': ['正官格', '偏官格'],
    'shousai': ['正財格', '偏財格'],
}

# 職種ランクの重み（能力key: 重み）
JOB_WEIGHTS = {
    'shogun': {'touritsu': 0.3, 'tairyoku': 0.3, 'kaitaku': 0.2, 'shousai': 0.2},
    'gunshi': {'chiryaku': 0.4, 'kikaku': 0.4, 'jinbou': 0.2},
    'kyoukan': {'kikaku': 0.5, 'chiryaku': 0.5},
    'senmon': {'jikkou': 0.5, 'chiryaku': 0.5},
    'eigyou': {'kaitaku': 0.4, 'jinbou': 0.4, 'tairyoku': 0.2},
    'genba': {'touritsu': 0.4, 'tairyoku': 0.3, 'jinbou': 0.3},
    'soumu': {'kanri': 0.6, 'shousai': 0.4},
}

# ランク帯（下限点, ランク）。上から順に判定する
RANK_BANDS = [
    (85, 'S'),
    (80, 'A+'),
    (75, 'A'),
    (70, 'B+'),
    (65, 'B'),
    (60, 'B-'),
    (55, 'C+'),
    (50, 'C'),
    (45, 'C-'),
]
RANK_LOWEST = 'D'

SCORE_MIN = 0
SCORE_MAX = 100

# 通変星点数の重み（doc/五行バランス点数計算.md の手順1〜2と同じ）
STAR_WEIGHT_HEAVENLY = 10
STAR_WEIGHT_HONKI = 10
STAR_WEIGHT_CHUKI = 5
STAR_WEIGHT_YOKI = 5
# 本気20点の地支、および午の特例
STAR_HONKI_20_BRANCHES = ('子', '卯', '酉', '午')
STAR_CHUKI_ZERO_BRANCHES = ('午',)  # 午の中気（己）は0点

ALL_STARS = ['比肩', '劫財', '食神', '傷官', '偏財', '正財', '偏官', '正官', '偏印', '印綬']

# 五行の相生順（木→火→土→金→水→木）
ELEMENT_CYCLE = ['wood', 'fire', 'earth', 'metal', 'water']
ELEMENT_GROUPS = ['比劫', '印', '食傷', '財', '官']

PILLAR_KEYS = ['year_pillar', 'month_pillar', 'day_pillar', 'hour_pillar']


# ---------------------------------------------------------------------------
# 計算関数
# ---------------------------------------------------------------------------

def _to_decimal(value):
    return Decimal(str(value))


def round_half_up(value):
    """四捨五入（0.5は切り上げ）。浮動小数点誤差を避けるため Decimal で計算する"""
    return int(_to_decimal(value).quantize(Decimal('1'), rounding=ROUND_HALF_UP))


def clamp_score(value):
    return max(SCORE_MIN, min(SCORE_MAX, value))




def get_element_groups(day_stem):
    """
    日干を基準に、五行（wood/fire/...）を5グループへ割り当てる

    Returns:
        dict: {'比劫': 'earth', '印': 'fire', '食傷': 'metal', '財': 'water', '官': 'wood'}
    """
    self_element = STEM_TO_ELEMENT.get(day_stem)
    if not self_element:
        raise ValueError(f'不正な日干です: {day_stem!r}')
    i = ELEMENT_CYCLE.index(self_element)
    return {
        '比劫': ELEMENT_CYCLE[i],
        '食傷': ELEMENT_CYCLE[(i + 1) % 5],  # 日干が生じる
        '財': ELEMENT_CYCLE[(i + 2) % 5],    # 日干が剋す
        '官': ELEMENT_CYCLE[(i + 3) % 5],    # 日干を剋す
        '印': ELEMENT_CYCLE[(i + 4) % 5],    # 日干を生じる
    }


def calculate_element_group_scores(day_stem, five_element_scores):
    """五行バランス点数を5グループの点数 E に変換する"""
    groups = get_element_groups(day_stem)
    return {
        group: float(five_element_scores.get(groups[group], 0) or 0)
        for group in ELEMENT_GROUPS
    }


def calculate_star_points(pillars, day_stem, hour_unknown=False):
    """
    通変星点数 P を算出する（日干そのものは含めない）

    Args:
        pillars: {'year_pillar': {'heavenly_stem', 'earthly_branch'}, ...}
        day_stem: 日干
        hour_unknown: True の場合、時柱（天干・蔵干）を除外

    Returns:
        dict: {'比肩': int, ..., '印綬': int}（10星すべてを含む）
    """
    points = {star: 0 for star in ALL_STARS}

    def add(stem, weight):
        if not stem or weight == 0:
            return
        star = get_heavenly_star(day_stem, stem)
        if star in points:
            points[star] += weight

    for key in PILLAR_KEYS:
        if hour_unknown and key == 'hour_pillar':
            continue
        pillar = pillars.get(key) or {}

        # 天干（日柱天干＝日干そのものは除外）
        if key != 'day_pillar':
            add(pillar.get('heavenly_stem'), STAR_WEIGHT_HEAVENLY)

        branch = pillar.get('earthly_branch')
        if not branch:
            continue
        hidden = get_hidden_stems_full(branch)
        honki_weight = 20 if branch in STAR_HONKI_20_BRANCHES else STAR_WEIGHT_HONKI
        chuki_weight = 0 if branch in STAR_CHUKI_ZERO_BRANCHES else STAR_WEIGHT_CHUKI
        add(hidden.get('本気'), honki_weight)
        add(hidden.get('中気'), chuki_weight)
        add(hidden.get('余気'), STAR_WEIGHT_YOKI)

    return points


def calculate_strength(element_group_scores):
    """
    身旺度 D と判定ラベルを返す

    D = (E比劫 + E印) − (E食傷 + E財 + E官)
    D > 0 → 身旺 ／ D < 0 → 身弱 ／ D = 0 → 中和
    """
    e = {g: _to_decimal(element_group_scores.get(g, 0)) for g in ELEMENT_GROUPS}
    diff = (e['比劫'] + e['印']) - (e['食傷'] + e['財'] + e['官'])
    if diff > 0:
        label = '身旺'
    elif diff < 0:
        label = '身弱'
    else:
        label = '中和'
    return float(diff), label


def _matched_kaku(ability_key, kakukyoku):
    """格補正の対象となる格名のうち、格局文字列に含まれるもの"""
    targets = KAKU_BONUS_TARGETS.get(ability_key)
    if not targets or not kakukyoku:
        return []
    return [t for t in targets if t in kakukyoku]


def _kaku_bonus(ability_key, kakukyoku):
    return KAKU_BONUS_POINTS if _matched_kaku(ability_key, kakukyoku) else 0


def _strength_bonus(ability_key, strength_label):
    return STRENGTH_BONUS.get(ability_key, {}).get(strength_label, 0)


def calculate_ability_breakdowns(element_group_scores, star_points, strength_label, kakukyoku):
    """
    能力ごとの算出式の各項（丸め前）を返す

    Returns:
        dict: {能力key: [{'factor': str, 'value': Decimal}, ...]}
        各項の合計が丸め・クランプ前の能力値になる。
    """
    E = {g: _to_decimal(element_group_scores.get(g, 0)) for g in ELEMENT_GROUPS}
    P = {s: _to_decimal(star_points.get(s, 0)) for s in ALL_STARS}
    half = Decimal('0.5')

    terms = {
        'kikaku': [
            ('食傷の五行', E['食傷']),
            ('食神・傷官の星', half * (P['食神'] + P['傷官'])),
        ],
        'chiryaku': [
            ('印の五行', E['印']),
            ('偏印・印綬の星', half * (P['偏印'] + P['印綬'])),
        ],
        'jikkou': [
            ('食傷の五行', half * E['食傷']),
            ('比劫の五行', half * E['比劫']),
        ],
        'tairyoku': [
            ('比劫・印の五行', Decimal('0.6') * (E['比劫'] + E['印'])),
        ],
        'jinbou': [
            ('比肩・食神・偏財の星', half * (P['比肩'] + P['食神'] + P['偏財'])),
        ],
        'touritsu': [
            ('官の五行', E['官']),
            ('正官・偏官の星', half * (P['正官'] + P['偏官'])),
        ],
        'kaitaku': [
            ('偏官の星', P['偏官']),
            ('劫財の星', P['劫財']),
        ],
        'shousai': [
            ('財の五行', E['財']),
            ('正財・偏財の星', half * (P['正財'] + P['偏財'])),
        ],
        'kanri': [
            ('正官の星', P['正官']),
            ('正財の星', P['正財']),
        ],
    }

    breakdowns = {}
    for ability in ABILITIES:
        key = ability['key']
        items = [{'factor': '基礎点', 'value': _to_decimal(BASE_POINTS[key])}]
        items += [{'factor': f, 'value': v} for f, v in terms[key]]
        strength_bonus = _strength_bonus(key, strength_label)
        if strength_bonus:
            items.append({'factor': f'{strength_label}による補正', 'value': _to_decimal(strength_bonus)})
        matched = _matched_kaku(key, kakukyoku)
        if matched:
            items.append({'factor': '・'.join(matched), 'value': _to_decimal(KAKU_BONUS_POINTS)})
        breakdowns[key] = items
    return breakdowns


def scores_from_breakdowns(breakdowns):
    """内訳の合計を丸め・クランプして能力値（整数）にする"""
    return {
        key: clamp_score(round_half_up(sum(item['value'] for item in items)))
        for key, items in breakdowns.items()
    }


def calculate_ability_scores(element_group_scores, star_points, strength_label, kakukyoku):
    """能力値（丸め・クランプ後の整数）を算出する。解釈ルールの補正は含まない"""
    return scores_from_breakdowns(calculate_ability_breakdowns(
        element_group_scores, star_points, strength_label, kakukyoku
    ))


def _sum_effects(adjustments, ability_names):
    """ルールの補正量を能力名ごとに合計する（同じ能力への補正が複数あっても1つにまとめる）"""
    effects = {}
    for adj in adjustments:
        if adj['value'] != 0:
            name = ability_names[adj['ability']]
            effects[name] = effects.get(name, 0) + adj['value']
    return {name: float(value) for name, value in effects.items()}


def apply_rule_adjustments(breakdowns, applied_rules):
    """解釈ルールの補正を、ルール名を factor として内訳に追加する（breakdowns を直接更新）"""
    for rule in applied_rules:
        for adj in rule['adjustments']:
            if adj['value'] != 0:
                breakdowns[adj['ability']].append({'factor': rule['title'], 'value': adj['value']})
    return breakdowns


def _breakdown_for_json(items):
    return [{'factor': item['factor'], 'value': float(item['value'])} for item in items]


def _job_weights_by_name(job_key):
    names = {a['key']: a['name'] for a in ABILITIES}
    return {names[k]: w for k, w in JOB_WEIGHTS[job_key].items()}


def get_rank(score):
    for lower, rank in RANK_BANDS:
        if score >= lower:
            return rank
    return RANK_LOWEST


def calculate_job_scores(ability_scores):
    """職種ごとの加重平均点（四捨五入した整数）を算出する"""
    result = {}
    for job in JOBS:
        weights = JOB_WEIGHTS[job['key']]
        total = sum(
            _to_decimal(weight) * _to_decimal(ability_scores[ability_key])
            for ability_key, weight in weights.items()
        )
        result[job['key']] = round_half_up(total)
    return result


def calculate_skill_sheet(pillars, day_stem, five_element_scores, kakukyoku, hour_unknown=False):
    """
    鑑定スキル表を算出する

    Args:
        pillars: {'year_pillar': {'heavenly_stem', 'earthly_branch'}, ...}
        day_stem: 日干
        five_element_scores: five_elements_balance_data['scores']
        kakukyoku: 格局文字列（空文字・None は補正なし）
        hour_unknown: 時間不明フラグ

    Returns:
        dict: APIレスポンス用の skill_sheet
    """
    kakukyoku = kakukyoku or ''
    element_group_scores = calculate_element_group_scores(day_stem, five_element_scores)
    star_points = calculate_star_points(pillars, day_stem, hour_unknown)
    diff, strength_label = calculate_strength(element_group_scores)
    breakdowns = calculate_ability_breakdowns(
        element_group_scores, star_points, strength_label, kakukyoku
    )

    # 日干と五行の関係による補正（解釈ルール設定）
    ruleset = skill_rules.load_rules()
    applied_rules = skill_rules.evaluate(skill_rules.RuleContext(
        day_stem=day_stem,
        strength_label=strength_label,
        strength_diff=diff,
        element_groups=element_group_scores,
        star_points=star_points,
        kakukyoku=kakukyoku,
        stem_stars=skill_rules.collect_stem_stars(pillars, day_stem, hour_unknown),
    ), ruleset)
    apply_rule_adjustments(breakdowns, applied_rules)

    ability_scores = scores_from_breakdowns(breakdowns)
    job_scores = calculate_job_scores(ability_scores)
    ability_names = {a['key']: a['name'] for a in ABILITIES}

    return {
        'version': SKILL_SHEET_VERSION,
        'is_reference': bool(hour_unknown),
        'strength': {'label': strength_label, 'diff': diff},
        'kakukyoku': kakukyoku,
        'abilities': [
            {
                **ability,
                'score': ability_scores[ability['key']],
                'breakdown': _breakdown_for_json(breakdowns[ability['key']]),
            }
            for ability in ABILITIES
        ],
        'jobs': [
            {
                **job,
                'score': job_scores[job['key']],
                'rank': get_rank(job_scores[job['key']]),
                'weights': _job_weights_by_name(job['key']),
            }
            for job in JOBS
        ],
        'applied_rules': [
            {
                'id': rule['id'],
                'title': rule['title'],
                'interpretation': rule['interpretation'],
                'effects': _sum_effects(rule['adjustments'], ability_names),
            }
            for rule in applied_rules
        ],
        'rules_version': ruleset.fingerprint,
        'inputs': {
            'element_groups': element_group_scores,
            'star_points': star_points,
        },
    }
