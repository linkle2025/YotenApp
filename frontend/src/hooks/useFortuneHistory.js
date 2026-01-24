import { useState, useEffect, useCallback } from 'react';
import { fortuneService } from '../services/fortuneService';

/**
 * 四柱推命計算履歴を管理するカスタムフック
 */
const useFortuneHistory = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 履歴を取得
  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fortuneService.getHistory();
      setHistory(data);
    } catch (err) {
      setError('履歴の取得に失敗しました。');
      console.error('Failed to fetch history:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // 履歴を削除
  const deleteHistory = useCallback(async (id) => {
    try {
      await fortuneService.deleteHistory(id);
      setHistory(prev => prev.filter(item => item.id !== id));
      return { success: true };
    } catch (err) {
      console.error('Failed to delete history:', err);
      return { success: false, error: '削除に失敗しました。' };
    }
  }, []);

  // お気に入りを切り替え
  const toggleFavorite = useCallback(async (id) => {
    try {
      const updated = await fortuneService.toggleFavorite(id);
      setHistory(prev =>
        prev.map(item => (item.id === id ? { ...item, is_favorite: updated.is_favorite } : item))
      );
      return { success: true };
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
      return { success: false, error: 'お気に入りの更新に失敗しました。' };
    }
  }, []);

  // 初回マウント時に履歴を取得
  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return {
    history,
    loading,
    error,
    fetchHistory,
    deleteHistory,
    toggleFavorite,
  };
};

export default useFortuneHistory;

