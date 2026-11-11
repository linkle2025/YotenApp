import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthCard } from "@/components/auth-card";

export const metadata: Metadata = { title: "リンクを開けませんでした" };

const REASONS: Record<string, string> = {
  expired: "リンクの有効期限が切れているか、すでに使われています。メールのリンクは1回だけ、届いてから1時間以内に開いてください。",
  "other-browser": "申し込んだときとは別のブラウザ（または端末）でリンクが開かれました。申し込んだのと同じブラウザで開いてください。",
  invalid: "リンクが正しくないか、すでに使われています。",
};

export default function AuthErrorPage({ searchParams }: PageProps<"/auth/error">) {
  return (
    <AuthCard title="リンクを開けませんでした">
      <Suspense fallback={<p className="text-muted">確認しています…</p>}>
        <Reason searchParams={searchParams} />
      </Suspense>
    </AuthCard>
  );
}

async function Reason({ searchParams }: { searchParams: PageProps<"/auth/error">["searchParams"] }) {
  const params = await searchParams;
  const reason = typeof params.reason === "string" ? params.reason : "invalid";
  const isReset = params.flow === "reset";
  return (
    <div className="space-y-4">
      <p>{REASONS[reason] ?? REASONS.invalid}</p>
      {isReset ? (
        <Link
          href="/forgot-password"
          className="flex min-h-12 items-center justify-center rounded-[var(--radius-md)] bg-primary font-bold text-on-primary hover:bg-primary-hover"
        >
          もう一度申し込む
        </Link>
      ) : (
        <>
          <p className="text-sm text-muted">
            会員登録の確認メールの場合は、すでに確認が済んでいることがあります。まずログインをお試しください。
          </p>
          <Link
            href="/login"
            className="flex min-h-12 items-center justify-center rounded-[var(--radius-md)] bg-primary font-bold text-on-primary hover:bg-primary-hover"
          >
            ログインする
          </Link>
        </>
      )}
    </div>
  );
}
