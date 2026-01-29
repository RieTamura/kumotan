/**
 * PostCreationModal Component
 * Center popup modal for creating Bluesky posts
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
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { X } from 'lucide-react-native';
import { Colors, Spacing, FontSizes, BorderRadius, Shadows } from '../constants/colors';
import { Button } from './common/Button';
import { usePostCreation } from '../hooks/usePostCreation';
import { useTranslation } from 'react-i18next';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const POPUP_WIDTH = Math.min(SCREEN_WIDTH - Spacing.xl * 2, 400);
const MAX_CHARACTERS = 300;

/**
 * PostCreationModal props interface
 */
interface PostCreationModalProps {
  visible: boolean;
  onClose: () => void;
  onPostSuccess?: () => void;
}

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
}: PostCreationModalProps): React.JSX.Element {
  const { t } = useTranslation('home');
  const [scaleAnim] = useState(new Animated.Value(0.9));
  const [opacityAnim] = useState(new Animated.Value(0));

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
   * Animate popup open/close
   */
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          damping: 20,
          stiffness: 150,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 0.9,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, scaleAnim, opacityAnim]);

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
   * Handle backdrop press
   */
  const handleBackdropPress = useCallback(() => {
    if (!isPosting) {
      onClose();
    }
  }, [isPosting, onClose]);

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
      transparent
      animationType="none"
      onRequestClose={handleBackdropPress}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {/* Backdrop */}
        <Animated.View
          style={[
            styles.backdrop,
            { opacity: opacityAnim },
          ]}
        >
          <Pressable style={styles.backdropPressable} onPress={handleBackdropPress} />
        </Animated.View>

        {/* Center Popup */}
        <Animated.View
          style={[
            styles.popup,
            {
              opacity: opacityAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>{t('postTitle')}</Text>
            <Pressable
              onPress={handleBackdropPress}
              style={styles.closeButton}
              disabled={isPosting}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X size={24} color={Colors.textSecondary} />
            </Pressable>
          </View>

          {/* Content */}
          <View style={styles.content}>
            {/* Text Input */}
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.textInput}
                placeholder={t('postPlaceholder')}
                placeholderTextColor={Colors.textTertiary}
                value={text}
                onChangeText={setText}
                multiline
                maxLength={MAX_CHARACTERS + 50} // Allow some buffer for hashtags
                textAlignVertical="top"
                autoFocus={visible}
                editable={!isPosting}
              />
              <Text style={[styles.characterCount, getCharacterCounterStyle()]}>
                {characterCount}/{MAX_CHARACTERS}
              </Text>
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

            {/* Hashtags Section */}
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
          </View>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <Button
              title={isPosting ? t('posting') : t('postButton')}
              onPress={handleSubmit}
              variant="primary"
              loading={isPosting}
              disabled={!isValid || isPosting}
              style={styles.postButton}
            />
            <Button
              title={t('postCancel')}
              onPress={handleBackdropPress}
              variant="outline"
              disabled={isPosting}
              style={styles.cancelButton}
            />
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.overlay,
  },
  backdropPressable: {
    flex: 1,
  },
  popup: {
    width: POPUP_WIDTH,
    maxHeight: SCREEN_HEIGHT * 0.8,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.xl,
    ...Shadows.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  title: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.text,
  },
  closeButton: {
    padding: Spacing.xs,
  },
  content: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  inputContainer: {
    marginBottom: Spacing.md,
  },
  textInput: {
    minHeight: 100,
    maxHeight: 150,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: FontSizes.md,
    color: Colors.text,
    backgroundColor: Colors.backgroundSecondary,
  },
  characterCount: {
    fontSize: FontSizes.sm,
    color: Colors.textTertiary,
    textAlign: 'right',
    marginTop: Spacing.xs,
  },
  characterCountWarning: {
    color: '#FF9800',
  },
  characterCountError: {
    color: Colors.error,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFEBEE',
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.md,
  },
  errorText: {
    flex: 1,
    fontSize: FontSizes.sm,
    color: Colors.error,
  },
  hashtagSection: {
    marginBottom: Spacing.md,
  },
  sectionLabel: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  hashtagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  hashtagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundSecondary,
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
  actions: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    gap: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  postButton: {
    flex: 2,
  },
  cancelButton: {
    flex: 1,
  },
});

export default PostCreationModal;
