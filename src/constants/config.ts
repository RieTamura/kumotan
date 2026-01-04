/**
 * Application configuration constants
 */

/**
 * API endpoints
 */
export const API = {
  BLUESKY: {
    SERVICE: 'https://bsky.social',
    XRPC: 'https://bsky.social/xrpc',
  },
  DEEPL: {
    FREE_ENDPOINT: 'https://api-free.deepl.com/v2',
    TRANSLATE: 'https://api-free.deepl.com/v2/translate',
    USAGE: 'https://api-free.deepl.com/v2/usage',
  },
  DICTIONARY: {
    BASE_URL: 'https://api.dictionaryapi.dev/api/v2/entries/en',
  },
} as const;

/**
 * Storage keys for Secure Store and AsyncStorage
 */
export const STORAGE_KEYS = {
  // Secure Store (encrypted)
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
  USER_DID: 'user_did',
  YAHOO_CLIENT_ID: 'yahoo_client_id',
  USER_HANDLE: 'user_handle',
  DEEPL_API_KEY: 'deepl_api_key',

  // AsyncStorage (non-sensitive)
  THEME: 'theme',
  LANGUAGE: 'language',
  TUTORIAL_COMPLETED: 'tutorial_completed',
  LAST_FEED_UPDATE: 'last_feed_update',
} as const;

/**
 * Rate limiting configuration
 */
export const RATE_LIMIT = {
  BLUESKY: {
    MAX_REQUESTS: 3000,
    WINDOW_MS: 5 * 60 * 1000, // 5 minutes
    MIN_INTERVAL_MS: 100,
  },
  DEEPL: {
    WARNING_THRESHOLD: 80, // 80% usage warning
    CRITICAL_THRESHOLD: 95, // 95% usage critical
    MONTHLY_LIMIT: 500000, // 500k characters
  },
} as const;

/**
 * Timeout configuration
 */
export const TIMEOUT = {
  API_REQUEST: 10000, // 10 seconds
  API: 10000, // Generic API timeout
  LOGIN: 15000, // 15 seconds
  TRANSLATION: 10000, // 10 seconds
} as const;

/**
 * Pagination configuration
 */
export const PAGINATION = {
  FEED_LIMIT: 50,
  WORDS_LIMIT: 50,
} as const;

/**
 * App information
 */
export const APP_INFO = {
  NAME: 'くもたん',
  NAME_EN: 'Kumotan',
  VERSION: '1.0.0',
  DESCRIPTION: '雲から学ぶ、あなたの単語帳',
} as const;

/**
 * External links
 */
export const EXTERNAL_LINKS = {
  BLUESKY_APP_PASSWORDS: 'https://bsky.app/settings/app-passwords',
  DEEPL_SIGNUP: 'https://www.deepl.com/pro-api',
  BLUESKY_DOCS: 'https://docs.bsky.app/',
  DEEPL_DOCS: 'https://www.deepl.com/docs-api',
  DICTIONARY_DOCS: 'https://dictionaryapi.dev/',
} as const;

/**
 * Database configuration
 */
export const DATABASE = {
  NAME: 'kumotan.db',
  VERSION: 1,
} as const;

/**
 * Feature flags (can be used for gradual rollout)
 */
export const FEATURES = {
  ENABLE_TRANSLATION: true,
  ENABLE_DICTIONARY: true,
  ENABLE_OFFLINE_MODE: true,
  ENABLE_SHARE: true,
} as const;
