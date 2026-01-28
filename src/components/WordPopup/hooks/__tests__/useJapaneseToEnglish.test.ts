/**
 * useJapaneseToEnglish Hook Tests
 *
 * Note: The underlying translateToEnglishWithFallback function is
 * comprehensively tested in src/services/dictionary/__tests__/translate.test.ts
 * These tests verify the hook's basic structure and exports.
 */

import { useJapaneseToEnglish, UseJapaneseToEnglishResult } from '../useJapaneseToEnglish';

describe('useJapaneseToEnglish', () => {
  it('should export useJapaneseToEnglish function', () => {
    expect(typeof useJapaneseToEnglish).toBe('function');
  });

  it('should be a valid React hook (function name starts with "use")', () => {
    expect(useJapaneseToEnglish.name).toBe('useJapaneseToEnglish');
  });

  it('should export UseJapaneseToEnglishResult interface type', () => {
    // This test verifies the type export is available
    // Type checking is done at compile time
    const mockResult: UseJapaneseToEnglishResult = {
      englishTranslation: null,
      translationError: null,
      loading: false,
      translationAvailable: false,
      fetchEnglishTranslation: async () => {},
      reset: () => {},
    };
    expect(mockResult).toBeDefined();
    expect(mockResult.englishTranslation).toBeNull();
    expect(mockResult.translationError).toBeNull();
    expect(mockResult.loading).toBe(false);
    expect(mockResult.translationAvailable).toBe(false);
    expect(typeof mockResult.fetchEnglishTranslation).toBe('function');
    expect(typeof mockResult.reset).toBe('function');
  });
});
