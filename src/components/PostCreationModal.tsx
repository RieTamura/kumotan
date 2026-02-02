/**
 * PostCreationModal Component
 * Full-screen modal for creating Bluesky posts, inspired by Bluesky's own UI.
 */

import React, { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { Colors, Spacing, FontSizes, BorderRadius } from '../constants/colors';
import { Button } from './common/Button';
import { usePostCreation } from '../hooks/usePostCreation';
import { useTranslation } from 'react-i18next';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const MAX_CHARACTERS = 300;

/**
 * HashtagChip Component
 */
interface HashtagChipProps {
  tag: string;
  selected: boolean;
  onPress: () => void;
}

function HashtagChip({ tag, selected, onPress }: HashtagChipProps): React.JSX.Element {
  return (
    <Pressable
      style={[
        styles.hashtagChip,
        selected && styles.hashtagChipSelected,
      ]}
      onPress={onPress}
    >
      <Text
        style={[
          styles.hashtagChipText,
          selected && styles.hashtagChipTextSelected,
        ]}
      >
        #{tag}
      </Text>
      {selected && (
        <X size={14} color={Colors.background} style={styles.hashtagChipIcon} />
      )}
    </Pressable>
  );
}

/**
 * PostCreationModal Component
 */
export function PostCreationModal({
  visible,
  onClose,
  onPostSuccess,
}: {
  visible: boolean;
  onClose: () => void;
  onPostSuccess?: () => void;
}): React.JSX.Element {
  const { t } = useTranslation('home');
  const insets = useSafeAreaInsets();

  const {
    text,
    hashtags,
    hashtagHistory,
    isPosting,
    error,
    characterCount,
    isValid,
    remainingCharacters,
    setText,
    addHashtag,
    removeHashtag,
    submitPost,
    reset,
    clearError,
  } = usePostCreation();

  /**
   * Reset state when modal closes
   */
  useEffect(() => {
    if (!visible) {
      reset();
    }
  }, [visible, reset]);

  /**
   * Handle submit post
   */
  const handleSubmit = useCallback(async () => {
    const success = await submitPost();
    if (success) {
      Alert.alert(t('postSuccess'));
      onClose();
      onPostSuccess?.();
    }
  }, [submitPost, onClose, onPostSuccess, t]);

  /**
   * Handle hashtag toggle
   */
  const handleHashtagPress = useCallback((tag: string) => {
    if (hashtags.includes(tag)) {
      removeHashtag(tag);
    } else {
      addHashtag(tag);
    }
  }, [hashtags, addHashtag, removeHashtag]);

  /**
   * Get character counter style based on remaining characters
   */
  const getCharacterCounterStyle = useCallback(() => {
    if (remainingCharacters < 0) {
      return styles.characterCountError;
    }
    if (remainingCharacters < 20) {
      return styles.characterCountWarning;
    }
    return styles.characterCount;
  }, [remainingCharacters]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header (Bluesky style) */}
        <View style={styles.header}>
          <Pressable
            onPress={onClose}
            style={styles.headerCancel}
            disabled={isPosting}
          >
            <Text style={styles.cancelText}>{t('postCancel')}</Text>
          </Pressable>

          <View style={styles.headerRight}>
            <Button
              title={isPosting ? t('posting') : t('postButton')}
              onPress={handleSubmit}
              variant="primary"
              loading={isPosting}
              disabled={!isValid || isPosting}
              style={styles.postButtonSmall}
              textStyle={styles.postButtonText}
            />
          </View>
        </View>

        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            style={styles.content}
            keyboardShouldPersistTaps="handled"
            bounces={true}
          >
            {/* Input Area */}
            <View style={styles.inputSection}>
              <TextInput
                style={styles.textInput}
                placeholder={t('postPlaceholder')}
                placeholderTextColor={Colors.textTertiary}
                value={text}
                onChangeText={setText}
                multiline
                autoFocus={true}
                editable={!isPosting}
                maxLength={MAX_CHARACTERS + 50}
              />
            </View>

            {/* Error Message */}
            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error.getUserMessage()}</Text>
                <Pressable onPress={clearError}>
                  <X size={16} color={Colors.error} />
                </Pressable>
              </View>
            )}

            {/* Hashtags Section - Integrated into scroll */}
            <View style={styles.hashtagSection}>
              <Text style={styles.sectionLabel}>{t('hashtags')}</Text>
              <View style={styles.hashtagsContainer}>
                {hashtagHistory.map((tag) => (
                  <HashtagChip
                    key={tag}
                    tag={tag}
                    selected={hashtags.includes(tag)}
                    onPress={() => handleHashtagPress(tag)}
                  />
                ))}
              </View>
            </View>
          </ScrollView>

          {/* Bottom Toolbar (Sticky above keyboard) */}
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, Spacing.md) }]}>
            <View style={styles.toolbar}>
              {/* Optional tools could go here (e.g. image upload icons) */}
              <View style={styles.spacer} />

              {/* Character Counter */}
              <View style={styles.counterContainer}>
                <Text style={[styles.characterCount, getCharacterCounterStyle()]}>
                  {characterCount}/{MAX_CHARACTERS}
                </Text>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  headerCancel: {
    paddingVertical: Spacing.sm,
  },
  cancelText: {
    fontSize: FontSizes.lg,
    color: Colors.primary,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  postButtonSmall: {
    minHeight: 32,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 0,
    borderRadius: BorderRadius.full,
  },
  postButtonText: {
    fontSize: FontSizes.md,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  inputSection: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  textInput: {
    fontSize: FontSizes.xl,
    color: Colors.text,
    minHeight: SCREEN_HEIGHT * 0.2,
    textAlignVertical: 'top',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.errorLight,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  errorText: {
    flex: 1,
    fontSize: FontSizes.sm,
    color: Colors.error,
  },
  hashtagSection: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xl,
  },
  sectionLabel: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
  },
  hashtagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  hashtagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundTertiary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  hashtagChipSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  hashtagChipText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  hashtagChipTextSelected: {
    color: Colors.background,
    fontWeight: '600',
  },
  hashtagChipIcon: {
    marginLeft: Spacing.xs,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.divider,
    backgroundColor: Colors.background,
  },
  toolbar: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  spacer: {
    flex: 1,
  },
  counterContainer: {
    justifyContent: 'center',
  },
  characterCount: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  characterCountWarning: {
    color: Colors.warning,
    fontWeight: '600',
  },
  characterCountError: {
    color: Colors.error,
    fontWeight: '700',
  },
});

export default PostCreationModal;
