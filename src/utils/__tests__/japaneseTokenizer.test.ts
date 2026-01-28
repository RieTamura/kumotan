/**
 * Japanese Tokenizer Tests
 */

import {
  tokenizeJapanese,
  tokenizeJapaneseSimple,
  containsJapanese,
  isMeaningfulToken,
  JapaneseToken,
} from '../japaneseTokenizer';

describe('tokenizeJapanese', () => {
  it('should tokenize kanji text', () => {
    const result = tokenizeJapanese('美術館');
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ text: '美術館', type: 'kanji' });
  });

  it('should tokenize hiragana text', () => {
    const result = tokenizeJapanese('ください');
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ text: 'ください', type: 'hiragana' });
  });

  it('should tokenize katakana text', () => {
    const result = tokenizeJapanese('コンピューター');
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ text: 'コンピューター', type: 'katakana' });
  });

  it('should tokenize kanji with okurigana', () => {
    const result = tokenizeJapanese('美しい');
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ text: '美しい', type: 'kanji' });
  });

  it('should tokenize mixed text with different character types', () => {
    // Without morphological analysis, kanji+hiragana is treated as one token
    // This tests text with clear boundaries (kanji, katakana, hiragana blocks)
    const result = tokenizeJapanese('日本語とカタカナ');
    // Should split at character type boundaries
    expect(result.length).toBeGreaterThan(1);
    expect(result.some(t => t.type === 'katakana')).toBe(true);
  });

  it('should handle punctuation', () => {
    const result = tokenizeJapanese('こんにちは！');
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ text: 'こんにちは', type: 'hiragana' });
    expect(result[1]).toEqual({ text: '！', type: 'punctuation' });
  });

  it('should return empty array for empty input', () => {
    expect(tokenizeJapanese('')).toEqual([]);
  });

  it('should handle single character', () => {
    const result = tokenizeJapanese('猫');
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ text: '猫', type: 'kanji' });
  });
});

describe('tokenizeJapaneseSimple', () => {
  it('should return array of strings', () => {
    const result = tokenizeJapaneseSimple('美しい空');
    expect(result).toBeInstanceOf(Array);
    expect(result.every(t => typeof t === 'string')).toBe(true);
  });

  it('should tokenize correctly with different character types', () => {
    // Text with clear type boundaries: kanji + katakana
    const result = tokenizeJapaneseSimple('猫とネコ');
    expect(result.length).toBeGreaterThan(1);
    expect(result).toContain('ネコ');
  });
});

describe('containsJapanese', () => {
  it('should return true for hiragana', () => {
    expect(containsJapanese('こんにちは')).toBe(true);
  });

  it('should return true for katakana', () => {
    expect(containsJapanese('コンピューター')).toBe(true);
  });

  it('should return true for kanji', () => {
    expect(containsJapanese('日本語')).toBe(true);
  });

  it('should return true for mixed Japanese and English', () => {
    expect(containsJapanese('Hello こんにちは')).toBe(true);
  });

  it('should return false for English only', () => {
    expect(containsJapanese('Hello World')).toBe(false);
  });

  it('should return false for numbers only', () => {
    expect(containsJapanese('12345')).toBe(false);
  });

  it('should return false for empty string', () => {
    expect(containsJapanese('')).toBe(false);
  });
});

describe('isMeaningfulToken', () => {
  it('should return true for kanji token', () => {
    const token: JapaneseToken = { text: '猫', type: 'kanji' };
    expect(isMeaningfulToken(token)).toBe(true);
  });

  it('should return true for hiragana token', () => {
    const token: JapaneseToken = { text: 'する', type: 'hiragana' };
    expect(isMeaningfulToken(token)).toBe(true);
  });

  it('should return true for katakana token', () => {
    const token: JapaneseToken = { text: 'ネコ', type: 'katakana' };
    expect(isMeaningfulToken(token)).toBe(true);
  });

  it('should return false for punctuation token', () => {
    const token: JapaneseToken = { text: '。', type: 'punctuation' };
    expect(isMeaningfulToken(token)).toBe(false);
  });

  it('should return false for other token', () => {
    const token: JapaneseToken = { text: ' ', type: 'other' };
    expect(isMeaningfulToken(token)).toBe(false);
  });

  it('should return false for whitespace-only token', () => {
    const token: JapaneseToken = { text: '  ', type: 'hiragana' };
    expect(isMeaningfulToken(token)).toBe(false);
  });
});
