/**
 * 四柱推命の基本の表
 * 現行: backend/apps/fortune/calculators.py 17-157, 744-763 / skill_sheet.py
 */

export const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'] as const;
export const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'] as const;

export type Stem = (typeof STEMS)[number];
export type Branch = (typeof BRANCHES)[number];

export const ELEMENTS = ['wood', 'fire', 'earth', 'metal', 'water'] as const;
export type Element = (typeof ELEMENTS)[number];

export const ELEMENT_LABELS: Record<Element, string> = {
  wood: '木',
  fire: '火',
  earth: '土',
  metal: '金',
  water: '水',
};

export const STARS = ['比肩', '劫財', '食神', '傷官', '偏財', '正財', '偏官', '正官', '偏印', '印綬'] as const;
export type Star = (typeof STARS)[number];

/** 日干から見た5つのグループ */
export const ELEMENT_GROUPS = ['比劫', '印', '食傷', '財', '官'] as const;
export type ElementGroup = (typeof ELEMENT_GROUPS)[number];

export const STEM_TO_ELEMENT: Record<Stem, Element> = {
  甲: 'wood', 乙: 'wood',
  丙: 'fire', 丁: 'fire',
  戊: 'earth', 己: 'earth',
  庚: 'metal', 辛: 'metal',
  壬: 'water', 癸: 'water',
};

export const BRANCH_TO_ELEMENT: Record<Branch, Element> = {
  子: 'water', 亥: 'water',
  寅: 'wood', 卯: 'wood',
  巳: 'fire', 午: 'fire',
  申: 'metal', 酉: 'metal',
  丑: 'earth', 辰: 'earth', 未: 'earth', 戌: 'earth',
};

export const YANG_STEMS: ReadonlySet<Stem> = new Set<Stem>(['甲', '丙', '戊', '庚', '壬']);

/** 相生の順（日干から見たグループの割り当てと、五行図の並びに使う） */
export const ELEMENT_CYCLE: readonly Element[] = ['wood', 'fire', 'earth', 'metal', 'water'];

/** 相剋の順（木→土→水→火→金→木）。死令の判定に使う */
export const KEIKO_CYCLE: readonly Element[] = ['wood', 'earth', 'water', 'fire', 'metal'];

export interface HiddenStems {
  /** 本気 */
  honki: Stem;
  /** 中気 */
  chuki: Stem | null;
  /** 余気 */
  yoki: Stem | null;
}

/** 蔵干（中国式） */
export const HIDDEN_STEMS: Record<Branch, HiddenStems> = {
  子: { yoki: null, chuki: null, honki: '癸' },
  丑: { yoki: '癸', chuki: '辛', honki: '己' },
  寅: { yoki: '戊', chuki: '丙', honki: '甲' },
  卯: { yoki: null, chuki: null, honki: '乙' },
  辰: { yoki: '乙', chuki: '癸', honki: '戊' },
  巳: { yoki: '戊', chuki: '庚', honki: '丙' },
  午: { yoki: null, chuki: '己', honki: '丁' },
  未: { yoki: '丁', chuki: '乙', honki: '己' },
  申: { yoki: '戊', chuki: '壬', honki: '庚' },
  酉: { yoki: null, chuki: null, honki: '辛' },
  戌: { yoki: '辛', chuki: '丁', honki: '戊' },
  亥: { yoki: null, chuki: '甲', honki: '壬' },
};

/** 通変星（日干 × 対象の干） */
export const STAR_TABLE: Record<Stem, Record<Stem, Star>> = {
  甲: { 甲: '比肩', 乙: '劫財', 丙: '食神', 丁: '傷官', 戊: '偏財', 己: '正財', 庚: '偏官', 辛: '正官', 壬: '偏印', 癸: '印綬' },
  乙: { 乙: '比肩', 甲: '劫財', 丁: '食神', 丙: '傷官', 己: '偏財', 戊: '正財', 辛: '偏官', 庚: '正官', 癸: '偏印', 壬: '印綬' },
  丙: { 丙: '比肩', 丁: '劫財', 戊: '食神', 己: '傷官', 庚: '偏財', 辛: '正財', 壬: '偏官', 癸: '正官', 甲: '偏印', 乙: '印綬' },
  丁: { 丁: '比肩', 丙: '劫財', 己: '食神', 戊: '傷官', 辛: '偏財', 庚: '正財', 癸: '偏官', 壬: '正官', 乙: '偏印', 甲: '印綬' },
  戊: { 戊: '比肩', 己: '劫財', 庚: '食神', 辛: '傷官', 壬: '偏財', 癸: '正財', 甲: '偏官', 乙: '正官', 丙: '偏印', 丁: '印綬' },
  己: { 己: '比肩', 戊: '劫財', 辛: '食神', 庚: '傷官', 癸: '偏財', 壬: '正財', 乙: '偏官', 甲: '正官', 丁: '偏印', 丙: '印綬' },
  庚: { 庚: '比肩', 辛: '劫財', 壬: '食神', 癸: '傷官', 甲: '偏財', 乙: '正財', 丙: '偏官', 丁: '正官', 戊: '偏印', 己: '印綬' },
  辛: { 辛: '比肩', 庚: '劫財', 癸: '食神', 壬: '傷官', 乙: '偏財', 甲: '正財', 丁: '偏官', 丙: '正官', 己: '偏印', 戊: '印綬' },
  壬: { 壬: '比肩', 癸: '劫財', 甲: '食神', 乙: '傷官', 丙: '偏財', 丁: '正財', 戊: '偏官', 己: '正官', 庚: '偏印', 辛: '印綬' },
  癸: { 癸: '比肩', 壬: '劫財', 乙: '食神', 甲: '傷官', 丁: '偏財', 丙: '正財', 己: '偏官', 戊: '正官', 辛: '偏印', 庚: '印綬' },
};

export function starOf(dayStem: Stem, target: Stem): Star;
export function starOf(dayStem: Stem, target: Stem | null): Star | null;
export function starOf(dayStem: Stem, target: Stem | null): Star | null {
  return target ? STAR_TABLE[dayStem][target] : null;
}

/** 干合の組み合わせ */
export const KANGOU_PARTNER: Record<Stem, Stem> = {
  甲: '己', 己: '甲',
  乙: '庚', 庚: '乙',
  丙: '辛', 辛: '丙',
  丁: '壬', 壬: '丁',
  戊: '癸', 癸: '戊',
};

/** 負の数でも 0〜n-1 を返す剰余（Python の % と同じ） */
export function mod(a: number, n: number): number {
  return ((a % n) + n) % n;
}

export function stemAt(index: number): Stem {
  return STEMS[mod(index, 10)]!;
}

export function branchAt(index: number): Branch {
  return BRANCHES[mod(index, 12)]!;
}

export function isStem(value: string): value is Stem {
  return (STEMS as readonly string[]).includes(value);
}

export function isBranch(value: string): value is Branch {
  return (BRANCHES as readonly string[]).includes(value);
}
