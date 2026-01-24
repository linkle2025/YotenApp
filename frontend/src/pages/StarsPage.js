import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { starService } from '../services/starService';
import StarModal from '../components/StarModal';
import Loading from '../components/Loading';
import ErrorMessage from '../components/ErrorMessage';
import './StarsPage.css';

const StarsPage = () => {
  const [stars, setStars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedStar, setSelectedStar] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    fetchStars();
  }, []);

  useEffect(() => {
    // URLパラメータで指定された通変星を自動表示
    const selectedName = searchParams.get('selected');
    if (selectedName && stars.length > 0) {
      const star = stars.find(s => s.name === selectedName);
      if (star) {
        setSelectedStar(star);
      }
    }
  }, [searchParams, stars]);

  const fetchStars = async () => {
    try {
      setLoading(true);
      const data = await starService.getAllStars();
      setStars(data);
      setError('');
    } catch (err) {
      console.error('通変星データの取得に失敗しました:', err);
      setError('通変星データの取得に失敗しました。もう一度お試しください。');
    } finally {
      setLoading(false);
    }
  };

  const handleCardClick = (star) => {
    setSelectedStar(star);
    setSearchParams({ selected: star.name });
  };

  const handleCloseModal = () => {
    setSelectedStar(null);
    setSearchParams({});
  };

  if (loading) return <Loading />;
  if (error) return <ErrorMessage message={error} onRetry={fetchStars} />;

  return (
    <div className="stars-container">
      <div className="stars-header">
        <h1>通変星について</h1>
        <p className="stars-intro">
          四柱推命における通変星（つうへんせい）は、その人の性格や才能、弱点を表します。
          <br />
          各通変星のカードをクリックすると、詳細な説明をご覧いただけます。
        </p>
      </div>

      <div className="stars-grid">
        {stars.map((star) => (
          <div
            key={star.id}
            className="star-card"
            onClick={() => handleCardClick(star)}
          >
            <div className="star-card-name">{star.name}</div>
            <div className="star-card-reading">{star.reading}</div>
            <div className="star-card-preview">
              {star.character}
            </div>
          </div>
        ))}
      </div>

      {selectedStar && (
        <StarModal star={selectedStar} onClose={handleCloseModal} />
      )}
    </div>
  );
};

export default StarsPage;

