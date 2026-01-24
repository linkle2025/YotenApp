import {
  formatDateTime,
  formatDate,
  formatBirthDate,
  formatRelativeTime,
} from '../dateFormat';

describe('dateFormat utilities', () => {
  describe('formatDateTime', () => {
    test('formats ISO string to Japanese datetime', () => {
      const result = formatDateTime('2025-01-15T10:30:00Z');
      expect(result).toContain('2025年1月15日');
      expect(result).toContain(':');
    });

    test('returns empty string for null input', () => {
      expect(formatDateTime(null)).toBe('');
    });
  });

  describe('formatDate', () => {
    test('formats ISO string to Japanese date', () => {
      const result = formatDate('2025-01-15T10:30:00Z');
      expect(result).toContain('2025年1月15日');
      expect(result).not.toContain(':');
    });

    test('returns empty string for null input', () => {
      expect(formatDate(null)).toBe('');
    });
  });

  describe('formatBirthDate', () => {
    test('formats birth date correctly', () => {
      const result = formatBirthDate(1990, 1, 1);
      expect(result).toBe('1990年1月1日');
    });

    test('returns empty string for missing values', () => {
      expect(formatBirthDate(null, 1, 1)).toBe('');
      expect(formatBirthDate(1990, null, 1)).toBe('');
      expect(formatBirthDate(1990, 1, null)).toBe('');
    });
  });

  describe('formatRelativeTime', () => {
    test('returns "たった今" for very recent time', () => {
      const now = new Date();
      const result = formatRelativeTime(now.toISOString());
      expect(result).toBe('たった今');
    });

    test('returns empty string for null input', () => {
      expect(formatRelativeTime(null)).toBe('');
    });
  });
});

