import "server-only";

/**
 * 判定の要点（Gemini）の設定。値は環境変数から読む（web/.env.example）。
 * 個人に結びつく命式を送るため、有料枠のキーであることを運用者が確認した（GEMINI_PAID_TIER_CONFIRMED=true）ときだけ動かす。
 */
export function insightConfig() {
  const flag = (v: string | undefined, fallback: boolean) => (v === undefined || v === "" ? fallback : /^(true|1|yes)$/i.test(v));
  const int = (v: string | undefined, fallback: number) => (v && /^\d+$/.test(v) ? Number(v) : fallback);
  return {
    apiKey: process.env.GEMINI_API_KEY ?? "",
    model: process.env.GEMINI_MODEL || "gemini-3.6-flash",
    paidTierConfirmed: flag(process.env.GEMINI_PAID_TIER_CONFIRMED, false),
    enabled: flag(process.env.SKILL_INSIGHT_ENABLED, true),
    dailyLimit: int(process.env.SKILL_INSIGHT_DAILY_LIMIT, 20),
    timeoutMs: int(process.env.GEMINI_TIMEOUT_SECONDS, 40) * 1000,
  };
}

let warned = false;

/** 機能が使えるか：有料枠の確認・機能オン・キー設定済みの3つがそろったときだけ */
export function isInsightAvailable(): boolean {
  const c = insightConfig();
  if (!c.paidTierConfirmed) {
    if (!warned) {
      console.warn("判定の要点: GEMINI_PAID_TIER_CONFIRMED が true ではないため、機能を無効にしています。");
      warned = true;
    }
    return false;
  }
  return c.enabled && Boolean(c.apiKey);
}

/** ログに出す文字列から API キーを伏せる */
export function redact(text: unknown): string {
  const key = process.env.GEMINI_API_KEY;
  let s = String(text);
  if (key) s = s.split(key).join("[REDACTED]");
  return s.replace(/AIza[0-9A-Za-z_-]{20,}/g, "[REDACTED]");
}
