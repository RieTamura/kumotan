/**
 * Login Screen
 * Handles Bluesky authentication with App Password
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Linking,
  TextInput as RNTextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Spacing, FontSizes, BorderRadius } from '../constants/colors';
import { APP_INFO, EXTERNAL_LINKS } from '../constants/config';
import { useAuthStore } from '../store/authStore';
import { Validators, sanitizeHandle, sanitizeApiKey } from '../utils/validators';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { StaticOfflineBanner } from '../components/OfflineBanner';
import { OAuthButton } from '../components/OAuthButton';

/**
 * LoginScreen Component
 */
export function LoginScreen(): React.JSX.Element {
  // Auth store
  const { login, isLoading, error, clearError } = useAuthStore();

  // Network status
  const isConnected = useNetworkStatus();

  // Form state
  const [identifier, setIdentifier] = useState('');
  const [appPassword, setAppPassword] = useState('');
  const [showAppPasswordForm, setShowAppPasswordForm] = useState(false);

  // Validation errors
  const [identifierError, setIdentifierError] = useState<string | undefined>();
  const [appPasswordError, setAppPasswordError] = useState<string | undefined>();

  // Refs for input focus
  const passwordInputRef = useRef<RNTextInput>(null);

  /**
   * Validate identifier input
   */
  const validateIdentifier = useCallback((value: string): boolean => {
    const result = Validators.validateHandle(value);
    setIdentifierError(result.isValid ? undefined : result.error);
    return result.isValid;
  }, []);

  /**
   * Validate app password input
   */
  const validateAppPassword = useCallback((value: string): boolean => {
    const result = Validators.validateAppPassword(value);
    setAppPasswordError(result.isValid ? undefined : result.error);
    return result.isValid;
  }, []);

  /**
   * Handle identifier change
   */
  const handleIdentifierChange = useCallback((text: string) => {
    setIdentifier(text);
    // Clear error when user starts typing
    if (identifierError) {
      setIdentifierError(undefined);
    }
    // Clear auth error
    if (error) {
      clearError();
    }
  }, [identifierError, error, clearError]);

  /**
   * Handle app password change
   */
  const handleAppPasswordChange = useCallback((text: string) => {
    setAppPassword(text);
    if (appPasswordError) {
      setAppPasswordError(undefined);
    }
    if (error) {
      clearError();
    }
  }, [appPasswordError, error, clearError]);

  /**
   * Handle login button press
   */
  const handleLogin = useCallback(async () => {
    // Check network connectivity
    if (!isConnected) {
      Alert.alert(
        'オフライン',
        'ネットワーク接続を確認してください。',
        [{ text: 'OK' }]
      );
      return;
    }

    // Validate inputs
    const isIdentifierValid = validateIdentifier(identifier);
    const isAppPasswordValid = validateAppPassword(appPassword);

    if (!isIdentifierValid || !isAppPasswordValid) {
      return;
    }

    // Sanitize inputs
    const sanitizedIdentifier = sanitizeHandle(identifier);
    const sanitizedPassword = sanitizeApiKey(appPassword);

    // Attempt login
    const result = await login(sanitizedIdentifier, sanitizedPassword);

    if (!result.success) {
      // Error is already set in the store
      // Show alert for network errors
      if (result.error.code === 'NETWORK_ERROR') {
        Alert.alert(
          'ネットワークエラー',
          result.error.message,
          [{ text: 'OK' }]
        );
      }
    }
  }, [identifier, appPassword, isConnected, validateIdentifier, validateAppPassword, login]);

  /**
   * Handle App Password help link press
   */
  const handleAppPasswordHelp = useCallback(async () => {
    try {
      const canOpen = await Linking.canOpenURL(EXTERNAL_LINKS.BLUESKY_APP_PASSWORDS);
      if (canOpen) {
        await Linking.openURL(EXTERNAL_LINKS.BLUESKY_APP_PASSWORDS);
      } else {
        Alert.alert(
          'リンクを開けません',
          'ブラウザでBlueskyの設定ページを開いてください。',
          [{ text: 'OK' }]
        );
      }
    } catch (err) {
      console.error('Failed to open URL:', err);
    }
  }, []);

  /**
   * Handle identifier submit (move to password field)
   */
  const handleIdentifierSubmit = useCallback(() => {
    passwordInputRef.current?.focus();
  }, []);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StaticOfflineBanner visible={!isConnected} />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.appName}>{APP_INFO.NAME}</Text>
            <Text style={styles.tagline}>{APP_INFO.DESCRIPTION}</Text>
          </View>

          {/* Description */}
          <View style={styles.descriptionContainer}>
            <Text style={styles.description}>
              Blueskyで英語学習！{'\n'}
              タイムラインから単語を保存して、{'\n'}
              あなただけの単語帳を作ろう
            </Text>
          </View>

          {/* Login Form */}
          <View style={styles.formContainer}>
            {/* Auth Error Display */}
            {error && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>
                  {error.getUserMessage()}
                </Text>
              </View>
            )}

            {/* OAuth Login (Primary) */}
            <View style={styles.oauthSection}>
              <OAuthButton disabled={!isConnected} />
            </View>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>または</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* App Password Login (Advanced Option) */}
            <View style={styles.appPasswordSection}>
              {!showAppPasswordForm ? (
                <Pressable
                  onPress={() => setShowAppPasswordForm(true)}
                  style={styles.advancedOptionButton}
                >
                  <Text style={styles.advancedOptionText}>
                    App Passwordでログイン
                  </Text>
                </Pressable>
              ) : (
                <>
                  {/* Identifier Input */}
                  <Input
                    label="ユーザー名"
                    placeholder="user.bsky.social"
                    value={identifier}
                    onChangeText={handleIdentifierChange}
                    error={identifierError}
                    hint="Blueskyのハンドル名またはメールアドレス"
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    textContentType="username"
                    returnKeyType="next"
                    onSubmitEditing={handleIdentifierSubmit}
                    editable={!isLoading}
                  />

                  {/* App Password Input */}
                  <Input
                    ref={passwordInputRef}
                    label="App Password"
                    placeholder="xxxx-xxxx-xxxx-xxxx"
                    value={appPassword}
                    onChangeText={handleAppPasswordChange}
                    error={appPasswordError}
                    secureTextEntry
                    showPasswordToggle
                    autoCapitalize="none"
                    autoCorrect={false}
                    textContentType="password"
                    returnKeyType="done"
                    onSubmitEditing={handleLogin}
                    editable={!isLoading}
                  />

                  {/* App Password Help Link */}
                  <Pressable
                    onPress={handleAppPasswordHelp}
                    style={styles.helpLink}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text style={styles.helpLinkText}>
                      App Passwordの取得方法 →
                    </Text>
                  </Pressable>

                  {/* Login Button */}
                  <Button
                    title={isLoading ? 'ログイン中...' : 'ログイン'}
                    onPress={handleLogin}
                    loading={isLoading}
                    disabled={!isConnected || isLoading}
                    fullWidth
                    size="large"
                    style={styles.loginButton}
                  />

                  {/* Security Note */}
                  <View style={styles.securityNote}>
                    <Text style={styles.securityNoteText}>
                      🔒 App Passwordは認証にのみ使用され、保存されません。
                    </Text>
                  </View>

                  {/* Hide Form Button */}
                  <Pressable
                    onPress={() => setShowAppPasswordForm(false)}
                    style={styles.hideFormButton}
                  >
                    <Text style={styles.hideFormText}>
                      フォームを閉じる
                    </Text>
                  </Pressable>
                </>
              )}
            </View>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              バージョン {APP_INFO.VERSION}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  header: {
    alignItems: 'center',
    marginTop: Spacing.xxl,
    marginBottom: Spacing.lg,
  },
  appName: {
    fontSize: FontSizes.xxxl,
    fontWeight: '700',
    color: Colors.primary,
    marginBottom: Spacing.xs,
  },
  tagline: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
  },
  descriptionContainer: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  description: {
    fontSize: FontSizes.lg,
    color: Colors.text,
    textAlign: 'center',
    lineHeight: 28,
  },
  formContainer: {
    flex: 1,
  },
  errorBanner: {
    backgroundColor: Colors.errorLight,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: Colors.error,
  },
  errorBannerText: {
    color: Colors.error,
    fontSize: FontSizes.md,
  },
  helpLink: {
    alignSelf: 'flex-start',
    marginBottom: Spacing.xl,
  },
  helpLinkText: {
    color: Colors.primary,
    fontSize: FontSizes.md,
    fontWeight: '500',
  },
  loginButton: {
    marginTop: Spacing.md,
  },
  securityNote: {
    marginTop: Spacing.lg,
    padding: Spacing.md,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: BorderRadius.md,
  },
  securityNoteText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  footer: {
    alignItems: 'center',
    marginTop: Spacing.xxl,
    paddingTop: Spacing.lg,
  },
  footerText: {
    fontSize: FontSizes.sm,
    color: Colors.textTertiary,
  },
  // OAuth Section
  oauthSection: {
    marginBottom: Spacing.lg,
  },
  // Divider
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.xl,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginHorizontal: Spacing.md,
  },
  // App Password Section
  appPasswordSection: {
    marginBottom: Spacing.lg,
  },
  advancedOptionButton: {
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  advancedOptionText: {
    fontSize: FontSizes.md,
    color: Colors.primary,
    fontWeight: '500',
  },
  hideFormButton: {
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  hideFormText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
});

export default LoginScreen;
