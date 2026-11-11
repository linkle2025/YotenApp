"use server";

import { redirect } from "next/navigation";
import type { FormState } from "@/components/form";
import { authErrorMessage } from "@/lib/auth-errors";
import { currentOrigin } from "@/lib/origin";
import { safeNext } from "@/lib/redirect";
import { createClient } from "@/lib/supabase/server";
import { checkDisplayName, checkEmail, checkNewPassword, str } from "@/lib/validation";

/** 会員登録：表示名・メールアドレス・パスワードの3項目（04_骨格 4.8） */
export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const displayName = str(formData, "displayName");
  const email = str(formData, "email");
  const password = String(formData.get("password") ?? "");
  const agreed = formData.get("agree") === "on";
  const values = { displayName, email };

  const fieldErrors: Record<string, string> = {};
  const nameError = checkDisplayName(displayName);
  const emailError = checkEmail(email);
  const passwordError = checkNewPassword(password);
  if (nameError) fieldErrors.displayName = nameError;
  if (emailError) fieldErrors.email = emailError;
  if (passwordError) fieldErrors.password = passwordError;
  if (!agreed) fieldErrors.agree = "利用規約とプライバシーポリシーへの同意が必要です。";
  if (Object.keys(fieldErrors).length) return { fieldErrors, values };

  const supabase = await createClient();
  const origin = await currentOrigin();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName },
      emailRedirectTo: `${origin}/auth/confirm?next=${encodeURIComponent("/me/profile?welcome=1")}`,
    },
  });
  if (error) return { message: authErrorMessage(error), values };

  // すでに登録済みのメールアドレスでも、他人に登録の有無を知られないよう同じ画面を出す（Supabase の仕様）
  redirect(`/signup/sent?email=${encodeURIComponent(email)}`);
}

/** ログイン：戻り先があればそこへ、なければホームへ */
export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = str(formData, "email");
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"));
  const values = { email };

  if (!email || !password) {
    return {
      fieldErrors: {
        ...(email ? {} : { email: "メールアドレスを入力してください。" }),
        ...(password ? {} : { password: "パスワードを入力してください。" }),
      },
      values,
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { message: authErrorMessage(error), values };

  const { data: profile } = await supabase.from("profiles").select("status").eq("id", data.user.id).maybeSingle();
  if (profile?.status !== "active") {
    await supabase.auth.signOut();
    return { message: "このアカウントは現在ご利用いただけません。陽てん塾にお問い合わせください。", values };
  }

  redirect(next);
}

/** ログアウト */
export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

/** パスワード再設定の申し込み：登録の有無にかかわらず同じ表示にする */
export async function requestPasswordReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = str(formData, "email");
  const emailError = checkEmail(email);
  if (emailError) return { fieldErrors: { email: emailError }, values: { email } };

  const supabase = await createClient();
  const origin = await currentOrigin();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/confirm?next=${encodeURIComponent("/reset-password")}`,
  });
  if (error && (error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit")) {
    return { message: authErrorMessage(error), values: { email } };
  }

  return {
    ok: true,
    message: `${email} あてに、パスワード再設定のメールを送りました（登録がある場合）。メールのリンクを開いてください。届かないときは、迷惑メールのフォルダもご確認ください。`,
  };
}

/** 新しいパスワードの設定（再設定メールのリンクからログインした状態で使う） */
export async function updatePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const passwordError = checkNewPassword(password);
  if (passwordError) return { fieldErrors: { password: passwordError } };
  if (password !== confirm) return { fieldErrors: { confirm: "確認用のパスワードが一致しません。" } };

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) {
    return { message: "リンクの有効期限が切れたか、別のブラウザで開かれました。もう一度申し込んでください。" };
  }
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { message: authErrorMessage(error) };

  redirect("/home?notice=password-updated");
}
