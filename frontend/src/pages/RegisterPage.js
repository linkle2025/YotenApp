import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PREFECTURES } from '../utils/constants';
import './LoginPage.css';

const RegisterPage = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [birthYear, setBirthYear] = useState(1984);
  const [birthMonth, setBirthMonth] = useState(1);
  const [birthDay, setBirthDay] = useState(1);
  const [birthHour, setBirthHour] = useState(0);
  const [birthMinute, setBirthMinute] = useState(0);
  const [hourUnknown, setHourUnknown] = useState(false);
  const [prefecture, setPrefecture] = useState('東京');
  const [residencePrefecture, setResidencePrefecture] = useState('東京');
  const [displayMode, setDisplayMode] = useState('business');
  const [error, setError] = useState('');
  const { register } = useAuth();
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
    setError('');

    if (password !== password2) {
      setError('パスワードが一致しません。');
      return;
    }

    try {
      await register(
        username, 
        email, 
        password, 
        password2,
        {
          birthYear,
          birthMonth,
          birthDay,
          birthHour,
          birthMinute,
          hourUnknown,
          prefecture,
          residencePrefecture,
          displayMode,
        }
      );
      navigate('/');
    } catch (err) {
      const errorData = err.response?.data;
      if (errorData) {
        const errorMessages = Object.values(errorData).flat().join(', ');
        setError(errorMessages || '登録に失敗しました。');
      } else {
        setError('登録に失敗しました。');
      }
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h1>ユーザー登録</h1>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>ユーザー名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>メールアドレス</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>パスワード</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>パスワード（確認）</label>
            <input
              type="password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              required
            />
          </div>
          
          <h2 style={{ marginTop: '2rem', marginBottom: '1rem' }}>生年月日・時間</h2>
          
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <select
                value={birthYear}
                onChange={(e) => setBirthYear(parseInt(e.target.value))}
              >
                {generateYears().map((year) => (
                  <option key={year} value={year}>
                    {year}年
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <select
                value={birthMonth}
                onChange={(e) => setBirthMonth(parseInt(e.target.value))}
              >
                {generateMonths().map((month) => (
                  <option key={month} value={month}>
                    {month}月
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <select
                value={birthDay}
                onChange={(e) => setBirthDay(parseInt(e.target.value))}
              >
                {generateDays().map((day) => (
                  <option key={day} value={day}>
                    {day}日
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <select
                value={birthHour}
                onChange={(e) => setBirthHour(parseInt(e.target.value))}
                disabled={hourUnknown}
              >
                {generateHours().map((hour) => (
                  <option key={hour} value={hour}>
                    {hour}時
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <select
                value={birthMinute}
                onChange={(e) => setBirthMinute(parseInt(e.target.value))}
                disabled={hourUnknown}
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
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="checkbox"
                checked={hourUnknown}
                onChange={(e) => setHourUnknown(e.target.checked)}
              />
              時間不明
            </label>
          </div>
          
          <div className="form-group">
            <label>生まれた都市</label>
            <select
              value={prefecture}
              onChange={(e) => setPrefecture(e.target.value)}
            >
              {PREFECTURES.map((pref) => (
                <option key={pref} value={pref}>
                  {pref}
                </option>
              ))}
            </select>
          </div>
          
          <div className="form-group">
            <label>お住いの都市</label>
            <select
              value={residencePrefecture}
              onChange={(e) => setResidencePrefecture(e.target.value)}
            >
              {PREFECTURES.map((pref) => (
                <option key={pref} value={pref}>
                  {pref}
                </option>
              ))}
            </select>
          </div>
          
          <div className="form-group">
            <label>表示モード</label>
            <select
              value={displayMode}
              onChange={(e) => setDisplayMode(e.target.value)}
            >
              <option value="business">経営者向け</option>
              <option value="parent">保護者向け</option>
            </select>
          </div>
          
          <button type="submit" className="submit-button">登録</button>
        </form>
        <p className="register-link">
          既にアカウントをお持ちの方は <Link to="/login">こちら</Link>
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;

