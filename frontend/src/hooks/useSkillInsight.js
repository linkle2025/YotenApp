import { useCallback, useEffect, useState } from 'react';
import { fortuneService } from '../services/fortuneService';

const DEFAULT_ERROR = '生成に失敗しました。時間をおいて再度お試しください';

/**
 * 判定の要点（LLM生成）の取得・生成
 * - 初回はキャッシュを読むだけで、自動生成はしない（コスト対策）
 * - generate(regenerate) で生成。regenerate=true はキャッシュを無視して再生成
 */
export const useSkillInsight = (calculationId) => {
  const [insight, setInsight] = useState(null);
  const [available, setAvailable] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!calculationId) return undefined;
    let cancelled = false;
    setLoaded(false);
    fortuneService
      .getSkillInsight(calculationId)
      .then((data) => {
        if (cancelled) return;
        setInsight(data.insight);
        setAvailable(data.available !== false);
      })
      .catch(() => {
        // キャッシュの取得に失敗しても、生成ボタンは使えるようにしておく
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [calculationId]);

  const generate = useCallback(
    async (regenerate = false) => {
      setGenerating(true);
      setError('');
      try {
        const data = await fortuneService.generateSkillInsight(calculationId, { regenerate });
        setInsight(data.insight);
      } catch (err) {
        setError(err?.response?.data?.detail || DEFAULT_ERROR);
      } finally {
        setGenerating(false);
      }
    },
    [calculationId]
  );

  return { insight, available, loaded, generating, error, generate };
};

export default useSkillInsight;
