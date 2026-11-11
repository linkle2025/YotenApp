"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { FormState } from "@/components/form";
import { getCurrentUser } from "@/lib/auth";
import { authErrorMessage } from "@/lib/auth-errors";
import { computeMeishiki, parseBirth, toReadingColumns } from "@/lib/birth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { checkDisplayName, checkNewPassword, str } from "@/lib/validation";

const SESSION_EXPIRED: FormState = { message: "ログインの有効期限が切れました。もう一度ログインしてください。" };

/**
 * プロフィールの保存：表示名と、本人の命式（鑑定記録の is_self）
 * 計算結果はサーバーで計算し、管理用クライアントで書く（画面から結果を改ざんできないようにする）
 */
export async function saveProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return SESSION_EXPIRED;

  const displayName = str(formData, "displayName");
  const birth = parseBirth(formData);
  const values = { displayName, ...stringify(birth.values) };

  const fieldErrors: Record<string, string> = birth.ok ? {} : { ...birth.fieldErrors };
  const nameError = checkDisplayName(displayName);
  if (nameError) fieldErrors.displayName = nameError;
  if (!birth.ok || nameError) return { fieldErrors, values };

  const computed = computeMeishiki(birth.input);
  if (!computed.ok) return { fieldErrors: computed.fieldErrors, values };

  const supabase = await createClient();
  const { error: nameUpdateError } = await supabase
    .from("profiles")
    .update({ display_name: displayName })
    .eq("id", user.id);
  if (nameUpdateError) return { message: "保存できませんでした。時間をおいて、もう一度お試しください。", values };

  const admin = createAdminClient();
  const row = {
    ...toReadingColumns(birth.input),
    name: displayName,
    result: computed.result,
    calc_version: computed.result.calcVersion,
  };

  // 本人の記録は1件だけ（readings_one_self_per_owner_idx）。あれば更新、なければ作る
  const { data: existing } = await admin
    .from("readings")
    .select("id")
    .eq("owner_id", user.id)
    .eq("is_self", true)
    .maybeSingle();

  let readingId: string;
  if (existing) {
    const { error } = await admin.from("readings").update(row).eq("id", existing.id).eq("owner_id", user.id);
    if (error) return { message: "保存できませんでした。時間をおいて、もう一度お試しください。", values };
    readingId = existing.id;
  } else {
    const { data, error } = await admin
      .from("readings")
      .insert({ ...row, owner_id: user.id, is_self: true })
      .select("id")
      .single();
    if (error || !data) return { message: "保存できませんでした。時間をおいて、もう一度お試しください。", values };
    readingId = data.id;
  }

  if (user.selfReadingId !== readingId) {
    const { error } = await admin.from("profiles").update({ self_reading_id: readingId }).eq("id", user.id);
    if (error) return { message: "保存できませんでした。時間をおいて、もう一度お試しください。", values };
  }

  redirect(`/readings/${readingId}?notice=profile-saved`);
}

/** パスワードの変更：今のパスワードを確かめてから変える（付録B B.3-2） */
export async function changePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return SESSION_EXPIRED;

  const current = String(formData.get("current") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  const fieldErrors: Record<string, string> = {};
  if (!current) fieldErrors.current = "今のパスワードを入力してください。";
  const passwordError = checkNewPassword(password);
  if (passwordError) fieldErrors.password = passwordError;
  else if (password !== confirm) fieldErrors.confirm = "確認用のパスワードが一致しません。";
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const supabase = await createClient();
  const { error: verifyError } = await supabase.auth.signInWithPassword({ email: user.email, password: current });
  if (verifyError) {
    return verifyError.code === "invalid_credentials"
      ? { fieldErrors: { current: "今のパスワードが違います。" } }
      : { message: authErrorMessage(verifyError) };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { message: authErrorMessage(error) };

  redirect("/me?notice=password-updated");
}

/**
 * 退会：認証ユーザーを削除する。プロフィール・鑑定記録・判定の要点は、外部キーの連鎖でまとめて消える（付録B B.3-4）
 */
export async function deleteAccount(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return SESSION_EXPIRED;

  if (str(formData, "confirmText") !== "退会する") {
    return { fieldErrors: { confirmText: "確認のため「退会する」と入力してください。" } };
  }
  if (user.role === "admin") {
    return { message: "管理者のアカウントは、ここからは退会できません。ほかの管理者に依頼してください。" };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return { message: "退会の手続きができませんでした。時間をおいて、もう一度お試しください。" };

  // ログインの Cookie を消す（ユーザーはもう存在しないので、サーバーへのログアウト要求は失敗してもよい）
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
  const cookieStore = await cookies();
  for (const c of cookieStore.getAll()) if (c.name.startsWith("sb-")) cookieStore.delete(c.name);

  redirect("/login?notice=account-deleted");
}

function stringify(values: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(Object.entries(values).map(([k, v]) => [k, typeof v === "boolean" ? (v ? "on" : "") : String(v ?? "")]));
}
