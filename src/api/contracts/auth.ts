import type { StaffPermissionCode } from '@/config/constants';
import type { OtpPurpose, StaffAccountStatus, TravelPace, UserRole } from './common';

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  displayName: string;
  avatarUrl: string | null;
  phone: string;
  role: UserRole;
  staffCode?: string;
  staffStatus?: StaffAccountStatus;
  permissions: StaffPermissionCode[];
  preferences: {
    categoryIds: string[];
    defaultBudgetVnd: number | null;
    defaultPartySize: number;
    pace: TravelPace;
  };
  updatedAt: string;
}

export interface AuthSession {
  authenticated: boolean;
  user: UserProfile | null;
}

export interface OtpChallengeState {
  email: string;
  maskedEmail: string;
  purpose: OtpPurpose;
  expiresAt: string | null;
  resendAvailableAt: string | null;
  burstLockedUntil: string | null;
  sendsUsedInBurst: number;
  maxSendsPerBurst: number;
  remainingAttempts: number;
  message: string;
  emailDeliveryFailed?: boolean;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface VerifyRegisterRequest {
  email: string;
  code: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  email: string;
  code: string;
  newPassword: string;
  confirmPassword: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface ActivateStaffRequest {
  email: string;
  code: string;
  password: string;
  confirmPassword: string;
}

export interface ResendOtpRequest {
  email: string;
  purpose: OtpPurpose;
}

export interface UpdateProfileRequest {
  fullName: string;
  displayName: string;
  phone: string;
  categoryIds: string[];
  defaultBudgetVnd: number | null;
  defaultPartySize: number;
  pace: TravelPace;
}
