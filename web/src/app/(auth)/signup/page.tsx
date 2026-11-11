import type { Metadata } from "next";
import { AuthCard } from "@/components/auth-card";
import { SignUpForm } from "./signup-form";

export const metadata: Metadata = { title: "会員登録" };

export default function SignUpPage() {
  return (
    <AuthCard title="会員登録" lead="登録は3項目だけです。生年月日などは、登録のあとで入力できます。">
      <SignUpForm />
    </AuthCard>
  );
}
