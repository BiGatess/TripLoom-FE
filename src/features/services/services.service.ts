import { getDataSource } from '@/api/adapters/data-source';
import type { PaginatedServices, ServiceAvailability, ServiceFilterParams, TravelService } from '@/api/contracts';

export const servicesService = {
  listServices: (params?: ServiceFilterParams): Promise<PaginatedServices> => getDataSource().listServices(params),
  getDetail: (id: string, options?: { includeHiddenForAdmin?: boolean }): Promise<TravelService> =>
    getDataSource().getServiceDetail(id, options),
  checkAvailability: (serviceId: string, serviceDate: string): Promise<ServiceAvailability> =>
    getDataSource().checkServiceAvailability(serviceId, serviceDate),
};
