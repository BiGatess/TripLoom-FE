import { AppError } from '@/api/errors';
import type {
  AuditLogFilterParams,
  BackofficeDashboardStats,
  CreateStaffRequest,
  LockUnlockStaffRequest,
  OtpChallengeState,
  PaginatedAuditLogs,
  PaginatedStaff,
  StaffFilterParams,
  StaffMember,
  UpdateStaffPermissionsRequest,
  UpdateStaffRequest,
} from '@/api/contracts';
import { STAFF_PERMISSION_GROUPS, type StaffPermissionCode } from '@/config/constants';
import { isValidEmail, validateReason, validateStaffCode } from '@/shared/utils/validation';
import { getMockNowMs, loadMockDb, mutateMockDb, simulateDelay } from '@/mocks/storage/mock-db';
import {
  assertNetworkAvailable,
  issueOtpForEmail,
  requireAdminAccount,
  requireBackofficePermission,
} from './auth-handler';
import { syncExpiredBookings } from './booking-handler';

const ALLOWED_PERMISSION_CODES = new Set<string>(STAFF_PERMISSION_GROUPS.map((g) => g.code));

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

function formatPermLabels(codes: StaffPermissionCode[]): string {
  if (codes.length === 0) return 'Chưa gán nhóm quyền';
  return codes
    .map((c) => STAFF_PERMISSION_GROUPS.find((g) => g.code === c)?.label ?? c)
    .join(', ');
}

export async function mockGetBackofficeDashboard(): Promise<BackofficeDashboardStats> {
  await simulateDelay(90);
  return mutateMockDb((db) => {
    assertNetworkAvailable(db);
    syncExpiredBookings(db);
    const actor = requireBackofficePermission(db);
    const isAdmin = actor.profile.role === 'ADMIN';
    const hasPerm = (p: StaffPermissionCode) => isAdmin || actor.profile.permissions.includes(p);

    const pendingBookings = hasPerm('STAFF_BOOKING')
      ? db.bookings.filter((b) => b.status === 'PENDING_PAYMENT').length
      : 0;
    const confirmedBookings = hasPerm('STAFF_BOOKING')
      ? db.bookings.filter((b) => b.status === 'CONFIRMED').length
      : 0;
    const needsReviewEvents = hasPerm('STAFF_PAYMENT_VIEW')
      ? db.paymentEvents.filter((e) => e.status === 'NEEDS_REVIEW').length
      : 0;
    const pendingReviews = hasPerm('STAFF_REVIEW')
      ? db.reviews.filter((r) => r.status === 'PENDING').length
      : 0;
    const invitedStaff = isAdmin ? db.staffMembers.filter((s) => s.status === 'INVITED').length : 0;
    const activeDestinations = hasPerm('STAFF_DESTINATION')
      ? db.destinations.filter((d) => d.status === 'ACTIVE').length
      : 0;
    const activeServices = hasPerm('STAFF_SERVICE')
      ? db.services.filter((s) => s.status === 'ACTIVE').length
      : 0;

    const workQueue: BackofficeDashboardStats['workQueue'] = [];

    if (hasPerm('STAFF_BOOKING') && pendingBookings > 0) {
      const firstBk = db.bookings.find((b) => b.status === 'PENDING_PAYMENT')!;
      workQueue.push({
        id: `WQ_BK_${firstBk.id}`,
        moduleLabel: 'Booking dịch vụ',
        title: `Đơn ${firstBk.id} đang chờ thanh toán (${firstBk.paymentCode})`,
        subtitle: `${firstBk.serviceName} · ${firstBk.guestCount} khách`,
        badgeLabel: 'Chờ thanh toán',
        badgeTone: 'warning',
        actionLabel: 'Xem đơn',
        href: `/quan-tri/booking/${firstBk.id}`,
        requiredPermission: 'STAFF_BOOKING',
      });
    }

    if (hasPerm('STAFF_PAYMENT_VIEW') && needsReviewEvents > 0) {
      const firstEv = db.paymentEvents.find((e) => e.status === 'NEEDS_REVIEW')!;
      workQueue.push({
        id: `WQ_EV_${firstEv.id}`,
        moduleLabel: 'Thanh toán & đối soát',
        title: `Giao dịch ${firstEv.transactionRef} cần đối soát`,
        subtitle: firstEv.mismatchReason ?? 'Kiểm tra chi tiết giao dịch SePay',
        badgeLabel: 'Cần đối soát',
        badgeTone: 'error',
        actionLabel: isAdmin ? 'Đối soát' : 'Xem chi tiết',
        href: `/quan-tri/giao-dich/${firstEv.id}`,
        requiredPermission: 'STAFF_PAYMENT_VIEW',
      });
    }

    if (hasPerm('STAFF_REVIEW') && pendingReviews > 0) {
      const firstRv = db.reviews.find((r) => r.status === 'PENDING')!;
      workQueue.push({
        id: `WQ_RV_${firstRv.id}`,
        moduleLabel: 'Kiểm duyệt đánh giá',
        title: `${firstRv.id} · ${firstRv.userName} đánh giá ${firstRv.destinationName} (${firstRv.rating} sao)`,
        subtitle: firstRv.comment.slice(0, 90),
        badgeLabel: 'Chờ duyệt',
        badgeTone: 'info',
        actionLabel: 'Xử lý',
        href: '/quan-tri/danh-gia',
        requiredPermission: 'STAFF_REVIEW',
      });
    }

    if (isAdmin && invitedStaff > 0) {
      const firstStf = db.staffMembers.find((s) => s.status === 'INVITED')!;
      workQueue.push({
        id: `WQ_STF_${firstStf.id}`,
        moduleLabel: 'Nhân viên',
        title: `${firstStf.staffCode} · ${firstStf.fullName} chưa kích hoạt`,
        subtitle: `Email mời: ${firstStf.email}`,
        badgeLabel: 'Chờ kích hoạt',
        badgeTone: 'warning',
        actionLabel: 'Xem chi tiết',
        href: `/quan-tri/nhan-vien/${firstStf.id}`,
        requiredPermission: 'ADMIN_ONLY',
      });
    }

    const analytics: BackofficeDashboardStats['analytics'] =
      isAdmin || hasPerm('STAFF_PAYMENT_VIEW')
        ? {
            ranges: {
              day: {
                kpiLabel: 'Doanh thu hôm nay',
                kpiVal: '4,85tr',
                kpiTrend: '+9,2%',
                kpiSub: 'So với 4,44tr hôm qua',
                bookVal: '6',
                bookTrend: '+2 đơn',
                sepayVal: '100%',
                chartTitle: 'Biểu đồ doanh thu hôm nay (theo khung giờ)',
                totalFormatted: '4.850.000đ',
                avgFormatted: '690.000đ/khung giờ',
                donutPeriod: 'Hôm nay',
                donutVal: '4,85tr',
                gridCols: 'grid-cols-7',
                bars: [
                  { label: '08h', valTr: 0.4, displayVal: '0,4tr', heightPct: 32 },
                  { label: '10h', valTr: 0.9, displayVal: '0,9tr', heightPct: 65 },
                  { label: '12h', valTr: 0.6, displayVal: '0,6tr', heightPct: 45 },
                  { label: '14h', valTr: 0.8, displayVal: '0,8tr', heightPct: 58 },
                  { label: '16h', valTr: 0.7, displayVal: '0,7tr', heightPct: 52 },
                  { label: '18h', valTr: 0.5, displayVal: '0,5tr', heightPct: 38 },
                  { label: '20h', valTr: 0.95, displayVal: '0,95tr', heightPct: 76, active: true },
                ],
              },
              week: {
                kpiLabel: 'Doanh thu 7 ngày',
                kpiVal: '38,20tr',
                kpiTrend: '+14,6%',
                kpiSub: 'So với 33,3tr tuần trước',
                bookVal: '41',
                bookTrend: '+11,0%',
                sepayVal: '95,1%',
                chartTitle: 'Biểu đồ doanh thu theo tuần (Thứ 2 – Chủ Nhật)',
                totalFormatted: '38.200.000đ',
                avgFormatted: '5.450.000đ/ngày',
                donutPeriod: '7 ngày',
                donutVal: '38,2tr',
                gridCols: 'grid-cols-7',
                bars: [
                  { label: 'Thứ 2', valTr: 3.9, displayVal: '3,9tr', heightPct: 45 },
                  { label: 'Thứ 3', valTr: 4.2, displayVal: '4,2tr', heightPct: 50 },
                  { label: 'Thứ 4', valTr: 5.8, displayVal: '5,8tr', heightPct: 68 },
                  { label: 'Thứ 5', valTr: 5.1, displayVal: '5,1tr', heightPct: 60 },
                  { label: 'Thứ 6', valTr: 6.4, displayVal: '6,4tr', heightPct: 76 },
                  { label: 'Thứ 7', valTr: 7.6, displayVal: '7,6tr', heightPct: 90 },
                  { label: 'CN', valTr: 5.2, displayVal: '5,2tr', heightPct: 62, active: true },
                ],
              },
              month: {
                kpiLabel: 'Doanh thu tháng 11',
                kpiVal: '128,45tr',
                kpiTrend: '+18,4%',
                kpiSub: 'So với 108,5tr tháng trước',
                bookVal: '142',
                bookTrend: '+12,0%',
                sepayVal: '94,2%',
                chartTitle: 'Biểu đồ doanh thu tháng 11 (theo tuần)',
                totalFormatted: '128.450.000đ',
                avgFormatted: '32.110.000đ/tuần',
                donutPeriod: 'Tháng 11',
                donutVal: '128,4tr',
                gridCols: 'grid-cols-4',
                bars: [
                  { label: 'Tuần 1', valTr: 26.4, displayVal: '26,4tr', heightPct: 68 },
                  { label: 'Tuần 2', valTr: 31.2, displayVal: '31,2tr', heightPct: 80 },
                  { label: 'Tuần 3', valTr: 34.8, displayVal: '34,8tr', heightPct: 88 },
                  { label: 'Tuần 4', valTr: 36.05, displayVal: '36,05tr', heightPct: 95, active: true },
                ],
              },
              '90d': {
                kpiLabel: 'Doanh thu 90 ngày',
                kpiVal: '331,45tr',
                kpiTrend: '+22,5%',
                kpiSub: 'So với 270,5tr kỳ trước',
                bookVal: '386',
                bookTrend: '+19,8%',
                sepayVal: '93,8%',
                chartTitle: 'Biểu đồ doanh thu 90 ngày gần nhất',
                totalFormatted: '331.450.000đ',
                avgFormatted: '55.240.000đ/nửa tháng',
                donutPeriod: '90 ngày',
                donutVal: '331,4tr',
                gridCols: 'grid-cols-6',
                bars: [
                  { label: 'Nửa 1 T9', valTr: 45, displayVal: '45tr', heightPct: 56 },
                  { label: 'Nửa 2 T9', valTr: 50, displayVal: '50tr', heightPct: 62 },
                  { label: 'Nửa 1 T10', valTr: 52, displayVal: '52tr', heightPct: 65 },
                  { label: 'Nửa 2 T10', valTr: 56, displayVal: '56tr', heightPct: 70 },
                  { label: 'Nửa 1 T11', valTr: 61, displayVal: '61tr', heightPct: 78 },
                  { label: 'Nửa 2 T11', valTr: 67.4, displayVal: '67,4tr', heightPct: 92, active: true },
                ],
              },
            },
            breakdown: [
              { key: 'tour', label: 'Tour & Lịch trình', sharePct: 54, valueLabel: '54% · 69,4tr', colorClass: 'bg-primary' },
              { key: 'craft', label: 'Làng nghề & Vé', sharePct: 28, valueLabel: '28% · 36,0tr', colorClass: 'bg-info' },
              { key: 'other', label: 'Dịch vụ khác', sharePct: 18, valueLabel: '18% · 23,1tr', colorClass: 'bg-success' },
            ],
            destinationRevenue: [
              { name: 'Phố cổ Hội An', amountFormatted: '52.400.000đ (41%)', sharePct: 41, barWidthPct: 82, barColorClass: 'bg-primary' },
              { name: 'Bán đảo Sơn Trà', amountFormatted: '34.200.000đ (27%)', sharePct: 27, barWidthPct: 58, barColorClass: 'bg-primary' },
              { name: 'Biển Mỹ Khê', amountFormatted: '24.850.000đ (19%)', sharePct: 19, barWidthPct: 42, barColorClass: 'bg-info' },
              { name: 'Ngũ Hành Sơn & Thanh Hà', amountFormatted: '17.000.000đ (13%)', sharePct: 13, barWidthPct: 28, barColorClass: 'bg-success' },
            ],
          }
        : undefined;

    return {
      pendingBookings,
      confirmedBookings,
      needsReviewEvents,
      pendingReviews,
      invitedStaff,
      activeDestinations,
      activeServices,
      analytics,
      workQueue,
    };
  });
}

export async function mockListStaff(params: StaffFilterParams = {}): Promise<PaginatedStaff> {
  await simulateDelay(90);
  const db = loadMockDb();
  assertNetworkAvailable(db);
  requireAdminAccount(db);

  const q = (params.query ?? '').trim().toLowerCase();
  let items = db.staffMembers.map(clone);

  if (params.status && params.status !== 'ALL') {
    items = items.filter((s) => s.status === params.status);
  }
  if (params.permission && params.permission !== 'ALL') {
    items = items.filter((s) => s.permissions.includes(params.permission as StaffPermissionCode));
  }
  if (q) {
    items = items.filter(
      (s) =>
        s.staffCode.toLowerCase().includes(q) ||
        s.fullName.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q),
    );
  }
  items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return paginate(items, params.page ?? 1, params.pageSize ?? 10);
}

export async function mockGetStaffDetail(id: string): Promise<StaffMember> {
  await simulateDelay(80);
  const db = loadMockDb();
  assertNetworkAvailable(db);
  requireAdminAccount(db);
  const found = db.staffMembers.find((s) => s.id === id || s.staffCode === id);
  if (!found) {
    throw new AppError({ code: 'NOT_FOUND', status: 404, message: 'Không tìm thấy hồ sơ nhân viên.' });
  }
  return clone(found);
}

export async function mockCreateStaff(
  req: CreateStaffRequest,
): Promise<{ staff: StaffMember; otpState: OtpChallengeState | null }> {
  await simulateDelay(150);
  return mutateMockDb((db) => {
    assertNetworkAvailable(db);
    const admin = requireAdminAccount(db);
    const fieldErrors: Record<string, string> = {};

    const normalizedCode = req.staffCode.trim().toUpperCase();
    const codeErr = validateStaffCode(normalizedCode);
    if (codeErr) fieldErrors.staffCode = codeErr;

    const fullName = req.fullName.trim();
    if (fullName.length < 2 || fullName.length > 150) {
      fieldErrors.fullName = 'Họ và tên phải từ 2 đến 150 ký tự.';
    }

    const email = req.email.trim().toLowerCase();
    if (!isValidEmail(email)) {
      fieldErrors.email = 'Vui lòng nhập địa chỉ email hợp lệ.';
    }

    if (req.phone.trim().length > 20) {
      fieldErrors.phone = 'Số điện thoại tối đa 20 ký tự.';
    }

    if (req.notes.trim().length > 1000) {
      fieldErrors.notes = 'Ghi chú tối đa 1.000 ký tự.';
    }

    const invalidPerms = req.permissions.filter((p) => !ALLOWED_PERMISSION_CODES.has(p));
    if (invalidPerms.length > 0) {
      fieldErrors.permissions = 'Có nhóm quyền không nằm trong danh sách được phép cấp cho nhân viên.';
    }

    if (Object.keys(fieldErrors).length > 0) {
      throw new AppError({
        code: 'VALIDATION_ERROR',
        status: 400,
        message: 'Thông tin tạo nhân viên chưa hợp lệ.',
        fieldErrors,
      });
    }

    if (db.staffMembers.some((s) => s.staffCode.toUpperCase() === normalizedCode)) {
      throw new AppError({
        code: 'CONFLICT',
        status: 409,
        message: 'Mã nhân viên này đã tồn tại trên hệ thống.',
        fieldErrors: { staffCode: 'Mã nhân viên đã được sử dụng.' },
      });
    }

    if (db.accounts.some((a) => a.profile.email.toLowerCase() === email)) {
      throw new AppError({
        code: 'CONFLICT',
        status: 409,
        message: 'Email này đã thuộc về một tài khoản khác trên hệ thống.',
        fieldErrors: { email: 'Email đã tồn tại trên hệ thống.' },
      });
    }

    const nowIso = new Date(getMockNowMs()).toISOString();
    const staffId = `STF_${normalizedCode}`;
    const permissions = [...new Set(req.permissions)];

    // Tạo nhân viên ở trạng thái INVITED (không tạo mật khẩu thay cho nhân viên)
    let emailDeliveryStatus: StaffMember['emailDeliveryStatus'] = 'SENT';
    let emailDeliveryMessage = `Email kích hoạt đã gửi tới ${email} (mã 6 số hiệu lực 5 phút).`;
    let otpState: OtpChallengeState | null = null;
    let lastActivationSentAt: string | null = nowIso;

    try {
      const issued = issueOtpForEmail(db, email, 'STAFF_ACTIVATION', { actuallyCreateCode: true });
      otpState = issued.state;
    } catch (err) {
      // QUY TẮC: Gửi email lỗi KHÔNG tạo tài khoản thứ hai — nhân viên vẫn là 1 bản ghi INVITED và có nút gửi lại
      emailDeliveryStatus = 'FAILED';
      emailDeliveryMessage =
        err instanceof AppError
          ? err.message
          : 'Tài khoản đã được tạo ở trạng thái Chờ kích hoạt nhưng gửi email kích hoạt thất bại. Bạn có thể bấm Gửi lại mã.';
      lastActivationSentAt = null;
    }

    const staff: StaffMember = {
      id: staffId,
      staffCode: normalizedCode,
      fullName,
      email,
      phone: req.phone.trim(),
      notes: req.notes.trim(),
      status: 'INVITED',
      hasActivatedBefore: false,
      permissions,
      emailDeliveryStatus,
      emailDeliveryMessage,
      lastActivationSentAt,
      createdBy: `${admin.profile.staffCode ?? 'ADM001'} · ${admin.profile.fullName}`,
      createdAt: nowIso,
      lastLoginAt: null,
      updatedAt: nowIso,
      authVersion: 1,
    };

    db.staffMembers.unshift(staff);
    db.accounts.push({
      password: '',
      authVersion: 1,
      profile: {
        id: staffId,
        email,
        fullName,
        displayName: fullName.split(' ').slice(-2).join(' '),
        avatarUrl: null,
        phone: req.phone.trim(),
        role: 'STAFF',
        staffCode: normalizedCode,
        staffStatus: 'INVITED',
        permissions,
        preferences: {
          categoryIds: [],
          defaultBudgetVnd: null,
          defaultPartySize: 2,
          pace: 'MODERATE',
        },
        updatedAt: nowIso,
      },
    });

    db.auditLogs.unshift({
      id: `LOG${String(db.counters.audit++).padStart(3, '0')}`,
      timestamp: nowIso,
      actorId: admin.profile.id,
      actorName: admin.profile.fullName,
      targetType: 'STAFF',
      targetId: staff.id,
      targetLabel: `${staff.staffCode} · ${staff.fullName}`,
      action: 'STAFF_CREATED',
      actionLabel: 'Tạo tài khoản nhân viên mới',
      reason: req.notes.trim() || 'Tạo hồ sơ nhân sự mới trên hệ thống.',
      beforeSummary: { 'Trạng thái': 'Chưa tồn tại' },
      afterSummary: {
        'Mã nhân viên': staff.staffCode,
        'Trạng thái': 'Chờ kích hoạt',
        'Nhóm quyền': formatPermLabels(staff.permissions),
        'Kết quả gửi email': emailDeliveryStatus === 'SENT' ? 'Đã gửi' : 'Gửi lỗi (có thể gửi lại)',
      },
    });

    return { staff: clone(staff), otpState };
  });
}

export async function mockUpdateStaff(id: string, req: UpdateStaffRequest): Promise<StaffMember> {
  await simulateDelay(130);
  return mutateMockDb((db) => {
    assertNetworkAvailable(db);
    const admin = requireAdminAccount(db);
    const staff = db.staffMembers.find((s) => s.id === id);
    if (!staff) throw new AppError({ code: 'NOT_FOUND', status: 404, message: 'Không tìm thấy nhân viên.' });

    if (staff.updatedAt !== req.expectedUpdatedAt) {
      throw new AppError({
        code: 'CONFLICT',
        status: 409,
        message: 'Hồ sơ nhân viên vừa được cập nhật bởi quản trị viên khác. Vui lòng tải lại trước khi lưu.',
      });
    }

    const fieldErrors: Record<string, string> = {};
    const fullName = req.fullName.trim();
    if (fullName.length < 2 || fullName.length > 150) fieldErrors.fullName = 'Họ tên phải từ 2 đến 150 ký tự.';
    if (req.phone.trim().length > 20) fieldErrors.phone = 'Số điện thoại tối đa 20 ký tự.';
    if (req.notes.trim().length > 1000) fieldErrors.notes = 'Ghi chú tối đa 1.000 ký tự.';
    if (Object.keys(fieldErrors).length > 0) {
      throw new AppError({ code: 'VALIDATION_ERROR', status: 400, message: 'Dữ liệu cập nhật chưa hợp lệ.', fieldErrors });
    }

    const prevName = staff.fullName;
    const prevPhone = staff.phone;
    const nowIso = new Date(getMockNowMs()).toISOString();

    // Email và mã nhân viên TUYỆT ĐỐI không được sửa sau khi tạo
    staff.fullName = fullName;
    staff.phone = req.phone.trim();
    staff.notes = req.notes.trim();
    staff.updatedAt = nowIso;

    const acc = db.accounts.find((a) => a.profile.id === staff.id);
    if (acc) {
      acc.profile.fullName = fullName;
      acc.profile.displayName = fullName.split(' ').slice(-2).join(' ');
      acc.profile.phone = staff.phone;
      acc.profile.updatedAt = nowIso;
    }

    db.auditLogs.unshift({
      id: `LOG${String(db.counters.audit++).padStart(3, '0')}`,
      timestamp: nowIso,
      actorId: admin.profile.id,
      actorName: admin.profile.fullName,
      targetType: 'STAFF',
      targetId: staff.id,
      targetLabel: `${staff.staffCode} · ${staff.fullName}`,
      action: 'STAFF_INFO_UPDATED',
      actionLabel: 'Cập nhật thông tin nhân viên',
      reason: 'Chỉnh sửa họ tên, số điện thoại hoặc ghi chú.',
      beforeSummary: { 'Họ và tên': prevName, 'Điện thoại': prevPhone || 'Trống' },
      afterSummary: { 'Họ và tên': staff.fullName, 'Điện thoại': staff.phone || 'Trống' },
    });

    return clone(staff);
  });
}

export async function mockUpdateStaffPermissions(
  id: string,
  req: UpdateStaffPermissionsRequest,
): Promise<StaffMember> {
  await simulateDelay(140);
  return mutateMockDb((db) => {
    assertNetworkAvailable(db);
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

    const invalid = req.permissions.filter((p) => !ALLOWED_PERMISSION_CODES.has(p));
    if (invalid.length > 0) {
      throw new AppError({
        code: 'FORBIDDEN',
        status: 403,
        message: 'Không được phép gán nhóm quyền ngoài phạm vi nhân viên (không thể cấp quyền Admin).',
      });
    }

    const staff = db.staffMembers.find((s) => s.id === id);
    if (!staff) throw new AppError({ code: 'NOT_FOUND', status: 404, message: 'Không tìm thấy nhân viên.' });
    if (staff.updatedAt !== req.expectedUpdatedAt) {
      throw new AppError({
        code: 'CONFLICT',
        status: 409,
        message: 'Dữ liệu nhân viên đã thay đổi. Vui lòng tải lại trước khi cập nhật quyền.',
      });
    }

    const prevPerms = [...staff.permissions];
    const nextPerms = [...new Set(req.permissions)];
    const nowIso = new Date(getMockNowMs()).toISOString();

    staff.permissions = nextPerms;
    staff.authVersion += 1;
    staff.updatedAt = nowIso;

    const acc = db.accounts.find((a) => a.profile.id === staff.id);
    if (acc) {
      acc.profile.permissions = [...nextPerms];
      acc.authVersion = staff.authVersion;
      acc.profile.updatedAt = nowIso;
    }

    db.auditLogs.unshift({
      id: `LOG${String(db.counters.audit++).padStart(3, '0')}`,
      timestamp: nowIso,
      actorId: admin.profile.id,
      actorName: admin.profile.fullName,
      targetType: 'STAFF',
      targetId: staff.id,
      targetLabel: `${staff.staffCode} · ${staff.fullName}`,
      action: 'STAFF_PERMISSIONS_UPDATED',
      actionLabel: 'Thay đổi nhóm quyền nhân viên',
      reason: req.reason.trim(),
      beforeSummary: { 'Nhóm quyền': formatPermLabels(prevPerms) },
      afterSummary: { 'Nhóm quyền': formatPermLabels(nextPerms), 'Phiên cũ': 'Đã thu hồi, cần đăng nhập lại' },
    });

    return clone(staff);
  });
}

export async function mockLockOrUnlockStaff(id: string, req: LockUnlockStaffRequest): Promise<StaffMember> {
  await simulateDelay(140);
  return mutateMockDb((db) => {
    assertNetworkAvailable(db);
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

    const staff = db.staffMembers.find((s) => s.id === id);
    if (!staff) throw new AppError({ code: 'NOT_FOUND', status: 404, message: 'Không tìm thấy tài khoản nhân viên.' });
    if (staff.updatedAt !== req.expectedUpdatedAt) {
      throw new AppError({
        code: 'CONFLICT',
        status: 409,
        message: 'Hồ sơ nhân viên vừa thay đổi. Vui lòng tải lại trước khi thực hiện.',
      });
    }

    const prevStatus = staff.status;
    const nowIso = new Date(getMockNowMs()).toISOString();

    if (req.action === 'LOCK') {
      if (staff.status === 'LOCKED') {
        throw new AppError({ code: 'CONFLICT', status: 409, message: 'Tài khoản này đã ở trạng thái Đã khóa.' });
      }
      staff.status = 'LOCKED';
      staff.authVersion += 1;
      // Vô hiệu mọi mã OTP kích hoạt đang còn hiệu lực của nhân viên bị khóa
      for (const otp of db.otpCodes) {
        if (otp.email === staff.email.toLowerCase() && otp.purpose === 'STAFF_ACTIVATION') {
          otp.invalidated = true;
        }
      }
      staff.emailDeliveryStatus = 'NOT_REQUIRED';
      staff.emailDeliveryMessage = 'Tài khoản đang bị khóa; mọi phiên và mã kích hoạt cũ đã bị vô hiệu.';
    } else {
      if (staff.status !== 'LOCKED') {
        throw new AppError({ code: 'CONFLICT', status: 409, message: 'Chỉ mở khóa tài khoản đang ở trạng thái Đã khóa.' });
      }
      // QUY TẮC QUAN TRỌNG:
      // Đã kích hoạt trước đó → ACTIVE; chưa kích hoạt → INVITED (cần gửi mã kích hoạt mới)
      staff.status = staff.hasActivatedBefore ? 'ACTIVE' : 'INVITED';
      staff.authVersion += 1;
      if (staff.status === 'INVITED') {
        staff.emailDeliveryStatus = 'NOT_REQUIRED';
        staff.emailDeliveryMessage = 'Tài khoản trở về Chờ kích hoạt. Vui lòng bấm Gửi lại mã kích hoạt mới.';
      } else {
        staff.emailDeliveryMessage = 'Tài khoản đã được mở khóa và hoạt động trở lại.';
      }
    }

    staff.updatedAt = nowIso;

    const acc = db.accounts.find((a) => a.profile.id === staff.id);
    if (acc) {
      acc.profile.staffStatus = staff.status;
      acc.authVersion = staff.authVersion;
      acc.profile.updatedAt = nowIso;
    }

    db.auditLogs.unshift({
      id: `LOG${String(db.counters.audit++).padStart(3, '0')}`,
      timestamp: nowIso,
      actorId: admin.profile.id,
      actorName: admin.profile.fullName,
      targetType: 'STAFF',
      targetId: staff.id,
      targetLabel: `${staff.staffCode} · ${staff.fullName}`,
      action: req.action === 'LOCK' ? 'STAFF_LOCKED' : 'STAFF_UNLOCKED',
      actionLabel: req.action === 'LOCK' ? 'Khóa tài khoản nhân viên' : 'Mở khóa tài khoản nhân viên',
      reason: req.reason.trim(),
      beforeSummary: { 'Trạng thái': prevStatus },
      afterSummary: { 'Trạng thái': staff.status },
    });

    return clone(staff);
  });
}

export async function mockResendStaffActivation(staffId: string): Promise<{ staff: StaffMember; otpState: OtpChallengeState }> {
  await simulateDelay(130);
  return mutateMockDb((db) => {
    assertNetworkAvailable(db);
    const admin = requireAdminAccount(db);
    const staff = db.staffMembers.find((s) => s.id === staffId);
    if (!staff) throw new AppError({ code: 'NOT_FOUND', status: 404, message: 'Không tìm thấy nhân viên.' });
    if (staff.status !== 'INVITED') {
      throw new AppError({
        code: 'CONFLICT',
        status: 409,
        message: 'Chỉ gửi lại mã kích hoạt cho nhân viên ở trạng thái Chờ kích hoạt.',
      });
    }

    const { state } = issueOtpForEmail(db, staff.email, 'STAFF_ACTIVATION', { actuallyCreateCode: true });
    const nowIso = new Date(getMockNowMs()).toISOString();
    staff.emailDeliveryStatus = 'SENT';
    staff.emailDeliveryMessage = `Đã gửi lại mã kích hoạt tới ${staff.email}.`;
    staff.lastActivationSentAt = nowIso;
    staff.updatedAt = nowIso;

    db.auditLogs.unshift({
      id: `LOG${String(db.counters.audit++).padStart(3, '0')}`,
      timestamp: nowIso,
      actorId: admin.profile.id,
      actorName: admin.profile.fullName,
      targetType: 'STAFF',
      targetId: staff.id,
      targetLabel: `${staff.staffCode} · ${staff.fullName}`,
      action: 'STAFF_ACTIVATION_RESENT',
      actionLabel: 'Gửi lại thư kích hoạt nhân viên',
      reason: 'Quản trị viên yêu cầu gửi lại mã kích hoạt (không tạo tài khoản trùng).',
      beforeSummary: { 'Trạng thái': 'Chờ kích hoạt' },
      afterSummary: { 'Kết quả gửi email': 'Đã gửi mã mới (mã cũ đã vô hiệu)' },
    });

    return { staff: clone(staff), otpState: state };
  });
}

export async function mockListAuditLogs(params: AuditLogFilterParams = {}): Promise<PaginatedAuditLogs> {
  await simulateDelay(90);
  const db = loadMockDb();
  assertNetworkAvailable(db);
  // Chỉ Admin xem nhật ký hệ thống & nhân sự
  requireAdminAccount(db);

  const q = (params.query ?? '').trim().toLowerCase();
  let items = db.auditLogs.map(clone);

  if (params.targetId) {
    items = items.filter((l) => l.targetId === params.targetId || l.targetLabel.includes(params.targetId!));
  }
  if (params.targetType && params.targetType !== 'ALL') {
    items = items.filter((l) => l.targetType === params.targetType);
  }
  if (params.fromDate) {
    items = items.filter((l) => l.timestamp.slice(0, 10) >= params.fromDate!);
  }
  if (params.toDate) {
    items = items.filter((l) => l.timestamp.slice(0, 10) <= params.toDate!);
  }
  if (q) {
    items = items.filter(
      (l) =>
        l.actorName.toLowerCase().includes(q) ||
        l.targetLabel.toLowerCase().includes(q) ||
        l.actionLabel.toLowerCase().includes(q) ||
        l.reason.toLowerCase().includes(q),
    );
  }

  return paginate(items, params.page ?? 1, params.pageSize ?? 12);
}
