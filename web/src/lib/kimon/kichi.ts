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
