import type { RouteContext } from '@/app/router';
import { isAppError, toUserErrorMessage } from '@/api/errors';
import { authService } from '@/features/auth/auth.service';
import { renderPublicShell } from '@/layouts/public/PublicShell';
import { showToast } from '@/shared/components/Toast';
import { bindImageFallbacks, escapeHtml } from '@/shared/utils/dom';
import { STITCH_IMAGES } from '@/shared/utils/media';
import { isValidEmail, validatePassword } from '@/shared/utils/validation';

export function renderRegisterPage(ctx: RouteContext): void {
  const prefillEmail = ctx.query.get('email') ?? '';

  const main = renderPublicShell({
    container: ctx.container,
    variant: 'auth',
    contentHtml: `
      <div class="flex-1 flex items-center justify-center px-space-4 py-space-6">
        <div class="w-full max-w-[920px] bg-surface border border-border rounded-xl shadow-md overflow-hidden grid grid-cols-1 md:grid-cols-12">
          <!-- Cột hình ảnh thương hiệu -->
          <aside class="md:col-span-5 relative min-h-[170px] md:min-h-[520px] flex flex-col justify-end p-space-6 text-on-primary bg-primary">
            <img src="${STITCH_IMAGES.heroVietnam}" alt="Khám phá Việt Nam cùng TripLoom" data-fallback-label="TripLoom Việt Nam" class="absolute inset-0 w-full h-full object-cover" />
            <div class="absolute inset-0 bg-gradient-to-t from-primary-hover via-primary/90 to-primary/65"></div>
            <div class="relative z-10 flex flex-col gap-space-3">
              <h2 class="font-headline text-headline-md text-on-primary">Bắt đầu hành trình riêng của bạn.</h2>
              <p class="font-body text-body-md text-primary-light">Gợi ý địa điểm hợp gu, tối ưu lịch trình theo ngày và quản lý đơn dịch vụ tập trung.</p>
            </div>
          </aside>

          <!-- Cột biểu mẫu đăng ký -->
          <section class="md:col-span-7 p-space-6 md:p-space-8 flex flex-col justify-center gap-space-5">
            <div class="flex flex-col gap-space-1">
              <h1 class="font-headline text-headline-lg text-on-surface">Đăng ký tài khoản</h1>
              <p class="font-body text-body-md text-text-secondary">Điền thông tin để nhận mã xác thực qua email.</p>
            </div>

            <!-- Stepper gọn -->
            <ol class="grid grid-cols-3 gap-space-2 font-label text-label-sm" aria-label="Các bước đăng ký tài khoản">
              <li class="flex items-center justify-center gap-space-1 px-space-2 py-space-2 rounded-lg bg-primary-light border border-primary text-primary">
                <span class="tabular-nums">1.</span><span>Thông tin</span>
              </li>
              <li class="flex items-center justify-center gap-space-1 px-space-2 py-space-2 rounded-lg bg-background border border-border text-text-secondary">
                <span class="tabular-nums">2.</span><span>Xác thực</span>
              </li>
              <li class="flex items-center justify-center gap-space-1 px-space-2 py-space-2 rounded-lg bg-background border border-border text-text-secondary">
                <span class="tabular-nums">3.</span><span>Hoàn tất</span>
              </li>
            </ol>

            <div id="regAlert" role="alert" class="hidden p-space-3 rounded-lg bg-error-bg text-on-error-bg font-body text-body-md"></div>

            <form id="regForm" novalidate class="flex flex-col gap-space-3">
              <label class="flex flex-col gap-space-1">
                <span class="font-label text-label-md text-on-surface">Họ và tên <span class="text-error">*</span></span>
                <div class="relative flex items-center">
                  <span class="material-symbols-outlined text-[20px] text-text-secondary absolute left-space-3 pointer-events-none" aria-hidden="true">person</span>
                  <input id="regName" name="fullName" type="text" autocomplete="name" placeholder="Ví dụ: Nguyễn Minh Anh" class="w-full min-h-[44px] pl-10 pr-space-4 rounded border border-border bg-surface text-body-lg focus:border-primary focus:ring-2 focus:ring-primary/20" />
                </div>
                <span data-err="fullName" class="hidden font-body text-body-md text-error"></span>
              </label>

              <label class="flex flex-col gap-space-1">
                <span class="font-label text-label-md text-on-surface">Email <span class="text-error">*</span></span>
                <div class="relative flex items-center">
                  <span class="material-symbols-outlined text-[20px] text-text-secondary absolute left-space-3 pointer-events-none" aria-hidden="true">mail</span>
                  <input id="regEmail" name="email" type="email" autocomplete="email" value="${escapeHtml(prefillEmail)}" placeholder="you@example.com" class="w-full min-h-[44px] pl-10 pr-space-4 rounded border border-border bg-surface text-body-lg focus:border-primary focus:ring-2 focus:ring-primary/20" />
                </div>
                <span data-err="email" class="hidden font-body text-body-md text-error"></span>
              </label>

              <label class="flex flex-col gap-space-1">
                <span class="font-label text-label-md text-on-surface">Mật khẩu <span class="text-error">*</span></span>
                <div class="relative flex items-center">
                  <span class="material-symbols-outlined text-[20px] text-text-secondary absolute left-space-3 pointer-events-none" aria-hidden="true">lock</span>
                  <input id="regPwd" name="password" type="password" autocomplete="new-password" placeholder="Tối thiểu 8 ký tự gồm chữ và số" class="w-full min-h-[44px] pl-10 pr-12 rounded border border-border bg-surface text-body-lg focus:border-primary focus:ring-2 focus:ring-primary/20" />
                  <button type="button" data-toggle-pwd="regPwd" aria-label="Hiện hoặc ẩn mật khẩu" class="absolute right-space-1 w-[44px] h-[44px] inline-flex items-center justify-center text-text-secondary hover:text-on-surface">
                    <span class="material-symbols-outlined text-[20px]" aria-hidden="true">visibility</span>
                  </button>
                </div>
                <span data-err="password" class="hidden font-body text-body-md text-error"></span>
              </label>

              <label class="flex flex-col gap-space-1">
                <span class="font-label text-label-md text-on-surface">Xác nhận mật khẩu <span class="text-error">*</span></span>
                <div class="relative flex items-center">
                  <span class="material-symbols-outlined text-[20px] text-text-secondary absolute left-space-3 pointer-events-none" aria-hidden="true">lock</span>
                  <input id="regConfirmPwd" name="confirmPassword" type="password" autocomplete="new-password" placeholder="Nhập lại mật khẩu" class="w-full min-h-[44px] pl-10 pr-12 rounded border border-border bg-surface text-body-lg focus:border-primary focus:ring-2 focus:ring-primary/20" />
                  <button type="button" data-toggle-pwd="regConfirmPwd" aria-label="Hiện hoặc ẩn mật khẩu xác nhận" class="absolute right-space-1 w-[44px] h-[44px] inline-flex items-center justify-center text-text-secondary hover:text-on-surface">
                    <span class="material-symbols-outlined text-[20px]" aria-hidden="true">visibility</span>
                  </button>
                </div>
                <span data-err="confirmPassword" class="hidden font-body text-body-md text-error"></span>
              </label>

              <button id="regSubmitBtn" type="submit" class="w-full min-h-[44px] px-space-6 rounded bg-primary text-on-primary hover:bg-primary-hover disabled:opacity-60 font-label text-label-lg mt-space-1 transition-colors">
                Tiếp tục
              </button>
            </form>

            <div class="border-t border-border pt-space-4 flex flex-wrap items-center justify-between gap-space-2 font-body text-body-md text-text-secondary">
              <span>Đã có tài khoản TripLoom?</span>
              <a href="/dang-nhap" class="font-label text-label-md text-primary hover:underline">Đăng nhập ngay →</a>
            </div>
          </section>
        </div>
      </div>
    `,
  });

  bindImageFallbacks(main);

  main.querySelectorAll<HTMLButtonElement>('[data-toggle-pwd]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = main.querySelector<HTMLInputElement>(`#${btn.dataset.togglePwd}`);
      if (!target) return;
      const hidden = target.type === 'password';
      target.type = hidden ? 'text' : 'password';
      const icon = btn.querySelector('.material-symbols-outlined');
      if (icon) icon.textContent = hidden ? 'visibility_off' : 'visibility';
    });
  });

  const form = main.querySelector<HTMLFormElement>('#regForm');
  const alertEl = main.querySelector<HTMLElement>('#regAlert');
  const submitBtn = main.querySelector<HTMLButtonElement>('#regSubmitBtn');

  const setFieldErr = (name: string, msg: string | null) => {
    const el = main.querySelector<HTMLElement>(`[data-err="${name}"]`);
    if (!el) return;
    if (msg) {
      el.textContent = msg;
      el.classList.remove('hidden');
    } else {
      el.textContent = '';
      el.classList.add('hidden');
    }
  };

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!submitBtn || submitBtn.disabled) return;

    const fullName = main.querySelector<HTMLInputElement>('#regName')?.value.trim() ?? '';
    const email = main.querySelector<HTMLInputElement>('#regEmail')?.value.trim() ?? '';
    const password = main.querySelector<HTMLInputElement>('#regPwd')?.value ?? '';
    const confirmPassword = main.querySelector<HTMLInputElement>('#regConfirmPwd')?.value ?? '';

    ['fullName', 'email', 'password', 'confirmPassword'].forEach((k) => setFieldErr(k, null));
    alertEl?.classList.add('hidden');

    let hasErr = false;
    if (fullName.length < 2 || fullName.length > 150) {
      setFieldErr('fullName', 'Họ và tên phải từ 2 đến 150 ký tự.');
      hasErr = true;
    }
    if (!isValidEmail(email)) {
      setFieldErr('email', 'Vui lòng nhập địa chỉ email hợp lệ.');
      hasErr = true;
    }
    const pwdErr = validatePassword(password);
    if (pwdErr) {
      setFieldErr('password', pwdErr);
      hasErr = true;
    }
    if (password !== confirmPassword) {
      setFieldErr('confirmPassword', 'Mật khẩu xác nhận không khớp.');
      hasErr = true;
    }
    if (hasErr) return;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Đang gửi mã xác thực...';
    try {
      await authService.register({ fullName, email, password, confirmPassword });
      showToast('Đã gửi mã xác thực 6 chữ số tới email của bạn.', 'success');
      ctx.navigate(`/dang-ky/xac-thuc?email=${encodeURIComponent(email)}`);
    } catch (err) {
      if (isAppError(err)) {
        Object.entries(err.fieldErrors).forEach(([k, v]) => setFieldErr(k, v));
      }
      if (alertEl) {
        alertEl.textContent = toUserErrorMessage(err);
        alertEl.classList.remove('hidden');
      }
      submitBtn.disabled = false;
      submitBtn.textContent = 'Tiếp tục';
    }
  });
}
