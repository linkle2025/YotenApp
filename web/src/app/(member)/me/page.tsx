import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Notice } from "@/components/notice";
import { requireUser } from "@/lib/auth";
import { signOut } from "../../(auth)/actions";

export const metadata: Metadata = { title: "マイページ" };

export default function MyPage({ searchParams }: PageProps<"/me">) {
  return (
    <main className="mx-auto w-full max-w-[560px] flex-1 px-4 py-8">
      <h1 className="font-serif text-2xl font-bold">マイページ</h1>
      <Suspense fallback={<div className="mt-6 h-80 animate-pulse rounded-[var(--radius-md)] bg-surface" aria-hidden />}>
        <MyPageContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function MyPageContent({ searchParams }: { searchParams: PageProps<"/me">["searchParams"] }) {
  const user = await requireUser("/me");
  const { notice } = await searchParams;
  const item = "flex min-h-14 items-center justify-between px-4 hover:bg-bg";
  return (
    <div className="mt-6 space-y-6">
      {notice === "password-updated" && <Notice>パスワードを変更しました。</Notice>}
      <div>
        <p className="font-bold">{user.displayName || "会員"}さん</p>
        <p className="text-sm break-all text-muted">{user.email}</p>
      </div>
      <nav className="divide-y divide-border overflow-hidden rounded-[var(--radius-md)] border border-border bg-surface">
        <Link href="/me/profile" className={item}>
          プロフィール（生年月日など）<span aria-hidden>›</span>
        </Link>
        <Link href="/me/password" className={item}>
          パスワードの変更<span aria-hidden>›</span>
        </Link>
      </nav>
      <nav className="divide-y divide-border overflow-hidden rounded-[var(--radius-md)] border border-border bg-surface">
        <Link href="/jikkan" className={item}>
          十干の解説<span aria-hidden>›</span>
        </Link>
        <Link href="/tsuhensei" className={item}>
          通変星の解説<span aria-hidden>›</span>
        </Link>
      </nav>
      <form action={signOut}>
        <button
          type="submit"
          className="min-h-12 w-full rounded-[var(--radius-md)] border border-border bg-surface font-bold hover:bg-bg"
        >
          ログアウト
        </button>
      </form>
      <p className="text-right text-sm">
        <Link href="/me/delete" className="text-muted underline">
          退会
        </Link>
      </p>
    </div>
  );
}
