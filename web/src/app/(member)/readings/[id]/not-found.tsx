import Link from "next/link";

export default function ReadingNotFound() {
  return (
    <main className="mx-auto w-full max-w-[560px] flex-1 px-4 py-10">
      <h1 className="text-[26px] font-bold tracking-tight">鑑定表が見つかりません</h1>
      <p className="mt-2 text-muted">削除されたか、URL が正しくない可能性があります。</p>
      <Link href="/home" className="mt-6 link inline-block">
        ホームへ戻る
      </Link>
    </main>
  );
}
