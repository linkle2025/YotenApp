import Link from "next/link";

/**
 * トップページ（段階1の簡易版：04_骨格 4.3）
 * 段階3で、紹介・読み物・無料診断の入口に作り替える。
 */
export default function Home() {
  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-12">
      <p className="text-sm text-muted">陽てん塾の四柱推命アプリ（α版）</p>
      <h1 className="mt-2 font-serif text-3xl font-bold leading-snug">
        生年月日から、
        <br />
        あなたの強みと活かし方を。
      </h1>
      <p className="mt-4 text-muted">
        命式を正確に出し、9つの能力と7つの職種適性を、点数とその理由でお伝えします。
      </p>
      <div className="mt-8 space-y-3">
        <Link
          href="/signup"
          className="flex min-h-12 items-center justify-center rounded-[var(--radius-md)] bg-primary font-bold text-on-primary hover:bg-primary-hover"
        >
          無料ではじめる
        </Link>
        <p className="text-center text-sm">
          <Link href="/login" className="text-accent underline">
            ログインはこちら
          </Link>
        </p>
      </div>
    </main>
  );
}
