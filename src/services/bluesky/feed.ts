/**
 * Bluesky Feed Service
 * Handles timeline fetching and post operations
 */

import * as FileSystem from 'expo-file-system/legacy';
import { Result } from '../../types/result';
import { TimelinePost, PostEmbed, PostImage, ReplyRestriction, ReplyRef } from '../../types/bluesky';
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
 * Image attachment for a post
 */
export interface PostImageAttachment {
  uri: string;
  mimeType: string;
  width: number;
  height: number;
  alt: string;
}

/**
 * Maximum number of images per post
 */
const MAX_IMAGES = 4;

/**
 * Maximum image size in bytes (1MB)
 */
const MAX_IMAGE_SIZE = 1_000_000;

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

interface RawEmbedView {
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
  record?: {
    record?: RawQuotedRecordView;
  } | RawQuotedRecordView;
  media?: {
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
  };
}

interface RawQuotedRecordView {
  uri?: string;
  cid?: string;
  author?: {
    handle?: string;
    displayName?: string;
    avatar?: string;
  };
  value?: {
    text?: string;
  };
}

function mapMediaEmbed(
  media?: {
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
  }
): Pick<PostEmbed, 'images' | 'external'> {
  if (!media?.$type) return {};

  if (media.$type === 'app.bsky.embed.images#view' && media.images) {
    return {
      images: media.images.map((img): PostImage => ({
        thumb: img.thumb ?? '',
        fullsize: img.fullsize ?? '',
        alt: img.alt ?? '',
        aspectRatio: img.aspectRatio,
      })),
    };
  }

  if (media.$type === 'app.bsky.embed.external#view' && media.external) {
    return {
      external: {
        uri: media.external.uri ?? '',
        title: media.external.title ?? '',
        description: media.external.description ?? '',
        thumb: media.external.thumb,
      },
    };
  }

  return {};
}

function extractQuotedRecord(rawEmbed: RawEmbedView): RawQuotedRecordView | undefined {
  if (rawEmbed.$type === 'app.bsky.embed.record#view') {
    return rawEmbed.record as RawQuotedRecordView | undefined;
  }

  if (rawEmbed.$type === 'app.bsky.embed.recordWithMedia#view') {
    return (rawEmbed.record as { record?: RawQuotedRecordView } | undefined)?.record;
  }

  return undefined;
}

export function extractPostEmbed(raw: unknown): PostEmbed | undefined {
  const rawEmbed = raw as RawEmbedView | undefined;
  if (!rawEmbed?.$type) return undefined;

  const embed: PostEmbed = { $type: rawEmbed.$type };

  if (rawEmbed.$type === 'app.bsky.embed.images#view' || rawEmbed.$type === 'app.bsky.embed.external#view') {
    const mediaEmbed = mapMediaEmbed(rawEmbed);
    if (mediaEmbed.images) {
      embed.images = mediaEmbed.images;
    }
    if (mediaEmbed.external) {
      embed.external = mediaEmbed.external;
    }
    return embed.images || embed.external ? embed : undefined;
  }

  if (rawEmbed.$type === 'app.bsky.embed.record#view' || rawEmbed.$type === 'app.bsky.embed.recordWithMedia#view') {
    const quotedRecord = extractQuotedRecord(rawEmbed);
    if (quotedRecord?.uri) {
      embed.quoted = {
        uri: quotedRecord.uri,
        cid: quotedRecord.cid,
        text: quotedRecord.value?.text,
        author: quotedRecord.author?.handle
          ? {
              handle: quotedRecord.author.handle,
              displayName: quotedRecord.author.displayName ?? quotedRecord.author.handle,
              avatar: quotedRecord.author.avatar,
            }
          : undefined,
      };
    }

    if (rawEmbed.$type === 'app.bsky.embed.recordWithMedia#view') {
      const mediaEmbed = mapMediaEmbed(rawEmbed.media);
      if (mediaEmbed.images) {
        embed.images = mediaEmbed.images;
      }
      if (mediaEmbed.external) {
        embed.external = mediaEmbed.external;
      }
    }

    return embed.quoted || embed.images || embed.external ? embed : undefined;
  }

  return undefined;
}

/**
 * Map a raw AT Protocol feed item to a TimelinePost.
 * Shared between getTimeline and getAuthorFeed to eliminate duplication.
 */
function mapPostItem(item: { post: any }): TimelinePost {
  const embed = extractPostEmbed(item.post.embed);
  const rawEmbed = item.post.embed as { $type?: string } | undefined;
  const viewer = item.post.viewer as { like?: string; repost?: string } | undefined;
  const threadgate = item.post.threadgate as { uri?: string; record?: Record<string, unknown> } | undefined;
  const replyRestriction = getReplyRestriction(threadgate);
  const rawLabels = item.post.labels as Array<{ val: string }> | undefined;
  const labels = rawLabels && rawLabels.length > 0
    ? rawLabels.map((l) => ({ val: l.val }))
    : undefined;
  const authorViewer = item.post.author.viewer as { following?: string; blocking?: string } | undefined;

  if (__DEV__) {
    const postText = (item.post.record as { text?: string })?.text ?? '';
    if (postText.includes('ラベル')) {
      console.log('[Feed Debug]', {
        text: postText.substring(0, 50),
        rawLabels: JSON.stringify(item.post.labels),
        hasEmbed: !!item.post.embed,
        embedType: rawEmbed?.$type,
        rawEmbed: JSON.stringify(item.post.embed)?.substring(0, 500),
      });
    }
  }

  return {
    uri: item.post.uri,
    cid: item.post.cid,
    text: (item.post.record as { text?: string })?.text ?? '',
    facets: (item.post.record as { facets?: unknown[] })?.facets as any,
    author: {
      did: item.post.author.did,
      handle: item.post.author.handle,
      displayName: item.post.author.displayName ?? item.post.author.handle,
      avatar: item.post.author.avatar,
      viewer: authorViewer
        ? { following: authorViewer.following, blocking: authorViewer.blocking }
        : undefined,
    },
    createdAt: (item.post.record as { createdAt?: string })?.createdAt ?? '',
    likeCount: item.post.likeCount,
    repostCount: item.post.repostCount,
    replyCount: item.post.replyCount,
    embed,
    viewer: viewer ? { like: viewer.like, repost: viewer.repost } : undefined,
    replyRestriction: replyRestriction !== 'none' ? replyRestriction : undefined,
    labels,
  };
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
    const posts: TimelinePost[] = response.data.feed.map(mapPostItem);

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
 * Build an image embed object for a post by uploading images to Bluesky.
 * Reads each image as base64, converts to Uint8Array, and uploads via agent.uploadBlob().
 */
export async function buildImageEmbed(
  images: PostImageAttachment[]
): Promise<Result<Record<string, unknown>, AppError>> {
  try {
    if (images.length === 0) {
      return {
        success: false,
        error: new AppError(ErrorCode.VALIDATION_ERROR, '画像が選択されていません'),
      };
    }

    if (images.length > MAX_IMAGES) {
      return {
        success: false,
        error: new AppError(ErrorCode.VALIDATION_ERROR, `画像は最大${MAX_IMAGES}枚までです`),
      };
    }

    const agent = getAgent();

    if (!hasActiveSession()) {
      const refreshResult = await refreshSession();
      if (!refreshResult.success) {
        return { success: false, error: refreshResult.error };
      }
    }

    const uploadedImages: Array<{
      alt: string;
      image: unknown;
      aspectRatio?: { width: number; height: number };
    }> = [];

    for (const img of images) {
      await rateLimiter.throttle();

      const base64 = await FileSystem.readAsStringAsync(img.uri, {
        encoding: 'base64',
      });

      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      if (bytes.length > MAX_IMAGE_SIZE) {
        return {
          success: false,
          error: new AppError(ErrorCode.VALIDATION_ERROR, '画像サイズが1MBを超えています。より小さい画像を使用してください。'),
        };
      }

      const response = await agent.uploadBlob(bytes, {
        encoding: img.mimeType,
      });

      uploadedImages.push({
        alt: img.alt,
        image: response.data.blob,
        aspectRatio: img.width > 0 && img.height > 0
          ? { width: img.width, height: img.height }
          : undefined,
      });
    }

    const embed: Record<string, unknown> = {
      $type: 'app.bsky.embed.images',
      images: uploadedImages,
    };

    if (__DEV__) {
      console.log(`Built image embed with ${uploadedImages.length} images`);
    }

    return { success: true, data: embed };
  } catch (error: unknown) {
    if (__DEV__) {
      console.error('Failed to build image embed:', error);
    }
    return {
      success: false,
      error: mapToAppError(error, '画像のアップロード'),
    };
  }
}

/**
 * Create a post on Bluesky
 */
export async function createPost(
  text: string,
  replySettings?: PostReplySettings,
  embed?: Record<string, unknown>,
  selfLabels?: string[],
  reply?: ReplyRef
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

    if (reply) {
      postRecord.reply = {
        root: { uri: reply.root.uri, cid: reply.root.cid },
        parent: { uri: reply.parent.uri, cid: reply.parent.cid },
      };
    }

    if (embed) {
      postRecord.embed = embed;
    }

    if (selfLabels && selfLabels.length > 0) {
      postRecord.labels = {
        $type: 'com.atproto.label.defs#selfLabels',
        values: selfLabels.map((val) => ({ val })),
      };
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
 * Repost a post on Bluesky
 */
export async function repostPost(
  uri: string,
  cid: string
): Promise<Result<{ uri: string }, AppError>> {
  try {
    const agent = getAgent();

    if (!hasActiveSession()) {
      const refreshResult = await refreshSession();
      if (!refreshResult.success) {
        return { success: false, error: refreshResult.error };
      }
    }

    await rateLimiter.throttle();

    const response = await agent.repost(uri, cid);

    if (__DEV__) {
      console.log('Post reposted successfully:', response.uri);
    }

    return { success: true, data: { uri: response.uri } };
  } catch (error: unknown) {
    if (__DEV__) {
      console.error('Failed to repost:', error);
    }

    return {
      success: false,
      error: mapToAppError(error, 'リポスト'),
    };
  }
}

/**
 * Unrepost a post on Bluesky
 */
export async function unrepostPost(
  repostUri: string
): Promise<Result<boolean, AppError>> {
  try {
    const agent = getAgent();

    if (!hasActiveSession()) {
      const refreshResult = await refreshSession();
      if (!refreshResult.success) {
        return { success: false, error: refreshResult.error };
      }
    }

    await rateLimiter.throttle();

    await agent.deleteRepost(repostUri);

    if (__DEV__) {
      console.log('Post unreposted successfully');
    }

    return { success: true, data: true };
  } catch (error: unknown) {
    if (__DEV__) {
      console.error('Failed to unrepost:', error);
    }

    return {
      success: false,
      error: mapToAppError(error, 'リポスト解除'),
    };
  }
}

/**
 * Delete a post on Bluesky
 */
export async function deletePost(
  uri: string
): Promise<Result<boolean, AppError>> {
  try {
    const agent = getAgent();

    if (!hasActiveSession()) {
      const refreshResult = await refreshSession();
      if (!refreshResult.success) {
        return { success: false, error: refreshResult.error };
      }
    }

    await rateLimiter.throttle();

    const rkey = extractRkey(uri);
    const repo = extractDid(uri);

    await agent.api.com.atproto.repo.deleteRecord({
      repo,
      collection: 'app.bsky.feed.post',
      rkey,
    });

    if (__DEV__) {
      console.log('Post deleted successfully:', uri);
    }

    return { success: true, data: true };
  } catch (error: unknown) {
    if (__DEV__) {
      console.error('Failed to delete post:', error);
    }

    return {
      success: false,
      error: mapToAppError(error, '投稿の削除'),
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
    const posts: TimelinePost[] = response.data.feed.map(mapPostItem);

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
