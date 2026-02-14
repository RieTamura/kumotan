/**
 * Tutorial Hook
 * Manages tutorial state and progression
 */

import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TUTORIAL_COMPLETED_KEY = '@kumotan:tutorial_completed';

export interface TargetPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TutorialStep {
  id: string;
  title: string;
  description: string;
  targetPosition?: TargetPosition;
  arrowDirection?: 'up' | 'down' | 'left' | 'right';
}

interface UseTutorialReturn {
  isActive: boolean;
  currentStepIndex: number;
  currentStepData: TutorialStep | null;
  totalSteps: number;
  nextStep: () => void;
  prevStep: () => void;
  skipTutorial: () => void;
  startTutorial: () => void;
  resetTutorial: () => Promise<void>;
}

/**
 * Hook to manage tutorial state
 * @param steps - Array of tutorial steps
 * @param shouldAutoStart - Whether to auto-start tutorial for first-time users
 */
export function useTutorial(
  steps: TutorialStep[],
  shouldAutoStart: boolean = true
): UseTutorialReturn {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [hasCheckedStorage, setHasCheckedStorage] = useState(false);

  // Check if tutorial has been completed before
  useEffect(() => {
    const checkTutorialStatus = async () => {
      try {
        const completed = await AsyncStorage.getItem(TUTORIAL_COMPLETED_KEY);
        if (completed !== 'true' && shouldAutoStart) {
          // Small delay to let the UI render first
          setTimeout(() => {
            setIsActive(true);
          }, 500);
        }
        setHasCheckedStorage(true);
      } catch (error) {
        if (__DEV__) {
          console.error('Failed to check tutorial status:', error);
        }
        setHasCheckedStorage(true);
      }
    };

    checkTutorialStatus();
  }, [shouldAutoStart]);

  // Mark tutorial as completed
  const completeTutorial = useCallback(async () => {
    try {
      await AsyncStorage.setItem(TUTORIAL_COMPLETED_KEY, 'true');
    } catch (error) {
      if (__DEV__) {
        console.error('Failed to save tutorial status:', error);
      }
    }
  }, []);

  // Go to next step or complete tutorial
  const nextStep = useCallback(() => {
    if (currentStep < steps.length) {
      setCurrentStep((prev) => prev + 1);
    } else {
      // Tutorial completed
      setIsActive(false);
      setCurrentStep(1);
      completeTutorial();
    }
  }, [currentStep, steps.length, completeTutorial]);

  // Go to previous step
  const prevStep = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  }, [currentStep]);

  // Skip tutorial entirely
  const skipTutorial = useCallback(() => {
    setIsActive(false);
    setCurrentStep(1);
    completeTutorial();
  }, [completeTutorial]);

  // Manually start tutorial
  const startTutorial = useCallback(() => {
    setCurrentStep(1);
    setIsActive(true);
  }, []);

  // Reset tutorial (for testing or settings)
  const resetTutorial = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(TUTORIAL_COMPLETED_KEY);
      setCurrentStep(1);
    } catch (error) {
      if (__DEV__) {
        console.error('Failed to reset tutorial:', error);
      }
    }
  }, []);

  // Get current step data (0-indexed array, currentStep is 1-indexed)
  const currentStepData = isActive && currentStep >= 1 && currentStep <= steps.length
    ? steps[currentStep - 1]
    : null;

  return {
    isActive: hasCheckedStorage && isActive,
    currentStepIndex: currentStep,
    currentStepData,
    totalSteps: steps.length,
    nextStep,
    prevStep,
    skipTutorial,
    startTutorial,
    resetTutorial,
  };
}

export default useTutorial;
