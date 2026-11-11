/**
 * 命式の計算：基準ケース、現行の不具合の修正、オプション、入力チェック
 * 仕様: 新仕様書/付録A_鑑定ロジック仕様.md、付録B_現行システムの課題.md
 */
import { describe, expect, it } from 'vitest';
import { calculateMeishiki, LEGACY_OPTIONS, MeishikiInputError, type MeishikiInput } from '../src';

const pillars = (input: MeishikiInput, options = {}) => {
  const r = calculateMeishiki(input, options);
  const p = r.pillars;
  return [p.year, p.month, p.day, p.hour].map((x) => (x ? x.stem + x.branch : '—'));
};

const GIFU = '21';
const TOKYO = '13';
const OSAKA = '27';

describe('基準ケース（付録A A.3）', () => {
  const input: MeishikiInput = { year: 1985, month: 5, day: 10, hour: 11, minute: 30, birthPlace: GIFU, gender: 'male' };

  it('1985-05-10 11:30 岐阜 男性', () => {
    const r = calculateMeishiki(input);
    expect(pillars(input)).toEqual(['乙丑', '辛巳', '己酉', '庚午']);
    expect(r.dayStem).toBe('己');
    expect(r.kakukyoku).toBe('傷官格');
    expect(r.taiun?.direction).toBe('逆運');
    expect(r.taiun?.ritsuun).toBe(2);
    expect(r.pillars.hour?.stemStar).toBe('傷官');
    // 既定は経度差だけで補正する（岐阜 +7分）。均時差は使わない（お手本サイトと同じ）
    expect(r.correction).toMatchObject({ longitudeMinutes: 7, equationOfTimeMinutes: 0 });
    expect(r.correction.adjusted).toEqual({ year: 1985, month: 5, day: 10, hour: 11, minute: 37 });
  });

  it('日干から見たグループと身旺身弱', () => {
    const r = calculateMeishiki(input);
    expect(r.elementGroups.比劫.element).toBe('earth');
    expect(r.elementGroups.食傷.element).toBe('metal');
    expect(r.elementGroups.印.element).toBe('fire');
    const g = r.elementGroups;
    expect(r.strength.diff).toBe(g.比劫.score + g.印.score - (g.食傷.score + g.財.score + g.官.score));
  });
});

describe('現行の不具合の修正（付録B B.1）', () => {
  it('1月1日〜小寒前は、前年12月（大雪）の月柱になる', () => {
    expect(pillars({ year: 1990, month: 1, day: 3, hour: 12, birthPlace: TOKYO, gender: 'male' })[1]).toBe('丙子');
    expect(pillars({ year: 2000, month: 1, day: 1, hour: 0, minute: 30, birthPlace: TOKYO, gender: 'male' })[1]).toBe(
      '丙子',
    );
  });

  it('時間不明のときは時刻を補正せず、日柱が前日にずれない', () => {
    const r = calculateMeishiki({ year: 1990, month: 3, day: 10, hourUnknown: true, birthPlace: OSAKA, gender: 'male' });
    expect(r.pillars.day.stem + r.pillars.day.branch).toBe('甲戌');
    expect(r.pillars.hour).toBeNull();
    expect(r.correction.applied).toBe(false);
  });

  it('時間不明のときは、時柱を五行・格局に含めない', () => {
    const known = calculateMeishiki({ year: 1990, month: 7, day: 20, hour: 15, birthPlace: TOKYO, gender: 'male' });
    const unknown = calculateMeishiki({ year: 1990, month: 7, day: 20, hourUnknown: true, birthPlace: TOKYO, gender: 'male' });
    const sum = (r: typeof known) => Object.values(r.fiveElements).reduce((a, b) => a + b, 0);
    expect(sum(unknown)).toBeLessThan(sum(known));
    expect(unknown.kangou.some((k) => (k.pillars as readonly string[]).includes('hour'))).toBe(false);
  });

  it('節入りの当日に生まれても、大運の向きの節を取り違えない', () => {
    // 1990年立春の30分後（付録D No.4）は順運。次の節（啓蟄）まで約30日で立運10歳（お手本サイトと同じ）
    const input: MeishikiInput = { year: 1990, month: 2, day: 4, hour: 11, minute: 44, birthPlace: TOKYO, gender: 'male' };
    const r = calculateMeishiki(input);
    expect(r.taiun?.direction).toBe('順運');
    expect(r.taiun?.ritsuun).toBe(10);
    expect(r.taiun?.periods.find((p) => p.ageStart === 10)).toMatchObject({ stem: '己', branch: '卯' });
    // 現行版の決まりでは、当日の立春を「次の節」と数えて立運0歳になっていた
    expect(calculateMeishiki(input, LEGACY_OPTIONS).taiun?.ritsuun).toBe(0);
  });

  it('節入りの直後で日数がほぼ0でも、立運は1歳（お手本サイトと同じ）', () => {
    const r = calculateMeishiki({ year: 2000, month: 1, day: 6, hour: 10, minute: 32, birthPlace: TOKYO, gender: 'male' });
    expect(r.taiun?.ritsuun).toBe(1);
  });
});


describe('オプション', () => {
  it('節入りは補正前の日本標準時で比べる。corrected にすると補正後の時刻で比べる（現行版）', () => {
    // 那覇 11:24 は、立春（11:14）の10分後。補正（−29分）すると立春前
    const input: MeishikiInput = { year: 1990, month: 2, day: 4, hour: 11, minute: 24, birthPlace: '47', gender: 'male' };
    expect(pillars(input)[0]).toBe('庚午');
    expect(pillars(input, { termBasis: 'corrected' })[0]).toBe('己巳');
  });

  it('補正なしにすると、入力した時刻のまま計算する', () => {
    const r = calculateMeishiki(
      { year: 1993, month: 9, day: 9, hour: 10, minute: 45, birthPlace: TOKYO, gender: 'male' },
      { longitudeCorrection: false },
    );
    expect(r.correction.applied).toBe(false);
    expect(r.pillars.hour?.branch).toBe('巳');
  });

  it('23時台の時柱は翌日の子の刻。境目を23時にすると日柱も翌日になる', () => {
    const input: MeishikiInput = { year: 1992, month: 6, day: 15, hour: 23, minute: 30, birthPlace: TOKYO, gender: 'male' };
    expect(pillars(input).slice(2)).toEqual(['壬戌', '壬子']);
    expect(pillars(input, { dayBoundary: '23' }).slice(2)).toEqual(['癸亥', '壬子']);
    // 現行版：時柱は日柱の日干から出す
    expect(pillars(input, LEGACY_OPTIONS).slice(2)).toEqual(['壬戌', '庚子']);
  });

  it('時刻不明のときは、正午として節入りと比べる（立春の当日は立春後）', () => {
    const input: MeishikiInput = { year: 1990, month: 2, day: 4, hourUnknown: true, birthPlace: TOKYO, gender: 'male' };
    expect(pillars(input).slice(0, 2)).toEqual(['庚午', '戊寅']);
    expect(pillars(input, LEGACY_OPTIONS).slice(0, 2)).toEqual(['己巳', '丁丑']);
  });
});


describe('入力チェック', () => {
  const base: MeishikiInput = { year: 1990, month: 1, day: 1, hour: 12, birthPlace: TOKYO, gender: 'male' };

  it.each([
    ['存在しない日付', { month: 2, day: 30 }, 'date'],
    ['範囲外の年（1900年）', { year: 1900 }, 'date'],
    ['範囲外の年（2041年）', { year: 2041 }, 'date'],
    ['節入りデータより前（1901年1月1日）', { year: 1901, month: 1, day: 1 }, 'date'],
    ['時刻なし', { hour: undefined }, 'time'],
    ['24時', { hour: 24 }, 'time'],
    ['都道府県コードの誤り', { birthPlace: '48' }, 'birthPlace'],
  ] as const)('%s', (_label, patch, field) => {
    const call = () => calculateMeishiki({ ...base, ...patch } as MeishikiInput);
    expect(call).toThrow(MeishikiInputError);
    try {
      call();
    } catch (e) {
      expect((e as MeishikiInputError).field).toBe(field);
    }
  });

  it('2040年12月31日は計算でき、大運は節入りデータがなければ null', () => {
    const r = calculateMeishiki({ ...base, year: 2040, month: 12, day: 31 });
    expect(r.pillars.day.stem + r.pillars.day.branch).toBe('癸巳');
    expect(r.taiun === null || r.taiun.periods.length > 0).toBe(true);
  });
});
