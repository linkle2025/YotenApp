/**
 * お手本サイトとの照合（付録D No.1〜38。2026-11-11 に画面から書き写した結果）
 *
 * 四柱と大運（立運の年齢と干支）が、既定の決まりでお手本サイトと一致することを確かめる。
 * 境目の設定（23時／24時）を両方撮ったケースは、それぞれの設定で比べる。
 * 蔵干（午・酉など）は流派の違いがあり要確認（付録C Q28）のため、ここでは比べない。
 * 五行の点数は、お手本サイトが計算方法を変えてあるため比べない。
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { calculateMeishiki, type MeishikiInput } from '../src';

interface ReferenceCase {
  case: string;
  input: MeishikiInput;
  dayBoundary: '23' | '24';
  pillars: [string, string, string, string | null];
  taiun: string[];
}

const { cases } = JSON.parse(readFileSync(new URL('./fixtures/reference-meishiki.json', import.meta.url), 'utf8')) as {
  cases: ReferenceCase[];
};

describe('お手本サイトとの照合（命式）', () => {
  it('48件', () => expect(cases).toHaveLength(48));

  it.each(cases.map((c) => [c.case, c] as const))('%s', (_label, c) => {
    const r = calculateMeishiki(c.input, { dayBoundary: c.dayBoundary });
    const p = r.pillars;
    expect([p.year, p.month, p.day, p.hour].map((x) => (x ? x.stem + x.branch : null))).toEqual(c.pillars);
    // 2040年末は、次の節入りのデータがなく大運を出せない（お手本サイトは出している）
    if (r.taiun) {
      const periods = r.taiun.periods.filter((q) => q.ageStart >= r.taiun!.ritsuun).map((q) => `${q.ageStart}${q.stem}${q.branch}`);
      expect(periods.slice(0, c.taiun.length)).toEqual(c.taiun);
    } else {
      expect(c.input.year).toBe(2040);
    }
  });
});
