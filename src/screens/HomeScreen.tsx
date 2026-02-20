/**
 * Home Screen
 * Displays Bluesky timeline feed with word selection functionality
 */

import React, { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  Pressable,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Animated,
  Dimensions,
} from 'react-native';
import PagerView, { PagerViewOnPageSelectedEvent } from 'react-native-pager-view';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Lightbulb, ArrowUp, Plus } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { useTranslation } from 'react-i18next';
import { Colors, Spacing, FontSizes, BorderRadius, Shadows } from '../constants/colors';
import { useBlueskyFeed } from '../hooks/useBlueskyFeed';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useTutorial, TutorialStep } from '../hooks/useTutorial';
import { useWordRegistration } from '../hooks/useWordRegistration';
import { PostCard } from '../components/PostCard';
import { OfflineBanner } from '../components/OfflineBanner';
import { Loading } from '../components/common/Loading';
import { Button } from '../components/common/Button';
import { WordPopup } from '../components/WordPopup';
import { PostCreationModal } from '../components/PostCreationModal';
import { TutorialTooltip } from '../components/Tutorial';
import { IndexTabs, TabType } from '../components/IndexTabs';
import { ProfileView } from '../components/ProfileView';
import { TimelinePost } from '../types/bluesky';
import { useAuthProfile, useAuthUser } from '../store/authStore';
import { likePost, unlikePost, repostPost, unrepostPost } from '../services/bluesky/feed';
import { followUser, unfollowUser, blockUser, unblockUser } from '../services/bluesky/social';
import { useSocialStore } from '../store/socialStore';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { ReplyToInfo, QuoteToInfo } from '../hooks/usePostCreation';
import { useTheme } from '../hooks/useTheme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * HomeScreen Component
 */
export function HomeScreen(): React.JSX.Element {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('home');
  const { t: tt } = useTranslation('tutorial');
  const { colors, isDark } = useTheme();
  const profile = useAuthProfile();
  const user = useAuthUser();
  const { setFollowing, setBlocking } = useSocialStore();

  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('following');
  const pagerRef = useRef<PagerView>(null);

  // Tab index mapping
  const TAB_INDEX_MAP: Record<TabType, number> = { following: 0, profile: 1 };
  const INDEX_TAB_MAP: TabType[] = ['following', 'profile'];

  // Scroll to top button state (declared early for use in tab change handlers)
  const flatListRef = useRef<FlatList<TimelinePost>>(null);
  const profileFlatListRef = useRef<FlatList<TimelinePost>>(null);
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const scrollToTopOpacity = useRef(new Animated.Value(0)).current;
  const followingScrollOffset = useRef(0);
  const profileScrollOffset = useRef(0);
  const SCROLL_THRESHOLD = 500;

  /**
   * Handle tab change from IndexTabs
   */
  const handleTabChange = useCallback((tab: TabType) => {
    setActiveTab(tab);
    pagerRef.current?.setPage(TAB_INDEX_MAP[tab]);
    // Sync scroll-to-top button state for the new tab
    const offset = tab === 'following'
      ? followingScrollOffset.current
      : profileScrollOffset.current;
    const shouldShow = offset > SCROLL_THRESHOLD;
    setShowScrollToTop(shouldShow);
    Animated.timing(scrollToTopOpacity, {
      toValue: shouldShow ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [scrollToTopOpacity, SCROLL_THRESHOLD]);

  /**
   * Handle page change from swipe
   */
  const handlePageSelected = useCallback((event: PagerViewOnPageSelectedEvent) => {
    const pageIndex = event.nativeEvent.position;
    const tab = INDEX_TAB_MAP[pageIndex];
    if (tab && tab !== activeTab) {
      setActiveTab(tab);
      // Sync scroll-to-top button state for the new tab
      const offset = tab === 'following'
        ? followingScrollOffset.current
        : profileScrollOffset.current;
      const shouldShow = offset > SCROLL_THRESHOLD;
      setShowScrollToTop(shouldShow);
      Animated.timing(scrollToTopOpacity, {
        toValue: shouldShow ? 1 : 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [activeTab, scrollToTopOpacity, SCROLL_THRESHOLD]);

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
      targetPosition: tutorialPositions.firstWord || {
        x: 20,
        y: insets.top + 160,
        width: 80,
        height: 32,
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
        x: SCREEN_WIDTH - 46,
        y: insets.top + 14,
        width: 24,
        height: 24,
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
    prevStep,
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

  // Word registration hook
  const {
    wordPopup,
    handleWordSelect,
    handleSentenceSelect,
    closeWordPopup,
    handleAddWord,
  } = useWordRegistration();

  // Post creation modal state
  const [isPostModalVisible, setIsPostModalVisible] = useState(false);
  const [replyTarget, setReplyTarget] = useState<ReplyToInfo | null>(null);
  const [quoteTarget, setQuoteTarget] = useState<QuoteToInfo | null>(null);

  // Block confirmation modal state
  const [blockConfirm, setBlockConfirm] = useState<{
    visible: boolean;
    did: string;
    handle: string;
    blockUri?: string;
  }>({ visible: false, did: '', handle: '' });

  /**
   * Handle end reached for infinite scroll
   */
  const handleEndReached = useCallback(() => {
    if (!isLoadingMore && hasMore && isConnected) {
      loadMore();
    }
  }, [isLoadingMore, hasMore, isConnected, loadMore]);

  /**
   * Update scroll-to-top button visibility with animation
   */
  const updateScrollToTopVisibility = useCallback(
    (shouldShow: boolean) => {
      if (shouldShow !== showScrollToTop) {
        setShowScrollToTop(shouldShow);
        Animated.timing(scrollToTopOpacity, {
          toValue: shouldShow ? 1 : 0,
          duration: 200,
          useNativeDriver: true,
        }).start();
      }
    },
    [showScrollToTop, scrollToTopOpacity]
  );

  /**
   * Handle scroll event for Following tab
   */
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetY = event.nativeEvent.contentOffset.y;
      followingScrollOffset.current = offsetY;
      updateScrollToTopVisibility(offsetY > SCROLL_THRESHOLD);
    },
    [updateScrollToTopVisibility, SCROLL_THRESHOLD]
  );

  /**
   * Handle scroll event for Profile tab
   */
  const handleProfileScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetY = event.nativeEvent.contentOffset.y;
      profileScrollOffset.current = offsetY;
      updateScrollToTopVisibility(offsetY > SCROLL_THRESHOLD);
    },
    [updateScrollToTopVisibility, SCROLL_THRESHOLD]
  );

  /**
   * Scroll to top of the active tab's list
   */
  const scrollToTop = useCallback(() => {
    if (activeTab === 'following') {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    } else {
      profileFlatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    }
  }, [activeTab]);

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
   * Handle reply press
   */
  const handleReplyPress = useCallback((post: TimelinePost) => {
    setReplyTarget({
      uri: post.uri,
      cid: post.cid,
      author: { handle: post.author.handle, displayName: post.author.displayName },
      text: post.text,
    });
    setQuoteTarget(null);
    setIsPostModalVisible(true);
  }, []);

  /**
   * Handle repost press
   */
  const handleRepostPress = useCallback(
    async (post: TimelinePost, shouldRepost: boolean) => {
      try {
        if (shouldRepost) {
          const result = await repostPost(post.uri, post.cid);
          if (!result.success && __DEV__) {
            console.error('Failed to repost:', result.error);
          }
        } else {
          if (post.viewer?.repost) {
            const result = await unrepostPost(post.viewer.repost);
            if (!result.success && __DEV__) {
              console.error('Failed to unrepost:', result.error);
            }
          }
        }
      } catch (error) {
        if (__DEV__) {
          console.error('Repost operation failed:', error);
        }
      }
    },
    []
  );

  /**
   * Handle follow/unfollow press from PostCard avatar tap
   */
  const handleFollowPress = useCallback(
    async (did: string, shouldFollow: boolean, followUri?: string) => {
      // Optimistic update first ('optimistic' is truthy → shows following state)
      setFollowing(did, shouldFollow ? 'optimistic' : null);

      try {
        if (shouldFollow) {
          const result = await followUser(did);
          if (result.success) {
            setFollowing(did, result.data.uri);
          } else {
            // Revert
            setFollowing(did, followUri ?? null);
            if (__DEV__) {
              console.error('Failed to follow user:', result.error);
            }
          }
        } else {
          if (!followUri) return;
          const result = await unfollowUser(followUri);
          if (!result.success) {
            // Revert
            setFollowing(did, followUri);
            if (__DEV__) {
              console.error('Failed to unfollow user:', result.error);
            }
          }
        }
      } catch (error) {
        setFollowing(did, followUri ?? null);
        if (__DEV__) {
          console.error('Follow operation failed:', error);
        }
      }
    },
    [setFollowing]
  );

  /**
   * Handle block/unblock press from PostCard avatar tap.
   * Blocking shows ConfirmModal first. Unblocking is immediate with optimistic update.
   */
  const handleBlockPress = useCallback(
    (did: string, handle: string, shouldBlock: boolean, blockUri?: string) => {
      if (shouldBlock) {
        setBlockConfirm({ visible: true, did, handle, blockUri });
      } else {
        // Unblock: optimistic update then API call
        setBlocking(did, null);
        if (blockUri) {
          unblockUser(blockUri).then((result) => {
            if (!result.success) {
              setBlocking(did, blockUri);
              if (__DEV__) {
                console.error('Failed to unblock user:', result.error);
              }
            }
          });
        }
      }
    },
    [setBlocking]
  );

  /**
   * Execute block after user confirms via ConfirmModal
   */
  const handleBlockConfirm = useCallback(async () => {
    const { did, blockUri } = blockConfirm;
    setBlockConfirm((prev) => ({ ...prev, visible: false }));

    // Optimistic update
    setBlocking(did, 'optimistic');

    try {
      const result = await blockUser(did);
      if (result.success) {
        setBlocking(did, result.data.uri);
      } else {
        setBlocking(did, blockUri ?? null);
        if (__DEV__) {
          console.error('Failed to block user:', result.error);
        }
      }
    } catch (error) {
      setBlocking(did, blockUri ?? null);
      if (__DEV__) {
        console.error('Block operation failed:', error);
      }
    }
  }, [blockConfirm, setBlocking]);

  /**
   * Handle quote press
   */
  const handleQuotePress = useCallback((post: TimelinePost) => {
    setQuoteTarget({
      uri: post.uri,
      cid: post.cid,
      author: {
        handle: post.author.handle,
        displayName: post.author.displayName,
        avatar: post.author.avatar,
      },
      text: post.text,
    });
    setReplyTarget(null);
    setIsPostModalVisible(true);
  }, []);

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
            // Shrink to fit the icon with small margin (remove button padding, keep slight breathing room)
            const inset = Spacing.sm;
            setTutorialPositions(prev => ({
              ...prev,
              tips: {
                x: x + inset,
                y: y + inset,
                width: width - inset * 2,
                height: height - inset * 2,
              },
            }));
          }
        });
      }, 500);
    }
  }, []);

  // Measure tips button when tutorial becomes active
  useEffect(() => {
    if (isTutorialActive) {
      measureTips();
    }
  }, [isTutorialActive, measureTips]);

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
          onReplyPress={handleReplyPress}
          onRepostPress={handleRepostPress}
          onQuotePress={handleQuotePress}
          onFollowPress={handleFollowPress}
          onBlockPress={handleBlockPress}
          currentUserDid={user?.did}
          clearSelection={shouldClearSelection}
          onLayoutElements={index === 0 ? handlePostLayoutElements : undefined}
        />
      );
    },
    [handleWordSelect, handleSentenceSelect, handlePostPress, handleLikePress, handleReplyPress, handleRepostPress, handleQuotePress, handleFollowPress, handleBlockPress, user?.did, wordPopup.visible, wordPopup.postUri, handlePostLayoutElements]
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


  // Show loading state on initial load (only for Following tab)
  if (isLoading && posts.length === 0 && activeTab === 'following') {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={[styles.header, {
          backgroundColor: 'transparent',
          borderBottomColor: colors.indexTabBorder,
        }]}>
          <View style={styles.headerTabsContainer}>
            <IndexTabs
              activeTab={activeTab}
              onTabChange={handleTabChange}
              avatarUri={profile?.avatar}
            />
          </View>
          <View style={styles.headerRight}>
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
        <Loading fullScreen message={t('loadingTimeline')} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      <OfflineBanner />

      {/* Header with Index Tabs */}
      <View style={[styles.header, {
        backgroundColor: 'transparent',
        borderBottomColor: colors.indexTabBorder,
      }]}>
        <View style={styles.headerTabsContainer}>
          <IndexTabs
            activeTab={activeTab}
            onTabChange={handleTabChange}
            avatarUri={profile?.avatar}
          />
        </View>
        <View style={styles.headerRight}>
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

      {/* Swipeable tab content */}
      <PagerView
        ref={pagerRef}
        style={styles.tabContent}
        initialPage={0}
        onPageSelected={handlePageSelected}
        overdrag={true}
      >
        {/* Following tab - page 0 */}
        <View key="following" style={styles.pageContainer}>
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
        </View>

        {/* Profile tab - page 1 */}
        <View key="profile" style={styles.pageContainer}>
          <ProfileView
            flatListRef={profileFlatListRef}
            onScroll={handleProfileScroll}
            onReplyPress={handleReplyPress}
            onRepostPress={handleRepostPress}
            onQuotePress={handleQuotePress}
          />
        </View>
      </PagerView>

      {/* Floating Action Buttons */}
      {showScrollToTop && (
        <Pressable
          style={[styles.scrollToTopButton, styles.scrollToTopPressable, { backgroundColor: colors.backgroundTertiary }]}
          onPress={scrollToTop}
          accessibilityLabel={t('scrollToTop')}
          accessibilityRole="button"
        >
          <ArrowUp size={24} color={colors.primary} />
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
        onClose={() => {
          setIsPostModalVisible(false);
          setReplyTarget(null);
          setQuoteTarget(null);
        }}
        onPostSuccess={() => {
          setIsPostModalVisible(false);
          setReplyTarget(null);
          setQuoteTarget(null);
          refresh();
        }}
        replyTo={replyTarget ?? undefined}
        quoteTo={quoteTarget ?? undefined}
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

      {/* Block confirmation modal */}
      <ConfirmModal
        visible={blockConfirm.visible}
        title={t('blockConfirmTitle')}
        message={t('blockConfirmMessage', { handle: blockConfirm.handle })}
        buttons={[
          {
            text: t('postCancel'),
            style: 'cancel',
            onPress: () => setBlockConfirm((prev) => ({ ...prev, visible: false })),
          },
          {
            text: t('blockConfirm'),
            style: 'destructive',
            onPress: handleBlockConfirm,
          },
        ]}
        onClose={() => setBlockConfirm((prev) => ({ ...prev, visible: false }))}
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
          onBack={prevStep}
          onSkip={skipTutorial}
          nextLabel={currentStepIndex === totalSteps ? tt('done') : tt('next')}
          backLabel={tt('back')}
          skipLabel={tt('skip')}
        />
      )}
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
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingRight: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.background,
    minHeight: 56,
  },
  headerLeft: {
    flex: 1,
  },
  headerTabsContainer: {
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
  tabContent: {
    flex: 1,
  },
  pageContainer: {
    flex: 1,
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
