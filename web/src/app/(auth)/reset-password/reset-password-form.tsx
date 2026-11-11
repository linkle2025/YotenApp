"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FormMessage, initialFormState, PasswordField, SubmitButton } from "@/components/form";
import { updatePassword } from "../actions";

export function ResetPasswordForm() {
  const [state, action] = useActionState(updatePassword, initialFormState);
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-5" noValidate>
      <FormMessage state={state} />
      {state.message && (
        <Link href="/forgot-password" className="inline-block text-sm text-accent underline">
          もう一度申し込む
        </Link>
      )}
      <PasswordField
        label="新しいパスワード"
        name="password"
        autoComplete="new-password"
        hint="8文字以上で、英字と数字の両方を含めてください。"
        error={e.password}
      />
      <PasswordField label="新しいパスワード（確認）" name="confirm" autoComplete="new-password" error={e.confirm} />
      <SubmitButton>パスワードを変更する</SubmitButton>
    </form>
  );
}
