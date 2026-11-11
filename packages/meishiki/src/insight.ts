/**
 * 判定の要点（AI 解説）の中心部分：AI に渡す入力の組み立て・ハッシュ・プロンプト・応答の検証
 *
 * 点数とランクは AI に決めさせない。鑑定スキル表の計算結果を正とし、AI には根拠の説明文だけを書かせる。
 * 氏名・生年月日・出生時刻・出生地は入力に含めない（干支・点数・解釈ルールだけ）。
 * 現行: backend/apps/fortune/insight_service.py、説明書: doc/判定の要点生成.md
 * AI の呼び出し（Gemini）と保存は、画面側（web/）が行う。
 */
import { createHash } from 'node:crypto';
import type { Stem } from './constants';
import type { MeishikiResult, Pillar } from './meishiki';
import { INSIGHT_PROMPTS } from './prompts.generated';
import { dayStemInfo, elementRelations, loadDefaultRules, type RuleSet } from './skillRules';
import type { SkillSheet } from './skillSheet';

export const INSIGHT_PROMPT_VERSION = 'v2';
/** 1項目の文字数の上限 */
export const INSIGHT_MAX_TEXT_LENGTH = 400;
/** 生成の温度（現行と同じ） */
export const INSIGHT_TEMPERATURE = 0.4;

/** 本人コンテキスト（将来対応。α版では入力 UI がなく、常に null） */
export interface InsightContext {
  age?: number;
  occupation?: string;
  position?: string;
  industry?: string;
  note?: string;
}

/** AI に渡す入力（現行の build_insight_input と同じ形・同じ順） */
export interface InsightInput {
  rules_version: string;
  day_stem: ReturnType<typeof dayStemInfo>;
  strength: SkillSheet['strength'];
  element_relations: ReturnType<typeof elementRelations>;
  kakukyoku: string;
  pillars: Record<'year' | 'month' | 'day' | 'hour', InsightPillar | null>;
  hour_unknown: boolean;
  star_points: SkillSheet['inputs']['starPoints'];
  applied_rules: { title: string; interpretation: string; effects: Record<string, number> }[];
  abilities: Pick<SkillSheet['abilities'][number], 'key' | 'name' | 'meaning' | 'score' | 'breakdown'>[];
  jobs: Pick<SkillSheet['jobs'][number], 'key' | 'name' | 'meaning' | 'score' | 'rank' | 'weights'>[];
  context: InsightContext | null;
}

interface InsightPillar {
  stem: string;
  branch: string;
  stem_star: string;
  hidden: { stem: string; kind: '本気' | '中気' | '余気'; star: string }[];
}

/** AI の応答（検証・並べ替え済み） */
export interface InsightContent {
  summary: string;
  jobs: { key: string; text: string }[];
  abilities: { key: string; text: string }[];
  advice: string;
}

export class InsightValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InsightValidationError';
  }
}

function pillarInput(p: Pillar, isDay: boolean): InsightPillar {
  const kinds = [
    ['本気', p.hidden.honki, p.hiddenStars.honki],
    ['中気', p.hidden.chuki, p.hiddenStars.chuki],
    ['余気', p.hidden.yoki, p.hiddenStars.yoki],
  ] as const;
  return {
    stem: p.stem,
    branch: p.branch,
    stem_star: isDay ? '日干' : p.stemStar,
    hidden: kinds.filter(([, stem]) => stem).map(([kind, stem, star]) => ({ stem: stem!, kind, star: star! })),
  };
}

/**
 * AI に渡す入力を組み立てる。日干を起点に読ませるため、日干の性質 → 五行の関係 → 適用ルールの順に並べる。
 * @param dayStemType 十干マスタの比喩（樹木など）
 */
export function buildInsightInput(
  meishiki: MeishikiResult,
  sheet: SkillSheet,
  dayStemType: string,
  context: InsightContext | null = null,
  ruleset: RuleSet = loadDefaultRules(),
): InsightInput {
  const dayStem = meishiki.dayStem as Stem;
  const hourUnknown = Boolean(meishiki.input.hourUnknown);
  const pl = meishiki.pillars;
  return {
    rules_version: sheet.rulesVersion,
    day_stem: dayStemInfo(dayStem, dayStemType, ruleset),
    strength: sheet.strength,
    element_relations: elementRelations(dayStem, sheet.inputs.elementGroups, sheet.strength.label, ruleset),
    kakukyoku: sheet.kakukyoku,
    pillars: {
      year: pillarInput(pl.year, false),
      month: pillarInput(pl.month, false),
      day: pillarInput(pl.day, true),
      hour: hourUnknown || !pl.hour ? null : pillarInput(pl.hour, false),
    },
    hour_unknown: hourUnknown,
    star_points: sheet.inputs.starPoints,
    applied_rules: sheet.appliedRules.map(({ title, interpretation, effects }) => ({ title, interpretation, effects })),
    abilities: sheet.abilities.map(({ key, name, meaning, score, breakdown }) => ({ key, name, meaning, score, breakdown })),
    jobs: sheet.jobs.map(({ key, name, meaning, score, rank, weights }) => ({ key, name, meaning, score, rank, weights })),
    context,
  };
}

/** キーを並べた JSON（Python の json.dumps(sort_keys=True, separators=(',', ':')) と同じ） */
function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
}

/**
 * 入力（context を含む）＋プロンプトの版＋モデル名の SHA-256。
 * 保存済みの解説がこの値と一致するときだけ表示する（解釈ルールなどが変わったら、古い解説は出さない）。
 */
export function computeInsightHash(input: InsightInput, promptVersion: string, modelName: string): string {
  return createHash('sha256')
    .update(canonicalJson({ input, prompt_version: promptVersion, model_name: modelName }), 'utf8')
    .digest('hex');
}

/** プロンプトのファイルを「section: 名前」で区切る */
function loadPrompt(version: string): Record<'system' | 'user' | 'context', string> {
  const text = INSIGHT_PROMPTS[version];
  if (!text) throw new Error(`プロンプト ${version} がありません`);
  const parts = text.split(/^<!-- section: (\w+) -->\s*$/m);
  const sections: Record<string, string> = {};
  for (let i = 1; i < parts.length - 1; i += 2) sections[parts[i]!] = parts[i + 1]!.trim();
  for (const name of ['system', 'user', 'context']) {
    if (!(name in sections)) throw new Error(`プロンプトに section: ${name} がありません（${version}）`);
  }
  return sections as Record<'system' | 'user' | 'context', string>;
}

/** システム指示。{{principles}} を解釈ルール設定の読み方の原則（番号付き）に置き換える */
export function renderInsightSystemPrompt(version = INSIGHT_PROMPT_VERSION, ruleset: RuleSet = loadDefaultRules()): string {
  const principles = ruleset.principles.map((p, i) => `${i + 1}. ${p}`).join('\n');
  return loadPrompt(version).system.replace('{{principles}}', principles || '（なし）');
}

/** ユーザー入力。{{input_json}} と {{context_block}} を置き換える */
export function renderInsightUserPrompt(input: InsightInput, version = INSIGHT_PROMPT_VERSION): string {
  const sections = loadPrompt(version);
  const contextBlock = input.context
    ? `\n${sections.context.replace('{{context_json}}', JSON.stringify(input.context, null, 2))}`
    : '';
  return sections.user.replace('{{input_json}}', JSON.stringify(input, null, 2)).replace('{{context_block}}', contextBlock);
}

/** 構造化出力のスキーマ（Gemini の responseSchema。OpenAPI の部分集合で、型名は大文字：@google/genai の Type と同じ値） */
export function insightResponseSchema(sheet: SkillSheet) {
  const item = (keys: string[]) => ({
    type: 'ARRAY',
    items: {
      type: 'OBJECT',
      properties: { key: { type: 'STRING', enum: keys }, text: { type: 'STRING' } },
      required: ['key', 'text'],
      propertyOrdering: ['key', 'text'],
    },
  });
  return {
    type: 'OBJECT',
    properties: {
      summary: { type: 'STRING' },
      jobs: item(sheet.jobs.map((j) => j.key)),
      abilities: item(sheet.abilities.map((a) => a.key)),
      advice: { type: 'STRING' },
    },
    required: ['summary', 'jobs', 'abilities', 'advice'],
    propertyOrdering: ['summary', 'jobs', 'abilities', 'advice'],
  };
}

function checkText(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new InsightValidationError(`${label} が空です`);
  const text = value.trim();
  if ([...text].length > INSIGHT_MAX_TEXT_LENGTH) {
    throw new InsightValidationError(`${label} が${INSIGHT_MAX_TEXT_LENGTH}字を超えています`);
  }
  return text;
}

function checkItems(items: unknown, allowed: string[], label: string, requireAll: boolean) {
  if (!Array.isArray(items)) throw new InsightValidationError(`${label} が配列ではありません`);
  const texts = new Map<string, string>();
  for (const item of items) {
    if (!item || typeof item !== 'object') throw new InsightValidationError(`${label} の要素がオブジェクトではありません`);
    const key = (item as { key?: unknown }).key;
    if (typeof key !== 'string' || !allowed.includes(key)) {
      throw new InsightValidationError(`${label} に不明な key があります: ${String(key)}`);
    }
    if (texts.has(key)) throw new InsightValidationError(`${label} の key が重複しています: ${key}`);
    texts.set(key, checkText((item as { text?: unknown }).text, `${label}.${key}`));
  }
  if (requireAll) {
    const missing = allowed.filter((k) => !texts.has(k));
    if (missing.length) throw new InsightValidationError(`${label} に不足があります: ${missing.join(', ')}`);
  }
  // 表示順（スキル表の順）にそろえる
  return allowed.filter((k) => texts.has(k)).map((k) => ({ key: k, text: texts.get(k)! }));
}

/**
 * AI の応答を検証して整える（現行の validate_content と同じ基準）
 * - JSON として読め、summary・jobs・abilities・advice がそろう
 * - jobs は7職種すべて・重複なし。abilities は任意だが key は9能力のいずれか
 * - 各文は空でなく400字以内
 */
export function validateInsightContent(raw: unknown, sheet: SkillSheet): InsightContent {
  let content = raw;
  if (typeof content === 'string') {
    try {
      content = JSON.parse(content);
    } catch {
      throw new InsightValidationError('JSONとして解釈できません');
    }
  }
  if (!content || typeof content !== 'object' || Array.isArray(content)) {
    throw new InsightValidationError('応答がオブジェクトではありません');
  }
  const c = content as Record<string, unknown>;
  return {
    summary: checkText(c.summary, 'summary'),
    jobs: checkItems(c.jobs, sheet.jobs.map((j) => j.key), 'jobs', true),
    abilities: checkItems(c.abilities ?? [], sheet.abilities.map((a) => a.key), 'abilities', false),
    advice: checkText(c.advice, 'advice'),
  };
}
