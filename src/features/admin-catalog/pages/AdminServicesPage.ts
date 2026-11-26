import type { RouteContext } from '@/app/router';
import { toUserErrorMessage } from '@/api/errors';
import type { ActiveStatus } from '@/api/contracts';
import { adminCatalogService } from '@/features/admin-catalog/admin-catalog.service';
import { servicesService } from '@/features/services/services.service';
import { renderBackofficeShell } from '@/layouts/backoffice/BackofficeShell';
import { renderEmptyState, renderErrorBanner, renderTableSkeleton } from '@/shared/components/EmptyErrorState';
import { openConfirmModal } from '@/shared/components/Modal';
import { renderPagination } from '@/shared/components/Pagination';
import { renderActiveStatusBadge } from '@/shared/components/StatusBadge';
import { showToast } from '@/shared/components/Toast';
import { beginAsyncRender, escapeHtml, finishAsyncRender } from '@/shared/utils/dom';
import { formatVnd } from '@/shared/utils/format';

export async function renderAdminServicesPage(ctx: RouteContext): Promise<void> {
  let query = '';
  let status: ActiveStatus | 'ALL' = 'ALL';
  let page = 1;

  const main = renderBackofficeShell({
    container: ctx.container,
    activeNav: 'services',
    breadcrumbs: [{ label: 'Quản trị', href: '/quan-tri' }, { label: 'Dịch vụ' }],
    contentHtml: `
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-space-4">
        <div>
          <h1 class="font-headline text-headline-lg text-on-surface">Quản lý dịch vụ du lịch</h1>
          <p class="font-body text-body-md text-text-secondary">Thay đổi giá dịch vụ chỉ áp dụng cho đơn mới; giá chụp của các booking đã tạo giữ nguyên.</p>
        </div>
        <a href="/quan-tri/dich-vu/them" class="inline-flex items-center justify-center gap-space-2 min-h-[44px] px-space-6 rounded bg-primary text-on-primary hover:bg-primary-hover font-label text-label-md">
          <span class="material-symbols-outlined text-[20px]">add</span>
          <span>Thêm dịch vụ</span>
        </a>
      </div>

      <form id="a05FilterForm" class="bg-surface border border-border rounded-xl shadow-sm p-4 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
        <div class="sm:col-span-7 relative flex items-center">
          <span class="material-symbols-outlined text-[20px] text-text-secondary absolute left-3.5 pointer-events-none" aria-hidden="true">search</span>
          <input id="a05Q" type="search" placeholder="Tìm mã, tên dịch vụ hoặc địa điểm..." class="w-full min-h-[44px] pl-10 pr-4 rounded-xl border border-border bg-surface text-body-md focus:border-primary focus:ring-2 focus:ring-primary/20" />
        </div>
        <select id="a05Status" class="sm:col-span-3 min-h-[44px] px-space-3 rounded-xl border border-border bg-surface text-body-md">
          <option value="ALL">Tất cả trạng thái</option>
          <option value="ACTIVE">Đang hoạt động</option>
          <option value="HIDDEN">Đã ẩn</option>
        </select>
        <button type="submit" class="sm:col-span-2 min-h-[44px] px-4 rounded-xl bg-primary text-on-primary hover:bg-primary-hover font-label text-label-md shadow-sm">Lọc</button>
      </form>

      <div id="a05Table">${renderTableSkeleton(4)}</div>
      <div id="a05Pag"></div>
    `,
  });

  const load = async () => {
    const wrap = main.querySelector<HTMLElement>('#a05Table')!;
    const pag = main.querySelector<HTMLElement>('#a05Pag')!;
    beginAsyncRender(wrap, renderTableSkeleton(4));
    pag.innerHTML = '';

    try {
      const res = await servicesService.listServices({ query, status, includeHidden: true, page, pageSize: 10 });
      if (res.items.length === 0) {
        finishAsyncRender(
          wrap,
          renderEmptyState({
            icon: 'confirmation_number',
            title: 'Không có dịch vụ phù hợp',
            description: 'Thử điều chỉnh từ khóa lọc hoặc thêm dịch vụ mới.',
            actionHref: '/quan-tri/dich-vu/them',
            actionLabel: 'Thêm dịch vụ',
          }),
        );
        return;
      }

      finishAsyncRender(
        wrap,
        `<div class="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
          <div class="table-scroll-wrap">
            <table class="w-full text-left border-collapse min-w-[820px]">
              <thead class="bg-surface-muted border-b border-border font-label text-label-sm text-text-secondary">
                <tr>
                  <th class="px-space-4 py-space-3">Dịch vụ</th>
                  <th class="px-space-4 py-space-3">Địa điểm</th>
                  <th class="px-space-4 py-space-3">Loại</th>
                  <th class="px-space-4 py-space-3">Đơn giá / người</th>
                  <th class="px-space-4 py-space-3">Sức chứa tối đa / ngày</th>
                  <th class="px-space-4 py-space-3">Trạng thái</th>
                  <th class="px-space-4 py-space-3 text-right">Hành động</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border font-body text-body-md">
                ${res.items
                  .map(
                    (s) => `
                  <tr class="hover:bg-background">
                    <td class="px-space-4 py-space-3">
                      <p class="font-label text-on-surface">${escapeHtml(s.name)}</p>
                      <p class="text-label-sm text-primary tabular-nums">${escapeHtml(s.id)}</p>
                    </td>
                    <td class="px-space-4 py-space-3">
                      <span>${escapeHtml(s.destinationName)}</span>
                      ${s.destinationHidden || s.categoryHidden ? `<p class="text-label-sm text-warning">Địa điểm/danh mục cha đang ẩn → ngừng nhận đặt</p>` : ''}
                    </td>
                    <td class="px-space-4 py-space-3">${escapeHtml(s.serviceType)}</td>
                    <td class="px-space-4 py-space-3 font-label text-primary tabular-nums">${formatVnd(s.pricePerGuestVnd)}</td>
                    <td class="px-space-4 py-space-3 tabular-nums">${s.maxDailyCapacity} khách/ngày</td>
                    <td class="px-space-4 py-space-3">${renderActiveStatusBadge(s.status)}</td>
                    <td class="px-space-4 py-space-3 text-right">
                      <div class="inline-flex items-center gap-space-2">
                        <a href="/quan-tri/dich-vu/${encodeURIComponent(s.id)}/sua" class="min-h-[40px] px-space-3 rounded border border-border bg-surface text-on-surface hover:bg-surface-muted font-label text-label-sm inline-flex items-center">Sửa</a>
                        <button type="button" data-toggle-svc="${escapeHtml(s.id)}" data-next-status="${s.status === 'ACTIVE' ? 'HIDDEN' : 'ACTIVE'}" class="min-h-[40px] px-space-3 rounded border ${
                          s.status === 'ACTIVE' ? 'border-error/40 text-error hover:bg-error-bg' : 'border-primary text-primary hover:bg-primary-light'
                        } font-label text-label-sm">
                          ${s.status === 'ACTIVE' ? 'Ẩn' : 'Kích hoạt'}
                        </button>
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

      wrap.querySelectorAll<HTMLButtonElement>('[data-toggle-svc]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.toggleSvc!;
          const nextStatus = btn.dataset.nextStatus as ActiveStatus;
          openConfirmModal({
            title: nextStatus === 'HIDDEN' ? `Ẩn dịch vụ ${id}?` : `Kích hoạt dịch vụ ${id}?`,
            description:
              nextStatus === 'HIDDEN'
                ? 'Dịch vụ sẽ ngừng nhận đơn đặt mới. Các đơn đã tạo trước đó vẫn được giữ nguyên.'
                : 'Dịch vụ sẽ mở đặt lại nếu địa điểm và danh mục cha đang hoạt động.',
            confirmLabel: nextStatus === 'HIDDEN' ? 'Ẩn dịch vụ' : 'Kích hoạt',
            destructive: nextStatus === 'HIDDEN',
            onConfirm: async () => {
              await adminCatalogService.toggleServiceStatus(id, nextStatus);
              showToast(`Đã cập nhật trạng thái dịch vụ ${id}.`, 'success');
              await load();
            },
          });
        });
      });

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
      finishAsyncRender(wrap, renderErrorBanner(toUserErrorMessage(err), 'retryA05'));
      wrap.querySelector('#retryA05')?.addEventListener('click', () => void load());
    }
  };

  const applyA05Filters = () => {
    query = main.querySelector<HTMLInputElement>('#a05Q')?.value.trim() ?? '';
    status = (main.querySelector<HTMLSelectElement>('#a05Status')?.value ?? 'ALL') as ActiveStatus | 'ALL';
    page = 1;
    void load();
  };

  main.querySelector<HTMLFormElement>('#a05FilterForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    applyA05Filters();
  });
  main.querySelector('#a05Status')?.addEventListener('change', applyA05Filters);

  await load();
}
