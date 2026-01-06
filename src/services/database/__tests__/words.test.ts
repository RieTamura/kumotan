/**
 * Words Database Service Tests
 * Tests all database operations with SQL injection protection
 */

import * as SQLite from 'expo-sqlite';
import {
  setDatabase,
  insertWord,
  addWord,
  getWords,
  getWordById,
  findWordByEnglish,
  toggleReadStatus,
  deleteWord,
  getTotalWordCount,
  getReadWordCount,
  getTodayReadCount,
  deleteAllWords,
  exportWords,
} from '../words';
import { Word, CreateWordInput } from '../../../types/word';
import { ErrorCode } from '../../../utils/errors';

// Mock sanitizeWord to test SQL injection protection
jest.mock('../../../utils/validators', () => ({
  sanitizeWord: jest.fn((word: string) => word.trim().toLowerCase()),
}));

describe('Words Database Service', () => {
  let mockDb: jest.Mocked<SQLite.SQLiteDatabase>;

  beforeEach(() => {
    // Create a fresh mock database for each test
    mockDb = {
      runAsync: jest.fn(),
      getFirstAsync: jest.fn(),
      getAllAsync: jest.fn(),
      execAsync: jest.fn(),
      withTransactionAsync: jest.fn(),
      closeAsync: jest.fn(),
    } as unknown as jest.Mocked<SQLite.SQLiteDatabase>;

    setDatabase(mockDb);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('insertWord', () => {
    const validInput: CreateWordInput = {
      english: 'hello',
      japanese: 'こんにちは',
      definition: 'a greeting',
      postUrl: 'https://example.com',
      postText: 'Sample post',
    };

    it('should insert a new word successfully', async () => {
      // Mock: no duplicate exists
      mockDb.getFirstAsync.mockResolvedValueOnce(null);

      // Mock: successful insert with ID 1
      mockDb.runAsync.mockResolvedValueOnce({
        lastInsertRowId: 1,
        changes: 1,
      });

      // Mock: retrieve inserted word
      const mockWord = {
        id: 1,
        english: 'hello',
        japanese: 'こんにちは',
        definition: 'a greeting',
        post_url: 'https://example.com',
        post_text: 'Sample post',
        is_read: 0,
        created_at: '2026-01-06 10:00:00',
        read_at: null,
      };
      mockDb.getFirstAsync.mockResolvedValueOnce(mockWord);

      const result = await insertWord(validInput);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.english).toBe('hello');
        expect(result.data.japanese).toBe('こんにちは');
        expect(result.data.isRead).toBe(false);
      }

      // Verify SQL queries used placeholders
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO words'),
        expect.arrayContaining(['hello', 'こんにちは', 'a greeting'])
      );
    });

    it('should reject duplicate words', async () => {
      // Mock: duplicate exists
      mockDb.getFirstAsync.mockResolvedValueOnce({ id: 1 });

      const result = await insertWord(validInput);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(ErrorCode.DUPLICATE_WORD);
        expect(result.error.message).toContain('既に登録されています');
      }

      // Verify no insert was attempted
      expect(mockDb.runAsync).not.toHaveBeenCalled();
    });

    it('should handle null optional fields', async () => {
      const minimalInput: CreateWordInput = {
        english: 'world',
      };

      mockDb.getFirstAsync.mockResolvedValueOnce(null);
      mockDb.runAsync.mockResolvedValueOnce({
        lastInsertRowId: 2,
        changes: 1,
      });
      mockDb.getFirstAsync.mockResolvedValueOnce({
        id: 2,
        english: 'world',
        japanese: null,
        definition: null,
        post_url: null,
        post_text: null,
        is_read: 0,
        created_at: '2026-01-06 10:00:00',
        read_at: null,
      });

      const result = await insertWord(minimalInput);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.japanese).toBeNull();
        expect(result.data.definition).toBeNull();
      }
    });

    it('should handle database errors gracefully', async () => {
      mockDb.getFirstAsync.mockRejectedValueOnce(
        new Error('Database connection failed')
      );

      const result = await insertWord(validInput);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(ErrorCode.DATABASE_ERROR);
      }
    });
  });

  describe('SQL Injection Protection', () => {
    it('should prevent SQL injection in insertWord', async () => {
      const maliciousInput: CreateWordInput = {
        english: "'; DROP TABLE words; --",
        japanese: "'); DELETE FROM words; --",
        definition: "' OR '1'='1",
      };

      mockDb.getFirstAsync.mockResolvedValueOnce(null);
      mockDb.runAsync.mockResolvedValueOnce({
        lastInsertRowId: 3,
        changes: 1,
      });
      mockDb.getFirstAsync.mockResolvedValueOnce({
        id: 3,
        english: "'; DROP TABLE words; --",
        japanese: "'); DELETE FROM words; --",
        definition: "' OR '1'='1",
        post_url: null,
        post_text: null,
        is_read: 0,
        created_at: '2026-01-06 10:00:00',
        read_at: null,
      });

      const result = await insertWord(maliciousInput);

      expect(result.success).toBe(true);

      // Verify that parameterized queries were used (values passed as array)
      // Note: sanitizeWord converts to lowercase
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([
          expect.stringContaining("'; drop table words; --"),
          expect.stringContaining("'); DELETE FROM words; --"),
          expect.stringContaining("' OR '1'='1"),
        ])
      );

      // Verify no inline string concatenation in SQL
      const sqlQuery = (mockDb.runAsync as jest.Mock).mock.calls[0][0];
      expect(sqlQuery).not.toContain("'; DROP TABLE");
      expect(sqlQuery).toContain('?'); // Placeholders used
    });

    it('should prevent SQL injection in findWordByEnglish', async () => {
      const maliciousWord = "' OR '1'='1' --";

      mockDb.getFirstAsync.mockResolvedValueOnce(null);

      const result = await findWordByEnglish(maliciousWord);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBeNull();
      }

      // Verify parameterized query
      // Note: sanitizeWord converts to lowercase
      expect(mockDb.getFirstAsync).toHaveBeenCalledWith(
        expect.stringContaining('WHERE english = ?'),
        expect.arrayContaining([expect.stringContaining("' or '1'='1' --")])
      );
    });

    it('should prevent SQL injection in getWords filter', async () => {
      const maliciousFilter = {
        isRead: true,
        sortBy: 'created_at' as const,
        sortOrder: 'desc' as const,
        limit: 10,
        offset: 0,
      };

      mockDb.getAllAsync.mockResolvedValueOnce([]);

      const result = await getWords(maliciousFilter);

      expect(result.success).toBe(true);

      // Verify that filter values are parameterized
      const call = (mockDb.getAllAsync as jest.Mock).mock.calls[0];
      const params = call[1];
      expect(params).toEqual([1, 10, 0]); // isRead=1, limit=10, offset=0
    });
  });

  describe('getWords', () => {
    it('should retrieve words with filters', async () => {
      const mockWords = [
        {
          id: 1,
          english: 'hello',
          japanese: 'こんにちは',
          definition: 'a greeting',
          post_url: null,
          post_text: null,
          is_read: 1,
          created_at: '2026-01-06 10:00:00',
          read_at: '2026-01-06 10:30:00',
        },
        {
          id: 2,
          english: 'world',
          japanese: '世界',
          definition: 'the earth',
          post_url: null,
          post_text: null,
          is_read: 0,
          created_at: '2026-01-06 09:00:00',
          read_at: null,
        },
      ];

      mockDb.getAllAsync.mockResolvedValueOnce(mockWords);

      const result = await getWords({
        isRead: null,
        sortBy: 'created_at',
        sortOrder: 'desc',
        limit: 50,
        offset: 0,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(2);
        expect(result.data[0].isRead).toBe(true);
        expect(result.data[1].isRead).toBe(false);
      }
    });

    it('should filter by read status', async () => {
      mockDb.getAllAsync.mockResolvedValueOnce([]);

      const result = await getWords({
        isRead: true,
        sortBy: 'english',
        sortOrder: 'asc',
      });

      expect(result.success).toBe(true);

      // Verify WHERE clause with is_read filter
      const call = (mockDb.getAllAsync as jest.Mock).mock.calls[0];
      const sql = call[0];
      expect(sql).toContain('WHERE is_read = ?');
    });

    it('should sort by english alphabetically', async () => {
      mockDb.getAllAsync.mockResolvedValueOnce([]);

      const result = await getWords({
        sortBy: 'english',
        sortOrder: 'asc',
      });

      expect(result.success).toBe(true);

      const call = (mockDb.getAllAsync as jest.Mock).mock.calls[0];
      const sql = call[0];
      expect(sql).toContain('ORDER BY english ASC');
    });
  });

  describe('toggleReadStatus', () => {
    it('should toggle word from unread to read', async () => {
      const mockCurrentWord = {
        id: 1,
        english: 'test',
        japanese: 'テスト',
        definition: 'a test',
        post_url: null,
        post_text: null,
        is_read: 0,
        created_at: '2026-01-06 10:00:00',
        read_at: null,
      };

      const mockUpdatedWord = {
        ...mockCurrentWord,
        is_read: 1,
        read_at: '2026-01-06 10:30:00',
      };

      // Mock: get current word
      mockDb.getFirstAsync.mockResolvedValueOnce(mockCurrentWord);

      // Mock: transaction succeeds
      mockDb.withTransactionAsync.mockImplementationOnce(async (callback) => {
        await callback();
      });

      // Mock: get updated word
      mockDb.getFirstAsync.mockResolvedValueOnce(mockUpdatedWord);

      const result = await toggleReadStatus(1);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isRead).toBe(true);
        expect(result.data.readAt).toBe('2026-01-06 10:30:00');
      }

      // Verify transaction was used
      expect(mockDb.withTransactionAsync).toHaveBeenCalled();
    });

    it('should toggle word from read to unread', async () => {
      const mockCurrentWord = {
        id: 2,
        english: 'test2',
        japanese: 'テスト2',
        definition: 'another test',
        post_url: null,
        post_text: null,
        is_read: 1,
        created_at: '2026-01-06 09:00:00',
        read_at: '2026-01-06 09:30:00',
      };

      const mockUpdatedWord = {
        ...mockCurrentWord,
        is_read: 0,
        read_at: null,
      };

      mockDb.getFirstAsync.mockResolvedValueOnce(mockCurrentWord);
      mockDb.withTransactionAsync.mockImplementationOnce(async (callback) => {
        await callback();
      });
      mockDb.getFirstAsync.mockResolvedValueOnce(mockUpdatedWord);

      const result = await toggleReadStatus(2);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isRead).toBe(false);
        expect(result.data.readAt).toBeNull();
      }
    });

    it('should return error for non-existent word', async () => {
      mockDb.getFirstAsync.mockResolvedValueOnce(null);

      const result = await toggleReadStatus(999);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(ErrorCode.WORD_NOT_FOUND);
      }
    });
  });

  describe('deleteWord', () => {
    it('should delete a word by ID', async () => {
      mockDb.runAsync.mockResolvedValueOnce({
        lastInsertRowId: 0,
        changes: 1,
      });

      const result = await deleteWord(1);

      expect(result.success).toBe(true);
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        'DELETE FROM words WHERE id = ?',
        [1]
      );
    });

    it('should handle deletion errors', async () => {
      mockDb.runAsync.mockRejectedValueOnce(new Error('Foreign key constraint'));

      const result = await deleteWord(1);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(ErrorCode.DATABASE_ERROR);
      }
    });
  });

  describe('getTotalWordCount', () => {
    it('should return total word count', async () => {
      mockDb.getFirstAsync.mockResolvedValueOnce({ count: 42 });

      const result = await getTotalWordCount();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(42);
      }
    });

    it('should return 0 when no words exist', async () => {
      mockDb.getFirstAsync.mockResolvedValueOnce(null);

      const result = await getTotalWordCount();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(0);
      }
    });
  });

  describe('getReadWordCount', () => {
    it('should return read word count', async () => {
      mockDb.getFirstAsync.mockResolvedValueOnce({ count: 15 });

      const result = await getReadWordCount();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(15);
      }

      // Verify SQL filters for is_read = 1
      expect(mockDb.getFirstAsync).toHaveBeenCalledWith(
        expect.stringContaining('WHERE is_read = 1')
      );
    });
  });

  describe('getTodayReadCount', () => {
    it('should return today\'s read count', async () => {
      mockDb.getFirstAsync.mockResolvedValueOnce({ count: 5 });

      const result = await getTodayReadCount();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(5);
      }

      // Verify SQL uses date comparison
      expect(mockDb.getFirstAsync).toHaveBeenCalledWith(
        expect.stringContaining('date(read_at)')
      );
    });
  });

  describe('deleteAllWords', () => {
    it('should delete all words and stats in transaction', async () => {
      mockDb.withTransactionAsync.mockImplementationOnce(async (callback) => {
        await callback();
      });

      const result = await deleteAllWords();

      expect(result.success).toBe(true);
      expect(mockDb.withTransactionAsync).toHaveBeenCalled();

      // Verify both tables are cleared
      expect(mockDb.runAsync).toHaveBeenCalledWith('DELETE FROM words');
      expect(mockDb.runAsync).toHaveBeenCalledWith('DELETE FROM daily_stats');
    });

    it('should handle transaction errors', async () => {
      mockDb.withTransactionAsync.mockRejectedValueOnce(
        new Error('Transaction failed')
      );

      const result = await deleteAllWords();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(ErrorCode.DATABASE_ERROR);
      }
    });
  });

  describe('exportWords', () => {
    it('should export all words ordered by created_at', async () => {
      const mockWords = [
        {
          id: 2,
          english: 'world',
          japanese: '世界',
          definition: 'the earth',
          post_url: null,
          post_text: null,
          is_read: 0,
          created_at: '2026-01-06 11:00:00',
          read_at: null,
        },
        {
          id: 1,
          english: 'hello',
          japanese: 'こんにちは',
          definition: 'a greeting',
          post_url: null,
          post_text: null,
          is_read: 1,
          created_at: '2026-01-06 10:00:00',
          read_at: '2026-01-06 10:30:00',
        },
      ];

      mockDb.getAllAsync.mockResolvedValueOnce(mockWords);

      const result = await exportWords();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(2);
        expect(result.data[0].english).toBe('world'); // Newer first
        expect(result.data[1].english).toBe('hello');
      }

      // Verify ORDER BY clause
      expect(mockDb.getAllAsync).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY created_at DESC')
      );
    });
  });

  describe('addWord (simplified interface)', () => {
    it('should call insertWord with correct parameters', async () => {
      mockDb.getFirstAsync.mockResolvedValueOnce(null);
      mockDb.runAsync.mockResolvedValueOnce({
        lastInsertRowId: 1,
        changes: 1,
      });
      mockDb.getFirstAsync.mockResolvedValueOnce({
        id: 1,
        english: 'test',
        japanese: 'テスト',
        definition: 'a test',
        post_url: null,
        post_text: null,
        is_read: 0,
        created_at: '2026-01-06 10:00:00',
        read_at: null,
      });

      const result = await addWord('test', 'テスト', 'a test');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.english).toBe('test');
        expect(result.data.japanese).toBe('テスト');
        expect(result.data.definition).toBe('a test');
      }
    });
  });

  describe('getWordById', () => {
    it('should retrieve a word by ID', async () => {
      const mockWord = {
        id: 5,
        english: 'specific',
        japanese: '特定の',
        definition: 'clearly defined',
        post_url: null,
        post_text: null,
        is_read: 0,
        created_at: '2026-01-06 10:00:00',
        read_at: null,
      };

      mockDb.getFirstAsync.mockResolvedValueOnce(mockWord);

      const result = await getWordById(5);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data?.id).toBe(5);
        expect(result.data?.english).toBe('specific');
      }

      // Verify parameterized query
      expect(mockDb.getFirstAsync).toHaveBeenCalledWith(
        'SELECT * FROM words WHERE id = ?',
        [5]
      );
    });

    it('should return null for non-existent ID', async () => {
      mockDb.getFirstAsync.mockResolvedValueOnce(null);

      const result = await getWordById(999);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBeNull();
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string inputs gracefully', async () => {
      const emptyInput: CreateWordInput = {
        english: '',
        japanese: '',
        definition: '',
      };

      mockDb.getFirstAsync.mockResolvedValueOnce(null);
      mockDb.runAsync.mockResolvedValueOnce({
        lastInsertRowId: 1,
        changes: 1,
      });
      mockDb.getFirstAsync.mockResolvedValueOnce({
        id: 1,
        english: '',
        japanese: '',
        definition: '',
        post_url: null,
        post_text: null,
        is_read: 0,
        created_at: '2026-01-06 10:00:00',
        read_at: null,
      });

      const result = await insertWord(emptyInput);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.english).toBe('');
      }
    });

    it('should handle very long strings', async () => {
      const longString = 'a'.repeat(10000);
      const longInput: CreateWordInput = {
        english: longString,
        japanese: longString,
        definition: longString,
      };

      mockDb.getFirstAsync.mockResolvedValueOnce(null);
      mockDb.runAsync.mockResolvedValueOnce({
        lastInsertRowId: 1,
        changes: 1,
      });
      mockDb.getFirstAsync.mockResolvedValueOnce({
        id: 1,
        english: longString,
        japanese: longString,
        definition: longString,
        post_url: null,
        post_text: null,
        is_read: 0,
        created_at: '2026-01-06 10:00:00',
        read_at: null,
      });

      const result = await insertWord(longInput);

      expect(result.success).toBe(true);
    });

    it('should handle special Unicode characters', async () => {
      const unicodeInput: CreateWordInput = {
        english: '🌟✨💫',
        japanese: '日本語の文字列🎌',
        definition: 'Special chars: àéîôü',
      };

      mockDb.getFirstAsync.mockResolvedValueOnce(null);
      mockDb.runAsync.mockResolvedValueOnce({
        lastInsertRowId: 1,
        changes: 1,
      });
      mockDb.getFirstAsync.mockResolvedValueOnce({
        id: 1,
        english: '🌟✨💫',
        japanese: '日本語の文字列🎌',
        definition: 'Special chars: àéîôü',
        post_url: null,
        post_text: null,
        is_read: 0,
        created_at: '2026-01-06 10:00:00',
        read_at: null,
      });

      const result = await insertWord(unicodeInput);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.english).toBe('🌟✨💫');
        expect(result.data.japanese).toBe('日本語の文字列🎌');
      }
    });
  });
});
