import { getDataSource } from '@/api/adapters/data-source';
import type { UpdateProfileRequest, UserProfile } from '@/api/contracts';

export const profileService = {
  getProfile: (): Promise<UserProfile> => getDataSource().getProfile(),
  updateProfile: (req: UpdateProfileRequest): Promise<UserProfile> => getDataSource().updateProfile(req),
};
