import React from 'react';
import { render, screen } from '@testing-library/react';
import SkillSheet from '../SkillSheet';

const sampleSheet = {
  version: 'alpha-1',
  is_reference: false,
  strength: { label: '身旺', diff: 17.5 },
  kakukyoku: '傷官格',
  day_stem: '己',
  day_stem_type: '田畑',
  abilities: [
    { key: 'kikaku', name: '企画', meaning: 'ゼロから構想を描く', score: 90 },
    { key: 'chiryaku', name: '知略', meaning: '情報を整理し本質を見抜く', score: 82 },
  ],
  jobs: [
    { key: 'shogun', name: '将軍', meaning: '方針を決め、責任を取る経営者', score: 58, rank: 'C+' },
    { key: 'kyoukan', name: '教官', meaning: '学びを設計し、人を育てる', score: 86, rank: 'S' },
  ],
  inputs: {
    element_groups: { 比劫: 25.0, 印: 30.0, 食傷: 25.0, 財: 2.5, 官: 10.0 },
    star_points: { 食神: 35, 偏印: 20 },
  },
};

describe('SkillSheet Component', () => {
  test('renders nothing when skillSheet is null', () => {
    const { container } = render(<SkillSheet skillSheet={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  test('renders heading, subtitle, abilities and jobs', () => {
    render(<SkillSheet skillSheet={sampleSheet} />);
    expect(screen.getByText('鑑定スキル表（現代ビジネス版）')).toBeInTheDocument();
    expect(screen.getByText('日干：己（田畑）／身旺／傷官格')).toBeInTheDocument();
    expect(screen.getByText('企画')).toBeInTheDocument();
    expect(screen.getByText('ゼロから構想を描く')).toBeInTheDocument();
    expect(screen.getByText('90')).toBeInTheDocument();
    expect(screen.getByRole('meter', { name: '企画 90点' })).toBeInTheDocument();
    expect(screen.getByText('S')).toBeInTheDocument();
    expect(screen.getByText(/試作版です/)).toBeInTheDocument();
  });

  test('keeps job order from API (not sorted by rank)', () => {
    render(<SkillSheet skillSheet={sampleSheet} />);
    const names = screen.getAllByText(/^(将軍|教官)$/).map((el) => el.textContent);
    expect(names).toEqual(['将軍', '教官']);
  });

  test('shows reference notice when is_reference is true', () => {
    render(<SkillSheet skillSheet={{ ...sampleSheet, is_reference: true }} />);
    expect(screen.getByText('時間不明のため参考値')).toBeInTheDocument();
  });

  test('does not show reference notice when is_reference is false', () => {
    render(<SkillSheet skillSheet={sampleSheet} />);
    expect(screen.queryByText('時間不明のため参考値')).not.toBeInTheDocument();
  });

  test('debug info is shown only when showDebug is true', () => {
    const { rerender } = render(<SkillSheet skillSheet={sampleSheet} />);
    expect(screen.queryByText(/計算デバッグ情報/)).not.toBeInTheDocument();
    rerender(<SkillSheet skillSheet={sampleSheet} showDebug />);
    expect(screen.getByText(/計算デバッグ情報/)).toBeInTheDocument();
    expect(screen.getByText(/身旺度 D: 17.5/)).toBeInTheDocument();
  });
});
