import { useState, useEffect, useCallback } from 'react';
import { fortuneService } from '../services/fortuneService';

/**
 * 四柱推命計算結果の詳細を管理するカスタムフック
 */
const useFortuneDetail = (id) => {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 詳細を取得
  const fetchDetail = useCallback(async () => {
    if (!id) return;
    
    setLoading(true);
    setError(null);
    try {
      const data = await fortuneService.getDetail(id);
      setDetail(data);
    } catch (err) {
      setError('詳細の取得に失敗しました。');
      console.error('Failed to fetch detail:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  // お気に入りを切り替え
  const toggleFavorite = useCallback(async () => {
    if (!detail) return { success: false, error: 'データがありません。' };
    
    try {
      const updated = await fortuneService.toggleFavorite(detail.id);
      setDetail(prev => ({ ...prev, is_favorite: updated.is_favorite }));
      return { success: true };
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
      return { success: false, error: 'お気に入りの更新に失敗しました。' };
    }
  }, [detail]);

  // 初回マウント時に詳細を取得
  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  return {
    detail,
    loading,
    error,
    fetchDetail,
    toggleFavorite,
  };
};

export default useFortuneDetail;

