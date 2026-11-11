import Link from "next/link";
import { Suspense } from "react";
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
  return (
    <nav className="flex items-center gap-4 text-sm">
      <Link href="/home" className="hover:underline">
        ホーム
      </Link>
      <Link href="/me" className="hover:underline">
        マイページ
      </Link>
    </nav>
  );
}
