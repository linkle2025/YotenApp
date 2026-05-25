import React, { useState, useEffect } from 'react';
import BaguaSymbolismPopup from '../BaguaSymbolismPopup';
import KimonUsageGuidePopup from '../KimonUsageGuidePopup';
import {
  KIMON_BAGUA_BY_POSITION,
  BAGUA_POPUP_PLACEMENT,
} from '../../data/kimonBaguaSymbolism';
import {
  KIMON_USAGE_GUIDES,
  KIMON_USAGE_TAGS,
} from '../../data/kimonUsageGuide';
import {
  getHighlightStems,
  getHasshinDisplay,
  getHachimonColorClass,
  renderTenbanKanWithHighlight,
} from '../../utils/kimonBoardHelpers';

const KimonBoardDisplay = ({
  board,
  dayPillar,
  hourPillar,
  showUsageTags = true,
  showLegend = true,
  compact = false,
}) => {
  const [activeBaguaPosition, setActiveBaguaPosition] = useState(null);
  const [activeUsageGuideId, setActiveUsageGuideId] = useState(null);
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(hover: none)');
    const update = () => setIsTouchDevice(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!activeBaguaPosition && !activeUsageGuideId) return undefined;
    const onKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      if (activeUsageGuideId) setActiveUsageGuideId(null);
      else setActiveBaguaPosition(null);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [activeBaguaPosition, activeUsageGuideId]);

  if (!board || !board.palaces) {
    return null;
  }

  const highlightStems = getHighlightStems(dayPillar, hourPillar);
  const sortedPalaces = [...board.palaces].sort((a, b) => a.position - b.position);

  const renderJibanKan = (palace) => {
    if (!palace.jiban_kan) return null;
    const text =
      board.junshu_jiban_pos && palace.position === board.junshu_jiban_pos
        ? `(${palace.jiban_kan})`
        : palace.jiban_kan;
    return <span className="board-jiban-kan">{text}</span>;
  };

  const renderTenbanKan = (palace) => {
    if (!palace.tenban_kan) return null;

    if (Array.isArray(palace.tenban_kan)) {
      const [first, second] = palace.tenban_kan;
      const firstText =
        board.junshu_tenban_pos && palace.position === board.junshu_tenban_pos
          ? `(${first})`
          : first;
      return (
        <span className="board-tenban-kan">
          {renderTenbanKanWithHighlight(firstText, highlightStems)}
          {renderTenbanKanWithHighlight(second, highlightStems)}
        </span>
      );
    }

    const text =
      board.junshu_tenban_pos && palace.position === board.junshu_tenban_pos
        ? `(${palace.tenban_kan})`
        : palace.tenban_kan;
    return renderTenbanKanWithHighlight(text, highlightStems, 'board-tenban-kan');
  };

  const gridOrder = [4, 9, 2, 3, 5, 7, 8, 1, 6];
  const orderedPalaces = gridOrder.map((pos) =>
    sortedPalaces.find((p) => p.position === pos)
  );

  const gridClassName = compact ? 'board-grid board-grid--compact' : 'board-grid';

  return (
    <>
      <div className="board-container">
        <div className={gridClassName}>
          {orderedPalaces.map((palace, index) => {
            const cellPos = palace?.position ?? gridOrder[index];
            if (!palace) {
              return (
                <div
                  key={index}
                  className={`board-cell board-cell-pos-${cellPos}`}
                />
              );
            }

            const isCenter = palace.position === 5;
            const isBaguaActive = activeBaguaPosition === palace.position;
            const baguaData = KIMON_BAGUA_BY_POSITION[palace.position];

            return (
              <div
                key={palace.position}
                className={[
                  `board-cell board-cell-pos-${palace.position}`,
                  !isCenter && 'board-cell-interactive',
                  isBaguaActive && 'board-cell-active',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onMouseEnter={() => {
                  if (!isCenter && !isTouchDevice) {
                    setActiveBaguaPosition(palace.position);
                  }
                }}
                onMouseLeave={() => {
                  if (!isTouchDevice) {
                    setActiveBaguaPosition(null);
                  }
                }}
                onClick={() => {
                  if (!isCenter && isTouchDevice) {
                    setActiveBaguaPosition((prev) =>
                      prev === palace.position ? null : palace.position
                    );
                  }
                }}
                role={!isCenter ? 'button' : undefined}
                tabIndex={!isCenter ? 0 : undefined}
                onKeyDown={(e) => {
                  if (!isCenter && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    setActiveBaguaPosition((prev) =>
                      prev === palace.position ? null : palace.position
                    );
                  }
                }}
                aria-label={
                  !isCenter && baguaData
                    ? `${baguaData.title}の象意を表示`
                    : undefined
                }
              >
                {!isCenter && (
                  <span className="board-cell-hint" aria-hidden="true">
                    i
                  </span>
                )}
                <div className="board-cell-content">
                  <div className="board-cell-row board-cell-row-top">
                    {renderTenbanKan(palace)}
                    {palace.chugan && (
                      <span className="board-chugan">{palace.chugan}</span>
                    )}
                    <span className="board-kyusei">{palace.kyusei || ''}</span>
                  </div>
                  <div className="board-cell-row board-cell-row-center">
                    <span
                      className={[
                        'board-hachimon',
                        getHachimonColorClass(palace.hachimon),
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      {palace.hachimon || ''}
                    </span>
                  </div>
                  <div className="board-cell-row board-cell-row-bottom">
                    {renderJibanKan(palace)}
                    <span className="board-hasshin">
                      {getHasshinDisplay(palace.hasshin)}
                    </span>
                  </div>
                  {palace.kyokaku && palace.kyokaku.length > 0 && (
                    <div className="board-kyokaku">
                      {palace.kyokaku.map((kyokaku, idx) => (
                        <span key={idx} className="kyokaku-item">{kyokaku}</span>
                      ))}
                    </div>
                  )}
                  {palace.score !== undefined && palace.score !== null && (
                    <div className="board-score-overlay">{palace.score}点</div>
                  )}
                </div>
                {!isCenter && isBaguaActive && baguaData && !isTouchDevice && (
                  <BaguaSymbolismPopup
                    data={baguaData}
                    placement={BAGUA_POPUP_PLACEMENT[palace.position]}
                    variant="inline"
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
      {isTouchDevice && activeBaguaPosition && KIMON_BAGUA_BY_POSITION[activeBaguaPosition] && (
        <BaguaSymbolismPopup
          data={KIMON_BAGUA_BY_POSITION[activeBaguaPosition]}
          variant="modal"
          onClose={() => setActiveBaguaPosition(null)}
        />
      )}
      {showUsageTags && (
        <>
          <p className="kimon-board-usage-tags">
            {KIMON_USAGE_TAGS.map((tag, index) => (
              <React.Fragment key={tag.id}>
                {index > 0 && '　'}
                <button
                  type="button"
                  className="kimon-usage-tag-btn"
                  onClick={() => setActiveUsageGuideId(tag.id)}
                  aria-haspopup="dialog"
                >
                  {tag.label}
                </button>
              </React.Fragment>
            ))}
          </p>
          {activeUsageGuideId && (
            <KimonUsageGuidePopup
              guide={KIMON_USAGE_GUIDES[activeUsageGuideId]}
              onClose={() => setActiveUsageGuideId(null)}
            />
          )}
        </>
      )}
      {showLegend && (
        <aside className="kimon-board-legend" aria-label="八門・格局の参考">
          <p>
            休：愛情、休息、安定 　　生：財、積極性 　　開：仕事、オープン
          </p>
          <p>
            傷：怪我、ギャンブル　 杜：隠れる、閉じる　 景：祝事、文書、華やか　 死：停止 　驚：トラブル、想定外
          </p>
          <p className="kimon-board-legend-doors">傷 杜 景 死 驚</p>
          <p>風遁：放送・広報・宣伝活動に効果があることを実証済み</p>
          <p>玉女守門：：人間関係、男女の和合、試験にも効果ありを確認。</p>
          <p>勾陳＝白虎：出血、車、交通事故</p>
          <p>朱雀＝玄武：腹黒い、嘘、騙す、口喧嘩、お金に関する悪いこと</p>
        </aside>
      )}
    </>
  );
};

export default KimonBoardDisplay;
