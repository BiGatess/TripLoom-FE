import { getDataSource } from '@/api/adapters/data-source';
import type {
  DestinationDetailResponse,
  DestinationFilterParams,
  PaginatedCategories,
  PaginatedDestinations,
} from '@/api/contracts';

export const destinationsService = {
  listCategories: (params?: { query?: string; includeHidden?: boolean; page?: number; pageSize?: number }): Promise<PaginatedCategories> =>
    getDataSource().listCategories(params),
  listDestinations: (params?: DestinationFilterParams): Promise<PaginatedDestinations> =>
    getDataSource().listDestinations(params),
  getDetail: (id: string, options?: { includeHiddenForAdmin?: boolean }): Promise<DestinationDetailResponse> =>
    getDataSource().getDestinationDetail(id, options),
};
