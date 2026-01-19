import { OAuthClient, OAuthSession } from '@atproto/oauth-client';
import { AsyncStorageStore } from './storage-adapter';
import { cryptoImplementation } from './crypto-implementation';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { JoseKey } from './JoseKey';

// Polyfill AbortSignal features for React Native environment
if (typeof AbortSignal !== 'undefined') {
  if (!AbortSignal.timeout) {
    (AbortSignal as any).timeout = (ms: number) => {
      const controller = new AbortController();
      setTimeout(() => controller.abort(new Error('TimeoutError')), ms);
      return controller.signal;
    };
  }
  if (!AbortSignal.prototype.throwIfAborted) {
    AbortSignal.prototype.throwIfAborted = function () {
      if (this.aborted) {
        throw this.reason || new Error('Aborted');
      }
    };
  }
}

// Wrapper to hydrate keys from storage
const hydrateKey = (data: any) => {
  if (data && data.dpopKey && !(data.dpopKey instanceof JoseKey)) {
    console.log('[OAuth] Hydrating dpopKey', { keys: Object.keys(data.dpopKey), hasJWK: !!data.dpopKey.jwk });
    // If it was stored as a JoseKey instance, the JWK is in data.dpopKey.jwk
    const keyData = data.dpopKey.jwk || data.dpopKey;
    data.dpopKey = new JoseKey(keyData);
  }
  return data;
};

const hydratedStateStore = {
  get: async (key: string) => hydrateKey(await new AsyncStorageStore<any>('@kumotan:oauth:state').get(key)),
  set: (key: string, val: any) => new AsyncStorageStore<any>('@kumotan:oauth:state').set(key, val),
  del: (key: string) => new AsyncStorageStore<any>('@kumotan:oauth:state').del(key),
};

const hydratedSessionStore = {
  get: async (key: string) => hydrateKey(await new AsyncStorageStore<any>('@kumotan:oauth:session').get(key)),
  set: (key: string, val: any) => new AsyncStorageStore<any>('@kumotan:oauth:session').set(key, val),
  del: (key: string) => new AsyncStorageStore<any>('@kumotan:oauth:session').del(key),
};

// Simple memory cache to pre-populate metadata and avoid fetch issues
class MemoryCache {
  private cache = new Map<string, { value: any, expiresAt: number }>();
  async get(key: string) {
    const entry = this.cache.get(key);
    console.log(`[OAuth] Cache GET ${key}:`, { hit: !!entry });
    if (!entry || entry.expiresAt < Date.now()) return undefined;
    return entry.value;
  }
  async set(key: string, value: any) {
    console.log(`[OAuth] Cache SET ${key}`);
    this.cache.set(key, { value, expiresAt: Date.now() + 3600000 });
  }
  async del(key: string) { this.cache.delete(key); }
}

const asCache = new MemoryCache();
const prCache = new MemoryCache();

// Custom resolver to bypass complex DID resolution issues in mobile environment
const customResolver = {
  resolve: async (input: string) => {
    console.log('[OAuth] Custom resolve starting for:', input);
    try {
      let did = input;
      let handle = input;

      if (!input.startsWith('did:')) {
        // It's a handle, resolve it to a DID
        const res = await fetch(`https://bsky.social/xrpc/com.atproto.identity.resolveHandle?handle=${input}`);
        if (!res.ok) {
          throw new Error(`Failed to resolve handle: ${res.status}`);
        }
        const data = await res.json();
        did = data.did;
        console.log('[OAuth] Resolved handle to DID:', did);
      } else {
        console.log('[OAuth] Input is already a DID:', did);
        // We don't have the handle easily, but the library mostly cares about the DID
      }

      // Return IdentityInfo structure expected by the library
      return {
        did,
        handle,
        didDoc: {
          id: did,
          service: [
            {
              id: '#atproto_pds',
              type: 'AtprotoPersonalDataServer',
              serviceEndpoint: 'https://bsky.social'
            }
          ]
        }
      };
    } catch (err: any) {
      console.error('[OAuth] Custom resolve failed:', err.message);
      throw err;
    }
  }
};

// Pre-populate bsky.social metadata
// Pre-populate bsky.social metadata with exact matching keys to satisfy strict library checks
const BSKY_METADATA = {
  issuer: 'https://bsky.social',
  authorization_endpoint: 'https://bsky.social/oauth/authorize',
  token_endpoint: 'https://bsky.social/oauth/token',
  revocation_endpoint: 'https://bsky.social/oauth/revoke',
  pushed_authorization_request_endpoint: 'https://bsky.social/oauth/par',
  response_types_supported: ['code'],
  grant_types_supported: ['authorization_code', 'refresh_token'],
  token_endpoint_auth_methods_supported: ['none'],
  dpop_signing_alg_values_supported: ['ES256'],
  code_challenge_methods_supported: ['S256'],
  client_id_metadata_document_supported: true,
};

const BSKY_RESOURCE = {
  resource: 'https://bsky.social',
  authorization_servers: ['https://bsky.social'],
};

// Register variant for https://bsky.social
asCache.set('https://bsky.social', { ...BSKY_METADATA, issuer: 'https://bsky.social' });
prCache.set('https://bsky.social', { ...BSKY_RESOURCE, resource: 'https://bsky.social' });

// Register variant for https://bsky.social/ (library often adds a trailing slash)
asCache.set('https://bsky.social/', { ...BSKY_METADATA, issuer: 'https://bsky.social/' });
prCache.set('https://bsky.social/', { ...BSKY_RESOURCE, resource: 'https://bsky.social/' });

console.log('[OAuth] Pre-populated metadata cache for bsky.social');

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
  stateStore: hydratedStateStore as any,
  sessionStore: hydratedSessionStore as any,
  runtimeImplementation: cryptoImplementation,
  responseMode: 'query',
  allowHttp: true,
  // Use pre-populated caches to bypass resolution errors
  authorizationServerMetadataCache: asCache as any,
  protectedResourceMetadataCache: prCache as any,
  // Inject the custom resolver to ensure stable identity resolution on mobile
  identityResolver: customResolver as any,
});

export async function signIn(handle: string): Promise<OAuthSession> {
  try {
    // 1. Resolve and Authorize
    const redirectUrl = 'io.github.rietamura:/oauth/callback';
    console.log('[OAuth] Calling oauthClient.authorize', { handle, redirectUrl });
    const url = await oauthClient.authorize(handle, {
      redirect_uri: redirectUrl as any,
      scope: 'atproto transition:generic'
    });
    console.log('[OAuth] authorize success', { url: url.toString() });

    // 2. Open Browser
    console.log('[OAuth] Opening browser...');
    const result = await WebBrowser.openAuthSessionAsync(
      url.toString(),
      redirectUrl
    );

    console.log('[OAuth] Open browser result:', { type: result.type, url: result.type === 'success' ? result.url : undefined });

    if (result.type === 'success' && result.url) {
      // 3. Handle Callback
      console.log('[OAuth] Handling callback...');
      const callbackUrl = result.url;

      // Extract search params more robustly
      let params: URLSearchParams;
      if (callbackUrl.includes('?')) {
        params = new URLSearchParams(callbackUrl.split('?')[1]);
      } else if (callbackUrl.includes('#')) {
        params = new URLSearchParams(callbackUrl.split('#')[1]);
      } else {
        console.error('[OAuth] No query or hash found in redirect URL');
        throw new Error('Invalid redirect URL: Missing parameters');
      }

      console.log('[OAuth] Calling oauthClient.callback...', {
        hasCode: params.has('code'),
        hasState: params.has('state'),
        hasIss: params.has('iss')
      });

      const { session } = await oauthClient.callback(params);
      console.log('[OAuth] Login success!', { sub: session.sub });
      return session;
    } else {
      console.log('[OAuth] Auth session cancelled or failed', { type: result.type });
      throw new Error('Authentication cancelled');
    }
  } catch (err: any) {
    console.error('[OAuth] signIn error:', err.message || err);
    if (err.stack) {
      console.error('[OAuth] stack trace:', err.stack);
    }
    throw err;
  }
}

export async function restoreSession(did: string): Promise<OAuthSession> {
  return await oauthClient.restore(did);
}
