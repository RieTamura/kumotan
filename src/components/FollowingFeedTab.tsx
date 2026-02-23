/**
 * FollowingFeedTab Component
 * Displays the Following timeline feed (page 0 of HomeScreen's PagerView).
 * Receives feed data and interaction handlers from HomeScreen.
 */

import React, { useCallback, memo } from 'react';
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
import { AppError } from '../utils/errors';
import { PostCard } from './PostCard';
import { Loading } from './common/Loading';
import { Button } from './common/Button';
import { useTheme } from '../hooks/useTheme';
import { Spacing, FontSizes } from '../constants/colors';

export interface FollowingFeedTabProps {
  // Ref & scroll
  flatListRef: React.RefObject<FlatList<TimelinePost> | null>;
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;

  // Feed data
  posts: TimelinePost[];
  isLoading: boolean;
  isRefreshing: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  isConnected: boolean;
  onRefresh: () => void;
  onLoadMore: () => void;

  // Word popup state (for clearing selection)
  wordPopupVisible: boolean;
  wordPopupPostUri: string;

  // Post interaction handlers
  currentUserDid?: string;
  onWordSelect: (word: string, postUri: string, postText: string) => void;
  onSentenceSelect: (sentence: string, postUri: string, postText: string) => void;
  onPostPress: (postUri: string) => void;
  onLikePress: (post: TimelinePost, isLiked: boolean) => void;
  onReplyPress: (post: TimelinePost) => void;
  onRepostPress: (post: TimelinePost, isReposted: boolean) => void;
  onQuotePress: (post: TimelinePost) => void;
  onAvatarPress: (author: TimelinePost['author']) => void;
  onDeletePress: (post: TimelinePost) => void;

  // Tutorial layout measurement (only called for the first post)
  onPostLayoutElements: (elements: {
    bookIcon?: { x: number; y: number; width: number; height: number };
    firstWord?: { x: number; y: number; width: number; height: number };
    contentColumn?: { x: number; y: number; width: number; height: number };
  }) => void;
}

export const FollowingFeedTab = memo(function FollowingFeedTab({
  flatListRef,
  onScroll,
  posts,
  isLoading,
  isRefreshing,
  isLoadingMore,
  hasMore,
  isConnected,
  onRefresh,
  onLoadMore,
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
  onPostLayoutElements,
}: FollowingFeedTabProps): React.JSX.Element {
  const { t } = useTranslation('home');
  const { colors } = useTheme();

  const keyExtractor = useCallback((item: TimelinePost) => item.uri, []);

  const handleEndReached = useCallback(() => {
    if (!isLoadingMore && hasMore && isConnected) {
      onLoadMore();
    }
  }, [isLoadingMore, hasMore, isConnected, onLoadMore]);

  const renderItem = useCallback(
    ({ item, index }: { item: TimelinePost; index: number }) => {
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
          onLayoutElements={index === 0 ? onPostLayoutElements : undefined}
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
      onPostLayoutElements,
    ]
  );

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
              {t('feed.empty')}
            </Text>
            <Button
              title={t('feed.retry')}
              onPress={onRefresh}
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
          onRefresh={onRefresh}
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
});

export default FollowingFeedTab;
