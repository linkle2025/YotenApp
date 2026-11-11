"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Field, FormMessage, initialFormState, SubmitButton } from "@/components/form";
import { requestPasswordReset } from "../actions";

export function ForgotPasswordForm() {
  const [state, action] = useActionState(requestPasswordReset, initialFormState);
  if (state.ok) {
    return (
      <div className="space-y-4">
        <FormMessage state={state} />
        <p className="text-sm text-muted">リンクは、申し込んだのと同じブラウザで開いてください。</p>
        <Link href="/login" className="inline-block text-accent underline">
          ログイン画面へ戻る
        </Link>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-5" noValidate>
      <FormMessage state={state} />
      <Field
        label="メールアドレス"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        required
        defaultValue={state.values?.email}
        error={state.fieldErrors?.email}
      />
      <SubmitButton>再設定のメールを送る</SubmitButton>
      <p className="text-center text-sm">
        <Link href="/login" className="text-accent underline">
          ログイン画面へ戻る
        </Link>
      </p>
    </form>
  );
}
