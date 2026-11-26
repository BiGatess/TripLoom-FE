import type { PaginatedResponse, PaginationParams, TravelPace } from './common';
import type { Destination } from './catalog';

export interface TripRequestInput {
  region: string;
  startDate: string; // YYYY-MM-DD
  daysCount: number;
  partySize: number;
  budgetVnd: number;
  budgetScopeNote: string;
  categoryIds: string[];
  pace: TravelPace;
  notes?: string;
}

export interface TripDraftRequest extends TripRequestInput {
  id: string;
  endDate: string;
  createdAt: string;
}

export interface RecommendedDestination {
  destination: Destination;
  matchReasons: string[];
  estimatedGroupCostVnd: number | null;
}

export interface RecommendationsResponse {
  request: TripDraftRequest;
  recommendations: RecommendedDestination[];
}

export interface ItineraryActivity {
  id: string;
  dayNumber: number;
  orderIndex: number;
  type: 'DESTINATION' | 'REST_NOTE';
  destinationId: string | null;
  destinationName: string | null;
  title: string;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  estimatedGroupCostVnd: number | null;
  notes: string;
}

export interface ItineraryDay {
  dayNumber: number;
  date: string; // YYYY-MM-DD
  activities: ItineraryActivity[];
}

export interface Itinerary {
  id: string;
  ownerId: string;
  title: string;
  region: string;
  startDate: string;
  endDate: string;
  daysCount: number;
  partySize: number;
  budgetVnd: number;
  budgetScopeNote: string;
  pace: TravelPace;
  categoryIds: string[];
  isDraft: boolean;
  draftExpiresAt: string | null;
  hasUnsavedChanges?: boolean;
  pendingDraftDays?: ItineraryDay[] | null;
  version: number;
  days: ItineraryDay[];
  totalEstimatedCostVnd: number;
  hasUnknownCostItems: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RegenerateDayPreview {
  itineraryId: string;
  dayNumber: number;
  date: string;
  prompt: string;
  beforeActivities: ItineraryActivity[];
  afterActivities: ItineraryActivity[];
  beforeTotalVnd: number;
  afterTotalVnd: number;
  disclaimer: string;
}

export interface UpsertActivityInput {
  id?: string;
  dayNumber: number;
  type: 'DESTINATION' | 'REST_NOTE';
  destinationId: string | null;
  title: string;
  startTime: string;
  endTime: string;
  estimatedGroupCostVnd: number | null;
  notes: string;
}

export interface CloneItineraryRequest {
  title: string;
  newStartDate?: string;
}

export interface ItineraryListParams extends PaginationParams {
  query?: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  sender: 'USER' | 'AI';
  content: string;
  status: 'SENT' | 'ERROR';
  errorMessage?: string;
  createdAt: string;
}

export interface ChatConversation {
  id: string;
  ownerId: string;
  title: string;
  itineraryId: string | null;
  itineraryTitle: string | null;
  itineraryIsDraft?: boolean;
  itineraryLinked: boolean;
  messages: ChatMessage[];
  updatedAt: string;
}

export type PaginatedItineraries = PaginatedResponse<Itinerary>;
