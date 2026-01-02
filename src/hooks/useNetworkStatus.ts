/**
 * Network Status Hook
 * Provides React hook for monitoring network connectivity
 */

import { useState, useEffect } from 'react';
import { networkMonitor } from '../services/network/monitor';

/**
 * Hook to monitor network connectivity status
 * @returns boolean indicating if device is connected to network
 */
export function useNetworkStatus(): boolean {
  const [isConnected, setIsConnected] = useState<boolean>(
    networkMonitor.getIsConnected()
  );

  useEffect(() => {
    // Subscribe to network status changes
    const unsubscribe = networkMonitor.subscribe((connected) => {
      setIsConnected(connected);
    });

    // Start monitoring if not already started
    networkMonitor.start();

    // Cleanup on unmount
    return () => {
      unsubscribe();
    };
  }, []);

  return isConnected;
}

/**
 * Hook that returns both connection status and a refresh function
 */
export function useNetworkStatusWithRefresh(): {
  isConnected: boolean;
  refresh: () => Promise<boolean>;
} {
  const [isConnected, setIsConnected] = useState<boolean>(
    networkMonitor.getIsConnected()
  );

  useEffect(() => {
    const unsubscribe = networkMonitor.subscribe((connected) => {
      setIsConnected(connected);
    });

    networkMonitor.start();

    return () => {
      unsubscribe();
    };
  }, []);

  const refresh = async (): Promise<boolean> => {
    const connected = await networkMonitor.checkNetworkState();
    setIsConnected(connected);
    return connected;
  };

  return { isConnected, refresh };
}

/**
 * Hook that throws an error or shows a message when offline
 * Useful for components that require network connectivity
 */
export function useRequireNetwork(
  errorMessage: string = 'この操作にはネットワーク接続が必要です。'
): {
  isConnected: boolean;
  checkNetwork: () => void;
} {
  const isConnected = useNetworkStatus();

  const checkNetwork = () => {
    if (!isConnected) {
      throw new Error(errorMessage);
    }
  };

  return { isConnected, checkNetwork };
}

export default useNetworkStatus;
