/**
 * Network Monitor Service
 * Monitors network connectivity status and provides hooks for components
 */

import NetInfo, { NetInfoState, NetInfoSubscription } from '@react-native-community/netinfo';

/**
 * Listener callback type
 */
type NetworkListener = (isConnected: boolean) => void;

/**
 * Network Monitor Class
 * Singleton pattern for centralized network state management
 */
class NetworkMonitor {
  private isConnected: boolean = true;
  private listeners: Set<NetworkListener> = new Set();
  private unsubscribe: NetInfoSubscription | null = null;
  private isStarted: boolean = false;

  /**
   * Start network monitoring
   */
  start(): void {
    if (this.isStarted) {
      return;
    }

    this.isStarted = true;

    // Get initial state
    NetInfo.fetch().then((state) => {
      this.updateConnectionStatus(state);
    });

    // Subscribe to network state changes
    this.unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      this.updateConnectionStatus(state);
    });
  }

  /**
   * Stop network monitoring
   */
  stop(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.isStarted = false;
  }

  /**
   * Update connection status and notify listeners
   */
  private updateConnectionStatus(state: NetInfoState): void {
    const wasConnected = this.isConnected;
    this.isConnected = state.isConnected ?? false;

    if (wasConnected !== this.isConnected) {
      if (__DEV__) {
        console.log(
          `Network status changed: ${this.isConnected ? 'online' : 'offline'}`
        );
      }
      this.notifyListeners();
    }
  }

  /**
   * Get current network connection status
   */
  getIsConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Subscribe to network status changes
   * @param listener - Callback function to be called when network status changes
   * @returns Unsubscribe function
   */
  subscribe(listener: NetworkListener): () => void {
    this.listeners.add(listener);

    // Immediately notify the listener of current state
    listener(this.isConnected);

    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify all listeners of network status change
   */
  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      try {
        listener(this.isConnected);
      } catch (error) {
        if (__DEV__) {
          console.error('Error in network listener:', error);
        }
      }
    });
  }

  /**
   * Check if network is available before performing an operation
   * @throws Error if network is not available
   */
  requireNetwork(): void {
    if (!this.isConnected) {
      throw new Error('ネットワーク接続がありません');
    }
  }

  /**
   * Perform an async operation that requires network connectivity
   * @param operation - The async operation to perform
   * @param offlineMessage - Custom message to show when offline
   * @returns The result of the operation or throws an error
   */
  async withNetwork<T>(
    operation: () => Promise<T>,
    offlineMessage: string = 'この操作にはネットワーク接続が必要です。'
  ): Promise<T> {
    if (!this.isConnected) {
      throw new Error(offlineMessage);
    }

    return await operation();
  }

  /**
   * Check current network state (async)
   * Useful for getting fresh network state
   */
  async checkNetworkState(): Promise<boolean> {
    try {
      const state = await NetInfo.fetch();
      this.updateConnectionStatus(state);
      return this.isConnected;
    } catch (error) {
      if (__DEV__) {
        console.error('Error checking network state:', error);
      }
      return false;
    }
  }
}

// Export singleton instance
export const networkMonitor = new NetworkMonitor();

// Export class for testing purposes
export { NetworkMonitor };
