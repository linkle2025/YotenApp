import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StarSections } from "@/components/explain-content";
import { getStars } from "@/lib/master";

/** 全件を generateStaticParams で事前に生成するので、URL の値を待っても遅くならない（Next.js の即時遷移の検査から外す） */
export const instant = false;

export async function generateStaticParams() {
  return (await getStars()).map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: PageProps<"/tsuhensei/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const star = (await getStars()).find((s) => s.slug === slug);
  if (!star) return {};
  return {
    title: `${star.name}（${star.reading}）の特徴`,
    description: `四柱推命の通変星「${star.name}（${star.reading}）」のキャラクター・才能・弱点を解説します。`,
  };
}

export default async function TsuhenseiPage({ params }: PageProps<"/tsuhensei/[slug]">) {
  const { slug } = await params;
  const stars = await getStars();
  const star = stars.find((s) => s.slug === slug);
  if (!star) notFound();
  return (
    <main className="mx-auto w-full max-w-[720px] flex-1 px-4 py-8">
      <Link href="/tsuhensei" className="text-sm text-accent underline-offset-2 hover:underline">
        ← 通変星の一覧
      </Link>
      <h1 className="mt-4 font-serif text-3xl font-bold">
        {star.name}
        <span className="ml-2 text-lg font-normal text-muted">（{star.reading}）</span>
      </h1>
      <div className="mt-6">
        <StarSections star={star} />
      </div>
      <nav aria-label="他の通変星" className="mt-10 border-t border-border pt-4">
        <h2 className="text-sm text-muted">他の通変星</h2>
        <ul className="mt-2 flex flex-wrap gap-2">
          {stars
            .filter((s) => s.slug !== star.slug)
            .map((s) => (
              <li key={s.slug}>
                <Link href={`/tsuhensei/${s.slug}`} className="inline-flex min-h-11 items-center rounded-[var(--radius-sm)] border border-border bg-surface px-3 hover:bg-bg">
                  {s.name}
                </Link>
              </li>
            ))}
        </ul>
      </nav>
    </main>
  );
}
