import type { RouteContext } from '@/app/router';
import { sessionStore } from '@/app/session-store';
import { isAppError, toUserErrorMessage } from '@/api/errors';
import { authService } from '@/features/auth/auth.service';
import { profileService } from '@/features/profile/profile.service';
import { renderMemberShell } from '@/layouts/member/MemberShell';
import { renderErrorBanner, renderLoadingSkeleton } from '@/shared/components/EmptyErrorState';
import { showToast } from '@/shared/components/Toast';
import { beginAsyncRender, escapeHtml, finishAsyncRender } from '@/shared/utils/dom';
import { formatDateTimeVi } from '@/shared/utils/format';

function renderPasswordInput(id: string, label: string, placeholder: string, errKey: string, autocomplete: string): string {
  return `
    <label class="flex flex-col gap-space-1">
      <span class="font-label text-label-md text-on-surface">${label} <span class="text-error">*</span></span>
      <div class="relative flex items-center">
        <input
          id="${id}"
          type="password"
          autocomplete="${autocomplete}"
          placeholder="${placeholder}"
          class="w-full min-h-[44px] pl-space-4 pr-11 rounded-lg border border-border bg-surface text-body-md focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
        <button
          type="button"
          data-toggle-pwd="${id}"
          aria-label="Hiện mật khẩu"
          class="tl-no-press absolute right-1.5 w-9 h-9 rounded-full inline-flex items-center justify-center text-text-secondary hover:text-primary hover:bg-surface-muted transition-colors"
        >
          <span class="material-symbols-outlined text-[19px]" aria-hidden="true">visibility</span>
        </button>
      </div>
      <span data-pwd-err="${errKey}" class="hidden font-body text-body-md text-error"></span>
    </label>
  `;
}

export async function renderProfilePage(ctx: RouteContext): Promise<void> {
  const main = renderMemberShell({
    container: ctx.container,
    activeNav: 'profile',
    contentHtml: `<div id="profileRoot" class="flex flex-col gap-space-6">${renderLoadingSkeleton(2)}</div>`,
  });

  const root = main.querySelector<HTMLElement>('#profileRoot')!;

  const load = async () => {
    beginAsyncRender(root, renderLoadingSkeleton(2));
    try {
      const profile = await profileService.getProfile();

      finishAsyncRender(
        root,
        `
        <div class="flex flex-col gap-space-1">
          <h1 class="font-headline text-headline-lg text-on-surface">Hồ sơ cá nhân</h1>
          <p class="font-body text-body-md text-text-secondary">Quản lý thông tin liên hệ và bảo mật mật khẩu đăng nhập của tài khoản.</p>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-12 gap-space-6 items-start">
          <!-- Card 1: Thông tin cá nhân -->
          <section class="lg:col-span-6 bg-surface border border-border rounded-xl p-space-6 shadow-sm flex flex-col gap-space-4">
            <div class="flex items-center justify-between gap-space-3 border-b border-border pb-space-3">
              <div class="flex items-center gap-2">
                <span class="material-symbols-outlined text-[22px] text-primary" aria-hidden="true">badge</span>
                <h2 class="font-headline text-headline-md text-on-surface">Thông tin cá nhân</h2>
              </div>
              <button
                type="button"
                id="profEditBtn"
                class="inline-flex items-center gap-1.5 min-h-[36px] px-3 rounded-full border border-border bg-surface text-primary hover:bg-primary-light hover:border-primary/40 font-label text-label-sm transition-colors"
              >
                <span class="material-symbols-outlined text-[16px]" aria-hidden="true">edit</span>
                <span>Cập nhật thông tin</span>
              </button>
            </div>

            <!-- Read-only View Mode -->
            <div id="profViewPanel" class="flex flex-col gap-space-4 tl-content-enter">
              <div class="flex items-center gap-space-3 p-space-3.5 rounded-xl bg-background border border-border">
                <span class="w-12 h-12 rounded-full bg-primary text-on-primary font-headline text-headline-md inline-flex items-center justify-center shrink-0">
                  ${escapeHtml(profile.displayName.slice(0, 1).toUpperCase())}
                </span>
                <div class="min-w-0">
                  <p class="font-title text-title-md text-on-surface truncate">${escapeHtml(profile.fullName)}</p>
                  <p class="font-body text-body-md text-text-secondary truncate">Tên hiển thị: <strong class="text-on-surface font-medium">${escapeHtml(profile.displayName)}</strong></p>
                </div>
              </div>

              <dl class="rounded-xl bg-background border border-border divide-y divide-border px-space-4 font-body text-body-md">
                <div class="py-space-3 flex items-center justify-between gap-space-4">
                  <dt class="text-text-secondary shrink-0">Email đăng nhập</dt>
                  <dd class="inline-flex items-center gap-1.5 font-label text-on-surface text-right min-w-0">
                    <span class="truncate select-none">${escapeHtml(profile.email)}</span>
                    <span class="material-symbols-outlined text-[15px] text-text-secondary/80 shrink-0" aria-hidden="true" title="Email đăng nhập cố định">lock</span>
                  </dd>
                </div>
                <div class="py-space-3 flex items-center justify-between gap-space-4">
                  <dt class="text-text-secondary shrink-0">Họ và tên</dt>
                  <dd class="font-label text-on-surface text-right">${escapeHtml(profile.fullName)}</dd>
                </div>
                <div class="py-space-3 flex items-center justify-between gap-space-4">
                  <dt class="text-text-secondary shrink-0">Tên hiển thị</dt>
                  <dd class="font-label text-on-surface text-right">${escapeHtml(profile.displayName)}</dd>
                </div>
                <div class="py-space-3 flex items-center justify-between gap-space-4">
                  <dt class="text-text-secondary shrink-0">Số điện thoại liên hệ</dt>
                  <dd class="font-label text-on-surface tabular-nums text-right">
                    ${profile.phone ? escapeHtml(profile.phone) : `<span class="text-text-secondary font-normal">Chưa cập nhật</span>`}
                  </dd>
                </div>
              </dl>
            </div>

            <!-- Edit Mode (ẩn mặc định, chỉ mở khi bấm icon Cập nhật thông tin) -->
            <form id="profileForm" novalidate class="hidden flex-col gap-space-4 tl-content-enter">
              <div id="profileAlert" role="alert" class="hidden p-space-3.5 rounded-lg bg-error-bg text-on-error-bg font-body text-body-md"></div>

              <label class="flex flex-col gap-space-1">
                <span class="font-label text-label-md text-on-surface">Email đăng nhập</span>
                <div class="relative flex items-center">
                  <input
                    type="email"
                    value="${escapeHtml(profile.email)}"
                    disabled
                    readonly
                    aria-readonly="true"
                    tabindex="-1"
                    class="w-full min-h-[44px] pl-space-4 pr-10 rounded-lg bg-surface-muted border border-border text-text-secondary cursor-not-allowed select-none opacity-90"
                  />
                  <span class="material-symbols-outlined text-[18px] text-text-secondary/80 absolute right-3.5 pointer-events-none" aria-hidden="true">lock</span>
                </div>
              </label>

              <label class="flex flex-col gap-space-1">
                <span class="font-label text-label-md text-on-surface">Họ và tên <span class="text-error">*</span></span>
                <input id="profFullName" type="text" value="${escapeHtml(profile.fullName)}" class="w-full min-h-[44px] px-space-4 rounded-lg border border-border bg-surface text-body-md focus:border-primary focus:ring-2 focus:ring-primary/20" />
                <span data-err="fullName" class="hidden font-body text-body-md text-error"></span>
              </label>

              <label class="flex flex-col gap-space-1">
                <span class="font-label text-label-md text-on-surface">Tên hiển thị <span class="text-error">*</span></span>
                <input id="profDisplayName" type="text" value="${escapeHtml(profile.displayName)}" class="w-full min-h-[44px] px-space-4 rounded-lg border border-border bg-surface text-body-md focus:border-primary focus:ring-2 focus:ring-primary/20" />
                <span data-err="displayName" class="hidden font-body text-body-md text-error"></span>
              </label>

              <label class="flex flex-col gap-space-1">
                <span class="font-label text-label-md text-on-surface">Số điện thoại liên hệ</span>
                <input id="profPhone" type="tel" value="${escapeHtml(profile.phone)}" placeholder="Ví dụ: 0905 123 456" class="w-full min-h-[44px] px-space-4 rounded-lg border border-border bg-surface text-body-md tabular-nums focus:border-primary focus:ring-2 focus:ring-primary/20" />
              </label>

              <div class="pt-space-2 flex items-center justify-end gap-space-2.5">
                <button id="profCancelBtn" type="button" class="min-h-[42px] px-space-4 rounded-lg border border-border bg-surface text-on-surface hover:bg-surface-muted font-label text-label-md transition-colors">
                  Hủy
                </button>
                <button id="profSaveBtn" type="submit" class="min-h-[42px] px-space-6 rounded-lg bg-primary text-on-primary hover:bg-primary-hover disabled:opacity-60 font-label text-label-md transition-colors">
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </section>

          <!-- Card 2: Bảo mật & mật khẩu -->
          <section class="lg:col-span-6 bg-surface border border-border rounded-xl p-space-6 shadow-sm flex flex-col gap-space-4">
            <div class="flex items-center justify-between gap-space-3 border-b border-border pb-space-3">
              <div class="flex items-center gap-2">
                <span class="material-symbols-outlined text-[22px] text-primary" aria-hidden="true">verified_user</span>
                <h2 class="font-headline text-headline-md text-on-surface">Bảo mật &amp; mật khẩu</h2>
              </div>
            </div>

            <!-- Default Status Mode -->
            <div id="pwdViewPanel" class="flex flex-col gap-space-4 tl-content-enter">
              <div class="p-space-4 rounded-xl bg-background border border-border flex items-center justify-between gap-space-3">
                <div class="flex items-start gap-space-3 min-w-0">
                  <span class="w-10 h-10 rounded-full bg-primary-light text-primary inline-flex items-center justify-center shrink-0">
                    <span class="material-symbols-outlined text-[20px]" aria-hidden="true">lock</span>
                  </span>
                  <div class="min-w-0">
                    <p class="font-title text-title-md text-on-surface">Mật khẩu đăng nhập</p>
                    <p class="font-label text-label-md text-text-secondary tracking-widest mt-0.5">••••••••••••</p>
                    <p class="font-body text-label-sm text-text-secondary tabular-nums mt-1">Cập nhật gần nhất: ${formatDateTimeVi(profile.updatedAt)}</p>
                  </div>
                </div>
                <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-success-bg text-success font-label text-label-sm shrink-0">
                  <span class="material-symbols-outlined text-[14px]" aria-hidden="true">check_circle</span>
                  <span>Đã thiết lập</span>
                </span>
              </div>

              <p class="font-body text-body-md text-text-secondary">
                Bạn có thể chủ động thay đổi mật khẩu định kỳ hoặc gửi yêu cầu đặt lại mật khẩu qua email nếu quên mật khẩu hiện tại.
              </p>

              <div class="flex flex-wrap items-center gap-space-3 pt-space-1">
                <button
                  type="button"
                  id="pwdOpenBtn"
                  class="inline-flex items-center justify-center gap-2 min-h-[42px] px-space-5 rounded-lg bg-primary text-on-primary hover:bg-primary-hover font-label text-label-md transition-colors"
                >
                  <span class="material-symbols-outlined text-[18px]" aria-hidden="true">lock_reset</span>
                  <span>Thay đổi mật khẩu</span>
                </button>
                <a
                  href="/quen-mat-khau?email=${encodeURIComponent(profile.email)}&from=ho-so"
                  class="inline-flex items-center justify-center gap-2 min-h-[42px] px-space-4 rounded-lg border border-border bg-surface text-on-surface hover:border-primary hover:text-primary font-label text-label-md no-underline transition-colors"
                >
                  <span class="material-symbols-outlined text-[18px]" aria-hidden="true">help_outline</span>
                  <span>Quên mật khẩu</span>
                </a>
              </div>
            </div>

            <!-- Change Password Edit Mode (ẩn mặc định) -->
            <form id="changePasswordForm" novalidate class="hidden flex-col gap-space-4 tl-content-enter">
              <div id="pwdAlert" role="alert" class="hidden p-space-3.5 rounded-lg bg-error-bg text-on-error-bg font-body text-body-md"></div>

              ${renderPasswordInput('pwdCurrent', 'Mật khẩu hiện tại', 'Nhập mật khẩu hiện tại', 'currentPassword', 'current-password')}
              ${renderPasswordInput('pwdNew', 'Mật khẩu mới', 'Tối thiểu 8 ký tự, gồm chữ và số', 'newPassword', 'new-password')}
              ${renderPasswordInput('pwdConfirm', 'Xác nhận mật khẩu mới', 'Nhập lại mật khẩu mới', 'confirmPassword', 'new-password')}

              <p class="font-body text-label-sm text-text-secondary bg-surface-muted/70 border border-border rounded-lg p-space-3 flex items-center gap-2">
                <span class="material-symbols-outlined text-[17px] text-primary shrink-0" aria-hidden="true">info</span>
                <span>Mật khẩu nên dài tối thiểu 8 ký tự, bao gồm cả chữ cái và chữ số để bảo vệ tài khoản.</span>
              </p>

              <div class="pt-space-2 flex flex-wrap items-center justify-between gap-space-3">
                <a href="/quen-mat-khau?email=${encodeURIComponent(profile.email)}&from=ho-so" class="font-label text-label-sm text-primary hover:underline no-underline">
                  Quên mật khẩu hiện tại?
                </a>
                <div class="flex items-center gap-space-2.5 ml-auto">
                  <button id="pwdCancelBtn" type="button" class="min-h-[42px] px-space-4 rounded-lg border border-border bg-surface text-on-surface hover:bg-surface-muted font-label text-label-md transition-colors">
                    Hủy
                  </button>
                  <button id="pwdSaveBtn" type="submit" class="min-h-[42px] px-space-6 rounded-lg bg-primary text-on-primary hover:bg-primary-hover disabled:opacity-60 font-label text-label-md transition-colors">
                    Cập nhật mật khẩu
                  </button>
                </div>
              </div>
            </form>
          </section>
        </div>
      `,
      );

      // Toggle Edit Profile Mode
      const profEditBtn = root.querySelector<HTMLButtonElement>('#profEditBtn');
      const profViewPanel = root.querySelector<HTMLElement>('#profViewPanel');
      const form = root.querySelector<HTMLFormElement>('#profileForm');
      const profCancelBtn = root.querySelector<HTMLButtonElement>('#profCancelBtn');
      const alertEl = root.querySelector<HTMLElement>('#profileAlert');
      const saveBtn = root.querySelector<HTMLButtonElement>('#profSaveBtn');

      const setErr = (k: string, msg: string | null) => {
        const el = root.querySelector<HTMLElement>(`[data-err="${k}"]`);
        if (!el) return;
        if (msg) {
          el.textContent = msg;
          el.classList.remove('hidden');
        } else {
          el.classList.add('hidden');
        }
      };

      const setProfileEditMode = (editing: boolean) => {
        if (!profViewPanel || !form) return;
        if (editing) {
          profViewPanel.classList.add('hidden');
          form.classList.remove('hidden');
          form.classList.add('flex');
          profEditBtn?.classList.add('hidden');
          root.querySelector<HTMLInputElement>('#profFullName')?.focus();
        } else {
          form.classList.add('hidden');
          form.classList.remove('flex');
          profViewPanel.classList.remove('hidden');
          profEditBtn?.classList.remove('hidden');
          ['fullName', 'displayName'].forEach((k) => setErr(k, null));
          alertEl?.classList.add('hidden');
          // Restore saved field values on cancel
          const fn = root.querySelector<HTMLInputElement>('#profFullName');
          const dn = root.querySelector<HTMLInputElement>('#profDisplayName');
          const ph = root.querySelector<HTMLInputElement>('#profPhone');
          if (fn) fn.value = profile.fullName;
          if (dn) dn.value = profile.displayName;
          if (ph) ph.value = profile.phone;
        }
      };

      profEditBtn?.addEventListener('click', () => setProfileEditMode(true));
      profCancelBtn?.addEventListener('click', () => setProfileEditMode(false));

      // Toggle Change Password Mode
      const pwdViewPanel = root.querySelector<HTMLElement>('#pwdViewPanel');
      const pwdForm = root.querySelector<HTMLFormElement>('#changePasswordForm');
      const pwdOpenBtn = root.querySelector<HTMLButtonElement>('#pwdOpenBtn');
      const pwdCancelBtn = root.querySelector<HTMLButtonElement>('#pwdCancelBtn');
      const pwdAlert = root.querySelector<HTMLElement>('#pwdAlert');
      const pwdBtn = root.querySelector<HTMLButtonElement>('#pwdSaveBtn');

      const setPwdErr = (k: string, msg: string | null) => {
        const el = root.querySelector<HTMLElement>(`[data-pwd-err="${k}"]`);
        if (!el) return;
        if (msg) {
          el.textContent = msg;
          el.classList.remove('hidden');
        } else {
          el.classList.add('hidden');
        }
      };

      const setPasswordEditMode = (editing: boolean) => {
        if (!pwdViewPanel || !pwdForm) return;
        if (editing) {
          pwdViewPanel.classList.add('hidden');
          pwdForm.classList.remove('hidden');
          pwdForm.classList.add('flex');
          root.querySelector<HTMLInputElement>('#pwdCurrent')?.focus();
        } else {
          pwdForm.classList.add('hidden');
          pwdForm.classList.remove('flex');
          pwdViewPanel.classList.remove('hidden');
          pwdForm.reset();
          ['currentPassword', 'newPassword', 'confirmPassword'].forEach((k) => setPwdErr(k, null));
          pwdAlert?.classList.add('hidden');
        }
      };

      pwdOpenBtn?.addEventListener('click', () => setPasswordEditMode(true));
      pwdCancelBtn?.addEventListener('click', () => setPasswordEditMode(false));

      // Show / Hide password toggles
      root.querySelectorAll<HTMLButtonElement>('[data-toggle-pwd]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const inputId = btn.dataset.togglePwd;
          const inp = inputId ? root.querySelector<HTMLInputElement>(`#${inputId}`) : null;
          const icon = btn.querySelector('.material-symbols-outlined');
          if (!inp) return;
          const show = inp.type === 'password';
          inp.type = show ? 'text' : 'password';
          btn.setAttribute('aria-label', show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu');
          if (icon) icon.textContent = show ? 'visibility_off' : 'visibility';
        });
      });

      form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!saveBtn || saveBtn.disabled) return;
        ['fullName', 'displayName'].forEach((k) => setErr(k, null));
        alertEl?.classList.add('hidden');

        const fullName = root.querySelector<HTMLInputElement>('#profFullName')?.value.trim() ?? '';
        const displayName = root.querySelector<HTMLInputElement>('#profDisplayName')?.value.trim() ?? '';
        const phone = root.querySelector<HTMLInputElement>('#profPhone')?.value.trim() ?? '';

        saveBtn.disabled = true;
        saveBtn.textContent = 'Đang lưu...';
        try {
          const updated = await profileService.updateProfile({
            fullName,
            displayName,
            phone,
            categoryIds: profile.preferences.categoryIds,
            defaultBudgetVnd: profile.preferences.defaultBudgetVnd,
            defaultPartySize: profile.preferences.defaultPartySize,
            pace: profile.preferences.pace,
          });
          sessionStore.updateUser(updated);
          showToast('Đã cập nhật thông tin cá nhân.', 'success');
          await renderProfilePage(ctx);
        } catch (err) {
          if (isAppError(err)) {
            Object.entries(err.fieldErrors).forEach(([k, v]) => setErr(k, v));
          }
          if (alertEl) {
            alertEl.textContent = toUserErrorMessage(err);
            alertEl.classList.remove('hidden');
          }
          saveBtn.disabled = false;
          saveBtn.textContent = 'Lưu thay đổi';
        }
      });

      pwdForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!pwdBtn || pwdBtn.disabled) return;
        ['currentPassword', 'newPassword', 'confirmPassword'].forEach((k) => setPwdErr(k, null));
        pwdAlert?.classList.add('hidden');

        const currentPassword = root.querySelector<HTMLInputElement>('#pwdCurrent')?.value ?? '';
        const newPassword = root.querySelector<HTMLInputElement>('#pwdNew')?.value ?? '';
        const confirmPassword = root.querySelector<HTMLInputElement>('#pwdConfirm')?.value ?? '';

        pwdBtn.disabled = true;
        pwdBtn.textContent = 'Đang cập nhật...';
        try {
          const res = await authService.changePassword({
            currentPassword,
            newPassword,
            confirmPassword,
          });
          showToast(res.message, 'success');
          setPasswordEditMode(false);
        } catch (err) {
          if (isAppError(err)) {
            Object.entries(err.fieldErrors).forEach(([k, v]) => setPwdErr(k, v));
          }
          if (pwdAlert) {
            pwdAlert.textContent = toUserErrorMessage(err);
            pwdAlert.classList.remove('hidden');
          }
        } finally {
          pwdBtn.disabled = false;
          pwdBtn.textContent = 'Cập nhật mật khẩu';
        }
      });
    } catch (err) {
      finishAsyncRender(root, renderErrorBanner(toUserErrorMessage(err), 'retryProfBtn'));
      root.querySelector('#retryProfBtn')?.addEventListener('click', () => void load());
    }
  };

  await load();
}
