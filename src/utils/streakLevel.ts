/**
 * Streak Level Utility
 * Returns icon, icon color, and card background color based on consecutive study days.
 * The visual metaphor is plant growth: seed → sprout → leaf → shrub → tree → forest.
 */

import {
  Sprout,
  Leaf,
  Shrub,
  TreeDeciduous,
  Trees,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

interface StreakLevel {
  Icon: LucideIcon;
  iconColor: string;
  backgroundColor: string;
}

const levels: { minDays: number; Icon: LucideIcon; iconColor: string; lightBg: string; darkBg: string }[] = [
  { minDays: 43, Icon: Trees,         iconColor: '#1B5E20', lightBg: '#F3E5F5', darkBg: 'rgba(243, 229, 245, 0.12)' },
  { minDays: 29, Icon: TreeDeciduous,  iconColor: '#2E7D32', lightBg: '#FFF3E0', darkBg: 'rgba(255, 243, 224, 0.12)' },
  { minDays: 15, Icon: Shrub,          iconColor: '#388E3C', lightBg: '#FFF8E1', darkBg: 'rgba(255, 248, 225, 0.12)' },
  { minDays: 8,  Icon: Leaf,           iconColor: '#43A047', lightBg: '#E0F2E0', darkBg: 'rgba(224, 242, 224, 0.12)' },
  { minDays: 1,  Icon: Sprout,         iconColor: '#66BB6A', lightBg: '#E8F5E9', darkBg: 'rgba(232, 245, 233, 0.12)' },
];

const defaultLevel = {
  Icon: Sprout,
  iconColor: '#9E9E9E',
  lightBg: '#F5F5F5',
  darkBg: 'rgba(245, 245, 245, 0.08)',
};

export function getStreakLevel(streak: number, isDark: boolean): StreakLevel {
  if (streak <= 0) {
    return {
      Icon: defaultLevel.Icon,
      iconColor: defaultLevel.iconColor,
      backgroundColor: isDark ? defaultLevel.darkBg : defaultLevel.lightBg,
    };
  }

  for (const level of levels) {
    if (streak >= level.minDays) {
      return {
        Icon: level.Icon,
        iconColor: level.iconColor,
        backgroundColor: isDark ? level.darkBg : level.lightBg,
      };
    }
  }

  // Fallback (streak >= 1 but didn't match — shouldn't happen)
  const first = levels[levels.length - 1];
  return {
    Icon: first.Icon,
    iconColor: first.iconColor,
    backgroundColor: isDark ? first.darkBg : first.lightBg,
  };
}
