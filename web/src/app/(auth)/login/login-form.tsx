"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { Field, FormMessage, initialFormState, PasswordField, SubmitButton } from "@/components/form";
import { signIn } from "../actions";

const NOTICES: Record<string, string> = {
  confirmed: "メールアドレスを確認しました。ログインしてください。",
  "account-deleted": "退会の手続きが完了しました。ご利用ありがとうございました。",
};

export function LoginForm() {
  const params = useSearchParams();
  const next = params.get("next") ?? "";
  const notice = NOTICES[params.get("notice") ?? ""];
  const [state, action] = useActionState(signIn, initialFormState);
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-5" noValidate>
      {notice && !state.message && <FormMessage state={{ ok: true, message: notice }} />}
      <FormMessage state={state} />
      <input type="hidden" name="next" value={next} />
      <Field
        label="メールアドレス"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        required
        defaultValue={state.values?.email}
        error={e.email}
      />
      <PasswordField label="パスワード" name="password" autoComplete="current-password" error={e.password} />
      <SubmitButton>ログイン</SubmitButton>
      <div className="flex flex-col items-center gap-2 text-sm">
        <Link href="/forgot-password" className="text-accent underline">
          パスワードを忘れた場合
        </Link>
        <Link href="/signup" className="text-accent underline">
          会員登録はこちら
        </Link>
      </div>
    </form>
  );
}
