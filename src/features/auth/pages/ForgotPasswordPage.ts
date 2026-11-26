import type { RouteContext } from '@/app/router';
import { toUserErrorMessage } from '@/api/errors';
import { authService } from '@/features/auth/auth.service';
import { renderPublicShell } from '@/layouts/public/PublicShell';
import { escapeHtml } from '@/shared/utils/dom';
import { isValidEmail } from '@/shared/utils/validation';

export function renderForgotPasswordPage(ctx: RouteContext): void {
  const prefillEmail = ctx.query.get('email')?.trim() ?? '';
  const fromProfile = ctx.query.get('from') === 'ho-so';
  const backHref = fromProfile ? '/ca-nhan/ho-so' : '/dang-nhap';
  const backText = fromProfile ? 'Quay lại hồ sơ cá nhân' : 'Quay lại đăng nhập';

  const main = renderPublicShell({
    container: ctx.container,
    variant: 'auth',
    contentHtml: `
      <div class="flex-1 flex items-center justify-center px-space-4 py-space-8">
        <section class="w-full max-w-lg bg-surface border border-border rounded-xl shadow-md p-space-6 md:p-space-8 flex flex-col gap-space-6">
          <div class="flex flex-col gap-space-1">
            <h1 class="font-headline text-headline-lg text-on-surface">Quên mật khẩu</h1>
            <p class="font-body text-body-md text-text-secondary">Nhập email đã đăng ký. Hệ thống sẽ gửi mã 6 chữ số để bạn đặt lại mật khẩu mới.</p>
          </div>

          <div id="forgotAlert" role="alert" class="hidden p-space-3 rounded-lg bg-error-bg text-on-error-bg font-body text-body-md"></div>
          <div id="forgotInfo" role="status" class="hidden p-space-4 rounded-lg bg-info-bg text-on-info-bg font-body text-body-md flex flex-col gap-space-3"></div>

          <form id="forgotForm" novalidate class="flex flex-col gap-space-4">
            <label class="flex flex-col gap-space-1">
              <span class="font-label text-label-md text-on-surface">Địa chỉ email <span class="text-error">*</span></span>
              <input id="forgotEmail" type="email" autocomplete="email" value="${escapeHtml(prefillEmail)}" placeholder="you@example.com" class="w-full min-h-[44px] px-space-4 rounded border border-border bg-surface text-body-lg focus:border-primary focus:ring-2 focus:ring-primary/20" />
              <span id="forgotEmailErr" class="hidden font-body text-body-md text-error"></span>
            </label>

            <button id="forgotSubmitBtn" type="submit" class="w-full min-h-[44px] px-space-6 rounded bg-primary text-on-primary hover:bg-primary-hover disabled:opacity-60 font-label text-label-lg transition-colors">
              Gửi mã khôi phục
            </button>
          </form>

          <div class="border-t border-border pt-space-4 flex items-center justify-between font-body text-body-md">
            <a href="${backHref}" class="tl-back-btn">
              <span class="tl-back-icon" aria-hidden="true">
                <span class="material-symbols-outlined text-[16px]">arrow_back</span>
              </span>
              <span>${backText}</span>
            </a>
          </div>
        </section>
      </div>
    `,
  });

  const form = main.querySelector<HTMLFormElement>('#forgotForm');
  const emailInput = main.querySelector<HTMLInputElement>('#forgotEmail');
  const emailErr = main.querySelector<HTMLElement>('#forgotEmailErr');
  const alertEl = main.querySelector<HTMLElement>('#forgotAlert');
  const infoEl = main.querySelector<HTMLElement>('#forgotInfo');
  const submitBtn = main.querySelector<HTMLButtonElement>('#forgotSubmitBtn');

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!submitBtn || submitBtn.disabled) return;

    const email = emailInput?.value.trim() ?? '';
    emailErr?.classList.add('hidden');
    alertEl?.classList.add('hidden');
    infoEl?.classList.add('hidden');

    if (!isValidEmail(email)) {
      if (emailErr) {
        emailErr.textContent = 'Vui lòng nhập địa chỉ email đúng định dạng.';
        emailErr.classList.remove('hidden');
      }
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Đang xử lý...';
    try {
      const state = await authService.requestPasswordReset({ email });
      if (infoEl) {
        infoEl.innerHTML = `
          <p>${escapeHtml(state.message)}</p>
          <a href="/quen-mat-khau/dat-lai?email=${encodeURIComponent(email)}" class="self-start inline-flex items-center justify-center min-h-[44px] px-space-4 rounded bg-primary text-on-primary font-label text-label-md">Tiếp tục nhập mã xác thực</a>
        `;
        infoEl.classList.remove('hidden');
      }
      submitBtn.disabled = false;
      submitBtn.textContent = 'Gửi mã khôi phục';
    } catch (err) {
      if (alertEl) {
        alertEl.textContent = toUserErrorMessage(err);
        alertEl.classList.remove('hidden');
      }
      submitBtn.disabled = false;
      submitBtn.textContent = 'Gửi mã khôi phục';
    }
  });
}
