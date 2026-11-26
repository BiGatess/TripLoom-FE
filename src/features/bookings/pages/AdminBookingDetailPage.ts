import type { RouteContext } from '@/app/router';
import { sessionStore } from '@/app/session-store';
import { isAppError, toUserErrorMessage } from '@/api/errors';
import { bookingsService } from '@/features/bookings/bookings.service';
import { renderErrorPage } from '@/features/system/pages/ErrorPage';
import { renderBackofficeShell } from '@/layouts/backoffice/BackofficeShell';
import { renderErrorBanner, renderLoadingSkeleton } from '@/shared/components/EmptyErrorState';
import { openConfirmModal } from '@/shared/components/Modal';
import { renderBookingStatusBadge, renderPaymentStatusBadge } from '@/shared/components/StatusBadge';
import { showToast } from '@/shared/components/Toast';
import { escapeHtml } from '@/shared/utils/dom';
import { formatDateTimeVi, formatDateVi, formatVnd } from '@/shared/utils/format';

export async function renderAdminBookingDetailPage(ctx: RouteContext): Promise<void> {
  const bookingId = ctx.params.id ?? '';
  const isAdmin = sessionStore.user?.role === 'ADMIN';

  const main = renderBackofficeShell({
    container: ctx.container,
    activeNav: 'bookings',
    breadcrumbs: [
      { label: 'Quản trị', href: '/quan-tri' },
      { label: 'Booking', href: '/quan-tri/booking' },
      { label: bookingId },
    ],
    contentHtml: `<div id="a08Root">${renderLoadingSkeleton(2)}</div>`,
  });

  const root = main.querySelector<HTMLElement>('#a08Root')!;

  const load = async () => {
    root.innerHTML = renderLoadingSkeleton(2);
    try {
      const { booking: bk, payment } = await bookingsService.getAdminBookingDetail(bookingId);

      root.innerHTML = `
        <div class="flex flex-col gap-space-6">
          <div class="flex flex-wrap items-center justify-between gap-space-4">
            <div class="flex flex-col gap-space-2">
              <a href="/quan-tri/booking" class="tl-back-btn self-start">
                <span class="tl-back-icon" aria-hidden="true">
                  <span class="material-symbols-outlined text-[16px]">arrow_back</span>
                </span>
                <span>Về danh sách Booking</span>
              </a>
              <div class="flex flex-wrap items-center gap-space-3">
                <h1 class="font-headline text-headline-lg text-on-surface">Hỗ trợ Booking ${escapeHtml(bk.id)}</h1>
                ${renderBookingStatusBadge(bk.status)}
                ${renderPaymentStatusBadge(bk.paymentStatus)}
              </div>
            </div>
            <div class="flex flex-wrap gap-space-2">
              ${
                isAdmin
                  ? `<a href="/quan-tri/nhat-ky?targetId=${encodeURIComponent(bk.id)}" class="min-h-[44px] px-space-4 rounded border border-border bg-surface text-on-surface hover:bg-surface-muted font-label text-label-md inline-flex items-center gap-1"><span class="material-symbols-outlined text-[18px]">history</span>Nhật ký đơn</a>`
                  : ''
              }
              <button type="button" id="a08CancelBtn" ${!bk.canStaffCancel ? 'disabled' : ''} class="min-h-[44px] px-space-4 rounded border border-error text-error hover:bg-error-bg disabled:opacity-40 disabled:cursor-not-allowed font-label text-label-md">
                Hủy đơn (cần lý do)
              </button>
            </div>
          </div>

          ${
            !bk.canStaffCancel
              ? `<p class="p-space-3 rounded-lg bg-surface-muted text-text-secondary font-body text-body-md">Nút hủy đơn bị vô hiệu vì đơn đã thanh toán, đã hủy, hết hạn hoặc đang có giao dịch cần đối soát. Đơn cần đối soát được xử lý bởi Quản trị viên tại mục Thanh toán &amp; đối soát.</p>`
              : ''
          }

          <div class="grid grid-cols-1 lg:grid-cols-12 gap-space-6 items-start">
            <section class="lg:col-span-7 flex flex-col gap-space-6">
              <div class="bg-surface border border-border rounded-xl p-space-6 shadow-sm flex flex-col gap-space-3">
                <h2 class="font-headline text-headline-md text-on-surface">Thông tin đơn (chỉ đọc giá chụp)</h2>
                <dl class="flex flex-col divide-y divide-border font-body text-body-md">
                  <div class="py-space-2 flex justify-between"><dt class="text-text-secondary">Dịch vụ</dt><dd class="font-label text-on-surface">${escapeHtml(bk.serviceName)} (${escapeHtml(bk.serviceId)})</dd></div>
                  <div class="py-space-2 flex justify-between"><dt class="text-text-secondary">Ngày sử dụng</dt><dd class="font-label tabular-nums">${formatDateVi(bk.serviceDate)}</dd></div>
                  <div class="py-space-2 flex justify-between"><dt class="text-text-secondary">Số khách</dt><dd class="font-label tabular-nums">${bk.guestCount} khách</dd></div>
                  <div class="py-space-2 flex justify-between"><dt class="text-text-secondary">Đơn giá chụp</dt><dd class="font-label tabular-nums">${formatVnd(bk.unitPriceSnapshotVnd)} / khách</dd></div>
                  <div class="py-space-2 flex justify-between"><dt class="text-text-secondary">Tổng tiền</dt><dd class="font-headline text-title-md text-primary tabular-nums">${formatVnd(bk.totalAmountVnd)}</dd></div>
                  <div class="py-space-2 flex justify-between"><dt class="text-text-secondary">Liên hệ khách</dt><dd class="text-on-surface">${escapeHtml(bk.customerName)} · ${escapeHtml(bk.customerPhone)} · ${escapeHtml(bk.customerEmail)}</dd></div>
                  <div class="py-space-2 flex justify-between"><dt class="text-text-secondary">Hạn giữ chỗ</dt><dd class="tabular-nums">${formatDateTimeVi(bk.expiresAt)}</dd></div>
                </dl>
              </div>

              <!-- Support Notes Form -->
              <div class="bg-surface border border-border rounded-xl p-space-6 shadow-sm flex flex-col gap-space-4">
                <h2 class="font-headline text-headline-md text-on-surface">Ghi chú hỗ trợ vận hành</h2>
                <form id="a08NoteForm" class="flex flex-col gap-space-3">
                  <label class="flex flex-col gap-space-1">
                    <span class="font-label text-label-md text-on-surface">Thêm ghi chú mới</span>
                    <textarea id="a08NoteInput" rows="3" placeholder="Ghi nhận trao đổi hỗ trợ với khách hàng (tối thiểu 3 ký tự)..." class="w-full p-space-3 rounded border border-border bg-surface text-body-md"></textarea>
                    <span id="a08NoteErr" class="hidden text-body-md text-error"></span>
                  </label>
                  <button type="submit" id="a08NoteBtn" class="self-end min-h-[44px] px-space-6 rounded bg-primary text-on-primary hover:bg-primary-hover font-label text-label-md">Lưu ghi chú</button>
                </form>

                ${
                  bk.supportNotes.length === 0
                    ? `<p class="font-body text-body-md text-text-secondary">Chưa có ghi chú nội bộ nào cho đơn này.</p>`
                    : `<ul class="flex flex-col gap-space-3 border-t border-border pt-space-4">
                        ${bk.supportNotes
                          .map(
                            (n) => `<li class="p-space-3 rounded-lg bg-background border border-border">
                              <div class="flex justify-between gap-space-2 text-label-sm text-text-secondary">
                                <strong class="text-on-surface">${escapeHtml(n.author)}</strong>
                                <span class="tabular-nums">${formatDateTimeVi(n.createdAt)}</span>
                              </div>
                              <p class="font-body text-body-md text-on-surface mt-space-1">${escapeHtml(n.content)}</p>
                            </li>`,
                          )
                          .join('')}
                      </ul>`
                }
              </div>
            </section>

            <aside class="lg:col-span-5 flex flex-col gap-space-6">
              ${
                payment
                  ? `<section class="bg-surface border border-border rounded-xl p-space-6 shadow-sm flex flex-col gap-space-3">
                       <h2 class="font-headline text-headline-md text-on-surface">Thông tin Payment liên kết</h2>
                       <dl class="flex flex-col gap-space-2 font-body text-body-md">
                         <div class="flex justify-between"><dt class="text-text-secondary">Mã thanh toán</dt><dd class="font-label text-primary tabular-nums">${escapeHtml(payment.paymentCode)}</dd></div>
                         <div class="flex justify-between"><dt class="text-text-secondary">Dự kiến</dt><dd class="font-label tabular-nums">${formatVnd(payment.expectedAmountVnd)}</dd></div>
                         <div class="flex justify-between"><dt class="text-text-secondary">Đã nhận</dt><dd class="font-label tabular-nums">${formatVnd(payment.receivedAmountVnd)}</dd></div>
                       </dl>
                       <a href="/quan-tri/thanh-toan" class="font-label text-label-md text-primary hover:underline">Mở danh sách Thanh toán &amp; SePay</a>
                     </section>`
                  : `<section class="bg-surface border border-border rounded-xl p-space-4 text-body-md text-text-secondary">Tài khoản hiện tại không có quyền xem chi tiết payment.</section>`
              }

              <section class="bg-surface border border-border rounded-xl p-space-6 shadow-sm flex flex-col gap-space-3">
                <h2 class="font-headline text-headline-md text-on-surface">Lịch sử vận hành đơn</h2>
                <ol class="flex flex-col gap-space-3">
                  ${bk.timeline
                    .map(
                      (ev) => `<li class="pl-space-4 border-l-2 border-primary flex flex-col gap-0.5">
                        <span class="text-label-sm text-text-secondary tabular-nums">${formatDateTimeVi(ev.timestamp)} · ${escapeHtml(ev.actor)}</span>
                        <strong class="font-label text-label-md text-on-surface">${escapeHtml(ev.title)}</strong>
                        <p class="font-body text-body-md text-text-secondary">${escapeHtml(ev.detail)}</p>
                      </li>`,
                    )
                    .join('')}
                </ol>
              </section>
            </aside>
          </div>
        </div>
      `;

      root.querySelector<HTMLFormElement>('#a08NoteForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = root.querySelector<HTMLButtonElement>('#a08NoteBtn');
        const input = root.querySelector<HTMLTextAreaElement>('#a08NoteInput');
        const errEl = root.querySelector<HTMLElement>('#a08NoteErr');
        if (!btn || btn.disabled) return;
        const content = input?.value.trim() ?? '';
        errEl?.classList.add('hidden');
        if (content.length < 3) {
          if (errEl) {
            errEl.textContent = 'Ghi chú cần tối thiểu 3 ký tự.';
            errEl.classList.remove('hidden');
          }
          return;
        }
        btn.disabled = true;
        btn.textContent = 'Đang lưu...';
        try {
          await bookingsService.addAdminBookingNote(bk.id, { content });
          showToast('Đã lưu ghi chú hỗ trợ vào nhật ký đơn.', 'success');
          await load();
        } catch (err) {
          showToast(toUserErrorMessage(err), 'error');
          btn.disabled = false;
          btn.textContent = 'Lưu ghi chú';
        }
      });

      root.querySelector('#a08CancelBtn')?.addEventListener('click', () => {
        if (!bk.canStaffCancel) return;
        openConfirmModal({
          title: `Hủy đơn booking ${bk.id}?`,
          description: 'Thao tác hủy sẽ giải phóng chỗ giữ tạm và ghi nhận vào nhật ký vận hành. Nếu webhook thanh toán vừa đến, máy chủ sẽ từ chối hủy.',
          confirmLabel: 'Xác nhận hủy đơn',
          destructive: true,
          requireReason: true,
          reasonLabel: 'Lý do hủy đơn nội bộ',
          onConfirm: async (reason) => {
            await bookingsService.adminCancelBooking(bk.id, { reason });
            showToast(`Đã hủy đơn ${bk.id}.`, 'info');
            await load();
          },
        });
      });
    } catch (err) {
      if (isAppError(err) && (err.code === 'NOT_FOUND' || err.code === 'FORBIDDEN')) {
        renderErrorPage(ctx, { code: err.code === 'FORBIDDEN' ? '403' : '404', description: err.message });
        return;
      }
      root.innerHTML = renderErrorBanner(toUserErrorMessage(err), 'retryA08');
      root.querySelector('#retryA08')?.addEventListener('click', () => void load());
    }
  };

  await load();
}
