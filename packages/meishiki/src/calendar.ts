/**
 * 日時の計算と節入り時刻
 *
 * 日時はタイムゾーンに左右されないよう、「暦の上の日時」を 1970-01-01 00:00 からの分数（整数）で扱う。
 * Date はこの変換にだけ使い、ローカルのタイムゾーンは使わない。
 *
 * 節入り時刻: data/solar_terms.json（1901〜2040年、毎年12節。日本標準時、分単位）
 */
import rawSolarTerms from '../data/solar_terms.json';
import { isStem, isBranch, type Stem, type Branch } from './constants';

export const MINUTES_PER_DAY = 1440;

export interface CivilDate {
  year: number;
  month: number;
  day: number;
}

export interface CivilDateTime extends CivilDate {
  hour: number;
  minute: number;
}

/** 暦の上の日付を、1970-01-01 からの日数に変換する */
export function toDayNumber({ year, month, day }: CivilDate): number {
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

/** 暦の上の日時を、1970-01-01 00:00 からの分数に変換する */
export function toMinutes(dt: CivilDateTime): number {
  return toDayNumber(dt) * MINUTES_PER_DAY + dt.hour * 60 + dt.minute;
}

export function fromMinutes(totalMinutes: number): CivilDateTime {
  const day = Math.floor(totalMinutes / MINUTES_PER_DAY);
  const rest = totalMinutes - day * MINUTES_PER_DAY;
  const d = new Date(day * 86_400_000);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: Math.floor(rest / 60),
    minute: rest % 60,
  };
}

/** 存在する日付か（2月30日などを弾く） */
export function isValidDate({ year, month, day }: CivilDate): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (month < 1 || month > 12 || day < 1) return false;
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

export interface SolarTerm {
  /** 節の名前（立春・啓蟄…小寒） */
  name: string;
  /** 節入りの日時（分） */
  minutes: number;
  /** 節入りの日（日数） */
  dayNumber: number;
  /** この節から始まる月の干支 */
  monthPillar: { stem: Stem; branch: Branch };
  /** 節入り日の日干支 */
  dayPillar: { stem: Stem; branch: Branch };
  /** データ上の年（solar_terms.json のキー） */
  dataYear: number;
}

interface RawTerm {
  date: string;
  hour: number;
  minute: number;
  term: string;
  month_pillar: string;
  day_pillar: string;
}

function splitPillar(value: string, context: string): { stem: Stem; branch: Branch } {
  const stem = value[0] ?? '';
  const branch = value[1] ?? '';
  if (!isStem(stem) || !isBranch(branch)) {
    throw new Error(`節入りデータの干支が不正です（${context}）: ${value}`);
  }
  return { stem, branch };
}

function loadTerms(): SolarTerm[] {
  const data = rawSolarTerms as Record<string, Record<string, RawTerm[]>>;
  const terms: SolarTerm[] = [];
  for (const [yearKey, months] of Object.entries(data)) {
    for (const list of Object.values(months)) {
      for (const t of list) {
        const [y, m, d] = t.date.split('-').map(Number) as [number, number, number];
        const date = { year: y, month: m, day: d };
        terms.push({
          name: t.term,
          minutes: toMinutes({ ...date, hour: t.hour, minute: t.minute }),
          dayNumber: toDayNumber(date),
          monthPillar: splitPillar(t.month_pillar, `${t.date} ${t.term}`),
          dayPillar: splitPillar(t.day_pillar, `${t.date} ${t.term}`),
          dataYear: Number(yearKey),
        });
      }
    }
  }
  terms.sort((a, b) => a.minutes - b.minutes);
  return terms;
}

/** すべての節入り（日時の昇順） */
export const SOLAR_TERMS: readonly SolarTerm[] = loadTerms();

export const FIRST_YEAR = 1901;
export const LAST_YEAR = 2040;

/** 指定した時刻までに最後に通過した節（at 以下で最大）。なければ null */
export function lastTermAtOrBefore(minutes: number): SolarTerm | null {
  let lo = 0;
  let hi = SOLAR_TERMS.length - 1;
  let found: SolarTerm | null = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const term = SOLAR_TERMS[mid]!;
    if (term.minutes <= minutes) {
      found = term;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}

/** 指定した時刻より前の、最も近い節（at 未満）。なければ null */
export function lastTermBefore(minutes: number): SolarTerm | null {
  return lastTermAtOrBefore(minutes - 1);
}

/** 指定した時刻より後の、最も近い節（at より後）。なければ null */
export function firstTermAfter(minutes: number): SolarTerm | null {
  const last = lastTermAtOrBefore(minutes);
  const index = last ? SOLAR_TERMS.indexOf(last) + 1 : 0;
  return SOLAR_TERMS[index] ?? null;
}

/** 指定した日以前で、最も近い節入り日の節（日付だけで比べる）。なければ null */
export function lastTermOnOrBeforeDay(dayNumber: number): SolarTerm | null {
  return lastTermAtOrBefore((dayNumber + 1) * MINUTES_PER_DAY - 1);
}

/** その年の立春 */
export function risshunOf(year: number): SolarTerm | null {
  return SOLAR_TERMS.find((t) => t.dataYear === year && t.name === '立春') ?? null;
}
