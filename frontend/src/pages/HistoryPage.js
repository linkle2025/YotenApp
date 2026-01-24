import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fortuneService } from '../services/fortuneService';
import './HistoryPage.css';

const HistoryPage = () => {
  const [calculations, setCalculations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  useEffect(() => {
    loadHistory();
  }, [showFavoritesOnly]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const data = await fortuneService.getHistory(showFavoritesOnly ? true : null);
      setCalculations(data.results || data);
    } catch (error) {
      console.error('履歴の取得に失敗しました:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('この履歴を削除しますか？')) {
      try {
        await fortuneService.deleteCalculation(id);
        loadHistory();
      } catch (error) {
        alert('削除に失敗しました。');
      }
    }
  };

  if (loading) {
    return <div className="history-container">読み込み中...</div>;
  }

  return (
    <div className="history-container">
      <div className="history-header">
        <h1>計算履歴</h1>
        <label className="filter-checkbox">
          <input
            type="checkbox"
            checked={showFavoritesOnly}
            onChange={(e) => setShowFavoritesOnly(e.target.checked)}
          />
          お気に入りのみ表示
        </label>
      </div>
      {calculations.length === 0 ? (
        <div className="no-history">履歴がありません</div>
      ) : (
        <div className="history-list">
          {calculations.map((calc) => (
            <div key={calc.id} className="history-item">
              <div className="history-info">
                {calc.name && (
                  <div className="history-name">
                    <strong>{calc.name}</strong>
                  </div>
                )}
                <div className="history-date">
                  {calc.birth_year}年{calc.birth_month}月{calc.birth_day}日{calc.birth_hour}時
                  {calc.prefecture && <span className="prefecture"> ({calc.prefecture})</span>}
                </div>
                <div className="history-pillars">
                  {calc.year_pillar_heavenly_stem}{calc.year_pillar_earthly_branch}年
                  {' '}
                  {calc.day_pillar_heavenly_stem}{calc.day_pillar_earthly_branch}日
                </div>
                {calc.is_favorite && <span className="favorite-badge">★</span>}
              </div>
              <div className="history-actions">
                <Link to={`/fortune/${calc.id}`} className="view-button">
                  詳細を見る
                </Link>
                <button
                  onClick={() => handleDelete(calc.id)}
                  className="delete-button"
                >
                  削除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default HistoryPage;

