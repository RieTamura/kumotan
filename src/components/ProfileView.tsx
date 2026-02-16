/**
 * ProfileView Component
 * Displays the logged-in user's Bluesky profile with their posts
 */

import React, { memo, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  FlatList,
  RefreshControl,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Linking,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../hooks/useTheme';
import { useWordRegistration } from '../hooks/useWordRegistration';
import { useAuthStore, useAuthProfile, useIsProfileLoading } from '../store/authStore';
import { useAuthorFeed } from '../hooks/useAuthorFeed';
import { Loading } from './common/Loading';
import { PostCard } from './PostCard';
import { WordPopup } from './WordPopup';
import { Spacing, FontSizes } from '../constants/colors';
import { TimelinePost } from '../types/bluesky';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { likePost, unlikePost } from '../services/bluesky/feed';
import { tokenizeRichText } from '../utils/richText';

interface ProfileViewProps {
  flatListRef?: React.RefObject<FlatList<TimelinePost> | null>;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
}

/**
 * ProfileView - Displays user profile information with their posts
 */
export const ProfileView = memo(function ProfileView({ flatListRef, onScroll }: ProfileViewProps): React.JSX.Element {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { t } = useTranslation('home');
  const { colors } = useTheme();
  const profile = useAuthProfile();
  const isProfileLoading = useIsProfileLoading();
  const refreshProfile = useAuthStore((state) => state.refreshProfile);
  const fetchProfile = useAuthStore((state) => state.fetchProfile);

  // Word registration hook
  const {
    wordPopup,
    handleWordSelect,
    handleSentenceSelect,
    closeWordPopup,
    handleAddWord,
  } = useWordRegistration();

  // Author feed hook
  const {
    posts,
    isLoading: isFeedLoading,
    isRefreshing,
    isLoadingMore,
    hasMore,
    refresh: refreshFeed,
    loadMore,
  } = useAuthorFeed();

  const descriptionTokens = useMemo(
    () => tokenizeRichText(profile?.description ?? ''),
    [profile?.description]
  );

  // Fetch profile on mount if not loaded
  useEffect(() => {
    if (!profile && !isProfileLoading) {
      fetchProfile();
    }
  }, [profile, isProfileLoading, fetchProfile]);

  /**
   * Handle refresh (both profile and feed)
   */
  const handleRefresh = useCallback(async () => {
    await Promise.all([refreshProfile(), refreshFeed()]);
  }, [refreshProfile, refreshFeed]);

  /**
   * Handle post press - navigate to thread
   */
  const handlePostPress = useCallback(
    (postUri: string) => {
      navigation.navigate('Thread', { postUri });
    },
    [navigation]
  );

  /**
   * Handle like press
   */
  const handleLikePress = useCallback(
    async (post: TimelinePost, shouldLike: boolean) => {
      try {
        if (shouldLike) {
          const result = await likePost(post.uri, post.cid);
          if (!result.success && __DEV__) {
            console.error('Failed to like post:', result.error);
          }
        } else {
          if (post.viewer?.like) {
            const result = await unlikePost(post.viewer.like);
            if (!result.success && __DEV__) {
              console.error('Failed to unlike post:', result.error);
            }
          }
        }
      } catch (error) {
        if (__DEV__) {
          console.error('Like operation failed:', error);
        }
      }
    },
    []
  );

  /**
   * Handle end reached for infinite scroll
   */
  const handleEndReached = useCallback(() => {
    if (!isLoadingMore && hasMore) {
      loadMore();
    }
  }, [isLoadingMore, hasMore, loadMore]);

  const openExternalUrl = useCallback(async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch (error) {
      if (__DEV__) {
        console.error('Failed to open URL:', error);
      }
    }
  }, []);

  const handleHashtagPress = useCallback(
    async (tag: string) => {
      await openExternalUrl(`https://bsky.app/search?q=%23${encodeURIComponent(tag)}`);
    },
    [openExternalUrl]
  );

  const handleMentionPress = useCallback(
    async (handle: string) => {
      await openExternalUrl(`https://bsky.app/profile/${encodeURIComponent(handle)}`);
    },
    [openExternalUrl]
  );

  /**
   * Render profile header
   */
  const renderHeader = useCallback(() => {
    if (!profile) return null;

    return (
      <View>
        {/* Banner area */}
        <View style={[styles.bannerArea, { backgroundColor: colors.backgroundSecondary }]}>
          {profile.banner && (
            <Image
              source={{ uri: profile.banner }}
              style={styles.bannerImage}
              resizeMode="cover"
            />
          )}
        </View>

        {/* Avatar */}
        <View style={styles.avatarContainer}>
          {profile.avatar ? (
            <Image
              source={{ uri: profile.avatar }}
              style={[styles.avatar, { borderColor: colors.background }]}
            />
          ) : (
            <View
              style={[
                styles.avatar,
                styles.avatarPlaceholder,
                { borderColor: colors.background, backgroundColor: colors.backgroundTertiary },
              ]}
            />
          )}
        </View>

        {/* Profile info */}
        <View style={styles.infoContainer}>
          {/* Display name */}
          <Text style={[styles.displayName, { color: colors.text }]}>
            {profile.displayName || profile.handle}
          </Text>

          {/* Handle */}
          <Text style={[styles.handle, { color: colors.textSecondary }]}>
            @{profile.handle}
          </Text>

          {/* Description */}
          {profile.description && (
            <Text style={[styles.description, { color: colors.text }]}>
              {descriptionTokens.map((token, index) => {
                if (token.type === 'url') {
                  return (
                    <Text
                      key={`${token.type}-${index}`}
                      style={[styles.linkText, { color: colors.primary }]}
                      onPress={() => openExternalUrl(token.text)}
                      suppressHighlighting={false}
                    >
                      {token.text}
                    </Text>
                  );
                }

                if (token.type === 'hashtag' && token.value) {
                  const hashtagValue = token.value;
                  return (
                    <Text
                      key={`${token.type}-${index}`}
                      style={[styles.linkText, { color: colors.primary }]}
                      onPress={() => handleHashtagPress(hashtagValue)}
                      suppressHighlighting={false}
                    >
                      {token.text}
                    </Text>
                  );
                }

                if (token.type === 'mention' && token.value) {
                  const mentionValue = token.value;
                  return (
                    <Text
                      key={`${token.type}-${index}`}
                      style={[styles.linkText, { color: colors.primary }]}
                      onPress={() => handleMentionPress(mentionValue)}
                      suppressHighlighting={false}
                    >
                      {token.text}
                    </Text>
                  );
                }

                return <Text key={`${token.type}-${index}`}>{token.text}</Text>;
              })}
            </Text>
          )}

          {/* Stats */}
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: colors.text }]}>
                {formatNumber(profile.followsCount ?? 0)}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                {t('profile.following')}
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: colors.text }]}>
                {formatNumber(profile.followersCount ?? 0)}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                {t('profile.followers')}
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: colors.text }]}>
                {formatNumber(profile.postsCount ?? 0)}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                {t('profile.posts')}
              </Text>
            </View>
          </View>
        </View>

        {/* Posts section header */}
        <View style={[styles.sectionHeader, { borderTopColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {t('profile.myPosts')}
          </Text>
        </View>
      </View>
    );
  }, [profile, colors, t, descriptionTokens, openExternalUrl, handleHashtagPress, handleMentionPress]);

  /**
   * Render post item
   */
  const renderPost = useCallback(
    ({ item }: { item: TimelinePost }) => {
      const shouldClearSelection =
        !wordPopup.visible && wordPopup.postUri === item.uri && wordPopup.postUri !== '';
      return (
        <PostCard
          post={item}
          onPostPress={handlePostPress}
          onLikePress={handleLikePress}
          onWordSelect={handleWordSelect}
          onSentenceSelect={handleSentenceSelect}
          clearSelection={shouldClearSelection}
        />
      );
    },
    [handlePostPress, handleLikePress, handleWordSelect, handleSentenceSelect, wordPopup.visible, wordPopup.postUri]
  );

  /**
   * Render empty state for posts
   */
  const renderEmpty = useCallback(() => {
    if (isFeedLoading) {
      return (
        <View style={styles.emptyContainer}>
          <Loading size="small" message={t('profile.loadingPosts')} />
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          {t('profile.noPosts')}
        </Text>
      </View>
    );
  }, [isFeedLoading, colors, t]);

  /**
   * Render footer (loading more indicator)
   */
  const renderFooter = useCallback(() => {
    if (!isLoadingMore) return <View style={{ height: 100 }} />;

    return (
      <View style={styles.footerLoader}>
        <Loading size="small" />
      </View>
    );
  }, [isLoadingMore]);

  /**
   * Extract key for FlatList
   */
  const keyExtractor = useCallback((item: TimelinePost) => item.uri, []);

  // Show loading state on initial profile load
  if (isProfileLoading && !profile) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <Loading size="large" message={t('profile.loading')} />
      </View>
    );
  }

  // Show error state if no profile
  if (!profile) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          {t('profile.notFound')}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        ref={flatListRef}
        style={styles.container}
        data={posts}
        renderItem={renderPost}
        keyExtractor={keyExtractor}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        windowSize={5}
      />
      <WordPopup
        visible={wordPopup.visible}
        word={wordPopup.word}
        isSentenceMode={wordPopup.isSentenceMode}
        postUri={wordPopup.postUri}
        postText={wordPopup.postText}
        onClose={closeWordPopup}
        onAddToWordList={handleAddWord}
      />
    </View>
  );
});

/**
 * Format large numbers with K/M suffix
 */
function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return num.toString();
}

const AVATAR_SIZE = 80;
const BANNER_HEIGHT = 120;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
    minHeight: 200,
  },
  emptyText: {
    fontSize: FontSizes.md,
    textAlign: 'center',
  },
  bannerArea: {
    height: BANNER_HEIGHT,
    width: '100%',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  avatarContainer: {
    marginTop: -AVATAR_SIZE / 2,
    paddingHorizontal: Spacing.lg,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 4,
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  displayName: {
    fontSize: FontSizes.xxl,
    fontWeight: '700',
  },
  handle: {
    fontSize: FontSizes.md,
    marginTop: Spacing.xs,
  },
  description: {
    fontSize: FontSizes.md,
    lineHeight: 22,
    marginTop: Spacing.md,
  },
  linkText: {
    textDecorationLine: 'underline',
  },
  statsContainer: {
    flexDirection: 'row',
    marginTop: Spacing.lg,
    gap: Spacing.xl,
  },
  statItem: {
    alignItems: 'flex-start',
  },
  statNumber: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: FontSizes.sm,
    marginTop: 2,
  },
  sectionHeader: {
    marginTop: Spacing.lg,
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
    borderTopWidth: 1,
  },
  sectionTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
  },
  footerLoader: {
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
});

export default ProfileView;
