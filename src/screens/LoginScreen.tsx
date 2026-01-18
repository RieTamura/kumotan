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
import { useTranslation } from 'react-i18next';
import { Colors, Spacing, FontSizes, BorderRadius } from '../constants/colors';
import { APP_INFO, EXTERNAL_LINKS } from '../constants/config';
import { useAuthStore } from '../store/authStore';
import { Validators, sanitizeHandle, sanitizeApiKey } from '../utils/validators';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { StaticOfflineBanner } from '../components/OfflineBanner';

/**
 * LoginScreen Component
 */
export function LoginScreen(): React.JSX.Element {
  const { t } = useTranslation('login');
  const { t: tc } = useTranslation('common');

  // Auth store
  const { login, loginWithOAuth, isLoading, error, clearError } = useAuthStore();

  // Network status
  const isConnected = useNetworkStatus();

  // Form state
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  // Validation errors
  const [identifierError, setIdentifierError] = useState<string | undefined>();
  const [passwordError, setPasswordError] = useState<string | undefined>();

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
   * Validate password input
   */
  const validatePassword = useCallback((value: string): boolean => {
    const result = Validators.validateAppPassword(value);
    setPasswordError(result.isValid ? undefined : result.error);
    return result.isValid;
  }, []);

  /**
   * Handle identifier change
   */
  const handleIdentifierChange = useCallback((text: string) => {
    setIdentifier(text);
    if (identifierError) setIdentifierError(undefined);
    if (error) clearError();
  }, [identifierError, error, clearError]);

  /**
   * Handle password change
   */
  const handlePasswordChange = useCallback((text: string) => {
    setPassword(text);
    if (passwordError) setPasswordError(undefined);
    if (error) clearError();
  }, [passwordError, error, clearError]);

  /**
   * Handle OAuth Login
   * Note: We now require password input even for OAuth to ensure 
   * security and consistency as requested by the user.
   */
  const handleOAuthLogin = useCallback(async () => {
    if (!isConnected) {
      Alert.alert(t('errors.offline'), t('errors.offlineMessage'), [{ text: tc('buttons.ok') }]);
      return;
    }

    const isIdentifierValid = validateIdentifier(identifier);
    const isPasswordValid = validatePassword(password);

    if (!isIdentifierValid || !isPasswordValid) return;

    const sanitizedIdentifier = sanitizeHandle(identifier);
    const result = await loginWithOAuth(sanitizedIdentifier);

    if (!result.success) {
      if (result.error.code === 'NETWORK_ERROR') {
        Alert.alert(t('errors.networkError'), result.error.message, [{ text: tc('buttons.ok') }]);
      }
    }
  }, [identifier, password, isConnected, validateIdentifier, validatePassword, loginWithOAuth, t, tc]);

  /**
   * Handle App Password login
   */
  const handleAppPasswordLogin = useCallback(async () => {
    if (!isConnected) {
      Alert.alert(t('errors.offline'), t('errors.offlineMessage'), [{ text: tc('buttons.ok') }]);
      return;
    }

    const isIdentifierValid = validateIdentifier(identifier);
    const isPasswordValid = validatePassword(password);

    if (!isIdentifierValid || !isPasswordValid) return;

    const sanitizedIdentifier = sanitizeHandle(identifier);
    const sanitizedPassword = sanitizeApiKey(password);

    const result = await login(sanitizedIdentifier, sanitizedPassword);

    if (!result.success && result.error.code === 'NETWORK_ERROR') {
      Alert.alert(t('errors.networkError'), result.error.message, [{ text: tc('buttons.ok') }]);
    }
  }, [identifier, password, isConnected, validateIdentifier, validatePassword, login, t, tc]);

  /**
   * Handle password help link
   */
  const handleAppPasswordHelp = useCallback(async () => {
    try {
      const canOpen = await Linking.canOpenURL(EXTERNAL_LINKS.BLUESKY_APP_PASSWORDS);
      if (canOpen) {
        await Linking.openURL(EXTERNAL_LINKS.BLUESKY_APP_PASSWORDS);
      }
    } catch (err) {
      console.error('Failed to open URL:', err);
    }
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
              {t('description')}
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

            {/* Identifier Input */}
            <Input
              label={t('handle.label')}
              placeholder={t('handle.placeholder')}
              value={identifier}
              onChangeText={handleIdentifierChange}
              error={identifierError}
              hint={t('handle.hint')}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="username"
              returnKeyType="next"
              onSubmitEditing={() => passwordInputRef.current?.focus()}
              editable={!isLoading}
            />

            {/* Password Input (Used for App Password, always shown per user request) */}
            <Input
              ref={passwordInputRef}
              label={t('appPassword.label')}
              placeholder={t('appPassword.placeholder')}
              value={password}
              onChangeText={handlePasswordChange}
              error={passwordError}
              secureTextEntry
              showPasswordToggle
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="password"
              returnKeyType="done"
              onSubmitEditing={handleAppPasswordLogin}
              editable={!isLoading}
            />

            {/* App Password Help Link */}
            <Pressable
              onPress={handleAppPasswordHelp}
              style={styles.helpLink}
            >
              <Text style={styles.helpLinkText}>
                {t('appPassword.help')}
              </Text>
            </Pressable>

            {/* Actions */}
            <View style={styles.actionContainer}>
              <Button
                title={isLoading ? t('button.loggingIn') : t('button.login')}
                onPress={handleAppPasswordLogin}
                loading={isLoading}
                disabled={!isConnected || isLoading}
                fullWidth
                size="large"
                style={styles.mainButton}
              />

              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>{t('oauth.or')}</Text>
                <View style={styles.dividerLine} />
              </View>

              <Button
                title={t('oauth.button')}
                onPress={handleOAuthLogin}
                loading={isLoading && !password.includes('-')} // Heuristic: if no hyphen, likely trying OAuth
                disabled={!isConnected || isLoading}
                fullWidth
                size="large"
                style={styles.oauthButton}
              />
            </View>

            {/* Security Note */}
            <View style={styles.securityNote}>
              <Text style={styles.securityNoteText}>
                {t('security.note')}
              </Text>
            </View>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              {t('version', { version: APP_INFO.VERSION })}
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
  actionContainer: {
    marginTop: Spacing.md,
  },
  mainButton: {
    marginBottom: Spacing.md,
  },
  oauthButton: {
    marginTop: Spacing.sm,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    paddingHorizontal: Spacing.md,
    color: Colors.textTertiary,
    fontSize: FontSizes.sm,
    fontWeight: '500',
  },
});

export default LoginScreen;
