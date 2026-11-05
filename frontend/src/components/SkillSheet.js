import React from 'react';
import './SkillSheet.css';

// ランク → 色分け用クラス（S / A系 / B系 / C系 / D）
const rankClass = (rank) => {
  if (!rank) return '';
  return `skill-rank-${rank.charAt(0).toLowerCase()}`;
};

const formatNumber = (value) => {
  if (typeof value !== 'number') return value;
  return value % 1 === 0 ? value.toFixed(0) : value.toFixed(1);
};

// 点数の高い順（同点は API の表示順を保つ）。職種はランクが点数から決まるため、S から降順になる
const byScoreDesc = (items) =>
  items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => b.item.score - a.item.score || a.index - b.index)
    .map(({ item }) => item);

const textsByKey = (items) => Object.fromEntries((items || []).map((item) => [item.key, item.text]));

/**
 * 鑑定スキル表（現代ビジネス版）
 * - 能力9項目を3×3（点数の高い順）、その下に職種7項目を「職種名（意味）ランク」＋個別解説（S から降順）
 * - 文言・点数・ランクはすべて API の skill_sheet の値。解説文は判定の要点（insight）の値
 */
const SkillSheet = ({ skillSheet, insight = null, showDebug = false }) => {
  if (!skillSheet) return null;

  const { strength, inputs } = skillSheet;
  const abilities = byScoreDesc(skillSheet.abilities || []);
  const jobs = byScoreDesc(skillSheet.jobs || []);
  const jobTexts = textsByKey(insight?.jobs);
  const abilityTexts = textsByKey(insight?.abilities);

  return (
    <div className="skill-sheet">
      <ul className="skill-ability-grid" aria-label="能力">
        {abilities.map((ability) => (
          <li key={ability.key} className="skill-ability-cell">
            <div className="skill-ability-head">
              <span className="skill-name">{ability.name}</span>
              <span className="skill-ability-score">{ability.score}</span>
            </div>
            <div
              className="skill-bar"
              role="meter"
              aria-label={`${ability.name} ${ability.score}点`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={ability.score}
            >
              <div
                className="skill-bar-fill"
                style={{ width: `${Math.max(0, Math.min(100, ability.score))}%` }}
              />
            </div>
            <div className="skill-meaning">{ability.meaning}</div>
            {abilityTexts[ability.key] && (
              <p className="skill-ability-text">{abilityTexts[ability.key]}</p>
            )}
          </li>
        ))}
      </ul>

      <ul className="skill-job-list" aria-label="職種適性">
        {jobs.map((job) => (
          <li key={job.key} className="skill-job-item">
            <div className="skill-job-head">
              <span className="skill-job-title">
                <span className="skill-name">{job.name}</span>
                <span className="skill-job-meaning">（{job.meaning}）</span>
              </span>
              <span className={`skill-rank ${rankClass(job.rank)}`}>{job.rank}</span>
            </div>
            {jobTexts[job.key] && <p className="skill-job-text">{jobTexts[job.key]}</p>}
          </li>
        ))}
      </ul>

      {showDebug && inputs && (
        <details className="balance-debug skill-sheet-debug">
          <summary>計算デバッグ情報（鑑定スキル表）</summary>
          <div className="debug-line">バージョン: {skillSheet.version}</div>
          {strength && (
            <div className="debug-line">
              身旺度 D: {formatNumber(strength.diff)} → {strength.label}
            </div>
          )}
          <div className="debug-line">
            五行グループ E:{' '}
            {Object.entries(inputs.element_groups || {})
              .map(([k, v]) => `${k}${formatNumber(v)}`)
              .join(' / ')}
          </div>
          <div className="debug-line">
            通変星点数 P:{' '}
            {Object.entries(inputs.star_points || {})
              .map(([k, v]) => `${k}${formatNumber(v)}`)
              .join(' / ')}
          </div>
          <div className="debug-line">
            職種点数: {jobs.map((j) => `${j.name}${j.score}`).join(' / ')}
          </div>
        </details>
      )}
    </div>
  );
};

export default SkillSheet;
