/**
 * Thread Screen
 * Displays a post and its replies in a thread view
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { Colors, Spacing, FontSizes, BorderRadius } from '../constants/colors';
import { useTheme } from '../hooks/useTheme';
import { Loading } from '../components/common/Loading';
import { PostCard } from '../components/PostCard';
import { PostCreationModal } from '../components/PostCreationModal';
import { WordPopup } from '../components/WordPopup';
import { TimelinePost } from '../types/bluesky';
import { getAgent, hasActiveSession, refreshSession } from '../services/bluesky/auth';
import { likePost, unlikePost, repostPost, unrepostPost, extractPostEmbed } from '../services/bluesky/feed';
import { ReplyToInfo, QuoteToInfo } from '../hooks/usePostCreation';
import { addWord } from '../services/database/words';
import { RootStackParamList } from '../navigation/AppNavigator';

type ThreadScreenProps = NativeStackScreenProps<RootStackParamList, 'Thread'>;

interface ThreadData {
  post: TimelinePost;
  replies: TimelinePost[];
  parent?: TimelinePost;
}

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
 * Convert raw post to TimelinePost
 */
function toTimelinePost(post: {
  uri: string;
  cid: string;
  author: { handle: string; displayName?: string; avatar?: string };
  record: unknown;
  likeCount?: number;
  repostCount?: number;
  replyCount?: number;
  embed?: unknown;
  viewer?: { like?: string; repost?: string };
  labels?: Array<{ val: string }>;
}): TimelinePost {
  const record = post.record as { text?: string; createdAt?: string } | undefined;
  const rawLabels = post.labels;
  const labels = rawLabels && rawLabels.length > 0
    ? rawLabels.map((l) => ({ val: l.val }))
    : undefined;
  return {
    uri: post.uri,
    cid: post.cid,
    text: record?.text ?? '',
    author: {
      handle: post.author.handle,
      displayName: post.author.displayName ?? post.author.handle,
      avatar: post.author.avatar,
    },
    createdAt: record?.createdAt ?? '',
    likeCount: post.likeCount,
    repostCount: post.repostCount,
    replyCount: post.replyCount,
    embed: extractPostEmbed(post.embed),
    viewer: post.viewer ? { like: post.viewer.like, repost: post.viewer.repost } : undefined,
    labels,
  };
}

/**
 * ThreadScreen Component
 */
export function ThreadScreen({ route, navigation }: ThreadScreenProps): React.JSX.Element {
  const { postUri } = route.params;
  const { t } = useTranslation(['thread', 'common']);
  const { t: tc } = useTranslation('common');
  const { t: th } = useTranslation('home');
  const [threadData, setThreadData] = useState<ThreadData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { colors } = useTheme();

  // Word popup state
  const [wordPopup, setWordPopup] = useState<WordPopupState>(initialWordPopupState);

  // Post creation modal state
  const [isPostModalVisible, setIsPostModalVisible] = useState(false);
  const [replyTarget, setReplyTarget] = useState<ReplyToInfo | null>(null);
  const [quoteTarget, setQuoteTarget] = useState<QuoteToInfo | null>(null);

  /**
   * Fetch thread data
   */
  const fetchThread = useCallback(async (showLoadingIndicator = true) => {
    try {
      if (showLoadingIndicator) {
        setIsLoading(true);
      }
      setError(null);

      // Ensure session is valid
      if (!hasActiveSession()) {
        const refreshResult = await refreshSession();
        if (!refreshResult.success) {
          setError(t('common:errors.sessionExpired'));
          return;
        }
      }

      const agent = getAgent();
      const response = await agent.getPostThread({
        uri: postUri,
        depth: 10,
      });

      const thread = response.data.thread;

      if (thread.$type !== 'app.bsky.feed.defs#threadViewPost') {
        setError(t('thread:notFound'));
        return;
      }

      const threadView = thread as {
        post: {
          uri: string;
          cid: string;
          author: { handle: string; displayName?: string; avatar?: string };
          record: unknown;
          likeCount?: number;
          repostCount?: number;
          replyCount?: number;
          embed?: unknown;
          viewer?: { like?: string; repost?: string };
        };
        parent?: {
          $type?: string;
          post?: {
            uri: string;
            cid: string;
            author: { handle: string; displayName?: string; avatar?: string };
            record: unknown;
            likeCount?: number;
            repostCount?: number;
            replyCount?: number;
            embed?: unknown;
            viewer?: { like?: string; repost?: string };
          };
        };
        replies?: Array<{
          $type?: string;
          post?: {
            uri: string;
            cid: string;
            author: { handle: string; displayName?: string; avatar?: string };
            record: unknown;
            likeCount?: number;
            repostCount?: number;
            replyCount?: number;
            embed?: unknown;
            viewer?: { like?: string; repost?: string };
          };
        }>;
      };

      // Extract main post
      const mainPost = toTimelinePost(threadView.post);

      // Extract parent if exists
      let parent: TimelinePost | undefined;
      if (threadView.parent?.$type === 'app.bsky.feed.defs#threadViewPost' && threadView.parent.post) {
        parent = toTimelinePost(threadView.parent.post);
      }

      // Extract replies
      const replies: TimelinePost[] = [];
      if (threadView.replies) {
        for (const reply of threadView.replies) {
          if (reply.$type === 'app.bsky.feed.defs#threadViewPost' && reply.post) {
            replies.push(toTimelinePost(reply.post));
          }
        }
      }

      setThreadData({
        post: mainPost,
        replies,
        parent,
      });
    } catch (err) {
      if (__DEV__) {
        console.error('Failed to fetch thread:', err);
      }
      setError(t('thread:loadError'));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [postUri, t]);

  /**
   * Handle refresh
   */
  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchThread(false);
  }, [fetchThread]);

  /**
   * Handle word selection from a post
   */
  const handleWordSelect = useCallback(
    (word: string, uri: string, postText: string) => {
      setWordPopup({
        visible: true,
        word: word.toLowerCase(),
        isSentenceMode: false,
        postUri: uri,
        postText,
      });
    },
    []
  );

  /**
   * Handle sentence selection from a post
   */
  const handleSentenceSelect = useCallback(
    (sentence: string, uri: string, postText: string) => {
      setWordPopup({
        visible: true,
        word: sentence,
        isSentenceMode: true,
        postUri: uri,
        postText,
      });
    },
    []
  );

  /**
   * Close word popup
   */
  const closeWordPopup = useCallback(() => {
    setWordPopup(prev => ({ ...prev, visible: false }));
    setTimeout(() => {
      setWordPopup(initialWordPopupState);
    }, 100);
  }, []);

  /**
   * Handle post press - navigate to thread
   */
  const handlePostPress = useCallback(
    (targetPostUri: string) => {
      navigation.navigate('Thread', { postUri: targetPostUri });
    },
    [navigation]
  );

  /**
   * Handle add word to vocabulary
   */
  const handleAddWord = useCallback(
    async (
      word: string,
      japanese: string | null,
      definition: string | null,
      uri: string | null,
      postText: string | null
    ) => {
      try {
        const result = await addWord(
          word,
          japanese ?? undefined,
          definition ?? undefined,
          uri ?? undefined,
          postText ?? undefined
        );

        if (result.success) {
          Alert.alert(tc('status.success'), th('wordAdded'));
        } else {
          Alert.alert(tc('status.error'), result.error.message);
        }
      } catch (err) {
        Alert.alert(tc('status.error'), th('wordAddError'));
        if (__DEV__) {
          console.error('Failed to add word:', err);
        }
      }
    },
    [tc, th]
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
      } catch (err) {
        if (__DEV__) {
          console.error('Like operation failed:', err);
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
      } catch (err) {
        if (__DEV__) {
          console.error('Repost operation failed:', err);
        }
      }
    },
    []
  );

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

  // Fetch thread on mount
  useEffect(() => {
    fetchThread();
  }, [fetchThread]);

  /**
   * Render header (parent post + main post)
   */
  const renderHeader = useCallback(() => {
    if (!threadData) return null;

    const shouldClearParentSelection = !wordPopup.visible && wordPopup.postUri === threadData.parent?.uri && wordPopup.postUri !== '';
    const shouldClearMainSelection = !wordPopup.visible && wordPopup.postUri === threadData.post.uri && wordPopup.postUri !== '';

    return (
      <View>
        {/* Parent post if exists */}
        {threadData.parent && (
          <View style={styles.parentContainer}>
            <View style={[styles.threadLine, { backgroundColor: colors.border }]} />
            <PostCard
              post={threadData.parent}
              onWordSelect={handleWordSelect}
              onSentenceSelect={handleSentenceSelect}
              onPostPress={handlePostPress}
              onLikePress={handleLikePress}
              onReplyPress={handleReplyPress}
              onRepostPress={handleRepostPress}
              onQuotePress={handleQuotePress}
              clearSelection={shouldClearParentSelection}
            />
          </View>
        )}

        {/* Main post */}
        <View style={[styles.mainPostContainer, { borderBottomColor: colors.border }]}>
          <PostCard
            post={threadData.post}
            onWordSelect={handleWordSelect}
            onSentenceSelect={handleSentenceSelect}
            onPostPress={handlePostPress}
            onLikePress={handleLikePress}
            onReplyPress={handleReplyPress}
            onRepostPress={handleRepostPress}
            onQuotePress={handleQuotePress}
            clearSelection={shouldClearMainSelection}
          />
        </View>

        {/* Replies header */}
        {threadData.replies.length > 0 && (
          <View style={[styles.repliesHeader, { backgroundColor: colors.backgroundSecondary }]}>
            <Text style={[styles.repliesHeaderText, { color: colors.textSecondary }]}>
              {t('thread:replies', { count: threadData.replies.length })}
            </Text>
          </View>
        )}
      </View>
    );
  }, [threadData, t, handleWordSelect, handleSentenceSelect, handlePostPress, handleLikePress, handleReplyPress, handleRepostPress, handleQuotePress, wordPopup.visible, wordPopup.postUri]);

  /**
   * Render reply item
   */
  const renderReply = useCallback(({ item }: { item: TimelinePost }) => {
    const shouldClearSelection = !wordPopup.visible && wordPopup.postUri === item.uri && wordPopup.postUri !== '';
    return (
      <View style={[styles.replyContainer, { borderBottomColor: colors.border }]}>
        <PostCard
          post={item}
          onWordSelect={handleWordSelect}
          onSentenceSelect={handleSentenceSelect}
          onPostPress={handlePostPress}
          onLikePress={handleLikePress}
          onReplyPress={handleReplyPress}
          onRepostPress={handleRepostPress}
          onQuotePress={handleQuotePress}
          clearSelection={shouldClearSelection}
        />
      </View>
    );
  }, [handleWordSelect, handleSentenceSelect, handlePostPress, handleLikePress, handleReplyPress, handleRepostPress, handleQuotePress, wordPopup.visible, wordPopup.postUri]);

  /**
   * Key extractor
   */
  const keyExtractor = useCallback((item: TimelinePost) => item.uri, []);

  // Loading state
  if (isLoading) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['bottom']}>
        <Loading fullScreen message={t('thread:loading')} />
      </SafeAreaView>
    );
  }

  // Error state
  if (error) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['bottom']}>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: colors.textSecondary }]}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // No data
  if (!threadData) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['bottom']}>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: colors.textSecondary }]}>{t('thread:notFound')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['bottom']}>
      <FlatList
        data={threadData.replies}
        renderItem={renderReply}
        keyExtractor={keyExtractor}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      />

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
          handleRefresh();
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: Spacing.lg,
  },
  parentContainer: {
    position: 'relative',
  },
  threadLine: {
    position: 'absolute',
    left: Spacing.md + 21, // Avatar center position
    top: Spacing.lg + 42, // Below avatar
    bottom: 0,
    width: 2,
    backgroundColor: Colors.border,
  },
  mainPostContainer: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  repliesHeader: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.backgroundSecondary,
  },
  repliesHeaderText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  replyContainer: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xxl,
  },
  errorText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});

export default ThreadScreen;
