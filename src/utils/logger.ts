/**
 * Remote Logger for Production Environment
 * Stores logs locally for debugging TestFlight builds
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const LOG_STORAGE_KEY = '@kumotan:debug_logs';
const MAX_LOGS = 200; // Keep last 200 log entries

interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  tag: string;
  message: string;
  data?: any;
}

/**
 * Store a log entry
 */
async function storeLog(entry: LogEntry): Promise<void> {
  try {
    const existingLogs = await getLogs();
    const newLogs = [...existingLogs, entry].slice(-MAX_LOGS); // Keep only last MAX_LOGS entries
    await AsyncStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(newLogs));
  } catch (error) {
    // Silently fail to avoid infinite loops
    console.warn('Failed to store log:', error);
  }
}

/**
 * Get all stored logs
 */
export async function getLogs(): Promise<LogEntry[]> {
  try {
    const logsJson = await AsyncStorage.getItem(LOG_STORAGE_KEY);
    if (!logsJson) return [];
    return JSON.parse(logsJson);
  } catch (error) {
    console.warn('Failed to get logs:', error);
    return [];
  }
}

/**
 * Clear all stored logs
 */
export async function clearLogs(): Promise<void> {
  try {
    await AsyncStorage.removeItem(LOG_STORAGE_KEY);
  } catch (error) {
    console.warn('Failed to clear logs:', error);
  }
}

/**
 * Get logs as formatted string for sharing
 */
export async function getLogsAsString(): Promise<string> {
  const logs = await getLogs();
  return logs
    .map(log => `[${log.timestamp}] [${log.level.toUpperCase()}] [${log.tag}] ${log.message}${log.data ? '\n' + JSON.stringify(log.data, null, 2) : ''}`)
    .join('\n\n');
}

/**
 * Log with info level
 */
export function logInfo(tag: string, message: string, data?: any): void {
  const timestamp = new Date().toISOString();
  const entry: LogEntry = { timestamp, level: 'info', tag, message, data };

  console.log(`[${tag}] ${message}`, data || '');
  storeLog(entry);
}

/**
 * Log with warning level
 */
export function logWarn(tag: string, message: string, data?: any): void {
  const timestamp = new Date().toISOString();
  const entry: LogEntry = { timestamp, level: 'warn', tag, message, data };

  console.warn(`[${tag}] ${message}`, data || '');
  storeLog(entry);
}

/**
 * Log with error level
 */
export function logError(tag: string, message: string, data?: any): void {
  const timestamp = new Date().toISOString();
  const entry: LogEntry = { timestamp, level: 'error', tag, message, data };

  console.error(`[${tag}] ${message}`, data || '');
  storeLog(entry);
}

/**
 * Enhanced logger for OAuth flow
 */
export const oauthLogger = {
  info: (message: string, data?: any) => logInfo('OAuth', message, data),
  warn: (message: string, data?: any) => logWarn('OAuth', message, data),
  error: (message: string, data?: any) => logError('OAuth', message, data),
};
