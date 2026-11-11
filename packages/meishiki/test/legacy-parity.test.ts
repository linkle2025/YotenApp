/**
 * 現行の Python 版との比較テスト
 *
 * test/fixtures/legacy.json.gz は scripts/export_legacy_fixtures.py で現行版から作ったデータ（11,395件）。
 * 全節入りの前後と乱数の日時について、TypeScript 版が同じ結果になることを確かめる。
 *
 * 現行版と同じ決まり（LEGACY_OPTIONS）で計算して比べる。既定の決まりはお手本サイトに合わせてあり、現行版とは違う。
 * 意図的に結果を変えた箇所（付録A・付録B）は、比較から外すか、変更後の形に合わせて比べる。
 * - 時間不明で、現行の補正によって日付や節が変わるケース（現行の不具合）
 * - 1月1日〜小寒前（現行の不具合）
 * - 立運0歳の最初の運（新版では出さない）
 * - 2040年末で大運の節入りデータがないケース（新版では null）
 */
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { lastTermAtOrBefore, toMinutes, type CivilDateTime } from '../src/calendar';
import { calculateMeishiki, LEGACY_OPTIONS, prefectureFromLegacyCity, type Pillar } from '../src';

interface LegacyCase {
  in: [number, number, number, number | null, number | null, string, 'male' | 'female'];
  adj: [number, number, number, number, number];
  p: [string, string, string, string];
  s: [string, string, string, string];
  fe: [number, number, number, number, number];
  st: [string, number];
  kk: string;
  tu: [string, number, string];
}

const fixture = JSON.parse(
  gunzipSync(readFileSync(new URL('./fixtures/legacy.json.gz', import.meta.url))).toString('utf8'),
) as { cases: LegacyCase[] };

const pillarStr = (p: Pillar | null) => (p ? p.stem + p.branch : '');
const starsStr = (p: Pillar | null) =>
  p ? [p.stemStar, p.hiddenStars.honki, p.hiddenStars.chuki ?? '', p.hiddenStars.yoki ?? ''].join('|') : '';

function legacyAdjusted(c: LegacyCase): CivilDateTime {
  const [year, month, day, hour, minute] = c.adj;
  return { year, month, day, hour, minute };
}

/** 現行版の結果が不具合の影響を受けているケース（比較しない） */
function skipReason(c: LegacyCase): string | null {
  const [year, month, day, hour] = c.in;
  const adj = legacyAdjusted(c);
  const adjMinutes = toMinutes(adj);
  if (hour === null) {
    const midnight = toMinutes({ year, month, day, hour: 0, minute: 0 });
    const sameDay = adj.year === year && adj.month === month && adj.day === day;
    if (!sameDay || lastTermAtOrBefore(midnight) !== lastTermAtOrBefore(adjMinutes)) {
      return '時間不明の補正（現行の不具合）';
    }
  }
  if (lastTermAtOrBefore(adjMinutes)?.dataYear !== adj.year) {
    return '1月1日〜小寒前の月柱（現行の不具合）';
  }
  return null;
}

describe('現行の Python 版との比較', () => {
  it(`${fixture.cases.length}件の結果が一致する（意図的な変更を除く）`, () => {
    const mismatches: string[] = [];
    const skipped = new Map<string, number>();
    let compared = 0;

    for (const c of fixture.cases) {
      const reason = skipReason(c);
      if (reason) {
        skipped.set(reason, (skipped.get(reason) ?? 0) + 1);
        continue;
      }
      const [year, month, day, hour, minute, city, gender] = c.in;
      const r = calculateMeishiki({
        year,
        month,
        day,
        hour: hour ?? undefined,
        minute: minute ?? undefined,
        hourUnknown: hour === null,
        birthPlace: prefectureFromLegacyCity(city).code,
        gender,
      }, LEGACY_OPTIONS);
      compared += 1;

      const label = `${c.in.join(' ')}`;
      const check = (name: string, actual: unknown, expected: unknown) => {
        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
          mismatches.push(`${label} ${name}: 期待 ${JSON.stringify(expected)} / 実際 ${JSON.stringify(actual)}`);
        }
      };

      const { year: py, month: pm, day: pd, hour: ph } = r.pillars;
      if (hour !== null) {
        const a = r.correction.adjusted;
        check('補正後の日時', [a.year, a.month, a.day, a.hour, a.minute], c.adj);
      }
      check('四柱', [py, pm, pd, ph].map(pillarStr), c.p);
      check('通変星', [py, pm, pd, ph].map(starsStr), c.s);
      const fe = r.fiveElements;
      check('五行', [fe.wood, fe.fire, fe.earth, fe.metal, fe.water], c.fe);
      check('身旺身弱', [r.strength.label, r.strength.diff], c.st);
      check('格局', r.kakukyoku, c.kk);

      const [direction, ritsuun, list] = c.tu;
      if (r.taiun === null) {
        // 2040年12月の大雪以降で、翌年の節入りデータがない
        if (!(c.adj[0] === 2040 && c.adj[1] === 12)) mismatches.push(`${label} 大運が null`);
      } else {
        check('大運の向き', r.taiun.direction, direction);
        check('立運', r.taiun.ritsuun, ritsuun);
        // 立運0歳なら、現行の最初の運（0〜−1歳）を除いて比べる
        const legacyPeriods = (list.match(/../g) ?? []).slice(ritsuun === 0 ? 1 : 0);
        check('大運の干支', r.taiun.periods.map((p) => p.stem + p.branch), legacyPeriods);
      }
    }

    // 比較から外した件数（参考）
    console.info('比較', compared, '件 / 対象外', Object.fromEntries(skipped));
    expect(mismatches.slice(0, 20)).toEqual([]);
    expect(compared).toBeGreaterThan(10_800);
  });
});
