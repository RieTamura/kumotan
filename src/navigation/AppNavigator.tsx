/**
 * App Navigator
 * Main navigation structure with tab and stack navigation
 * Supports swipe navigation between tabs
 */

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import {
  createNativeStackNavigator,
  NativeStackNavigationOptions,
} from '@react-navigation/native-stack';
import { View, StyleSheet, TouchableOpacity, Animated, Easing, Image } from 'react-native';
import { Home, BookOpen, HelpCircle, BarChart3, Settings } from 'lucide-react-native';
import PagerView, { PagerViewOnPageSelectedEvent } from 'react-native-pager-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Colors } from '../constants/colors';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../hooks/useTheme';

// Screens
import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import WordListScreen from '../screens/WordListScreen';
import ProgressScreen from '../screens/ProgressScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ApiKeySetupScreen from '../screens/ApiKeySetupScreen';
import LicenseScreen from '../screens/LicenseScreen';
import { DebugLogsScreen } from '../screens/DebugLogsScreen';
import { TipsScreen } from '../screens/TipsScreen';
import { ThreadScreen } from '../screens/ThreadScreen';
import { DictionarySetupScreen } from '../screens/DictionarySetupScreen';
import { QuizSetupScreen } from '../screens/QuizSetupScreen';
import { QuizScreen } from '../screens/QuizScreen';
import { QuizResultScreen } from '../screens/QuizResultScreen';
import { QuizSettings, QuizResult } from '../types/quiz';
import { LegalDocumentScreen } from '../screens/LegalDocumentScreen';

/**
 * Stack Navigator Types
 */
export type RootStackParamList = {
  Splash: undefined;
  Login: undefined;
  Main: undefined;
  ApiKeySetup: { section?: 'deepl' | 'yahoo' };
  License: undefined;
  LegalDocument: { type: 'terms' | 'privacy' };
  DebugLogs: undefined;
  Tips: undefined;
  Thread: { postUri: string };
  DictionarySetup: undefined;
  QuizSetup: undefined;
  Quiz: { settings: QuizSettings };
  QuizResult: { result: QuizResult };
};

/**
 * Tab Navigator Types
 */
export type MainTabParamList = {
  Home: undefined;
  WordList: undefined;
  Quiz: undefined;
  Progress: undefined;
  Settings: undefined;
};

// Create navigators
const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Tab configuration
 */
interface TabConfig {
  key: keyof MainTabParamList;
  labelKey: 'home' | 'wordList' | 'quiz' | 'progress' | 'settings';
  Icon: React.ComponentType<{ size?: number; color?: string }>;
  component: React.ComponentType<any>;
}

const TAB_CONFIG: TabConfig[] = [
  { key: 'Home', labelKey: 'home', Icon: Home, component: HomeScreen },
  { key: 'WordList', labelKey: 'wordList', Icon: BookOpen, component: WordListScreen },
  { key: 'Quiz', labelKey: 'quiz', Icon: HelpCircle, component: QuizSetupScreen },
  { key: 'Progress', labelKey: 'progress', Icon: BarChart3, component: ProgressScreen },
  { key: 'Settings', labelKey: 'settings', Icon: Settings, component: SettingsScreen },
];

/**
 * Custom Tab Bar Component
 * Renders the bottom tab bar with tap functionality
 */
interface CustomTabBarProps {
  currentIndex: number;
  onTabPress: (index: number) => void;
}

function CustomTabBar({ currentIndex, onTabPress }: CustomTabBarProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('navigation');
  const { colors } = useTheme();

  return (
    <View style={[
      styles.tabBar,
      {
        paddingBottom: Math.max(insets.bottom, 8),
        backgroundColor: colors.background,
        borderTopColor: colors.border,
      }
    ]}>
      {TAB_CONFIG.map((tab, index) => {
        const isActive = currentIndex === index;
        const color = isActive ? colors.tabActive : colors.tabInactive;
        const label = t(`tabs.${tab.labelKey}`);

        return (
          <TouchableOpacity
            key={tab.key}
            style={styles.tabItem}
            onPress={() => onTabPress(index)}
            activeOpacity={0.7}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={label}
          >
            <tab.Icon size={24} color={color} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/**
 * Main Tabs with Swipe Navigation
 * Uses PagerView for swipe support and custom tab bar
 */
function MainTabs(): React.JSX.Element {
  const pagerRef = useRef<PagerView>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Handle page change from swipe
  const handlePageSelected = useCallback((e: PagerViewOnPageSelectedEvent) => {
    setCurrentIndex(e.nativeEvent.position);
  }, []);

  // Handle tab press
  const handleTabPress = useCallback((index: number) => {
    setCurrentIndex(index);
    pagerRef.current?.setPage(index);
  }, []);

  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <PagerView
        ref={pagerRef}
        style={styles.pagerView}
        initialPage={0}
        onPageSelected={handlePageSelected}
        overdrag={true}
        offscreenPageLimit={1}
      >
        {TAB_CONFIG.map((tab) => (
          <View key={tab.key} style={styles.pageContainer}>
            <tab.component />
          </View>
        ))}
      </PagerView>
      <CustomTabBar currentIndex={currentIndex} onTabPress={handleTabPress} />
    </View>
  );
}

/**
 * Default stack screen options
 */
const defaultStackOptions: NativeStackNavigationOptions = {
  headerShown: false,
  animation: 'slide_from_right',
  contentStyle: {
    backgroundColor: Colors.background,
  },
};

/**
 * Root Stack Navigator
 * Handles authentication flow and main app navigation
 */
function RootNavigator(): React.JSX.Element {
  const { isAuthenticated, isLoading } = useAuthStore();
  const { t } = useTranslation('navigation');
  const { colors, isDark } = useTheme();

  const stackOptions: NativeStackNavigationOptions = {
    ...defaultStackOptions,
    contentStyle: {
      backgroundColor: colors.background,
    },
  };

  // While checking auth status, show nothing (splash would be shown by expo-splash-screen)
  if (isLoading) {
    return (
      <Stack.Navigator screenOptions={stackOptions}>
        <Stack.Screen
          name="Splash"
          component={SplashPlaceholder}
          options={{ headerShown: false }}
        />
      </Stack.Navigator>
    );
  }

  return (
    <Stack.Navigator screenOptions={stackOptions}>
      {isAuthenticated ? (
        // Authenticated routes
        <Stack.Group>
          <Stack.Screen
            name="Main"
            component={MainTabs}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="ApiKeySetup"
            component={ApiKeySetupScreen}
            options={{
              headerShown: true,
              headerTitle: t('headers.apiKeySetup'),
              headerBackTitle: t('common:buttons.back'),
              headerTintColor: colors.primary,
              headerStyle: {
                backgroundColor: colors.background,
              },
              headerTitleStyle: {
                color: colors.text,
              },
            }}
          />
          <Stack.Screen
            name="License"
            component={LicenseScreen}
            options={{
              headerShown: true,
              headerTitle: t('headers.license'),
              headerBackTitle: t('common:buttons.back'),
              headerTintColor: colors.primary,
              headerStyle: {
                backgroundColor: colors.background,
              },
              headerTitleStyle: {
                color: colors.text,
              },
            }}
          />
          <Stack.Screen
            name="LegalDocument"
            component={LegalDocumentScreen}
            options={({ route }) => ({
              headerShown: true,
              headerTitle: route.params.type === 'terms'
                ? t('headers.termsOfService')
                : t('headers.privacyPolicy'),
              headerBackTitle: t('common:buttons.back'),
              headerTintColor: colors.primary,
              headerStyle: {
                backgroundColor: colors.background,
              },
              headerTitleStyle: {
                color: colors.text,
              },
            })}
          />
          <Stack.Screen
            name="DebugLogs"
            component={DebugLogsScreen}
            options={{
              headerShown: true,
              headerTitle: t('headers.debugLogs'),
              headerBackTitle: t('common:buttons.back'),
              headerTintColor: colors.primary,
              headerStyle: {
                backgroundColor: colors.background,
              },
              headerTitleStyle: {
                color: colors.text,
              },
            }}
          />
          <Stack.Screen
            name="Tips"
            component={TipsScreen}
            options={{
              headerShown: true,
              headerTitle: t('headers.tips'),
              headerBackTitle: t('common:buttons.back'),
              headerTintColor: colors.primary,
              headerStyle: {
                backgroundColor: colors.background,
              },
              headerTitleStyle: {
                color: colors.text,
              },
            }}
          />
          <Stack.Screen
            name="Thread"
            component={ThreadScreen}
            options={{
              headerShown: true,
              headerTitle: t('headers.thread'),
              headerBackTitle: t('common:buttons.back'),
              headerTintColor: colors.primary,
              headerStyle: {
                backgroundColor: colors.background,
              },
              headerTitleStyle: {
                color: colors.text,
              },
            }}
          />
          <Stack.Screen
            name="DictionarySetup"
            component={DictionarySetupScreen}
            options={{
              headerShown: true,
              headerTitle: t('headers.dictionarySetup'),
              headerBackTitle: t('common:buttons.back'),
              headerTintColor: colors.primary,
              headerStyle: {
                backgroundColor: colors.background,
              },
              headerTitleStyle: {
                color: colors.text,
              },
            }}
          />
          <Stack.Screen
            name="QuizSetup"
            component={QuizSetupScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="Quiz"
            component={QuizScreen}
            options={{
              headerShown: false,
              gestureEnabled: false,
            }}
          />
          <Stack.Screen
            name="QuizResult"
            component={QuizResultScreen}
            options={{
              headerShown: true,
              headerTitle: t('headers.quizResult'),
              headerBackTitle: t('common:buttons.back'),
              headerTintColor: colors.primary,
              headerStyle: {
                backgroundColor: colors.background,
              },
              headerTitleStyle: {
                color: colors.text,
              },
              headerLeft: () => null,
            }}
          />
        </Stack.Group>
      ) : (
        // Unauthenticated routes
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{
            headerShown: false,
          }}
        />
      )}
    </Stack.Navigator>
  );
}

/**
 * Splash placeholder component
 * Used while checking authentication status
 */
function SplashPlaceholder(): React.JSX.Element {
  const progressAnim = useRef(new Animated.Value(0)).current;
  const startTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    // プログレスバーを推定時間に基づいて進行させる
    // OAuth認証は通常3-5秒程度かかるため、5秒で90%まで進む
    // 残り10%は処理完了を待つための余裕
    const animation = Animated.timing(progressAnim, {
      toValue: 0.9, // 90%まで進める
      duration: 5000, // 5秒
      easing: Easing.bezier(0.4, 0.0, 0.2, 1), // 加速カーブ（最初は速く、後半ゆっくり）
      useNativeDriver: false, // widthアニメーションのためfalse
    });
    
    animation.start();
    
    return () => {
      animation.stop();
    };
  }, [progressAnim]);

  return (
    <View style={[styles.splashPlaceholder, { backgroundColor: Colors.primary }]}>
      <View style={styles.splashContent}>
        {/* くもたんロゴ */}
        <View style={styles.logoContainer}>
          <Image
            source={require('../../assets/icon.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>
        
        {/* プログレスバー */}
        <View style={styles.progressBarContainer}>
          <View style={styles.progressBar}>
            <Animated.View
              style={[
                styles.progressBarInner,
                {
                  backgroundColor: Colors.textInverse,
                  width: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

/**
 * App Navigator
 * The main navigation component wrapping everything in NavigationContainer
 */
export function AppNavigator(): React.JSX.Element {
  return (
    <NavigationContainer>
      <RootNavigator />
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  pagerView: {
    flex: 1,
  },
  pageContainer: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 8,
    paddingBottom: 8,
    minHeight: 60,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  splashPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  splashContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    marginBottom: 60,
  },
  logoImage: {
    width: 120,
    height: 120,
  },
  progressBarContainer: {
    width: 200,
    alignItems: 'center',
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarInner: {
    height: '100%',
    borderRadius: 2,
  },
});

export default AppNavigator;
