import AsyncStorage from '@react-native-async-storage/async-storage';
// import { SimpleStore } from '@atproto/oauth-client';

// If SimpleStore is not exported directly, we define it based on knowledge
// However, implementing SessionStore and StateStore interfaces is what matters.

export class AsyncStorageStore<V> {
  constructor(private prefix: string) { }

  async get(key: string, options?: any): Promise<V | undefined> {
    try {
      const val = await AsyncStorage.getItem(this.prefix + ":" + key);
      return val ? JSON.parse(val) : undefined;
    } catch (e) {
      console.error('AsyncStorage get error', e);
      return undefined;
    }
  }

  async set(key: string, value: V): Promise<void> {
    try {
      await AsyncStorage.setItem(this.prefix + ":" + key, JSON.stringify(value));
    } catch (e) {
      console.error('AsyncStorage set error', e);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.prefix + ":" + key);
    } catch (e) {
      console.error('AsyncStorage del error', e);
    }
  }
}
