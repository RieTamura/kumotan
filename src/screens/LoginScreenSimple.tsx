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
import { Colors, Spacing, FontSizes } from '../constants/colors';

/**
 * Simple LoginScreen for testing
 */
export function LoginScreenSimple(): React.JSX.Element {
  console.log('LoginScreenSimple rendering...');

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.container}>
        <Text style={styles.title}>テスト画面</Text>
        <Text style={styles.message}>
          この画面が表示されれば、基本的なレンダリングは正常です。
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  title: {
    fontSize: FontSizes.xxxl,
    fontWeight: '700',
    color: Colors.primary,
    marginBottom: Spacing.lg,
  },
  message: {
    fontSize: FontSizes.lg,
    color: Colors.text,
    textAlign: 'center',
  },
});

export default LoginScreenSimple;
