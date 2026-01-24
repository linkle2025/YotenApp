import api from './api';

export const starService = {
  /**
   * 通変星一覧を取得
   */
  async getAllStars() {
    const response = await api.get('/stars/');
    // Django REST Frameworkのページネーションレスポンスからresultsを取り出す
    return response.data.results || response.data;
  },
};

