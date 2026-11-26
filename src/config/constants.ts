export const BRAND = {
  name: 'TripLoom',
  tagline: 'Kết nối trải nghiệm, dệt nên hành trình.',
  timezone: 'Asia/Ho_Chi_Minh',
} as const;

export const OTP_RULES = {
  codeLength: 6,
  expiresInSeconds: 5 * 60, // 5 phút
  resendCooldownSeconds: 60, // 60 giây
  maxSendsPerBurst: 5, // tối đa 5 lần gửi
  burstLockoutSeconds: 15 * 60, // chờ 15 phút sau lần thứ 5
  maxVerifyAttempts: 5, // tối đa 5 lần nhập sai cho 1 mã
} as const;

export const BOOKING_RULES = {
  holdMinutes: 15,
  holdSeconds: 15 * 60,
} as const;

export const DRAFT_RULES = {
  ttlHours: 24,
} as const;

export const STAFF_PERMISSION_GROUPS = [
  {
    code: 'STAFF_DESTINATION',
    label: 'Quản lý địa điểm',
    description: 'Xem, thêm mới, chỉnh sửa và ẩn/kích hoạt địa điểm du lịch.',
    capabilities: ['Xem danh sách địa điểm', 'Thêm và sửa địa điểm', 'Ẩn / kích hoạt địa điểm'],
  },
  {
    code: 'STAFF_SERVICE',
    label: 'Quản lý dịch vụ',
    description: 'Xem, thêm mới, chỉnh sửa và ẩn/kích hoạt dịch vụ có thể đặt.',
    capabilities: ['Xem danh sách dịch vụ', 'Thêm và sửa dịch vụ', 'Ẩn / kích hoạt dịch vụ'],
  },
  {
    code: 'STAFF_BOOKING',
    label: 'Hỗ trợ booking',
    description: 'Tra cứu đơn đặt dịch vụ, ghi chú hỗ trợ và hủy đơn khi còn đủ điều kiện.',
    capabilities: ['Xem danh sách và chi tiết booking', 'Thêm ghi chú vận hành', 'Hủy đơn đủ điều kiện kèm lý do'],
  },
  {
    code: 'STAFF_REVIEW',
    label: 'Kiểm duyệt đánh giá',
    description: 'Duyệt công khai hoặc ẩn đánh giá kèm lý do; không được sửa nội dung hay số sao.',
    capabilities: ['Xem tất cả đánh giá', 'Công khai / ẩn đánh giá kèm lý do'],
  },
  {
    code: 'STAFF_PAYMENT_VIEW',
    label: 'Xem thanh toán',
    description: 'Chỉ đọc thông tin thanh toán và sự kiện SePay được phép; không có quyền quyết định đối soát.',
    capabilities: ['Xem danh sách payment', 'Xem sự kiện giao dịch (chỉ đọc)'],
  },
] as const;

export type StaffPermissionCode = (typeof STAFF_PERMISSION_GROUPS)[number]['code'];

export const PACE_LABELS: Record<'SLOW' | 'MODERATE' | 'FAST', string> = {
  SLOW: 'Chậm',
  MODERATE: 'Vừa phải',
  FAST: 'Nhanh',
};

export const REGIONS = ['Đà Nẵng', 'Hội An', 'Huế', 'Nha Trang', 'Đà Lạt'] as const;
