/**
 * Bluesky Authentication Service
 * Handles login, logout, token management, and session refresh
 */

import { BskyAgent } from '@atproto/api';
import * as SecureStore from 'expo-secure-store';
import { Result } from '../../types/result';
import { BlueskySession, StoredAuth, BlueskyProfile } from '../../types/bluesky';
import { AppError, ErrorCode, authError } from '../../utils/errors';
import { STORAGE_KEYS, API } from '../../constants/config';

/**
 * Bluesky agent instance
 */
let agent: BskyAgent | null = null;

/**
 * Get or create Bluesky agent instance
 */
export function getAgent(): BskyAgent {
  if (!agent) {
    agent = new BskyAgent({ service: API.BLUESKY.SERVICE });
  }
  return agent;
}

/**
 * Login to Bluesky with identifier and app password
 * Note: App password is NOT stored - only tokens are persisted
 */
export async function login(
  identifier: string,
  appPassword: string
): Promise<Result<BlueskySession, AppError>> {
  try {
    const bskyAgent = getAgent();

    const response = await bskyAgent.login({
      identifier,
      password: appPassword,
    });

    const session: BlueskySession = {
      accessJwt: response.data.accessJwt,
      refreshJwt: response.data.refreshJwt,
      handle: response.data.handle,
      did: response.data.did,
      email: response.data.email,
    };

    // Store tokens and user info in Secure Store
    // Note: App password is intentionally NOT stored for security
    await storeAuth(session);

    if (__DEV__) {
      console.log('Login successful:', session.handle);
    }

    return { success: true, data: session };
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';

    if (__DEV__) {
      console.error('Login failed:', errorMessage);
    }

    // Determine error type
    if (
      errorMessage.includes('Invalid') ||
      errorMessage.includes('Authentication')
    ) {
      return {
        success: false,
        error: authError(
          'ログインに失敗しました。ユーザー名またはApp Passwordを確認してください。',
          error
        ),
      };
    }

    if (errorMessage.includes('Network') || errorMessage.includes('fetch')) {
      return {
        success: false,
        error: new AppError(
          ErrorCode.NETWORK_ERROR,
          'ネットワーク接続を確認してください。',
          error
        ),
      };
    }

    return {
      success: false,
      error: authError('ログインに失敗しました。', error),
    };
  }
}

/**
 * Store authentication data in Secure Store
 * @param session - Bluesky session data to store
 */
export async function storeAuth(session: BlueskySession): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(STORAGE_KEYS.ACCESS_TOKEN, session.accessJwt),
    SecureStore.setItemAsync(STORAGE_KEYS.REFRESH_TOKEN, session.refreshJwt),
    SecureStore.setItemAsync(STORAGE_KEYS.USER_DID, session.did),
    SecureStore.setItemAsync(STORAGE_KEYS.USER_HANDLE, session.handle),
  ]);
}

/**
 * Get stored authentication data from Secure Store
 */
export async function getStoredAuth(): Promise<StoredAuth | null> {
  try {
    const [accessToken, refreshToken, did, handle] = await Promise.all([
      SecureStore.getItemAsync(STORAGE_KEYS.ACCESS_TOKEN),
      SecureStore.getItemAsync(STORAGE_KEYS.REFRESH_TOKEN),
      SecureStore.getItemAsync(STORAGE_KEYS.USER_DID),
      SecureStore.getItemAsync(STORAGE_KEYS.USER_HANDLE),
    ]);

    if (!accessToken || !refreshToken || !did || !handle) {
      return null;
    }

    return { accessToken, refreshToken, did, handle };
  } catch (error) {
    if (__DEV__) {
      console.error('Failed to get stored auth:', error);
    }
    return null;
  }
}

/**
 * Check if user is authenticated (has stored tokens)
 */
export async function isAuthenticated(): Promise<boolean> {
  const storedAuth = await getStoredAuth();
  return storedAuth !== null;
}

/**
 * Resume session from stored tokens
 */
export async function resumeSession(): Promise<Result<void, AppError>> {
  try {
    const storedAuth = await getStoredAuth();

    if (!storedAuth) {
      return {
        success: false,
        error: new AppError(
          ErrorCode.TOKEN_EXPIRED,
          'セッションが見つかりません。再度ログインしてください。'
        ),
      };
    }

    const bskyAgent = getAgent();

    await bskyAgent.resumeSession({
      accessJwt: storedAuth.accessToken,
      refreshJwt: storedAuth.refreshToken,
      handle: storedAuth.handle,
      did: storedAuth.did,
      active: true,
    });

    // Update stored tokens if they were refreshed
    if (bskyAgent.session) {
      await SecureStore.setItemAsync(
        STORAGE_KEYS.ACCESS_TOKEN,
        bskyAgent.session.accessJwt
      );
      await SecureStore.setItemAsync(
        STORAGE_KEYS.REFRESH_TOKEN,
        bskyAgent.session.refreshJwt
      );
    }

    if (__DEV__) {
      console.log('Session resumed successfully');
    }

    return { success: true, data: undefined };
  } catch (error: unknown) {
    if (__DEV__) {
      console.error('Failed to resume session:', error);
    }

    // Clear invalid tokens
    await clearAuth();

    return {
      success: false,
      error: new AppError(
        ErrorCode.TOKEN_EXPIRED,
        'セッションが期限切れです。再度ログインしてください。',
        error
      ),
    };
  }
}

/**
 * Refresh the current session
 */
export async function refreshSession(): Promise<Result<void, AppError>> {
  try {
    const storedAuth = await getStoredAuth();

    if (!storedAuth) {
      return {
        success: false,
        error: new AppError(
          ErrorCode.TOKEN_EXPIRED,
          'セッションが見つかりません。再度ログインしてください。'
        ),
      };
    }

    const bskyAgent = getAgent();

    // Resume session (this will auto-refresh if needed)
    await bskyAgent.resumeSession({
      accessJwt: storedAuth.accessToken,
      refreshJwt: storedAuth.refreshToken,
      handle: storedAuth.handle,
      did: storedAuth.did,
      active: true,
    });

    // Store refreshed tokens
    if (bskyAgent.session) {
      await SecureStore.setItemAsync(
        STORAGE_KEYS.ACCESS_TOKEN,
        bskyAgent.session.accessJwt
      );
      await SecureStore.setItemAsync(
        STORAGE_KEYS.REFRESH_TOKEN,
        bskyAgent.session.refreshJwt
      );
    }

    if (__DEV__) {
      console.log('Session refreshed successfully');
    }

    return { success: true, data: undefined };
  } catch (error: unknown) {
    if (__DEV__) {
      console.error('Failed to refresh session:', error);
    }

    // Clear invalid tokens
    await clearAuth();

    return {
      success: false,
      error: new AppError(
        ErrorCode.TOKEN_EXPIRED,
        'セッションの更新に失敗しました。再度ログインしてください。',
        error
      ),
    };
  }
}

/**
 * Clear all authentication data (logout)
 */
export async function clearAuth(): Promise<void> {
  try {
    await Promise.all([
      SecureStore.deleteItemAsync(STORAGE_KEYS.ACCESS_TOKEN),
      SecureStore.deleteItemAsync(STORAGE_KEYS.REFRESH_TOKEN),
      SecureStore.deleteItemAsync(STORAGE_KEYS.USER_DID),
      SecureStore.deleteItemAsync(STORAGE_KEYS.USER_HANDLE),
    ]);

    // Reset agent
    agent = null;

    if (__DEV__) {
      console.log('Auth cleared successfully');
    }
  } catch (error) {
    if (__DEV__) {
      console.error('Failed to clear auth:', error);
    }
  }
}

/**
 * Logout - clears auth and resets agent
 */
export async function logout(): Promise<void> {
  await clearAuth();
}

/**
 * Get current user handle
 */
export async function getCurrentHandle(): Promise<string | null> {
  const storedAuth = await getStoredAuth();
  return storedAuth?.handle ?? null;
}

/**
 * Get current user DID
 */
export async function getCurrentDid(): Promise<string | null> {
  const storedAuth = await getStoredAuth();
  return storedAuth?.did ?? null;
}

/**
 * Check if agent has active session
 */
export function hasActiveSession(): boolean {
  const bskyAgent = getAgent();
  return bskyAgent.session !== undefined;
}

/**
 * Login to Bluesky with OAuth
 * Uses PKCE flow for secure authentication
 * @param accessToken - OAuth access token from token exchange
 * @param refreshToken - OAuth refresh token
 * @returns Bluesky session
 */
export async function loginWithOAuth(
  accessToken: string,
  refreshToken: string
): Promise<Result<BlueskySession, AppError>> {
  try {
    const bskyAgent = getAgent();

    // Resume session with OAuth tokens
    await bskyAgent.resumeSession({
      accessJwt: accessToken,
      refreshJwt: refreshToken,
      // DID and handle will be populated after session resume
      did: '',
      handle: '',
      active: true,
    });

    if (!bskyAgent.session) {
      return {
        success: false,
        error: authError('Failed to create session with OAuth tokens'),
      };
    }

    const session: BlueskySession = {
      accessJwt: bskyAgent.session.accessJwt,
      refreshJwt: bskyAgent.session.refreshJwt,
      handle: bskyAgent.session.handle,
      did: bskyAgent.session.did,
      email: bskyAgent.session.email,
    };

    // Store tokens and user info in Secure Store
    await storeAuth(session);

    if (__DEV__) {
      console.log('OAuth login successful:', session.handle);
    }

    return { success: true, data: session };
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';

    if (__DEV__) {
      console.error('OAuth login failed:', errorMessage);
    }

    if (errorMessage.includes('Network') || errorMessage.includes('fetch')) {
      return {
        success: false,
        error: new AppError(
          ErrorCode.NETWORK_ERROR,
          'ネットワーク接続を確認してください。',
          error
        ),
      };
    }

    return {
      success: false,
      error: authError('OAuthログインに失敗しました。', error),
    };
  }
}

/**
 * Get user profile information
 */
export async function getProfile(actor?: string): Promise<Result<BlueskyProfile, AppError>> {
  try {
    const bskyAgent = getAgent();
    
    // If no actor specified, use current user's DID
    let actorId = actor;
    if (!actorId) {
      const did = await getCurrentDid();
      if (!did) {
        return {
          success: false,
          error: authError('ユーザー情報が見つかりません。'),
        };
      }
      actorId = did;
    }

    const response = await bskyAgent.getProfile({ actor: actorId });
    
    const profile: BlueskyProfile = {
      did: response.data.did,
      handle: response.data.handle,
      displayName: response.data.displayName,
      description: response.data.description,
      avatar: response.data.avatar,
      banner: response.data.banner,
      followersCount: response.data.followersCount,
      followsCount: response.data.followsCount,
      postsCount: response.data.postsCount,
    };

    if (__DEV__) {
      console.log('Profile fetched:', profile.handle);
    }

    return { success: true, data: profile };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    if (__DEV__) {
      console.error('Failed to fetch profile:', errorMessage);
    }

    return {
      success: false,
      error: new AppError(
        ErrorCode.API_ERROR,
        'プロフィール情報の取得に失敗しました。',
        error
      ),
    };
  }
}

/**
 * Re-export OAuth functions from oauth.ts
 */
export { startOAuthFlow, completeOAuthFlow } from './oauth';
