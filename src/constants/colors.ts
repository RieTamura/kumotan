/**
 * Color constants for the application
 * Following Bluesky's design language with custom accents
 */

export const LightColors = {
  // Primary colors
  primary: '#1DA1F2', // Bluesky blue
  primaryDark: '#0d8bd9',
  primaryLight: '#4db5f5',

  // Background colors
  background: '#FFFFFF',
  backgroundSecondary: '#F7F9FA',
  backgroundTertiary: '#EFF3F4',

  // Text colors
  text: '#14171A',
  textSecondary: '#657786',
  textTertiary: '#AAB8C2',
  textInverse: '#FFFFFF',

  // Border colors
  border: '#E1E8ED',
  borderLight: '#EFF3F4',

  // Status colors
  success: '#17BF63',
  successLight: '#E8F9EE',
  warning: '#FFAD1F',
  warningLight: '#FFF8E6',
  error: '#E0245E',
  errorLight: '#FDEEF2',

  // Interactive states
  hover: '#E8F5FE',
  pressed: '#CCE4F7',
  disabled: '#AAB8C2',

  // Card colors
  card: '#FFFFFF',
  cardShadow: 'rgba(0, 0, 0, 0.1)',

  // Tab bar colors
  tabActive: '#1DA1F2',
  tabInactive: '#657786',

  // Read/Unread status
  read: '#17BF63',
  unread: '#AAB8C2',

  // Offline banner
  offline: '#F59E0B',
  offlineText: '#FFFFFF',

  // Overlay
  overlay: 'rgba(0, 0, 0, 0.5)',

  // Input
  inputBackground: '#F7F9FA',
  inputBorder: '#E1E8ED',
  inputFocus: '#1DA1F2',
  inputError: '#E0245E',

  // Placeholder
  placeholder: '#AAB8C2',

  // Divider
  divider: '#E1E8ED',

  // Skeleton loading
  skeleton: '#E1E8ED',
  skeletonHighlight: '#F7F9FA',

  // Index tabs
  indexTabActive: '#FFFFFF',
  indexTabInactive: '#F7F9FA',
  indexTabBorder: '#E1E8ED',
  indexTabShadow: 'rgba(0, 0, 0, 0.1)',
  indexTabText: '#657786',
  indexTabTextActive: '#14171A',
} as const;

export const DarkColors = {
  // Primary colors
  primary: '#1DA1F2',
  primaryDark: '#0d8bd9',
  primaryLight: '#4db5f5',

  // Background colors
  background: '#15202B', // Dim dark mode
  backgroundSecondary: '#1E2732',
  backgroundTertiary: '#253341',

  // Text colors
  text: '#FFFFFF',
  textSecondary: '#8899A6',
  textTertiary: '#657786',
  textInverse: '#14171A',

  // Border colors
  border: '#38444D',
  borderLight: '#253341',

  // Status colors
  success: '#17BF63',
  successLight: 'rgba(23, 191, 99, 0.15)',
  warning: '#FFAD1F',
  warningLight: 'rgba(255, 173, 31, 0.15)',
  error: '#E0245E',
  errorLight: 'rgba(224, 36, 94, 0.15)',

  // Interactive states
  hover: 'rgba(29, 161, 242, 0.1)',
  pressed: 'rgba(29, 161, 242, 0.2)',
  disabled: '#38444D',

  // Card colors
  card: '#192734',
  cardShadow: 'rgba(0, 0, 0, 0.3)',

  // Tab bar colors
  tabActive: '#1DA1F2',
  tabInactive: '#8899A6',

  // Read/Unread status
  read: '#17BF63',
  unread: '#657786',

  // Offline banner
  offline: '#F59E0B',
  offlineText: '#FFFFFF',

  // Overlay
  overlay: 'rgba(0, 0, 0, 0.7)',

  // Input
  inputBackground: '#1E2732',
  inputBorder: '#38444D',
  inputFocus: '#1DA1F2',
  inputError: '#E0245E',

  // Placeholder
  placeholder: '#657786',

  // Divider
  divider: '#38444D',

  // Skeleton loading
  skeleton: '#253341',
  skeletonHighlight: '#1E2732',

  // Index tabs
  indexTabActive: '#15202B',
  indexTabInactive: '#1E2732',
  indexTabBorder: '#38444D',
  indexTabShadow: 'rgba(0, 0, 0, 0.3)',
  indexTabText: '#8899A6',
  indexTabTextActive: '#FFFFFF',
} as const;

export type ThemeColors = Record<keyof typeof LightColors, string>;
export const Colors = LightColors;

/**
 * Spacing constants
 */
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

/**
 * Font sizes
 */
export const FontSizes = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 24,
  xxxl: 32,
} as const;

/**
 * Font weights
 */
export const FontWeights = {
  normal: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

/**
 * Border radius
 */
export const BorderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;

/**
 * Shadow styles
 */
export const Shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
} as const;
