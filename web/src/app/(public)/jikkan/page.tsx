import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { STEM_TO_ELEMENT } from "@yoten/meishiki";
import { ELEMENT_INFO } from "@/components/reading/elements";
import { getStems, stemImage } from "@/lib/master";

export const metadata: Metadata = {
  title: "十干の解説",
  description: "四柱推命の十干（甲・乙・丙・丁・戊・己・庚・辛・壬・癸）の特徴・人物像・強み・弱みを解説します。",
};

/** 十干の一覧（04_骨格 4.7）：五行ごとにまとめて並べる */
export default async function JikkanListPage() {
  const stems = await getStems();
  const groups = (["wood", "fire", "earth", "metal", "water"] as const).map((element) => ({
    element,
    stems: stems.filter((s) => STEM_TO_ELEMENT[s.name as keyof typeof STEM_TO_ELEMENT] === element),
  }));
  return (
    <main className="mx-auto w-full max-w-[720px] flex-1 px-4 py-8">
      <h1 className="font-serif text-2xl font-bold">十干の解説</h1>
      <p className="mt-2 text-muted">
        十干は、命式の中心となる「日干」をはじめ、四柱の天干に表れる10の性質です。五行（木・火・土・金・水）がそれぞれ陽と陰に分かれています。
      </p>
      <div className="mt-6 space-y-6">
        {groups.map((g) => (
          <section key={g.element} aria-labelledby={`g-${g.element}`}>
            <h2 id={`g-${g.element}`} className={`font-bold ${ELEMENT_INFO[g.element].text}`}>
              {ELEMENT_INFO[g.element].label}
            </h2>
            <ul className="mt-2 grid gap-3 sm:grid-cols-2">
              {g.stems.map((s) => (
                <li key={s.slug}>
                  <Link
                    href={`/jikkan/${s.slug}`}
                    className="flex items-center gap-3 rounded-[var(--radius-md)] border border-border bg-surface p-3 hover:bg-bg"
                  >
                    <Image src={stemImage(s.slug)} alt="" width={56} height={56} className="size-14" />
                    <span>
                      <span className="font-serif text-xl font-bold">{s.name}</span>
                      <span className="ml-2 text-sm text-muted">{s.reading}</span>
                      <span className="block text-sm">{s.element_type}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <p className="mt-8">
        <Link href="/tsuhensei" className="text-accent underline">
          通変星の解説へ
        </Link>
      </p>
    </main>
  );
}
