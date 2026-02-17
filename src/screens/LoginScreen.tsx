/**
 * Login Screen
 * Handles Bluesky authentication with OAuth
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
  Linking,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Colors, Spacing, FontSizes, BorderRadius } from '../constants/colors';
import { APP_INFO } from '../constants/config';
import { useAuthStore } from '../store/authStore';
import { Validators, sanitizeHandle } from '../utils/validators';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { StaticOfflineBanner } from '../components/OfflineBanner';
import { useTheme } from '../hooks/useTheme';

/**
 * LoginScreen Component
 */
export function LoginScreen(): React.JSX.Element {
  const { t } = useTranslation('login');
  const { t: tc } = useTranslation('common');
  const { colors, isDark } = useTheme();

  // Auth store
  const { loginWithOAuth, isLoading, error, clearError } = useAuthStore();

  // Network status
  const isConnected = useNetworkStatus();

  // Form state
  const [identifier, setIdentifier] = useState('');

  // Validation errors
  const [identifierError, setIdentifierError] = useState<string | undefined>();

  /**
   * Validate identifier input
   */
  const validateIdentifier = useCallback((value: string): boolean => {
    const result = Validators.validateHandle(value);
    setIdentifierError(result.isValid ? undefined : result.error);
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
   * Handle OAuth Login
   */
  const handleOAuthLogin = useCallback(async () => {
    if (!isConnected) {
      Alert.alert(t('errors.offline'), t('errors.offlineMessage'), [{ text: tc('buttons.ok') }]);
      return;
    }

    const isIdentifierValid = validateIdentifier(identifier);
    if (!isIdentifierValid) return;

    const sanitizedIdentifier = sanitizeHandle(identifier);
    const result = await loginWithOAuth(sanitizedIdentifier);

    if (!result.success) {
      if (result.error.code === 'NETWORK_ERROR') {
        Alert.alert(t('errors.networkError'), result.error.message, [{ text: tc('buttons.ok') }]);
      }
    }
  }, [identifier, isConnected, validateIdentifier, loginWithOAuth, t, tc]);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.primary }]} edges={['top', 'left', 'right']}>
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
            <Image 
              source={require('../../assets/icon.png')} 
              style={styles.appIcon}
              resizeMode="contain"
            />
          </View>

          {/* Description */}
          <View style={[styles.descriptionContainer, { backgroundColor: 'rgba(255, 255, 255, 0.9)' }]}>
            <Text style={[styles.description, { color: colors.text }]}>
              {t('description')}
            </Text>
          </View>

          {/* Login Form */}
          <View style={styles.formContainer}>
            {/* Auth Error Display */}
            {error && (
              <View style={[styles.errorBanner, { backgroundColor: colors.errorLight, borderLeftColor: colors.error }]}>
                <Text style={[styles.errorBannerText, { color: colors.error }]}>
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
              returnKeyType="done"
              onSubmitEditing={handleOAuthLogin}
              editable={!isLoading}
              labelStyle={{ color: '#FFFFFF' }}
              hintStyle={{ color: '#FFFFFF' }}
            />

            {/* Actions */}
            <View style={styles.actionContainer}>
              <Button
                title={t('oauth.button')}
                onPress={handleOAuthLogin}
                loading={isLoading}
                disabled={!isConnected || isLoading}
                fullWidth
                size="large"
                style={[styles.mainButton, { backgroundColor: '#FFFFFF' }]}
                textStyle={{ color: colors.primary, fontWeight: '700' }}
              />
            </View>

            {/* Divider */}
            <View style={styles.divider} />

            {/* No Account Info */}
            <View style={styles.noAccountContainer}>
              <Text style={styles.noAccountText}>
                {t('noAccount.text')}
              </Text>
              <TouchableOpacity 
                onPress={() => Linking.openURL('https://bsky.app')}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.noAccountLink}>
                  {t('noAccount.link')}
                </Text>
              </TouchableOpacity>
            </View>

          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: '#FFFFFF' }]}>
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
    backgroundColor: Colors.primary,
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
    marginTop: Spacing.lg,
  },
  appIcon: {
    width: 160,
    height: 160,
  },
  appName: {
    fontSize: FontSizes.xxxl,
    fontWeight: '700',
    color: Colors.primary,
    marginBottom: Spacing.xs,
  },
  tagline: {
    fontSize: FontSizes.md,
    color: '#FFFFFF',
  },
  descriptionContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
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
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginVertical: Spacing.lg,
  },
  noAccountContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  noAccountText: {
    fontSize: FontSizes.sm,
    color: '#FFFFFF',
    marginRight: Spacing.xs,
  },
  noAccountLink: {
    fontSize: FontSizes.sm,
    color: '#FFFFFF',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});

export default LoginScreen;
