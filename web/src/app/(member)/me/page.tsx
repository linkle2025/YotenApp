import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Suspense } from "react";
import { Notice } from "@/components/notice";
import { requireUser } from "@/lib/auth";
import { signOut } from "../../(auth)/actions";

export const metadata: Metadata = { title: "マイページ" };

export default function MyPage({ searchParams }: PageProps<"/me">) {
  return (
    <main className="mx-auto w-full max-w-[560px] flex-1 px-4 py-8">
      <h1 className="text-[26px] font-bold tracking-tight">マイページ</h1>
      <Suspense fallback={<div className="mt-6 h-80 animate-pulse rounded-[var(--radius-md)] bg-surface" aria-hidden />}>
        <MyPageContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function MyPageContent({ searchParams }: { searchParams: PageProps<"/me">["searchParams"] }) {
  const user = await requireUser("/me");
  const { notice } = await searchParams;
  const item = "flex min-h-14 items-center justify-between px-5 font-medium hover:bg-bg";
  return (
    <div className="mt-6 space-y-6">
      {notice === "password-updated" && <Notice>パスワードを変更しました。</Notice>}
      <div className="flex items-center gap-3">
        <span aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-full bg-subtle text-lg font-bold">
          {(user.displayName || "会").slice(0, 1)}
        </span>
        <div className="min-w-0">
          <p className="font-bold">{user.displayName || "会員"}さん</p>
          <p className="text-sm break-all text-muted">{user.email}</p>
        </div>
      </div>
      <nav className="card divide-y divide-subtle overflow-hidden">
        <Link href="/me/profile" className={item}>
          プロフィール（生年月日など）<ChevronRight size={18} aria-hidden className="text-muted" />
        </Link>
        <Link href="/me/password" className={item}>
          パスワードの変更<ChevronRight size={18} aria-hidden className="text-muted" />
        </Link>
      </nav>
      <nav className="card divide-y divide-subtle overflow-hidden">
        <Link href="/jikkan" className={item}>
          十干の解説<ChevronRight size={18} aria-hidden className="text-muted" />
        </Link>
        <Link href="/tsuhensei" className={item}>
          通変星の解説<ChevronRight size={18} aria-hidden className="text-muted" />
        </Link>
      </nav>
      <form action={signOut}>
        <button
          type="submit"
          className="btn btn-secondary w-full"
        >
          ログアウト
        </button>
      </form>
      <p className="text-right text-sm">
        <Link href="/me/delete" className="text-muted hover:text-text">
          退会
        </Link>
      </p>
    </div>
  );
}
