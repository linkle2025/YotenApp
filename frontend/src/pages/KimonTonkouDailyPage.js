import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fortuneService } from '../services/fortuneService';
import KimonBoardDisplay from '../components/kimon/KimonBoardDisplay';
import KimonPillarsDisplay from '../components/kimon/KimonPillarsDisplay';
import '../pages/KimonTonkouPage.css';
import './KimonTonkouDailyPage.css';

const DAILY_HOURS = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22];

const KimonTonkouDailyPage = () => {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const date = searchParams.get('date');
  const prefecture = searchParams.get('prefecture');
  const yinYang = searchParams.get('yin_yang') || '';
  const kyokusu = searchParams.get('kyokusu') || '';

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState([]);

  useEffect(() => {
    if (!isAdmin()) {
      navigate('/');
    }
  }, [isAdmin, navigate]);

  useEffect(() => {
    if (!isAdmin()) return;

    if (!date || !prefecture) {
      setError('日付または場所（都市）が指定されていません。');
      return;
    }

    const [year, month, day] = date.split('-').map(Number);
    if (!year || !month || !day) {
      setError('日付の形式が正しくありません。');
      return;
    }

    const fetchDailyBoards = async () => {
      setLoading(true);
      setError('');
      setResults([]);

      try {
        const settled = await Promise.allSettled(
          DAILY_HOURS.map(async (hour) => {
            const requestData = {
              type: '時盤',
              year,
              month,
              day,
              hour,
              minute: 0,
              prefecture,
            };
            if (yinYang) requestData.yin_yang = yinYang;
            if (kyokusu) requestData.kyokusu = parseInt(kyokusu, 10);

            const result = await fortuneService.calculateKimonTonkou(requestData);
            return { hour, result };
          })
        );

        const failures = settled
          .map((item, index) => ({ item, hour: DAILY_HOURS[index] }))
          .filter(({ item }) => item.status === 'rejected');

        if (failures.length > 0) {
          const failedHours = failures.map(({ hour }) => `${hour}時`).join('、');
          throw new Error(`${failedHours}の時盤計算に失敗しました。`);
        }

        setResults(
          settled.map((item) => item.value).sort((a, b) => a.hour - b.hour)
        );
      } catch (err) {
        console.error('1日分時盤計算エラー:', err);
        setError(err.message || '1日分の時盤計算に失敗しました。');
      } finally {
        setLoading(false);
      }
    };

    fetchDailyBoards();
  }, [date, prefecture, yinYang, kyokusu, isAdmin]);

  if (!isAdmin()) {
    return null;
  }

  const [year, month, day] = date ? date.split('-').map(Number) : [];
  const pageTitle = year && month && day
    ? `${year}年${month}月${day}日 1日分の時盤`
    : '1日分の時盤';

  return (
    <div className="kimon-daily-container">
      <h1>{pageTitle}</h1>
      {prefecture && (
        <p className="kimon-daily-meta">場所（都市）：{prefecture}</p>
      )}

      {loading && (
        <p className="kimon-daily-loading">12件の時盤を計算中...</p>
      )}

      {error && (
        <div className="error-message">{error}</div>
      )}

      {!loading && !error && results.length > 0 && (
        <div className="kimon-daily-grid">
          {results.map(({ hour, result }) => (
            <div key={hour} className="kimon-daily-item">
              <h2 className="kimon-daily-hour">{hour}時</h2>
              <p className="result-datetime kimon-daily-datetime">
                作盤日時：{result.datetime_str}
                {result.natural_time_str && (
                  <span className="natural-time">
                    <br />自然時：{result.natural_time_str}
                  </span>
                )}
              </p>
              <KimonPillarsDisplay result={result} />
              {result.board && (
                <KimonBoardDisplay
                  board={result.board}
                  dayPillar={result.day_pillar}
                  hourPillar={result.hour_pillar}
                  showUsageTags={false}
                  showLegend={false}
                  compact
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default KimonTonkouDailyPage;
