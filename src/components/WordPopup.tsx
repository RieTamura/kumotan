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
import { DictionaryResult, TranslateResult, JapaneseWordInfo, WordInfo } from '../types/word';
import { lookupWord } from '../services/dictionary/freeDictionary';
import { translateToJapanese, hasApiKey } from '../services/dictionary/deepl';
import { 
  analyzeMorphology,
  hasClientId as hasYahooClientId 
} from '../services/dictionary/yahooJapan';
import { Validators, extractEnglishWords } from '../utils/validators';
import { Button } from './common/Button';
import { useWordStore } from '../store/wordStore';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');
const MAX_POPUP_HEIGHT = SCREEN_HEIGHT * 0.85; // Maximum 85% of screen height
const MIN_POPUP_HEIGHT = SCREEN_HEIGHT * 0.5;  // Minimum 50% of screen height

/**
 * SwipeableWordCard Component - Swipe to remove word from list
 */
interface SwipeableWordCardProps {
  wordInfo: WordInfo;
  onRemove: () => void;
}

function SwipeableWordCard({ wordInfo, onRemove }: SwipeableWordCardProps): React.JSX.Element {
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
      <View style={[styles.wordItemCard, styles.wordItemCardRegistered]}>
        <View style={styles.wordCardHeader}>
          <Text style={styles.wordCardWord}>{wordInfo.word}</Text>
          <View style={styles.registeredBadge}>
            <Text style={styles.registeredBadgeText}>登録済み</Text>
          </View>
        </View>
        
        {wordInfo.japanese && (
          <View style={styles.wordCardRow}>
            <Text style={styles.wordCardLabel}>日本語訳:</Text>
            <Text style={styles.wordCardJapanese}>{wordInfo.japanese}</Text>
          </View>
        )}
        
        {wordInfo.definition && (
          <View style={styles.wordCardRow}>
            <Text style={styles.wordCardLabel}>定義:</Text>
            <Text style={styles.wordCardDefinition} numberOfLines={3}>
              {wordInfo.definition}
            </Text>
          </View>
        )}
        
        <Text style={styles.wordItemHint}>この単語は既に登録されています</Text>
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
      <View style={styles.wordItemCard}>
        {/* 単語名 */}
        <View style={styles.wordCardHeader}>
          <Text style={styles.wordCardWord}>{wordInfo.word}</Text>
        </View>
        
        {/* 日本語訳 */}
        {wordInfo.japanese && (
          <View style={styles.wordCardRow}>
            <Text style={styles.wordCardLabel}>日本語訳:</Text>
            <Text style={styles.wordCardJapanese}>{wordInfo.japanese}</Text>
          </View>
        )}
        
        {/* 定義 */}
        {wordInfo.definition && (
          <View style={styles.wordCardRow}>
            <Text style={styles.wordCardLabel}>定義:</Text>
            <Text style={styles.wordCardDefinition} numberOfLines={3}>
              {wordInfo.definition}
            </Text>
          </View>
        )}
        
        {/* スワイプヒント */}
        <Text style={styles.swipeHint}>← スワイプで除外</Text>
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
  const [slideAnim] = useState(new Animated.Value(MAX_POPUP_HEIGHT));
  const [backdropOpacity] = useState(new Animated.Value(0));
  
  const [definition, setDefinition] = useState<DictionaryResult | null>(null);
  const [translation, setTranslation] = useState<TranslateResult | null>(null);
  const [japaneseInfo, setJapaneseInfo] = useState<JapaneseWordInfo[]>([]);
  
  // Sentence mode states
  const [sentenceTranslation, setSentenceTranslation] = useState<TranslateResult | null>(null);
  const [wordsInfo, setWordsInfo] = useState<WordInfo[]>([]);
  
  const [definitionError, setDefinitionError] = useState<string | null>(null);
  const [translationError, setTranslationError] = useState<string | null>(null);
  const [japaneseError, setJapaneseError] = useState<string | null>(null);
  const [sentenceError, setSentenceError] = useState<string | null>(null);
  
  const [loading, setLoading] = useState<LoadingState>({
    definition: false,
    translation: false,
    japanese: false,
    sentenceTranslation: false,
    wordsInfo: false,
  });

  // Helper to update loading state
  const updateLoading = (key: keyof LoadingState, value: boolean) => {
    setLoading((prev: LoadingState) => ({ ...prev, [key]: value }));
  };
  const [apiKeyAvailable, setApiKeyAvailable] = useState(false);
  const [yahooClientIdAvailable, setYahooClientIdAvailable] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [isJapanese, setIsJapanese] = useState(false);
  
  // Get addWord from word store
  const addWordToStore = useWordStore(state => state.addWord);

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
   * Fetch word data when popup opens
   */
  useEffect(() => {
    console.log(`WordPopup useEffect: visible=${visible}, word="${word}"`);
    
    if (visible && word) {
      console.log('WordPopup useEffect: Calling fetchWordData');
      fetchWordData();
    } else {
      console.log('WordPopup useEffect: Resetting state');
      // Reset state when closed
      setDefinition(null);
      setTranslation(null);
      setJapaneseInfo([]);
      setSentenceTranslation(null);
      setWordsInfo([]);
      setDefinitionError(null);
      setTranslationError(null);
      setJapaneseError(null);
      setSentenceError(null);
      setIsAdding(false);
      setIsJapanese(false);
    }
  }, [visible, word, fetchWordData]);

  /**
   * Check API key availability
   */
  useEffect(() => {
    hasApiKey().then(setApiKeyAvailable);
    hasYahooClientId().then(setYahooClientIdAvailable);
  }, []);

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
  }, [word, isSentenceMode]);

  /**
   * Fetch data for single word (original logic)
   */
  const fetchSingleWordData = useCallback(async () => {
    // Check if word is Japanese
    const wordIsJapanese = Validators.isJapanese(word);
    setIsJapanese(wordIsJapanese);

    if (wordIsJapanese) {
      // Japanese word - use Yahoo! API
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
        } else {
          console.log(`WordPopup: Definition error:`, defResult.error.message);
          setDefinitionError(defResult.error.message);
        }
      } catch (error) {
        console.error('WordPopup: Unexpected error in lookupWord:', error);
        updateLoading('definition', false);
        setDefinitionError('予期しないエラーが発生しました');
      }

      // Fetch translation (only if API key is set)
      const hasKey = await hasApiKey();
      setApiKeyAvailable(hasKey);
      console.log(`WordPopup: API key available: ${hasKey}`);

      if (hasKey) {
        updateLoading('translation', true);
        const transResult = await translateToJapanese(word);
        updateLoading('translation', false);

        if (transResult.success) {
          setTranslation(transResult.data);
        } else {
          setTranslationError(transResult.error.message);
        }
      }
    }
  }, [word]);

  /**
   * Fetch data for sentence mode
   */
  const fetchSentenceData = useCallback(async () => {
    const hasKey = await hasApiKey();
    setApiKeyAvailable(hasKey);
    setIsJapanese(false);

    // 1. Translate the entire sentence
    if (hasKey) {
      updateLoading('sentenceTranslation', true);
      const sentenceResult = await translateToJapanese(word);
      updateLoading('sentenceTranslation', false);

      if (sentenceResult.success) {
        setSentenceTranslation(sentenceResult.data);
      } else {
        setSentenceError(sentenceResult.error.message);
      }
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

    // 4. Fetch info for each word
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
          isRegistered: true,
          isSelected: false, // Will be set by user
        };
      }

      // Fetch new data
      const [defResult, transResult] = await Promise.all([
        lookupWord(w),
        hasKey ? translateToJapanese(w) : Promise.resolve({ success: false, error: null }),
      ]);

      return {
        word: w,
        japanese: transResult.success ? transResult.data.text : null,
        definition: defResult.success ? defResult.data.definition : null,
        isRegistered: false,
        isSelected: !isRegistered, // Auto-select unregistered words
      };
    });

    const wordsInfoResults = await Promise.all(wordsInfoPromises);
    setWordsInfo(wordsInfoResults);
    updateLoading('wordsInfo', false);
  }, [word]);

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
          Alert.alert('情報', '登録する単語がありません');
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
              postUrl: postUri ?? undefined,
              postText: postText ?? undefined,
            })
          )
        );

        const successCount = results.filter(r => r.success).length;
        const failCount = results.length - successCount;

        if (successCount > 0) {
          Alert.alert(
            '成功',
            `${successCount}個の単語を追加しました${failCount > 0 ? `\n(${failCount}個は失敗)` : '！'}`
          );
          
          // Close popup after adding successfully
          setTimeout(() => {
            onClose();
          }, 500);
        } else {
          Alert.alert('エラー', 'すべての単語の追加に失敗しました');
        }
      } else if (isJapanese) {
        // Japanese word
        const mainToken = japaneseInfo.find(
          (token) =>
            !token.partOfSpeech.includes('助詞') &&
            !token.partOfSpeech.includes('記号') &&
            token.word.trim().length > 0
        );
        
        const reading = mainToken?.reading ?? null;
        
        const morphologyResult = japaneseInfo.length > 0
          ? japaneseInfo.map(token => 
              `${token.word} (${token.reading})\n品詞: ${token.partOfSpeech}\n基本形: ${token.baseForm}`
            ).join('\n\n')
          : null;
        
        const result = await addWordToStore({
          english: word,
          japanese: reading ?? undefined,
          definition: morphologyResult ?? undefined,
          postUrl: postUri ?? undefined,
          postText: postText ?? undefined,
        });
        
        if (result.success) {
          Alert.alert('成功', '単語を追加しました！');
          setTimeout(() => {
            onClose();
          }, 500);
        } else {
          Alert.alert('エラー', result.error.message);
        }
      } else {
        // English word
        const result = await addWordToStore({
          english: word,
          japanese: translation?.text ?? undefined,
          definition: definition?.definition ?? undefined,
          postUrl: postUri ?? undefined,
          postText: postText ?? undefined,
        });
        
        if (result.success) {
          Alert.alert('成功', '単語を追加しました！');
          setTimeout(() => {
            onClose();
          }, 500);
        } else {
          Alert.alert('エラー', result.error.message);
        }
      }
    } catch (error) {
      console.error('Failed to add word:', error);
      Alert.alert('エラー', '単語の追加に失敗しました');
    } finally {
      setIsAdding(false);
    }
  }, [word, isSentenceMode, isJapanese, wordsInfo, japaneseInfo, translation, definition, postUri, postText, addWordToStore, onAddToWordList, onClose]);

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
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Handle */}
          <View style={styles.handleContainer}>
            <View style={styles.handle} />
          </View>

          {/* Word/Sentence Header */}
          <View style={styles.header}>
            <Text style={isSentenceMode ? styles.sentence : styles.word}>
              {word}
            </Text>
            {!isJapanese && !isSentenceMode && definition?.phonetic && (
              <Text style={styles.phonetic}>{definition.phonetic}</Text>
            )}
            {!isJapanese && !isSentenceMode && definition?.partOfSpeech && (
              <View style={styles.posTag}>
              <Text style={styles.posText}>{definition.partOfSpeech}</Text>
            </View>
          )}
          {isSentenceMode && (
            <View style={styles.modeTag}>
              <Text style={styles.modeText}>文章モード</Text>
            </View>
          )}
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
                <Text style={styles.sectionTitle}>文章の日本語訳</Text>
                {loading.sentenceTranslation ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : sentenceTranslation ? (
                  <Text style={styles.translationText}>{sentenceTranslation.text}</Text>
                ) : sentenceError ? (
                  <Text style={styles.errorText}>{sentenceError}</Text>
                ) : !apiKeyAvailable ? (
                  <Text style={styles.hintText}>
                    DeepL API Keyを設定すると日本語訳が表示されます
                  </Text>
                ) : (
                  <Text style={styles.hintText}>-</Text>
                )}
              </View>

              {/* Words List */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>含まれる単語</Text>
                <Text style={styles.swipeInstruction}>
                  登録しない単語は左にスワイプして除外
                </Text>
                {loading.wordsInfo ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : wordsInfo.length > 0 ? (
                  <View style={styles.wordsListContainer}>
                    {wordsInfo.map((wordInfo, index) => (
                      <SwipeableWordCard
                        key={`${wordInfo.word}-${index}`}
                        wordInfo={wordInfo}
                        onRemove={() => {
                          setWordsInfo(prev => prev.filter((_, i) => i !== index));
                        }}
                      />
                    ))}
                  </View>
                ) : (
                  <Text style={styles.hintText}>単語が見つかりませんでした</Text>
                )}
              </View>
            </>
          )}

          {/* Word Mode Content (original) */}
          {!isSentenceMode && (
            <>
              {/* Japanese Word Info Section */}
              {isJapanese && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>形態素解析結果</Text>
              {loading.japanese ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : japaneseInfo.length > 0 ? (
                <>
                  {japaneseInfo.map((token, index) => (
                    <View key={`${token.word}-${token.reading}-${index}`} style={styles.tokenCard}>
                      <View style={styles.tokenHeader}>
                        <Text style={styles.tokenWord}>{token.word}</Text>
                        <Text style={styles.tokenReading}>({token.reading})</Text>
                      </View>
                      <View style={styles.tokenDetails}>
                        <Text style={styles.tokenDetailText}>品詞: {token.partOfSpeech}</Text>
                        <Text style={styles.tokenDetailText}>基本形: {token.baseForm}</Text>
                      </View>
                    </View>
                  ))}
                </>
              ) : japaneseError ? (
                <Text style={styles.errorText}>{japaneseError}</Text>
              ) : !yahooClientIdAvailable ? (
                <Text style={styles.hintText}>
                  Yahoo! Client IDを設定すると詳細情報が表示されます
                </Text>
              ) : (
                <Text style={styles.hintText}>-</Text>
              )}
            </View>
          )}

          {/* Translation Section (English words only) */}
          {!isJapanese && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>日本語訳</Text>
              {loading.translation ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : translation ? (
                <Text style={styles.translationText}>{translation.text}</Text>
              ) : translationError ? (
                <Text style={styles.errorText}>{translationError}</Text>
              ) : !apiKeyAvailable ? (
                <Text style={styles.hintText}>
                  DeepL API Keyを設定すると日本語訳が表示されます
                </Text>
              ) : (
                <Text style={styles.hintText}>-</Text>
              )}
            </View>
          )}

          {/* Definition Section (English words only) */}
          {!isJapanese && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>英語の定義</Text>
              {loading.definition ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : definition ? (
                <>
                  <Text style={styles.definitionText}>{definition.definition}</Text>
                  {definition.example && (
                    <Text style={styles.exampleText}>
                      例: "{definition.example}"
                    </Text>
                  )}
                </>
              ) : definitionError ? (
                <Text style={styles.errorText}>{definitionError}</Text>
              ) : (
                <Text style={styles.hintText}>-</Text>
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
            style={styles.cancelButton}
          />
        </View>
      </Animated.View>
      </GestureHandlerRootView>
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
    backgroundColor: Colors.border,
    borderRadius: 2,
  },
  header: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
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
  definitionText: {
    fontSize: FontSizes.md,
    color: Colors.text,
    lineHeight: 22,
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
    ...Shadows.card,
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
});

export default WordPopup;
