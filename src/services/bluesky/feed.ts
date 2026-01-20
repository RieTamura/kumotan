/**
 * Bluesky Feed Service
 * Handles timeline fetching and post operations
 */

import { Result } from '../../types/result';
import { TimelinePost } from '../../types/bluesky';
import { AppError, ErrorCode, mapToAppError } from '../../utils/errors';
import { PAGINATION } from '../../constants/config';
import { getAgent, refreshSession, hasActiveSession } from './auth';

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
    const posts: TimelinePost[] = response.data.feed.map((item) => ({
      uri: item.post.uri,
      text:
        (item.post.record as { text?: string })?.text ?? '',
      author: {
        handle: item.post.author.handle,
        displayName: item.post.author.displayName ?? item.post.author.handle,
        avatar: item.post.author.avatar,
      },
      createdAt: (item.post.record as { createdAt?: string })?.createdAt ?? '',
      likeCount: item.post.likeCount,
      repostCount: item.post.repostCount,
      replyCount: item.post.replyCount,
    }));

    if (__DEV__) {
      console.log(`Fetched ${posts.length} posts from timeline`);
    }

    return {
      success: true,
      data: {
        posts,
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
 * Create a post on Bluesky
 */
export async function createPost(
  text: string
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

    // Create post
    const response = await agent.post({
      text,
      createdAt: new Date().toISOString(),
    });

    if (__DEV__) {
      console.log('Post created successfully:', response.uri);
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
 * Get remaining API requests
 */
export function getRemainingRequests(): number {
  return rateLimiter.getRemainingRequests();
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
