import type { RouteContext } from '@/app/router';
import { isAppError, toUserErrorMessage } from '@/api/errors';
import { paymentsService } from '@/features/payments/payments.service';
import { renderErrorPage } from '@/features/system/pages/ErrorPage';
import { renderBackofficeShell } from '@/layouts/backoffice/BackofficeShell';
import { renderErrorBanner, renderLoadingSkeleton } from '@/shared/components/EmptyErrorState';
import {
  renderBookingStatusBadge,
  renderPaymentEventStatusBadge,
  renderPaymentStatusBadge,
} from '@/shared/components/StatusBadge';
import { showToast } from '@/shared/components/Toast';
import { escapeHtml } from '@/shared/utils/dom';
import { formatDateTimeVi, formatVnd } from '@/shared/utils/format';

export async function renderAdminPaymentDetailPage(ctx: RouteContext): Promise<void> {
  const eventId = ctx.params.eventId ?? '';

  const main = renderBackofficeShell({
    container: ctx.container,
    activeNav: 'payments',
    breadcrumbs: [
      { label: 'Quản trị', href: '/quan-tri' },
      { label: 'Thanh toán & đối soát', href: '/quan-tri/thanh-toan' },
      { label: eventId },
    ],
    contentHtml: `<div id="a11Root">${renderLoadingSkeleton(2)}</div>`,
  });

  const root = main.querySelector<HTMLElement>('#a11Root')!;

  const load = async () => {
    root.innerHTML = renderLoadingSkeleton(2);
    try {
      const { event: ev, payment, booking, canReconcile } = await paymentsService.getAdminPaymentEventDetail(eventId);
      const isFinalized = ev.status === 'MATCHED' || ev.status === 'RESOLVED' || ev.status === 'IGNORED';
      const canConfirmPaid =
        Boolean(booking && payment) &&
        booking!.status === 'PENDING_PAYMENT' &&
        new Date(booking!.expiresAt).getTime() > Date.now() &&
        ev.amountReceivedVnd === payment!.expectedAmountVnd;

      root.innerHTML = `
        <div class="flex flex-col gap-space-6">
          <div class="flex flex-wrap items-center justify-between gap-space-4">
            <div class="flex flex-wrap items-center gap-space-3">
              <h1 class="font-headline text-headline-lg text-on-surface">Giao dịch ${escapeHtml(ev.id)}</h1>
              ${renderPaymentEventStatusBadge(ev.status)}
            </div>
            <a href="/quan-tri/thanh-toan" class="tl-back-btn">
              <span class="tl-back-icon" aria-hidden="true">
                <span class="material-symbols-outlined text-[16px]">arrow_back</span>
              </span>
              <span>Quay lại danh sách</span>
            </a>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-12 gap-space-6 items-start">
            <!-- Transaction Details -->
            <section class="lg:col-span-7 bg-surface border border-border rounded-xl p-space-6 shadow-sm flex flex-col gap-space-4">
              <h2 class="font-headline text-headline-md text-on-surface">Thông tin giao dịch nhận được (đã lọc dữ liệu bí mật)</h2>
              <dl class="flex flex-col divide-y divide-border font-body text-body-md">
                <div class="py-space-3 flex justify-between gap-space-4">
                  <dt class="text-text-secondary">Mã tham chiếu SePay</dt>
                  <dd class="font-label text-primary tabular-nums">${escapeHtml(ev.transactionRef)}</dd>
                </div>
                <div class="py-space-3 flex justify-between gap-space-4">
                  <dt class="text-text-secondary">Nội dung chuyển khoản</dt>
                  <dd class="font-label text-on-surface text-right">${escapeHtml(ev.transferContent)}</dd>
                </div>
                <div class="py-space-3 flex justify-between gap-space-4">
                  <dt class="text-text-secondary">Tài khoản nhận đối chiếu</dt>
                  <dd class="font-label text-on-surface tabular-nums">${escapeHtml(ev.receivingAccountDemo)}</dd>
                </div>
                <div class="py-space-3 flex justify-between gap-space-4">
                  <dt class="text-text-secondary">Số tiền thực nhận</dt>
                  <dd class="font-headline text-title-md text-primary tabular-nums">${formatVnd(ev.amountReceivedVnd)}</dd>
                </div>
                <div class="py-space-3 flex justify-between gap-space-4">
                  <dt class="text-text-secondary">Số tiền dự kiến của đơn</dt>
                  <dd class="font-label text-on-surface tabular-nums">${ev.expectedAmountVnd !== null ? formatVnd(ev.expectedAmountVnd) : 'Chưa xác định đơn'}</dd>
                </div>
                <div class="py-space-3 flex justify-between gap-space-4">
                  <dt class="text-text-secondary">Thời điểm ghi nhận</dt>
                  <dd class="tabular-nums">${formatDateTimeVi(ev.occurredAt)}</dd>
                </div>
                ${
                  ev.mismatchReason
                    ? `<div class="py-space-3 flex flex-col gap-1">
                         <dt class="text-error font-label text-label-sm">Nguyên nhân lệch / cần đối soát</dt>
                         <dd class="text-on-error-bg bg-error-bg p-space-3 rounded">${escapeHtml(ev.mismatchReason)}</dd>
                       </div>`
                    : ''
                }
              </dl>

              ${
                booking && payment
                  ? `
                    <div class="p-space-4 rounded-lg bg-background border border-border flex flex-col gap-space-2">
                      <div class="flex flex-wrap items-center gap-space-2">
                        <strong class="font-label text-label-md text-on-surface">Đơn liên kết: ${escapeHtml(booking.id)}</strong>
                        ${renderBookingStatusBadge(booking.status)}
                        ${renderPaymentStatusBadge(payment.status)}
                      </div>
                      <p class="font-body text-body-md text-text-secondary">${escapeHtml(booking.serviceName)} · Khách: ${escapeHtml(booking.customerName)}</p>
                      <p class="font-body text-label-sm text-text-secondary tabular-nums">Hạn giữ chỗ: ${formatDateTimeVi(booking.expiresAt)}</p>
                    </div>
                  `
                  : `<div class="p-space-4 rounded-lg bg-warning-bg text-on-warning-bg font-body text-body-md">Giao dịch này chưa liên kết được với đơn dịch vụ hoặc mã payment nào trên hệ thống.</div>`
              }
            </section>

            <!-- Decision Panel (Admin only!) -->
            <aside class="lg:col-span-5 bg-surface border border-border rounded-xl p-space-6 shadow-sm flex flex-col gap-space-4">
              <h2 class="font-headline text-headline-md text-on-surface">Quyết định đối soát</h2>

              ${
                isFinalized
                  ? `
                    <div class="p-space-4 rounded-lg bg-info-bg text-on-info-bg flex flex-col gap-space-2 font-body text-body-md">
                      <p class="font-label text-label-md">Sự kiện này đã hoàn tất xử lý</p>
                      ${ev.resolvedBy ? `<p>Người xử lý: <strong>${escapeHtml(ev.resolvedBy)}</strong> (${formatDateTimeVi(ev.resolvedAt)})</p>` : ''}
                      ${ev.resolutionNote ? `<p>Ghi chú đối soát: ${escapeHtml(ev.resolutionNote)}</p>` : ''}
                    </div>
                  `
                  : !canReconcile
                    ? `
                      <div class="p-space-4 rounded-lg bg-surface-muted border border-border flex flex-col gap-space-2 font-body text-body-md text-text-secondary">
                        <p class="font-label text-label-md text-on-surface">Quyền chỉ đọc (STAFF_PAYMENT_VIEW)</p>
                        <p>Tài khoản nhân viên chỉ xem thanh toán không được quyết định đối soát hoặc thay đổi trạng thái giao dịch. Vui lòng chuyển Quản trị viên xử lý.</p>
                      </div>
                    `
                    : `
                      <div id="a11Alert" role="alert" class="hidden p-space-3 rounded bg-error-bg text-on-error-bg font-body text-body-md"></div>
                      <form id="a11Form" novalidate class="flex flex-col gap-space-4">
                        <fieldset class="flex flex-col gap-space-2">
                          <legend class="font-label text-label-md text-on-surface">Chọn hướng xử lý <span class="text-error">*</span></legend>

                          <label class="flex items-start gap-space-3 p-space-3 rounded-lg border border-border ${canConfirmPaid ? 'cursor-pointer hover:border-primary' : 'opacity-50 cursor-not-allowed bg-surface-muted'}">
                            <input type="radio" name="decision" value="CONFIRM_PAID" ${!canConfirmPaid ? 'disabled' : ''} class="mt-1 text-primary focus:ring-primary" />
                            <div>
                              <p class="font-label text-label-md text-on-surface">Xác nhận khớp &amp; Đã thanh toán</p>
                              <p class="font-body text-label-sm text-text-secondary">Chỉ khả dụng khi đơn đang Chờ thanh toán, còn hạn giữ chỗ 15 phút và số tiền khớp chính xác.</p>
                            </div>
                          </label>

                          <label class="flex items-start gap-space-3 p-space-3 rounded-lg border border-border cursor-pointer hover:border-primary">
                            <input type="radio" name="decision" value="MARK_RESOLVED_EXTERNAL" class="mt-1 text-primary focus:ring-primary" />
                            <div>
                              <p class="font-label text-label-md text-on-surface">Đã xử lý đối soát ngoài hệ thống</p>
                              <p class="font-body text-label-sm text-text-secondary">Ghi nhận đã đối soát/xử lý thủ công bên ngoài. KHÔNG tự mở lại đơn hết hạn/đã hủy và KHÔNG đồng nghĩa đơn đã thanh toán.</p>
                            </div>
                          </label>

                          <label class="flex items-start gap-space-3 p-space-3 rounded-lg border border-border cursor-pointer hover:border-primary">
                            <input type="radio" name="decision" value="IGNORE_EVENT" class="mt-1 text-primary focus:ring-primary" />
                            <div>
                              <p class="font-label text-label-md text-on-surface">Không ghi nhận vào đơn (Bỏ qua)</p>
                              <p class="font-body text-label-sm text-text-secondary">Giao dịch không thuộc phạm vi đơn dịch vụ TripLoom hoặc sự kiện trùng.</p>
                            </div>
                          </label>
                        </fieldset>

                        <label class="flex flex-col gap-space-1">
                          <span class="font-label text-label-md text-on-surface">Lý do &amp; hướng xử lý (5 – 500 ký tự) <span class="text-error">*</span></span>
                          <textarea id="a11Reason" rows="3" placeholder="Ghi rõ căn cứ đối soát và kết quả xử lý..." class="w-full p-space-3 rounded border border-border bg-surface text-body-md"></textarea>
                        </label>

                        <button type="submit" id="a11SubmitBtn" class="w-full min-h-[44px] px-space-6 rounded bg-primary text-on-primary hover:bg-primary-hover font-label text-label-lg transition-colors">
                          Xác nhận quyết định đối soát
                        </button>
                      </form>
                    `
              }
            </aside>
          </div>
        </div>
      `;

      root.querySelector<HTMLFormElement>('#a11Form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = root.querySelector<HTMLButtonElement>('#a11SubmitBtn');
        const alertEl = root.querySelector<HTMLElement>('#a11Alert');
        if (!btn || btn.disabled) return;
        const decision = root.querySelector<HTMLInputElement>('input[name="decision"]:checked')?.value as
          | 'CONFIRM_PAID'
          | 'MARK_RESOLVED_EXTERNAL'
          | 'IGNORE_EVENT'
          | undefined;
        const reason = root.querySelector<HTMLTextAreaElement>('#a11Reason')?.value.trim() ?? '';

        alertEl?.classList.add('hidden');
        if (!decision) {
          if (alertEl) {
            alertEl.textContent = 'Vui lòng chọn một hướng xử lý đối soát cụ thể (hệ thống không tự điền sẵn).';
            alertEl.classList.remove('hidden');
          }
          return;
        }

        btn.disabled = true;
        btn.textContent = 'Đang ghi nhận đối soát...';
        try {
          await paymentsService.reconcilePaymentEvent(ev.id, { decision, reason });
          showToast('Đã ghi nhận kết quả đối soát vào hệ thống và nhật ký.', 'success');
          await load();
        } catch (err) {
          if (alertEl) {
            alertEl.textContent = toUserErrorMessage(err);
            alertEl.classList.remove('hidden');
          }
          btn.disabled = false;
          btn.textContent = 'Xác nhận quyết định đối soát';
        }
      });
    } catch (err) {
      if (isAppError(err) && (err.code === 'NOT_FOUND' || err.code === 'FORBIDDEN')) {
        renderErrorPage(ctx, { code: err.code === 'FORBIDDEN' ? '403' : '404', description: err.message });
        return;
      }
      root.innerHTML = renderErrorBanner(toUserErrorMessage(err), 'retryA11');
      root.querySelector('#retryA11')?.addEventListener('click', () => void load());
    }
  };

  await load();
}
