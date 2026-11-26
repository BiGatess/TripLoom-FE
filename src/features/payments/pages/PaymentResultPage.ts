import type { RouteContext } from '@/app/router';
import { isAppError, toUserErrorMessage } from '@/api/errors';
import { paymentsService } from '@/features/payments/payments.service';
import { renderErrorPage } from '@/features/system/pages/ErrorPage';
import { renderMemberShell } from '@/layouts/member/MemberShell';
import { renderErrorBanner, renderLoadingSkeleton } from '@/shared/components/EmptyErrorState';
import { renderBookingStatusBadge, renderPaymentStatusBadge } from '@/shared/components/StatusBadge';
import { escapeHtml } from '@/shared/utils/dom';
import { formatDateTimeVi, formatVnd } from '@/shared/utils/format';

export async function renderPaymentResultPage(ctx: RouteContext): Promise<void> {
  const bookingId = ctx.params.bookingId ?? '';

  const main = renderMemberShell({
    container: ctx.container,
    activeNav: 'bookings',
    contentHtml: `<div id="b05Root">${renderLoadingSkeleton(1)}</div>`,
  });

  const root = main.querySelector<HTMLElement>('#b05Root')!;

  const load = async () => {
    root.innerHTML = renderLoadingSkeleton(1);
    try {
      // Luôn đọc trạng thái thực tế từ service/máy chủ, KHÔNG suy ra từ URL!
      const { booking: bk, payment } = await paymentsService.checkPaymentStatus(bookingId);

      let icon = 'hourglass_top';
      let toneCls = 'bg-warning-bg text-on-warning-bg';
      let heading = 'Đang chờ ngân hàng xác nhận';
      let desc = 'Hệ thống chưa nhận được xác nhận khớp thanh toán từ SePay. Bạn có thể quay lại trang QR nếu đơn vẫn còn hạn giữ chỗ.';

      if (bk.status === 'CONFIRMED' && payment.status === 'PAID') {
        icon = 'check_circle';
        toneCls = 'bg-success-bg text-on-success-bg';
        heading = 'Thanh toán thành công — Đơn đã xác nhận';
        desc = 'Giao dịch SePay đã khớp với đơn dịch vụ của bạn. Thông tin đơn đã được lưu tại mục Đơn dịch vụ.';
      } else if (payment.status === 'NEEDS_REVIEW') {
        icon = 'warning';
        toneCls = 'bg-error-bg text-on-error-bg';
        heading = 'Giao dịch cần đối soát thủ công';
        desc =
          'Hệ thống ghi nhận giao dịch chuyển tiền muộn, thiếu hoặc thừa tiền. Đơn không tự mở lại và không có hoàn tiền tự động; Quản trị viên sẽ kiểm tra và hỗ trợ xử lý.';
      } else if (bk.status === 'EXPIRED') {
        icon = 'timer_off';
        toneCls = 'bg-error-bg text-on-error-bg';
        heading = 'Đơn dịch vụ đã hết hạn giữ chỗ';
        desc = 'Quá thời hạn 15 phút mà chưa có xác nhận thanh toán hợp lệ. Chỗ giữ tạm đã được nhả; vui lòng tạo đơn mới nếu bạn vẫn muốn đặt dịch vụ.';
      } else if (bk.status === 'CANCELLED') {
        icon = 'cancel';
        toneCls = 'bg-surface-muted text-on-surface-muted';
        heading = 'Đơn dịch vụ đã bị hủy';
        desc = 'Đơn này đã được hủy và không còn tiếp nhận thanh toán.';
      }

      root.innerHTML = `
        <section class="max-w-2xl mx-auto w-full bg-surface border border-border rounded-xl p-space-6 md:p-space-8 shadow-sm flex flex-col items-center text-center gap-space-4">
          <span class="w-16 h-16 rounded-full ${toneCls} inline-flex items-center justify-center">
            <span class="material-symbols-outlined text-[32px]">${icon}</span>
          </span>
          <div class="flex flex-wrap items-center justify-center gap-space-2">
            ${renderBookingStatusBadge(bk.status)}
            ${renderPaymentStatusBadge(payment.status)}
          </div>
          <h1 class="font-headline text-headline-lg text-on-surface">${escapeHtml(heading)}</h1>
          <p class="font-body text-body-lg text-text-secondary">${escapeHtml(desc)}</p>

          <dl class="w-full text-left bg-background border border-border rounded-lg p-space-4 flex flex-col gap-space-2 font-body text-body-md">
            <div class="flex justify-between">
              <dt class="text-text-secondary">Mã đơn dịch vụ</dt>
              <dd class="font-label text-primary tabular-nums">${escapeHtml(bk.id)}</dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-text-secondary">Mã thanh toán</dt>
              <dd class="font-label text-on-surface tabular-nums">${escapeHtml(payment.paymentCode)}</dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-text-secondary">Số tiền đơn hàng</dt>
              <dd class="font-label text-on-surface tabular-nums">${formatVnd(payment.expectedAmountVnd)}</dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-text-secondary">Số tiền đã ghi nhận</dt>
              <dd class="font-label text-on-surface tabular-nums">${formatVnd(payment.receivedAmountVnd)}</dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-text-secondary">Cập nhật từ máy chủ lúc</dt>
              <dd class="font-label text-on-surface tabular-nums">${formatDateTimeVi(payment.updatedAt)}</dd>
            </div>
          </dl>

          <div class="flex flex-wrap items-center justify-center gap-space-3 pt-space-2">
            <a href="/don-dich-vu/${encodeURIComponent(bk.id)}" class="inline-flex items-center justify-center min-h-[44px] px-space-6 rounded bg-primary text-on-primary hover:bg-primary-hover font-label text-label-md">Xem chi tiết đơn</a>
            ${
              bk.status === 'PENDING_PAYMENT'
                ? `<a href="/thanh-toan/${encodeURIComponent(bk.id)}" class="inline-flex items-center justify-center min-h-[44px] px-space-4 rounded border border-primary text-primary hover:bg-primary-light font-label text-label-md">Quay lại trang QR</a>`
                : ''
            }
            ${
              bk.status === 'EXPIRED' || bk.status === 'CANCELLED'
                ? `<a href="/dat-dich-vu/${encodeURIComponent(bk.serviceId)}" class="inline-flex items-center justify-center min-h-[44px] px-space-4 rounded border border-primary text-primary hover:bg-primary-light font-label text-label-md">Đặt lại đơn mới</a>`
                : ''
            }
            <a href="/don-dich-vu" class="inline-flex items-center justify-center min-h-[44px] px-space-4 rounded border border-border bg-surface text-on-surface hover:bg-surface-muted font-label text-label-md">Danh sách đơn</a>
          </div>
        </section>
      `;
    } catch (err) {
      if (isAppError(err) && (err.code === 'NOT_FOUND' || err.code === 'FORBIDDEN')) {
        renderErrorPage(ctx, { code: err.code === 'FORBIDDEN' ? '403' : '404', description: err.message });
        return;
      }
      root.innerHTML = renderErrorBanner(toUserErrorMessage(err), 'retryB05');
      root.querySelector('#retryB05')?.addEventListener('click', () => void load());
    }
  };

  await load();
}
