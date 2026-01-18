import { Buffer } from 'buffer';

export function base64UrlEncode(str: string | Uint8Array | Buffer): string {
  const buffer = Buffer.isBuffer(str) ? str : Buffer.from(str);
  return buffer.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function base64UrlDecode(str: string): Buffer {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) {
    str += '=';
  }
  return Buffer.from(str, 'base64');
}
