# -*- coding: utf-8 -*-
"""
判定の要点（LLM生成）に渡す「注記ファクト」の検出

LLM が命式にない概念を作り出さないよう、伝統的な注目点をコード側で検出し、
事実として渡す。点数（skill_sheet）には一切影響させない。

ルールを追加するときは、検出関数を書いて FACT_RULES に (ID, 関数) を足す。
検出関数は FactContext を受け取り、該当すれば文言（str）、しなければ None を返す。
仕様: doc/判定の要点生成.md
"""

from dataclasses import dataclass, field

from .calculators import get_heavenly_star

# 天干として見る柱（日干そのものは除く）
STEM_PILLARS = [
    ('year_pillar', '年干'),
    ('month_pillar', '月干'),
    ('hour_pillar', '時干'),
]

ELEMENT_GROUP_ORDER = ['比劫', '印', '食傷', '財', '官']

# しきい値
SCARCE_THRESHOLD = 5        # これ未満なら「ほぼない」
SHOKUSHOU_STRONG_MIN = 20   # 食傷が強いとみなす最低点
SHOKUSHOU_STRONG_RANK = 2   # 上位何位以内なら強いとみなすか

KAN_STARS = ('正官', '偏官')


@dataclass
class FactContext:
    pillars: dict
    day_stem: str
    element_groups: dict
    strength_label: str
    hour_unknown: bool = False
    stem_stars: list = field(default_factory=list)  # [(柱の表示名, 干, 通変星), ...]


def _fmt(value):
    value = float(value)
    return f'{value:.0f}' if value.is_integer() else f'{value:g}'


def _collect_stem_stars(pillars, day_stem, hour_unknown):
    result = []
    for key, label in STEM_PILLARS:
        if hour_unknown and key == 'hour_pillar':
            continue
        stem = (pillars.get(key) or {}).get('heavenly_stem')
        if not stem:
            continue
        star = get_heavenly_star(day_stem, stem)
        if star:
            result.append((label, stem, star))
    return result


def _rank_of(element_groups, group):
    """5グループ中の順位（自分より大きいグループの数 + 1）"""
    value = element_groups.get(group, 0)
    return 1 + sum(1 for g in ELEMENT_GROUP_ORDER if element_groups.get(g, 0) > value)


# ---------------------------------------------------------------------------
# 検出ルール
# ---------------------------------------------------------------------------

def detect_shokan_kenkan(ctx):
    """傷官見官：天干（日干除く）に傷官と、正官または偏官が両方ある"""
    shokan = [f'{label}の傷官（{stem}）' for label, stem, star in ctx.stem_stars if star == '傷官']
    kan = [f'{label}の{star}（{stem}）' for label, stem, star in ctx.stem_stars if star in KAN_STARS]
    if not shokan or not kan:
        return None
    return f'傷官見官：{"・".join(shokan)}と{"・".join(kan)}が天干に並ぶ'


def detect_in_dominant(ctx):
    """身旺で、かつ E印 が5グループ中最大"""
    if ctx.strength_label != '身旺':
        return None
    in_score = ctx.element_groups.get('印', 0)
    if in_score <= 0 or _rank_of(ctx.element_groups, '印') != 1:
        return None
    return f'印が最も強い身旺（印 {_fmt(in_score)}）：学びが厚い一方、考えすぎて出力が遅れやすい'


def detect_zai_scarce(ctx):
    """E財 < 5"""
    score = ctx.element_groups.get('財', 0)
    if score >= SCARCE_THRESHOLD:
        return None
    return f'財星がほぼない（財 {_fmt(score)}）'


def detect_kan_scarce(ctx):
    """E官 < 5"""
    score = ctx.element_groups.get('官', 0)
    if score >= SCARCE_THRESHOLD:
        return None
    return f'官星がほぼない（官 {_fmt(score)}）'


def detect_shokushou_strong(ctx):
    """E食傷 が上位2位以内かつ 20以上"""
    score = ctx.element_groups.get('食傷', 0)
    if score < SHOKUSHOU_STRONG_MIN or _rank_of(ctx.element_groups, '食傷') > SHOKUSHOU_STRONG_RANK:
        return None
    return f'食傷が強い（食傷 {_fmt(score)}）：表現・制作の出口が太い'


FACT_RULES = [
    ('shokan_kenkan', detect_shokan_kenkan),
    ('in_dominant', detect_in_dominant),
    ('zai_scarce', detect_zai_scarce),
    ('kan_scarce', detect_kan_scarce),
    ('shokushou_strong', detect_shokushou_strong),
]


def detect_notable_facts(pillars, day_stem, element_groups, strength_label, hour_unknown=False):
    """
    注記ファクトを検出する

    Returns:
        list[dict]: [{'id': 'shokan_kenkan', 'text': '傷官見官：...'}, ...]（FACT_RULES の順）
    """
    ctx = FactContext(
        pillars=pillars,
        day_stem=day_stem,
        element_groups=element_groups,
        strength_label=strength_label,
        hour_unknown=hour_unknown,
        stem_stars=_collect_stem_stars(pillars, day_stem, hour_unknown),
    )
    facts = []
    for fact_id, rule in FACT_RULES:
        text = rule(ctx)
        if text:
            facts.append({'id': fact_id, 'text': text})
    return facts
