import { describe, expect, it } from 'vitest';
import {
  buildDailyInput,
  calculateMeishiki,
  DailyValidationError,
  findDailyRelations,
  renderDailyUserPrompt,
  validateDailyContent,
  type TodayPillars,
} from '../src';

const natal = calculateMeishiki({ year: 1990, month: 5, day: 15, hour: 10, minute: 0, birthPlace: '23', gender: 'male' });
const pillar = (stem: string, branch: string) => ({ stem, branch }) as never;

describe('今日の干支と命式の関係', () => {
  it('地支の冲・六合・干合を拾う', () => {
    const d = natal.pillars.day;
    const chuu: Record<string, string> = { 子: '午', 午: '子', 丑: '未', 未: '丑', 寅: '申', 申: '寅', 卯: '酉', 酉: '卯', 辰: '戌', 戌: '辰', 巳: '亥', 亥: '巳' };
    const today: TodayPillars = { year: pillar('甲', '子'), month: pillar('甲', '子'), day: pillar('甲', chuu[d.branch]!) };
    const rels = findDailyRelations(natal, today);
    expect(rels.some((r) => r.today === 'day' && r.natal === '日柱' && r.kind === '冲')).toBe(true);
  });

  it('入力に生年月日などの個人情報を含めない', () => {
    const today: TodayPillars = { year: pillar('丙', '午'), month: pillar('庚', '子'), day: pillar('癸', '卯') };
    const json = JSON.stringify(buildDailyInput(natal, today));
    expect(json).not.toContain('1990');
    expect(json).not.toContain('birthPlace');
    expect(renderDailyUserPrompt(buildDailyInput(natal, today))).toContain('relations');
  });
});

describe('応答の検証', () => {
  const ok = {
    summary: 'まとめ',
    angles: [{ angle: '日干との関係', text: 'a' }],
    cautions: ['c'],
    strengths: ['s'],
  };
  it('正しい応答を通す', () => {
    expect(validateDailyContent(JSON.stringify(ok)).angles).toHaveLength(1);
  });
  it('不正な angle・重複・空を拒む', () => {
    expect(() => validateDailyContent({ ...ok, angles: [{ angle: 'x', text: 'a' }] })).toThrow(DailyValidationError);
    expect(() => validateDailyContent({ ...ok, angles: [ok.angles[0], ok.angles[0]] })).toThrow(DailyValidationError);
    expect(() => validateDailyContent({ ...ok, cautions: [] })).toThrow(DailyValidationError);
  });
});
