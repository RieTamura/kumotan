/**
 * ProfilePreviewModal Component
 * Bottom sheet that shows a user's profile summary with follow/block actions.
 * Opened by tapping an avatar in the feed.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Image,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { X, UserCheck, UserPlus, Shield, ShieldOff } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { TimelinePost, BlueskyProfile } from '../types/bluesky';
import { useSocialStore, resolveFollowState, resolveBlockState } from '../store/socialStore';
import { getUserProfile } from '../services/bluesky/social';
import { useTheme } from '../hooks/useTheme';
import { Spacing, FontSizes, BorderRadius, Shadows } from '../constants/colors';

const DEFAULT_AVATAR = 'https://cdn.bsky.app/img/avatar/plain/did:plc:default/avatar@jpeg';

interface ProfilePreviewModalProps {
  visible: boolean;
  author: TimelinePost['author'] | null;
  currentUserDid?: string;
  onClose: () => void;
  onFollowPress: (did: string, shouldFollow: boolean, followUri?: string) => void;
  onBlockPress: (did: string, handle: string, shouldBlock: boolean, blockUri?: string) => void;
}

export function ProfilePreviewModal({
  visible,
  author,
  currentUserDid,
  onClose,
  onFollowPress,
  onBlockPress,
}: ProfilePreviewModalProps): React.JSX.Element {
  const { t } = useTranslation('home');
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [profile, setProfile] = useState<BlueskyProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [avatarError, setAvatarError] = useState(false);

  // Read follow/block state from store (overrides server-supplied viewer data)
  const userStates = useSocialStore((s) => s.userStates);
  const effectiveFollowingUri = author
    ? resolveFollowState(userStates, author.did, author.viewer?.following)
    : undefined;
  const effectiveBlockingUri = author
    ? resolveBlockState(userStates, author.did, author.viewer?.blocking)
    : undefined;
  const isFollowing = !!effectiveFollowingUri;
  const isBlocking = !!effectiveBlockingUri;
  const isOwnProfile = author?.did === currentUserDid;

  // Fetch full profile when the modal opens (or the target author changes)
  useEffect(() => {
    if (!visible || !author) return;
    setProfile(null);
    setLoadError(false);
    setAvatarError(false);
    setIsLoading(true);

    getUserProfile(author.did).then((result) => {
      setIsLoading(false);
      if (result.success) {
        setProfile(result.data);
      } else {
        setLoadError(true);
      }
    });
  }, [visible, author?.did]);

  const handleFollowPress = useCallback(() => {
    if (!author) return;
    onFollowPress(author.did, !isFollowing, effectiveFollowingUri);
    onClose();
  }, [author, isFollowing, effectiveFollowingUri, onFollowPress, onClose]);

  // For block, close this modal first so the ConfirmModal appears cleanly
  const handleBlockPress = useCallback(() => {
    if (!author) return;
    onClose();
    onBlockPress(author.did, author.handle, !isBlocking, effectiveBlockingUri);
  }, [author, isBlocking, effectiveBlockingUri, onBlockPress, onClose]);

  if (!author) return <></>;

  const avatarUri = avatarError
    ? DEFAULT_AVATAR
    : (profile?.avatar || author.avatar || DEFAULT_AVATAR);
  const displayName = profile?.displayName || author.displayName;
  const bio = profile?.description;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        {/* Backdrop — tap to dismiss */}
        <Pressable style={styles.backdrop} onPress={onClose} />

        {/* Bottom sheet */}
        <View
          style={[
            styles.sheet,
            { backgroundColor: colors.card, paddingBottom: Math.max(insets.bottom, Spacing.lg) },
          ]}
        >
          {/* Drag handle */}
          <View style={[styles.handleBar, { backgroundColor: colors.border }]} />

          {/* Close button */}
          <Pressable
            style={styles.closeButton}
            onPress={onClose}
            hitSlop={10}
            accessible={true}
            accessibilityLabel={t('postCancel')}
            accessibilityRole="button"
          >
            <X size={20} color={colors.textSecondary} />
          </Pressable>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Avatar + display name + handle */}
            <View style={styles.avatarSection}>
              <Image
                source={{ uri: avatarUri }}
                style={styles.avatar}
                onError={() => setAvatarError(true)}
              />
              <Text
                style={[styles.displayName, { color: colors.text }]}
                numberOfLines={2}
              >
                {displayName}
              </Text>
              <Text
                style={[styles.handleText, { color: colors.textSecondary }]}
                numberOfLines={1}
              >
                @{author.handle}
              </Text>
            </View>

            {/* Bio */}
            {bio ? (
              <Text style={[styles.bio, { color: colors.text }]}>{bio}</Text>
            ) : null}

            {/* Stats row (shown after profile loads) */}
            {isLoading ? (
              <ActivityIndicator style={styles.loader} color={colors.primary} />
            ) : loadError ? (
              <Text style={[styles.errorText, { color: colors.textSecondary }]}>
                {t('profilePreviewLoadError')}
              </Text>
            ) : profile ? (
              <View style={[styles.statsRow, { borderColor: colors.border }]}>
                <View style={styles.statItem}>
                  <Text style={[styles.statNumber, { color: colors.text }]}>
                    {(profile.followsCount ?? 0).toLocaleString()}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                    {t('profile.following')}
                  </Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                <View style={styles.statItem}>
                  <Text style={[styles.statNumber, { color: colors.text }]}>
                    {(profile.followersCount ?? 0).toLocaleString()}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                    {t('profile.followers')}
                  </Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                <View style={styles.statItem}>
                  <Text style={[styles.statNumber, { color: colors.text }]}>
                    {(profile.postsCount ?? 0).toLocaleString()}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                    {t('profile.posts')}
                  </Text>
                </View>
              </View>
            ) : null}

            {/* Follow / Block action buttons (hidden for own profile) */}
            {!isOwnProfile && (
              <View style={styles.actions}>
                <Pressable
                  style={[
                    styles.actionButton,
                    isFollowing
                      ? [styles.actionButtonOutline, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]
                      : [styles.actionButtonPrimary, { backgroundColor: colors.primary }],
                  ]}
                  onPress={handleFollowPress}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel={isFollowing ? t('unfollow') : t('follow')}
                >
                  {isFollowing ? (
                    <UserCheck size={16} color={colors.text} />
                  ) : (
                    <UserPlus size={16} color="#FFF" />
                  )}
                  <Text
                    style={[
                      styles.actionButtonText,
                      { color: isFollowing ? colors.text : '#FFF' },
                    ]}
                  >
                    {isFollowing ? t('unfollow') : t('follow')}
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.actionButton,
                    styles.actionButtonOutline,
                    { borderColor: colors.border, backgroundColor: colors.backgroundSecondary },
                  ]}
                  onPress={handleBlockPress}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel={isBlocking ? t('unblock') : t('block')}
                >
                  {isBlocking ? (
                    <ShieldOff size={16} color={colors.textSecondary} />
                  ) : (
                    <Shield size={16} color={colors.error} />
                  )}
                  <Text
                    style={[
                      styles.actionButtonText,
                      { color: isBlocking ? colors.textSecondary : colors.error },
                    ]}
                  >
                    {isBlocking ? t('unblock') : t('block')}
                  </Text>
                </Pressable>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sheet: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingTop: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    maxHeight: '75%',
    ...Shadows.lg,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  closeButton: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.lg,
    padding: Spacing.xs,
    zIndex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing.md,
  },
  avatarSection: {
    alignItems: 'center',
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: Spacing.md,
    backgroundColor: '#E0E0E0',
  },
  displayName: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  handleText: {
    fontSize: FontSizes.md,
    textAlign: 'center',
  },
  bio: {
    fontSize: FontSizes.md,
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.lg,
  },
  loader: {
    marginVertical: Spacing.lg,
  },
  errorText: {
    textAlign: 'center',
    fontSize: FontSizes.sm,
    marginVertical: Spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.lg,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  statNumber: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: FontSizes.xs,
  },
  statDivider: {
    width: 1,
    height: 32,
    marginHorizontal: Spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  actionButtonPrimary: {
    // backgroundColor set inline
  },
  actionButtonOutline: {
    borderWidth: 1,
  },
  actionButtonText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
});
