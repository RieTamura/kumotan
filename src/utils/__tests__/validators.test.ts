/**
 * Validation utilities tests
 * セキュリティクリティカルな入力検証のテスト
 */

import { Validators, sanitizeWord, sanitizeHandle, sanitizeApiKey } from '../validators';

describe('Validators', () => {
  describe('isValidHandle', () => {
    it('should accept valid handle format', () => {
      expect(Validators.isValidHandle('user.bsky.social')).toBe(true);
      expect(Validators.isValidHandle('alice.example.com')).toBe(true);
      expect(Validators.isValidHandle('test-user.bsky.social')).toBe(true);
    });

    it('should accept valid email format', () => {
      expect(Validators.isValidHandle('user@example.com')).toBe(true);
      expect(Validators.isValidHandle('test.user@bsky.social')).toBe(true);
    });

    it('should reject invalid input', () => {
      expect(Validators.isValidHandle('')).toBe(false);
      expect(Validators.isValidHandle('   ')).toBe(false);
      expect(Validators.isValidHandle('invalid')).toBe(false);
      expect(Validators.isValidHandle('user@')).toBe(false);
      expect(Validators.isValidHandle('@example.com')).toBe(false);
    });

    it('should prevent injection attacks', () => {
      expect(Validators.isValidHandle('<script>alert("xss")</script>')).toBe(false);
      expect(Validators.isValidHandle('user"; DROP TABLE users; --')).toBe(false);
      expect(Validators.isValidHandle('../../etc/passwd')).toBe(false);
    });
  });

  describe('isValidAppPassword', () => {
    it('should accept valid app password format', () => {
      expect(Validators.isValidAppPassword('abcd-1234-efgh-5678')).toBe(true);
      expect(Validators.isValidAppPassword('aaaa-bbbb-cccc-dddd')).toBe(true);
      expect(Validators.isValidAppPassword('1111-2222-3333-4444')).toBe(true);
    });

    it('should reject invalid format', () => {
      expect(Validators.isValidAppPassword('')).toBe(false);
      expect(Validators.isValidAppPassword('abcd-1234-efgh')).toBe(false);
      expect(Validators.isValidAppPassword('ABCD-1234-EFGH-5678')).toBe(false); // Uppercase not allowed
      expect(Validators.isValidAppPassword('abcd-1234-efgh-567')).toBe(false); // Too short
      expect(Validators.isValidAppPassword('abcd-1234-efgh-56789')).toBe(false); // Too long
    });

    it('should prevent injection attacks', () => {
      expect(Validators.isValidAppPassword('abcd-1234-efgh-5678\'; DROP TABLE --')).toBe(false);
      expect(Validators.isValidAppPassword('<script>alert(1)</script>')).toBe(false);
    });
  });

  describe('isValidDeepLApiKey', () => {
    it('should accept valid free tier API key', () => {
      expect(Validators.isValidDeepLApiKey('12345678-1234-1234-1234-123456789abc:fx')).toBe(true);
      expect(Validators.isValidDeepLApiKey('abcdefgh-abcd-abcd-abcd-abcdefghijkl:fx')).toBe(true);
    });

    it('should reject invalid format', () => {
      expect(Validators.isValidDeepLApiKey('')).toBe(false);
      expect(Validators.isValidDeepLApiKey('short-key:fx')).toBe(false);
      expect(Validators.isValidDeepLApiKey('12345678-1234-1234-1234-123456789abc')).toBe(false); // Missing :fx
      expect(Validators.isValidDeepLApiKey('12345678-1234-1234-1234-123456789abc:pro')).toBe(false); // Not free tier
    });

    it('should prevent injection attacks', () => {
      expect(Validators.isValidDeepLApiKey('12345678-1234-1234-1234-123456789abc:fx\'; DROP --')).toBe(false);
      expect(Validators.isValidDeepLApiKey('<script>alert(1)</script>:fx')).toBe(false);
    });
  });

  describe('isValidEnglishWord', () => {
    it('should accept valid English words', () => {
      expect(Validators.isValidEnglishWord('hello')).toBe(true);
      expect(Validators.isValidEnglishWord('world')).toBe(true);
      expect(Validators.isValidEnglishWord("don't")).toBe(true); // Apostrophe
      expect(Validators.isValidEnglishWord('ice-cream')).toBe(true); // Hyphen
      expect(Validators.isValidEnglishWord('New York')).toBe(true); // Space
    });

    it('should reject invalid input', () => {
      expect(Validators.isValidEnglishWord('')).toBe(false);
      expect(Validators.isValidEnglishWord('   ')).toBe(false);
      expect(Validators.isValidEnglishWord('123')).toBe(false); // Must start with letter
      expect(Validators.isValidEnglishWord('hello123')).toBe(false); // Numbers not allowed
      expect(Validators.isValidEnglishWord('a'.repeat(101))).toBe(false); // Too long
    });

    it('should prevent injection attacks', () => {
      expect(Validators.isValidEnglishWord('<script>alert("xss")</script>')).toBe(false);
      expect(Validators.isValidEnglishWord('word"; DROP TABLE words; --')).toBe(false);
      expect(Validators.isValidEnglishWord('../../etc/passwd')).toBe(false);
    });
  });

  describe('isJapanese', () => {
    it('should detect Japanese text', () => {
      expect(Validators.isJapanese('こんにちは')).toBe(true); // Hiragana
      expect(Validators.isJapanese('カタカナ')).toBe(true); // Katakana
      expect(Validators.isJapanese('漢字')).toBe(true); // Kanji
      expect(Validators.isJapanese('日本語テキスト')).toBe(true); // Mixed
    });

    it('should reject non-Japanese text', () => {
      expect(Validators.isJapanese('hello')).toBe(false);
      expect(Validators.isJapanese('123')).toBe(false);
      expect(Validators.isJapanese('')).toBe(false);
      expect(Validators.isJapanese('   ')).toBe(false);
    });
  });

  describe('validateHandle', () => {
    it('should return isValid true for valid input', () => {
      const result = Validators.validateHandle('user.bsky.social');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return error for empty input', () => {
      const result = Validators.validateHandle('');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('ユーザー名を入力してください');
    });

    it('should return error for invalid format', () => {
      const result = Validators.validateHandle('invalid');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('正しい形式で入力してください（例: user.bsky.social）');
    });
  });

  describe('validateAppPassword', () => {
    it('should return isValid true for valid input', () => {
      const result = Validators.validateAppPassword('abcd-1234-efgh-5678');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return error for empty input', () => {
      const result = Validators.validateAppPassword('');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('App Passwordを入力してください');
    });

    it('should return error for invalid format', () => {
      const result = Validators.validateAppPassword('invalid');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('App Passwordの形式が正しくありません（例: xxxx-xxxx-xxxx-xxxx）');
    });
  });

  describe('validateDeepLApiKey', () => {
    it('should return isValid true for valid input', () => {
      const result = Validators.validateDeepLApiKey('12345678-1234-1234-1234-123456789abc:fx');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return error for empty input', () => {
      const result = Validators.validateDeepLApiKey('');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('API Keyを入力してください');
    });

    it('should return error for invalid format', () => {
      const result = Validators.validateDeepLApiKey('invalid');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('API Keyの形式が正しくありません');
    });
  });

  describe('validateEnglishWord', () => {
    it('should return isValid true for valid input', () => {
      const result = Validators.validateEnglishWord('hello');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return error for empty input', () => {
      const result = Validators.validateEnglishWord('');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('単語を入力してください');
    });

    it('should return error for too long input', () => {
      const result = Validators.validateEnglishWord('a'.repeat(101));
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('単語は100文字以内で入力してください');
    });

    it('should return error for invalid characters', () => {
      const result = Validators.validateEnglishWord('123');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('英単語を入力してください');
    });
  });
});

describe('Sanitization functions', () => {
  describe('sanitizeWord', () => {
    it('should trim whitespace', () => {
      expect(sanitizeWord('  hello  ')).toBe('hello');
      expect(sanitizeWord('\thello\n')).toBe('hello');
    });

    it('should convert to lowercase', () => {
      expect(sanitizeWord('HELLO')).toBe('hello');
      expect(sanitizeWord('HeLLo')).toBe('hello');
    });

    it('should handle empty input', () => {
      expect(sanitizeWord('')).toBe('');
      expect(sanitizeWord('   ')).toBe('');
    });

    it('should prevent SQL injection', () => {
      const malicious = "  HELLO'; DROP TABLE words; --  ";
      const sanitized = sanitizeWord(malicious);
      // After sanitization, it should be lowercase and trimmed
      expect(sanitized).toBe("hello'; drop table words; --");
      // The sanitized value should NOT be executed as SQL
      // (This is tested in database tests with placeholders)
    });
  });

  describe('sanitizeHandle', () => {
    it('should trim whitespace', () => {
      expect(sanitizeHandle('  user.bsky.social  ')).toBe('user.bsky.social');
    });

    it('should preserve case', () => {
      expect(sanitizeHandle('User.Bsky.Social')).toBe('User.Bsky.Social');
    });

    it('should handle empty input', () => {
      expect(sanitizeHandle('')).toBe('');
      expect(sanitizeHandle('   ')).toBe('');
    });
  });

  describe('sanitizeApiKey', () => {
    it('should trim whitespace', () => {
      expect(sanitizeApiKey('  api-key  ')).toBe('api-key');
    });

    it('should preserve case and special characters', () => {
      expect(sanitizeApiKey('ABC-123:fx')).toBe('ABC-123:fx');
    });

    it('should handle empty input', () => {
      expect(sanitizeApiKey('')).toBe('');
      expect(sanitizeApiKey('   ')).toBe('');
    });
  });
});
