import type { RouteContext } from '@/app/router';
import { toUserErrorMessage } from '@/api/errors';
import type { AuditLogEntry } from '@/api/contracts';
import { staffService } from '@/features/staff/staff.service';
import { renderBackofficeShell } from '@/layouts/backoffice/BackofficeShell';
import { renderEmptyState, renderErrorBanner, renderTableSkeleton } from '@/shared/components/EmptyErrorState';
import { openModal } from '@/shared/components/Modal';
import { renderPagination } from '@/shared/components/Pagination';
import { renderBadge } from '@/shared/components/StatusBadge';
import { beginAsyncRender, escapeHtml, finishAsyncRender } from '@/shared/utils/dom';
import { formatDateTimeVi } from '@/shared/utils/format';

export async function renderAuditLogPage(ctx: RouteContext): Promise<void> {
  let query = '';
  let targetId = ctx.query.get('targetId') ?? '';
  let targetType: AuditLogEntry['targetType'] | 'ALL' = 'ALL';
  let fromDate = '';
  let toDate = '';
  let page = 1;

  const main = renderBackofficeShell({
    container: ctx.container,
    activeNav: 'audit',
    breadcrumbs: [{ label: 'Quản trị', href: '/quan-tri' }, { label: 'Nhật ký hệ thống' }],
    contentHtml: `
      <div>
        <h1 class="font-headline text-headline-lg text-on-surface">Nhật ký &amp; chi tiết thay đổi</h1>
        <p class="font-body text-body-md text-text-secondary">Nhật ký chỉ đọc dành cho Quản trị viên; đã loại bỏ hoàn toàn mật khẩu, mã OTP và khóa bí mật.</p>
      </div>

      <form id="a17Form" class="bg-surface border border-border rounded-xl shadow-sm p-4 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
        <label class="sm:col-span-4 flex flex-col gap-space-1">
          <span class="font-label text-label-sm text-text-secondary">Từ khóa / Đối tượng</span>
          <div class="relative flex items-center">
            <span class="material-symbols-outlined text-[20px] text-text-secondary absolute left-3.5 pointer-events-none" aria-hidden="true">search</span>
            <input id="a17Q" type="search" value="${escapeHtml(targetId)}" placeholder="Người thao tác, đối tượng, lý do..." class="w-full min-h-[44px] pl-10 pr-3 rounded-xl border border-border bg-surface text-body-md focus:border-primary focus:ring-2 focus:ring-primary/20" />
          </div>
        </label>
        <label class="sm:col-span-3 flex flex-col gap-space-1">
          <span class="font-label text-label-sm text-text-secondary">Nhóm đối tượng</span>
          <select id="a17Type" class="w-full min-h-[44px] px-space-3 rounded-xl border border-border bg-surface text-body-md">
            <option value="ALL">Mọi nhóm đối tượng</option>
            <option value="STAFF">Nhân sự &amp; phân quyền</option>
            <option value="BOOKING">Booking nội bộ</option>
            <option value="PAYMENT_EVENT">Đối soát thanh toán SePay</option>
            <option value="REVIEW">Kiểm duyệt đánh giá</option>
            <option value="CATALOG">Danh mục / Địa điểm / Dịch vụ</option>
          </select>
        </label>
        <label class="sm:col-span-2 flex flex-col gap-space-1">
          <span class="font-label text-label-sm text-text-secondary">Từ ngày</span>
          <input id="a17FromDate" type="date" class="w-full min-h-[44px] px-3 rounded-xl border border-border bg-surface text-body-md tabular-nums focus:border-primary focus:ring-2 focus:ring-primary/20" />
        </label>
        <label class="sm:col-span-2 flex flex-col gap-space-1">
          <span class="font-label text-label-sm text-text-secondary">Đến ngày</span>
          <input id="a17ToDate" type="date" class="w-full min-h-[44px] px-3 rounded-xl border border-border bg-surface text-body-md tabular-nums focus:border-primary focus:ring-2 focus:ring-primary/20" />
        </label>
        <div class="sm:col-span-1 flex gap-space-2">
          <button type="submit" class="w-full min-h-[44px] px-3 rounded-xl bg-primary text-on-primary hover:bg-primary-hover font-label text-label-md shadow-sm">Lọc</button>
        </div>
      </form>

      <div id="a17Table">${renderTableSkeleton(5)}</div>
      <div id="a17Pag"></div>
    `,
  });

  const openLogDetailDrawer = (log: AuditLogEntry) => {
    const renderKvList = (obj: Record<string, string>) =>
      Object.entries(obj)
        .map(
          ([k, v]) => `<div class="flex justify-between gap-space-3 py-space-1 border-b border-border/60 last:border-0">
            <dt class="text-text-secondary">${escapeHtml(k)}</dt>
            <dd class="font-label text-on-surface text-right">${escapeHtml(v)}</dd>
          </div>`,
        )
        .join('');

    openModal({
      title: `Chi tiết nhật ký ${log.id}`,
      subtitle: 'Bản ghi chỉ đọc, không hỗ trợ chỉnh sửa hoặc xóa.',
      size: 'drawer',
      bodyHtml: `
        <div class="flex flex-col gap-space-4 font-body text-body-md">
          <dl class="bg-background border border-border rounded-lg p-space-4 flex flex-col gap-space-2">
            <div class="flex justify-between"><dt class="text-text-secondary">Thời gian</dt><dd class="font-label tabular-nums">${formatDateTimeVi(log.timestamp)}</dd></div>
            <div class="flex justify-between"><dt class="text-text-secondary">Người thao tác</dt><dd class="font-label">${escapeHtml(log.actorName)}</dd></div>
            <div class="flex justify-between"><dt class="text-text-secondary">Đối tượng</dt><dd class="font-label">${escapeHtml(log.targetLabel)}</dd></div>
            <div class="flex justify-between"><dt class="text-text-secondary">Hành động</dt><dd class="font-label text-primary">${escapeHtml(log.actionLabel)}</dd></div>
          </dl>

          <div>
            <h3 class="font-label text-label-md text-on-surface mb-space-1">Lý do ghi nhận</h3>
            <p class="p-space-3 rounded-lg bg-surface border border-border">${escapeHtml(log.reason)}</p>
          </div>

          <div class="grid grid-cols-1 gap-space-3">
            <div class="p-space-4 rounded-lg bg-surface-muted border border-border">
              <h3 class="font-label text-label-sm text-text-secondary mb-space-2">Giá trị trước thay đổi</h3>
              <dl>${renderKvList(log.beforeSummary)}</dl>
            </div>
            <div class="p-space-4 rounded-lg bg-primary-light/50 border border-primary/30">
              <h3 class="font-label text-label-sm text-primary mb-space-2">Giá trị sau thay đổi</h3>
              <dl>${renderKvList(log.afterSummary)}</dl>
            </div>
          </div>
        </div>
      `,
    });
  };

  const load = async () => {
    const wrap = main.querySelector<HTMLElement>('#a17Table')!;
    const pag = main.querySelector<HTMLElement>('#a17Pag')!;
    beginAsyncRender(wrap, renderTableSkeleton(5));
    pag.innerHTML = '';

    try {
      const res = await staffService.listAuditLogs({
        query: query || undefined,
        targetId: targetId || undefined,
        targetType,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        page,
        pageSize: 12,
      });

      if (res.items.length === 0) {
        finishAsyncRender(
          wrap,
          renderEmptyState({
            icon: 'history',
            title: 'Không có bản ghi nhật ký phù hợp',
            description: 'Thử thay đổi điều kiện lọc để xem toàn bộ lịch sử thao tác hệ thống.',
          }),
        );
        return;
      }

      finishAsyncRender(
        wrap,
        `<div class="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
          <div class="table-scroll-wrap">
            <table class="w-full text-left border-collapse min-w-[860px]">
              <thead class="bg-surface-muted border-b border-border font-label text-label-sm text-text-secondary">
                <tr>
                  <th class="px-space-4 py-space-3">Thời gian</th>
                  <th class="px-space-4 py-space-3">Người thao tác</th>
                  <th class="px-space-4 py-space-3">Đối tượng</th>
                  <th class="px-space-4 py-space-3">Hành động</th>
                  <th class="px-space-4 py-space-3">Lý do</th>
                  <th class="px-space-4 py-space-3 text-right">Chi tiết</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border font-body text-body-md">
                ${res.items
                  .map(
                    (l) => `
                  <tr class="hover:bg-background">
                    <td class="px-space-4 py-space-3 text-label-sm text-text-secondary tabular-nums">${formatDateTimeVi(l.timestamp)}</td>
                    <td class="px-space-4 py-space-3 font-label text-on-surface">${escapeHtml(l.actorName)}</td>
                    <td class="px-space-4 py-space-3">${escapeHtml(l.targetLabel)}</td>
                    <td class="px-space-4 py-space-3">${renderBadge(l.actionLabel, 'info', 'history')}</td>
                    <td class="px-space-4 py-space-3 max-w-xs truncate text-text-secondary">${escapeHtml(l.reason)}</td>
                    <td class="px-space-4 py-space-3 text-right">
                      <button type="button" data-open-log="${escapeHtml(l.id)}" class="min-h-[40px] px-space-3 rounded border border-border bg-surface text-on-surface hover:bg-surface-muted font-label text-label-sm">Xem trước/sau</button>
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

      wrap.querySelectorAll<HTMLButtonElement>('[data-open-log]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const item = res.items.find((x) => x.id === btn.dataset.openLog);
          if (item) openLogDetailDrawer(item);
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
      finishAsyncRender(wrap, renderErrorBanner(toUserErrorMessage(err), 'retryA17'));
      wrap.querySelector('#retryA17')?.addEventListener('click', () => void load());
    }
  };

  const applyA17Filters = () => {
    query = main.querySelector<HTMLInputElement>('#a17Q')?.value.trim() ?? '';
    targetId = '';
    targetType = (main.querySelector<HTMLSelectElement>('#a17Type')?.value ?? 'ALL') as AuditLogEntry['targetType'] | 'ALL';
    fromDate = main.querySelector<HTMLInputElement>('#a17FromDate')?.value ?? '';
    toDate = main.querySelector<HTMLInputElement>('#a17ToDate')?.value ?? '';
    page = 1;
    void load();
  };

  main.querySelector<HTMLFormElement>('#a17Form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    applyA17Filters();
  });
  main.querySelectorAll('#a17Type, #a17FromDate, #a17ToDate').forEach((el) => {
    el.addEventListener('change', applyA17Filters);
  });

  await load();
}
