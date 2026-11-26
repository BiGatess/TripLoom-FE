import type { ActiveStatus, PaginatedResponse, PaginationParams, ReviewStatus } from './common';

export interface Category {
  id: string;
  slug: string;
  name: string;
  description: string;
  status: ActiveStatus;
  destinationCount: number;
  updatedAt: string;
}

export interface Destination {
  id: string;
  name: string;
  region: string;
  categoryId: string;
  categoryName: string;
  categoryHidden?: boolean;
  address: string;
  description: string;
  imageUrl: string;
  galleryUrls?: string[];
  estimatedCostVnd: number | null; // null = Chưa có thông tin giá; 0 = Miễn phí
  openingHours: string;
  status: ActiveStatus;
  effectivelyPublic: boolean;
  averageRating: number | null;
  publishedReviewCount: number;
  isFavorite?: boolean;
  version: number;
  updatedAt: string;
}

export interface TravelService {
  id: string;
  destinationId: string;
  destinationName: string;
  destinationHidden?: boolean;
  categoryHidden?: boolean;
  name: string;
  serviceType: string;
  description: string;
  imageUrl: string;
  galleryUrls?: string[];
  pricePerGuestVnd: number;
  maxDailyCapacity: number;
  status: ActiveStatus;
  effectivelyBookable: boolean;
  version: number;
  updatedAt: string;
}

export interface ServiceAvailability {
  serviceId: string;
  serviceDate: string;
  maxDailyCapacity: number;
  bookedGuests: number;
  remainingCapacity: number;
  pricePerGuestVnd: number;
  available: boolean;
  message?: string;
}

export interface Review {
  id: string;
  destinationId: string;
  destinationName: string;
  destinationPublic: boolean;
  userId: string;
  userName: string;
  rating: number; // 1..5
  comment: string;
  status: ReviewStatus;
  moderationReason?: string;
  moderatedBy?: string;
  moderatedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DestinationFilterParams extends PaginationParams {
  query?: string;
  region?: string;
  categoryId?: string;
  status?: ActiveStatus | 'ALL';
  includeHidden?: boolean;
}

export interface ServiceFilterParams extends PaginationParams {
  query?: string;
  destinationId?: string;
  status?: ActiveStatus | 'ALL';
  includeHidden?: boolean;
}

export interface ReviewFilterParams extends PaginationParams {
  destinationId?: string;
  status?: ReviewStatus | 'ALL';
  query?: string;
}

export interface UpsertCategoryRequest {
  name: string;
  description: string;
  status: ActiveStatus;
}

export interface UpsertDestinationRequest {
  name: string;
  region: string;
  categoryId: string;
  address: string;
  description: string;
  imageUrl: string;
  galleryUrls?: string[];
  estimatedCostVnd: number | null;
  openingHours: string;
  status: ActiveStatus;
  expectedVersion?: number;
}

export interface UpsertServiceRequest {
  destinationId: string;
  name: string;
  serviceType: string;
  description: string;
  imageUrl: string;
  galleryUrls?: string[];
  pricePerGuestVnd: number;
  maxDailyCapacity: number;
  status: ActiveStatus;
  expectedVersion?: number;
}

export interface UpsertReviewRequest {
  destinationId: string;
  rating: number;
  comment: string;
}

export interface ModerateReviewRequest {
  status: 'PUBLISHED' | 'HIDDEN';
  reason: string;
}

export interface DestinationDetailResponse {
  destination: Destination;
  services: TravelService[];
  publishedReviews: Review[];
  myReview: Review | null;
  isFavorite: boolean;
}

export type PaginatedDestinations = PaginatedResponse<Destination>;
export type PaginatedServices = PaginatedResponse<TravelService>;
export type PaginatedCategories = PaginatedResponse<Category>;
export type PaginatedReviews = PaginatedResponse<Review>;
