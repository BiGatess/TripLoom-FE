import { router, type RouteDefinition } from './router';
import { appEnv } from '@/config/env';
import { toUserErrorMessage } from '@/api/errors';
import { renderErrorPage } from '@/features/system/pages/ErrorPage';
import { initCustomSelectEnhancer } from '@/shared/components/CustomSelect';

const ROUTES: RouteDefinition[] = [
  // Public (P01 - P04)
  {
    pattern: '/',
    title: 'Trang chủ',
    policy: { kind: 'public' },
    handler: async (ctx) => (await import('@/features/destinations/pages/HomePage')).renderHomePage(ctx),
  },
  {
    pattern: '/dia-diem',
    title: 'Khám phá địa điểm',
    policy: { kind: 'public' },
    handler: async (ctx) =>
      (await import('@/features/destinations/pages/DestinationSearchPage')).renderDestinationSearchPage(ctx),
  },
  {
    pattern: '/dia-diem/:id',
    title: 'Chi tiết địa điểm',
    policy: { kind: 'public' },
    handler: async (ctx) =>
      (await import('@/features/destinations/pages/DestinationDetailPage')).renderDestinationDetailPage(ctx),
  },
  {
    pattern: '/dich-vu/:id',
    title: 'Chi tiết dịch vụ',
    policy: { kind: 'public' },
    handler: async (ctx) => (await import('@/features/services/pages/ServiceDetailPage')).renderServiceDetailPage(ctx),
  },

  // Auth (T01 - T06)
  {
    pattern: '/dang-nhap',
    title: 'Đăng nhập',
    policy: { kind: 'guest-only' },
    handler: async (ctx) => (await import('@/features/auth/pages/LoginPage')).renderLoginPage(ctx),
  },
  {
    pattern: '/dang-ky',
    title: 'Đăng ký tài khoản',
    policy: { kind: 'guest-only' },
    handler: async (ctx) => (await import('@/features/auth/pages/RegisterPage')).renderRegisterPage(ctx),
  },
  {
    pattern: '/dang-ky/xac-thuc',
    title: 'Xác thực email đăng ký',
    policy: { kind: 'guest-only' },
    handler: async (ctx) => (await import('@/features/auth/pages/VerifyEmailPage')).renderVerifyEmailPage(ctx),
  },
  {
    pattern: '/quen-mat-khau',
    title: 'Quên mật khẩu',
    policy: { kind: 'public' },
    handler: async (ctx) => (await import('@/features/auth/pages/ForgotPasswordPage')).renderForgotPasswordPage(ctx),
  },
  {
    pattern: '/quen-mat-khau/dat-lai',
    title: 'Đặt lại mật khẩu',
    policy: { kind: 'public' },
    handler: async (ctx) => (await import('@/features/auth/pages/ResetPasswordPage')).renderResetPasswordPage(ctx),
  },
  {
    pattern: '/kich-hoat-nhan-vien',
    title: 'Kích hoạt tài khoản nhân viên',
    policy: { kind: 'public' },
    handler: async (ctx) => (await import('@/features/auth/pages/StaffActivatePage')).renderStaffActivatePage(ctx),
  },

  // Member Space (U01 - U12)
  {
    pattern: '/ca-nhan',
    title: 'Không gian cá nhân',
    policy: { kind: 'authenticated' },
    handler: async (ctx) => (await import('@/features/profile/pages/MemberDashboardPage')).renderMemberDashboardPage(ctx),
  },
  {
    pattern: '/ca-nhan/ho-so',
    title: 'Hồ sơ cá nhân',
    policy: { kind: 'authenticated' },
    handler: async (ctx) => (await import('@/features/profile/pages/ProfilePage')).renderProfilePage(ctx),
  },
  {
    pattern: '/lap-lich-trinh',
    title: 'Lập lịch trình chuyến đi',
    policy: { kind: 'authenticated' },
    handler: async (ctx) => (await import('@/features/trip-planning/pages/TripWizardPage')).renderTripWizardPage(ctx),
  },
  {
    pattern: '/de-xuat',
    title: 'Đề xuất địa điểm cá nhân hóa',
    policy: { kind: 'authenticated' },
    handler: async (ctx) =>
      (await import('@/features/trip-planning/pages/RecommendationsPage')).renderRecommendationsPage(ctx),
  },
  {
    pattern: '/lich-trinh/nhap/:draftId',
    title: 'Bản nháp lịch trình',
    policy: { kind: 'authenticated' },
    handler: async (ctx) =>
      (await import('@/features/itineraries/pages/ItineraryDetailPage')).renderItineraryDetailPage(ctx),
  },
  {
    pattern: '/lich-trinh/:id',
    title: 'Chi tiết lịch trình',
    policy: { kind: 'authenticated' },
    handler: async (ctx) =>
      (await import('@/features/itineraries/pages/ItineraryDetailPage')).renderItineraryDetailPage(ctx),
  },
  {
    pattern: '/lich-trinh-cua-toi',
    title: 'Lịch sử lịch trình',
    policy: { kind: 'authenticated' },
    handler: async (ctx) =>
      (await import('@/features/itineraries/pages/ItineraryHistoryPage')).renderItineraryHistoryPage(ctx),
  },
  {
    pattern: '/chat',
    title: 'Chat AI TripLoom',
    policy: { kind: 'authenticated' },
    handler: async (ctx) => (await import('@/features/chat/pages/ChatPage')).renderChatPage(ctx),
  },
  {
    pattern: '/chat/:conversationId',
    title: 'Chat AI TripLoom',
    policy: { kind: 'authenticated' },
    handler: async (ctx) => (await import('@/features/chat/pages/ChatPage')).renderChatPage(ctx),
  },
  {
    pattern: '/yeu-thich',
    title: 'Địa điểm yêu thích',
    policy: { kind: 'authenticated' },
    handler: async (ctx) => (await import('@/features/favorites/pages/FavoritesPage')).renderFavoritesPage(ctx),
  },
  {
    pattern: '/danh-gia-cua-toi',
    title: 'Đánh giá của tôi',
    policy: { kind: 'authenticated' },
    handler: async (ctx) => (await import('@/features/reviews/pages/MyReviewsPage')).renderMyReviewsPage(ctx),
  },

  // Booking & Payments (B01 - B05)
  {
    pattern: '/dat-dich-vu/:serviceId',
    title: 'Xác nhận đặt dịch vụ',
    policy: { kind: 'authenticated' },
    handler: async (ctx) =>
      (await import('@/features/bookings/pages/BookingConfirmPage')).renderBookingConfirmPage(ctx),
  },
  {
    pattern: '/don-dich-vu',
    title: 'Đơn dịch vụ của tôi',
    policy: { kind: 'authenticated' },
    handler: async (ctx) => (await import('@/features/bookings/pages/MyBookingsPage')).renderMyBookingsPage(ctx),
  },
  {
    pattern: '/don-dich-vu/:bookingId',
    title: 'Chi tiết đơn dịch vụ',
    policy: { kind: 'authenticated' },
    handler: async (ctx) => (await import('@/features/bookings/pages/BookingDetailPage')).renderBookingDetailPage(ctx),
  },
  {
    pattern: '/thanh-toan/:bookingId',
    title: 'Thanh toán QR SePay',
    policy: { kind: 'authenticated' },
    handler: async (ctx) => (await import('@/features/payments/pages/PaymentQrPage')).renderPaymentQrPage(ctx),
  },
  {
    pattern: '/thanh-toan/:bookingId/ket-qua',
    title: 'Kết quả thanh toán',
    policy: { kind: 'authenticated' },
    handler: async (ctx) => (await import('@/features/payments/pages/PaymentResultPage')).renderPaymentResultPage(ctx),
  },

  // Backoffice (A01 - A17 + Cổng đăng nhập Quản trị riêng)
  {
    pattern: '/quan-tri/dang-nhap',
    title: 'Đăng nhập Quản trị',
    policy: { kind: 'guest-only' },
    handler: async (ctx) => (await import('@/features/auth/pages/AdminLoginPage')).renderAdminLoginPage(ctx),
  },
  {
    pattern: '/quan-tri',
    title: 'Tổng quan quản trị',
    policy: { kind: 'backoffice' },
    handler: async (ctx) =>
      (await import('@/features/admin-catalog/pages/AdminDashboardPage')).renderAdminDashboardPage(ctx),
  },
  {
    pattern: '/quan-tri/danh-muc',
    title: 'Quản lý danh mục',
    policy: { kind: 'backoffice', adminOnly: true },
    handler: async (ctx) => (await import('@/features/admin-catalog/pages/CategoriesPage')).renderCategoriesPage(ctx),
  },
  {
    pattern: '/quan-tri/dia-diem',
    title: 'Quản lý địa điểm',
    policy: { kind: 'backoffice', permission: 'STAFF_DESTINATION' },
    handler: async (ctx) =>
      (await import('@/features/admin-catalog/pages/AdminDestinationsPage')).renderAdminDestinationsPage(ctx),
  },
  {
    pattern: '/quan-tri/dia-diem/them',
    title: 'Thêm địa điểm',
    policy: { kind: 'backoffice', permission: 'STAFF_DESTINATION' },
    handler: async (ctx) =>
      (await import('@/features/admin-catalog/pages/DestinationFormPage')).renderDestinationFormPage(ctx),
  },
  {
    pattern: '/quan-tri/dia-diem/:id/sua',
    title: 'Chỉnh sửa địa điểm',
    policy: { kind: 'backoffice', permission: 'STAFF_DESTINATION' },
    handler: async (ctx) =>
      (await import('@/features/admin-catalog/pages/DestinationFormPage')).renderDestinationFormPage(ctx),
  },
  {
    pattern: '/quan-tri/dich-vu',
    title: 'Quản lý dịch vụ',
    policy: { kind: 'backoffice', permission: 'STAFF_SERVICE' },
    handler: async (ctx) =>
      (await import('@/features/admin-catalog/pages/AdminServicesPage')).renderAdminServicesPage(ctx),
  },
  {
    pattern: '/quan-tri/dich-vu/them',
    title: 'Thêm dịch vụ',
    policy: { kind: 'backoffice', permission: 'STAFF_SERVICE' },
    handler: async (ctx) => (await import('@/features/admin-catalog/pages/ServiceFormPage')).renderServiceFormPage(ctx),
  },
  {
    pattern: '/quan-tri/dich-vu/:id/sua',
    title: 'Chỉnh sửa dịch vụ',
    policy: { kind: 'backoffice', permission: 'STAFF_SERVICE' },
    handler: async (ctx) => (await import('@/features/admin-catalog/pages/ServiceFormPage')).renderServiceFormPage(ctx),
  },
  {
    pattern: '/quan-tri/booking',
    title: 'Danh sách Booking nội bộ',
    policy: { kind: 'backoffice', permission: 'STAFF_BOOKING' },
    handler: async (ctx) => (await import('@/features/bookings/pages/AdminBookingsPage')).renderAdminBookingsPage(ctx),
  },
  {
    pattern: '/quan-tri/booking/:id',
    title: 'Chi tiết & hỗ trợ Booking',
    policy: { kind: 'backoffice', permission: 'STAFF_BOOKING' },
    handler: async (ctx) =>
      (await import('@/features/bookings/pages/AdminBookingDetailPage')).renderAdminBookingDetailPage(ctx),
  },
  {
    pattern: '/quan-tri/danh-gia',
    title: 'Kiểm duyệt đánh giá',
    policy: { kind: 'backoffice', permission: 'STAFF_REVIEW' },
    handler: async (ctx) =>
      (await import('@/features/reviews/pages/ReviewModerationPage')).renderReviewModerationPage(ctx),
  },
  {
    pattern: '/quan-tri/thanh-toan',
    title: 'Thanh toán & giao dịch SePay',
    policy: { kind: 'backoffice', permission: 'STAFF_PAYMENT_VIEW' },
    handler: async (ctx) => (await import('@/features/payments/pages/AdminPaymentsPage')).renderAdminPaymentsPage(ctx),
  },
  {
    pattern: '/quan-tri/giao-dich/:eventId',
    title: 'Chi tiết giao dịch & đối soát',
    policy: { kind: 'backoffice', permission: 'STAFF_PAYMENT_VIEW' },
    handler: async (ctx) =>
      (await import('@/features/payments/pages/AdminPaymentDetailPage')).renderAdminPaymentDetailPage(ctx),
  },
  {
    pattern: '/quan-tri/nhan-vien',
    title: 'Quản lý nhân viên',
    policy: { kind: 'backoffice', adminOnly: true },
    handler: async (ctx) => (await import('@/features/staff/pages/StaffListPage')).renderStaffListPage(ctx),
  },
  {
    pattern: '/quan-tri/nhan-vien/them',
    title: 'Thêm nhân viên',
    policy: { kind: 'backoffice', adminOnly: true },
    handler: async (ctx) => (await import('@/features/staff/pages/StaffCreatePage')).renderStaffCreatePage(ctx),
  },
  {
    pattern: '/quan-tri/nhan-vien/:id',
    title: 'Chi tiết nhân viên',
    policy: { kind: 'backoffice', adminOnly: true },
    handler: async (ctx) => (await import('@/features/staff/pages/StaffDetailPage')).renderStaffDetailPage(ctx),
  },
  {
    pattern: '/quan-tri/nhat-ky',
    title: 'Nhật ký hệ thống',
    policy: { kind: 'backoffice', adminOnly: true },
    handler: async (ctx) => (await import('@/features/staff/pages/AuditLogPage')).renderAuditLogPage(ctx),
  },

  // System Errors (X01)
  {
    pattern: '/403',
    title: 'Không có quyền truy cập',
    policy: { kind: 'public' },
    handler: (ctx) => renderErrorPage(ctx, { code: '403' }),
  },
  {
    pattern: '/404',
    title: 'Không tìm thấy trang',
    policy: { kind: 'public' },
    handler: (ctx) => renderErrorPage(ctx, { code: '404' }),
  },
];

export function bootstrapApp(): void {
  const appEl = document.getElementById('app');
  if (!appEl) {
    throw new Error('Không tìm thấy phần tử gốc #app để khởi chạy ứng dụng.');
  }

  router.register(ROUTES);
  router.setForbiddenHandler((ctx, reason) => {
    renderErrorPage(ctx, { code: '403', description: reason });
  });
  router.setNotFoundHandler((ctx) => {
    renderErrorPage(ctx, { code: '404' });
  });
  router.setErrorHandler((ctx, err) => {
    renderErrorPage(ctx, { code: '500', description: toUserErrorMessage(err) });
  });

  initCustomSelectEnhancer();
  router.mount(appEl);
  if (appEnv.enableDevTools) {
    void import('@/shared/components/DevToolbar').then((mod) => mod.mountDevToolbar());
  }
}
