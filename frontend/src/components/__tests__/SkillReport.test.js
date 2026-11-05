import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SkillReport from '../SkillReport';
import { fortuneService } from '../../services/fortuneService';

jest.mock('../../services/fortuneService', () => ({
  fortuneService: {
    getSkillInsight: jest.fn(),
    generateSkillInsight: jest.fn(),
  },
}));

const skillSheet = {
  is_reference: false,
  abilities: [
    { key: 'kikaku', name: '企画', meaning: 'ゼロから構想を描く', score: 90 },
    { key: 'chiryaku', name: '知略', meaning: '情報を整理し本質を見抜く', score: 82 },
  ],
  jobs: [
    { key: 'shogun', name: '将軍', meaning: '方針を決め、責任を取る経営者', score: 58, rank: 'C+' },
    { key: 'kyoukan', name: '教官', meaning: '学びを設計し、人を育てる', score: 86, rank: 'S' },
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
  const promise = new Promise((res) => {
    resolve = res;
  });
  return { promise, resolve };
};

describe('SkillReport Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders nothing when skillSheet is null', async () => {
    fortuneService.getSkillInsight.mockResolvedValue({ insight: null, available: true });
    const { container } = render(<SkillReport calculationId={1} skillSheet={null} />);
    await waitFor(() => expect(fortuneService.getSkillInsight).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  test('not generated: shows skill sheet and generate button, no auto-generate', async () => {
    fortuneService.getSkillInsight.mockResolvedValue({ insight: null, available: true });
    render(<SkillReport calculationId={1} skillSheet={skillSheet} />);
    expect(screen.getByText('将軍')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: '判定の要点を生成' })).toBeInTheDocument();
    expect(fortuneService.getSkillInsight).toHaveBeenCalledWith(1);
    expect(fortuneService.generateSkillInsight).not.toHaveBeenCalled();
  });

  test('unavailable: shows message instead of button', async () => {
    fortuneService.getSkillInsight.mockResolvedValue({ insight: null, available: false });
    render(<SkillReport calculationId={1} skillSheet={skillSheet} />);
    expect(await screen.findByText(/現在生成できません/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '判定の要点を生成' })).not.toBeInTheDocument();
  });

  test('generating: shows loading, then summary and per-job texts', async () => {
    fortuneService.getSkillInsight.mockResolvedValue({ insight: null, available: true });
    const pending = deferred();
    fortuneService.generateSkillInsight.mockReturnValue(pending.promise);
    render(<SkillReport calculationId={1} skillSheet={skillSheet} />);

    fireEvent.click(await screen.findByRole('button', { name: '判定の要点を生成' }));
    expect(screen.getByText(/判定の要点を生成しています/)).toBeInTheDocument();
    expect(fortuneService.generateSkillInsight).toHaveBeenCalledWith(1, { regenerate: false });

    pending.resolve({ insight: { ...insight, is_cached: false } });
    expect(await screen.findByText('印と食傷が強い命式です。')).toBeInTheDocument();
    expect(screen.queryByText(/判定の要点を生成しています/)).not.toBeInTheDocument();
  });

  test('generated: rank comes from skill_sheet and text sits under each job', async () => {
    fortuneService.getSkillInsight.mockResolvedValue({ insight, available: true });
    render(<SkillReport calculationId={1} skillSheet={skillSheet} />);

    expect(await screen.findByText('印と食傷が強い命式です。')).toBeInTheDocument();
    const shogun = screen.getByText('将軍').closest('li');
    expect(shogun).toHaveTextContent('C+');
    expect(shogun).toHaveTextContent('少数精鋭のチームで力を発揮しやすくなります。');
    expect(screen.getByText('企画').closest('li')).toHaveTextContent('構想を描く力が最も高く出ています。');
    expect(screen.getByText('学んだことを形にすると活きます。')).toBeInTheDocument();
    expect(screen.getByText(/AIによる生成文です（gemini-test-model・2026年11月5日/)).toBeInTheDocument();
  });

  test('generated once: no regenerate or generate button is shown', async () => {
    fortuneService.getSkillInsight.mockResolvedValue({ insight, available: true });
    render(<SkillReport calculationId={1} skillSheet={skillSheet} />);

    expect(await screen.findByText('印と食傷が強い命式です。')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '再生成' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '判定の要点を生成' })).not.toBeInTheDocument();
    expect(fortuneService.generateSkillInsight).not.toHaveBeenCalled();
  });

  test('error: shows API message with ErrorMessage', async () => {
    fortuneService.getSkillInsight.mockResolvedValue({ insight: null, available: true });
    fortuneService.generateSkillInsight.mockRejectedValue({
      response: { status: 429, data: { detail: '本日の生成回数の上限に達しました' } },
    });
    render(<SkillReport calculationId={1} skillSheet={skillSheet} />);

    fireEvent.click(await screen.findByRole('button', { name: '判定の要点を生成' }));
    expect(await screen.findByText('本日の生成回数の上限に達しました')).toBeInTheDocument();
  });

  test('error without detail falls back to default message', async () => {
    fortuneService.getSkillInsight.mockResolvedValue({ insight: null, available: true });
    fortuneService.generateSkillInsight.mockRejectedValue(new Error('Network Error'));
    render(<SkillReport calculationId={1} skillSheet={skillSheet} />);

    fireEvent.click(await screen.findByRole('button', { name: '判定の要点を生成' }));
    expect(
      await screen.findByText('生成に失敗しました。時間をおいて再度お試しください')
    ).toBeInTheDocument();
  });

  test('shows reference notice when hour is unknown', async () => {
    fortuneService.getSkillInsight.mockResolvedValue({ insight: null, available: true });
    render(<SkillReport calculationId={1} skillSheet={{ ...skillSheet, is_reference: true }} />);
    expect(screen.getByText('時間不明のため参考値')).toBeInTheDocument();
    await screen.findByRole('button', { name: '判定の要点を生成' });
  });
});
