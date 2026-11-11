/**
 * ログイン後などの戻り先を、このサイト内のパスだけに限る（外部サイトへ飛ばされる「オープンリダイレクト」を防ぐ）
 */
export function safeNext(next: unknown, fallback = "/home"): string {
  if (typeof next !== "string") return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
