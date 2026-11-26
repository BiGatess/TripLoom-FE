import type {
  ActiveStatus,
  BookingStatus,
  PaymentEventStatus,
  PaymentStatus,
  ReviewStatus,
  StaffAccountStatus,
} from '@/api/contracts';
import { escapeHtml } from '@/shared/utils/dom';

type BadgeTone = 'success' | 'warning' | 'error' | 'info' | 'neutral';

const TONE_CLASSES: Record<BadgeTone, string> = {
  success: 'bg-success-bg text-on-success-bg',
  warning: 'bg-warning-bg text-on-warning-bg',
  error: 'bg-error-bg text-on-error-bg',
  info: 'bg-info-bg text-on-info-bg',
  neutral: 'bg-surface-muted text-on-surface-muted',
};

export function renderBadge(label: string, tone: BadgeTone, icon: string): string {
  return `<span class="inline-flex items-center gap-space-1 px-space-3 py-space-1 rounded-full ${TONE_CLASSES[tone]} font-label text-label-sm whitespace-nowrap shrink-0">
    <span class="material-symbols-outlined text-[16px]" aria-hidden="true">${escapeHtml(icon)}</span>
    <span>${escapeHtml(label)}</span>
  </span>`;
}

export function renderBookingStatusBadge(status: BookingStatus): string {
  switch (status) {
    case 'PENDING_PAYMENT':
      return renderBadge('Chờ thanh toán', 'warning', 'schedule');
    case 'CONFIRMED':
      return renderBadge('Đã xác nhận', 'success', 'check_circle');
    case 'CANCELLED':
      return renderBadge('Đã hủy', 'neutral', 'cancel');
    case 'EXPIRED':
      return renderBadge('Hết hạn', 'error', 'timer_off');
  }
}

export function renderPaymentStatusBadge(status: PaymentStatus): string {
  switch (status) {
    case 'PENDING':
      return renderBadge('Chờ xác nhận', 'warning', 'hourglass_top');
    case 'PAID':
      return renderBadge('Đã thanh toán', 'success', 'verified');
    case 'FAILED':
      return renderBadge('Không thành công', 'error', 'error');
    case 'NEEDS_REVIEW':
      return renderBadge('Cần đối soát', 'error', 'warning');
  }
}

export function renderPaymentEventStatusBadge(status: PaymentEventStatus): string {
  switch (status) {
    case 'RECEIVED':
      return renderBadge('Đã tiếp nhận', 'info', 'call_received');
    case 'MATCHED':
      return renderBadge('Đã khớp', 'success', 'check_circle');
    case 'NEEDS_REVIEW':
      return renderBadge('Cần đối soát', 'error', 'warning');
    case 'IGNORED':
      return renderBadge('Không ghi nhận vào đơn', 'neutral', 'block');
    case 'RESOLVED':
      return renderBadge('Đã xử lý đối soát', 'info', 'task_alt');
  }
}

export function renderStaffStatusBadge(status: StaffAccountStatus): string {
  switch (status) {
    case 'INVITED':
      return renderBadge('Chờ kích hoạt', 'warning', 'mail');
    case 'ACTIVE':
      return renderBadge('Đang hoạt động', 'success', 'check_circle');
    case 'LOCKED':
      return renderBadge('Đã khóa', 'error', 'lock');
  }
}

export function renderReviewStatusBadge(status: ReviewStatus): string {
  switch (status) {
    case 'PENDING':
      return renderBadge('Chờ duyệt', 'warning', 'pending');
    case 'PUBLISHED':
      return renderBadge('Đã công khai', 'success', 'visibility');
    case 'HIDDEN':
      return renderBadge('Đã ẩn', 'neutral', 'visibility_off');
  }
}

export function renderActiveStatusBadge(status: ActiveStatus): string {
  return status === 'ACTIVE'
    ? renderBadge('Đang hoạt động', 'success', 'check_circle')
    : renderBadge('Đã ẩn', 'neutral', 'visibility_off');
}
