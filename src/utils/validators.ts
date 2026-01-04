/**
 * Validation utilities for user input
 */

/**
 * Validation result
 */
export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validators object containing all validation functions
 */
export const Validators = {
  /**
   * Validate Bluesky handle
   * Accepts handle format (user.bsky.social) or email format
   * @param handle - The handle to validate
   */
  isValidHandle(handle: string): boolean {
    const trimmed = handle.trim();
    if (!trimmed) return false;

    // Handle format (domain style): user.bsky.social
    const handlePattern =
      /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;

    // Email format
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    return handlePattern.test(trimmed) || emailPattern.test(trimmed);
  },

  /**
   * Validate Bluesky App Password
   * Format: xxxx-xxxx-xxxx-xxxx (lowercase letters and numbers)
   * @param password - The app password to validate
   */
  isValidAppPassword(password: string): boolean {
    const pattern = /^[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/;
    return pattern.test(password.trim());
  },

  /**
   * Validate DeepL API Key
   * Format: 36+ characters ending with :fx for free tier
   * @param apiKey - The API key to validate
   */
  isValidDeepLApiKey(apiKey: string): boolean {
    const trimmed = apiKey.trim();

    // Free tier ends with :fx
    if (!trimmed.endsWith(':fx')) {
      return false;
    }

    // Basic format check (36+ characters)
    const pattern = /^[a-zA-Z0-9-]{36,}:fx$/;
    return pattern.test(trimmed);
  },

  /**
   * Validate English word
   * Must be 1-100 characters, starting with a letter
   * @param word - The word to validate
   */
  isValidEnglishWord(word: string): boolean {
    const trimmed = word.trim();
    if (!trimmed || trimmed.length > 100) return false;

    // Allow letters, hyphens, apostrophes, and spaces
    const pattern = /^[a-zA-Z][a-zA-Z'\s-]*$/;
    return pattern.test(trimmed);
  },

  /**
   * Check if string contains Japanese characters
   * @param text - The text to check
   */
  isJapanese(text: string): boolean {
    const trimmed = text.trim();
    if (!trimmed) return false;

    // Check for Hiragana, Katakana, or Kanji
    const japanesePattern = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/;
    return japanesePattern.test(trimmed);
  },

  /**
   * Validate handle with detailed error message
   */
  validateHandle(handle: string): ValidationResult {
    const trimmed = handle.trim();

    if (!trimmed) {
      return { isValid: false, error: 'ユーザー名を入力してください' };
    }

    if (!this.isValidHandle(trimmed)) {
      return {
        isValid: false,
        error: '正しい形式で入力してください（例: user.bsky.social）',
      };
    }

    return { isValid: true };
  },

  /**
   * Validate app password with detailed error message
   */
  validateAppPassword(password: string): ValidationResult {
    const trimmed = password.trim();

    if (!trimmed) {
      return { isValid: false, error: 'App Passwordを入力してください' };
    }

    if (!this.isValidAppPassword(trimmed)) {
      return {
        isValid: false,
        error: 'App Passwordの形式が正しくありません（例: xxxx-xxxx-xxxx-xxxx）',
      };
    }

    return { isValid: true };
  },

  /**
   * Validate DeepL API key with detailed error message
   */
  validateDeepLApiKey(apiKey: string): ValidationResult {
    const trimmed = apiKey.trim();

    if (!trimmed) {
      return { isValid: false, error: 'API Keyを入力してください' };
    }

    if (!this.isValidDeepLApiKey(trimmed)) {
      return {
        isValid: false,
        error: 'API Keyの形式が正しくありません',
      };
    }

    return { isValid: true };
  },

  /**
   * Validate English word with detailed error message
   */
  validateEnglishWord(word: string): ValidationResult {
    const trimmed = word.trim();

    if (!trimmed) {
      return { isValid: false, error: '単語を入力してください' };
    }

    if (trimmed.length > 100) {
      return { isValid: false, error: '単語は100文字以内で入力してください' };
    }

    if (!this.isValidEnglishWord(trimmed)) {
      return {
        isValid: false,
        error: '英単語を入力してください',
      };
    }

    return { isValid: true };
  },
};

/**
 * Sanitize word input (normalize to lowercase and trim)
 */
export function sanitizeWord(input: string): string {
  return input.trim().toLowerCase();
}

/**
 * Sanitize handle input (trim only, preserve case)
 */
export function sanitizeHandle(input: string): string {
  return input.trim();
}

/**
 * Sanitize API key input (trim)
 */
export function sanitizeApiKey(input: string): string {
  return input.trim();
}
