// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// モックデータとヘルパー関数
export const mockUser = {
  id: 1,
  username: 'testuser',
  email: 'test@example.com',
  date_joined: '2025-01-01T00:00:00Z',
};

export const mockFortuneCalculation = {
  id: 1,
  birth_year: 1990,
  birth_month: 1,
  birth_day: 1,
  birth_hour: 10,
  gender: 'male',
  year_pillar_stem: '庚',
  year_pillar_branch: '午',
  month_pillar_stem: '戊',
  month_pillar_branch: '寅',
  day_pillar_stem: '甲',
  day_pillar_branch: '子',
  hour_pillar_stem: '丙',
  hour_pillar_branch: '申',
  hidden_stems: {},
  great_fortune: [],
  is_favorite: false,
  created_at: '2025-01-01T10:00:00Z',
};

