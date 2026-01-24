import api from './api';

export const stemService = {
  /**
   * 十干一覧を取得
   */
  async getAllStems() {
    const response = await api.get('/stems/');
    // Django REST Frameworkはページネーションオブジェクトでレスポンスするのでresultsを取り出す
    return response.data.results || response.data;
  },
};

