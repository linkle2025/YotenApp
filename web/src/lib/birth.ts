import "server-only";
import { calculateMeishiki, isValidDate, PREFECTURES, MeishikiInputError, type MeishikiInput } from "@yoten/meishiki";
import type { BirthValues } from "@/components/birth-fields";
import { str } from "@/lib/validation";

export type ParsedBirth =
  | { ok: true; input: MeishikiInput; values: BirthValues }
  | { ok: false; fieldErrors: Record<string, string>; values: BirthValues };

/**
 * 選べる最後の年：来年まで（生まれる予定の子どもも見られるように）
 * 計算ロジック自体は2040年まで対応しているが、それより先の年は選択肢に出さない。日本時間で数える。
 */
export function maxBirthYear(now = new Date()): number {
  const japanYear = new Date(now.getTime() + 9 * 60 * 60 * 1000).getUTCFullYear();
  return Math.min(japanYear + 1, 2040);
}

const int = (s: string) => (/^\d+$/.test(s) ? Number(s) : NaN);

/** フォームの生年月日などを読み、計算ロジックの入力にする。誤りは項目ごとに返す */
export function parseBirth(formData: FormData): ParsedBirth {
  const values: BirthValues = {
    year: str(formData, "year"),
    month: str(formData, "month"),
    day: str(formData, "day"),
    hour: str(formData, "hour"),
    minute: str(formData, "minute"),
    hourUnknown: formData.get("hourUnknown") === "on",
    birthPlace: str(formData, "birthPlace"),
    gender: str(formData, "gender"),
  };
  const fieldErrors: Record<string, string> = {};

  const year = int(values.year!);
  const month = int(values.month!);
  const day = int(values.day!);
  if (!values.year || !values.month || !values.day) {
    fieldErrors.date = "生年月日を選んでください。";
  } else if (!isValidDate({ year, month, day })) {
    fieldErrors.date = "存在しない日付です。";
  } else {
    const key = year * 10000 + month * 100 + day;
    const maxYear = maxBirthYear();
    if (key < 19010106 || key > maxYear * 10000 + 1231) {
      fieldErrors.date = `1901年1月6日〜${maxYear}年12月31日の間で選んでください。`;
    }
  }

  let hour: number | undefined;
  let minute: number | undefined;
  if (!values.hourUnknown) {
    hour = int(values.hour!);
    minute = values.minute ? int(values.minute) : 0;
    if (!values.hour) fieldErrors.time = "時刻を選ぶか、「時間がわからない」にチェックを入れてください。";
    else if (!(hour >= 0 && hour <= 23) || !(minute >= 0 && minute <= 59)) fieldErrors.time = "時刻が正しくありません。";
  }

  if (!PREFECTURES.some((p) => p.code === values.birthPlace)) fieldErrors.birthPlace = "出生地を選んでください。";
  if (values.gender !== "male" && values.gender !== "female") fieldErrors.gender = "性別を選んでください。";

  if (Object.keys(fieldErrors).length) return { ok: false, fieldErrors, values };

  return {
    ok: true,
    values,
    input: {
      year,
      month,
      day,
      hour,
      minute,
      hourUnknown: values.hourUnknown,
      birthPlace: values.birthPlace!,
      gender: values.gender as "male" | "female",
    },
  };
}

/** 計算する。入力の誤り（範囲外など）は項目の誤りとして返す */
export function computeMeishiki(input: MeishikiInput) {
  try {
    return { ok: true as const, result: calculateMeishiki(input) };
  } catch (error) {
    if (error instanceof MeishikiInputError) {
      return { ok: false as const, fieldErrors: { [error.field]: error.message } };
    }
    throw error;
  }
}

/** DB に保存する形（readings の列） */
export function toReadingColumns(input: MeishikiInput) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    birth_date: `${input.year}-${pad(input.month)}-${pad(input.day)}`,
    birth_time: input.hourUnknown ? null : `${pad(input.hour ?? 0)}:${pad(input.minute ?? 0)}`,
    hour_unknown: Boolean(input.hourUnknown),
    birth_place: input.birthPlace,
    gender: input.gender,
  };
}

/** DB の列から、フォームの初期値に戻す */
export function fromReadingColumns(row: {
  birth_date: string;
  birth_time: string | null;
  hour_unknown: boolean;
  birth_place: string;
  gender: string;
}): BirthValues {
  const [y, m, d] = row.birth_date.split("-");
  const [h, min] = row.birth_time ? row.birth_time.split(":") : ["", ""];
  return {
    year: String(Number(y)),
    month: String(Number(m)),
    day: String(Number(d)),
    hour: h ? String(Number(h)) : "",
    minute: min ? String(Number(min)) : "",
    hourUnknown: row.hour_unknown,
    birthPlace: row.birth_place,
    gender: row.gender,
  };
}

/** 今の日本時間（年月日・時を UTC の値として持つ Date）。画面の既定値に使う */
export function japanNow(): Date {
  return new Date(Date.now() + 9 * 60 * 60 * 1000);
}
