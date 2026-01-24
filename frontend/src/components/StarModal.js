import React from 'react';
import './StarModal.css';

const StarModal = ({ star, onClose }) => {
  if (!star) return null;

  const handleBackgroundClick = (e) => {
    if (e.target.className === 'star-modal-overlay') {
      onClose();
    }
  };

  return (
    <div className="star-modal-overlay" onClick={handleBackgroundClick}>
      <div className="star-modal-content">
        <button className="star-modal-close" onClick={onClose}>
          ×
        </button>
        
        <div className="star-modal-header">
          <h2>{star.name}</h2>
          <div className="star-modal-subtitle">
            <span className="star-reading">{star.reading}</span>
          </div>
        </div>

        <div className="star-modal-body">
          <section className="star-section">
            <h3>キャラクター</h3>
            <div className="star-text">{star.character}</div>
          </section>

          <section className="star-section">
            <h3>才能</h3>
            <div className="star-text">{star.talents}</div>
          </section>

          <section className="star-section">
            <h3>弱点</h3>
            <div className="star-text">{star.weaknesses}</div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default StarModal;

