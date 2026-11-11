"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Field, FormMessage, initialFormState, SubmitButton } from "@/components/form";
import { deleteAccount } from "../../actions";

export function DeleteAccountForm() {
  const [state, action] = useActionState(deleteAccount, initialFormState);
  return (
    <form action={action} className="space-y-5" noValidate>
      <FormMessage state={state} />
      <Field
        label="確認のため「退会する」と入力してください"
        name="confirmText"
        autoComplete="off"
        required
        error={state.fieldErrors?.confirmText}
      />
      <SubmitButton variant="danger">退会する</SubmitButton>
      <p className="text-center text-sm">
        <Link href="/me" className="text-accent underline">
          やめて戻る
        </Link>
      </p>
    </form>
  );
}
