/**
 * Bluesky Social Graph Service
 * Handles follow and block operations using the AT Protocol.
 * Follows the same pattern as likePost/unlikePost in feed.ts.
 */

import { Result } from '../../types/result';
import { AppError, ErrorCode, mapToAppError } from '../../utils/errors';
import { getAgent, hasActiveSession, refreshSession, getCurrentDid } from './auth';
import { BlueskyProfile } from '../../types/bluesky';

/**
 * Minimal rate limiter for social graph operations.
 * Social actions are far less frequent than feed reads,
 * so a simple minimum interval between requests is sufficient.
 */
class SocialRateLimiter {
  private lastRequestTime = 0;
  private readonly minIntervalMs: number;

  constructor(minIntervalMs = 200) {
    this.minIntervalMs = minIntervalMs;
  }

  async throttle(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.minIntervalMs) {
      await new Promise((resolve) =>
        setTimeout(resolve, this.minIntervalMs - elapsed)
      );
    }
    this.lastRequestTime = Date.now();
  }
}

const rateLimiter = new SocialRateLimiter();

/**
 * Ensure an active session exists, refreshing if necessary.
 */
async function ensureSession(): Promise<Result<void, AppError>> {
  if (!hasActiveSession()) {
    const result = await refreshSession();
    if (!result.success) return result;
  }
  return { success: true, data: undefined };
}

/**
 * Follow a user by their DID.
 * Returns the URI of the created follow record on success.
 */
export async function followUser(
  did: string
): Promise<Result<{ uri: string }, AppError>> {
  try {
    const session = await ensureSession();
    if (!session.success) return session;

    await rateLimiter.throttle();

    const agent = getAgent();
    const response = await agent.follow(did);

    if (__DEV__) {
      console.log('Followed user successfully:', did, 'record URI:', response.uri);
    }

    return { success: true, data: { uri: response.uri } };
  } catch (error: unknown) {
    if (__DEV__) {
      console.error('Failed to follow user:', error);
    }
    return { success: false, error: mapToAppError(error, 'フォロー') };
  }
}

/**
 * Unfollow a user by deleting the follow record.
 * followUri: the AT-URI of the follow record to delete.
 */
export async function unfollowUser(
  followUri: string
): Promise<Result<boolean, AppError>> {
  try {
    const session = await ensureSession();
    if (!session.success) return session;

    await rateLimiter.throttle();

    const agent = getAgent();
    await agent.deleteFollow(followUri);

    if (__DEV__) {
      console.log('Unfollowed user successfully, deleted:', followUri);
    }

    return { success: true, data: true };
  } catch (error: unknown) {
    if (__DEV__) {
      console.error('Failed to unfollow user:', error);
    }
    return { success: false, error: mapToAppError(error, 'フォロー解除') };
  }
}

/**
 * Block a user by their DID.
 * Returns the URI of the created block record on success.
 */
export async function blockUser(
  did: string
): Promise<Result<{ uri: string }, AppError>> {
  try {
    const session = await ensureSession();
    if (!session.success) return session;

    const repoDid = await getCurrentDid();
    if (!repoDid) {
      return {
        success: false,
        error: new AppError(ErrorCode.AUTH_FAILED, 'ユーザーDIDが取得できません'),
      };
    }

    await rateLimiter.throttle();

    const agent = getAgent();
    const response = await agent.app.bsky.graph.block.create(
      { repo: repoDid },
      {
        subject: did,
        createdAt: new Date().toISOString(),
      }
    );

    if (__DEV__) {
      console.log('Blocked user successfully:', did, 'record URI:', response.uri);
    }

    return { success: true, data: { uri: response.uri } };
  } catch (error: unknown) {
    if (__DEV__) {
      console.error('Failed to block user:', error);
    }
    return { success: false, error: mapToAppError(error, 'ブロック') };
  }
}

/**
 * Unblock a user by deleting the block record.
 * blockUri: the AT-URI of the block record (e.g. at://did:plc:xxx/app.bsky.graph.block/rkey)
 */
export async function unblockUser(
  blockUri: string
): Promise<Result<boolean, AppError>> {
  try {
    const session = await ensureSession();
    if (!session.success) return session;

    const repoDid = await getCurrentDid();
    if (!repoDid) {
      return {
        success: false,
        error: new AppError(ErrorCode.AUTH_FAILED, 'ユーザーDIDが取得できません'),
      };
    }

    await rateLimiter.throttle();

    const rkey = blockUri.split('/').pop() ?? '';
    const agent = getAgent();
    await agent.app.bsky.graph.block.delete({ repo: repoDid, rkey });

    if (__DEV__) {
      console.log('Unblocked user successfully, rkey:', rkey);
    }

    return { success: true, data: true };
  } catch (error: unknown) {
    if (__DEV__) {
      console.error('Failed to unblock user:', error);
    }
    return { success: false, error: mapToAppError(error, 'ブロック解除') };
  }
}

/**
 * Fetch a user's public profile by DID or handle.
 */
export async function getUserProfile(
  actor: string
): Promise<Result<BlueskyProfile, AppError>> {
  try {
    const session = await ensureSession();
    if (!session.success) return session;

    const agent = getAgent();
    const response = await agent.getProfile({ actor });
    const data = response.data;

    return {
      success: true,
      data: {
        did: data.did,
        handle: data.handle,
        displayName: data.displayName,
        description: data.description,
        avatar: data.avatar,
        banner: data.banner,
        followersCount: data.followersCount,
        followsCount: data.followsCount,
        postsCount: data.postsCount,
      },
    };
  } catch (error: unknown) {
    if (__DEV__) {
      console.error('Failed to get user profile:', error);
    }
    return { success: false, error: mapToAppError(error, 'プロフィール取得') };
  }
}
