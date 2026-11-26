import type { RouteContext } from '@/app/router';
import { isAppError, toUserErrorMessage } from '@/api/errors';
import { bookingsService } from '@/features/bookings/bookings.service';
import { renderErrorPage } from '@/features/system/pages/ErrorPage';
import { renderMemberShell } from '@/layouts/member/MemberShell';
import { renderErrorBanner, renderLoadingSkeleton } from '@/shared/components/EmptyErrorState';
import { openConfirmModal } from '@/shared/components/Modal';
import { renderBookingStatusBadge, renderPaymentStatusBadge } from '@/shared/components/StatusBadge';
import { showToast } from '@/shared/components/Toast';
import { escapeHtml } from '@/shared/utils/dom';
import { formatCountdownMmSs, formatDateTimeVi, formatDateVi, formatVnd, secondsRemaining } from '@/shared/utils/format';

export async function renderBookingDetailPage(ctx: RouteContext): Promise<void> {
  const bookingId = ctx.params.bookingId ?? '';

  const main = renderMemberShell({
    container: ctx.container,
    activeNav: 'bookings',
    contentHtml: `<div id="b03Root">${renderLoadingSkeleton(2)}</div>`,
  });

  const root = main.querySelector<HTMLElement>('#b03Root')!;

  const load = async () => {
    root.innerHTML = renderLoadingSkeleton(2);
    try {
      const { booking: bk, payment } = await bookingsService.getMyBookingDetail(bookingId);

      const isConfirmed = bk.status === 'CONFIRMED';
      const isPending = bk.status === 'PENDING_PAYMENT';
      const isFailedOrCancelled = bk.status === 'CANCELLED' || bk.status === 'EXPIRED';

      const headerTintClass =
        bk.paymentStatus === 'NEEDS_REVIEW' || bk.status === 'CANCELLED'
          ? 'bg-error-bg/35 border-error/20'
          : isConfirmed
            ? 'bg-success-bg/35 border-success/20'
            : isPending
              ? 'bg-warning-bg/40 border-warning/25'
              : 'bg-surface-muted border-border';

      const step1Done = true;
      const step2Done = bk.paymentStatus === 'PAID' || isConfirmed;
      const step2Active = isPending && bk.paymentStatus !== 'PAID';
      const step3Done = isConfirmed;

      const stepNodeClass = (done: boolean, active: boolean, alert = false) => {
        if (alert) return 'bg-error text-white border-error';
        if (done) return 'bg-primary text-on-primary border-primary';
        if (active) return 'bg-warning text-white border-warning';
        return 'bg-surface text-text-secondary border-border';
      };

      const step3Label =
        bk.status === 'CANCELLED'
          ? 'Đơn đã hủy'
          : bk.status === 'EXPIRED'
            ? 'Hết hạn giữ chỗ'
            : bk.paymentStatus === 'NEEDS_REVIEW'
              ? 'Cần đối soát'
              : 'Xác nhận dịch vụ';

      root.innerHTML = `
        <div class="flex flex-col gap-space-6">
          <!-- Top Bar -->
          <div class="flex flex-wrap items-center justify-between gap-space-3">
            <a href="/don-dich-vu" class="tl-back-btn">
              <span class="tl-back-icon" aria-hidden="true">
                <span class="material-symbols-outlined text-[16px]">arrow_back</span>
              </span>
              <span>Về danh sách đơn của tôi</span>
            </a>

            <div class="flex flex-wrap items-center gap-space-2.5">
              <a href="/dich-vu/${encodeURIComponent(bk.serviceId)}" class="inline-flex items-center gap-1.5 min-h-[40px] px-space-4 rounded-lg border border-border bg-surface text-on-surface hover:border-primary hover:text-primary font-label text-label-md no-underline transition-colors">
                <span class="material-symbols-outlined text-[18px]" aria-hidden="true">open_in_new</span>
                <span>Xem dịch vụ</span>
              </a>
              ${
                isPending
                  ? `<a href="/thanh-toan/${encodeURIComponent(bk.id)}" class="inline-flex items-center justify-center gap-space-2 min-h-[40px] px-space-5 rounded-lg bg-primary text-on-primary hover:bg-primary-hover font-label text-label-md no-underline shadow-sm">
                       <span class="material-symbols-outlined text-[18px]" aria-hidden="true">qr_code_2</span>
                       <span>Thanh toán QR</span>
                     </a>`
                  : ''
              }
              ${
                bk.canCustomerCancel
                  ? `<button type="button" id="b03CancelBtn" class="min-h-[40px] px-space-4 rounded-lg border border-error text-error hover:bg-error-bg font-label text-label-md transition-colors">Hủy đơn</button>`
                  : ''
              }
              ${
                isFailedOrCancelled
                  ? `<a href="/dat-dich-vu/${encodeURIComponent(bk.serviceId)}" class="inline-flex items-center gap-1.5 min-h-[40px] px-space-5 rounded-lg bg-primary text-on-primary hover:bg-primary-hover font-label text-label-md no-underline shadow-sm">
                       <span class="material-symbols-outlined text-[18px]" aria-hidden="true">replay</span>
                       <span>Đặt lại đơn mới</span>
                     </a>`
                  : ''
              }
            </div>
          </div>

          <!-- Order Hero Summary & Stepper -->
          <section class="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
            <div class="p-space-5 md:p-space-6 border-b ${headerTintClass} flex flex-col lg:flex-row lg:items-center justify-between gap-space-4">
              <div class="flex flex-col gap-space-2 min-w-0">
                <div class="flex flex-wrap items-center gap-space-2">
                  <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-surface border border-border font-label text-label-sm text-on-surface tabular-nums">
                    Mã đơn: <strong>${escapeHtml(bk.id)}</strong>
                  </span>
                  ${renderBookingStatusBadge(bk.status)}
                  <span class="font-body text-label-sm text-text-secondary tabular-nums">· Tạo lúc ${formatDateTimeVi(bk.createdAt)}</span>
                </div>
                <h1 class="font-headline text-headline-lg text-on-surface leading-snug">
                  <a href="/dich-vu/${encodeURIComponent(bk.serviceId)}" class="text-on-surface hover:text-primary no-underline transition-colors">${escapeHtml(bk.serviceName)}</a>
                </h1>
                <div class="flex flex-wrap items-center gap-x-space-4 gap-y-1 text-body-md text-text-secondary">
                  <a href="/dia-diem/${encodeURIComponent(bk.destinationId)}" class="inline-flex items-center gap-1 text-primary hover:underline no-underline font-label text-label-md">
                    <span class="material-symbols-outlined text-[17px]" aria-hidden="true">location_on</span>
                    <span>${escapeHtml(bk.destinationName)}</span>
                  </a>
                  <span class="inline-flex items-center gap-1">
                    <span class="material-symbols-outlined text-[17px] text-text-secondary" aria-hidden="true">confirmation_number</span>
                    <span>Mã dịch vụ: ${escapeHtml(bk.serviceId)}</span>
                  </span>
                </div>
              </div>

              <div class="flex lg:flex-col lg:items-end justify-between gap-space-2 pt-space-3 lg:pt-0 border-t lg:border-t-0 border-border/60 shrink-0">
                <div class="flex flex-col lg:items-end">
                  <span class="font-label text-label-sm text-text-secondary">Tổng thanh toán</span>
                  <span class="font-headline text-[28px] leading-[34px] font-bold text-primary tabular-nums">${formatVnd(bk.totalAmountVnd)}</span>
                </div>
                ${renderPaymentStatusBadge(payment.status)}
              </div>
            </div>

            <!-- 3-Step Booking Lifecycle + Quick Metrics -->
            <div class="p-space-5 md:p-space-6 flex flex-col gap-space-5">
              <div class="grid grid-cols-1 md:grid-cols-3 gap-space-3 items-center">
                <div class="flex items-center gap-space-3 p-space-3 rounded-lg bg-background border border-border">
                  <span class="w-8 h-8 rounded-full border inline-flex items-center justify-center shrink-0 ${stepNodeClass(step1Done, false)}">
                    <span class="material-symbols-outlined text-[18px]" aria-hidden="true">check</span>
                  </span>
                  <div class="min-w-0">
                    <p class="font-label text-label-md text-on-surface">1. Tạo đơn giữ chỗ</p>
                    <p class="font-body text-label-sm text-text-secondary truncate">${formatDateTimeVi(bk.createdAt)}</p>
                  </div>
                </div>

                <div class="flex items-center gap-space-3 p-space-3 rounded-lg bg-background border border-border">
                  <span class="w-8 h-8 rounded-full border inline-flex items-center justify-center shrink-0 ${stepNodeClass(step2Done, step2Active, bk.paymentStatus === 'NEEDS_REVIEW')}">
                    <span class="material-symbols-outlined text-[18px]" aria-hidden="true">${step2Done ? 'check' : bk.paymentStatus === 'NEEDS_REVIEW' ? 'priority_high' : 'qr_code_2'}</span>
                  </span>
                  <div class="min-w-0">
                    <p class="font-label text-label-md text-on-surface">2. Thanh toán SePay</p>
                    <p class="font-body text-label-sm text-text-secondary truncate">${step2Done ? `Đã nhận ${formatVnd(payment.receivedAmountVnd)}` : step2Active ? 'Đang chờ chuyển khoản QR' : 'Chưa hoàn tất'}</p>
                  </div>
                </div>

                <div class="flex items-center gap-space-3 p-space-3 rounded-lg bg-background border border-border">
                  <span class="w-8 h-8 rounded-full border inline-flex items-center justify-center shrink-0 ${stepNodeClass(step3Done, false, isFailedOrCancelled || bk.paymentStatus === 'NEEDS_REVIEW')}">
                    <span class="material-symbols-outlined text-[18px]" aria-hidden="true">${step3Done ? 'verified' : isFailedOrCancelled ? 'close' : 'hourglass_top'}</span>
                  </span>
                  <div class="min-w-0">
                    <p class="font-label text-label-md text-on-surface">3. ${step3Label}</p>
                    <p class="font-body text-label-sm text-text-secondary truncate">${step3Done ? 'Sẵn sàng trải nghiệm' : isFailedOrCancelled ? 'Đơn không còn hiệu lực' : 'Chờ hoàn tất thanh toán'}</p>
                  </div>
                </div>
              </div>

              <div class="grid grid-cols-2 lg:grid-cols-4 gap-space-3">
                <div class="p-space-3.5 rounded-lg bg-surface-muted/60 border border-border flex items-start gap-space-2.5">
                  <span class="material-symbols-outlined text-[20px] text-primary shrink-0 mt-0.5" aria-hidden="true">calendar_today</span>
                  <div class="min-w-0">
                    <p class="font-label text-label-sm text-text-secondary">Ngày sử dụng</p>
                    <p class="font-title text-title-md text-on-surface tabular-nums">${formatDateVi(bk.serviceDate)}</p>
                  </div>
                </div>

                <div class="p-space-3.5 rounded-lg bg-surface-muted/60 border border-border flex items-start gap-space-2.5">
                  <span class="material-symbols-outlined text-[20px] text-primary shrink-0 mt-0.5" aria-hidden="true">group</span>
                  <div class="min-w-0">
                    <p class="font-label text-label-sm text-text-secondary">Số lượng khách</p>
                    <p class="font-title text-title-md text-on-surface tabular-nums">${bk.guestCount} khách</p>
                  </div>
                </div>

                <div class="p-space-3.5 rounded-lg bg-surface-muted/60 border border-border flex items-start gap-space-2.5">
                  <span class="material-symbols-outlined text-[20px] text-primary shrink-0 mt-0.5" aria-hidden="true">receipt</span>
                  <div class="min-w-0">
                    <p class="font-label text-label-sm text-text-secondary">Mã thanh toán</p>
                    <p class="font-title text-title-md text-primary tabular-nums truncate">${escapeHtml(payment.paymentCode)}</p>
                  </div>
                </div>

                <div class="p-space-3.5 rounded-lg bg-surface-muted/60 border border-border flex items-start gap-space-2.5">
                  <span class="material-symbols-outlined text-[20px] text-primary shrink-0 mt-0.5" aria-hidden="true">schedule</span>
                  <div class="min-w-0">
                    <p class="font-label text-label-sm text-text-secondary">Hạn giữ chỗ (15 phút)</p>
                    <p class="font-title text-title-md text-on-surface tabular-nums truncate">${formatDateTimeVi(payment.expiresAt)}</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          ${
            bk.paymentStatus === 'NEEDS_REVIEW'
              ? `<div role="alert" class="p-space-4 rounded-xl bg-error-bg border border-error/30 text-on-error-bg font-body text-body-md flex items-start gap-space-3">
                   <span class="material-symbols-outlined text-[22px] shrink-0 mt-0.5" aria-hidden="true">report</span>
                   <div>
                     <strong>Giao dịch đang ở trạng thái Cần đối soát:</strong> Hệ thống ghi nhận chuyển khoản sai số tiền, thừa tiền hoặc đến sau thời hạn giữ chỗ. Đơn không tự mở lại và không tự hoàn tiền; Quản trị viên đang kiểm tra đối soát.
                   </div>
                 </div>`
              : ''
          }

          <!-- Detailed Cards -->
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-space-6 items-start">
            <!-- Left: Customer, Service & Invoice Breakdown -->
            <section class="lg:col-span-7 flex flex-col gap-space-6">
              <div class="bg-surface border border-border rounded-xl p-space-6 shadow-sm flex flex-col gap-space-5">
                <div class="flex items-center justify-between border-b border-border pb-space-3">
                  <h2 class="font-headline text-headline-md text-on-surface flex items-center gap-2">
                    <span class="material-symbols-outlined text-[22px] text-primary" aria-hidden="true">assignment</span>
                    <span>Thông tin dịch vụ &amp; liên hệ</span>
                  </h2>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-space-4">
                  <div class="p-space-4 rounded-lg bg-background border border-border flex flex-col gap-space-2">
                    <span class="font-label text-label-sm text-text-secondary uppercase tracking-wide">Dịch vụ đã đặt</span>
                    <p class="font-title text-title-md text-on-surface">${escapeHtml(bk.serviceName)}</p>
                    <p class="font-body text-body-md text-text-secondary">
                      Địa điểm: <strong class="text-on-surface">${escapeHtml(bk.destinationName)}</strong>
                    </p>
                    <div class="pt-space-1">
                      <span class="inline-flex items-center px-2 py-0.5 rounded bg-primary-light text-primary font-label text-label-sm tabular-nums">${escapeHtml(bk.serviceId)}</span>
                    </div>
                  </div>

                  <div class="p-space-4 rounded-lg bg-background border border-border flex flex-col gap-space-2">
                    <span class="font-label text-label-sm text-text-secondary uppercase tracking-wide">Người liên hệ</span>
                    <p class="font-title text-title-md text-on-surface flex items-center gap-1.5">
                      <span class="material-symbols-outlined text-[18px] text-primary" aria-hidden="true">person</span>
                      <span>${escapeHtml(bk.customerName)}</span>
                    </p>
                    <p class="font-body text-body-md text-text-secondary flex items-center gap-1.5 tabular-nums">
                      <span class="material-symbols-outlined text-[17px] text-text-secondary" aria-hidden="true">call</span>
                      <span>${escapeHtml(bk.customerPhone)}</span>
                    </p>
                    ${
                      bk.customerEmail
                        ? `<p class="font-body text-body-md text-text-secondary flex items-center gap-1.5 truncate">
                             <span class="material-symbols-outlined text-[17px] text-text-secondary shrink-0" aria-hidden="true">mail</span>
                             <span class="truncate">${escapeHtml(bk.customerEmail)}</span>
                           </p>`
                        : ''
                    }
                  </div>
                </div>

                <!-- Price Breakdown Box -->
                <div class="rounded-xl bg-surface-muted/60 border border-border p-space-4 flex flex-col gap-space-3">
                  <h3 class="font-label text-label-md text-on-surface">Chi tiết giá dịch vụ</h3>
                  <dl class="flex flex-col gap-space-2 font-body text-body-md">
                    <div class="flex items-center justify-between gap-space-4">
                      <dt class="text-text-secondary">Đơn giá chụp tại thời điểm đặt</dt>
                      <dd class="font-label text-on-surface tabular-nums">${formatVnd(bk.unitPriceSnapshotVnd)} / khách</dd>
                    </div>
                    <div class="flex items-center justify-between gap-space-4">
                      <dt class="text-text-secondary">Số lượng khách áp dụng</dt>
                      <dd class="font-label text-on-surface tabular-nums">× ${bk.guestCount} khách</dd>
                    </div>
                    <div class="pt-space-3 mt-space-1 border-t border-dashed border-border flex items-center justify-between gap-space-4">
                      <dt class="font-title text-title-md text-on-surface">Tổng tiền chính thức</dt>
                      <dd class="font-headline text-headline-md text-primary tabular-nums">${formatVnd(bk.totalAmountVnd)}</dd>
                    </div>
                  </dl>
                </div>

                <div class="p-space-3 rounded-lg bg-primary-light/50 border border-primary/20 flex items-start gap-space-2.5 text-body-md text-on-surface">
                  <span class="material-symbols-outlined text-[19px] text-primary shrink-0 mt-0.5" aria-hidden="true">verified_user</span>
                  <p class="font-body text-body-md text-text-secondary">${escapeHtml(bk.internalNotice)}</p>
                </div>
              </div>
            </section>

            <!-- Right: Payment Summary & Vertical Timeline -->
            <aside class="lg:col-span-5 flex flex-col gap-space-6">
              <section class="bg-surface border border-border rounded-xl p-space-6 shadow-sm flex flex-col gap-space-4">
                <div class="flex items-center justify-between gap-space-2 border-b border-border pb-space-3">
                  <h2 class="font-headline text-headline-md text-on-surface flex items-center gap-2">
                    <span class="material-symbols-outlined text-[22px] text-primary" aria-hidden="true">payments</span>
                    <span>Thanh toán SePay</span>
                  </h2>
                  ${renderPaymentStatusBadge(payment.status)}
                </div>

                ${
                  isPending
                    ? `<p id="b03Countdown" class="p-space-3 rounded-lg bg-warning-bg border border-warning/25 text-on-warning-bg font-label text-label-md tabular-nums flex items-center gap-2">
                         <span class="material-symbols-outlined text-[18px]" aria-hidden="true">timer</span>
                         <span data-countdown-text>Thời gian giữ chỗ còn lại: ${formatCountdownMmSs(secondsRemaining(bk.expiresAt))}</span>
                       </p>`
                    : ''
                }

                <div class="grid grid-cols-2 gap-space-3">
                  <div class="p-space-3 rounded-lg bg-background border border-border">
                    <p class="font-label text-label-sm text-text-secondary">Cần thanh toán</p>
                    <p class="font-title text-title-md text-on-surface tabular-nums mt-0.5">${formatVnd(payment.expectedAmountVnd)}</p>
                  </div>
                  <div class="p-space-3 rounded-lg ${payment.receivedAmountVnd >= payment.expectedAmountVnd ? 'bg-success-bg/45 border-success/25' : 'bg-background border-border'} border">
                    <p class="font-label text-label-sm text-text-secondary">Đã ghi nhận</p>
                    <p class="font-title text-title-md ${payment.receivedAmountVnd >= payment.expectedAmountVnd ? 'text-success' : 'text-on-surface'} tabular-nums mt-0.5">${formatVnd(payment.receivedAmountVnd)}</p>
                  </div>
                </div>

                <dl class="flex flex-col gap-space-2.5 font-body text-body-md pt-space-1">
                  <div class="flex items-center justify-between gap-space-3">
                    <dt class="text-text-secondary">Mã thanh toán</dt>
                    <dd class="font-label text-primary tabular-nums">${escapeHtml(payment.paymentCode)}</dd>
                  </div>
                  <div class="flex items-center justify-between gap-space-3">
                    <dt class="text-text-secondary">Ngân hàng nhận</dt>
                    <dd class="font-label text-on-surface text-right">${escapeHtml(payment.bankName)}</dd>
                  </div>
                  <div class="flex items-center justify-between gap-space-3">
                    <dt class="text-text-secondary">Số tài khoản</dt>
                    <dd class="font-label text-on-surface tabular-nums">${escapeHtml(payment.accountNumberDemo)}</dd>
                  </div>
                  <div class="flex items-center justify-between gap-space-3">
                    <dt class="text-text-secondary">Chủ tài khoản</dt>
                    <dd class="font-label text-on-surface text-right">${escapeHtml(payment.accountName)}</dd>
                  </div>
                </dl>
              </section>

              <section class="bg-surface border border-border rounded-xl p-space-6 shadow-sm flex flex-col gap-space-4">
                <h2 class="font-headline text-headline-md text-on-surface flex items-center gap-2 border-b border-border pb-space-3">
                  <span class="material-symbols-outlined text-[22px] text-primary" aria-hidden="true">history</span>
                  <span>Lịch sử trạng thái đơn</span>
                </h2>
                <ol class="relative flex flex-col gap-space-4 pl-2">
                  ${bk.timeline
                    .map((ev, idx) => {
                      const isLatest = idx === bk.timeline.length - 1;
                      return `
                        <li class="relative pl-7 pb-1 ${idx < bk.timeline.length - 1 ? 'before:content-[\"\"] before:absolute before:left-[10px] before:top-6 before:bottom-[-18px] before:w-[2px] before:bg-border' : ''}">
                          <span class="absolute left-0 top-0.5 w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center ${
                            isLatest ? 'bg-primary border-primary text-on-primary' : 'bg-surface border-primary/60 text-primary'
                          }" aria-hidden="true">
                            <span class="material-symbols-outlined text-[13px]">${isLatest ? 'check' : 'fiber_manual_record'}</span>
                          </span>
                          <div class="flex flex-col gap-0.5">
                            <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                              <span class="font-label text-label-md text-on-surface">${escapeHtml(ev.title)}</span>
                              <span class="px-2 py-0.5 rounded bg-surface-muted text-text-secondary font-label text-[11px]">${escapeHtml(ev.actor)}</span>
                            </div>
                            <span class="font-body text-label-sm text-text-secondary tabular-nums">${formatDateTimeVi(ev.timestamp)}</span>
                            <p class="font-body text-body-md text-text-secondary mt-0.5">${escapeHtml(ev.detail)}</p>
                          </div>
                        </li>
                      `;
                    })
                    .join('')}
                </ol>
              </section>
            </aside>
          </div>
        </div>
      `;

      root.querySelector('#b03CancelBtn')?.addEventListener('click', () => {
        openConfirmModal({
          title: `Hủy đơn dịch vụ ${bk.id}?`,
          description: 'Sau khi hủy, chỗ giữ tạm sẽ được giải phóng và không thể mở lại đơn cũ.',
          confirmLabel: 'Xác nhận hủy đơn',
          destructive: true,
          requireReason: true,
          reasonLabel: 'Lý do hủy đơn',
          onConfirm: async (reason) => {
            await bookingsService.cancelMyBooking(bk.id, { reason });
            showToast(`Đơn ${bk.id} đã chuyển sang trạng thái Đã hủy.`, 'info');
            await load();
          },
        });
      });

      if (bk.status === 'PENDING_PAYMENT') {
        const timer = window.setInterval(() => {
          const el = root.querySelector<HTMLElement>('#b03Countdown');
          if (!el) return;
          const target = el.querySelector<HTMLElement>('[data-countdown-text]') ?? el;
          const sec = secondsRemaining(bk.expiresAt);
          if (sec <= 0) {
            target.textContent = 'Hết thời gian giữ chỗ. Đang kiểm tra trạng thái...';
            window.clearInterval(timer);
            void load();
          } else {
            target.textContent = `Thời gian giữ chỗ còn lại: ${formatCountdownMmSs(sec)}`;
          }
        }, 1000);
        ctx.onCleanup(() => window.clearInterval(timer));
      }
    } catch (err) {
      if (isAppError(err) && (err.code === 'NOT_FOUND' || err.code === 'FORBIDDEN')) {
        renderErrorPage(ctx, { code: err.code === 'FORBIDDEN' ? '403' : '404', description: err.message });
        return;
      }
      root.innerHTML = renderErrorBanner(toUserErrorMessage(err), 'retryB03');
      root.querySelector('#retryB03')?.addEventListener('click', () => void load());
    }
  };

  await load();
}
