import React from 'react';
import './BaguaSymbolismPopup.css';

const BaguaPopupBody = ({ data, onClose, showClose = false }) => (
  <>
    <h4 id="bagua-popup-title" className="bagua-popup-title">
      {data.title}
    </h4>
    <dl className="bagua-popup-list">
      <div className="bagua-popup-row">
        <dt>正象</dt>
        <dd>{data.zhengxiang}</dd>
      </div>
      <div className="bagua-popup-row">
        <dt>人物</dt>
        <dd>{data.person}</dd>
      </div>
      <div className="bagua-popup-row">
        <dt>象意</dt>
        <dd>{data.xiangyi}</dd>
      </div>
    </dl>
    {showClose && (
      <button type="button" className="bagua-popup-close" onClick={onClose}>
        閉じる
      </button>
    )}
  </>
);

const BaguaSymbolismPopup = ({ data, placement = 'above', onClose, variant = 'inline' }) => {
  if (!data) return null;

  const placementClass = placement === 'below' ? 'bagua-popup--below' : 'bagua-popup--above';

  if (variant === 'modal') {
    return (
      <div
        className="bagua-popup-backdrop"
        role="presentation"
        onClick={onClose}
      >
        <div
          className="bagua-popup bagua-popup--modal"
          role="dialog"
          aria-labelledby="bagua-popup-title"
          onClick={(e) => e.stopPropagation()}
        >
          <BaguaPopupBody data={data} onClose={onClose} showClose />
        </div>
      </div>
    );
  }

  return (
    <div
      className={`bagua-popup bagua-popup--inline ${placementClass}`}
      role="tooltip"
      onClick={(e) => e.stopPropagation()}
    >
      <BaguaPopupBody data={data} />
    </div>
  );
};

export default BaguaSymbolismPopup;
