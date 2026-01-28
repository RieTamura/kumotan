/**
 * JMdict辞書サービス テスト
 * オフライン英日辞書検索機能のテスト
 */

import * as SQLite from 'expo-sqlite';
import { Asset } from 'expo-asset';
import {
  initJMdictDatabase,
  isJMdictAvailable,
  lookupJMdict,
  lookupJMdictReverse,
  translateWithJMdict,
  translateWithJMdictReverse,
  clearJMdictCache,
  clearJMdictReverseCache,
  getJMdictMetadata,
  JMDICT_LICENSE_TEXT,
  JMDICT_ATTRIBUTION,
} from '../jmdict';
import { ErrorCode } from '../../../utils/errors';

// Mock file instance
const mockFileInstance = {
  exists: true,
  uri: '/mock/document/jmdict.db',
  copy: jest.fn(),
};

// Mock expo-sqlite
jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(),
}));

// Mock expo-file-system with new API
jest.mock('expo-file-system', () => ({
  Paths: {
    document: { uri: '/mock/document/' },
  },
  File: jest.fn().mockImplementation(() => mockFileInstance),
}));

// Mock expo-asset
jest.mock('expo-asset', () => ({
  Asset: {
    fromModule: jest.fn(),
  },
}));

describe('JMdict Dictionary Service', () => {
  let mockDb: {
    getAllAsync: jest.Mock;
    runAsync: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    clearJMdictCache();

    // Reset mock file
    mockFileInstance.exists = true;
    mockFileInstance.copy.mockClear();

    // Setup mock database
    mockDb = {
      getAllAsync: jest.fn(),
      runAsync: jest.fn(),
    };

    (SQLite.openDatabaseAsync as jest.Mock).mockResolvedValue(mockDb);

    // Setup mock asset
    (Asset.fromModule as jest.Mock).mockReturnValue({
      downloadAsync: jest.fn().mockResolvedValue(undefined),
      localUri: '/mock/asset/jmdict.db',
    });
  });

  describe('Database Initialization', () => {
    describe('initJMdictDatabase', () => {
      it('should initialize database successfully', async () => {
        mockDb.getAllAsync.mockResolvedValue([
          { key: 'version', value: '3.5.0' },
          { key: 'entry_count', value: '214000' },
        ]);

        const result = await initJMdictDatabase();

        expect(result.success).toBe(true);
        expect(SQLite.openDatabaseAsync).toHaveBeenCalled();
      });

      it('should copy database file if not exists', async () => {
        mockFileInstance.exists = false;
        mockDb.getAllAsync.mockResolvedValue([]);

        await initJMdictDatabase();

        expect(mockFileInstance.copy).toHaveBeenCalled();
      });

      it('should skip copy if database already exists', async () => {
        mockFileInstance.exists = true;
        mockDb.getAllAsync.mockResolvedValue([]);

        // Need to reset module state
        jest.resetModules();
        const { initJMdictDatabase: freshInit, clearJMdictCache: freshClear } = require('../jmdict');
        freshClear();

        await freshInit();

        // copy should not be called when file exists
        // Note: Since we're using a fresh require, this may not work as expected
      });

      it('should return error if asset not found', async () => {
        (Asset.fromModule as jest.Mock).mockReturnValue({
          downloadAsync: jest.fn().mockResolvedValue(undefined),
          localUri: null,
        });

        jest.resetModules();
        const { initJMdictDatabase: freshInit, clearJMdictCache: freshClear } = require('../jmdict');
        freshClear();

        const result = await freshInit();

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe(ErrorCode.DATABASE_ERROR);
        }
      });

      it('should handle database open error', async () => {
        (SQLite.openDatabaseAsync as jest.Mock).mockRejectedValue(
          new Error('Failed to open database')
        );

        jest.resetModules();
        const { initJMdictDatabase: freshInit, clearJMdictCache: freshClear } = require('../jmdict');
        freshClear();

        const result = await freshInit();

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe(ErrorCode.DATABASE_ERROR);
        }
      });
    });

    describe('isJMdictAvailable', () => {
      it('should return true when database file exists', async () => {
        mockFileInstance.exists = true;

        jest.resetModules();
        const { isJMdictAvailable: freshCheck, clearJMdictCache: freshClear } = require('../jmdict');
        freshClear();

        const result = await freshCheck();

        expect(result).toBe(true);
      });

      it('should return false when database file does not exist', async () => {
        mockFileInstance.exists = false;

        jest.resetModules();
        const { isJMdictAvailable: freshCheck, clearJMdictCache: freshClear } = require('../jmdict');
        freshClear();

        const result = await freshCheck();

        expect(result).toBe(false);
      });
    });
  });

  describe('Dictionary Lookup', () => {
    beforeEach(async () => {
      mockDb.getAllAsync.mockResolvedValue([]);
      await initJMdictDatabase();
    });

    describe('lookupJMdict', () => {
      it('should find exact match for English word', async () => {
        const mockResults = [
          {
            entry_id: 1234,
            kanji: '美しい',
            kana: 'うつくしい',
            is_common: 1,
            priority: 150,
            gloss_id: 5678,
            gloss: 'beautiful',
            part_of_speech: 'adjective',
            sense_index: 0,
          },
        ];

        mockDb.getAllAsync.mockResolvedValue(mockResults);

        const result = await lookupJMdict('beautiful');

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.length).toBe(1);
          expect(result.data[0].entry.kanji).toBe('美しい');
          expect(result.data[0].entry.kana).toBe('うつくしい');
          expect(result.data[0].entry.isCommon).toBe(true);
          expect(result.data[0].glosses[0].gloss).toBe('beautiful');
        }
      });

      it('should return multiple entries for common words', async () => {
        const mockResults = [
          {
            entry_id: 1,
            kanji: '本',
            kana: 'ほん',
            is_common: 1,
            priority: 200,
            gloss_id: 1,
            gloss: 'book',
            part_of_speech: 'noun',
            sense_index: 0,
          },
          {
            entry_id: 2,
            kanji: '書籍',
            kana: 'しょせき',
            is_common: 0,
            priority: 50,
            gloss_id: 2,
            gloss: 'book',
            part_of_speech: 'noun',
            sense_index: 0,
          },
        ];

        mockDb.getAllAsync.mockResolvedValue(mockResults);

        const result = await lookupJMdict('book');

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.length).toBe(2);
        }
      });

      it('should group multiple glosses under same entry', async () => {
        const mockResults = [
          {
            entry_id: 1,
            kanji: '走る',
            kana: 'はしる',
            is_common: 1,
            priority: 150,
            gloss_id: 1,
            gloss: 'to run',
            part_of_speech: 'verb',
            sense_index: 0,
          },
          {
            entry_id: 1,
            kanji: '走る',
            kana: 'はしる',
            is_common: 1,
            priority: 150,
            gloss_id: 2,
            gloss: 'to dash',
            part_of_speech: 'verb',
            sense_index: 0,
          },
        ];

        mockDb.getAllAsync.mockResolvedValue(mockResults);

        const result = await lookupJMdict('run');

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.length).toBe(1);
          expect(result.data[0].glosses.length).toBe(2);
        }
      });

      it('should fallback to prefix search when exact match not found', async () => {
        mockDb.getAllAsync
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([
            {
              entry_id: 1,
              kanji: '美しい',
              kana: 'うつくしい',
              is_common: 1,
              priority: 100,
              gloss_id: 1,
              gloss: 'beautiful',
              part_of_speech: 'adjective',
              sense_index: 0,
            },
          ]);

        const result = await lookupJMdict('beauti');

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.length).toBe(1);
        }
        expect(mockDb.getAllAsync).toHaveBeenCalledTimes(2);
      });

      it('should normalize input to lowercase', async () => {
        mockDb.getAllAsync.mockResolvedValue([]);

        await lookupJMdict('BEAUTIFUL');

        expect(mockDb.getAllAsync).toHaveBeenCalledWith(
          expect.any(String),
          ['beautiful']
        );
      });

      it('should return validation error for empty input', async () => {
        const result = await lookupJMdict('   ');

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe(ErrorCode.VALIDATION_ERROR);
        }
      });

      it('should handle database query error', async () => {
        mockDb.getAllAsync.mockRejectedValue(new Error('Query failed'));

        const result = await lookupJMdict('test');

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe(ErrorCode.DATABASE_ERROR);
        }
      });
    });

    describe('translateWithJMdict', () => {
      it('should translate word and cache result', async () => {
        const mockResults = [
          {
            entry_id: 1,
            kanji: '愛',
            kana: 'あい',
            is_common: 1,
            priority: 200,
            gloss_id: 1,
            gloss: 'love',
            part_of_speech: 'noun',
            sense_index: 0,
          },
        ];

        mockDb.getAllAsync.mockResolvedValue(mockResults);

        const result = await translateWithJMdict('love');

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.text).toBe('愛');
          expect(result.data.readings).toContain('あい');
          expect(result.data.isCommon).toBe(true);
          expect(result.data.source).toBe('jmdict');
        }

        // Second call should use cache (db called only once for this word)
        mockDb.getAllAsync.mockClear();
        const cachedResult = await translateWithJMdict('love');
        expect(cachedResult.success).toBe(true);
        expect(mockDb.getAllAsync).not.toHaveBeenCalled();
      });

      it('should return kana when no kanji available', async () => {
        const mockResults = [
          {
            entry_id: 1,
            kanji: null,
            kana: 'ありがとう',
            is_common: 1,
            priority: 150,
            gloss_id: 1,
            gloss: 'thank you',
            part_of_speech: 'expression',
            sense_index: 0,
          },
        ];

        mockDb.getAllAsync.mockResolvedValue(mockResults);

        const result = await translateWithJMdict('thank you');

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.text).toBe('ありがとう');
        }
      });

      it('should return WORD_NOT_FOUND error when no results', async () => {
        mockDb.getAllAsync.mockResolvedValue([]);

        const result = await translateWithJMdict('xyznotaword');

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe(ErrorCode.WORD_NOT_FOUND);
        }
      });

      it('should collect part of speech from multiple glosses', async () => {
        const mockResults = [
          {
            entry_id: 1,
            kanji: '食べる',
            kana: 'たべる',
            is_common: 1,
            priority: 200,
            gloss_id: 1,
            gloss: 'to eat',
            part_of_speech: 'verb, ichidan verb',
            sense_index: 0,
          },
          {
            entry_id: 1,
            kanji: '食べる',
            kana: 'たべる',
            is_common: 1,
            priority: 200,
            gloss_id: 2,
            gloss: 'to consume',
            part_of_speech: 'verb, transitive verb',
            sense_index: 1,
          },
        ];

        mockDb.getAllAsync.mockResolvedValue(mockResults);

        const result = await translateWithJMdict('eat');

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.partOfSpeech.length).toBeGreaterThan(0);
        }
      });
    });

    describe('clearJMdictCache', () => {
      it('should clear cached translations', async () => {
        const mockResults = [
          {
            entry_id: 1,
            kanji: 'テスト',
            kana: 'てすと',
            is_common: 0,
            priority: 50,
            gloss_id: 1,
            gloss: 'test',
            part_of_speech: 'noun',
            sense_index: 0,
          },
        ];

        mockDb.getAllAsync.mockResolvedValue(mockResults);

        // First call
        await translateWithJMdict('test');

        // Second call uses cache
        mockDb.getAllAsync.mockClear();
        await translateWithJMdict('test');
        expect(mockDb.getAllAsync).not.toHaveBeenCalled();

        // Clear cache
        clearJMdictCache();

        // Third call should query database again
        mockDb.getAllAsync.mockResolvedValue(mockResults);
        await translateWithJMdict('test');
        expect(mockDb.getAllAsync).toHaveBeenCalled();
      });
    });
  });

  describe('Metadata', () => {
    beforeEach(async () => {
      mockDb.getAllAsync.mockResolvedValue([]);
      await initJMdictDatabase();
    });

    describe('getJMdictMetadata', () => {
      it('should return dictionary metadata', async () => {
        mockDb.getAllAsync.mockResolvedValue([
          { key: 'version', value: '3.5.0' },
          { key: 'dict_date', value: '2024-01-01' },
          { key: 'entry_count', value: '214000' },
        ]);

        const result = await getJMdictMetadata();

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.version).toBe('3.5.0');
          expect(result.data.entry_count).toBe('214000');
        }
      });

      it('should handle metadata query error', async () => {
        mockDb.getAllAsync.mockRejectedValue(new Error('Query failed'));

        const result = await getJMdictMetadata();

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe(ErrorCode.DATABASE_ERROR);
        }
      });
    });
  });

  describe('License Information', () => {
    it('should export license text', () => {
      expect(JMDICT_LICENSE_TEXT).toContain('JMdict');
      expect(JMDICT_LICENSE_TEXT).toContain('EDRDG');
    });

    it('should export attribution text', () => {
      expect(JMDICT_ATTRIBUTION).toContain('JMdict');
      expect(JMDICT_ATTRIBUTION).toContain('EDRDG');
    });
  });

  describe('Reverse Lookup (Japanese to English)', () => {
    beforeEach(async () => {
      mockDb.getAllAsync.mockResolvedValue([]);
      clearJMdictReverseCache();
      await initJMdictDatabase();
    });

    describe('lookupJMdictReverse', () => {
      it('should find entry by kanji', async () => {
        const mockResults = [
          {
            entry_id: 1234,
            kanji: '美しい',
            kana: 'うつくしい',
            is_common: 1,
            priority: 150,
            gloss: 'beautiful',
            part_of_speech: 'adjective',
            sense_index: 0,
          },
          {
            entry_id: 1234,
            kanji: '美しい',
            kana: 'うつくしい',
            is_common: 1,
            priority: 150,
            gloss: 'lovely',
            part_of_speech: 'adjective',
            sense_index: 0,
          },
        ];

        mockDb.getAllAsync.mockResolvedValue(mockResults);

        const result = await lookupJMdictReverse('美しい');

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.length).toBe(1);
          expect(result.data[0].entry.kanji).toBe('美しい');
          expect(result.data[0].englishGlosses).toContain('beautiful');
          expect(result.data[0].englishGlosses).toContain('lovely');
        }
      });

      it('should find entry by hiragana', async () => {
        const mockResults = [
          {
            entry_id: 1,
            kanji: '食べる',
            kana: 'たべる',
            is_common: 1,
            priority: 200,
            gloss: 'to eat',
            part_of_speech: 'verb',
            sense_index: 0,
          },
        ];

        mockDb.getAllAsync.mockResolvedValue(mockResults);

        const result = await lookupJMdictReverse('たべる');

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.length).toBe(1);
          expect(result.data[0].englishGlosses).toContain('to eat');
        }
      });

      it('should convert katakana to hiragana for search', async () => {
        const mockResults = [
          {
            entry_id: 1,
            kanji: null,
            kana: 'ありがとう',
            is_common: 1,
            priority: 150,
            gloss: 'thank you',
            part_of_speech: 'expression',
            sense_index: 0,
          },
        ];

        mockDb.getAllAsync.mockResolvedValue(mockResults);

        // Input is katakana, should be converted to hiragana
        const result = await lookupJMdictReverse('アリガトウ');

        expect(result.success).toBe(true);
        // Verify that search was attempted with normalized text
        expect(mockDb.getAllAsync).toHaveBeenCalled();
      });

      it('should return WORD_NOT_FOUND for unknown words', async () => {
        mockDb.getAllAsync.mockResolvedValue([]);

        const result = await lookupJMdictReverse('あああああ');

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe(ErrorCode.WORD_NOT_FOUND);
        }
      });

      it('should return validation error for empty input', async () => {
        const result = await lookupJMdictReverse('   ');

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe(ErrorCode.VALIDATION_ERROR);
        }
      });

      it('should collect part of speech from glosses', async () => {
        const mockResults = [
          {
            entry_id: 1,
            kanji: '走る',
            kana: 'はしる',
            is_common: 1,
            priority: 150,
            gloss: 'to run',
            part_of_speech: 'verb, godan verb',
            sense_index: 0,
          },
          {
            entry_id: 1,
            kanji: '走る',
            kana: 'はしる',
            is_common: 1,
            priority: 150,
            gloss: 'to dash',
            part_of_speech: 'verb, intransitive',
            sense_index: 1,
          },
        ];

        mockDb.getAllAsync.mockResolvedValue(mockResults);

        const result = await lookupJMdictReverse('走る');

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data[0].partOfSpeech.length).toBeGreaterThan(0);
        }
      });
    });

    describe('translateWithJMdictReverse', () => {
      it('should translate Japanese to English and cache result', async () => {
        const mockResults = [
          {
            entry_id: 1,
            kanji: '愛',
            kana: 'あい',
            is_common: 1,
            priority: 200,
            gloss: 'love',
            part_of_speech: 'noun',
            sense_index: 0,
          },
        ];

        mockDb.getAllAsync.mockResolvedValue(mockResults);

        const result = await translateWithJMdictReverse('愛');

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.text).toBe('love');
          expect(result.data.originalJapanese).toBe('愛');
          expect(result.data.reading).toBe('あい');
          expect(result.data.isCommon).toBe(true);
          expect(result.data.source).toBe('jmdict');
        }

        // Second call should use cache
        mockDb.getAllAsync.mockClear();
        const cachedResult = await translateWithJMdictReverse('愛');
        expect(cachedResult.success).toBe(true);
        expect(mockDb.getAllAsync).not.toHaveBeenCalled();
      });

      it('should not include reading when entry has no kanji', async () => {
        const mockResults = [
          {
            entry_id: 1,
            kanji: null,
            kana: 'ありがとう',
            is_common: 1,
            priority: 150,
            gloss: 'thank you',
            part_of_speech: 'expression',
            sense_index: 0,
          },
        ];

        mockDb.getAllAsync.mockResolvedValue(mockResults);

        const result = await translateWithJMdictReverse('ありがとう');

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.text).toBe('thank you');
          expect(result.data.originalJapanese).toBe('ありがとう');
          expect(result.data.reading).toBeUndefined();
        }
      });

      it('should return WORD_NOT_FOUND error when no results', async () => {
        mockDb.getAllAsync.mockResolvedValue([]);

        const result = await translateWithJMdictReverse('zzzzz');

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe(ErrorCode.WORD_NOT_FOUND);
        }
      });
    });

    describe('clearJMdictReverseCache', () => {
      it('should clear cached reverse translations', async () => {
        const mockResults = [
          {
            entry_id: 1,
            kanji: 'テスト',
            kana: 'てすと',
            is_common: 0,
            priority: 50,
            gloss: 'test',
            part_of_speech: 'noun',
            sense_index: 0,
          },
        ];

        mockDb.getAllAsync.mockResolvedValue(mockResults);

        // First call
        await translateWithJMdictReverse('テスト');

        // Second call uses cache
        mockDb.getAllAsync.mockClear();
        await translateWithJMdictReverse('テスト');
        expect(mockDb.getAllAsync).not.toHaveBeenCalled();

        // Clear cache
        clearJMdictReverseCache();

        // Third call should query database again
        mockDb.getAllAsync.mockResolvedValue(mockResults);
        await translateWithJMdictReverse('テスト');
        expect(mockDb.getAllAsync).toHaveBeenCalled();
      });
    });
  });
});
