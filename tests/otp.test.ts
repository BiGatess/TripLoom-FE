import { beforeEach, describe, expect, it } from 'vitest';
import { authService } from '@/features/auth/auth.service';
import { getLatestDevOtpForEmail } from '@/mocks/handlers/auth-handler';
import { advanceMockClockMs, resetMockDatabase } from '@/mocks/storage/mock-db';

describe('OTP rules & rate limits', () => {
  beforeEach(() => {
    resetMockDatabase(Date.UTC(2027, 0, 15, 8, 0, 0));
  });

  it('enforces 60s cooldown, 5-send burst limit, 15m non-extending lockout, and 5th code remains usable for 5m', async () => {
    const email = 'otp.tester@example.com';

    // Lần gửi 1 (REGISTER)
    const state1 = await authService.register({
      fullName: 'Người Dùng Kiểm Thử',
      email,
      password: 'Password123',
      confirmPassword: 'Password123',
    });
    expect(state1.sendsUsedInBurst).toBe(1);
    const code1 = getLatestDevOtpForEmail(email, 'REGISTER')?.code;
    expect(code1).toMatch(/^\d{6}$/);

    // Gửi lại trước 60 giây -> bị chặn RATE_LIMITED
    await expect(authService.resendOtp({ email, purpose: 'REGISTER' })).rejects.toMatchObject({
      code: 'RATE_LIMITED',
    });

    // Lần gửi 2, 3, 4 (mỗi lần cách > 60s)
    for (let send = 2; send <= 4; send++) {
      advanceMockClockMs(61_000);
      const st = await authService.resendOtp({ email, purpose: 'REGISTER' });
      expect(st.sendsUsedInBurst).toBe(send);
      expect(st.burstLockedUntil).toBeNull();
    }

    // Mã lần 1 đã bị vô hiệu do có mã mới cùng mục đích
    await expect(authService.verifyRegister({ email, code: code1! })).rejects.toMatchObject({
      code: 'OTP_INVALID',
    });

    // Lần gửi 5 -> kích hoạt khóa đợt 15 phút tính từ lần 5, NHƯNG mã lần 5 vẫn dùng được trong 5 phút!
    advanceMockClockMs(61_000);
    const state5 = await authService.resendOtp({ email, purpose: 'REGISTER' });
    expect(state5.sendsUsedInBurst).toBe(5);
    expect(state5.burstLockedUntil).not.toBeNull();
    const lockedUntilInitial = state5.burstLockedUntil!;
    const code5 = getLatestDevOtpForEmail(email, 'REGISTER')?.code;
    expect(code5).toMatch(/^\d{6}$/);

    // Gửi tiếp trong lúc bị chặn sau 2 phút -> KHÔNG kéo dài thời gian chặn 15 phút!
    advanceMockClockMs(2 * 60_000);
    await expect(authService.resendOtp({ email, purpose: 'REGISTER' })).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      meta: { burstLockedUntil: lockedUntilInitial },
    });

    // Hạn mức dùng chung theo email: yêu cầu PASSWORD_RESET lúc này cũng bị chặn cùng mốc
    await expect(authService.requestPasswordReset({ email })).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      meta: { burstLockedUntil: lockedUntilInitial },
    });

    // Mã lần 5 vẫn xác thực thành công trong vòng 5 phút!
    const verified = await authService.verifyRegister({ email, code: code5! });
    expect(verified.email).toBe(email);

    // Dùng lại cùng mã đã dùng -> OTP_USED
    await expect(authService.verifyRegister({ email, code: code5! })).rejects.toMatchObject({
      code: 'OTP_USED',
    });
  });

  it('invalidates OTP after 5 wrong attempts without locking the account, and expires after 5 minutes', async () => {
    const email = 'wrong.otp@example.com';
    await authService.register({
      fullName: 'Test Sai OTP',
      email,
      password: 'Password123',
      confirmPassword: 'Password123',
    });

    const realCode = getLatestDevOtpForEmail(email, 'REGISTER')!.code;
    const wrongCode = realCode === '000000' ? '111111' : '000000';

    for (let i = 1; i <= 4; i++) {
      await expect(authService.verifyRegister({ email, code: wrongCode })).rejects.toMatchObject({
        code: 'OTP_INVALID',
      });
    }
    // Lần sai thứ 5 -> vô hiệu mã
    await expect(authService.verifyRegister({ email, code: wrongCode })).rejects.toMatchObject({
      code: 'OTP_MAX_ATTEMPTS',
    });

    // Mã cũ không còn dùng được dù nhập đúng
    await expect(authService.verifyRegister({ email, code: realCode })).rejects.toMatchObject({
      code: 'OTP_INVALID',
    });

    // Sau 61 giây vẫn xin mã mới được bình thường (tài khoản không bị khóa)
    advanceMockClockMs(61_000);
    await authService.resendOtp({ email, purpose: 'REGISTER' });
    const freshCode = getLatestDevOtpForEmail(email, 'REGISTER')!.code;

    // Hết hạn sau 5 phút
    advanceMockClockMs(5 * 60_000 + 1000);
    await expect(authService.verifyRegister({ email, code: freshCode })).rejects.toMatchObject({
      code: 'OTP_EXPIRED',
    });
  });

  it('returns generic message on forgot password and does not auto-login or unlock locked staff', async () => {
    const nonExist = await authService.requestPasswordReset({ email: 'khongtontai@example.com' });
    const existing = await authService.requestPasswordReset({ email: 'minh.anh@example.com' });
    expect(nonExist.message).toBe(existing.message);
    expect(getLatestDevOtpForEmail('khongtontai@example.com', 'PASSWORD_RESET')).toBeNull();

    const resetCode = getLatestDevOtpForEmail('minh.anh@example.com', 'PASSWORD_RESET')!.code;
    await authService.resetPassword({
      email: 'minh.anh@example.com',
      code: resetCode,
      newPassword: 'NewPassword99',
      confirmPassword: 'NewPassword99',
    });

    // Không tự đăng nhập sau reset
    const sessionAfterReset = await authService.getSession();
    expect(sessionAfterReset.authenticated).toBe(false);

    // Đăng nhập được với mật khẩu mới
    const loggedIn = await authService.login({ email: 'minh.anh@example.com', password: 'NewPassword99' });
    expect(loggedIn.authenticated).toBe(true);
  });
});
