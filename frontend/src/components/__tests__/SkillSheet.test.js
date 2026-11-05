import React from 'react';
import { render, screen } from '@testing-library/react';
import SkillSheet from '../SkillSheet';

export const sampleSheet = {
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

  test('renders abilities and jobs without section headings', () => {
    render(<SkillSheet skillSheet={sampleSheet} />);
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    expect(screen.getByText('企画')).toBeInTheDocument();
    expect(screen.getByText('ゼロから構想を描く')).toBeInTheDocument();
    expect(screen.getByText('90')).toBeInTheDocument();
    expect(screen.getByRole('meter', { name: '企画 90点' })).toBeInTheDocument();
    expect(screen.getByText('（方針を決め、責任を取る経営者）')).toBeInTheDocument();
    expect(screen.getByText('S')).toHaveClass('skill-rank-s');
  });

  test('sorts jobs from S downward (by score)', () => {
    render(<SkillSheet skillSheet={sampleSheet} />);
    const names = screen.getAllByText(/^(将軍|教官)$/).map((el) => el.textContent);
    expect(names).toEqual(['教官', '将軍']);
  });

  test('sorts abilities by score descending, keeping API order for ties', () => {
    const sheet = {
      ...sampleSheet,
      abilities: [
        { key: 'touritsu', name: '統率', meaning: 'm', score: 50 },
        { key: 'kikaku', name: '企画', meaning: 'm', score: 90 },
        { key: 'kaitaku', name: '開拓', meaning: 'm', score: 50 },
        { key: 'kanri', name: '管理', meaning: 'm', score: 25 },
      ],
    };
    const { container } = render(<SkillSheet skillSheet={sheet} />);
    const names = Array.from(container.querySelectorAll('.skill-ability-cell .skill-name')).map(
      (el) => el.textContent
    );
    expect(names).toEqual(['企画', '統率', '開拓', '管理']);
  });

  test('shows insight texts under each job and ability when provided', () => {
    const insight = {
      jobs: [{ key: 'kyoukan', text: '学ぶ力と伝える力が揃っています。' }],
      abilities: [{ key: 'kikaku', text: '構想を描く力が最も高く出ています。' }],
    };
    render(<SkillSheet skillSheet={sampleSheet} insight={insight} />);
    const kyoukanItem = screen.getByText('教官').closest('li');
    expect(kyoukanItem).toHaveTextContent('学ぶ力と伝える力が揃っています。');
    expect(kyoukanItem).toHaveTextContent('S');
    const kikakuCell = screen.getByText('企画').closest('li');
    expect(kikakuCell).toHaveTextContent('構想を描く力が最も高く出ています。');
    // 解説のない職種には本文を出さない
    expect(screen.getByText('将軍').closest('li').querySelector('.skill-job-text')).toBeNull();
  });

  test('debug info is shown only when showDebug is true', () => {
    const { rerender } = render(<SkillSheet skillSheet={sampleSheet} />);
    expect(screen.queryByText(/計算デバッグ情報/)).not.toBeInTheDocument();
    rerender(<SkillSheet skillSheet={sampleSheet} showDebug />);
    expect(screen.getByText(/計算デバッグ情報/)).toBeInTheDocument();
    expect(screen.getByText(/身旺度 D: 17.5/)).toBeInTheDocument();
  });
});
