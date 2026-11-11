/**
 * 奇門遁甲：現行の Python 版との比較テスト
 *
 * test/fixtures/legacy-kimon.json.gz は scripts/export_legacy_kimon_fixtures.py で現行版から作ったデータ。
 * 2026年の毎日の時盤（0〜23時と、1日分の時盤と同じ時刻）・日盤と、陰陽・局数を指定したケースについて、
 * TypeScript 版が同じ結果になることを確かめる。
 *
 * 盤の配置（地盤干・天盤干・九星・八門・八神・中宮の干支・点数・旬首の位置・直使・大直符）は、すべてのケースで
 * 現行版と完全に一致すること。
 *
 * 意図的に変えた箇所は、現行の関数で作った「直した期待値」（fixed〜）と比べる。
 * - 凶格：「(日干)」に日柱の天干を使う／門迫を判定する／月干は1月1日〜小寒前の不具合を直したもの
 * - 五不遇時：日柱の天干で判定する
 * - 月柱：1月1日〜小寒前（現行の不具合）
 * - 日盤：現行版は必ずエラーになる（ここでは盤の配置を現行の関数で直接作って比べる）
 *
 * お手本サイトとの照合（2026-11-11、test/kimon-reference.test.ts）で、次の盤は作盤の決まりを直したため、
 * 現行版との完全一致の比較から外す（件数だけ確かめる）。
 * - 旬首が中宮にある盤：坤二宮の地盤干が旬首と一緒に動く／直使は坤二宮の門を旬首の宮から飛ばす
 * - 直使が中宮に着く盤：坤二宮に寄せる
 * - 補正後が23時台の時盤：時柱は翌日の子の刻（翌日の日干から時干を出す）
 */
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { calculateKimonTonkou, prefectureFromLegacyCity, type KimonPillar, type KimonResult, type YinYang } from '../src';

interface LegacyKimonCase {
  in: ['時盤' | '日盤', number, number, number, number | null, number | null, string | null, YinYang | null, number | null];
  yy: YinYang;
  k: number;
  adj: [number, number, number, number, number] | null;
  legacyError?: string | null;
  p: [string, string, string, string];
  fixedMonth: string;
  junshu: string;
  jjp: number;
  jtp: number;
  chokushi: [string, number, boolean];
  chokufu: [string, number];
  palaces: string[];
  kk: string[];
  fixedKk: string[];
  gobuuji: boolean;
  fixedGobuuji: boolean;
}

const fixture = JSON.parse(
  gunzipSync(readFileSync(new URL('./fixtures/legacy-kimon.json.gz', import.meta.url))).toString('utf8'),
) as { cases: LegacyKimonCase[] };

const ps = (p: KimonPillar | null) => (p ? p.stem + p.branch : '');

function run(c: LegacyKimonCase): KimonResult {
  const [type, year, month, day, hour, minute, city, yinYang, kyokusu] = c.in;
  return calculateKimonTonkou({
    type,
    year,
    month,
    day,
    ...(type === '時盤' ? { hour: hour!, minute: minute!, place: prefectureFromLegacyCity(city!).code } : {}),
    ...(yinYang ? { yinYang } : {}),
    ...(kyokusu !== null ? { kyokusu } : {}),
  });
}

/** 現行版の宮の表し方（palace_str）にそろえる */
function palaceStr(r: KimonResult): string[] {
  return r.palaces.map((p) =>
    [p.tenbanKan.join(''), p.kyusei ?? '', p.hachimon ?? '', p.jibanKan, p.hasshin ?? '', p.chugan ?? '', p.score ?? ''].join('|'),
  );
}

describe('奇門遁甲：現行版との比較', () => {
  const cases = fixture.cases;
  const jiban = cases.filter((c) => c.in[0] === '時盤');
  const nichiban = cases.filter((c) => c.in[0] === '日盤');

  it('比較用データの件数', () => {
    expect(jiban.length).toBeGreaterThan(13_000);
    expect(nichiban.length).toBeGreaterThan(365);
  });

  /** 作盤の決まりを直した盤（現行版の直使の位置が中宮、旬首が中宮、補正後が23時台＝時柱は翌日の子の刻） */
  const changed = (c: LegacyKimonCase) => c.jjp === 5 || c.chokushi[1] === 5 || c.adj?.[3] === 23;

  it('作盤の決まりを直した盤は、全体の4分の1未満', () => {
    const n = cases.filter(changed).length;
    expect(n).toBeGreaterThan(0);
    expect(n / cases.length).toBeLessThan(0.25);
  });

  it('盤の配置・四柱・局数がすべて一致する（決まりを直した盤を除く）', () => {
    const mismatches: string[] = [];
    for (const c of cases.filter((x) => !changed(x))) {
      const r = run(c);
      const expected = {
        adj: c.adj,
        pillars: [c.p[0], c.fixedMonth, c.p[2], c.p[3]],
        yy: c.yy,
        k: c.k,
        junshu: c.junshu,
        jjp: c.jjp,
        jtp: c.jtp,
        chokushi: c.chokushi.slice(0, 2),
        chokufu: c.chokufu,
        palaces: c.palaces,
      };
      const a = r.correction?.adjusted;
      const actual = {
        adj: a ? [a.year, a.month, a.day, a.hour, a.minute] : null,
        pillars: [ps(r.pillars.year), ps(r.pillars.month), ps(r.pillars.day), ps(r.pillars.hour)],
        yy: r.yinYang,
        k: r.kyokusu,
        junshu: r.junshu,
        jjp: r.junshuJibanPosition,
        jtp: r.junshuTenbanPosition,
        chokushi: [r.detail.chokushi.mon, r.detail.chokushi.position],
        chokufu: [r.detail.chokufu.star, r.detail.chokufu.position],
        palaces: palaceStr(r),
      };
      try {
        expect(actual).toEqual(expected);
      } catch {
        mismatches.push(`${c.in.join(' ')}`);
      }
    }
    expect(mismatches.slice(0, 20)).toEqual([]);
  });

  it('月柱が現行版と違うのは、1月1日〜小寒前（現行の不具合）だけ', () => {
    const differ = cases.filter((c) => c.p[1] !== c.fixedMonth);
    expect(differ.length).toBeGreaterThan(0);
    for (const c of differ) {
      const [y, m, d, h, mi] = c.adj ?? [c.in[1], c.in[2], c.in[3], 0, 0];
      // 小寒（2026-01-05 17:23 など）より前の1月
      expect(m, c.in.join(' ')).toBe(1);
      expect(d * 1440 + h * 60 + mi, c.in.join(' ')).toBeLessThan(7 * 1440);
      void y;
    }
  });

  it('凶格・五不遇時は、不具合を直した期待値とすべて一致する（決まりを直した盤を除く）', () => {
    const mismatches: string[] = [];
    for (const c of cases.filter((x) => !changed(x))) {
      const r = run(c);
      const actual = { kk: r.palaces.map((p) => p.kyokaku.join(',')), gobuuji: r.gobuuji };
      const expected = { kk: c.fixedKk, gobuuji: c.fixedGobuuji };
      try {
        expect(actual).toEqual(expected);
      } catch {
        mismatches.push(`${c.in.join(' ')}`);
      }
    }
    expect(mismatches.slice(0, 20)).toEqual([]);
  });

  it('凶格が現行版と違うのは、日格・雲干・門迫・月格（意図的な修正）だけ', () => {
    const allowed = new Set(['日格', '雲干', '門迫', '月格']);
    let changed = 0;
    for (const c of cases) {
      for (let i = 0; i < 9; i++) {
        const before = (c.kk[i] ?? '').split(',').filter(Boolean);
        const after = (c.fixedKk[i] ?? '').split(',').filter(Boolean);
        const removed = before.filter((n) => !after.includes(n));
        const added = after.filter((n) => !before.includes(n));
        for (const name of [...removed, ...added]) {
          expect(allowed.has(name), `${c.in.join(' ')} 宮${i + 1}: ${name}`).toBe(true);
          changed += 1;
        }
      }
    }
    expect(changed).toBeGreaterThan(0);
  });

  it('現行版は五不遇時が一度も成立しない（不具合）。新版は成立するケースがある', () => {
    expect(jiban.some((c) => c.gobuuji)).toBe(false);
    expect(jiban.some((c) => c.fixedGobuuji)).toBe(true);
  });

  it('現行版の日盤は必ずエラーになる（新版は作盤できる）', () => {
    for (const c of nichiban) {
      expect(c.legacyError).toBe('TypeError: replace() argument 2 must be str, not None');
    }
  });
});
