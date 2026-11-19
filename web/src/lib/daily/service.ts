import "server-only";
import { GoogleGenAI } from "@google/genai";
import {
  buildDailyInput,
  calculateMeishiki,
  DAILY_SYSTEM_PROMPT,
  DAILY_TEMPERATURE,
  DailyValidationError,
  dailyResponseSchema,
  renderDailyUserPrompt,
  validateDailyContent,
  type DailyContent,
  type MeishikiResult,
  type TodayPillars,
} from "@yoten/meishiki";
import { insightConfig, isInsightAvailable, redact } from "@/lib/insight/config";

const MAX_ATTEMPTS = 2;

/** 今日（日本時間）の年・月・日の干支。正午の時刻で数える（日付の境目や時刻補正の影響を受けないように） */
export function todayPillars(now = new Date()): { date: { year: number; month: number; day: number }; pillars: TodayPillars } {
  const jst = new Date(now.getTime() + 9 * 3600 * 1000);
  const date = { year: jst.getUTCFullYear(), month: jst.getUTCMonth() + 1, day: jst.getUTCDate() };
  const r = calculateMeishiki({ ...date, hour: 12, minute: 0, birthPlace: "13", gender: "male" });
  const pick = (p: { stem: string; branch: string }) => ({ stem: p.stem, branch: p.branch }) as TodayPillars["year"];
  return { date, pillars: { year: pick(r.pillars.year), month: pick(r.pillars.month), day: pick(r.pillars.day) } };
}

export type DailyAdviceView = {
  content: DailyContent;
  today: { label: string; year: string; month: string; day: string };
  relations: { today: string; natal: string; kind: string; detail: string }[];
  modelName: string;
};

export type DailyAdviceResult = { ok: true; advice: DailyAdviceView } | { ok: false; message: string };

/** 今日の干支が命式にどう影響するかを、AI に読ませる（テスト機能。保存はしない）。呼ぶ前に管理者であることを確かめること。 */
export async function generateDailyAdvice(natal: MeishikiResult): Promise<DailyAdviceResult> {
  if (!isInsightAvailable()) return { ok: false, message: "AI の設定（GEMINI_API_KEY など）が有効になっていないため、つくれません。" };
  const config = insightConfig();
  const { date, pillars } = todayPillars();
  const input = buildDailyInput(natal, pillars);

  const ai = new GoogleGenAI({ apiKey: config.apiKey, httpOptions: { timeout: config.timeoutMs } });
  let content: DailyContent | null = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS && !content; attempt++) {
    let text: string | undefined;
    try {
      const response = await ai.models.generateContent({
        model: config.model,
        contents: renderDailyUserPrompt(input),
        config: {
          systemInstruction: DAILY_SYSTEM_PROMPT,
          responseMimeType: "application/json",
          responseSchema: dailyResponseSchema() as never,
          temperature: DAILY_TEMPERATURE,
        },
      });
      text = response.text;
    } catch (error) {
      console.error(`今日の干支アドバイス: Gemini の呼び出しに失敗しました: ${redact(error instanceof Error ? `${error.name}: ${error.message}` : error)}`);
      return { ok: false, message: "AI が混み合っているか、応答がありませんでした。時間をおいて、もう一度お試しください。" };
    }
    try {
      content = validateDailyContent(text);
    } catch (error) {
      if (!(error instanceof DailyValidationError)) throw error;
      console.warn(`今日の干支アドバイス: 応答の検証に失敗しました（${attempt}/${MAX_ATTEMPTS}回目）: ${error.message}`);
    }
  }
  if (!content) return { ok: false, message: "うまく文章をつくれませんでした。もう一度お試しください。" };

  const gz = (p: { stem: string; branch: string }) => `${p.stem}${p.branch}`;
  return {
    ok: true,
    advice: {
      content,
      today: { label: `${date.month}月${date.day}日`, year: gz(pillars.year), month: gz(pillars.month), day: gz(pillars.day) },
      relations: input.relations.map((r) => ({
        today: r.today === "year" ? "年" : r.today === "month" ? "月" : "日",
        natal: r.natal,
        kind: r.kind,
        detail: r.detail,
      })),
      modelName: config.model,
    },
  };
}
