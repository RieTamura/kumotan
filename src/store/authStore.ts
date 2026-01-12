/**
 * Authentication State Store
 * Manages authentication state using Zustand
 */

import { create } from 'zustand';
import { StoredAuth, BlueskyProfile } from '../types/bluesky';
import * as AuthService from '../services/bluesky/auth';
import { Result } from '../types/result';
import { AppError, ErrorCode } from '../utils/errors';

/**
 * Auth store state interface
 */
interface AuthState {
  // State
  isAuthenticated: boolean;
  isLoading: boolean;
  user: {
    handle: string;
    did: string;
  } | null;
  error: AppError | null;
  profile: BlueskyProfile | null;
  isProfileLoading: boolean;

  // Actions
  login: (identifier: string, appPassword: string) => Promise<Result<void, AppError>>;
  loginWithOAuth: (handle: string) => Promise<Result<void, AppError>>;
  completeOAuth: (callbackUrl: string) => Promise<Result<void, AppError>>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<boolean>;
  resumeSession: () => Promise<Result<void, AppError>>;
  clearError: () => void;
  fetchProfile: () => Promise<Result<BlueskyProfile, AppError>>;
  refreshProfile: () => Promise<void>;
}

/**
 * Auth store using Zustand
 */
export const useAuthStore = create<AuthState>((set, get) => ({
  // Initial state
  isAuthenticated: false,
  isLoading: true,
  user: null,
  error: null,
  profile: null,
  isProfileLoading: false,

  /**
   * Login with identifier and app password
   */
  login: async (identifier: string, appPassword: string) => {
    set({ isLoading: true, error: null });

    const result = await AuthService.login(identifier, appPassword);

    if (result.success) {
      set({
        isAuthenticated: true,
        isLoading: false,
        user: {
          handle: result.data.handle,
          did: result.data.did,
        },
        error: null,
      });

      // Fetch profile automatically after login
      get().fetchProfile();

      return { success: true, data: undefined };
    } else {
      set({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        error: result.error,
      });
      return result;
    }
  },

  /**
   * Login with OAuth - Start OAuth flow
   * Note: Changed from @atproto/oauth-client-expo to custom implementation
   * Opens browser for authentication, completeOAuth handles the callback
   */
  loginWithOAuth: async (handle: string) => {
    set({ isLoading: true, error: null });

    const result = await AuthService.startOAuthFlow(handle);

    if (result.success) {
      // OAuth flow started successfully - browser opened
      // Keep loading state true until completeOAuth is called
      return { success: true, data: undefined };
    } else {
      // Failed to start OAuth flow
      set({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        error: result.error,
      });
      return result;
    }
  },

  /**
   * Complete OAuth flow after callback
   * Called when app receives deep link callback from OAuth provider
   */
  completeOAuth: async (callbackUrl: string) => {
    // Keep loading state from loginWithOAuth
    set({ error: null });

    const result = await AuthService.completeOAuthFlow(callbackUrl);

    if (result.success) {
      set({
        isAuthenticated: true,
        isLoading: false,
        user: {
          handle: result.data.handle,
          did: result.data.did,
        },
        error: null,
      });

      // Fetch profile automatically after OAuth login
      get().fetchProfile();

      return { success: true, data: undefined };
    } else {
      set({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        error: result.error,
      });
      return result;
    }
  },

  /**
   * Logout and clear all auth state
   */
  logout: async () => {
    set({ isLoading: true });
    await AuthService.logout();
    await AuthService.clearOAuthSession(); // Clear OAuth session data
    set({
      isAuthenticated: false,
      isLoading: false,
      user: null,
      error: null,
      profile: null,
      isProfileLoading: false,
    });
  },

  /**
   * Check if user is authenticated (has stored tokens)
   */
  checkAuth: async () => {
    set({ isLoading: true });

    try {
      const storedAuth = await AuthService.getStoredAuth();

      if (storedAuth) {
        set({
          isAuthenticated: true,
          isLoading: false,
          user: {
            handle: storedAuth.handle,
            did: storedAuth.did,
          },
        });
        return true;
      } else {
        set({
          isAuthenticated: false,
          isLoading: false,
          user: null,
        });
        return false;
      }
    } catch (error) {
      set({
        isAuthenticated: false,
        isLoading: false,
        user: null,
      });
      return false;
    }
  },

  /**
   * Resume session from stored tokens
   * Tries App Password session first, then OAuth session
   */
  resumeSession: async () => {
    set({ isLoading: true, error: null });

    // Try to resume App Password session first
    let result = await AuthService.resumeSession();

    // If App Password session fails, try OAuth session restoration
    if (!result.success) {
      const oauthResult = await AuthService.restoreOAuthSession();
      // Map BlueskySession to void for consistency
      if (oauthResult.success) {
        result = { success: true, data: undefined };
      } else {
        result = oauthResult;
      }
    }

    if (result.success) {
      const storedAuth = await AuthService.getStoredAuth();
      if (storedAuth) {
        set({
          isAuthenticated: true,
          isLoading: false,
          user: {
            handle: storedAuth.handle,
            did: storedAuth.did,
          },
          error: null,
        });

        // Fetch profile automatically after session resume
        get().fetchProfile();
      }
      return { success: true, data: undefined };
    } else {
      set({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        error: result.error,
      });
      return { success: false, error: result.error };
    }
  },

  /**
   * Clear error state
   */
  clearError: () => {
    set({ error: null });
  },

  /**
   * Fetch user profile
   * Returns cached profile if available, otherwise fetches from API
   */
  fetchProfile: async () => {
    const currentProfile = get().profile;
    
    // Return cached profile if available
    if (currentProfile) {
      return { success: true, data: currentProfile };
    }
    
    set({ isProfileLoading: true });
    
    const result = await AuthService.getProfile();
    
    if (result.success) {
      set({
        profile: result.data,
        isProfileLoading: false,
      });
      return result;
    } else {
      set({ isProfileLoading: false });
      return result;
    }
  },

  /**
   * Refresh user profile from API
   * Forces a fresh fetch regardless of cache
   */
  refreshProfile: async () => {
    set({ isProfileLoading: true });
    
    const result = await AuthService.getProfile();
    
    if (result.success) {
      set({
        profile: result.data,
        isProfileLoading: false,
      });
    } else {
      set({ isProfileLoading: false });
    }
  },
}));

/**
 * Selector hooks for specific state pieces
 */
export const useIsAuthenticated = () => useAuthStore((state) => state.isAuthenticated);
export const useIsAuthLoading = () => useAuthStore((state) => state.isLoading);
export const useAuthUser = () => useAuthStore((state) => state.user);
export const useAuthError = () => useAuthStore((state) => state.error);
export const useAuthProfile = () => useAuthStore((state) => state.profile);
export const useIsProfileLoading = () => useAuthStore((state) => state.isProfileLoading);
