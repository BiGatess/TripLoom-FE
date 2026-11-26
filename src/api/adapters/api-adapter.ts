import type { DataSourceAdapter } from './data-source';
import { httpRequest } from '@/api/http-client';

/**
 * API Adapter kết nối Django REST/JSON backend (các endpoint ĐỀ XUẤT được mô tả chi tiết trong docs/api-contract.md).
 * Tuyệt đối KHÔNG tự chuyển sang dữ liệu giả khi gọi API thất bại.
 */
export const apiAdapter: DataSourceAdapter = {
  getSession: () => httpRequest('/auth/session'),
  login: (req) => httpRequest('/auth/login', { method: 'POST', body: req }),
  logout: () => httpRequest('/auth/logout', { method: 'POST' }),
  register: (req) => httpRequest('/auth/register', { method: 'POST', body: req }),
  verifyRegister: (req) => httpRequest('/auth/register/verify', { method: 'POST', body: req }),
  requestPasswordReset: (req) => httpRequest('/auth/password-reset/request', { method: 'POST', body: req }),
  resetPassword: (req) => httpRequest('/auth/password-reset/confirm', { method: 'POST', body: req }),
  changePassword: (req) => httpRequest('/auth/change-password', { method: 'POST', body: req }),
  activateStaff: (req) => httpRequest('/auth/staff/activate', { method: 'POST', body: req }),
  resendOtp: (req) => httpRequest('/auth/otp/resend', { method: 'POST', body: req }),
  getOtpState: (email, purpose) => httpRequest('/auth/otp/state', { query: { email, purpose } }),
  getProfile: () => httpRequest('/profile'),
  updateProfile: (req) => httpRequest('/profile', { method: 'PUT', body: req }),

  listCategories: (params) =>
    httpRequest('/categories', {
      query: {
        query: params?.query,
        include_hidden: params?.includeHidden,
        page: params?.page,
        page_size: params?.pageSize,
      },
    }),
  upsertCategory: (id, req) =>
    id
      ? httpRequest(`/admin/categories/${encodeURIComponent(id)}`, { method: 'PUT', body: req })
      : httpRequest('/admin/categories', { method: 'POST', body: req }),
  listDestinations: (params) =>
    httpRequest('/destinations', {
      query: {
        query: params?.query,
        region: params?.region,
        category_id: params?.categoryId,
        status: params?.status,
        include_hidden: params?.includeHidden,
        page: params?.page,
        page_size: params?.pageSize,
      },
    }),
  getDestinationDetail: (id, options) =>
    httpRequest(`/destinations/${encodeURIComponent(id)}`, {
      query: { include_hidden: options?.includeHiddenForAdmin },
    }),
  upsertDestination: (id, req) =>
    id
      ? httpRequest(`/admin/destinations/${encodeURIComponent(id)}`, { method: 'PUT', body: req })
      : httpRequest('/admin/destinations', { method: 'POST', body: req }),
  toggleDestinationStatus: (id, status) =>
    httpRequest(`/admin/destinations/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: { status } }),
  listServices: (params) =>
    httpRequest('/services', {
      query: {
        query: params?.query,
        destination_id: params?.destinationId,
        status: params?.status,
        include_hidden: params?.includeHidden,
        page: params?.page,
        page_size: params?.pageSize,
      },
    }),
  getServiceDetail: (id, options) =>
    httpRequest(`/services/${encodeURIComponent(id)}`, {
      query: { include_hidden: options?.includeHiddenForAdmin },
    }),
  checkServiceAvailability: (serviceId, serviceDate) =>
    httpRequest(`/services/${encodeURIComponent(serviceId)}/availability`, { query: { service_date: serviceDate } }),
  upsertService: (id, req) =>
    id
      ? httpRequest(`/admin/services/${encodeURIComponent(id)}`, { method: 'PUT', body: req })
      : httpRequest('/admin/services', { method: 'POST', body: req }),
  toggleServiceStatus: (id, status) =>
    httpRequest(`/admin/services/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: { status } }),

  listFavorites: () => httpRequest('/favorites'),
  addFavorite: (destinationId) =>
    httpRequest(`/favorites/${encodeURIComponent(destinationId)}`, { method: 'PUT' }),
  removeFavorite: (destinationId) =>
    httpRequest(`/favorites/${encodeURIComponent(destinationId)}`, { method: 'DELETE' }),
  upsertMyReview: (req) => httpRequest('/reviews/mine', { method: 'PUT', body: req }),
  listMyReviews: () => httpRequest('/reviews/mine'),
  listAdminReviews: (params) =>
    httpRequest('/admin/reviews', {
      query: {
        destination_id: params?.destinationId,
        status: params?.status,
        query: params?.query,
        page: params?.page,
        page_size: params?.pageSize,
      },
    }),
  moderateReview: (reviewId, req) =>
    httpRequest(`/admin/reviews/${encodeURIComponent(reviewId)}/moderate`, { method: 'POST', body: req }),

  createTripRequest: (input) => httpRequest('/trip-requests', { method: 'POST', body: input }),
  getRecommendations: (draftRequestId) =>
    httpRequest(`/trip-requests/${encodeURIComponent(draftRequestId)}/recommendations`),
  generateDraftItinerary: (draftRequestId, selectedDestinationIds) =>
    httpRequest(`/trip-requests/${encodeURIComponent(draftRequestId)}/generate-draft`, {
      method: 'POST',
      body: { selectedDestinationIds },
      timeoutMs: 30_000,
    }),
  getItinerary: (id) => httpRequest(`/itineraries/${encodeURIComponent(id)}`),
  listMyItineraries: (params) =>
    httpRequest('/itineraries', { query: { query: params?.query, page: params?.page, page_size: params?.pageSize } }),
  upsertItineraryActivity: (itineraryId, input, expectedVersion) =>
    httpRequest(`/itineraries/${encodeURIComponent(itineraryId)}/activities`, {
      method: 'POST',
      body: { ...input, expectedVersion },
    }),
  reorderOrDeleteActivity: (itineraryId, dayNumber, activityId, action, expectedVersion) =>
    httpRequest(`/itineraries/${encodeURIComponent(itineraryId)}/activities/${encodeURIComponent(activityId)}`, {
      method: 'PATCH',
      body: { dayNumber, action, expectedVersion },
    }),
  previewRegenerateDay: (itineraryId, dayNumber, prompt) =>
    httpRequest(`/itineraries/${encodeURIComponent(itineraryId)}/days/${dayNumber}/regenerate-preview`, {
      method: 'POST',
      body: { prompt },
      timeoutMs: 30_000,
    }),
  applyRegeneratedDay: (itineraryId, dayNumber, activities, expectedVersion) =>
    httpRequest(`/itineraries/${encodeURIComponent(itineraryId)}/days/${dayNumber}/apply-preview`, {
      method: 'POST',
      body: { activities, expectedVersion },
    }),
  saveItinerary: (itineraryId, expectedVersion, title) =>
    httpRequest(`/itineraries/${encodeURIComponent(itineraryId)}/save`, {
      method: 'POST',
      body: { expectedVersion, title },
    }),
  discardItineraryChanges: (itineraryId) =>
    httpRequest(`/itineraries/${encodeURIComponent(itineraryId)}/discard-draft`, {
      method: 'POST',
    }),
  cloneItinerary: (itineraryId, req) =>
    httpRequest(`/itineraries/${encodeURIComponent(itineraryId)}/clone`, { method: 'POST', body: req }),
  deleteItinerary: (itineraryId) =>
    httpRequest(`/itineraries/${encodeURIComponent(itineraryId)}`, { method: 'DELETE' }),
  listConversations: () => httpRequest('/chat/conversations'),
  createConversation: (itineraryId) =>
    httpRequest('/chat/conversations', { method: 'POST', body: { itineraryId: itineraryId ?? null } }),
  sendChatMessage: (conversationId, content) =>
    httpRequest(`/chat/conversations/${encodeURIComponent(conversationId)}/messages`, {
      method: 'POST',
      body: { content },
      timeoutMs: 30_000,
    }),
  retryChatMessage: (conversationId, failedUserMessageId) =>
    httpRequest(
      `/chat/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(failedUserMessageId)}/retry`,
      { method: 'POST', timeoutMs: 30_000 },
    ),

  createBooking: (req) =>
    httpRequest('/bookings', {
      method: 'POST',
      body: req,
      idempotencyKey: req.idempotencyKey,
    }),
  listMyBookings: (params) =>
    httpRequest('/bookings', {
      query: { query: params?.query, status: params?.status, page: params?.page, page_size: params?.pageSize },
    }),
  getMyBookingDetail: (bookingId) => httpRequest(`/bookings/${encodeURIComponent(bookingId)}`),
  cancelMyBooking: (bookingId, req) =>
    httpRequest(`/bookings/${encodeURIComponent(bookingId)}/cancel`, { method: 'POST', body: req }),
  checkPaymentStatus: (bookingId) => httpRequest(`/payments/booking/${encodeURIComponent(bookingId)}/status`),
  listAdminBookings: (params) =>
    httpRequest('/admin/bookings', {
      query: {
        query: params?.query,
        status: params?.status,
        service_date: params?.serviceDate,
        service_id: params?.serviceId,
        page: params?.page,
        page_size: params?.pageSize,
      },
    }),
  getAdminBookingDetail: (bookingId) => httpRequest(`/admin/bookings/${encodeURIComponent(bookingId)}`),
  addAdminBookingNote: (bookingId, req) =>
    httpRequest(`/admin/bookings/${encodeURIComponent(bookingId)}/notes`, { method: 'POST', body: req }),
  adminCancelBooking: (bookingId, req) =>
    httpRequest(`/admin/bookings/${encodeURIComponent(bookingId)}/cancel`, { method: 'POST', body: req }),
  listAdminPayments: (params) =>
    httpRequest('/admin/payments', {
      query: { query: params?.query, status: params?.status, page: params?.page, page_size: params?.pageSize },
    }),
  listAdminPaymentEvents: (params) =>
    httpRequest('/admin/payment-events', {
      query: { query: params?.query, status: params?.status, page: params?.page, page_size: params?.pageSize },
    }),
  getAdminPaymentEventDetail: (eventId) => httpRequest(`/admin/payment-events/${encodeURIComponent(eventId)}`),
  reconcilePaymentEvent: (eventId, req) =>
    httpRequest(`/admin/payment-events/${encodeURIComponent(eventId)}/reconcile`, { method: 'POST', body: req }),

  getBackofficeDashboard: () => httpRequest('/admin/dashboard'),
  listStaff: (params) =>
    httpRequest('/admin/staff', {
      query: {
        query: params?.query,
        status: params?.status,
        permission: params?.permission,
        page: params?.page,
        page_size: params?.pageSize,
      },
    }),
  getStaffDetail: (id) => httpRequest(`/admin/staff/${encodeURIComponent(id)}`),
  createStaff: (req) => httpRequest('/admin/staff', { method: 'POST', body: req }),
  updateStaff: (id, req) => httpRequest(`/admin/staff/${encodeURIComponent(id)}`, { method: 'PUT', body: req }),
  updateStaffPermissions: (id, req) =>
    httpRequest(`/admin/staff/${encodeURIComponent(id)}/permissions`, { method: 'PUT', body: req }),
  lockOrUnlockStaff: (id, req) =>
    httpRequest(`/admin/staff/${encodeURIComponent(id)}/lock-state`, { method: 'POST', body: req }),
  resendStaffActivation: (staffId) =>
    httpRequest(`/admin/staff/${encodeURIComponent(staffId)}/resend-activation`, { method: 'POST' }),
  listAuditLogs: (params) =>
    httpRequest('/admin/audit-logs', {
      query: {
        query: params?.query,
        target_id: params?.targetId,
        target_type: params?.targetType,
        from_date: params?.fromDate,
        to_date: params?.toDate,
        page: params?.page,
        page_size: params?.pageSize,
      },
    }),
};
