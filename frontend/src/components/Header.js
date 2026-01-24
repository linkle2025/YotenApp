import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Header.css';

const Header = () => {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="header">
      <div className="header-content">
        <Link to="/" className="logo">
          陽てん塾 命式作成アプリ
        </Link>
        <nav className="nav">
          <Link to="/stems">十干</Link>
          <Link to="/stars">通変星</Link>
          {user ? (
            <>
              <Link to="/calculate">命式作成</Link>
              <Link to="/history">履歴</Link>
              <Link to="/mypage">マイページ</Link>
              {isAdmin() && <Link to="/admin">ユーザー管理</Link>}
              {isAdmin() && <Link to="/kimon-tonkou">奇門遁甲</Link>}
              <button onClick={handleLogout} className="logout-button">
                ログアウト
              </button>
            </>
          ) : (
            <>
              <Link to="/login">ログイン</Link>
              <Link to="/register">登録</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
};

export default Header;

