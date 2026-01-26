/**
 * Dictionary Services Index
 * Re-exports all dictionary-related functions
 */

// DeepL API (Japanese translation)
export {
  translateToJapanese,
  getApiKey,
  saveApiKey,
  deleteApiKey,
  hasApiKey,
  validateApiKey,
  getUsage,
  isUsageWarning,
  isUsageCritical,
  formatUsage,
  type DeepLUsage,
} from './deepl';

// Free Dictionary API (English definitions)
export {
  lookupWord,
  lookupWords,
  getDetailedDefinition,
  isEnglishWord,
  extractWords,
} from './freeDictionary';

// Yahoo! JAPAN API (Japanese word analysis)
export {
  analyzeMorphology,
  addFurigana,
  getJapaneseWordInfo,
  getClientId as getYahooClientId,
  saveClientId as saveYahooClientId,
  deleteClientId as deleteYahooClientId,
  hasClientId as hasYahooClientId,
  validateClientId as validateYahooClientId,
  type JapaneseWordInfo,
} from './yahooJapan';

// JMdict辞書 (オフライン英日辞書)
export {
  initJMdictDatabase,
  isJMdictAvailable,
  lookupJMdict,
  translateWithJMdict,
  clearJMdictCache,
  getJMdictMetadata,
  JMDICT_LICENSE_TEXT,
  JMDICT_ATTRIBUTION,
} from './jmdict';

// 統合翻訳サービス (JMdict + DeepL フォールバック)
export {
  translateToJapaneseWithFallback,
  getTranslationServiceStatus,
  getRecommendedSource,
  type TranslationSource,
  type ExtendedTranslateResult,
  type TranslateOptions,
} from './translate';
