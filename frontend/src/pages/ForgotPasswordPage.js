import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { authService } from '../services/authService';
import './LoginPage.css';

/**
 * パスワードを忘れた場合：メールアドレスを入力してリセット用リンクを受け取る
 * - 登録の有無が分からないよう、送信後はいつも同じメッセージを表示する（文言は API の値）
 */
const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const data = await authService.requestPasswordReset(email);
      setMessage(data.message);
    } catch (err) {
      const res = err.response;
      if (res?.status === 429) {
        setError('お申し込みが続いたため、一時的に受付を停止しています。しばらく時間をおいて再度お試しください。');
      } else if (res?.data?.email) {
        setError('メールアドレスの形式が正しくありません。');
      } else {
        setError('送信に失敗しました。時間をおいて再度お試しください。');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h1>パスワードの再設定</h1>
        {message ? (
          <div className="success-message" role="status">
            {message}
          </div>
        ) : (
          <>
            <p className="form-help">
              ご登録のメールアドレスを入力してください。パスワード再設定用のリンクをお送りします。
            </p>
            {error && <div className="error-message">{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="reset-email">メールアドレス</label>
                <input
                  id="reset-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
              <button type="submit" className="submit-button" disabled={submitting}>
                {submitting ? '送信中...' : '再設定メールを送信'}
              </button>
            </form>
          </>
        )}
        <p className="register-link">
          <Link to="/login">ログイン画面に戻る</Link>
        </p>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
