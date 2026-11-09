/**
 * 解釈ルール（rules/skill_rules.toml）の読み込み・検証・判定
 *
 * 現行: backend/apps/fortune/skill_rules.py
 * 説明書: doc/解釈ルール設定.md
 *
 * 鑑定スキル表の点数補正（adjust）と、判定の要点（AI）に渡す解釈の両方に使う。
 * 書式の誤りは RulesConfigError（どのルールのどの項目かを含む）で知らせる。
 */
import { createHash } from 'node:crypto';
import { parse as parseToml, TomlError } from 'smol-toml';
import {
  ELEMENT_CYCLE,
  ELEMENT_GROUPS,
  ELEMENT_LABELS,
  STARS,
  STEMS,
  STEM_TO_ELEMENT,
  YANG_STEMS,
  type ElementGroup,
  type Star,
  type Stem,
} from './constants';
import { Dec } from './decimal';
import { SKILL_RULES_TOML } from './rules.generated';

export const STRENGTH_LABELS = ['身旺', '身弱', '中和'] as const;
export type StrengthLabel = (typeof STRENGTH_LABELS)[number];

export const ROLES = ['喜', '忌', '中'] as const;
export type Role = (typeof ROLES)[number];

export const ABILITY_KEYS = [
  'kikaku',
  'chiryaku',
  'jikkou',
  'tairyoku',
  'jinbou',
  'touritsu',
  'kaitaku',
  'shousai',
  'kanri',
] as const;
export type AbilityKey = (typeof ABILITY_KEYS)[number];

const STRENGTH_DIFF_NAME = '身旺度';

const CONDITION_KEYS = [
  'strength',
  'day_stem',
  'day_element',
  'top_group',
  'group_at_least',
  'group_below',
  'group_rank_within',
  'strength_diff_at_least',
  'strength_diff_below',
  'kakukyoku_any',
  'stem_stars',
] as const;
const ADJUST_KEYS = new Set(['ability', 'value', 'per', 'min', 'max']);
const PER_NAMES = new Set<string>([...ELEMENT_GROUPS, ...STARS, STRENGTH_DIFF_NAME]);
const FORMAT_NAMES = new Set<string>([...ELEMENT_GROUPS, ...STARS, STRENGTH_DIFF_NAME, '日干']);

/** 日干から見た各グループの関係（相生・相剋） */
export const GROUP_RELATIONS: Record<ElementGroup, string> = {
  比劫: '日干と同じ五行（自分自身の力・仲間）',
  印: '日干を生じる（支え・学び・吸収）',
  食傷: '日干が生じる（表現・出力・形にする力）',
  財: '日干が剋す（扱う対象・お金・成果）',
  官: '日干を剋す（規律・組織・プレッシャー）',
};
const GROUP_OFFSETS: Record<ElementGroup, number> = { 比劫: 0, 食傷: 1, 財: 2, 官: 3, 印: 4 };

export class RulesConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RulesConfigError';
  }
}

export interface Adjustment {
  ability: AbilityKey;
  value: Dec;
  per: string[];
  min: Dec | null;
  max: Dec | null;
}

export type Condition = Record<string, unknown>;

export interface Rule {
  id: string;
  title: string;
  when: Condition;
  interpretation: string;
  adjust: Adjustment[];
}

export interface DayStemProfile {
  nature: string;
  strengths: string;
  cautions: string;
  adjust: Adjustment[];
}

export interface RuleSet {
  version: string;
  /** version と内容のハッシュ（sha256 の先頭12桁）。判定の要点の入力に含め、ルールの変更を見分ける */
  fingerprint: string;
  principles: string[];
  strengthRoles: Record<StrengthLabel, Record<ElementGroup, Role>>;
  dayStems: Partial<Record<Stem, DayStemProfile>>;
  rules: Rule[];
}

export interface RuleContext {
  dayStem: Stem;
  strengthLabel: StrengthLabel;
  strengthDiff: number;
  elementGroups: Record<ElementGroup, number>;
  starPoints: Record<Star, number>;
  kakukyoku: string;
  /** 天干（日干を除く）の通変星 */
  stemStars: Star[];
}

export interface AppliedRule {
  id: string;
  title: string;
  interpretation: string;
  adjustments: { ability: AbilityKey; value: Dec }[];
}

// ---------------------------------------------------------------------------
// 読み込み・検証
// ---------------------------------------------------------------------------

function fail(where: string, message: string): never {
  throw new RulesConfigError(`解釈ルール設定の誤り（${where}）: ${message}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date);
}

function asDec(value: unknown, where: string): Dec {
  if (typeof value !== 'number' && typeof value !== 'bigint') fail(where, `数値で指定してください: ${JSON.stringify(value)}`);
  return Dec.from(String(value));
}

function checkList(value: unknown, allowed: readonly string[], where: string): string[] {
  const list = typeof value === 'string' ? [value] : value;
  if (!Array.isArray(list) || list.length === 0) fail(where, 'リストで指定してください');
  for (const v of list) {
    if (typeof v !== 'string' || !allowed.includes(v)) {
      fail(where, `使えない値です: ${JSON.stringify(v)}（使える値: ${allowed.join('・')}）`);
    }
  }
  return list as string[];
}

function checkGroupMap(value: unknown, where: string): void {
  if (!isRecord(value) || Object.keys(value).length === 0) fail(where, '{ "財" = 30 } の形で指定してください');
  for (const [k, v] of Object.entries(value)) {
    if (!(ELEMENT_GROUPS as readonly string[]).includes(k)) fail(where, `五行グループ名が不正です: ${JSON.stringify(k)}`);
    asDec(v, where);
  }
}

function checkWhen(when: unknown, where: string): Condition {
  if (!isRecord(when)) fail(where, 'when は { ... } の形で指定してください');
  for (const [key, value] of Object.entries(when)) {
    const w = `${where} の when.${key}`;
    switch (key) {
      case 'strength':
        checkList(value, STRENGTH_LABELS, w);
        break;
      case 'day_stem':
        checkList(value, STEMS, w);
        break;
      case 'day_element':
        checkList(value, Object.values(ELEMENT_LABELS), w);
        break;
      case 'top_group':
        checkList(value, ELEMENT_GROUPS, w);
        break;
      case 'group_at_least':
      case 'group_below':
      case 'group_rank_within':
        checkGroupMap(value, w);
        break;
      case 'strength_diff_at_least':
      case 'strength_diff_below':
        asDec(value, w);
        break;
      case 'kakukyoku_any':
        if (!Array.isArray(value) || !value.every((v) => typeof v === 'string' && v)) fail(w, '格名のリストで指定してください');
        break;
      case 'stem_stars':
        if (!Array.isArray(value) || value.length === 0) fail(w, '[["傷官"], ["正官", "偏官"]] の形で指定してください');
        for (const group of value) checkList(group, STARS, w);
        break;
      default:
        fail(w, `不明な条件です（使える条件: ${[...CONDITION_KEYS].sort().join('・')}）`);
    }
  }
  return when;
}

function parseAdjust(items: unknown, where: string): Adjustment[] {
  if (items === undefined || items === null) return [];
  if (!Array.isArray(items)) fail(where, 'adjust はリストで指定してください');
  return items.map((item, i) => {
    const w = `${where} の adjust ${i + 1}件目`;
    if (!isRecord(item)) fail(w, '{ ability = "...", value = ... } の形で指定してください');
    const unknown = Object.keys(item).filter((k) => !ADJUST_KEYS.has(k));
    if (unknown.length) fail(w, `不明な項目です: ${unknown.sort().join(', ')}`);
    if (!(ABILITY_KEYS as readonly unknown[]).includes(item.ability)) {
      fail(w, `ability が不正です: ${JSON.stringify(item.ability)}（使える値: ${ABILITY_KEYS.join(', ')}）`);
    }
    if (!('value' in item)) fail(w, 'value がありません');
    const rawPer = item.per ?? [];
    const per = typeof rawPer === 'string' ? [rawPer] : rawPer;
    if (!Array.isArray(per)) fail(w, 'per は名前、または名前のリストで指定してください');
    for (const name of per) {
      if (typeof name !== 'string' || !PER_NAMES.has(name)) fail(w, `per に使えない名前です: ${JSON.stringify(name)}`);
    }
    return {
      ability: item.ability as AbilityKey,
      value: asDec(item.value, w),
      per: per as string[],
      min: 'min' in item ? asDec(item.min, w) : null,
      max: 'max' in item ? asDec(item.max, w) : null,
    };
  });
}

/** interpretation の差し込み（{官} など）の名前を取り出す。{{ と }} は文字の { } */
function placeholderNames(text: string, where: string): string[] {
  const names: string[] = [];
  const re = /\{\{|\}\}|\{([^{}]*)\}|[{}]/g;
  for (const m of text.matchAll(re)) {
    if (m[0] === '{{' || m[0] === '}}') continue;
    if (m[1] === undefined) fail(where, 'interpretation の { } の書き方が不正です');
    names.push(m[1]);
  }
  return names;
}

function checkInterpretation(text: unknown, where: string): string {
  if (typeof text !== 'string') fail(where, 'interpretation は文字列で指定してください');
  for (const name of placeholderNames(text, where)) {
    if (!FORMAT_NAMES.has(name)) fail(where, `interpretation で使えない差し込み名です: {${name}}`);
  }
  return text;
}

/** TOML の文字列を検証して RuleSet にする */
export function parseRules(text: string): RuleSet {
  let data: Record<string, unknown>;
  try {
    data = parseToml(text) as Record<string, unknown>;
  } catch (e) {
    const detail = e instanceof TomlError ? e.message : String(e);
    throw new RulesConfigError(`解釈ルール設定を読み込めません（TOMLの書式）: ${detail}`);
  }

  const principles = data.principles ?? [];
  if (!Array.isArray(principles) || !principles.every((p) => typeof p === 'string')) {
    fail('principles', '文字列のリストで指定してください');
  }

  const rawRoles = isRecord(data.strength_roles) ? data.strength_roles : {};
  const strengthRoles = {} as RuleSet['strengthRoles'];
  for (const label of STRENGTH_LABELS) {
    const roles = rawRoles[label];
    if (!isRecord(roles)) fail(`strength_roles.${label}`, '5つの五行グループの役割を指定してください');
    for (const group of ELEMENT_GROUPS) {
      if (!(ROLES as readonly unknown[]).includes(roles[group])) {
        fail(`strength_roles.${label}.${group}`, `喜・忌・中のいずれかで指定してください: ${JSON.stringify(roles[group] ?? null)}`);
      }
    }
    strengthRoles[label] = roles as Record<ElementGroup, Role>;
  }

  const dayStems: RuleSet['dayStems'] = {};
  for (const [stem, profile] of Object.entries(isRecord(data.day_stems) ? data.day_stems : {})) {
    const where = `day_stems.${stem}`;
    if (!(STEMS as readonly string[]).includes(stem)) fail(where, '日干名が不正です');
    if (!isRecord(profile)) fail(where, 'nature・strengths・cautions を指定してください');
    for (const key of ['nature', 'strengths', 'cautions']) {
      if (typeof (profile[key] ?? '') !== 'string') fail(`${where}.${key}`, '文字列で指定してください');
    }
    dayStems[stem as Stem] = {
      nature: (profile.nature as string) ?? '',
      strengths: (profile.strengths as string) ?? '',
      cautions: (profile.cautions as string) ?? '',
      adjust: parseAdjust(profile.adjust, where),
    };
  }

  const rules: Rule[] = [];
  const seen = new Set<string>();
  const rawRules = Array.isArray(data.rules) ? data.rules : [];
  rawRules.forEach((raw, i) => {
    const id = isRecord(raw) ? raw.id : undefined;
    const where = `rules ${i + 1}件目（id=${id === undefined ? 'None' : String(id)}）`;
    if (typeof id !== 'string' || !id) fail(where, 'id がありません');
    if (seen.has(id)) fail(where, 'id が重複しています');
    seen.add(id);
    const r = raw as Record<string, unknown>;
    if (typeof r.title !== 'string' || !r.title) fail(where, 'title がありません');
    rules.push({
      id,
      title: r.title,
      when: checkWhen(r.when ?? {}, where),
      interpretation: checkInterpretation(r.interpretation ?? '', where),
      adjust: parseAdjust(r.adjust, where),
    });
  });

  const version = data.version === undefined ? '' : String(data.version);
  const digest = createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 12);
  return {
    version,
    fingerprint: `${version}-${digest}`,
    principles: principles as string[],
    strengthRoles,
    dayStems,
    rules,
  };
}

let defaultRuleSet: RuleSet | null = null;

/** リポジトリに同梱した解釈ルール（rules/skill_rules.toml）。初回に読み込んで検証する */
export function loadDefaultRules(): RuleSet {
  defaultRuleSet ??= parseRules(SKILL_RULES_TOML);
  return defaultRuleSet;
}

// ---------------------------------------------------------------------------
// 判定
// ---------------------------------------------------------------------------

function rankOf(groups: Record<ElementGroup, number>, group: ElementGroup): number {
  const value = groups[group] ?? 0;
  return 1 + ELEMENT_GROUPS.filter((g) => (groups[g] ?? 0) > value).length;
}

const asList = (v: unknown): string[] => (typeof v === 'string' ? [v] : (v as string[]));
const d = (v: unknown) => Dec.from(String(v ?? 0));

/** 条件をすべて満たすか */
export function matches(when: Condition, ctx: RuleContext): boolean {
  const groups = ctx.elementGroups;
  for (const [key, value] of Object.entries(when)) {
    const map = value as Record<ElementGroup, number>;
    const entries = () => Object.entries(map) as [ElementGroup, number][];
    switch (key) {
      case 'strength':
        if (!asList(value).includes(ctx.strengthLabel)) return false;
        break;
      case 'day_stem':
        if (!asList(value).includes(ctx.dayStem)) return false;
        break;
      case 'day_element':
        if (!asList(value).includes(ELEMENT_LABELS[STEM_TO_ELEMENT[ctx.dayStem]])) return false;
        break;
      case 'top_group':
        if (!asList(value).some((g) => rankOf(groups, g as ElementGroup) === 1)) return false;
        break;
      case 'group_at_least':
        if (entries().some(([g, v]) => d(groups[g]).cmp(d(v)) < 0)) return false;
        break;
      case 'group_below':
        if (entries().some(([g, v]) => d(groups[g]).cmp(d(v)) >= 0)) return false;
        break;
      case 'group_rank_within':
        if (entries().some(([g, v]) => rankOf(groups, g) > v)) return false;
        break;
      case 'strength_diff_at_least':
        if (d(ctx.strengthDiff).cmp(d(value)) < 0) return false;
        break;
      case 'strength_diff_below':
        if (d(ctx.strengthDiff).cmp(d(value)) >= 0) return false;
        break;
      case 'kakukyoku_any':
        if (!(value as string[]).some((k) => (ctx.kakukyoku ?? '').includes(k))) return false;
        break;
      case 'stem_stars':
        if (!(value as unknown[]).every((g) => asList(g).some((s) => ctx.stemStars.includes(s as Star)))) return false;
        break;
    }
  }
  return true;
}

function baseValue(name: string, ctx: RuleContext): Dec {
  if ((ELEMENT_GROUPS as readonly string[]).includes(name)) return d(ctx.elementGroups[name as ElementGroup]);
  if (name === STRENGTH_DIFF_NAME) return d(ctx.strengthDiff);
  return d(ctx.starPoints[name as Star]);
}

/** 補正量。per があれば value × 合計、min・max で範囲を制限 */
export function adjustmentAmount(adj: Adjustment, ctx: RuleContext): Dec {
  let amount = adj.per.length ? adj.value.mul(Dec.sum(adj.per.map((n) => baseValue(n, ctx)))) : adj.value;
  if (adj.min) amount = Dec.max(adj.min, amount);
  if (adj.max) amount = Dec.min(adj.max, amount);
  return amount;
}

/** 現行の _fmt と同じ表記（整数ならそのまま、小数なら最短表記） */
export function formatNumber(value: number): string {
  return Number.isInteger(value) ? value.toFixed(0) : String(value);
}

export function formatInterpretation(text: string, ctx: RuleContext): string {
  const values: Record<string, string> = { 日干: ctx.dayStem, [STRENGTH_DIFF_NAME]: formatNumber(ctx.strengthDiff) };
  for (const g of ELEMENT_GROUPS) values[g] = formatNumber(ctx.elementGroups[g] ?? 0);
  for (const s of STARS) values[s] = formatNumber(ctx.starPoints[s] ?? 0);
  return text.replace(/\{\{|\}\}|\{([^{}]*)\}/g, (m, name: string | undefined) => {
    if (m === '{{') return '{';
    if (m === '}}') return '}';
    return values[name!] ?? m;
  });
}

/** 条件に合うルール（日干の補正 → [[rules]] の上から順） */
export function evaluateRules(ctx: RuleContext, ruleset: RuleSet = loadDefaultRules()): AppliedRule[] {
  const applied: AppliedRule[] = [];
  const profile = ruleset.dayStems[ctx.dayStem];
  if (profile && profile.adjust.length) {
    applied.push({
      id: `day_stem_${ctx.dayStem}`,
      title: `日干${ctx.dayStem}の性質`,
      interpretation: '',
      adjustments: profile.adjust.map((a) => ({ ability: a.ability, value: adjustmentAmount(a, ctx) })),
    });
  }
  for (const rule of ruleset.rules) {
    if (!matches(rule.when, ctx)) continue;
    applied.push({
      id: rule.id,
      title: rule.title,
      interpretation: formatInterpretation(rule.interpretation, ctx),
      adjustments: rule.adjust.map((a) => ({ ability: a.ability, value: adjustmentAmount(a, ctx) })),
    });
  }
  return applied;
}

// ---------------------------------------------------------------------------
// AI解説向けの日干・五行の情報
// ---------------------------------------------------------------------------

export function dayStemInfo(dayStem: Stem, stemType = '', ruleset: RuleSet = loadDefaultRules()) {
  const profile = ruleset.dayStems[dayStem];
  return {
    stem: dayStem,
    element: ELEMENT_LABELS[STEM_TO_ELEMENT[dayStem]],
    yin_yang: YANG_STEMS.has(dayStem) ? '陽' : '陰',
    type: stemType,
    nature: profile?.nature ?? '',
    strengths: profile?.strengths ?? '',
    cautions: profile?.cautions ?? '',
  };
}

/** 日干から見た5グループの関係・点数・順位・役割（喜忌） */
export function elementRelations(
  dayStem: Stem,
  elementGroups: Record<ElementGroup, number>,
  strengthLabel: StrengthLabel,
  ruleset: RuleSet = loadDefaultRules(),
) {
  const roles = ruleset.strengthRoles[strengthLabel];
  const selfIndex = ELEMENT_CYCLE.indexOf(STEM_TO_ELEMENT[dayStem]);
  return ELEMENT_GROUPS.map((group) => ({
    group,
    element: ELEMENT_LABELS[ELEMENT_CYCLE[(selfIndex + GROUP_OFFSETS[group]) % 5]!],
    relation: GROUP_RELATIONS[group],
    score: elementGroups[group] ?? 0,
    rank: rankOf(elementGroups, group),
    role: roles?.[group] ?? '中',
  }));
}
