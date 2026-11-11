"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FormMessage, initialFormState, PasswordField, SubmitButton } from "@/components/form";
import { changePassword } from "../../actions";

export function ChangePasswordForm() {
  const [state, action] = useActionState(changePassword, initialFormState);
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-5" noValidate>
      <FormMessage state={state} />
      <PasswordField label="今のパスワード" name="current" autoComplete="current-password" error={e.current} />
      <PasswordField
        label="新しいパスワード"
        name="password"
        autoComplete="new-password"
        hint="8文字以上で、英字と数字の両方を含めてください。"
        error={e.password}
      />
      <PasswordField label="新しいパスワード（確認）" name="confirm" autoComplete="new-password" error={e.confirm} />
      <SubmitButton>変更する</SubmitButton>
      <p className="text-center text-sm">
        <Link href="/forgot-password" className="text-accent underline">
          今のパスワードを忘れた場合
        </Link>
      </p>
    </form>
  );
}
