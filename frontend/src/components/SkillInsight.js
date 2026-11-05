import React, { useCallback, useEffect, useState } from 'react';
import { fortuneService } from '../services/fortuneService';
import Loading from './Loading';
import ErrorMessage from './ErrorMessage';
import { formatDateTime } from '../utils/dateFormat';
import './SkillInsight.css';

const DEFAULT_ERROR = '生成に失敗しました。時間をおいて再度お試しください';

const errorMessageOf = (err) => err?.response?.data?.detail || DEFAULT_ERROR;

/**
 * 判定の要点（LLM生成）
 * - 点数・ランクは skillSheet（API の skill_sheet）の値を表示し、LLM の本文には含めない
 * - ページを開いたときはキャッシュを読むだけで、自動生成はしない（コスト対策）
 */
const SkillInsight = ({ calculationId, skillSheet }) => {
  const [insight, setInsight] = useState(null);
  const [available, setAvailable] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
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
    async (regenerate) => {
      setGenerating(true);
      setError('');
      try {
        const data = await fortuneService.generateSkillInsight(calculationId, { regenerate });
        setInsight(data.insight);
      } catch (err) {
        setError(errorMessageOf(err));
      } finally {
        setGenerating(false);
      }
    },
    [calculationId]
  );

  if (!skillSheet || !loaded) return null;

  const jobTexts = Object.fromEntries((insight?.jobs || []).map((j) => [j.key, j.text]));
  const abilityTexts = Object.fromEntries((insight?.abilities || []).map((a) => [a.key, a.text]));
  const abilitiesWithText = (skillSheet.abilities || []).filter((a) => abilityTexts[a.key]);

  return (
    <div className="detail-section skill-insight">
      <h2>判定の要点</h2>

      {generating && <Loading message="判定の要点を生成しています（30秒ほどかかります）..." />}

      {!generating && error && (
        <ErrorMessage message={error} onRetry={available ? () => generate(Boolean(insight)) : undefined} />
      )}

      {!generating && !insight && !error && (
        <div className="skill-insight-empty">
          {available ? (
            <>
              <p>鑑定スキル表の点数・ランクの根拠を、AIが文章で解説します。</p>
              <button type="button" className="skill-insight-button" onClick={() => generate(false)}>
                判定の要点を生成
              </button>
            </>
          ) : (
            <p className="skill-insight-unavailable">現在、判定の要点は生成できません。</p>
          )}
        </div>
      )}

      {!generating && insight && (
        <div className="skill-insight-body">
          <p className="skill-insight-summary">{insight.summary}</p>

          <ul className="skill-insight-jobs">
            {(skillSheet.jobs || []).map((job) =>
              jobTexts[job.key] ? (
                <li key={job.key}>
                  <span className="skill-insight-job-label">
                    {job.name}
                    <span className="skill-insight-rank">{job.rank}</span>：
                  </span>
                  {jobTexts[job.key]}
                </li>
              ) : null
            )}
          </ul>

          {abilitiesWithText.length > 0 && (
            <details className="skill-insight-abilities">
              <summary>能力ごとの解説</summary>
              <ul>
                {abilitiesWithText.map((ability) => (
                  <li key={ability.key}>
                    <span className="skill-insight-job-label">
                      {ability.name}
                      <span className="skill-insight-rank">{ability.score}</span>：
                    </span>
                    {abilityTexts[ability.key]}
                  </li>
                ))}
              </ul>
            </details>
          )}

          {insight.advice && <p className="skill-insight-advice">{insight.advice}</p>}

          <div className="skill-insight-footer">
            <small>
              AIによる生成文です（{insight.model_name}・{formatDateTime(insight.created_at)}）
            </small>
            {available && (
              <button type="button" className="skill-insight-regenerate" onClick={() => generate(true)}>
                再生成
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SkillInsight;
