import type { Metadata } from "next";
import Link from "next/link";
import { getStars } from "@/lib/master";

export const metadata: Metadata = {
  title: "通変星の解説",
  description: "四柱推命の通変星（比肩・劫財・食神・傷官・偏財・正財・偏官・正官・偏印・印綬）のキャラクター・才能・弱点を解説します。",
};

export default async function TsuhenseiListPage() {
  const stars = await getStars();
  return (
    <main className="mx-auto w-full max-w-[720px] flex-1 px-4 py-8">
      <h1 className="font-serif text-2xl font-bold">通変星の解説</h1>
      <p className="mt-2 text-muted">
        通変星は、日干から見たほかの干との関係を、10の性質で表したものです。命式の表の天干・蔵干の下に表示しています。
      </p>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {stars.map((s) => (
          <li key={s.slug}>
            <Link href={`/tsuhensei/${s.slug}`} className="block rounded-[var(--radius-md)] border border-border bg-surface p-3 hover:bg-bg">
              <span className="font-serif text-xl font-bold">{s.name}</span>
              <span className="ml-2 text-sm text-muted">{s.reading}</span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-8">
        <Link href="/jikkan" className="text-accent underline">
          十干の解説へ
        </Link>
      </p>
    </main>
  );
}
