import { STAFF_PERMISSION_GROUPS, type StaffPermissionCode } from '@/config/constants';
import { escapeHtml } from '@/shared/utils/dom';

export function renderPermissionMatrix(selected: StaffPermissionCode[], name = 'permissions'): string {
  return `
    <div class="flex flex-col gap-space-3">
      ${STAFF_PERMISSION_GROUPS.map((group) => {
        const checked = selected.includes(group.code);
        return `
          <label class="flex items-start gap-space-3 p-space-4 rounded-lg border ${
            checked ? 'border-primary bg-primary-light/50' : 'border-border bg-surface'
          } hover:border-primary cursor-pointer transition-colors">
            <input
              type="checkbox"
              name="${escapeHtml(name)}"
              value="${escapeHtml(group.code)}"
              ${checked ? 'checked' : ''}
              class="mt-1 h-5 w-5 rounded border-border text-primary focus:ring-primary"
            />
            <div class="flex-1 min-w-0">
              <div class="flex flex-wrap items-center gap-space-2">
                <span class="font-label text-label-md text-on-surface">${escapeHtml(group.label)}</span>
                ${
                  group.code === 'STAFF_PAYMENT_VIEW'
                    ? `<span class="px-space-2 py-0.5 rounded-full bg-info-bg text-on-info-bg font-label text-label-sm">Chỉ đọc</span>`
                    : ''
                }
              </div>
              <p class="font-body text-body-md text-text-secondary mt-0.5">${escapeHtml(group.description)}</p>
              <div class="flex flex-wrap gap-space-1 mt-space-2">
                ${group.capabilities
                  .map(
                    (cap) =>
                      `<span class="px-space-2 py-0.5 rounded bg-surface-muted text-text-secondary font-label text-label-sm">${escapeHtml(cap)}</span>`,
                  )
                  .join('')}
              </div>
            </div>
          </label>
        `;
      }).join('')}
      <p class="font-body text-body-md text-text-secondary">
        Lưu ý: Hệ thống không cho phép cấp quyền Quản trị viên, quản lý nhân sự, quản lý danh mục hoặc quyền quyết định đối soát thanh toán cho tài khoản nhân viên.
      </p>
    </div>
  `;
}

export function readSelectedPermissions(root: ParentNode, name = 'permissions'): StaffPermissionCode[] {
  return Array.from(root.querySelectorAll<HTMLInputElement>(`input[name="${name}"]:checked`)).map(
    (el) => el.value as StaffPermissionCode,
  );
}
