/**
 * バリデーション用ユーティリティ関数
 */

/**
 * メールアドレスの形式をチェック
 * @param {string} email - メールアドレス
 * @returns {boolean} - 有効な場合true
 */
export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * パスワードの強度をチェック
 * @param {string} password - パスワード
 * @returns {object} - {isValid: boolean, message: string}
 */
export const validatePassword = (password) => {
  if (!password || password.length < 8) {
    return {
      isValid: false,
      message: 'パスワードは8文字以上である必要があります。',
    };
  }
  
  if (!/[A-Z]/.test(password)) {
    return {
      isValid: false,
      message: 'パスワードには大文字を1文字以上含める必要があります。',
    };
  }
  
  if (!/[a-z]/.test(password)) {
    return {
      isValid: false,
      message: 'パスワードには小文字を1文字以上含める必要があります。',
    };
  }
  
  if (!/\d/.test(password)) {
    return {
      isValid: false,
      message: 'パスワードには数字を1文字以上含める必要があります。',
    };
  }
  
  return {
    isValid: true,
    message: '',
  };
};

/**
 * 生年月日の妥当性をチェック
 * @param {number} year - 年
 * @param {number} month - 月
 * @param {number} day - 日
 * @returns {object} - {isValid: boolean, message: string}
 */
export const validateBirthDate = (year, month, day) => {
  const currentYear = new Date().getFullYear();
  
  // 年のチェック
  if (!year || year < 1900 || year > currentYear) {
    return {
      isValid: false,
      message: `年は1900年から${currentYear}年の間で入力してください。`,
    };
  }
  
  // 月のチェック
  if (!month || month < 1 || month > 12) {
    return {
      isValid: false,
      message: '月は1から12の間で入力してください。',
    };
  }
  
  // 日のチェック
  const daysInMonth = new Date(year, month, 0).getDate();
  if (!day || day < 1 || day > daysInMonth) {
    return {
      isValid: false,
      message: `日は1から${daysInMonth}の間で入力してください。`,
    };
  }
  
  return {
    isValid: true,
    message: '',
  };
};

/**
 * 時刻の妥当性をチェック
 * @param {number} hour - 時（0-23）
 * @returns {object} - {isValid: boolean, message: string}
 */
export const validateHour = (hour) => {
  if (hour === undefined || hour === null || hour < 0 || hour > 23) {
    return {
      isValid: false,
      message: '時は0から23の間で入力してください。',
    };
  }
  
  return {
    isValid: true,
    message: '',
  };
};

/**
 * ユーザー名の妥当性をチェック
 * @param {string} username - ユーザー名
 * @returns {object} - {isValid: boolean, message: string}
 */
export const validateUsername = (username) => {
  if (!username || username.length < 3) {
    return {
      isValid: false,
      message: 'ユーザー名は3文字以上である必要があります。',
    };
  }
  
  if (username.length > 30) {
    return {
      isValid: false,
      message: 'ユーザー名は30文字以下である必要があります。',
    };
  }
  
  // 英数字とアンダースコアのみ許可
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return {
      isValid: false,
      message: 'ユーザー名には英数字とアンダースコアのみ使用できます。',
    };
  }
  
  return {
    isValid: true,
    message: '',
  };
};

