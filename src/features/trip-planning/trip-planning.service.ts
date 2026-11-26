import { getDataSource } from '@/api/adapters/data-source';
import type { Itinerary, RecommendationsResponse, TripDraftRequest, TripRequestInput } from '@/api/contracts';

export const tripPlanningService = {
  createTripRequest: (input: TripRequestInput): Promise<TripDraftRequest> => getDataSource().createTripRequest(input),
  getRecommendations: (draftRequestId: string): Promise<RecommendationsResponse> =>
    getDataSource().getRecommendations(draftRequestId),
  generateDraftItinerary: (draftRequestId: string, selectedDestinationIds?: string[]): Promise<Itinerary> =>
    getDataSource().generateDraftItinerary(draftRequestId, selectedDestinationIds),
};
