/**
 * OAuth Flow Hook
 * Manages the OAuth authentication flow with Bluesky
 */

import { useState, useCallback } from 'react';
import { Linking, Alert } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { AppError, ErrorCode } from '../utils/errors';

/**
 * OAuth flow state
 */
interface OAuthFlowState {
  isLoading: boolean;
  error: AppError | null;
}

/**
 * OAuth flow hook return type
 */
interface UseOAuthFlowReturn {
  isLoading: boolean;
  error: AppError | null;
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
 * const { isLoading, error, startOAuthFlow, clearError } = useOAuthFlow();
 *
 * <Button onPress={startOAuthFlow} loading={isLoading}>
 *   ログイン with Bluesky
 * </Button>
 * ```
 */
export function useOAuthFlow(): UseOAuthFlowReturn {
  const [state, setState] = useState<OAuthFlowState>({
    isLoading: false,
    error: null,
  });

  const { startOAuth } = useAuthStore();

  /**
   * Start the OAuth authentication flow
   * Opens the browser for user authorization
   */
  const startOAuthFlow = useCallback(async () => {
    try {
      setState({ isLoading: true, error: null });

      // Start OAuth flow - this will generate the authorization URL
      const result = await startOAuth();

      if (!result.success) {
        setState({ isLoading: false, error: result.error });

        // Show alert for critical errors
        if (result.error.code === 'NETWORK_ERROR') {
          Alert.alert(
            'ネットワークエラー',
            result.error.message,
            [{ text: 'OK' }]
          );
        }
        return;
      }

      // Open the authorization URL in browser
      const authUrl = result.data?.authorizationUrl;
      if (!authUrl) {
        const error = new AppError(
          ErrorCode.OAUTH_ERROR,
          'OAuth URLの生成に失敗しました',
          { context: 'useOAuthFlow.startOAuthFlow' }
        );
        setState({ isLoading: false, error });
        return;
      }

      const canOpen = await Linking.canOpenURL(authUrl);
      if (!canOpen) {
        const error = new AppError(
          ErrorCode.OAUTH_ERROR,
          'ブラウザを開けませんでした',
          { context: 'useOAuthFlow.startOAuthFlow', url: authUrl }
        );
        setState({ isLoading: false, error });
        Alert.alert(
          'エラー',
          'ブラウザを開けませんでした。デバイスの設定を確認してください。',
          [{ text: 'OK' }]
        );
        return;
      }

      // Open browser for OAuth authorization
      await Linking.openURL(authUrl);

      // Keep loading state until callback is handled
      // The loading state will be cleared when the app receives the deep link callback
      // or when the user cancels (handled by clearError or timeout)

    } catch (error) {
      console.error('OAuth flow error:', error);
      const appError = error instanceof AppError
        ? error
        : new AppError(
            ErrorCode.OAUTH_ERROR,
            error instanceof Error ? error.message : 'OAuth認証中にエラーが発生しました',
            { originalError: error }
          );

      setState({ isLoading: false, error: appError });

      Alert.alert(
        'エラー',
        appError.getUserMessage(),
        [{ text: 'OK' }]
      );
    }
  }, [startOAuth]);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  return {
    isLoading: state.isLoading,
    error: state.error,
    startOAuthFlow,
    clearError,
  };
}
