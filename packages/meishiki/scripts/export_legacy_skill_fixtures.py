# -*- coding: utf-8 -*-
"""
現行の Python 版で鑑定スキル表（解釈ルールの補正を含む）を計算し、比較テスト用のデータ（JSON）を書き出す。

使い方（リポジトリのルートで）:
  docker compose exec -T backend python - < packages/meishiki/scripts/export_legacy_skill_fixtures.py \
    | gzip -9 > packages/meishiki/test/fixtures/legacy-skill.json.gz

ケース: 乱数（固定シード）で選んだ日時 3,000件（約1割は時間不明）と、鑑定事例S・O・基準ケース
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
from apps.fortune.skill_sheet import calculate_skill_sheet  # noqa: E402
from apps.fortune import skill_rules  # noqa: E402

CITIES = list(c.CITY_TIME_OFFSETS.keys())


def run(dt, city, gender, hour_unknown):
    hour = 0 if hour_unknown else dt.hour
    minute = 0 if hour_unknown else dt.minute
    adj_h, adj_m, change = c.adjust_birth_hour_by_prefecture(hour, minute, city, dt.month)
    adj_date = datetime(dt.year, dt.month, dt.day) + timedelta(days=change)
    r = c.calculate_fortune(dt.year, dt.month, dt.day, hour, prefecture=city,
                            birth_minute=minute, hour_unknown=hour_unknown, gender=gender)
    pillars = {k: ({'heavenly_stem': r[k]['heavenly_stem'], 'earthly_branch': r[k]['earthly_branch']} if r[k] else {})
               for k in ('year_pillar', 'month_pillar', 'day_pillar', 'hour_pillar')}
    sheet = calculate_skill_sheet(pillars, r['day_pillar']['heavenly_stem'],
                                  r['five_elements_balance']['scores'], r['kakukyoku'], hour_unknown)
    return {
        'in': [dt.year, dt.month, dt.day, None if hour_unknown else dt.hour,
               None if hour_unknown else dt.minute, city, gender],
        'adj': [adj_date.year, adj_date.month, adj_date.day, adj_h, adj_m],
        'ab': [[a['score'], [[i['factor'], i['value']] for i in a['breakdown']]] for a in sheet['abilities']],
        'jb': [[j['score'], j['rank']] for j in sheet['jobs']],
        'ru': [[x['id'], x['title'], x['interpretation'], x['effects']] for x in sheet['applied_rules']],
        'sp': sheet['inputs']['star_points'],
    }


def main():
    cases = []
    rng = random.Random(20261110)
    start = datetime(1901, 1, 7)
    span = (datetime(2040, 12, 31, 23, 59) - start).total_seconds() // 60
    for _ in range(3000):
        dt = start + timedelta(minutes=rng.randrange(int(span)))
        cases.append(run(dt, rng.choice(CITIES), rng.choice(['male', 'female']), rng.random() < 0.1))
    cases.append(run(datetime(1985, 5, 10, 11, 30), '岐阜', 'male', False))
    json.dump({'generatedBy': 'packages/meishiki/scripts/export_legacy_skill_fixtures.py',
               'rulesVersion': skill_rules.load_rules().fingerprint, 'cases': cases},
              sys.stdout, ensure_ascii=False, separators=(',', ':'))


main()
