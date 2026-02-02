/**
 * Simple Login Screen for debugging
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';

/**
 * Simple LoginScreen for testing
 */
export function LoginScreenSimple(): React.JSX.Element {
  const { colors } = useTheme();
  console.log('LoginScreenSimple rendering...');

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <View style={styles.container}>
        <Text style={[styles.title, { color: colors.primary }]}>テスト画面</Text>
        <Text style={[styles.message, { color: colors.text }]}>
          この画面が表示されれば、基本的なレンダリングは正常です。
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24, // Spacing.xl
  },
  title: {
    fontSize: 32, // FontSizes.xxxl
    fontWeight: '700',
    marginBottom: 16, // Spacing.lg
  },
  message: {
    fontSize: 16, // FontSizes.lg
    textAlign: 'center',
  },
});

export default LoginScreenSimple;
