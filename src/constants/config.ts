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
    OAUTH: {
      AUTHORIZE: 'https://bsky.social/oauth/authorize',
      TOKEN: 'https://bsky.social/oauth/token',
      CLIENT_ID: 'kumotan://oauth/callback',
      REDIRECT_URI: 'kumotan://oauth/callback',
      SCOPE: 'atproto transition:generic',
    },
  },
  DEEPL: {
    FREE_ENDPOINT: 'https://api-free.deepl.com/v2',
    TRANSLATE: 'https://api-free.deepl.com/v2/translate',
    USAGE: 'https://api-free.deepl.com/v2/usage',
  },
  DICTIONARY: {
    BASE_URL: 'https://api.dictionaryapi.dev/api/v2/entries/en',
  },
  FEEDBACK: {
    GAS_URL: 'https://script.google.com/macros/s/AKfycbzimG7RHCjZaBxr9AT28VTt0EKRXhsBchY60y9ruriDlvxWIXT7A39g-rYiIKC7_-ai/exec', // 手動で置き換えてください
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
  OAUTH_STATE: 'oauth_state',
  OAUTH_CODE_VERIFIER: 'oauth_code_verifier',

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
  GITHUB_ISSUES: 'https://github.com/RieTamura/kumotan/issues/new/choose',
  GITHUB_REPO: 'https://github.com/RieTamura/kumotan',
  GITHUB_SPONSORS: 'https://github.com/sponsors/RieTamura',
  BLUESKY_ACCOUNT: 'https://bsky.app/profile/kumotanapp.bsky.social',
  BLUESKY_MODERATION: 'https://bsky.app/profile/did:plc:ar7c4by46qjdydhdevvrndac',
} as const;

/**
 * Database configuration
 */
export const DATABASE = {
  NAME: 'kumotan.db',
  VERSION: 6,
} as const;

/**
 * External dictionary configuration
 * GitHub Pagesからダウンロードするオフライン辞書の設定
 */
export const DICTIONARY_CONFIG = {
  /** 辞書データ配信リポジトリのベースURL */
  BASE_URL: 'https://rietamura.github.io/kumotan-dictionary',
  /** メタデータファイル名 */
  METADATA_FILE: 'metadata.json',
  /** 圧縮辞書ファイル名 */
  COMPRESSED_FILE: 'jmdict.db.gz',
  /** 解凍後の辞書ファイル名 */
  DATABASE_FILE: 'jmdict.db',
  /** 差分ファイル名（フィードバックからの修正を適用） */
  OVERRIDES_FILE: 'overrides.json',
  /** AsyncStorageキー：辞書インストール完了フラグ */
  STORAGE_KEY_INSTALLED: '@kumotan:dictionary_installed',
  /** AsyncStorageキー：インストール済みバージョン */
  STORAGE_KEY_VERSION: '@kumotan:dictionary_version',
  /** AsyncStorageキー：差分データのキャッシュ */
  STORAGE_KEY_OVERRIDES: '@kumotan:dictionary_overrides',
  /** AsyncStorageキー：差分データの最終更新日時 */
  STORAGE_KEY_OVERRIDES_UPDATED: '@kumotan:dictionary_overrides_updated',
  /** ダウンロードタイムアウト（ms） */
  DOWNLOAD_TIMEOUT: 5 * 60 * 1000, // 5分
  /** 差分キャッシュの有効期限（ms） */
  OVERRIDES_CACHE_TTL: 60 * 60 * 1000, // 1時間
} as const;

/**
 * Feature flags (can be used for gradual rollout)
 */
export const FEATURES = {
  ENABLE_TRANSLATION: true,
  ENABLE_DICTIONARY: true,
  ENABLE_OFFLINE_MODE: true,
  ENABLE_SHARE: true,
  ENABLE_OAUTH: true, // OAuth authentication feature
} as const;

/**
 * OAuth configuration
 */
export const OAUTH = {
  CODE_CHALLENGE_METHOD: 'S256', // SHA-256
  RESPONSE_TYPE: 'code',
  STATE_LENGTH: 16, // bytes
  CODE_VERIFIER_LENGTH: 32, // bytes (256 bits)
} as const;
