"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { deletePractice, saveMemo } from "./actions";

export type PracticeRow = {
  id: string;
  placeName: string;
  /** その場所の時計での始まり・終わり（2026-11-20T09:00:00 の形） */
  slotStart: string;
  slotEnd: string;
  hourPillar: string;
  kind: string;
  direction: string;
  mark: string | null;
  score: number | null;
  memo: string;
};

const WEEK = ["日", "月", "火", "水", "木", "金", "土"];

function formatRange(start: string, end: string) {
  const [y, mo, d] = start.slice(0, 10).split("-").map(Number) as [number, number, number];
  const weekday = WEEK[new Date(Date.UTC(y, mo - 1, d)).getUTCDay()];
  const hm = (s: string) => `${Number(s.slice(11, 13))}:${s.slice(14, 16)}`;
  return `${mo}月${d}日（${weekday}）${hm(start)}〜${hm(end)}`;
}

/** 実践履歴の1件：何を実践したかと、後日のメモ（保存・削除） */
export function PracticeItem({ practice: p }: { practice: PracticeRow }) {
  const router = useRouter();
  const memoId = useId();
  const [memo, setMemo] = useState(p.memo);
  const [saved, setSaved] = useState(p.memo);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      setMessage(null);
      const result = await saveMemo(p.id, memo);
      if (result.ok) {
        setSaved(memo.trim());
        setMemo(memo.trim());
        setEditing(false);
        setMessage({ text: "メモを保存しました。", ok: true });
      } else {
        setMessage({ text: result.message, ok: false });
      }
    });

  const remove = () =>
    startTransition(async () => {
      setMessage(null);
      const result = await deletePractice(p.id);
      if (result.ok) router.refresh();
      else setMessage({ text: result.message, ok: false });
    });

  return (
    <article className="card space-y-3 p-4">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className={`flex size-11 shrink-0 items-center justify-center rounded-[13px] text-lg font-bold ${
            p.mark === "◎" ? "bg-primary text-on-primary" : p.mark === "◯" ? "bg-primary-tint text-primary" : "bg-water-tint text-sm text-water"
          }`}
        >
          {p.mark ?? "吉格"}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-bold">
            {p.direction}
            <span className="ml-2 text-sm font-normal text-muted">
              {p.kind === "生門" ? `生門${p.score !== null ? ` ${p.score}点` : ""}` : p.kind}
            </span>
          </p>
          <p className="text-sm text-muted tabular-nums">
            {formatRange(p.slotStart, p.slotEnd)}（{p.hourPillar}の刻）・{p.placeName}
          </p>
        </div>
      </div>

      {editing ? (
        <div className="space-y-2">
          <label htmlFor={memoId} className="block text-sm font-bold">
            あとで起きたこと
          </label>
          <textarea
            id={memoId}
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            rows={4}
            maxLength={1000}
            className="w-full rounded-[14px] bg-bg p-3 text-sm leading-relaxed shadow-[inset_0_0_0_1px_var(--border)]"
            placeholder="例：翌週、思いがけない紹介をもらった"
          />
          <div className="flex gap-2">
            <button type="button" onClick={save} disabled={pending} className="btn btn-primary min-h-11 flex-1">
              {pending ? "保存中…" : "保存する"}
            </button>
            <button
              type="button"
              onClick={() => {
                setMemo(saved);
                setEditing(false);
              }}
              disabled={pending}
              className="btn btn-secondary min-h-11"
            >
              やめる
            </button>
          </div>
        </div>
      ) : (
        <div className="well p-3">
          {saved ? <p className="text-sm leading-relaxed whitespace-pre-wrap">{saved}</p> : <p className="text-sm text-muted">メモはまだありません。</p>}
          <button type="button" onClick={() => setEditing(true)} className="link mt-1 min-h-9 text-sm">
            {saved ? "メモを直す" : "メモを書く"}
          </button>
        </div>
      )}

      {message && (
        <p role={message.ok ? "status" : "alert"} className={`text-sm font-bold ${message.ok ? "text-primary" : "text-danger"}`}>
          {message.text}
        </p>
      )}

      <div className="text-right">
        {confirmDelete ? (
          <span className="inline-flex items-center gap-2 text-sm">
            この履歴を消しますか？
            <button type="button" onClick={remove} disabled={pending} className="btn btn-danger min-h-9 px-4 text-sm">
              消す
            </button>
            <button type="button" onClick={() => setConfirmDelete(false)} disabled={pending} className="btn btn-secondary min-h-9 px-4 text-sm">
              やめる
            </button>
          </span>
        ) : (
          <button type="button" onClick={() => setConfirmDelete(true)} className="min-h-9 text-sm text-muted hover:text-text">
            履歴を消す
          </button>
        )}
      </div>
    </article>
  );
}
