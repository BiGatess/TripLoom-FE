import type { RouteContext } from '@/app/router';
import { toUserErrorMessage } from '@/api/errors';
import { authService } from '@/features/auth/auth.service';
import { renderPublicShell } from '@/layouts/public/PublicShell';
import { mountEmailCodeForm, renderEmailCodeInputHtml, renderOtpInfoBox } from '@/shared/components/EmailCodeForm';
import { showToast } from '@/shared/components/Toast';
import { escapeHtml } from '@/shared/utils/dom';
import { OTP_RULES } from '@/config/constants';
import { maskEmail } from '@/shared/utils/format';
import { validateOtpCode } from '@/shared/utils/validation';

export async function renderVerifyEmailPage(ctx: RouteContext): Promise<void> {
  const email = ctx.query.get('email')?.trim() ?? '';

  if (!email) {
    ctx.navigate('/dang-ky', { replace: true });
    return;
  }

  let initialLoadErr = '';
  let state;
  try {
    state = await authService.getOtpState(email, 'REGISTER');
  } catch (err) {
    initialLoadErr = toUserErrorMessage(err);
    state = {
      email,
      maskedEmail: maskEmail(email),
      purpose: 'REGISTER' as const,
      expiresAt: null,
      resendAvailableAt: null,
      burstLockedUntil: null,
      sendsUsedInBurst: 0,
      maxSendsPerBurst: OTP_RULES.maxSendsPerBurst,
      remainingAttempts: OTP_RULES.maxVerifyAttempts,
      message: 'Nhập mã 6 chữ số đã được gửi tới email của bạn.',
    };
  }

  const main = renderPublicShell({
    container: ctx.container,
    variant: 'auth',
    contentHtml: `
      <div class="flex-1 flex items-center justify-center px-space-4 py-space-8">
        <section class="w-full max-w-lg bg-surface border border-border rounded-xl shadow-md p-space-6 md:p-space-8 flex flex-col gap-space-6">
          <ol class="grid grid-cols-3 gap-space-2 text-center" aria-label="Các bước đăng ký tài khoản">
            <li class="p-space-2 rounded bg-success-bg text-on-success-bg font-label text-label-sm">1. Thông tin</li>
            <li class="p-space-2 rounded bg-primary-light text-primary font-label text-label-sm">2. Xác thực email</li>
            <li class="p-space-2 rounded bg-surface-muted text-text-secondary font-label text-label-sm">3. Hoàn tất</li>
          </ol>

          <div class="flex flex-col gap-space-1">
            <h1 class="font-headline text-headline-lg text-on-surface">Xác thực email đăng ký</h1>
            <p class="font-body text-body-md text-text-secondary">Tài khoản chỉ được tạo sau khi bạn xác thực mã hợp lệ.</p>
          </div>

          <div id="verifyContainer" class="flex flex-col gap-space-4">
            ${renderOtpInfoBox(state.email, state.maskedEmail)}
            <div id="verifyAlert" role="alert" class="${initialLoadErr ? '' : 'hidden'} p-space-3 rounded-lg bg-error-bg text-on-error-bg font-body text-body-md">${escapeHtml(initialLoadErr)}</div>

            <form id="verifyForm" novalidate class="flex flex-col gap-space-4">
              <div id="otpFieldMount">${renderEmailCodeInputHtml('reg-otp')}</div>
              <button id="verifySubmitBtn" type="submit" class="w-full min-h-[44px] px-space-6 rounded bg-primary text-on-primary hover:bg-primary-hover disabled:opacity-60 font-label text-label-lg transition-colors">
                Xác thực và tạo tài khoản
              </button>
            </form>

            <div class="border-t border-border pt-space-4 flex flex-wrap items-center justify-between gap-space-2 font-body text-body-md">
              <a href="/dang-ky?email=${encodeURIComponent(email)}" class="tl-back-btn">
                <span class="tl-back-icon" aria-hidden="true">
                  <span class="material-symbols-outlined text-[16px]">arrow_back</span>
                </span>
                <span>Đổi địa chỉ email</span>
              </a>
              <a href="/dang-nhap" class="px-space-3 py-space-1.5 rounded-full font-label text-label-md text-text-secondary hover:text-primary hover:bg-primary-light transition-colors">Về đăng nhập</a>
            </div>
          </div>
        </section>
      </div>
    `,
  });

  const otpMount = main.querySelector<HTMLElement>('#otpFieldMount')!;
  const otpCtrl = mountEmailCodeForm({
    container: otpMount,
    state,
    onResend: async () => {
      const next = await authService.resendOtp({ email, purpose: 'REGISTER' });
      showToast('Đã gửi mã xác thực mới. Mã cũ trước đó đã hết hiệu lực.', 'success');
      return next;
    },
    onCleanup: ctx.onCleanup,
  });

  const form = main.querySelector<HTMLFormElement>('#verifyForm');
  const alertEl = main.querySelector<HTMLElement>('#verifyAlert');
  const submitBtn = main.querySelector<HTMLButtonElement>('#verifySubmitBtn');
  const container = main.querySelector<HTMLElement>('#verifyContainer');

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!submitBtn || submitBtn.disabled) return;

    const code = otpCtrl.getCode();
    otpCtrl.setFieldError(null);
    alertEl?.classList.add('hidden');

    const errMsg = validateOtpCode(code);
    if (errMsg) {
      otpCtrl.setFieldError(errMsg);
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Đang xác thực...';
    try {
      const res = await authService.verifyRegister({ email, code });
      if (container) {
        container.innerHTML = `
          <div class="p-space-6 rounded-xl bg-success-bg border border-success/30 text-center flex flex-col items-center gap-space-3">
            <span class="w-12 h-12 rounded-full bg-surface text-success inline-flex items-center justify-center">
              <span class="material-symbols-outlined text-[28px]">check_circle</span>
            </span>
            <h2 class="font-headline text-headline-md text-on-success-bg">Tạo tài khoản thành công</h2>
            <p class="font-body text-body-md text-on-success-bg">${escapeHtml(res.message)}</p>
            <a href="/dang-nhap?email=${encodeURIComponent(res.email)}" class="mt-space-2 inline-flex items-center justify-center min-h-[44px] px-space-6 rounded bg-primary text-on-primary hover:bg-primary-hover font-label text-label-md">Đăng nhập ngay</a>
          </div>
        `;
      }
    } catch (err) {
      if (alertEl) {
        alertEl.textContent = toUserErrorMessage(err);
        alertEl.classList.remove('hidden');
      }
      submitBtn.disabled = false;
      submitBtn.textContent = 'Xác thực và tạo tài khoản';
      try {
        const refreshed = await authService.getOtpState(email, 'REGISTER');
        otpCtrl.updateState(refreshed);
      } catch {
        // Giữ nguyên bộ đếm hiện tại nếu mất kết nối tạm thời
      }
    }
  });
}
