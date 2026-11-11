import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  buildInsightInput,
  calculateMeishiki,
  calculateSkillSheet,
  computeInsightHash,
  INSIGHT_PROMPT_VERSION,
  InsightValidationError,
  insightResponseSchema,
  loadDefaultRules,
  renderInsightSystemPrompt,
  renderInsightUserPrompt,
  validateInsightContent,
} from '../src';
import { INSIGHT_PROMPTS } from '../src/prompts.generated';

const meishiki = calculateMeishiki({ year: 1985, month: 5, day: 10, hour: 11, minute: 30, birthPlace: '21', gender: 'male' });
const sheet = calculateSkillSheet(meishiki);
const input = buildInsightInput(meishiki, sheet, '田畑');

const goodContent = () => ({
  summary: '要約です。',
  jobs: sheet.jobs.map((j) => ({ key: j.key, text: `${j.name}の説明` })).reverse(),
  abilities: [{ key: 'kikaku', text: '企画の説明' }],
  advice: '活かし方です。',
});

describe('プロンプトのファイル', () => {
  it('現行版（backend）のプロンプトと同じ内容', () => {
    const backend = readFileSync(new URL('../../../backend/apps/fortune/prompts/skill_insight_v2.md', import.meta.url), 'utf8');
    const local = readFileSync(new URL('../prompts/skill_insight_v2.md', import.meta.url), 'utf8');
    expect(local).toBe(backend);
  });

  it('prompts.generated.ts が最新（書き出し忘れがない）', () => {
    const local = readFileSync(new URL('../prompts/skill_insight_v2.md', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
    expect(INSIGHT_PROMPTS[INSIGHT_PROMPT_VERSION]).toBe(local);
  });

  it('システム指示に読み方の原則が番号付きで入る', () => {
    const system = renderInsightSystemPrompt();
    expect(system).not.toContain('{{principles}}');
    expect(system).toContain(`1. ${loadDefaultRules().principles[0]}`);
  });

  it('ユーザー入力に入力の JSON が入り、本人コンテキストがなければ欄を出さない', () => {
    const user = renderInsightUserPrompt(input);
    expect(user).toContain('"rules_version"');
    expect(user).not.toContain('{{');
  });
});

describe('AI に渡す入力', () => {
  it('氏名・生年月日・出生時刻・出生地を含まない', () => {
    const json = JSON.stringify(input);
    expect(json).not.toMatch(/1985|birthPlace|"21"|11:30|gender|male/);
  });

  it('日干を起点にした項目がそろい、日柱の通変星は「日干」', () => {
    expect(input.day_stem.stem).toBe('己');
    expect(input.day_stem.type).toBe('田畑');
    expect(input.pillars.day?.stem_star).toBe('日干');
    expect(input.pillars.hour?.stem).toBe('庚');
    expect(input.jobs).toHaveLength(7);
    expect(input.abilities).toHaveLength(9);
  });

  it('時間不明なら時柱は null', () => {
    const m = calculateMeishiki({ year: 1985, month: 5, day: 10, hourUnknown: true, birthPlace: '21', gender: 'male' });
    const i = buildInsightInput(m, calculateSkillSheet(m), '田畑');
    expect(i.pillars.hour).toBeNull();
    expect(i.hour_unknown).toBe(true);
  });

  it('ハッシュは同じ入力で同じ、モデル名やプロンプトの版が変われば変わる', () => {
    const a = computeInsightHash(input, 'v2', 'gemini-3.6-flash');
    expect(computeInsightHash(buildInsightInput(meishiki, sheet, '田畑'), 'v2', 'gemini-3.6-flash')).toBe(a);
    expect(computeInsightHash(input, 'v2', 'other-model')).not.toBe(a);
    expect(computeInsightHash(input, 'v3', 'gemini-3.6-flash')).not.toBe(a);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('構造化出力のスキーマは職種・能力の key を列挙で持つ', () => {
    const schema = insightResponseSchema(sheet);
    expect(schema.properties.jobs.items.properties.key.enum).toEqual(sheet.jobs.map((j) => j.key));
  });
});

describe('応答の検証', () => {
  it('正しい応答は通り、職種はスキル表の順に並べ替える', () => {
    const v = validateInsightContent(JSON.stringify(goodContent()), sheet);
    expect(v.jobs.map((j) => j.key)).toEqual(sheet.jobs.map((j) => j.key));
    expect(v.abilities).toEqual([{ key: 'kikaku', text: '企画の説明' }]);
  });

  it.each([
    ['JSON でない', 'not json'],
    ['職種が足りない', { ...goodContent(), jobs: goodContent().jobs.slice(1) }],
    ['知らない key', { ...goodContent(), abilities: [{ key: 'unknown', text: 'x' }] }],
    ['重複', { ...goodContent(), abilities: [{ key: 'kikaku', text: 'a' }, { key: 'kikaku', text: 'b' }] }],
    ['空の文', { ...goodContent(), summary: '  ' }],
    ['400字を超える', { ...goodContent(), advice: 'あ'.repeat(401) }],
  ])('%s は不合格', (_label, raw) => {
    expect(() => validateInsightContent(raw, sheet)).toThrow(InsightValidationError);
  });
});
