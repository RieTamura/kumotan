/**
 * Authentication State Store
 * Manages authentication state using Zustand
 */

import { create } from 'zustand';
import { StoredAuth, BlueskyProfile } from '../types/bluesky';
import * as AuthService from '../services/bluesky/auth';
import * as ProfileCache from '../services/cache/profileCache';
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
  logout: () => Promise<void>;
  checkAuth: () => Promise<boolean>;
  resumeSession: () => Promise<Result<void, AppError>>;
  clearError: () => void;
  fetchProfile: () => Promise<Result<BlueskyProfile, AppError>>;
  refreshProfile: () => Promise<void>;
  loadCachedProfile: () => Promise<void>;
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
   * Note: Now handles the complete flow including browser interaction and session creation
   */
  loginWithOAuth: async (handle: string) => {
    set({ isLoading: true, error: null });

    const result = await AuthService.startOAuthFlow(handle);

    if (result.success) {
      // With the new implementation, success means the session is established
      const userDid = await AuthService.getCurrentDid();
      const userHandle = await AuthService.getCurrentHandle();

      if (userDid && userHandle) {
        set({
          isAuthenticated: true,
          isLoading: false,
          user: {
            handle: userHandle,
            did: userDid,
          },
          error: null,
        });

        // Fetch profile
        get().fetchProfile();

        return { success: true, data: undefined };
      }
    }

    // Fallback if failed or no data
    const error = !result.success ? result.error : new AppError(ErrorCode.OAUTH_ERROR, 'Login succeeded but user data missing');

    set({
      isAuthenticated: false,
      isLoading: false,
      user: null,
      error: error,
    });
    return result.success ? { success: false, error } : result;
  },

  /**
   * Logout and clear all auth state
   */
  logout: async () => {
    set({ isLoading: true });
    await AuthService.logout();
    await ProfileCache.clearProfileCache();
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
   */
  resumeSession: async () => {
    set({ isLoading: true, error: null });

    const result = await AuthService.resumeSession();

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

        // Fetch profile
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
   * Fetch user profile with cache support
   * - Returns cached profile immediately if available
   * - Fetches from API in background if cache is stale
   */
  fetchProfile: async () => {
    const currentProfile = get().profile;
    const user = get().user;

    // Return current profile if already loaded
    if (currentProfile) {
      return { success: true, data: currentProfile };
    }

    // Try to load from cache first
    if (user?.did) {
      const cachedProfile = await ProfileCache.loadProfileFromCache(user.did);
      if (cachedProfile) {
        set({ profile: cachedProfile });

        // Check if cache is stale and refresh in background
        const isStale = await ProfileCache.isCacheStale(user.did);
        if (isStale) {
          // Background refresh without loading state
          AuthService.getProfile().then((result) => {
            if (result.success) {
              set({ profile: result.data });
              ProfileCache.saveProfileToCache(result.data, user.did);
            }
          });
        }

        return { success: true, data: cachedProfile };
      }
    }

    // No cache, fetch from API
    set({ isProfileLoading: true });

    const result = await AuthService.getProfile();

    if (result.success) {
      set({
        profile: result.data,
        isProfileLoading: false,
      });

      // Save to cache
      if (user?.did) {
        ProfileCache.saveProfileToCache(result.data, user.did);
      }

      return result;
    } else {
      // Try to use stale cache as fallback
      if (user?.did) {
        const staleProfile = await ProfileCache.getCachedProfileForOffline(user.did);
        if (staleProfile) {
          set({
            profile: staleProfile,
            isProfileLoading: false,
          });
          return { success: true, data: staleProfile };
        }
      }

      set({ isProfileLoading: false });
      return result;
    }
  },

  /**
   * Refresh user profile from API (ignores cache)
   */
  refreshProfile: async () => {
    const user = get().user;
    set({ isProfileLoading: true });

    const result = await AuthService.getProfile();

    if (result.success) {
      set({
        profile: result.data,
        isProfileLoading: false,
      });

      // Update cache
      if (user?.did) {
        ProfileCache.saveProfileToCache(result.data, user.did);
      }
    } else {
      set({ isProfileLoading: false });
    }
  },

  /**
   * Load cached profile on app startup (before API call)
   */
  loadCachedProfile: async () => {
    const user = get().user;
    if (!user?.did) return;

    const cachedProfile = await ProfileCache.getCachedProfileForOffline(user.did);
    if (cachedProfile && !get().profile) {
      set({ profile: cachedProfile });
    }
  },
}));

/**
 * Selector hooks
 */
export const useIsAuthenticated = () => useAuthStore((state) => state.isAuthenticated);
export const useIsAuthLoading = () => useAuthStore((state) => state.isLoading);
export const useAuthUser = () => useAuthStore((state) => state.user);
export const useAuthError = () => useAuthStore((state) => state.error);
export const useAuthProfile = () => useAuthStore((state) => state.profile);
export const useIsProfileLoading = () => useAuthStore((state) => state.isProfileLoading);
