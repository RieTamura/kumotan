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
      }

      // Fetch the actual DID document from PLC Directory to get the real PDS URL
      let didDoc: any;
      if (did.startsWith('did:plc:')) {
        console.log('[OAuth] Fetching DID document from PLC Directory...');
        const plcRes = await fetch(`https://plc.directory/${did}`);
        if (!plcRes.ok) {
          throw new Error(`Failed to fetch DID document: ${plcRes.status}`);
        }
        didDoc = await plcRes.json();
        console.log('[OAuth] Got DID document, PDS:', didDoc.service?.[0]?.serviceEndpoint);
      } else if (did.startsWith('did:web:')) {
        // For did:web, construct the URL from the DID
        const domain = did.replace('did:web:', '').replace(/%3A/g, ':');
        console.log('[OAuth] Fetching DID document from did:web domain:', domain);
        const webRes = await fetch(`https://${domain}/.well-known/did.json`);
        if (!webRes.ok) {
          throw new Error(`Failed to fetch did:web document: ${webRes.status}`);
        }
        didDoc = await webRes.json();
        console.log('[OAuth] Got DID document, PDS:', didDoc.service?.[0]?.serviceEndpoint);
      } else {
        throw new Error(`Unsupported DID method: ${did}`);
      }

      // Return IdentityInfo structure expected by the library
      return {
        did,
        handle,
        didDoc
      };
    } catch (err: any) {
      console.error('[OAuth] Custom resolve failed:', err.message);
      throw err;
    }
  }
};

// Pre-populate bsky.social Authorization Server metadata
// bsky.social is the Authorization Server (Entryway), not a Protected Resource (PDS)
const BSKY_AS_METADATA = {
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

// Only cache the Authorization Server metadata, not Protected Resource metadata
// The library will fetch Protected Resource metadata from the user's actual PDS
asCache.set('https://bsky.social', BSKY_AS_METADATA);

console.log('[OAuth] Pre-populated AS metadata cache for bsky.social');

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
    // Log all error properties for debugging
    console.error('[OAuth] Error keys:', Object.keys(err));
    try {
      console.error('[OAuth] Full error:', JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
    } catch {
      console.error('[OAuth] Could not stringify error');
    }

    // Traverse the cause chain
    let currentError = err;
    let depth = 0;
    while (currentError && depth < 5) {
      console.error(`[OAuth] Error level ${depth}:`, {
        name: currentError.name,
        message: currentError.message,
        constructor: currentError.constructor?.name,
      });
      if (currentError.cause) {
        console.error(`[OAuth] Cause at level ${depth}:`, currentError.cause.message || currentError.cause);
        if (currentError.cause.response) {
          console.error(`[OAuth] Response at level ${depth}:`, {
            status: currentError.cause.response.status,
            statusText: currentError.cause.response.statusText,
          });
        }
        if (currentError.cause.json) {
          console.error(`[OAuth] Response JSON at level ${depth}:`, currentError.cause.json);
        }
      }
      currentError = currentError.cause;
      depth++;
    }
    throw err;
  }
}

export async function restoreSession(did: string): Promise<OAuthSession> {
  return await oauthClient.restore(did);
}
