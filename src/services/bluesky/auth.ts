/**
 * Bluesky Authentication Service
 * Handles login, logout, token management, and session refresh
 */

import { BskyAgent } from '@atproto/api';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Result } from '../../types/result';
import { BlueskySession, StoredAuth, BlueskyProfile } from '../../types/bluesky';
import { AppError, ErrorCode, authError } from '../../utils/errors';
import { STORAGE_KEYS, API } from '../../constants/config';
import { oauthLogger } from '../../utils/logger';
import { signIn as oauthSignIn, restoreSession as oauthRestore, oauthClient } from '../auth/oauth-client';

// Helper to access protected tokens
async function getSessionTokens(session: any) {
  const tokenSet = await session.getTokenSet();
  return {
    access_token: tokenSet.access_token,
    refresh_token: tokenSet.refresh_token
  };
}

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

    // Try normal Agent resume first (works for App Password)
    const bskyAgent = getAgent();

    // Check if we have an OAuth session for this user
    // If we do, we should use the OAuth client to ensure token freshness
    try {
      const oauthSession = await oauthRestore(storedAuth.did);
      // Access tokens via helper
      if (oauthSession) {
        const tokens = await getSessionTokens(oauthSession);
        if (tokens.access_token && tokens.refresh_token) {
          console.log('Valid OAuth session found, using OAuth tokens');
          // If we have a valid OAuth session, use its tokens
          await bskyAgent.resumeSession({
            accessJwt: tokens.access_token,
            refreshJwt: tokens.refresh_token,
            handle: storedAuth.handle,
            did: storedAuth.did,
            active: true,
          });
          return { success: true, data: undefined };
        }
      }
    } catch (e) {
      // Not an OAuth session or restore failed, fall back to standard resume
      // likely an App Password session
      console.log('Not an OAuth session or restore failed, trying standard resume');
    }

    await bskyAgent.resumeSession({
      accessJwt: storedAuth.accessToken,
      refreshJwt: storedAuth.refreshToken,
      handle: storedAuth.handle,
      did: storedAuth.did,
      active: true,
    });

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
  // mapped to resumeSession for now
  return resumeSession();
}

/**
 * Clear all authentication data (logout)
 */
export async function clearAuth(): Promise<void> {
  try {
    const did = await SecureStore.getItemAsync(STORAGE_KEYS.USER_DID);
    if (did) {
      // Try to revoke/cleanup OAuth session if exists
      // We don't have a direct delete method exposed in oauth-client wrapper easily
      // but we can try to rely on oauthClient internals if needed.
      // For now, just clearing local storage is enough for logout.
    }

    await Promise.all([
      SecureStore.deleteItemAsync(STORAGE_KEYS.ACCESS_TOKEN),
      SecureStore.deleteItemAsync(STORAGE_KEYS.REFRESH_TOKEN),
      SecureStore.deleteItemAsync(STORAGE_KEYS.USER_DID),
      SecureStore.deleteItemAsync(STORAGE_KEYS.USER_HANDLE),
    ]);

    // Also clear the OAuth client state for this DID potentially?
    // The library manages this.

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
 * Get user profile information
 */
export async function getProfile(actor?: string): Promise<Result<BlueskyProfile, AppError>> {
  try {
    const bskyAgent = getAgent();

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
 * Start OAuth authentication flow
 */
export async function startOAuthFlow(
  handle: string
): Promise<Result<void, AppError>> {
  try {
    oauthLogger.info('Starting OAuth flow', { handle });

    // Call the new OAuth client implementation
    const session = await oauthSignIn(handle);

    console.log('[OAuth] Sign-in successful, session established');
    oauthLogger.info('OAuth sign-in successful');

    // Store session data into SecureStore for app usage
    if (session) {
      const tokens = await getSessionTokens(session);

      if (tokens.access_token && tokens.refresh_token) {
        const blueskySession: BlueskySession = {
          accessJwt: tokens.access_token,
          refreshJwt: tokens.refresh_token,
          handle: handle, // We must trust the input handle or fetch it separately since session may not expose it
          did: session.sub,
          email: undefined
        };
        await storeAuth(blueskySession);

        // Initialize the global agent with these tokens
        const bskyAgent = getAgent();
        await bskyAgent.resumeSession({
          accessJwt: blueskySession.accessJwt,
          refreshJwt: blueskySession.refreshJwt,
          handle: blueskySession.handle,
          did: blueskySession.did,
          active: true
        });

        oauthLogger.info('Session data stored and agent initialized');
      }
    }

    return { success: true, data: undefined };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    oauthLogger.error('OAuth flow error', { error: errorMessage });
    console.log('[OAuth] OAuth flow error:', errorMessage);

    if (errorMessage.includes('cancelled') || errorMessage.includes('dismissed')) {
      return {
        success: false,
        error: new AppError(
          ErrorCode.AUTH_FAILED,
          'ユーザーがキャンセルしました。',
          error
        ),
      };
    }

    return {
      success: false,
      error: new AppError(
        ErrorCode.OAUTH_ERROR,
        `OAuth認証に失敗しました。\n\nエラー詳細: ${errorMessage}`,
        error
      ),
    };
  }
}

// Deprecated stubs removed

