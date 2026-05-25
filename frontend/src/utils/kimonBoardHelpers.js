import React from 'react';

/** 日柱・時柱の天干セット */
export const getHighlightStems = (dayPillar, hourPillar) => {
  const stems = new Set();
  if (dayPillar?.heavenly_stem) stems.add(dayPillar.heavenly_stem);
  if (hourPillar?.heavenly_stem) stems.add(hourPillar.heavenly_stem);
  return stems;
};

/** 八神の表示文言（陳・雀は別名付き） */
export const getHasshinDisplay = (hasshin) => {
  const map = {
    陳: '陳（白虎）',
    雀: '雀（玄武）',
  };
  return map[hasshin] || hasshin || '';
};

/** 八門の文字色用クラス */
export const getHachimonColorClass = (hachimon) => {
  const map = {
    休: 'hachimon-kyu',
    生: 'hachimon-do',
    死: 'hachimon-do',
    傷: 'hachimon-ryoku',
    杜: 'hachimon-ryoku',
    景: 'hachimon-kei',
    驚: 'hachimon-kai',
    開: 'hachimon-kai',
  };
  return map[hachimon] || '';
};

/** 天盤干のみ：日柱・時柱の天干と一致する字を赤色＋下線 */
export const renderTenbanKanWithHighlight = (text, highlightStems, className = '') => {
  if (!text) return null;
  return (
    <span className={className}>
      {Array.from(text).map((char, index) =>
        char !== '(' && char !== ')' && highlightStems.has(char) ? (
          <span key={index} className="tenban-stem-highlight">
            {char}
          </span>
        ) : (
          <span key={index}>{char}</span>
        )
      )}
    </span>
  );
};
