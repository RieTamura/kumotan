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

    const result = await Crypto.digestStringAsync(alg, Buffer.from(data).toString('base64'), { encoding: Crypto.CryptoEncoding.BASE64 });
    // result is likely the digest string itself or an object. To be safe let's inspect or assume string if modern expo.
    // Actually, looking at docs: "Returns a Promise which fulfills with a value representing the hashed input."
    // If it returns Digest, and Digest is string, then result is string.
    const binaryString = atob(typeof result === 'string' ? result : (result as any).digest);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }
}
