import { getDataSource } from '@/api/adapters/data-source';
import type {
  ModerateReviewRequest,
  PaginatedReviews,
  Review,
  ReviewFilterParams,
  UpsertReviewRequest,
} from '@/api/contracts';

export const reviewsService = {
  upsertMyReview: (req: UpsertReviewRequest): Promise<Review> => getDataSource().upsertMyReview(req),
  listMyReviews: (): Promise<Review[]> => getDataSource().listMyReviews(),
  listAdminReviews: (params?: ReviewFilterParams): Promise<PaginatedReviews> => getDataSource().listAdminReviews(params),
  moderateReview: (reviewId: string, req: ModerateReviewRequest): Promise<Review> =>
    getDataSource().moderateReview(reviewId, req),
};
