/**
 * Home Screen
 * Displays Bluesky timeline feed with word selection functionality
 */

import React, { useCallback, useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  Pressable,
  Alert,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Lightbulb, ArrowUp, Plus, Settings, HelpCircle } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { useTranslation } from 'react-i18next';
import { Colors, Spacing, FontSizes, BorderRadius, Shadows } from '../constants/colors';
import { useBlueskyFeed } from '../hooks/useBlueskyFeed';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useTutorial, TutorialStep } from '../hooks/useTutorial';
import { PostCard } from '../components/PostCard';
import { OfflineBanner } from '../components/OfflineBanner';
import { Loading } from '../components/common/Loading';
import { Button } from '../components/common/Button';
import { WordPopup } from '../components/WordPopup';
import { PostCreationModal } from '../components/PostCreationModal';
import { TutorialTooltip } from '../components/Tutorial';
import { TimelinePost } from '../types/bluesky';
import { addWord } from '../services/database/words';
import { likePost, unlikePost } from '../services/bluesky/feed';
import { useTheme } from '../hooks/useTheme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

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
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('home');
  const { t: tc } = useTranslation('common');
  const { t: tt } = useTranslation('tutorial');
  const { colors, isDark } = useTheme();

  const tipsRef = useRef<View>(null);
  const [tutorialPositions, setTutorialPositions] = useState<{
    tips?: { x: number; y: number; width: number; height: number };
    bookIcon?: { x: number; y: number; width: number; height: number };
    firstWord?: { x: number; y: number; width: number; height: number };
    contentColumn?: { x: number; y: number; width: number; height: number };
  }>({});

  // Tutorial steps configuration
  const tutorialSteps: TutorialStep[] = useMemo(() => [
    {
      id: 'wordSelection',
      title: tt('steps.wordSelection.title'),
      description: tt('steps.wordSelection.description'),
      targetPosition: tutorialPositions.contentColumn || {
        x: 20,
        y: insets.top + 160,
        width: SCREEN_WIDTH - 40,
        height: 100,
      },
      arrowDirection: 'up',
    },
    {
      id: 'bookSearch',
      title: tt('steps.bookSearch.title'),
      description: tt('steps.bookSearch.description'),
      targetPosition: tutorialPositions.bookIcon || {
        x: SCREEN_WIDTH - 60,
        y: insets.top + 280,
        width: 44,
        height: 44,
      },
      arrowDirection: 'up',
    },
    {
      id: 'apiSetup',
      title: tt('steps.apiSetup.title'),
      description: tt('steps.apiSetup.description'),
      targetPosition: tutorialPositions.bookIcon || {
        x: SCREEN_WIDTH - 60,
        y: insets.top + 340,
        width: 44,
        height: 44,
      },
      arrowDirection: 'up',
    },
    {
      id: 'tips',
      title: tt('steps.tips.title'),
      description: tt('steps.tips.description'),
      targetPosition: tutorialPositions.tips || {
        x: SCREEN_WIDTH - 58,
        y: insets.top + 2,
        width: 48,
        height: 48,
      },
      arrowDirection: 'up',
    },
  ], [tt, insets.top, tutorialPositions]);

  // Tutorial hook
  const {
    isActive: isTutorialActive,
    currentStepIndex,
    currentStepData,
    totalSteps,
    nextStep,
    skipTutorial,
  } = useTutorial(tutorialSteps);

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

  // Post creation modal state
  const [isPostModalVisible, setIsPostModalVisible] = useState(false);

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
          Alert.alert(tc('status.success'), t('wordAdded'));
        } else {
          Alert.alert(tc('status.error'), result.error.message);
        }
      } catch (error) {
        Alert.alert(tc('status.error'), t('wordAddError'));
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
          // Like the post
          const result = await likePost(post.uri, post.cid);
          if (!result.success) {
            if (__DEV__) {
              console.error('Failed to like post:', result.error);
            }
          }
        } else {
          // Unlike the post
          if (post.viewer?.like) {
            const result = await unlikePost(post.viewer.like);
            if (!result.success) {
              if (__DEV__) {
                console.error('Failed to unlike post:', result.error);
              }
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
   * Handle first post elements layout for tutorial
   */
  const handlePostLayoutElements = useCallback((elements: any) => {
    setTutorialPositions(prev => ({
      ...prev,
      bookIcon: elements.bookIcon,
      firstWord: elements.firstWord,
      contentColumn: elements.contentColumn,
    }));
  }, []);

  /**
   * Measure tips button for tutorial
   */
  const measureTips = useCallback(() => {
    if (tipsRef.current) {
      // Small delay to ensure layout is stable
      setTimeout(() => {
        tipsRef.current?.measureInWindow((x, y, width, height) => {
          if (x !== 0 || y !== 0) {
            setTutorialPositions(prev => ({ ...prev, tips: { x, y, width, height } }));
          }
        });
      }, 500);
    }
  }, []);

  /**
   * Render individual post item
   */
  const renderPost = useCallback(
    ({ item, index }: { item: TimelinePost, index: number }) => {
      // Only clear selection for the post that had a word selected
      // and only when the popup is closed but postUri hasn't been reset yet
      const shouldClearSelection = !wordPopup.visible && wordPopup.postUri === item.uri && wordPopup.postUri !== '';
      return (
        <PostCard
          post={item}
          onWordSelect={handleWordSelect}
          onSentenceSelect={handleSentenceSelect}
          onPostPress={handlePostPress}
          onLikePress={handleLikePress}
          clearSelection={shouldClearSelection}
          onLayoutElements={index === 0 ? handlePostLayoutElements : undefined}
        />
      );
    },
    [handleWordSelect, handleSentenceSelect, handlePostPress, handleLikePress, wordPopup.visible, wordPopup.postUri, handlePostLayoutElements]
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
        <Loading size="small" message={t('loadingMore')} />
      </View>
    );
  }, [isLoadingMore, t]);

  /**
   * Render empty state
   */
  const renderEmpty = useCallback(() => {
    if (isLoading) return null;

    if (error) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>⚠️</Text>
          <Text style={styles.emptyTitle}>{t('error')}</Text>
          <Text style={styles.emptyMessage}>{error.getUserMessage()}</Text>
          <Button
            title={t('retry')}
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
          <Text style={styles.emptyTitle}>{t('offline')}</Text>
          <Text style={styles.emptyMessage}>
            {t('offlineMessage')}
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>📭</Text>
        <Text style={styles.emptyTitle}>{t('empty')}</Text>
        <Text style={styles.emptyMessage}>
          {t('emptyMessage')}
        </Text>
        <Button
          title={t('refresh')}
          onPress={refresh}
          variant="outline"
          style={styles.retryButton}
        />
      </View>
    );
  }, [isLoading, error, isConnected, refresh, t]);


  // Show loading state on initial load
  if (isLoading && posts.length === 0) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
          <View style={styles.headerTitleContainer}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>{t('header')}</Text>
            <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>{t('headerSubtitle')}</Text>
          </View>
        </View>
        <Loading fullScreen message={t('loadingTimeline')} />
      </SafeAreaView>
    );
  }

  return (
    <View style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <OfflineBanner />

      {/* Header */}
      <View style={[styles.header, {
        backgroundColor: colors.background,
        borderBottomColor: colors.border,
        paddingTop: insets.top,
      }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{t('header')}</Text>
        </View>
        <View style={styles.headerRight}>
          <Pressable
            onPress={() => navigation.navigate('QuizSetup')}
            style={({ pressed }) => [
              styles.headerIconButton,
              pressed && { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' }
            ]}
            accessible={true}
            accessibilityLabel={t('quiz')}
            accessibilityHint={t('quizHint')}
            accessibilityRole="button"
          >
            <HelpCircle size={24} color={colors.primary} />
          </Pressable>
          <Pressable
            ref={tipsRef}
            onPress={() => navigation.navigate('Tips')}
            style={({ pressed }) => [
              styles.headerIconButton,
              pressed && { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' }
            ]}
            accessible={true}
            accessibilityLabel={t('tips')}
            accessibilityHint={t('tipsHint')}
            accessibilityRole="button"
          >
            <Lightbulb size={24} color={colors.primary} />
          </Pressable>
        </View>
      </View>

      <FlatList
        ref={flatListRef}
        data={posts}
        renderItem={renderPost}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyMessage, { color: colors.textSecondary }]}>{t('feed.empty')}</Text>
              <Button
                title={t('feed.retry')}
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
          ) : <View style={{ height: 100 }} />
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
        onScroll={handleScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        windowSize={5}
      />

      {/* Floating Action Button */}
      {showScrollToTop && (
        <Pressable
          style={[styles.scrollToTopButton, styles.scrollToTopPressable, { backgroundColor: colors.primary }]}
          onPress={scrollToTop}
          accessibilityLabel={t('scrollToTop')}
          accessibilityRole="button"
        >
          <ArrowUp size={24} color="#FFF" />
        </Pressable>
      )}

      <Pressable
        style={[styles.fab, { backgroundColor: colors.primary, ...Shadows.lg }]}
        onPress={() => setIsPostModalVisible(true)}
        accessibilityLabel={t('createPost')}
        accessibilityRole="button"
      >
        <Plus size={28} color="#FFF" />
      </Pressable>

      <PostCreationModal
        visible={isPostModalVisible}
        onClose={() => setIsPostModalVisible(false)}
        onPostSuccess={() => {
          setIsPostModalVisible(false);
          refresh();
        }}
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

      {/* Tutorial Tooltip */}
      {isTutorialActive && currentStepData && (
        <TutorialTooltip
          visible={isTutorialActive}
          title={currentStepData.title}
          description={currentStepData.description}
          tooltipPosition={{}} // Handled automatically
          highlightArea={currentStepData.targetPosition}
          arrowDirection="up" // Handled automatically
          currentStep={currentStepIndex}
          totalSteps={totalSteps}
          onNext={nextStep}
          onSkip={skipTutorial}
          nextLabel={currentStepIndex === totalSteps ? tt('done') : tt('next')}
          skipLabel={tt('skip')}
        />
      )}
    </View>
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
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerIconButton: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.text,
  },
  headerSubtitle: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  tipsButton: {
    padding: Spacing.sm,
  },
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
    left: Spacing.lg,
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
  fab: {
    position: 'absolute',
    bottom: Spacing.xl,
    right: Spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.lg,
  },
});

export default HomeScreen;
