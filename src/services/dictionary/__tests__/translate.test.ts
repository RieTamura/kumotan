/**
 * 統合翻訳サービス テスト
 * JMdict + DeepLフォールバック機能のテスト
 */

import {
  translateToJapaneseWithFallback,
  translateToEnglishWithFallback,
  getTranslationServiceStatus,
  getRecommendedSource,
  detectTranslationDirection,
  translateWithAutoDetect,
} from '../translate';
import * as jmdict from '../jmdict';
import * as deepl from '../deepl';
import { ErrorCode } from '../../../utils/errors';

// Mock JMdict service
jest.mock('../jmdict', () => ({
  translateWithJMdict: jest.fn(),
  translateWithJMdictReverse: jest.fn(),
  isJMdictAvailable: jest.fn(),
  initJMdictDatabase: jest.fn(),
}));

// Mock DeepL service
jest.mock('../deepl', () => ({
  translateToJapanese: jest.fn(),
  translateToEnglish: jest.fn(),
  hasApiKey: jest.fn(),
}));

describe('Integrated Translation Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('translateToJapaneseWithFallback', () => {
    describe('Word-level translation (JMdict priority)', () => {
      it('should use JMdict for single word when available', async () => {
        (jmdict.isJMdictAvailable as jest.Mock).mockResolvedValue(true);
        (jmdict.translateWithJMdict as jest.Mock).mockResolvedValue({
          success: true,
          data: {
            text: '美しい',
            readings: ['うつくしい'],
            partOfSpeech: ['adjective'],
            isCommon: true,
            source: 'jmdict',
          },
        });

        const result = await translateToJapaneseWithFallback('beautiful');

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.text).toBe('美しい');
          expect(result.data.source).toBe('jmdict');
          expect(result.data.readings).toContain('うつくしい');
        }

        expect(jmdict.translateWithJMdict).toHaveBeenCalledWith('beautiful');
        expect(deepl.translateToJapanese).not.toHaveBeenCalled();
      });

      it('should fallback to DeepL when JMdict returns WORD_NOT_FOUND', async () => {
        (jmdict.isJMdictAvailable as jest.Mock).mockResolvedValue(true);
        (jmdict.translateWithJMdict as jest.Mock).mockResolvedValue({
          success: false,
          error: {
            code: ErrorCode.WORD_NOT_FOUND,
            message: '辞書に見つかりませんでした',
          },
        });
        (deepl.hasApiKey as jest.Mock).mockResolvedValue(true);
        (deepl.translateToJapanese as jest.Mock).mockResolvedValue({
          success: true,
          data: {
            text: 'スラング語',
            detectedLanguage: 'EN',
          },
        });

        const result = await translateToJapaneseWithFallback('slangword');

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.text).toBe('スラング語');
          expect(result.data.source).toBe('deepl');
        }

        expect(jmdict.translateWithJMdict).toHaveBeenCalled();
        expect(deepl.translateToJapanese).toHaveBeenCalled();
      });

      it('should return error when JMdict fails and DeepL not configured', async () => {
        (jmdict.isJMdictAvailable as jest.Mock).mockResolvedValue(true);
        (jmdict.translateWithJMdict as jest.Mock).mockResolvedValue({
          success: false,
          error: {
            code: ErrorCode.WORD_NOT_FOUND,
            message: '辞書に見つかりませんでした',
          },
        });
        (deepl.hasApiKey as jest.Mock).mockResolvedValue(false);

        const result = await translateToJapaneseWithFallback('unknownword');

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe(ErrorCode.WORD_NOT_FOUND);
          expect(result.error.message).toContain('DeepL');
        }
      });

      it('should initialize JMdict if not available', async () => {
        (jmdict.isJMdictAvailable as jest.Mock).mockResolvedValue(false);
        (jmdict.initJMdictDatabase as jest.Mock).mockResolvedValue({ success: true });
        (jmdict.translateWithJMdict as jest.Mock).mockResolvedValue({
          success: true,
          data: {
            text: '本',
            readings: ['ほん'],
            partOfSpeech: ['noun'],
            isCommon: true,
            source: 'jmdict',
          },
        });

        const result = await translateToJapaneseWithFallback('book');

        expect(jmdict.initJMdictDatabase).toHaveBeenCalled();
        expect(result.success).toBe(true);
      });
    });

    describe('Sentence-level translation (DeepL priority)', () => {
      it('should use DeepL for sentences when API key available', async () => {
        (deepl.hasApiKey as jest.Mock).mockResolvedValue(true);
        (deepl.translateToJapanese as jest.Mock).mockResolvedValue({
          success: true,
          data: {
            text: '今日はいい天気ですね',
            detectedLanguage: 'EN',
          },
        });

        const result = await translateToJapaneseWithFallback('It is a nice day today', {
          isWord: false,
        });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.text).toBe('今日はいい天気ですね');
          expect(result.data.source).toBe('deepl');
        }

        expect(jmdict.translateWithJMdict).not.toHaveBeenCalled();
        expect(deepl.translateToJapanese).toHaveBeenCalled();
      });

      it('should detect multi-word text automatically', async () => {
        (jmdict.isJMdictAvailable as jest.Mock).mockResolvedValue(true);
        (jmdict.translateWithJMdict as jest.Mock).mockResolvedValue({
          success: true,
          data: {
            text: 'ありがとう',
            readings: ['ありがとう'],
            partOfSpeech: ['expression'],
            isCommon: true,
            source: 'jmdict',
          },
        });

        // Two words should still try JMdict first
        await translateToJapaneseWithFallback('thank you');

        expect(jmdict.translateWithJMdict).toHaveBeenCalled();
      });

      it('should skip JMdict for longer text', async () => {
        (deepl.hasApiKey as jest.Mock).mockResolvedValue(true);
        (deepl.translateToJapanese as jest.Mock).mockResolvedValue({
          success: true,
          data: {
            text: '翻訳結果',
            detectedLanguage: 'EN',
          },
        });

        // Three or more words
        await translateToJapaneseWithFallback('this is a sentence');

        expect(jmdict.translateWithJMdict).not.toHaveBeenCalled();
        expect(deepl.translateToJapanese).toHaveBeenCalled();
      });
    });

    describe('Options handling', () => {
      it('should respect preferJMdict=false option', async () => {
        (deepl.hasApiKey as jest.Mock).mockResolvedValue(true);
        (deepl.translateToJapanese as jest.Mock).mockResolvedValue({
          success: true,
          data: {
            text: '愛',
            detectedLanguage: 'EN',
          },
        });

        await translateToJapaneseWithFallback('love', { preferJMdict: false });

        expect(jmdict.translateWithJMdict).not.toHaveBeenCalled();
        expect(deepl.translateToJapanese).toHaveBeenCalled();
      });

      it('should respect fallbackToDeepL=false option', async () => {
        (jmdict.isJMdictAvailable as jest.Mock).mockResolvedValue(true);
        (jmdict.translateWithJMdict as jest.Mock).mockResolvedValue({
          success: false,
          error: {
            code: ErrorCode.WORD_NOT_FOUND,
            message: '見つかりませんでした',
          },
        });

        const result = await translateToJapaneseWithFallback('rareword', {
          fallbackToDeepL: false,
        });

        expect(result.success).toBe(false);
        expect(deepl.translateToJapanese).not.toHaveBeenCalled();
      });

      it('should respect isWord option override', async () => {
        (jmdict.isJMdictAvailable as jest.Mock).mockResolvedValue(true);
        (jmdict.translateWithJMdict as jest.Mock).mockResolvedValue({
          success: true,
          data: {
            text: '結果',
            readings: ['けっか'],
            partOfSpeech: ['noun'],
            isCommon: true,
            source: 'jmdict',
          },
        });

        // Even multi-word input treated as word
        await translateToJapaneseWithFallback('the result', { isWord: true });

        expect(jmdict.translateWithJMdict).toHaveBeenCalled();
      });
    });

    describe('Input validation', () => {
      it('should return validation error for empty text', async () => {
        const result = await translateToJapaneseWithFallback('   ');

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe(ErrorCode.VALIDATION_ERROR);
          expect(result.error.message).toContain('入力');
        }
      });
    });

    describe('Error handling', () => {
      it('should fallback to DeepL on JMdict database error', async () => {
        (jmdict.isJMdictAvailable as jest.Mock).mockResolvedValue(true);
        (jmdict.translateWithJMdict as jest.Mock).mockResolvedValue({
          success: false,
          error: {
            code: ErrorCode.DATABASE_ERROR,
            message: 'Database error',
          },
        });
        (deepl.hasApiKey as jest.Mock).mockResolvedValue(true);
        (deepl.translateToJapanese as jest.Mock).mockResolvedValue({
          success: true,
          data: {
            text: '結果',
            detectedLanguage: 'EN',
          },
        });

        const result = await translateToJapaneseWithFallback('result');

        expect(result.success).toBe(true);
        expect(deepl.translateToJapanese).toHaveBeenCalled();
      });
    });
  });

  describe('getTranslationServiceStatus', () => {
    it('should return status of both services', async () => {
      (jmdict.isJMdictAvailable as jest.Mock).mockResolvedValue(true);
      (deepl.hasApiKey as jest.Mock).mockResolvedValue(true);

      const status = await getTranslationServiceStatus();

      expect(status.jmdict.available).toBe(true);
      expect(status.deepl.available).toBe(true);
      expect(status.deepl.apiKeyConfigured).toBe(true);
    });

    it('should reflect unavailable services', async () => {
      (jmdict.isJMdictAvailable as jest.Mock).mockResolvedValue(false);
      (deepl.hasApiKey as jest.Mock).mockResolvedValue(false);

      const status = await getTranslationServiceStatus();

      expect(status.jmdict.available).toBe(false);
      expect(status.deepl.available).toBe(false);
    });
  });

  describe('getRecommendedSource', () => {
    it('should recommend JMdict for single word when available', async () => {
      (jmdict.isJMdictAvailable as jest.Mock).mockResolvedValue(true);
      (deepl.hasApiKey as jest.Mock).mockResolvedValue(true);

      const source = await getRecommendedSource('hello');

      expect(source).toBe('jmdict');
    });

    it('should recommend DeepL for sentences', async () => {
      (jmdict.isJMdictAvailable as jest.Mock).mockResolvedValue(true);
      (deepl.hasApiKey as jest.Mock).mockResolvedValue(true);

      const source = await getRecommendedSource('this is a long sentence');

      expect(source).toBe('deepl');
    });

    it('should recommend DeepL when JMdict unavailable', async () => {
      (jmdict.isJMdictAvailable as jest.Mock).mockResolvedValue(false);
      (deepl.hasApiKey as jest.Mock).mockResolvedValue(true);

      const source = await getRecommendedSource('hello');

      expect(source).toBe('deepl');
    });

    it('should recommend JMdict when DeepL unavailable (word)', async () => {
      (jmdict.isJMdictAvailable as jest.Mock).mockResolvedValue(true);
      (deepl.hasApiKey as jest.Mock).mockResolvedValue(false);

      const source = await getRecommendedSource('hello');

      expect(source).toBe('jmdict');
    });

    it('should return none when both services unavailable', async () => {
      (jmdict.isJMdictAvailable as jest.Mock).mockResolvedValue(false);
      (deepl.hasApiKey as jest.Mock).mockResolvedValue(false);

      const source = await getRecommendedSource('hello');

      expect(source).toBe('none');
    });
  });

  describe('translateToEnglishWithFallback (Japanese to English)', () => {
    describe('Word-level translation (JMdict priority)', () => {
      it('should use JMdict reverse for Japanese word when available', async () => {
        (jmdict.isJMdictAvailable as jest.Mock).mockResolvedValue(true);
        (jmdict.translateWithJMdictReverse as jest.Mock).mockResolvedValue({
          success: true,
          data: {
            text: 'beautiful',
            originalJapanese: '美しい',
            reading: 'うつくしい',
            partOfSpeech: ['adjective'],
            isCommon: true,
            source: 'jmdict',
          },
        });

        const result = await translateToEnglishWithFallback('美しい');

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.text).toBe('beautiful');
          expect(result.data.source).toBe('jmdict');
          expect(result.data.readings).toContain('うつくしい');
        }

        expect(jmdict.translateWithJMdictReverse).toHaveBeenCalledWith('美しい');
        expect(deepl.translateToEnglish).not.toHaveBeenCalled();
      });

      it('should fallback to DeepL when JMdict returns WORD_NOT_FOUND', async () => {
        (jmdict.isJMdictAvailable as jest.Mock).mockResolvedValue(true);
        (jmdict.translateWithJMdictReverse as jest.Mock).mockResolvedValue({
          success: false,
          error: {
            code: ErrorCode.WORD_NOT_FOUND,
            message: '辞書に見つかりませんでした',
          },
        });
        (deepl.hasApiKey as jest.Mock).mockResolvedValue(true);
        (deepl.translateToEnglish as jest.Mock).mockResolvedValue({
          success: true,
          data: {
            text: 'slang word',
            detectedLanguage: 'JA',
          },
        });

        const result = await translateToEnglishWithFallback('スラング語');

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.text).toBe('slang word');
          expect(result.data.source).toBe('deepl');
        }

        expect(jmdict.translateWithJMdictReverse).toHaveBeenCalled();
        expect(deepl.translateToEnglish).toHaveBeenCalled();
      });

      it('should return error when JMdict fails and DeepL not configured', async () => {
        (jmdict.isJMdictAvailable as jest.Mock).mockResolvedValue(true);
        (jmdict.translateWithJMdictReverse as jest.Mock).mockResolvedValue({
          success: false,
          error: {
            code: ErrorCode.WORD_NOT_FOUND,
            message: '辞書に見つかりませんでした',
          },
        });
        (deepl.hasApiKey as jest.Mock).mockResolvedValue(false);

        const result = await translateToEnglishWithFallback('不明な単語');

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe(ErrorCode.WORD_NOT_FOUND);
          expect(result.error.message).toContain('DeepL');
        }
      });
    });

    describe('Input validation', () => {
      it('should return validation error for empty text', async () => {
        const result = await translateToEnglishWithFallback('   ');

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe(ErrorCode.VALIDATION_ERROR);
        }
      });

      it('should return validation error for non-Japanese text', async () => {
        const result = await translateToEnglishWithFallback('hello world');

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe(ErrorCode.VALIDATION_ERROR);
          expect(result.error.message).toContain('日本語');
        }
      });
    });

    describe('Options handling', () => {
      it('should respect preferJMdict=false option', async () => {
        (deepl.hasApiKey as jest.Mock).mockResolvedValue(true);
        (deepl.translateToEnglish as jest.Mock).mockResolvedValue({
          success: true,
          data: {
            text: 'love',
            detectedLanguage: 'JA',
          },
        });

        await translateToEnglishWithFallback('愛', { preferJMdict: false });

        expect(jmdict.translateWithJMdictReverse).not.toHaveBeenCalled();
        expect(deepl.translateToEnglish).toHaveBeenCalled();
      });

      it('should respect fallbackToDeepL=false option', async () => {
        (jmdict.isJMdictAvailable as jest.Mock).mockResolvedValue(true);
        (jmdict.translateWithJMdictReverse as jest.Mock).mockResolvedValue({
          success: false,
          error: {
            code: ErrorCode.WORD_NOT_FOUND,
            message: '見つかりませんでした',
          },
        });

        const result = await translateToEnglishWithFallback('珍しい単語', {
          fallbackToDeepL: false,
        });

        expect(result.success).toBe(false);
        expect(deepl.translateToEnglish).not.toHaveBeenCalled();
      });
    });
  });

  describe('detectTranslationDirection', () => {
    it('should detect Japanese to English direction', () => {
      expect(detectTranslationDirection('こんにちは')).toBe('ja-to-en');
      expect(detectTranslationDirection('日本語')).toBe('ja-to-en');
      expect(detectTranslationDirection('カタカナ')).toBe('ja-to-en');
    });

    it('should detect English to Japanese direction', () => {
      expect(detectTranslationDirection('hello')).toBe('en-to-ja');
      expect(detectTranslationDirection('world')).toBe('en-to-ja');
    });

    it('should treat mixed text as Japanese to English if contains Japanese', () => {
      expect(detectTranslationDirection('hello あ')).toBe('ja-to-en');
    });
  });

  describe('translateWithAutoDetect', () => {
    it('should translate Japanese to English', async () => {
      (jmdict.isJMdictAvailable as jest.Mock).mockResolvedValue(true);
      (jmdict.translateWithJMdictReverse as jest.Mock).mockResolvedValue({
        success: true,
        data: {
          text: 'love',
          originalJapanese: '愛',
          reading: 'あい',
          partOfSpeech: ['noun'],
          isCommon: true,
          source: 'jmdict',
        },
      });

      const result = await translateWithAutoDetect('愛');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.text).toBe('love');
      }
      expect(jmdict.translateWithJMdictReverse).toHaveBeenCalled();
    });

    it('should translate English to Japanese', async () => {
      (jmdict.isJMdictAvailable as jest.Mock).mockResolvedValue(true);
      (jmdict.translateWithJMdict as jest.Mock).mockResolvedValue({
        success: true,
        data: {
          text: '愛',
          readings: ['あい'],
          partOfSpeech: ['noun'],
          isCommon: true,
          source: 'jmdict',
        },
      });

      const result = await translateWithAutoDetect('love');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.text).toBe('愛');
      }
      expect(jmdict.translateWithJMdict).toHaveBeenCalled();
    });
  });
});
