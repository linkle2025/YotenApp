import React from 'react';
import './SkillSheet.css';

// ランク → 色分け用クラス（S / A系 / B系 / C系 / D）
const rankClass = (rank) => {
  if (!rank) return '';
  const head = rank.charAt(0).toLowerCase();
  return `skill-rank-${head}`;
};

const formatNumber = (value) => {
  if (typeof value !== 'number') return value;
  return value % 1 === 0 ? value.toFixed(0) : value.toFixed(1);
};

/**
 * 鑑定スキル表（現代ビジネス版）
 * 文言・点数はすべて API の skill_sheet の値を表示する（ハードコードしない）
 */
const SkillSheet = ({ skillSheet, showDebug = false }) => {
  if (!skillSheet) return null;

  const {
    is_reference: isReference,
    strength,
    kakukyoku,
    abilities = [],
    jobs = [],
    inputs,
    day_stem: dayStem,
    day_stem_type: dayStemType,
  } = skillSheet;

  const subtitleParts = [];
  if (dayStem) {
    subtitleParts.push(`日干：${dayStem}${dayStemType ? `（${dayStemType}）` : ''}`);
  }
  if (strength?.label) subtitleParts.push(strength.label);
  if (kakukyoku) subtitleParts.push(kakukyoku);

  return (
    <div className="detail-section skill-sheet">
      <h2>鑑定スキル表（現代ビジネス版）</h2>
      {subtitleParts.length > 0 && (
        <p className="skill-sheet-subtitle">{subtitleParts.join('／')}</p>
      )}
      {isReference && (
        <p className="skill-sheet-reference">時間不明のため参考値</p>
      )}

      <div className="skill-sheet-grid">
        <div className="skill-sheet-card">
          <h3>能力</h3>
          <ul className="skill-ability-list">
            {abilities.map((ability) => (
              <li key={ability.key} className="skill-ability-item">
                <div className="skill-ability-head">
                  <span className="skill-name">{ability.name}</span>
                  <span className="skill-ability-score">{ability.score}</span>
                </div>
                <div className="skill-meaning">{ability.meaning}</div>
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
              </li>
            ))}
          </ul>
        </div>

        <div className="skill-sheet-card">
          <h3>職種適性</h3>
          <ul className="skill-job-list">
            {jobs.map((job) => (
              <li key={job.key} className="skill-job-item">
                <div className="skill-job-text">
                  <span className="skill-name">{job.name}</span>
                  <span className="skill-meaning">{job.meaning}</span>
                </div>
                <span className={`skill-rank ${rankClass(job.rank)}`}>{job.rank}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="skill-sheet-note">
        この表は命式の傾向を数値化した試作版です。能力を断定するものではありません。
      </p>

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
            職種点数:{' '}
            {jobs.map((j) => `${j.name}${j.score}`).join(' / ')}
          </div>
        </details>
      )}
    </div>
  );
};

export default SkillSheet;
