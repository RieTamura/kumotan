/**
 * App Navigator
 * Main navigation structure with tab and stack navigation
 * Supports swipe navigation between tabs
 */

import React, { useRef, useState, useCallback } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import {
  createNativeStackNavigator,
  NativeStackNavigationOptions,
} from '@react-navigation/native-stack';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Home, BookOpen, BarChart3, Settings } from 'lucide-react-native';
import PagerView, { PagerViewOnPageSelectedEvent } from 'react-native-pager-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, FontSizes } from '../constants/colors';
import { useAuthStore } from '../store/authStore';

// Screens
import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import WordListScreen from '../screens/WordListScreen';
import ProgressScreen from '../screens/ProgressScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ApiKeySetupScreen from '../screens/ApiKeySetupScreen';

/**
 * Stack Navigator Types
 */
export type RootStackParamList = {
  Splash: undefined;
  Login: undefined;
  Main: undefined;
  ApiKeySetup: { section?: 'deepl' | 'yahoo' };
  License: undefined;
};

/**
 * Tab Navigator Types
 */
export type MainTabParamList = {
  Home: undefined;
  WordList: undefined;
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
  label: string;
  Icon: React.ComponentType<{ size?: number; color?: string }>;
  component: React.ComponentType<any>;
}

const TAB_CONFIG: TabConfig[] = [
  { key: 'Home', label: 'ホーム', Icon: Home, component: HomeScreen },
  { key: 'WordList', label: '単語帳', Icon: BookOpen, component: WordListScreen },
  { key: 'Progress', label: '進捗', Icon: BarChart3, component: ProgressScreen },
  { key: 'Settings', label: '設定', Icon: Settings, component: SettingsScreen },
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
  
  return (
    <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {TAB_CONFIG.map((tab, index) => {
        const isActive = currentIndex === index;
        const color = isActive ? Colors.tabActive : Colors.tabInactive;
        
        return (
          <TouchableOpacity
            key={tab.key}
            style={styles.tabItem}
            onPress={() => onTabPress(index)}
            activeOpacity={0.7}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={tab.label}
          >
            <tab.Icon size={24} color={color} />
            <Text style={[styles.tabLabel, { color }]}>{tab.label}</Text>
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

  return (
    <View style={styles.container}>
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

  // While checking auth status, show nothing (splash would be shown by expo-splash-screen)
  if (isLoading) {
    return (
      <Stack.Navigator screenOptions={defaultStackOptions}>
        <Stack.Screen
          name="Splash"
          component={SplashPlaceholder}
          options={{ headerShown: false }}
        />
      </Stack.Navigator>
    );
  }

  return (
    <Stack.Navigator screenOptions={defaultStackOptions}>
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
              headerTitle: 'API Key設定',
              headerBackTitle: '戻る',
              headerTintColor: Colors.primary,
              headerStyle: {
                backgroundColor: Colors.background,
              },
            }}
          />
          {/* Add License screen here when implemented */}
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
  return (
    <View style={{ flex: 1, backgroundColor: Colors.primary }} />
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
  tabLabel: {
    fontSize: FontSizes.xs,
    fontWeight: '500',
    marginTop: 2,
  },
});

export default AppNavigator;
