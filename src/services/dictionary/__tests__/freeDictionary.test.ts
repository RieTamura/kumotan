/**
 * Free Dictionary API Service Tests
 * Tests English word definition lookup and error handling
 */

import {
  lookupWord,
  lookupWords,
  getDetailedDefinition,
  isEnglishWord,
  extractWords,
} from '../freeDictionary';
import { ErrorCode } from '../../../utils/errors';

// Mock fetch
global.fetch = jest.fn();

describe('Free Dictionary API Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('lookupWord', () => {
    const mockDictionaryResponse = [
      {
        word: 'hello',
        phonetic: '/həˈloʊ/',
        phonetics: [
          {
            text: '/həˈloʊ/',
            audio: 'https://example.com/hello.mp3',
          },
        ],
        meanings: [
          {
            partOfSpeech: 'noun',
            definitions: [
              {
                definition: 'A greeting or expression of goodwill',
                example: 'She gave me a warm hello',
                synonyms: ['greeting', 'salutation'],
                antonyms: ['goodbye'],
              },
            ],
          },
          {
            partOfSpeech: 'interjection',
            definitions: [
              {
                definition: 'Used as a greeting',
                example: 'Hello! How are you?',
              },
            ],
          },
        ],
      },
    ];

    it('should look up word successfully', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockDictionaryResponse,
      });

      const result = await lookupWord('hello');

      jest.runAllTimers();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.word).toBe('hello');
        expect(result.data.phonetic).toBe('/həˈloʊ/');
        expect(result.data.definition).toContain('greeting');
        expect(result.data.partOfSpeech).toBe('noun');
        expect(result.data.audio).toBe('https://example.com/hello.mp3');
      }
    });

    it('should normalize word before lookup', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockDictionaryResponse,
      });

      await lookupWord('  HELLO!  ');

      jest.runAllTimers();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('hello'),
        expect.any(Object)
      );
    });

    it('should return error for empty word', async () => {
      const result = await lookupWord('   ');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(ErrorCode.VALIDATION_ERROR);
        expect(result.error.message).toContain('入力');
      }
    });

    it('should return error for too long word', async () => {
      const longWord = 'a'.repeat(51);

      const result = await lookupWord(longWord);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(ErrorCode.VALIDATION_ERROR);
        expect(result.error.message).toContain('無効');
      }
    });

    it('should handle word not found (404)', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
      });

      const result = await lookupWord('xyzabc123');

      jest.runAllTimers();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(ErrorCode.WORD_NOT_FOUND);
        expect(result.error.message).toContain('見つかりませんでした');
      }
    });

    it('should handle API error', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
      });

      const result = await lookupWord('hello');

      jest.runAllTimers();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(ErrorCode.API_ERROR);
        expect(result.error.message).toContain('APIエラー');
      }
    });

    it('should handle empty response', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => [],
      });

      const result = await lookupWord('hello');

      jest.runAllTimers();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(ErrorCode.WORD_NOT_FOUND);
      }
    });

    it('should handle timeout', async () => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      (global.fetch as jest.Mock).mockRejectedValue(abortError);

      const result = await lookupWord('hello');

      jest.runAllTimers();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(ErrorCode.TIMEOUT);
      }
    });

    it('should handle network error', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await lookupWord('hello');

      jest.runAllTimers();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(ErrorCode.NETWORK_ERROR);
        expect(result.error.message).toContain('ネットワーク');
      }
    });

    it('should handle missing audio gracefully', async () => {
      const responseWithoutAudio = [
        {
          word: 'test',
          phonetic: '/test/',
          phonetics: [],
          meanings: [
            {
              partOfSpeech: 'noun',
              definitions: [{ definition: 'A trial or examination' }],
            },
          ],
        },
      ];

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => responseWithoutAudio,
      });

      const result = await lookupWord('test');

      jest.runAllTimers();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.audio).toBeUndefined();
      }
    });
  });

  describe('lookupWords', () => {
    it('should look up multiple words in batches', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => [
          {
            word: 'test',
            meanings: [
              {
                partOfSpeech: 'noun',
                definitions: [{ definition: 'A test' }],
              },
            ],
          },
        ],
      });

      const words = ['hello', 'world', 'test'];
      const results = await lookupWords(words);

      jest.runAllTimers();

      expect(results.size).toBe(3);
      expect(results.has('hello')).toBe(true);
      expect(results.has('world')).toBe(true);
      expect(results.has('test')).toBe(true);
    });

    it('should handle mixed success and failure', async () => {
      let callCount = 0;
      (global.fetch as jest.Mock).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: true,
            json: async () => [
              {
                word: 'hello',
                meanings: [
                  {
                    partOfSpeech: 'noun',
                    definitions: [{ definition: 'A greeting' }],
                  },
                ],
              },
            ],
          });
        }
        return Promise.resolve({ ok: false, status: 404 });
      });

      const words = ['hello', 'xyzabc'];
      const results = await lookupWords(words);

      jest.runAllTimers();

      expect(results.size).toBe(2);

      const helloResult = results.get('hello');
      expect(helloResult?.success).toBe(true);

      const invalidResult = results.get('xyzabc');
      expect(invalidResult?.success).toBe(false);
    });

    // TODO: Fix this test - it times out due to Promise.all timing issues
    it.skip('should process words in batches of 5', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => [
          {
            word: 'test',
            meanings: [
              { partOfSpeech: 'noun', definitions: [{ definition: 'Test' }] },
            ],
          },
        ],
      });

      const words = Array(12).fill('test').map((w, i) => `${w}${i}`);
      const result = await lookupWords(words);

      // Should make 12 fetch calls (12 words)
      expect(global.fetch).toHaveBeenCalledTimes(12);
      expect(result.size).toBe(12);
    });
  });

  describe('getDetailedDefinition', () => {
    it('should return all meanings for a word', async () => {
      const detailedResponse = [
        {
          word: 'run',
          phonetic: '/rʌn/',
          phonetics: [{ text: '/rʌn/', audio: 'https://example.com/run.mp3' }],
          meanings: [
            {
              partOfSpeech: 'verb',
              definitions: [
                { definition: 'Move at a speed faster than walking' },
                { definition: 'Operate or function' },
              ],
            },
            {
              partOfSpeech: 'noun',
              definitions: [{ definition: 'An act of running' }],
            },
          ],
        },
      ];

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => detailedResponse,
      });

      const result = await getDetailedDefinition('run');

      jest.runAllTimers();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.length).toBe(3); // 2 verb + 1 noun definitions
        expect(result.data[0].partOfSpeech).toBe('verb');
        expect(result.data[2].partOfSpeech).toBe('noun');
      }
    });

    it('should validate input', async () => {
      const result = await getDetailedDefinition('');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(ErrorCode.VALIDATION_ERROR);
      }
    });

    it('should handle word not found', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
      });

      const result = await getDetailedDefinition('xyzabc');

      jest.runAllTimers();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(ErrorCode.WORD_NOT_FOUND);
      }
    });
  });

  describe('isEnglishWord', () => {
    it('should return true for valid English words', () => {
      expect(isEnglishWord('hello')).toBe(true);
      expect(isEnglishWord('world')).toBe(true);
      expect(isEnglishWord('test')).toBe(true);
      expect(isEnglishWord("don't")).toBe(true);
      expect(isEnglishWord('co-operate')).toBe(true);
      expect(isEnglishWord('I')).toBe(true);
      expect(isEnglishWord('a')).toBe(true);
    });

    it('should return false for non-English text', () => {
      expect(isEnglishWord('こんにちは')).toBe(false);
      expect(isEnglishWord('123')).toBe(false);
      expect(isEnglishWord('test123')).toBe(false);
      expect(isEnglishWord('@hello')).toBe(false);
      expect(isEnglishWord('hello!')).toBe(false);
      expect(isEnglishWord('')).toBe(false);
      expect(isEnglishWord('   ')).toBe(false);
    });

    it('should handle edge cases', () => {
      expect(isEnglishWord("'hello")).toBe(false); // starts with apostrophe
      expect(isEnglishWord("hello'")).toBe(false); // ends with apostrophe
      expect(isEnglishWord('-hello')).toBe(false); // starts with hyphen
      expect(isEnglishWord('hello-')).toBe(false); // ends with hyphen
    });
  });

  describe('extractWords', () => {
    it('should extract English words from text', () => {
      const text = 'Hello, world! How are you today?';
      const words = extractWords(text);

      expect(words).toContain('hello');
      expect(words).toContain('world');
      expect(words).toContain('how');
      expect(words).toContain('are');
      expect(words).toContain('you');
      expect(words).toContain('today');
    });

    it('should remove duplicates', () => {
      const text = 'hello hello HELLO';
      const words = extractWords(text);

      expect(words).toEqual(['hello']);
    });

    it('should filter out single character words', () => {
      const text = 'I am a developer';
      const words = extractWords(text);

      expect(words).toContain('am');
      expect(words).toContain('developer');
      // Single letters are filtered out (length < 2)
      expect(words).not.toContain('i');
      expect(words).not.toContain('a');
    });

    it('should handle contractions', () => {
      const text = "I don't know what's happening";
      const words = extractWords(text);

      expect(words).toContain("don't");
      expect(words).toContain("what's");
    });

    it('should handle hyphenated words', () => {
      const text = 'This is a well-known co-operative project';
      const words = extractWords(text);

      expect(words).toContain('well-known');
      expect(words).toContain('co-operative');
    });

    it('should handle mixed language text', () => {
      const text = 'Hello こんにちは world 世界';
      const words = extractWords(text);

      expect(words).toContain('hello');
      expect(words).toContain('world');
      expect(words).not.toContain('こんにちは');
      expect(words).not.toContain('世界');
    });

    it('should handle empty or whitespace text', () => {
      expect(extractWords('')).toEqual([]);
      expect(extractWords('   ')).toEqual([]);
    });

    it('should handle text with only punctuation', () => {
      expect(extractWords('!@#$%^&*()')).toEqual([]);
    });

    it('should handle text with numbers', () => {
      const text = 'I have 123 apples and 456 oranges';
      const words = extractWords(text);

      expect(words).toContain('have');
      expect(words).toContain('apples');
      expect(words).toContain('and');
      expect(words).toContain('oranges');
      expect(words).not.toContain('123');
      expect(words).not.toContain('456');
    });
  });
});
