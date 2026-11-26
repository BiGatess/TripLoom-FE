import { beforeEach, describe, expect, it } from 'vitest';
import { authService } from '@/features/auth/auth.service';
import { bookingsService } from '@/features/bookings/bookings.service';
import { paymentsService } from '@/features/payments/payments.service';
import { simulateDevSePayWebhook } from '@/mocks/handlers/booking-handler';
import { advanceMockClockMs, resetMockDatabase } from '@/mocks/storage/mock-db';

describe('Booking idempotency, 15m hold expiry & SePay payment reconciliation', () => {
  beforeEach(async () => {
    resetMockDatabase(Date.UTC(2027, 0, 15, 8, 0, 0));
    await authService.login({ email: 'minh.anh@example.com', password: 'TripLoom@123' });
  });

  it('prevents duplicate booking via idempotencyKey and enforces strict 15-minute hold expiry', async () => {
    const req = {
      serviceId: 'SV001',
      serviceDate: '2027-01-20',
      guestCount: 2,
      contactName: 'Nguyễn Minh Anh',
      contactPhone: '0905123456',
      acknowledgedUnitPriceVnd: 150000,
      idempotencyKey: 'KEY_TEST_001',
    };

    const first = await bookingsService.createBooking(req);
    const second = await bookingsService.createBooking(req);
    expect(second.booking.id).toBe(first.booking.id);
    expect(second.payment.paymentCode).toBe(first.payment.paymentCode);

    const originalExpiresAt = first.payment.expiresAt;

    // Sau 5 phút kiểm tra lại: KHÔNG tạo lại 15 phút
    advanceMockClockMs(5 * 60_000);
    const midCheck = await paymentsService.checkPaymentStatus(first.booking.id);
    expect(midCheck.booking.status).toBe('PENDING_PAYMENT');
    expect(midCheck.payment.expiresAt).toBe(originalExpiresAt);

    // Sau tổng 15 phút + 1 giây -> chuyển EXPIRED
    advanceMockClockMs(10 * 60_000 + 1000);
    const expiredCheck = await paymentsService.checkPaymentStatus(first.booking.id);
    expect(expiredCheck.booking.status).toBe('EXPIRED');
    expect(expiredCheck.payment.status).toBe('FAILED');
    expect(expiredCheck.booking.canCustomerCancel).toBe(false);
  });

  it('handles late/wrong payment as NEEDS_REVIEW, blocks staff reconciliation, and prevents auto-reopen on Admin resolve', async () => {
    // Giả lập chuyển tiền muộn cho BK001
    const sim = simulateDevSePayWebhook({ bookingId: 'BK001', scenario: 'LATE_PAYMENT' });
    expect(sim.booking.status).toBe('EXPIRED');
    expect(sim.payment.status).toBe('NEEDS_REVIEW');
    expect(sim.event?.status).toBe('NEEDS_REVIEW');

    // Khách hàng không thể hủy đơn đã có tiền cần đối soát
    await expect(bookingsService.cancelMyBooking('BK001', { reason: 'Muốn hủy đơn này' })).rejects.toMatchObject({
      code: 'CONFLICT',
    });

    // Nhân viên STAFF_PAYMENT_VIEW chỉ được xem, BỊ CHẶN quyết định đối soát (403)
    await authService.login({ email: 'yen.do@triploom.vn', password: 'Staff@123' });
    const detailAsStaff = await paymentsService.getAdminPaymentEventDetail(sim.event!.id);
    expect(detailAsStaff.canReconcile).toBe(false);
    await expect(
      paymentsService.reconcilePaymentEvent(sim.event!.id, {
        decision: 'MARK_RESOLVED_EXTERNAL',
        reason: 'Nhân viên thử đối soát trái phép',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    // Admin cũng KHÔNG thể chọn CONFIRM_PAID để tự mở lại đơn đã EXPIRED
    await authService.login({ email: 'admin@triploom.vn', password: 'Admin@123' });
    await expect(
      paymentsService.reconcilePaymentEvent(sim.event!.id, {
        decision: 'CONFIRM_PAID',
        reason: 'Thử mở lại đơn đã hết hạn',
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });

    // Admin đánh dấu RESOLVED ngoài hệ thống -> event RESOLVED nhưng booking vẫn giữ EXPIRED
    const resolved = await paymentsService.reconcilePaymentEvent(sim.event!.id, {
      decision: 'MARK_RESOLVED_EXTERNAL',
      reason: 'Đã liên hệ khách hàng hoàn trả thủ công qua kế toán.',
    });
    expect(resolved.status).toBe('RESOLVED');
    const afterAdminCheck = await bookingsService.getAdminBookingDetail('BK001');
    expect(afterAdminCheck.booking.status).toBe('EXPIRED');
  });

  it('rejects silent booking when service unit price has changed', async () => {
    await expect(
      bookingsService.createBooking({
        serviceId: 'SV001',
        serviceDate: '2027-01-21',
        guestCount: 2,
        contactName: 'Nguyễn Minh Anh',
        contactPhone: '0905123456',
        acknowledgedUnitPriceVnd: 100000, // giá cũ khác 150.000đ
        idempotencyKey: 'KEY_PRICE_CHANGE',
      }),
    ).rejects.toMatchObject({ code: 'PRICE_CHANGED' });
  });
});
