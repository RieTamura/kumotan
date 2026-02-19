/**
 * DeepL API Service Tests
 * Tests translation functionality, API key management, and error handling
 */

import * as SecureStore from 'expo-secure-store';
import {
  getApiKey,
  saveApiKey,
  deleteApiKey,
  hasApiKey,
  validateApiKey,
  getUsage,
  translateToJapanese,
  isUsageWarning,
  isUsageCritical,
  formatUsage,
  clearDeeplCache,
} from '../deepl';
import { ErrorCode } from '../../../utils/errors';
import { STORAGE_KEYS } from '../../../constants/config';

// Mock expo-secure-store
jest.mock('expo-secure-store');

// Mock fetch
global.fetch = jest.fn();

describe('DeepL API Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    clearDeeplCache();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('API Key Management', () => {
    describe('getApiKey', () => {
      it('should return API key when stored', async () => {
        const mockKey = 'test-deepl-key:fx';
        (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(mockKey);

        const result = await getApiKey();

        expect(result).toBe(mockKey);
        expect(SecureStore.getItemAsync).toHaveBeenCalledWith(STORAGE_KEYS.DEEPL_API_KEY);
      });

      it('should return null when no key stored', async () => {
        (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

        const result = await getApiKey();

        expect(result).toBeNull();
      });

      it('should return null on storage error', async () => {
        (SecureStore.getItemAsync as jest.Mock).mockRejectedValue(new Error('Storage error'));

        const result = await getApiKey();

        expect(result).toBeNull();
      });
    });

    describe('saveApiKey', () => {
      it('should save API key successfully', async () => {
        const mockKey = 'test-deepl-key:fx';
        (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);

        const result = await saveApiKey(mockKey);

        expect(result.success).toBe(true);
        expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
          STORAGE_KEYS.DEEPL_API_KEY,
          mockKey
        );
      });

      it('should return error on storage failure', async () => {
        const mockKey = 'test-deepl-key:fx';
        (SecureStore.setItemAsync as jest.Mock).mockRejectedValue(new Error('Storage error'));

        const result = await saveApiKey(mockKey);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe(ErrorCode.DATABASE_ERROR);
          expect(result.error.message).toContain('保存に失敗');
        }
      });
    });

    describe('deleteApiKey', () => {
      it('should delete API key successfully', async () => {
        (SecureStore.deleteItemAsync as jest.Mock).mockResolvedValue(undefined);

        const result = await deleteApiKey();

        expect(result.success).toBe(true);
        expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(STORAGE_KEYS.DEEPL_API_KEY);
      });

      it('should return error on deletion failure', async () => {
        (SecureStore.deleteItemAsync as jest.Mock).mockRejectedValue(new Error('Storage error'));

        const result = await deleteApiKey();

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe(ErrorCode.DATABASE_ERROR);
          expect(result.error.message).toContain('削除に失敗');
        }
      });
    });

    describe('hasApiKey', () => {
      it('should return true when API key exists', async () => {
        (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('test-key');

        const result = await hasApiKey();

        expect(result).toBe(true);
      });

      it('should return false when no API key', async () => {
        (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

        const result = await hasApiKey();

        expect(result).toBe(false);
      });

      it('should return false when API key is empty', async () => {
        (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('');

        const result = await hasApiKey();

        expect(result).toBe(false);
      });
    });
  });

  describe('API Validation', () => {
    describe('validateApiKey', () => {
      it('should validate correct API key and return usage', async () => {
        const mockUsageResponse = {
          character_count: 100000,
          character_limit: 500000,
        };

        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => mockUsageResponse,
        });

        const result = await validateApiKey('test-key:fx');

        jest.runAllTimers();

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.characterCount).toBe(100000);
          expect(result.data.characterLimit).toBe(500000);
          expect(result.data.usagePercentage).toBe(20);
        }
      });

      it('should return error for invalid API key (403)', async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
          ok: false,
          status: 403,
        });

        const result = await validateApiKey('invalid-key');

        jest.runAllTimers();

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe(ErrorCode.AUTH_FAILED);
          expect(result.error.message).toContain('無効');
        }
      });

      it('should return error for quota exceeded (456)', async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
          ok: false,
          status: 456,
        });

        const result = await validateApiKey('test-key:fx');

        jest.runAllTimers();

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe(ErrorCode.QUOTA_EXCEEDED);
          expect(result.error.message).toContain('上限');
        }
      });

      it('should handle timeout', async () => {
        (global.fetch as jest.Mock).mockImplementation(
          () =>
            new Promise((_, reject) => {
              setTimeout(() => {
                const error = new Error('The operation was aborted');
                error.name = 'AbortError';
                reject(error);
              }, 10000);
            })
        );

        const promise = validateApiKey('test-key:fx');
        jest.advanceTimersByTime(10000);

        const result = await promise;

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe(ErrorCode.TIMEOUT);
        }
      });

      it('should handle network error', async () => {
        (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

        const result = await validateApiKey('test-key:fx');

        jest.runAllTimers();

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe(ErrorCode.NETWORK_ERROR);
          expect(result.error.message).toContain('ネットワーク');
        }
      });
    });

    describe('getUsage', () => {
      it('should return error when no API key configured', async () => {
        (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

        const result = await getUsage();

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe(ErrorCode.AUTH_FAILED);
          expect(result.error.message).toContain('設定されていません');
        }
      });

      it('should return usage when API key exists', async () => {
        (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('test-key:fx');
        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          json: async () => ({
            character_count: 250000,
            character_limit: 500000,
          }),
        });

        const result = await getUsage();

        jest.runAllTimers();

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.usagePercentage).toBe(50);
        }
      });
    });
  });

  describe('Translation', () => {
    describe('translateToJapanese', () => {
      beforeEach(() => {
        (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('test-key:fx');
      });

      it('should translate English to Japanese successfully', async () => {
        const mockTranslateResponse = {
          translations: [
            {
              detected_source_language: 'EN',
              text: 'こんにちは',
            },
          ],
        };

        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          json: async () => mockTranslateResponse,
        });

        const result = await translateToJapanese('hello');

        jest.runAllTimers();

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.text).toBe('こんにちは');
          expect(result.data.detectedLanguage).toBe('EN');
        }
      });

      it('should return error when no API key', async () => {
        (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

        const result = await translateToJapanese('hello');

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe(ErrorCode.AUTH_FAILED);
          expect(result.error.message).toContain('設定されていません');
        }
      });

      it('should validate input text (empty)', async () => {
        const result = await translateToJapanese('   ');

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe(ErrorCode.VALIDATION_ERROR);
          expect(result.error.message).toContain('入力');
        }
      });

      it('should validate input text (too long)', async () => {
        const longText = 'a'.repeat(5001);

        const result = await translateToJapanese(longText);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe(ErrorCode.VALIDATION_ERROR);
          expect(result.error.message).toContain('長すぎます');
        }
      });

      it('should handle invalid API key during translation', async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
          ok: false,
          status: 403,
        });

        const result = await translateToJapanese('hello');

        jest.runAllTimers();

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe(ErrorCode.AUTH_FAILED);
          expect(result.error.message).toContain('無効');
        }
      });

      it('should handle quota exceeded during translation', async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
          ok: false,
          status: 456,
        });

        const result = await translateToJapanese('hello');

        jest.runAllTimers();

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe(ErrorCode.QUOTA_EXCEEDED);
          expect(result.error.message).toContain('上限');
        }
      });

      it('should handle rate limit', async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
          ok: false,
          status: 429,
        });

        const result = await translateToJapanese('hello');

        jest.runAllTimers();

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe(ErrorCode.RATE_LIMIT);
          expect(result.error.message).toContain('制限');
        }
      });

      it('should handle timeout', async () => {
        const abortError = new Error('The operation was aborted');
        abortError.name = 'AbortError';
        (global.fetch as jest.Mock).mockRejectedValue(abortError);

        const result = await translateToJapanese('hello');

        jest.runAllTimers();

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe(ErrorCode.TIMEOUT);
        }
      });

      it('should handle empty translation response', async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          json: async () => ({ translations: [] }),
        });

        const result = await translateToJapanese('hello');

        jest.runAllTimers();

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe(ErrorCode.API_ERROR);
          expect(result.error.message).toContain('取得できませんでした');
        }
      });

      it('should handle network error', async () => {
        (global.fetch as jest.Mock).mockRejectedValue(new Error('Network failure'));

        const result = await translateToJapanese('hello');

        jest.runAllTimers();

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe(ErrorCode.NETWORK_ERROR);
        }
      });
    });
  });

  describe('Usage Utilities', () => {
    describe('isUsageWarning', () => {
      it('should return true when usage >= 80%', () => {
        const usage = {
          characterCount: 400000,
          characterLimit: 500000,
          usagePercentage: 80,
        };

        expect(isUsageWarning(usage)).toBe(true);
      });

      it('should return false when usage < 80%', () => {
        const usage = {
          characterCount: 300000,
          characterLimit: 500000,
          usagePercentage: 60,
        };

        expect(isUsageWarning(usage)).toBe(false);
      });
    });

    describe('isUsageCritical', () => {
      it('should return true when usage >= 95%', () => {
        const usage = {
          characterCount: 475000,
          characterLimit: 500000,
          usagePercentage: 95,
        };

        expect(isUsageCritical(usage)).toBe(true);
      });

      it('should return false when usage < 95%', () => {
        const usage = {
          characterCount: 450000,
          characterLimit: 500000,
          usagePercentage: 90,
        };

        expect(isUsageCritical(usage)).toBe(false);
      });
    });

    describe('formatUsage', () => {
      it('should format usage correctly', () => {
        const usage = {
          characterCount: 123456,
          characterLimit: 500000,
          usagePercentage: 25,
        };

        const formatted = formatUsage(usage);

        expect(formatted).toContain('123,456');
        expect(formatted).toContain('500,000');
        expect(formatted).toContain('25%');
      });

      it('should handle zero usage', () => {
        const usage = {
          characterCount: 0,
          characterLimit: 500000,
          usagePercentage: 0,
        };

        const formatted = formatUsage(usage);

        expect(formatted).toContain('0');
        expect(formatted).toContain('500,000');
        expect(formatted).toContain('0%');
      });
    });
  });
});
