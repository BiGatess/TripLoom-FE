import type { RouteContext } from '@/app/router';
import { toUserErrorMessage } from '@/api/errors';
import type { StaffAccountStatus } from '@/api/contracts';
import { STAFF_PERMISSION_GROUPS, type StaffPermissionCode } from '@/config/constants';
import { staffService } from '@/features/staff/staff.service';
import { renderBackofficeShell } from '@/layouts/backoffice/BackofficeShell';
import { renderEmptyState, renderErrorBanner, renderTableSkeleton } from '@/shared/components/EmptyErrorState';
import { renderPagination } from '@/shared/components/Pagination';
import { renderStaffStatusBadge } from '@/shared/components/StatusBadge';
import { beginAsyncRender, escapeHtml, finishAsyncRender } from '@/shared/utils/dom';
import { formatDateVi } from '@/shared/utils/format';

function permLabel(code: StaffPermissionCode): string {
  return STAFF_PERMISSION_GROUPS.find((g) => g.code === code)?.label ?? code;
}

export async function renderStaffListPage(ctx: RouteContext): Promise<void> {
  let query = '';
  let status: StaffAccountStatus | 'ALL' = 'ALL';
  let permission: StaffPermissionCode | 'ALL' = 'ALL';
  let page = 1;

  const main = renderBackofficeShell({
    container: ctx.container,
    activeNav: 'staff',
    breadcrumbs: [{ label: 'Quản trị', href: '/quan-tri' }, { label: 'Nhân viên' }],
    contentHtml: `
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-space-4">
        <div>
          <h1 class="font-headline text-headline-lg text-on-surface">Quản lý nhân viên</h1>
          <p class="font-body text-body-md text-text-secondary">Quản trị tài khoản nhân viên vận hành, nhóm quyền nghiệp vụ và trạng thái kích hoạt. Chỉ Quản trị viên được truy cập.</p>
        </div>
        <a href="/quan-tri/nhan-vien/them" class="inline-flex items-center justify-center gap-space-2 min-h-[44px] px-space-6 rounded bg-primary text-on-primary hover:bg-primary-hover font-label text-label-md">
          <span class="material-symbols-outlined text-[20px]">person_add</span>
          <span>Thêm nhân viên</span>
        </a>
      </div>

      <form id="a12FilterForm" class="bg-surface border border-border rounded-xl shadow-sm p-4 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
        <div class="sm:col-span-4 relative flex items-center">
          <span class="material-symbols-outlined text-[20px] text-text-secondary absolute left-3.5 pointer-events-none" aria-hidden="true">search</span>
          <input id="a12Q" type="search" placeholder="Tìm mã nhân viên, họ tên hoặc email..." class="w-full min-h-[44px] pl-10 pr-3 rounded-xl border border-border bg-surface text-body-md focus:border-primary focus:ring-2 focus:ring-primary/20" />
        </div>
        <select id="a12Status" class="sm:col-span-3 min-h-[44px] px-space-3 rounded-xl border border-border bg-surface text-body-md">
          <option value="ALL">Mọi trạng thái</option>
          <option value="INVITED">Chờ kích hoạt</option>
          <option value="ACTIVE">Đang hoạt động</option>
          <option value="LOCKED">Đã khóa</option>
        </select>
        <select id="a12Perm" class="sm:col-span-3 min-h-[44px] px-space-3 rounded-xl border border-border bg-surface text-body-md">
          <option value="ALL">Mọi nhóm quyền</option>
          ${STAFF_PERMISSION_GROUPS.map((g) => `<option value="${g.code}">${escapeHtml(g.label)}</option>`).join('')}
        </select>
        <button type="submit" class="sm:col-span-2 min-h-[44px] px-4 rounded-xl bg-primary text-on-primary hover:bg-primary-hover font-label text-label-md shadow-sm">Lọc</button>
      </form>

      <div id="a12Table">${renderTableSkeleton(4)}</div>
      <div id="a12Pag"></div>
    `,
  });

  const load = async () => {
    const wrap = main.querySelector<HTMLElement>('#a12Table')!;
    const pag = main.querySelector<HTMLElement>('#a12Pag')!;
    beginAsyncRender(wrap, renderTableSkeleton(4));
    pag.innerHTML = '';

    try {
      const res = await staffService.listStaff({ query, status, permission, page, pageSize: 10 });
      if (res.items.length === 0) {
        finishAsyncRender(
          wrap,
          renderEmptyState({
            icon: 'badge',
            title: 'Không có nhân viên phù hợp',
            description: 'Thử thay đổi bộ lọc hoặc tạo tài khoản nhân viên mới.',
            actionHref: '/quan-tri/nhan-vien/them',
            actionLabel: 'Thêm nhân viên',
          }),
        );
        return;
      }

      finishAsyncRender(
        wrap,
        `<div class="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
          <div class="table-scroll-wrap">
            <table class="w-full text-left border-collapse min-w-[900px]">
              <thead class="bg-surface-muted border-b border-border font-label text-label-sm text-text-secondary">
                <tr>
                  <th class="px-space-4 py-space-3">Mã NV</th>
                  <th class="px-space-4 py-space-3">Họ tên &amp; Email</th>
                  <th class="px-space-4 py-space-3">Nhóm quyền được cấp</th>
                  <th class="px-space-4 py-space-3">Trạng thái</th>
                  <th class="px-space-4 py-space-3">Ngày tạo</th>
                  <th class="px-space-4 py-space-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border font-body text-body-md">
                ${res.items
                  .map(
                    (s) => `
                  <tr class="hover:bg-background">
                    <td class="px-space-4 py-space-3 font-label text-primary tabular-nums">${escapeHtml(s.staffCode)}</td>
                    <td class="px-space-4 py-space-3">
                      <p class="font-label text-on-surface">${escapeHtml(s.fullName)}</p>
                      <p class="text-label-sm text-text-secondary">${escapeHtml(s.email)}</p>
                    </td>
                    <td class="px-space-4 py-space-3">
                      <div class="flex flex-wrap gap-1">
                        ${
                          s.permissions.length === 0
                            ? `<span class="text-label-sm text-text-secondary">Chưa gán quyền</span>`
                            : s.permissions
                                .map(
                                  (p) =>
                                    `<span class="px-space-2 py-0.5 rounded-full bg-primary-light text-primary font-label text-label-sm">${escapeHtml(permLabel(p))}</span>`,
                                )
                                .join('')
                        }
                      </div>
                    </td>
                    <td class="px-space-4 py-space-3">${renderStaffStatusBadge(s.status)}</td>
                    <td class="px-space-4 py-space-3 text-text-secondary tabular-nums">${formatDateVi(s.createdAt)}</td>
                    <td class="px-space-4 py-space-3 text-right">
                      <div class="inline-flex items-center gap-space-2">
                        <a href="/quan-tri/nhan-vien/${encodeURIComponent(s.id)}" class="min-h-[40px] px-space-3 rounded border border-primary text-primary hover:bg-primary-light font-label text-label-sm inline-flex items-center">Chi tiết</a>
                        <a href="/quan-tri/nhat-ky?targetId=${encodeURIComponent(s.id)}" class="min-h-[40px] px-space-3 rounded border border-border text-on-surface hover:bg-surface-muted font-label text-label-sm inline-flex items-center">Nhật ký</a>
                      </div>
                    </td>
                  </tr>
                `,
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        </div>`,
      );

      pag.innerHTML = renderPagination(res.page, res.totalPages, res.total);
      pag.querySelectorAll<HTMLButtonElement>('[data-page]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const next = Number(btn.dataset.page);
          if (next >= 1 && next <= res.totalPages && next !== page) {
            page = next;
            void load();
          }
        });
      });
    } catch (err) {
      finishAsyncRender(wrap, renderErrorBanner(toUserErrorMessage(err), 'retryA12'));
      wrap.querySelector('#retryA12')?.addEventListener('click', () => void load());
    }
  };

  const applyA12Filters = () => {
    query = main.querySelector<HTMLInputElement>('#a12Q')?.value.trim() ?? '';
    status = (main.querySelector<HTMLSelectElement>('#a12Status')?.value ?? 'ALL') as StaffAccountStatus | 'ALL';
    permission = (main.querySelector<HTMLSelectElement>('#a12Perm')?.value ?? 'ALL') as StaffPermissionCode | 'ALL';
    page = 1;
    void load();
  };

  main.querySelector<HTMLFormElement>('#a12FilterForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    applyA12Filters();
  });
  main.querySelectorAll('#a12Status, #a12Perm').forEach((sel) => {
    sel.addEventListener('change', applyA12Filters);
  });

  await load();
}
