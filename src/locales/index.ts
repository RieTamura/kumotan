/**
 * i18n Configuration
 * Internationalization setup using i18next
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../constants/config';

// Import Japanese translations
import jaCommon from './ja/common.json';
import jaNavigation from './ja/navigation.json';
import jaSettings from './ja/settings.json';
import jaHome from './ja/home.json';
import jaWordList from './ja/wordList.json';
import jaProgress from './ja/progress.json';
import jaLogin from './ja/login.json';
import jaApiSetup from './ja/apiSetup.json';
import jaWordPopup from './ja/wordPopup.json';
import jaLicense from './ja/license.json';
import jaDebugLogs from './ja/debugLogs.json';

// Import English translations
import enCommon from './en/common.json';
import enNavigation from './en/navigation.json';
import enSettings from './en/settings.json';
import enHome from './en/home.json';
import enWordList from './en/wordList.json';
import enProgress from './en/progress.json';
import enLogin from './en/login.json';
import enApiSetup from './en/apiSetup.json';
import enWordPopup from './en/wordPopup.json';
import enLicense from './en/license.json';
import enDebugLogs from './en/debugLogs.json';

/**
 * Translation resources
 */
export const resources = {
  ja: {
    common: jaCommon,
    navigation: jaNavigation,
    settings: jaSettings,
    home: jaHome,
    wordList: jaWordList,
    progress: jaProgress,
    login: jaLogin,
    apiSetup: jaApiSetup,
    wordPopup: jaWordPopup,
    license: jaLicense,
    debugLogs: jaDebugLogs,
  },
  en: {
    common: enCommon,
    navigation: enNavigation,
    settings: enSettings,
    home: enHome,
    wordList: enWordList,
    progress: enProgress,
    login: enLogin,
    apiSetup: enApiSetup,
    wordPopup: enWordPopup,
    license: enLicense,
    debugLogs: enDebugLogs,
  },
} as const;

/**
 * Supported languages
 */
export type Language = 'ja' | 'en';

/**
 * Available namespaces
 */
export type Namespace = keyof typeof resources['ja'];

/**
 * Default namespace
 */
export const defaultNS: Namespace = 'common';

/**
 * Language detector for AsyncStorage
 */
const languageDetector = {
  type: 'languageDetector' as const,
  async: true,
  detect: async (callback: (lang: Language) => void) => {
    try {
      const savedLanguage = await AsyncStorage.getItem(STORAGE_KEYS.LANGUAGE);
      if (savedLanguage === 'ja' || savedLanguage === 'en') {
        callback(savedLanguage);
      } else {
        callback('ja'); // Default to Japanese
      }
    } catch {
      callback('ja');
    }
  },
  init: () => {},
  cacheUserLanguage: async (language: Language) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.LANGUAGE, language);
    } catch (error) {
      console.error('Failed to save language preference:', error);
    }
  },
};

/**
 * Initialize i18n
 */
i18n
  .use(languageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'ja',
    defaultNS,
    ns: [
      'common',
      'navigation',
      'settings',
      'home',
      'wordList',
      'progress',
      'login',
      'apiSetup',
      'wordPopup',
      'license',
      'debugLogs',
    ],
    interpolation: {
      escapeValue: false, // React already handles escaping
    },
    react: {
      useSuspense: false, // For React Native compatibility
    },
  });

/**
 * Change the current language
 */
export const changeLanguage = async (language: Language): Promise<void> => {
  await i18n.changeLanguage(language);
};

/**
 * Get the current language
 */
export const getCurrentLanguage = (): Language => {
  return (i18n.language as Language) || 'ja';
};

/**
 * Check if a language is supported
 */
export const isSupportedLanguage = (lang: string): lang is Language => {
  return lang === 'ja' || lang === 'en';
};

export default i18n;
