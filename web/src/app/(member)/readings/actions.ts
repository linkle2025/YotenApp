"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/components/form";
import { getCurrentUser } from "@/lib/auth";
import { computeMeishiki, parseBirth, toReadingColumns } from "@/lib/birth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * 命式の作成（F-03）：サーバーで計算し、管理用クライアントで保存してから鑑定表へ移る
 * 計算結果は画面から書き込めない（RLS・列単位の権限）。持ち主は必ずログイン中の会員にする。
 */
export async function createReading(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { message: "ログインの有効期限が切れました。もう一度ログインしてください。" };

  const name = String(formData.get("name") ?? "").trim();
  const birth = parseBirth(formData);
  const values: Record<string, string> = {
    name,
    ...Object.fromEntries(
      Object.entries(birth.values).map(([k, v]) => [k, typeof v === "boolean" ? (v ? "on" : "") : String(v ?? "")]),
    ),
  };

  const fieldErrors: Record<string, string> = birth.ok ? {} : { ...birth.fieldErrors };
  if ([...name].length > 100) fieldErrors.name = "100文字以内にしてください。";
  if (!birth.ok || fieldErrors.name) return { fieldErrors, values };

  const computed = computeMeishiki(birth.input);
  if (!computed.ok) return { fieldErrors: computed.fieldErrors, values };

  const { data, error } = await createAdminClient()
    .from("readings")
    .insert({
      ...toReadingColumns(birth.input),
      owner_id: user.id,
      is_self: false,
      name: name || null,
      result: computed.result,
      calc_version: computed.result.calcVersion,
    })
    .select("id")
    .single();
  if (error || !data) return { message: "保存できませんでした。時間をおいて、もう一度お試しください。", values };

  redirect(`/readings/${data.id}`);
}

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

/** 一覧からの削除（画面はそのまま。「元に戻す」の時間が過ぎてから呼ぶ） */
export async function deleteReadingInPlace(readingId: string): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false };
  const supabase = await createClient();
  const { error, count } = await supabase.from("readings").delete({ count: "exact" }).eq("id", readingId);
  if (error || count === 0) return { ok: false };
  revalidatePath("/readings");
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
