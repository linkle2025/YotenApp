import Link from "next/link";
import { Suspense } from "react";
import { BottomTabs } from "@/components/bottom-tabs";
import { getCurrentUser } from "@/lib/auth";

/** ヘッダー：ロゴは静的に出し、ログイン状態の部分だけ後から流し込む */
export function SiteHeader() {
  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex h-14 w-full max-w-[1200px] items-center justify-between px-4">
        <Link href="/" className="font-serif text-lg font-bold">
          陽てん塾
        </Link>
        <Suspense fallback={<span className="h-5 w-24 animate-pulse rounded bg-border" aria-hidden />}>
          <UserNav />
        </Suspense>
      </div>
    </header>
  );
}

async function UserNav() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <nav className="flex items-center gap-4 text-sm">
        <Link href="/login" className="hover:underline">
          ログイン
        </Link>
        <Link
          href="/signup"
          className="rounded-[var(--radius-sm)] bg-primary px-3 py-1.5 font-bold text-on-primary hover:bg-primary-hover"
        >
          会員登録
        </Link>
      </nav>
    );
  }
  const link = "hidden hover:underline md:inline";
  return (
    <>
      <nav className="flex items-center gap-4 text-sm">
        <Link href="/home" className={link}>
          ホーム
        </Link>
        <Link href="/readings/new" className={link}>
          つくる
        </Link>
        <Link href="/readings" className={link}>
          記録
        </Link>
        <Link href="/me" className={link}>
          マイページ
        </Link>
        {user.role === "admin" && (
          <Link href="/admin/users" className="rounded-[var(--radius-sm)] border border-border px-2 py-1 hover:bg-bg">
            管理
          </Link>
        )}
        <span className="text-muted md:hidden">{user.displayName || "会員"}さん</span>
      </nav>
      <BottomTabs />
    </>
  );
}
