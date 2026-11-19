import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { STEM_TO_ELEMENT, YANG_STEMS } from "@yoten/meishiki";
import { StemSections } from "@/components/explain-content";
import { ELEMENT_INFO } from "@/components/reading/elements";
import { getStems, stemImage } from "@/lib/master";

/** 全件を generateStaticParams で事前に生成するので、URL の値を待っても遅くならない（Next.js の即時遷移の検査から外す） */
export const instant = false;

export async function generateStaticParams() {
  return (await getStems()).map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: PageProps<"/jikkan/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const stem = (await getStems()).find((s) => s.slug === slug);
  if (!stem) return {};
  return {
    title: `${stem.name}（${stem.reading}）の特徴`,
    description: `四柱推命の十干「${stem.name}（${stem.reading}）・${stem.element_type}」の特徴・人物像・強み・弱みを解説します。`,
  };
}

/** 十干の個別ページ（04_骨格 4.7） */
export default async function JikkanPage({ params }: PageProps<"/jikkan/[slug]">) {
  const { slug } = await params;
  const stems = await getStems();
  const stem = stems.find((s) => s.slug === slug);
  if (!stem) notFound();
  const element = STEM_TO_ELEMENT[stem.name as keyof typeof STEM_TO_ELEMENT];
  const yinYang = YANG_STEMS.has(stem.name as never) ? "陽" : "陰";

  return (
    <main className="mx-auto w-full max-w-[720px] flex-1 px-4 py-8">
      <Link href="/jikkan" className="link text-sm">
        ← 十干の一覧
      </Link>
      <div className="mt-4 flex items-center gap-4">
        <span aria-hidden className={`flex size-24 shrink-0 items-center justify-center rounded-[24px] ${ELEMENT_INFO[element].tint}`}><Image src={stemImage(stem.slug)} alt="" width={96} height={96} className="size-18" priority /></span>
        <div>
          <h1 className="font-serif text-3xl font-bold">
            {stem.name}
            <span className="ml-2 text-lg font-normal text-muted">（{stem.reading}）</span>
          </h1>
          <p className={ELEMENT_INFO[element].text}>
            {ELEMENT_INFO[element].label}の{yinYang}・{stem.element_type}
          </p>
        </div>
      </div>
      <div className="card mt-6 p-5 sm:p-6">
        <StemSections stem={stem} />
      </div>
      <nav aria-label="他の十干" className="mt-10">
        <h2 className="text-sm text-muted">他の十干</h2>
        <ul className="mt-2 flex flex-wrap gap-2">
          {stems
            .filter((s) => s.slug !== stem.slug)
            .map((s) => (
              <li key={s.slug}>
                <Link href={`/jikkan/${s.slug}`} className="inline-flex size-11 items-center justify-center rounded-[12px] bg-surface shadow-[inset_0_0_0_1px_var(--border)] font-serif text-lg hover:bg-bg">
                  {s.name}
                </Link>
              </li>
            ))}
        </ul>
      </nav>
    </main>
  );
}
