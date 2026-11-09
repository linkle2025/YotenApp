# -*- coding: utf-8 -*-
"""
現行の Python 版（backend/apps/fortune/calculators.py）で命式を大量に計算し、
TypeScript 版（@yoten/meishiki）との比較テスト用のデータ（JSON）を標準出力に書き出す。

使い方（リポジトリのルートで）:
  docker compose exec -T backend python - < packages/meishiki/scripts/export_legacy_fixtures.py \
    | gzip -9 > packages/meishiki/test/fixtures/legacy.json.gz

ケース:
  - 全節入り（1901〜2040年の1,680回）の前後（-40, -10, 0, +10, +40 分）。出生地は47都市を順に回す
  - 乱数（固定シード）で選んだ日時 3,000件（約1割は時間不明）
"""
import json
import logging
import os
import random
import sys
from datetime import datetime, timedelta

import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()
logging.disable(logging.CRITICAL)

from apps.fortune import calculators as c  # noqa: E402
from apps.fortune.skill_sheet import calculate_element_group_scores, calculate_strength  # noqa: E402

CITIES = list(c.CITY_TIME_OFFSETS.keys())
OFFSETS = [-40, -10, 0, 10, 40]


def pillar_str(p):
    return (p['heavenly_stem'] + p['earthly_branch']) if p else ''


def stars(p):
    if not p:
        return ''
    return '|'.join(x or '' for x in [
        p.get('heavenly_stem_star'), p.get('hidden_stem_star'),
        p.get('hidden_stem_tertiary_star'), p.get('hidden_stem_secondary_star'),
    ])


def run(dt, city, gender, hour_unknown):
    hour = 0 if hour_unknown else dt.hour
    minute = 0 if hour_unknown else dt.minute
    adj_h, adj_m, change = c.adjust_birth_hour_by_prefecture(hour, minute, city, dt.month)
    adj_date = datetime(dt.year, dt.month, dt.day) + timedelta(days=change)
    r = c.calculate_fortune(dt.year, dt.month, dt.day, hour, prefecture=city,
                            birth_minute=minute, hour_unknown=hour_unknown, gender=gender)
    fe = r['five_elements_balance']['scores']
    day_stem = r['day_pillar']['heavenly_stem']
    diff, label = calculate_strength(calculate_element_group_scores(day_stem, fe))
    t = r['taiun']
    return {
        'in': [dt.year, dt.month, dt.day, None if hour_unknown else dt.hour,
               None if hour_unknown else dt.minute, city, gender],
        'adj': [adj_date.year, adj_date.month, adj_date.day, adj_h, adj_m],
        'p': [pillar_str(r['year_pillar']), pillar_str(r['month_pillar']),
              pillar_str(r['day_pillar']), pillar_str(r['hour_pillar'])],
        's': [stars(r['year_pillar']), stars(r['month_pillar']), stars(r['day_pillar']), stars(r['hour_pillar'])],
        'fe': [fe['wood'], fe['fire'], fe['earth'], fe['metal'], fe['water']],
        'st': [label, diff],
        'kk': r['kakukyoku'],
        'tu': [t['direction'], t['ritsuun'],
               ''.join(x['heavenly_stem'] + x['earthly_branch'] for x in t['taiun_list'])],
    }


def main():
    cases = []
    data = c.load_solar_terms_data()
    i = 0
    for year in range(1901, 2041):
        for month_terms in data[str(year)].values():
            for term in month_terms:
                y, mo, d = map(int, term['date'].split('-'))
                base = datetime(y, mo, d, term['hour'], term['minute'])
                for off in OFFSETS:
                    dt = base + timedelta(minutes=off)
                    if dt.year < 1901 or dt.year > 2040:
                        continue
                    if dt < datetime(1901, 1, 7):  # 現行は前年データがなくエラー
                        continue
                    city = CITIES[i % len(CITIES)]
                    gender = 'male' if i % 2 == 0 else 'female'
                    i += 1
                    cases.append(run(dt, city, gender, False))

    rng = random.Random(20261109)
    start = datetime(1901, 1, 7)
    span = (datetime(2040, 12, 31, 23, 59) - start).total_seconds() // 60
    for _ in range(3000):
        dt = start + timedelta(minutes=rng.randrange(int(span)))
        cases.append(run(dt, rng.choice(CITIES), rng.choice(['male', 'female']), rng.random() < 0.1))

    json.dump({'generatedBy': 'packages/meishiki/scripts/export_legacy_fixtures.py', 'cases': cases},
              sys.stdout, ensure_ascii=False, separators=(',', ':'))


main()
