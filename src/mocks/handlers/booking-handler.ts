import { AppError } from '@/api/errors';
import type {
  AddBookingNoteRequest,
  Booking,
  BookingFilterParams,
  CancelBookingRequest,
  CreateBookingRequest,
  PaginatedBookings,
  PaginatedPaymentEvents,
  PaginatedPayments,
  PaymentEventFilterParams,
  PaymentFilterParams,
  PaymentRecord,
  ReconcileEventRequest,
  SePayEvent,
} from '@/api/contracts';
import { BOOKING_RULES } from '@/config/constants';
import { validateReason } from '@/shared/utils/validation';
import type { MockDatabase } from '@/mocks/fixtures/seed-data';
import { getMockNowMs, mutateMockDb, simulateDelay } from '@/mocks/storage/mock-db';
import {
  assertNetworkAvailable,
  requireAdminAccount,
  requireAuthAccount,
  requireBackofficePermission,
} from './auth-handler';
import { hydrateService } from './catalog-handler';

function clone<T>(val: T): T {
  return JSON.parse(JSON.stringify(val)) as T;
}

function paginate<T>(items: T[], page = 1, pageSize = 10) {
  const safeSize = Math.max(1, pageSize);
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / safeSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * safeSize;
  return {
    items: items.slice(start, start + safeSize),
    total,
    page: safePage,
    pageSize: safeSize,
    totalPages,
  };
}

function updateBookingCancelFlags(booking: Booking, db: MockDatabase): void {
  const hasNeedsReviewEvent = db.paymentEvents.some(
    (ev) => ev.bookingId === booking.id && ev.status === 'NEEDS_REVIEW',
  );
  const eligible =
    booking.status === 'PENDING_PAYMENT' &&
    booking.paymentStatus === 'PENDING' &&
    !hasNeedsReviewEvent;
  booking.canCustomerCancel = eligible;
  booking.canStaffCancel = eligible;
}

/**
 * Tự động chuyển các đơn PENDING_PAYMENT quá hạn 15 phút sang EXPIRED (giống tác vụ máy chủ).
 */
export function syncExpiredBookings(db: MockDatabase): void {
  const nowMs = getMockNowMs();
  const nowIso = new Date(nowMs).toISOString();

  for (const booking of db.bookings) {
    if (booking.status === 'PENDING_PAYMENT' && new Date(booking.expiresAt).getTime() <= nowMs) {
      booking.status = 'EXPIRED';
      booking.updatedAt = nowIso;
      const payment = db.payments.find((p) => p.id === booking.paymentId);
      if (payment && payment.status === 'PENDING') {
        payment.status = 'FAILED';
        payment.updatedAt = nowIso;
        booking.paymentStatus = 'FAILED';
      }
      booking.timeline.push({
        id: `TL_${nowMs}_${booking.id}`,
        timestamp: nowIso,
        actor: 'Hệ thống TripLoom',
        title: 'Đơn dịch vụ hết thời gian giữ chỗ (15 phút)',
        detail: 'Chưa ghi nhận thanh toán hợp lệ trong thời hạn. Đơn chuyển Hết hạn và đã nhả chỗ.',
      });
    }
    updateBookingCancelFlags(booking, db);
  }
}

export async function mockCreateBooking(req: CreateBookingRequest): Promise<{ booking: Booking; payment: PaymentRecord }> {
  await simulateDelay(160);
  return mutateMockDb((db) => {
    assertNetworkAvailable(db);
    syncExpiredBookings(db);
    const acc = requireAuthAccount(db);

    // Chống tạo đơn trùng theo idempotencyKey
    if (req.idempotencyKey && db.bookingIdempotencyMap[req.idempotencyKey]) {
      const existingId = db.bookingIdempotencyMap[req.idempotencyKey]!;
      const existingBooking = db.bookings.find((b) => b.id === existingId);
      const existingPayment = db.payments.find((p) => p.bookingId === existingId);
      if (existingBooking && existingPayment) {
        return { booking: clone(existingBooking), payment: clone(existingPayment) };
      }
    }

    const fieldErrors: Record<string, string> = {};
    if (!/^\d{4}-\d{2}-\d{2}$/.test(req.serviceDate)) fieldErrors.serviceDate = 'Vui lòng chọn ngày sử dụng hợp lệ.';
    if (!Number.isInteger(req.guestCount) || req.guestCount < 1) {
      fieldErrors.guestCount = 'Số khách phải là số nguyên dương.';
    }
    if (req.contactName.trim().length < 2) fieldErrors.contactName = 'Vui lòng nhập họ tên liên hệ.';
    if (req.contactPhone.trim().length < 8) fieldErrors.contactPhone = 'Vui lòng nhập số điện thoại liên hệ hợp lệ.';

    if (Object.keys(fieldErrors).length > 0) {
      throw new AppError({
        code: 'VALIDATION_ERROR',
        status: 400,
        message: 'Thông tin đặt dịch vụ chưa hợp lệ.',
        fieldErrors,
      });
    }

    const rawService = db.services.find((s) => s.id === req.serviceId);
    if (!rawService) {
      throw new AppError({ code: 'NOT_FOUND', status: 404, message: 'Dịch vụ không tồn tại.' });
    }
    const svc = hydrateService(db, rawService);
    if (!svc.effectivelyBookable) {
      throw new AppError({
        code: 'CONFLICT',
        status: 409,
        message: 'Dịch vụ hiện ngừng hoạt động hoặc địa điểm liên kết đã ẩn, không thể nhận đặt mới.',
      });
    }

    // Kiểm tra giá có thay đổi so với giá người dùng đã xem hay không
    if (req.acknowledgedUnitPriceVnd !== svc.pricePerGuestVnd) {
      throw new AppError({
        code: 'PRICE_CHANGED',
        status: 409,
        message: 'Đơn giá dịch vụ vừa được cập nhật trên hệ thống. Vui lòng xem lại giá mới trước khi xác nhận đặt.',
        meta: { latestUnitPriceVnd: svc.pricePerGuestVnd },
      });
    }

    // Kiểm tra sức chứa còn lại theo ngày
    const nowMs = getMockNowMs();
    const bookedGuests = db.bookings
      .filter(
        (b) =>
          b.serviceId === svc.id &&
          b.serviceDate === req.serviceDate &&
          (b.status === 'CONFIRMED' || (b.status === 'PENDING_PAYMENT' && new Date(b.expiresAt).getTime() > nowMs)),
      )
      .reduce((sum, b) => sum + b.guestCount, 0);

    const remaining = Math.max(0, svc.maxDailyCapacity - bookedGuests);
    if (req.guestCount > remaining) {
      throw new AppError({
        code: 'INSUFFICIENT_CAPACITY',
        status: 409,
        message: `Ngày ${req.serviceDate} chỉ còn ${remaining} chỗ trống, không đủ cho ${req.guestCount} khách.`,
        meta: { remainingCapacity: remaining },
      });
    }

    const nowIso = new Date(nowMs).toISOString();
    const expiresAt = new Date(nowMs + BOOKING_RULES.holdSeconds * 1000).toISOString();
    const bookingId = `BK${String(db.counters.booking++).padStart(3, '0')}`;
    const paymentNum = db.counters.paymentCode++;
    const paymentId = `PAY${String(paymentNum).padStart(3, '0')}`;
    const paymentCode = `TAI${String(paymentNum).padStart(4, '0')}`;
    const totalAmountVnd = svc.pricePerGuestVnd * req.guestCount;

    const booking: Booking = {
      id: bookingId,
      ownerId: acc.profile.id,
      customerName: req.contactName.trim(),
      customerEmail: acc.profile.email,
      customerPhone: req.contactPhone.trim(),
      serviceId: svc.id,
      serviceName: svc.name,
      destinationId: svc.destinationId,
      destinationName: svc.destinationName,
      serviceDate: req.serviceDate,
      guestCount: req.guestCount,
      unitPriceSnapshotVnd: svc.pricePerGuestVnd,
      totalAmountVnd,
      status: 'PENDING_PAYMENT',
      paymentId,
      paymentCode,
      paymentStatus: 'PENDING',
      expiresAt,
      createdAt: nowIso,
      updatedAt: nowIso,
      canCustomerCancel: true,
      canStaffCancel: true,
      internalNotice:
        'Đơn dịch vụ nội bộ trên TripLoom. Giá chụp và tổng tiền do máy chủ xác định tại thời điểm tạo đơn.',
      timeline: [
        {
          id: `TL_${nowMs}`,
          timestamp: nowIso,
          actor: req.contactName.trim(),
          title: `Tạo đơn ${bookingId} và mã thanh toán ${paymentCode}`,
          detail: `Giữ chỗ 15 phút cho ${req.guestCount} khách (${totalAmountVnd.toLocaleString('vi-VN')}đ). Đang chờ ngân hàng xác nhận.`,
        },
      ],
      supportNotes: [],
    };

    const payment: PaymentRecord = {
      id: paymentId,
      paymentCode,
      bookingId,
      serviceName: svc.name,
      customerName: booking.customerName,
      expectedAmountVnd: totalAmountVnd,
      receivedAmountVnd: 0,
      status: 'PENDING',
      expiresAt,
      bankName: 'Ngân hàng Demo (Môi trường mô phỏng)',
      accountName: 'TRIPLOOM DEMO ACCOUNT',
      accountNumberDemo: '0000 1234 5678 (DEMO)',
      qrPlaceholderLabel: 'QR minh họa — Không chuyển khoản thật',
      updatedAt: nowIso,
    };

    db.bookings.unshift(booking);
    db.payments.unshift(payment);
    if (req.idempotencyKey) {
      db.bookingIdempotencyMap[req.idempotencyKey] = bookingId;
    }

    return { booking: clone(booking), payment: clone(payment) };
  });
}

export async function mockListMyBookings(params: BookingFilterParams = {}): Promise<PaginatedBookings> {
  await simulateDelay(90);
  return mutateMockDb((db) => {
    assertNetworkAvailable(db);
    syncExpiredBookings(db);
    const acc = requireAuthAccount(db);
    const q = (params.query ?? '').trim().toLowerCase();

    let items = db.bookings.filter((b) => b.ownerId === acc.profile.id).map(clone);
    if (params.status && params.status !== 'ALL') {
      items = items.filter((b) => b.status === params.status);
    }
    if (q) {
      items = items.filter(
        (b) =>
          b.id.toLowerCase().includes(q) ||
          b.serviceName.toLowerCase().includes(q) ||
          b.paymentCode.toLowerCase().includes(q),
      );
    }
    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return paginate(items, params.page ?? 1, params.pageSize ?? 8);
  });
}

export async function mockGetMyBookingDetail(bookingId: string): Promise<{ booking: Booking; payment: PaymentRecord }> {
  await simulateDelay(80);
  return mutateMockDb((db) => {
    assertNetworkAvailable(db);
    syncExpiredBookings(db);
    const acc = requireAuthAccount(db);
    const booking = db.bookings.find((b) => b.id.toUpperCase() === bookingId.toUpperCase());
    if (!booking) {
      throw new AppError({ code: 'NOT_FOUND', status: 404, message: 'Không tìm thấy đơn dịch vụ.' });
    }
    if (booking.ownerId !== acc.profile.id) {
      throw new AppError({
        code: 'FORBIDDEN',
        status: 403,
        message: 'Bạn không có quyền truy cập đơn dịch vụ của tài khoản khác.',
      });
    }
    const payment = db.payments.find((p) => p.id === booking.paymentId);
    if (!payment) {
      throw new AppError({ code: 'NOT_FOUND', status: 404, message: 'Không tìm thấy bản ghi thanh toán của đơn.' });
    }
    return { booking: clone(booking), payment: clone(payment) };
  });
}

export async function mockCancelMyBooking(bookingId: string, req: CancelBookingRequest): Promise<Booking> {
  await simulateDelay(130);
  return mutateMockDb((db) => {
    assertNetworkAvailable(db);
    syncExpiredBookings(db);
    const acc = requireAuthAccount(db);
    const booking = db.bookings.find((b) => b.id === bookingId);
    if (!booking) throw new AppError({ code: 'NOT_FOUND', status: 404, message: 'Không tìm thấy đơn dịch vụ.' });
    if (booking.ownerId !== acc.profile.id) {
      throw new AppError({ code: 'FORBIDDEN', status: 403, message: 'Bạn không có quyền hủy đơn của tài khoản khác.' });
    }
    if (!booking.canCustomerCancel) {
      throw new AppError({
        code: 'CONFLICT',
        status: 409,
        message: 'Đơn này không còn đủ điều kiện tự hủy (đã thanh toán, hết hạn, đã hủy hoặc có giao dịch cần đối soát).',
      });
    }

    const reasonErr = validateReason(req.reason, 5, 500);
    if (reasonErr) {
      throw new AppError({
        code: 'VALIDATION_ERROR',
        status: 400,
        message: reasonErr,
        fieldErrors: { reason: reasonErr },
      });
    }

    const nowIso = new Date(getMockNowMs()).toISOString();
    booking.status = 'CANCELLED';
    booking.paymentStatus = 'FAILED';
    booking.updatedAt = nowIso;
    const payment = db.payments.find((p) => p.id === booking.paymentId);
    if (payment && payment.status === 'PENDING') {
      payment.status = 'FAILED';
      payment.updatedAt = nowIso;
    }
    booking.timeline.push({
      id: `TL_${getMockNowMs()}`,
      timestamp: nowIso,
      actor: acc.profile.fullName,
      title: 'Khách hàng hủy đơn dịch vụ',
      detail: `Lý do: ${req.reason.trim()}. Chỗ giữ tạm đã được giải phóng.`,
    });
    updateBookingCancelFlags(booking, db);
    return clone(booking);
  });
}

export async function mockCheckPaymentStatus(bookingId: string): Promise<{ booking: Booking; payment: PaymentRecord }> {
  // Đọc trạng thái mới nhất từ máy chủ (syncExpiredBookings + đọc trạng thái đã có từ webhook)
  return mockGetMyBookingDetail(bookingId);
}

// ===== BACKOFFICE BOOKING =====

export async function mockListAdminBookings(params: BookingFilterParams = {}): Promise<PaginatedBookings> {
  await simulateDelay(90);
  return mutateMockDb((db) => {
    assertNetworkAvailable(db);
    syncExpiredBookings(db);
    requireBackofficePermission(db, 'STAFF_BOOKING');
    const q = (params.query ?? '').trim().toLowerCase();

    let items = db.bookings.map(clone);
    if (params.status && params.status !== 'ALL') {
      items = items.filter((b) => b.status === params.status);
    }
    if (params.serviceDate) {
      items = items.filter((b) => b.serviceDate === params.serviceDate);
    }
    if (params.serviceId && params.serviceId !== 'ALL') {
      items = items.filter((b) => b.serviceId === params.serviceId);
    }
    if (q) {
      items = items.filter(
        (b) =>
          b.id.toLowerCase().includes(q) ||
          b.customerName.toLowerCase().includes(q) ||
          b.paymentCode.toLowerCase().includes(q) ||
          b.serviceName.toLowerCase().includes(q),
      );
    }
    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return paginate(items, params.page ?? 1, params.pageSize ?? 10);
  });
}

export async function mockGetAdminBookingDetail(
  bookingId: string,
): Promise<{ booking: Booking; payment: PaymentRecord | null }> {
  await simulateDelay(80);
  return mutateMockDb((db) => {
    assertNetworkAvailable(db);
    syncExpiredBookings(db);
    const actor = requireBackofficePermission(db, 'STAFF_BOOKING');
    const booking = db.bookings.find((b) => b.id.toUpperCase() === bookingId.toUpperCase());
    if (!booking) throw new AppError({ code: 'NOT_FOUND', status: 404, message: 'Không tìm thấy đơn booking.' });

    const canSeePayment =
      actor.profile.role === 'ADMIN' || actor.profile.permissions.includes('STAFF_PAYMENT_VIEW');
    const payment = canSeePayment ? (db.payments.find((p) => p.id === booking.paymentId) ?? null) : null;
    return { booking: clone(booking), payment: payment ? clone(payment) : null };
  });
}

export async function mockAddAdminBookingNote(bookingId: string, req: AddBookingNoteRequest): Promise<Booking> {
  await simulateDelay(110);
  return mutateMockDb((db) => {
    assertNetworkAvailable(db);
    syncExpiredBookings(db);
    const actor = requireBackofficePermission(db, 'STAFF_BOOKING');
    const content = req.content.trim();
    if (content.length < 3 || content.length > 1000) {
      throw new AppError({
        code: 'VALIDATION_ERROR',
        status: 400,
        message: 'Ghi chú hỗ trợ phải từ 3 đến 1.000 ký tự.',
        fieldErrors: { content: 'Ghi chú phải từ 3 đến 1.000 ký tự.' },
      });
    }

    const booking = db.bookings.find((b) => b.id === bookingId);
    if (!booking) throw new AppError({ code: 'NOT_FOUND', status: 404, message: 'Không tìm thấy đơn booking.' });

    const nowIso = new Date(getMockNowMs()).toISOString();
    const authorLabel = actor.profile.staffCode
      ? `${actor.profile.fullName} (${actor.profile.staffCode})`
      : actor.profile.fullName;

    booking.supportNotes.unshift({
      id: `SN_${getMockNowMs()}`,
      author: authorLabel,
      content,
      createdAt: nowIso,
    });
    booking.timeline.push({
      id: `TL_${getMockNowMs()}`,
      timestamp: nowIso,
      actor: authorLabel,
      title: 'Thêm ghi chú hỗ trợ nội bộ',
      detail: content,
    });
    booking.updatedAt = nowIso;

    db.auditLogs.unshift({
      id: `LOG${String(db.counters.audit++).padStart(3, '0')}`,
      timestamp: nowIso,
      actorId: actor.profile.id,
      actorName: authorLabel,
      targetType: 'BOOKING',
      targetId: booking.id,
      targetLabel: `Booking ${booking.id}`,
      action: 'BOOKING_NOTE_ADDED',
      actionLabel: 'Ghi chú hỗ trợ booking',
      reason: content,
      beforeSummary: { 'Số ghi chú': String(booking.supportNotes.length - 1) },
      afterSummary: { 'Số ghi chú': String(booking.supportNotes.length) },
    });

    return clone(booking);
  });
}

export async function mockAdminCancelBooking(bookingId: string, req: CancelBookingRequest): Promise<Booking> {
  await simulateDelay(130);
  return mutateMockDb((db) => {
    assertNetworkAvailable(db);
    syncExpiredBookings(db);
    const actor = requireBackofficePermission(db, 'STAFF_BOOKING');
    const reasonErr = validateReason(req.reason, 5, 500);
    if (reasonErr) {
      throw new AppError({
        code: 'VALIDATION_ERROR',
        status: 400,
        message: reasonErr,
        fieldErrors: { reason: reasonErr },
      });
    }

    const booking = db.bookings.find((b) => b.id === bookingId);
    if (!booking) throw new AppError({ code: 'NOT_FOUND', status: 404, message: 'Không tìm thấy đơn booking.' });
    if (!booking.canStaffCancel) {
      throw new AppError({
        code: 'CONFLICT',
        status: 409,
        message: 'Không thể hủy đơn đã thanh toán, đã hết hạn hoặc đang có giao dịch cần đối soát.',
      });
    }

    const nowIso = new Date(getMockNowMs()).toISOString();
    const actorLabel = actor.profile.staffCode
      ? `${actor.profile.fullName} (${actor.profile.staffCode})`
      : actor.profile.fullName;

    booking.status = 'CANCELLED';
    booking.paymentStatus = 'FAILED';
    booking.updatedAt = nowIso;
    const payment = db.payments.find((p) => p.id === booking.paymentId);
    if (payment && payment.status === 'PENDING') {
      payment.status = 'FAILED';
      payment.updatedAt = nowIso;
    }
    booking.timeline.push({
      id: `TL_${getMockNowMs()}`,
      timestamp: nowIso,
      actor: actorLabel,
      title: 'Hỗ trợ nội bộ hủy đơn dịch vụ',
      detail: `Lý do: ${req.reason.trim()}. Đã giải phóng chỗ giữ tạm.`,
    });
    updateBookingCancelFlags(booking, db);

    db.auditLogs.unshift({
      id: `LOG${String(db.counters.audit++).padStart(3, '0')}`,
      timestamp: nowIso,
      actorId: actor.profile.id,
      actorName: actorLabel,
      targetType: 'BOOKING',
      targetId: booking.id,
      targetLabel: `Booking ${booking.id}`,
      action: 'BOOKING_CANCELLED_BY_STAFF',
      actionLabel: 'Hủy booking nội bộ',
      reason: req.reason.trim(),
      beforeSummary: { 'Trạng thái đơn': 'Chờ thanh toán' },
      afterSummary: { 'Trạng thái đơn': 'Đã hủy' },
    });

    return clone(booking);
  });
}

// ===== BACKOFFICE PAYMENTS & SEPAY RECONCILIATION =====

export async function mockListAdminPayments(params: PaymentFilterParams = {}): Promise<PaginatedPayments> {
  await simulateDelay(90);
  return mutateMockDb((db) => {
    assertNetworkAvailable(db);
    syncExpiredBookings(db);
    requireBackofficePermission(db, 'STAFF_PAYMENT_VIEW');
    const q = (params.query ?? '').trim().toLowerCase();

    let items = db.payments.map(clone);
    if (params.status && params.status !== 'ALL') {
      items = items.filter((p) => p.status === params.status);
    }
    if (q) {
      items = items.filter(
        (p) =>
          p.paymentCode.toLowerCase().includes(q) ||
          p.bookingId.toLowerCase().includes(q) ||
          p.customerName.toLowerCase().includes(q),
      );
    }
    items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return paginate(items, params.page ?? 1, params.pageSize ?? 10);
  });
}

export async function mockListAdminPaymentEvents(
  params: PaymentEventFilterParams = {},
): Promise<PaginatedPaymentEvents> {
  await simulateDelay(90);
  return mutateMockDb((db) => {
    assertNetworkAvailable(db);
    syncExpiredBookings(db);
    requireBackofficePermission(db, 'STAFF_PAYMENT_VIEW');
    const q = (params.query ?? '').trim().toLowerCase();

    let items = db.paymentEvents.map(clone);
    if (params.status && params.status !== 'ALL') {
      items = items.filter((e) => e.status === params.status);
    }
    if (q) {
      items = items.filter(
        (e) =>
          e.id.toLowerCase().includes(q) ||
          e.transactionRef.toLowerCase().includes(q) ||
          e.transferContent.toLowerCase().includes(q) ||
          (e.paymentCode ?? '').toLowerCase().includes(q),
      );
    }
    items.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
    return paginate(items, params.page ?? 1, params.pageSize ?? 10);
  });
}

export async function mockGetAdminPaymentEventDetail(
  eventId: string,
): Promise<{ event: SePayEvent; payment: PaymentRecord | null; booking: Booking | null; canReconcile: boolean }> {
  await simulateDelay(80);
  return mutateMockDb((db) => {
    assertNetworkAvailable(db);
    syncExpiredBookings(db);
    const actor = requireBackofficePermission(db, 'STAFF_PAYMENT_VIEW');
    const ev = db.paymentEvents.find((e) => e.id.toUpperCase() === eventId.toUpperCase());
    if (!ev) throw new AppError({ code: 'NOT_FOUND', status: 404, message: 'Không tìm thấy sự kiện giao dịch.' });

    const payment = ev.paymentId ? (db.payments.find((p) => p.id === ev.paymentId) ?? null) : null;
    const booking = ev.bookingId ? (db.bookings.find((b) => b.id === ev.bookingId) ?? null) : null;
    return {
      event: clone(ev),
      payment: payment ? clone(payment) : null,
      booking: booking ? clone(booking) : null,
      canReconcile: actor.profile.role === 'ADMIN',
    };
  });
}

export async function mockReconcilePaymentEvent(eventId: string, req: ReconcileEventRequest): Promise<SePayEvent> {
  await simulateDelay(140);
  return mutateMockDb((db) => {
    assertNetworkAvailable(db);
    syncExpiredBookings(db);
    // QUY TẮC: Chỉ ADMIN mới được quyết định đối soát! Nhân viên STAFF_PAYMENT_VIEW bị chặn 403!
    const admin = requireAdminAccount(db);

    const reasonErr = validateReason(req.reason, 5, 500);
    if (reasonErr) {
      throw new AppError({
        code: 'VALIDATION_ERROR',
        status: 400,
        message: reasonErr,
        fieldErrors: { reason: reasonErr },
      });
    }

    const ev = db.paymentEvents.find((e) => e.id === eventId);
    if (!ev) throw new AppError({ code: 'NOT_FOUND', status: 404, message: 'Không tìm thấy sự kiện giao dịch.' });
    if (ev.status === 'RESOLVED' || ev.status === 'IGNORED' || ev.status === 'MATCHED') {
      throw new AppError({
        code: 'CONFLICT',
        status: 409,
        message: 'Sự kiện giao dịch này đã được xử lý trước đó.',
      });
    }

    const nowMs = getMockNowMs();
    const nowIso = new Date(nowMs).toISOString();
    const prevStatus = ev.status;

    if (req.decision === 'CONFIRM_PAID') {
      if (!ev.bookingId || !ev.paymentId) {
        throw new AppError({
          code: 'CONFLICT',
          status: 409,
          message: 'Sự kiện chưa xác định đơn hàng nên không thể xác nhận Đã thanh toán cho đơn.',
        });
      }
      const booking = db.bookings.find((b) => b.id === ev.bookingId);
      const payment = db.payments.find((p) => p.id === ev.paymentId);
      if (!booking || !payment) {
        throw new AppError({ code: 'NOT_FOUND', status: 404, message: 'Không tìm thấy đơn hoặc bản ghi thanh toán liên kết.' });
      }
      // Chỉ cho xác nhận PAID/CONFIRMED nếu đơn còn hạn và đang chờ thanh toán
      if (booking.status !== 'PENDING_PAYMENT' || new Date(booking.expiresAt).getTime() <= nowMs) {
        throw new AppError({
          code: 'CONFLICT',
          status: 409,
          message: 'Đơn đã hết hạn hoặc đã hủy, không thể tự mở lại. Vui lòng chọn "Đã xử lý đối soát ngoài hệ thống".',
        });
      }
      if (ev.amountReceivedVnd !== payment.expectedAmountVnd) {
        throw new AppError({
          code: 'CONFLICT',
          status: 409,
          message: 'Số tiền thực nhận không khớp chính xác số tiền đơn hàng. Không thể xác nhận khớp tự động.',
        });
      }

      ev.status = 'MATCHED';
      payment.status = 'PAID';
      payment.receivedAmountVnd = ev.amountReceivedVnd;
      payment.updatedAt = nowIso;
      booking.status = 'CONFIRMED';
      booking.paymentStatus = 'PAID';
      booking.updatedAt = nowIso;
      booking.timeline.push({
        id: `TL_${nowMs}`,
        timestamp: nowIso,
        actor: admin.profile.fullName,
        title: 'Quản trị viên xác nhận đối soát hợp lệ',
        detail: `Khớp giao dịch ${ev.transactionRef}. Lý do: ${req.reason.trim()}`,
      });
      updateBookingCancelFlags(booking, db);
    } else if (req.decision === 'MARK_RESOLVED_EXTERNAL') {
      // Đã xử lý đối soát KHÔNG đồng nghĩa đơn đã thanh toán hoặc tự mở lại đơn hết hạn/đã hủy!
      ev.status = 'RESOLVED';
    } else {
      ev.status = 'IGNORED';
    }

    ev.resolutionNote = req.reason.trim();
    ev.resolvedBy = admin.profile.fullName;
    ev.resolvedAt = nowIso;

    db.auditLogs.unshift({
      id: `LOG${String(db.counters.audit++).padStart(3, '0')}`,
      timestamp: nowIso,
      actorId: admin.profile.id,
      actorName: admin.profile.fullName,
      targetType: 'PAYMENT_EVENT',
      targetId: ev.id,
      targetLabel: `Giao dịch ${ev.transactionRef}`,
      action: `PAYMENT_EVENT_${req.decision}`,
      actionLabel:
        req.decision === 'CONFIRM_PAID'
          ? 'Đối soát khớp & xác nhận thanh toán'
          : req.decision === 'MARK_RESOLVED_EXTERNAL'
            ? 'Đánh dấu đã xử lý đối soát ngoài hệ thống'
            : 'Bỏ qua sự kiện không ghi nhận vào đơn',
      reason: req.reason.trim(),
      beforeSummary: { 'Trạng thái sự kiện': prevStatus },
      afterSummary: { 'Trạng thái sự kiện': ev.status },
    });

    return clone(ev);
  });
}

/**
 * Công cụ mô phỏng sự kiện SePay CHỈ dành cho DevToolbar & Vitest.
 * Tuyệt đối không gắn trực tiếp vào UI khách hàng như nút "Tôi đã chuyển tiền".
 */
export function simulateDevSePayWebhook(params: {
  bookingId: string;
  scenario: 'EXACT_PAID' | 'LATE_PAYMENT' | 'WRONG_AMOUNT' | 'OVERPAID' | 'EXPIRE_NOW';
}): { booking: Booking; payment: PaymentRecord; event?: SePayEvent } {
  return mutateMockDb((db) => {
    const booking = db.bookings.find((b) => b.id === params.bookingId);
    if (!booking) throw new AppError({ code: 'NOT_FOUND', status: 404, message: 'Không tìm thấy đơn để mô phỏng.' });
    const payment = db.payments.find((p) => p.id === booking.paymentId);
    if (!payment) throw new AppError({ code: 'NOT_FOUND', status: 404, message: 'Không tìm thấy payment của đơn.' });

    const nowMs = getMockNowMs();
    const nowIso = new Date(nowMs).toISOString();

    if (params.scenario === 'EXPIRE_NOW') {
      booking.expiresAt = new Date(nowMs - 1000).toISOString();
      payment.expiresAt = booking.expiresAt;
      syncExpiredBookings(db);
      return { booking: clone(booking), payment: clone(payment) };
    }

    syncExpiredBookings(db);
    const evId = `EVT${String(db.counters.event++).padStart(3, '0')}`;
    const txRef = `SEPAY-DEMO-${nowMs.toString().slice(-6)}`;

    if (params.scenario === 'LATE_PAYMENT') {
      // Đảm bảo đơn đã hết hạn trước khi tiền đến muộn
      if (booking.status === 'PENDING_PAYMENT') {
        booking.expiresAt = new Date(nowMs - 60_000).toISOString();
        payment.expiresAt = booking.expiresAt;
        syncExpiredBookings(db);
      }
      const ev: SePayEvent = {
        id: evId,
        transactionRef: txRef,
        paymentId: payment.id,
        paymentCode: payment.paymentCode,
        bookingId: booking.id,
        transferContent: `${payment.paymentCode} CHUYEN KHOAN MUON`,
        amountReceivedVnd: payment.expectedAmountVnd,
        expectedAmountVnd: payment.expectedAmountVnd,
        receivingAccountDemo: payment.accountNumberDemo,
        occurredAt: nowIso,
        status: 'NEEDS_REVIEW',
        mismatchReason: 'Giao dịch đến sau khi đơn đã hết hạn giữ chỗ 15 phút. Không tự mở lại đơn.',
      };
      db.paymentEvents.unshift(ev);
      payment.status = 'NEEDS_REVIEW';
      payment.receivedAmountVnd += ev.amountReceivedVnd;
      payment.updatedAt = nowIso;
      booking.paymentStatus = 'NEEDS_REVIEW';
      booking.updatedAt = nowIso;
      booking.timeline.push({
        id: `TL_${nowMs}`,
        timestamp: nowIso,
        actor: 'SePay Webhook (Demo)',
        title: 'Ghi nhận chuyển tiền muộn — Cần đối soát',
        detail: `Nhận ${ev.amountReceivedVnd.toLocaleString('vi-VN')}đ sau khi đơn hết hạn. Đơn giữ nguyên Hết hạn, chuyển Quản trị viên đối soát.`,
      });
      updateBookingCancelFlags(booking, db);
      return { booking: clone(booking), payment: clone(payment), event: clone(ev) };
    }

    if (params.scenario === 'WRONG_AMOUNT' || params.scenario === 'OVERPAID') {
      const received =
        params.scenario === 'WRONG_AMOUNT'
          ? Math.max(10000, payment.expectedAmountVnd - 50000)
          : payment.expectedAmountVnd + 100000;
      const reason =
        params.scenario === 'WRONG_AMOUNT'
          ? `Số tiền chuyển thiếu (${received.toLocaleString('vi-VN')}đ / ${payment.expectedAmountVnd.toLocaleString('vi-VN')}đ).`
          : `Số tiền chuyển thừa (${received.toLocaleString('vi-VN')}đ / ${payment.expectedAmountVnd.toLocaleString('vi-VN')}đ).`;

      const ev: SePayEvent = {
        id: evId,
        transactionRef: txRef,
        paymentId: payment.id,
        paymentCode: payment.paymentCode,
        bookingId: booking.id,
        transferContent: `${payment.paymentCode} ${params.scenario}`,
        amountReceivedVnd: received,
        expectedAmountVnd: payment.expectedAmountVnd,
        receivingAccountDemo: payment.accountNumberDemo,
        occurredAt: nowIso,
        status: 'NEEDS_REVIEW',
        mismatchReason: reason,
      };
      db.paymentEvents.unshift(ev);
      payment.status = 'NEEDS_REVIEW';
      payment.receivedAmountVnd += received;
      payment.updatedAt = nowIso;
      booking.paymentStatus = 'NEEDS_REVIEW';
      booking.updatedAt = nowIso;
      booking.timeline.push({
        id: `TL_${nowMs}`,
        timestamp: nowIso,
        actor: 'SePay Webhook (Demo)',
        title: 'Nhận giao dịch sai lệch số tiền — Cần đối soát',
        detail: `${reason} Không tự xác nhận đơn và không tự hoàn tiền.`,
      });
      updateBookingCancelFlags(booking, db);
      return { booking: clone(booking), payment: clone(payment), event: clone(ev) };
    }

    // EXACT_PAID
    if (booking.status !== 'PENDING_PAYMENT') {
      // Nếu đơn đã hết hạn/hủy, chuyển tiền đúng số tiền vẫn thành NEEDS_REVIEW (không tự mở lại đơn)
      const ev: SePayEvent = {
        id: evId,
        transactionRef: txRef,
        paymentId: payment.id,
        paymentCode: payment.paymentCode,
        bookingId: booking.id,
        transferContent: `${payment.paymentCode} CHUYEN MUON`,
        amountReceivedVnd: payment.expectedAmountVnd,
        expectedAmountVnd: payment.expectedAmountVnd,
        receivingAccountDemo: payment.accountNumberDemo,
        occurredAt: nowIso,
        status: 'NEEDS_REVIEW',
        mismatchReason: 'Đơn không còn ở trạng thái Chờ thanh toán. Chuyển sang Cần đối soát.',
      };
      db.paymentEvents.unshift(ev);
      payment.status = 'NEEDS_REVIEW';
      booking.paymentStatus = 'NEEDS_REVIEW';
      updateBookingCancelFlags(booking, db);
      return { booking: clone(booking), payment: clone(payment), event: clone(ev) };
    }

    const ev: SePayEvent = {
      id: evId,
      transactionRef: txRef,
      paymentId: payment.id,
      paymentCode: payment.paymentCode,
      bookingId: booking.id,
      transferContent: `${payment.paymentCode} THANH TOAN ${booking.id}`,
      amountReceivedVnd: payment.expectedAmountVnd,
      expectedAmountVnd: payment.expectedAmountVnd,
      receivingAccountDemo: payment.accountNumberDemo,
      occurredAt: nowIso,
      status: 'MATCHED',
      mismatchReason: null,
    };
    db.paymentEvents.unshift(ev);
    payment.status = 'PAID';
    payment.receivedAmountVnd = payment.expectedAmountVnd;
    payment.updatedAt = nowIso;
    booking.status = 'CONFIRMED';
    booking.paymentStatus = 'PAID';
    booking.updatedAt = nowIso;
    booking.timeline.push({
      id: `TL_${nowMs}`,
      timestamp: nowIso,
      actor: 'SePay Webhook (Demo)',
      title: 'Ngân hàng xác nhận thanh toán thành công',
      detail: `Khớp giao dịch ${txRef} (${ev.amountReceivedVnd.toLocaleString('vi-VN')}đ). Đơn chuyển Đã xác nhận.`,
    });
    updateBookingCancelFlags(booking, db);
    return { booking: clone(booking), payment: clone(payment), event: clone(ev) };
  });
}
