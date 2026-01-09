/**
 * AT Protocol OAuth Client
 * Uses @atproto/oauth-client-expo for native OAuth authentication
 */

import { ExpoOAuthClient } from '@atproto/oauth-client-expo';
import Constants from 'expo-constants';

/**
 * OAuth Client ID (HTTPS URL where metadata is hosted)
 */
const CLIENT_ID = Constants.expoConfig?.extra?.oauth?.clientId ||
  'https://rietamura.github.io/kumotan/oauth-client-metadata.json';

/**
 * OAuth redirect URI
 */
const REDIRECT_URI = Constants.expoConfig?.extra?.oauth?.redirectUri ||
  'io.github.rietamura:/oauth/callback';

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
let oauthClientInstance: ExpoOAuthClient | null = null;

/**
 * Get or create the OAuth client instance
 *
 * @returns ExpoOAuthClient instance
 */
export function getOAuthClient(): ExpoOAuthClient {
  if (!oauthClientInstance) {
    try {
      if (__DEV__) {
        console.log('Initializing OAuth client with:', {
          handleResolver: HANDLE_RESOLVER,
          clientId: CLIENT_ID,
          redirectUri: REDIRECT_URI,
          clientMetadata,
        });
      }

      // Check if ExpoOAuthClient is properly imported
      if (typeof ExpoOAuthClient !== 'function') {
        throw new Error(`ExpoOAuthClient is not a constructor. Type: ${typeof ExpoOAuthClient}`);
      }

      oauthClientInstance = new ExpoOAuthClient({
        handleResolver: HANDLE_RESOLVER,
        clientMetadata,
      });

      if (__DEV__) {
        console.log('OAuth client initialized successfully');
      }
    } catch (error) {
      if (__DEV__) {
        console.error('Failed to initialize OAuth client:', error);
        console.error('Error type:', typeof error);
        console.error('ExpoOAuthClient type:', typeof ExpoOAuthClient);
        console.error('ExpoOAuthClient value:', ExpoOAuthClient);
        if (error instanceof Error) {
          console.error('Error message:', error.message);
          console.error('Error stack:', error.stack);
        }
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
