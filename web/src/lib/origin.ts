import "server-only";
import { headers } from "next/headers";

/**
 * 今アクセスしているサイトの URL（例：https://app.yoten.org）
 * 確認メールのリンクの戻り先に使う。戻り先は Supabase の Redirect URLs で許可したものだけが通る。
 */
export async function currentOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
