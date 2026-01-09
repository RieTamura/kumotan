/**
 * OAuth Flow Hook
 * Simplified hook for OAuth authentication using @atproto/oauth-client-expo
 */

import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { AppError } from '../utils/errors';

/**
 * OAuth flow state
 */
interface OAuthFlowState {
  isLoading: boolean;
  error: AppError | null;
  handle: string;
}

/**
 * OAuth flow hook return type
 */
interface UseOAuthFlowReturn {
  isLoading: boolean;
  error: AppError | null;
  handle: string;
  setHandle: (handle: string) => void;
  startOAuthFlow: () => Promise<void>;
  clearError: () => void;
}

/**
 * Custom hook to manage OAuth authentication flow
 *
 * @returns OAuth flow controls and state
 *
 * @example
 * ```tsx
 * const { isLoading, error, handle, setHandle, startOAuthFlow } = useOAuthFlow();
 *
 * <TextInput value={handle} onChangeText={setHandle} />
 * <Button onPress={startOAuthFlow} loading={isLoading}>
 *   ログイン with Bluesky
 * </Button>
 * ```
 */
export function useOAuthFlow(): UseOAuthFlowReturn {
  const [state, setState] = useState<OAuthFlowState>({
    isLoading: false,
    error: null,
    handle: '',
  });

  const { loginWithOAuth } = useAuthStore();

  /**
   * Set handle value
   */
  const setHandle = useCallback((handle: string) => {
    setState(prev => ({ ...prev, handle, error: null }));
  }, []);

  /**
   * Start the OAuth authentication flow
   * ExpoOAuthClient automatically handles browser opening and callback
   */
  const startOAuthFlow = useCallback(async () => {
    if (!state.handle.trim()) {
      Alert.alert('エラー', 'ハンドル名を入力してください。');
      return;
    }

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      // Start OAuth flow - ExpoOAuthClient handles everything
      const result = await loginWithOAuth(state.handle.trim());

      if (!result.success) {
        setState(prev => ({ ...prev, isLoading: false, error: result.error }));

        // Show alert for errors
        Alert.alert(
          'ログインエラー',
          result.error.getUserMessage(),
          [{ text: 'OK' }]
        );
      } else {
        // Success - auth store will handle state update
        setState(prev => ({ ...prev, isLoading: false, error: null }));
      }
    } catch (error) {
      console.error('OAuth flow error:', error);
      const appError = error instanceof AppError
        ? error
        : new AppError(
            'OAUTH_ERROR' as any,
            error instanceof Error ? error.message : 'OAuth認証中にエラーが発生しました',
            { originalError: error }
          );

      setState(prev => ({ ...prev, isLoading: false, error: appError }));

      Alert.alert(
        'エラー',
        appError.getUserMessage(),
        [{ text: 'OK' }]
      );
    }
  }, [state.handle, loginWithOAuth]);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  return {
    isLoading: state.isLoading,
    error: state.error,
    handle: state.handle,
    setHandle,
    startOAuthFlow,
    clearError,
  };
}
