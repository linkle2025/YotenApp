"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Field, FieldFooter, FormMessage, initialFormState, PasswordField, SubmitButton } from "@/components/form";
import { signUp } from "../actions";

export function SignUpForm() {
  const [state, action] = useActionState(signUp, initialFormState);
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-5" noValidate>
      <FormMessage state={state} />
      <Field
        label="表示名"
        name="displayName"
        autoComplete="nickname"
        required
        maxLength={50}
        defaultValue={state.values?.displayName}
        hint="画面のあいさつなどに使います。ニックネームでも構いません。"
        error={e.displayName}
      />
      <Field
        label="メールアドレス"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        required
        defaultValue={state.values?.email}
        hint="ログインに使います。確認のメールが届きます。"
        error={e.email}
      />
      <PasswordField
        label="パスワード"
        name="password"
        autoComplete="new-password"
        hint="8文字以上で、英字と数字の両方を含めてください。"
        error={e.password}
      />
      <div>
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            name="agree"
            className="mt-1.5 size-5 accent-[var(--primary)]"
            aria-invalid={e.agree ? true : undefined}
            aria-describedby={e.agree ? "agree-error" : undefined}
          />
          <span>
            利用規約とプライバシーポリシーに同意します
            <span className="block text-sm text-muted">（α版のため、規約は準備中です）</span>
          </span>
        </label>
        <FieldFooter id="agree" error={e.agree} />
      </div>
      <SubmitButton>登録する</SubmitButton>
      <p className="text-center text-sm">
        すでに会員の方は{" "}
        <Link href="/login" className="text-accent underline">
          ログイン
        </Link>
      </p>
    </form>
  );
}
