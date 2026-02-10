/**
 * Bluesky Feed Service
 * Handles timeline fetching and post operations
 */

import { Result } from '../../types/result';
import { TimelinePost, PostEmbed, PostImage, ReplyRestriction } from '../../types/bluesky';
import { AppError, ErrorCode, mapToAppError } from '../../utils/errors';
import { PAGINATION } from '../../constants/config';
import { getAgent, refreshSession, hasActiveSession } from './auth';

/**
 * Reply permission rule types for threadgate
 */
export type ThreadgateAllowRule =
  | 'mention'    // Users mentioned in the post
  | 'follower'   // Users who follow you
  | 'following'; // Users you follow

/**
 * Post reply and quote settings
 */
export interface PostReplySettings {
  /** true = anyone can reply (default), false = apply allowRules */
  allowAll: boolean;
  /** Rules applied when allowAll is false (empty array = no replies) */
  allowRules: ThreadgateAllowRule[];
  /** Whether quoting is allowed (default: true) */
  allowQuote: boolean;
}

export const DEFAULT_REPLY_SETTINGS: PostReplySettings = {
  allowAll: true,
  allowRules: [],
  allowQuote: true,
};

/**
 * Rate limiter for Bluesky API
 */
class RateLimiter {
  private requestTimes: number[] = [];
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private readonly minIntervalMs: number;

  constructor(
    maxRequests: number = 3000,
    windowMs: number = 5 * 60 * 1000, // 5 minutes
    minIntervalMs: number = 100
  ) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.minIntervalMs = minIntervalMs;
  }

  async throttle(): Promise<void> {
    const now = Date.now();

    // Remove old requests outside the window
    this.requestTimes = this.requestTimes.filter(
      (time) => now - time < this.windowMs
    );

    // Check if we've hit the rate limit
    if (this.requestTimes.length >= this.maxRequests) {
      const oldestRequest = this.requestTimes[0];
      const waitTime = this.windowMs - (now - oldestRequest) + 1000;
      if (__DEV__) {
        console.log(`Rate limit reached. Waiting ${waitTime}ms`);
      }
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      return this.throttle();
    }

    // Ensure minimum interval between requests
    const lastRequest = this.requestTimes[this.requestTimes.length - 1];
    if (lastRequest && now - lastRequest < this.minIntervalMs) {
      const waitTime = this.minIntervalMs - (now - lastRequest);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.requestTimes.push(Date.now());
  }

  getRemainingRequests(): number {
    const now = Date.now();
    this.requestTimes = this.requestTimes.filter(
      (time) => now - time < this.windowMs
    );
    return this.maxRequests - this.requestTimes.length;
  }
}

// Global rate limiter instance
const rateLimiter = new RateLimiter();

/**
 * Determine reply restriction level from threadgate data.
 * Note: PostView does not include postgate, so we determine the level from threadgate alone.
 *   - 'disabled': threadgate exists with empty allow array (no one can reply)
 *   - 'restricted': threadgate exists with some allow rules (limited replies)
 *   - 'none': no threadgate
 */
function getReplyRestriction(
  threadgate?: { uri?: string; record?: Record<string, unknown> },
): ReplyRestriction {
  if (!threadgate?.uri) return 'none';

  const record = threadgate.record as { allow?: unknown[] } | undefined;
  const hasNoReplyRules = !record?.allow || record.allow.length === 0;

  return hasNoReplyRules ? 'disabled' : 'restricted';
}

/**
 * Fetch timeline posts from Bluesky
 */
export async function getTimeline(
  limit: number = PAGINATION.FEED_LIMIT,
  cursor?: string
): Promise<Result<{ posts: TimelinePost[]; cursor?: string }, AppError>> {
  try {
    const agent = getAgent();

    // Check if we have an active session
    if (!hasActiveSession()) {
      const refreshResult = await refreshSession();
      if (!refreshResult.success) {
        return { success: false, error: refreshResult.error };
      }
    }

    // Apply rate limiting
    await rateLimiter.throttle();

    // Fetch timeline
    const response = await agent.getTimeline({
      limit,
      cursor,
    });

    // Map response to our TimelinePost type
    const posts: TimelinePost[] = response.data.feed.map((item) => {
      // Extract embed information if present
      let embed: PostEmbed | undefined;
      const rawEmbed = item.post.embed as {
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

      if (rawEmbed?.$type) {
        if (rawEmbed.$type === 'app.bsky.embed.images#view' && rawEmbed.images) {
          embed = {
            $type: rawEmbed.$type,
            images: rawEmbed.images.map((img): PostImage => ({
              thumb: img.thumb ?? '',
              fullsize: img.fullsize ?? '',
              alt: img.alt ?? '',
              aspectRatio: img.aspectRatio,
            })),
          };
        } else if (rawEmbed.$type === 'app.bsky.embed.external#view' && rawEmbed.external) {
          embed = {
            $type: rawEmbed.$type,
            external: {
              uri: rawEmbed.external.uri ?? '',
              title: rawEmbed.external.title ?? '',
              description: rawEmbed.external.description ?? '',
              thumb: rawEmbed.external.thumb,
            },
          };
        }
      }

      // Extract viewer state
      const viewer = item.post.viewer as { like?: string; repost?: string } | undefined;

      // Extract threadgate info for reply restriction icon
      const threadgate = item.post.threadgate as { uri?: string; record?: Record<string, unknown> } | undefined;
      const replyRestriction = getReplyRestriction(threadgate);

      return {
        uri: item.post.uri,
        cid: item.post.cid,
        text: (item.post.record as { text?: string })?.text ?? '',
        author: {
          handle: item.post.author.handle,
          displayName: item.post.author.displayName ?? item.post.author.handle,
          avatar: item.post.author.avatar,
        },
        createdAt: (item.post.record as { createdAt?: string })?.createdAt ?? '',
        likeCount: item.post.likeCount,
        repostCount: item.post.repostCount,
        replyCount: item.post.replyCount,
        embed,
        viewer: viewer ? { like: viewer.like, repost: viewer.repost } : undefined,
        replyRestriction: replyRestriction !== 'none' ? replyRestriction : undefined,
      };
    });

    // Remove duplicates based on URI (just in case API returns duplicates)
    const uniquePosts = posts.filter((post, index, self) =>
      index === self.findIndex((p) => p.uri === post.uri)
    );

    if (__DEV__) {
      console.log(`Fetched ${uniquePosts.length} posts from timeline`);
      if (posts.length !== uniquePosts.length) {
        console.warn(`Removed ${posts.length - uniquePosts.length} duplicate posts`);
      }
    }

    return {
      success: true,
      data: {
        posts: uniquePosts,
        cursor: response.data.cursor,
      },
    };
  } catch (error: unknown) {
    if (__DEV__) {
      console.error('Failed to fetch timeline:', error);
    }

    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';

    // Handle specific error cases
    if (errorMessage.includes('ExpiredToken') || errorMessage.includes('401')) {
      // Try to refresh session and retry
      const refreshResult = await refreshSession();
      if (refreshResult.success) {
        // Retry the request
        return getTimeline(limit, cursor);
      }
      return { success: false, error: refreshResult.error };
    }

    return {
      success: false,
      error: mapToAppError(error, 'タイムラインの取得'),
    };
  }
}

/**
 * Facet interface for rich text features
 */
interface Facet {
  index: {
    byteStart: number;
    byteEnd: number;
  };
  features: Array<{
    $type: string;
    tag?: string;
  }>;
}

/**
 * Get byte length of a string (UTF-8)
 */
function getByteLength(str: string): number {
  return new TextEncoder().encode(str).length;
}

/**
 * Detect hashtags in text and generate facets
 */
function detectHashtagFacets(text: string): Facet[] {
  const facets: Facet[] = [];
  // Match hashtags: # followed by word characters (including Unicode)
  const hashtagRegex = /#[\p{L}\p{N}_]+/gu;
  let match;

  while ((match = hashtagRegex.exec(text)) !== null) {
    const hashtag = match[0];
    const tag = hashtag.slice(1); // Remove # prefix
    const startIndex = match.index;

    // Calculate byte positions
    const textBefore = text.slice(0, startIndex);
    const byteStart = getByteLength(textBefore);
    const byteEnd = byteStart + getByteLength(hashtag);

    facets.push({
      index: {
        byteStart,
        byteEnd,
      },
      features: [
        {
          $type: 'app.bsky.richtext.facet#tag',
          tag,
        },
      ],
    });
  }

  return facets;
}

/**
 * Extract rkey from an AT-URI (e.g., "at://did:plc:xxx/app.bsky.feed.post/rkey" -> "rkey")
 */
function extractRkey(uri: string): string {
  return uri.split('/').pop() ?? '';
}

/**
 * Extract DID from an AT-URI (e.g., "at://did:plc:xxx/app.bsky.feed.post/rkey" -> "did:plc:xxx")
 */
function extractDid(uri: string): string {
  return uri.replace('at://', '').split('/')[0];
}

/**
 * Map ThreadgateAllowRule to AT Protocol threadgate rule objects
 */
function mapAllowRules(rules: ThreadgateAllowRule[]): Array<{ $type: string }> {
  return rules.map((rule) => {
    switch (rule) {
      case 'mention':
        return { $type: 'app.bsky.feed.threadgate#mentionRule' };
      case 'follower':
        return { $type: 'app.bsky.feed.threadgate#followerRule' };
      case 'following':
        return { $type: 'app.bsky.feed.threadgate#followingRule' };
    }
  });
}

/**
 * Create threadgate record for a post (controls who can reply)
 */
async function createThreadgate(
  postUri: string,
  allowRules: ThreadgateAllowRule[]
): Promise<void> {
  try {
    const agent = getAgent();
    const rkey = extractRkey(postUri);
    const repo = extractDid(postUri);
    const allow = mapAllowRules(allowRules);

    await agent.app.bsky.feed.threadgate.create(
      { repo, rkey },
      {
        post: postUri,
        allow,
        createdAt: new Date().toISOString(),
      }
    );

    if (__DEV__) {
      console.log('Threadgate created successfully for:', postUri);
    }
  } catch (error: unknown) {
    // Threadgate creation failure should not block the post
    if (__DEV__) {
      console.warn('Failed to create threadgate:', error);
    }
  }
}

/**
 * Create postgate record for a post (controls quoting)
 */
async function createPostgate(postUri: string): Promise<void> {
  try {
    const agent = getAgent();
    const rkey = extractRkey(postUri);
    const repo = extractDid(postUri);

    await agent.app.bsky.feed.postgate.create(
      { repo, rkey },
      {
        post: postUri,
        createdAt: new Date().toISOString(),
        embeddingRules: [{ $type: 'app.bsky.feed.postgate#disableRule' }],
      }
    );

    if (__DEV__) {
      console.log('Postgate created successfully for:', postUri);
    }
  } catch (error: unknown) {
    // Postgate creation failure should not block the post
    if (__DEV__) {
      console.warn('Failed to create postgate:', error);
    }
  }
}

/**
 * Create a post on Bluesky
 */
export async function createPost(
  text: string,
  replySettings?: PostReplySettings
): Promise<Result<{ uri: string; cid: string }, AppError>> {
  try {
    const agent = getAgent();

    // Check if we have an active session
    if (!hasActiveSession()) {
      const refreshResult = await refreshSession();
      if (!refreshResult.success) {
        return { success: false, error: refreshResult.error };
      }
    }

    // Apply rate limiting
    await rateLimiter.throttle();

    // Detect hashtags and generate facets
    const facets = detectHashtagFacets(text);

    // Create post with facets for hashtag links
    const postRecord: Record<string, unknown> = {
      text,
      createdAt: new Date().toISOString(),
    };

    if (facets.length > 0) {
      postRecord.facets = facets;
    }

    const response = await agent.post(postRecord);

    if (__DEV__) {
      console.log('Post created successfully:', response.uri);
      if (facets.length > 0) {
        console.log(`Added ${facets.length} hashtag facets`);
      }
    }

    // Create threadgate if reply restrictions are set
    if (replySettings && !replySettings.allowAll) {
      await createThreadgate(response.uri, replySettings.allowRules);
    }

    // Create postgate if quoting is disabled
    if (replySettings && !replySettings.allowQuote) {
      await createPostgate(response.uri);
    }

    return {
      success: true,
      data: {
        uri: response.uri,
        cid: response.cid,
      },
    };
  } catch (error: unknown) {
    if (__DEV__) {
      console.error('Failed to create post:', error);
    }

    return {
      success: false,
      error: mapToAppError(error, '投稿の作成'),
    };
  }
}

/**
 * Share learning progress on Bluesky
 */
export async function shareProgress(
  wordCount: number
): Promise<Result<boolean, AppError>> {
  const text = `今日は${wordCount}個の単語を学習しました！ #英語学習 #くもたん`;

  const result = await createPost(text);

  if (!result.success) {
    return result;
  }

  return { success: true, data: true };
}

/**
 * Like a post on Bluesky
 */
export async function likePost(
  uri: string,
  cid: string
): Promise<Result<{ uri: string }, AppError>> {
  try {
    const agent = getAgent();

    // Check if we have an active session
    if (!hasActiveSession()) {
      const refreshResult = await refreshSession();
      if (!refreshResult.success) {
        return { success: false, error: refreshResult.error };
      }
    }

    // Apply rate limiting
    await rateLimiter.throttle();

    // Like the post
    const response = await agent.like(uri, cid);

    if (__DEV__) {
      console.log('Post liked successfully:', response.uri);
    }

    return {
      success: true,
      data: {
        uri: response.uri,
      },
    };
  } catch (error: unknown) {
    if (__DEV__) {
      console.error('Failed to like post:', error);
    }

    return {
      success: false,
      error: mapToAppError(error, 'いいね'),
    };
  }
}

/**
 * Unlike a post on Bluesky
 */
export async function unlikePost(
  likeUri: string
): Promise<Result<boolean, AppError>> {
  try {
    const agent = getAgent();

    // Check if we have an active session
    if (!hasActiveSession()) {
      const refreshResult = await refreshSession();
      if (!refreshResult.success) {
        return { success: false, error: refreshResult.error };
      }
    }

    // Apply rate limiting
    await rateLimiter.throttle();

    // Unlike the post
    await agent.deleteLike(likeUri);

    if (__DEV__) {
      console.log('Post unliked successfully');
    }

    return {
      success: true,
      data: true,
    };
  } catch (error: unknown) {
    if (__DEV__) {
      console.error('Failed to unlike post:', error);
    }

    return {
      success: false,
      error: mapToAppError(error, 'いいね解除'),
    };
  }
}

/**
 * Get remaining API requests
 */
export function getRemainingRequests(): number {
  return rateLimiter.getRemainingRequests();
}

/**
 * Author feed filter type
 */
export type AuthorFeedFilter =
  | 'posts_no_replies'
  | 'posts_with_media'
  | 'posts_and_author_threads'
  | 'posts_with_replies';

/**
 * Fetch author's posts from Bluesky
 */
export async function getAuthorFeed(
  actor: string,
  limit: number = PAGINATION.FEED_LIMIT,
  cursor?: string,
  filter: AuthorFeedFilter = 'posts_no_replies'
): Promise<Result<{ posts: TimelinePost[]; cursor?: string }, AppError>> {
  try {
    const agent = getAgent();

    // Check if we have an active session
    if (!hasActiveSession()) {
      const refreshResult = await refreshSession();
      if (!refreshResult.success) {
        return { success: false, error: refreshResult.error };
      }
    }

    // Apply rate limiting
    await rateLimiter.throttle();

    // Fetch author feed
    const response = await agent.getAuthorFeed({
      actor,
      limit,
      cursor,
      filter,
    });

    // Map response to our TimelinePost type
    const posts: TimelinePost[] = response.data.feed.map((item) => {
      // Extract embed information if present
      let embed: PostEmbed | undefined;
      const rawEmbed = item.post.embed as {
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

      if (rawEmbed?.$type) {
        if (rawEmbed.$type === 'app.bsky.embed.images#view' && rawEmbed.images) {
          embed = {
            $type: rawEmbed.$type,
            images: rawEmbed.images.map((img): PostImage => ({
              thumb: img.thumb ?? '',
              fullsize: img.fullsize ?? '',
              alt: img.alt ?? '',
              aspectRatio: img.aspectRatio,
            })),
          };
        } else if (rawEmbed.$type === 'app.bsky.embed.external#view' && rawEmbed.external) {
          embed = {
            $type: rawEmbed.$type,
            external: {
              uri: rawEmbed.external.uri ?? '',
              title: rawEmbed.external.title ?? '',
              description: rawEmbed.external.description ?? '',
              thumb: rawEmbed.external.thumb,
            },
          };
        }
      }

      // Extract viewer state
      const viewer = item.post.viewer as { like?: string; repost?: string } | undefined;

      // Extract threadgate info for reply restriction icon
      const threadgate = item.post.threadgate as { uri?: string; record?: Record<string, unknown> } | undefined;
      const replyRestriction = getReplyRestriction(threadgate);

      return {
        uri: item.post.uri,
        cid: item.post.cid,
        text: (item.post.record as { text?: string })?.text ?? '',
        author: {
          handle: item.post.author.handle,
          displayName: item.post.author.displayName ?? item.post.author.handle,
          avatar: item.post.author.avatar,
        },
        createdAt: (item.post.record as { createdAt?: string })?.createdAt ?? '',
        likeCount: item.post.likeCount,
        repostCount: item.post.repostCount,
        replyCount: item.post.replyCount,
        embed,
        viewer: viewer ? { like: viewer.like, repost: viewer.repost } : undefined,
        replyRestriction: replyRestriction !== 'none' ? replyRestriction : undefined,
      };
    });

    // Remove duplicates based on URI
    const uniquePosts = posts.filter((post, index, self) =>
      index === self.findIndex((p) => p.uri === post.uri)
    );

    if (__DEV__) {
      console.log(`Fetched ${uniquePosts.length} posts from author feed`);
    }

    return {
      success: true,
      data: {
        posts: uniquePosts,
        cursor: response.data.cursor,
      },
    };
  } catch (error: unknown) {
    if (__DEV__) {
      console.error('Failed to fetch author feed:', error);
    }

    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';

    // Handle specific error cases
    if (errorMessage.includes('ExpiredToken') || errorMessage.includes('401')) {
      const refreshResult = await refreshSession();
      if (refreshResult.success) {
        return getAuthorFeed(actor, limit, cursor, filter);
      }
      return { success: false, error: refreshResult.error };
    }

    return {
      success: false,
      error: mapToAppError(error, 'ユーザー投稿の取得'),
    };
  }
}

/**
 * Translation function type for formatRelativeTime
 */
type TranslationFunction = (key: string, options?: { count: number }) => string;

/**
 * Format relative time for display
 * @param dateString - ISO date string
 * @param t - Translation function from i18next
 * @param locale - Locale for date formatting (default: 'ja-JP')
 */
export function formatRelativeTime(
  dateString: string,
  t?: TranslationFunction,
  locale: string = 'ja-JP'
): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  // Fallback to Japanese if no translation function provided
  if (!t) {
    if (diffSeconds < 60) {
      return 'たった今';
    } else if (diffMinutes < 60) {
      return `${diffMinutes}分前`;
    } else if (diffHours < 24) {
      return `${diffHours}時間前`;
    } else if (diffDays < 7) {
      return `${diffDays}日前`;
    } else {
      return date.toLocaleDateString('ja-JP', {
        month: 'short',
        day: 'numeric',
      });
    }
  }

  if (diffSeconds < 60) {
    return t('common:time.justNow');
  } else if (diffMinutes < 60) {
    return t('common:time.minutesAgo', { count: diffMinutes });
  } else if (diffHours < 24) {
    return t('common:time.hoursAgo', { count: diffHours });
  } else if (diffDays < 7) {
    return t('common:time.daysAgo', { count: diffDays });
  } else {
    // Format as date using the provided locale
    return date.toLocaleDateString(locale === 'en' ? 'en-US' : 'ja-JP', {
      month: 'short',
      day: 'numeric',
    });
  }
}
