/**
 * Error handling utilities
 */

/**
 * Error codes for the application
 */
export enum ErrorCode {
  // Network errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',

  // Authentication errors
  AUTH_FAILED = 'AUTH_FAILED',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  OAUTH_ERROR = 'OAUTH_ERROR',

  // API errors
  RATE_LIMIT = 'RATE_LIMIT',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  API_ERROR = 'API_ERROR',
  INVALID_API_KEY = 'INVALID_API_KEY',

  // Validation errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  PARSE_ERROR = 'PARSE_ERROR',

  // Data errors
  DUPLICATE_WORD = 'DUPLICATE_WORD',
  WORD_NOT_FOUND = 'WORD_NOT_FOUND',
  DATABASE_ERROR = 'DATABASE_ERROR',

  // Unknown error
  UNKNOWN = 'UNKNOWN',
}

/**
 * Custom error class for the application
 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly originalError?: unknown;
  readonly timestamp: string;

  constructor(code: ErrorCode, message: string, originalError?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.originalError = originalError;
    this.timestamp = new Date().toISOString();

    // Log error (in production, consider sending to error tracking service)
    // Skip logging for expected/handled cases that don't need console output
    const silentErrors: ErrorCode[] = [
      ErrorCode.WORD_NOT_FOUND, // Normal case: word not in dictionary
      ErrorCode.DUPLICATE_WORD, // Expected during PDS restore (skipped duplicates)
      ErrorCode.RATE_LIMIT, // Expected when API limits are hit
      ErrorCode.RATE_LIMIT_EXCEEDED, // Expected when API limits are hit
    ];
    if (__DEV__ && !silentErrors.includes(code)) {
      console.error(`[${this.timestamp}] ${code}: ${message}`, originalError);
    }
  }

  /**
   * Get user-friendly error message
   */
  getUserMessage(): string {
    return this.message;
  }

  /**
   * Check if error is retryable
   */
  isRetryable(): boolean {
    return [
      ErrorCode.NETWORK_ERROR,
      ErrorCode.TIMEOUT,
      ErrorCode.API_ERROR,
    ].includes(this.code);
  }

  /**
   * Check if error is authentication related
   */
  isAuthError(): boolean {
    return [ErrorCode.AUTH_FAILED, ErrorCode.TOKEN_EXPIRED].includes(this.code);
  }
}

/**
 * Map various error types to AppError
 */
export function mapToAppError(error: unknown, context: string): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof TypeError) {
    if (
      error.message.includes('Network') ||
      error.message.includes('fetch') ||
      error.message.includes('Failed to fetch')
    ) {
      return new AppError(
        ErrorCode.NETWORK_ERROR,
        'ネットワーク接続を確認してください。',
        error
      );
    }
  }

  if (error instanceof Error) {
    if (error.message.includes('timeout') || error.message.includes('Timeout')) {
      return new AppError(
        ErrorCode.TIMEOUT,
        'リクエストがタイムアウトしました。',
        error
      );
    }

    if (
      error.message.includes('401') ||
      error.message.includes('Unauthorized')
    ) {
      return new AppError(
        ErrorCode.AUTH_FAILED,
        '認証に失敗しました。再度ログインしてください。',
        error
      );
    }

    if (
      error.message.includes('429') ||
      error.message.includes('rate limit')
    ) {
      return new AppError(
        ErrorCode.RATE_LIMIT,
        'リクエストが多すぎます。しばらく待ってから再試行してください。',
        error
      );
    }
  }

  return new AppError(
    ErrorCode.UNKNOWN,
    `${context}でエラーが発生しました。`,
    error
  );
}

/**
 * Create a validation error
 */
export function validationError(message: string): AppError {
  return new AppError(ErrorCode.VALIDATION_ERROR, message);
}

/**
 * Create a network error
 */
export function networkError(message: string, originalError?: unknown): AppError {
  return new AppError(ErrorCode.NETWORK_ERROR, message, originalError);
}

/**
 * Create an auth error
 */
export function authError(message: string, originalError?: unknown): AppError {
  return new AppError(ErrorCode.AUTH_FAILED, message, originalError);
}

/**
 * Create a database error
 */
export function databaseError(message: string, originalError?: unknown): AppError {
  return new AppError(ErrorCode.DATABASE_ERROR, message, originalError);
}
