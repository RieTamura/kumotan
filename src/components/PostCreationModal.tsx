/**
 * PostCreationModal Component
 * Full-screen modal for creating Bluesky posts, inspired by Bluesky's own UI.
 */

import React, { useEffect, useCallback, useState, useMemo } from 'react';
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
import { X, Globe } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../hooks/useTheme';
import { usePostCreation } from '../hooks/usePostCreation';
import { Button } from './common/Button';
import { ReplySettingsModal } from './ReplySettingsModal';

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
  const { colors } = useTheme();
  return (
    <Pressable
      style={[
        styles.hashtagChip,
        { backgroundColor: colors.backgroundTertiary, borderColor: colors.border },
        selected && [styles.hashtagChipSelected, { backgroundColor: colors.primary, borderColor: colors.primary }],
      ]}
      onPress={onPress}
    >
      <Text
        style={[
          styles.hashtagChipText,
          { color: colors.textSecondary },
          selected && { color: colors.background, fontWeight: '600' },
        ]}
      >
        #{tag}
      </Text>
      {selected && (
        <X size={14} color={colors.background} style={styles.hashtagChipIcon} />
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
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('home');
  const { colors } = useTheme();

  const {
    text,
    hashtags,
    hashtagHistory,
    isPosting,
    error,
    characterCount,
    isValid,
    remainingCharacters,
    replySettings,
    setText,
    addHashtag,
    removeHashtag,
    setReplySettings,
    submitPost,
    reset,
    clearError,
  } = usePostCreation();

  const [showReplySettings, setShowReplySettings] = useState(false);

  /**
   * Get display label for current reply settings
   */
  const replySettingsLabel = useMemo(() => {
    if (replySettings.allowAll) return t('replySettingsLabel');
    if (replySettings.allowRules.length === 0) return t('replySettingsLabelNoReply');
    return t('replySettingsLabelCustom');
  }, [replySettings, t]);

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
    return { color: colors.textSecondary };
  }, [remainingCharacters, colors.textSecondary]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        {/* Header (Bluesky style) */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Pressable
            onPress={onClose}
            style={styles.headerCancel}
            disabled={isPosting}
          >
            <Text style={[styles.cancelText, { color: colors.primary }]}>{t('postCancel')}</Text>
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
                style={[styles.textInput, { color: colors.text }]}
                placeholder={t('postPlaceholder')}
                placeholderTextColor={colors.textTertiary}
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
              <View style={[styles.errorContainer, { backgroundColor: colors.errorLight }]}>
                <Text style={[styles.errorText, { color: colors.error }]}>{error.getUserMessage()}</Text>
                <Pressable onPress={clearError}>
                  <X size={16} color={colors.error} />
                </Pressable>
              </View>
            )}

            {/* Hashtags Section - Integrated into scroll */}
            <View style={styles.hashtagSection}>
              <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>{t('hashtags')}</Text>
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
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12), borderTopColor: colors.border, backgroundColor: colors.background }]}>
            <View style={styles.toolbar}>
              {/* Reply Settings Button */}
              <Pressable
                style={styles.replySettingsButton}
                onPress={() => setShowReplySettings(true)}
                disabled={isPosting}
              >
                <Globe size={16} color={colors.primary} />
                <Text style={[styles.replySettingsText, { color: colors.primary }]}>
                  {replySettingsLabel}
                </Text>
              </Pressable>

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

        {/* Reply Settings Modal */}
        <ReplySettingsModal
          visible={showReplySettings}
          settings={replySettings}
          onSave={setReplySettings}
          onClose={() => setShowReplySettings(false)}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16, // Spacing.lg
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerCancel: {
    paddingVertical: 8, // Spacing.sm
  },
  cancelText: {
    fontSize: 16, // FontSizes.lg
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  postButtonSmall: {
    minHeight: 32,
    paddingHorizontal: 16, // Spacing.lg
    paddingVertical: 0,
    borderRadius: 99, // BorderRadius.full
  },
  postButtonText: {
    fontSize: 14, // FontSizes.md
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  inputSection: {
    paddingHorizontal: 16, // Spacing.lg
    paddingTop: 16, // Spacing.lg
  },
  textInput: {
    fontSize: 18, // FontSizes.xl
    minHeight: SCREEN_HEIGHT * 0.2,
    textAlignVertical: 'top',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16, // Spacing.lg
    marginTop: 12, // Spacing.md
    padding: 8, // Spacing.sm
    borderRadius: 4, // BorderRadius.sm
  },
  errorText: {
    flex: 1,
    fontSize: 12, // FontSizes.sm
  },
  hashtagSection: {
    paddingHorizontal: 16, // Spacing.lg
    paddingVertical: 24, // Spacing.xl
  },
  sectionLabel: {
    fontSize: 12, // FontSizes.sm
    fontWeight: '600',
    marginBottom: 12, // Spacing.md
  },
  hashtagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8, // Spacing.sm
  },
  hashtagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12, // Spacing.md
    paddingVertical: 8, // Spacing.sm
    borderRadius: 12, // BorderRadius.lg
    borderWidth: 1,
  },
  hashtagChipSelected: {
    // Colors handled dynamically
  },
  hashtagChipText: {
    fontSize: 12, // FontSizes.sm
  },
  hashtagChipIcon: {
    marginLeft: 4, // Spacing.xs
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  toolbar: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16, // Spacing.lg
  },
  spacer: {
    flex: 1,
  },
  counterContainer: {
    justifyContent: 'center',
  },
  characterCount: {
    fontSize: 12, // FontSizes.sm
  },
  characterCountWarning: {
    color: '#FFAD1F', // Colors.warning
    fontWeight: '600',
  },
  characterCountError: {
    color: '#E0245E', // Colors.error
    fontWeight: '700',
  },
  replySettingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  replySettingsText: {
    fontSize: 13,
    fontWeight: '500',
  },
});

export default PostCreationModal;
