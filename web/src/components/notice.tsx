/** 画面上部の短い知らせ（保存しました など） */
export function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p role="status" className="rounded-[var(--radius-sm)] border border-success bg-surface px-3 py-2 text-sm text-success">
      {children}
    </p>
  );
}
