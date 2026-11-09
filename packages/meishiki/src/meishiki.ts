/**
 * 命式の計算（四柱・蔵干・通変星・五行バランス・身旺身弱・格局・干合・大運）
 *
 * 仕様: 新仕様書/付録A_鑑定ロジック仕様.md
 * 現行: backend/apps/fortune/calculators.py（calculate_fortune）
 *
 * 現行からの意図的な変更（付録A・付録B）:
 * - 1月1日〜小寒前の月柱：前年12月（大雪）の月柱を使う（現行は前年1月の丑月を拾う不具合）
 * - 時間不明：時刻の補正をしない（現行は0時として補正し、日柱が前日にずれることがある）
 * - 範囲外：節入りデータで決められない日時はエラーにする（現行は誤った予備計算をする）
 * - 大運：立運0歳のときの「0〜−1歳」の運を出さない。節入りデータがなく出せないときは null
 * - 身旺身弱・干合もここで計算する（現行は画面側とスキル表側で別々に計算）
 */
import {
  BRANCH_TO_ELEMENT,
  ELEMENT_CYCLE,
  ELEMENTS,
  HIDDEN_STEMS,
  KANGOU_PARTNER,
  KEIKO_CYCLE,
  STEM_TO_ELEMENT,
  STEMS,
  BRANCHES,
  YANG_STEMS,
  branchAt,
  starOf,
  stemAt,
  type Branch,
  type Element,
  type ElementGroup,
  type HiddenStems,
  type Stem,
  type Star,
} from './constants';
import {
  FIRST_YEAR,
  LAST_YEAR,
  MINUTES_PER_DAY,
  firstTermAfter,
  fromMinutes,
  isValidDate,
  lastTermAtOrBefore,
  lastTermBefore,
  lastTermOnOrBeforeDay,
  risshunOf,
  toDayNumber,
  toMinutes,
  type CivilDate,
  type CivilDateTime,
} from './calendar';
import { EQUATION_OF_TIME_MINUTES, getPrefecture, type Prefecture } from './places';

/** 計算ロジックの版。結果と一緒に保存し、ロジックを直したときの再計算の目印にする */
export const CALC_VERSION = 'meishiki-0.1.0';

export type Gender = 'male' | 'female';

export interface MeishikiInput {
  year: number;
  month: number;
  day: number;
  /** 時（0〜23）。時間不明なら無視する */
  hour?: number;
  /** 分（0〜59）。時間不明なら無視する */
  minute?: number;
  hourUnknown?: boolean;
  /** 出生地の都道府県コード（01〜47） */
  birthPlace: string;
  gender: Gender;
}

export interface MeishikiOptions {
  /** 経度差による補正をするか（既定 true。お手本サイトの扱いに合わせて決める） */
  longitudeCorrection?: boolean;
  /** 均時差による補正をするか（既定 true） */
  equationOfTimeCorrection?: boolean;
  /**
   * 23時台（補正後）の日柱の扱い（既定 'sameDay'）
   * - sameDay: 当日の日柱のまま（現行と同じ）
   * - nextDay: 翌日の日柱にする（時柱の天干も翌日の日干から出す）
   */
  lateNightRule?: 'sameDay' | 'nextDay';
}

export interface Pillar {
  stem: Stem;
  branch: Branch;
  /** 天干の通変星（日柱は「比肩」） */
  stemStar: Star;
  hidden: HiddenStems;
  hiddenStars: { honki: Star; chuki: Star | null; yoki: Star | null };
}

export interface Kangou {
  pillars: ['hour', 'day'] | ['day', 'month'] | ['month', 'year'];
  stems: [Stem, Stem];
  label: string;
}

export interface TaiunPeriod {
  ageStart: number;
  ageEnd: number;
  stem: Stem;
  branch: Branch;
  stemStar: Star;
}

export interface Taiun {
  direction: '順運' | '逆運';
  /** 立運（歳） */
  ritsuun: number;
  periods: TaiunPeriod[];
}

export interface MeishikiResult {
  calcVersion: string;
  input: Required<Omit<MeishikiInput, 'hour' | 'minute'>> & { hour: number | null; minute: number | null };
  /** 補正の内容。時間不明なら applied は false */
  correction: {
    applied: boolean;
    longitudeMinutes: number;
    equationOfTimeMinutes: number;
    /** 補正後の日時（時間不明なら入力日の0時） */
    adjusted: CivilDateTime;
  };
  pillars: { year: Pillar; month: Pillar; day: Pillar; hour: Pillar | null };
  dayStem: Stem;
  fiveElements: Record<Element, number>;
  /** 日干から見た5グループの五行と点数 */
  elementGroups: Record<ElementGroup, { element: Element; score: number }>;
  strength: { label: '身旺' | '身弱' | '中和'; diff: number };
  /** 格局。決まらない（比肩・劫財）ときは空文字 */
  kakukyoku: string;
  kangou: Kangou[];
  /** 大運。節入りデータの範囲外で出せないときは null */
  taiun: Taiun | null;
}

export class MeishikiInputError extends Error {
  constructor(
    message: string,
    readonly field: 'date' | 'time' | 'birthPlace' | 'gender',
  ) {
    super(message);
    this.name = 'MeishikiInputError';
  }
}

// ---------------------------------------------------------------------------

function validate(input: MeishikiInput): void {
  const date = { year: input.year, month: input.month, day: input.day };
  if (!isValidDate(date)) {
    throw new MeishikiInputError('存在しない日付です。', 'date');
  }
  if (input.year < FIRST_YEAR || input.year > LAST_YEAR) {
    throw new MeishikiInputError(`${FIRST_YEAR}年〜${LAST_YEAR}年の生まれに対応しています。`, 'date');
  }
  if (!input.hourUnknown) {
    const { hour, minute = 0 } = input;
    if (hour === undefined || !Number.isInteger(hour) || hour < 0 || hour > 23) {
      throw new MeishikiInputError('時刻（時）が正しくありません。', 'time');
    }
    if (!Number.isInteger(minute) || minute < 0 || minute > 59) {
      throw new MeishikiInputError('時刻（分）が正しくありません。', 'time');
    }
  }
  if (input.gender !== 'male' && input.gender !== 'female') {
    throw new MeishikiInputError('性別が正しくありません。', 'gender');
  }
}

function adjustTime(
  input: MeishikiInput,
  prefecture: Prefecture,
  options: Required<MeishikiOptions>,
): MeishikiResult['correction'] {
  const date: CivilDate = { year: input.year, month: input.month, day: input.day };
  if (input.hourUnknown) {
    return {
      applied: false,
      longitudeMinutes: 0,
      equationOfTimeMinutes: 0,
      adjusted: { ...date, hour: 0, minute: 0 },
    };
  }
  const longitudeMinutes = options.longitudeCorrection ? prefecture.longitudeOffsetMinutes : 0;
  // 均時差は入力した生月（補正前）で引く（現行と同じ）
  const equationOfTimeMinutes = options.equationOfTimeCorrection
    ? (EQUATION_OF_TIME_MINUTES[input.month] ?? 0)
    : 0;
  const base = toMinutes({ ...date, hour: input.hour!, minute: input.minute ?? 0 });
  return {
    applied: longitudeMinutes !== 0 || equationOfTimeMinutes !== 0,
    longitudeMinutes,
    equationOfTimeMinutes,
    adjusted: fromMinutes(base + longitudeMinutes + equationOfTimeMinutes),
  };
}

function yearPillar(adjusted: CivilDateTime): { stem: Stem; branch: Branch } {
  const risshun = risshunOf(adjusted.year);
  const year = risshun && toMinutes(adjusted) < risshun.minutes ? adjusted.year - 1 : adjusted.year;
  const offset = year - 1984; // 1984年 = 甲子
  return { stem: stemAt(offset), branch: branchAt(offset) };
}

function monthPillar(adjusted: CivilDateTime): { stem: Stem; branch: Branch } {
  const term = lastTermAtOrBefore(toMinutes(adjusted));
  if (!term) {
    throw new MeishikiInputError('節入りデータの範囲外のため、月柱を決められません。', 'date');
  }
  return term.monthPillar;
}

function dayPillarOf(dayNumber: number): { stem: Stem; branch: Branch } {
  const term = lastTermOnOrBeforeDay(dayNumber);
  if (!term) {
    throw new MeishikiInputError('節入りデータの範囲外のため、日柱を決められません。', 'date');
  }
  const diff = dayNumber - term.dayNumber;
  return {
    stem: stemAt(STEMS.indexOf(term.dayPillar.stem) + diff),
    branch: branchAt(BRANCHES.indexOf(term.dayPillar.branch) + diff),
  };
}

function hourPillar(dayStem: Stem, hour: number): { stem: Stem; branch: Branch } {
  const branchIndex = Math.floor((hour + 1) / 2) % 12; // 23時は子
  return {
    stem: stemAt(STEMS.indexOf(dayStem) * 2 + branchIndex), // 五鼠遁
    branch: branchAt(branchIndex),
  };
}

function makePillar(base: { stem: Stem; branch: Branch }, dayStem: Stem): Pillar {
  const hidden = HIDDEN_STEMS[base.branch];
  return {
    ...base,
    stemStar: starOf(dayStem, base.stem),
    hidden,
    hiddenStars: {
      honki: starOf(dayStem, hidden.honki),
      chuki: starOf(dayStem, hidden.chuki),
      yoki: starOf(dayStem, hidden.yoki),
    },
  };
}

/** 五行バランスの点数（現行: calculate_five_elements_balance） */
export function fiveElementScores(
  pillars: readonly (Pillar | null)[],
  monthBranch: Branch,
): Record<Element, number> {
  const scores: Record<Element, number> = { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 };
  const inStems = new Set<Element>();
  const present = pillars.filter((p): p is Pillar => p !== null);

  // 1. 天干：各10点
  for (const p of present) {
    const element = STEM_TO_ELEMENT[p.stem];
    scores[element] += 10;
    inStems.add(element);
  }
  // 2. 蔵干
  let haiCount = 0;
  for (const p of present) {
    if (p.branch === '亥') haiCount += 1;
    const { honki, chuki, yoki } = p.hidden;
    const honkiPoints = p.branch === '子' || p.branch === '卯' || p.branch === '酉' || (p.branch === '午' && honki === '丁') ? 20 : 10;
    scores[STEM_TO_ELEMENT[honki]] += honkiPoints;
    if (chuki && !(p.branch === '午' && chuki === '己')) scores[STEM_TO_ELEMENT[chuki]] += 5;
    if (yoki) scores[STEM_TO_ELEMENT[yoki]] += 5;
  }
  scores.earth += haiCount * 5; // 亥には余気がないため土に加点
  // 3. 月令：月支の五行を2倍
  const monthElement = BRANCH_TO_ELEMENT[monthBranch];
  scores[monthElement] *= 2;
  // 4. 死令：月令の五行が剋す五行を半分
  const killed = KEIKO_CYCLE[(KEIKO_CYCLE.indexOf(monthElement) + 1) % 5]!;
  scores[killed] /= 2;
  // 5. 天干にない五行を半分
  for (const element of ELEMENTS) {
    if (!inStems.has(element)) scores[element] /= 2;
  }
  return scores;
}

/** 日干から見た5グループの五行（比劫・食傷・財・官・印） */
export function elementGroupsOf(dayStem: Stem): Record<ElementGroup, Element> {
  const i = ELEMENT_CYCLE.indexOf(STEM_TO_ELEMENT[dayStem]);
  return {
    比劫: ELEMENT_CYCLE[i]!,
    食傷: ELEMENT_CYCLE[(i + 1) % 5]!, // 日干が生じる
    財: ELEMENT_CYCLE[(i + 2) % 5]!, // 日干が剋す
    官: ELEMENT_CYCLE[(i + 3) % 5]!, // 日干を剋す
    印: ELEMENT_CYCLE[(i + 4) % 5]!, // 日干を生じる
  };
}

/** 格局（現行: calculate_kakukyoku） */
export function kakukyokuOf(monthBranch: Branch, stems: readonly Stem[], dayStem: Stem): string {
  const { honki, chuki, yoki } = HIDDEN_STEMS[monthBranch];
  const isToukan = (hidden: Stem | null) =>
    hidden !== null && stems.some((s) => STEM_TO_ELEMENT[s] === STEM_TO_ELEMENT[hidden]);
  const kakuName = (hidden: Stem | null) => {
    if (!hidden) return '';
    const star = starOf(dayStem, hidden);
    return star === '比肩' || star === '劫財' ? '' : `${star}格`;
  };

  if (isToukan(honki)) {
    const kaku = kakuName(honki);
    if (kaku) return kaku;
  }
  const yokiToukan = isToukan(yoki);
  const chukiToukan = isToukan(chuki);
  if (yokiToukan && chukiToukan) {
    const both = [kakuName(yoki), kakuName(chuki)].filter(Boolean);
    if (both.length) return both.join('または');
  } else if (yokiToukan) {
    const kaku = kakuName(yoki);
    if (kaku) return kaku;
  } else if (chukiToukan) {
    const kaku = kakuName(chuki);
    if (kaku) return kaku;
  }
  return kakuName(honki);
}

function kangouOf(pillars: MeishikiResult['pillars']): Kangou[] {
  const result: Kangou[] = [];
  const check = (a: Stem, b: Stem) => KANGOU_PARTNER[a] === b;
  const { hour, day, month, year } = pillars;
  if (hour && check(hour.stem, day.stem)) {
    result.push({ pillars: ['hour', 'day'], stems: [hour.stem, day.stem], label: '時柱と日柱' });
  }
  if (check(day.stem, month.stem)) {
    result.push({ pillars: ['day', 'month'], stems: [day.stem, month.stem], label: '日柱と月柱' });
  }
  if (check(month.stem, year.stem)) {
    result.push({ pillars: ['month', 'year'], stems: [month.stem, year.stem], label: '月柱と年柱' });
  }
  return result;
}

/** 大運（現行: calculate_taiun）。日数は時刻付きの差を日単位で切り捨てて数える */
function taiunOf(
  adjusted: CivilDate,
  yearStem: Stem,
  month: { stem: Stem; branch: Branch },
  dayStem: Stem,
  gender: Gender,
): Taiun | null {
  const isYang = YANG_STEMS.has(yearStem);
  const forward = gender === 'male' ? isYang : !isYang;
  const birthMidnight = toDayNumber(adjusted) * MINUTES_PER_DAY;

  let days: number;
  if (forward) {
    const term = firstTermAfter(birthMidnight);
    if (!term) return null;
    days = Math.floor((term.minutes - birthMidnight) / MINUTES_PER_DAY);
  } else {
    const term = lastTermBefore(birthMidnight);
    if (!term) return null;
    days = Math.floor((birthMidnight - term.minutes) / MINUTES_PER_DAY) + 1; // 両端を数える
  }
  const quotient = Math.floor(days / 3);
  const ritsuun = days % 3 === 2 ? quotient + 1 : quotient;

  const step = forward ? 1 : -1;
  const stemIndex = STEMS.indexOf(month.stem);
  const branchIndex = BRANCHES.indexOf(month.branch);
  const periods: TaiunPeriod[] = [];
  for (let i = 0; i < 12; i++) {
    const ageStart = i === 0 ? 0 : ritsuun + (i - 1) * 10;
    const ageEnd = i === 0 ? ritsuun - 1 : ageStart + 9;
    if (ageEnd < ageStart) continue; // 立運0歳のとき、最初の運はない
    const stem = stemAt(stemIndex + i * step);
    periods.push({ ageStart, ageEnd, stem, branch: branchAt(branchIndex + i * step), stemStar: starOf(dayStem, stem) });
  }
  return { direction: forward ? '順運' : '逆運', ritsuun, periods };
}

// ---------------------------------------------------------------------------

export function calculateMeishiki(input: MeishikiInput, options: MeishikiOptions = {}): MeishikiResult {
  validate(input);
  const opts: Required<MeishikiOptions> = {
    longitudeCorrection: options.longitudeCorrection ?? true,
    equationOfTimeCorrection: options.equationOfTimeCorrection ?? true,
    lateNightRule: options.lateNightRule ?? 'sameDay',
  };
  let prefecture: Prefecture;
  try {
    prefecture = getPrefecture(input.birthPlace);
  } catch {
    throw new MeishikiInputError('生まれた場所が正しくありません。', 'birthPlace');
  }

  const correction = adjustTime(input, prefecture, opts);
  const { adjusted } = correction;
  const hourUnknown = input.hourUnknown === true;

  const y = yearPillar(adjusted);
  const m = monthPillar(adjusted);
  const dayShift = !hourUnknown && opts.lateNightRule === 'nextDay' && adjusted.hour === 23 ? 1 : 0;
  const d = dayPillarOf(toDayNumber(adjusted) + dayShift);
  const dayStem = d.stem;
  const h = hourUnknown ? null : hourPillar(dayStem, adjusted.hour);

  const pillars = {
    year: makePillar(y, dayStem),
    month: makePillar(m, dayStem),
    day: makePillar(d, dayStem),
    hour: h ? makePillar(h, dayStem) : null,
  };

  const fiveElements = fiveElementScores([pillars.year, pillars.month, pillars.day, pillars.hour], m.branch);
  const groupElements = elementGroupsOf(dayStem);
  const elementGroups = Object.fromEntries(
    (Object.entries(groupElements) as [ElementGroup, Element][]).map(([group, element]) => [
      group,
      { element, score: fiveElements[element] },
    ]),
  ) as MeishikiResult['elementGroups'];
  const g = (name: ElementGroup) => elementGroups[name].score;
  const diff = g('比劫') + g('印') - (g('食傷') + g('財') + g('官'));

  const stems = [pillars.year.stem, pillars.month.stem, pillars.day.stem, ...(pillars.hour ? [pillars.hour.stem] : [])];

  return {
    calcVersion: CALC_VERSION,
    input: {
      year: input.year,
      month: input.month,
      day: input.day,
      hour: hourUnknown ? null : input.hour!,
      minute: hourUnknown ? null : (input.minute ?? 0),
      hourUnknown,
      birthPlace: input.birthPlace,
      gender: input.gender,
    },
    correction,
    pillars,
    dayStem,
    fiveElements,
    elementGroups,
    strength: { label: diff > 0 ? '身旺' : diff < 0 ? '身弱' : '中和', diff },
    kakukyoku: kakukyokuOf(m.branch, stems, dayStem),
    kangou: kangouOf(pillars),
    taiun: taiunOf(adjusted, y.stem, m, dayStem, input.gender),
  };
}
