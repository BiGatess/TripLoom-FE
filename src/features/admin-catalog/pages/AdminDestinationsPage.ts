import type { RouteContext } from '@/app/router';
import { toUserErrorMessage } from '@/api/errors';
import type { ActiveStatus, Category } from '@/api/contracts';
import { REGIONS } from '@/config/constants';
import { adminCatalogService } from '@/features/admin-catalog/admin-catalog.service';
import { destinationsService } from '@/features/destinations/destinations.service';
import { renderBackofficeShell } from '@/layouts/backoffice/BackofficeShell';
import { renderEmptyState, renderErrorBanner, renderTableSkeleton } from '@/shared/components/EmptyErrorState';
import { openConfirmModal } from '@/shared/components/Modal';
import { renderPagination } from '@/shared/components/Pagination';
import { renderActiveStatusBadge } from '@/shared/components/StatusBadge';
import { showToast } from '@/shared/components/Toast';
import { beginAsyncRender, bindImageFallbacks, escapeHtml, finishAsyncRender } from '@/shared/utils/dom';
import { formatDateVi, formatVnd } from '@/shared/utils/format';

export async function renderAdminDestinationsPage(ctx: RouteContext): Promise<void> {
  let query = '';
  let region = 'ALL';
  let categoryId = 'ALL';
  let status: ActiveStatus | 'ALL' = 'ALL';
  let page = 1;
  let categories: Category[] = [];

  const main = renderBackofficeShell({
    container: ctx.container,
    activeNav: 'destinations',
    breadcrumbs: [{ label: 'Quản trị', href: '/quan-tri' }, { label: 'Địa điểm' }],
    contentHtml: `
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-space-4">
        <div>
          <h1 class="font-headline text-headline-lg text-on-surface">Quản lý địa điểm</h1>
          <p class="font-body text-body-md text-text-secondary">Quản trị danh sách địa điểm nội bộ dùng cho tìm kiếm, gợi ý và lập lịch trình AI.</p>
        </div>
        <a href="/quan-tri/dia-diem/them" class="inline-flex items-center justify-center gap-space-2 min-h-[44px] px-space-6 rounded bg-primary text-on-primary hover:bg-primary-hover font-label text-label-md">
          <span class="material-symbols-outlined text-[20px]">add</span>
          <span>Thêm địa điểm</span>
        </a>
      </div>

      <form id="a03FilterForm" class="bg-surface border border-border rounded-xl shadow-sm p-4 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
        <div class="sm:col-span-4 relative flex items-center">
          <span class="material-symbols-outlined text-[20px] text-text-secondary absolute left-3.5 pointer-events-none" aria-hidden="true">search</span>
          <input id="a03Q" type="search" placeholder="Tìm mã hoặc tên địa điểm..." class="w-full min-h-[44px] pl-10 pr-3 rounded-xl border border-border bg-surface text-body-md focus:border-primary focus:ring-2 focus:ring-primary/20" />
        </div>
        <select id="a03Region" class="sm:col-span-2 min-h-[44px] px-space-3 rounded-xl border border-border bg-surface text-body-md">
          <option value="ALL">Mọi khu vực</option>
          ${REGIONS.map((r) => `<option value="${escapeHtml(r)}">${escapeHtml(r)}</option>`).join('')}
        </select>
        <select id="a03Cat" class="sm:col-span-3 min-h-[44px] px-space-3 rounded-xl border border-border bg-surface text-body-md">
          <option value="ALL">Mọi danh mục</option>
          ${categories.map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`).join('')}
        </select>
        <select id="a03Status" class="sm:col-span-2 min-h-[44px] px-space-3 rounded-xl border border-border bg-surface text-body-md">
          <option value="ALL">Mọi trạng thái</option>
          <option value="ACTIVE">Đang hoạt động</option>
          <option value="HIDDEN">Đã ẩn</option>
        </select>
        <button type="submit" class="sm:col-span-1 min-h-[44px] px-3 rounded-xl bg-primary text-on-primary hover:bg-primary-hover font-label text-label-md shadow-sm">Lọc</button>
      </form>

      <div id="a03Table">${renderTableSkeleton(5)}</div>
      <div id="a03Pag"></div>
    `,
  });

  const load = async () => {
    const wrap = main.querySelector<HTMLElement>('#a03Table')!;
    const pag = main.querySelector<HTMLElement>('#a03Pag')!;
    beginAsyncRender(wrap, renderTableSkeleton(5));
    pag.innerHTML = '';

    try {
      const res = await destinationsService.listDestinations({
        query,
        region,
        categoryId,
        status,
        includeHidden: true,
        page,
        pageSize: 8,
      });

      if (res.items.length === 0) {
        finishAsyncRender(
          wrap,
          renderEmptyState({
            icon: 'place',
            title: 'Không có địa điểm phù hợp',
            description: 'Thử điều chỉnh bộ lọc hoặc thêm địa điểm mới vào danh mục.',
            actionHref: '/quan-tri/dia-diem/them',
            actionLabel: 'Thêm địa điểm',
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
                  <th class="px-space-4 py-space-3">Địa điểm</th>
                  <th class="px-space-4 py-space-3">Khu vực</th>
                  <th class="px-space-4 py-space-3">Danh mục</th>
                  <th class="px-space-4 py-space-3">Giá</th>
                  <th class="px-space-4 py-space-3">Trạng thái</th>
                  <th class="px-space-4 py-space-3">Cập nhật</th>
                  <th class="px-space-4 py-space-3 text-right">Hành động</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border font-body text-body-md">
                ${res.items
                  .map(
                    (d) => `
                  <tr class="hover:bg-background">
                    <td class="px-space-4 py-space-3">
                      <div class="flex items-center gap-space-3">
                        <img src="${escapeHtml(d.imageUrl)}" alt="${escapeHtml(d.name)}" data-fallback-label="${escapeHtml(d.name)}" class="w-14 h-10 rounded object-cover border border-border shrink-0" />
                        <div class="min-w-0">
                          <p class="font-label text-on-surface truncate">${escapeHtml(d.name)}</p>
                          <p class="text-label-sm text-primary tabular-nums">${escapeHtml(d.id)}</p>
                        </div>
                      </div>
                    </td>
                    <td class="px-space-4 py-space-3">${escapeHtml(d.region)}</td>
                    <td class="px-space-4 py-space-3">
                      <span>${escapeHtml(d.categoryName)}</span>
                      ${d.categoryHidden ? `<p class="text-label-sm text-warning">Danh mục cha đang ẩn → không công khai</p>` : ''}
                    </td>
                    <td class="px-space-4 py-space-3 tabular-nums">${formatVnd(d.estimatedCostVnd)}</td>
                    <td class="px-space-4 py-space-3">${renderActiveStatusBadge(d.status)}</td>
                    <td class="px-space-4 py-space-3 text-text-secondary tabular-nums">${formatDateVi(d.updatedAt)}</td>
                    <td class="px-space-4 py-space-3 text-right">
                      <div class="inline-flex items-center gap-space-2">
                        <a href="/quan-tri/dia-diem/${encodeURIComponent(d.id)}/sua" class="min-h-[40px] px-space-3 rounded border border-border bg-surface text-on-surface hover:bg-surface-muted font-label text-label-sm inline-flex items-center">Sửa</a>
                        <button type="button" data-toggle-dest="${escapeHtml(d.id)}" data-next-status="${d.status === 'ACTIVE' ? 'HIDDEN' : 'ACTIVE'}" class="min-h-[40px] px-space-3 rounded border ${
                          d.status === 'ACTIVE' ? 'border-error/40 text-error hover:bg-error-bg' : 'border-primary text-primary hover:bg-primary-light'
                        } font-label text-label-sm">
                          ${d.status === 'ACTIVE' ? 'Ẩn' : 'Kích hoạt'}
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

      bindImageFallbacks(wrap);

      wrap.querySelectorAll<HTMLButtonElement>('[data-toggle-dest]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.toggleDest!;
          const nextStatus = btn.dataset.nextStatus as ActiveStatus;
          openConfirmModal({
            title: nextStatus === 'HIDDEN' ? `Ẩn địa điểm ${id}?` : `Kích hoạt lại địa điểm ${id}?`,
            description:
              nextStatus === 'HIDDEN'
                ? 'Địa điểm sẽ không còn hiển thị công khai và các dịch vụ liên kết sẽ ngừng nhận đặt mới.'
                : 'Địa điểm sẽ hiển thị công khai trở lại nếu danh mục cha đang hoạt động.',
            confirmLabel: nextStatus === 'HIDDEN' ? 'Ẩn địa điểm' : 'Kích hoạt',
            destructive: nextStatus === 'HIDDEN',
            onConfirm: async () => {
              await adminCatalogService.toggleDestinationStatus(id, nextStatus);
              showToast(`Đã cập nhật trạng thái địa điểm ${id}.`, 'success');
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
      finishAsyncRender(wrap, renderErrorBanner(toUserErrorMessage(err), 'retryA03'));
      wrap.querySelector('#retryA03')?.addEventListener('click', () => void load());
    }
  };

  const applyA03Filters = () => {
    query = main.querySelector<HTMLInputElement>('#a03Q')?.value.trim() ?? '';
    region = main.querySelector<HTMLSelectElement>('#a03Region')?.value ?? 'ALL';
    categoryId = main.querySelector<HTMLSelectElement>('#a03Cat')?.value ?? 'ALL';
    status = (main.querySelector<HTMLSelectElement>('#a03Status')?.value ?? 'ALL') as ActiveStatus | 'ALL';
    page = 1;
    void load();
  };

  main.querySelector<HTMLFormElement>('#a03FilterForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    applyA03Filters();
  });
  main.querySelectorAll('#a03Region, #a03Cat, #a03Status').forEach((sel) => {
    sel.addEventListener('change', applyA03Filters);
  });

  const loadCategoriesPromise = destinationsService
    .listCategories({ includeHidden: true, pageSize: 50 })
    .then((catRes) => {
      categories = catRes.items;
      const catSel = main.querySelector<HTMLSelectElement>('#a03Cat');
      if (catSel) {
        catSel.innerHTML = [
          `<option value="ALL">Mọi danh mục</option>`,
          ...categories.map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`),
        ].join('');
        catSel.dispatchEvent(new Event('tl:sync'));
      }
    })
    .catch(() => {
      categories = [];
    });

  await Promise.all([loadCategoriesPromise, load()]);
}
