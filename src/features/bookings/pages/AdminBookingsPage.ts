import type { RouteContext } from '@/app/router';
import { toUserErrorMessage } from '@/api/errors';
import type { BookingStatus } from '@/api/contracts';
import { bookingsService } from '@/features/bookings/bookings.service';
import { renderBackofficeShell } from '@/layouts/backoffice/BackofficeShell';
import { renderEmptyState, renderErrorBanner, renderTableSkeleton } from '@/shared/components/EmptyErrorState';
import { renderPagination } from '@/shared/components/Pagination';
import { renderBookingStatusBadge, renderPaymentStatusBadge } from '@/shared/components/StatusBadge';
import { beginAsyncRender, escapeHtml, finishAsyncRender } from '@/shared/utils/dom';
import { formatDateTimeVi, formatDateVi, formatVnd } from '@/shared/utils/format';

export async function renderAdminBookingsPage(ctx: RouteContext): Promise<void> {
  let query = '';
  let status: BookingStatus | 'ALL' = 'ALL';
  let serviceDate = '';
  let page = 1;

  const main = renderBackofficeShell({
    container: ctx.container,
    activeNav: 'bookings',
    breadcrumbs: [{ label: 'Quản trị', href: '/quan-tri' }, { label: 'Booking nội bộ' }],
    contentHtml: `
      <div>
        <h1 class="font-headline text-headline-lg text-on-surface">Danh sách Booking nội bộ</h1>
        <p class="font-body text-body-md text-text-secondary">Tra cứu và hỗ trợ đơn dịch vụ. Chỉ hiển thị thông tin liên hệ tối thiểu phục vụ vận hành; nhân viên không tự xác nhận thanh toán.</p>
      </div>

      <form id="a07Form" class="bg-surface border border-border rounded-xl shadow-sm p-4 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
        <div class="sm:col-span-5 relative flex items-center">
          <span class="material-symbols-outlined text-[20px] text-text-secondary absolute left-3.5 pointer-events-none" aria-hidden="true">search</span>
          <input id="a07Q" type="search" placeholder="Tìm mã đơn, mã TT, tên khách, dịch vụ..." class="w-full min-h-[44px] pl-10 pr-3 rounded-xl border border-border bg-surface text-body-md focus:border-primary focus:ring-2 focus:ring-primary/20" />
        </div>
        <select id="a07Status" class="sm:col-span-3 min-h-[44px] px-space-3 rounded-xl border border-border bg-surface text-body-md">
          <option value="ALL">Mọi trạng thái đơn</option>
          <option value="PENDING_PAYMENT">Chờ thanh toán</option>
          <option value="CONFIRMED">Đã xác nhận</option>
          <option value="EXPIRED">Hết hạn</option>
          <option value="CANCELLED">Đã hủy</option>
        </select>
        <input id="a07Date" type="date" aria-label="Lọc theo ngày sử dụng" class="sm:col-span-2 min-h-[44px] px-3 rounded-xl border border-border bg-surface text-body-md tabular-nums focus:border-primary focus:ring-2 focus:ring-primary/20" />
        <button type="submit" class="sm:col-span-2 min-h-[44px] px-4 rounded-xl bg-primary text-on-primary hover:bg-primary-hover font-label text-label-md shadow-sm">Lọc đơn</button>
      </form>

      <div id="a07Table">${renderTableSkeleton(5)}</div>
      <div id="a07Pag"></div>
    `,
  });

  const load = async () => {
    const wrap = main.querySelector<HTMLElement>('#a07Table')!;
    const pag = main.querySelector<HTMLElement>('#a07Pag')!;
    beginAsyncRender(wrap, renderTableSkeleton(5));
    pag.innerHTML = '';

    try {
      const res = await bookingsService.listAdminBookings({
        query,
        status,
        serviceDate: serviceDate || undefined,
        page,
        pageSize: 10,
      });

      if (res.items.length === 0) {
        finishAsyncRender(
          wrap,
          renderEmptyState({
            icon: 'receipt_long',
            title: 'Không có đơn booking phù hợp',
            description: 'Thử thay đổi bộ lọc ngày, trạng thái hoặc từ khóa tìm kiếm.',
          }),
        );
        return;
      }

      finishAsyncRender(
        wrap,
        `<div class="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
          <div class="table-scroll-wrap">
            <table class="w-full text-left border-collapse min-w-[920px]">
              <thead class="bg-surface-muted border-b border-border font-label text-label-sm text-text-secondary">
                <tr>
                  <th class="px-space-4 py-space-3">Mã đơn / Mã TT</th>
                  <th class="px-space-4 py-space-3">Khách liên hệ</th>
                  <th class="px-space-4 py-space-3">Dịch vụ &amp; Ngày</th>
                  <th class="px-space-4 py-space-3">Tổng tiền</th>
                  <th class="px-space-4 py-space-3">Trạng thái đơn</th>
                  <th class="px-space-4 py-space-3">Thanh toán</th>
                  <th class="px-space-4 py-space-3">Hạn giữ chỗ</th>
                  <th class="px-space-4 py-space-3 text-right">Hỗ trợ</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border font-body text-body-md">
                ${res.items
                  .map(
                    (b) => `
                  <tr class="hover:bg-background">
                    <td class="px-space-4 py-space-3 tabular-nums">
                      <p class="font-label text-primary">${escapeHtml(b.id)}</p>
                      <p class="text-label-sm text-text-secondary">${escapeHtml(b.paymentCode)}</p>
                    </td>
                    <td class="px-space-4 py-space-3">
                      <p class="font-label text-on-surface">${escapeHtml(b.customerName)}</p>
                      <p class="text-label-sm text-text-secondary tabular-nums">${escapeHtml(b.customerPhone)}</p>
                    </td>
                    <td class="px-space-4 py-space-3">
                      <p class="text-on-surface">${escapeHtml(b.serviceName)}</p>
                      <p class="text-label-sm text-text-secondary tabular-nums">${formatDateVi(b.serviceDate)} · ${b.guestCount} khách</p>
                    </td>
                    <td class="px-space-4 py-space-3 font-label text-on-surface tabular-nums">${formatVnd(b.totalAmountVnd)}</td>
                    <td class="px-space-4 py-space-3">${renderBookingStatusBadge(b.status)}</td>
                    <td class="px-space-4 py-space-3">${renderPaymentStatusBadge(b.paymentStatus)}</td>
                    <td class="px-space-4 py-space-3 text-label-sm text-text-secondary tabular-nums">${formatDateTimeVi(b.expiresAt)}</td>
                    <td class="px-space-4 py-space-3 text-right">
                      <a href="/quan-tri/booking/${encodeURIComponent(b.id)}" class="min-h-[40px] px-space-3 rounded border border-primary text-primary hover:bg-primary-light font-label text-label-sm inline-flex items-center">Chi tiết</a>
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
      finishAsyncRender(wrap, renderErrorBanner(toUserErrorMessage(err), 'retryA07'));
      wrap.querySelector('#retryA07')?.addEventListener('click', () => void load());
    }
  };

  const applyA07Filters = () => {
    query = main.querySelector<HTMLInputElement>('#a07Q')?.value.trim() ?? '';
    status = (main.querySelector<HTMLSelectElement>('#a07Status')?.value ?? 'ALL') as BookingStatus | 'ALL';
    serviceDate = main.querySelector<HTMLInputElement>('#a07Date')?.value ?? '';
    page = 1;
    void load();
  };

  main.querySelector<HTMLFormElement>('#a07Form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    applyA07Filters();
  });
  main.querySelectorAll('#a07Status, #a07Date').forEach((el) => {
    el.addEventListener('change', applyA07Filters);
  });

  await load();
}
