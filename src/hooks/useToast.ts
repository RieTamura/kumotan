/**
 * Toast Hook
 * Provides toast notification functionality across the app
 */

import { useState, useCallback } from 'react';
import type { ToastType } from '../components/common/Toast';

export interface ToastState {
  visible: boolean;
  message: string;
  type: ToastType;
  duration: number;
}

export interface UseToastReturn {
  toastState: ToastState;
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  showSuccess: (message: string, duration?: number) => void;
  showError: (message: string, duration?: number) => void;
  showWarning: (message: string, duration?: number) => void;
  showInfo: (message: string, duration?: number) => void;
  hideToast: () => void;
}

/**
 * Custom hook for managing toast notifications
 */
export function useToast(): UseToastReturn {
  const [toastState, setToastState] = useState<ToastState>({
    visible: false,
    message: '',
    type: 'info',
    duration: 3000,
  });

  /**
   * Show toast with custom options
   */
  const showToast = useCallback(
    (message: string, type: ToastType = 'info', duration: number = 3000) => {
      setToastState({
        visible: true,
        message,
        type,
        duration,
      });
    },
    []
  );

  /**
   * Show success toast
   */
  const showSuccess = useCallback(
    (message: string, duration: number = 3000) => {
      showToast(message, 'success', duration);
    },
    [showToast]
  );

  /**
   * Show error toast
   */
  const showError = useCallback(
    (message: string, duration: number = 3000) => {
      showToast(message, 'error', duration);
    },
    [showToast]
  );

  /**
   * Show warning toast
   */
  const showWarning = useCallback(
    (message: string, duration: number = 3000) => {
      showToast(message, 'warning', duration);
    },
    [showToast]
  );

  /**
   * Show info toast
   */
  const showInfo = useCallback(
    (message: string, duration: number = 3000) => {
      showToast(message, 'info', duration);
    },
    [showToast]
  );

  /**
   * Hide toast
   */
  const hideToast = useCallback(() => {
    setToastState((prev) => ({
      ...prev,
      visible: false,
    }));
  }, []);

  return {
    toastState,
    showToast,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    hideToast,
  };
}

export default useToast;
