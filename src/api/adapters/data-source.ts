import type {
  ActivateStaffRequest,
  ActiveStatus,
  AddBookingNoteRequest,
  AuditLogFilterParams,
  AuthSession,
  BackofficeDashboardStats,
  Booking,
  BookingFilterParams,
  CancelBookingRequest,
  Category,
  ChangePasswordRequest,
  ChatConversation,
  CloneItineraryRequest,
  CreateBookingRequest,
  CreateStaffRequest,
  Destination,
  DestinationDetailResponse,
  DestinationFilterParams,
  ForgotPasswordRequest,
  Itinerary,
  ItineraryActivity,
  ItineraryListParams,
  LockUnlockStaffRequest,
  LoginRequest,
  ModerateReviewRequest,
  OtpChallengeState,
  OtpPurpose,
  PaginatedAuditLogs,
  PaginatedBookings,
  PaginatedCategories,
  PaginatedDestinations,
  PaginatedItineraries,
  PaginatedPaymentEvents,
  PaginatedPayments,
  PaginatedReviews,
  PaginatedServices,
  PaginatedStaff,
  PaymentEventFilterParams,
  PaymentFilterParams,
  PaymentRecord,
  RecommendationsResponse,
  ReconcileEventRequest,
  RegenerateDayPreview,
  RegisterRequest,
  ResendOtpRequest,
  ResetPasswordRequest,
  Review,
  ReviewFilterParams,
  SePayEvent,
  ServiceAvailability,
  ServiceFilterParams,
  StaffFilterParams,
  StaffMember,
  TravelService,
  TripDraftRequest,
  TripRequestInput,
  UpdateProfileRequest,
  UpdateStaffPermissionsRequest,
  UpdateStaffRequest,
  UpsertActivityInput,
  UpsertCategoryRequest,
  UpsertDestinationRequest,
  UpsertReviewRequest,
  UpsertServiceRequest,
  UserProfile,
  VerifyRegisterRequest,
} from '@/api/contracts';
import { appEnv } from '@/config/env';
import { mockAdapter } from './mock-adapter';
import { apiAdapter } from './api-adapter';

export interface DataSourceAdapter {
  // Auth & Profile
  getSession(): Promise<AuthSession>;
  login(req: LoginRequest): Promise<AuthSession>;
  logout(): Promise<void>;
  register(req: RegisterRequest): Promise<OtpChallengeState>;
  verifyRegister(req: VerifyRegisterRequest): Promise<{ message: string; email: string }>;
  requestPasswordReset(req: ForgotPasswordRequest): Promise<OtpChallengeState>;
  resetPassword(req: ResetPasswordRequest): Promise<{ message: string }>;
  changePassword(req: ChangePasswordRequest): Promise<{ message: string }>;
  activateStaff(req: ActivateStaffRequest): Promise<{ message: string }>;
  resendOtp(req: ResendOtpRequest): Promise<OtpChallengeState>;
  getOtpState(email: string, purpose: OtpPurpose): Promise<OtpChallengeState>;
  getProfile(): Promise<UserProfile>;
  updateProfile(req: UpdateProfileRequest): Promise<UserProfile>;

  // Catalog (Public & Admin)
  listCategories(params?: { query?: string; includeHidden?: boolean; page?: number; pageSize?: number }): Promise<PaginatedCategories>;
  upsertCategory(id: string | null, req: UpsertCategoryRequest): Promise<Category>;
  listDestinations(params?: DestinationFilterParams): Promise<PaginatedDestinations>;
  getDestinationDetail(id: string, options?: { includeHiddenForAdmin?: boolean }): Promise<DestinationDetailResponse>;
  upsertDestination(id: string | null, req: UpsertDestinationRequest): Promise<Destination>;
  toggleDestinationStatus(id: string, status: ActiveStatus): Promise<Destination>;
  listServices(params?: ServiceFilterParams): Promise<PaginatedServices>;
  getServiceDetail(id: string, options?: { includeHiddenForAdmin?: boolean }): Promise<TravelService>;
  checkServiceAvailability(serviceId: string, serviceDate: string): Promise<ServiceAvailability>;
  upsertService(id: string | null, req: UpsertServiceRequest): Promise<TravelService>;
  toggleServiceStatus(id: string, status: ActiveStatus): Promise<TravelService>;

  // Favorites & Reviews
  listFavorites(): Promise<Destination[]>;
  addFavorite(destinationId: string): Promise<{ isFavorite: true }>;
  removeFavorite(destinationId: string): Promise<{ isFavorite: false }>;
  upsertMyReview(req: UpsertReviewRequest): Promise<Review>;
  listMyReviews(): Promise<Review[]>;
  listAdminReviews(params?: ReviewFilterParams): Promise<PaginatedReviews>;
  moderateReview(reviewId: string, req: ModerateReviewRequest): Promise<Review>;

  // Trip Planning, Itineraries & Chat
  createTripRequest(input: TripRequestInput): Promise<TripDraftRequest>;
  getRecommendations(draftRequestId: string): Promise<RecommendationsResponse>;
  generateDraftItinerary(draftRequestId: string, selectedDestinationIds?: string[]): Promise<Itinerary>;
  getItinerary(id: string): Promise<Itinerary>;
  listMyItineraries(params?: ItineraryListParams): Promise<PaginatedItineraries>;
  upsertItineraryActivity(itineraryId: string, input: UpsertActivityInput, expectedVersion: number): Promise<Itinerary>;
  reorderOrDeleteActivity(
    itineraryId: string,
    dayNumber: number,
    activityId: string,
    action: 'MOVE_UP' | 'MOVE_DOWN' | 'DELETE',
    expectedVersion: number,
  ): Promise<Itinerary>;
  previewRegenerateDay(itineraryId: string, dayNumber: number, prompt: string): Promise<RegenerateDayPreview>;
  applyRegeneratedDay(
    itineraryId: string,
    dayNumber: number,
    activities: ItineraryActivity[],
    expectedVersion: number,
  ): Promise<Itinerary>;
  saveItinerary(itineraryId: string, expectedVersion: number, title?: string): Promise<Itinerary>;
  discardItineraryChanges(itineraryId: string): Promise<Itinerary>;
  cloneItinerary(itineraryId: string, req: CloneItineraryRequest): Promise<Itinerary>;
  deleteItinerary(itineraryId: string): Promise<void>;
  listConversations(): Promise<ChatConversation[]>;
  createConversation(itineraryId?: string | null): Promise<ChatConversation>;
  sendChatMessage(conversationId: string, content: string): Promise<ChatConversation>;
  retryChatMessage(conversationId: string, failedUserMessageId: string): Promise<ChatConversation>;

  // Bookings & Payments
  createBooking(req: CreateBookingRequest): Promise<{ booking: Booking; payment: PaymentRecord }>;
  listMyBookings(params?: BookingFilterParams): Promise<PaginatedBookings>;
  getMyBookingDetail(bookingId: string): Promise<{ booking: Booking; payment: PaymentRecord }>;
  cancelMyBooking(bookingId: string, req: CancelBookingRequest): Promise<Booking>;
  checkPaymentStatus(bookingId: string): Promise<{ booking: Booking; payment: PaymentRecord }>;
  listAdminBookings(params?: BookingFilterParams): Promise<PaginatedBookings>;
  getAdminBookingDetail(bookingId: string): Promise<{ booking: Booking; payment: PaymentRecord | null }>;
  addAdminBookingNote(bookingId: string, req: AddBookingNoteRequest): Promise<Booking>;
  adminCancelBooking(bookingId: string, req: CancelBookingRequest): Promise<Booking>;
  listAdminPayments(params?: PaymentFilterParams): Promise<PaginatedPayments>;
  listAdminPaymentEvents(params?: PaymentEventFilterParams): Promise<PaginatedPaymentEvents>;
  getAdminPaymentEventDetail(
    eventId: string,
  ): Promise<{ event: SePayEvent; payment: PaymentRecord | null; booking: Booking | null; canReconcile: boolean }>;
  reconcilePaymentEvent(eventId: string, req: ReconcileEventRequest): Promise<SePayEvent>;

  // Backoffice Dashboard, Staff & Audit
  getBackofficeDashboard(): Promise<BackofficeDashboardStats>;
  listStaff(params?: StaffFilterParams): Promise<PaginatedStaff>;
  getStaffDetail(id: string): Promise<StaffMember>;
  createStaff(req: CreateStaffRequest): Promise<{ staff: StaffMember; otpState: OtpChallengeState | null }>;
  updateStaff(id: string, req: UpdateStaffRequest): Promise<StaffMember>;
  updateStaffPermissions(id: string, req: UpdateStaffPermissionsRequest): Promise<StaffMember>;
  lockOrUnlockStaff(id: string, req: LockUnlockStaffRequest): Promise<StaffMember>;
  resendStaffActivation(staffId: string): Promise<{ staff: StaffMember; otpState: OtpChallengeState }>;
  listAuditLogs(params?: AuditLogFilterParams): Promise<PaginatedAuditLogs>;
}

/**
 * Chọn adapter tập trung theo VITE_DATA_SOURCE.
 * Chế độ 'api' tuyệt đối KHÔNG tự chuyển sang mock khi gặp lỗi.
 */
export function getDataSource(): DataSourceAdapter {
  return appEnv.dataSource === 'api' ? apiAdapter : mockAdapter;
}
