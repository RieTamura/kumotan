import * as Crypto from 'expo-crypto';

/**
 * PKCE (Proof Key for Code Exchange) utilities for OAuth 2.0
 * Implements RFC 7636 for secure authorization code flow
 */

/**
 * Generates a cryptographically random code verifier string
 * @returns Base64 URL-encoded random string (43-128 characters)
 */
export async function generateCodeVerifier(): Promise<string> {
  // RFC 7636 recommends 32 bytes (256 bits) of entropy
  // This produces a 43-character base64url string
  const randomBytes = await Crypto.getRandomBytesAsync(32);
  return base64UrlEncode(randomBytes);
}

/**
 * Generates a code challenge from a code verifier using SHA-256
 * @param verifier - The code verifier string
 * @returns Base64 URL-encoded SHA-256 hash of the verifier
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  // Hash the verifier with SHA-256
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    verifier,
    { encoding: Crypto.CryptoEncoding.BASE64 }
  );

  // Convert standard base64 to base64url
  return base64UrlEncodeFromBase64(digest);
}

/**
 * Generates both code verifier and challenge for PKCE flow
 * @returns Object containing verifier and challenge
 */
export async function generatePKCEChallenge(): Promise<{
  verifier: string;
  challenge: string;
}> {
  const verifier = await generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);

  return { verifier, challenge };
}

/**
 * Converts a byte array to base64url encoding
 * @param buffer - Byte array to encode
 * @returns Base64 URL-encoded string
 */
function base64UrlEncode(buffer: Uint8Array): string {
  // Convert to base64
  const base64 = btoa(String.fromCharCode(...buffer));

  // Convert to base64url (RFC 4648 Section 5)
  return base64UrlEncodeFromBase64(base64);
}

/**
 * Converts standard base64 to base64url encoding
 * @param base64 - Standard base64 string
 * @returns Base64 URL-encoded string
 */
function base64UrlEncodeFromBase64(base64: string): string {
  return base64
    .replace(/\+/g, '-')  // Replace + with -
    .replace(/\//g, '_')  // Replace / with _
    .replace(/=/g, '');   // Remove padding
}

/**
 * Generates a cryptographically random state parameter for OAuth
 * Used to prevent CSRF attacks
 * @returns Random state string
 */
export async function generateState(): Promise<string> {
  const randomBytes = await Crypto.getRandomBytesAsync(16);
  return base64UrlEncode(randomBytes);
}
