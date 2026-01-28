/**
 * 日本語処理ユーティリティのテスト
 */

import {
  katakanaToHiragana,
  hiraganaToKatakana,
  containsJapanese,
  isPrimarilyJapanese,
  normalizeJapanese,
} from '../japanese';

describe('Japanese Utilities', () => {
  describe('katakanaToHiragana', () => {
    it('should convert katakana to hiragana', () => {
      expect(katakanaToHiragana('アイウエオ')).toBe('あいうえお');
      expect(katakanaToHiragana('カキクケコ')).toBe('かきくけこ');
      expect(katakanaToHiragana('サシスセソ')).toBe('さしすせそ');
    });

    it('should preserve hiragana', () => {
      expect(katakanaToHiragana('あいうえお')).toBe('あいうえお');
    });

    it('should preserve kanji', () => {
      expect(katakanaToHiragana('漢字')).toBe('漢字');
    });

    it('should handle mixed text', () => {
      expect(katakanaToHiragana('カタカナとひらがな')).toBe('かたかなとひらがな');
      expect(katakanaToHiragana('日本語テスト')).toBe('日本語てすと');
    });

    it('should preserve ASCII characters', () => {
      expect(katakanaToHiragana('Hello')).toBe('Hello');
      expect(katakanaToHiragana('Test123')).toBe('Test123');
    });

    it('should handle empty string', () => {
      expect(katakanaToHiragana('')).toBe('');
    });

    it('should convert special katakana characters', () => {
      expect(katakanaToHiragana('ガギグゲゴ')).toBe('がぎぐげご');
      expect(katakanaToHiragana('パピプペポ')).toBe('ぱぴぷぺぽ');
    });
  });

  describe('hiraganaToKatakana', () => {
    it('should convert hiragana to katakana', () => {
      expect(hiraganaToKatakana('あいうえお')).toBe('アイウエオ');
      expect(hiraganaToKatakana('かきくけこ')).toBe('カキクケコ');
    });

    it('should preserve katakana', () => {
      expect(hiraganaToKatakana('アイウエオ')).toBe('アイウエオ');
    });

    it('should handle mixed text', () => {
      expect(hiraganaToKatakana('ひらがなとカタカナ')).toBe('ヒラガナトカタカナ');
    });
  });

  describe('containsJapanese', () => {
    it('should return true for hiragana', () => {
      expect(containsJapanese('あいうえお')).toBe(true);
      expect(containsJapanese('hello あ')).toBe(true);
    });

    it('should return true for katakana', () => {
      expect(containsJapanese('アイウエオ')).toBe(true);
      expect(containsJapanese('hello ア')).toBe(true);
    });

    it('should return true for kanji', () => {
      expect(containsJapanese('漢字')).toBe(true);
      expect(containsJapanese('hello 日本')).toBe(true);
    });

    it('should return false for ASCII only', () => {
      expect(containsJapanese('hello world')).toBe(false);
      expect(containsJapanese('Test123!@#')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(containsJapanese('')).toBe(false);
    });
  });

  describe('isPrimarilyJapanese', () => {
    it('should return true when more than half is Japanese', () => {
      expect(isPrimarilyJapanese('こんにちは')).toBe(true);
      expect(isPrimarilyJapanese('日本語テスト')).toBe(true);
    });

    it('should return false when less than half is Japanese', () => {
      expect(isPrimarilyJapanese('hello worldあ')).toBe(false);
      expect(isPrimarilyJapanese('ABCDEFGあ')).toBe(false);
    });

    it('should ignore spaces and punctuation', () => {
      expect(isPrimarilyJapanese('こんにちは！！！')).toBe(true);
      expect(isPrimarilyJapanese('あ い う え お')).toBe(true);
    });

    it('should return false for empty string', () => {
      expect(isPrimarilyJapanese('')).toBe(false);
    });

    it('should return false for spaces only', () => {
      expect(isPrimarilyJapanese('   ')).toBe(false);
    });
  });

  describe('normalizeJapanese', () => {
    it('should convert katakana to hiragana', () => {
      expect(normalizeJapanese('カタカナ')).toBe('かたかな');
    });

    it('should convert full-width alphanumerics to half-width', () => {
      expect(normalizeJapanese('ＡＢＣ')).toBe('ABC');
      expect(normalizeJapanese('１２３')).toBe('123');
    });

    it('should trim whitespace', () => {
      expect(normalizeJapanese('  あいう  ')).toBe('あいう');
    });

    it('should handle combined conversions', () => {
      expect(normalizeJapanese('  カタカナＡＢＣ  ')).toBe('かたかなABC');
    });

    it('should preserve kanji', () => {
      expect(normalizeJapanese('漢字')).toBe('漢字');
    });
  });
});
