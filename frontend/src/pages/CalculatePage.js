import React, { useState } from 'react';
import { fortuneService } from '../services/fortuneService';
import { useNavigate } from 'react-router-dom';
import { PREFECTURES } from '../utils/constants';
import './CalculatePage.css';

const CalculatePage = () => {
  const [name, setName] = useState('');
  const [birthYear, setBirthYear] = useState(1984);
  const [birthMonth, setBirthMonth] = useState(1);
  const [birthDay, setBirthDay] = useState(1);
  const [birthHour, setBirthHour] = useState(0);
  const [birthMinute, setBirthMinute] = useState(0);
  const [hourUnknown, setHourUnknown] = useState(false);
  const [prefecture, setPrefecture] = useState('東京');
  const [gender, setGender] = useState('male');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // 年の選択肢を生成（1901-2040年）
  const generateYears = () => {
    const years = [];
    for (let year = 2040; year >= 1901; year--) {
      years.push(year);
    }
    return years;
  };

  // 月の選択肢を生成（1-12月）
  const generateMonths = () => {
    return Array.from({ length: 12 }, (_, i) => i + 1);
  };

  // 日の選択肢を生成（1-31日）
  const generateDays = () => {
    return Array.from({ length: 31 }, (_, i) => i + 1);
  };

  // 時の選択肢を生成（0-23時）
  const generateHours = () => {
    return Array.from({ length: 24 }, (_, i) => i);
  };

  // 分の選択肢を生成（0-59分）
  const generateMinutes = () => {
    return Array.from({ length: 60 }, (_, i) => i);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await fortuneService.calculate(
        birthYear,
        birthMonth,
        birthDay,
        hourUnknown ? 0 : birthHour,
        prefecture,
        gender,
        name,
        hourUnknown ? 0 : birthMinute,
        hourUnknown
      );
      navigate(`/fortune/${result.id}`);
    } catch (err) {
      console.error('Calculate error:', err);
      const errorData = err.response?.data;
      
      if (errorData) {
        // エラーレスポンスがHTMLの場合（Djangoのデバッグページなど）
        if (typeof errorData === 'string') {
          // HTMLまたは長い文字列の場合は簡略化
          if (errorData.includes('<!DOCTYPE') || errorData.includes('<html')) {
            setError('サーバーエラーが発生しました。詳細はコンソールを確認してください。');
          } else {
            setError(errorData);
          }
        } else if (typeof errorData === 'object') {
          // JSONオブジェクトの場合
          let errorMessages = [];
          
          Object.entries(errorData).forEach(([key, value]) => {
            if (Array.isArray(value)) {
              errorMessages.push(...value);
            } else if (typeof value === 'string') {
              errorMessages.push(value);
            } else if (value !== null && value !== undefined) {
              errorMessages.push(String(value));
            }
          });
          
          setError(errorMessages.join('\n') || '計算に失敗しました。');
        } else {
          setError('計算に失敗しました。');
        }
      } else {
        setError('計算に失敗しました。サーバーとの接続を確認してください。');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="calculate-container">
      <div className="calculate-box">
        <h1>命式作成</h1>
        <h2>生年月日と生まれた時間を入力してください</h2>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>氏名（任意）</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="山田太郎"
              maxLength="100"
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <select
                value={birthYear}
                onChange={(e) => setBirthYear(parseInt(e.target.value))}
                required
              >
                {generateYears().map((year) => (
                  <option key={year} value={year}>
                    {year}年
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <select
                value={birthMonth}
                onChange={(e) => setBirthMonth(parseInt(e.target.value))}
                required
              >
                {generateMonths().map((month) => (
                  <option key={month} value={month}>
                    {month}月
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <select
                value={birthDay}
                onChange={(e) => setBirthDay(parseInt(e.target.value))}
                required
              >
                {generateDays().map((day) => (
                  <option key={day} value={day}>
                    {day}日
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={hourUnknown}
                onChange={(e) => setHourUnknown(e.target.checked)}
              />
              <span>時間不明</span>
            </label>
          </div>
          <div className="form-row">
            <div className="form-group">
              <select
                value={birthHour}
                onChange={(e) => setBirthHour(parseInt(e.target.value))}
                disabled={hourUnknown}
                required={!hourUnknown}
              >
                {generateHours().map((hour) => (
                  <option key={hour} value={hour}>
                    {hour}時
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <select
                value={birthMinute}
                onChange={(e) => setBirthMinute(parseInt(e.target.value))}
                disabled={hourUnknown}
                required={!hourUnknown}
              >
                {generateMinutes().map((minute) => (
                  <option key={minute} value={minute}>
                    {minute}分
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>生まれた都市</label>
            <select
              value={prefecture}
              onChange={(e) => setPrefecture(e.target.value)}
              required
            >
              {PREFECTURES.map((pref) => (
                <option key={pref} value={pref}>
                  {pref}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>性別</label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              required
            >
              <option value="male">男性</option>
              <option value="female">女性</option>
            </select>
          </div>
          <button type="submit" className="submit-button" disabled={loading}>
            {loading ? '計算中...' : '計算する'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CalculatePage;

