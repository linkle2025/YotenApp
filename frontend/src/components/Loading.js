import React from 'react';
import './Loading.css';

const Loading = ({ message = '読み込み中...' }) => {
  return (
    <div className="loading-container">
      <div className="loading-spinner"></div>
      <p className="loading-message">{message}</p>
    </div>
  );
};

export default Loading;

