import type {
  BookingStatus,
  PaginatedResponse,
  PaginationParams,
  PaymentEventStatus,
  PaymentStatus,
} from './common';

export interface BookingTimelineItem {
  id: string;
  timestamp: string;
  actor: string;
  title: string;
  detail: string;
}

export interface Booking {
  id: string;
  ownerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  serviceId: string;
  serviceName: string;
  destinationId: string;
  destinationName: string;
  serviceDate: string; // YYYY-MM-DD
  guestCount: number;
  unitPriceSnapshotVnd: number;
  totalAmountVnd: number;
  status: BookingStatus;
  paymentId: string;
  paymentCode: string;
  paymentStatus: PaymentStatus;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  canCustomerCancel: boolean;
  canStaffCancel: boolean;
  internalNotice: string;
  timeline: BookingTimelineItem[];
  supportNotes: Array<{
    id: string;
    author: string;
    content: string;
    createdAt: string;
  }>;
}

export interface PaymentRecord {
  id: string;
  paymentCode: string;
  bookingId: string;
  serviceName: string;
  customerName: string;
  expectedAmountVnd: number;
  receivedAmountVnd: number;
  status: PaymentStatus;
  expiresAt: string;
  bankName: string;
  accountName: string;
  accountNumberDemo: string;
  qrPlaceholderLabel: string;
  updatedAt: string;
}

export interface SePayEvent {
  id: string;
  transactionRef: string;
  paymentId: string | null;
  paymentCode: string | null;
  bookingId: string | null;
  transferContent: string;
  amountReceivedVnd: number;
  expectedAmountVnd: number | null;
  receivingAccountDemo: string;
  occurredAt: string;
  status: PaymentEventStatus;
  mismatchReason: string | null;
  resolutionNote?: string;
  resolvedBy?: string;
  resolvedAt?: string;
}

export interface CreateBookingRequest {
  serviceId: string;
  serviceDate: string;
  guestCount: number;
  contactName: string;
  contactPhone: string;
  acknowledgedUnitPriceVnd: number;
  idempotencyKey: string;
}

export interface CancelBookingRequest {
  reason: string;
}

export interface AddBookingNoteRequest {
  content: string;
}

export interface ReconcileEventRequest {
  decision: 'CONFIRM_PAID' | 'MARK_RESOLVED_EXTERNAL' | 'IGNORE_EVENT';
  reason: string;
}

export interface BookingFilterParams extends PaginationParams {
  query?: string;
  status?: BookingStatus | 'ALL';
  serviceDate?: string;
  serviceId?: string;
}

export interface PaymentFilterParams extends PaginationParams {
  query?: string;
  status?: PaymentStatus | 'ALL';
}

export interface PaymentEventFilterParams extends PaginationParams {
  query?: string;
  status?: PaymentEventStatus | 'ALL';
}

export type PaginatedBookings = PaginatedResponse<Booking>;
export type PaginatedPayments = PaginatedResponse<PaymentRecord>;
export type PaginatedPaymentEvents = PaginatedResponse<SePayEvent>;
