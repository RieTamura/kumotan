/**
 * Bluesky OAuth Service
 * Implements OAuth 2.0 with PKCE (RFC 7636) for secure authentication
 */

import * as SecureStore from 'expo-secure-store';
import { generatePKCEChallenge as generatePKCE, generateState as generateRandomState } from '../../utils/pkce';
import { PKCEChallenge, OAuthState, OAuthTokenResponse, BlueskySession } from '../../types/bluesky';
import { STORAGE_KEYS, API, OAUTH, TIMEOUT } from '../../constants/config';
import { Result } from '../../types/result';
import { AppError, ErrorCode } from '../../utils/errors';
import { getAgent } from './auth';
import { storeAuth } from './auth';

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
 * @param state - Random state for CSRF protection
 * @param codeChallenge - PKCE code challenge
 * @returns Authorization URL
 */
export function buildAuthorizationUrl(
  state: string,
  codeChallenge: string
): string {
  const params = new URLSearchParams({
    response_type: OAUTH.RESPONSE_TYPE,
    client_id: API.BLUESKY.OAUTH.CLIENT_ID,
    redirect_uri: API.BLUESKY.OAUTH.REDIRECT_URI,
    scope: API.BLUESKY.OAUTH.SCOPE,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: OAUTH.CODE_CHALLENGE_METHOD,
  });

  return `${API.BLUESKY.OAUTH.AUTHORIZE}?${params.toString()}`;
}

/**
 * Store OAuth state securely
 * @param state - State parameter
 * @param codeVerifier - PKCE code verifier
 */
export async function storeOAuthState(
  state: string,
  codeVerifier: string
): Promise<void> {
  const oauthState: OAuthState = {
    state,
    codeVerifier,
    timestamp: Date.now(),
  };

  await SecureStore.setItemAsync(
    STORAGE_KEYS.OAUTH_STATE,
    JSON.stringify(oauthState)
  );
}

/**
 * Retrieve and verify OAuth state
 * @param receivedState - State parameter received from callback
 * @returns Code verifier if state is valid, null otherwise
 */
export async function retrieveOAuthState(
  receivedState: string
): Promise<Result<string, AppError>> {
  try {
    const storedStateJson = await SecureStore.getItemAsync(
      STORAGE_KEYS.OAUTH_STATE
    );

    if (!storedStateJson) {
      return {
        success: false,
        error: new AppError(
          ErrorCode.AUTH_FAILED,
          'OAuth state not found. Please restart the login process.'
        ),
      };
    }

    const storedState: OAuthState = JSON.parse(storedStateJson);

    // Verify state matches (CSRF protection)
    if (storedState.state !== receivedState) {
      // Clear invalid state
      await clearOAuthState();

      return {
        success: false,
        error: new AppError(
          ErrorCode.AUTH_FAILED,
          'Invalid state parameter. Possible CSRF attack detected.'
        ),
      };
    }

    // Check if state is not too old (15 minutes)
    const STATE_EXPIRY_MS = 15 * 60 * 1000;
    const isExpired = Date.now() - storedState.timestamp > STATE_EXPIRY_MS;

    if (isExpired) {
      await clearOAuthState();

      return {
        success: false,
        error: new AppError(
          ErrorCode.TOKEN_EXPIRED,
          'OAuth state expired. Please restart the login process.'
        ),
      };
    }

    // Clear state after successful retrieval (one-time use)
    await clearOAuthState();

    return { success: true, data: storedState.codeVerifier };
  } catch (error) {
    if (__DEV__) {
      console.error('Failed to retrieve OAuth state:', error);
    }

    return {
      success: false,
      error: new AppError(
        ErrorCode.AUTH_FAILED,
        'Failed to retrieve OAuth state.',
        error
      ),
    };
  }
}

/**
 * Clear stored OAuth state
 */
export async function clearOAuthState(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(STORAGE_KEYS.OAUTH_STATE);
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
 * @returns Access and refresh tokens
 */
export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string
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

/**
 * Start OAuth flow
 * Generates PKCE challenge, stores state, and returns authorization URL
 * @returns Authorization URL to open in browser
 */
export async function startOAuthFlow(): Promise<Result<string, AppError>> {
  try {
    // Generate PKCE challenge
    const { verifier, challenge } = await generatePKCEChallenge();

    // Generate state for CSRF protection
    const state = await generateState();

    // Store state and verifier securely
    await storeOAuthState(state, verifier);

    // Build authorization URL
    const authUrl = buildAuthorizationUrl(state, challenge);

    if (__DEV__) {
      console.log('OAuth flow started');
    }

    return { success: true, data: authUrl };
  } catch (error) {
    if (__DEV__) {
      console.error('Failed to start OAuth flow:', error);
    }

    return {
      success: false,
      error: new AppError(
        ErrorCode.AUTH_FAILED,
        'Failed to start OAuth flow',
        error
      ),
    };
  }
}

/**
 * Complete OAuth flow
 * Handles callback, validates state, and exchanges code for tokens
 * @param callbackUrl - Deep link URL from OAuth callback
 * @returns OAuth tokens
 */
export async function completeOAuthFlow(
  callbackUrl: string
): Promise<Result<BlueskySession, AppError>> {
  try {
    // Parse callback URL
    const parseResult = parseCallbackUrl(callbackUrl);
    if (!parseResult.success) {
      return parseResult;
    }

    const { code, state } = parseResult.data;

    // Retrieve and validate state
    const stateResult = await retrieveOAuthState(state);
    if (!stateResult.success) {
      return stateResult;
    }

    const codeVerifier = stateResult.data;

    // Exchange code for tokens
    const tokensResult = await exchangeCodeForTokens(code, codeVerifier);
    if (!tokensResult.success) {
      return tokensResult;
    }

    const tokens = tokensResult.data;

    // Store tokens and create session using auth service
    const sessionResult = await storeTokensAndCreateSession(
      tokens.access_token,
      tokens.refresh_token
    );

    if (!sessionResult.success) {
      return sessionResult;
    }

    // Clear OAuth state after successful completion
    await clearOAuthState();

    if (__DEV__) {
      console.log('OAuth flow completed successfully');
    }

    return sessionResult;
  } catch (error) {
    if (__DEV__) {
      console.error('Failed to complete OAuth flow:', error);
    }

    // Ensure state is cleared on error
    await clearOAuthState();

    return {
      success: false,
      error: new AppError(
        ErrorCode.AUTH_FAILED,
        'Failed to complete OAuth flow',
        error
      ),
    };
  }
}
