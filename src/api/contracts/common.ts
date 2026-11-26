export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

export type ActiveStatus = 'ACTIVE' | 'HIDDEN';
export type TravelPace = 'SLOW' | 'MODERATE' | 'FAST';
export type UserRole = 'MEMBER' | 'STAFF' | 'ADMIN';
export type StaffAccountStatus = 'INVITED' | 'ACTIVE' | 'LOCKED';
export type ReviewStatus = 'PENDING' | 'PUBLISHED' | 'HIDDEN';

export type BookingStatus = 'PENDING_PAYMENT' | 'CONFIRMED' | 'CANCELLED' | 'EXPIRED';
export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'NEEDS_REVIEW';
export type PaymentEventStatus = 'RECEIVED' | 'MATCHED' | 'NEEDS_REVIEW' | 'IGNORED' | 'RESOLVED';

export type OtpPurpose = 'REGISTER' | 'PASSWORD_RESET' | 'STAFF_ACTIVATION';
