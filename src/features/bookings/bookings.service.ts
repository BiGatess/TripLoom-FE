import { getDataSource } from '@/api/adapters/data-source';
import type {
  AddBookingNoteRequest,
  Booking,
  BookingFilterParams,
  CancelBookingRequest,
  CreateBookingRequest,
  PaginatedBookings,
  PaymentRecord,
} from '@/api/contracts';

export const bookingsService = {
  createBooking: (req: CreateBookingRequest): Promise<{ booking: Booking; payment: PaymentRecord }> =>
    getDataSource().createBooking(req),
  listMyBookings: (params?: BookingFilterParams): Promise<PaginatedBookings> => getDataSource().listMyBookings(params),
  getMyBookingDetail: (bookingId: string): Promise<{ booking: Booking; payment: PaymentRecord }> =>
    getDataSource().getMyBookingDetail(bookingId),
  cancelMyBooking: (bookingId: string, req: CancelBookingRequest): Promise<Booking> =>
    getDataSource().cancelMyBooking(bookingId, req),
  listAdminBookings: (params?: BookingFilterParams): Promise<PaginatedBookings> =>
    getDataSource().listAdminBookings(params),
  getAdminBookingDetail: (bookingId: string): Promise<{ booking: Booking; payment: PaymentRecord | null }> =>
    getDataSource().getAdminBookingDetail(bookingId),
  addAdminBookingNote: (bookingId: string, req: AddBookingNoteRequest): Promise<Booking> =>
    getDataSource().addAdminBookingNote(bookingId, req),
  adminCancelBooking: (bookingId: string, req: CancelBookingRequest): Promise<Booking> =>
    getDataSource().adminCancelBooking(bookingId, req),
};
