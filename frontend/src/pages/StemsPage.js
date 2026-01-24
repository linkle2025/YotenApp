import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { stemService } from '../services/stemService';
import StemModal from '../components/StemModal';
import Loading from '../components/Loading';
import ErrorMessage from '../components/ErrorMessage';
import './StemsPage.css';

const StemsPage = () => {
  const [stems, setStems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedStem, setSelectedStem] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    fetchStems();
  }, []);

  useEffect(() => {
    // URLパラメータで指定された十干を自動表示
    const selectedName = searchParams.get('selected');
    if (selectedName && stems.length > 0) {
      const stem = stems.find(s => s.name === selectedName);
      if (stem) {
        setSelectedStem(stem);
      }
    }
  }, [searchParams, stems]);

  const fetchStems = async () => {
    try {
      setLoading(true);
      const data = await stemService.getAllStems();
      setStems(data);
      setError('');
    } catch (err) {
      console.error('十干データの取得に失敗しました:', err);
      setError('十干データの取得に失敗しました。もう一度お試しください。');
    } finally {
      setLoading(false);
    }
  };

  const handleCardClick = (stem) => {
    setSelectedStem(stem);
    setSearchParams({ selected: stem.name });
  };

  const handleCloseModal = () => {
    setSelectedStem(null);
    setSearchParams({});
  };

  // 五行のマッピング（十干 -> 五行）
  const getElementClass = (stemName) => {
    const elementMap = {
      '甲': 'wood',
      '乙': 'wood',
      '丙': 'fire',
      '丁': 'fire',
      '戊': 'earth',
      '己': 'earth',
      '庚': 'metal',
      '辛': 'metal',
      '壬': 'water',
      '癸': 'water',
    };
    return elementMap[stemName] || '';
  };

  if (loading) return <Loading />;
  if (error) return <ErrorMessage message={error} onRetry={fetchStems} />;

  return (
    <div className="stems-container">
      <div className="stems-header">
        <h1>十干について</h1>
        <p className="stems-intro">
          四柱推命における十干（じっかん）は、生まれ持った性格や特性を表します。
          <br />
          各十干のカードをクリックすると、詳細な説明をご覧いただけます。
        </p>
      </div>

      <div className="stems-grid">
        {stems.map((stem) => (
          <div
            key={stem.id}
            className={`stem-card ${getElementClass(stem.name)}`}
            onClick={() => handleCardClick(stem)}
          >
            <div className="stem-card-name">{stem.name}</div>
            <div className="stem-card-reading">{stem.reading}</div>
            <div className="stem-card-type">{stem.element_type}</div>
            <div className="stem-card-preview">
              {stem.personality.substring(0, 40)}...
            </div>
          </div>
        ))}
      </div>

      {selectedStem && (
        <StemModal stem={selectedStem} onClose={handleCloseModal} />
      )}
    </div>
  );
};

export default StemsPage;

