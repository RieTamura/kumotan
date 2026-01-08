import {
  generateCodeVerifier,
  generateCodeChallenge,
  generatePKCEChallenge,
  generateState,
} from '../pkce';

// Mock expo-crypto
jest.mock('expo-crypto', () => ({
  getRandomBytesAsync: jest.fn(),
  digestStringAsync: jest.fn(),
  CryptoDigestAlgorithm: {
    SHA256: 'SHA256',
  },
  CryptoEncoding: {
    BASE64: 'base64',
  },
}));

// Import the mocked module
import * as Crypto from 'expo-crypto';

const mockedCrypto = Crypto as jest.Mocked<typeof Crypto>;

describe('PKCE Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateCodeVerifier', () => {
    it('should generate a 43-character base64url string from 32 random bytes', async () => {
      // Mock 32 bytes of random data
      const mockBytes = new Uint8Array(32);
      for (let i = 0; i < 32; i++) {
        mockBytes[i] = i;
      }
      mockedCrypto.getRandomBytesAsync.mockResolvedValue(mockBytes);

      const verifier = await generateCodeVerifier();

      expect(mockedCrypto.getRandomBytesAsync).toHaveBeenCalledWith(32);
      expect(typeof verifier).toBe('string');
      expect(verifier.length).toBe(43);
      // Should not contain +, /, or = (base64url encoding)
      expect(verifier).not.toMatch(/[+/=]/);
    });

    it('should generate different verifiers on multiple calls', async () => {
      const mockBytes1 = new Uint8Array(32).fill(1);
      const mockBytes2 = new Uint8Array(32).fill(2);

      mockedCrypto.getRandomBytesAsync
        .mockResolvedValueOnce(mockBytes1)
        .mockResolvedValueOnce(mockBytes2);

      const verifier1 = await generateCodeVerifier();
      const verifier2 = await generateCodeVerifier();

      expect(verifier1).not.toBe(verifier2);
    });

    it('should handle all possible byte values correctly', async () => {
      // Test with bytes that would produce +, /, and = in standard base64
      const mockBytes = new Uint8Array(32);
      mockBytes[0] = 0b11111110; // Would produce + in base64
      mockBytes[1] = 0b11111111; // Would produce / in base64
      mockedCrypto.getRandomBytesAsync.mockResolvedValue(mockBytes);

      const verifier = await generateCodeVerifier();

      // Should convert + to -, / to _, and remove =
      expect(verifier).not.toMatch(/[+/=]/);
      expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
    });
  });

  describe('generateCodeChallenge', () => {
    it('should generate SHA-256 hash of verifier in base64url format', async () => {
      const verifier = 'test-verifier-string';
      const mockDigest = 'mockBase64Digest+/=';

      mockedCrypto.digestStringAsync.mockResolvedValue(mockDigest);

      const challenge = await generateCodeChallenge(verifier);

      expect(mockedCrypto.digestStringAsync).toHaveBeenCalledWith(
        Crypto.CryptoDigestAlgorithm.SHA256,
        verifier,
        { encoding: Crypto.CryptoEncoding.BASE64 }
      );
      expect(typeof challenge).toBe('string');
      // Should convert base64 to base64url
      expect(challenge).toBe('mockBase64Digest-_');
    });

    it('should produce consistent challenge for same verifier', async () => {
      const verifier = 'consistent-verifier';
      const mockDigest = 'sameDigest123';

      mockedCrypto.digestStringAsync.mockResolvedValue(mockDigest);

      const challenge1 = await generateCodeChallenge(verifier);
      const challenge2 = await generateCodeChallenge(verifier);

      expect(challenge1).toBe(challenge2);
    });

    it('should produce different challenges for different verifiers', async () => {
      mockedCrypto.digestStringAsync
        .mockResolvedValueOnce('digest1')
        .mockResolvedValueOnce('digest2');

      const challenge1 = await generateCodeChallenge('verifier1');
      const challenge2 = await generateCodeChallenge('verifier2');

      expect(challenge1).not.toBe(challenge2);
    });

    it('should handle base64 padding correctly', async () => {
      const mockDigest = 'test==';
      mockedCrypto.digestStringAsync.mockResolvedValue(mockDigest);

      const challenge = await generateCodeChallenge('test');

      expect(challenge).toBe('test');
      expect(challenge).not.toContain('=');
    });

    it('should replace + with - in base64url encoding', async () => {
      const mockDigest = 'test+test';
      mockedCrypto.digestStringAsync.mockResolvedValue(mockDigest);

      const challenge = await generateCodeChallenge('test');

      expect(challenge).toBe('test-test');
      expect(challenge).not.toContain('+');
    });

    it('should replace / with _ in base64url encoding', async () => {
      const mockDigest = 'test/test';
      mockedCrypto.digestStringAsync.mockResolvedValue(mockDigest);

      const challenge = await generateCodeChallenge('test');

      expect(challenge).toBe('test_test');
      expect(challenge).not.toContain('/');
    });
  });

  describe('generatePKCEChallenge', () => {
    it('should generate both verifier and challenge', async () => {
      const mockBytes = new Uint8Array(32).fill(42);
      const mockDigest = 'mockDigest123';

      mockedCrypto.getRandomBytesAsync.mockResolvedValue(mockBytes);
      mockedCrypto.digestStringAsync.mockResolvedValue(mockDigest);

      const result = await generatePKCEChallenge();

      expect(result).toHaveProperty('verifier');
      expect(result).toHaveProperty('challenge');
      expect(typeof result.verifier).toBe('string');
      expect(typeof result.challenge).toBe('string');
      expect(result.verifier.length).toBeGreaterThan(0);
      expect(result.challenge.length).toBeGreaterThan(0);
    });

    it('should generate verifier and matching challenge', async () => {
      const mockBytes = new Uint8Array(32).fill(100);
      const mockDigest = 'challengeHash';

      mockedCrypto.getRandomBytesAsync.mockResolvedValue(mockBytes);
      mockedCrypto.digestStringAsync.mockResolvedValue(mockDigest);

      const { verifier, challenge } = await generatePKCEChallenge();

      // Verify that digestStringAsync was called with the verifier
      expect(mockedCrypto.digestStringAsync).toHaveBeenCalledWith(
        Crypto.CryptoDigestAlgorithm.SHA256,
        verifier,
        { encoding: Crypto.CryptoEncoding.BASE64 }
      );
      expect(challenge).toBe('challengeHash');
    });

    it('should generate unique pairs on multiple calls', async () => {
      const mockBytes1 = new Uint8Array(32).fill(1);
      const mockBytes2 = new Uint8Array(32).fill(2);
      const mockDigest1 = 'digest1';
      const mockDigest2 = 'digest2';

      mockedCrypto.getRandomBytesAsync
        .mockResolvedValueOnce(mockBytes1)
        .mockResolvedValueOnce(mockBytes2);
      mockedCrypto.digestStringAsync
        .mockResolvedValueOnce(mockDigest1)
        .mockResolvedValueOnce(mockDigest2);

      const result1 = await generatePKCEChallenge();
      const result2 = await generatePKCEChallenge();

      expect(result1.verifier).not.toBe(result2.verifier);
      expect(result1.challenge).not.toBe(result2.challenge);
    });

    it('should return verifier and challenge in correct format', async () => {
      const mockBytes = new Uint8Array(32).fill(50);
      const mockDigest = 'test+/=digest';

      mockedCrypto.getRandomBytesAsync.mockResolvedValue(mockBytes);
      mockedCrypto.digestStringAsync.mockResolvedValue(mockDigest);

      const { verifier, challenge } = await generatePKCEChallenge();

      // Both should be base64url encoded
      expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(verifier).not.toMatch(/[+/=]/);
      expect(challenge).not.toMatch(/[+/=]/);
    });
  });

  describe('generateState', () => {
    it('should generate a random state string from 16 bytes', async () => {
      const mockBytes = new Uint8Array(16).fill(123);
      mockedCrypto.getRandomBytesAsync.mockResolvedValue(mockBytes);

      const state = await generateState();

      expect(mockedCrypto.getRandomBytesAsync).toHaveBeenCalledWith(16);
      expect(typeof state).toBe('string');
      expect(state.length).toBeGreaterThan(0);
      expect(state).not.toMatch(/[+/=]/);
    });

    it('should generate different states on multiple calls', async () => {
      const mockBytes1 = new Uint8Array(16).fill(1);
      const mockBytes2 = new Uint8Array(16).fill(2);

      mockedCrypto.getRandomBytesAsync
        .mockResolvedValueOnce(mockBytes1)
        .mockResolvedValueOnce(mockBytes2);

      const state1 = await generateState();
      const state2 = await generateState();

      expect(state1).not.toBe(state2);
    });

    it('should return base64url encoded string', async () => {
      const mockBytes = new Uint8Array(16);
      mockBytes[0] = 0b11111110; // Would produce + in base64
      mockBytes[1] = 0b11111111; // Would produce / in base64
      mockedCrypto.getRandomBytesAsync.mockResolvedValue(mockBytes);

      const state = await generateState();

      expect(state).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(state).not.toMatch(/[+/=]/);
    });

    it('should produce state of expected length (22 characters from 16 bytes)', async () => {
      const mockBytes = new Uint8Array(16).fill(42);
      mockedCrypto.getRandomBytesAsync.mockResolvedValue(mockBytes);

      const state = await generateState();

      // 16 bytes in base64url = 22 characters (ceil(16 * 8 / 6))
      expect(state.length).toBe(22);
    });
  });

  describe('RFC 7636 Compliance', () => {
    it('should generate verifier with sufficient entropy (256 bits)', async () => {
      const mockBytes = new Uint8Array(32); // 32 bytes = 256 bits
      mockedCrypto.getRandomBytesAsync.mockResolvedValue(mockBytes);

      await generateCodeVerifier();

      // Verify 32 bytes (256 bits) as per RFC 7636 recommendation
      expect(mockedCrypto.getRandomBytesAsync).toHaveBeenCalledWith(32);
    });

    it('should use SHA-256 for code challenge as per RFC 7636', async () => {
      const mockDigest = 'digest';
      mockedCrypto.digestStringAsync.mockResolvedValue(mockDigest);

      await generateCodeChallenge('test');

      expect(mockedCrypto.digestStringAsync).toHaveBeenCalledWith(
        Crypto.CryptoDigestAlgorithm.SHA256,
        expect.any(String),
        expect.any(Object)
      );
    });

    it('should produce URL-safe characters only (RFC 7636 Section 4.1)', async () => {
      const mockBytes = new Uint8Array(32);
      // Fill with values that could produce non-URL-safe characters
      for (let i = 0; i < 32; i++) {
        mockBytes[i] = (i * 7) % 256;
      }
      mockedCrypto.getRandomBytesAsync.mockResolvedValue(mockBytes);

      const verifier = await generateCodeVerifier();

      // RFC 7636: unreserved characters [A-Z] / [a-z] / [0-9] / "-" / "." / "_" / "~"
      // We use base64url which is [A-Z] / [a-z] / [0-9] / "-" / "_"
      expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty-like byte arrays gracefully', async () => {
      const mockBytes = new Uint8Array(32).fill(0);
      mockedCrypto.getRandomBytesAsync.mockResolvedValue(mockBytes);

      const verifier = await generateCodeVerifier();

      expect(verifier).toBeTruthy();
      expect(verifier.length).toBe(43);
    });

    it('should handle maximum byte values', async () => {
      const mockBytes = new Uint8Array(32).fill(255);
      mockedCrypto.getRandomBytesAsync.mockResolvedValue(mockBytes);

      const verifier = await generateCodeVerifier();

      expect(verifier).toBeTruthy();
      expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('should handle crypto API errors gracefully', async () => {
      mockedCrypto.getRandomBytesAsync.mockRejectedValue(
        new Error('Crypto API unavailable')
      );

      await expect(generateCodeVerifier()).rejects.toThrow(
        'Crypto API unavailable'
      );
    });

    it('should handle digest errors gracefully', async () => {
      mockedCrypto.digestStringAsync.mockRejectedValue(
        new Error('Digest failed')
      );

      await expect(generateCodeChallenge('test')).rejects.toThrow(
        'Digest failed'
      );
    });
  });
});
