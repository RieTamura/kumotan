/**
 * WordPopup Component
 * Bottom sheet popup for displaying word definition and translation
 * Shows when a word is long-pressed in the timeline
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Animated,
  Dimensions,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
import { Colors, Spacing, FontSizes, BorderRadius, Shadows } from '../constants/colors';
import { useTheme } from '../hooks/useTheme';
import { DictionaryResult, JapaneseWordInfo, WordInfo } from '../types/word';
import { lookupWord } from '../services/dictionary/freeDictionary';
import { useTranslation } from 'react-i18next';
import {
  translateToJapaneseWithFallback,
  ExtendedTranslateResult,
} from '../services/dictionary/translate';
import {
  analyzeMorphology,
  hasClientId as hasYahooClientId
} from '../services/dictionary/yahooJapan';
import { Validators, extractEnglishWords } from '../utils/validators';
import { Button } from './common/Button';
import { useWordStore } from '../store/wordStore';
import {
  translateToEnglishWithFallback,
  ExtendedTranslateResult as EnglishTranslateResult,
} from '../services/dictionary/translate';
import { MessageSquareShare, Volume2, VolumeX } from 'lucide-react-native';
import { useSpeech } from '../hooks/useSpeech';
import { FeedbackModal } from './FeedbackModal';
import { API } from '../constants/config';
import { translateToJapanese, hasApiKey as hasDeepLApiKey } from '../services/dictionary/deepl';
import { useSettingsStore } from '../store/settingsStore';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');
const MAX_POPUP_HEIGHT = SCREEN_HEIGHT * 0.85; // Maximum 85% of screen height

/**
 * SwipeableWordCard Component - Swipe to remove word from list
 */
interface SwipeableWordCardProps {
  wordInfo: WordInfo;
  onRemove: () => void;
}

function SwipeableWordCard({ wordInfo, onRemove }: SwipeableWordCardProps): React.JSX.Element {
  const { colors, isDark } = useTheme();
  const swipeableRef = useRef<Swipeable>(null);

  // 右側に表示される削除背景
  const renderRightActions = (
    progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>
  ) => {
    const opacity = dragX.interpolate({
      inputRange: [-100, -50, 0],
      outputRange: [1, 0.8, 0],
      extrapolate: 'clamp',
    });

    const scale = dragX.interpolate({
      inputRange: [-100, 0],
      outputRange: [1, 0.8],
      extrapolate: 'clamp',
    });

    return (
      <Animated.View style={[styles.deleteBackground, { opacity }]}>
        <Animated.Text style={[styles.deleteBackgroundText, { transform: [{ scale }] }]}>
          除外
        </Animated.Text>
      </Animated.View>
    );
  };

  const handleSwipeOpen = () => {
    // スワイプが完了したらカードを削除
    onRemove();
  };

  // 登録済みの単語はスワイプ不可
  if (wordInfo.isRegistered) {
    return (
      <View style={[
        styles.wordItemCard,
        { backgroundColor: colors.card, borderColor: colors.border },
        wordInfo.isRegistered && [styles.wordItemCardRegistered, { backgroundColor: isDark ? '#1B301B' : '#E8F5E9', borderColor: '#4CAF50' }]
      ]}>
        <View style={styles.wordCardHeader}>
          <Text style={[styles.wordCardWord, { color: colors.text }]}>{wordInfo.word}</Text>
          <View style={styles.registeredBadge}>
            <Text style={styles.registeredBadgeText}>登録済み</Text>
          </View>
        </View>

        {wordInfo.japanese && (
          <View style={styles.wordCardRow}>
            <Text style={[styles.wordCardLabel, { color: colors.textSecondary }]}>日本語訳:</Text>
            <Text style={[styles.wordCardJapanese, { color: colors.primary }]}>{wordInfo.japanese}</Text>
          </View>
        )}

        {wordInfo.definition && (
          <View style={styles.wordCardRow}>
            <Text style={[styles.wordCardLabel, { color: colors.textSecondary }]}>定義:</Text>
            <Text style={[styles.wordCardDefinition, { color: colors.text }]} numberOfLines={3}>
              {wordInfo.definition}
            </Text>
          </View>
        )}

        {wordInfo.definition && wordInfo.definitionJa && (
          <View style={styles.wordCardRow}>
            <Text style={[styles.wordCardLabel, { color: colors.textSecondary }]}>定義の日本語訳:</Text>
            <Text style={[styles.wordCardDefinition, { color: colors.text }]} numberOfLines={3}>
              {wordInfo.definitionJa}
            </Text>
          </View>
        )}

        <Text style={[styles.wordItemHint, { color: colors.textTertiary }]}>この単語は既に登録されています</Text>
      </View>
    );
  }

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      onSwipeableOpen={handleSwipeOpen}
      rightThreshold={80}
      overshootRight={false}
      containerStyle={styles.swipeableContainer}
    >
      <View style={[styles.wordItemCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {/* 単語名 */}
        <View style={styles.wordCardHeader}>
          <Text style={[styles.wordCardWord, { color: colors.text }]}>{wordInfo.word}</Text>
        </View>

        {/* 日本語訳 */}
        {wordInfo.japanese && (
          <View style={styles.wordCardRow}>
            <Text style={[styles.wordCardLabel, { color: colors.textSecondary }]}>日本語訳:</Text>
            <Text style={[styles.wordCardJapanese, { color: colors.primary }]}>{wordInfo.japanese}</Text>
          </View>
        )}

        {/* 定義 */}
        {wordInfo.definition && (
          <View style={styles.wordCardRow}>
            <Text style={[styles.wordCardLabel, { color: colors.textSecondary }]}>定義:</Text>
            <Text style={[styles.wordCardDefinition, { color: colors.text }]} numberOfLines={3}>
              {wordInfo.definition}
            </Text>
          </View>
        )}

        {/* 定義の日本語訳 */}
        {wordInfo.definition && wordInfo.definitionJa && (
          <View style={styles.wordCardRow}>
            <Text style={[styles.wordCardLabel, { color: colors.textSecondary }]}>定義の日本語訳:</Text>
            <Text style={[styles.wordCardDefinition, { color: colors.text }]} numberOfLines={3}>
              {wordInfo.definitionJa}
            </Text>
          </View>
        )}

        {/* スワイプヒント */}
        <Text style={[styles.swipeHint, { color: colors.textTertiary }]}>← スワイプで除外</Text>
      </View>
    </Swipeable>
  );
}

/**
 * WordPopup props interface
 */
interface WordPopupProps {
  visible: boolean;
  word: string;
  isSentenceMode?: boolean;  // True if displaying a sentence instead of a word
  postUri?: string;
  postText?: string;
  onClose: () => void;
  onAddToWordList: (
    word: string,
    japanese: string | null,
    definition: string | null,
    definitionJa: string | null,
    postUri: string | null,
    postText: string | null
  ) => void;
}

/**
 * Loading state for each API
 */
interface LoadingState {
  definition: boolean;
  translation: boolean;
  sentenceTranslation: boolean;
  wordsInfo: boolean;
  japanese: boolean;
  englishTranslation: boolean;
  definitionTranslation: boolean;
}

/**
 * WordPopup Component
 */
export function WordPopup({
  visible,
  word,
  isSentenceMode = false,
  postUri,
  postText,
  onClose,
  onAddToWordList,
}: WordPopupProps): React.JSX.Element {
  const { t } = useTranslation('wordPopup');
  const { colors, isDark } = useTheme();
  const [slideAnim] = useState(new Animated.Value(MAX_POPUP_HEIGHT));
  const [backdropOpacity] = useState(new Animated.Value(0));

  const [definition, setDefinition] = useState<DictionaryResult | null>(null);
  const [definitionJa, setDefinitionJa] = useState<string | null>(null);
  const [translation, setTranslation] = useState<ExtendedTranslateResult | null>(null);
  const [japaneseInfo, setJapaneseInfo] = useState<JapaneseWordInfo[]>([]);
  const [englishTranslation, setEnglishTranslation] = useState<EnglishTranslateResult | null>(null);

  // Sentence mode states
  const [sentenceTranslation, setSentenceTranslation] = useState<ExtendedTranslateResult | null>(null);
  const [wordsInfo, setWordsInfo] = useState<WordInfo[]>([]);

  const [definitionError, setDefinitionError] = useState<string | null>(null);
  const [definitionNotFound, setDefinitionNotFound] = useState<boolean>(false);
  const [translationError, setTranslationError] = useState<string | null>(null);
  const [japaneseError, setJapaneseError] = useState<string | null>(null);
  const [sentenceError, setSentenceError] = useState<string | null>(null);
  const [englishTranslationError, setEnglishTranslationError] = useState<string | null>(null);

  const [loading, setLoading] = useState<LoadingState>({
    definition: false,
    translation: false,
    japanese: false,
    sentenceTranslation: false,
    wordsInfo: false,
    englishTranslation: false,
    definitionTranslation: false,
  });

  // Helper to update loading state
  const updateLoading = (key: keyof LoadingState, value: boolean) => {
    setLoading((prev: LoadingState) => ({ ...prev, [key]: value }));
  };
  const [translationAvailable, setTranslationAvailable] = useState(false);
  const [yahooClientIdAvailable, setYahooClientIdAvailable] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [isJapanese, setIsJapanese] = useState(false);
  const [isFeedbackVisible, setIsFeedbackVisible] = useState(false);

  const { speak, stop: stopSpeech, isSpeaking } = useSpeech();

  // Get addWord from word store
  const addWordToStore = useWordStore(state => state.addWord);
  const translateDefinition = useSettingsStore(state => state.translateDefinition);
  const translateSentenceToEnglish = useSettingsStore(state => state.translateSentenceToEnglish);
  const translateDefinitionInEnglishSentence = useSettingsStore(state => state.translateDefinitionInEnglishSentence);
  const autoSpeechOnPopup = useSettingsStore(state => state.autoSpeechOnPopup);

  // Auto-speak when popup opens with a new word
  useEffect(() => {
    if (!autoSpeechOnPopup || !word) return;
    const lang = Validators.isJapanese(word) ? 'ja-JP' : 'en-US';
    speak(word, { language: lang });
  }, [word]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Animate popup open/close
   */
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          damping: 20,
          stiffness: 150,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: MAX_POPUP_HEIGHT,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, slideAnim, backdropOpacity]);

  /**
   * Convert JapaneseWordInfo to WordInfo for sentence mode
   */
  const convertJapaneseInfoToWordInfo = useCallback((tokens: JapaneseWordInfo[]): WordInfo[] => {
    return tokens.map(token => ({
      word: token.word,
      japanese: token.reading,
      definition: `${token.partOfSpeech} - 基本形: ${token.baseForm}`,
      definitionJa: null,
      isRegistered: false,
      isSelected: true,
    }));
  }, []);

  /**
   * Check Yahoo Client ID availability
   */
  useEffect(() => {
    hasYahooClientId().then(setYahooClientIdAvailable);
  }, []);

  /**
   * Fetch data for single word (original logic)
   */
  const fetchSingleWordData = useCallback(async () => {
    // Check if word is Japanese
    const wordIsJapanese = Validators.isJapanese(word);
    setIsJapanese(wordIsJapanese);

    if (wordIsJapanese) {
      // Japanese word - get English translation and optionally morphological analysis

      // 1. Fetch English translation (JMdict + DeepL fallback)
      updateLoading('englishTranslation', true);
      const englishResult = await translateToEnglishWithFallback(word);
      updateLoading('englishTranslation', false);

      if (englishResult.success) {
        setEnglishTranslation(englishResult.data);
      } else {
        setEnglishTranslationError(englishResult.error.message);
      }

      // 2. Optionally use Yahoo! API for morphological analysis
      const hasYahooId = await hasYahooClientId();
      setYahooClientIdAvailable(hasYahooId);

      if (hasYahooId) {
        updateLoading('japanese', true);
        const japaneseResult = await analyzeMorphology(word);
        updateLoading('japanese', false);

        if (japaneseResult.success) {
          setJapaneseInfo(japaneseResult.data);
        } else {
          setJapaneseError(japaneseResult.error.message);
        }
      }
    } else {
      // English word - use existing logic
      console.log(`WordPopup: Starting dictionary lookup for "${word}"`);
      updateLoading('definition', true);

      try {
        const defResult = await lookupWord(word);
        updateLoading('definition', false);

        console.log(`WordPopup: Dictionary result:`, defResult);

        if (defResult.success) {
          console.log(`WordPopup: Definition found:`, defResult.data);
          setDefinition(defResult.data);

          // Translate definition to Japanese if settings allow
          const hasDeepLKey = await hasDeepLApiKey();
          if (translateDefinition && hasDeepLKey) {
            updateLoading('definitionTranslation', true);
            const jaResult = await translateToJapanese(defResult.data.definition);
            if (jaResult.success) {
              setDefinitionJa(jaResult.data.text);
            }
            updateLoading('definitionTranslation', false);
          }
        } else {
          console.log(`WordPopup: Definition error:`, defResult.error.message);
          // WORD_NOT_FOUNDの場合は穏やかな「見つからない」状態にする
          if (defResult.error.code === 'WORD_NOT_FOUND') {
            setDefinitionNotFound(true);
          } else {
            setDefinitionError(defResult.error.message);
          }
        }
      } catch (error) {
        console.error('WordPopup: Unexpected error in lookupWord:', error);
        updateLoading('definition', false);
        setDefinitionError('予期しないエラーが発生しました');
      }

      // Fetch translation (JMdict優先、DeepLフォールバック)
      updateLoading('translation', true);
      const transResult = await translateToJapaneseWithFallback(word);
      updateLoading('translation', false);

      if (transResult.success) {
        setTranslation(transResult.data);
        setTranslationAvailable(true);
      } else {
        setTranslationError(transResult.error.message);
        setTranslationAvailable(false);
      }
    }
  }, [word, translateDefinition]);

  /**
   * Fetch data for English sentence mode
   */
  const fetchEnglishSentenceData = useCallback(async () => {
    // 1. Translate the entire sentence (JMdict + DeepL fallback)
    updateLoading('sentenceTranslation', true);
    const sentenceResult = await translateToJapaneseWithFallback(word, { isWord: false });
    updateLoading('sentenceTranslation', false);

    if (sentenceResult.success) {
      setSentenceTranslation(sentenceResult.data);
      setTranslationAvailable(true);
    } else {
      setSentenceError(sentenceResult.error.message);
      setTranslationAvailable(false);
    }

    // 2. Extract words from sentence
    const words = extractEnglishWords(word);
    console.log(`WordPopup: Extracted ${words.length} words from sentence:`, words);

    if (words.length === 0) {
      return;
    }

    // 3. Get registered words from store
    const registeredWords = useWordStore.getState().words;
    const registeredWordsSet = new Set(
      registeredWords.map(w => w.english.toLowerCase())
    );

    // 4. Check DeepL availability once before the loop
    const hasDeepLKey = await hasDeepLApiKey();

    // 5. Fetch info for each word
    updateLoading('wordsInfo', true);

    const wordsInfoPromises = words.map(async (w): Promise<WordInfo> => {
      const isRegistered = registeredWordsSet.has(w.toLowerCase());

      // If already registered, don't fetch new data
      if (isRegistered) {
        const registeredWord = registeredWords.find(
          rw => rw.english.toLowerCase() === w.toLowerCase()
        );
        return {
          word: w,
          japanese: registeredWord?.japanese || null,
          definition: registeredWord?.definition || null,
          definitionJa: registeredWord?.definitionJa || null,
          isRegistered: true,
          isSelected: false, // Will be set by user
        };
      }

      // Fetch new data (JMdict優先、DeepLフォールバック)
      const [defResult, transResult] = await Promise.all([
        lookupWord(w),
        translateToJapaneseWithFallback(w),
      ]);

      // Translate definition to Japanese if settings allow
      let definitionJa: string | null = null;
      if (defResult.success && translateDefinitionInEnglishSentence && hasDeepLKey) {
        const jaResult = await translateToJapanese(defResult.data.definition);
        if (jaResult.success) {
          definitionJa = jaResult.data.text;
        }
      }

      return {
        word: w,
        japanese: transResult.success ? transResult.data.text : null,
        definition: defResult.success ? defResult.data.definition : null,
        definitionJa,
        isRegistered: false,
        isSelected: !isRegistered, // Auto-select unregistered words
      };
    });

    const wordsInfoResults = await Promise.all(wordsInfoPromises);
    setWordsInfo(wordsInfoResults);
    updateLoading('wordsInfo', false);
  }, [word, translateDefinitionInEnglishSentence]);

  /**
   * Fetch data for Japanese sentence mode
   */
  const fetchJapaneseSentenceData = useCallback(async () => {
    // Translate Japanese sentence to English if settings allow
    const hasDeepLKey = await hasDeepLApiKey();
    if (translateSentenceToEnglish && hasDeepLKey) {
      updateLoading('sentenceTranslation', true);
      const englishResult = await translateToEnglishWithFallback(word, { isWord: false });
      updateLoading('sentenceTranslation', false);

      if (englishResult.success) {
        setSentenceTranslation(englishResult.data);
        setTranslationAvailable(true);
      } else {
        setSentenceError(englishResult.error.message);
      }
    }

    const hasYahooId = await hasYahooClientId();
    setYahooClientIdAvailable(hasYahooId);

    if (!hasYahooId) {
      console.log('WordPopup: Yahoo Client ID not available');
      return;
    }

    console.log('WordPopup: Analyzing Japanese sentence with morphology');

    // Morphological analysis
    updateLoading('wordsInfo', true);
    const result = await analyzeMorphology(word);
    updateLoading('wordsInfo', false);

    if (result.success) {
      console.log(`WordPopup: Extracted ${result.data.length} words from sentence:`, result.data);

      // Convert morphological analysis results to WordInfo
      const wordInfos = convertJapaneseInfoToWordInfo(result.data);

      // Get registered words from store
      const registeredWords = useWordStore.getState().words;
      const registeredWordsSet = new Set(
        registeredWords.map(w => w.english.toLowerCase())
      );

      // Update isRegistered flag
      const updatedWordInfos = wordInfos.map(info => ({
        ...info,
        isRegistered: registeredWordsSet.has(info.word.toLowerCase()),
        isSelected: !registeredWordsSet.has(info.word.toLowerCase()),
      }));

      setWordsInfo(updatedWordInfos);
    } else {
      console.error('WordPopup: Morphological analysis error:', result.error.message);
      setSentenceError(result.error.message);
    }
  }, [word, convertJapaneseInfoToWordInfo, translateSentenceToEnglish]);

  /**
   * Fetch data for sentence mode
   */
  const fetchSentenceData = useCallback(async () => {
    // Japanese detection
    const sentenceIsJapanese = Validators.isJapanese(word);
    setIsJapanese(sentenceIsJapanese);

    if (sentenceIsJapanese) {
      // Japanese sentence processing
      await fetchJapaneseSentenceData();
    } else {
      // English sentence processing
      await fetchEnglishSentenceData();
    }
  }, [word, fetchJapaneseSentenceData, fetchEnglishSentenceData]);

  /**
   * Fetch definition and translation
   */
  const fetchWordData = useCallback(async () => {
    if (!word) {
      console.log('WordPopup: No word provided');
      return;
    }

    console.log(`WordPopup: Fetching data for ${isSentenceMode ? 'sentence' : 'word'} "${word}"`);

    // Reset errors
    setDefinitionError(null);
    setDefinitionNotFound(false);
    setTranslationError(null);
    setJapaneseError(null);
    setSentenceError(null);

    if (isSentenceMode) {
      // Sentence mode - translate sentence and get info for all words
      await fetchSentenceData();
    } else {
      // Word mode - existing logic
      await fetchSingleWordData();
    }
  }, [word, isSentenceMode, fetchSentenceData, fetchSingleWordData]);

  /**
   * Fetch word data when popup opens
   */
  useEffect(() => {
    console.log(`WordPopup useEffect: visible=${visible}, word="${word}"`);

    if (visible && word) {
      console.log('WordPopup useEffect: Calling fetchWordData');
      // Reset state before fetching new data
      setDefinition(null);
      setDefinitionJa(null);
      setTranslation(null);
      setJapaneseInfo([]);
      setSentenceTranslation(null);
      setWordsInfo([]);
      setEnglishTranslation(null);
      setDefinitionError(null);
      setDefinitionNotFound(false);
      setTranslationError(null);
      setJapaneseError(null);
      setSentenceError(null);
      setEnglishTranslationError(null);
      setIsAdding(false);
      // Call fetchWordData
      fetchWordData();
    } else {
      console.log('WordPopup useEffect: Resetting state');
      stopSpeech();
      // Reset state when closed
      setDefinition(null);
      setDefinitionJa(null);
      setTranslation(null);
      setJapaneseInfo([]);
      setSentenceTranslation(null);
      setWordsInfo([]);
      setEnglishTranslation(null);
      setDefinitionError(null);
      setDefinitionNotFound(false);
      setTranslationError(null);
      setJapaneseError(null);
      setSentenceError(null);
      setEnglishTranslationError(null);
      setIsAdding(false);
      setIsJapanese(false);
    }
  }, [visible, word, fetchWordData]);

  /**
   * Handle add to word list
   */
  const handleAddToWordList = useCallback(async () => {
    setIsAdding(true);

    try {
      if (isSentenceMode) {
        // Sentence mode - add all remaining words (not swiped away)
        const wordsToAdd = wordsInfo.filter(w => !w.isRegistered);

        if (wordsToAdd.length === 0) {
          Alert.alert(t('alerts.info'), t('alerts.noWordsToRegister'));
          setIsAdding(false);
          return;
        }

        // Add all remaining words
        const results = await Promise.all(
          wordsToAdd.map(w =>
            addWordToStore({
              english: w.word,
              japanese: w.japanese ?? undefined,
              definition: w.definition ?? undefined,
              definitionJa: w.definitionJa ?? undefined,
              postUrl: postUri ?? undefined,
              postText: postText ?? undefined,
            })
          )
        );

        const successCount = results.filter(r => r.success).length;
        const failCount = results.length - successCount;

        if (successCount > 0) {
          const message = t('alerts.wordsAdded', { count: successCount }) +
            (failCount > 0 ? `\n${t('alerts.wordsFailed', { count: failCount })}` : '!');
          Alert.alert(t('alerts.success'), message);

          // Close popup after adding successfully
          setTimeout(() => {
            onClose();
          }, 500);
        } else {
          Alert.alert(t('alerts.error'), t('alerts.allWordsFailed'));
        }
      } else if (isJapanese) {
        // Japanese word - use English translation and optionally morphology result
        const englishText = englishTranslation?.text?.trim();
        const readings = englishTranslation?.readings ?? null;

        if (!englishText) {
          Alert.alert(t('alerts.error'), t('sentence.noTranslation'));
          return;
        }

        // Build definition from English translation and morphology
        const definitionParts: string[] = [];

        if (readings && readings.length > 0) {
          definitionParts.push(`読み: ${readings.join(', ')}`);
        }

        if (englishTranslation?.partOfSpeech && englishTranslation.partOfSpeech.length > 0) {
          definitionParts.push(`品詞: ${englishTranslation.partOfSpeech.join(', ')}`);
        }

        const definitionText = definitionParts.length > 0 ? definitionParts.join('\n') : undefined;

        const result = await addWordToStore({
          english: englishText,
          japanese: word,
          definition: definitionText,
          postUrl: postUri ?? undefined,
          postText: postText ?? undefined,
        });

        if (result.success) {
          Alert.alert(t('alerts.success'), t('alerts.wordAdded'));
          setTimeout(() => {
            onClose();
          }, 500);
        } else {
          Alert.alert(t('alerts.error'), result.error.message);
        }
      } else {
        // English word
        const result = await addWordToStore({
          english: word,
          japanese: translation?.text ?? undefined,
          definition: definition?.definition ?? undefined,
          definitionJa: definitionJa ?? undefined,
          postUrl: postUri ?? undefined,
          postText: postText ?? undefined,
        });

        if (result.success) {
          Alert.alert(t('alerts.success'), t('alerts.wordAdded'));
          setTimeout(() => {
            onClose();
          }, 500);
        } else {
          Alert.alert(t('alerts.error'), result.error.message);
        }
      }
    } catch (error) {
      console.error('Failed to add word:', error);
      Alert.alert(t('alerts.error'), t('alerts.addFailed'));
    } finally {
      setIsAdding(false);
    }
  }, [word, isSentenceMode, isJapanese, wordsInfo, japaneseInfo, translation, definition, definitionJa, postUri, postText, addWordToStore, onAddToWordList, onClose]);

  /**
   * Handle backdrop press
   */
  const handleBackdropPress = useCallback(() => {
    if (!isAdding) {
      onClose();
    }
  }, [isAdding, onClose]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleBackdropPress}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        {/* Backdrop */}
        <Animated.View
          style={[
            styles.backdrop,
            { opacity: backdropOpacity },
          ]}
        >
          <Pressable style={styles.backdropPressable} onPress={handleBackdropPress} />
        </Animated.View>

        {/* Popup */}
        <Animated.View
          style={[
            styles.popup,
            {
              backgroundColor: colors.background,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Handle */}
          <View style={styles.handleContainer}>
            <View style={[styles.handle, { backgroundColor: colors.border }]} />
          </View>

          {/* Word/Sentence Header */}
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <Text style={[isSentenceMode ? styles.sentence : styles.word, { color: colors.text }]} numberOfLines={2}>
                {word}
              </Text>
              {!isJapanese && !isSentenceMode && definition?.phonetic && (
                <Text style={[styles.phonetic, { color: colors.textSecondary }]}>{definition.phonetic}</Text>
              )}
              {!isJapanese && !isSentenceMode && definition?.partOfSpeech && (
                <View style={[styles.posTag, { backgroundColor: colors.backgroundSecondary }]}>
                  <Text style={[styles.posText, { color: colors.textSecondary }]}>{definition.partOfSpeech}</Text>
                </View>
              )}
              {isSentenceMode && (
                <View style={[styles.modeTag, { backgroundColor: colors.primary + '20' }]}>
                  <Text style={[styles.modeText, { color: colors.primary }]}>文章モード</Text>
                </View>
              )}
            </View>

            {/* Speaker Icon */}
            <Pressable
              onPress={() => {
                if (isSpeaking) {
                  stopSpeech();
                } else {
                  speak(word, { language: isJapanese ? 'ja-JP' : 'en-US' });
                }
              }}
              style={styles.feedbackButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              {isSpeaking
                ? <VolumeX size={22} color={colors.primary} />
                : <Volume2 size={22} color={colors.primary} />
              }
            </Pressable>

            {/* Feedback Icon */}
            <Pressable
              onPress={() => setIsFeedbackVisible(true)}
              style={styles.feedbackButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MessageSquareShare size={22} color={colors.primary} />
            </Pressable>
          </View>

          {/* Scrollable Content */}
          <ScrollView
            style={styles.scrollContent}
            contentContainerStyle={styles.scrollContentContainer}
          >
            {/* Sentence Mode Content */}
            {isSentenceMode && (
              <>
                {/* Sentence Translation */}
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                    {isJapanese ? t('sentence.englishTranslation') : t('sentence.japaneseTranslation')}
                  </Text>
                  {loading.sentenceTranslation ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : sentenceTranslation ? (
                    <Text style={[styles.translationText, { color: colors.text }]}>{sentenceTranslation.text}</Text>
                  ) : sentenceError ? (
                    <Text style={[styles.errorText, { color: colors.error }]}>{sentenceError}</Text>
                  ) : (
                    <Text style={styles.hintText}>{t('sentence.translationUnavailable')}</Text>
                  )}
                </View>

                {/* Words List */}
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>含まれる単語</Text>
                  <Text style={[styles.swipeInstruction, { color: colors.textTertiary }]}>
                    登録しない単語は左にスワイプして除外
                  </Text>
                  {loading.wordsInfo ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : wordsInfo.length > 0 ? (
                    <View style={styles.wordsListContainer}>
                      {wordsInfo.map((wordInfo, index) => (
                        <SwipeableWordCard
                          key={`word-${index}-${wordInfo.word}`}
                          wordInfo={wordInfo}
                          onRemove={() => {
                            setWordsInfo(prev => prev.filter((_, i) => i !== index));
                          }}
                        />
                      ))}
                    </View>
                  ) : (
                    <Text style={[styles.hintText, { color: colors.textTertiary }]}>単語が見つかりませんでした</Text>
                  )}
                </View>
              </>
            )}

            {/* Word Mode Content (original) */}
            {!isSentenceMode && (
              <>
                {/* Japanese Word - English Translation Section */}
                {isJapanese && (
                  <View style={[styles.section, { borderBottomColor: colors.divider }]}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>英語訳</Text>
                    {loading.englishTranslation ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : englishTranslation ? (
                      <>
                        <Text style={[styles.translationText, { color: colors.text }]}>{englishTranslation.text}</Text>
                        {englishTranslation.source && (
                          <Text style={[styles.sourceText, { color: colors.textTertiary }]}>
                            出典: {englishTranslation.source === 'jmdict' ? 'JMdict辞書' : 'DeepL翻訳'}
                          </Text>
                        )}
                        {englishTranslation.readings && englishTranslation.readings.length > 0 && (
                          <Text style={[styles.readingText, { color: colors.textSecondary }]}>
                            読み: {englishTranslation.readings.join(', ')}
                          </Text>
                        )}
                        {englishTranslation.partOfSpeech && englishTranslation.partOfSpeech.length > 0 && (
                          <Text style={[styles.posInfoText, { color: colors.textSecondary }]}>
                            品詞: {englishTranslation.partOfSpeech.join(', ')}
                          </Text>
                        )}
                      </>
                    ) : englishTranslationError ? (
                      <Text style={[styles.errorText, { color: colors.error }]}>{englishTranslationError}</Text>
                    ) : (
                      <Text style={[styles.hintText, { color: colors.textTertiary }]}>英語訳が見つかりませんでした</Text>
                    )}
                  </View>
                )}

                {/* Japanese Word Info Section (Morphological Analysis) */}
                {isJapanese && (
                  <View style={[styles.section, { borderBottomColor: colors.divider }]}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>形態素解析結果</Text>
                    {loading.japanese ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : japaneseInfo.length > 0 ? (
                      <>
                        {japaneseInfo.map((token, index) => (
                          <View key={`token-${index}-${token.word}-${token.reading}`} style={[styles.tokenCard, { backgroundColor: colors.backgroundSecondary }]}>
                            <View style={styles.tokenHeader}>
                              <Text style={[styles.tokenWord, { color: colors.text }]}>{token.word}</Text>
                              <Text style={[styles.tokenReading, { color: colors.textSecondary }]}>({token.reading})</Text>
                            </View>
                            <View style={styles.tokenDetails}>
                              <Text style={[styles.tokenDetailText, { color: colors.textSecondary }]}>品詞: {token.partOfSpeech}</Text>
                              <Text style={[styles.tokenDetailText, { color: colors.textSecondary }]}>基本形: {token.baseForm}</Text>
                            </View>
                          </View>
                        ))}
                      </>
                    ) : japaneseError ? (
                      <Text style={[styles.errorText, { color: colors.error }]}>{japaneseError}</Text>
                    ) : !yahooClientIdAvailable ? (
                      <Text style={[styles.hintText, { color: colors.textTertiary }]}>
                        Yahoo! Client IDを設定すると詳細情報が表示されます
                      </Text>
                    ) : (
                      <Text style={[styles.hintText, { color: colors.textTertiary }]}>-</Text>
                    )}
                  </View>
                )}

                {/* Translation Section (English words only) */}
                {!isJapanese && (
                  <View style={[styles.section, { borderBottomColor: colors.divider }]}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>日本語訳</Text>
                    {loading.translation ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : translation ? (
                      <>
                        <Text style={[styles.translationText, { color: colors.text }]}>{translation.text}</Text>
                        {translation.source && (
                          <Text style={[styles.sourceText, { color: colors.textTertiary }]}>
                            出典: {translation.source === 'jmdict' ? 'JMdict辞書' : 'DeepL翻訳'}
                          </Text>
                        )}
                        {translation.readings && translation.readings.length > 0 && (
                          <Text style={[styles.readingText, { color: colors.textSecondary }]}>
                            読み: {translation.readings.join(', ')}
                          </Text>
                        )}
                        {translation.partOfSpeech && translation.partOfSpeech.length > 0 && (
                          <Text style={[styles.posInfoText, { color: colors.textSecondary }]}>
                            品詞: {translation.partOfSpeech.join(', ')}
                          </Text>
                        )}
                      </>
                    ) : translationError ? (
                      <Text style={[styles.errorText, { color: colors.error }]}>{translationError}</Text>
                    ) : !translationAvailable ? (
                      <Text style={[styles.hintText, { color: colors.textTertiary }]}>
                        翻訳が利用できません
                      </Text>
                    ) : (
                      <Text style={[styles.hintText, { color: colors.textTertiary }]}>-</Text>
                    )}
                  </View>
                )}

                {/* Definition Section (English words only) */}
                {!isJapanese && (
                  <View style={[styles.section, { borderBottomColor: colors.divider }]}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>英語の定義</Text>
                    {loading.definition ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : definition ? (
                      <>
                        <Text style={[styles.definitionText, { color: colors.text }]}>{definition.definition}</Text>
                        {loading.definitionTranslation ? (
                          <ActivityIndicator size="small" color={colors.primary} style={styles.definitionJaLoader} />
                        ) : definitionJa ? (
                          <Text style={[styles.definitionJaText, { color: colors.textSecondary }]}>{definitionJa}</Text>
                        ) : null}
                        {definition.example && (
                          <Text style={[styles.exampleText, { color: colors.textSecondary }]}>
                            例: &quot;{definition.example}&quot;
                          </Text>
                        )}
                      </>
                    ) : definitionNotFound ? (
                      <Text style={[styles.notFoundText, { color: colors.textSecondary }]}>定義が見つかりませんでした</Text>
                    ) : definitionError ? (
                      <Text style={[styles.errorText, { color: colors.error }]}>{definitionError}</Text>
                    ) : (
                      <Text style={[styles.hintText, { color: colors.textTertiary }]}>-</Text>
                    )}
                  </View>
                )}
              </>
            )}
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <Button
              title={isSentenceMode
                ? `単語を登録 (${wordsInfo.filter(w => !w.isRegistered).length}件)`
                : '単語帳に追加'}
              onPress={handleAddToWordList}
              variant="primary"
              loading={isAdding}
              disabled={
                loading.definition ||
                loading.translation ||
                loading.japanese ||
                loading.sentenceTranslation ||
                loading.wordsInfo ||
                (isSentenceMode && wordsInfo.filter(w => !w.isRegistered).length === 0)
              }
              style={styles.addButton}
            />
            <Button
              title="キャンセル"
              onPress={handleBackdropPress}
              variant="outline"
              disabled={isAdding}
              style={[styles.cancelButton, { backgroundColor: colors.background }]}
            />
          </View>
        </Animated.View>
      </GestureHandlerRootView>

      <FeedbackModal
        visible={isFeedbackVisible}
        word={word}
        partOfSpeech={
          translation?.partOfSpeech?.join(', ') ||
          definition?.partOfSpeech ||
          englishTranslation?.partOfSpeech?.join(', ') ||
          undefined
        }
        postUrl={postUri}
        onClose={() => setIsFeedbackVisible(false)}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.overlay,
  },
  backdropPressable: {
    flex: 1,
  },
  popup: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: MAX_POPUP_HEIGHT,
    backgroundColor: Colors.background,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    ...Shadows.lg,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#CCCCCC',
    borderRadius: 2,
  },
  header: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  word: {
    fontSize: FontSizes.xxl,
    fontWeight: '700',
    color: Colors.text,
  },
  sentence: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    color: Colors.text,
    lineHeight: 24,
  },
  phonetic: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  posTag: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  posText: {
    fontSize: FontSizes.xs,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  modeTag: {
    backgroundColor: '#FF9800',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  modeText: {
    fontSize: FontSizes.xs,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingBottom: 100, // Space for action buttons
  },
  section: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  sectionTitle: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  tokenCard: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  tokenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
    gap: Spacing.xs,
  },
  tokenWord: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    color: Colors.text,
  },
  tokenReading: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
  },
  tokenDetails: {
    gap: 2,
  },
  tokenDetailText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  translationText: {
    fontSize: FontSizes.xl,
    fontWeight: '600',
    color: Colors.text,
  },
  sourceText: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
    marginTop: Spacing.xs,
  },
  readingText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  posInfoText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  definitionText: {
    fontSize: FontSizes.md,
    color: Colors.text,
    lineHeight: 22,
  },
  definitionJaLoader: {
    marginTop: Spacing.xs,
    alignSelf: 'flex-start',
  },
  definitionJaText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginTop: Spacing.xs,
    fontStyle: 'italic',
  },
  definitionCard: {
    backgroundColor: Colors.backgroundSecondary,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  partOfSpeechText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
    fontStyle: 'italic',
  },
  exampleText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  swipeInstruction: {
    fontSize: FontSizes.sm,
    color: Colors.textTertiary,
    marginBottom: Spacing.md,
    fontStyle: 'italic',
  },
  wordsListContainer: {
    gap: Spacing.md,
  },
  swipeableContainer: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  deleteBackground: {
    flex: 1,
    backgroundColor: '#FF5252',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  deleteBackgroundText: {
    color: '#FFFFFF',
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
  },
  wordItemCard: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    ...Shadows.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  wordItemCardRegistered: {
    backgroundColor: '#E8F5E9',
    borderColor: '#4CAF50',
  },
  wordCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  wordCardWord: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.text,
    flex: 1,
  },
  wordCardRow: {
    marginBottom: Spacing.xs,
  },
  wordCardLabel: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  wordCardJapanese: {
    fontSize: FontSizes.md,
    color: Colors.primary,
    fontWeight: '600',
  },
  wordCardDefinition: {
    fontSize: FontSizes.sm,
    color: Colors.text,
    lineHeight: 20,
  },
  swipeHint: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
    textAlign: 'right',
    marginTop: Spacing.sm,
    fontStyle: 'italic',
  },
  registeredBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  registeredBadgeText: {
    fontSize: FontSizes.xs,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  wordItemHint: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
    fontStyle: 'italic',
    marginTop: Spacing.sm,
  },
  errorText: {
    fontSize: FontSizes.sm,
    color: Colors.error,
  },
  notFoundText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  hintText: {
    fontSize: FontSizes.sm,
    color: Colors.textTertiary,
    fontStyle: 'italic',
  },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    gap: Spacing.md,
    position: 'absolute',
    bottom: Spacing.xl,
    left: 0,
    right: 0,
  },
  addButton: {
    flex: 2,
  },
  cancelButton: {
    flex: 1,
  },
  feedbackButton: {
    padding: Spacing.xs,
  },
});

export default WordPopup;
