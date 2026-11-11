import "server-only";
import { CALC_VERSION, calculateMeishiki, type MeishikiResult } from "@yoten/meishiki";
import { createAdminClient } from "@/lib/supabase/admin";

type ReadingRow = {
  id: string;
  birth_date: string;
  birth_time: string | null;
  hour_unknown: boolean;
  birth_place: string;
  gender: string;
  result: unknown;
};

/**
 * 保存されている計算結果を返す。計算ロジックの版（CALC_VERSION）が古ければ、入力から計算し直して保存し直す。
 * 計算の決まりを直したとき（例：2026-11-11 お手本サイトに合わせた変更）に、古い結果が残らないようにする。
 * 呼ぶ側で、記録が会員本人のものであることを確かめてから呼ぶ（会員本人のクライアントで読んだ行を渡す）。
 */
export async function currentResult(row: ReadingRow): Promise<MeishikiResult> {
  const stored = row.result as MeishikiResult;
  if (stored?.calcVersion === CALC_VERSION) return stored;

  const [year, month, day] = row.birth_date.split("-").map(Number);
  const [hour, minute] = row.birth_time ? row.birth_time.split(":").map(Number) : [undefined, undefined];
  const result = calculateMeishiki({
    year,
    month,
    day,
    hour: row.hour_unknown ? undefined : hour,
    minute: row.hour_unknown ? undefined : minute,
    hourUnknown: row.hour_unknown,
    birthPlace: row.birth_place,
    gender: row.gender as "male" | "female",
  });
  const { error } = await createAdminClient()
    .from("readings")
    .update({ result, calc_version: result.calcVersion })
    .eq("id", row.id);
  if (error) console.error(`鑑定記録の再計算を保存できませんでした（${row.id}）: ${error.message}`);
  return result;
}
