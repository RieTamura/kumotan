/**
 * Home Screen
 * Displays Bluesky timeline feed with word selection functionality
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  Pressable,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Spacing, FontSizes, BorderRadius, Shadows } from '../constants/colors';
import { useBlueskyFeed } from '../hooks/useBlueskyFeed';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { PostCard } from '../components/PostCard';
import { OfflineBanner } from '../components/OfflineBanner';
import { Loading } from '../components/common/Loading';
import { Button } from '../components/common/Button';
import { TimelinePost } from '../types/bluesky';

/**
 * Word popup state interface
 */
interface WordPopupState {
  visible: boolean;
  word: string;
  postUri: string;
  postText: string;
}

/**
 * Initial word popup state
 */
const initialWordPopupState: WordPopupState = {
  visible: false,
  word: '',
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

  /**
   * Handle word selection from a post
   */
  const handleWordSelect = useCallback(
    (word: string, postUri: string, postText: string) => {
      setWordPopup({
        visible: true,
        word: word.toLowerCase(),
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
    setWordPopup(initialWordPopupState);
  }, []);

  /**
   * Handle add word to vocabulary
   */
  const handleAddWord = useCallback(async () => {
    // TODO: Implement word addition with API calls
    Alert.alert(
      '単語を追加',
      `"${wordPopup.word}" を単語帳に追加しますか？`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '追加',
          onPress: () => {
            // TODO: Call word service to add word
            Alert.alert('成功', '単語を追加しました！');
            closeWordPopup();
          },
        },
      ]
    );
  }, [wordPopup.word, closeWordPopup]);

  /**
   * Handle end reached for infinite scroll
   */
  const handleEndReached = useCallback(() => {
    if (!isLoadingMore && hasMore && isConnected) {
      loadMore();
    }
  }, [isLoadingMore, hasMore, isConnected, loadMore]);

  /**
   * Render individual post item
   */
  const renderPost = useCallback(
    ({ item }: { item: TimelinePost }) => (
      <PostCard post={item} onWordSelect={handleWordSelect} />
    ),
    [handleWordSelect]
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
          >
            <Text style={styles.refreshIcon}>🔄</Text>
          </Pressable>
        )}
      </View>

      <FlatList
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
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        windowSize={5}
      />

      <Modal
        visible={wordPopup.visible}
        transparent
        animationType="slide"
        onRequestClose={closeWordPopup}
      >
        <Pressable style={styles.modalOverlay} onPress={closeWordPopup}>
          <Pressable style={styles.modalContent} onPress={() => {}}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalWord}>{wordPopup.word}</Text>

            <View style={styles.modalSection}>
              <Text style={styles.modalSectionTitle}>日本語訳</Text>
              <Text style={styles.modalSectionContent}>読み込み中...</Text>
            </View>

            <View style={styles.modalSection}>
              <Text style={styles.modalSectionTitle}>英語定義</Text>
              <Text style={styles.modalSectionContent}>読み込み中...</Text>
            </View>

            <View style={styles.modalButtons}>
              <Button
                title="単語帳に追加"
                onPress={handleAddWord}
                fullWidth
                size="large"
              />
              <Button
                title="キャンセル"
                onPress={closeWordPopup}
                variant="ghost"
                fullWidth
                style={styles.cancelButton}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
  refreshIcon: {
    fontSize: FontSizes.xl,
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
});

export default HomeScreen;
