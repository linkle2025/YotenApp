import type { StarInfo, StemInfo } from "@/lib/master";

/** 解説の本文（ページとパネルで共通） */
export function StemSections({ stem }: { stem: StemInfo }) {
  return (
    <Sections
      items={[
        { title: "特徴", body: stem.description },
        { title: "人物像", body: stem.personality },
        { title: "強み・活かし方", body: stem.strengths },
        { title: "弱み・接し方の注意点", body: stem.weaknesses },
      ]}
    />
  );
}

export function StarSections({ star }: { star: StarInfo }) {
  return (
    <Sections
      items={[
        { title: "キャラクター", body: star.character },
        { title: "才能", body: star.talents },
        { title: "弱点", body: star.weaknesses },
      ]}
    />
  );
}

function Sections({ items }: { items: { title: string; body: string }[] }) {
  return (
    <div className="space-y-5">
      {items
        .filter((i) => i.body.trim())
        .map((i) => (
          <section key={i.title}>
            <h2 className="border-l-4 border-primary pl-2 font-bold">{i.title}</h2>
            <p className="mt-2 whitespace-pre-line">{i.body}</p>
          </section>
        ))}
    </div>
  );
}
