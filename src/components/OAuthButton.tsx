/**
 * OAuth Button Component
 * Simplified button for OAuth authentication using @atproto/oauth-client-expo
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from './common/Button';
import { Input } from './common/Input';
import { useOAuthFlow } from '../hooks/useOAuthFlow';
import { Colors, Spacing, FontSizes } from '../constants/colors';

/**
 * OAuth Button props
 */
interface OAuthButtonProps {
  disabled?: boolean;
}

/**
 * OAuthButton Component
 * Renders handle input and button to start OAuth authentication
 */
export function OAuthButton({ disabled = false }: OAuthButtonProps): React.JSX.Element {
  const { isLoading, error, handle, setHandle, startOAuthFlow, clearError } = useOAuthFlow();

  // Clear error when user starts typing
  const handleChange = (text: string) => {
    if (error) {
      clearError();
    }
    setHandle(text);
  };

  return (
    <View style={styles.container}>
      {/* Handle Input */}
      <Input
        label="Blueskyハンドル"
        placeholder="user.bsky.social"
        value={handle}
        onChangeText={handleChange}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="username"
        returnKeyType="go"
        onSubmitEditing={startOAuthFlow}
        editable={!isLoading && !disabled}
        hint="ハンドル名またはDIDを入力"
      />

      <Button
        title={isLoading ? '認証中...' : 'Blueskyでログイン'}
        onPress={startOAuthFlow}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  button: {
    marginTop: Spacing.md,
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
});

export default OAuthButton;
