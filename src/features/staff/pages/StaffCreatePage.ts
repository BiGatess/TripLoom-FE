import type { RouteContext } from '@/app/router';
import { isAppError, toUserErrorMessage } from '@/api/errors';
import { staffService } from '@/features/staff/staff.service';
import { renderBackofficeShell } from '@/layouts/backoffice/BackofficeShell';
import { readSelectedPermissions, renderPermissionMatrix } from '@/shared/components/PermissionMatrix';
import { showToast } from '@/shared/components/Toast';

export function renderStaffCreatePage(ctx: RouteContext): void {
  const main = renderBackofficeShell({
    container: ctx.container,
    activeNav: 'staff',
    breadcrumbs: [
      { label: 'Quản trị', href: '/quan-tri' },
      { label: 'Nhân viên', href: '/quan-tri/nhan-vien' },
      { label: 'Thêm nhân viên' },
    ],
    contentHtml: `
      <div class="flex flex-col gap-space-6 max-w-4xl">
        <div class="flex items-center justify-between gap-space-4">
          <div>
            <h1 class="font-headline text-headline-lg text-on-surface">Thêm nhân viên mới</h1>
            <p class="font-body text-body-md text-text-secondary">Tài khoản tạo mới sẽ ở trạng thái Chờ kích hoạt (INVITED) và gửi mã kích hoạt qua email để nhân viên tự đặt mật khẩu.</p>
          </div>
          <a href="/quan-tri/nhan-vien" class="tl-back-btn shrink-0">
            <span class="tl-back-icon" aria-hidden="true">
              <span class="material-symbols-outlined text-[16px]">arrow_back</span>
            </span>
            <span>Quay lại</span>
          </a>
        </div>

        <div id="a13Alert" role="alert" class="hidden p-space-4 rounded-lg bg-error-bg text-on-error-bg font-body text-body-md"></div>

        <form id="a13Form" novalidate class="flex flex-col gap-space-6">
          <section class="bg-surface border border-border rounded-xl p-space-6 shadow-sm flex flex-col gap-space-4">
            <h2 class="font-headline text-headline-md text-on-surface">Thông tin định danh (Mã &amp; Email không thể sửa sau khi tạo)</h2>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-space-4">
              <label class="flex flex-col gap-space-1">
                <span class="font-label text-label-md text-on-surface">Mã nhân viên (3 – 30 ký tự, tự chuẩn hóa chữ hoa) <span class="text-error">*</span></span>
                <input id="a13Code" type="text" placeholder="Ví dụ: NV005" class="w-full min-h-[44px] px-space-4 rounded border border-border bg-surface text-body-md uppercase tabular-nums" />
                <span data-err="staffCode" class="hidden text-body-md text-error"></span>
              </label>

              <label class="flex flex-col gap-space-1">
                <span class="font-label text-label-md text-on-surface">Họ và tên (2 – 150 ký tự) <span class="text-error">*</span></span>
                <input id="a13Name" type="text" placeholder="Ví dụ: Võ Minh Tuấn" class="w-full min-h-[44px] px-space-4 rounded border border-border bg-surface text-body-md" />
                <span data-err="fullName" class="hidden text-body-md text-error"></span>
              </label>

              <label class="flex flex-col gap-space-1">
                <span class="font-label text-label-md text-on-surface">Email công vụ <span class="text-error">*</span></span>
                <input id="a13Email" type="email" placeholder="tuan.vo@triploom.vn" class="w-full min-h-[44px] px-space-4 rounded border border-border bg-surface text-body-md" />
                <span data-err="email" class="hidden text-body-md text-error"></span>
              </label>

              <label class="flex flex-col gap-space-1">
                <span class="font-label text-label-md text-on-surface">Số điện thoại (tùy chọn, tối đa 20 ký tự)</span>
                <input id="a13Phone" type="tel" maxlength="20" placeholder="0915 000 111" class="w-full min-h-[44px] px-space-4 rounded border border-border bg-surface text-body-md tabular-nums" />
                <span data-err="phone" class="hidden text-body-md text-error"></span>
              </label>
            </div>

            <label class="flex flex-col gap-space-1">
              <span class="font-label text-label-md text-on-surface">Ghi chú nhân sự (tối đa 1.000 ký tự)</span>
              <textarea id="a13Notes" rows="2" maxlength="1000" placeholder="Ca làm việc hoặc phạm vi phụ trách..." class="w-full p-space-3 rounded border border-border bg-surface text-body-md"></textarea>
              <span data-err="notes" class="hidden text-body-md text-error"></span>
            </label>

            <p class="p-space-3 rounded-lg bg-info-bg/70 text-on-info-bg font-body text-label-sm">
              Không có ô đặt mật khẩu tại đây. Nhân viên sẽ nhận mã 6 chữ số qua email và tự thiết lập mật khẩu tại trang Kích hoạt tài khoản nhân viên.
            </p>
          </section>

          <section class="bg-surface border border-border rounded-xl p-space-6 shadow-sm flex flex-col gap-space-4">
            <h2 class="font-headline text-headline-md text-on-surface">Gán nhóm quyền nghiệp vụ</h2>
            <span data-err="permissions" class="hidden text-body-md text-error"></span>
            ${renderPermissionMatrix([], 'a13Perms')}
          </section>

          <div class="flex justify-end gap-space-3">
            <a href="/quan-tri/nhan-vien" class="min-h-[44px] px-space-4 rounded border border-border bg-surface text-on-surface hover:bg-surface-muted font-label text-label-md inline-flex items-center">Hủy</a>
            <button type="submit" id="a13SubmitBtn" class="min-h-[44px] px-space-6 rounded bg-primary text-on-primary hover:bg-primary-hover font-label text-label-lg">Tạo nhân viên &amp; gửi mã kích hoạt</button>
          </div>
        </form>
      </div>
    `,
  });

  main.querySelector<HTMLFormElement>('#a13Form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = main.querySelector<HTMLButtonElement>('#a13SubmitBtn');
    const alertEl = main.querySelector<HTMLElement>('#a13Alert');
    if (!btn || btn.disabled) return;

    alertEl?.classList.add('hidden');
    main.querySelectorAll('[data-err]').forEach((el) => el.classList.add('hidden'));

    const staffCode = (main.querySelector<HTMLInputElement>('#a13Code')?.value ?? '').trim().toUpperCase();
    const fullName = main.querySelector<HTMLInputElement>('#a13Name')?.value.trim() ?? '';
    const email = main.querySelector<HTMLInputElement>('#a13Email')?.value.trim() ?? '';
    const phone = main.querySelector<HTMLInputElement>('#a13Phone')?.value.trim() ?? '';
    const notes = main.querySelector<HTMLTextAreaElement>('#a13Notes')?.value.trim() ?? '';
    const permissions = readSelectedPermissions(main, 'a13Perms');

    btn.disabled = true;
    btn.textContent = 'Đang tạo nhân viên...';
    try {
      const { staff } = await staffService.createStaff({
        staffCode,
        fullName,
        email,
        phone,
        notes,
        permissions,
      });
      if (staff.emailDeliveryStatus === 'FAILED') {
        showToast(
          `Đã tạo nhân viên ${staff.staffCode} (Chờ kích hoạt), nhưng gửi email lỗi. Bạn có thể bấm Gửi lại mã tại trang chi tiết.`,
          'warning',
        );
      } else {
        showToast(`Đã tạo nhân viên ${staff.staffCode} và gửi mã kích hoạt tới ${staff.email}.`, 'success');
      }
      ctx.navigate(`/quan-tri/nhan-vien/${encodeURIComponent(staff.id)}`);
    } catch (err) {
      if (isAppError(err)) {
        Object.entries(err.fieldErrors).forEach(([k, v]) => {
          const el = main.querySelector<HTMLElement>(`[data-err="${k}"]`);
          if (el) {
            el.textContent = v;
            el.classList.remove('hidden');
          }
        });
      }
      if (alertEl) {
        alertEl.textContent = toUserErrorMessage(err);
        alertEl.classList.remove('hidden');
      }
      btn.disabled = false;
      btn.textContent = 'Tạo nhân viên & gửi mã kích hoạt';
    }
  });
}
