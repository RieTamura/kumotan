import * as SecureStore from 'expo-secure-store';
import { STORAGE_KEYS, API, OAUTH } from '../../../constants/config';
import { ErrorCode } from '../../../utils/errors';

// Mock dependencies BEFORE imports
jest.mock('expo-secure-store');
jest.mock('../../../utils/pkce', () => ({
  generatePKCEChallenge: jest.fn(),
  generateState: jest.fn(),
  generateCodeVerifier: jest.fn(),
  generateCodeChallenge: jest.fn(),
}));

// Import after mocking
import {
  generatePKCEChallenge,
  generateState,
  buildAuthorizationUrl,
  storeOAuthState,
  retrieveOAuthState,
  clearOAuthState,
  exchangeCodeForTokens,
  parseCallbackUrl,
  startOAuthFlow,
  completeOAuthFlow,
} from '../oauth';
import * as pkce from '../../../utils/pkce';

const mockedSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;
const mockedPkce = pkce as jest.Mocked<typeof pkce>;

// Mock fetch globally
global.fetch = jest.fn();

describe('OAuth Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('generatePKCEChallenge', () => {
    it('should generate PKCE challenge pair', async () => {
      const mockChallenge = {
        verifier: 'mock-verifier',
        challenge: 'mock-challenge',
      };
      mockedPkce.generatePKCEChallenge.mockResolvedValue(mockChallenge);

      const result = await generatePKCEChallenge();

      expect(result).toEqual(mockChallenge);
      expect(mockedPkce.generatePKCEChallenge).toHaveBeenCalledTimes(1);
    });
  });

  describe('generateState', () => {
    it('should generate random state', async () => {
      const mockState = 'random-state-123';
      mockedPkce.generateState.mockResolvedValue(mockState);

      const result = await generateState();

      expect(result).toBe(mockState);
      expect(mockedPkce.generateState).toHaveBeenCalledTimes(1);
    });
  });

  describe('buildAuthorizationUrl', () => {
    it('should build valid authorization URL with all parameters', () => {
      const state = 'test-state';
      const codeChallenge = 'test-challenge';

      const url = buildAuthorizationUrl(state, codeChallenge);

      expect(url).toContain(API.BLUESKY.OAUTH.AUTHORIZE);
      expect(url).toContain(`response_type=${OAUTH.RESPONSE_TYPE}`);
      expect(url).toContain(`client_id=${encodeURIComponent(API.BLUESKY.OAUTH.CLIENT_ID)}`);
      expect(url).toContain(`redirect_uri=${encodeURIComponent(API.BLUESKY.OAUTH.REDIRECT_URI)}`);
      expect(url).toContain(`scope=`);  // URLSearchParams uses + for spaces
      expect(url).toContain(`state=${state}`);
      expect(url).toContain(`code_challenge=${codeChallenge}`);
      expect(url).toContain(`code_challenge_method=${OAUTH.CODE_CHALLENGE_METHOD}`);
    });

    it('should encode special characters in parameters', () => {
      const state = 'state+with/special=chars';
      const codeChallenge = 'challenge-with_chars';

      const url = buildAuthorizationUrl(state, codeChallenge);

      expect(url).toContain(encodeURIComponent(state));
      expect(url).toContain(codeChallenge);
    });
  });

  describe('storeOAuthState', () => {
    it('should store OAuth state with timestamp', async () => {
      const state = 'test-state';
      const codeVerifier = 'test-verifier';
      const mockTimestamp = 1234567890;

      jest.setSystemTime(mockTimestamp);

      await storeOAuthState(state, codeVerifier);

      const expectedState = JSON.stringify({
        state,
        codeVerifier,
        timestamp: mockTimestamp,
      });

      expect(mockedSecureStore.setItemAsync).toHaveBeenCalledWith(
        STORAGE_KEYS.OAUTH_STATE,
        expectedState
      );
    });
  });

  describe('retrieveOAuthState', () => {
    it('should retrieve and validate OAuth state successfully', async () => {
      const state = 'test-state';
      const codeVerifier = 'test-verifier';
      const timestamp = Date.now();

      const storedState = JSON.stringify({
        state,
        codeVerifier,
        timestamp,
      });

      mockedSecureStore.getItemAsync.mockResolvedValue(storedState);
      mockedSecureStore.deleteItemAsync.mockResolvedValue();

      const result = await retrieveOAuthState(state);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(codeVerifier);
      }
      expect(mockedSecureStore.deleteItemAsync).toHaveBeenCalledWith(
        STORAGE_KEYS.OAUTH_STATE
      );
    });

    it('should fail if state not found', async () => {
      mockedSecureStore.getItemAsync.mockResolvedValue(null);

      const result = await retrieveOAuthState('any-state');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(ErrorCode.AUTH_FAILED);
        expect(result.error.message).toContain('OAuth state not found');
      }
    });

    it('should fail if state does not match (CSRF protection)', async () => {
      const storedState = JSON.stringify({
        state: 'stored-state',
        codeVerifier: 'verifier',
        timestamp: Date.now(),
      });

      mockedSecureStore.getItemAsync.mockResolvedValue(storedState);
      mockedSecureStore.deleteItemAsync.mockResolvedValue();

      const result = await retrieveOAuthState('different-state');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(ErrorCode.AUTH_FAILED);
        expect(result.error.message).toContain('Invalid state parameter');
        expect(result.error.message).toContain('CSRF');
      }
      expect(mockedSecureStore.deleteItemAsync).toHaveBeenCalled();
    });

    it('should fail if state is expired (15 minutes)', async () => {
      const expiredTimestamp = Date.now() - 16 * 60 * 1000; // 16 minutes ago
      const storedState = JSON.stringify({
        state: 'test-state',
        codeVerifier: 'verifier',
        timestamp: expiredTimestamp,
      });

      mockedSecureStore.getItemAsync.mockResolvedValue(storedState);
      mockedSecureStore.deleteItemAsync.mockResolvedValue();

      const result = await retrieveOAuthState('test-state');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(ErrorCode.TOKEN_EXPIRED);
        expect(result.error.message).toContain('expired');
      }
      expect(mockedSecureStore.deleteItemAsync).toHaveBeenCalled();
    });

    it('should handle JSON parse errors', async () => {
      mockedSecureStore.getItemAsync.mockResolvedValue('invalid-json{');

      const result = await retrieveOAuthState('test-state');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(ErrorCode.AUTH_FAILED);
      }
    });
  });

  describe('clearOAuthState', () => {
    it('should delete OAuth state from secure store', async () => {
      mockedSecureStore.deleteItemAsync.mockResolvedValue();

      await clearOAuthState();

      expect(mockedSecureStore.deleteItemAsync).toHaveBeenCalledWith(
        STORAGE_KEYS.OAUTH_STATE
      );
    });

    it('should handle deletion errors gracefully', async () => {
      mockedSecureStore.deleteItemAsync.mockRejectedValue(
        new Error('Delete failed')
      );

      await expect(clearOAuthState()).resolves.not.toThrow();
    });
  });

  describe('exchangeCodeForTokens', () => {
    beforeEach(() => {
      jest.clearAllTimers();
      jest.useFakeTimers();
    });

    it('should exchange authorization code for tokens successfully', async () => {
      const code = 'auth-code';
      const codeVerifier = 'code-verifier';
      const mockTokens = {
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        token_type: 'Bearer',
        expires_in: 3600,
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockTokens,
      });

      const promise = exchangeCodeForTokens(code, codeVerifier);
      jest.runAllTimers();
      const result = await promise;

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(mockTokens);
      }

      expect(global.fetch).toHaveBeenCalledWith(
        API.BLUESKY.OAUTH.TOKEN,
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        })
      );
    });

    it('should handle token exchange failure', async () => {
      const code = 'auth-code';
      const codeVerifier = 'code-verifier';

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        json: async () => ({
          error: 'invalid_grant',
          error_description: 'Authorization code expired',
        }),
      });

      const promise = exchangeCodeForTokens(code, codeVerifier);
      jest.runAllTimers();
      const result = await promise;

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(ErrorCode.AUTH_FAILED);
        expect(result.error.message).toContain('Authorization code expired');
      }
    });

    it('should handle network errors', async () => {
      const code = 'auth-code';
      const codeVerifier = 'code-verifier';

      (global.fetch as jest.Mock).mockRejectedValue(
        new Error('Network request failed')
      );

      const promise = exchangeCodeForTokens(code, codeVerifier);
      jest.runAllTimers();
      const result = await promise;

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(ErrorCode.NETWORK_ERROR);
      }
    });

    it('should handle timeout errors', async () => {
      const code = 'auth-code';
      const codeVerifier = 'code-verifier';

      (global.fetch as jest.Mock).mockImplementation(
        () =>
          new Promise((_, reject) => {
            setTimeout(() => reject(new Error('aborted')), 1000);
          })
      );

      const promise = exchangeCodeForTokens(code, codeVerifier);
      jest.runAllTimers();
      const result = await promise;

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(ErrorCode.TIMEOUT);
      }
    });

    it('should send correct request body parameters', async () => {
      const code = 'test-code';
      const codeVerifier = 'test-verifier';

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ access_token: 'token' }),
      });

      const promise = exchangeCodeForTokens(code, codeVerifier);
      jest.runAllTimers();
      await promise;

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const body = fetchCall[1].body;

      expect(body).toContain(`grant_type=authorization_code`);
      expect(body).toContain(`code=${code}`);
      expect(body).toContain(`code_verifier=${codeVerifier}`);
      expect(body).toContain(`redirect_uri=${encodeURIComponent(API.BLUESKY.OAUTH.REDIRECT_URI)}`);
      expect(body).toContain(`client_id=${encodeURIComponent(API.BLUESKY.OAUTH.CLIENT_ID)}`);
    });
  });

  describe('parseCallbackUrl', () => {
    it('should parse valid callback URL successfully', () => {
      const url = 'kumotan://oauth/callback?code=auth-code&state=test-state';

      const result = parseCallbackUrl(url);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.code).toBe('auth-code');
        expect(result.data.state).toBe('test-state');
      }
    });

    it('should handle OAuth error in callback', () => {
      const url =
        'kumotan://oauth/callback?error=access_denied&error_description=User%20denied%20access';

      const result = parseCallbackUrl(url);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(ErrorCode.AUTH_FAILED);
        expect(result.error.message).toContain('User denied access');
      }
    });

    it('should fail if code is missing', () => {
      const url = 'kumotan://oauth/callback?state=test-state';

      const result = parseCallbackUrl(url);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(ErrorCode.AUTH_FAILED);
        expect(result.error.message).toContain('missing code');
      }
    });

    it('should fail if state is missing', () => {
      const url = 'kumotan://oauth/callback?code=auth-code';

      const result = parseCallbackUrl(url);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(ErrorCode.AUTH_FAILED);
        expect(result.error.message).toContain('missing');
      }
    });

    it('should handle invalid URL format', () => {
      const url = 'not-a-valid-url';

      const result = parseCallbackUrl(url);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(ErrorCode.AUTH_FAILED);
      }
    });
  });

  describe('startOAuthFlow', () => {
    it('should start OAuth flow successfully', async () => {
      const mockChallenge = {
        verifier: 'test-verifier',
        challenge: 'test-challenge',
      };
      const mockState = 'test-state';

      mockedPkce.generatePKCEChallenge.mockResolvedValue(mockChallenge);
      mockedPkce.generateState.mockResolvedValue(mockState);
      mockedSecureStore.setItemAsync.mockResolvedValue();

      const result = await startOAuthFlow();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toContain(API.BLUESKY.OAUTH.AUTHORIZE);
        expect(result.data).toContain(`state=${mockState}`);
        expect(result.data).toContain(`code_challenge=${mockChallenge.challenge}`);
      }

      expect(mockedSecureStore.setItemAsync).toHaveBeenCalled();
    });

    it('should handle PKCE generation failure', async () => {
      mockedPkce.generatePKCEChallenge.mockRejectedValue(
        new Error('PKCE generation failed')
      );

      const result = await startOAuthFlow();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(ErrorCode.AUTH_FAILED);
      }
    });

    it('should handle state generation failure', async () => {
      mockedPkce.generatePKCEChallenge.mockResolvedValue({
        verifier: 'verifier',
        challenge: 'challenge',
      });
      mockedPkce.generateState.mockRejectedValue(
        new Error('State generation failed')
      );

      const result = await startOAuthFlow();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(ErrorCode.AUTH_FAILED);
      }
    });

    it('should handle storage failure', async () => {
      mockedPkce.generatePKCEChallenge.mockResolvedValue({
        verifier: 'verifier',
        challenge: 'challenge',
      });
      mockedPkce.generateState.mockResolvedValue('state');
      mockedSecureStore.setItemAsync.mockRejectedValue(
        new Error('Storage failed')
      );

      const result = await startOAuthFlow();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(ErrorCode.AUTH_FAILED);
      }
    });
  });

  describe('completeOAuthFlow', () => {
    beforeEach(() => {
      jest.clearAllTimers();
      jest.useFakeTimers();
    });

    it('should complete OAuth flow successfully', async () => {
      const callbackUrl =
        'kumotan://oauth/callback?code=auth-code&state=test-state';
      const storedState = JSON.stringify({
        state: 'test-state',
        codeVerifier: 'test-verifier',
        timestamp: Date.now(),
      });
      const mockTokens = {
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        token_type: 'Bearer',
      };

      mockedSecureStore.getItemAsync.mockResolvedValue(storedState);
      mockedSecureStore.deleteItemAsync.mockResolvedValue();
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockTokens,
      });

      const promise = completeOAuthFlow(callbackUrl);
      jest.runAllTimers();
      const result = await promise;

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(mockTokens);
      }
    });

    it('should fail if callback URL is invalid', async () => {
      const callbackUrl = 'invalid-url';

      const result = await completeOAuthFlow(callbackUrl);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(ErrorCode.AUTH_FAILED);
      }
    });

    it('should fail if state validation fails', async () => {
      const callbackUrl =
        'kumotan://oauth/callback?code=auth-code&state=test-state';

      mockedSecureStore.getItemAsync.mockResolvedValue(null);

      const result = await completeOAuthFlow(callbackUrl);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(ErrorCode.AUTH_FAILED);
      }
    });

    it('should fail if token exchange fails', async () => {
      const callbackUrl =
        'kumotan://oauth/callback?code=auth-code&state=test-state';
      const storedState = JSON.stringify({
        state: 'test-state',
        codeVerifier: 'test-verifier',
        timestamp: Date.now(),
      });

      mockedSecureStore.getItemAsync.mockResolvedValue(storedState);
      mockedSecureStore.deleteItemAsync.mockResolvedValue();
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'invalid_grant' }),
      });

      const promise = completeOAuthFlow(callbackUrl);
      jest.runAllTimers();
      const result = await promise;

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(ErrorCode.AUTH_FAILED);
      }
    });

  });
    it('should clear state on error', async () => {
      const callbackUrl = 'kumotan://oauth/callback?code=code&state=state';

      // Test that state is cleared when validation fails (wrong state = CSRF)
      const storedState = JSON.stringify({
        state: 'different-state',
        codeVerifier: 'verifier',
        timestamp: Date.now(),
      });

      mockedSecureStore.getItemAsync.mockResolvedValue(storedState);
      mockedSecureStore.deleteItemAsync.mockResolvedValue();

      const result = await completeOAuthFlow(callbackUrl);

      expect(result.success).toBe(false);
      // State is cleared in retrieveOAuthState when CSRF validation fails
      expect(mockedSecureStore.deleteItemAsync).toHaveBeenCalled();
    });

  describe('Integration scenarios', () => {
    it('should handle complete OAuth flow from start to finish', async () => {
      // Start flow
      const mockChallenge = {
        verifier: 'verifier',
        challenge: 'challenge',
      };
      const mockState = 'state';

      mockedPkce.generatePKCEChallenge.mockResolvedValue(mockChallenge);
      mockedPkce.generateState.mockResolvedValue(mockState);
      mockedSecureStore.setItemAsync.mockResolvedValue();

      const startResult = await startOAuthFlow();
      expect(startResult.success).toBe(true);

      // Complete flow
      const callbackUrl = `kumotan://oauth/callback?code=code&state=${mockState}`;
      const storedState = JSON.stringify({
        state: mockState,
        codeVerifier: mockChallenge.verifier,
        timestamp: Date.now(),
      });

      mockedSecureStore.getItemAsync.mockResolvedValue(storedState);
      mockedSecureStore.deleteItemAsync.mockResolvedValue();
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'token',
          refresh_token: 'refresh',
          token_type: 'Bearer',
        }),
      });

      const promise = completeOAuthFlow(callbackUrl);
      jest.runAllTimers();
      const completeResult = await promise;

      expect(completeResult.success).toBe(true);
    });
  });
});
