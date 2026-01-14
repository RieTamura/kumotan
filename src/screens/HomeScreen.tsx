/**
 * Home Screen
 * Displays Bluesky timeline feed with word selection functionality
 */

import React, { useCallback, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  Pressable,
  Alert,
  Modal,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RefreshCw, ArrowUp } from 'lucide-react-native';
import { Colors, Spacing, FontSizes, BorderRadius, Shadows } from '../constants/colors';
import { useBlueskyFeed } from '../hooks/useBlueskyFeed';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { PostCard } from '../components/PostCard';
import { OfflineBanner } from '../components/OfflineBanner';
import { Loading } from '../components/common/Loading';
import { Button } from '../components/common/Button';
import { WordPopup } from '../components/WordPopup';
import { TimelinePost } from '../types/bluesky';
import { addWord } from '../services/database/words';

/**
 * Word popup state interface
 */
interface WordPopupState {
  visible: boolean;
  word: string;
  isSentenceMode: boolean;
  postUri: string;
  postText: string;
}

/**
 * Initial word popup state
 */
const initialWordPopupState: WordPopupState = {
  visible: false,
  word: '',
  isSentenceMode: false,
  postUri: '',
  postText: '',
};

/**
 * HomeScreen Component
 */
export function HomeScreen(): React.JSX.Element {
  // Feed state and actions
  const {
    posts,
    isLoading,
    isRefreshing,
    isLoadingMore,
    error,
    hasMore,
    refresh,
    loadMore,
    clearError,
  } = useBlueskyFeed();

  // Network status
  const isConnected = useNetworkStatus();

  // Word popup state
  const [wordPopup, setWordPopup] = useState<WordPopupState>(initialWordPopupState);

  // Scroll to top button state
  const flatListRef = useRef<FlatList<TimelinePost>>(null);
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const scrollToTopOpacity = useRef(new Animated.Value(0)).current;

  // Threshold for showing scroll to top button (in pixels)
  const SCROLL_THRESHOLD = 500;

  /**
   * Handle word selection from a post
   */
  const handleWordSelect = useCallback(
    (word: string, postUri: string, postText: string) => {
      setWordPopup({
        visible: true,
        word: word.toLowerCase(),
        isSentenceMode: false,
        postUri,
        postText,
      });
    },
    []
  );

  /**
   * Handle sentence selection from a post
   */
  const handleSentenceSelect = useCallback(
    (sentence: string, postUri: string, postText: string) => {
      setWordPopup({
        visible: true,
        word: sentence,
        isSentenceMode: true,
        postUri,
        postText,
      });
    },
    []
  );

  /**
   * Close word popup
   */
  const closeWordPopup = useCallback(() => {
    // Keep postUri to allow PostCard to clear selection before full reset
    setWordPopup(prev => ({ ...prev, visible: false }));
    
    // Reset postUri after a short delay to allow PostCard to process clearSelection
    setTimeout(() => {
      setWordPopup(prev => ({ ...initialWordPopupState }));
    }, 100);
  }, []);

  /**
   * Handle add word to vocabulary
   */
  const handleAddWord = useCallback(
    async (
      word: string,
      japanese: string | null,
      definition: string | null,
      postUri: string | null,
      postText: string | null
    ) => {
      try {
        const result = await addWord(
          word,
          japanese ?? undefined,
          definition ?? undefined,
          postUri ?? undefined,
          postText ?? undefined
        );

        if (result.success) {
          Alert.alert('成功', '単語を追加しました！');
        } else {
          Alert.alert('エラー', result.error.message);
        }
      } catch (error) {
        Alert.alert('エラー', '単語の追加に失敗しました');
        console.error('Failed to add word:', error);
      }
    },
    []
  );

  /**
   * Handle end reached for infinite scroll
   */
  const handleEndReached = useCallback(() => {
    if (!isLoadingMore && hasMore && isConnected) {
      loadMore();
    }
  }, [isLoadingMore, hasMore, isConnected, loadMore]);

  /**
   * Handle scroll event to show/hide scroll to top button
   */
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetY = event.nativeEvent.contentOffset.y;
      const shouldShow = offsetY > SCROLL_THRESHOLD;

      if (shouldShow !== showScrollToTop) {
        setShowScrollToTop(shouldShow);
        Animated.timing(scrollToTopOpacity, {
          toValue: shouldShow ? 1 : 0,
          duration: 200,
          useNativeDriver: true,
        }).start();
      }
    },
    [showScrollToTop, scrollToTopOpacity, SCROLL_THRESHOLD]
  );

  /**
   * Scroll to top of the list
   */
  const scrollToTop = useCallback(() => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);

  /**
   * Render individual post item
   */
  const renderPost = useCallback(
    ({ item }: { item: TimelinePost }) => {
      // Only clear selection for the post that had a word selected
      // and only when the popup is closed but postUri hasn't been reset yet
      const shouldClearSelection = !wordPopup.visible && wordPopup.postUri === item.uri && wordPopup.postUri !== '';
      return (
        <PostCard 
          post={item} 
          onWordSelect={handleWordSelect}
          onSentenceSelect={handleSentenceSelect}
          clearSelection={shouldClearSelection}
        />
      );
    },
    [handleWordSelect, handleSentenceSelect, wordPopup.visible, wordPopup.postUri]
  );

  /**
   * Extract key for FlatList
   */
  const keyExtractor = useCallback((item: TimelinePost) => item.uri, []);

  /**
   * Render list header
   */
  const renderHeader = useCallback(() => {
    if (!isConnected) {
      return null;
    }
    return null;
  }, [isConnected]);

  /**
   * Render list footer (loading more indicator)
   */
  const renderFooter = useCallback(() => {
    if (!isLoadingMore) return null;

    return (
      <View style={styles.footerLoader}>
        <Loading size="small" message="読み込み中..." />
      </View>
    );
  }, [isLoadingMore]);

  /**
   * Render empty state
   */
  const renderEmpty = useCallback(() => {
    if (isLoading) return null;

    if (error) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>⚠️</Text>
          <Text style={styles.emptyTitle}>エラーが発生しました</Text>
          <Text style={styles.emptyMessage}>{error.getUserMessage()}</Text>
          <Button
            title="再試行"
            onPress={refresh}
            variant="outline"
            style={styles.retryButton}
          />
        </View>
      );
    }

    if (!isConnected) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>☁️</Text>
          <Text style={styles.emptyTitle}>オフラインです</Text>
          <Text style={styles.emptyMessage}>
            ネットワーク接続を確認してください
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>📭</Text>
        <Text style={styles.emptyTitle}>投稿がありません</Text>
        <Text style={styles.emptyMessage}>
          タイムラインに投稿がないか、{'\n'}
          フォローしているユーザーがいません
        </Text>
        <Button
          title="更新"
          onPress={refresh}
          variant="outline"
          style={styles.retryButton}
        />
      </View>
    );
  }, [isLoading, error, isConnected, refresh]);

  // Show loading state on initial load
  if (isLoading && posts.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>ホーム</Text>
        </View>
        <Loading fullScreen message="タイムラインを読み込み中..." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <OfflineBanner />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>ホーム</Text>
        {isConnected && (
          <Pressable
            onPress={refresh}
            style={styles.refreshButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessible={true}
            accessibilityLabel="タイムラインを更新"
            accessibilityHint="最新の投稿を読み込みます"
            accessibilityRole="button"
          >
            <RefreshCw size={24} color={Colors.primary} />
          </Pressable>
        )}
      </View>

      <FlatList
        ref={flatListRef}
        data={posts}
        renderItem={renderPost}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refresh}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
            enabled={isConnected}
          />
        }
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        windowSize={5}
      />

      {/* Scroll to Top Button */}
      <Animated.View
        style={[
          styles.scrollToTopButton,
          { opacity: scrollToTopOpacity },
        ]}
        pointerEvents={showScrollToTop ? 'auto' : 'none'}
      >
        <Pressable
          onPress={scrollToTop}
          style={styles.scrollToTopPressable}
          accessibilityLabel="TOPへ戻る"
          accessibilityRole="button"
        >
          <ArrowUp size={24} color={Colors.background} />
        </Pressable>
      </Animated.View>

      <WordPopup
        visible={wordPopup.visible}
        word={wordPopup.word}
        isSentenceMode={wordPopup.isSentenceMode}
        postUri={wordPopup.postUri}
        postText={wordPopup.postText}
        onClose={closeWordPopup}
        onAddToWordList={handleAddWord}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.background,
  },
  headerTitle: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.text,
  },
  refreshButton: {
    padding: Spacing.sm,
  },
  listContent: {
    flexGrow: 1,
    paddingVertical: Spacing.sm,
  },
  footerLoader: {
    paddingVertical: Spacing.lg,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xxl,
    marginTop: Spacing.xxl,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    fontSize: FontSizes.xl,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  emptyMessage: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  retryButton: {
    marginTop: Spacing.lg,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
    paddingTop: Spacing.md,
    maxHeight: '80%',
    ...Shadows.lg,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: Spacing.lg,
  },
  modalWord: {
    fontSize: FontSizes.xxl,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  modalSection: {
    marginBottom: Spacing.lg,
  },
  modalSectionTitle: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  modalSectionContent: {
    fontSize: FontSizes.lg,
    color: Colors.text,
    lineHeight: 24,
  },
  modalApiNote: {
    fontSize: FontSizes.sm,
    color: Colors.textTertiary,
    marginTop: Spacing.xs,
    fontStyle: 'italic',
  },
  modalButtons: {
    marginTop: Spacing.lg,
  },
  cancelButton: {
    marginTop: Spacing.sm,
  },
  scrollToTopButton: {
    position: 'absolute',
    bottom: Spacing.xl,
    right: Spacing.lg,
    ...Shadows.md,
  },
  scrollToTopPressable: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default HomeScreen;
