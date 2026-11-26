import type { RouteContext } from '@/app/router';
import { toUserErrorMessage } from '@/api/errors';
import type { BookingStatus } from '@/api/contracts';
import { bookingsService } from '@/features/bookings/bookings.service';
import { renderMemberShell } from '@/layouts/member/MemberShell';
import { renderEmptyState, renderErrorBanner, renderTableSkeleton } from '@/shared/components/EmptyErrorState';
import { openConfirmModal } from '@/shared/components/Modal';
import { renderPagination } from '@/shared/components/Pagination';
import { renderBookingStatusBadge, renderPaymentStatusBadge } from '@/shared/components/StatusBadge';
import { showToast } from '@/shared/components/Toast';
import { beginAsyncRender, escapeHtml, finishAsyncRender } from '@/shared/utils/dom';
import { formatCountdownMmSs, formatDateVi, formatVnd, secondsRemaining } from '@/shared/utils/format';

export async function renderMyBookingsPage(ctx: RouteContext): Promise<void> {
  let statusFilter: BookingStatus | 'ALL' = 'ALL';
  let query = '';
  let page = 1;

  const main = renderMemberShell({
    container: ctx.container,
    activeNav: 'bookings',
    contentHtml: `
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-space-4">
        <div>
          <h1 class="font-headline text-headline-lg text-on-surface">Đơn dịch vụ của tôi</h1>
          <p class="font-body text-body-md text-text-secondary">Theo dõi trạng thái đơn và trạng thái thanh toán SePay tách biệt.</p>
        </div>
        <a href="/dia-diem" class="inline-flex items-center justify-center min-h-[44px] px-space-6 rounded bg-primary text-on-primary hover:bg-primary-hover font-label text-label-md">Khám phá dịch vụ</a>
      </div>

      <form id="b02FilterForm" class="bg-surface border border-border rounded-xl shadow-sm p-4 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
        <div class="sm:col-span-6 relative flex items-center">
          <span class="material-symbols-outlined text-[20px] text-text-secondary absolute left-3.5 pointer-events-none" aria-hidden="true">search</span>
          <input id="b02Query" type="search" placeholder="Tìm mã đơn, mã thanh toán hoặc tên dịch vụ..." class="w-full min-h-[44px] pl-10 pr-4 rounded-xl border border-border bg-surface text-body-md focus:border-primary focus:ring-2 focus:ring-primary/20" />
        </div>
        <select id="b02Status" class="sm:col-span-4 min-h-[44px] px-space-3 rounded-xl border border-border bg-surface text-body-md">
          <option value="ALL">Tất cả trạng thái đơn</option>
          <option value="PENDING_PAYMENT">Chờ thanh toán</option>
          <option value="CONFIRMED">Đã xác nhận</option>
          <option value="EXPIRED">Hết hạn</option>
          <option value="CANCELLED">Đã hủy</option>
        </select>
        <button type="submit" class="sm:col-span-2 min-h-[44px] px-4 rounded-xl bg-primary text-on-primary hover:bg-primary-hover font-label text-label-md shadow-sm">Lọc</button>
      </form>

      <div id="b02List">${renderTableSkeleton(4)}</div>
      <div id="b02Pag"></div>
    `,
  });

  const load = async () => {
    const listEl = main.querySelector<HTMLElement>('#b02List')!;
    const pagEl = main.querySelector<HTMLElement>('#b02Pag')!;
    beginAsyncRender(listEl, renderTableSkeleton(4));
    pagEl.innerHTML = '';

    try {
      const res = await bookingsService.listMyBookings({ query, status: statusFilter, page, pageSize: 6 });
      if (res.items.length === 0) {
        finishAsyncRender(
          listEl,
          renderEmptyState({
            icon: 'receipt_long',
            title: 'Chưa có đơn dịch vụ nào phù hợp',
            description: 'Các đơn đặt trải nghiệm của tài khoản bạn sẽ hiển thị tại đây.',
            actionHref: '/dia-diem',
            actionLabel: 'Khám phá địa điểm & dịch vụ',
          }),
        );
        return;
      }

      finishAsyncRender(
        listEl,
        `<div class="flex flex-col gap-space-4">
          ${res.items
            .map(
              (bk) => `
            <article class="bg-surface border border-border rounded-xl p-space-6 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-space-4">
              <div class="flex flex-col gap-space-2 min-w-0">
                <div class="flex flex-wrap items-center gap-space-2">
                  <span class="font-label text-label-md text-primary tabular-nums">${escapeHtml(bk.id)}</span>
                  <span class="text-border">·</span>
                  <span class="font-label text-label-sm text-text-secondary tabular-nums">Mã TT: ${escapeHtml(bk.paymentCode)}</span>
                  ${renderBookingStatusBadge(bk.status)}
                  ${renderPaymentStatusBadge(bk.paymentStatus)}
                </div>
                <h2 class="font-title text-title-md text-on-surface">${escapeHtml(bk.serviceName)}</h2>
                <p class="font-body text-body-md text-text-secondary tabular-nums">
                  Ngày sử dụng: <strong class="text-on-surface">${formatDateVi(bk.serviceDate)}</strong> · ${bk.guestCount} khách · Tổng tiền: <strong class="text-primary">${formatVnd(bk.totalAmountVnd)}</strong>
                </p>
                ${
                  bk.status === 'PENDING_PAYMENT'
                    ? `<p data-b02-countdown="${escapeHtml(bk.expiresAt)}" class="font-label text-label-sm text-warning tabular-nums">Thời gian giữ chỗ còn lại: ${formatCountdownMmSs(secondsRemaining(bk.expiresAt))}</p>`
                    : ''
                }
              </div>

              <div class="flex flex-wrap items-center gap-space-2 shrink-0">
                <a href="/don-dich-vu/${encodeURIComponent(bk.id)}" class="inline-flex items-center justify-center min-h-[44px] px-space-4 rounded border border-border bg-surface text-on-surface hover:bg-surface-muted font-label text-label-md">Chi tiết</a>
                ${
                  bk.status === 'PENDING_PAYMENT'
                    ? `<a href="/thanh-toan/${encodeURIComponent(bk.id)}" class="inline-flex items-center justify-center min-h-[44px] px-space-4 rounded bg-primary text-on-primary hover:bg-primary-hover font-label text-label-md">Tiếp tục thanh toán</a>`
                    : ''
                }
                ${
                  bk.canCustomerCancel
                    ? `<button type="button" data-cancel-bk="${escapeHtml(bk.id)}" class="min-h-[44px] px-space-4 rounded border border-error text-error hover:bg-error-bg font-label text-label-md">Hủy đơn</button>`
                    : ''
                }
              </div>
            </article>
          `,
            )
            .join('')}
        </div>`,
      );

      listEl.querySelectorAll<HTMLButtonElement>('[data-cancel-bk]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const bkId = btn.dataset.cancelBk!;
          openConfirmModal({
            title: `Hủy đơn dịch vụ ${bkId}?`,
            description: 'Chỗ giữ tạm sẽ được giải phóng ngay. Bạn không thể mở lại đơn sau khi hủy.',
            confirmLabel: 'Xác nhận hủy đơn',
            destructive: true,
            requireReason: true,
            reasonLabel: 'Lý do hủy đơn',
            reasonPlaceholder: 'Ví dụ: Thay đổi kế hoạch di chuyển...',
            onConfirm: async (reason) => {
              await bookingsService.cancelMyBooking(bkId, { reason });
              showToast(`Đã hủy đơn ${bkId}.`, 'info');
              await load();
            },
          });
        });
      });

      pagEl.innerHTML = renderPagination(res.page, res.totalPages, res.total);
      pagEl.querySelectorAll<HTMLButtonElement>('[data-page]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const next = Number(btn.dataset.page);
          if (next >= 1 && next <= res.totalPages && next !== page) {
            page = next;
            void load();
          }
        });
      });
    } catch (err) {
      finishAsyncRender(listEl, renderErrorBanner(toUserErrorMessage(err), 'retryB02'));
      listEl.querySelector('#retryB02')?.addEventListener('click', () => void load());
    }
  };

  const applyB02Filters = () => {
    query = main.querySelector<HTMLInputElement>('#b02Query')?.value.trim() ?? '';
    statusFilter = (main.querySelector<HTMLSelectElement>('#b02Status')?.value ?? 'ALL') as BookingStatus | 'ALL';
    page = 1;
    void load();
  };

  main.querySelector<HTMLFormElement>('#b02FilterForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    applyB02Filters();
  });
  main.querySelector('#b02Status')?.addEventListener('change', applyB02Filters);

  const timer = window.setInterval(() => {
    main.querySelectorAll<HTMLElement>('[data-b02-countdown]').forEach((el) => {
      const sec = secondsRemaining(el.dataset.b02Countdown);
      el.textContent = sec > 0 ? `Thời gian giữ chỗ còn lại: ${formatCountdownMmSs(sec)}` : 'Đã hết hạn giữ chỗ (tải lại để cập nhật)';
    });
  }, 1000);
  ctx.onCleanup(() => window.clearInterval(timer));

  await load();
}
