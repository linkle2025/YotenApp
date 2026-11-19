import Link from "next/link";
import { Suspense } from "react";
import { BottomTabs } from "@/components/bottom-tabs";
import { HeaderNav } from "@/components/header-nav";
import { getCurrentUser } from "@/lib/auth";

/** ヘッダー：ロゴは静的に出し、ログイン状態の部分だけ後から流し込む */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 bg-bg/90 backdrop-blur print:static">
      <div className="mx-auto flex h-14 w-full max-w-[1200px] items-center justify-between gap-4 px-4">
        <Link href="/" className="flex items-center gap-2 rounded-[var(--radius-sm)]">
          <span
            aria-hidden
            className="flex size-7 items-center justify-center rounded-[9px] bg-primary font-serif text-base font-bold text-on-primary"
          >
            陽
          </span>
          <span className="font-serif text-[17px] font-bold tracking-wider">陽てん塾</span>
        </Link>
        <Suspense fallback={<span className="h-5 w-24 animate-pulse rounded bg-subtle" aria-hidden />}>
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
      <nav className="flex items-center gap-2 text-sm">
        <Link href="/login" className="rounded-full px-3 py-1.5 font-bold hover:bg-subtle">
          ログイン
        </Link>
        <Link href="/signup" className="rounded-full bg-primary px-4 py-1.5 font-bold text-on-primary hover:bg-primary-hover">
          会員登録
        </Link>
      </nav>
    );
  }
  const name = user.displayName || "会員";
  return (
    <>
      <div className="flex items-center gap-2">
        <HeaderNav />
        {user.role === "admin" && (
          <Link href="/admin/users" className="chip">
            管理
          </Link>
        )}
        <Link
          href="/me"
          aria-label={`${name}さんのマイページ`}
          className="flex size-9 items-center justify-center rounded-full bg-subtle text-sm font-bold hover:bg-border"
        >
          {name.slice(0, 1)}
        </Link>
      </div>
      <BottomTabs />
    </>
  );
}
