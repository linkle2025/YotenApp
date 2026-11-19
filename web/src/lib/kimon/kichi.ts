import type { CivilDateTime } from "@yoten/meishiki";

/** 吉方位の場所の既定（愛知県） */
export const KIMON_PLACE_DEFAULT = "23";

export const pad2 = (n: number) => String(n).padStart(2, "0");

/** 「時盤を表示」の行き先。日時と場所を URL に持たせる */
export function kimonBoardHref(t: CivilDateTime, place: string) {
  const q = new URLSearchParams({
    date: `${t.year}-${pad2(t.month)}-${pad2(t.day)}`,
    time: `${pad2(t.hour)}:${pad2(t.minute)}`,
    place,
  });
  return `/kimon/board?${q}`;
}

/** 時間の始まりを「2026-11-20T09:00」の形にする（実践履歴との突き合わせに使う。その場所の時計） */
export function slotKey(t: CivilDateTime) {
  return `${t.year}-${pad2(t.month)}-${pad2(t.day)}T${pad2(t.hour)}:${pad2(t.minute)}`;
}

/** 実践した吉方位の目印（場所・時間・理由・宮の位置） */
export function practiceKey(place: string, start: string, kind: string, position: number) {
  return `${place}|${start}|${kind}|${position}`;
}

/** 先の週まで見られる上限（1年分） */
export const MAX_WEEK = 52;
