/**
 * OAuth Button Component
 * Button to initiate OAuth authentication with Bluesky
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from './common/Button';
import { useOAuthFlow } from '../hooks/useOAuthFlow';
import { Colors, Spacing, FontSizes, BorderRadius } from '../constants/colors';

/**
 * OAuth Button props
 */
interface OAuthButtonProps {
  disabled?: boolean;
}

/**
 * OAuthButton Component
 * Renders a button to start OAuth authentication flow
 */
export function OAuthButton({ disabled = false }: OAuthButtonProps): React.JSX.Element {
  const { isLoading, error, startOAuthFlow, clearError } = useOAuthFlow();

  // Clear error when user interacts with button
  const handlePress = () => {
    if (error) {
      clearError();
    }
    startOAuthFlow();
  };

  return (
    <View style={styles.container}>
      <Button
        title={isLoading ? 'ブラウザを起動中...' : 'Blueskyでログイン'}
        onPress={handlePress}
        loading={isLoading}
        disabled={disabled || isLoading}
        variant="primary"
        size="large"
        fullWidth
        style={styles.button}
      />

      {/* OAuth Info */}
      <View style={styles.infoContainer}>
        <Text style={styles.infoText}>
          🔒 Blueskyの公式ログイン画面で安全に認証
        </Text>
      </View>

      {/* Error Display */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            {error.getUserMessage()}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  button: {
    marginBottom: Spacing.md,
  },
  infoContainer: {
    paddingHorizontal: Spacing.sm,
  },
  infoText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  errorContainer: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.errorLight,
    borderRadius: BorderRadius.md,
    borderLeftWidth: 4,
    borderLeftColor: Colors.error,
  },
  errorText: {
    fontSize: FontSizes.sm,
    color: Colors.error,
  },
});

export default OAuthButton;
