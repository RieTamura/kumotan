/**
 * Kumotan - Main App Entry Point
 */

// Import OAuth client polyfills first
import 'core-js/proposals/explicit-resource-management';
import 'event-target-polyfill';
import 'react-native-url-polyfill/auto';

// Initialize i18n
import './src/locales';

import React, { useEffect, useState, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as Linking from 'expo-linking';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, StyleSheet, Text, Animated, Easing, Image } from 'react-native';

import { AppNavigator } from './src/navigation/AppNavigator';
import { useAuthStore } from './src/store/authStore';
import { initDatabase } from './src/services/database/init';
import { setDatabase as setWordsDatabase } from './src/services/database/words';
import { setDatabase as setStatsDatabase } from './src/services/database/stats';
import { networkMonitor } from './src/services/network/monitor';
import {
  initJMdictDatabase,
  type JMdictInitStatus,
} from './src/services/dictionary/jmdict';
import { Colors, FontSizes, Spacing } from './src/constants/colors';
import { APP_INFO } from './src/constants/config';

SplashScreen.preventAutoHideAsync().catch(() => {
  /* ignore */
});

interface InitState {
  isReady: boolean;
  error: string | null;
  jmdictStatus: JMdictInitStatus;
}

export default function App(): React.JSX.Element {
  const [initState, setInitState] = useState<InitState>({
    isReady: false,
    error: null,
    jmdictStatus: 'idle',
  });

  // プログレスバーアニメーション
  const progressAnim = useRef(new Animated.Value(0)).current;

  // ネイティブスプラッシュ画面を隠す関数
  const hideNativeSplash = async () => {
    try {
      await SplashScreen.hideAsync();
    } catch (e) {
      /* ignore */
    }
  };

  // アプリの準備ができたら確実にスプラッシュを隠す
  useEffect(() => {
    if (initState.isReady) {
      // 遷移をスムーズにするため極短時間のディレイを入れる
      const timer = setTimeout(() => {
        hideNativeSplash();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [initState.isReady]);

  useEffect(() => {
    if (
      initState.jmdictStatus === 'checking' ||
      initState.jmdictStatus === 'copying'
    ) {
      // 無限ループアニメーション
      const animation = Animated.loop(
        Animated.timing(progressAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        })
      );
      animation.start();
      return () => animation.stop();
    } else {
      progressAnim.setValue(0);
    }
  }, [initState.jmdictStatus, progressAnim]);

  const checkAuth = useAuthStore((state) => state.checkAuth);
  const resumeSession = useAuthStore((state) => state.resumeSession);

  // OAuth callbacks are handled internally by the loginWithOAuth action
  // using WebBrowser.openAuthSessionAsync, which returns the result directly.
  // No global deep link listener for OAuth is needed unless there are other
  // deep links to support.
  useEffect(() => {
    async function initializeApp() {
      try {
        console.log('Initializing database...');
        const db = await initDatabase();
        setWordsDatabase(db);
        setStatsDatabase(db);

        console.log('Starting network monitor...');
        networkMonitor.start();

        // JMdict辞書の初期化（バックグラウンドで実行、エラーは無視）
        console.log('Initializing JMdict dictionary...');
        initJMdictDatabase((status) => {
          setInitState((prev) => ({ ...prev, jmdictStatus: status }));
        }).catch((err) => {
          console.warn('JMdict initialization failed:', err);
        });

        console.log('Checking authentication...');
        const hasAuth = await checkAuth();
        console.log('Auth check result:', hasAuth);

        if (hasAuth) {
          console.log('Resuming session...');
          await resumeSession();
          console.log('Session resumed');
        }

        console.log('Initialization complete');
        setInitState((prev) => ({ ...prev, isReady: true, error: null }));
      } catch (error) {
        console.error('App initialization error:', error);
        setInitState((prev) => ({
          ...prev,
          isReady: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }));
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
    const getJMdictStatusText = (): string | null => {
      switch (initState.jmdictStatus) {
        case 'idle':
          return 'アプリを起動中...';
        case 'checking':
          return '辞書データを確認中...';
        case 'copying':
          return '辞書データをコピー中...（初回のみ）';
        default:
          return null;
      }
    };

    const jmdictStatusText = getJMdictStatusText();

    return (
      <SafeAreaProvider>
        <View style={styles.splashContainer}>
          <Image
            source={require('./assets/splash.png')}
            style={styles.splashImage}
            resizeMode="contain"
            onLoad={hideNativeSplash}
          />
          {jmdictStatusText && (
            <View style={styles.progressContainerFixed}>
              <View style={styles.progressBar}>
                <Animated.View
                  style={[
                    styles.progressBarInner,
                    {
                      transform: [
                        {
                          translateX: progressAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [-150, 350],
                          }),
                        },
                      ],
                    },
                  ]}
                />
              </View>
              <Text style={styles.progressText}>{jmdictStatusText}</Text>
            </View>
          )}
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
  splashImage: {
    ...StyleSheet.absoluteFillObject,
  },
  progressContainerFixed: {
    position: 'absolute',
    bottom: 110, // iPhone SE等でも収まるよう微調整
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: '10%',
    zIndex: 10,
    elevation: 5,
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarInner: {
    width: 100,
    height: '100%',
    backgroundColor: Colors.textInverse,
    borderRadius: 2,
  },
  progressText: {
    marginTop: Spacing.sm,
    fontSize: FontSizes.sm,
    color: Colors.textInverse,
    opacity: 0.9,
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
