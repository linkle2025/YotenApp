import React from 'react';
import SkillSheet from './SkillSheet';
import Loading from './Loading';
import ErrorMessage from './ErrorMessage';
import { useSkillInsight } from '../hooks/useSkillInsight';
import { formatDateTime } from '../utils/dateFormat';
import './SkillReport.css';

/**
 * 鑑定スキル表 ＋ 判定の要点（LLM生成）をまとめて表示する
 * - 要約（または生成ボタン）→ 能力3×3 → 職種（ランク＋個別解説）→ 活かし方
 * - 生成は最初の1回のみ（再生成ボタンは当面非表示）
 * - 点数・ランクは skill_sheet の値。解説文だけを判定の要点から差し込む
 * - ページを開いたときはキャッシュを読むだけで、自動生成はしない（コスト対策）
 */
const SkillReport = ({ calculationId, skillSheet, showDebug = false }) => {
  const { insight, available, loaded, generating, error, generate } = useSkillInsight(calculationId);

  if (!skillSheet) return null;

  const renderTop = () => {
    if (generating) {
      return <Loading message="判定の要点を生成しています（30秒ほどかかります）..." />;
    }
    if (error) {
      return (
        <ErrorMessage message={error} onRetry={available ? () => generate(false) : undefined} />
      );
    }
    if (insight) {
      return <p className="skill-report-summary">{insight.summary}</p>;
    }
    if (!loaded) return null;
    if (!available) {
      return <p className="skill-report-unavailable">判定の要点（AIによる解説）は現在生成できません。</p>;
    }
    return (
      <div className="skill-report-cta">
        <p>点数・ランクの根拠を、AIが職種ごと・能力ごとに解説します。</p>
        <button type="button" className="skill-report-button" onClick={() => generate(false)}>
          判定の要点を生成
        </button>
      </div>
    );
  };

  return (
    <div className="skill-report">
      {skillSheet.is_reference && <p className="skill-report-reference">時間不明のため参考値</p>}

      <div className="skill-report-top">{renderTop()}</div>

      <SkillSheet skillSheet={skillSheet} insight={insight} showDebug={showDebug} />

      {insight?.advice && <p className="skill-report-advice">{insight.advice}</p>}

      <div className="skill-report-footer">
        <small>この表は命式の傾向を数値化した試作版です。能力を断定するものではありません。</small>
        {insight && (
          <span className="skill-report-ai">
            {/* 再生成は当面行わない（最初の1回のみ生成）。再開するときは generate(true) を呼ぶボタンを戻す */}
            <small>
              解説はAIによる生成文です（{insight.model_name}・{formatDateTime(insight.created_at)}）
            </small>
          </span>
        )}
      </div>
    </div>
  );
};

export default SkillReport;
