import { ec as EC } from 'elliptic';
import { Key, JwtHeader, JwtPayload, SignedJwt, VerifyOptions, VerifyResult } from '@atproto/oauth-client';
import * as Crypto from 'expo-crypto';
import { base64UrlEncode, base64UrlDecode } from './utils';
import { Buffer } from 'buffer';

const ec = new EC('p256');

/**
 * Generate a simple random ID without depending on uuid library
 */
function generateRandomId(): string {
  return Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
}

export class JoseKey extends Key {
  private keyPair: EC.KeyPair;

  constructor(keyData: EC.KeyPair | any) {
    if (keyData && typeof keyData.getPublic === 'function') {
      const keyPair = keyData as EC.KeyPair;
      const pub = keyPair.getPublic();
      const x = pub.getX().toString(16).padStart(64, '0');
      const y = pub.getY().toString(16).padStart(64, '0');
      const d = keyPair.getPrivate() ? keyPair.getPrivate().toString(16).padStart(64, '0') : undefined;
      const kid = `key-${generateRandomId()}`;

      super({
        kty: 'EC',
        crv: 'P-256',
        x: Buffer.from(x, 'hex').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
        y: Buffer.from(y, 'hex').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
        d: d ? Buffer.from(d, 'hex').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') : undefined,
        kid,
        alg: 'ES256',
        key_ops: ['sign', 'verify']
      } as any);
      this.keyPair = keyPair;
    } else {
      // It's a JWK
      super(keyData);

      if (!keyData.x || !keyData.y) {
        throw new Error(`Invalid JWK: Missing x or y coordinates`);
      }

      const x = base64UrlDecode(keyData.x).toString('hex');
      const y = base64UrlDecode(keyData.y).toString('hex');

      if (keyData.d) {
        const d = base64UrlDecode(keyData.d).toString('hex');
        this.keyPair = ec.keyFromPrivate(d, 'hex');
      } else {
        this.keyPair = ec.keyFromPublic({ x, y }, 'hex');
      }
    }
  }

  /**
   * Explicitly define algorithms to avoid 'includes of undefined' error 
   * when base class decorators fail in React Native environment.
   */
  get algorithms(): string[] {
    return ['ES256'];
  }

  async createJwt(header: JwtHeader, payload: JwtPayload): Promise<SignedJwt> {
    const protectedHeader = { ...header, alg: 'ES256', kid: this.jwk.kid };

    const encodedHeader = base64UrlEncode(JSON.stringify(protectedHeader));
    const encodedPayload = base64UrlEncode(JSON.stringify(payload));
    const message = `${encodedHeader}.${encodedPayload}`;

    const msgBytes = new Uint8Array(Buffer.from(message));

    try {
      const hashBuffer = await Crypto.digest(
        Crypto.CryptoDigestAlgorithm.SHA256,
        msgBytes
      );

      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const signature = this.keyPair.sign(hashArray);

      const r = signature.r.toString(16).padStart(64, '0');
      const s = signature.s.toString(16).padStart(64, '0');

      const sigBuffer = Buffer.concat([
        Buffer.from(r, 'hex'),
        Buffer.from(s, 'hex')
      ]);
      const encodedSignature = base64UrlEncode(sigBuffer);

      return `${message}.${encodedSignature}` as SignedJwt;
    } catch (err: any) {
      console.error('[JoseKey] createJwt error', err.message || err);
      throw err;
    }
  }

  async verifyJwt<C extends string = never>(token: SignedJwt, options: VerifyOptions<C> = {}): Promise<VerifyResult<C>> {
    throw new Error('Verification not implemented locally');
  }
}
