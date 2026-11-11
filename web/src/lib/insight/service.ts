import "server-only";
import { GoogleGenAI } from "@google/genai";
import {
  buildInsightInput,
  calculateSkillSheet,
  computeInsightHash,
  INSIGHT_PROMPT_VERSION,
  INSIGHT_TEMPERATURE,
  InsightValidationError,
  insightResponseSchema,
  renderInsightSystemPrompt,
  renderInsightUserPrompt,
  validateInsightContent,
  type InsightContent,
  type MeishikiResult,
  type SkillSheet,
} from "@yoten/meishiki";
import { getStems } from "@/lib/master";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { insightConfig, isInsightAvailable, redact } from "./config";

/** 画面に渡す判定の要点 */
export type InsightView = InsightContent & { modelName: string; createdAt: string };

const MAX_ATTEMPTS = 2; // 検証に落ちたら1回だけ作り直す

async function prepare(result: MeishikiResult, sheet: SkillSheet = calculateSkillSheet(result)) {
  const stems = await getStems();
  const dayStemType = stems.find((s) => s.name === result.dayStem)?.element_type ?? "";
  const input = buildInsightInput(result, sheet, dayStemType);
  const { model } = insightConfig();
  return { sheet, input, model, hash: computeInsightHash(input, INSIGHT_PROMPT_VERSION, model) };
}

/**
 * 今のスキル表と同じ入力で作った、保存済みの判定の要点（なければ null）
 * 解釈ルール・プロンプト・モデルが変わってハッシュが合わなくなった古い解説は返さない。
 * 会員本人のクライアント（RLS）で読むので、他人の記録の解説は読めない。
 */
export async function getCurrentInsight(readingId: string, result: MeishikiResult, sheet?: SkillSheet): Promise<InsightView | null> {
  const { hash } = await prepare(result, sheet);
  const supabase = await createClient();
  const { data } = await supabase
    .from("insights")
    .select("content, model_name, created_at")
    .eq("reading_id", readingId)
    .eq("input_hash", hash)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return { ...(data.content as InsightContent), modelName: data.model_name, createdAt: data.created_at };
}

/** 今日（日本時間）この会員が作った件数。キャッシュの命中は数えない */
export async function countTodayGenerations(userId: string): Promise<number> {
  const now = new Date(Date.now() + 9 * 3600 * 1000);
  const startJst = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - 9 * 3600 * 1000;
  const { count } = await createAdminClient()
    .from("insights")
    .select("id", { count: "exact", head: true })
    .eq("created_by", userId)
    .gte("created_at", new Date(startJst).toISOString());
  return count ?? 0;
}

export type GenerateResult =
  | { ok: true; insight: InsightView; cached: boolean }
  | { ok: false; reason: "unavailable" | "limit" | "failed" | "notFound"; message: string };

/**
 * 判定の要点を作る（同じ入力の解説がすでにあれば、それを返す）
 * 呼ぶ前に、記録の持ち主がログイン中の会員であることを確かめること（readingOwnerId）。
 */
export async function generateInsight(params: {
  readingId: string;
  result: MeishikiResult;
  userId: string;
}): Promise<GenerateResult> {
  if (!isInsightAvailable()) return { ok: false, reason: "unavailable", message: "現在、判定の要点はつくれません。" };
  const config = insightConfig();
  const { sheet, input, model, hash } = await prepare(params.result);
  const admin = createAdminClient();

  const { data: cached } = await admin
    .from("insights")
    .select("content, model_name, created_at")
    .eq("reading_id", params.readingId)
    .eq("input_hash", hash)
    .limit(1)
    .maybeSingle();
  if (cached) {
    return { ok: true, cached: true, insight: { ...(cached.content as InsightContent), modelName: cached.model_name, createdAt: cached.created_at } };
  }

  if ((await countTodayGenerations(params.userId)) >= config.dailyLimit) {
    return { ok: false, reason: "limit", message: "今日の生成回数の上限に達しました。明日またお試しください。" };
  }

  const ai = new GoogleGenAI({ apiKey: config.apiKey, httpOptions: { timeout: config.timeoutMs } });
  const usage = { input: 0, output: 0 };
  let content: InsightContent | null = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS && !content; attempt++) {
    let text: string | undefined;
    try {
      const response = await ai.models.generateContent({
        model,
        contents: renderInsightUserPrompt(input),
        config: {
          systemInstruction: renderInsightSystemPrompt(),
          responseMimeType: "application/json",
          // @google/genai の Schema 型と同じ形（型名は大文字）
          responseSchema: insightResponseSchema(sheet) as never,
          temperature: INSIGHT_TEMPERATURE,
        },
      });
      usage.input += response.usageMetadata?.promptTokenCount ?? 0;
      usage.output += response.usageMetadata?.candidatesTokenCount ?? 0;
      text = response.text;
    } catch (error) {
      console.error(`判定の要点: Gemini の呼び出しに失敗しました: ${redact(error instanceof Error ? `${error.name}: ${error.message}` : error)}`);
      return { ok: false, reason: "failed", message: "AI が混み合っているか、応答がありませんでした。時間をおいて、もう一度お試しください。" };
    }
    try {
      content = validateInsightContent(text, sheet);
    } catch (error) {
      if (!(error instanceof InsightValidationError)) throw error;
      console.warn(`判定の要点: 応答の検証に失敗しました（${attempt}/${MAX_ATTEMPTS}回目）: ${error.message}`);
    }
  }
  if (!content) {
    return { ok: false, reason: "failed", message: "うまく文章をつくれませんでした。もう一度お試しください。" };
  }

  const { data: saved, error } = await admin
    .from("insights")
    .insert({
      reading_id: params.readingId,
      input_hash: hash,
      prompt_version: INSIGHT_PROMPT_VERSION,
      model_name: model,
      context: null,
      content,
      input_tokens: usage.input || null,
      output_tokens: usage.output || null,
      created_by: params.userId,
    })
    .select("created_at")
    .single();
  if (error || !saved) {
    return { ok: false, reason: "failed", message: "文章はできましたが、保存できませんでした。もう一度お試しください。" };
  }
  return { ok: true, cached: false, insight: { ...content, modelName: model, createdAt: saved.created_at } };
}
