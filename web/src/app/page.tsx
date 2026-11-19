import Link from "next/link";
import { ChartColumn, BookOpenText, Sparkles } from "lucide-react";

const FEATURES = [
  { icon: BookOpenText, title: "正確な命式", text: "生まれた場所と季節で時刻を補正し、四柱・蔵干・大運まで出します。" },
  { icon: ChartColumn, title: "強みを点数で", text: "9つの能力と7つの職種への向き不向きを、点数とその理由で示します。" },
  { icon: Sparkles, title: "活かし方まで", text: "日干を起点に、強みの活かし方を短い文章でまとめます。" },
];

/**
 * トップページ（段階1の簡易版：04_骨格 4.3）
 * 段階3で、紹介・読み物・無料診断の入口に作り替える。
 */
export default function Home() {
  return (
    <main className="mx-auto w-full max-w-[960px] flex-1 px-4 py-12 sm:py-20">
      <section className="mx-auto max-w-xl text-center">
        <p className="tag bg-primary-tint text-primary">陽てん塾の四柱推命アプリ（α版）</p>
        <h1 className="mt-5 text-[32px] leading-tight font-bold tracking-tight sm:text-[40px]">
          生年月日から、
          <br />
          あなたの<span className="text-primary">強み</span>と活かし方を。
        </h1>
        <p className="mt-5 text-muted">命式を正確に出し、9つの能力と7つの職種適性を、点数とその理由でお伝えします。</p>
        <div className="mx-auto mt-8 flex max-w-sm flex-col gap-3">
          <Link href="/signup" className="btn btn-primary w-full">
            無料ではじめる
          </Link>
          <Link href="/login" className="btn btn-secondary w-full">
            ログイン
          </Link>
        </div>
      </section>

      <ul className="mt-16 grid gap-4 sm:grid-cols-3">
        {FEATURES.map((f) => (
          <li key={f.title} className="card p-6">
            <span aria-hidden className="flex size-11 items-center justify-center rounded-[14px] bg-primary-tint text-primary">
              <f.icon size={22} />
            </span>
            <h2 className="mt-4 text-lg font-bold">{f.title}</h2>
            <p className="mt-1 text-sm text-muted">{f.text}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
