/**
 * Common Button Component
 * Reusable button with various styles and states
 */

import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  StyleProp,
} from 'react-native';
import { Colors, Spacing, FontSizes, BorderRadius } from '../../constants/colors';

/**
 * Button variant types
 */
type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';

/**
 * Button size types
 */
type ButtonSize = 'small' | 'medium' | 'large';

/**
 * Button props interface
 */
interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

/**
 * Button Component
 */
export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  fullWidth = false,
  style,
  textStyle,
  leftIcon,
  rightIcon,
}: ButtonProps): React.JSX.Element {
  const isDisabled = disabled || loading;

  const getContainerStyle = (): ViewStyle[] => {
    const styles: ViewStyle[] = [baseStyles.container];

    // Size styles
    switch (size) {
      case 'small':
        styles.push(sizeStyles.small);
        break;
      case 'large':
        styles.push(sizeStyles.large);
        break;
      default:
        styles.push(sizeStyles.medium);
    }

    // Variant styles
    switch (variant) {
      case 'secondary':
        styles.push(variantStyles.secondary);
        break;
      case 'outline':
        styles.push(variantStyles.outline);
        break;
      case 'ghost':
        styles.push(variantStyles.ghost);
        break;
      case 'danger':
        styles.push(variantStyles.danger);
        break;
      default:
        styles.push(variantStyles.primary);
    }

    // Full width
    if (fullWidth) {
      styles.push(baseStyles.fullWidth);
    }

    // Disabled state
    if (isDisabled) {
      styles.push(baseStyles.disabled);
    }

    return styles;
  };

  const getTextStyle = (): TextStyle[] => {
    const styles: TextStyle[] = [baseStyles.text];

    // Size text styles
    switch (size) {
      case 'small':
        styles.push(textSizeStyles.small);
        break;
      case 'large':
        styles.push(textSizeStyles.large);
        break;
      default:
        styles.push(textSizeStyles.medium);
    }

    // Variant text styles
    switch (variant) {
      case 'secondary':
        styles.push(textVariantStyles.secondary);
        break;
      case 'outline':
        styles.push(textVariantStyles.outline);
        break;
      case 'ghost':
        styles.push(textVariantStyles.ghost);
        break;
      case 'danger':
        styles.push(textVariantStyles.danger);
        break;
      default:
        styles.push(textVariantStyles.primary);
    }

    // Disabled text
    if (isDisabled) {
      styles.push(baseStyles.disabledText);
    }

    return styles;
  };

  const getLoaderColor = (): string => {
    switch (variant) {
      case 'outline':
      case 'ghost':
        return Colors.primary;
      case 'secondary':
        return Colors.text;
      default:
        return Colors.textInverse;
    }
  };

  return (
    <TouchableOpacity
      style={[getContainerStyle(), style]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator size="small" color={getLoaderColor()} />
      ) : (
        <>
          {leftIcon && <>{leftIcon}</>}
          <Text style={[getTextStyle(), textStyle]}>{title}</Text>
          {rightIcon && <>{rightIcon}</>}
        </>
      )}
    </TouchableOpacity>
  );
}

/**
 * Base styles
 */
const baseStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    fontWeight: '600',
    textAlign: 'center',
  },
  disabledText: {
    opacity: 0.8,
  },
});

/**
 * Size styles
 */
const sizeStyles = StyleSheet.create({
  small: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    minHeight: 32,
  },
  medium: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    minHeight: 44,
  },
  large: {
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    minHeight: 52,
  },
});

/**
 * Text size styles
 */
const textSizeStyles = StyleSheet.create({
  small: {
    fontSize: FontSizes.sm,
  },
  medium: {
    fontSize: FontSizes.md,
  },
  large: {
    fontSize: FontSizes.lg,
  },
});

/**
 * Variant styles
 */
const variantStyles = StyleSheet.create({
  primary: {
    backgroundColor: Colors.primary,
  },
  secondary: {
    backgroundColor: Colors.backgroundSecondary,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  danger: {
    backgroundColor: Colors.error,
  },
});

/**
 * Text variant styles
 */
const textVariantStyles = StyleSheet.create({
  primary: {
    color: Colors.textInverse,
  },
  secondary: {
    color: Colors.text,
  },
  outline: {
    color: Colors.primary,
  },
  ghost: {
    color: Colors.primary,
  },
  danger: {
    color: Colors.textInverse,
  },
});

export default Button;
