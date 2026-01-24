import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/authService';
import { fortuneService } from '../services/fortuneService';
import { PREFECTURES } from '../utils/constants';
import './MyPage.css';

const MyPage = () => {
  const { user, updateDisplayMode, loadUser } = useAuth();
  const navigate = useNavigate();
  
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
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

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

  useEffect(() => {
    if (user) {
      setUsername(user.username || '');
      setEmail(user.email || '');
      setDisplayMode(user.profile?.display_mode || 'business');
      setBirthYear(user.profile?.birth_year || 1984);
      setBirthMonth(user.profile?.birth_month || 1);
      setBirthDay(user.profile?.birth_day || 1);
      setBirthHour(user.profile?.birth_hour || 0);
      setBirthMinute(user.profile?.birth_minute || 0);
      setHourUnknown(user.profile?.hour_unknown || false);
      setPrefecture(user.profile?.prefecture || '東京');
      setResidencePrefecture(user.profile?.residence_prefecture || '東京');
    }
  }, [user]);

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    try {
      await authService.updateUser({
        username,
        email,
        profile: {
          birth_year: birthYear,
          birth_month: birthMonth,
          birth_day: birthDay,
          birth_hour: hourUnknown ? null : birthHour,
          birth_minute: hourUnknown ? null : birthMinute,
          hour_unknown: hourUnknown,
          prefecture: prefecture || null,
          residence_prefecture: residencePrefecture || null,
        }
      });
      await loadUser();
      setMessage('ユーザー情報を更新しました。');
    } catch (err) {
      const errorData = err.response?.data;
      if (errorData?.username) {
        setError(errorData.username[0]);
      } else if (errorData?.email) {
        setError(errorData.email[0]);
      } else if (errorData?.profile) {
        const profileErrors = Object.values(errorData.profile).flat();
        setError(profileErrors.join(', ') || 'ユーザー情報の更新に失敗しました。');
      } else {
        setError('ユーザー情報の更新に失敗しました。');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    if (password !== password2) {
      setError('パスワードが一致しません。');
      setLoading(false);
      return;
    }

    try {
      await authService.changePassword(password, password2);
      setMessage('パスワードを変更しました。');
      setPassword('');
      setPassword2('');
    } catch (err) {
      setError(err.response?.data?.password?.[0] || err.response?.data?.password2?.[0] || 'パスワードの変更に失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  const handleDisplayModeChange = async (e) => {
    const newMode = e.target.value;
    setLoading(true);
    setMessage('');
    setError('');

    try {
      await updateDisplayMode(newMode);
      setDisplayMode(newMode);
      setMessage('表示モードを変更しました。');
    } catch (err) {
      setError('表示モードの変更に失敗しました。');
      setDisplayMode(displayMode); // 元に戻す
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivate = async () => {
    if (!window.confirm('本当に退会しますか？この操作は取り消せません。')) {
      return;
    }

    if (!window.confirm('再度確認します。本当に退会しますか？')) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      await authService.deactivateAccount();
      authService.logout();
      navigate('/login');
      alert('退会処理が完了しました。');
    } catch (err) {
      setError('退会処理に失敗しました。');
      setLoading(false);
    }
  };

  const handleShowMyFortune = async () => {
    if (!user?.profile) {
      setError('生年月日情報が登録されていません。');
      return;
    }

    const profile = user.profile;
    
    // 生年月日が登録されているかチェック
    if (!profile.birth_year || !profile.birth_month || !profile.birth_day) {
      setError('生年月日が登録されていません。ユーザー情報を更新してください。');
      return;
    }

    setLoading(true);
    setMessage('');
    setError('');

    try {
      // 履歴一覧を取得して、同じ生年月日のデータを探す
      const history = await fortuneService.getHistory();
      const calculations = history.results || history;
      
      // 同じ生年月日・都道府県のデータを探す
      const existingCalculation = calculations.find(calc => 
        calc.birth_year === profile.birth_year &&
        calc.birth_month === profile.birth_month &&
        calc.birth_day === profile.birth_day &&
        calc.prefecture === profile.prefecture &&
        calc.hour_unknown === profile.hour_unknown &&
        (profile.hour_unknown || (calc.birth_hour === profile.birth_hour && calc.birth_minute === (profile.birth_minute || 0)))
      );

      if (existingCalculation) {
        // 既存のデータがある場合はそのIDで表示
        navigate(`/fortune/${existingCalculation.id}`);
      } else {
        // 新規作成
        const calculation = await fortuneService.calculate(
          profile.birth_year,
          profile.birth_month,
          profile.birth_day,
          profile.hour_unknown ? 0 : (profile.birth_hour || 0),
          profile.prefecture || '東京',
          'male', // デフォルトで男性（後でユーザープロフィールに追加可能）
          user.username, // 氏名はユーザー名を使用
          profile.birth_minute || 0,
          profile.hour_unknown || false
        );
        navigate(`/fortune/${calculation.id}`);
      }
    } catch (err) {
      setError(err.response?.data?.non_field_errors?.[0] || err.response?.data?.birth_year?.[0] || '命式の表示に失敗しました。');
      setLoading(false);
    }
  };

  if (!user) {
    return <div className="mypage-container">ログインが必要です。</div>;
  }

  return (
    <div className="mypage-container">
      <h1>マイページ</h1>
      
      {message && <div className="message">{message}</div>}
      {error && <div className="error">{error}</div>}

      {/* 自分の命式を表示 */}
      <section className="mypage-section my-fortune-section">
        <h2>自分の命式</h2>
        <p className="my-fortune-description">
          アカウントに登録されている生年月日・時間・都道府県を元に命式を表示します。
        </p>
        <button
          onClick={handleShowMyFortune}
          disabled={loading || !user?.profile?.birth_year}
          className="my-fortune-button"
        >
          自分の命式を表示
        </button>
        {!user?.profile?.birth_year && (
          <p className="my-fortune-warning">
            生年月日が登録されていません。ユーザー情報を更新してください。
          </p>
        )}
      </section>

      {/* ユーザー情報編集 */}
      <section className="mypage-section">
        <h2>ユーザー情報</h2>
        <form onSubmit={handleUpdateUser}>
          <div className="form-group">
            <label htmlFor="username">登録名</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          <div className="form-group">
            <label htmlFor="email">メールアドレス</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          
          <h3 style={{ marginTop: '2rem', marginBottom: '1rem' }}>生年月日・時間</h3>
          
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label>生年</label>
              <select
                value={birthYear}
                onChange={(e) => setBirthYear(parseInt(e.target.value))}
                disabled={loading}
              >
                {generateYears().map((year) => (
                  <option key={year} value={year}>
                    {year}年
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>生月</label>
              <select
                value={birthMonth}
                onChange={(e) => setBirthMonth(parseInt(e.target.value))}
                disabled={loading}
              >
                {generateMonths().map((month) => (
                  <option key={month} value={month}>
                    {month}月
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>生日</label>
              <select
                value={birthDay}
                onChange={(e) => setBirthDay(parseInt(e.target.value))}
                disabled={loading}
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
              <label>生時</label>
              <select
                value={birthHour}
                onChange={(e) => setBirthHour(parseInt(e.target.value))}
                disabled={loading || hourUnknown}
              >
                {generateHours().map((hour) => (
                  <option key={hour} value={hour}>
                    {hour}時
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>生分</label>
              <select
                value={birthMinute}
                onChange={(e) => setBirthMinute(parseInt(e.target.value))}
                disabled={loading || hourUnknown}
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
                disabled={loading}
              />
              時間不明
            </label>
          </div>
          
          <div className="form-group">
            <label>生まれた都市</label>
            <select
              value={prefecture}
              onChange={(e) => setPrefecture(e.target.value)}
              disabled={loading}
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
              disabled={loading}
            >
              {PREFECTURES.map((pref) => (
                <option key={pref} value={pref}>
                  {pref}
                </option>
              ))}
            </select>
          </div>
          
          <button type="submit" disabled={loading} className="submit-button">
            更新
          </button>
        </form>
      </section>

      {/* パスワード変更 */}
      <section className="mypage-section">
        <h2>パスワード変更</h2>
        <form onSubmit={handleChangePassword}>
          <div className="form-group">
            <label htmlFor="password">新しいパスワード</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          <div className="form-group">
            <label htmlFor="password2">確認用パスワード</label>
            <input
              type="password"
              id="password2"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          <button type="submit" disabled={loading} className="submit-button">
            パスワードを変更
          </button>
        </form>
      </section>

      {/* 表示モード切り替え */}
      <section className="mypage-section">
        <h2>表示モード</h2>
        <div className="form-group">
          <label htmlFor="display-mode">表示モードを選択</label>
          <select
            id="display-mode"
            value={displayMode}
            onChange={handleDisplayModeChange}
            disabled={loading}
            className="display-mode-select"
          >
            <option value="business">経営者向け</option>
            <option value="parent">保護者向け</option>
          </select>
        </div>
      </section>

      {/* 退会処理 */}
      <section className="mypage-section danger-section">
        <h2>退会処理</h2>
        <p className="danger-text">
          退会すると、すべてのデータが無効化されます。この操作は取り消せません。
        </p>
        <button
          onClick={handleDeactivate}
          disabled={loading}
          className="danger-button"
        >
          退会する
        </button>
      </section>
    </div>
  );
};

export default MyPage;

