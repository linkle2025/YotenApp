import api from './api';

export const authService = {
  async register(username, email, password, password2, profileData = {}) {
    const data = {
      username,
      email,
      password,
      password2,
    };
    
    // プロフィール情報を追加
    if (profileData.birthYear !== undefined) data.birth_year = profileData.birthYear;
    if (profileData.birthMonth !== undefined) data.birth_month = profileData.birthMonth;
    if (profileData.birthDay !== undefined) data.birth_day = profileData.birthDay;
    if (profileData.birthHour !== undefined) data.birth_hour = profileData.birthHour;
    if (profileData.birthMinute !== undefined) data.birth_minute = profileData.birthMinute;
    if (profileData.hourUnknown !== undefined) data.hour_unknown = profileData.hourUnknown;
    if (profileData.prefecture !== undefined) data.prefecture = profileData.prefecture;
    if (profileData.residencePrefecture !== undefined) data.residence_prefecture = profileData.residencePrefecture;
    if (profileData.displayMode !== undefined) data.display_mode = profileData.displayMode;
    if (profileData.gender !== undefined) data.gender = profileData.gender;
    
    const response = await api.post('/auth/register/', data);
    return response.data;
  },

  async login(username, password) {
    const response = await api.post('/token/', {
      username,
      password,
    });
    const { access, refresh } = response.data;
    localStorage.setItem('access_token', access);
    localStorage.setItem('refresh_token', refresh);
    return response.data;
  },

  async getCurrentUser() {
    const response = await api.get('/auth/user/');
    return response.data;
  },

  logout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  },

  isAuthenticated() {
    return !!localStorage.getItem('access_token');
  },

  async updateDisplayMode(displayMode) {
    const response = await api.patch('/auth/display-mode/', {
      display_mode: displayMode,
    });
    return response.data;
  },

  async updateUser(userData) {
    const response = await api.patch('/auth/user/', userData);
    return response.data;
  },

  async changePassword(password, password2) {
    const response = await api.patch('/auth/password/', {
      password,
      password2,
    });
    return response.data;
  },

  // パスワードリセット（ログイン不要）
  async requestPasswordReset(email) {
    const response = await api.post('/auth/password-reset/', { email });
    return response.data;
  },

  // password を渡さないとリンクの有効性だけを確認する
  async checkPasswordResetLink(uid, token) {
    const response = await api.post('/auth/password-reset/confirm/', { uid, token });
    return response.data;
  },

  async confirmPasswordReset(uid, token, password, password2) {
    const response = await api.post('/auth/password-reset/confirm/', {
      uid,
      token,
      password,
      password2,
    });
    return response.data;
  },

  async deactivateAccount() {
    const response = await api.post('/auth/deactivate/');
    return response.data;
  },

  // 管理者用API
  async getAdminUserList() {
    const response = await api.get('/auth/admin/users/');
    return response.data;
  },

  async getAdminUserDetail(userId) {
    const response = await api.get(`/auth/admin/users/${userId}/`);
    return response.data;
  },

  async updateAdminUser(userId, userData) {
    const response = await api.patch(`/auth/admin/users/${userId}/`, userData);
    return response.data;
  },
};

