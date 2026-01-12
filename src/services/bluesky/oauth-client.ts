/**
 * AT Protocol OAuth Client
 * Uses @atproto/oauth-client-expo for native OAuth authentication
 */

import Constants from 'expo-constants';

// Dynamic import to catch initialization errors
let ExpoOAuthClient: typeof import('@atproto/oauth-client-expo').ExpoOAuthClient;
let importError: Error | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const oauthModule = require('@atproto/oauth-client-expo');
  ExpoOAuthClient = oauthModule.ExpoOAuthClient;

  if (!ExpoOAuthClient) {
    importError = new Error('ExpoOAuthClient not found in @atproto/oauth-client-expo module');
  }
} catch (e) {
  importError = e instanceof Error ? e : new Error(String(e));
  console.error('[OAuth Client] Failed to import @atproto/oauth-client-expo:', importError);
}

/**
 * OAuth Client ID (HTTPS URL where metadata is hosted)
 */
const CLIENT_ID = Constants.expoConfig?.extra?.oauth?.clientId ||
  'https://rietamura.github.io/kumotan/oauth-client-metadata.json';

/**
 * OAuth redirect URI
 */
const REDIRECT_URI = Constants.expoConfig?.extra?.oauth?.redirectUri ||
  'io.github.rietamura:/';

/**
 * Handle resolver for Bluesky
 * Used to resolve handles to DIDs and find PDS instances
 */
const HANDLE_RESOLVER = 'https://bsky.social';

/**
 * Client metadata object
 * Defined inline instead of requiring JSON file for React Native compatibility
 */
const clientMetadata = {
  client_id: CLIENT_ID,
  client_name: 'くもたん (Kumotan)',
  client_uri: 'https://rietamura.github.io/kumotan/',
  logo_uri: 'https://rietamura.github.io/kumotan/icon.png',
  tos_uri: 'https://rietamura.github.io/kumotan/',
  policy_uri: 'https://rietamura.github.io/kumotan/',
  redirect_uris: [REDIRECT_URI],
  scope: 'atproto transition:generic',
  token_endpoint_auth_method: 'none',
  response_types: ['code'],
  grant_types: ['authorization_code', 'refresh_token'],
  application_type: 'native',
  dpop_bound_access_tokens: true,
};

/**
 * Singleton instance of ExpoOAuthClient
 */
let oauthClientInstance: InstanceType<typeof ExpoOAuthClient> | null = null;

/**
 * Get or create the OAuth client instance
 *
 * @returns ExpoOAuthClient instance
 */
export function getOAuthClient(): InstanceType<typeof ExpoOAuthClient> {
  if (!oauthClientInstance) {
    try {
      // Check for import errors first
      if (importError) {
        throw new Error(`Failed to import OAuth client library: ${importError.message}`);
      }

      // Log initialization attempt (always, not just in dev)
      console.log('[OAuth Client] Initializing OAuth client with:', {
        handleResolver: HANDLE_RESOLVER,
        clientId: CLIENT_ID,
        redirectUri: REDIRECT_URI,
      });

      // Check if Constants is available
      console.log('[OAuth Client] Constants check:', {
        exists: typeof Constants !== 'undefined',
        hasExpoConfig: Constants?.expoConfig !== undefined,
        configValues: Constants?.expoConfig?.extra?.oauth,
      });

      // Check if ExpoOAuthClient is properly imported
      if (!ExpoOAuthClient || typeof ExpoOAuthClient !== 'function') {
        throw new Error(`ExpoOAuthClient is not a constructor. Type: ${typeof ExpoOAuthClient}`);
      }

      oauthClientInstance = new ExpoOAuthClient({
        handleResolver: HANDLE_RESOLVER,
        clientMetadata,
      });

      // Verify instance was created
      if (!oauthClientInstance) {
        throw new Error('ExpoOAuthClient constructor returned null/undefined');
      }

      // Safely get prototype methods for debugging
      let allMethods: string[] = [];
      try {
        const proto = Object.getPrototypeOf(oauthClientInstance);
        if (proto) {
          allMethods = Object.getOwnPropertyNames(proto);
        }
      } catch (protoError) {
        console.warn('[OAuth Client] Could not get prototype methods:', protoError);
      }

      // Verify instance has required methods
      console.log('[OAuth Client] Instance created. Checking methods:', {
        hasSignIn: typeof oauthClientInstance.signIn === 'function',
        hasRestore: typeof oauthClientInstance.restore === 'function',
        allMethods,
      });

      if (!oauthClientInstance.signIn || typeof oauthClientInstance.signIn !== 'function') {
        throw new Error('ExpoOAuthClient instance does not have signIn method');
      }

      console.log('[OAuth Client] OAuth client initialized successfully');
    } catch (error) {
      console.error('[OAuth Client] Failed to initialize OAuth client:', error);
      console.error('[OAuth Client] Error type:', typeof error);
      console.error('[OAuth Client] ExpoOAuthClient type:', typeof ExpoOAuthClient);
      if (error instanceof Error) {
        console.error('[OAuth Client] Error message:', error.message);
        console.error('[OAuth Client] Error stack:', error.stack);
      }
      throw error;
    }
  }

  return oauthClientInstance;
}

/**
 * Reset the OAuth client instance (for testing purposes)
 */
export function resetOAuthClient(): void {
  oauthClientInstance = null;
}
