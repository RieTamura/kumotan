/**
 * Kumotan - Main App Entry Point
 */

import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
// import * as SplashScreen from 'expo-splash-screen';  // 一時的に無効化
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, StyleSheet, Text } from 'react-native';
import * as Linking from 'expo-linking';

import { AppNavigator } from './src/navigation/AppNavigator';
import { useAuthStore } from './src/store/authStore';
import { initDatabase } from './src/services/database/init';
import { setDatabase as setWordsDatabase } from './src/services/database/words';
import { setDatabase as setStatsDatabase } from './src/services/database/stats';
import { networkMonitor } from './src/services/network/monitor';
import { Colors, FontSizes, Spacing } from './src/constants/colors';
import { APP_INFO } from './src/constants/config';

// SplashScreen.preventAutoHideAsync();  // 一時的に無効化

interface InitState {
  isReady: boolean;
  error: string | null;
}

export default function App(): React.JSX.Element {
  const [initState, setInitState] = useState<InitState>({
    isReady: false,
    error: null,
  });

  const checkAuth = useAuthStore((state) => state.checkAuth);
  const resumeSession = useAuthStore((state) => state.resumeSession);
  const completeOAuth = useAuthStore((state) => state.completeOAuth);

  // Handle deep link for OAuth callback
  useEffect(() => {
    const handleDeepLink = async (event: { url: string }) => {
      const url = event.url;
      console.log('Deep link received:', url);

      // Check if this is an OAuth callback
      if (url.includes('/oauth/callback')) {
        try {
          console.log('Processing OAuth callback...');
          const result = await completeOAuth(url);

          if (result.success) {
            console.log('OAuth authentication successful');
          } else {
            console.error('OAuth authentication failed:', result.error);
          }
        } catch (error) {
          console.error('Error processing OAuth callback:', error);
        }
      }
    };

    // Listen for deep links when app is in foreground
    const subscription = Linking.addEventListener('url', handleDeepLink);

    // Check for deep link that opened the app
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink({ url });
      }
    });

    return () => {
      subscription.remove();
    };
  }, [completeOAuth]);

  useEffect(() => {
    async function initializeApp() {
      try {
        console.log('Initializing database...');
        const db = await initDatabase();
        setWordsDatabase(db);
        setStatsDatabase(db);

        console.log('Starting network monitor...');
        networkMonitor.start();

        console.log('Checking authentication...');
        const hasAuth = await checkAuth();
        console.log('Auth check result:', hasAuth);

        if (hasAuth) {
          console.log('Resuming session...');
          await resumeSession();
          console.log('Session resumed');
        }

        console.log('Initialization complete');
        setInitState({ isReady: true, error: null });
      } catch (error) {
        console.error('App initialization error:', error);
        setInitState({
          isReady: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    initializeApp();

    return () => {
      networkMonitor.stop();
    };
  }, [checkAuth, resumeSession]);

  // エラー画面
  if (initState.error) {
    return (
      <SafeAreaProvider>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Error</Text>
          <Text style={styles.errorMessage}>{initState.error}</Text>
        </View>
        <StatusBar style="dark" />
      </SafeAreaProvider>
    );
  }

  // 初期化中
  if (!initState.isReady) {
    return (
      <SafeAreaProvider>
        <View style={styles.splashContainer}>
          <Text style={styles.splashAppName}>{APP_INFO.NAME}</Text>
          <Text style={styles.splashTagline}>{APP_INFO.DESCRIPTION}</Text>
        </View>
        <StatusBar style="light" />
      </SafeAreaProvider>
    );
  }

  // メインアプリ
  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        <AppNavigator />
      </View>
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  splashContainer: {
    flex: 1,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  splashAppName: {
    fontSize: FontSizes.xxxl,
    fontWeight: '700',
    color: Colors.textInverse,
    marginBottom: Spacing.sm,
  },
  splashTagline: {
    fontSize: FontSizes.lg,
    color: Colors.textInverse,
    opacity: 0.8,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xxl,
  },
  errorTitle: {
    fontSize: FontSizes.xl,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  errorMessage: {
    fontSize: FontSizes.md,
    color: Colors.error,
    textAlign: 'center',
  },
});
