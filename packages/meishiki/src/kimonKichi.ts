/**
 * 吉方位さがし（一般会員向け）
 *
 * 時盤をもとに、指定した日から数日分の「吉方位の時間と方角」を探す。陽てん塾の指定による定義:
 * - 生門のある宮の点数が 70点以上
 * - その宮に凶格が1つもない
 * - その時間が五不遇時ではない
 * 生門が南（離宮）なら ◎、北東（艮宮）・南西（坤宮）なら ◯ を付ける。
 *
 * 時間は、時盤の時柱（2時間ごとの十二支の刻）を単位にする。場所による時刻の補正（経度差＋均時差）を
 * 戻して、その場所の時計での始まり・終わりを出す。盤は各刻の真ん中の時刻で作る。
 */
import { fromMinutes, toMinutes, type CivilDate, type CivilDateTime } from './calendar';
import { calculateKimonTonkou, KimonInputError, KIMON_DEFAULT_PLACE } from './kimon';
import { PALACE_INFO, type PalacePosition } from './kimonBoard';
import { EQUATION_OF_TIME_MINUTES, getPrefecture } from './places';

/** 吉方位とみなす生門の宮の点数（以上） */
export const KICHI_HOUI_MIN_SCORE = 70;

/** 生門の方角による印。南は ◎、北東・南西は ◯ */
export type KichiHouiMark = '◎' | '◯' | null;

export function kichiHouiMark(position: PalacePosition): KichiHouiMark {
  if (position === 9) return '◎';
  if (position === 8 || position === 2) return '◯';
  return null;
}

export interface KichiHouiSlot {
  /** その場所の時計での始まり・終わり（終わりは次の刻の始まりと同じ時刻） */
  start: CivilDateTime;
  end: CivilDateTime;
  /** 時柱の干支（甲子など） */
  hourPillar: string;
  /** 生門のある宮 */
  position: PalacePosition;
  /** 方角（南・北東など） */
  direction: string;
  /** 生門の宮の点数 */
  score: number;
  mark: KichiHouiMark;
  /** 「時盤を表示」で同じ盤を作り直すための時刻（その場所の時計。刻の真ん中） */
  boardTime: CivilDateTime;
}

export interface KichiHouiDay {
  date: CivilDate;
  /** その日に始まる吉方位の時間（時刻の順） */
  slots: KichiHouiSlot[];
  /** 局数データがないなどで、その日の一部または全部の刻を判定できなかった */
  unavailable: boolean;
}

export interface KichiHouiInput {
  /** 探しはじめる日（その場所の時計での日付） */
  start: CivilDate;
  /** 何日分か（既定 7） */
  days?: number;
  /** 都道府県コード（既定 '13' 東京都） */
  place?: string;
}

export interface KichiHouiResult {
  place: string;
  placeName: string;
  days: KichiHouiDay[];
}

const SLOT_MINUTES = 120;

function sameDate(a: CivilDate, b: CivilDate): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

/**
 * 指定した日から数日分の吉方位を探す。局数データのない日は unavailable にし、例外にはしない。
 *
 * @throws KimonInputError 場所が正しくないとき
 */
export function findKichiHoui(input: KichiHouiInput): KichiHouiResult {
  const days = input.days ?? 7;
  const place = input.place ?? KIMON_DEFAULT_PLACE;
  let prefecture;
  try {
    prefecture = getPrefecture(place);
  } catch {
    throw new KimonInputError('場所（都道府県）が正しくありません。', 'place');
  }

  const base = toMinutes({ ...input.start, hour: 0, minute: 0 });
  const dates: CivilDate[] = Array.from({ length: days }, (_, i) => {
    const d = fromMinutes(base + i * 1440);
    return { year: d.year, month: d.month, day: d.day };
  });
  const result: KichiHouiDay[] = dates.map((date) => ({ date, slots: [], unavailable: false }));

  // 補正後の時刻で偶数時（0時・2時…）が各刻の真ん中。最初の日の子の刻（前の晩に始まる）から、
  // 最後の日の翌日の子の刻（最後の日の晩に始まる）まで調べ、始まりの日付で振り分ける
  for (let i = 0; i <= days * 12; i++) {
    const adjustedMid = base + i * SLOT_MINUTES;
    const month = fromMinutes(adjustedMid).month;
    const correction = prefecture.longitudeOffsetMinutes + (EQUATION_OF_TIME_MINUTES[month] ?? 0);
    const localMid = adjustedMid - correction;
    const start = fromMinutes(localMid - SLOT_MINUTES / 2);
    const day = result.find((d) => sameDate(d.date, start));
    if (!day) continue;

    const boardTime = fromMinutes(localMid);
    let board;
    try {
      board = calculateKimonTonkou({ type: '時盤', ...boardTime, place });
    } catch (error) {
      if (error instanceof KimonInputError) {
        day.unavailable = true;
        continue;
      }
      throw error;
    }
    if (board.gobuuji) continue;
    const palace = board.palaces.find((p) => p.hachimon === '生');
    if (!palace || palace.score === null) continue; // 生門が中宮に入った盤は点数がない
    if (palace.score < KICHI_HOUI_MIN_SCORE || palace.kyokaku.length > 0) continue;

    day.slots.push({
      start,
      end: fromMinutes(localMid + SLOT_MINUTES / 2),
      hourPillar: `${board.usedPillar.stem}${board.usedPillar.branch}`,
      position: palace.position,
      direction: PALACE_INFO[palace.position].direction,
      score: palace.score,
      mark: kichiHouiMark(palace.position),
      boardTime,
    });
  }

  return { place, placeName: prefecture.name, days: result };
}
