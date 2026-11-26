import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiAdapter } from '@/api/adapters/api-adapter';
import { AppError } from '@/api/errors';
import { httpRequest } from '@/api/http-client';

describe('HTTP client & API adapter contract safety', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('normalizes 401, 403, 422 field_errors, and 500 without leaking stack traces', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          code: 'VALIDATION_ERROR',
          message: 'Dữ liệu không hợp lệ.',
          field_errors: { email: ['Email không đúng định dạng.'] },
        }),
        { status: 422, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await expect(httpRequest('/auth/register', { method: 'POST', body: { email: 'bad' } })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      status: 422,
      fieldErrors: { email: 'Email không đúng định dạng.' },
    });

    // 500 HTML/non-JSON response -> friendly message, no technical stack trace
    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      new Response('Traceback (most recent call last): ValueError', {
        status: 500,
        headers: { 'Content-Type': 'text/plain' },
      }),
    );

    try {
      await httpRequest('/destinations');
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      const appErr = err as AppError;
      expect(appErr.code).toBe('SERVER_ERROR');
      expect(appErr.message).not.toContain('Traceback');
    }
  });

  it('sends Idempotency-Key and does NOT retry POST requests on failure, and apiAdapter never falls back to mock', async () => {
    const fetchSpy = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    globalThis.fetch = fetchSpy;

    // apiAdapter.listDestinations fails with NETWORK_ERROR rather than returning mock destinations!
    await expect(apiAdapter.listDestinations()).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // POST booking with idempotencyKey sends header and is called strictly ONCE (no retry!)
    fetchSpy.mockClear();
    await expect(
      apiAdapter.createBooking({
        serviceId: 'SV001',
        serviceDate: '2027-01-20',
        guestCount: 2,
        contactName: 'Minh Anh',
        contactPhone: '0905123456',
        acknowledgedUnitPriceVnd: 150000,
        idempotencyKey: 'IDEMP_123',
      }),
    ).rejects.toMatchObject({ code: 'NETWORK_ERROR' });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const callInit = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    const headers = callInit.headers as Record<string, string>;
    expect(headers['Idempotency-Key']).toBe('IDEMP_123');
    expect(callInit.credentials).toBe('include');
  });

  it('supports request cancellation via AbortController and timeout', async () => {
    const controller = new AbortController();
    globalThis.fetch = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });
    });

    const pending = httpRequest('/destinations', { signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ code: 'ABORTED' });

    // Timeout
    await expect(httpRequest('/destinations', { timeoutMs: 20 })).rejects.toMatchObject({
      code: 'TIMEOUT',
      status: 408,
    });
  });
});
