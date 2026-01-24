import {
  isValidEmail,
  validatePassword,
  validateBirthDate,
  validateHour,
  validateUsername,
} from '../validation';

describe('validation utilities', () => {
  describe('isValidEmail', () => {
    test('returns true for valid email', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name+tag@example.co.jp')).toBe(true);
    });

    test('returns false for invalid email', () => {
      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('invalid@')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
    });
  });

  describe('validatePassword', () => {
    test('returns valid for strong password', () => {
      const result = validatePassword('TestPass123');
      expect(result.isValid).toBe(true);
    });

    test('returns invalid for short password', () => {
      const result = validatePassword('Short1');
      expect(result.isValid).toBe(false);
      expect(result.message).toContain('8文字以上');
    });

    test('returns invalid for password without uppercase', () => {
      const result = validatePassword('testpass123');
      expect(result.isValid).toBe(false);
      expect(result.message).toContain('大文字');
    });

    test('returns invalid for password without lowercase', () => {
      const result = validatePassword('TESTPASS123');
      expect(result.isValid).toBe(false);
      expect(result.message).toContain('小文字');
    });

    test('returns invalid for password without number', () => {
      const result = validatePassword('TestPassword');
      expect(result.isValid).toBe(false);
      expect(result.message).toContain('数字');
    });
  });

  describe('validateBirthDate', () => {
    test('returns valid for valid date', () => {
      const result = validateBirthDate(1990, 1, 1);
      expect(result.isValid).toBe(true);
    });

    test('returns invalid for future year', () => {
      const futureYear = new Date().getFullYear() + 1;
      const result = validateBirthDate(futureYear, 1, 1);
      expect(result.isValid).toBe(false);
    });

    test('returns invalid for invalid month', () => {
      const result = validateBirthDate(1990, 13, 1);
      expect(result.isValid).toBe(false);
      expect(result.message).toContain('月');
    });

    test('returns invalid for invalid day', () => {
      const result = validateBirthDate(1990, 2, 30);
      expect(result.isValid).toBe(false);
      expect(result.message).toContain('日');
    });
  });

  describe('validateHour', () => {
    test('returns valid for valid hour', () => {
      expect(validateHour(0).isValid).toBe(true);
      expect(validateHour(12).isValid).toBe(true);
      expect(validateHour(23).isValid).toBe(true);
    });

    test('returns invalid for negative hour', () => {
      const result = validateHour(-1);
      expect(result.isValid).toBe(false);
    });

    test('returns invalid for hour > 23', () => {
      const result = validateHour(24);
      expect(result.isValid).toBe(false);
    });
  });

  describe('validateUsername', () => {
    test('returns valid for valid username', () => {
      expect(validateUsername('testuser').isValid).toBe(true);
      expect(validateUsername('test_user123').isValid).toBe(true);
    });

    test('returns invalid for short username', () => {
      const result = validateUsername('ab');
      expect(result.isValid).toBe(false);
      expect(result.message).toContain('3文字以上');
    });

    test('returns invalid for long username', () => {
      const result = validateUsername('a'.repeat(31));
      expect(result.isValid).toBe(false);
      expect(result.message).toContain('30文字以下');
    });

    test('returns invalid for username with special characters', () => {
      const result = validateUsername('test@user');
      expect(result.isValid).toBe(false);
      expect(result.message).toContain('英数字とアンダースコア');
    });
  });
});

