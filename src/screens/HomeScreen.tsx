/**
 * Home Screen
 * Displays Bluesky timeline feed with word selection functionality
 */

import React, { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Animated,
  Dimensions,
} from 'react-native';
import PagerView, { PagerViewOnPageSelectedEvent } from 'react-native-pager-view';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowUp, Bell, Plus } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { useTranslation } from 'react-i18next';
import { Spacing, BorderRadius, Shadows } from '../constants/colors';
import { useBlueskyFeed } from '../hooks/useBlueskyFeed';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useCustomFeedStore } from '../store/customFeedStore';
import { useTabOrderStore, type HomeTabKey } from '../store/tabOrderStore';
import { useTutorial, TutorialStep } from '../hooks/useTutorial';
import { useTutorialTargetStore } from '../store/tutorialTargetStore';
import { useWordRegistration } from '../hooks/useWordRegistration';
import { OfflineBanner } from '../components/OfflineBanner';
import { Loading } from '../components/common/Loading';
import { WordPopup } from '../components/WordPopup';
import { PostCreationModal } from '../components/PostCreationModal';
import { TutorialTooltip } from '../components/Tutorial';
import { IndexTabs, TabConfig, AvatarTabIcon } from '../components/IndexTabs';
import { FollowingFeedTab } from '../components/FollowingFeedTab';
import { CustomFeedTab } from '../components/CustomFeedTab';
import { ProfileView } from '../components/ProfileView';
import { TimelinePost } from '../types/bluesky';
import { useAuthProfile, useAuthUser } from '../store/authStore';
import { likePost, unlikePost, repostPost, unrepostPost, deletePost } from '../services/bluesky/feed';
import { followUser, unfollowUser, blockUser, unblockUser } from '../services/bluesky/social';
import { useSocialStore } from '../store/socialStore';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { ProfilePreviewModal } from '../components/ProfilePreviewModal';
import { ReplyToInfo, QuoteToInfo } from '../hooks/usePostCreation';
import { useTheme } from '../hooks/useTheme';
import { useNotificationStore } from '../store/notificationStore';
import { Colors } from '../constants/colors';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// HomeTabKey is defined in tabOrderStore and re-exported here for local use

/**
 * HomeScreen Component
 */
export function HomeScreen(): React.JSX.Element {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('home');
  const { t: tt } = useTranslation('tutorial');
  const { colors } = useTheme();
  const hasUnread = useNotificationStore((state) => state.hasUnread);
  const profile = useAuthProfile();
  const user = useAuthUser();
  const { setFollowing, setBlocking, userStates } = useSocialStore();

  // Tab state
  const [activeTab, setActiveTab] = useState<HomeTabKey>('following');
  const pagerRef = useRef<PagerView>(null);

  // Custom feed selection (persisted via Zustand)
  const { selectedFeedUri, selectedFeedDisplayName, selectFeed } = useCustomFeedStore();

  // Tab order (persisted via Zustand)
  const { tabOrder } = useTabOrderStore();

  // Declarative tab configuration — ordered by tabOrder, customFeed only shown when selected
  const tabs = useMemo((): TabConfig[] => {
    const allTabs: Partial<Record<HomeTabKey, TabConfig>> = {
      following: { key: 'following', label: t('tabs.following') },
      ...(selectedFeedUri && selectedFeedDisplayName
        ? {
            customFeed: {
              key: 'customFeed',
              label: selectedFeedDisplayName,
              onRemove: () => selectFeed(null, null),
            },
          }
        : {}),
      profile: {
        key: 'profile',
        clipAtEdge: true,
        renderContent: (isActive: boolean) => (
          <AvatarTabIcon
            isActive={isActive}
            uri={profile?.avatar}
            activeColor={colors.indexTabTextActive}
            inactiveColor={colors.indexTabText}
          />
        ),
      },
    };
    return tabOrder
      .map(key => allTabs[key])
      .filter((tab): tab is TabConfig => tab !== undefined);
  }, [tabOrder, t, selectedFeedUri, selectedFeedDisplayName, selectFeed, profile?.avatar, colors.indexTabTextActive, colors.indexTabText]);

  // Per-tab FlatList refs
  const followingListRef = useRef<FlatList<TimelinePost> | null>(null);
  const customFeedListRef = useRef<FlatList<TimelinePost> | null>(null);
  const profileListRef = useRef<FlatList<TimelinePost> | null>(null);

  const getListRef = useCallback(
    (key: string): React.RefObject<FlatList<TimelinePost> | null> | null => {
      const map: Record<string, React.RefObject<FlatList<TimelinePost> | null>> = {
        following: followingListRef,
        customFeed: customFeedListRef,
        profile: profileListRef,
      };
      return map[key] ?? null;
    },
    []
  );

  // Per-tab scroll offset tracking
  const scrollOffsets = useRef<Record<string, number>>({ following: 0, customFeed: 0, profile: 0 });

  // Scroll-to-top FAB state
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const scrollToTopOpacity = useRef(new Animated.Value(0)).current;
  const SCROLL_THRESHOLD = 500;

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
   * Handle tab change from IndexTabs (tap)
   */
  const handleTabChange = useCallback(
    (tab: string) => {
      setActiveTab(tab as HomeTabKey);
      const pageIndex = tabs.findIndex((t) => t.key === tab);
      if (pageIndex >= 0) pagerRef.current?.setPage(pageIndex);
      const offset = scrollOffsets.current[tab] ?? 0;
      const shouldShow = offset > SCROLL_THRESHOLD;
      setShowScrollToTop(shouldShow);
      Animated.timing(scrollToTopOpacity, {
        toValue: shouldShow ? 1 : 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    },
    [tabs, scrollToTopOpacity, SCROLL_THRESHOLD]
  );

  /**
   * Handle page change from swipe
   */
  const handlePageSelected = useCallback(
    (event: PagerViewOnPageSelectedEvent) => {
      const pageIndex = event.nativeEvent.position;
      const tab = tabs[pageIndex]?.key;
      if (tab && tab !== activeTab) {
        setActiveTab(tab as HomeTabKey);
        const offset = scrollOffsets.current[tab] ?? 0;
        const shouldShow = offset > SCROLL_THRESHOLD;
        setShowScrollToTop(shouldShow);
        Animated.timing(scrollToTopOpacity, {
          toValue: shouldShow ? 1 : 0,
          duration: 200,
          useNativeDriver: true,
        }).start();
      }
    },
    [activeTab, tabs, scrollToTopOpacity, SCROLL_THRESHOLD]
  );

  /**
   * Handle scroll event for Following tab
   */
  const handleFollowingScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetY = event.nativeEvent.contentOffset.y;
      scrollOffsets.current.following = offsetY;
      updateScrollToTopVisibility(offsetY > SCROLL_THRESHOLD);
    },
    [updateScrollToTopVisibility, SCROLL_THRESHOLD]
  );

  /**
   * Handle scroll event for CustomFeed tab
   */
  const handleCustomFeedScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetY = event.nativeEvent.contentOffset.y;
      scrollOffsets.current.customFeed = offsetY;
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
      scrollOffsets.current.profile = offsetY;
      updateScrollToTopVisibility(offsetY > SCROLL_THRESHOLD);
    },
    [updateScrollToTopVisibility, SCROLL_THRESHOLD]
  );

  /**
   * Scroll to top of the active tab's list
   */
  const scrollToTop = useCallback(() => {
    getListRef(activeTab)?.current?.scrollToOffset({ offset: 0, animated: true });
  }, [activeTab, getListRef]);

  const [tutorialPositions, setTutorialPositions] = useState<{
    bookIcon?: { x: number; y: number; width: number; height: number };
    firstWord?: { x: number; y: number; width: number; height: number };
    contentColumn?: { x: number; y: number; width: number; height: number };
  }>({});
  const { settingsTabPosition } = useTutorialTargetStore();

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
      targetPosition: settingsTabPosition || {
        x: SCREEN_WIDTH * 0.8,
        y: SCREEN_HEIGHT - 60,
        width: SCREEN_WIDTH * 0.2,
        height: 60,
      },
      arrowDirection: 'down',
    },
  ], [tt, insets.top, tutorialPositions, settingsTabPosition]);

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
    posts: rawPosts,
    isLoading,
    isRefreshing,
    isLoadingMore,
    hasMore,
    refresh,
    loadMore,
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

  // Deleted post URIs for immediate removal from feed
  const [deletedUris, setDeletedUris] = useState<Set<string>>(new Set());

  // Filter out blocked users' posts and deleted posts from the current feed.
  const posts = useMemo(() => {
    const blockedDids = new Set(
      Object.entries(userStates)
        .filter(([_, s]) => s.blocking != null)
        .map(([did]) => did)
    );
    return rawPosts.filter(
      (p) => !blockedDids.has(p.author.did) && !deletedUris.has(p.uri)
    );
  }, [rawPosts, userStates, deletedUris]);

  // Block confirmation modal state
  const [blockConfirm, setBlockConfirm] = useState<{
    visible: boolean;
    did: string;
    handle: string;
    blockUri?: string;
  }>({ visible: false, did: '', handle: '' });

  // Delete confirmation modal state
  const [deleteConfirm, setDeleteConfirm] = useState<{
    visible: boolean;
    post: TimelinePost | null;
  }>({ visible: false, post: null });

  // Profile preview modal state
  const [profilePreview, setProfilePreview] = useState<{
    visible: boolean;
    author: TimelinePost['author'] | null;
  }>({ visible: false, author: null });

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
      setFollowing(did, shouldFollow ? 'optimistic' : null);

      try {
        if (shouldFollow) {
          const result = await followUser(did);
          if (result.success) {
            setFollowing(did, result.data.uri);
          } else {
            setFollowing(did, followUri ?? null);
            if (__DEV__) {
              console.error('Failed to follow user:', result.error);
            }
          }
        } else {
          if (!followUri) return;
          const result = await unfollowUser(followUri);
          if (!result.success) {
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
   */
  const handleBlockPress = useCallback(
    (did: string, handle: string, shouldBlock: boolean, blockUri?: string) => {
      if (shouldBlock) {
        setBlockConfirm({ visible: true, did, handle, blockUri });
      } else {
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
   * Handle avatar press - open profile preview modal
   */
  const handleAvatarPress = useCallback((author: TimelinePost['author']) => {
    setProfilePreview({ visible: true, author });
  }, []);

  /**
   * Handle delete press - show confirmation modal
   */
  const handleDeletePress = useCallback((post: TimelinePost) => {
    setDeleteConfirm({ visible: true, post });
  }, []);

  /**
   * Execute delete after user confirms via ConfirmModal
   */
  const handleDeleteConfirm = useCallback(async () => {
    const post = deleteConfirm.post;
    if (!post) return;

    setDeleteConfirm((prev) => ({ ...prev, visible: false }));

    setDeletedUris((prev) => new Set(prev).add(post.uri));

    const result = await deletePost(post.uri);
    if (!result.success) {
      setDeletedUris((prev) => {
        const next = new Set(prev);
        next.delete(post.uri);
        return next;
      });
      if (__DEV__) {
        console.error('Failed to delete post:', result.error);
      }
    }
  }, [deleteConfirm.post]);

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

  // When the custom feed is removed from settings, fall back to the Following tab
  useEffect(() => {
    if (!selectedFeedUri && activeTab === 'customFeed') {
      setActiveTab('following');
      pagerRef.current?.setPage(0);
    }
  }, [selectedFeedUri, activeTab]);

  // Shared IndexTabs / header props
  const indexTabsHeader = (
    <View style={[styles.header, {
      backgroundColor: 'transparent',
      borderBottomColor: colors.indexTabBorder,
    }]}>
      <View style={styles.headerTabsContainer}>
        <IndexTabs
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={handleTabChange}
        />
      </View>
      <View style={styles.headerRight}>
        <Pressable
          style={styles.headerIconButton}
          onPress={() => navigation.navigate('BlueskyNotifications')}
          accessibilityLabel={t('notifications.bell')}
          accessibilityRole="button"
        >
          <Bell size={22} color={colors.text} />
          {hasUnread && <View style={styles.unreadDot} />}
        </Pressable>
      </View>
    </View>
  );

  // Show loading state on initial load (only for Following tab)
  if (isLoading && posts.length === 0 && activeTab === 'following') {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
        {indexTabsHeader}
        <Loading fullScreen message={t('loadingTimeline')} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      <OfflineBanner />

      {indexTabsHeader}

      {/* Swipeable tab content.
          PagerView must never receive null/undefined/false children —
          accessing .props on them crashes the library.
          We build a typed array and filter out null before rendering.
          key={tabsKey} forces a full remount when the page count or order
          changes so PagerView is always initialised with the right children. */}
      <PagerView
        key={tabs.map(t => t.key).join('-')}
        ref={pagerRef}
        style={styles.tabContent}
        initialPage={0}
        onPageSelected={handlePageSelected}
        overdrag={true}
      >
        {(
          [
            <View key="following" style={styles.pageContainer}>
              <FollowingFeedTab
                flatListRef={followingListRef}
                onScroll={handleFollowingScroll}
                posts={posts}
                isLoading={isLoading}
                isRefreshing={isRefreshing}
                isLoadingMore={isLoadingMore}
                hasMore={hasMore}
                isConnected={isConnected}
                onRefresh={refresh}
                onLoadMore={loadMore}
                wordPopupVisible={wordPopup.visible}
                wordPopupPostUri={wordPopup.postUri}
                currentUserDid={user?.did}
                onWordSelect={handleWordSelect}
                onSentenceSelect={handleSentenceSelect}
                onPostPress={handlePostPress}
                onLikePress={handleLikePress}
                onReplyPress={handleReplyPress}
                onRepostPress={handleRepostPress}
                onQuotePress={handleQuotePress}
                onAvatarPress={handleAvatarPress}
                onDeletePress={handleDeletePress}
                onPostLayoutElements={handlePostLayoutElements}
              />
            </View>,

            selectedFeedUri ? (
              <View key="customFeed" style={styles.pageContainer}>
                <CustomFeedTab
                  feedUri={selectedFeedUri}
                  flatListRef={customFeedListRef}
                  onScroll={handleCustomFeedScroll}
                  wordPopupVisible={wordPopup.visible}
                  wordPopupPostUri={wordPopup.postUri}
                  currentUserDid={user?.did}
                  deletedUris={deletedUris}
                  onWordSelect={handleWordSelect}
                  onSentenceSelect={handleSentenceSelect}
                  onPostPress={handlePostPress}
                  onLikePress={handleLikePress}
                  onReplyPress={handleReplyPress}
                  onRepostPress={handleRepostPress}
                  onQuotePress={handleQuotePress}
                  onAvatarPress={handleAvatarPress}
                  onDeletePress={handleDeletePress}
                />
              </View>
            ) : null,

            <View key="profile" style={styles.pageContainer}>
              <ProfileView
                flatListRef={profileListRef}
                onScroll={handleProfileScroll}
                onReplyPress={handleReplyPress}
                onRepostPress={handleRepostPress}
                onQuotePress={handleQuotePress}
              />
            </View>,
          ] as (React.JSX.Element | null)[]
        ).filter((page): page is React.JSX.Element => page !== null)}
      </PagerView>

      {/* Scroll-to-top FAB */}
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

      {/* Post creation FAB */}
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

      {/* Delete post confirmation modal */}
      <ConfirmModal
        visible={deleteConfirm.visible}
        title={t('deletePostTitle', '投稿を削除')}
        message={t('deletePostMessage', 'この投稿を削除しますか？この操作は取り消せません。')}
        buttons={[
          {
            text: t('postCancel'),
            style: 'cancel',
            onPress: () => setDeleteConfirm((prev) => ({ ...prev, visible: false })),
          },
          {
            text: t('deletePostConfirm', '削除'),
            style: 'destructive',
            onPress: handleDeleteConfirm,
          },
        ]}
        onClose={() => setDeleteConfirm((prev) => ({ ...prev, visible: false }))}
      />

      {/* Profile preview modal */}
      <ProfilePreviewModal
        visible={profilePreview.visible}
        author={profilePreview.author}
        currentUserDid={user?.did}
        onClose={() => setProfilePreview((prev) => ({ ...prev, visible: false }))}
        onFollowPress={handleFollowPress}
        onBlockPress={handleBlockPress}
      />

      {/* Tutorial Tooltip */}
      {isTutorialActive && currentStepData && (
        <TutorialTooltip
          visible={isTutorialActive}
          title={currentStepData.title}
          description={currentStepData.description}
          tooltipPosition={{}}
          highlightArea={currentStepData.targetPosition}
          arrowDirection="up"
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingRight: Spacing.lg,
    borderBottomWidth: 1,
    minHeight: 56,
  },
  headerTabsContainer: {
    flex: 1,
    overflow: 'hidden',
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
  unreadDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.error,
  },
  tabContent: {
    flex: 1,
  },
  pageContainer: {
    flex: 1,
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
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.lg,
  },
});

export default HomeScreen;
