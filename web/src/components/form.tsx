"use client";

import { useId, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

/** フォームの結果（Server Action が返す） */
export type FormState = {
  /** 画面上部に出す、フォーム全体の知らせ */
  message?: string;
  /** 項目ごとの誤り */
  fieldErrors?: Record<string, string>;
  /** 送信した値（誤りがあったときに入力を残す。パスワードは入れない） */
  values?: Record<string, string>;
  ok?: boolean;
};

export const initialFormState: FormState = {};

/** 送信ボタン：送信中は押せなくし、くるくる回る印を出す（04_骨格 4.2） */
export function SubmitButton({
  children,
  variant = "primary",
  pendingLabel = "送信中…",
}: {
  children: ReactNode;
  variant?: "primary" | "danger";
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();
  const color =
    variant === "danger"
      ? "bg-danger text-on-primary hover:opacity-90"
      : "bg-primary text-on-primary hover:bg-primary-hover";
  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] px-4 font-bold transition disabled:cursor-wait disabled:opacity-70 ${color}`}
    >
      {pending && (
        <span
          aria-hidden
          className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {pending ? pendingLabel : children}
    </button>
  );
}

type FieldProps = {
  label: string;
  name: string;
  hint?: ReactNode;
  error?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "name">;

/** 入力欄：ラベルは常に上、補足と誤りは下（04_骨格 4.2） */
export function Field({ label, name, hint, error, className, ...rest }: FieldProps) {
  const id = useId();
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ");
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-bold">
        {label}
      </label>
      <input
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={inputClass(Boolean(error))}
        {...rest}
      />
      <FieldFooter id={id} hint={hint} error={error} />
    </div>
  );
}

/** パスワード欄（表示の切り替え付き） */
export function PasswordField({ label, name, hint, error, autoComplete }: Omit<FieldProps, "type">) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ");
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-bold">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          className={`${inputClass(Boolean(error))} pr-20`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          aria-controls={id}
          className="absolute inset-y-0 right-0 mt-1 px-3 text-sm text-accent underline-offset-2 hover:underline"
        >
          {visible ? "隠す" : "表示"}
        </button>
      </div>
      <FieldFooter id={id} hint={hint} error={error} />
    </div>
  );
}

export function FieldFooter({ id, hint, error }: { id: string; hint?: ReactNode; error?: string }) {
  return (
    <>
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-sm text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm font-bold text-danger">
          {error}
        </p>
      )}
    </>
  );
}

export function inputClass(invalid: boolean) {
  return `mt-1 block min-h-12 w-full rounded-[var(--radius-sm)] border bg-surface px-3 text-base outline-none focus:ring-2 focus:ring-primary ${
    invalid ? "border-danger" : "border-border"
  }`;
}

/** フォーム全体の知らせ（誤りは赤、成功は緑）。読み上げにも伝わるようにする */
export function FormMessage({ state }: { state: FormState }) {
  if (!state.message) return null;
  return (
    <p
      role={state.ok ? "status" : "alert"}
      className={`rounded-[var(--radius-sm)] border px-3 py-2 text-sm ${
        state.ok ? "border-success text-success" : "border-danger text-danger"
      }`}
    >
      {state.message}
    </p>
  );
}
