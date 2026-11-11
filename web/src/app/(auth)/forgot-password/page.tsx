import type { Metadata } from "next";
import { AuthCard } from "@/components/auth-card";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = { title: "パスワードの再設定" };

export default function ForgotPasswordPage() {
  return (
    <AuthCard title="パスワードの再設定" lead="登録したメールアドレスに、再設定のリンクを送ります。">
      <ForgotPasswordForm />
    </AuthCard>
  );
}
