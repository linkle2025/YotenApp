"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { deleteMember, updateMember } from "./actions";

export type Member = {
  id: string;
  email: string;
  displayName: string;
  role: "general" | "fortuneteller" | "admin";
  status: "active" | "suspended";
  createdAt: string;
  lastSignInAt: string | null;
  readingCount: number;
  insightCount: number;
};

const ROLE_LABELS: Record<Member["role"], string> = { general: "一般", fortuneteller: "占者", admin: "管理者" };
const STATUS_LABELS: Record<Member["status"], string> = { active: "利用中", suspended: "停止中" };
type SortKey = "createdAt" | "lastSignInAt" | "readingCount" | "displayName";

/**
 * 会員の一覧（F-11）：検索・絞り込み・並べ替え。編集は右から出るパネルで行う（誤操作を防ぐ）。
 * スマートフォンでは表をカードの一覧に切り替える。
 */
export function MemberTable({ members, meId }: { members: Member[]; meId: string }) {
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({ key: "createdAt", asc: false });
  const [editing, setEditing] = useState<Member | null>(null);
  const [notice, setNotice] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = members.filter(
      (m) =>
        (!needle || m.displayName.toLowerCase().includes(needle) || m.email.toLowerCase().includes(needle)) &&
        (!role || m.role === role) &&
        (!status || m.status === status),
    );
    const value = (m: Member) => (sort.key === "readingCount" ? m.readingCount : (m[sort.key] ?? ""));
    return filtered.sort((a, b) => {
      const va = value(a);
      const vb = value(b);
      const c = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "ja");
      return sort.asc ? c : -c;
    });
  }, [members, q, role, status, sort]);

  const open = (m: Member) => {
    setEditing(m);
    setNotice("");
    requestAnimationFrame(() => dialogRef.current?.showModal());
  };

  const sortButton = (key: SortKey, label: string) => (
    <button
      type="button"
      onClick={() => setSort((s) => ({ key, asc: s.key === key ? !s.asc : false }))}
      className="font-normal hover:underline"
      aria-label={`${label}で並べ替え`}
    >
      {label}
      {sort.key === key && <span aria-hidden>{sort.asc ? " ▲" : " ▼"}</span>}
    </button>
  );

  const select = "min-h-10 rounded-[var(--radius-sm)] border border-border bg-surface px-2";

  return (
    <div className="space-y-3">
      {notice && (
        <p role="status" className="rounded-[var(--radius-sm)] border border-success bg-surface px-3 py-2 text-sm text-success">
          {notice}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <label className="sr-only" htmlFor="member-q">
          名前・メールで検索
        </label>
        <input
          id="member-q"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="名前・メールで検索"
          className="min-h-10 min-w-56 flex-1 rounded-[var(--radius-sm)] border border-border bg-surface px-3"
        />
        <label className="flex items-center gap-1 text-sm">
          ロール
          <select value={role} onChange={(e) => setRole(e.target.value)} className={select}>
            <option value="">すべて</option>
            {Object.entries(ROLE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1 text-sm">
          状態
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={select}>
            <option value="">すべて</option>
            {Object.entries(STATUS_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="text-sm text-muted">{rows.length}人</p>

      {/* パソコン：表 */}
      <div className="hidden overflow-x-auto rounded-[var(--radius-md)] border border-border bg-surface md:block">
        <table className="w-full text-sm">
          <thead className="bg-bg text-left text-xs text-muted">
            <tr>
              <th className="px-3 py-2">{sortButton("displayName", "表示名")}</th>
              <th className="px-3 py-2 font-normal">メール</th>
              <th className="px-3 py-2 font-normal">ロール</th>
              <th className="px-3 py-2 font-normal">状態</th>
              <th className="px-3 py-2">{sortButton("createdAt", "登録日")}</th>
              <th className="px-3 py-2">{sortButton("lastSignInAt", "最終ログイン")}</th>
              <th className="px-3 py-2 text-right">{sortButton("readingCount", "記録")}</th>
              <th className="px-3 py-2">
                <span className="sr-only">操作</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id} className="border-t border-border">
                <td className="px-3 py-2">
                  {m.displayName || <span className="text-muted">（未設定）</span>}
                  {m.id === meId && <span className="ml-1 text-xs text-muted">（あなた）</span>}
                </td>
                <td className="px-3 py-2 break-all">{m.email}</td>
                <td className="px-3 py-2">{ROLE_LABELS[m.role]}</td>
                <td className={`px-3 py-2 ${m.status === "suspended" ? "font-bold text-danger" : ""}`}>{STATUS_LABELS[m.status]}</td>
                <td className="px-3 py-2 whitespace-nowrap">{formatDate(m.createdAt)}</td>
                <td className="px-3 py-2 whitespace-nowrap">{m.lastSignInAt ? formatDateTime(m.lastSignInAt) : "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums">{m.readingCount}</td>
                <td className="px-3 py-2 text-right">
                  <button type="button" onClick={() => open(m)} className="rounded-[var(--radius-sm)] border border-border px-3 py-1 hover:bg-bg">
                    編集
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* スマートフォン：カード */}
      <ul className="space-y-2 md:hidden">
        {rows.map((m) => (
          <li key={m.id} className="rounded-[var(--radius-md)] border border-border bg-surface p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-bold">
                  {m.displayName || "（未設定）"}
                  {m.id === meId && <span className="ml-1 text-xs font-normal text-muted">（あなた）</span>}
                </p>
                <p className="text-sm break-all text-muted">{m.email}</p>
              </div>
              <button type="button" onClick={() => open(m)} className="shrink-0 rounded-[var(--radius-sm)] border border-border px-3 py-1 text-sm">
                編集
              </button>
            </div>
            <p className="mt-1 text-xs text-muted">
              {ROLE_LABELS[m.role]}・<span className={m.status === "suspended" ? "font-bold text-danger" : ""}>{STATUS_LABELS[m.status]}</span>
              ・記録 {m.readingCount}件・登録 {formatDate(m.createdAt)}・最終ログイン {m.lastSignInAt ? formatDateTime(m.lastSignInAt) : "—"}
            </p>
          </li>
        ))}
      </ul>

      <dialog
        ref={dialogRef}
        onClose={() => setEditing(null)}
        aria-labelledby="member-edit-title"
        className="m-0 mt-auto w-full max-w-none rounded-t-[var(--radius-lg)] bg-surface p-0 text-text shadow-xl backdrop:bg-black/40 sm:mt-0 sm:ml-auto sm:h-full sm:max-h-none sm:w-[420px] sm:rounded-none"
      >
        {editing && (
          <EditPanel
            key={editing.id}
            member={editing}
            isMe={editing.id === meId}
            onClose={() => dialogRef.current?.close()}
            onDone={(message) => {
              setNotice(message);
              dialogRef.current?.close();
            }}
          />
        )}
      </dialog>
    </div>
  );
}

function EditPanel({
  member,
  isMe,
  onClose,
  onDone,
}: {
  member: Member;
  isMe: boolean;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [role, setRole] = useState(member.role);
  const [status, setStatus] = useState(member.status);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const name = member.displayName || member.email;

  const save = () =>
    startTransition(async () => {
      setError("");
      const result = await updateMember(member.id, role, status);
      if (result.ok) onDone(`${name} さんの設定を変更しました。`);
      else setError(result.message);
    });

  const remove = () =>
    startTransition(async () => {
      setError("");
      const result = await deleteMember(member.id);
      if (result.ok) onDone(`${name} さんを削除しました。`);
      else setError(result.message);
    });

  return (
    <div className="space-y-5 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="member-edit-title" className="text-lg font-bold">
            {member.displayName || "（表示名なし）"}
          </h2>
          <p className="text-sm break-all text-muted">{member.email}</p>
        </div>
        <button type="button" onClick={onClose} className="min-h-10 rounded-[var(--radius-sm)] border border-border px-3 text-sm" autoFocus>
          閉じる
        </button>
      </div>

      {isMe && <p className="rounded-[var(--radius-sm)] bg-bg p-3 text-sm">自分自身の役割・利用状態は変えられず、削除もできません。</p>}
      {error && (
        <p role="alert" className="text-sm font-bold text-danger">
          {error}
        </p>
      )}

      <fieldset disabled={isMe || pending} className="space-y-4 disabled:opacity-60">
        <label className="block">
          <span className="text-sm font-bold">ロール</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Member["role"])}
            className="mt-1 block min-h-11 w-full rounded-[var(--radius-sm)] border border-border bg-surface px-2"
          >
            {Object.entries(ROLE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <div>
          <span className="text-sm font-bold">利用状態</span>
          <div className="mt-1 flex gap-4">
            {Object.entries(STATUS_LABELS).map(([v, l]) => (
              <label key={v} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="status"
                  value={v}
                  checked={status === v}
                  onChange={() => setStatus(v as Member["status"])}
                  className="size-5 accent-[var(--primary)]"
                />
                {l}
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-muted">停止中にすると、その会員はログインできなくなります（データは残ります）。</p>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={role === member.role && status === member.status}
          className="min-h-11 w-full rounded-[var(--radius-md)] bg-primary font-bold text-on-primary hover:bg-primary-hover disabled:opacity-50"
        >
          {pending ? "保存しています…" : "変更を保存"}
        </button>
      </fieldset>

      {!isMe && (
        <div className="border-t border-border pt-4">
          {!confirmDelete ? (
            <button type="button" onClick={() => setConfirmDelete(true)} className="text-sm text-danger underline">
              この会員を削除する
            </button>
          ) : (
            <div role="alertdialog" aria-labelledby="del-title" className="rounded-[var(--radius-md)] border border-danger p-3">
              <p id="del-title" className="font-bold">
                {name} さんを削除しますか？
              </p>
              <p className="mt-1 text-sm">
                プロフィール、鑑定記録 {member.readingCount}件、判定の要点 {member.insightCount}件、ログイン情報がすべて消え、元に戻せません。
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={remove}
                  disabled={pending}
                  className="min-h-10 rounded-[var(--radius-sm)] bg-danger px-4 text-sm font-bold text-on-primary disabled:opacity-60"
                >
                  {pending ? "削除しています…" : "削除する"}
                </button>
                <button type="button" onClick={() => setConfirmDelete(false)} className="min-h-10 rounded-[var(--radius-sm)] border border-border px-4 text-sm">
                  やめる
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function toJst(iso: string) {
  return new Date(new Date(iso).getTime() + 9 * 3600 * 1000);
}
function formatDate(iso: string) {
  const d = toJst(iso);
  return `${d.getUTCFullYear()}/${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}
function formatDateTime(iso: string) {
  const d = toJst(iso);
  return `${formatDate(iso)} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}
