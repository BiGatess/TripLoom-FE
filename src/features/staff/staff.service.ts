import { getDataSource } from '@/api/adapters/data-source';
import type {
  AuditLogFilterParams,
  CreateStaffRequest,
  LockUnlockStaffRequest,
  OtpChallengeState,
  PaginatedAuditLogs,
  PaginatedStaff,
  StaffFilterParams,
  StaffMember,
  UpdateStaffPermissionsRequest,
  UpdateStaffRequest,
} from '@/api/contracts';

export const staffService = {
  listStaff: (params?: StaffFilterParams): Promise<PaginatedStaff> => getDataSource().listStaff(params),
  getStaffDetail: (id: string): Promise<StaffMember> => getDataSource().getStaffDetail(id),
  createStaff: (req: CreateStaffRequest): Promise<{ staff: StaffMember; otpState: OtpChallengeState | null }> =>
    getDataSource().createStaff(req),
  updateStaff: (id: string, req: UpdateStaffRequest): Promise<StaffMember> => getDataSource().updateStaff(id, req),
  updateStaffPermissions: (id: string, req: UpdateStaffPermissionsRequest): Promise<StaffMember> =>
    getDataSource().updateStaffPermissions(id, req),
  lockOrUnlockStaff: (id: string, req: LockUnlockStaffRequest): Promise<StaffMember> =>
    getDataSource().lockOrUnlockStaff(id, req),
  resendStaffActivation: (staffId: string): Promise<{ staff: StaffMember; otpState: OtpChallengeState }> =>
    getDataSource().resendStaffActivation(staffId),
  listAuditLogs: (params?: AuditLogFilterParams): Promise<PaginatedAuditLogs> => getDataSource().listAuditLogs(params),
};
