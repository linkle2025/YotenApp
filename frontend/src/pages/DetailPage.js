import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fortuneService } from '../services/fortuneService';
import { stemService } from '../services/stemService';
import { starService } from '../services/starService';
import StemModal from '../components/StemModal';
import StarModal from '../components/StarModal';
import SkillSheet from '../components/SkillSheet';
import './DetailPage.css';

// 五行バランス図の位置ごとの解説（位置のみで決まり、五行は考慮しない）
const POSITION_TOOLTIP_DATA = {
  'top': { positionName: '比劫星', relation: '自分', keywords: '信念、決断力、マイペース、わがまま、頑固' },
  'right': { positionName: '食傷星', relation: '子供', keywords: '表現（アウトプット）発想、専門技術、おしゃべり、自由' },
  'bottom-right': { positionName: '財星', relation: '妻（男）、部下', keywords: 'お金、財産、時間、気配り、コントロール' },
  'bottom-left': { positionName: '官星', relation: '夫（女）、目上、上司', keywords: '国、法律、ルール、役職、出世、地位、真面目、礼儀、忍耐' },
  'left': { positionName: '印星', relation: '親、助っ人', keywords: '学問、知識、語学、技術' },
};

const DetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [calculation, setCalculation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAllHiddenStems, setShowAllHiddenStems] = useState(false);
  const [stems, setStems] = useState([]);
  const [selectedStem, setSelectedStem] = useState(null);
  const [stars, setStars] = useState([]);
  const [selectedStar, setSelectedStar] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 767px)');
    const handler = () => setIsMobile(mql.matches);
    handler();
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    loadDetail();
    loadStems();
    loadStars();
  }, [id]);

  const loadStems = async () => {
    try {
      const data = await stemService.getAllStems();
      setStems(data);
    } catch (err) {
      console.error('十干データの取得に失敗しました:', err);
    }
  };

  const loadStars = async () => {
    try {
      const data = await starService.getAllStars();
      setStars(data);
    } catch (err) {
      console.error('通変星データの取得に失敗しました:', err);
    }
  };

  const handleStemClick = (stemName) => {
    const stem = stems.find(s => s.name === stemName);
    if (stem) {
      setSelectedStem(stem);
    }
  };

  const handleStarClick = (starName) => {
    const star = stars.find(s => s.name === starName);
    if (star) {
      setSelectedStar(star);
    }
  };

  const handleCloseStemModal = () => {
    setSelectedStem(null);
  };

  const handleCloseStarModal = () => {
    setSelectedStar(null);
  };

  // 天干から五行を取得
  const getHeavenlyStemElement = (stem) => {
    const elementMap = {
      '甲': 'wood', '乙': 'wood',
      '丙': 'fire', '丁': 'fire',
      '戊': 'earth', '己': 'earth',
      '庚': 'metal', '辛': 'metal',
      '壬': 'water', '癸': 'water',
    };
    return elementMap[stem] || '';
  };

  // 地支から五行を取得
  const getEarthlyBranchElement = (branch) => {
    const elementMap = {
      '子': 'water', '亥': 'water',
      '寅': 'wood', '卯': 'wood',
      '巳': 'fire', '午': 'fire',
      '申': 'metal', '酉': 'metal',
      '丑': 'earth', '辰': 'earth', '未': 'earth', '戌': 'earth',
    };
    return elementMap[branch] || '';
  };

  // 日干から画像ファイル名を取得
  const getStemImageName = (stem) => {
    const imageMap = {
      '甲': 'kinoe', '乙': 'kinoto',
      '丙': 'hinoe', '丁': 'hinoto',
      '戊': 'tutinoe', '己': 'tutinoto',
      '庚': 'kanoe', '辛': 'kanoto',
      '壬': 'mizunoe', '癸': 'mizunoto'
    };
    return imageMap[stem] || null;
  };

  // 日干を基準に五行を時計回りに並び替える
  const getOrderedElements = () => {
    if (!calculation) return [];

    // 日干の五行を取得
    const dayStemElement = getHeavenlyStemElement(calculation.day_pillar_heavenly_stem);
    
    // 五行の相生順（木→火→土→金→水）
    const elementOrder = ['wood', 'fire', 'earth', 'metal', 'water'];
    const elementNames = {
      'wood': '木',
      'fire': '火',
      'earth': '土',
      'metal': '金',
      'water': '水'
    };
    
    // 日干の五行のインデックスを取得
    const startIndex = elementOrder.indexOf(dayStemElement);
    
    // 日干の五行から時計回りに並び替え
    const orderedElements = [];
    for (let i = 0; i < 5; i++) {
      const index = (startIndex + i) % 5;
      orderedElements.push({
        element: elementOrder[index],
        name: elementNames[elementOrder[index]]
      });
    }
    
    return orderedElements;
  };

  // 五行バランスの左上点数を計算（自分の五行 + 左の五行）
  const calculateTopLeftScore = () => {
    if (!calculation || !calculation.five_elements_balance_data) return 0;
    
    const orderedElements = getOrderedElements();
    const scores = calculation.five_elements_balance_data.scores || {};
    
    // positions[0]: 上（自分の五行）
    // positions[4]: 左（偏印・印綬）
    const topElement = orderedElements[0]?.element;
    const leftElement = orderedElements[4]?.element;
    
    const topScore = scores[topElement] || 0;
    const leftScore = scores[leftElement] || 0;
    
    return topScore + leftScore;
  };

  // 五行バランスの右下点数を計算（右 + 下右 + 下左）
  const calculateBottomRightScore = () => {
    if (!calculation || !calculation.five_elements_balance_data) return 0;
    
    const orderedElements = getOrderedElements();
    const scores = calculation.five_elements_balance_data.scores || {};
    
    // positions[1]: 右（食傷星）
    // positions[2]: 下右（財星）
    // positions[3]: 下左（官星）
    const rightElement = orderedElements[1]?.element;
    const bottomRightElement = orderedElements[2]?.element;
    const bottomLeftElement = orderedElements[3]?.element;
    
    const rightScore = scores[rightElement] || 0;
    const bottomRightElementScore = scores[bottomRightElement] || 0;
    const bottomLeftElementScore = scores[bottomLeftElement] || 0;
    
    return rightScore + bottomRightElementScore + bottomLeftElementScore;
  };

  // 身旺・身弱を判定
  const getStrengthLabel = () => {
    const topLeftScore = calculateTopLeftScore();
    const bottomRightScore = calculateBottomRightScore();
    
    if (topLeftScore > bottomRightScore) {
      return '身旺';
    } else if (topLeftScore < bottomRightScore) {
      return '身弱';
    } else {
      return '-';
    }
  };

  // 指定された五行に属する天干を取得
  const getStemsForElement = (element) => {
    if (!calculation) return [];
    
    const stems = [];
    
    // 時間不明でない場合、時干も含める
    if (!calculation.hour_unknown && calculation.hour_pillar_heavenly_stem) {
      if (getHeavenlyStemElement(calculation.hour_pillar_heavenly_stem) === element) {
        stems.push(calculation.hour_pillar_heavenly_stem);
      }
    }
    
    // 日干
    if (calculation.day_pillar_heavenly_stem && getHeavenlyStemElement(calculation.day_pillar_heavenly_stem) === element) {
      stems.push(calculation.day_pillar_heavenly_stem);
    }
    
    // 月干
    if (calculation.month_pillar_heavenly_stem && getHeavenlyStemElement(calculation.month_pillar_heavenly_stem) === element) {
      stems.push(calculation.month_pillar_heavenly_stem);
    }
    
    // 年干
    if (calculation.year_pillar_heavenly_stem && getHeavenlyStemElement(calculation.year_pillar_heavenly_stem) === element) {
      stems.push(calculation.year_pillar_heavenly_stem);
    }
    
    return stems;
  };

  // 指定された五行に属する地支を取得（蔵干は除く）
  const getBranchesForElement = (element) => {
    if (!calculation) return [];
    
    const branches = [];
    
    // 時間不明でない場合、時支も含める
    if (!calculation.hour_unknown && calculation.hour_pillar_earthly_branch) {
      if (getEarthlyBranchElement(calculation.hour_pillar_earthly_branch) === element) {
        branches.push(calculation.hour_pillar_earthly_branch);
      }
    }
    
    // 日支
    if (calculation.day_pillar_earthly_branch && getEarthlyBranchElement(calculation.day_pillar_earthly_branch) === element) {
      branches.push(calculation.day_pillar_earthly_branch);
    }
    
    // 月支
    if (calculation.month_pillar_earthly_branch && getEarthlyBranchElement(calculation.month_pillar_earthly_branch) === element) {
      branches.push(calculation.month_pillar_earthly_branch);
    }
    
    // 年支
    if (calculation.year_pillar_earthly_branch && getEarthlyBranchElement(calculation.year_pillar_earthly_branch) === element) {
      branches.push(calculation.year_pillar_earthly_branch);
    }
    
    return branches;
  };

  // 干合の判定
  const checkKangou = (stem1, stem2) => {
    const kangouPairs = {
      '甲': '己',
      '己': '甲',
      '乙': '庚',
      '庚': '乙',
      '丙': '辛',
      '辛': '丙',
      '丁': '壬',
      '壬': '丁',
      '戊': '癸',
      '癸': '戊'
    };
    return kangouPairs[stem1] === stem2;
  };

  // 干合が成立している柱を取得
  const getKangouPillars = () => {
    if (!calculation) return [];

    const kangouList = [];
    
    // 時柱と日柱（時間不明でない場合のみ）
    if (!calculation.hour_unknown && 
        checkKangou(calculation.hour_pillar_heavenly_stem, calculation.day_pillar_heavenly_stem)) {
      kangouList.push({
        pillars: ['hour', 'day'],
        stem1: calculation.hour_pillar_heavenly_stem,
        stem2: calculation.day_pillar_heavenly_stem,
        label: '時柱と日柱'
      });
    }
    
    // 日柱と月柱
    if (checkKangou(calculation.day_pillar_heavenly_stem, calculation.month_pillar_heavenly_stem)) {
      kangouList.push({
        pillars: ['day', 'month'],
        stem1: calculation.day_pillar_heavenly_stem,
        stem2: calculation.month_pillar_heavenly_stem,
        label: '日柱と月柱'
      });
    }
    
    // 月柱と年柱
    if (checkKangou(calculation.month_pillar_heavenly_stem, calculation.year_pillar_heavenly_stem)) {
      kangouList.push({
        pillars: ['month', 'year'],
        stem1: calculation.month_pillar_heavenly_stem,
        stem2: calculation.year_pillar_heavenly_stem,
        label: '月柱と年柱'
      });
    }
    
    return kangouList;
  };

  // 特定の柱が干合に含まれているかチェック
  const hasKangou = (pillarName) => {
    const kangouList = getKangouPillars();
    return kangouList.some(k => k.pillars.includes(pillarName));
  };

  const loadDetail = async () => {
    try {
      setLoading(true);
      const data = await fortuneService.getDetail(id);
      setCalculation(data);
    } catch (err) {
      setError('詳細の取得に失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleFavorite = async () => {
    try {
      const result = await fortuneService.toggleFavorite(id);
      setCalculation({ ...calculation, is_favorite: result.is_favorite });
    } catch (error) {
      alert('お気に入りの更新に失敗しました。');
    }
  };

  if (loading) {
    return <div className="detail-container">読み込み中...</div>;
  }

  if (error || !calculation) {
    return <div className="detail-container">{error || 'データが見つかりません'}</div>;
  }

  const strengthLabel = getStrengthLabel();

  return (
    <div className="detail-container">
      <div className="detail-box">
        <h1>{calculation.name} さんの鑑定表</h1>
        <div className="detail-section">

        </div>
        
        <div className="pillars-and-elements-container">
          <div className="pillars-section">
            <div className="detail-section">
              <h2>
                {calculation.birth_year}年{calculation.birth_month}月{calculation.birth_day}日
                {calculation.hour_unknown ? '（時間不明）' : `${calculation.birth_hour}時`+`${calculation.birth_minute}分` } ({calculation.gender === 'male' ? '男性' : '女性'})　{calculation.prefecture}生まれ
              </h2>
              <div className="pillars-table">
                <table>
                  <thead>
                    <tr>
                      <th></th>
                      <th>時柱</th>
                      <th>日柱</th>
                  <th>月柱</th>
                  <th>年柱</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="row-label">天干</td>
                  <td className={calculation.hour_unknown ? '' : `element-${getHeavenlyStemElement(calculation.hour_pillar_heavenly_stem)} ${hasKangou('hour') ? 'kangou' : ''}`}>
                    {calculation.hour_unknown ? (
                      <div className="unknown-marker">ー</div>
                    ) : (
                      <div className="stem-with-star">
                        <div className="stem-main">{calculation.hour_pillar_heavenly_stem}</div>
                        <div 
                          className="stem-star" 
                          onClick={() => handleStarClick(calculation.hour_pillar_heavenly_stem_star)}
                          title="クリックして詳細を見る"
                        >
                          ({calculation.hour_pillar_heavenly_stem_star})
                        </div>
                      </div>
                    )}
                  </td>
                  <td className={`element-${getHeavenlyStemElement(calculation.day_pillar_heavenly_stem)} ${hasKangou('day') ? 'kangou' : ''}`}>
                    <div className="stem-with-star day-stem-container">
                      <div 
                        className="stem-main stem-clickable" 
                        onClick={() => handleStemClick(calculation.day_pillar_heavenly_stem)}
                        title="クリックして詳細を見る"
                      >
                        {calculation.day_pillar_heavenly_stem}
                      </div>
                      {/* 日干画像 */}
                      <img 
                        src={`/img/${getStemImageName(calculation.day_pillar_heavenly_stem)}.png`}
                        alt={calculation.day_pillar_heavenly_stem}
                        className="day-stem-image"
                        onClick={() => handleStemClick(calculation.day_pillar_heavenly_stem)}
                        title="クリックして詳細を見る"
                      />
                      <div className="stem-star"></div>
                    </div>
                  </td>
                  <td className={`element-${getHeavenlyStemElement(calculation.month_pillar_heavenly_stem)} ${hasKangou('month') ? 'kangou' : ''}`}>
                    <div className="stem-with-star">
                      <div className="stem-main">{calculation.month_pillar_heavenly_stem}</div>
                      <div 
                        className="stem-star" 
                        onClick={() => handleStarClick(calculation.month_pillar_heavenly_stem_star)}
                        title="クリックして詳細を見る"
                      >
                        ({calculation.month_pillar_heavenly_stem_star})
                      </div>
                    </div>
                  </td>
                  <td className={`element-${getHeavenlyStemElement(calculation.year_pillar_heavenly_stem)} ${hasKangou('year') ? 'kangou' : ''}`}>
                    <div className="stem-with-star">
                      <div className="stem-main">{calculation.year_pillar_heavenly_stem}</div>
                      <div 
                        className="stem-star" 
                        onClick={() => handleStarClick(calculation.year_pillar_heavenly_stem_star)}
                        title="クリックして詳細を見る"
                      >
                        ({calculation.year_pillar_heavenly_stem_star})
                      </div>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td className="row-label">地支</td>
                  <td className={calculation.hour_unknown ? '' : `element-${getEarthlyBranchElement(calculation.hour_pillar_earthly_branch)}`}>
                    {calculation.hour_unknown ? (
                      <div className="unknown-marker">ー</div>
                    ) : (
                      calculation.hour_pillar_earthly_branch
                    )}
                  </td>
                  <td className={`element-${getEarthlyBranchElement(calculation.day_pillar_earthly_branch)}`}>
                    {calculation.day_pillar_earthly_branch}
                  </td>
                  <td className={`element-${getEarthlyBranchElement(calculation.month_pillar_earthly_branch)}`}>
                    {calculation.month_pillar_earthly_branch}
                  </td>
                  <td className={`element-${getEarthlyBranchElement(calculation.year_pillar_earthly_branch)}`}>
                    {calculation.year_pillar_earthly_branch}
                  </td>
                </tr>
                <tr>
                  <td className="row-label">
                    蔵干
                    <div className="toggle-link">
                      <button 
                        onClick={() => setShowAllHiddenStems(!showAllHiddenStems)}
                        className="show-all-link"
                      >
                        {showAllHiddenStems ? 'ー' : '＋'}
                      </button>
                    </div>
                  </td>
                  <td>
                    {calculation.hour_unknown ? (
                      <div className="unknown-marker">ー</div>
                    ) : (
                      <div className="hidden-stem-cell">
                        <div className="stem-main">{calculation.hour_pillar_hidden_stem}</div>
                        {showAllHiddenStems && (
                          <div className="secondary-stems">
                            {calculation.hour_pillar_hidden_stem_tertiary && (
                              <div className="stem-detail">
                                中気: {calculation.hour_pillar_hidden_stem_tertiary}
                              </div>
                            )}
                            {calculation.hour_pillar_hidden_stem_secondary && (
                              <div className="stem-detail">
                                余気: {calculation.hour_pillar_hidden_stem_secondary}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                  <td>
                    <div className="hidden-stem-cell">
                      <div className="stem-main">{calculation.day_pillar_hidden_stem}</div>
                      {showAllHiddenStems && (
                        <div className="secondary-stems">
                          {calculation.day_pillar_hidden_stem_tertiary && (
                            <div className="stem-detail">
                              中気: {calculation.day_pillar_hidden_stem_tertiary}
                            </div>
                          )}
                          {calculation.day_pillar_hidden_stem_secondary && (
                            <div className="stem-detail">
                              余気: {calculation.day_pillar_hidden_stem_secondary}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="hidden-stem-cell">
                      <div className="stem-main">{calculation.month_pillar_hidden_stem}</div>
                      {showAllHiddenStems && (
                        <div className="secondary-stems">
                          {calculation.month_pillar_hidden_stem_tertiary && (
                            <div className="stem-detail">
                              中気: {calculation.month_pillar_hidden_stem_tertiary}
                            </div>
                          )}
                          {calculation.month_pillar_hidden_stem_secondary && (
                            <div className="stem-detail">
                              余気: {calculation.month_pillar_hidden_stem_secondary}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="hidden-stem-cell">
                      <div className="stem-main">{calculation.year_pillar_hidden_stem}</div>
                      {showAllHiddenStems && (
                        <div className="secondary-stems">
                          {calculation.year_pillar_hidden_stem_tertiary && (
                            <div className="stem-detail">
                              中気: {calculation.year_pillar_hidden_stem_tertiary}
                            </div>
                          )}
                          {calculation.year_pillar_hidden_stem_secondary && (
                            <div className="stem-detail">
                              余気: {calculation.year_pillar_hidden_stem_secondary}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
              </div>
              
              {/* 干合の表示 */}
              {getKangouPillars().length > 0 && (
                <div className="kangou-display">
                  {getKangouPillars().map((kangou, index) => (
                    <small key={index}>
                      {kangou.stem1}干と{kangou.stem2}干が干合成立（{kangou.label}）
                    </small>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          <div className="five-elements-section">
            <div className="detail-section">
              <h2>五行バランス</h2>
              <div className={`five-elements-container${strengthLabel === '身旺' ? ' strength-miou' : strengthLabel === '身弱' ? ' strength-mijaku' : ''}`}>
            <div className="five-elements-diagram">
              {/* 点数表示 */}
              <div className="score-display score-top-left">
                <div className="score-value">
                  {(() => {
                    const score = calculateTopLeftScore();
                    return score % 1 === 0 ? score.toFixed(0) : score.toFixed(1);
                  })()}
                </div>
                <div className="score-line"></div>
              </div>
              <div className="score-display score-top-right">
                <div className="score-value">
                  {(() => {
                    const score = calculateBottomRightScore();
                    return score % 1 === 0 ? score.toFixed(0) : score.toFixed(1);
                  })()}
                </div>
                <div className="score-line"></div>
              </div>
              
              {(() => {
                const orderedElements = getOrderedElements();
                const positions = ['top', 'right', 'bottom-right', 'bottom-left', 'left'];
                const balanceData = calculation.five_elements_balance_data || {};
                const scores = balanceData.scores || {};
                
                return orderedElements.map((elem, index) => {
                  const stems = getStemsForElement(elem.element);
                  const branches = getBranchesForElement(elem.element);
                  const posKey = positions[index];
                  const tipData = POSITION_TOOLTIP_DATA[posKey];
                  const isTooltipOpen = tooltipPosition === posKey;
                  
                  const handleClick = () => {
                    setTooltipPosition(isTooltipOpen ? null : posKey);
                  };
                  const handleKeyDown = (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleClick();
                    }
                  };
                  
                  return (
                    <div 
                      key={elem.element} 
                      className={`element-item balance-element-${posKey}`}
                      onMouseEnter={() => setTooltipPosition(posKey)}
                      onMouseLeave={() => setTooltipPosition(null)}
                      onClick={handleClick}
                      onKeyDown={handleKeyDown}
                      role="button"
                      tabIndex={0}
                      aria-expanded={isTooltipOpen}
                      aria-label={tipData ? `${tipData.positionName}の説明を${isTooltipOpen ? '閉じる' : '開く'}` : undefined}
                    >
                      {/* 上：天干 */}
                      <div className="element-stems">
                        {stems.length > 0 ? stems.join('') : '　'}
                      </div>
                      
                      <div className={`element-box ${elem.element}`}>
                        <div className="element-label">{elem.name}</div>
                        <div className="element-value">
                          {scores[elem.element] !== undefined 
                            ? (scores[elem.element] % 1 === 0 
                                ? scores[elem.element].toFixed(0) 
                                : scores[elem.element].toFixed(1))
                            : '0'}
                        </div>
                      </div>
                      
                      {/* 下：地支 */}
                      <div className="element-branches">
                        {branches.length > 0 ? branches.join('') : '　'}
                      </div>
                      
                      {isTooltipOpen && tipData && !isMobile && (
                        <div className={`position-tooltip position-tooltip-${posKey}`} role="tooltip">
                          <div className="position-tooltip-title">{tipData.positionName}</div>
                          <div className="position-tooltip-row"><span className="position-tooltip-label">人間関係:</span> {tipData.relation}</div>
                          <div className="position-tooltip-row"><span className="position-tooltip-label">キーワード:</span> {tipData.keywords}</div>
                        </div>
                      )}
                    </div>
                  );
                });
              })()}

              {/* 斜めの線（右上から左下） */}
              <div className="diagonal-line"></div>
            </div>

            <div className="five-elements-summary">
              {/* スマホのみ: 右下の合計点数を「格」の上に表示（左上は図内の元位置） */}
              <div className="score-row-mobile">
                <div className="score-row-item score-row-item-right">
                  <div className="score-value">
                    {(() => {
                      const score = calculateBottomRightScore();
                      return score % 1 === 0 ? score.toFixed(0) : score.toFixed(1);
                    })()}
                  </div>
                  <div className="score-line"></div>
                </div>
              </div>
              <div className="summary-item">
                <div className={`summary-label${strengthLabel === '身旺' || strengthLabel === '身弱' ? ' strength-label-red' : ''}`}>{strengthLabel}</div>
                <div className="summary-line"></div>
              </div>
              <div className="summary-item">
                <div className="summary-label">{calculation.kakukyoku || '-'}</div>
                <div className="summary-line"></div>
              </div>
            </div>
            {strengthLabel === '身旺' && (
              <div className="five-elements-explanation">
                <p>身旺：あなた自身の五行（比劫星）と、あなたに力を与える五行（印星）が強いです。よって五行バランスをとるには食傷星、財星を強めることが吉となります。逆に比劫星、印星が巡ってくる時期は凶となります。官星はあなたの五行を強める時もあれば弱める時もあるため、中立の扱いです。</p>
              </div>
            )}
            {strengthLabel === '身弱' && (
              <div className="five-elements-explanation">
                <p>身弱：あなた自身の五行（比劫星）と、あなたに力を与える五行（印星）が弱いです。よって五行バランスをとるには比劫星、印星を強めることが吉となります。逆に食傷星、財星が巡ってくる時期は凶となります。官星はあなたの五行を強める時もあれば弱める時もあるため、中立の扱いです。</p>
              </div>
            )}
            
            {/* デバッグ情報（管理者のみ） */}
            {isAdmin() && calculation.five_elements_balance_data?.debug_info && (
              <div className="balance-debug">
                <h3>計算デバッグ情報</h3>
                {calculation.five_elements_balance_data.debug_info.map((info, i) => (
                  <div key={i} className="debug-line">{info}</div>
                ))}
              </div>
            )}
              </div>
            </div>

            {/* 鑑定スキル表（全ユーザーに表示） */}
            <SkillSheet skillSheet={calculation.skill_sheet} showDebug={isAdmin()} />

            {/* 大運セクション（DEBUG=True のときのみ表示） */}
            {calculation.show_taiun_nenun && calculation.taiun_data && calculation.taiun_data.taiun_list && (
              <div className="detail-section taiun-section">
                <h2>大運</h2>
                <div className="taiun-info">
                  <p>順逆: {calculation.taiun_data.direction}</p>
                  <p>立運: {calculation.taiun_data.ritsuun}歳</p>
                </div>
                <div className="taiun-table-container">
                  <table className="taiun-table">
                    <thead>
                      <tr>
                        <th>期間</th>
                        <th>天干</th>
                        <th>地支</th>
                        <th>通変星</th>
                      </tr>
                    </thead>
                    <tbody>
                      {calculation.taiun_data.taiun_list.map((taiun, index) => (
                        <tr key={index}>
                          <td>{taiun.period}</td>
                          <td className={`element-${getHeavenlyStemElement(taiun.heavenly_stem)}`}>
                            {taiun.heavenly_stem}
                          </td>
                          <td className={`element-${getEarthlyBranchElement(taiun.earthly_branch)}`}>
                            {taiun.earthly_branch}
                          </td>
                          <td>{taiun.heavenly_stem_star || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                {/* デバッグ情報（管理者のみ） */}
                {isAdmin() && calculation.taiun_data?.debug_info && (
                  <div className="taiun-debug">
                    <h3>大運計算デバッグ情報</h3>
                    {calculation.taiun_data.debug_info.map((info, i) => (
                      <div key={i} className="debug-line">{info}</div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 年運セクション（DEBUG=True のときのみ表示） */}
            {calculation.show_taiun_nenun && calculation.nenun_data && calculation.nenun_data.length > 0 && (
              <div className="detail-section nenun-section">
                <h2>年運</h2>
                <p className="nenun-intro">各年の干支（立春基準）。デバッグ用表示です。</p>
                <div className="taiun-table-container">
                  <table className="taiun-table nenun-table">
                    <thead>
                      <tr>
                        <th>年</th>
                        <th>天干</th>
                        <th>地支</th>
                        <th>通変星</th>
                      </tr>
                    </thead>
                    <tbody>
                      {calculation.nenun_data.map((nenun, index) => (
                        <tr key={index}>
                          <td>{nenun.year}</td>
                          <td className={`element-${getHeavenlyStemElement(nenun.heavenly_stem)}`}>
                            {nenun.heavenly_stem}
                          </td>
                          <td className={`element-${getEarthlyBranchElement(nenun.earthly_branch)}`}>
                            {nenun.earthly_branch}
                          </td>
                          <td>{nenun.heavenly_stem_star || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="detail-actions">
          <button
            onClick={handleToggleFavorite}
            className={`favorite-button ${calculation.is_favorite ? 'active' : ''}`}
          >
            {calculation.is_favorite ? '★ お気に入り解除' : '☆ お気に入り登録'}
          </button>
          <button onClick={() => navigate('/history')} className="back-button">
            履歴に戻る
          </button>
        </div>
      </div>

      {selectedStem && (
        <StemModal stem={selectedStem} onClose={handleCloseStemModal} />
      )}
      
      {selectedStar && (
        <StarModal star={selectedStar} onClose={handleCloseStarModal} />
      )}

      {/* スマホ: 吹き出しをオーバーレイで画面中央に固定表示（ポータル） */}
      {tooltipPosition && isMobile && POSITION_TOOLTIP_DATA[tooltipPosition] && createPortal(
        <div
          className="tooltip-overlay-mobile"
          onClick={() => setTooltipPosition(null)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Escape') setTooltipPosition(null); }}
          aria-label="閉じる"
        >
          <div
            className="position-tooltip position-tooltip-mobile-fixed"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="tooltip-mobile-title"
          >
            <div id="tooltip-mobile-title" className="position-tooltip-title">
              {POSITION_TOOLTIP_DATA[tooltipPosition].positionName}
            </div>
            <div className="position-tooltip-row">
              <span className="position-tooltip-label">人間関係:</span>{' '}
              {POSITION_TOOLTIP_DATA[tooltipPosition].relation}
            </div>
            <div className="position-tooltip-row">
              <span className="position-tooltip-label">キーワード:</span>{' '}
              {POSITION_TOOLTIP_DATA[tooltipPosition].keywords}
            </div>
            <button
              type="button"
              className="tooltip-close-button"
              onClick={() => setTooltipPosition(null)}
              aria-label="閉じる"
            >
              閉じる
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default DetailPage;

