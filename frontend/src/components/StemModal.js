import React from 'react';
import './StemModal.css';

const StemModal = ({ stem, onClose }) => {
  if (!stem) return null;

  const handleBackgroundClick = (e) => {
    if (e.target.className === 'stem-modal-overlay') {
      onClose();
    }
  };

  return (
    <div className="stem-modal-overlay" onClick={handleBackgroundClick}>
      <div className="stem-modal-content">
        <button className="stem-modal-close" onClick={onClose}>
          ×
        </button>
        
        <div className="stem-modal-header">
          <h2>{stem.name}</h2>
          <div className="stem-modal-subtitle">
            <span className="stem-reading">{stem.reading}</span>
            <span className="stem-type">{stem.element_type} タイプ</span>
          </div>
        </div>

        <div className="stem-modal-body">
          <section className="stem-section">
            <h3>特徴</h3>
            <div className="stem-text">{stem.description}</div>
          </section>

          <section className="stem-section">
            <h3>人物像</h3>
            <div className="stem-text">{stem.personality}</div>
          </section>

          <section className="stem-section">
            <h3>強み・活かし方</h3>
            <div className="stem-text">{stem.strengths}</div>
          </section>

          <section className="stem-section">
            <h3>弱み・接し方の注意点</h3>
            <div className="stem-text">{stem.weaknesses}</div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default StemModal;

