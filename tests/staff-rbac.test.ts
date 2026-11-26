import { beforeEach, describe, expect, it } from 'vitest';
import { authService } from '@/features/auth/auth.service';
import { staffService } from '@/features/staff/staff.service';
import { getLatestDevOtpForEmail } from '@/mocks/handlers/auth-handler';
import { mutateMockDb, resetMockDatabase } from '@/mocks/storage/mock-db';

describe('Staff lifecycle, permissions, lock/unlock & read-only audit logs', () => {
  beforeEach(async () => {
    resetMockDatabase(Date.UTC(2027, 0, 15, 8, 0, 0));
    await authService.login({ email: 'admin@triploom.vn', password: 'Admin@123' });
  });

  it('creates INVITED staff without duplicating on email failure, activates via T06, and unlocks to proper state', async () => {
    // Giả lập lỗi gửi email khi tạo nhân viên -> vẫn chỉ tạo 1 bản ghi INVITED
    mutateMockDb((db) => {
      db.devFlags.simulateEmailFailure = true;
    });

    const created = await staffService.createStaff({
      staffCode: 'nv010',
      fullName: 'Đặng Minh Khôi',
      email: 'khoi.dang@triploom.vn',
      phone: '0911222333',
      notes: 'Nhân viên hỗ trợ dịch vụ',
      permissions: ['STAFF_SERVICE'],
    });

    expect(created.staff.staffCode).toBe('NV010');
    expect(created.staff.status).toBe('INVITED');
    expect(created.staff.emailDeliveryStatus).toBe('FAILED');

    // Khóa nhân viên CHƯA từng kích hoạt -> mở khóa phải quay về INVITED (KHÔNG tự thành ACTIVE)
    const lockedUnactivated = await staffService.lockOrUnlockStaff(created.staff.id, {
      action: 'LOCK',
      reason: 'Tạm hoãn nhận việc theo yêu cầu phòng nhân sự',
      expectedUpdatedAt: created.staff.updatedAt,
    });
    expect(lockedUnactivated.status).toBe('LOCKED');

    const unlockedUnactivated = await staffService.lockOrUnlockStaff(created.staff.id, {
      action: 'UNLOCK',
      reason: 'Nhân viên quay lại tiếp tục quy trình nhận việc',
      expectedUpdatedAt: lockedUnactivated.updatedAt,
    });
    expect(unlockedUnactivated.status).toBe('INVITED');

    // Tắt lỗi email -> gửi lại mã kích hoạt (không tạo 2 nhân viên)
    mutateMockDb((db) => {
      db.devFlags.simulateEmailFailure = false;
    });
    await staffService.resendStaffActivation(created.staff.id);
    const listAfterResend = await staffService.listStaff({ query: 'NV010' });
    expect(listAfterResend.total).toBe(1);

    // Nhân viên tự kích hoạt qua T06 với mã 6 số
    const code = getLatestDevOtpForEmail('khoi.dang@triploom.vn', 'STAFF_ACTIVATION')!.code;
    await authService.logout();
    await authService.activateStaff({
      email: 'khoi.dang@triploom.vn',
      code,
      password: 'StaffPassword99',
      confirmPassword: 'StaffPassword99',
    });

    // Đăng nhập thành công với mật khẩu tự đặt
    const staffSession = await authService.login({
      email: 'khoi.dang@triploom.vn',
      password: 'StaffPassword99',
    });
    expect(staffSession.user?.staffStatus).toBe('ACTIVE');

    // Nhân viên bị chặn truy cập danh sách nhân viên và nhật ký (403)
    await expect(staffService.listStaff()).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(staffService.listAuditLogs()).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('unlocks previously activated staff back to ACTIVE and logs without secrets', async () => {
    const nv003 = await staffService.getStaffDetail('STF_NV003');
    expect(nv003.status).toBe('LOCKED');
    expect(nv003.hasActivatedBefore).toBe(true);

    const unlocked = await staffService.lockOrUnlockStaff(nv003.id, {
      action: 'UNLOCK',
      reason: 'Nhân viên quay trở lại làm việc bình thường',
      expectedUpdatedAt: nv003.updatedAt,
    });
    expect(unlocked.status).toBe('ACTIVE');

    // Nhật ký không chứa mật khẩu hay OTP
    const logs = await staffService.listAuditLogs({ targetId: nv003.id });
    const serialized = JSON.stringify(logs.items);
    expect(serialized).not.toContain('Staff@123');
    expect(serialized).not.toContain('246810');
  });
});
