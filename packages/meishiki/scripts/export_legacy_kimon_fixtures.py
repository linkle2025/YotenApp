# -*- coding: utf-8 -*-
"""
現行の Python 版（backend/apps/fortune/calculators.py）で奇門遁甲の盤を大量に作り、
TypeScript 版（@yoten/meishiki の calculateKimonTonkou）との比較テスト用のデータ（JSON）を標準出力に書き出す。

使い方（リポジトリのルートで）:
  docker compose exec -T backend python - < packages/meishiki/scripts/export_legacy_kimon_fixtures.py \
    | gzip -9 > packages/meishiki/test/fixtures/legacy-kimon.json.gz

画面の API（views.calculate_kimon_tonkou）は管理者のログインが要るため、その中の処理（補正・四柱・局数・
作盤）をここで同じ順に呼ぶ。

ケース:
  - 時盤：2026年の毎日 × 0〜23時（分は乱数）。場所は47都市を順に回す
  - 時盤：2026年の毎日 × 1日分の時盤と同じ時刻（0,2,…,22時の0分）。場所は47都市を順に回す
  - 時盤：陰陽・局数を指定したケース（2025年・2027年の乱数の日時）
  - 日盤：2026年の毎日、と陰陽・局数を指定したケース（2025年・2027年）

日盤は現行版では必ずエラーになる（凶格の判定で時干 None を文字列に置き換えようとする）。
そこで盤の配置は凶格の判定を飛ばして作り（year_stem=None で呼ぶ）、凶格は check_kyokaku を時干 '' で呼んで作る
（'' なら「(時干)」の条件はどの宮にも当てはまらない＝判定しないのと同じ）。現行のエラー文も記録する。

現行版の不具合を直した期待値（fixed）も、現行の関数を使って一緒に書き出す:
  - 凶格の「(日干)」に日柱の天干を使う（現行の時盤は時干を使っている）
  - 門迫：八門に「門」を付けて判定する（現行は「休」と「休門」を比べて一度も成立しない）
  - 月干：1月1日〜小寒前は前年12月（大雪）の月柱（現行は前年1月の丑月を拾う）
  - 五不遇時：日柱の天干で判定（時盤のみ）
"""
import json
import logging
import os
import random
from datetime import datetime, timedelta

import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()
logging.disable(logging.CRITICAL)

from apps.fortune import calculators as c  # noqa: E402

CITIES = list(c.CITY_TIME_OFFSETS.keys())


def ps(p):
    return (p['heavenly_stem'] + p['earthly_branch']) if p else ''


# 正しい月柱（全年の節入りから、対象日時以前で最後の節）
_ALL_TERMS = None


def correct_month_pillar(dt):
    global _ALL_TERMS
    if _ALL_TERMS is None:
        _ALL_TERMS = []
        for year_data in c.load_solar_terms_data().values():
            for terms in year_data.values():
                for t in terms:
                    y, mo, d = map(int, t['date'].split('-'))
                    _ALL_TERMS.append((datetime(y, mo, d, t['hour'], t['minute']), t['month_pillar']))
        _ALL_TERMS.sort()
    found = None
    for term_dt, pillar in _ALL_TERMS:
        if term_dt <= dt:
            found = pillar
        else:
            break
    return found


def palace_str(p):
    tk = p['tenban_kan']
    tk = ''.join(tk) if isinstance(tk, list) else (tk or '')
    return '|'.join([
        tk, p['kyusei'] or '', p['hachimon'] or '', p['jiban_kan'] or '', p['hasshin'] or '',
        p['chugan'] or '', '' if p['score'] is None else str(p['score']),
    ])


def kyokaku_list(result):
    return [','.join(result[pos]) for pos in range(1, 10)]


def fixed_kyokaku(palaces, year_stem, month_stem, day_stem, hour_stem, hour_branch, junshu, calc_type):
    fixed_palaces = []
    for p in palaces:
        q = dict(p)
        if q.get('hachimon'):
            q['hachimon'] = q['hachimon'] + '門'
        fixed_palaces.append(q)
    return c.check_kyokaku(fixed_palaces, year_stem, month_stem, day_stem,
                           hour_stem if hour_stem else '', hour_branch, junshu, calc_type)


def run(calc_type, year, month, day, hour, minute, city, yin_yang_in, kyokusu_in):
    yin_yang, kyokusu = yin_yang_in, kyokusu_in
    if not yin_yang or kyokusu is None:
        auto_y, auto_k = c.get_kyokusu_for_date(year, month, day, calc_type)
        yin_yang = yin_yang or auto_y
        kyokusu = auto_k if kyokusu is None else kyokusu

    case = {'in': [calc_type, year, month, day, hour, minute, city, yin_yang_in, kyokusu_in],
            'yy': yin_yang, 'k': kyokusu}

    if calc_type == '日盤':
        yp = c.calculate_year_pillar(year, month, day)
        mp = c.calculate_month_pillar(year, month, day)
        dp = c.calculate_day_pillar(year, month, day)
        hp = None
        used = dp
        adj_dt = datetime(year, month, day)
        case['adj'] = None
        try:
            c.calculate_kimon_tonkou_board(dp['heavenly_stem'], dp['earthly_branch'], yin_yang, kyokusu,
                                           year_stem=yp['heavenly_stem'], month_stem=mp['heavenly_stem'],
                                           hour_stem=None, hour_branch=None, calculation_type='日盤')
            case['legacyError'] = None
        except Exception as e:  # 現行の不具合（必ずここに来る）
            case['legacyError'] = f'{type(e).__name__}: {e}'
        board = c.calculate_kimon_tonkou_board(used['heavenly_stem'], used['earthly_branch'], yin_yang, kyokusu,
                                               calculation_type='日盤')
        junshu = board['debug']['step1']['junshu_stem']
        legacy_kk = c.check_kyokaku(board['palaces'], yp['heavenly_stem'], mp['heavenly_stem'],
                                    dp['heavenly_stem'], '', None, junshu, '日盤')
        legacy_gobuuji = False
    else:
        adj_h, adj_m, change = c.adjust_birth_hour_by_prefecture(hour, minute, city, month)
        ad = datetime(year, month, day) + timedelta(days=change)
        yp = c.calculate_year_pillar(ad.year, ad.month, ad.day, adj_h, adj_m)
        mp = c.calculate_month_pillar(ad.year, ad.month, ad.day, adj_h, adj_m)
        dp = c.calculate_day_pillar(ad.year, ad.month, ad.day)
        hp = c.calculate_hour_pillar(ad.year, ad.month, ad.day, adj_h)
        used = hp
        adj_dt = datetime(ad.year, ad.month, ad.day, adj_h, adj_m)
        case['adj'] = [ad.year, ad.month, ad.day, adj_h, adj_m]
        board = c.calculate_kimon_tonkou_board(hp['heavenly_stem'], hp['earthly_branch'], yin_yang, kyokusu,
                                               year_stem=yp['heavenly_stem'], month_stem=mp['heavenly_stem'],
                                               hour_stem=hp['heavenly_stem'], hour_branch=hp['earthly_branch'],
                                               calculation_type='時盤')
        junshu = board['debug']['step1']['junshu_stem']
        legacy_kk = {p['position']: p['kyokaku'] for p in board['palaces']}
        legacy_gobuuji = board['gobuuji']

    fixed_month = correct_month_pillar(adj_dt)
    hour_stem = hp['heavenly_stem'] if hp else None
    fixed_kk = fixed_kyokaku(board['palaces'], yp['heavenly_stem'], fixed_month[0], dp['heavenly_stem'],
                             hour_stem, hp['earthly_branch'] if hp else None, junshu, calc_type)
    step4 = board['debug']['step4']['debug']
    step5 = board['debug']['step5']['debug']
    case.update({
        'p': [ps(yp), ps(mp), ps(dp), ps(hp)],
        'fixedMonth': fixed_month,
        'junshu': junshu,
        'jjp': board['junshu_jiban_pos'],
        'jtp': board['junshu_tenban_pos'],
        'chokushi': [step4['chokushi_teii'], step4['chokushi_pos'], bool(step4['branch_fly'])],
        'chokufu': [step5['daichokufu_teii'], step5['placement_pos']],
        'palaces': [palace_str(p) for p in board['palaces']],
        'kk': kyokaku_list(legacy_kk),
        'fixedKk': kyokaku_list(fixed_kk),
        'gobuuji': legacy_gobuuji,
        'fixedGobuuji': c.check_gobuuji(dp['heavenly_stem'], hour_stem) if calc_type == '時盤' else False,
    })
    return case


def main():
    rng = random.Random(20260506)
    cases = []
    start = datetime(2026, 1, 1)
    i = 0
    for n in range(365):
        d = start + timedelta(days=n)
        for hour in range(24):
            cases.append(run('時盤', d.year, d.month, d.day, hour, rng.randrange(60), CITIES[i % len(CITIES)], None, None))
            i += 1
        for hour in range(0, 24, 2):
            cases.append(run('時盤', d.year, d.month, d.day, hour, 0, CITIES[i % len(CITIES)], None, None))
            i += 1
        cases.append(run('日盤', d.year, d.month, d.day, None, None, None, None, None))
    for _ in range(400):
        d = datetime(rng.choice([2025, 2027]), 1, 1) + timedelta(days=rng.randrange(365))
        yy = rng.choice(['陰', '陽'])
        k = rng.randint(1, 9)
        cases.append(run('時盤', d.year, d.month, d.day, rng.randrange(24), rng.randrange(60),
                         CITIES[i % len(CITIES)], yy, k))
        i += 1
        if _ % 4 == 0:
            cases.append(run('日盤', d.year, d.month, d.day, None, None, None, yy, k))
    print(json.dumps({'generatedAt': datetime.now().isoformat(timespec='seconds'), 'cases': cases},
                     ensure_ascii=False, separators=(',', ':')))


if __name__ == '__main__':
    main()
