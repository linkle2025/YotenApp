"use client";

import { useRef, useState } from "react";
import type { KimonPalace, KimonResult } from "@yoten/meishiki";
import { KIMON_BAGUA_BY_POSITION } from "@/lib/kimon/bagua";
import { KIMON_USAGE_GUIDES, KIMON_USAGE_TAGS } from "@/lib/kimon/usage-guide";

/** 盤面の並び（上が南）：4|9|2 / 3|5|7 / 8|1|6 */
const GRID_ORDER = [4, 9, 2, 3, 5, 7, 8, 1, 6] as const;

/** 八門の色（旧版と同じ考え方：門の五行の色） */
const HACHIMON_COLOR: Record<string, string> = {
  休: "text-water",
  生: "text-earth",
  死: "text-earth",
  傷: "text-wood",
  杜: "text-wood",
  景: "text-fire",
  驚: "text-metal",
  開: "text-metal",
};

/** 八神の表示（陳・雀は別名付き：旧版のまま） */
const HASSHIN_LABEL: Record<string, string> = { 陳: "陳（白虎）", 雀: "雀（玄武）" };

/**
 * 奇門遁甲の盤面（旧版 KimonBoardDisplay を引き継ぐ）
 * - 天盤干のうち、日干・時干と同じ字は赤い下線で強調。旬首は括弧で囲む
 * - 中宮以外のマスを押すと、その宮の八卦の象意を盤の下に表示する
 */
export function KimonBoard({ board, compact = false, showGuides = true }: { board: KimonResult; compact?: boolean; showGuides?: boolean }) {
  const [active, setActive] = useState<number | null>(null);
  const [guideId, setGuideId] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const highlight = new Set([board.pillars.day.stem, board.pillars.hour?.stem].filter(Boolean) as string[]);
  const byPosition = new Map(board.palaces.map((p) => [p.position as number, p]));
  const bagua = active ? KIMON_BAGUA_BY_POSITION[active] : null;

  return (
    <div className="space-y-3">
      <div className={`grid grid-cols-3 border-l border-t border-text ${compact ? "text-xs" : "text-sm"}`}>
        {GRID_ORDER.map((pos) => {
          const palace = byPosition.get(pos)!;
          const isCenter = pos === 5;
          const cell = <PalaceCell palace={palace} highlight={highlight} compact={compact} />;
          const base = `relative border-b border-r border-text ${compact ? "min-h-20 p-1" : "min-h-32 p-2"}`;
          if (isCenter || compact) return <div key={pos} className={`${base} ${isCenter ? "bg-bg" : "bg-surface"}`}>{cell}</div>;
          return (
            <button
              key={pos}
              type="button"
              onClick={() => setActive((a) => (a === pos ? null : pos))}
              aria-pressed={active === pos}
              aria-label={`${palace.name}（${palace.direction}）の象意を表示`}
              className={`${base} text-left ${active === pos ? "bg-primary/10" : "bg-surface hover:bg-bg"}`}
            >
              {cell}
            </button>
          );
        })}
      </div>

      {!compact && (
        <div aria-live="polite">
          {bagua ? (
            <div className="rounded-[var(--radius-md)] border border-border bg-surface p-3 text-sm">
              <p className="font-bold">{bagua.title}</p>
              <p className="mt-1">
                正象：{bagua.zhengxiang}　人物：{bagua.person}
              </p>
              <p className="mt-1">象意：{bagua.xiangyi}</p>
            </div>
          ) : (
            <p className="text-xs text-muted">マスを押すと、その方位の八卦の象意を表示します。</p>
          )}
        </div>
      )}

      {showGuides && !compact && (
        <>
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted">作盤の用途：</span>
            {KIMON_USAGE_TAGS.map((tag) => (
              <button
                key={tag.id}
                type="button"
                aria-haspopup="dialog"
                onClick={() => {
                  setGuideId(tag.id);
                  requestAnimationFrame(() => dialogRef.current?.showModal());
                }}
                className="rounded-full border border-border bg-surface px-3 py-1 hover:bg-bg"
              >
                {tag.label}
              </button>
            ))}
          </p>
          <aside aria-label="八門・格局の参考" className="space-y-1 rounded-[var(--radius-md)] bg-bg p-3 text-xs">
            <p>
              <span className="rounded bg-water-tint px-1 font-bold text-water">青</span>：吉格（風遁＝巽宮に天盤の乙と三吉門、玉女守門＝天盤の丁が直使と同宮）
              <span className="rounded bg-danger/10 px-1 text-danger">赤</span>：凶格
            </p>
            <p>休：愛情、休息、安定　生：財、積極性　開：仕事、オープン</p>
            <p>傷：怪我、ギャンブル　杜：隠れる、閉じる　景：祝事、文書、華やか　死：停止　驚：トラブル、想定外</p>
            <p>風遁：放送・広報・宣伝活動に効果があることを実証済み</p>
            <p>玉女守門：人間関係、男女の和合、試験にも効果ありを確認。</p>
            <p>勾陳＝白虎：出血、車、交通事故</p>
            <p>朱雀＝玄武：腹黒い、嘘、騙す、口喧嘩、お金に関する悪いこと</p>
          </aside>
          <dialog
            ref={dialogRef}
            onClose={() => setGuideId(null)}
            onClick={(e) => {
              if (e.target === dialogRef.current) dialogRef.current.close();
            }}
            aria-labelledby="guide-title"
            className="m-auto max-h-[85vh] w-[min(640px,calc(100%-2rem))] overflow-y-auto rounded-[var(--radius-md)] bg-surface p-5 text-text shadow-xl backdrop:bg-black/40"
          >
            {guideId && (
              <>
                <div className="flex items-start justify-between gap-3">
                  <h2 id="guide-title" className="text-lg font-bold">
                    {KIMON_USAGE_GUIDES[guideId].title}
                  </h2>
                  <button type="button" onClick={() => dialogRef.current?.close()} className="rounded-[var(--radius-sm)] border border-border px-3 py-1 text-sm" autoFocus>
                    閉じる
                  </button>
                </div>
                <p className="mt-3 text-sm whitespace-pre-wrap">{KIMON_USAGE_GUIDES[guideId].body}</p>
              </>
            )}
          </dialog>
        </>
      )}
    </div>
  );
}

function PalaceCell({
  palace,
  highlight,
  compact,
}: {
  palace: KimonPalace;
  highlight: Set<string>;
  compact: boolean;
}) {
  const big = compact ? "text-base" : "text-xl";
  return (
    <span className="flex h-full flex-col justify-between gap-1">
      <span className="flex items-start justify-between gap-1">
        <span className={`font-serif font-bold ${big}`}>
          {palace.tenbanKan.map((stem, i) => {
            const text = i === 0 && palace.isJunshuTenban ? `(${stem})` : stem;
            return (
              <span key={i} className={highlight.has(stem) ? "text-danger underline underline-offset-4" : ""}>
                {text}
              </span>
            );
          })}
          {palace.chugan && <span className="ml-1 text-xs font-normal text-muted">{palace.chugan}</span>}
        </span>
        {/* 天禽（中宮の星）は中宮が坤に寄るため、芮に添えて「芮禽」と書く（お手本サイトと同じ） */}
        <span className="text-muted">{palace.kyusei === "芮" ? "芮禽" : (palace.kyusei ?? "")}</span>
      </span>
      <span className={`text-center font-serif font-bold ${compact ? "text-lg" : "text-3xl"} ${HACHIMON_COLOR[palace.hachimon ?? ""] ?? ""}`}>
        {palace.hachimon ?? ""}
      </span>
      <span className="flex items-end justify-between gap-1">
        <span className={`font-serif ${big}`}>{palace.isJunshuJiban ? `(${palace.jibanKan})` : palace.jibanKan}</span>
        <span className="text-muted">{palace.hasshin ? (HASSHIN_LABEL[palace.hasshin] ?? palace.hasshin) : ""}</span>
      </span>
      {(palace.kyokaku.length > 0 || palace.kichikaku.length > 0 || palace.score !== null) && (
        <span className="flex flex-wrap items-center gap-1 text-xs">
          {palace.kichikaku.map((k) => (
            <span key={k} className="rounded bg-water-tint px-1 font-bold text-water" title="吉格">
              {k}
            </span>
          ))}
          {palace.kyokaku.map((k) => (
            <span key={k} className="rounded bg-danger/10 px-1 text-danger" title="凶格">
              {k}
            </span>
          ))}
          {palace.score !== null && <span className="ml-auto font-bold tabular-nums">{palace.score}点</span>}
        </span>
      )}
    </span>
  );
}
