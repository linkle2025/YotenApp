import React from 'react';
import './KimonUsageGuidePopup.css';

const KimonUsageGuidePopup = ({ guide, onClose }) => {
  if (!guide) return null;

  return (
    <div
      className="kimon-usage-popup-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="kimon-usage-popup"
        role="dialog"
        aria-labelledby="kimon-usage-popup-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h4 id="kimon-usage-popup-title" className="kimon-usage-popup-title">
          【{guide.title}】
        </h4>
        <pre className="kimon-usage-popup-body">{guide.body}</pre>
        <button type="button" className="kimon-usage-popup-close" onClick={onClose}>
          閉じる
        </button>
      </div>
    </div>
  );
};

export default KimonUsageGuidePopup;
