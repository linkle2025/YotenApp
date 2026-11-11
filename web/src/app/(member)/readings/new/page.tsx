import type { Metadata } from "next";
import { Suspense } from "react";
import { PREFECTURES } from "@yoten/meishiki";
import { requireUser } from "@/lib/auth";
import { maxBirthYear } from "@/lib/birth";
import { NewReadingForm } from "./new-reading-form";

export const metadata: Metadata = { title: "命式をつくる" };

const PREFECTURE_OPTIONS = PREFECTURES.map((p) => ({ code: p.code, name: p.name }));

/** 命式作成（04_骨格 4.4、02_要件 F-03） */
export default function NewReadingPage() {
  return (
    <main className="mx-auto w-full max-w-[560px] flex-1 px-4 py-8">
      <h1 className="font-serif text-2xl font-bold">命式をつくる</h1>
      <p className="mt-2 text-muted">家族・社員・相談者など、あなた以外の人の命式をつくって保存できます。</p>
      <div className="mt-6 rounded-[var(--radius-md)] border border-border bg-surface p-5 shadow-sm">
        <Suspense fallback={<div className="h-[32rem] animate-pulse rounded bg-bg" aria-hidden />}>
          <FormLoader />
        </Suspense>
      </div>
    </main>
  );
}

async function FormLoader() {
  await requireUser("/readings/new");
  return <NewReadingForm prefectures={PREFECTURE_OPTIONS} maxYear={maxBirthYear()} />;
}
