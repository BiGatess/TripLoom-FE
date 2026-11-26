import type { RouteContext } from '@/app/router';
import { isAppError, toUserErrorMessage } from '@/api/errors';
import { authService } from '@/features/auth/auth.service';
import { renderPublicShell } from '@/layouts/public/PublicShell';
import { mountEmailCodeForm, renderEmailCodeInputHtml, renderOtpInfoBox } from '@/shared/components/EmailCodeForm';
import { showToast } from '@/shared/components/Toast';
import { escapeHtml } from '@/shared/utils/dom';
import { OTP_RULES } from '@/config/constants';
import { maskEmail } from '@/shared/utils/format';
import { validateOtpCode, validatePassword } from '@/shared/utils/validation';

export async function renderResetPasswordPage(ctx: RouteContext): Promise<void> {
  const email = ctx.query.get('email')?.trim() ?? '';
  if (!email) {
    ctx.navigate('/quen-mat-khau', { replace: true });
    return;
  }

  let initialLoadErr = '';
  let state;
  try {
    state = await authService.getOtpState(email, 'PASSWORD_RESET');
  } catch (err) {
    initialLoadErr = toUserErrorMessage(err);
    state = {
      email,
      maskedEmail: maskEmail(email),
      purpose: 'PASSWORD_RESET' as const,
      expiresAt: null,
      resendAvailableAt: null,
      burstLockedUntil: null,
      sendsUsedInBurst: 0,
      maxSendsPerBurst: OTP_RULES.maxSendsPerBurst,
      remainingAttempts: OTP_RULES.maxVerifyAttempts,
      message: 'Nếu email đủ điều kiện, mã xác thực sẽ được gửi đến hộp thư của bạn.',
    };
  }

  const main = renderPublicShell({
    container: ctx.container,
    variant: 'auth',
    contentHtml: `
      <div class="flex-1 flex items-center justify-center px-space-4 py-space-8">
        <section class="w-full max-w-lg bg-surface border border-border rounded-xl shadow-md p-space-6 md:p-space-8 flex flex-col gap-space-6">
          <div class="flex flex-col gap-space-1">
            <h1 class="font-headline text-headline-lg text-on-surface">Đặt mật khẩu mới</h1>
            <p class="font-body text-body-md text-text-secondary">Nhập mã 6 chữ số đã gửi tới hộp thư và tạo mật khẩu mới. Sau khi đổi thành công, bạn sẽ cần đăng nhập lại.</p>
          </div>

          <div id="resetContainer" class="flex flex-col gap-space-4">
            ${renderOtpInfoBox(state.email, state.maskedEmail)}
            <div id="resetAlert" role="alert" class="${initialLoadErr ? '' : 'hidden'} p-space-3 rounded-lg bg-error-bg text-on-error-bg font-body text-body-md">${escapeHtml(initialLoadErr)}</div>

            <form id="resetForm" novalidate class="flex flex-col gap-space-4">
              <div id="resetOtpMount">${renderEmailCodeInputHtml('reset-otp')}</div>

              <label class="flex flex-col gap-space-1">
                <span class="font-label text-label-md text-on-surface">Mật khẩu mới <span class="text-error">*</span></span>
                <input id="resetNewPwd" type="password" autocomplete="new-password" placeholder="Tối thiểu 8 ký tự, gồm chữ và số" class="w-full min-h-[44px] px-space-4 rounded border border-border bg-surface text-body-lg focus:border-primary focus:ring-2 focus:ring-primary/20" />
                <span data-err="newPassword" class="hidden font-body text-body-md text-error"></span>
              </label>

              <label class="flex flex-col gap-space-1">
                <span class="font-label text-label-md text-on-surface">Xác nhận mật khẩu mới <span class="text-error">*</span></span>
                <input id="resetConfirmPwd" type="password" autocomplete="new-password" placeholder="Nhập lại mật khẩu mới" class="w-full min-h-[44px] px-space-4 rounded border border-border bg-surface text-body-lg focus:border-primary focus:ring-2 focus:ring-primary/20" />
                <span data-err="confirmPassword" class="hidden font-body text-body-md text-error"></span>
              </label>

              <button id="resetSubmitBtn" type="submit" class="w-full min-h-[44px] px-space-6 rounded bg-primary text-on-primary hover:bg-primary-hover disabled:opacity-60 font-label text-label-lg transition-colors">
                Đặt lại mật khẩu
              </button>
            </form>

            <div class="border-t border-border pt-space-4 flex items-center justify-between font-body text-body-md">
              <a href="/dang-nhap" class="tl-back-btn">
                <span class="tl-back-icon" aria-hidden="true">
                  <span class="material-symbols-outlined text-[16px]">arrow_back</span>
                </span>
                <span>Quay lại đăng nhập</span>
              </a>
            </div>
          </div>
        </section>
      </div>
    `,
  });

  const otpCtrl = mountEmailCodeForm({
    container: main.querySelector<HTMLElement>('#resetOtpMount')!,
    state,
    onResend: async () => {
      const next = await authService.resendOtp({ email, purpose: 'PASSWORD_RESET' });
      showToast(next.message, 'info');
      return next;
    },
    onCleanup: ctx.onCleanup,
  });

  const setErr = (key: string, msg: string | null) => {
    const el = main.querySelector<HTMLElement>(`[data-err="${key}"]`);
    if (!el) return;
    if (msg) {
      el.textContent = msg;
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
    }
  };

  const form = main.querySelector<HTMLFormElement>('#resetForm');
  const alertEl = main.querySelector<HTMLElement>('#resetAlert');
  const submitBtn = main.querySelector<HTMLButtonElement>('#resetSubmitBtn');
  const container = main.querySelector<HTMLElement>('#resetContainer');

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!submitBtn || submitBtn.disabled) return;

    const code = otpCtrl.getCode();
    const newPassword = main.querySelector<HTMLInputElement>('#resetNewPwd')?.value ?? '';
    const confirmPassword = main.querySelector<HTMLInputElement>('#resetConfirmPwd')?.value ?? '';

    otpCtrl.setFieldError(null);
    setErr('newPassword', null);
    setErr('confirmPassword', null);
    alertEl?.classList.add('hidden');

    let invalid = false;
    const codeErr = validateOtpCode(code);
    if (codeErr) {
      otpCtrl.setFieldError(codeErr);
      invalid = true;
    }
    const pwdErr = validatePassword(newPassword);
    if (pwdErr) {
      setErr('newPassword', pwdErr);
      invalid = true;
    }
    if (newPassword !== confirmPassword) {
      setErr('confirmPassword', 'Mật khẩu xác nhận không khớp.');
      invalid = true;
    }
    if (invalid) return;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Đang cập nhật mật khẩu...';
    try {
      const res = await authService.resetPassword({ email, code, newPassword, confirmPassword });
      if (container) {
        container.innerHTML = `
          <div class="p-space-6 rounded-xl bg-success-bg border border-success/30 text-center flex flex-col items-center gap-space-3">
            <span class="w-12 h-12 rounded-full bg-surface text-success inline-flex items-center justify-center">
              <span class="material-symbols-outlined text-[28px]">check_circle</span>
            </span>
            <h2 class="font-headline text-headline-md text-on-success-bg">Đã cập nhật mật khẩu</h2>
            <p class="font-body text-body-md text-on-success-bg">${escapeHtml(res.message)}</p>
            <a href="/dang-nhap?email=${encodeURIComponent(email)}" class="mt-space-2 inline-flex items-center justify-center min-h-[44px] px-space-6 rounded bg-primary text-on-primary hover:bg-primary-hover font-label text-label-md">Đăng nhập lại</a>
          </div>
        `;
      }
    } catch (err) {
      if (isAppError(err)) {
        if (err.fieldErrors.newPassword) setErr('newPassword', err.fieldErrors.newPassword);
        if (err.fieldErrors.confirmPassword) setErr('confirmPassword', err.fieldErrors.confirmPassword);
      }
      if (alertEl) {
        alertEl.textContent = toUserErrorMessage(err);
        alertEl.classList.remove('hidden');
      }
      submitBtn.disabled = false;
      submitBtn.textContent = 'Đặt lại mật khẩu';
      try {
        const refreshed = await authService.getOtpState(email, 'PASSWORD_RESET');
        otpCtrl.updateState(refreshed);
      } catch {
        // Giữ nguyên bộ đếm hiện tại nếu mất kết nối tạm thời
      }
    }
  });
}
