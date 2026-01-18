/**
 * AuthStore Tests
 * Tests authentication state management with Zustand
 */

import { useAuthStore } from '../authStore';
import * as AuthService from '../../services/bluesky/auth';
import { AppError, ErrorCode } from '../../utils/errors';

// Mock expo-crypto (used by OAuth utilities)
jest.mock('expo-crypto', () => ({
  randomBytes: jest.fn(() => new Uint8Array(32)),
  digestStringAsync: jest.fn(async () => 'mocked-hash'),
  CryptoDigestAlgorithm: { SHA256: 'SHA256' },
}));

// Mock the auth service
jest.mock('../../services/bluesky/auth');

const mockedAuthService = AuthService as jest.Mocked<typeof AuthService>;

describe('AuthStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useAuthStore.setState({
      isAuthenticated: false,
      isLoading: false,
      user: null,
      error: null,
      profile: null,
      isProfileLoading: false,
    });
    jest.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = useAuthStore.getState();

      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.user).toBeNull();
      expect(state.error).toBeNull();
      expect(state.profile).toBeNull();
      expect(state.isProfileLoading).toBe(false);
    });
  });

  describe('login', () => {
    it('should successfully login with valid credentials', async () => {
      const mockAuth = {
        handle: 'test.bsky.social',
        did: 'did:plc:test123',
      };

      mockedAuthService.login.mockResolvedValue({
        success: true,
        data: {
          ...mockAuth,
          accessJwt: 'access-token',
          refreshJwt: 'refresh-token',
        },
      });

      mockedAuthService.getProfile.mockResolvedValue({
        success: true,
        data: {
          did: 'did:plc:test123',
          handle: 'test.bsky.social',
          displayName: 'Test User',
          avatar: undefined,
          description: undefined,
          followersCount: 0,
          followsCount: 0,
          postsCount: 0,
        },
      });

      const loginResult = await useAuthStore.getState().login('test.bsky.social', 'password');
      expect(loginResult.success).toBe(true);

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
      expect(state.user).toEqual({
        handle: 'test.bsky.social',
        did: 'did:plc:test123',
      });
      expect(state.error).toBeNull();
      expect(mockedAuthService.login).toHaveBeenCalledWith('test.bsky.social', 'password');
    });

    it('should handle login failure', async () => {
      mockedAuthService.login.mockResolvedValue({
        success: false,
        error: new AppError(ErrorCode.AUTH_FAILED, 'Invalid credentials'),
      });

      const loginResult = await useAuthStore.getState().login('invalid', 'wrong');
      expect(loginResult.success).toBe(false);

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.user).toBeNull();
      expect(state.error?.code).toBe(ErrorCode.AUTH_FAILED);
    });
  });

  describe('logout', () => {
    it('should successfully logout and clear state', async () => {
      mockedAuthService.logout.mockResolvedValue(undefined);

      // Set initial authenticated state
      useAuthStore.setState({
        isAuthenticated: true,
        user: { handle: 'test.bsky.social', did: 'did:plc:test123' },
        profile: {
          did: 'did:plc:test123',
          handle: 'test.bsky.social',
          displayName: 'Test User',
          avatar: undefined,
          description: undefined,
          followersCount: 0,
          followsCount: 0,
          postsCount: 0,
        },
      });

      await useAuthStore.getState().logout();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
      expect(state.profile).toBeNull();
      expect(state.error).toBeNull();
      expect(mockedAuthService.logout).toHaveBeenCalled();
    });
  });

  describe('checkAuth', () => {
    it('should return true if stored auth exists', async () => {
      mockedAuthService.getStoredAuth.mockResolvedValue({
        handle: 'test.bsky.social',
        did: 'did:plc:test123',
        accessToken: 'token',
        refreshToken: 'refresh',
      });

      const isAuthenticated = await useAuthStore.getState().checkAuth();

      expect(isAuthenticated).toBe(true);
      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.user).toEqual({
        handle: 'test.bsky.social',
        did: 'did:plc:test123',
      });
    });

    it('should return false if no stored auth', async () => {
      mockedAuthService.getStoredAuth.mockResolvedValue(null);

      const isAuthenticated = await useAuthStore.getState().checkAuth();

      expect(isAuthenticated).toBe(false);
      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
    });

    it('should handle errors gracefully', async () => {
      mockedAuthService.getStoredAuth.mockRejectedValue(new Error('Storage error'));

      const isAuthenticated = await useAuthStore.getState().checkAuth();

      expect(isAuthenticated).toBe(false);
      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
    });
  });

  describe('resumeSession', () => {
    it('should resume App Password session successfully', async () => {
      mockedAuthService.resumeSession.mockResolvedValue({
        success: true,
        data: undefined,
      });

      mockedAuthService.getStoredAuth.mockResolvedValue({
        handle: 'test.bsky.social',
        did: 'did:plc:test123',
        accessToken: 'token',
        refreshToken: 'refresh',
      });

      mockedAuthService.getProfile.mockResolvedValue({
        success: true,
        data: {
          did: 'did:plc:test123',
          handle: 'test.bsky.social',
          displayName: 'Test User',
          avatar: undefined,
          description: undefined,
          followersCount: 0,
          followsCount: 0,
          postsCount: 0,
        },
      });

      const resumeResult = await useAuthStore.getState().resumeSession();
      expect(resumeResult.success).toBe(true);

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.user).toEqual({
        handle: 'test.bsky.social',
        did: 'did:plc:test123',
      });
    });

    it('should handle resume session failure', async () => {
      mockedAuthService.resumeSession.mockResolvedValue({
        success: false,
        error: new AppError(ErrorCode.AUTH_FAILED, 'No session'),
      });

      const resumeResult = await useAuthStore.getState().resumeSession();
      expect(resumeResult.success).toBe(false);

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.error?.code).toBe(ErrorCode.AUTH_FAILED);
    });
  });

  describe('clearError', () => {
    it('should clear error state', () => {
      // Set error state
      useAuthStore.setState({
        error: new AppError(ErrorCode.AUTH_FAILED, 'Error'),
      });

      expect(useAuthStore.getState().error).not.toBeNull();

      // Clear error
      useAuthStore.getState().clearError();

      expect(useAuthStore.getState().error).toBeNull();
    });
  });

  describe('fetchProfile', () => {
    it('should fetch profile from API', async () => {
      const mockProfile = {
        did: 'did:plc:test123',
        handle: 'test.bsky.social',
        displayName: 'Test User',
        avatar: 'https://example.com/avatar.jpg',
        description: 'Test description',
        followersCount: 10,
        followsCount: 5,
        postsCount: 20,
      };

      mockedAuthService.getProfile.mockResolvedValue({
        success: true,
        data: mockProfile,
      });

      const profileResult = await useAuthStore.getState().fetchProfile();
      expect(profileResult.success).toBe(true);
      if (profileResult.success) {
        expect(profileResult.data).toEqual(mockProfile);
      }

      const state = useAuthStore.getState();
      expect(state.profile).toEqual(mockProfile);
      expect(state.isProfileLoading).toBe(false);
    });

    it('should return cached profile if available', async () => {
      const mockProfile = {
        did: 'did:plc:test123',
        handle: 'test.bsky.social',
        displayName: 'Test User',
        avatar: undefined,
        description: undefined,
        followersCount: 0,
        followsCount: 0,
        postsCount: 0,
      };

      // Set cached profile
      useAuthStore.setState({ profile: mockProfile });

      const profileResult = await useAuthStore.getState().fetchProfile();
      expect(profileResult.success).toBe(true);

      // Should not call API
      expect(mockedAuthService.getProfile).not.toHaveBeenCalled();
      expect(useAuthStore.getState().profile).toEqual(mockProfile);
    });

    it('should handle profile fetch failure', async () => {
      mockedAuthService.getProfile.mockResolvedValue({
        success: false,
        error: new AppError(ErrorCode.API_ERROR, 'Failed to fetch profile'),
      });

      const profileResult = await useAuthStore.getState().fetchProfile();
      expect(profileResult.success).toBe(false);

      const state = useAuthStore.getState();
      expect(state.profile).toBeNull();
      expect(state.isProfileLoading).toBe(false);
    });
  });

  describe('refreshProfile', () => {
    it('should force fetch profile from API', async () => {
      const mockProfile = {
        did: 'did:plc:test123',
        handle: 'test.bsky.social',
        displayName: 'Updated User',
        avatar: 'https://example.com/new-avatar.jpg',
        description: 'Updated description',
        followersCount: 15,
        followsCount: 8,
        postsCount: 25,
      };

      mockedAuthService.getProfile.mockResolvedValue({
        success: true,
        data: mockProfile,
      });

      // Set old cached profile
      useAuthStore.setState({
        profile: {
          did: 'did:plc:test123',
          handle: 'test.bsky.social',
          displayName: 'Old User',
          avatar: undefined,
          description: undefined,
          followersCount: 0,
          followsCount: 0,
          postsCount: 0,
        },
      });

      await useAuthStore.getState().refreshProfile();

      // Should call API and update profile
      expect(mockedAuthService.getProfile).toHaveBeenCalled();
      expect(useAuthStore.getState().profile).toEqual(mockProfile);
    });
  });
});
