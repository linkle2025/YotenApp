"use server";

import { revalidatePath } from "next/cache";
import type { MeishikiResult } from "@yoten/meishiki";
import { getCurrentUser } from "@/lib/auth";
import { generateInsight, type GenerateResult } from "@/lib/insight/service";
import { createClient } from "@/lib/supabase/server";

/** 判定の要点をつくる（鑑定表のボタンから呼ぶ） */
export async function createInsight(readingId: string): Promise<GenerateResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, reason: "notFound", message: "ログインの有効期限が切れました。もう一度ログインしてください。" };

  // 本人の記録であることを、会員本人のクライアント（RLS）で読めるかどうかで確かめる
  const supabase = await createClient();
  const { data: reading } = await supabase.from("readings").select("id, result").eq("id", readingId).maybeSingle();
  if (!reading) return { ok: false, reason: "notFound", message: "鑑定表が見つかりません。" };

  const result = await generateInsight({ readingId, result: reading.result as MeishikiResult, userId: user.id });
  if (result.ok) revalidatePath(`/readings/${readingId}`);
  return result;
}
