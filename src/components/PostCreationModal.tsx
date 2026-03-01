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
  Image,
  ActionSheetIOS,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { X, Globe, ImagePlus, Tag, SpellCheck2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../hooks/useTheme';
import { usePostCreation, ReplyToInfo, QuoteToInfo } from '../hooks/usePostCreation';
import { PostImageAttachment } from '../services/bluesky/feed';
import { Button } from './common/Button';
import { ReplySettingsModal } from './ReplySettingsModal';
import { ContentLabelModal } from './ContentLabelModal';
import { ProofreadingView } from './ProofreadingView';
import {
  checkProofreading,
  hasClientId,
  ProofreadingSuggestion,
} from '../services/dictionary/yahooJapan';

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
  initialText,
  initialImages,
  replyTo,
  quoteTo,
}: {
  visible: boolean;
  onClose: () => void;
  onPostSuccess?: () => void;
  initialText?: string;
  initialImages?: PostImageAttachment[];
  replyTo?: ReplyToInfo;
  quoteTo?: QuoteToInfo;
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
    images,
    canAddImage,
    selfLabels,
    linkPreview,
    isLoadingLinkPreview,
    setText,
    addHashtag,
    removeHashtag,
    setReplySettings,
    addImage,
    removeImage,
    updateImageAlt,
    setSelfLabels,
    clearLinkPreview,
    submitPost,
    reset,
    clearError,
  } = usePostCreation(initialText, initialImages, replyTo, quoteTo);

  const [showReplySettings, setShowReplySettings] = useState(false);
  const [showContentLabels, setShowContentLabels] = useState(false);
  const [focusedImageIndex, setFocusedImageIndex] = useState(0);
  const [isProofreadingMode, setIsProofreadingMode] = useState(false);
  const [proofreadingSuggestions, setProofreadingSuggestions] = useState<ProofreadingSuggestion[]>([]);
  const [isProofreadingChecking, setIsProofreadingChecking] = useState(false);
  const [selectedError, setSelectedError] = useState<{
    offset: number;
    length: number;
    suggestions: string[];
  } | null>(null);

  /**
   * Keep focusedImageIndex in bounds when images are removed
   */
  useEffect(() => {
    if (images.length === 0) {
      setFocusedImageIndex(0);
    } else if (focusedImageIndex >= images.length) {
      setFocusedImageIndex(images.length - 1);
    }
  }, [images.length, focusedImageIndex]);

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
      setIsProofreadingMode(false);
      setProofreadingSuggestions([]);
      setSelectedError(null);
    }
  }, [visible, reset]);

  /**
   * Toggle proofreading mode: call Yahoo 校正 API and enter review mode.
   * If already in review mode, exit back to edit mode.
   */
  const handleProofreadingToggle = useCallback(async () => {
    if (isProofreadingMode) {
      setIsProofreadingMode(false);
      setProofreadingSuggestions([]);
      setSelectedError(null);
      return;
    }

    if (!text.trim()) return;

    const clientIdSet = await hasClientId();
    if (!clientIdSet) {
      Alert.alert(t('proofreadingNoClientId'), t('proofreadingNoClientIdMessage'));
      return;
    }

    const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text);
    if (!hasJapanese) {
      Alert.alert(t('proofreadingNoJapanese'));
      return;
    }

    setIsProofreadingChecking(true);
    const result = await checkProofreading(text);
    setIsProofreadingChecking(false);

    if (!result.success) {
      Alert.alert(t('proofreadingError'), result.error.getUserMessage());
      return;
    }

    if (result.data.length === 0) {
      Alert.alert(t('proofreadingNoErrors'));
      return;
    }

    setProofreadingSuggestions(result.data);
    setIsProofreadingMode(true);
  }, [isProofreadingMode, text, t]);

  /**
   * Called when the user taps an error segment in ProofreadingView.
   * Opens the correction panel for the tapped segment.
   */
  const handleSegmentTap = useCallback((offset: number, length: number, suggestions: string[]) => {
    setSelectedError({ offset, length, suggestions });
  }, []);

  /**
   * Apply the chosen suggestion from the correction panel.
   * Adjusts offsets of remaining suggestions and exits review mode when all are resolved.
   */
  const handleApplySelectedSuggestion = useCallback((suggestion: string) => {
    if (!selectedError) return;
    const { offset, length } = selectedError;
    const newText = text.slice(0, offset) + suggestion + text.slice(offset + length);
    setText(newText);

    const diff = suggestion.length - length;
    const remaining = proofreadingSuggestions
      .filter(s => s.offset !== offset)
      .map(s => s.offset > offset ? { ...s, offset: s.offset + diff } : s);

    setProofreadingSuggestions(remaining);
    setSelectedError(null);
    if (remaining.length === 0) {
      setIsProofreadingMode(false);
    }
  }, [selectedError, text, setText, proofreadingSuggestions]);

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

  /**
   * Launch image picker from gallery
   */
  const pickImageFromGallery = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('imagePermissionTitle'), t('imageGalleryPermissionMessage'));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      exif: false,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const attachment: PostImageAttachment = {
        uri: asset.uri,
        mimeType: asset.mimeType ?? 'image/jpeg',
        width: asset.width,
        height: asset.height,
        alt: '',
      };
      addImage(attachment);
    }
  }, [addImage, t]);

  /**
   * Launch camera to take a photo
   */
  const pickImageFromCamera = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('imagePermissionTitle'), t('imageCameraPermissionMessage'));
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      exif: false,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const attachment: PostImageAttachment = {
        uri: asset.uri,
        mimeType: asset.mimeType ?? 'image/jpeg',
        width: asset.width,
        height: asset.height,
        alt: '',
      };
      addImage(attachment);
    }
  }, [addImage, t]);

  /**
   * Show image source selection (gallery or camera)
   */
  const handleAddImage = useCallback(() => {
    if (!canAddImage) return;

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [t('imageCancel'), t('imageFromGallery'), t('imageFromCamera')],
          cancelButtonIndex: 0,
          title: t('imageSelectSource'),
        },
        (buttonIndex) => {
          if (buttonIndex === 1) pickImageFromGallery();
          if (buttonIndex === 2) pickImageFromCamera();
        },
      );
    } else {
      Alert.alert(
        t('imageSelectSource'),
        undefined,
        [
          { text: t('imageFromGallery'), onPress: pickImageFromGallery },
          { text: t('imageFromCamera'), onPress: pickImageFromCamera },
          { text: t('imageCancel'), style: 'cancel' },
        ],
      );
    }
  }, [canAddImage, pickImageFromGallery, pickImageFromCamera, t]);

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

          {replyTo && (
            <Text style={[styles.headerTitle, { color: colors.text }]}>{t('replyTitle')}</Text>
          )}

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
            {/* Reply target info */}
            {replyTo && (
              <View style={[styles.replyTargetContainer, { backgroundColor: colors.backgroundSecondary }]}>
                <Text style={[styles.replyTargetLabel, { color: colors.primary }]}>
                  {t('replyTo', { handle: replyTo.author.handle })}
                </Text>
                <Text style={[styles.replyTargetText, { color: colors.textSecondary }]} numberOfLines={2}>
                  {replyTo.text}
                </Text>
              </View>
            )}

            {/* Input Area */}
            <View style={styles.inputSection}>
              {isProofreadingMode ? (
                <>
                  <View style={[styles.proofreadingBanner, { backgroundColor: colors.warningLight }]}>
                    <Text style={[styles.proofreadingBannerText, { color: colors.warning }]}>
                      {t('proofreadingIssuesFound', { count: proofreadingSuggestions.length })}
                    </Text>
                    <Pressable onPress={() => { setIsProofreadingMode(false); setProofreadingSuggestions([]); setSelectedError(null); }}>
                      <Text style={[styles.proofreadingEditLink, { color: colors.primary }]}>
                        {t('proofreadingEdit')}
                      </Text>
                    </Pressable>
                  </View>
                  <ProofreadingView
                    text={text}
                    suggestions={proofreadingSuggestions}
                    onSegmentTap={handleSegmentTap}
                    style={styles.proofreadingView}
                  />
                  {selectedError && (
                    <View style={[styles.correctionPanel, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}>
                      <View style={styles.correctionPanelHeader}>
                        <Text style={[styles.correctionPanelLabel, { color: colors.textSecondary }]}>
                          {t('proofreadingSuggestionLabel')}
                        </Text>
                        <Pressable onPress={() => setSelectedError(null)} hitSlop={8}>
                          <X size={16} color={colors.textSecondary} />
                        </Pressable>
                      </View>
                      {selectedError.suggestions.length > 0 ? (
                        selectedError.suggestions.map((sug, idx) => (
                          <Pressable
                            key={idx}
                            style={[styles.correctionOption, { borderTopColor: colors.border }]}
                            onPress={() => handleApplySelectedSuggestion(sug)}
                          >
                            <Text style={[styles.correctionOptionText, { color: colors.primary }]}>
                              {sug}
                            </Text>
                          </Pressable>
                        ))
                      ) : (
                        <Text style={[styles.correctionNoSuggestion, { color: colors.textSecondary }]}>
                          {t('proofreadingNoSuggestion')}
                        </Text>
                      )}
                    </View>
                  )}
                </>
              ) : (
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
              )}
            </View>

            {/* Link Preview Card */}
            {isLoadingLinkPreview && images.length === 0 && (
              <View style={[styles.linkPreviewContainer, styles.linkPreviewLoadingContainer, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[styles.linkPreviewLoadingText, { color: colors.textSecondary }]}>
                  {t('linkPreviewLoading')}
                </Text>
              </View>
            )}
            {!isLoadingLinkPreview && linkPreview && images.length === 0 && (
              <View style={[styles.linkPreviewContainer, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}>
                <Pressable style={styles.linkPreviewDismiss} onPress={clearLinkPreview} disabled={isPosting}>
                  <X size={14} color={colors.textSecondary} />
                </Pressable>
                {linkPreview.thumb ? (
                  <Image source={{ uri: linkPreview.thumb }} style={styles.linkPreviewThumb} resizeMode="cover" />
                ) : null}
                <View style={styles.linkPreviewBody}>
                  <Text style={[styles.linkPreviewDomain, { color: colors.textTertiary }]} numberOfLines={1}>
                    {(() => { try { return new URL(linkPreview.uri).hostname; } catch { return linkPreview.uri; } })()}
                  </Text>
                  {linkPreview.title ? (
                    <Text style={[styles.linkPreviewTitle, { color: colors.text }]} numberOfLines={2}>
                      {linkPreview.title}
                    </Text>
                  ) : null}
                  {linkPreview.description ? (
                    <Text style={[styles.linkPreviewDescription, { color: colors.textSecondary }]} numberOfLines={2}>
                      {linkPreview.description}
                    </Text>
                  ) : null}
                </View>
              </View>
            )}

            {/* Image Preview */}
            {images.length > 0 && (
              <View style={styles.imagePreviewSection}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.imagePreviewScroll}>
                  {images.map((img, index) => (
                    <Pressable
                      key={img.uri}
                      style={styles.imagePreviewItem}
                      onPress={() => setFocusedImageIndex(index)}
                    >
                      <View style={[
                        styles.imagePreviewContainer,
                        index === focusedImageIndex && { borderWidth: 2, borderColor: colors.primary, borderRadius: 8 },
                      ]}>
                        <Image source={{ uri: img.uri }} style={styles.imagePreviewThumb} />
                        <Pressable
                          style={styles.imageRemoveButton}
                          onPress={() => removeImage(index)}
                          disabled={isPosting}
                        >
                          <X size={14} color="#FFFFFF" />
                        </Pressable>
                        {img.alt ? (
                          <View style={styles.altBadge}>
                            <Text style={styles.altBadgeText}>ALT</Text>
                          </View>
                        ) : null}
                      </View>
                    </Pressable>
                  ))}
                </ScrollView>
                <Text style={[styles.imageCount, { color: colors.textSecondary }]}>
                  {images.length}/4
                </Text>
                {/* Full-width ALT text input for focused image */}
                <TextInput
                  style={[styles.altTextInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}
                  placeholder="ALTテキスト（画像の説明）"
                  placeholderTextColor={colors.textTertiary}
                  value={images[focusedImageIndex]?.alt ?? ''}
                  onChangeText={(text) => updateImageAlt(focusedImageIndex, text)}
                  editable={!isPosting}
                  maxLength={1000}
                  multiline
                />
              </View>
            )}

            {/* Quote preview */}
            {quoteTo && (
              <View style={[styles.quotePreviewContainer, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}>
                <View style={styles.quotePreviewHeader}>
                  {quoteTo.author.avatar && (
                    <Image source={{ uri: quoteTo.author.avatar }} style={styles.quotePreviewAvatar} />
                  )}
                  <Text style={[styles.quotePreviewDisplayName, { color: colors.text }]} numberOfLines={1}>
                    {quoteTo.author.displayName}
                  </Text>
                  <Text style={[styles.quotePreviewHandle, { color: colors.textSecondary }]} numberOfLines={1}>
                    @{quoteTo.author.handle}
                  </Text>
                </View>
                <Text style={[styles.quotePreviewText, { color: colors.textSecondary }]} numberOfLines={3}>
                  {quoteTo.text}
                </Text>
              </View>
            )}

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

              {/* Image Picker Button (hidden in quote mode) */}
              {!quoteTo && (
                <Pressable
                  style={styles.toolbarButton}
                  onPress={handleAddImage}
                  disabled={isPosting || !canAddImage}
                >
                  <ImagePlus size={20} color={canAddImage ? colors.primary : colors.disabled} />
                </Pressable>
              )}

              {/* Content Label Button (only when images attached) */}
              {images.length > 0 && (
                <Pressable
                  style={styles.toolbarButton}
                  onPress={() => setShowContentLabels(true)}
                  disabled={isPosting}
                >
                  <Tag size={20} color={selfLabels.length > 0 ? colors.warning : colors.primary} />
                </Pressable>
              )}

              {/* Proofreading Button */}
              <Pressable
                style={styles.toolbarButton}
                onPress={handleProofreadingToggle}
                disabled={isPosting || isProofreadingChecking || !text.trim()}
                accessibilityLabel={t('proofreadingButton')}
              >
                {isProofreadingChecking ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <SpellCheck2
                    size={20}
                    color={
                      isProofreadingMode
                        ? colors.primary
                        : !text.trim()
                        ? colors.disabled
                        : colors.textSecondary
                    }
                  />
                )}
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

        {/* Content Label Modal */}
        <ContentLabelModal
          visible={showContentLabels}
          labels={selfLabels}
          onSave={setSelfLabels}
          onClose={() => setShowContentLabels(false)}
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
  headerTitle: {
    fontSize: 16, // FontSizes.lg
    fontWeight: '600',
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
  proofreadingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
    borderRadius: 6,
  },
  proofreadingBannerText: {
    fontSize: 13,
    flex: 1,
  },
  proofreadingEditLink: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 8,
  },
  proofreadingView: {
    minHeight: SCREEN_HEIGHT * 0.2,
    paddingVertical: 4,
  },
  correctionPanel: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  correctionPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  correctionPanelLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  correctionOption: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  correctionOptionText: {
    fontSize: 16,
    fontWeight: '500',
  },
  correctionNoSuggestion: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
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
  toolbarButton: {
    padding: 8,
  },
  imagePreviewSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  imagePreviewScroll: {
    gap: 8,
  },
  imagePreviewItem: {
    alignItems: 'center',
  },
  imagePreviewContainer: {
    position: 'relative',
  },
  imagePreviewThumb: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  altTextInput: {
    marginTop: 8,
    fontSize: 13,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    minHeight: 36,
  },
  altBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
  },
  altBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  imageRemoveButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageCount: {
    fontSize: 12,
    marginTop: 6,
  },
  replyTargetContainer: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
  },
  replyTargetLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  replyTargetText: {
    fontSize: 13,
    lineHeight: 18,
  },
  quotePreviewContainer: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  quotePreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  quotePreviewAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 6,
  },
  quotePreviewDisplayName: {
    fontSize: 13,
    fontWeight: '600',
    marginRight: 4,
  },
  quotePreviewHandle: {
    fontSize: 12,
    flex: 1,
  },
  quotePreviewText: {
    fontSize: 13,
    lineHeight: 18,
  },
  linkPreviewContainer: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  linkPreviewLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  linkPreviewLoadingText: {
    fontSize: 12,
    marginLeft: 8,
  },
  linkPreviewDismiss: {
    position: 'absolute',
    top: 6,
    right: 6,
    zIndex: 1,
    padding: 4,
  },
  linkPreviewThumb: {
    width: '100%',
    height: 120,
  },
  linkPreviewBody: {
    padding: 10,
    paddingRight: 28,
  },
  linkPreviewDomain: {
    fontSize: 11,
    marginBottom: 2,
  },
  linkPreviewTitle: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    marginBottom: 2,
  },
  linkPreviewDescription: {
    fontSize: 12,
    lineHeight: 16,
  },
});

export default PostCreationModal;
