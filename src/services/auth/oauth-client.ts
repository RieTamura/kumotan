import { OAuthClient, OAuthSession } from '@atproto/oauth-client';
import { AsyncStorageStore } from './storage-adapter';
import { cryptoImplementation } from './crypto-implementation';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

// Define the client configuration
export const oauthClient = new OAuthClient({
  clientMetadata: {
    client_id: 'https://rietamura.github.io/kumotan/oauth-client-metadata.json',
    client_name: 'くもたん (Kumotan)',
    redirect_uris: ['io.github.rietamura:/oauth/callback'],
    scope: 'atproto transition:generic',
    token_endpoint_auth_method: 'none',
    application_type: 'native',
    response_types: ['code'],
    grant_types: ['authorization_code', 'refresh_token'],
    dpop_bound_access_tokens: true,
  },
  stateStore: new AsyncStorageStore<any>('@kumotan:oauth:state') as any,
  sessionStore: new AsyncStorageStore<any>('@kumotan:oauth:session') as any,
  runtimeImplementation: cryptoImplementation,
  responseMode: 'query',
  handleResolver: 'https://bsky.social',
});

export async function signIn(handle: string): Promise<OAuthSession> {
  // 1. Resolve and Authorize
  const redirectUrl = 'io.github.rietamura:/oauth/callback';
  console.log('[OAuth] Calling oauthClient.authorize', { handle, redirectUrl });
  const url = await oauthClient.authorize(handle, {
    redirect_uri: redirectUrl as any,
    scope: 'atproto transition:generic'
  });
  console.log('[OAuth] authorize success', { url: url.toString() });

  // 2. Open Browser
  const result = await WebBrowser.openAuthSessionAsync(
    url.toString(),
    redirectUrl
  );

  if (result.type === 'success' && result.url) {
    // 3. Handle Callback
    // The URL might contain # or ? depending on response mode.
    // ATProto defaults to code flow (?) so query params.
    const paramStr = result.url.split('?')[1] || result.url.split('#')[1];
    const params = new URLSearchParams(paramStr);
    const { session } = await oauthClient.callback(params);
    return session;
  } else {
    throw new Error('Authentication cancelled');
  }
}

export async function restoreSession(did: string): Promise<OAuthSession> {
  return await oauthClient.restore(did);
}
