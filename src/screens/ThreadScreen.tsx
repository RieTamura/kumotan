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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { Colors, Spacing, FontSizes, BorderRadius } from '../constants/colors';
import { Loading } from '../components/common/Loading';
import { PostCard } from '../components/PostCard';
import { TimelinePost, PostEmbed, PostImage } from '../types/bluesky';
import { getAgent, hasActiveSession, refreshSession } from '../services/bluesky/auth';
import { RootStackParamList } from '../navigation/AppNavigator';

type ThreadScreenProps = NativeStackScreenProps<RootStackParamList, 'Thread'>;

interface ThreadData {
  post: TimelinePost;
  replies: TimelinePost[];
  parent?: TimelinePost;
}

/**
 * Extract embed from raw post data
 */
function extractEmbed(rawEmbed: unknown): PostEmbed | undefined {
  const embed = rawEmbed as {
    $type?: string;
    images?: Array<{
      thumb?: string;
      fullsize?: string;
      alt?: string;
      aspectRatio?: { width: number; height: number };
    }>;
    external?: {
      uri?: string;
      title?: string;
      description?: string;
      thumb?: string;
    };
  } | undefined;

  if (!embed?.$type) return undefined;

  if (embed.$type === 'app.bsky.embed.images#view' && embed.images) {
    return {
      $type: embed.$type,
      images: embed.images.map((img): PostImage => ({
        thumb: img.thumb ?? '',
        fullsize: img.fullsize ?? '',
        alt: img.alt ?? '',
        aspectRatio: img.aspectRatio,
      })),
    };
  }

  if (embed.$type === 'app.bsky.embed.external#view' && embed.external) {
    return {
      $type: embed.$type,
      external: {
        uri: embed.external.uri ?? '',
        title: embed.external.title ?? '',
        description: embed.external.description ?? '',
        thumb: embed.external.thumb,
      },
    };
  }

  return undefined;
}

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
}): TimelinePost {
  const record = post.record as { text?: string; createdAt?: string } | undefined;
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
    embed: extractEmbed(post.embed),
    viewer: post.viewer ? { like: post.viewer.like, repost: post.viewer.repost } : undefined,
  };
}

/**
 * ThreadScreen Component
 */
export function ThreadScreen({ route }: ThreadScreenProps): React.JSX.Element {
  const { postUri } = route.params;
  const { t } = useTranslation(['thread', 'common']);
  const [threadData, setThreadData] = useState<ThreadData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  // Fetch thread on mount
  useEffect(() => {
    fetchThread();
  }, [fetchThread]);

  /**
   * Render header (parent post + main post)
   */
  const renderHeader = useCallback(() => {
    if (!threadData) return null;

    return (
      <View>
        {/* Parent post if exists */}
        {threadData.parent && (
          <View style={styles.parentContainer}>
            <View style={styles.threadLine} />
            <PostCard post={threadData.parent} />
          </View>
        )}

        {/* Main post */}
        <View style={styles.mainPostContainer}>
          <PostCard post={threadData.post} />
        </View>

        {/* Replies header */}
        {threadData.replies.length > 0 && (
          <View style={styles.repliesHeader}>
            <Text style={styles.repliesHeaderText}>
              {t('thread:replies', { count: threadData.replies.length })}
            </Text>
          </View>
        )}
      </View>
    );
  }, [threadData, t]);

  /**
   * Render reply item
   */
  const renderReply = useCallback(({ item }: { item: TimelinePost }) => {
    return (
      <View style={styles.replyContainer}>
        <PostCard post={item} />
      </View>
    );
  }, []);

  /**
   * Key extractor
   */
  const keyExtractor = useCallback((item: TimelinePost) => item.uri, []);

  // Loading state
  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <Loading fullScreen message={t('thread:loading')} />
      </SafeAreaView>
    );
  }

  // Error state
  if (error) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // No data
  if (!threadData) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{t('thread:notFound')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
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
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
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
