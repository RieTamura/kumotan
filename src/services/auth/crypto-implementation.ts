import { RuntimeImplementation, Key } from '@atproto/oauth-client';
import * as Crypto from 'expo-crypto';
import { ec as EC } from 'elliptic';
import { Buffer } from 'buffer';
import { JoseKey } from './JoseKey';

const ec = new EC('p256');

export const cryptoImplementation: RuntimeImplementation = {
  createKey: async (algs: string[]): Promise<Key> => {
    if (!algs.includes('ES256')) throw new Error('Unsupported algorithm');
    const keyPair = ec.genKeyPair();
    return new JoseKey(keyPair);
  },
  getRandomValues: async (length: number) => {
    const array = new Uint8Array(length);
    Crypto.getRandomValues(array);
    return array;
  },
  digest: async (data: Uint8Array, algorithm: { name: string }) => {
    let alg: Crypto.CryptoDigestAlgorithm;
    switch (algorithm.name) {
      case 'sha256': alg = Crypto.CryptoDigestAlgorithm.SHA256; break;
      case 'sha384': alg = Crypto.CryptoDigestAlgorithm.SHA384; break;
      case 'sha512': alg = Crypto.CryptoDigestAlgorithm.SHA512; break;
      default: throw new Error(`Unsupported digest algorithm: ${algorithm.name}`);
    }

    const hash = await Crypto.digest(alg, data as any);
    return new Uint8Array(hash);
  }
}
