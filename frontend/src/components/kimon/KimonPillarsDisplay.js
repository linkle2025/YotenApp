import React from 'react';

/** 作盤結果の干支行（日柱・時柱の天干に下線・赤色） */
const KimonPillarsDisplay = ({ result }) => {
  const { year_pillar, month_pillar, day_pillar, hour_pillar, yin_yang, kyokusu, gobuuji } = result;

  const renderPillar = (pillar, suffix, underlineStem) => {
    if (!pillar) return null;
    const stem = pillar.heavenly_stem;
    const branch = pillar.earthly_branch;
    return (
      <>
        {underlineStem ? (
          <span className="pillar-stem-underline">{stem}</span>
        ) : (
          stem
        )}
        {branch}
        {suffix}
      </>
    );
  };

  return (
    <p className="result-pillars">
      干支：
      {renderPillar(year_pillar, '年', false)}
      　{renderPillar(month_pillar, '月', false)}
      　{renderPillar(day_pillar, '日', true)}
      {hour_pillar && (
        <>
          　{renderPillar(hour_pillar, '時', true)}
        </>
      )}
      　{yin_yang}
      {kyokusu}局
      {gobuuji && <span className="gobuuji-mark">【五不遇時】</span>}
    </p>
  );
};

export default KimonPillarsDisplay;
