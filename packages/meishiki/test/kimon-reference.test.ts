/**
 * 奇門遁甲：お手本サイトとの照合（付録D の D.4。2026-11-11 に画面から書き写した盤）
 *
 * 9宮の天盤干・九星・地盤干・八門・八神が、お手本サイトと一致することを確かめる。
 * 旬首は括弧で囲み、天禽は芮に添えて「芮禽」と書く（お手本サイトの書き方）。
 * 時盤の場所は東京（既定）。お手本サイトの K06 は補正後の時刻（未の刻）で作盤していた。
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { calculateKimonTonkou, PALACE_GRID_ORDER, type KimonInput, type KimonResult } from '../src';

interface ReferenceKimon {
  case: string;
  input: KimonInput;
  header: string[];
  cells: { tenban: string; kyusei: string; jiban: string; hachimon: string; hasshin: string }[];
}

const { cases } = JSON.parse(readFileSync(new URL('./fixtures/reference-kimon.json', import.meta.url), 'utf8')) as {
  cases: ReferenceKimon[];
};

/** お手本サイトの書き方にそろえる */
function cellsOf(b: KimonResult) {
  return PALACE_GRID_ORDER.map((pos) => {
    const p = b.palaces.find((x) => x.position === pos)!;
    return {
      tenban: p.tenbanKan.map((k) => (p.isJunshuTenban && k === b.junshu ? `(${k})` : k)).join(''),
      kyusei: p.kyusei === '芮' ? '芮禽' : (p.kyusei ?? ''),
      jiban: p.isJunshuJiban ? `(${p.jibanKan})` : p.jibanKan,
      hachimon: p.hachimon ?? '',
      hasshin: p.hasshin ?? '',
    };
  });
}

describe('奇門遁甲：お手本サイトとの照合', () => {
  it('10件', () => expect(cases).toHaveLength(10));

  it.each(cases.map((c) => [c.case, c] as const))('%s', (_label, c) => {
    const b = calculateKimonTonkou(c.input);
    expect(cellsOf(b)).toEqual(c.cells);
    // 干支（お手本の「干支表現」）
    const kanshi = c.header.find((h) => h.startsWith('干支表現'));
    if (kanshi) {
      const p = b.pillars;
      expect(kanshi).toContain(`${p.year.stem}${p.year.branch}年${p.month.stem}${p.month.branch}月`);
      expect(kanshi).toContain(`${p.hour!.stem}${p.hour!.branch}時`);
    }
  });
});
