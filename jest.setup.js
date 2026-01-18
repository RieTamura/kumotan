// Mock expo-secure-store
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

// Mock expo-sqlite
jest.mock('expo-sqlite', () => ({
  openDatabaseSync: jest.fn(() => ({
    execSync: jest.fn(),
    runSync: jest.fn(),
    getFirstSync: jest.fn(),
    getAllSync: jest.fn(),
    runAsync: jest.fn(),
    getFirstAsync: jest.fn(),
    getAllAsync: jest.fn(),
    execAsync: jest.fn(),
  })),
}));

// Mock @react-native-async-storage/async-storage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}));

// Mock @react-native-community/netinfo
jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn(() => Promise.resolve({ isConnected: true, isInternetReachable: true })),
  addEventListener: jest.fn(() => jest.fn()),
}));

// Mock expo-clipboard
jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(),
  getStringAsync: jest.fn(),
}));

// Mock expo-sharing
jest.mock('expo-sharing', () => ({
  shareAsync: jest.fn(),
  isAvailableAsync: jest.fn(() => Promise.resolve(true)),
}));

// Mock expo-web-browser
jest.mock('expo-web-browser', () => ({
  openAuthSessionAsync: jest.fn(),
  dismissAuthSession: jest.fn(),
}));

// Mock expo-linking
jest.mock('expo-linking', () => ({
  createURL: jest.fn((path) => `exp://test/${path}`),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
}));

// Mock react-native-view-shot
jest.mock('react-native-view-shot', () => ({
  captureRef: jest.fn(() => Promise.resolve('mock-uri')),
  default: 'ViewShot',
}));

// Mock lucide-react-native
jest.mock('lucide-react-native', () => ({
  Share: 'Share',
  RefreshCw: 'RefreshCw',
  BookOpen: 'BookOpen',
  CheckCircle: 'CheckCircle',
  BarChart3: 'BarChart3',
  Calendar: 'Calendar',
  Flame: 'Flame',
  MessageCircle: 'MessageCircle',
  Repeat2: 'Repeat2',
  Heart: 'Heart',
  Trash2: 'Trash2',
  Check: 'Check',
  ChevronLeft: 'ChevronLeft',
  ChevronRight: 'ChevronRight',
  X: 'X',
}));

// Define __DEV__ for tests
global.__DEV__ = process.env.NODE_ENV !== 'production';

// Suppress console warnings in tests
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
};
