"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { deleteReadingInPlace, setFavorite } from "./actions";

export type ReadingListItem = {
  id: string;
  name: string | null;
  isSelf: boolean;
  isFavorite: boolean;
  birthDate: string;
  /** 時間不明なら null（時刻を出さない） */
  birthTime: string | null;
  birthPlace: string;
  createdAt: string;
  dayStem: string;
};

const UNDO_MS = 5000;

/**
 * 記録のカード一覧（04_骨格 4.6）
 * - カード全体で鑑定表へ。☆でお気に入りの切り替え
 * - 削除はその場で消し、5秒間「元に戻す」を出す。時間が過ぎたら本当に消す
 */
export function ReadingList({ items }: { items: ReadingListItem[] }) {
  const [favorites, setFavorites] = useState(() => new Map(items.map((i) => [i.id, i.isFavorite])));
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<ReadingListItem | null>(null);
  const [error, setError] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<ReadingListItem | null>(null);

  // 「元に戻す」の待ち時間中に画面を離れたら、その時点で削除を確定する
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      if (pendingRef.current) void deleteReadingInPlace(pendingRef.current.id);
    },
    [],
  );

  const commit = async (item: ReadingListItem) => {
    pendingRef.current = null;
    setPending(null);
    const { ok } = await deleteReadingInPlace(item.id);
    if (!ok) {
      setHidden((h) => {
        const next = new Set(h);
        next.delete(item.id);
        return next;
      });
      setError(`「${title(item)}」を削除できませんでした。もう一度お試しください。`);
    }
  };

  const remove = (item: ReadingListItem) => {
    setError("");
    if (timer.current) clearTimeout(timer.current);
    if (pendingRef.current) void commit(pendingRef.current);
    setHidden((h) => new Set(h).add(item.id));
    pendingRef.current = item;
    setPending(item);
    timer.current = setTimeout(() => void commit(item), UNDO_MS);
  };

  const undo = () => {
    if (timer.current) clearTimeout(timer.current);
    const item = pendingRef.current;
    pendingRef.current = null;
    setPending(null);
    if (item)
      setHidden((h) => {
        const next = new Set(h);
        next.delete(item.id);
        return next;
      });
  };

  const toggleFavorite = async (item: ReadingListItem) => {
    const next = !favorites.get(item.id);
    setFavorites((m) => new Map(m).set(item.id, next));
    const { ok } = await setFavorite(item.id, next);
    if (!ok) {
      setFavorites((m) => new Map(m).set(item.id, !next));
      setError("お気に入りを変えられませんでした。もう一度お試しください。");
    }
  };

  return (
    <>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <ul className="space-y-2">
        {items
          .filter((i) => !hidden.has(i.id))
          .map((item) => {
            const fav = favorites.get(item.id);
            return (
              <li key={item.id} className="relative flex items-center gap-3 rounded-[var(--radius-md)] border border-border bg-surface p-3 hover:bg-bg">
                <span
                  aria-hidden
                  className="flex size-12 shrink-0 items-center justify-center rounded-full bg-bg font-serif text-2xl font-bold"
                >
                  {item.dayStem}
                </span>
                <div className="min-w-0 flex-1">
                  <Link href={`/readings/${item.id}`} className="font-bold after:absolute after:inset-0">
                    {title(item)}
                    {item.isSelf && (
                      <span className="ml-2 rounded-full bg-primary px-2 py-0.5 align-middle text-xs font-normal text-on-primary">あなた</span>
                    )}
                  </Link>
                  <p className="truncate text-sm text-muted">
                    日干 {item.dayStem}・{formatDate(item.birthDate)} {item.birthTime ?? "時刻不明"} {item.birthPlace}
                  </p>
                  <p className="text-xs text-muted">作成 {formatCreated(item.createdAt)}</p>
                </div>
                <div className="relative z-10 flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => toggleFavorite(item)}
                    aria-pressed={fav}
                    aria-label={fav ? `${title(item)}をお気に入りから外す` : `${title(item)}をお気に入りに追加`}
                    className={`size-11 rounded-[var(--radius-sm)] text-xl hover:bg-surface ${fav ? "text-primary" : "text-muted"}`}
                  >
                    {fav ? "★" : "☆"}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(item)}
                    aria-label={`${title(item)}を削除`}
                    className="size-11 rounded-[var(--radius-sm)] text-sm text-danger hover:bg-surface"
                  >
                    削除
                  </button>
                </div>
              </li>
            );
          })}
      </ul>

      {pending && (
        <div
          role="status"
          className="fixed inset-x-4 bottom-20 z-30 mx-auto flex max-w-[560px] items-center justify-between gap-4 rounded-[var(--radius-md)] bg-text px-4 py-3 text-sm text-surface shadow-lg sm:bottom-6"
        >
          <span>「{title(pending)}」を削除しました</span>
          <button type="button" onClick={undo} className="font-bold underline">
            元に戻す
          </button>
        </div>
      )}
    </>
  );
}

const title = (i: ReadingListItem) => (i.name ? `${i.name}さん` : "無題の鑑定");

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${y}/${m}/${d}`;
}

function formatCreated(iso: string) {
  const d = new Date(iso);
  const jst = new Date(d.getTime() + 9 * 3600 * 1000);
  return `${jst.getUTCFullYear()}/${jst.getUTCMonth() + 1}/${jst.getUTCDate()}`;
}
