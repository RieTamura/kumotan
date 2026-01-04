/**
 * App Navigator
 * Main navigation structure with tab and stack navigation
 */

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import {
  createNativeStackNavigator,
  NativeStackNavigationOptions,
} from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet } from 'react-native';
import { Home, BookOpen, BarChart3, Settings } from 'lucide-react-native';

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
const Tab = createBottomTabNavigator<MainTabParamList>();

/**
 * Tab bar icon component
 */
interface TabIconProps {
  Icon: React.ComponentType<{ size?: number; color?: string }>;
  focused: boolean;
}

function TabIcon({ Icon, focused }: TabIconProps): React.JSX.Element {
  return (
    <Icon 
      size={24} 
      color={focused ? Colors.tabActive : Colors.tabInactive} 
    />
  );
}

/**
 * Main Tab Navigator
 * Bottom tab navigation for the main app screens
 */
function MainTabs(): React.JSX.Element {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.tabActive,
        tabBarInactiveTintColor: Colors.tabInactive,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: 'ホーム',
          tabBarIcon: ({ focused }) => (
            <TabIcon Icon={Home} focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="WordList"
        component={WordListScreen}
        options={{
          tabBarLabel: '単語帳',
          tabBarIcon: ({ focused }) => (
            <TabIcon Icon={BookOpen} focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Progress"
        component={ProgressScreen}
        options={{
          tabBarLabel: '進捗',
          tabBarIcon: ({ focused }) => (
            <TabIcon Icon={BarChart3} focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarLabel: '設定',
          tabBarIcon: ({ focused }) => (
            <TabIcon Icon={Settings} focused={focused} />
          ),
        }}
      />
    </Tab.Navigator>
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
  tabBar: {
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 8,
    paddingBottom: 8,
    height: 60,
  },
  tabLabel: {
    fontSize: FontSizes.xs,
    fontWeight: '500',
    marginTop: 2,
  },
});

export default AppNavigator;
