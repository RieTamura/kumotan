/**
 * CustomFeedTab Component
 * Displays posts from a Bluesky feed generator.
 * Manages its own feed state internally via useCustomFeed.
 */

import React, { useCallback, useMemo, memo } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  NativeSyntheticEvent,
  NativeScrollEvent,
  StyleSheet,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { TimelinePost } from '../types/bluesky';
import { PostCard } from './PostCard';
import { Loading } from './common/Loading';
import { Button } from './common/Button';
import { useTheme } from '../hooks/useTheme';
import { useCustomFeed } from '../hooks/useCustomFeed';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useSocialStore } from '../store/socialStore';
import { Spacing, FontSizes } from '../constants/colors';

export interface CustomFeedTabProps {
  /** Feed generator URI to display. When null the tab renders nothing. */
  feedUri: string | null;

  // Ref & scroll
  flatListRef: React.RefObject<FlatList<TimelinePost> | null>;
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;

  // Word popup state (used to clear selection after closing)
  wordPopupVisible: boolean;
  wordPopupPostUri: string;

  // Post interaction handlers (same contract as FollowingFeedTab)
  currentUserDid?: string;
  deletedUris: Set<string>;
  onWordSelect: (word: string, postUri: string, postText: string) => void;
  onSentenceSelect: (sentence: string, postUri: string, postText: string) => void;
  onPostPress: (postUri: string) => void;
  onLikePress: (post: TimelinePost, isLiked: boolean) => void;
  onReplyPress: (post: TimelinePost) => void;
  onRepostPress: (post: TimelinePost, isReposted: boolean) => void;
  onQuotePress: (post: TimelinePost) => void;
  onAvatarPress: (author: TimelinePost['author']) => void;
  onDeletePress: (post: TimelinePost) => void;
}

export const CustomFeedTab = memo(function CustomFeedTab({
  feedUri,
  flatListRef,
  onScroll,
  wordPopupVisible,
  wordPopupPostUri,
  currentUserDid,
  deletedUris,
  onWordSelect,
  onSentenceSelect,
  onPostPress,
  onLikePress,
  onReplyPress,
  onRepostPress,
  onQuotePress,
  onAvatarPress,
  onDeletePress,
}: CustomFeedTabProps): React.JSX.Element {
  const { t } = useTranslation('home');
  const { colors } = useTheme();
  const isConnected = useNetworkStatus();
  const { userStates } = useSocialStore();

  const {
    posts: rawPosts,
    isLoading,
    isRefreshing,
    isLoadingMore,
    hasMore,
    error,
    refresh,
    loadMore,
    clearError,
  } = useCustomFeed(feedUri);

  // Filter out blocked users and locally deleted posts
  const posts = useMemo(() => {
    const blockedDids = new Set(
      Object.entries(userStates)
        .filter(([, s]) => s.blocking != null)
        .map(([did]) => did)
    );
    return rawPosts.filter(
      (p) => !blockedDids.has(p.author.did) && !deletedUris.has(p.uri)
    );
  }, [rawPosts, userStates, deletedUris]);

  const keyExtractor = useCallback((item: TimelinePost) => item.uri, []);

  const handleEndReached = useCallback(() => {
    if (!isLoadingMore && hasMore && isConnected) {
      loadMore();
    }
  }, [isLoadingMore, hasMore, isConnected, loadMore]);

  const renderItem = useCallback(
    ({ item }: { item: TimelinePost }) => {
      const shouldClearSelection =
        !wordPopupVisible && wordPopupPostUri === item.uri && wordPopupPostUri !== '';
      return (
        <PostCard
          post={item}
          onWordSelect={onWordSelect}
          onSentenceSelect={onSentenceSelect}
          onPostPress={onPostPress}
          onLikePress={onLikePress}
          onReplyPress={onReplyPress}
          onRepostPress={onRepostPress}
          onQuotePress={onQuotePress}
          onAvatarPress={onAvatarPress}
          onDeletePress={onDeletePress}
          currentUserDid={currentUserDid}
          clearSelection={shouldClearSelection}
        />
      );
    },
    [
      wordPopupVisible,
      wordPopupPostUri,
      currentUserDid,
      onWordSelect,
      onSentenceSelect,
      onPostPress,
      onLikePress,
      onReplyPress,
      onRepostPress,
      onQuotePress,
      onAvatarPress,
      onDeletePress,
    ]
  );

  // Error state (e.g. feed deleted on Bluesky side)
  if (error && posts.length === 0 && !isLoading) {
    return (
      <View style={styles.centerContainer}>
        <Text style={[styles.errorText, { color: colors.textSecondary }]}>
          {t('customFeed.error')}
        </Text>
        <Text style={[styles.hintText, { color: colors.textTertiary }]}>
          {t('customFeed.settingsHint')}
        </Text>
        <Button
          title={t('retry')}
          onPress={() => { clearError(); refresh(); }}
          variant="outline"
          size="small"
          style={{ marginTop: Spacing.md }}
        />
      </View>
    );
  }

  return (
    <FlatList
      ref={flatListRef}
      data={posts}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      contentContainerStyle={styles.listContent}
      ListEmptyComponent={
        !isLoading ? (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyMessage, { color: colors.textSecondary }]}>
              {t('empty')}
            </Text>
            <Button
              title={t('retry')}
              onPress={refresh}
              variant="outline"
              size="small"
              style={{ marginTop: Spacing.md }}
            />
          </View>
        ) : null
      }
      ListFooterComponent={
        isLoading && !isRefreshing ? (
          <View style={styles.footerLoader}>
            <Loading size="small" />
          </View>
        ) : (
          <View style={{ height: 100 }} />
        )
      }
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={refresh}
          tintColor={colors.primary}
          colors={[colors.primary]}
          enabled={isConnected}
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
  );
});

const styles = StyleSheet.create({
  listContent: {
    flexGrow: 1,
    paddingVertical: Spacing.sm,
  },
  footerLoader: {
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xxl,
    marginTop: Spacing.xxl,
  },
  emptyMessage: {
    fontSize: FontSizes.md,
    textAlign: 'center',
    lineHeight: 22,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xxl,
  },
  errorText: {
    fontSize: FontSizes.md,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.sm,
  },
  hintText: {
    fontSize: FontSizes.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default CustomFeedTab;
