import type { RouteContext } from '@/app/router';
import { resolvePostLoginDestination } from '@/app/route-guards';
import { sessionStore } from '@/app/session-store';
import { isAppError, toUserErrorMessage } from '@/api/errors';
import { authService } from '@/features/auth/auth.service';
import { renderPublicShell } from '@/layouts/public/PublicShell';
import { renderLogoMark } from '@/shared/components/Logo';
import { showToast } from '@/shared/components/Toast';
import { bindImageFallbacks, escapeHtml } from '@/shared/utils/dom';
import { STITCH_IMAGES } from '@/shared/utils/media';
import { isValidEmail } from '@/shared/utils/validation';

export function renderLoginPage(ctx: RouteContext): void {
  const redirectParam = ctx.query.get('redirect');
  const prefillEmail = ctx.query.get('email') ?? '';
  const reason = ctx.query.get('reason');

  const noticeHtml =
    reason === 'expired'
      ? `<div role="alert" class="p-space-3 rounded-lg bg-warning-bg text-on-warning-bg font-body text-body-md flex items-start gap-space-2">
           <span class="material-symbols-outlined text-[20px] shrink-0">schedule</span>
           <span>Phiên đăng nhập trước đã hết hạn. Vui lòng đăng nhập lại để tiếp tục.</span>
         </div>`
      : '';

  const main = renderPublicShell({
    container: ctx.container,
    variant: 'auth',
    contentHtml: `
      <div class="flex-1 flex items-center justify-center px-space-4 py-space-6">
        <div class="w-full max-w-[900px] bg-surface border border-border rounded-xl shadow-md overflow-hidden grid grid-cols-1 md:grid-cols-12">
          <!-- Cột hình ảnh thương hiệu -->
          <aside class="md:col-span-5 relative min-h-[180px] md:min-h-[480px] flex flex-col justify-end p-space-6 text-on-primary bg-primary">
            <img src="${STITCH_IMAGES.heroVietnam}" alt="Cảnh quan du lịch Việt Nam" data-fallback-label="TripLoom Việt Nam" class="absolute inset-0 w-full h-full object-cover" />
            <div class="absolute inset-0 bg-gradient-to-t from-primary-hover via-primary/90 to-primary/65"></div>
            <div class="relative z-10 flex flex-col gap-space-3">
              <span class="inline-flex self-start items-center gap-space-1 px-space-3 py-space-1 rounded-full bg-primary-hover border border-on-primary/25 font-label text-label-sm text-on-primary">
                <span class="material-symbols-outlined text-[16px]" aria-hidden="true">explore</span>
                Du lịch Việt Nam
              </span>
              <h2 class="font-headline text-headline-md text-on-primary">Kết nối trải nghiệm, dệt nên hành trình.</h2>
              <p class="font-body text-body-md text-primary-light">Lưu lịch trình theo ngày, trò chuyện cùng trợ lý AI và đặt dịch vụ nhanh chóng.</p>
            </div>
          </aside>

          <!-- Cột biểu mẫu đăng nhập -->
          <section class="md:col-span-7 p-space-6 md:p-space-8 flex flex-col justify-center gap-space-6">
            <div class="flex flex-col gap-space-2">
              <div class="flex items-center gap-space-2">
                ${renderLogoMark(28)}
                <span class="font-headline text-headline-md text-on-surface">TripLoom</span>
              </div>
              <h1 class="font-headline text-headline-lg text-on-surface">Đăng nhập</h1>
              <p class="font-body text-body-md text-text-secondary">Chào mừng bạn quay lại với không gian chuyến đi của mình.</p>
            </div>

            ${noticeHtml}
            <div id="loginAlert" role="alert" class="hidden p-space-3 rounded-lg bg-error-bg text-on-error-bg font-body text-body-md"></div>

            <form id="loginForm" novalidate class="flex flex-col gap-space-4">
              <label class="flex flex-col gap-space-1">
                <span class="font-label text-label-md text-on-surface">Email</span>
                <div class="relative flex items-center">
                  <span class="material-symbols-outlined text-[20px] text-text-secondary absolute left-space-3 pointer-events-none" aria-hidden="true">mail</span>
                  <input id="loginEmail" name="email" type="email" autocomplete="email" value="${escapeHtml(prefillEmail)}" placeholder="you@example.com" class="w-full min-h-[44px] pl-10 pr-space-4 rounded bg-surface border border-border text-body-lg focus:border-primary focus:ring-2 focus:ring-primary/20" />
                </div>
                <span id="loginEmailErr" class="hidden font-body text-body-md text-error"></span>
              </label>

              <label class="flex flex-col gap-space-1">
                <div class="flex items-center justify-between gap-space-2">
                  <span class="font-label text-label-md text-on-surface">Mật khẩu</span>
                  <a href="/quen-mat-khau" class="font-label text-label-md text-primary hover:underline">Quên mật khẩu?</a>
                </div>
                <div class="relative flex items-center">
                  <span class="material-symbols-outlined text-[20px] text-text-secondary absolute left-space-3 pointer-events-none" aria-hidden="true">lock</span>
                  <input id="loginPassword" name="password" type="password" autocomplete="current-password" placeholder="Nhập mật khẩu của bạn" class="w-full min-h-[44px] pl-10 pr-12 rounded bg-surface border border-border text-body-lg focus:border-primary focus:ring-2 focus:ring-primary/20" />
                  <button id="togglePwdBtn" type="button" aria-label="Hiện hoặc ẩn mật khẩu" class="absolute right-space-1 w-[44px] h-[44px] inline-flex items-center justify-center text-text-secondary hover:text-on-surface">
                    <span id="togglePwdIcon" class="material-symbols-outlined text-[20px]" aria-hidden="true">visibility</span>
                  </button>
                </div>
                <span id="loginPasswordErr" class="hidden font-body text-body-md text-error"></span>
              </label>

              <button id="loginSubmitBtn" type="submit" class="inline-flex items-center justify-center w-full min-h-[44px] px-space-6 rounded bg-primary text-on-primary hover:bg-primary-hover disabled:opacity-60 font-label text-label-lg mt-space-1 transition-colors">
                Đăng nhập
              </button>
            </form>

            <div class="border-t border-border pt-space-4 flex flex-wrap items-center justify-between gap-space-2 font-body text-body-md text-text-secondary">
              <span>Chưa có tài khoản?</span>
              <a href="/dang-ky" class="font-label text-label-md text-primary hover:underline">Đăng ký</a>
            </div>
          </section>
        </div>
      </div>
    `,
  });

  bindImageFallbacks(main);

  const form = main.querySelector<HTMLFormElement>('#loginForm');
  const emailInput = main.querySelector<HTMLInputElement>('#loginEmail');
  const pwdInput = main.querySelector<HTMLInputElement>('#loginPassword');
  const emailErr = main.querySelector<HTMLElement>('#loginEmailErr');
  const pwdErr = main.querySelector<HTMLElement>('#loginPasswordErr');
  const alertEl = main.querySelector<HTMLElement>('#loginAlert');
  const submitBtn = main.querySelector<HTMLButtonElement>('#loginSubmitBtn');

  main.querySelector('#togglePwdBtn')?.addEventListener('click', () => {
    if (!pwdInput) return;
    const isHidden = pwdInput.type === 'password';
    pwdInput.type = isHidden ? 'text' : 'password';
    const icon = main.querySelector('#togglePwdIcon');
    if (icon) icon.textContent = isHidden ? 'visibility_off' : 'visibility';
  });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!submitBtn || submitBtn.disabled) return;

    const email = emailInput?.value.trim() ?? '';
    const password = pwdInput?.value ?? '';

    emailErr?.classList.add('hidden');
    pwdErr?.classList.add('hidden');
    alertEl?.classList.add('hidden');

    let invalid = false;
    if (!isValidEmail(email)) {
      if (emailErr) {
        emailErr.textContent = 'Vui lòng nhập địa chỉ email hợp lệ.';
        emailErr.classList.remove('hidden');
      }
      invalid = true;
    }
    if (!password) {
      if (pwdErr) {
        pwdErr.textContent = 'Vui lòng nhập mật khẩu.';
        pwdErr.classList.remove('hidden');
      }
      invalid = true;
    }
    if (invalid) return;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Đang xác thực...';

    try {
      const session = await authService.login({ email, password });
      sessionStore.setSession(session);
      showToast(`Chào mừng ${session.user?.displayName ?? ''} quay trở lại TripLoom!`, 'success');
      const target = session.user ? resolvePostLoginDestination(session.user, redirectParam) : '/';
      ctx.navigate(target, { replace: true });
    } catch (err) {
      if (isAppError(err)) {
        if (err.fieldErrors.email && emailErr) {
          emailErr.textContent = err.fieldErrors.email;
          emailErr.classList.remove('hidden');
        }
        if (err.fieldErrors.password && pwdErr) {
          pwdErr.textContent = err.fieldErrors.password;
          pwdErr.classList.remove('hidden');
        }
      }
      if (alertEl) {
        alertEl.textContent = toUserErrorMessage(err);
        alertEl.classList.remove('hidden');
      }
      submitBtn.disabled = false;
      submitBtn.textContent = 'Đăng nhập';
    }
  });
}
