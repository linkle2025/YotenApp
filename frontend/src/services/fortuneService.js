import api from './api';

export const fortuneService = {
  async calculate(birthYear, birthMonth, birthDay, birthHour, prefecture, gender, name = '', birthMinute = 0, hourUnknown = false) {
    const data = {
      birth_year: birthYear,
      birth_month: birthMonth,
      birth_day: birthDay,
      birth_hour: birthHour,
      birth_minute: birthMinute,
      hour_unknown: hourUnknown,
      prefecture,
      gender,
    };
    
    // 氏名が入力されている場合のみ追加
    if (name) {
      data.name = name;
    }
    
    const response = await api.post('/fortune/calculate/', data);
    return response.data;
  },

  async getHistory(favorite = null) {
    const params = favorite !== null ? { favorite: favorite.toString() } : {};
    const response = await api.get('/fortune/history/', { params });
    return response.data;
  },

  async getDetail(id) {
    const response = await api.get(`/fortune/history/${id}/`);
    return response.data;
  },

  async deleteCalculation(id) {
    const response = await api.delete(`/fortune/history/${id}/delete/`);
    return response.data;
  },

  async toggleFavorite(id) {
    const response = await api.patch(`/fortune/history/${id}/favorite/`);
    return response.data;
  },

  async calculateKimonTonkou(data) {
    const response = await api.post('/fortune/kimon-tonkou/', data);
    return response.data;
  },
};

