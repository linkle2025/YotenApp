import type { Metadata } from "next";
import { AuthCard } from "@/components/auth-card";
import { ChangePasswordForm } from "./change-password-form";

export const metadata: Metadata = { title: "パスワードの変更" };

export default function ChangePasswordPage() {
  return (
    <AuthCard title="パスワードの変更">
      <ChangePasswordForm />
    </AuthCard>
  );
}
