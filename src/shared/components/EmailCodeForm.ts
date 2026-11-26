import type { OtpChallengeState } from '@/api/contracts';
import { escapeHtml } from '@/shared/utils/dom';
import { formatCountdownMmSs, secondsRemaining } from '@/shared/utils/format';

export interface EmailCodeFormMountOptions {
  container: HTMLElement;
  state: OtpChallengeState;
  onResend: () => Promise<OtpChallengeState>;
  onCleanup: (fn: () => void) => void;
  getNowMs?: () => number;
}

export interface EmailCodeFormController {
  getCode: () => string;
  setFieldError: (msg: string | null) => void;
  updateState: (next: OtpChallengeState) => void;
}

export function renderEmailCodeInputHtml(idPrefix = 'otp'): string {
  return `
    <div class="flex flex-col gap-space-3">
      <div class="flex items-center justify-between gap-space-2">
        <label for="${idPrefix}-digit-0" class="font-label text-label-md text-on-surface">Mã xác thực 6 chữ số</label>
        <span data-otp-expiry class="font-label text-label-sm text-primary tabular-nums"></span>
      </div>
      <div class="grid grid-cols-6 gap-space-2" role="group" aria-label="Nhập mã xác thực 6 chữ số">
        ${Array.from({ length: 6 })
          .map(
            (_, idx) => `
          <input
            id="${idPrefix}-digit-${idx}"
            data-otp-digit="${idx}"
            type="text"
            inputmode="numeric"
            autocomplete="${idx === 0 ? 'one-time-code' : 'off'}"
            maxlength="${idx === 0 ? '6' : '1'}"
            aria-label="Chữ số thứ ${idx + 1}"
            class="w-full min-h-[48px] text-center font-headline text-headline-md text-on-surface bg-surface border border-border rounded focus:border-primary focus:ring-2 focus:ring-primary/20 tabular-nums"
          />
        `,
          )
          .join('')}
      </div>
      <p data-otp-error class="hidden font-body text-body-md text-error"></p>
      <div class="flex flex-wrap items-center justify-between gap-space-2 bg-surface-muted border border-border rounded p-space-3">
        <p data-otp-resend-status class="font-body text-body-md text-text-secondary tabular-nums"></p>
        <button type="button" data-otp-resend-btn class="min-h-[44px] px-space-3 rounded border border-primary text-primary hover:bg-primary-light disabled:opacity-50 disabled:cursor-not-allowed font-label text-label-sm transition-colors">
          Gửi lại mã
        </button>
      </div>
    </div>
  `;
}

export function mountEmailCodeForm(opts: EmailCodeFormMountOptions): EmailCodeFormController {
  let currentState = opts.state;
  const digits = Array.from(opts.container.querySelectorAll<HTMLInputElement>('[data-otp-digit]'));
  const expiryEl = opts.container.querySelector<HTMLElement>('[data-otp-expiry]');
  const resendStatusEl = opts.container.querySelector<HTMLElement>('[data-otp-resend-status]');
  const resendBtn = opts.container.querySelector<HTMLButtonElement>('[data-otp-resend-btn]');
  const errorEl = opts.container.querySelector<HTMLElement>('[data-otp-error]');

  const getNow = opts.getNowMs ?? (() => Date.now());

  const updateCountdowns = () => {
    const now = getNow();
    const expSec = secondsRemaining(currentState.expiresAt, now);
    const lockSec = secondsRemaining(currentState.burstLockedUntil, now);
    const resendSec = secondsRemaining(currentState.resendAvailableAt, now);

    if (expiryEl) {
      if (!currentState.expiresAt) {
        expiryEl.textContent = 'Chưa có mã hiệu lực';
        expiryEl.className = 'font-label text-label-sm text-text-secondary tabular-nums';
      } else if (expSec > 0) {
        expiryEl.textContent = `Mã hết hạn sau ${formatCountdownMmSs(expSec)}`;
        expiryEl.className =
          expSec <= 60
            ? 'font-label text-label-sm text-warning tabular-nums'
            : 'font-label text-label-sm text-primary tabular-nums';
      } else {
        expiryEl.textContent = 'Mã hiện tại đã hết hạn';
        expiryEl.className = 'font-label text-label-sm text-error tabular-nums';
      }
    }

    if (resendStatusEl && resendBtn) {
      if (lockSec > 0) {
        resendStatusEl.textContent = `Bạn đã đạt giới hạn gửi mã (5/5). Thử lại sau ${formatCountdownMmSs(lockSec)}. Mã vừa nhận vẫn dùng được trong 5 phút.`;
        resendBtn.disabled = true;
      } else if (resendSec > 0) {
        resendStatusEl.textContent = `Gửi lại sau ${formatCountdownMmSs(resendSec)} (Đã gửi ${currentState.sendsUsedInBurst}/${currentState.maxSendsPerBurst} lần)`;
        resendBtn.disabled = true;
      } else {
        resendStatusEl.textContent = `Chưa nhận được mã? Bạn có thể yêu cầu gửi lại (${currentState.sendsUsedInBurst}/${currentState.maxSendsPerBurst} lần).`;
        resendBtn.disabled = false;
      }
    }
  };

  digits.forEach((input, idx) => {
    input.addEventListener('input', () => {
      const cleaned = input.value.replace(/\D/g, '');
      if (cleaned.length > 1) {
        // Hỗ trợ dán trực tiếp nhiều số hoặc auto-fill
        cleaned.slice(0, 6).split('').forEach((ch, offset) => {
          const target = digits[idx + offset];
          if (target) target.value = ch;
        });
        const nextIdx = Math.min(5, idx + cleaned.length);
        digits[nextIdx]?.focus();
      } else {
        input.value = cleaned;
        if (cleaned && idx < 5) {
          digits[idx + 1]?.focus();
        }
      }
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace') {
        if (input.value) {
          input.value = '';
          e.preventDefault();
        } else if (idx > 0) {
          const prev = digits[idx - 1];
          if (prev) {
            prev.value = '';
            prev.focus();
          }
          e.preventDefault();
        }
      } else if (e.key === 'ArrowLeft' && idx > 0) {
        digits[idx - 1]?.focus();
      } else if (e.key === 'ArrowRight' && idx < 5) {
        digits[idx + 1]?.focus();
      }
    });

    input.addEventListener('paste', (e) => {
      const pasted = e.clipboardData?.getData('text') ?? '';
      const nums = pasted.replace(/\D/g, '').slice(0, 6);
      if (nums.length > 0) {
        e.preventDefault();
        nums.split('').forEach((ch, i) => {
          const target = digits[i];
          if (target) target.value = ch;
        });
        digits[Math.min(5, nums.length - 1)]?.focus();
      }
    });
  });

  resendBtn?.addEventListener('click', async () => {
    if (!resendBtn || resendBtn.disabled) return;
    resendBtn.disabled = true;
    resendBtn.textContent = 'Đang gửi...';
    if (errorEl) errorEl.classList.add('hidden');
    try {
      currentState = await opts.onResend();
      digits.forEach((d) => {
        d.value = '';
      });
      digits[0]?.focus();
    } catch (err) {
      if (errorEl) {
        errorEl.textContent = err instanceof Error ? err.message : 'Không thể gửi lại mã xác thực.';
        errorEl.classList.remove('hidden');
      }
    } finally {
      resendBtn.textContent = 'Gửi lại mã';
      updateCountdowns();
    }
  });

  updateCountdowns();
  const intervalId = window.setInterval(updateCountdowns, 1000);
  opts.onCleanup(() => window.clearInterval(intervalId));

  return {
    getCode: () => digits.map((d) => d.value.trim()).join(''),
    setFieldError: (msg) => {
      if (!errorEl) return;
      if (msg) {
        errorEl.textContent = msg;
        errorEl.classList.remove('hidden');
      } else {
        errorEl.textContent = '';
        errorEl.classList.add('hidden');
      }
    },
    updateState: (next) => {
      currentState = next;
      updateCountdowns();
    },
  };
}

export function renderOtpInfoBox(email: string, maskedEmail: string): string {
  return `
    <div class="p-space-4 rounded-lg bg-primary-light border border-primary/25 flex items-start gap-space-3">
      <span class="material-symbols-outlined text-[20px] text-primary shrink-0 mt-0.5" aria-hidden="true">mark_email_read</span>
      <div class="font-body text-body-md text-on-surface">
        <p>Mã xác thực 6 chữ số được gửi tới <strong>${escapeHtml(maskedEmail || email)}</strong>.</p>
        <p class="text-text-secondary mt-space-1">Mã có hiệu lực 5 phút, chỉ dùng một lần. Bạn có thể dán trực tiếp cả 6 số.</p>
      </div>
    </div>
  `;
}
