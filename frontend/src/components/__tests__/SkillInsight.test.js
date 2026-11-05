import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SkillInsight from '../SkillInsight';
import { fortuneService } from '../../services/fortuneService';

jest.mock('../../services/fortuneService', () => ({
  fortuneService: {
    getSkillInsight: jest.fn(),
    generateSkillInsight: jest.fn(),
  },
}));

const skillSheet = {
  abilities: [
    { key: 'kikaku', name: '企画', score: 90 },
    { key: 'chiryaku', name: '知略', score: 82 },
  ],
  jobs: [
    { key: 'shogun', name: '将軍', score: 58, rank: 'C+' },
    { key: 'kyoukan', name: '教官', score: 86, rank: 'S' },
  ],
};

const insight = {
  summary: '印と食傷が強い命式です。',
  jobs: [
    { key: 'kyoukan', text: '学ぶ力と伝える力が揃っています。' },
    { key: 'shogun', text: '少数精鋭のチームで力を発揮しやすくなります。' },
  ],
  abilities: [{ key: 'kikaku', text: '構想を描く力が最も高く出ています。' }],
  advice: '学んだことを形にすると活きます。',
  model_name: 'gemini-test-model',
  prompt_version: 'v1',
  created_at: '2026-11-05T12:00:00+09:00',
  is_cached: true,
};

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe('SkillInsight Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders nothing when skillSheet is null', async () => {
    fortuneService.getSkillInsight.mockResolvedValue({ insight: null, available: true });
    const { container } = render(<SkillInsight calculationId={1} skillSheet={null} />);
    await waitFor(() => expect(fortuneService.getSkillInsight).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  test('not generated: shows generate button and does not auto-generate', async () => {
    fortuneService.getSkillInsight.mockResolvedValue({ insight: null, available: true });
    render(<SkillInsight calculationId={1} skillSheet={skillSheet} />);
    expect(await screen.findByRole('button', { name: '判定の要点を生成' })).toBeInTheDocument();
    expect(fortuneService.getSkillInsight).toHaveBeenCalledWith(1);
    expect(fortuneService.generateSkillInsight).not.toHaveBeenCalled();
  });

  test('unavailable: shows message instead of button', async () => {
    fortuneService.getSkillInsight.mockResolvedValue({ insight: null, available: false });
    render(<SkillInsight calculationId={1} skillSheet={skillSheet} />);
    expect(await screen.findByText('現在、判定の要点は生成できません。')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '判定の要点を生成' })).not.toBeInTheDocument();
  });

  test('generating: shows loading, then generated content', async () => {
    fortuneService.getSkillInsight.mockResolvedValue({ insight: null, available: true });
    const pending = deferred();
    fortuneService.generateSkillInsight.mockReturnValue(pending.promise);
    render(<SkillInsight calculationId={1} skillSheet={skillSheet} />);

    fireEvent.click(await screen.findByRole('button', { name: '判定の要点を生成' }));
    expect(screen.getByText(/判定の要点を生成しています/)).toBeInTheDocument();
    expect(fortuneService.generateSkillInsight).toHaveBeenCalledWith(1, { regenerate: false });

    pending.resolve({ insight: { ...insight, is_cached: false } });
    expect(await screen.findByText('印と食傷が強い命式です。')).toBeInTheDocument();
    expect(screen.queryByText(/判定の要点を生成しています/)).not.toBeInTheDocument();
  });

  test('generated: rank labels come from skill_sheet, in skill_sheet order', async () => {
    fortuneService.getSkillInsight.mockResolvedValue({ insight, available: true });
    render(<SkillInsight calculationId={1} skillSheet={skillSheet} />);

    await screen.findByText('印と食傷が強い命式です。');
    const labels = Array.from(document.querySelectorAll('.skill-insight-jobs .skill-insight-job-label')).map(
      (el) => el.textContent
    );
    expect(labels).toEqual(['将軍C+：', '教官S：']);
    // ランクは職種名と別要素（「現場LB」のように続けて読めないように）
    expect(screen.getByText('C+')).toHaveClass('skill-insight-rank');
    const abilityLabels = Array.from(
      document.querySelectorAll('.skill-insight-abilities .skill-insight-job-label')
    ).map((el) => el.textContent);
    expect(abilityLabels).toEqual(['企画90：']);
    expect(screen.getByText('学んだことを形にすると活きます。')).toBeInTheDocument();
    expect(screen.getByText(/AIによる生成文です（gemini-test-model・2026年11月5日/)).toBeInTheDocument();
  });

  test('regenerate button requests regenerate=true', async () => {
    fortuneService.getSkillInsight.mockResolvedValue({ insight, available: true });
    fortuneService.generateSkillInsight.mockResolvedValue({
      insight: { ...insight, summary: '新しい要約です。', is_cached: false },
    });
    render(<SkillInsight calculationId={1} skillSheet={skillSheet} />);

    fireEvent.click(await screen.findByRole('button', { name: '再生成' }));
    expect(await screen.findByText('新しい要約です。')).toBeInTheDocument();
    expect(fortuneService.generateSkillInsight).toHaveBeenCalledWith(1, { regenerate: true });
  });

  test('error: shows API message with ErrorMessage', async () => {
    fortuneService.getSkillInsight.mockResolvedValue({ insight: null, available: true });
    fortuneService.generateSkillInsight.mockRejectedValue({
      response: { status: 429, data: { detail: '本日の生成回数の上限に達しました' } },
    });
    render(<SkillInsight calculationId={1} skillSheet={skillSheet} />);

    fireEvent.click(await screen.findByRole('button', { name: '判定の要点を生成' }));
    expect(await screen.findByText('本日の生成回数の上限に達しました')).toBeInTheDocument();
  });

  test('error without detail falls back to default message', async () => {
    fortuneService.getSkillInsight.mockResolvedValue({ insight: null, available: true });
    fortuneService.generateSkillInsight.mockRejectedValue(new Error('Network Error'));
    render(<SkillInsight calculationId={1} skillSheet={skillSheet} />);

    fireEvent.click(await screen.findByRole('button', { name: '判定の要点を生成' }));
    expect(
      await screen.findByText('生成に失敗しました。時間をおいて再度お試しください')
    ).toBeInTheDocument();
  });
});
