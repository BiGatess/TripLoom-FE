import type { RouteContext } from '@/app/router';
import { toUserErrorMessage } from '@/api/errors';
import type { Review, ReviewStatus } from '@/api/contracts';
import { reviewsService } from '@/features/reviews/reviews.service';
import { renderBackofficeShell } from '@/layouts/backoffice/BackofficeShell';
import { renderEmptyState, renderErrorBanner, renderTableSkeleton } from '@/shared/components/EmptyErrorState';
import { openModal } from '@/shared/components/Modal';
import { renderPagination } from '@/shared/components/Pagination';
import { renderReviewStatusBadge } from '@/shared/components/StatusBadge';
import { showToast } from '@/shared/components/Toast';
import { beginAsyncRender, escapeHtml, finishAsyncRender } from '@/shared/utils/dom';
import { formatDateTimeVi } from '@/shared/utils/format';

export async function renderReviewModerationPage(ctx: RouteContext): Promise<void> {
  let statusFilter: ReviewStatus | 'ALL' = 'ALL';
  let query = '';
  let page = 1;

  const main = renderBackofficeShell({
    container: ctx.container,
    activeNav: 'reviews',
    breadcrumbs: [{ label: 'Quản trị', href: '/quan-tri' }, { label: 'Kiểm duyệt đánh giá' }],
    contentHtml: `
      <div>
        <h1 class="font-headline text-headline-lg text-on-surface">Kiểm duyệt đánh giá</h1>
        <p class="font-body text-body-md text-text-secondary">Duyệt công khai hoặc ẩn đánh giá kèm lý do. Người kiểm duyệt không được chỉnh sửa lời nhận xét hoặc số sao của người dùng.</p>
      </div>

      <form id="a09FilterForm" class="bg-surface border border-border rounded-xl shadow-sm p-4 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
        <div class="sm:col-span-6 relative flex items-center">
          <span class="material-symbols-outlined text-[20px] text-text-secondary absolute left-3.5 pointer-events-none" aria-hidden="true">search</span>
          <input id="a09Q" type="search" placeholder="Tìm theo mã, địa điểm, tác giả hoặc nội dung..." class="w-full min-h-[44px] pl-10 pr-3 rounded-xl border border-border bg-surface text-body-md focus:border-primary focus:ring-2 focus:ring-primary/20" />
        </div>
        <select id="a09Status" class="sm:col-span-4 min-h-[44px] px-space-3 rounded-xl border border-border bg-surface text-body-md">
          <option value="ALL">Tất cả trạng thái</option>
          <option value="PENDING">Chờ duyệt</option>
          <option value="PUBLISHED">Đã công khai</option>
          <option value="HIDDEN">Đã ẩn</option>
        </select>
        <button type="submit" class="sm:col-span-2 min-h-[44px] px-4 rounded-xl bg-primary text-on-primary hover:bg-primary-hover font-label text-label-md shadow-sm">Lọc</button>
      </form>

      <div id="a09Table">${renderTableSkeleton(4)}</div>
      <div id="a09Pag"></div>
    `,
  });

  const openModerateDrawer = (rv: Review) => {
    openModal({
      title: `Kiểm duyệt đánh giá ${rv.id}`,
      subtitle: 'Nội dung nhận xét và số sao của người dùng được giữ nguyên tuyệt đối (chỉ đọc).',
      size: 'drawer',
      bodyHtml: `
        <div class="flex flex-col gap-space-4">
          <div class="p-space-4 rounded-lg bg-background border border-border flex flex-col gap-space-2">
            <div class="flex items-center justify-between gap-space-2">
              <strong class="font-label text-label-md text-on-surface">${escapeHtml(rv.destinationName)}</strong>
              ${renderReviewStatusBadge(rv.status)}
            </div>
            <p class="font-body text-label-sm text-text-secondary">Tác giả: ${escapeHtml(rv.userName)} · ${formatDateTimeVi(rv.createdAt)}</p>
            <div class="flex items-center gap-0.5 text-warning" aria-label="${rv.rating} sao">
              ${Array.from({ length: 5 })
                .map((_, i) => `<span class="material-symbols-outlined text-[18px] ${i < rv.rating ? 'icon-filled text-warning' : 'text-border'}">star</span>`)
                .join('')}
              <span class="ml-1 font-label text-label-sm text-on-surface">${rv.rating}/5 sao (chỉ đọc)</span>
            </div>
            <blockquote class="p-space-3 rounded bg-surface border border-border font-body text-body-md text-on-surface">${escapeHtml(rv.comment)}</blockquote>
            ${
              rv.moderatedBy
                ? `<p class="font-body text-label-sm text-text-secondary">Xử lý gần nhất bởi <strong>${escapeHtml(rv.moderatedBy)}</strong> (${formatDateTimeVi(rv.moderatedAt)}): ${escapeHtml(rv.moderationReason ?? '')}</p>`
                : ''
            }
          </div>

          <div id="a09Alert" role="alert" class="hidden p-space-3 rounded bg-error-bg text-on-error-bg font-body text-body-md"></div>

          <form id="a09ModForm" novalidate class="flex flex-col gap-space-4">
            <fieldset class="flex flex-col gap-space-2">
              <legend class="font-label text-label-md text-on-surface">Quyết định kiểm duyệt <span class="text-error">*</span></legend>
              <div class="grid grid-cols-2 gap-space-2">
                <label class="cursor-pointer">
                  <input type="radio" name="modStatus" value="PUBLISHED" ${rv.status !== 'HIDDEN' ? 'checked' : ''} class="sr-only peer" />
                  <span class="w-full min-h-[44px] px-space-3 rounded border border-border peer-checked:border-success peer-checked:bg-success-bg peer-checked:text-on-success-bg inline-flex items-center justify-center font-label text-label-md">Duyệt công khai</span>
                </label>
                <label class="cursor-pointer">
                  <input type="radio" name="modStatus" value="HIDDEN" ${rv.status === 'HIDDEN' ? 'checked' : ''} class="sr-only peer" />
                  <span class="w-full min-h-[44px] px-space-3 rounded border border-border peer-checked:border-error peer-checked:bg-error-bg peer-checked:text-on-error-bg inline-flex items-center justify-center font-label text-label-md">Ẩn đánh giá</span>
                </label>
              </div>
            </fieldset>

            <label class="flex flex-col gap-space-1">
              <span class="font-label text-label-md text-on-surface">Lý do kiểm duyệt (5 – 500 ký tự) <span class="text-error">*</span></span>
              <textarea id="a09Reason" rows="3" placeholder="Nêu rõ lý do công khai hoặc ẩn đánh giá này..." class="w-full p-space-3 rounded border border-border bg-surface text-body-md">${escapeHtml(rv.moderationReason ?? '')}</textarea>
            </label>

            <div class="flex justify-end gap-space-3 pt-space-2 border-t border-border">
              <button type="button" data-a09-cancel class="min-h-[44px] px-space-4 rounded border border-border bg-surface text-on-surface font-label text-label-md">Hủy</button>
              <button type="submit" id="a09SubmitBtn" class="min-h-[44px] px-space-6 rounded bg-primary text-on-primary hover:bg-primary-hover font-label text-label-md">Lưu quyết định</button>
            </div>
          </form>
        </div>
      `,
      onMount: (panel, close) => {
        panel.querySelector('[data-a09-cancel]')?.addEventListener('click', close);
        panel.querySelector<HTMLFormElement>('#a09ModForm')?.addEventListener('submit', async (e) => {
          e.preventDefault();
          const btn = panel.querySelector<HTMLButtonElement>('#a09SubmitBtn');
          const alertEl = panel.querySelector<HTMLElement>('#a09Alert');
          if (!btn || btn.disabled) return;
          const nextStatus = (panel.querySelector<HTMLInputElement>('input[name="modStatus"]:checked')?.value ?? 'PUBLISHED') as
            | 'PUBLISHED'
            | 'HIDDEN';
          const reason = panel.querySelector<HTMLTextAreaElement>('#a09Reason')?.value.trim() ?? '';
          alertEl?.classList.add('hidden');
          btn.disabled = true;
          btn.textContent = 'Đang lưu...';
          try {
            await reviewsService.moderateReview(rv.id, { status: nextStatus, reason });
            close();
            showToast(`Đã cập nhật trạng thái đánh giá ${rv.id}.`, 'success');
            await load();
          } catch (err) {
            if (alertEl) {
              alertEl.textContent = toUserErrorMessage(err);
              alertEl.classList.remove('hidden');
            }
            btn.disabled = false;
            btn.textContent = 'Lưu quyết định';
          }
        });
      },
    });
  };

  const load = async () => {
    const wrap = main.querySelector<HTMLElement>('#a09Table')!;
    const pag = main.querySelector<HTMLElement>('#a09Pag')!;
    beginAsyncRender(wrap, renderTableSkeleton(4));
    pag.innerHTML = '';

    try {
      const res = await reviewsService.listAdminReviews({ query, status: statusFilter, page, pageSize: 10 });
      if (res.items.length === 0) {
        finishAsyncRender(
          wrap,
          renderEmptyState({
            icon: 'fact_check',
            title: 'Không có đánh giá phù hợp',
            description: 'Hiện không có đánh giá nào khớp bộ lọc đang chọn.',
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
                  <th class="px-space-4 py-space-3">Mã / Địa điểm</th>
                  <th class="px-space-4 py-space-3">Người đánh giá</th>
                  <th class="px-space-4 py-space-3">Số sao</th>
                  <th class="px-space-4 py-space-3">Nội dung</th>
                  <th class="px-space-4 py-space-3">Trạng thái</th>
                  <th class="px-space-4 py-space-3">Thời gian</th>
                  <th class="px-space-4 py-space-3 text-right">Kiểm duyệt</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border font-body text-body-md">
                ${res.items
                  .map(
                    (rv) => `
                  <tr class="hover:bg-background">
                    <td class="px-space-4 py-space-3">
                      <p class="font-label text-on-surface">${escapeHtml(rv.destinationName)}</p>
                      <p class="text-label-sm text-primary tabular-nums">${escapeHtml(rv.id)}</p>
                    </td>
                    <td class="px-space-4 py-space-3">${escapeHtml(rv.userName)}</td>
                    <td class="px-space-4 py-space-3 font-label tabular-nums">${rv.rating} / 5</td>
                    <td class="px-space-4 py-space-3 max-w-xs truncate text-text-secondary">${escapeHtml(rv.comment)}</td>
                    <td class="px-space-4 py-space-3">${renderReviewStatusBadge(rv.status)}</td>
                    <td class="px-space-4 py-space-3 text-label-sm text-text-secondary tabular-nums">${formatDateTimeVi(rv.updatedAt)}</td>
                    <td class="px-space-4 py-space-3 text-right">
                      <button type="button" data-mod-rv="${escapeHtml(rv.id)}" class="min-h-[40px] px-space-3 rounded border border-primary text-primary hover:bg-primary-light font-label text-label-sm">Kiểm duyệt</button>
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

      wrap.querySelectorAll<HTMLButtonElement>('[data-mod-rv]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const item = res.items.find((r) => r.id === btn.dataset.modRv);
          if (item) openModerateDrawer(item);
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
      finishAsyncRender(wrap, renderErrorBanner(toUserErrorMessage(err), 'retryA09'));
      wrap.querySelector('#retryA09')?.addEventListener('click', () => void load());
    }
  };

  const applyA09Filters = () => {
    query = main.querySelector<HTMLInputElement>('#a09Q')?.value.trim() ?? '';
    statusFilter = (main.querySelector<HTMLSelectElement>('#a09Status')?.value ?? 'ALL') as ReviewStatus | 'ALL';
    page = 1;
    void load();
  };

  main.querySelector<HTMLFormElement>('#a09FilterForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    applyA09Filters();
  });
  main.querySelector('#a09Status')?.addEventListener('change', applyA09Filters);

  await load();
}
