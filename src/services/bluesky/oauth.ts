/**
 * Bluesky OAuth Service
 * Implements OAuth 2.0 with PKCE (RFC 7636) for secure authentication
 */

import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { generatePKCEChallenge as generatePKCE, generateState as generateRandomState } from '../../utils/pkce';
import { PKCEChallenge, OAuthState, OAuthTokenResponse, BlueskySession } from '../../types/bluesky';
import { STORAGE_KEYS, API, OAUTH, TIMEOUT } from '../../constants/config';
import { Result } from '../../types/result';
import { AppError, ErrorCode } from '../../utils/errors';
import { getAgent } from './auth';
import { storeAuth } from './auth';

// AsyncStorage key for OAuth state
const OAUTH_STATE_KEY = '@kumotan:oauth_state';

/**
 * Generate PKCE challenge for OAuth flow
 * @returns PKCE challenge pair (verifier and challenge)
 */
export async function generatePKCEChallenge(): Promise<PKCEChallenge> {
  return await generatePKCE();
}

/**
 * Generate a random state parameter for CSRF protection
 * @returns Random state string
 */
export async function generateState(): Promise<string> {
  return await generateRandomState();
}

/**
 * Build OAuth authorization URL
 * @param handle - Bluesky handle (e.g., user.bsky.social)
 * @param codeChallenge - PKCE code challenge
 * @param state - Random state for CSRF protection
 * @returns Authorization URL
 */
export function buildAuthorizationUrl(
  handle: string,
  codeChallenge: string,
  state: string
): string {
  const params = new URLSearchParams({
    response_type: OAUTH.RESPONSE_TYPE,
    client_id: API.BLUESKY.OAUTH.CLIENT_ID,
    redirect_uri: API.BLUESKY.OAUTH.REDIRECT_URI,
    scope: API.BLUESKY.OAUTH.SCOPE,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: OAUTH.CODE_CHALLENGE_METHOD,
    // AT Protocol requires login_hint with the handle
    login_hint: handle,
  });

  return `${API.BLUESKY.OAUTH.AUTHORIZE}?${params.toString()}`;
}

/**
 * Store OAuth state in AsyncStorage
 * Note: Changed from SecureStore to AsyncStorage to avoid react-native-mmkv dependency
 * @param data - OAuth state data including state, codeVerifier, and handle
 */
export async function storeOAuthState(data: {
  state: string;
  codeVerifier: string;
  handle: string;
}): Promise<void> {
  const oauthState: OAuthState & { handle: string } = {
    state: data.state,
    codeVerifier: data.codeVerifier,
    handle: data.handle,
    timestamp: Date.now(),
  };

  await AsyncStorage.setItem(OAUTH_STATE_KEY, JSON.stringify(oauthState));
}

/**
 * Retrieve OAuth state from AsyncStorage
 * Note: Changed from SecureStore to AsyncStorage to avoid react-native-mmkv dependency
 * @returns OAuth state data (state, codeVerifier, handle) or null if not found
 */
export async function retrieveOAuthState(): Promise<{
  state: string;
  codeVerifier: string;
  handle: string;
} | null> {
  try {
    const storedStateJson = await AsyncStorage.getItem(OAUTH_STATE_KEY);

    if (!storedStateJson) {
      return null;
    }

    const storedState: OAuthState & { handle: string } = JSON.parse(storedStateJson);

    // Check if state is not too old (15 minutes)
    const STATE_EXPIRY_MS = 15 * 60 * 1000;
    const isExpired = Date.now() - storedState.timestamp > STATE_EXPIRY_MS;

    if (isExpired) {
      await clearOAuthState();
      return null;
    }

    return {
      state: storedState.state,
      codeVerifier: storedState.codeVerifier,
      handle: storedState.handle,
    };
  } catch (error) {
    if (__DEV__) {
      console.error('Failed to retrieve OAuth state:', error);
    }
    return null;
  }
}

/**
 * Clear stored OAuth state from AsyncStorage
 */
export async function clearOAuthState(): Promise<void> {
  try {
    await AsyncStorage.removeItem(OAUTH_STATE_KEY);
  } catch (error) {
    if (__DEV__) {
      console.error('Failed to clear OAuth state:', error);
    }
  }
}

/**
 * Exchange authorization code for tokens
 * @param code - Authorization code from callback
 * @param codeVerifier - PKCE code verifier
 * @param handle - Bluesky handle for session creation
 * @returns Access and refresh tokens
 */
export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
  handle: string
): Promise<Result<OAuthTokenResponse, AppError>> {
  try {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: API.BLUESKY.OAUTH.REDIRECT_URI,
      client_id: API.BLUESKY.OAUTH.CLIENT_ID,
      code_verifier: codeVerifier,
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT.LOGIN);

    const response = await fetch(API.BLUESKY.OAUTH.TOKEN, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage =
        errorData.error_description || errorData.error || 'Token exchange failed';

      if (__DEV__) {
        console.error('Token exchange failed:', errorMessage, errorData);
      }

      return {
        success: false,
        error: new AppError(
          ErrorCode.AUTH_FAILED,
          `認証に失敗しました: ${errorMessage}`,
          errorData
        ),
      };
    }

    const tokens: OAuthTokenResponse = await response.json();

    if (__DEV__) {
      console.log('Token exchange successful');
    }

    return { success: true, data: tokens };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (__DEV__) {
      console.error('Token exchange error:', errorMessage);
    }

    // Handle timeout
    if (errorMessage.includes('aborted')) {
      return {
        success: false,
        error: new AppError(
          ErrorCode.TIMEOUT,
          '認証がタイムアウトしました。もう一度お試しください。'
        ),
      };
    }

    // Handle network errors
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
      error: new AppError(
        ErrorCode.AUTH_FAILED,
        '認証に失敗しました。もう一度お試しください。',
        error
      ),
    };
  }
}

/**
 * Store tokens and create Bluesky session
 * Helper function to convert OAuth tokens to a BlueskySession
 */
async function storeTokensAndCreateSession(
  accessToken: string,
  refreshToken: string
): Promise<Result<BlueskySession, AppError>> {
  try {
    const agent = getAgent();

    // Resume session with OAuth tokens
    const resumeResult = await agent.resumeSession({
      accessJwt: accessToken,
      refreshJwt: refreshToken,
      did: '', // Will be filled by agent
      handle: '', // Will be filled by agent
      active: true,
    });

    if (!resumeResult.success) {
      return {
        success: false,
        error: new AppError(
          ErrorCode.AUTH_FAILED,
          'Failed to create session with OAuth tokens'
        ),
      };
    }

    // Get session data from agent
    const session = agent.session;
    if (!session) {
      return {
        success: false,
        error: new AppError(
          ErrorCode.AUTH_FAILED,
          'No session created after OAuth authentication'
        ),
      };
    }

    const blueskySession: BlueskySession = {
      accessJwt: session.accessJwt,
      refreshJwt: session.refreshJwt,
      handle: session.handle,
      did: session.did,
      email: session.email,
    };

    // Store session using auth service
    await storeAuth(blueskySession);

    return { success: true, data: blueskySession };
  } catch (error) {
    if (__DEV__) {
      console.error('Failed to store tokens and create session:', error);
    }

    return {
      success: false,
      error: new AppError(
        ErrorCode.AUTH_FAILED,
        'Failed to create session with OAuth tokens',
        error
      ),
    };
  }
}

/**
 * Parse OAuth callback URL
 * @param url - Callback URL from deep link
 * @returns Parsed parameters (code and state)
 */
export function parseCallbackUrl(url: string): Result<
  { code: string; state: string },
  AppError
> {
  try {
    const urlObj = new URL(url);
    const code = urlObj.searchParams.get('code');
    const state = urlObj.searchParams.get('state');
    const error = urlObj.searchParams.get('error');
    const errorDescription = urlObj.searchParams.get('error_description');

    // Check for OAuth errors
    if (error) {
      return {
        success: false,
        error: new AppError(
          ErrorCode.AUTH_FAILED,
          errorDescription || `OAuth error: ${error}`
        ),
      };
    }

    // Validate required parameters
    if (!code || !state) {
      return {
        success: false,
        error: new AppError(
          ErrorCode.AUTH_FAILED,
          'Invalid callback URL: missing code or state parameter'
        ),
      };
    }

    return { success: true, data: { code, state } };
  } catch (error) {
    if (__DEV__) {
      console.error('Failed to parse callback URL:', error);
    }

    return {
      success: false,
      error: new AppError(
        ErrorCode.AUTH_FAILED,
        'Invalid callback URL format',
        error
      ),
    };
  }
}

