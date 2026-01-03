/**
 * WordPopup Component
 * Bottom sheet popup for displaying word definition and translation
 * Shows when a word is long-pressed in the timeline
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Animated,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Colors, Spacing, FontSizes, BorderRadius, Shadows } from '../constants/colors';
import { DictionaryResult, TranslateResult } from '../types/word';
import { lookupWord } from '../services/dictionary/freeDictionary';
import { translateToJapanese, hasApiKey } from '../services/dictionary/deepl';
import { Button } from './common/Button';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const POPUP_HEIGHT = SCREEN_HEIGHT * 0.5;

/**
 * WordPopup props interface
 */
interface WordPopupProps {
  visible: boolean;
  word: string;
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
}

/**
 * WordPopup Component
 */
export function WordPopup({
  visible,
  word,
  postUri,
  postText,
  onClose,
  onAddToWordList,
}: WordPopupProps): React.JSX.Element {
  const [slideAnim] = useState(new Animated.Value(POPUP_HEIGHT));
  const [backdropOpacity] = useState(new Animated.Value(0));
  
  const [definition, setDefinition] = useState<DictionaryResult | null>(null);
  const [translation, setTranslation] = useState<TranslateResult | null>(null);
  const [definitionError, setDefinitionError] = useState<string | null>(null);
  const [translationError, setTranslationError] = useState<string | null>(null);
  const [loading, setLoading] = useState<LoadingState>({
    definition: false,
    translation: false,
  });

  // Helper to update loading state
  const updateLoading = (key: keyof LoadingState, value: boolean) => {
    setLoading((prev: LoadingState) => ({ ...prev, [key]: value }));
  };
  const [apiKeyAvailable, setApiKeyAvailable] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

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
          toValue: POPUP_HEIGHT,
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
      setDefinitionError(null);
      setTranslationError(null);
      setIsAdding(false);
    }
  }, [visible, word, fetchWordData]);

  /**
   * Check API key availability
   */
  useEffect(() => {
    hasApiKey().then(setApiKeyAvailable);
  }, []);

  /**
   * Fetch definition and translation
   */
  const fetchWordData = useCallback(async () => {
    if (!word) {
      console.log('WordPopup: No word provided');
      return;
    }

    console.log(`WordPopup: Fetching data for word "${word}"`);

    // Reset errors
    setDefinitionError(null);
    setTranslationError(null);

    // Fetch definition
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
  }, [word]);

  /**
   * Handle add to word list
   */
  const handleAddToWordList = useCallback(async () => {
    setIsAdding(true);
    
    try {
      onAddToWordList(
        word,
        translation?.text ?? null,
        definition?.definition ?? null,
        postUri ?? null,
        postText ?? null
      );
      
      // Close popup after adding
      setTimeout(() => {
        onClose();
      }, 500);
    } finally {
      setIsAdding(false);
    }
  }, [word, translation, definition, postUri, postText, onAddToWordList, onClose]);

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

        {/* Word Header */}
        <View style={styles.header}>
          <Text style={styles.word}>{word}</Text>
          {definition?.phonetic && (
            <Text style={styles.phonetic}>{definition.phonetic}</Text>
          )}
          {definition?.partOfSpeech && (
            <View style={styles.posTag}>
              <Text style={styles.posText}>{definition.partOfSpeech}</Text>
            </View>
          )}
        </View>

        {/* Translation Section */}
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

        {/* Definition Section */}
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

        {/* Action Buttons */}
        <View style={styles.actions}>
          <Button
            title="単語帳に追加"
            onPress={handleAddToWordList}
            variant="primary"
            loading={isAdding}
            disabled={loading.definition || loading.translation}
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
    height: POPUP_HEIGHT,
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
