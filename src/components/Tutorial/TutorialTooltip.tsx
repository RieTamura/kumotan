/**
 * Tutorial Tooltip Component
 * Displays a tooltip with an arrow pointing to a highlighted area
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Dimensions,
} from 'react-native';
import { Colors, Spacing, FontSizes, BorderRadius } from '../../constants/colors';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export interface TooltipPosition {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
}

export interface HighlightArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface TutorialTooltipProps {
  visible: boolean;
  title: string;
  description: string;
  tooltipPosition: TooltipPosition;
  highlightArea?: HighlightArea;
  arrowDirection: 'up' | 'down' | 'left' | 'right';
  onNext: () => void;
  onSkip: () => void;
  currentStep: number;
  totalSteps: number;
  nextLabel: string;
  skipLabel: string;
}

export function TutorialTooltip({
  visible,
  title,
  description,
  tooltipPosition,
  highlightArea,
  arrowDirection,
  onNext,
  onSkip,
  currentStep,
  totalSteps,
  nextLabel,
  skipLabel,
}: TutorialTooltipProps): React.JSX.Element | null {
  if (!visible) return null;

  const isLastStep = currentStep === totalSteps;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        {/* Highlight cutout */}
        {highlightArea && (
          <View
            style={[
              styles.highlight,
              {
                top: highlightArea.y - 4,
                left: highlightArea.x - 4,
                width: highlightArea.width + 8,
                height: highlightArea.height + 8,
              },
            ]}
          />
        )}

        {/* Tooltip */}
        <View style={[styles.tooltipContainer, tooltipPosition]}>
          {/* Arrow */}
          <View
            style={[
              styles.arrow,
              arrowDirection === 'up' && styles.arrowUp,
              arrowDirection === 'down' && styles.arrowDown,
              arrowDirection === 'left' && styles.arrowLeft,
              arrowDirection === 'right' && styles.arrowRight,
            ]}
          />

          {/* Content */}
          <View style={styles.tooltipContent}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.description}>{description}</Text>

            {/* Progress indicator */}
            <View style={styles.progressContainer}>
              {Array.from({ length: totalSteps }).map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.progressDot,
                    index + 1 === currentStep && styles.progressDotActive,
                    index + 1 < currentStep && styles.progressDotCompleted,
                  ]}
                />
              ))}
            </View>

            {/* Buttons */}
            <View style={styles.buttonContainer}>
              <Pressable style={styles.skipButton} onPress={onSkip}>
                <Text style={styles.skipButtonText}>{skipLabel}</Text>
              </Pressable>
              <Pressable style={styles.nextButton} onPress={onNext}>
                <Text style={styles.nextButtonText}>
                  {isLastStep ? nextLabel : `${nextLabel} (${currentStep}/${totalSteps})`}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  highlight: {
    position: 'absolute',
    backgroundColor: 'transparent',
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderColor: Colors.primary,
    // Create a "hole" effect with shadow
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10,
  },
  tooltipContainer: {
    position: 'absolute',
    maxWidth: SCREEN_WIDTH - Spacing.xl * 2,
  },
  tooltipContent: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  arrow: {
    position: 'absolute',
    width: 0,
    height: 0,
    borderStyle: 'solid',
  },
  arrowUp: {
    top: -10,
    left: '50%',
    marginLeft: -10,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderBottomWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: Colors.background,
  },
  arrowDown: {
    bottom: -10,
    left: '50%',
    marginLeft: -10,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: Colors.background,
  },
  arrowLeft: {
    left: -10,
    top: '50%',
    marginTop: -10,
    borderTopWidth: 10,
    borderBottomWidth: 10,
    borderRightWidth: 10,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderRightColor: Colors.background,
  },
  arrowRight: {
    right: -10,
    top: '50%',
    marginTop: -10,
    borderTopWidth: 10,
    borderBottomWidth: 10,
    borderLeftWidth: 10,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: Colors.background,
  },
  title: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  description: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    lineHeight: FontSizes.md * 1.5,
    marginBottom: Spacing.md,
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.border,
  },
  progressDotActive: {
    backgroundColor: Colors.primary,
    width: 24,
  },
  progressDotCompleted: {
    backgroundColor: Colors.primary,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  skipButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  skipButtonText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  nextButton: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  nextButtonText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.background,
  },
});

export default TutorialTooltip;
