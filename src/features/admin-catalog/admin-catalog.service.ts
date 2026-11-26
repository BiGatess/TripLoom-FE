import { getDataSource } from '@/api/adapters/data-source';
import type {
  ActiveStatus,
  BackofficeDashboardStats,
  Category,
  Destination,
  TravelService,
  UpsertCategoryRequest,
  UpsertDestinationRequest,
  UpsertServiceRequest,
} from '@/api/contracts';

export const adminCatalogService = {
  getDashboard: (): Promise<BackofficeDashboardStats> => getDataSource().getBackofficeDashboard(),
  upsertCategory: (id: string | null, req: UpsertCategoryRequest): Promise<Category> =>
    getDataSource().upsertCategory(id, req),
  upsertDestination: (id: string | null, req: UpsertDestinationRequest): Promise<Destination> =>
    getDataSource().upsertDestination(id, req),
  toggleDestinationStatus: (id: string, status: ActiveStatus): Promise<Destination> =>
    getDataSource().toggleDestinationStatus(id, status),
  upsertService: (id: string | null, req: UpsertServiceRequest): Promise<TravelService> =>
    getDataSource().upsertService(id, req),
  toggleServiceStatus: (id: string, status: ActiveStatus): Promise<TravelService> =>
    getDataSource().toggleServiceStatus(id, status),
};
