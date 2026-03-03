/**
 * Tab Color Settings Screen
 * Allows users to select accent colors for each home tab.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ban, Check } from 'lucide-react-native';
import { useTheme } from '../hooks/useTheme';
import { Spacing, FontSizes, BorderRadius } from '../constants/colors';
import { useTabColorStore, TAB_COLOR_PRESETS } from '../store/tabColorStore';

interface SwatchRowProps {
  selectedColor: string | null;
  onSelect: (color: string | null) => void;
}

function SwatchRow({ selectedColor, onSelect }: SwatchRowProps): React.JSX.Element {
  const { t } = useTranslation('settings');
  const { colors } = useTheme();
  const isNoneSelected = selectedColor === null;

  return (
    <View style={styles.swatchRow}>
      {/* No color option */}
      <Pressable
        onPress={() => onSelect(null)}
        style={[
          styles.swatch,
          styles.swatchNone,
          { borderColor: isNoneSelected ? colors.text : colors.border },
          isNoneSelected && styles.swatchNoneSelected,
        ]}
        accessibilityRole="radio"
        accessibilityState={{ selected: isNoneSelected }}
        accessibilityLabel={t('tabColors.none')}
      >
        <Ban size={16} color={isNoneSelected ? colors.text : colors.border} strokeWidth={2} />
      </Pressable>

      {TAB_COLOR_PRESETS.map((color) => {
        const isSelected = color === selectedColor;
        return (
          <Pressable
            key={color}
            onPress={() => onSelect(color)}
            style={[
              styles.swatch,
              { backgroundColor: color },
              isSelected && styles.swatchSelected,
            ]}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={color}
          >
            {isSelected && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
          </Pressable>
        );
      })}
    </View>
  );
}

interface SectionProps {
  label: string;
  selectedColor: string | null;
  onSelect: (color: string | null) => void;
}

function ColorSection({ label, selectedColor, onSelect }: SectionProps): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <View style={[styles.section, { borderColor: colors.border }]}>
      <View style={styles.sectionHeader}>
        <View
          style={[
            styles.sectionAccentDot,
            selectedColor
              ? { backgroundColor: selectedColor }
              : { borderWidth: 1.5, borderColor: colors.border },
          ]}
        />
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{label}</Text>
      </View>
      <SwatchRow selectedColor={selectedColor} onSelect={onSelect} />
    </View>
  );
}

export function TabColorSettingsScreen(): React.JSX.Element {
  const { t } = useTranslation('settings');
  const { colors } = useTheme();

  const {
    followingColor, setFollowingColor,
    customFeedColor, setCustomFeedColor,
    profileColor, setProfileColor,
  } = useTabColorStore();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <ColorSection
          label={t('tabColors.following')}
          selectedColor={followingColor}
          onSelect={setFollowingColor}
        />
        <ColorSection
          label={t('tabColors.customFeed')}
          selectedColor={customFeedColor}
          onSelect={setCustomFeedColor}
        />
        <ColorSection
          label={t('tabColors.profile')}
          selectedColor={profileColor}
          onSelect={setProfileColor}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

export default TabColorSettingsScreen;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  section: {
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  sectionAccentDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  sectionTitle: {
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  swatchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  swatchSelected: {
    borderWidth: 2.5,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  swatchNone: {
    borderWidth: 1.5,
  },
  swatchNoneSelected: {
    borderWidth: 2.5,
  },
});
