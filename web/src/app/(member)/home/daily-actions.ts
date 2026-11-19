"use server";

import type { MeishikiResult } from "@yoten/meishiki";
import { getCurrentUser } from "@/lib/auth";
import { generateDailyAdvice, type DailyAdviceResult } from "@/lib/daily/service";
import { currentResult } from "@/lib/readings";
import { createClient } from "@/lib/supabase/server";

/** 今日の干支アドバイスをつくる（管理者のテスト機能）。管理者かどうかは、ここで必ず確かめる */
export async function createDailyAdvice(): Promise<DailyAdviceResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "ログインの有効期限が切れました。もう一度ログインしてください。" };
  if (user.role !== "admin") return { ok: false, message: "この機能は管理者だけが使えます。" };
  if (!user.selfReadingId) return { ok: false, message: "先にプロフィールで生年月日を入力して、あなたの命式をつくってください。" };

  const supabase = await createClient();
  const { data: self } = await supabase
    .from("readings")
    .select("id, result, birth_date, birth_time, hour_unknown, birth_place, gender")
    .eq("id", user.selfReadingId)
    .maybeSingle();
  if (!self) return { ok: false, message: "あなたの命式が見つかりません。" };

  const result: MeishikiResult = await currentResult(self);
  return generateDailyAdvice(result);
}
