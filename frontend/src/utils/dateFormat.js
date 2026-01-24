/**
 * 日付フォーマット用ユーティリティ関数
 */

/**
 * ISO 8601形式の日付文字列を日本語表記に変換
 * @param {string} isoString - ISO 8601形式の日付文字列
 * @returns {string} - フォーマット済み日付文字列（例: 2025年11月15日 10:30）
 */
export const formatDateTime = (isoString) => {
  if (!isoString) return '';
  
  const date = new Date(isoString);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  return `${year}年${month}月${day}日 ${hours}:${minutes}`;
};

/**
 * ISO 8601形式の日付文字列を日付のみの日本語表記に変換
 * @param {string} isoString - ISO 8601形式の日付文字列
 * @returns {string} - フォーマット済み日付文字列（例: 2025年11月15日）
 */
export const formatDate = (isoString) => {
  if (!isoString) return '';
  
  const date = new Date(isoString);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  
  return `${year}年${month}月${day}日`;
};

/**
 * 生年月日を日本語表記に変換
 * @param {number} year - 年
 * @param {number} month - 月
 * @param {number} day - 日
 * @returns {string} - フォーマット済み生年月日（例: 1990年1月1日）
 */
export const formatBirthDate = (year, month, day) => {
  if (!year || !month || !day) return '';
  return `${year}年${month}月${day}日`;
};

/**
 * 相対的な日時表示（例: 3分前、2時間前）
 * @param {string} isoString - ISO 8601形式の日付文字列
 * @returns {string} - 相対的な時間表示
 */
export const formatRelativeTime = (isoString) => {
  if (!isoString) return '';
  
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  
  if (diffSec < 60) return 'たった今';
  if (diffMin < 60) return `${diffMin}分前`;
  if (diffHour < 24) return `${diffHour}時間前`;
  if (diffDay < 7) return `${diffDay}日前`;
  
  return formatDate(isoString);
};

