import { getDataSource } from '@/api/adapters/data-source';
import type {
  ActivateStaffRequest,
  AuthSession,
  ChangePasswordRequest,
  ForgotPasswordRequest,
  LoginRequest,
  OtpChallengeState,
  OtpPurpose,
  RegisterRequest,
  ResendOtpRequest,
  ResetPasswordRequest,
  VerifyRegisterRequest,
} from '@/api/contracts';

export const authService = {
  getSession: (): Promise<AuthSession> => getDataSource().getSession(),
  login: (req: LoginRequest): Promise<AuthSession> => getDataSource().login(req),
  logout: (): Promise<void> => getDataSource().logout(),
  register: (req: RegisterRequest): Promise<OtpChallengeState> => getDataSource().register(req),
  verifyRegister: (req: VerifyRegisterRequest): Promise<{ message: string; email: string }> =>
    getDataSource().verifyRegister(req),
  requestPasswordReset: (req: ForgotPasswordRequest): Promise<OtpChallengeState> =>
    getDataSource().requestPasswordReset(req),
  resetPassword: (req: ResetPasswordRequest): Promise<{ message: string }> => getDataSource().resetPassword(req),
  changePassword: (req: ChangePasswordRequest): Promise<{ message: string }> => getDataSource().changePassword(req),
  activateStaff: (req: ActivateStaffRequest): Promise<{ message: string }> => getDataSource().activateStaff(req),
  resendOtp: (req: ResendOtpRequest): Promise<OtpChallengeState> => getDataSource().resendOtp(req),
  getOtpState: (email: string, purpose: OtpPurpose): Promise<OtpChallengeState> =>
    getDataSource().getOtpState(email, purpose),
};
