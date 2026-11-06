import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { authService } from '../services/authService';
import './LoginPage.css';

const INVALID_LINK_MESSAGE =
  'このリンクは無効か、有効期限が切れています。もう一度パスワード再設定をお申し込みください。';

/**
 * メールのリンク（/password-reset/:uid/:token）から開く、新しいパスワードの設定画面
 * - 開いた時点でリンクの有効性を確認し、無効なら再申し込みへの導線だけを出す
 */
const ResetPasswordPage = () => {
  const { uid, token } = useParams();
  const [linkState, setLinkState] = useState('checking'); // checking | valid | invalid
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState('');
  const [error, setError] = useState('');
  const [passwordErrors, setPasswordErrors] = useState([]);

  useEffect(() => {
    let cancelled = false;
    authService
      .checkPasswordResetLink(uid, token)
      .then(() => !cancelled && setLinkState('valid'))
      .catch(() => !cancelled && setLinkState('invalid'));
    return () => {
      cancelled = true;
    };
  }, [uid, token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setPasswordErrors([]);
    if (password !== password2) {
      setPasswordErrors(['パスワードが一致しません。']);
      return;
    }
    setSubmitting(true);
    try {
      const data = await authService.confirmPasswordReset(uid, token, password, password2);
      setDone(data.message);
    } catch (err) {
      const res = err.response;
      if (res?.data?.password) {
        const errors = res.data.password;
        setPasswordErrors(Array.isArray(errors) ? errors : [errors]);
      } else if (res?.data?.detail && res.status === 400) {
        setLinkState('invalid');
      } else if (res?.status === 429) {
        setError('試行回数が多すぎます。しばらく時間をおいて再度お試しください。');
      } else {
        setError('再設定に失敗しました。時間をおいて再度お試しください。');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const renderBody = () => {
    if (done) {
      return (
        <>
          <div className="success-message" role="status">
            {done}
          </div>
          <Link to="/login" className="submit-button link-button">
            ログイン画面へ
          </Link>
        </>
      );
    }
    if (linkState === 'checking') {
      return <p className="form-help">リンクを確認しています...</p>;
    }
    if (linkState === 'invalid') {
      return (
        <>
          <div className="error-message">{INVALID_LINK_MESSAGE}</div>
          <p className="register-link">
            <Link to="/password-reset">パスワード再設定をもう一度申し込む</Link>
          </p>
        </>
      );
    }
    return (
      <>
        <p className="form-help">新しいパスワードを入力してください（8文字以上、数字だけ・よくある語句は不可）。</p>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="new-password">新しいパスワード</label>
            <input
              id="new-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="new-password2">新しいパスワード（確認）</label>
            <input
              id="new-password2"
              type="password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              autoComplete="new-password"
              required
            />
            {passwordErrors.map((msg) => (
              <p key={msg} className="field-error">
                {msg}
              </p>
            ))}
          </div>
          <button type="submit" className="submit-button" disabled={submitting}>
            {submitting ? '設定中...' : 'パスワードを再設定'}
          </button>
        </form>
      </>
    );
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h1>新しいパスワードの設定</h1>
        {renderBody()}
      </div>
    </div>
  );
};

export default ResetPasswordPage;
