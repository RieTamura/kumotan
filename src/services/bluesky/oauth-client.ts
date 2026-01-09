/**
 * AT Protocol OAuth Client
 * Uses @atproto/oauth-client-expo for native OAuth authentication
 */

import { ExpoOAuthClient } from '@atproto/oauth-client-expo';
import Constants from 'expo-constants';

// Import client metadata
const clientMetadata = require('../../../assets/oauth-client-metadata.json');

/**
 * OAuth Client ID (HTTPS URL where metadata is hosted)
 */
const CLIENT_ID = Constants.expoConfig?.extra?.oauth?.clientId ||
  'https://rietamura.github.io/kumotan/oauth-client-metadata.json';

/**
 * Handle resolver for Bluesky
 * Used to resolve handles to DIDs and find PDS instances
 */
const HANDLE_RESOLVER = 'https://bsky.social';

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
    oauthClientInstance = new ExpoOAuthClient({
      handleResolver: HANDLE_RESOLVER,
      clientMetadata: {
        ...clientMetadata,
        client_id: CLIENT_ID, // Override with configured client ID
      },
    });
  }

  return oauthClientInstance;
}

/**
 * Reset the OAuth client instance (for testing purposes)
 */
export function resetOAuthClient(): void {
  oauthClientInstance = null;
}
