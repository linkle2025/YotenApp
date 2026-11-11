"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * お気に入りの切り替え
 * 会員本人のクライアント（RLS）で書く。is_favorite は会員が変えてよい列（列単位の権限）。
 */
export async function setFavorite(readingId: string, favorite: boolean): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false };
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("readings")
    .update({ is_favorite: favorite }, { count: "exact" })
    .eq("id", readingId);
  if (error || count === 0) return { ok: false };
  revalidatePath(`/readings/${readingId}`);
  return { ok: true };
}

/** 鑑定記録の削除。本人の命式を消した場合は、プロフィールの紐づけも外れる（外部キーの on delete set null） */
export async function deleteReading(readingId: string): Promise<{ ok: false; message: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "ログインの有効期限が切れました。もう一度ログインしてください。" };
  const supabase = await createClient();
  const { error, count } = await supabase.from("readings").delete({ count: "exact" }).eq("id", readingId);
  if (error || count === 0) return { ok: false, message: "削除できませんでした。時間をおいて、もう一度お試しください。" };
  redirect("/home?notice=reading-deleted");
}
