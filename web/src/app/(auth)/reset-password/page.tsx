import type { Metadata } from "next";
import { AuthCard } from "@/components/auth-card";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = { title: "新しいパスワードの設定" };

export default function ResetPasswordPage() {
  return (
    <AuthCard title="新しいパスワードの設定">
      <ResetPasswordForm />
    </AuthCard>
  );
}
