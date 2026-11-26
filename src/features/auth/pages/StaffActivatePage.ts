import type { RouteContext } from '@/app/router';
import { isAppError, toUserErrorMessage } from '@/api/errors';
import { authService } from '@/features/auth/auth.service';
import { renderLogoMark } from '@/shared/components/Logo';
import { mountEmailCodeForm, renderEmailCodeInputHtml } from '@/shared/components/EmailCodeForm';
import { showToast } from '@/shared/components/Toast';
import { escapeHtml } from '@/shared/utils/dom';
import { OTP_RULES } from '@/config/constants';
import { maskEmail } from '@/shared/utils/format';
import { isValidEmail, validateOtpCode, validatePassword } from '@/shared/utils/validation';

export async function renderStaffActivatePage(ctx: RouteContext): Promise<void> {
  const initialEmail = ctx.query.get('email')?.trim() || 'bao.le@triploom.vn';
  let initialLoadErr = '';
  let initialState;
  try {
    initialState = await authService.getOtpState(initialEmail, 'STAFF_ACTIVATION');
  } catch (err) {
    initialLoadErr = toUserErrorMessage(err);
    initialState = {
      email: initialEmail,
      maskedEmail: maskEmail(initialEmail),
      purpose: 'STAFF_ACTIVATION' as const,
      expiresAt: null,
      resendAvailableAt: null,
      burstLockedUntil: null,
      sendsUsedInBurst: 0,
      maxSendsPerBurst: OTP_RULES.maxSendsPerBurst,
      remainingAttempts: OTP_RULES.maxVerifyAttempts,
      message: 'Nhập mã 6 chữ số đã được gửi tới email của bạn.',
    };
  }

  ctx.container.innerHTML = `
    <div class="min-h-screen bg-[#0F172A] flex items-center justify-center px-4 py-8 tl-page-enter">
      <section class="w-full max-w-lg bg-surface border border-border rounded-2xl shadow-lg p-6 md:p-8 flex flex-col gap-6">
        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              ${renderLogoMark(30)}
              <span class="font-headline text-headline-md text-on-surface">TripLoom</span>
              <span class="px-2.5 py-0.5 rounded-full bg-primary-light text-primary font-label text-label-sm">Vận hành</span>
            </div>
            <a href="/quan-tri/dang-nhap" class="tl-back-btn">
              <span class="tl-back-icon" aria-hidden="true">
                <span class="material-symbols-outlined text-[16px]">arrow_back</span>
              </span>
              <span>Cổng Quản trị</span>
            </a>
          </div>
          <h1 class="font-headline text-headline-lg text-on-surface mt-1">Kích hoạt tài khoản nhân viên</h1>
          <p class="font-body text-body-md text-text-secondary">Dành cho nhân viên đã được Quản trị viên mời. Nhập email công vụ, mã kích hoạt 6 số và tự thiết lập mật khẩu cá nhân.</p>
        </div>

        <div id="activateContainer" class="flex flex-col gap-space-4">
          <div id="activateAlert" role="alert" class="${initialLoadErr ? '' : 'hidden'} p-space-3 rounded-lg bg-error-bg text-on-error-bg font-body text-body-md">${escapeHtml(initialLoadErr)}</div>

          <form id="activateForm" novalidate class="flex flex-col gap-space-4">
            <label class="flex flex-col gap-space-1">
              <span class="font-label text-label-md text-on-surface">Email nhân viên <span class="text-error">*</span></span>
              <input id="actEmail" type="email" value="${escapeHtml(initialEmail)}" placeholder="ten.nhanvien@triploom.vn" class="w-full min-h-[44px] px-space-4 rounded border border-border bg-surface text-body-lg focus:border-primary focus:ring-2 focus:ring-primary/20" />
              <span data-err="email" class="hidden font-body text-body-md text-error"></span>
            </label>

            <div id="actOtpMount">${renderEmailCodeInputHtml('staff-otp')}</div>

            <label class="flex flex-col gap-space-1">
              <span class="font-label text-label-md text-on-surface">Mật khẩu mới <span class="text-error">*</span></span>
              <input id="actPwd" type="password" autocomplete="new-password" placeholder="Tối thiểu 8 ký tự, gồm chữ và số" class="w-full min-h-[44px] px-space-4 rounded border border-border bg-surface text-body-lg focus:border-primary focus:ring-2 focus:ring-primary/20" />
              <span data-err="password" class="hidden font-body text-body-md text-error"></span>
            </label>

            <label class="flex flex-col gap-space-1">
              <span class="font-label text-label-md text-on-surface">Xác nhận mật khẩu <span class="text-error">*</span></span>
              <input id="actConfirmPwd" type="password" autocomplete="new-password" placeholder="Nhập lại mật khẩu" class="w-full min-h-[44px] px-space-4 rounded border border-border bg-surface text-body-lg focus:border-primary focus:ring-2 focus:ring-primary/20" />
              <span data-err="confirmPassword" class="hidden font-body text-body-md text-error"></span>
            </label>

            <button id="actSubmitBtn" type="submit" class="w-full min-h-[44px] px-space-6 rounded bg-primary text-on-primary hover:bg-primary-hover disabled:opacity-60 font-label text-label-lg transition-colors">
              Kích hoạt tài khoản
            </button>
          </form>

          <p class="font-body text-label-sm text-text-secondary border-t border-border pt-space-3">
            Sau khi kích hoạt thành công, bạn sẽ đăng nhập tại cổng Quản trị bằng mật khẩu vừa đặt.
          </p>
        </div>
      </section>
    </div>
  `;

  const main = ctx.container;

  const emailInput = main.querySelector<HTMLInputElement>('#actEmail')!;
  const otpCtrl = mountEmailCodeForm({
    container: main.querySelector<HTMLElement>('#actOtpMount')!,
    state: initialState,
    onResend: async () => {
      const targetEmail = emailInput.value.trim();
      const next = await authService.resendOtp({ email: targetEmail, purpose: 'STAFF_ACTIVATION' });
      showToast('Đã gửi lại mã kích hoạt tới email nhân viên.', 'success');
      return next;
    },
    onCleanup: ctx.onCleanup,
  });

  emailInput.addEventListener('blur', async () => {
    const val = emailInput.value.trim();
    if (isValidEmail(val)) {
      try {
        const nextState = await authService.getOtpState(val, 'STAFF_ACTIVATION');
        otpCtrl.updateState(nextState);
      } catch {
        // Ignore transient blur error
      }
    }
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

  const form = main.querySelector<HTMLFormElement>('#activateForm');
  const alertEl = main.querySelector<HTMLElement>('#activateAlert');
  const submitBtn = main.querySelector<HTMLButtonElement>('#actSubmitBtn');
  const container = main.querySelector<HTMLElement>('#activateContainer');

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!submitBtn || submitBtn.disabled) return;

    const email = emailInput.value.trim();
    const code = otpCtrl.getCode();
    const password = main.querySelector<HTMLInputElement>('#actPwd')?.value ?? '';
    const confirmPassword = main.querySelector<HTMLInputElement>('#actConfirmPwd')?.value ?? '';

    ['email', 'password', 'confirmPassword'].forEach((k) => setErr(k, null));
    otpCtrl.setFieldError(null);
    alertEl?.classList.add('hidden');

    let invalid = false;
    if (!isValidEmail(email)) {
      setErr('email', 'Vui lòng nhập email nhân viên hợp lệ.');
      invalid = true;
    }
    const codeErr = validateOtpCode(code);
    if (codeErr) {
      otpCtrl.setFieldError(codeErr);
      invalid = true;
    }
    const pwdErr = validatePassword(password);
    if (pwdErr) {
      setErr('password', pwdErr);
      invalid = true;
    }
    if (password !== confirmPassword) {
      setErr('confirmPassword', 'Mật khẩu xác nhận không khớp.');
      invalid = true;
    }
    if (invalid) return;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Đang kích hoạt...';
    try {
      const res = await authService.activateStaff({ email, code, password, confirmPassword });
      if (container) {
        container.innerHTML = `
          <div class="p-space-6 rounded-xl bg-success-bg border border-success/30 text-center flex flex-col items-center gap-space-3">
            <span class="w-12 h-12 rounded-full bg-surface text-success inline-flex items-center justify-center">
              <span class="material-symbols-outlined text-[28px]">verified_user</span>
            </span>
            <h2 class="font-headline text-headline-md text-on-success-bg">Kích hoạt thành công</h2>
            <p class="font-body text-body-md text-on-success-bg">${escapeHtml(res.message)}</p>
            <a href="/quan-tri/dang-nhap?email=${encodeURIComponent(email)}" class="mt-space-2 inline-flex items-center justify-center min-h-[44px] px-space-6 rounded bg-primary text-on-primary hover:bg-primary-hover font-label text-label-md no-underline">Đăng nhập vào trang Quản trị</a>
          </div>
        `;
      }
    } catch (err) {
      if (isAppError(err)) {
        Object.entries(err.fieldErrors).forEach(([k, v]) => setErr(k, v));
      }
      if (alertEl) {
        alertEl.textContent = toUserErrorMessage(err);
        alertEl.classList.remove('hidden');
      }
      submitBtn.disabled = false;
      submitBtn.textContent = 'Kích hoạt tài khoản';
      try {
        const refreshed = await authService.getOtpState(email, 'STAFF_ACTIVATION');
        otpCtrl.updateState(refreshed);
      } catch {
        // Giữ nguyên bộ đếm hiện tại nếu mất kết nối tạm thời
      }
    }
  });
}
