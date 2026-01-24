import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './HomePage.css';

const HomePage = () => {
  const { user } = useAuth();

  return (
    <div className="home-container">
      <div className="home-content">
        <h1>四柱推命アプリへようこそ</h1>
        <p>生年月日時から命式を計算します。</p>
        {user ? (
          <div className="home-actions">
            <Link to="/calculate" className="primary-button">
              命式を作成する
            </Link>
            <Link to="/history" className="secondary-button">
              履歴を見る
            </Link>
          </div>
        ) : (
          <div className="home-actions">
            <Link to="/register" className="primary-button">
              アカウントを作成
            </Link>
            <Link to="/login" className="secondary-button">
              ログイン
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default HomePage;

