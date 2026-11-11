import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCard } from "@/components/auth-card";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "ログイン" };

export default function LoginPage() {
  return (
    <AuthCard title="ログイン">
      {/* 戻り先（?next=）を読むので、フォームは Suspense の内側に置く */}
      <Suspense fallback={<div className="h-80 animate-pulse rounded bg-bg" aria-hidden />}>
        <LoginForm />
      </Suspense>
    </AuthCard>
  );
}
