import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/redirect";
import { createClient } from "@/lib/supabase/server";

/**
 * 確認メール・パスワード再設定メールのリンクの受け口
 * - token_hash と type が付いてくる形（メールの文面を token_hash 方式にした場合。別の端末で開いても使える）
 * - code が付いてくる形（Supabase の標準の文面。申し込んだのと同じブラウザで開く必要がある）
 * の両方に対応する。
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNext(searchParams.get("next"));
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const isReset = next.startsWith("/reset-password") || type === "recovery";

  const supabase = await createClient();

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, origin));
    return NextResponse.redirect(errorUrl(origin, error.code === "otp_expired" ? "expired" : "invalid", isReset));
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
    // 会員登録の確認は、リンクを開いた時点で済んでいる。別のブラウザで開いた場合はログインしてもらう
    if (!isReset) return NextResponse.redirect(new URL("/login?notice=confirmed", origin));
    return NextResponse.redirect(errorUrl(origin, "other-browser", isReset));
  }

  const reason = searchParams.get("error_code") === "otp_expired" ? "expired" : "invalid";
  return NextResponse.redirect(errorUrl(origin, reason, isReset));
}

function errorUrl(origin: string, reason: string, isReset: boolean) {
  const url = new URL("/auth/error", origin);
  url.searchParams.set("reason", reason);
  if (isReset) url.searchParams.set("flow", "reset");
  return url;
}
