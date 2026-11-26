import { getDataSource } from '@/api/adapters/data-source';
import type {
  Booking,
  PaginatedPaymentEvents,
  PaginatedPayments,
  PaymentEventFilterParams,
  PaymentFilterParams,
  PaymentRecord,
  ReconcileEventRequest,
  SePayEvent,
} from '@/api/contracts';

export const paymentsService = {
  checkPaymentStatus: (bookingId: string): Promise<{ booking: Booking; payment: PaymentRecord }> =>
    getDataSource().checkPaymentStatus(bookingId),
  listAdminPayments: (params?: PaymentFilterParams): Promise<PaginatedPayments> =>
    getDataSource().listAdminPayments(params),
  listAdminPaymentEvents: (params?: PaymentEventFilterParams): Promise<PaginatedPaymentEvents> =>
    getDataSource().listAdminPaymentEvents(params),
  getAdminPaymentEventDetail: (
    eventId: string,
  ): Promise<{ event: SePayEvent; payment: PaymentRecord | null; booking: Booking | null; canReconcile: boolean }> =>
    getDataSource().getAdminPaymentEventDetail(eventId),
  reconcilePaymentEvent: (eventId: string, req: ReconcileEventRequest): Promise<SePayEvent> =>
    getDataSource().reconcilePaymentEvent(eventId, req),
};
