/**
 * Authentication State Store
 * Manages authentication state using Zustand
 */

import { create } from 'zustand';
import { StoredAuth } from '../types/bluesky';
import * as AuthService from '../services/bluesky/auth';
import { Result } from '../types/result';
import { AppError } from '../utils/errors';

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

  // Actions
  login: (identifier: string, appPassword: string) => Promise<Result<void, AppError>>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<boolean>;
  resumeSession: () => Promise<Result<void, AppError>>;
  clearError: () => void;
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
    set({
      isAuthenticated: false,
      isLoading: false,
      user: null,
      error: null,
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
      }
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
   * Clear error state
   */
  clearError: () => {
    set({ error: null });
  },
}));

/**
 * Selector hooks for specific state pieces
 */
export const useIsAuthenticated = () => useAuthStore((state) => state.isAuthenticated);
export const useIsAuthLoading = () => useAuthStore((state) => state.isLoading);
export const useAuthUser = () => useAuthStore((state) => state.user);
export const useAuthError = () => useAuthStore((state) => state.error);
