import { RuntimeImplementation, Key } from '@atproto/oauth-client';
import * as Crypto from 'expo-crypto';
import { ec as EC } from 'elliptic';
import { JoseKey } from './JoseKey';

const ec = new EC('p256');

// Memory locks to prevent concurrent storage access issues
const activeLocks = new Map<string, Promise<void>>();

export const cryptoImplementation: RuntimeImplementation = {
  createKey: async (algs: string[]): Promise<Key> => {
    console.log('[Crypto] createKey starting...', { algs });
    try {
      if (!algs.includes('ES256')) throw new Error('Unsupported algorithm');

      console.log('[Crypto] Generating entropy for KeyPair...');
      // Manually provide entropy because elliptic's auto-detection fails in RN
      const entropy = new Uint8Array(32);
      Crypto.getRandomValues(entropy);

      console.log('[Crypto] Generating new EC KeyPair with manual entropy...');
      const keyPair = ec.genKeyPair({ entropy: Array.from(entropy) });

      console.log('[Crypto] Wrapping in JoseKey...');
      const key = new JoseKey(keyPair);

      console.log('[Crypto] createKey success');
      return key;
    } catch (err: any) {
      console.error('[Crypto] createKey failed', err.message || err);
      throw err;
    }
  },

  getRandomValues: async (length: number) => {
    console.log('[Crypto] getRandomValues starting...', { length });
    const array = new Uint8Array(length);
    Crypto.getRandomValues(array);
    console.log('[Crypto] getRandomValues success');
    return array;
  },

  digest: async (data: Uint8Array, algorithm: { name: string }) => {
    console.log('[Crypto] digest starting...', { alg: algorithm.name });
    let alg: Crypto.CryptoDigestAlgorithm;
    switch (algorithm.name) {
      case 'sha256': alg = Crypto.CryptoDigestAlgorithm.SHA256; break;
      case 'sha384': alg = Crypto.CryptoDigestAlgorithm.SHA384; break;
      case 'sha512': alg = Crypto.CryptoDigestAlgorithm.SHA512; break;
      default: throw new Error(`Unsupported digest algorithm: ${algorithm.name}`);
    }

    try {
      const hash = await Crypto.digest(alg, data as any);
      console.log('[Crypto] digest success');
      return new Uint8Array(hash);
    } catch (err: any) {
      console.error('[Crypto] digest failed', err.message || err);
      throw err;
    }
  },

  requestLock: async <T>(name: string, fn: () => T | PromiseLike<T>): Promise<T> => {
    console.log('[Crypto] requestLock starting...', { name });
    const prevLock = activeLocks.get(name) || Promise.resolve();

    let releaseLock: () => void = () => { };
    const newLock = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });

    activeLocks.set(name, newLock);

    try {
      await prevLock;
      console.log('[Crypto] Lock acquired', { name });
      const result = await fn();
      console.log('[Crypto] Lock work finished', { name });
      return result;
    } finally {
      releaseLock();
      console.log('[Crypto] Lock released', { name });
    }
  }
}
