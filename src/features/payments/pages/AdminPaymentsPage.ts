import type { RouteContext } from '@/app/router';
import { sessionStore } from '@/app/session-store';
import { toUserErrorMessage } from '@/api/errors';
import { paymentsService } from '@/features/payments/payments.service';
import { renderBackofficeShell } from '@/layouts/backoffice/BackofficeShell';
import { renderEmptyState, renderErrorBanner, renderTableSkeleton } from '@/shared/components/EmptyErrorState';
import { renderPagination } from '@/shared/components/Pagination';
import { renderPaymentEventStatusBadge, renderPaymentStatusBadge } from '@/shared/components/StatusBadge';
import { beginAsyncRender, escapeHtml, finishAsyncRender } from '@/shared/utils/dom';
import { formatDateTimeVi, formatVnd } from '@/shared/utils/format';

export async function renderAdminPaymentsPage(ctx: RouteContext): Promise<void> {
  const isAdmin = sessionStore.user?.role === 'ADMIN';
  let activeTab: 'events' | 'payments' = ctx.query.get('tab') === 'payments' ? 'payments' : 'events';
  let query = '';
  let page = 1;

  const main = renderBackofficeShell({
    container: ctx.container,
    activeNav: 'payments',
    breadcrumbs: [{ label: 'Quản trị', href: '/quan-tri' }, { label: 'Thanh toán & đối soát SePay' }],
    contentHtml: `
      <div class="flex flex-col gap-space-2">
        <div class="flex flex-wrap items-center justify-between gap-space-3">
          <h1 class="font-headline text-headline-lg text-on-surface">Thanh toán &amp; giao dịch SePay</h1>
          ${
            !isAdmin
              ? `<span class="px-space-3 py-space-1 rounded-full bg-info-bg text-on-info-bg font-label text-label-sm">Chế độ chỉ đọc (STAFF_PAYMENT_VIEW)</span>`
              : ''
          }
        </div>
        <p class="font-body text-body-md text-text-secondary">
          Mỗi giao dịch chuyển khoản được lưu thành một sự kiện riêng biệt. Trạng thái "Cần đối soát" không phải "Đã thanh toán", và "Đã xử lý đối soát" không đồng nghĩa "Đơn đã xác nhận".
        </p>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-space-3">
        <div class="inline-flex bg-surface border border-border rounded-lg p-space-1 gap-space-1" role="tablist">
          <button type="button" role="tab" data-pay-tab="events" class="min-h-[44px] px-space-4 rounded font-label text-label-md">Giao dịch nhận được (SePay)</button>
          <button type="button" role="tab" data-pay-tab="payments" class="min-h-[44px] px-space-4 rounded font-label text-label-md">Bản ghi Payment theo đơn</button>
        </div>
        <form id="a10SearchForm" class="flex gap-2">
          <div class="relative flex items-center">
            <span class="material-symbols-outlined text-[20px] text-text-secondary absolute left-3.5 pointer-events-none" aria-hidden="true">search</span>
            <input id="a10Q" type="search" placeholder="Tìm mã GD, mã TT, nội dung..." class="min-h-[44px] pl-10 pr-3 rounded-xl border border-border bg-surface text-body-md focus:border-primary focus:ring-2 focus:ring-primary/20" />
          </div>
          <button type="submit" class="min-h-[44px] px-4 rounded-xl bg-primary text-on-primary hover:bg-primary-hover font-label text-label-md shadow-sm">Tìm</button>
        </form>
      </div>

      <div id="a10Table">${renderTableSkeleton(4)}</div>
      <div id="a10Pag"></div>
    `,
  });

  const syncTabs = () => {
    main.querySelectorAll<HTMLButtonElement>('[data-pay-tab]').forEach((btn) => {
      const selected = btn.dataset.payTab === activeTab;
      btn.setAttribute('aria-selected', selected ? 'true' : 'false');
      btn.className = selected
        ? 'min-h-[44px] px-space-4 rounded bg-primary text-on-primary font-label text-label-md'
        : 'min-h-[44px] px-space-4 rounded text-text-secondary hover:bg-surface-muted font-label text-label-md';
    });
  };

  const load = async () => {
    syncTabs();
    const wrap = main.querySelector<HTMLElement>('#a10Table')!;
    const pag = main.querySelector<HTMLElement>('#a10Pag')!;
    beginAsyncRender(wrap, renderTableSkeleton(4));
    pag.innerHTML = '';

    try {
      if (activeTab === 'events') {
        const res = await paymentsService.listAdminPaymentEvents({ query, page, pageSize: 10 });
        if (res.items.length === 0) {
          finishAsyncRender(
            wrap,
            renderEmptyState({
              icon: 'account_balance',
              title: 'Chưa có sự kiện giao dịch nào',
              description: 'Các giao dịch SePay Webhook (kể cả chưa khớp đơn) sẽ hiển thị riêng từng dòng tại đây.',
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
                    <th class="px-space-4 py-space-3">Mã sự kiện / Tham chiếu</th>
                    <th class="px-space-4 py-space-3">Đơn / Payment liên kết</th>
                    <th class="px-space-4 py-space-3">Nội dung chuyển khoản</th>
                    <th class="px-space-4 py-space-3">Số tiền thực nhận</th>
                    <th class="px-space-4 py-space-3">Thời gian</th>
                    <th class="px-space-4 py-space-3">Trạng thái</th>
                    <th class="px-space-4 py-space-3 text-right">Chi tiết</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-border font-body text-body-md">
                  ${res.items
                    .map(
                      (ev) => `
                    <tr class="hover:bg-background">
                      <td class="px-space-4 py-space-3 tabular-nums">
                        <p class="font-label text-primary">${escapeHtml(ev.id)}</p>
                        <p class="text-label-sm text-text-secondary">${escapeHtml(ev.transactionRef)}</p>
                      </td>
                      <td class="px-space-4 py-space-3">
                        ${
                          ev.bookingId
                            ? `<span class="font-label text-on-surface tabular-nums">${escapeHtml(ev.bookingId)} · ${escapeHtml(ev.paymentCode ?? '')}</span>`
                            : `<span class="text-warning font-label text-label-sm">Chưa xác định đơn</span>`
                        }
                      </td>
                      <td class="px-space-4 py-space-3 max-w-xs truncate text-text-secondary">${escapeHtml(ev.transferContent)}</td>
                      <td class="px-space-4 py-space-3 font-label text-on-surface tabular-nums">${formatVnd(ev.amountReceivedVnd)}</td>
                      <td class="px-space-4 py-space-3 text-label-sm text-text-secondary tabular-nums">${formatDateTimeVi(ev.occurredAt)}</td>
                      <td class="px-space-4 py-space-3">${renderPaymentEventStatusBadge(ev.status)}</td>
                      <td class="px-space-4 py-space-3 text-right">
                        <a href="/quan-tri/giao-dich/${encodeURIComponent(ev.id)}" class="min-h-[40px] px-space-3 rounded border border-primary text-primary hover:bg-primary-light font-label text-label-sm inline-flex items-center">
                          ${isAdmin ? 'Xem & đối soát' : 'Xem chi tiết'}
                        </a>
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
      } else {
        const res = await paymentsService.listAdminPayments({ query, page, pageSize: 10 });
        if (res.items.length === 0) {
          finishAsyncRender(
            wrap,
            renderEmptyState({
              icon: 'payments',
              title: 'Chưa có bản ghi thanh toán nào',
              description: 'Các bản ghi thanh toán gắn với đơn dịch vụ sẽ hiển thị tại đây.',
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
                    <th class="px-space-4 py-space-3">Mã Payment</th>
                    <th class="px-space-4 py-space-3">Mã Booking</th>
                    <th class="px-space-4 py-space-3">Khách hàng</th>
                    <th class="px-space-4 py-space-3">Dự kiến</th>
                    <th class="px-space-4 py-space-3">Đã nhận</th>
                    <th class="px-space-4 py-space-3">Trạng thái</th>
                    <th class="px-space-4 py-space-3">Cập nhật</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-border font-body text-body-md">
                  ${res.items
                    .map(
                      (p) => `
                    <tr class="hover:bg-background">
                      <td class="px-space-4 py-space-3 font-label text-primary tabular-nums">${escapeHtml(p.paymentCode)}</td>
                      <td class="px-space-4 py-space-3 font-label tabular-nums">${escapeHtml(p.bookingId)}</td>
                      <td class="px-space-4 py-space-3">${escapeHtml(p.customerName)}</td>
                      <td class="px-space-4 py-space-3 tabular-nums">${formatVnd(p.expectedAmountVnd)}</td>
                      <td class="px-space-4 py-space-3 font-label tabular-nums">${formatVnd(p.receivedAmountVnd)}</td>
                      <td class="px-space-4 py-space-3">${renderPaymentStatusBadge(p.status)}</td>
                      <td class="px-space-4 py-space-3 text-label-sm text-text-secondary tabular-nums">${formatDateTimeVi(p.updatedAt)}</td>
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
      }

      pag.querySelectorAll<HTMLButtonElement>('[data-page]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const next = Number(btn.dataset.page);
          if (next >= 1 && next !== page) {
            page = next;
            void load();
          }
        });
      });
    } catch (err) {
      finishAsyncRender(wrap, renderErrorBanner(toUserErrorMessage(err), 'retryA10'));
      wrap.querySelector('#retryA10')?.addEventListener('click', () => void load());
    }
  };

  main.querySelectorAll<HTMLButtonElement>('[data-pay-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeTab = btn.dataset.payTab as 'events' | 'payments';
      page = 1;
      void load();
    });
  });

  main.querySelector<HTMLFormElement>('#a10SearchForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    query = main.querySelector<HTMLInputElement>('#a10Q')?.value.trim() ?? '';
    page = 1;
    void load();
  });

  await load();
}
