export type AppErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'EXPIRED'
  | 'INSUFFICIENT_CAPACITY'
  | 'PRICE_CHANGED'
  | 'ACCOUNT_LOCKED'
  | 'ACCOUNT_NOT_ACTIVATED'
  | 'OTP_INVALID'
  | 'OTP_EXPIRED'
  | 'OTP_USED'
  | 'OTP_MAX_ATTEMPTS'
  | 'AI_ERROR'
  | 'EMAIL_DELIVERY_FAILED'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'ABORTED'
  | 'SERVER_ERROR';

export interface AppErrorOptions {
  code: AppErrorCode;
  message: string;
  status?: number;
  fieldErrors?: Record<string, string>;
  meta?: Record<string, unknown>;
}

/**
 * Chuẩn lỗi thống nhất dùng giữa HTTP client, API adapter, Mock adapter và UI.
 * Không bao giờ hiển thị stack trace hoặc chi tiết kỹ thuật cho người dùng cuối.
 */
export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  readonly fieldErrors: Record<string, string>;
  readonly meta: Record<string, unknown>;

  constructor(options: AppErrorOptions) {
    super(options.message);
    this.name = 'AppError';
    this.code = options.code;
    this.status = options.status ?? 400;
    this.fieldErrors = options.fieldErrors ?? {};
    this.meta = options.meta ?? {};
  }
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}

export function toUserErrorMessage(err: unknown, fallback = 'Đã xảy ra lỗi. Vui lòng thử lại sau.'): string {
  if (isAppError(err)) {
    return err.message;
  }
  return fallback;
}
