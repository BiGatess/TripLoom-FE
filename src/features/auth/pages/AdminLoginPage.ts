import type { RouteContext } from '@/app/router';
import { canUserAccessBackoffice, resolvePostLoginDestination } from '@/app/route-guards';
import { sessionStore } from '@/app/session-store';
import { isAppError, toUserErrorMessage } from '@/api/errors';
import { authService } from '@/features/auth/auth.service';
import { renderLogoMark } from '@/shared/components/Logo';
import { showToast } from '@/shared/components/Toast';
import { escapeHtml } from '@/shared/utils/dom';
import { isValidEmail } from '@/shared/utils/validation';

export function renderAdminLoginPage(ctx: RouteContext): void {
  const redirectParam = ctx.query.get('redirect');
  const prefillEmail = ctx.query.get('email') ?? '';
  const reason = ctx.query.get('reason');

  const noticeHtml =
    reason === 'expired'
      ? `<div role="alert" class="p-3 rounded-lg bg-warning-bg text-on-warning-bg font-body text-body-md flex items-start gap-2">
           <span class="material-symbols-outlined text-[20px] shrink-0" aria-hidden="true">schedule</span>
           <span>Phiên làm việc trước đã kết thúc. Vui lòng đăng nhập lại để vào khu Quản trị.</span>
         </div>`
      : '';

  ctx.container.innerHTML = `
    <div class="min-h-screen bg-[#0F172A] relative overflow-hidden flex items-center justify-center p-4 md:p-6 tl-page-enter">
      <!-- Ánh sáng nền nhẹ đồng bộ màu chủ đạo TripLoom -->
      <div aria-hidden="true" class="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[540px] h-[280px] rounded-full bg-primary/20 blur-3xl"></div>
      <div aria-hidden="true" class="pointer-events-none absolute -bottom-24 right-1/4 w-[420px] h-[240px] rounded-full bg-teal-500/10 blur-3xl"></div>

      <div class="relative z-10 w-full max-w-[440px] bg-surface border border-slate-200/90 rounded-2xl shadow-lg overflow-hidden">
        <div class="h-1.5 w-full bg-gradient-to-r from-primary via-teal-500 to-primary"></div>

        <div class="p-6 sm:p-8 flex flex-col gap-6">
          <div class="flex flex-col items-center text-center gap-3">
            <div class="inline-flex items-center gap-2.5">
              ${renderLogoMark(38)}
              <span class="font-headline text-headline-md text-on-surface">TripLoom</span>
              <span class="px-2.5 py-0.5 rounded-full bg-primary-light border border-primary/20 text-primary font-label text-label-sm">Admin</span>
            </div>
            <div class="flex flex-col gap-1">
              <h1 class="font-headline text-headline-lg text-on-surface">Đăng nhập Quản trị</h1>
              <p class="font-body text-body-md text-text-secondary">Cổng làm việc nội bộ dành cho Quản trị viên &amp; Nhân viên vận hành.</p>
            </div>
          </div>

          ${noticeHtml}
          <div id="adminLoginAlert" role="alert" class="hidden p-3 rounded-xl bg-error-bg text-on-error-bg font-body text-body-md"></div>

          <form id="adminLoginForm" novalidate class="flex flex-col gap-4">
            <label class="flex flex-col gap-1.5">
              <span class="font-label text-label-md text-on-surface">Email nội bộ</span>
              <div class="relative flex items-center">
                <span class="material-symbols-outlined text-[20px] text-text-secondary absolute left-3.5 pointer-events-none" aria-hidden="true">badge</span>
                <input
                  id="adminLoginEmail"
                  name="email"
                  type="email"
                  autocomplete="username"
                  value="${escapeHtml(prefillEmail)}"
                  placeholder="admin@triploom.vn"
                  class="w-full min-h-[46px] pl-11 pr-4 rounded-xl bg-background border border-border text-body-lg text-on-surface focus:bg-surface focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <span id="adminLoginEmailErr" class="hidden font-body text-body-md text-error"></span>
            </label>

            <label class="flex flex-col gap-1.5">
              <span class="font-label text-label-md text-on-surface">Mật khẩu</span>
              <div class="relative flex items-center">
                <span class="material-symbols-outlined text-[20px] text-text-secondary absolute left-3.5 pointer-events-none" aria-hidden="true">lock</span>
                <input
                  id="adminLoginPwd"
                  name="password"
                  type="password"
                  autocomplete="current-password"
                  placeholder="Nhập mật khẩu quản trị"
                  class="w-full min-h-[46px] pl-11 pr-12 rounded-xl bg-background border border-border text-body-lg text-on-surface focus:bg-surface focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                <button
                  id="adminTogglePwdBtn"
                  type="button"
                  aria-label="Hiện hoặc ẩn mật khẩu"
                  class="absolute right-1.5 w-[40px] h-[40px] rounded-lg inline-flex items-center justify-center text-text-secondary hover:text-primary hover:bg-surface-muted transition-colors"
                >
                  <span id="adminTogglePwdIcon" class="material-symbols-outlined text-[20px]" aria-hidden="true">visibility</span>
                </button>
              </div>
              <span id="adminLoginPwdErr" class="hidden font-body text-body-md text-error"></span>
            </label>

            <button
              id="adminLoginSubmitBtn"
              type="submit"
              class="inline-flex items-center justify-center gap-2 w-full min-h-[48px] px-6 rounded-xl bg-primary text-on-primary hover:bg-primary-hover disabled:opacity-60 font-label text-label-lg mt-1 shadow-sm transition-colors"
            >
              <span class="material-symbols-outlined text-[20px]" aria-hidden="true">admin_panel_settings</span>
              <span>Vào trang Quản trị</span>
            </button>
          </form>

          <div class="border-t border-border pt-4 flex flex-col items-center gap-2 text-center">
            <span class="font-body text-label-sm text-text-secondary">Nhân viên mới được Quản trị viên cấp quyền?</span>
            <a
              href="/kich-hoat-nhan-vien"
              class="inline-flex items-center justify-center gap-1.5 min-h-[38px] px-4 rounded-full border border-primary/30 bg-primary-light/70 text-primary hover:bg-primary hover:text-on-primary font-label text-label-sm no-underline transition-colors"
            >
              <span class="material-symbols-outlined text-[16px]" aria-hidden="true">verified_user</span>
              <span>Kích hoạt mã mời nhân viên</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  `;

  const root = ctx.container;
  const form = root.querySelector<HTMLFormElement>('#adminLoginForm');
  const emailInput = root.querySelector<HTMLInputElement>('#adminLoginEmail');
  const pwdInput = root.querySelector<HTMLInputElement>('#adminLoginPwd');
  const emailErr = root.querySelector<HTMLElement>('#adminLoginEmailErr');
  const pwdErr = root.querySelector<HTMLElement>('#adminLoginPwdErr');
  const alertEl = root.querySelector<HTMLElement>('#adminLoginAlert');
  const submitBtn = root.querySelector<HTMLButtonElement>('#adminLoginSubmitBtn');

  root.querySelector('#adminTogglePwdBtn')?.addEventListener('click', () => {
    if (!pwdInput) return;
    const isHidden = pwdInput.type === 'password';
    pwdInput.type = isHidden ? 'text' : 'password';
    const icon = root.querySelector('#adminTogglePwdIcon');
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
        emailErr.textContent = 'Vui lòng nhập email nội bộ hợp lệ.';
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
    submitBtn.textContent = 'Đang xác thực quyền...';

    try {
      const session = await authService.login({ email, password });
      if (!session.user || !canUserAccessBackoffice(session.user)) {
        await authService.logout();
        sessionStore.clear();
        if (alertEl) {
          alertEl.textContent =
            'Tài khoản khách hàng không được phép truy cập cổng Quản trị. Vui lòng đăng nhập bằng tài khoản Quản trị viên hoặc Nhân viên.';
          alertEl.classList.remove('hidden');
        }
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<span class="material-symbols-outlined text-[20px]" aria-hidden="true">admin_panel_settings</span><span>Vào trang Quản trị</span>`;
        return;
      }

      sessionStore.setSession(session);
      showToast(`Đã đăng nhập khu Quản trị (${session.user.fullName}).`, 'success');
      const target = resolvePostLoginDestination(session.user, redirectParam);
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
      submitBtn.innerHTML = `<span class="material-symbols-outlined text-[20px]" aria-hidden="true">admin_panel_settings</span><span>Vào trang Quản trị</span>`;
    }
  });
}
