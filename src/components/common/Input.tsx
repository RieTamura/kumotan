/**
 * Common Input Component
 * Reusable text input with validation and error display
 */

import React, { forwardRef, useState } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TextInputProps,
  ViewStyle,
  Pressable,
} from 'react-native';
import { Colors, Spacing, FontSizes, BorderRadius } from '../../constants/colors';
import { useTheme } from '../../hooks/useTheme';

/**
 * Input component props
 */
interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  containerStyle?: ViewStyle;
  showPasswordToggle?: boolean;
}

/**
 * Input component with label, error display, and optional icons
 */
export const Input = forwardRef<TextInput, InputProps>(
  (
    {
      label,
      error,
      hint,
      leftIcon,
      rightIcon,
      containerStyle,
      showPasswordToggle = false,
      secureTextEntry,
      style,
      ...props
    },
    ref
  ) => {
    const { colors } = useTheme();

    const [isFocused, setIsFocused] = useState(false);
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);

    const hasError = !!error;
    const isSecure = secureTextEntry && !isPasswordVisible;

    const handleFocus = (e: any) => {
      setIsFocused(true);
      props.onFocus?.(e);
    };

    const handleBlur = (e: any) => {
      setIsFocused(false);
      props.onBlur?.(e);
    };

    const togglePasswordVisibility = () => {
      setIsPasswordVisible((prev) => !prev);
    };

    return (
      <View style={[styles.container, containerStyle]}>
        {label && <Text style={[styles.label, { color: colors.text }]}>{label}</Text>}

        <View
          style={[
            styles.inputContainer,
            { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder },
            isFocused && [styles.inputContainerFocused, { borderColor: colors.inputFocus }],
            hasError && [styles.inputContainerError, { borderColor: colors.inputError }],
          ]}
        >
          {leftIcon && <View style={styles.iconContainer}>{leftIcon}</View>}

          <TextInput
            ref={ref}
            style={[
              styles.input,
              { color: colors.text },
              leftIcon ? styles.inputWithLeftIcon : undefined,
              rightIcon || showPasswordToggle ? styles.inputWithRightIcon : undefined,
              style,
            ]}
            placeholderTextColor={colors.placeholder}
            secureTextEntry={isSecure}
            onFocus={handleFocus}
            onBlur={handleBlur}
            {...props}
          />

          {showPasswordToggle && secureTextEntry && (
            <Pressable
              onPress={togglePasswordVisibility}
              style={styles.iconContainer}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={[styles.toggleText, { color: colors.primary }]}>
                {isPasswordVisible ? '隠す' : '表示'}
              </Text>
            </Pressable>
          )}

          {rightIcon && !showPasswordToggle && (
            <View style={styles.iconContainer}>{rightIcon}</View>
          )}
        </View>

        {error && <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>}
        {hint && !error && <Text style={[styles.hintText, { color: colors.textSecondary }]}>{hint}</Text>}
      </View>
    );
  }
);

Input.displayName = 'Input';

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.inputBackground,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: BorderRadius.md,
    minHeight: 48,
  },
  inputContainerFocused: {
    borderColor: Colors.inputFocus,
    borderWidth: 2,
  },
  inputContainerError: {
    borderColor: Colors.inputError,
    borderWidth: 2,
  },
  input: {
    flex: 1,
    fontSize: FontSizes.lg,
    color: Colors.text,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  inputWithLeftIcon: {
    paddingLeft: Spacing.xs,
  },
  inputWithRightIcon: {
    paddingRight: Spacing.xs,
  },
  iconContainer: {
    paddingHorizontal: Spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleText: {
    color: Colors.primary,
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  errorText: {
    color: Colors.error,
    fontSize: FontSizes.sm,
    marginTop: Spacing.xs,
  },
  hintText: {
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
    marginTop: Spacing.xs,
  },
});

export default Input;
