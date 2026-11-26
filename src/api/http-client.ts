import { appEnv } from '@/config/env';
import { finishPageLoading, startPageLoading } from '@/shared/components/PageLoader';
import { AppError, type AppErrorCode } from './errors';

export interface HttpRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  timeoutMs?: number;
  idempotencyKey?: string;
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined' || !document.cookie) return null;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${escaped}=([^;]*)`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function buildUrl(path: string, query?: HttpRequestOptions['query']): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const base = `${appEnv.apiBaseUrl}${normalizedPath}`;
  if (!query) return base;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== '') {
      params.set(k, String(v));
    }
  }
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

interface BackendErrorPayload {
  code?: string;
  message?: string;
  detail?: string;
  field_errors?: Record<string, string | string[]>;
  errors?: Record<string, string | string[]>;
  meta?: Record<string, unknown>;
}

function normalizeFieldErrors(raw?: Record<string, string | string[]>): Record<string, string> {
  if (!raw) return {};
  const result: Record<string, string> = {};
  for (const [key, val] of Object.entries(raw)) {
    result[key] = Array.isArray(val) ? (val[0] ?? 'Giá trị không hợp lệ.') : val;
  }
  return result;
}

function mapStatusToErrorCode(status: number, backendCode?: string): AppErrorCode {
  const knownCodes: AppErrorCode[] = [
    'VALIDATION_ERROR',
    'UNAUTHORIZED',
    'FORBIDDEN',
    'NOT_FOUND',
    'CONFLICT',
    'RATE_LIMITED',
    'EXPIRED',
    'INSUFFICIENT_CAPACITY',
    'PRICE_CHANGED',
    'ACCOUNT_LOCKED',
    'ACCOUNT_NOT_ACTIVATED',
    'OTP_INVALID',
    'OTP_EXPIRED',
    'OTP_USED',
    'OTP_MAX_ATTEMPTS',
    'AI_ERROR',
    'EMAIL_DELIVERY_FAILED',
  ];
  if (backendCode && knownCodes.includes(backendCode as AppErrorCode)) {
    return backendCode as AppErrorCode;
  }
  if (status === 401) return 'UNAUTHORIZED';
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  if (status === 409) return 'CONFLICT';
  if (status === 429) return 'RATE_LIMITED';
  if (status === 400 || status === 422) return 'VALIDATION_ERROR';
  return 'SERVER_ERROR';
}

function defaultMessageForStatus(status: number): string {
  if (status === 401) return 'Phiên đăng nhập đã hết hạn hoặc chưa đăng nhập. Vui lòng đăng nhập lại.';
  if (status === 403) return 'Bạn không có quyền thực hiện thao tác này.';
  if (status === 404) return 'Không tìm thấy tài nguyên yêu cầu hoặc nội dung đã bị ẩn.';
  if (status === 409) return 'Dữ liệu đã thay đổi trên hệ thống. Vui lòng tải lại trước khi tiếp tục.';
  if (status === 429) return 'Bạn thao tác quá nhanh hoặc đã đạt giới hạn. Vui lòng thử lại sau.';
  if (status >= 500) return 'Hệ thống đang tạm gián đoạn. Vui lòng thử lại sau.';
  return 'Yêu cầu không hợp lệ. Vui lòng kiểm tra lại thông tin đã nhập.';
}

/**
 * HTTP Client dùng chung chuẩn bị sẵn cho Django Session Cookie + CSRF.
 * - Tuyệt đối không tự retry các thao tác tạo/sửa/thanh toán (POST/PUT/PATCH/DELETE).
 * - Không tự fallback sang dữ liệu mock khi gặp lỗi.
 */
export async function httpRequest<T>(path: string, options: HttpRequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET';
  const timeoutMs = options.timeoutMs ?? 15_000;
  const controller = new AbortController();
  let timedOut = false;

  const onExternalAbort = () => controller.abort();
  if (options.signal) {
    if (options.signal.aborted) {
      throw new AppError({ code: 'ABORTED', message: 'Yêu cầu đã bị hủy.', status: 0 });
    }
    options.signal.addEventListener('abort', onExternalAbort, { once: true });
  }

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...options.headers,
  };

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (options.idempotencyKey) {
    headers['Idempotency-Key'] = options.idempotencyKey;
  }

  // Đính kèm CSRF token cho các phương thức thay đổi dữ liệu khi nối Django
  if (method !== 'GET') {
    const csrfToken = readCookie(appEnv.csrfCookieName);
    if (csrfToken) {
      headers[appEnv.csrfHeaderName] = csrfToken;
    }
  }

  startPageLoading();
  try {
    const response = await fetch(buildUrl(path, options.query), {
      method,
      headers,
      credentials: 'include', // Gửi session cookie của Django
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });

    if (response.status === 204) {
      return undefined as T;
    }

    const contentType = response.headers.get('content-type') ?? '';
    const isJson = contentType.includes('application/json');
    const payload = isJson ? ((await response.json().catch(() => null)) as unknown) : null;

    if (!response.ok) {
      const errObj = (payload && typeof payload === 'object' ? payload : {}) as BackendErrorPayload;
      const code = mapStatusToErrorCode(response.status, errObj.code);
      const message = errObj.message || errObj.detail || defaultMessageForStatus(response.status);
      const fieldErrors = normalizeFieldErrors(errObj.field_errors ?? errObj.errors);
      throw new AppError({
        code,
        message,
        status: response.status,
        fieldErrors,
        meta: errObj.meta ?? {},
      });
    }

    return payload as T;
  } catch (err) {
    if (err instanceof AppError) {
      throw err;
    }
    if (timedOut) {
      throw new AppError({
        code: 'TIMEOUT',
        message: 'Yêu cầu quá thời gian chờ phản hồi. Vui lòng thử lại.',
        status: 408,
      });
    }
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new AppError({
        code: 'ABORTED',
        message: 'Yêu cầu đã bị hủy.',
        status: 0,
      });
    }
    throw new AppError({
      code: 'NETWORK_ERROR',
      message: 'Không thể kết nối tới máy chủ. Vui lòng kiểm tra kết nối mạng và thử lại.',
      status: 0,
    });
  } finally {
    finishPageLoading();
    clearTimeout(timer);
    if (options.signal) {
      options.signal.removeEventListener('abort', onExternalAbort);
    }
  }
}
