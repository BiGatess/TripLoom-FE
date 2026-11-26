import { getDataSource } from '@/api/adapters/data-source';
import type { Destination } from '@/api/contracts';

export const favoritesService = {
  listFavorites: (): Promise<Destination[]> => getDataSource().listFavorites(),
  addFavorite: (destinationId: string): Promise<{ isFavorite: true }> => getDataSource().addFavorite(destinationId),
  removeFavorite: (destinationId: string): Promise<{ isFavorite: false }> =>
    getDataSource().removeFavorite(destinationId),
};
