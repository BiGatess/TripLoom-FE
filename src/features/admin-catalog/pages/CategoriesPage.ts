import type { RouteContext } from '@/app/router';
import { isAppError, toUserErrorMessage } from '@/api/errors';
import type { ActiveStatus, Category } from '@/api/contracts';
import { adminCatalogService } from '@/features/admin-catalog/admin-catalog.service';
import { destinationsService } from '@/features/destinations/destinations.service';
import { renderBackofficeShell } from '@/layouts/backoffice/BackofficeShell';
import { renderEmptyState, renderErrorBanner, renderTableSkeleton } from '@/shared/components/EmptyErrorState';
import { openModal } from '@/shared/components/Modal';
import { renderPagination } from '@/shared/components/Pagination';
import { renderActiveStatusBadge } from '@/shared/components/StatusBadge';
import { showToast } from '@/shared/components/Toast';
import { beginAsyncRender, escapeHtml, finishAsyncRender } from '@/shared/utils/dom';
import { formatDateTimeVi } from '@/shared/utils/format';

export async function renderCategoriesPage(ctx: RouteContext): Promise<void> {
  let query = '';
  let page = 1;

  const main = renderBackofficeShell({
    container: ctx.container,
    activeNav: 'categories',
    breadcrumbs: [{ label: 'Quản trị', href: '/quan-tri' }, { label: 'Danh mục du lịch' }],
    contentHtml: `
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-space-4">
        <div>
          <h1 class="font-headline text-headline-lg text-on-surface">Quản lý danh mục du lịch</h1>
          <p class="font-body text-body-md text-text-secondary">Chỉ Quản trị viên được thao tác danh mục. Khi ẩn danh mục, địa điểm và dịch vụ thuộc danh mục sẽ ngừng công khai.</p>
        </div>
        <button type="button" id="addCatBtn" class="inline-flex items-center justify-center gap-space-2 min-h-[44px] px-space-6 rounded bg-primary text-on-primary hover:bg-primary-hover font-label text-label-md">
          <span class="material-symbols-outlined text-[20px]">add</span>
          <span>Thêm danh mục</span>
        </button>
      </div>

      <form id="catSearchForm" class="bg-surface border border-border rounded-xl shadow-sm p-4 flex flex-col sm:flex-row gap-3 items-center">
        <div class="w-full flex-1 relative flex items-center">
          <span class="material-symbols-outlined text-[20px] text-text-secondary absolute left-3.5 pointer-events-none" aria-hidden="true">search</span>
          <input id="catSearchInput" type="search" placeholder="Tìm theo tên hoặc mô tả danh mục..." class="w-full min-h-[44px] pl-10 pr-4 rounded-xl border border-border bg-surface text-body-md focus:border-primary focus:ring-2 focus:ring-primary/20" />
        </div>
        <button type="submit" class="w-full sm:w-auto min-h-[44px] px-6 rounded-xl bg-primary text-on-primary hover:bg-primary-hover font-label text-label-md shadow-sm">Tìm kiếm</button>
      </form>

      <div id="catTableWrap">${renderTableSkeleton(4)}</div>
      <div id="catPag"></div>
    `,
  });

  const openCategoryModal = (existing?: Category) => {
    openModal({
      title: existing ? `Chỉnh sửa danh mục ${existing.id}` : 'Thêm danh mục du lịch mới',
      subtitle: 'Tên danh mục phải là duy nhất trên hệ thống. Không hỗ trợ xóa cứng danh mục đã dùng.',
      size: 'md',
      bodyHtml: `
        <form id="catForm" novalidate class="flex flex-col gap-space-4">
          <div id="catFormAlert" role="alert" class="hidden p-space-3 rounded bg-error-bg text-on-error-bg font-body text-body-md"></div>

          <label class="flex flex-col gap-space-1">
            <span class="font-label text-label-md text-on-surface">Tên danh mục <span class="text-error">*</span></span>
            <input id="catName" type="text" value="${escapeHtml(existing?.name ?? '')}" placeholder="Ví dụ: Di sản & Văn hóa" class="w-full min-h-[44px] px-space-4 rounded border border-border bg-surface text-body-md" />
            <span data-err="name" class="hidden text-body-md text-error"></span>
          </label>

          <label class="flex flex-col gap-space-1">
            <span class="font-label text-label-md text-on-surface">Mô tả <span class="text-error">*</span></span>
            <textarea id="catDesc" rows="3" class="w-full p-space-3 rounded border border-border bg-surface text-body-md">${escapeHtml(existing?.description ?? '')}</textarea>
            <span data-err="description" class="hidden text-body-md text-error"></span>
          </label>

          <label class="flex flex-col gap-space-1">
            <span class="font-label text-label-md text-on-surface">Trạng thái</span>
            <select id="catStatus" class="w-full min-h-[44px] px-space-3 rounded border border-border bg-surface text-body-md">
              <option value="ACTIVE" ${(existing?.status ?? 'ACTIVE') === 'ACTIVE' ? 'selected' : ''}>Đang hoạt động</option>
              <option value="HIDDEN" ${existing?.status === 'HIDDEN' ? 'selected' : ''}>Đã ẩn</option>
            </select>
          </label>

          <p id="catHideWarning" class="${existing?.status === 'HIDDEN' ? '' : 'hidden'} p-space-3 rounded bg-warning-bg text-on-warning-bg font-body text-label-sm">
            Cảnh báo: Khi ẩn danh mục, toàn bộ địa điểm và dịch vụ thuộc danh mục này sẽ không còn hiển thị công khai hoặc nhận đặt mới.
          </p>

          <div class="flex justify-end gap-space-3 pt-space-2">
            <button type="button" data-cat-cancel class="min-h-[44px] px-space-4 rounded border border-border bg-surface text-on-surface font-label text-label-md">Hủy</button>
            <button type="submit" id="catSaveBtn" class="min-h-[44px] px-space-6 rounded bg-primary text-on-primary hover:bg-primary-hover font-label text-label-md">Lưu danh mục</button>
          </div>
        </form>
      `,
      onMount: (panel, close) => {
        const statusSel = panel.querySelector<HTMLSelectElement>('#catStatus');
        const warn = panel.querySelector<HTMLElement>('#catHideWarning');
        statusSel?.addEventListener('change', () => {
          if (statusSel.value === 'HIDDEN') warn?.classList.remove('hidden');
          else warn?.classList.add('hidden');
        });
        panel.querySelector('[data-cat-cancel]')?.addEventListener('click', close);

        panel.querySelector<HTMLFormElement>('#catForm')?.addEventListener('submit', async (e) => {
          e.preventDefault();
          const btn = panel.querySelector<HTMLButtonElement>('#catSaveBtn');
          const alertEl = panel.querySelector<HTMLElement>('#catFormAlert');
          if (!btn || btn.disabled) return;
          alertEl?.classList.add('hidden');
          panel.querySelectorAll('[data-err]').forEach((el) => el.classList.add('hidden'));

          const name = panel.querySelector<HTMLInputElement>('#catName')?.value.trim() ?? '';
          const description = panel.querySelector<HTMLTextAreaElement>('#catDesc')?.value.trim() ?? '';
          const status = (statusSel?.value ?? 'ACTIVE') as ActiveStatus;

          btn.disabled = true;
          btn.textContent = 'Đang lưu...';
          try {
            await adminCatalogService.upsertCategory(existing?.id ?? null, { name, description, status });
            close();
            showToast(existing ? 'Đã cập nhật danh mục.' : 'Đã thêm danh mục mới.', 'success');
            await load();
          } catch (err) {
            if (isAppError(err)) {
              Object.entries(err.fieldErrors).forEach(([k, v]) => {
                const el = panel.querySelector<HTMLElement>(`[data-err="${k}"]`);
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
            btn.textContent = 'Lưu danh mục';
          }
        });
      },
    });
  };

  const load = async () => {
    const wrap = main.querySelector<HTMLElement>('#catTableWrap')!;
    const pag = main.querySelector<HTMLElement>('#catPag')!;
    beginAsyncRender(wrap, renderTableSkeleton(4));
    pag.innerHTML = '';

    try {
      const res = await destinationsService.listCategories({ query, includeHidden: true, page, pageSize: 10 });
      if (res.items.length === 0) {
        finishAsyncRender(
          wrap,
          renderEmptyState({
            icon: 'category',
            title: 'Không có danh mục phù hợp',
            description: 'Thử thay đổi từ khóa tìm kiếm hoặc thêm danh mục mới.',
          }),
        );
        return;
      }

      finishAsyncRender(
        wrap,
        `<div class="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
          <div class="table-scroll-wrap">
            <table class="w-full text-left border-collapse min-w-[680px]">
              <thead class="bg-surface-muted border-b border-border font-label text-label-sm text-text-secondary">
                <tr>
                  <th class="px-space-4 py-space-3">Mã</th>
                  <th class="px-space-4 py-space-3">Tên danh mục</th>
                  <th class="px-space-4 py-space-3">Mô tả</th>
                  <th class="px-space-4 py-space-3">Số địa điểm</th>
                  <th class="px-space-4 py-space-3">Trạng thái</th>
                  <th class="px-space-4 py-space-3">Cập nhật</th>
                  <th class="px-space-4 py-space-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border font-body text-body-md">
                ${res.items
                  .map(
                    (c) => `
                  <tr class="hover:bg-background">
                    <td class="px-space-4 py-space-3 font-label text-primary tabular-nums">${escapeHtml(c.id)}</td>
                    <td class="px-space-4 py-space-3 font-label text-on-surface">${escapeHtml(c.name)}</td>
                    <td class="px-space-4 py-space-3 text-text-secondary max-w-xs truncate">${escapeHtml(c.description)}</td>
                    <td class="px-space-4 py-space-3 tabular-nums">${c.destinationCount}</td>
                    <td class="px-space-4 py-space-3">${renderActiveStatusBadge(c.status)}</td>
                    <td class="px-space-4 py-space-3 text-text-secondary tabular-nums">${formatDateTimeVi(c.updatedAt)}</td>
                    <td class="px-space-4 py-space-3 text-right">
                      <button type="button" data-edit-cat="${escapeHtml(c.id)}" class="min-h-[40px] px-space-3 rounded border border-border bg-surface text-on-surface hover:bg-surface-muted font-label text-label-sm">Chỉnh sửa</button>
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

      wrap.querySelectorAll<HTMLButtonElement>('[data-edit-cat]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const item = res.items.find((x) => x.id === btn.dataset.editCat);
          if (item) openCategoryModal(item);
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
      finishAsyncRender(wrap, renderErrorBanner(toUserErrorMessage(err), 'retryCat'));
      wrap.querySelector('#retryCat')?.addEventListener('click', () => void load());
    }
  };

  main.querySelector('#addCatBtn')?.addEventListener('click', () => openCategoryModal());
  main.querySelector<HTMLFormElement>('#catSearchForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    query = main.querySelector<HTMLInputElement>('#catSearchInput')?.value.trim() ?? '';
    page = 1;
    void load();
  });

  await load();
}
