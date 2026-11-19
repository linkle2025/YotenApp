"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type PracticeActionResult = { ok: true } | { ok: false; message: string };

const MEMO_MAX = 1000;
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 実践履歴のメモを保存する。会員本人のクライアント（RLS・列の権限）で書くので、他人の履歴や他の列は変えられない */
export async function saveMemo(id: string, memo: string): Promise<PracticeActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "ログインの有効期限が切れました。もう一度ログインしてください。" };
  if (!ID.test(id)) return { ok: false, message: "履歴が見つかりません。" };
  const text = memo.trim();
  if ([...text].length > MEMO_MAX) return { ok: false, message: `メモは${MEMO_MAX}文字以内にしてください。` };

  const supabase = await createClient();
  const { data, error } = await supabase.from("kimon_practices").update({ memo: text }).eq("id", id).select("id");
  if (error || !data?.length) return { ok: false, message: "メモを保存できませんでした。時間をおいて、もう一度お試しください。" };
  revalidatePath("/me/practices");
  return { ok: true };
}

/** 実践履歴を消す（間違えて押したとき） */
export async function deletePractice(id: string): Promise<PracticeActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "ログインの有効期限が切れました。もう一度ログインしてください。" };
  if (!ID.test(id)) return { ok: false, message: "履歴が見つかりません。" };
  const supabase = await createClient();
  const { error } = await supabase.from("kimon_practices").delete().eq("id", id);
  if (error) return { ok: false, message: "削除できませんでした。時間をおいて、もう一度お試しください。" };
  revalidatePath("/me/practices");
  revalidatePath("/kimon");
  return { ok: true };
}
