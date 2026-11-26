import { getDataSource } from '@/api/adapters/data-source';
import type {
  CloneItineraryRequest,
  Itinerary,
  ItineraryActivity,
  ItineraryListParams,
  PaginatedItineraries,
  RegenerateDayPreview,
  UpsertActivityInput,
} from '@/api/contracts';

export const itinerariesService = {
  getItinerary: (id: string): Promise<Itinerary> => getDataSource().getItinerary(id),
  listMyItineraries: (params?: ItineraryListParams): Promise<PaginatedItineraries> =>
    getDataSource().listMyItineraries(params),
  upsertActivity: (itineraryId: string, input: UpsertActivityInput, expectedVersion: number): Promise<Itinerary> =>
    getDataSource().upsertItineraryActivity(itineraryId, input, expectedVersion),
  reorderOrDeleteActivity: (
    itineraryId: string,
    dayNumber: number,
    activityId: string,
    action: 'MOVE_UP' | 'MOVE_DOWN' | 'DELETE',
    expectedVersion: number,
  ): Promise<Itinerary> =>
    getDataSource().reorderOrDeleteActivity(itineraryId, dayNumber, activityId, action, expectedVersion),
  previewRegenerateDay: (itineraryId: string, dayNumber: number, prompt: string): Promise<RegenerateDayPreview> =>
    getDataSource().previewRegenerateDay(itineraryId, dayNumber, prompt),
  applyRegeneratedDay: (
    itineraryId: string,
    dayNumber: number,
    activities: ItineraryActivity[],
    expectedVersion: number,
  ): Promise<Itinerary> => getDataSource().applyRegeneratedDay(itineraryId, dayNumber, activities, expectedVersion),
  saveItinerary: (itineraryId: string, expectedVersion: number, title?: string): Promise<Itinerary> =>
    getDataSource().saveItinerary(itineraryId, expectedVersion, title),
  discardChanges: (itineraryId: string): Promise<Itinerary> =>
    getDataSource().discardItineraryChanges(itineraryId),
  cloneItinerary: (itineraryId: string, req: CloneItineraryRequest): Promise<Itinerary> =>
    getDataSource().cloneItinerary(itineraryId, req),
  deleteItinerary: (itineraryId: string): Promise<void> => getDataSource().deleteItinerary(itineraryId),
};
