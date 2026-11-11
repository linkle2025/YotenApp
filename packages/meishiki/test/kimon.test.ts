/**
 * 奇門遁甲の単体テスト
 * 現行のテスト: backend/apps/fortune/tests/test_kimon_tonkou_board.py
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  KIMON_DAY_HOURS,
  KYOKAKU_RULES,
  KYOKUSU_YEARS,
  KimonInputError,
  PALACE_GRID_ORDER,
  calculateKimonDay,
  calculateKimonTonkou,
  kyokusuEntryOf,
  type KimonResult,
} from '../src';
import { gobuujiOf, junshuOf, layoutKimonBoard } from '../src/kimonBoard';
import { KYOKAKU_CSV, KYOKUSU_CSV } from '../src/kimon.generated';

const readText = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const pillarText = (r: KimonResult) =>
  [r.pillars.year, r.pillars.month, r.pillars.day, r.pillars.hour].map((p) => (p ? p.stem + p.branch : '')).join(' ');

function expectInputError(fn: () => unknown, field: string, code = 'invalid'): KimonInputError {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(KimonInputError);
    const e = error as KimonInputError;
    expect(e.field).toBe(field);
    expect(e.code).toBe(code);
    return e;
  }
  throw new Error('KimonInputError が投げられませんでした');
}

describe('データ', () => {
  it('src/kimon.generated.ts が data/kimon/*.csv と同じ（書き出し忘れの検出）', () => {
    // 違う場合は pnpm --filter @yoten/meishiki generate:kimon を実行する
    expect(KYOKUSU_CSV).toBe(readText('../data/kimon/kyokusu.csv'));
    expect(KYOKAKU_CSV).toBe(readText('../data/kimon/kyokaku.csv'));
  });

  it('現行版（backend）のデータと同じ（切り替えまでの間、両方を同じ内容に保つ）', () => {
    // 現行版の削除後はこのテストを消す
    expect(readText('../data/kimon/kyokusu.csv')).toBe(readText('../../../backend/apps/fortune/data/kyokusu.csv'));
    expect(readText('../data/kimon/kyokaku.csv')).toBe(readText('../../../backend/apps/fortune/data/kyokaku.csv'));
  });

  it('局数データは2026年の365日分', () => {
    expect(KYOKUSU_YEARS).toEqual([2026]);
    expect(kyokusuEntryOf(2026, 1, 1)).not.toBeNull();
    expect(kyokusuEntryOf(2026, 12, 31)).not.toBeNull();
    expect(kyokusuEntryOf(2025, 12, 31)).toBeNull();
    expect(KYOKAKU_RULES.length).toBe(43);
  });

  it('「陽/陰」「3/7」と2つ書かれた日は1つ目を使い、2つ目も残す（現行と同じ）', () => {
    const e = kyokusuEntryOf(2026, 6, 21)!;
    expect(e.day).toEqual({ yinYang: '陽', kyokusu: 3 });
    expect(e.dayAlternative).toEqual({ yinYang: '陰', kyokusu: 7 });
    expect(e.hour).toEqual({ yinYang: '陰', kyokusu: 9 });
    expect(e.hourAlternative).toBeNull();
    const r = calculateKimonTonkou({ type: '日盤', year: 2026, month: 6, day: 21 });
    expect([r.yinYang, r.kyokusu]).toEqual(['陽', 3]);
    expect(r.kyokusuAlternative).toEqual({ yinYang: '陰', kyokusu: 7 });
  });
});

describe('作盤（現行のテストから引き継ぎ）', () => {
  it('2026年5月6日 己卯時・陽遁四局：九星・八門・八神', () => {
    const board = layoutKimonBoard('己', '卯', '陽', 4, '時盤');
    const expected: Record<number, [string, string, string]> = {
      1: ['蓬', '死', '合'],
      2: ['芮', '傷', '符'],
      3: ['冲', '開', '雀'],
      4: ['輔', '休', '地'],
      6: ['心', '景', '陰'],
      7: ['柱', '杜', '蛇'],
      8: ['任', '驚', '陳'],
      9: ['英', '生', '天'],
    };
    for (const [pos, [kyusei, hachimon, hasshin]] of Object.entries(expected)) {
      const p = Number(pos) as 1;
      expect([board.kyusei[p], board.hachimon[p], board.hasshin[p]], `宮${pos}`).toEqual([kyusei, hachimon, hasshin]);
    }
    // 旬首地盤が中宮の時盤は時支飛宮（卯=4）。大直符は坤二宮に寄せる
    expect(board.detail.chokushi.branchFly).toBe(true);
    expect(board.detail.chokufu.position).toBe(2);
    expect(board.chugan).toBe('己卯');
  });

  it('旬首地盤が中宮でない時盤は時支飛宮を使わない（丙寅・陽遁一局）', () => {
    expect(layoutKimonBoard('丙', '寅', '陽', 1, '時盤').detail.chokushi.branchFly).toBe(false);
  });

  it('同じ日時を calculateKimonTonkou で作ると、四柱・局数も現行の参照盤と同じ', () => {
    // 東京・5月：+19分（経度差）+3分（均時差）。5:00 → 5:22（卯の刻）
    const r = calculateKimonTonkou({ type: '時盤', year: 2026, month: 5, day: 6, hour: 5, minute: 0 });
    expect(pillarText(r)).toBe('丙午 癸巳 庚辰 己卯');
    expect([r.yinYang, r.kyokusu, r.kyokusuSource]).toEqual(['陽', 4, 'data']);
    expect(r.correction).toMatchObject({ placeName: '東京都', longitudeMinutes: 19, equationOfTimeMinutes: 3 });
    expect(r.usedPillar).toEqual({ stem: '己', branch: '卯' });
    expect(r.palaces.map((p) => p.position)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(r.palaces[8]!.chugan).toBe('己卯');
    expect(r.palaces[4]!.score).toBeNull();
    expect(r.palaces[0]!.score).toBe(40);
    expect(PALACE_GRID_ORDER).toEqual([4, 9, 2, 3, 5, 7, 8, 1, 6]);
    // JSON にしても情報が落ちない（画面・保存用）
    expect(JSON.parse(JSON.stringify(r))).toEqual(r);
  });

  it('旬首', () => {
    expect(junshuOf('甲', '子')).toBe('戊');
    expect(junshuOf('己', '卯')).toBe('己'); // 甲戌旬
    expect(junshuOf('癸', '亥')).toBe('癸'); // 甲寅旬
    expect(() => junshuOf('甲', '丑')).toThrow();
  });
});

describe('日盤（現行版は必ずエラーになっていた）', () => {
  it('作盤できる。時柱なし・五不遇時なし・時干を使う凶格（天羅・地網）は判定しない', () => {
    for (let day = 1; day <= 31; day++) {
      const r = calculateKimonTonkou({ type: '日盤', year: 2026, month: 3, day });
      expect(r.pillars.hour).toBeNull();
      expect(r.correction).toBeNull();
      expect(r.usedPillar).toEqual(r.pillars.day);
      expect(r.gobuuji).toBe(false);
      const names = r.palaces.flatMap((p) => p.kyokaku);
      expect(names).not.toContain('天羅');
      expect(names).not.toContain('地網');
    }
  });

  it('時刻・場所を渡しても使わない', () => {
    const a = calculateKimonTonkou({ type: '日盤', year: 2026, month: 3, day: 1 });
    const b = calculateKimonTonkou({ type: '日盤', year: 2026, month: 3, day: 1, hour: 23, minute: 59, place: '47' });
    expect(b).toEqual(a);
    expect(a.input).toEqual({ year: 2026, month: 3, day: 1, hour: null, minute: null, place: null });
  });

  it('年柱・月柱は入力日の0時で出す（節入り当日は前の月柱。現行と同じ）', () => {
    // 2026年の立春は 2月4日 5:02。日盤の 2月4日は0時で見るので、まだ乙巳年・己丑月
    const r = calculateKimonTonkou({ type: '日盤', year: 2026, month: 2, day: 4 });
    expect(pillarText(r)).toBe('乙巳 己丑 己酉 ');
  });
});

describe('時刻の境目', () => {
  it('補正後が23時台なら子の刻で、日柱は当日のまま', () => {
    // 東京・5月 +22分：22:40 → 23:02
    const r = calculateKimonTonkou({ type: '時盤', year: 2026, month: 5, day: 6, hour: 22, minute: 40 });
    expect(r.correction!.adjusted).toEqual({ year: 2026, month: 5, day: 6, hour: 23, minute: 2 });
    expect(r.pillars.day).toEqual({ stem: '庚', branch: '辰' });
    expect(r.pillars.hour!.branch).toBe('子');
    // 22:37 → 22:59 は亥の刻
    const before = calculateKimonTonkou({ type: '時盤', year: 2026, month: 5, day: 6, hour: 22, minute: 37 });
    expect(before.pillars.hour!.branch).toBe('亥');
  });

  it('補正で翌日になると日柱は翌日。局数は入力した日付のものを使う（現行と同じ）', () => {
    // 札幌・12月 +25+11=+36分：2026-12-31 23:30 → 2027-01-01 0:06
    const r = calculateKimonTonkou({ type: '時盤', year: 2026, month: 12, day: 31, hour: 23, minute: 30, place: '01' });
    expect(r.correction!.adjusted).toEqual({ year: 2027, month: 1, day: 1, hour: 0, minute: 6 });
    expect(r.pillars.day).toEqual({ stem: '庚', branch: '辰' });
    expect([r.yinYang, r.kyokusu]).toEqual([kyokusuEntryOf(2026, 12, 31)!.hour.yinYang, kyokusuEntryOf(2026, 12, 31)!.hour.kyokusu]);
  });

  it('補正で前日になると日柱は前日（那覇・2月 -29-13=-42分）', () => {
    const r = calculateKimonTonkou({ type: '時盤', year: 2026, month: 2, day: 10, hour: 0, minute: 30, place: '47' });
    expect(r.correction!.adjusted).toEqual({ year: 2026, month: 2, day: 9, hour: 23, minute: 48 });
    expect(r.pillars.hour!.branch).toBe('子');
  });

  it('1月1日〜小寒前の月柱は前年12月（大雪）の月柱（命式と同じ修正）', () => {
    const r = calculateKimonTonkou({ type: '時盤', year: 2026, month: 1, day: 2, hour: 12 });
    expect(r.pillars.month).toEqual({ stem: '戊', branch: '子' });
  });
});

describe('入力チェック', () => {
  it('局数データのない日はエラー（code: noKyokusuData）', () => {
    const e = expectInputError(
      () => calculateKimonTonkou({ type: '時盤', year: 2027, month: 1, day: 1, hour: 12 }),
      'date',
      'noKyokusuData',
    );
    expect(e.message).toContain('2027年1月1日の局数データがありません');
    expectInputError(() => calculateKimonTonkou({ type: '日盤', year: 2025, month: 12, day: 31 }), 'date', 'noKyokusuData');
    // 片方だけの指定では作盤できない
    expectInputError(() => calculateKimonTonkou({ type: '日盤', year: 2025, month: 12, day: 31, kyokusu: 3 }), 'date', 'noKyokusuData');
  });

  it('陰陽と局数を両方指定すれば、データのない日でも作盤できる（現行と同じ）', () => {
    const r = calculateKimonTonkou({ type: '時盤', year: 2027, month: 1, day: 1, hour: 12, yinYang: '陰', kyokusu: 7 });
    expect([r.yinYang, r.kyokusu, r.kyokusuSource]).toEqual(['陰', 7, 'manual']);
  });

  it('片方だけ指定したら、残りはデータから', () => {
    const r = calculateKimonTonkou({ type: '時盤', year: 2026, month: 5, day: 6, hour: 5, kyokusu: 8 });
    expect([r.yinYang, r.kyokusu, r.kyokusuSource]).toEqual(['陽', 8, 'mixed']);
  });

  it('形の正しくない入力', () => {
    expectInputError(() => calculateKimonTonkou({ type: '月盤' as never, year: 2026, month: 1, day: 1 }), 'type');
    expectInputError(() => calculateKimonTonkou({ type: '日盤', year: 2026, month: 2, day: 30 }), 'date');
    expectInputError(() => calculateKimonTonkou({ type: '時盤', year: 2026, month: 2, day: 1 }), 'time');
    expectInputError(() => calculateKimonTonkou({ type: '時盤', year: 2026, month: 2, day: 1, hour: 24 }), 'time');
    expectInputError(() => calculateKimonTonkou({ type: '時盤', year: 2026, month: 2, day: 1, hour: 1, minute: 60 }), 'time');
    expectInputError(() => calculateKimonTonkou({ type: '時盤', year: 2026, month: 2, day: 1, hour: 1, place: '48' }), 'place');
    expectInputError(() => calculateKimonTonkou({ type: '日盤', year: 2026, month: 2, day: 1, kyokusu: 0 }), 'kyokusu');
    expectInputError(() => calculateKimonTonkou({ type: '日盤', year: 2026, month: 2, day: 1, yinYang: '中' as never }), 'yinYang');
    expectInputError(
      () => calculateKimonTonkou({ type: '日盤', year: 1900, month: 2, day: 1, yinYang: '陽', kyokusu: 1 }),
      'date',
    );
  });
});

describe('五不遇時', () => {
  it('時干が日干を剋し、陰陽が同じとき（甲日の庚時など）', () => {
    expect(gobuujiOf('甲', '庚')).toBe(true);
    expect(gobuujiOf('乙', '辛')).toBe(true);
    expect(gobuujiOf('癸', '己')).toBe(true);
    expect(gobuujiOf('甲', '辛')).toBe(false); // 陰陽が違う
    expect(gobuujiOf('己', '己')).toBe(false); // 現行版はこの形（時干どうし）で判定していた
  });

  it('kyokaku.csv の五不遇時の表と一致する', () => {
    const rows = KYOKAKU_RULES.filter((r) => r.category === '五不遇時');
    expect(rows.length).toBe(10);
    for (const row of rows) {
      const [day, hour] = row.conditionValue.split('=') as ['甲', '庚'];
      expect(gobuujiOf(day, hour), row.conditionValue).toBe(true);
    }
  });
});

describe('1日分の時盤', () => {
  it('2時間ごとに12枚', () => {
    const r = calculateKimonDay({ year: 2026, month: 5, day: 6 });
    expect(r.slots.map((s) => s.hour)).toEqual([...KIMON_DAY_HOURS]);
    expect(r.slots.every((s) => s.ok)).toBe(true);
    const branches = r.slots.map((s) => (s.ok ? s.result.pillars.hour!.branch : ''));
    // 東京・5月は +22分なので、0:22（子）・2:22（丑）… 22:22（亥）
    expect(branches.join('')).toBe('子丑寅卯辰巳午未申酉戌亥');
  });

  it('1枚が失敗しても、ほかの盤は返す', () => {
    // 1901年1月6日：小寒（8:55）より前は節入りデータがなく月柱を決められない
    const r = calculateKimonDay({ year: 1901, month: 1, day: 6, yinYang: '陽', kyokusu: 1 });
    const failed = r.slots.filter((s) => !s.ok).map((s) => s.hour);
    const ok = r.slots.filter((s) => s.ok).map((s) => s.hour);
    expect(failed).toEqual([0, 2, 4, 6, 8]);
    expect(ok).toEqual([10, 12, 14, 16, 18, 20, 22]);
  });

  it('局数データのない日は、例外にせず全部の枠を失敗として返す', () => {
    const r = calculateKimonDay({ year: 2027, month: 1, day: 1 });
    expect(r.slots).toHaveLength(12);
    for (const s of r.slots) {
      expect(s.ok).toBe(false);
      if (!s.ok) expect(s.error.code).toBe('noKyokusuData');
    }
  });
});
