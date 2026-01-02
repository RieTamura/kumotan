import { AppError } from '../utils/errors';

/**
 * 統一されたResult型
 * 成功時はdataを、失敗時はerrorを返す
 */
export type Result<T, E = AppError> =
  | { success: true; data: T }
  | { success: false; error: E };

/**
 * Result型のヘルパー関数
 */
export const Result = {
  /**
   * 成功結果を作成
   */
  ok<T>(data: T): Result<T, never> {
    return { success: true, data };
  },

  /**
   * 失敗結果を作成
   */
  err<E>(error: E): Result<never, E> {
    return { success: false, error };
  },

  /**
   * Result型かどうかを判定
   */
  isResult<T, E>(value: unknown): value is Result<T, E> {
    return (
      typeof value === 'object' &&
      value !== null &&
      'success' in value &&
      typeof (value as Result<T, E>).success === 'boolean'
    );
  },

  /**
   * 成功時の値を取得（失敗時はデフォルト値）
   */
  unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
    return result.success ? result.data : defaultValue;
  },

  /**
   * 成功時の値を変換
   */
  map<T, U, E>(result: Result<T, E>, fn: (data: T) => U): Result<U, E> {
    if (result.success) {
      return { success: true, data: fn(result.data) };
    }
    return result;
  },

  /**
   * 成功時に別のResult型を返す処理を実行
   */
  flatMap<T, U, E>(
    result: Result<T, E>,
    fn: (data: T) => Result<U, E>
  ): Result<U, E> {
    if (result.success) {
      return fn(result.data);
    }
    return result;
  },
};
