import type { RouteContext } from '@/app/router';
import { isAppError, toUserErrorMessage } from '@/api/errors';
import { paymentsService } from '@/features/payments/payments.service';
import { renderErrorPage } from '@/features/system/pages/ErrorPage';
import { renderMemberShell } from '@/layouts/member/MemberShell';
import { renderErrorBanner, renderLoadingSkeleton } from '@/shared/components/EmptyErrorState';
import { renderBookingStatusBadge, renderPaymentStatusBadge } from '@/shared/components/StatusBadge';
import { showToast } from '@/shared/components/Toast';
import { copyToClipboard, escapeHtml } from '@/shared/utils/dom';
import { formatCountdownMmSs, formatDateVi, formatVnd, secondsRemaining } from '@/shared/utils/format';

export async function renderPaymentQrPage(ctx: RouteContext): Promise<void> {
  const bookingId = ctx.params.bookingId ?? '';

  const main = renderMemberShell({
    container: ctx.container,
    activeNav: 'bookings',
    contentHtml: `<div id="b04Root">${renderLoadingSkeleton(2)}</div>`,
  });

  const root = main.querySelector<HTMLElement>('#b04Root')!;
  let activeTimer: number | null = null;
  const clearTimer = () => {
    if (activeTimer !== null) {
      window.clearInterval(activeTimer);
      activeTimer = null;
    }
  };
  ctx.onCleanup(clearTimer);

  const load = async () => {
    clearTimer();
    root.innerHTML = renderLoadingSkeleton(2);
    try {
      const { booking: bk, payment } = await paymentsService.checkPaymentStatus(bookingId);

      // Nếu đơn đã PAID hoặc NEEDS_REVIEW, cho phép xem kết quả ngay hoặc chuyển tới B05
      const isPending = bk.status === 'PENDING_PAYMENT' && payment.status === 'PENDING';
      const remainingSec = secondsRemaining(payment.expiresAt);

      root.innerHTML = `
        <div class="flex flex-col gap-space-6">
          <div class="flex flex-col gap-space-2">
            <a href="/don-dich-vu/${encodeURIComponent(bk.id)}" class="tl-back-btn self-start">
              <span class="tl-back-icon" aria-hidden="true">
                <span class="material-symbols-outlined text-[16px]">arrow_back</span>
              </span>
              <span>Quay lại chi tiết đơn ${escapeHtml(bk.id)}</span>
            </a>
            <div class="flex flex-wrap items-center justify-between gap-space-3">
              <div class="flex flex-wrap items-center gap-space-3">
                <h1 class="font-headline text-headline-lg text-on-surface">Thanh toán QR SePay</h1>
                ${renderBookingStatusBadge(bk.status)}
                ${renderPaymentStatusBadge(payment.status)}
              </div>
              ${
                isPending
                  ? `<span id="b04CountdownPill" class="inline-flex items-center gap-space-2 px-space-4 py-space-2 rounded-full bg-warning-bg text-on-warning-bg font-label text-label-md tabular-nums">
                       <span class="material-symbols-outlined text-[18px]">timer</span>
                       <span>Thời gian giữ chỗ còn <strong id="b04TimerVal">${formatCountdownMmSs(remainingSec)}</strong></span>
                     </span>`
                  : ''
              }
            </div>
          </div>

          ${
            !isPending
              ? `
                <section class="bg-surface border border-border rounded-xl p-space-6 shadow-sm flex flex-col gap-space-4">
                  <div class="p-space-4 rounded-lg ${
                    bk.status === 'CONFIRMED'
                      ? 'bg-success-bg text-on-success-bg'
                      : bk.paymentStatus === 'NEEDS_REVIEW'
                        ? 'bg-error-bg text-on-error-bg'
                        : 'bg-warning-bg text-on-warning-bg'
                  } font-body text-body-md">
                    ${
                      bk.status === 'CONFIRMED'
                        ? 'Đơn dịch vụ đã được xác nhận thanh toán thành công.'
                        : bk.paymentStatus === 'NEEDS_REVIEW'
                          ? 'Hệ thống ghi nhận giao dịch cần đối soát (chuyển tiền muộn, thiếu hoặc thừa tiền). Mã QR cũ không còn hiệu lực thanh toán đơn.'
                          : bk.status === 'EXPIRED'
                            ? 'Đơn đã hết hạn giữ chỗ 15 phút và nhả chỗ. Vui lòng không chuyển khoản theo mã QR cũ (tiền chuyển muộn sẽ phải chuyển đối soát thủ công).'
                            : 'Đơn này đã bị hủy nên mã QR không còn hiệu lực.'
                    }
                  </div>
                  <div class="flex flex-wrap gap-space-3">
                    <a href="/thanh-toan/${encodeURIComponent(bk.id)}/ket-qua" class="inline-flex items-center justify-center min-h-[44px] px-space-6 rounded bg-primary text-on-primary hover:bg-primary-hover font-label text-label-md">Xem trang kết quả thanh toán</a>
                    ${
                      bk.status === 'EXPIRED' || bk.status === 'CANCELLED'
                        ? `<a href="/dat-dich-vu/${encodeURIComponent(bk.serviceId)}" class="inline-flex items-center justify-center min-h-[44px] px-space-6 rounded border border-primary text-primary hover:bg-primary-light font-label text-label-md">Đặt lại đơn mới</a>`
                        : ''
                    }
                  </div>
                </section>
              `
              : `
                <div class="grid grid-cols-1 lg:grid-cols-12 gap-space-6 items-start">
                  <!-- Left QR Placeholder Card (NO real QR / bank account!) -->
                  <section class="lg:col-span-5 bg-surface border border-border rounded-xl p-space-6 shadow-sm flex flex-col items-center gap-space-4 text-center">
                    <div class="inline-flex items-center gap-space-2 px-space-3 py-space-1 rounded-full bg-primary-light text-primary font-label text-label-sm">
                      <span class="material-symbols-outlined text-[16px]">qr_code_scanner</span>
                      <span>VietQR · SePay (Minh họa)</span>
                    </div>

                    <div class="p-space-4 bg-surface border-2 border-dashed border-primary/40 rounded-lg flex flex-col items-center gap-space-2">
                      <svg width="200" height="200" viewBox="0 0 200 200" fill="none" role="img" aria-label="QR minh họa cho đơn ${escapeHtml(bk.id)}">
                        <rect width="200" height="200" fill="#FFFFFF"></rect>
                        <rect x="12" y="12" width="52" height="52" rx="6" stroke="#0F172A" stroke-width="8"></rect>
                        <rect x="28" y="28" width="20" height="20" rx="2" fill="#0F766E"></rect>
                        <rect x="136" y="12" width="52" height="52" rx="6" stroke="#0F172A" stroke-width="8"></rect>
                        <rect x="152" y="28" width="20" height="20" rx="2" fill="#0F766E"></rect>
                        <rect x="12" y="136" width="52" height="52" rx="6" stroke="#0F172A" stroke-width="8"></rect>
                        <rect x="28" y="152" width="20" height="20" rx="2" fill="#0F766E"></rect>
                        <rect x="78" y="22" width="14" height="14" fill="#0F172A"></rect>
                        <rect x="104" y="22" width="14" height="14" fill="#0F172A"></rect>
                        <rect x="78" y="48" width="40" height="14" fill="#0F766E"></rect>
                        <rect x="22" y="84" width="156" height="32" rx="6" fill="#E6F5F2"></rect>
                        <text x="100" y="105" text-anchor="middle" font-family="Be Vietnam Pro, Arial, sans-serif" font-size="13" font-weight="700" fill="#0F766E">QR MINH HỌA</text>
                        <rect x="78" y="132" width="18" height="18" fill="#0F172A"></rect>
                        <rect x="108" y="132" width="18" height="18" fill="#0F172A"></rect>
                        <rect x="142" y="132" width="38" height="18" fill="#0F172A"></rect>
                        <rect x="78" y="162" width="48" height="18" fill="#0F172A"></rect>
                        <rect x="142" y="162" width="24" height="18" fill="#0F766E"></rect>
                      </svg>
                      <span class="font-label text-label-sm text-warning">${escapeHtml(payment.qrPlaceholderLabel)}</span>
                    </div>

                    <div class="flex flex-col gap-space-1">
                      <span class="font-body text-body-md text-text-secondary">Số tiền cần thanh toán</span>
                      <span class="font-display text-display-lg-mobile text-primary tabular-nums">${formatVnd(payment.expectedAmountVnd)}</span>
                    </div>

                    <p class="font-body text-body-md text-text-secondary">
                      Đang chờ ngân hàng xác nhận qua SePay Webhook. Tải lại hoặc đóng trang không làm mất webhook và không tạo lại 15 phút giữ chỗ.
                    </p>
                  </section>

                  <!-- Right Manual Transfer Info + Status Check -->
                  <aside class="lg:col-span-7 flex flex-col gap-space-6">
                    <section class="bg-surface border border-border rounded-xl p-space-6 shadow-sm flex items-center justify-between gap-space-4">
                      <div class="flex flex-col gap-space-1 min-w-0">
                        <span class="font-label text-label-sm text-primary tabular-nums">Đơn dịch vụ ${escapeHtml(bk.id)}</span>
                        <h2 class="font-title text-title-md text-on-surface">${escapeHtml(bk.serviceName)}</h2>
                        <p class="font-body text-body-md text-text-secondary tabular-nums">${formatDateVi(bk.serviceDate)} · ${bk.guestCount} khách</p>
                      </div>
                      <span class="font-headline text-headline-md text-on-surface tabular-nums shrink-0">${formatVnd(bk.totalAmountVnd)}</span>
                    </section>

                    <section class="bg-surface border border-border rounded-xl p-space-6 shadow-sm flex flex-col gap-space-4">
                      <h2 class="font-headline text-headline-md text-on-surface">Thông tin chuyển khoản minh họa</h2>
                      <dl class="flex flex-col divide-y divide-border font-body text-body-md">
                        <div class="py-space-3 flex items-center justify-between gap-space-4">
                          <dt class="text-text-secondary">Ngân hàng nhận</dt>
                          <dd class="font-label text-on-surface text-right">${escapeHtml(payment.bankName)}</dd>
                        </div>
                        <div class="py-space-3 flex items-center justify-between gap-space-4">
                          <dt class="text-text-secondary">Chủ tài khoản</dt>
                          <dd class="font-label text-on-surface text-right">${escapeHtml(payment.accountName)}</dd>
                        </div>
                        <div class="py-space-3 flex items-center justify-between gap-space-4">
                          <dt class="text-text-secondary">Số tài khoản minh họa</dt>
                          <dd class="flex items-center gap-space-2">
                            <span class="font-label text-on-surface tabular-nums">${escapeHtml(payment.accountNumberDemo)}</span>
                            <button type="button" data-copy="000012345678" aria-label="Sao chép số tài khoản minh họa" class="w-[44px] h-[44px] inline-flex items-center justify-center rounded border border-border text-primary hover:bg-primary-light">
                              <span class="material-symbols-outlined text-[18px]">content_copy</span>
                            </button>
                          </dd>
                        </div>
                        <div class="py-space-3 flex items-center justify-between gap-space-4">
                          <dt class="text-text-secondary">Số tiền chính xác</dt>
                          <dd class="flex items-center gap-space-2">
                            <span class="font-label text-on-surface tabular-nums">${formatVnd(payment.expectedAmountVnd)}</span>
                            <button type="button" data-copy="${payment.expectedAmountVnd}" aria-label="Sao chép số tiền" class="w-[44px] h-[44px] inline-flex items-center justify-center rounded border border-border text-primary hover:bg-primary-light">
                              <span class="material-symbols-outlined text-[18px]">content_copy</span>
                            </button>
                          </dd>
                        </div>
                        <div class="py-space-3 flex items-center justify-between gap-space-4">
                          <dt class="text-text-secondary">Nội dung chuyển khoản</dt>
                          <dd class="flex items-center gap-space-2">
                            <strong class="font-headline text-title-md text-primary tabular-nums">${escapeHtml(payment.paymentCode)}</strong>
                            <button type="button" data-copy="${escapeHtml(payment.paymentCode)}" aria-label="Sao chép nội dung chuyển khoản" class="w-[44px] h-[44px] inline-flex items-center justify-center rounded border border-border text-primary hover:bg-primary-light">
                              <span class="material-symbols-outlined text-[18px]">content_copy</span>
                            </button>
                          </dd>
                        </div>
                      </dl>

                      <div class="p-space-3 rounded-lg bg-info-bg/70 text-on-info-bg font-body text-label-sm">
                        Hệ thống chỉ cập nhật trạng thái <strong>Đã thanh toán</strong> khi nhận xác nhận hợp lệ từ máy chủ SePay. Nút bên dưới chỉ dùng để tra cứu trạng thái hiện tại trên máy chủ.
                      </div>

                      <div class="flex flex-wrap items-center gap-space-3 pt-space-2">
                        <button type="button" id="checkPaymentBtn" class="flex-1 min-h-[44px] px-space-6 rounded bg-primary text-on-primary hover:bg-primary-hover font-label text-label-lg inline-flex items-center justify-center gap-space-2 transition-colors">
                          <span class="material-symbols-outlined text-[20px]">sync</span>
                          <span>Kiểm tra thanh toán</span>
                        </button>
                        <a href="/don-dich-vu/${encodeURIComponent(bk.id)}" class="min-h-[44px] px-space-4 rounded border border-border bg-surface text-on-surface hover:bg-surface-muted font-label text-label-md inline-flex items-center justify-center">Xem đơn</a>
                      </div>
                    </section>
                  </aside>
                </div>
              `
          }
        </div>
      `;

      root.querySelectorAll<HTMLButtonElement>('[data-copy]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const ok = await copyToClipboard(btn.dataset.copy ?? '');
          showToast(ok ? 'Đã sao chép vào bộ nhớ tạm.' : 'Không thể sao chép tự động.', ok ? 'success' : 'warning');
        });
      });

      const checkBtn = root.querySelector<HTMLButtonElement>('#checkPaymentBtn');
      checkBtn?.addEventListener('click', async () => {
        if (checkBtn.disabled) return;
        checkBtn.disabled = true;
        checkBtn.textContent = 'Đang tra cứu máy chủ...';
        try {
          const latest = await paymentsService.checkPaymentStatus(bk.id);
          if (latest.booking.status === 'PENDING_PAYMENT' && latest.payment.status === 'PENDING') {
            showToast('Đang chờ ngân hàng xác nhận. Chưa ghi nhận giao dịch khớp.', 'info');
            checkBtn.disabled = false;
            checkBtn.innerHTML = `<span class="material-symbols-outlined text-[20px]">sync</span><span>Kiểm tra thanh toán</span>`;
          } else {
            ctx.navigate(`/thanh-toan/${encodeURIComponent(bk.id)}/ket-qua`);
          }
        } catch (err) {
          showToast(toUserErrorMessage(err), 'error');
          checkBtn.disabled = false;
          checkBtn.innerHTML = `<span class="material-symbols-outlined text-[20px]">sync</span><span>Kiểm tra thanh toán</span>`;
        }
      });

      if (isPending) {
        activeTimer = window.setInterval(() => {
          const sec = secondsRemaining(payment.expiresAt);
          const timerVal = root.querySelector<HTMLElement>('#b04TimerVal');
          if (timerVal) timerVal.textContent = formatCountdownMmSs(sec);
          if (sec <= 0) {
            // Đồng hồ về 00:00 không có nghĩa đã thanh toán! Truy vấn lại máy chủ để xác minh EXPIRED hay PAID
            clearTimer();
            void load();
          }
        }, 1000);
      }
    } catch (err) {
      if (isAppError(err) && (err.code === 'NOT_FOUND' || err.code === 'FORBIDDEN')) {
        renderErrorPage(ctx, { code: err.code === 'FORBIDDEN' ? '403' : '404', description: err.message });
        return;
      }
      root.innerHTML = renderErrorBanner(toUserErrorMessage(err), 'retryB04');
      root.querySelector('#retryB04')?.addEventListener('click', () => void load());
    }
  };

  await load();
}
