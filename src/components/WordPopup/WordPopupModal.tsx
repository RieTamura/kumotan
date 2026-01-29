/**
 * WordPopupModal Component
 * Refactored bottom sheet popup with useReducer and modular hooks
 */

import React, { useState, useEffect, useCallback, useReducer } from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useTranslation } from 'react-i18next';
import { Colors, Spacing, FontSizes, BorderRadius, Shadows } from '../../constants/colors';
import { Validators } from '../../utils/validators';
import { Button } from '../common/Button';
import { useWordStore } from '../../store/wordStore';

import { WordPopupProps } from './types';
import { wordPopupReducer, initialState } from './reducer';
import { SwipeableWordCard } from './components/SwipeableWordCard';
import { useWordLookup } from './hooks/useWordLookup';
import { useJapaneseMorphology } from './hooks/useJapaneseMorphology';
import { useJapaneseToEnglish } from './hooks/useJapaneseToEnglish';
import { useSentenceLookup } from './hooks/useSentenceLookup';
import { isDictionaryInstalled } from '../../services/dictionary/ExternalDictionaryService';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const MAX_POPUP_HEIGHT = SCREEN_HEIGHT * 0.85;

/**
 * WordPopupModal Component
 */
export function WordPopupModal({
  visible,
  word,
  isSentenceMode = false,
  postUri,
  postText,
  onClose,
  onAddToWordList,
}: WordPopupProps): React.JSX.Element {
  const { t } = useTranslation('wordPopup');
  const insets = useSafeAreaInsets();
  const [state, dispatch] = useReducer(wordPopupReducer, initialState);
  const [slideAnim] = useState(new Animated.Value(MAX_POPUP_HEIGHT));
  const [backdropOpacity] = useState(new Animated.Value(0));

  // Hooks for data fetching
  const wordLookup = useWordLookup();
  const japaneseMorphology = useJapaneseMorphology();
  const japaneseToEnglish = useJapaneseToEnglish();
  const sentenceLookup = useSentenceLookup();

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
   * Check dictionary installation and show alert if not installed
   */
  useEffect(() => {
    if (visible && word) {
      const checkDictionary = async () => {
        const installed = await isDictionaryInstalled();
        if (!installed) {
          Alert.alert(
            t('alerts.dictionaryNotInstalledTitle'),
            t('alerts.dictionaryNotInstalled')
          );
        }
      };
      checkDictionary();
    }
  }, [visible, word, t]);

  /**
   * Fetch word data when popup opens
   */
  useEffect(() => {
    if (visible && word) {
      fetchWordData();
    } else {
      // Reset state when closed
      dispatch({ type: 'RESET' });
      wordLookup.reset();
      japaneseMorphology.reset();
      japaneseToEnglish.reset();
      sentenceLookup.reset();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, word]);

  /**
   * Fetch data based on mode and language
   */
  const fetchWordData = useCallback(async () => {
    if (!word) return;

    if (isSentenceMode) {
      // Sentence mode
      const isJapanese = Validators.isJapanese(word);
      dispatch({ type: 'SET_IS_JAPANESE', isJapanese });

      if (isJapanese) {
        // Japanese sentence
        await sentenceLookup.fetchJapaneseSentence(word);
        dispatch({ type: 'SET_WORDS_INFO', wordsInfo: sentenceLookup.wordsInfo });
        if (sentenceLookup.sentenceError) {
          dispatch({ type: 'SET_SENTENCE_ERROR', error: sentenceLookup.sentenceError });
        }
      } else {
        // English sentence
        await sentenceLookup.fetchEnglishSentence(word);
        dispatch({ type: 'SET_SENTENCE_TRANSLATION', translation: sentenceLookup.sentenceTranslation });
        dispatch({ type: 'SET_WORDS_INFO', wordsInfo: sentenceLookup.wordsInfo });
        if (sentenceLookup.sentenceError) {
          dispatch({ type: 'SET_SENTENCE_ERROR', error: sentenceLookup.sentenceError });
        }
      }
    } else {
      // Word mode
      const isJapanese = Validators.isJapanese(word);
      dispatch({ type: 'SET_IS_JAPANESE', isJapanese });

      if (isJapanese) {
        // Japanese word - fetch morphology and English translation in parallel
        await Promise.all([
          japaneseMorphology.fetchJapaneseData(word),
          japaneseToEnglish.fetchEnglishTranslation(word),
        ]);
        dispatch({ type: 'SET_JAPANESE_INFO', japaneseInfo: japaneseMorphology.japaneseInfo });
        if (japaneseMorphology.japaneseError) {
          dispatch({ type: 'SET_JAPANESE_ERROR', error: japaneseMorphology.japaneseError });
        }
      } else {
        // English word
        await wordLookup.fetchWordData(word);
        dispatch({ type: 'SET_DEFINITION', definition: wordLookup.definition });
        dispatch({ type: 'SET_TRANSLATION', translation: wordLookup.translation });
        if (wordLookup.definitionError) {
          dispatch({ type: 'SET_DEFINITION_ERROR', error: wordLookup.definitionError });
        }
        if (wordLookup.definitionNotFound) {
          dispatch({ type: 'SET_DEFINITION_NOT_FOUND', notFound: true });
        }
        if (wordLookup.translationError) {
          dispatch({ type: 'SET_TRANSLATION_ERROR', error: wordLookup.translationError });
        }
      }
    }
  }, [word, isSentenceMode, wordLookup, japaneseMorphology, japaneseToEnglish, sentenceLookup]);

  /**
   * Handle add to word list
   */
  const handleAddToWordList = useCallback(async () => {
    dispatch({ type: 'SET_IS_ADDING', isAdding: true });

    try {
      if (isSentenceMode) {
        // Sentence mode - add all non-registered words
        const wordsToAdd = state.wordsInfo.filter(w => !w.isRegistered);

        if (wordsToAdd.length === 0) {
          Alert.alert(t('alerts.info'), t('alerts.noWordsToRegister'));
          dispatch({ type: 'SET_IS_ADDING', isAdding: false });
          return;
        }

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
          const message = failCount > 0
            ? `${t('alerts.wordsAdded', { count: successCount })}\n${t('alerts.wordsFailed', { count: failCount })}`
            : t('alerts.wordsAdded', { count: successCount }) + '!';
          Alert.alert(t('alerts.success'), message);
          setTimeout(() => onClose(), 500);
        } else {
          Alert.alert(t('alerts.error'), t('alerts.allWordsFailed'));
        }
      } else if (state.isJapanese) {
        // Japanese word
        const mainToken = state.japaneseInfo.find(
          token =>
            !token.partOfSpeech.includes('助詞') &&
            !token.partOfSpeech.includes('記号') &&
            token.word.trim().length > 0
        );

        const reading = mainToken?.reading ?? null;

        // Get English translation if available
        const englishTranslation = japaneseToEnglish.englishTranslation?.text ?? null;

        // Build definition with English translation and morphology info
        const definitionParts: string[] = [];
        if (englishTranslation) {
          definitionParts.push(`${t('japaneseWord.englishTranslation')}: ${englishTranslation}`);
        }
        if (state.japaneseInfo.length > 0) {
          const morphologyResult = state.japaneseInfo
            .map(token => `${token.word} (${token.reading})\n${t('morphology.partOfSpeech')}: ${token.partOfSpeech}\n${t('morphology.baseForm')}: ${token.baseForm}`)
            .join('\n\n');
          definitionParts.push(morphologyResult);
        }
        const definition = definitionParts.length > 0 ? definitionParts.join('\n\n') : null;

        const result = await addWordToStore({
          english: word,
          japanese: englishTranslation ?? reading ?? undefined,
          definition: definition || undefined,
          postUrl: postUri ?? undefined,
          postText: postText ?? undefined,
        });

        if (result.success) {
          Alert.alert(t('alerts.success'), t('alerts.wordAdded'));
          setTimeout(() => onClose(), 500);
        } else {
          Alert.alert(t('alerts.error'), result.error.message);
        }
      } else {
        // English word
        const result = await addWordToStore({
          english: word,
          japanese: state.translation?.text ?? undefined,
          definition: state.definition?.definition ?? undefined,
          postUrl: postUri ?? undefined,
          postText: postText ?? undefined,
        });

        if (result.success) {
          Alert.alert(t('alerts.success'), t('alerts.wordAdded'));
          setTimeout(() => onClose(), 500);
        } else {
          Alert.alert(t('alerts.error'), result.error.message);
        }
      }
    } catch (error) {
      console.error('Failed to add word:', error);
      Alert.alert(t('alerts.error'), t('alerts.addFailed'));
    } finally {
      dispatch({ type: 'SET_IS_ADDING', isAdding: false });
    }
  }, [word, isSentenceMode, state, postUri, postText, addWordToStore, onClose, japaneseToEnglish.englishTranslation, t]);

  /**
   * Handle backdrop press
   */
  const handleBackdropPress = useCallback(() => {
    if (!state.isAdding) {
      onClose();
    }
  }, [state.isAdding, onClose]);

  /**
   * Handle word removal from sentence mode list
   */
  const handleRemoveWord = useCallback((index: number) => {
    dispatch({
      type: 'SET_WORDS_INFO',
      wordsInfo: state.wordsInfo.filter((_, i) => i !== index),
    });
  }, [state.wordsInfo]);

  // Combined loading state
  const isLoading =
    wordLookup.loading.definition ||
    wordLookup.loading.translation ||
    japaneseMorphology.loading ||
    japaneseToEnglish.loading ||
    sentenceLookup.loading.sentenceTranslation ||
    sentenceLookup.loading.wordsInfo;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleBackdropPress}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        {/* Backdrop */}
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
          <Pressable style={styles.backdropPressable} onPress={handleBackdropPress} />
        </Animated.View>

        {/* Popup */}
        <Animated.View style={[styles.popup, { transform: [{ translateY: slideAnim }] }]}>
          {/* Handle */}
          <View style={styles.handleContainer}>
            <View style={styles.handle} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Text style={isSentenceMode ? styles.sentence : styles.word}>{word}</Text>
            {!state.isJapanese && !isSentenceMode && state.definition?.phonetic && (
              <Text style={styles.phonetic}>{state.definition.phonetic}</Text>
            )}
            {!state.isJapanese && !isSentenceMode && state.definition?.partOfSpeech && (
              <View style={styles.posTag}>
                <Text style={styles.posText}>{state.definition.partOfSpeech}</Text>
              </View>
            )}
            {isSentenceMode && (
              <View style={styles.modeTag}>
                <Text style={styles.modeText}>{t('sentence.mode')}</Text>
              </View>
            )}
          </View>

          {/* Content */}
          <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollContentContainer}>
            {/* Sentence Mode */}
            {isSentenceMode && (
              <>
                {/* Sentence Translation */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>{t('sentence.japaneseTranslation')}</Text>
                  {sentenceLookup.loading.sentenceTranslation ? (
                    <ActivityIndicator size="small" color={Colors.primary} />
                  ) : state.sentenceTranslation ? (
                    <Text style={styles.translationText}>{state.sentenceTranslation.text}</Text>
                  ) : state.sentenceError ? (
                    <Text style={styles.errorText}>{state.sentenceError}</Text>
                  ) : !sentenceLookup.translationAvailable ? (
                    <Text style={styles.hintText}>{t('englishWord.translationHint')}</Text>
                  ) : (
                    <Text style={styles.hintText}>{t('placeholder')}</Text>
                  )}
                </View>

                {/* Words List */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>{t('sentence.containedWords')}</Text>
                  <Text style={styles.swipeInstruction}>{t('sentence.swipeInstruction')}</Text>
                  {sentenceLookup.loading.wordsInfo ? (
                    <ActivityIndicator size="small" color={Colors.primary} />
                  ) : state.wordsInfo.length > 0 ? (
                    <View style={styles.wordsListContainer}>
                      {state.wordsInfo.map((wordInfo, index) => (
                        <SwipeableWordCard
                          key={`word-${index}-${wordInfo.word}`}
                          wordInfo={wordInfo}
                          onRemove={() => handleRemoveWord(index)}
                        />
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.hintText}>{t('sentence.noWordsFound')}</Text>
                  )}
                </View>
              </>
            )}

            {/* Word Mode */}
            {!isSentenceMode && (
              <>
                {/* Japanese Word Info */}
                {state.isJapanese && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{t('morphology.resultTitle')}</Text>
                    {japaneseMorphology.loading ? (
                      <ActivityIndicator size="small" color={Colors.primary} />
                    ) : state.japaneseInfo.length > 0 ? (
                      <>
                        {state.japaneseInfo.map((token, index) => (
                          <View key={`token-${index}-${token.word}-${token.reading}`} style={styles.tokenCard}>
                            <View style={styles.tokenHeader}>
                              <Text style={styles.tokenWord}>{token.word}</Text>
                              <Text style={styles.tokenReading}>({token.reading})</Text>
                            </View>
                            <View style={styles.tokenDetails}>
                              <Text style={styles.tokenDetailText}>{t('morphology.partOfSpeech')}: {token.partOfSpeech}</Text>
                              <Text style={styles.tokenDetailText}>{t('morphology.baseForm')}: {token.baseForm}</Text>
                            </View>
                          </View>
                        ))}
                      </>
                    ) : state.japaneseError ? (
                      <Text style={styles.errorText}>{state.japaneseError}</Text>
                    ) : !japaneseMorphology.yahooClientIdAvailable ? (
                      <Text style={styles.hintText}>{t('morphology.yahooHint')}</Text>
                    ) : (
                      <Text style={styles.hintText}>{t('placeholder')}</Text>
                    )}
                  </View>
                )}

                {/* English Translation (Japanese words) */}
                {state.isJapanese && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{t('japaneseWord.englishTranslation')}</Text>
                    {japaneseToEnglish.loading ? (
                      <ActivityIndicator size="small" color={Colors.primary} />
                    ) : japaneseToEnglish.englishTranslation ? (
                      <View>
                        <Text style={styles.translationText}>
                          {japaneseToEnglish.englishTranslation.text}
                        </Text>
                        {japaneseToEnglish.englishTranslation.readings &&
                          japaneseToEnglish.englishTranslation.readings.length > 0 && (
                          <Text style={styles.readingText}>
                            {t('japaneseWord.reading')}: {japaneseToEnglish.englishTranslation.readings.join(', ')}
                          </Text>
                        )}
                        {japaneseToEnglish.englishTranslation.partOfSpeech &&
                          japaneseToEnglish.englishTranslation.partOfSpeech.length > 0 && (
                          <View style={styles.posTagContainer}>
                            {japaneseToEnglish.englishTranslation.partOfSpeech.map((pos, index) => (
                              <View key={`pos-${index}`} style={styles.posTag}>
                                <Text style={styles.posText}>{pos}</Text>
                              </View>
                            ))}
                          </View>
                        )}
                        {japaneseToEnglish.englishTranslation.isCommon && (
                          <Text style={styles.commonWordText}>{t('japaneseWord.commonWord')}</Text>
                        )}
                        <Text style={styles.sourceText}>
                          {t('japaneseWord.source')}: {
                            japaneseToEnglish.englishTranslation.source === 'jmdict'
                              ? t('japaneseWord.sourceJMdict')
                              : t('japaneseWord.sourceDeepL')
                          }
                        </Text>
                      </View>
                    ) : japaneseToEnglish.translationError ? (
                      <Text style={styles.errorText}>{japaneseToEnglish.translationError}</Text>
                    ) : (
                      <Text style={styles.hintText}>{t('japaneseWord.translationHint')}</Text>
                    )}
                  </View>
                )}

                {/* Translation (English words) */}
                {!state.isJapanese && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{t('translation')}</Text>
                    {wordLookup.loading.translation ? (
                      <ActivityIndicator size="small" color={Colors.primary} />
                    ) : state.translation ? (
                      <>
                        <Text style={styles.translationText}>{state.translation.text}</Text>
                        {state.translation.source && (
                          <Text style={styles.sourceText}>
                            {t('japaneseWord.source')}: {
                              state.translation.source === 'jmdict'
                                ? t('japaneseWord.sourceJMdict')
                                : t('japaneseWord.sourceDeepL')
                            }
                          </Text>
                        )}
                        {state.translation.readings && state.translation.readings.length > 0 && (
                          <Text style={styles.readingText}>
                            {t('japaneseWord.reading')}: {state.translation.readings.join(', ')}
                          </Text>
                        )}
                        {state.translation.partOfSpeech && state.translation.partOfSpeech.length > 0 && (
                          <Text style={styles.posInfoText}>
                            {t('partOfSpeech')}: {state.translation.partOfSpeech.join(', ')}
                          </Text>
                        )}
                      </>
                    ) : state.translationError ? (
                      <Text style={styles.errorText}>{state.translationError}</Text>
                    ) : !wordLookup.translationAvailable ? (
                      <Text style={styles.hintText}>{t('englishWord.translationHint')}</Text>
                    ) : (
                      <Text style={styles.hintText}>{t('placeholder')}</Text>
                    )}
                  </View>
                )}

                {/* Definition (English words) */}
                {!state.isJapanese && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{t('definition')}</Text>
                    {wordLookup.loading.definition ? (
                      <ActivityIndicator size="small" color={Colors.primary} />
                    ) : state.definition ? (
                      <>
                        <Text style={styles.definitionText}>{state.definition.definition}</Text>
                        {state.definition.example && (
                          <Text style={styles.exampleText}>{t('englishWord.example')}: "{state.definition.example}"</Text>
                        )}
                      </>
                    ) : state.definitionNotFound ? (
                      <Text style={styles.notFoundText}>{t('englishWord.definitionNotFound')}</Text>
                    ) : state.definitionError ? (
                      <Text style={styles.errorText}>{state.definitionError}</Text>
                    ) : (
                      <Text style={styles.hintText}>{t('placeholder')}</Text>
                    )}
                  </View>
                )}
              </>
            )}
          </ScrollView>

          {/* Action Buttons */}
          <View style={[styles.actions, { paddingBottom: Math.max(insets.bottom, Spacing.lg) }]}>
            <Button
              title={
                isSentenceMode
                  ? t('buttons.registerWords', { count: state.wordsInfo.filter(w => !w.isRegistered).length })
                  : t('addToWordList')
              }
              onPress={handleAddToWordList}
              variant="primary"
              loading={state.isAdding}
              disabled={
                isLoading ||
                (isSentenceMode && state.wordsInfo.filter(w => !w.isRegistered).length === 0)
              }
              style={styles.addButton}
            />
            <Button
              title={t('buttons.cancel')}
              onPress={handleBackdropPress}
              variant="outline"
              disabled={state.isAdding}
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
    paddingBottom: 140,
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
  readingText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  posTagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  commonWordText: {
    fontSize: FontSizes.sm,
    color: Colors.success,
    marginTop: Spacing.xs,
  },
  sourceText: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
    marginTop: Spacing.sm,
  },
  posInfoText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    gap: Spacing.md,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  addButton: {
    flex: 2,
  },
  cancelButton: {
    flex: 1,
  },
});
