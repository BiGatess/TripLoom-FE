import type { RouteContext } from '@/app/router';
import { isAppError, toUserErrorMessage } from '@/api/errors';
import type { StaffMember } from '@/api/contracts';
import { STAFF_PERMISSION_GROUPS, type StaffPermissionCode } from '@/config/constants';
import { authService } from '@/features/auth/auth.service';
import { staffService } from '@/features/staff/staff.service';
import { renderErrorPage } from '@/features/system/pages/ErrorPage';
import { renderBackofficeShell } from '@/layouts/backoffice/BackofficeShell';
import { renderErrorBanner, renderLoadingSkeleton } from '@/shared/components/EmptyErrorState';
import { openConfirmModal, openModal } from '@/shared/components/Modal';
import { readSelectedPermissions, renderPermissionMatrix } from '@/shared/components/PermissionMatrix';
import { renderStaffStatusBadge } from '@/shared/components/StatusBadge';
import { showToast } from '@/shared/components/Toast';
import { escapeHtml } from '@/shared/utils/dom';
import { formatCountdownMmSs, formatDateTimeVi, secondsRemaining } from '@/shared/utils/format';

function permLabel(code: StaffPermissionCode): string {
  return STAFF_PERMISSION_GROUPS.find((g) => g.code === code)?.label ?? code;
}

export async function renderStaffDetailPage(ctx: RouteContext): Promise<void> {
  const staffId = ctx.params.id ?? '';

  const main = renderBackofficeShell({
    container: ctx.container,
    activeNav: 'staff',
    breadcrumbs: [
      { label: 'Quản trị', href: '/quan-tri' },
      { label: 'Nhân viên', href: '/quan-tri/nhan-vien' },
      { label: staffId },
    ],
    contentHtml: `<div id="a14Root">${renderLoadingSkeleton(2)}</div>`,
  });

  const root = main.querySelector<HTMLElement>('#a14Root')!;
  let resendTimer: number | null = null;
  const clearTimer = () => {
    if (resendTimer !== null) {
      window.clearInterval(resendTimer);
      resendTimer = null;
    }
  };
  ctx.onCleanup(clearTimer);

  const openPermissionModal = (staff: StaffMember) => {
    openModal({
      title: `Cấp & thu hồi nhóm quyền · ${staff.staffCode}`,
      subtitle: 'Khi thay đổi nhóm quyền, hệ thống sẽ tăng phiên bản xác thực và yêu cầu nhân viên đăng nhập lại.',
      size: 'lg',
      bodyHtml: `
        <form id="a15Form" novalidate class="flex flex-col gap-space-4">
          <div id="a15Alert" role="alert" class="hidden p-space-3 rounded bg-error-bg text-on-error-bg font-body text-body-md"></div>

          <div class="p-space-3 rounded-lg bg-background border border-border text-body-md">
            <span class="font-label text-label-sm text-text-secondary">Quyền hiện tại: </span>
            <strong class="text-on-surface">${staff.permissions.length > 0 ? escapeHtml(staff.permissions.map(permLabel).join(', ')) : 'Chưa gán nhóm quyền'}</strong>
          </div>

          ${renderPermissionMatrix(staff.permissions, 'a15Perms')}

          <label class="flex flex-col gap-space-1">
            <span class="font-label text-label-md text-on-surface">Lý do thay đổi quyền (5 – 500 ký tự) <span class="text-error">*</span></span>
            <textarea id="a15Reason" rows="3" placeholder="Nêu rõ lý do cấp thêm hoặc thu hồi nhóm quyền..." class="w-full p-space-3 rounded border border-border bg-surface text-body-md"></textarea>
          </label>

          <div class="flex justify-end gap-space-3 pt-space-2 border-t border-border">
            <button type="button" data-a15-cancel class="min-h-[44px] px-space-4 rounded border border-border bg-surface text-on-surface font-label text-label-md">Hủy</button>
            <button type="submit" id="a15Submit" class="min-h-[44px] px-space-6 rounded bg-primary text-on-primary hover:bg-primary-hover font-label text-label-md">Lưu thay đổi quyền</button>
          </div>
        </form>
      `,
      onMount: (panel, close) => {
        panel.querySelector('[data-a15-cancel]')?.addEventListener('click', close);
        panel.querySelector<HTMLFormElement>('#a15Form')?.addEventListener('submit', async (e) => {
          e.preventDefault();
          const btn = panel.querySelector<HTMLButtonElement>('#a15Submit');
          const alertEl = panel.querySelector<HTMLElement>('#a15Alert');
          if (!btn || btn.disabled) return;
          const permissions = readSelectedPermissions(panel, 'a15Perms');
          const reason = panel.querySelector<HTMLTextAreaElement>('#a15Reason')?.value.trim() ?? '';
          alertEl?.classList.add('hidden');
          btn.disabled = true;
          btn.textContent = 'Đang cập nhật...';
          try {
            await staffService.updateStaffPermissions(staff.id, {
              permissions,
              reason,
              expectedUpdatedAt: staff.updatedAt,
            });
            close();
            showToast('Đã cập nhật nhóm quyền. Nhân viên sẽ cần đăng nhập lại để nhận quyền mới.', 'success');
            await load();
          } catch (err) {
            if (alertEl) {
              alertEl.textContent = toUserErrorMessage(err);
              alertEl.classList.remove('hidden');
            }
            btn.disabled = false;
            btn.textContent = 'Lưu thay đổi quyền';
          }
        });
      },
    });
  };

  const openLockUnlockModal = (staff: StaffMember) => {
    const isLocked = staff.status === 'LOCKED';
    const nextStatusLabel = isLocked
      ? staff.hasActivatedBefore
        ? 'Đang hoạt động (ACTIVE)'
        : 'Chờ kích hoạt (INVITED — cần gửi mã kích hoạt mới)'
      : 'Đã khóa (LOCKED)';

    openConfirmModal({
      title: isLocked ? `Mở khóa tài khoản ${staff.staffCode}?` : `Khóa tài khoản ${staff.staffCode}?`,
      description: isLocked
        ? `Nhân viên ${staff.fullName} sẽ chuyển từ Đã khóa sang ${nextStatusLabel}. Thao tác sẽ được ghi nhận vào nhật ký.`
        : `Nhân viên ${staff.fullName} sẽ chuyển sang ${nextStatusLabel}. Toàn bộ phiên đăng nhập và mã kích hoạt cũ sẽ bị vô hiệu ngay lập tức; lịch sử vận hành vẫn được giữ nguyên.`,
      confirmLabel: isLocked ? 'Mở khóa tài khoản' : 'Khóa tài khoản',
      destructive: !isLocked,
      requireReason: true,
      reasonLabel: isLocked ? 'Lý do mở khóa (5 – 500 ký tự)' : 'Lý do khóa tài khoản (5 – 500 ký tự)',
      onConfirm: async (reason) => {
        await staffService.lockOrUnlockStaff(staff.id, {
          action: isLocked ? 'UNLOCK' : 'LOCK',
          reason,
          expectedUpdatedAt: staff.updatedAt,
        });
        showToast(isLocked ? `Đã mở khóa tài khoản ${staff.staffCode}.` : `Đã khóa tài khoản ${staff.staffCode}.`, 'success');
        await load();
      },
    });
  };

  const load = async () => {
    clearTimer();
    root.innerHTML = renderLoadingSkeleton(2);
    try {
      const staff = await staffService.getStaffDetail(staffId);
      const otpState = staff.status === 'INVITED' ? await authService.getOtpState(staff.email, 'STAFF_ACTIVATION') : null;

      root.innerHTML = `
        <div class="flex flex-col gap-space-6">
          <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-space-4">
            <div class="flex flex-col gap-space-2">
              <a href="/quan-tri/nhan-vien" class="tl-back-btn self-start">
                <span class="tl-back-icon" aria-hidden="true">
                  <span class="material-symbols-outlined text-[16px]">arrow_back</span>
                </span>
                <span>Về danh sách nhân viên</span>
              </a>
              <div class="flex flex-wrap items-center gap-space-3">
                <h1 class="font-headline text-headline-lg text-on-surface">${escapeHtml(staff.fullName)}</h1>
                <span class="px-space-3 py-space-1 rounded-full bg-primary-light text-primary font-label text-label-sm tabular-nums">${escapeHtml(staff.staffCode)}</span>
                ${renderStaffStatusBadge(staff.status)}
              </div>
            </div>

            <div class="flex flex-wrap items-center gap-space-2">
              <button type="button" id="openA15Btn" class="inline-flex items-center gap-space-2 min-h-[44px] px-space-4 rounded border border-primary text-primary hover:bg-primary-light font-label text-label-md">
                <span class="material-symbols-outlined text-[18px]">admin_panel_settings</span>
                <span>Phân quyền</span>
              </button>
              <button type="button" id="openA16Btn" class="inline-flex items-center gap-space-2 min-h-[44px] px-space-4 rounded border ${
                staff.status === 'LOCKED'
                  ? 'border-primary bg-primary text-on-primary hover:bg-primary-hover'
                  : 'border-error text-error hover:bg-error-bg'
              } font-label text-label-md">
                <span class="material-symbols-outlined text-[18px]">${staff.status === 'LOCKED' ? 'lock_open' : 'lock'}</span>
                <span>${staff.status === 'LOCKED' ? 'Mở khóa tài khoản' : 'Khóa tài khoản'}</span>
              </button>
              <a href="/quan-tri/nhat-ky?targetId=${encodeURIComponent(staff.id)}" class="inline-flex items-center gap-space-2 min-h-[44px] px-space-4 rounded border border-border bg-surface text-on-surface hover:bg-surface-muted font-label text-label-md">
                <span class="material-symbols-outlined text-[18px]">history</span>
                <span>Xem nhật ký</span>
              </a>
            </div>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-12 gap-space-6 items-start">
            <div class="lg:col-span-8 flex flex-col gap-space-6">
              <!-- Trạng thái gửi email kích hoạt (CHỈ hiện nút gửi lại khi INVITED) -->
              ${
                staff.status === 'INVITED'
                  ? `
                    <section class="bg-surface border border-border rounded-xl p-space-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-space-4">
                      <div class="flex items-start gap-space-3">
                        <span class="w-10 h-10 rounded-md ${
                          staff.emailDeliveryStatus === 'FAILED' ? 'bg-error-bg text-on-error-bg' : 'bg-warning-bg text-on-warning-bg'
                        } flex items-center justify-center shrink-0">
                          <span class="material-symbols-outlined text-[22px]">mark_email_unread</span>
                        </span>
                        <div class="flex flex-col gap-1">
                          <h2 class="font-title text-title-md text-on-surface">Trạng thái thư kích hoạt</h2>
                          <p class="font-body text-body-md text-text-secondary">${escapeHtml(staff.emailDeliveryMessage)}</p>
                          <p id="a14ResendCountdown" class="font-label text-label-sm text-primary tabular-nums"></p>
                        </div>
                      </div>
                      <button type="button" id="a14ResendBtn" class="min-h-[44px] px-space-4 rounded border border-primary text-primary hover:bg-primary-light disabled:opacity-50 disabled:cursor-not-allowed font-label text-label-md shrink-0">
                        Gửi lại mã kích hoạt
                      </button>
                    </section>
                  `
                  : ''
              }

              <!-- Form cập nhật thông tin -->
              <form id="a14UpdateForm" novalidate class="bg-surface border border-border rounded-xl p-space-6 shadow-sm flex flex-col gap-space-4">
                <h2 class="font-headline text-headline-md text-on-surface">Thông tin nhân viên</h2>
                <div id="a14Alert" role="alert" class="hidden p-space-3 rounded bg-error-bg text-on-error-bg font-body text-body-md"></div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-space-4">
                  <label class="flex flex-col gap-space-1">
                    <span class="font-label text-label-md text-on-surface">Mã nhân viên (chỉ đọc)</span>
                    <input type="text" value="${escapeHtml(staff.staffCode)}" readonly class="min-h-[44px] px-space-4 rounded bg-surface-muted border border-border text-text-secondary tabular-nums" />
                  </label>
                  <label class="flex flex-col gap-space-1">
                    <span class="font-label text-label-md text-on-surface">Email (chỉ đọc)</span>
                    <input type="email" value="${escapeHtml(staff.email)}" readonly class="min-h-[44px] px-space-4 rounded bg-surface-muted border border-border text-text-secondary" />
                  </label>
                  <label class="flex flex-col gap-space-1">
                    <span class="font-label text-label-md text-on-surface">Họ và tên <span class="text-error">*</span></span>
                    <input id="a14Name" type="text" value="${escapeHtml(staff.fullName)}" class="min-h-[44px] px-space-4 rounded border border-border bg-surface text-body-md" />
                  </label>
                  <label class="flex flex-col gap-space-1">
                    <span class="font-label text-label-md text-on-surface">Số điện thoại</span>
                    <input id="a14Phone" type="tel" maxlength="20" value="${escapeHtml(staff.phone)}" class="min-h-[44px] px-space-4 rounded border border-border bg-surface text-body-md tabular-nums" />
                  </label>
                </div>
                <label class="flex flex-col gap-space-1">
                  <span class="font-label text-label-md text-on-surface">Ghi chú</span>
                  <textarea id="a14Notes" rows="3" maxlength="1000" class="w-full p-space-3 rounded border border-border bg-surface text-body-md">${escapeHtml(staff.notes)}</textarea>
                </label>
                <div class="flex justify-end pt-space-2">
                  <button type="submit" id="a14SaveBtn" class="min-h-[44px] px-space-6 rounded bg-primary text-on-primary hover:bg-primary-hover font-label text-label-md">Lưu thay đổi</button>
                </div>
              </form>
            </div>

            <!-- Right column -->
            <aside class="lg:col-span-4 flex flex-col gap-space-6">
              <section class="bg-surface border border-border rounded-xl p-space-6 shadow-sm flex flex-col gap-space-4">
                <div class="flex items-center justify-between">
                  <h2 class="font-headline text-headline-md text-on-surface">Nhóm quyền hiện tại</h2>
                  <button type="button" id="sideA15Btn" class="font-label text-label-sm text-primary hover:underline">Sửa quyền</button>
                </div>
                <div class="flex flex-wrap gap-space-2">
                  ${
                    staff.permissions.length === 0
                      ? `<p class="font-body text-body-md text-text-secondary">Chưa được gán nhóm quyền nào.</p>`
                      : staff.permissions
                          .map(
                            (p) =>
                              `<span class="px-space-3 py-space-1 rounded-full bg-primary-light text-primary font-label text-label-sm">${escapeHtml(permLabel(p))}</span>`,
                          )
                          .join('')
                  }
                </div>
              </section>

              <section class="bg-surface border border-border rounded-xl p-space-6 shadow-sm flex flex-col gap-space-3 font-body text-body-md">
                <h2 class="font-headline text-headline-md text-on-surface">Thông tin tài khoản</h2>
                <div class="flex justify-between gap-space-2">
                  <span class="text-text-secondary">Ngày tạo</span>
                  <span class="font-label text-label-sm text-on-surface tabular-nums">${formatDateTimeVi(staff.createdAt)}</span>
                </div>
                <div class="flex justify-between gap-space-2">
                  <span class="text-text-secondary">Người tạo</span>
                  <span class="font-label text-label-sm text-on-surface text-right">${escapeHtml(staff.createdBy)}</span>
                </div>
                <div class="flex justify-between gap-space-2">
                  <span class="text-text-secondary">Đã từng kích hoạt</span>
                  <span class="font-label text-label-sm text-on-surface">${staff.hasActivatedBefore ? 'Có' : 'Chưa'}</span>
                </div>
                <div class="flex justify-between gap-space-2">
                  <span class="text-text-secondary">Đăng nhập cuối</span>
                  <span class="font-label text-label-sm text-text-secondary tabular-nums">${staff.lastLoginAt ? formatDateTimeVi(staff.lastLoginAt) : 'Chưa đăng nhập'}</span>
                </div>
              </section>
            </aside>
          </div>
        </div>
      `;

      root.querySelector('#openA15Btn')?.addEventListener('click', () => openPermissionModal(staff));
      root.querySelector('#sideA15Btn')?.addEventListener('click', () => openPermissionModal(staff));
      root.querySelector('#openA16Btn')?.addEventListener('click', () => openLockUnlockModal(staff));

      // Resend activation countdown & button
      if (staff.status === 'INVITED' && otpState) {
        const resendBtn = root.querySelector<HTMLButtonElement>('#a14ResendBtn');
        const cdEl = root.querySelector<HTMLElement>('#a14ResendCountdown');
        const updateResendUi = () => {
          const lockSec = secondsRemaining(otpState.burstLockedUntil);
          const waitSec = secondsRemaining(otpState.resendAvailableAt);
          if (lockSec > 0) {
            if (cdEl) cdEl.textContent = `Đã đạt giới hạn 5 lần gửi. Thử lại sau ${formatCountdownMmSs(lockSec)}.`;
            if (resendBtn) resendBtn.disabled = true;
          } else if (waitSec > 0) {
            if (cdEl) cdEl.textContent = `Gửi lại khả dụng sau ${formatCountdownMmSs(waitSec)}.`;
            if (resendBtn) resendBtn.disabled = true;
          } else {
            if (cdEl) cdEl.textContent = `Đã gửi ${otpState.sendsUsedInBurst}/${otpState.maxSendsPerBurst} lần trong đợt.`;
            if (resendBtn) resendBtn.disabled = false;
          }
        };
        updateResendUi();
        resendTimer = window.setInterval(updateResendUi, 1000);

        resendBtn?.addEventListener('click', async () => {
          if (resendBtn.disabled) return;
          resendBtn.disabled = true;
          resendBtn.textContent = 'Đang gửi...';
          try {
            await staffService.resendStaffActivation(staff.id);
            showToast(`Đã gửi lại mã kích hoạt tới ${staff.email} (không tạo tài khoản trùng).`, 'success');
            await load();
          } catch (err) {
            showToast(toUserErrorMessage(err), 'error');
            await load();
          }
        });
      }

      // Save staff info form
      root.querySelector<HTMLFormElement>('#a14UpdateForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = root.querySelector<HTMLButtonElement>('#a14SaveBtn');
        const alertEl = root.querySelector<HTMLElement>('#a14Alert');
        if (!btn || btn.disabled) return;
        alertEl?.classList.add('hidden');
        btn.disabled = true;
        btn.textContent = 'Đang lưu...';
        try {
          await staffService.updateStaff(staff.id, {
            fullName: root.querySelector<HTMLInputElement>('#a14Name')?.value.trim() ?? '',
            phone: root.querySelector<HTMLInputElement>('#a14Phone')?.value.trim() ?? '',
            notes: root.querySelector<HTMLTextAreaElement>('#a14Notes')?.value.trim() ?? '',
            expectedUpdatedAt: staff.updatedAt,
          });
          showToast('Đã lưu cập nhật thông tin nhân viên.', 'success');
          await load();
        } catch (err) {
          if (alertEl) {
            alertEl.textContent = toUserErrorMessage(err);
            alertEl.classList.remove('hidden');
          }
          btn.disabled = false;
          btn.textContent = 'Lưu thay đổi';
        }
      });
    } catch (err) {
      if (isAppError(err) && (err.code === 'NOT_FOUND' || err.code === 'FORBIDDEN')) {
        renderErrorPage(ctx, { code: err.code === 'FORBIDDEN' ? '403' : '404', description: err.message });
        return;
      }
      root.innerHTML = renderErrorBanner(toUserErrorMessage(err), 'retryA14');
      root.querySelector('#retryA14')?.addEventListener('click', () => void load());
    }
  };

  await load();
}
