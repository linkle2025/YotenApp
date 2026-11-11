"use client";

import Image from "next/image";
import Link from "next/link";
import { createContext, use, useEffect, useRef, useState, type ReactNode } from "react";
import { StarSections, StemSections } from "@/components/explain-content";
import type { StarInfo, StemInfo } from "@/lib/master";

type Target = { kind: "stem" | "star"; name: string };

const ExplainContext = createContext<((target: Target) => void) | null>(null);

/**
 * 鑑定表の中で十干・通変星の解説を開くパネル（F-08-3、04_骨格 4.7）
 * - ページを離れずに読める。「ページで開く」のリンクも付ける
 * - <dialog> を使い、Esc で閉じる・開いている間は後ろを操作できない・閉じたら押したボタンに戻る
 * - スマートフォンは下から、パソコンは右から出る
 */
export function ExplainProvider({ stems, stars, children }: { stems: StemInfo[]; stars: StarInfo[]; children: ReactNode }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [target, setTarget] = useState<Target | null>(null);

  useEffect(() => {
    if (target) dialogRef.current?.showModal();
  }, [target]);

  const stem = target?.kind === "stem" ? stems.find((s) => s.name === target.name) : undefined;
  const star = target?.kind === "star" ? stars.find((s) => s.name === target.name) : undefined;

  return (
    <ExplainContext value={setTarget}>
      {children}
      <dialog
        ref={dialogRef}
        onClose={() => setTarget(null)}
        onClick={(e) => {
          if (e.target === dialogRef.current) dialogRef.current.close();
        }}
        aria-labelledby="explain-title"
        className="m-0 mt-auto max-h-[85vh] w-full max-w-none overflow-y-auto rounded-t-[var(--radius-lg)] bg-surface p-0 text-text shadow-xl backdrop:bg-black/40 sm:mt-0 sm:ml-auto sm:h-full sm:max-h-none sm:w-[440px] sm:rounded-none"
      >
        {(stem || star) && (
          <div className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                {stem && <Image src={`/img/stems/${stem.slug}.png`} alt="" width={64} height={64} className="size-16" />}
                <h2 id="explain-title" className="font-serif text-2xl font-bold">
                  {(stem ?? star)!.name}
                  <span className="ml-2 text-base font-normal text-muted">（{(stem ?? star)!.reading}）</span>
                  {stem && <span className="block text-sm font-normal">{stem.element_type}</span>}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => dialogRef.current?.close()}
                className="min-h-10 rounded-[var(--radius-sm)] border border-border px-3 text-sm"
                autoFocus
              >
                閉じる
              </button>
            </div>
            <div className="mt-5">{stem ? <StemSections stem={stem} /> : <StarSections star={star!} />}</div>
            <Link
              href={stem ? `/jikkan/${stem.slug}` : `/tsuhensei/${star!.slug}`}
              className="mt-6 inline-block text-sm text-accent underline"
            >
              ページで開く
            </Link>
          </div>
        )}
      </dialog>
    </ExplainContext>
  );
}

/** 押すと解説を開く文字（天干・通変星） */
export function ExplainTrigger({ kind, name, children, className = "" }: Target & { children: ReactNode; className?: string }) {
  const open = use(ExplainContext);
  if (!open) return <>{children}</>;
  return (
    <button
      type="button"
      onClick={() => open({ kind, name })}
      aria-haspopup="dialog"
      aria-label={`${name}の解説を開く`}
      className={`rounded-[var(--radius-sm)] underline decoration-dotted decoration-1 underline-offset-4 hover:bg-bg focus-visible:outline-2 focus-visible:outline-primary ${className}`}
    >
      {children}
    </button>
  );
}
