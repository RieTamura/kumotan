/**
 * Japanese Text Tokenizer
 * Splits Japanese text into word-like tokens based on character type boundaries
 */

/**
 * Token type for Japanese text
 */
export interface JapaneseToken {
  text: string;
  type: 'kanji' | 'hiragana' | 'katakana' | 'punctuation' | 'other';
}

/**
 * Unicode ranges for Japanese character types
 */
const KANJI_RANGE = /[\u4E00-\u9FAF]/;
const HIRAGANA_RANGE = /[\u3040-\u309F]/;
const KATAKANA_RANGE = /[\u30A0-\u30FF]/;
const JAPANESE_PUNCTUATION = /[。、！？「」『』（）・ー〜]/;

/**
 * Detect the type of a Japanese character
 */
function getCharacterType(char: string): JapaneseToken['type'] {
  if (KANJI_RANGE.test(char)) return 'kanji';
  if (HIRAGANA_RANGE.test(char)) return 'hiragana';
  if (KATAKANA_RANGE.test(char)) return 'katakana';
  if (JAPANESE_PUNCTUATION.test(char)) return 'punctuation';
  return 'other';
}

/**
 * Tokenize Japanese text into word-like units
 *
 * Strategy:
 * - Consecutive kanji characters form one token (e.g., 美術館)
 * - Consecutive katakana characters form one token (e.g., コンピューター)
 * - Consecutive hiragana characters form one token (e.g., ください)
 * - Kanji followed by hiragana (okurigana) form one token (e.g., 美しい)
 * - Punctuation is kept separate
 *
 * @param text - Japanese text to tokenize
 * @returns Array of tokens
 */
export function tokenizeJapanese(text: string): JapaneseToken[] {
  if (!text || text.length === 0) {
    return [];
  }

  const tokens: JapaneseToken[] = [];
  let currentToken = '';
  let currentType: JapaneseToken['type'] | null = null;
  let isInKanjiWithOkurigana = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const charType = getCharacterType(char);

    if (currentType === null) {
      // Start new token
      currentToken = char;
      currentType = charType;
      isInKanjiWithOkurigana = charType === 'kanji';
    } else if (charType === currentType) {
      // Same type - continue token
      currentToken += char;
    } else if (isInKanjiWithOkurigana && charType === 'hiragana') {
      // Kanji followed by hiragana (okurigana) - continue as compound
      currentToken += char;
      currentType = 'kanji'; // Keep as kanji type for the compound
      isInKanjiWithOkurigana = false; // Only allow one okurigana sequence
    } else if (currentType === 'kanji' && charType === 'hiragana') {
      // Additional okurigana after kanji
      currentToken += char;
      isInKanjiWithOkurigana = false;
    } else {
      // Different type - save current token and start new one
      if (currentToken) {
        tokens.push({ text: currentToken, type: currentType });
      }
      currentToken = char;
      currentType = charType;
      isInKanjiWithOkurigana = charType === 'kanji';
    }
  }

  // Don't forget the last token
  if (currentToken && currentType !== null) {
    tokens.push({ text: currentToken, type: currentType });
  }

  return tokens;
}

/**
 * Simple tokenizer that splits Japanese text into clickable word units
 * Returns just the text strings for simpler integration
 *
 * @param text - Japanese text to tokenize
 * @returns Array of token strings
 */
export function tokenizeJapaneseSimple(text: string): string[] {
  const tokens = tokenizeJapanese(text);
  return tokens.map(t => t.text);
}

/**
 * Check if text contains Japanese characters
 */
export function containsJapanese(text: string): boolean {
  return /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text);
}

/**
 * Check if a token is a meaningful word (not just punctuation or whitespace)
 */
export function isMeaningfulToken(token: JapaneseToken): boolean {
  return token.type !== 'punctuation' && token.type !== 'other' && token.text.trim().length > 0;
}
