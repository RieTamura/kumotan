import { ec as EC } from 'elliptic';
import { Key, JwtHeader, JwtPayload, SignedJwt, VerifyOptions, VerifyResult } from '@atproto/oauth-client';
import * as Crypto from 'expo-crypto';
import { base64UrlEncode } from './utils';
import { Buffer } from 'buffer';
import { v4 as uuidv4 } from 'uuid';

const ec = new EC('p256');

export class JoseKey extends Key {
  private keyPair: EC.KeyPair;

  constructor(keyData: EC.KeyPair | any) {
    if (keyData && typeof keyData.getPublic === 'function') {
      const keyPair = keyData as EC.KeyPair;
      const pub = keyPair.getPublic();
      const x = pub.getX().toString(16).padStart(64, '0');
      const y = pub.getY().toString(16).padStart(64, '0');
      const kid = `key-${uuidv4()}`;

      super({
        kty: 'EC',
        crv: 'P-256',
        x: Buffer.from(x, 'hex').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
        y: Buffer.from(y, 'hex').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
        kid,
        alg: 'ES256',
        key_ops: ['sign', 'verify']
      });
      this.keyPair = keyPair;
    } else {
      // It's a JWK
      super(keyData);

      const x = Buffer.from(keyData.x, 'base64url').toString('hex');
      const y = Buffer.from(keyData.y, 'base64url').toString('hex');

      if (keyData.d) {
        const d = Buffer.from(keyData.d, 'base64url').toString('hex');
        this.keyPair = ec.keyFromPrivate(d, 'hex');
      } else {
        this.keyPair = ec.keyFromPublic({ x, y }, 'hex');
      }
    }
  }

  async createJwt(header: JwtHeader, payload: JwtPayload): Promise<SignedJwt> {
    const protectedHeader = { ...header, alg: 'ES256', kid: this.jwk.kid };

    const encodedHeader = base64UrlEncode(JSON.stringify(protectedHeader));
    const encodedPayload = base64UrlEncode(JSON.stringify(payload));
    const message = `${encodedHeader}.${encodedPayload}`;

    const msgBytes = Buffer.from(message);
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
  }

  async verifyJwt<C extends string = never>(token: SignedJwt, options: VerifyOptions<C> = {}): Promise<VerifyResult<C>> {
    throw new Error('Verification not implemented locally');
  }
}
