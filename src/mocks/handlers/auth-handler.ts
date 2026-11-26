import { AppError } from '@/api/errors';
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
  UpdateProfileRequest,
  UserProfile,
  VerifyRegisterRequest,
} from '@/api/contracts';
import { OTP_RULES, type StaffPermissionCode } from '@/config/constants';
import { maskEmail } from '@/shared/utils/format';
import { isValidEmail, validateOtpCode, validatePassword } from '@/shared/utils/validation';
import type { MockDatabase, MockOtpCodeRecord, MockOtpRateBucket, MockUserAccount } from '@/mocks/fixtures/seed-data';
import { getMockNowMs, loadMockDb, mutateMockDb, simulateDelay } from '@/mocks/storage/mock-db';

function cloneProfile(profile: UserProfile): UserProfile {
  return JSON.parse(JSON.stringify(profile)) as UserProfile;
}

export function getActiveAccount(db: MockDatabase): MockUserAccount | null {
  if (!db.currentUserId) return null;
  const acc = db.accounts.find((a) => a.profile.id === db.currentUserId);
  if (!acc) return null;
  if (db.currentAuthVersion !== null && acc.authVersion !== db.currentAuthVersion) {
    // Phiên đã bị thu hồi do đổi quyền / đổi mật khẩu / khóa tài khoản
    db.currentUserId = null;
    db.currentAuthVersion = null;
    return null;
  }
  if (acc.profile.role === 'STAFF' && acc.profile.staffStatus !== 'ACTIVE') {
    db.currentUserId = null;
    db.currentAuthVersion = null;
    return null;
  }
  return acc;
}

export function requireAuthAccount(db: MockDatabase): MockUserAccount {
  const acc = getActiveAccount(db);
  if (!acc) {
    throw new AppError({
      code: 'UNAUTHORIZED',
      status: 401,
      message: 'Phiên đăng nhập đã hết hạn hoặc bạn chưa đăng nhập. Vui lòng đăng nhập lại.',
    });
  }
  return acc;
}

export function requireAdminAccount(db: MockDatabase): MockUserAccount {
  const acc = requireAuthAccount(db);
  if (acc.profile.role !== 'ADMIN') {
    throw new AppError({
      code: 'FORBIDDEN',
      status: 403,
      message: 'Chức năng này chỉ dành cho Quản trị viên hệ thống.',
    });
  }
  return acc;
}

export function requireBackofficePermission(
  db: MockDatabase,
  permission?: StaffPermissionCode,
): MockUserAccount {
  const acc = requireAuthAccount(db);
  if (acc.profile.role === 'ADMIN') return acc;
  if (acc.profile.role !== 'STAFF' || acc.profile.staffStatus !== 'ACTIVE') {
    throw new AppError({
      code: 'FORBIDDEN',
      status: 403,
      message: 'Bạn không có quyền truy cập khu vực vận hành nội bộ.',
    });
  }
  if (permission && !acc.profile.permissions.includes(permission)) {
    throw new AppError({
      code: 'FORBIDDEN',
      status: 403,
      message: 'Tài khoản nhân viên chưa được cấp nhóm quyền cho thao tác này.',
    });
  }
  return acc;
}

export function assertNetworkAvailable(db: MockDatabase): void {
  if (db.devFlags.simulateNetworkFailure) {
    throw new AppError({
      code: 'NETWORK_ERROR',
      status: 0,
      message: 'Không thể kết nối tới máy chủ (đang bật chế độ mô phỏng lỗi mạng).',
    });
  }
}

function getOrCreateBucket(db: MockDatabase, normalizedEmail: string, nowMs: number): MockOtpRateBucket {
  let bucket = db.otpRateBuckets[normalizedEmail];
  if (!bucket) {
    bucket = {
      email: normalizedEmail,
      sendsInBurst: 0,
      lastSentAt: null,
      burstLockedUntil: null,
    };
    db.otpRateBuckets[normalizedEmail] = bucket;
  }

  // Nếu đợt khóa 15 phút đã qua, reset burst counter
  if (bucket.burstLockedUntil && new Date(bucket.burstLockedUntil).getTime() <= nowMs) {
    bucket.sendsInBurst = 0;
    bucket.burstLockedUntil = null;
  }

  return bucket;
}

function generateSixDigitCode(): string {
  const num = Math.floor(100000 + Math.random() * 900000);
  return String(num);
}

function findLatestActiveOtp(
  db: MockDatabase,
  normalizedEmail: string,
  purpose: OtpPurpose,
): MockOtpCodeRecord | null {
  const candidates = db.otpCodes.filter(
    (item) => item.email === normalizedEmail && item.purpose === purpose && !item.invalidated,
  );
  return candidates[candidates.length - 1] ?? null;
}

export function issueOtpForEmail(
  db: MockDatabase,
  rawEmail: string,
  purpose: OtpPurpose,
  options?: {
    actuallyCreateCode?: boolean;
    pendingPayload?: { fullName?: string; password?: string };
    genericMessage?: string;
  },
): { state: OtpChallengeState; codeCreated: string | null } {
  const nowMs = getMockNowMs();
  const normalizedEmail = rawEmail.trim().toLowerCase();
  const bucket = getOrCreateBucket(db, normalizedEmail, nowMs);

  // Kiểm tra đang bị khóa đợt 15 phút (tuyệt đối KHÔNG gia hạn thời gian chặn)
  if (bucket.burstLockedUntil) {
    const lockUntilMs = new Date(bucket.burstLockedUntil).getTime();
    if (lockUntilMs > nowMs) {
      throw new AppError({
        code: 'RATE_LIMITED',
        status: 429,
        message: 'Bạn đã đạt giới hạn gửi mã (5 lần). Vui lòng thử lại sau khi hết thời gian chờ.',
        meta: {
          burstLockedUntil: bucket.burstLockedUntil,
          resendAvailableAt: bucket.burstLockedUntil,
        },
      });
    }
  }

  // Kiểm tra cooldown 60 giây giữa 2 lần gửi liên tiếp
  if (bucket.lastSentAt) {
    const nextAllowedMs = new Date(bucket.lastSentAt).getTime() + OTP_RULES.resendCooldownSeconds * 1000;
    if (nextAllowedMs > nowMs) {
      throw new AppError({
        code: 'RATE_LIMITED',
        status: 429,
        message: 'Vui lòng chờ đủ 60 giây trước khi yêu cầu gửi lại mã xác thực.',
        meta: {
          resendAvailableAt: new Date(nextAllowedMs).toISOString(),
        },
      });
    }
  }

  // Kiểm tra mô phỏng lỗi gửi email
  if (db.devFlags.simulateEmailFailure) {
    throw new AppError({
      code: 'EMAIL_DELIVERY_FAILED',
      status: 502,
      message: 'Không thể gửi email xác thực vào lúc này. Vui lòng thử gửi lại sau.',
    });
  }

  const shouldCreate = options?.actuallyCreateCode !== false;
  let createdCode: string | null = null;
  let expiresAt: string | null = null;

  if (shouldCreate) {
    // Mã mới cùng mục đích làm vô hiệu mã cũ cùng mục đích (không ảnh hưởng mục đích khác)
    for (const existing of db.otpCodes) {
      if (existing.email === normalizedEmail && existing.purpose === purpose && !existing.invalidated) {
        existing.invalidated = true;
      }
    }

    createdCode = generateSixDigitCode();
    expiresAt = new Date(nowMs + OTP_RULES.expiresInSeconds * 1000).toISOString();

    db.otpCodes.push({
      id: `OTP_${nowMs}_${Math.floor(Math.random() * 10000)}`,
      email: normalizedEmail,
      purpose,
      code: createdCode,
      createdAt: new Date(nowMs).toISOString(),
      expiresAt,
      used: false,
      invalidated: false,
      failedAttempts: 0,
      pendingPayload: options?.pendingPayload,
    });
  } else {
    // Trường hợp quên mật khẩu email không tồn tại vẫn giả lập thời hạn chuẩn để không lộ thông tin
    expiresAt = new Date(nowMs + OTP_RULES.expiresInSeconds * 1000).toISOString();
  }

  // Cập nhật hạn mức dùng chung theo email
  bucket.sendsInBurst += 1;
  bucket.lastSentAt = new Date(nowMs).toISOString();

  let resendAvailableAt = new Date(nowMs + OTP_RULES.resendCooldownSeconds * 1000).toISOString();
  let burstLockedUntil: string | null = null;

  if (bucket.sendsInBurst >= OTP_RULES.maxSendsPerBurst) {
    burstLockedUntil = new Date(nowMs + OTP_RULES.burstLockoutSeconds * 1000).toISOString();
    bucket.burstLockedUntil = burstLockedUntil;
    resendAvailableAt = burstLockedUntil;
  }

  const state: OtpChallengeState = {
    email: normalizedEmail,
    maskedEmail: maskEmail(normalizedEmail),
    purpose,
    expiresAt,
    resendAvailableAt,
    burstLockedUntil,
    sendsUsedInBurst: bucket.sendsInBurst,
    maxSendsPerBurst: OTP_RULES.maxSendsPerBurst,
    remainingAttempts: OTP_RULES.maxVerifyAttempts,
    message:
      options?.genericMessage ??
      'Mã xác thực 6 chữ số đã được gửi tới hộp thư của bạn và có hiệu lực trong 5 phút.',
  };

  return { state, codeCreated: createdCode };
}

function verifyOtpRecord(
  db: MockDatabase,
  rawEmail: string,
  purpose: OtpPurpose,
  code: string,
): MockOtpCodeRecord {
  const codeErr = validateOtpCode(code);
  if (codeErr) {
    throw new AppError({
      code: 'VALIDATION_ERROR',
      status: 400,
      message: codeErr,
      fieldErrors: { code: codeErr },
    });
  }

  const nowMs = getMockNowMs();
  const normalizedEmail = rawEmail.trim().toLowerCase();
  const record = findLatestActiveOtp(db, normalizedEmail, purpose);

  if (!record) {
    throw new AppError({
      code: 'OTP_INVALID',
      status: 400,
      message: 'Mã xác thực không hợp lệ hoặc đã bị thay thế bởi mã mới hơn.',
      fieldErrors: { code: 'Mã xác thực không hợp lệ hoặc đã bị thay thế.' },
    });
  }

  if (record.used) {
    throw new AppError({
      code: 'OTP_USED',
      status: 400,
      message: 'Mã xác thực này đã được sử dụng. Vui lòng yêu cầu mã mới nếu cần.',
      fieldErrors: { code: 'Mã xác thực đã được sử dụng.' },
    });
  }

  if (new Date(record.expiresAt).getTime() <= nowMs) {
    throw new AppError({
      code: 'OTP_EXPIRED',
      status: 400,
      message: 'Mã xác thực đã hết hạn sau 5 phút. Vui lòng yêu cầu gửi lại mã mới.',
      fieldErrors: { code: 'Mã xác thực đã hết hạn.' },
    });
  }

  if (record.failedAttempts >= OTP_RULES.maxVerifyAttempts) {
    record.invalidated = true;
    throw new AppError({
      code: 'OTP_MAX_ATTEMPTS',
      status: 400,
      message: 'Mã xác thực này đã bị vô hiệu do nhập sai quá 5 lần. Vui lòng yêu cầu mã mới.',
      fieldErrors: { code: 'Đã vượt quá 5 lần nhập sai cho mã này.' },
    });
  }

  if (record.code !== code.trim()) {
    record.failedAttempts += 1;
    const remaining = Math.max(0, OTP_RULES.maxVerifyAttempts - record.failedAttempts);
    if (remaining === 0) {
      record.invalidated = true;
      throw new AppError({
        code: 'OTP_MAX_ATTEMPTS',
        status: 400,
        message: 'Bạn đã nhập sai 5 lần. Mã xác thực hiện tại đã bị vô hiệu (tài khoản không bị khóa). Vui lòng yêu cầu mã mới.',
        fieldErrors: { code: 'Mã đã bị vô hiệu do nhập sai 5 lần.' },
        meta: { remainingAttempts: 0 },
      });
    }
    throw new AppError({
      code: 'OTP_INVALID',
      status: 400,
      message: `Mã xác thực chưa chính xác. Bạn còn ${remaining} lần thử cho mã này.`,
      fieldErrors: { code: `Mã chưa chính xác (còn ${remaining} lần thử).` },
      meta: { remainingAttempts: remaining },
    });
  }

  return record;
}

export async function mockGetSession(): Promise<AuthSession> {
  const db = loadMockDb();
  const acc = getActiveAccount(db);
  return {
    authenticated: Boolean(acc),
    user: acc ? cloneProfile(acc.profile) : null,
  };
}

export async function mockLogin(req: LoginRequest): Promise<AuthSession> {
  await simulateDelay(140);
  return mutateMockDb((db) => {
    assertNetworkAvailable(db);
    const email = req.email.trim().toLowerCase();
    const fieldErrors: Record<string, string> = {};
    if (!isValidEmail(email)) fieldErrors.email = 'Vui lòng nhập địa chỉ email hợp lệ.';
    if (!req.password) fieldErrors.password = 'Vui lòng nhập mật khẩu.';
    if (Object.keys(fieldErrors).length > 0) {
      throw new AppError({
        code: 'VALIDATION_ERROR',
        status: 400,
        message: 'Vui lòng kiểm tra lại thông tin đăng nhập.',
        fieldErrors,
      });
    }

    const acc = db.accounts.find((a) => a.profile.email.toLowerCase() === email);
    if (!acc) {
      throw new AppError({
        code: 'UNAUTHORIZED',
        status: 401,
        message: 'Email hoặc mật khẩu không đúng.',
      });
    }

    if (acc.profile.role === 'STAFF' && acc.profile.staffStatus === 'INVITED') {
      throw new AppError({
        code: 'ACCOUNT_NOT_ACTIVATED',
        status: 403,
        message: 'Tài khoản nhân viên chưa được kích hoạt. Vui lòng hoàn tất kích hoạt bằng mã email trước khi đăng nhập.',
      });
    }

    if (acc.profile.role === 'STAFF' && acc.profile.staffStatus === 'LOCKED') {
      throw new AppError({
        code: 'ACCOUNT_LOCKED',
        status: 403,
        message: 'Tài khoản nhân viên hiện đang bị khóa. Vui lòng liên hệ Quản trị viên.',
      });
    }

    if (acc.password !== req.password) {
      throw new AppError({
        code: 'UNAUTHORIZED',
        status: 401,
        message: 'Email hoặc mật khẩu không đúng.',
      });
    }

    db.currentUserId = acc.profile.id;
    db.currentAuthVersion = acc.authVersion;

    // Cập nhật đăng nhập cuối cho nhân viên
    const staffRow = db.staffMembers.find((s) => s.id === acc.profile.id);
    if (staffRow) {
      staffRow.lastLoginAt = new Date(getMockNowMs()).toISOString();
    }

    return {
      authenticated: true,
      user: cloneProfile(acc.profile),
    };
  });
}

export async function mockLogout(): Promise<void> {
  await simulateDelay(80);
  mutateMockDb((db) => {
    db.currentUserId = null;
    db.currentAuthVersion = null;
  });
}

export async function mockRegister(req: RegisterRequest): Promise<OtpChallengeState> {
  await simulateDelay(150);
  return mutateMockDb((db) => {
    assertNetworkAvailable(db);
    const fieldErrors: Record<string, string> = {};
    const fullName = req.fullName.trim();
    const email = req.email.trim().toLowerCase();

    if (fullName.length < 2 || fullName.length > 150) {
      fieldErrors.fullName = 'Họ và tên phải từ 2 đến 150 ký tự.';
    }
    if (!isValidEmail(email)) {
      fieldErrors.email = 'Vui lòng nhập địa chỉ email hợp lệ.';
    }
    const pwdErr = validatePassword(req.password);
    if (pwdErr) fieldErrors.password = pwdErr;
    if (req.password !== req.confirmPassword) {
      fieldErrors.confirmPassword = 'Mật khẩu xác nhận không khớp.';
    }

    if (Object.keys(fieldErrors).length > 0) {
      throw new AppError({
        code: 'VALIDATION_ERROR',
        status: 400,
        message: 'Thông tin đăng ký chưa hợp lệ. Vui lòng kiểm tra các trường được đánh dấu.',
        fieldErrors,
      });
    }

    if (db.accounts.some((a) => a.profile.email.toLowerCase() === email)) {
      throw new AppError({
        code: 'CONFLICT',
        status: 409,
        message: 'Email này đã được đăng ký tài khoản trên TripLoom.',
        fieldErrors: { email: 'Email đã tồn tại trên hệ thống.' },
      });
    }

    const { state } = issueOtpForEmail(db, email, 'REGISTER', {
      actuallyCreateCode: true,
      pendingPayload: { fullName, password: req.password },
    });

    return state;
  });
}

export async function mockVerifyRegister(req: VerifyRegisterRequest): Promise<{ message: string; email: string }> {
  await simulateDelay(150);
  return mutateMockDb((db) => {
    assertNetworkAvailable(db);
    const normalizedEmail = req.email.trim().toLowerCase();
    const record = verifyOtpRecord(db, normalizedEmail, 'REGISTER', req.code);

    if (db.accounts.some((a) => a.profile.email.toLowerCase() === normalizedEmail)) {
      throw new AppError({
        code: 'CONFLICT',
        status: 409,
        message: 'Tài khoản với email này đã được tạo trước đó.',
      });
    }

    record.used = true;
    const nowIso = new Date(getMockNowMs()).toISOString();
    const newId = `USR${String(db.accounts.length + 1).padStart(3, '0')}`;
    const fullName = record.pendingPayload?.fullName || 'Thành viên TripLoom';
    const shortName = fullName.split(' ').slice(-2).join(' ');

    db.accounts.push({
      password: record.pendingPayload?.password || 'TripLoom@123',
      authVersion: 1,
      profile: {
        id: newId,
        email: normalizedEmail,
        fullName,
        displayName: shortName,
        avatarUrl: null,
        phone: '',
        role: 'MEMBER',
        permissions: [],
        preferences: {
          categoryIds: [],
          defaultBudgetVnd: null,
          defaultPartySize: 2,
          pace: 'MODERATE',
        },
        updatedAt: nowIso,
      },
    });

    return {
      email: normalizedEmail,
      message: 'Xác thực email và tạo tài khoản thành công. Vui lòng đăng nhập để tiếp tục.',
    };
  });
}

export async function mockRequestPasswordReset(req: ForgotPasswordRequest): Promise<OtpChallengeState> {
  await simulateDelay(150);
  return mutateMockDb((db) => {
    assertNetworkAvailable(db);
    const email = req.email.trim().toLowerCase();
    if (!isValidEmail(email)) {
      throw new AppError({
        code: 'VALIDATION_ERROR',
        status: 400,
        message: 'Vui lòng nhập đúng định dạng email.',
        fieldErrors: { email: 'Địa chỉ email không đúng định dạng.' },
      });
    }

    const account = db.accounts.find((a) => a.profile.email.toLowerCase() === email);
    const eligible =
      Boolean(account) &&
      !(account?.profile.role === 'STAFF' && account.profile.staffStatus !== 'ACTIVE');

    const { state } = issueOtpForEmail(db, email, 'PASSWORD_RESET', {
      actuallyCreateCode: eligible,
      genericMessage: 'Nếu email đủ điều kiện, mã xác thực sẽ được gửi đến hộp thư của bạn.',
    });

    return state;
  });
}

export async function mockResetPassword(req: ResetPasswordRequest): Promise<{ message: string }> {
  await simulateDelay(150);
  return mutateMockDb((db) => {
    assertNetworkAvailable(db);
    const fieldErrors: Record<string, string> = {};
    const pwdErr = validatePassword(req.newPassword);
    if (pwdErr) fieldErrors.newPassword = pwdErr;
    if (req.newPassword !== req.confirmPassword) {
      fieldErrors.confirmPassword = 'Mật khẩu xác nhận không khớp.';
    }
    if (Object.keys(fieldErrors).length > 0) {
      throw new AppError({
        code: 'VALIDATION_ERROR',
        status: 400,
        message: 'Mật khẩu mới chưa đáp ứng yêu cầu.',
        fieldErrors,
      });
    }

    const email = req.email.trim().toLowerCase();
    const record = verifyOtpRecord(db, email, 'PASSWORD_RESET', req.code);
    const account = db.accounts.find((a) => a.profile.email.toLowerCase() === email);

    if (!account) {
      throw new AppError({
        code: 'OTP_INVALID',
        status: 400,
        message: 'Tài khoản không đủ điều kiện đặt lại mật khẩu.',
      });
    }

    if (account.profile.role === 'STAFF' && account.profile.staffStatus === 'LOCKED') {
      throw new AppError({
        code: 'ACCOUNT_LOCKED',
        status: 403,
        message: 'Tài khoản nhân viên đang bị khóa, không thể đặt lại mật khẩu hoặc tự mở khóa.',
      });
    }

    if (account.profile.role === 'STAFF' && account.profile.staffStatus === 'INVITED') {
      throw new AppError({
        code: 'ACCOUNT_NOT_ACTIVATED',
        status: 403,
        message: 'Tài khoản nhân viên chưa kích hoạt. Vui lòng dùng trang Kích hoạt tài khoản nhân viên.',
      });
    }

    record.used = true;
    account.password = req.newPassword;
    account.authVersion += 1;

    // Thu hồi mọi phiên cũ, không tự đăng nhập
    if (db.currentUserId === account.profile.id) {
      db.currentUserId = null;
      db.currentAuthVersion = null;
    }

    return {
      message: 'Đã cập nhật mật khẩu thành công. Mọi phiên đăng nhập trước đó đã kết thúc, vui lòng đăng nhập lại.',
    };
  });
}

export async function mockActivateStaff(req: ActivateStaffRequest): Promise<{ message: string }> {
  await simulateDelay(150);
  return mutateMockDb((db) => {
    assertNetworkAvailable(db);
    const fieldErrors: Record<string, string> = {};
    const email = req.email.trim().toLowerCase();
    if (!isValidEmail(email)) fieldErrors.email = 'Vui lòng nhập email nhân viên hợp lệ.';
    const pwdErr = validatePassword(req.password);
    if (pwdErr) fieldErrors.password = pwdErr;
    if (req.password !== req.confirmPassword) {
      fieldErrors.confirmPassword = 'Mật khẩu xác nhận không khớp.';
    }
    if (Object.keys(fieldErrors).length > 0) {
      throw new AppError({
        code: 'VALIDATION_ERROR',
        status: 400,
        message: 'Vui lòng kiểm tra lại thông tin kích hoạt.',
        fieldErrors,
      });
    }

    const account = db.accounts.find((a) => a.profile.email.toLowerCase() === email && a.profile.role === 'STAFF');
    if (!account) {
      throw new AppError({
        code: 'NOT_FOUND',
        status: 404,
        message: 'Không tìm thấy tài khoản nhân viên phù hợp với email này.',
      });
    }

    if (account.profile.staffStatus === 'LOCKED') {
      throw new AppError({
        code: 'ACCOUNT_LOCKED',
        status: 403,
        message: 'Tài khoản nhân viên đã bị khóa, không thể kích hoạt bằng mã email.',
      });
    }

    if (account.profile.staffStatus === 'ACTIVE') {
      throw new AppError({
        code: 'CONFLICT',
        status: 409,
        message: 'Tài khoản nhân viên này đã được kích hoạt trước đó. Vui lòng đăng nhập.',
      });
    }

    const record = verifyOtpRecord(db, email, 'STAFF_ACTIVATION', req.code);
    record.used = true;

    const nowIso = new Date(getMockNowMs()).toISOString();
    account.password = req.password;
    account.profile.staffStatus = 'ACTIVE';
    account.profile.updatedAt = nowIso;
    account.authVersion += 1;

    const staff = db.staffMembers.find((s) => s.id === account.profile.id);
    if (staff) {
      staff.status = 'ACTIVE';
      staff.hasActivatedBefore = true;
      staff.emailDeliveryStatus = 'NOT_REQUIRED';
      staff.emailDeliveryMessage = 'Tài khoản đã hoàn tất kích hoạt.';
      staff.updatedAt = nowIso;
      staff.authVersion = account.authVersion;
    }

    db.auditLogs.unshift({
      id: `LOG${String(db.counters.audit++).padStart(3, '0')}`,
      timestamp: nowIso,
      actorId: account.profile.id,
      actorName: `${account.profile.fullName} (${account.profile.staffCode ?? ''})`,
      targetType: 'STAFF',
      targetId: account.profile.id,
      targetLabel: `${account.profile.staffCode ?? ''} · ${account.profile.fullName}`,
      action: 'STAFF_ACTIVATED',
      actionLabel: 'Nhân viên kích hoạt tài khoản',
      reason: 'Hoàn tất xác thực mã email và thiết lập mật khẩu cá nhân.',
      beforeSummary: { 'Trạng thái': 'Chờ kích hoạt' },
      afterSummary: { 'Trạng thái': 'Đang hoạt động' },
    });

    return {
      message: 'Kích hoạt tài khoản nhân viên thành công. Vui lòng đăng nhập bằng mật khẩu vừa tạo.',
    };
  });
}

export async function mockResendOtp(req: ResendOtpRequest): Promise<OtpChallengeState> {
  await simulateDelay(130);
  return mutateMockDb((db) => {
    assertNetworkAvailable(db);
    const email = req.email.trim().toLowerCase();
    if (!isValidEmail(email)) {
      throw new AppError({
        code: 'VALIDATION_ERROR',
        status: 400,
        message: 'Email không hợp lệ.',
        fieldErrors: { email: 'Email không hợp lệ.' },
      });
    }

    if (req.purpose === 'REGISTER') {
      const prev = findLatestActiveOtp(db, email, 'REGISTER');
      const { state } = issueOtpForEmail(db, email, 'REGISTER', {
        actuallyCreateCode: true,
        pendingPayload: prev?.pendingPayload,
      });
      return state;
    }

    if (req.purpose === 'PASSWORD_RESET') {
      const account = db.accounts.find((a) => a.profile.email.toLowerCase() === email);
      const eligible =
        Boolean(account) &&
        !(account?.profile.role === 'STAFF' && account.profile.staffStatus !== 'ACTIVE');
      const { state } = issueOtpForEmail(db, email, 'PASSWORD_RESET', {
        actuallyCreateCode: eligible,
        genericMessage: 'Nếu email đủ điều kiện, mã xác thực mới đã được gửi đến hộp thư của bạn.',
      });
      return state;
    }

    // STAFF_ACTIVATION
    const account = db.accounts.find((a) => a.profile.email.toLowerCase() === email && a.profile.role === 'STAFF');
    if (!account || account.profile.staffStatus !== 'INVITED') {
      throw new AppError({
        code: 'CONFLICT',
        status: 409,
        message: 'Tài khoản không ở trạng thái Chờ kích hoạt nên không thể gửi lại mã kích hoạt.',
      });
    }
    const { state } = issueOtpForEmail(db, email, 'STAFF_ACTIVATION', {
      actuallyCreateCode: true,
    });
    const staff = db.staffMembers.find((s) => s.id === account.profile.id);
    if (staff) {
      staff.emailDeliveryStatus = 'SENT';
      staff.emailDeliveryMessage = `Email kích hoạt mới đã gửi tới ${email}.`;
      staff.lastActivationSentAt = new Date(getMockNowMs()).toISOString();
    }
    return state;
  });
}

export async function mockGetOtpState(email: string, purpose: OtpPurpose): Promise<OtpChallengeState> {
  const db = loadMockDb();
  const nowMs = getMockNowMs();
  const normalizedEmail = email.trim().toLowerCase();
  const bucket = db.otpRateBuckets[normalizedEmail];
  const latest = findLatestActiveOtp(db, normalizedEmail, purpose);

  let burstLockedUntil: string | null = null;
  let sendsUsedInBurst = bucket?.sendsInBurst ?? 0;
  if (bucket?.burstLockedUntil) {
    if (new Date(bucket.burstLockedUntil).getTime() > nowMs) {
      burstLockedUntil = bucket.burstLockedUntil;
    } else {
      sendsUsedInBurst = 0;
    }
  }

  let resendAvailableAt: string | null = burstLockedUntil;
  if (!resendAvailableAt && bucket?.lastSentAt) {
    const cooldownEnd = new Date(bucket.lastSentAt).getTime() + OTP_RULES.resendCooldownSeconds * 1000;
    if (cooldownEnd > nowMs) {
      resendAvailableAt = new Date(cooldownEnd).toISOString();
    }
  }

  return {
    email: normalizedEmail,
    maskedEmail: maskEmail(normalizedEmail),
    purpose,
    expiresAt: latest && !latest.used ? latest.expiresAt : null,
    resendAvailableAt,
    burstLockedUntil,
    sendsUsedInBurst,
    maxSendsPerBurst: OTP_RULES.maxSendsPerBurst,
    remainingAttempts: latest ? Math.max(0, OTP_RULES.maxVerifyAttempts - latest.failedAttempts) : OTP_RULES.maxVerifyAttempts,
    message:
      purpose === 'PASSWORD_RESET'
        ? 'Nếu email đủ điều kiện, mã xác thực sẽ được gửi đến hộp thư của bạn.'
        : 'Nhập mã 6 chữ số đã được gửi tới email của bạn.',
  };
}

export async function mockGetProfile(): Promise<UserProfile> {
  await simulateDelay(70);
  const db = loadMockDb();
  assertNetworkAvailable(db);
  const acc = requireAuthAccount(db);
  return cloneProfile(acc.profile);
}

export async function mockUpdateProfile(req: UpdateProfileRequest): Promise<UserProfile> {
  await simulateDelay(140);
  return mutateMockDb((db) => {
    assertNetworkAvailable(db);
    const acc = requireAuthAccount(db);
    const fieldErrors: Record<string, string> = {};

    const fullName = req.fullName.trim();
    const displayName = req.displayName.trim();
    if (fullName.length < 2 || fullName.length > 150) {
      fieldErrors.fullName = 'Họ và tên phải từ 2 đến 150 ký tự.';
    }
    if (displayName.length < 2 || displayName.length > 80) {
      fieldErrors.displayName = 'Tên hiển thị phải từ 2 đến 80 ký tự.';
    }
    if (req.defaultBudgetVnd !== null && req.defaultBudgetVnd < 0) {
      fieldErrors.defaultBudgetVnd = 'Ngân sách mặc định không được là số âm.';
    }
    if (!Number.isInteger(req.defaultPartySize) || req.defaultPartySize < 1 || req.defaultPartySize > 50) {
      fieldErrors.defaultPartySize = 'Số người mặc định phải từ 1 đến 50.';
    }

    if (Object.keys(fieldErrors).length > 0) {
      throw new AppError({
        code: 'VALIDATION_ERROR',
        status: 400,
        message: 'Thông tin hồ sơ chưa hợp lệ.',
        fieldErrors,
      });
    }

    const nowIso = new Date(getMockNowMs()).toISOString();
    acc.profile.fullName = fullName;
    acc.profile.displayName = displayName;
    acc.profile.phone = req.phone.trim();
    acc.profile.preferences = {
      categoryIds: [...new Set(req.categoryIds)],
      defaultBudgetVnd: req.defaultBudgetVnd,
      defaultPartySize: req.defaultPartySize,
      pace: req.pace,
    };
    acc.profile.updatedAt = nowIso;

    // Đồng bộ tên hiển thị trong các bản đánh giá của người dùng
    for (const rv of db.reviews) {
      if (rv.userId === acc.profile.id) {
        rv.userName = fullName;
      }
    }

    return cloneProfile(acc.profile);
  });
}

export async function mockChangePassword(req: ChangePasswordRequest): Promise<{ message: string }> {
  await simulateDelay(140);
  return mutateMockDb((db) => {
    assertNetworkAvailable(db);
    const acc = requireAuthAccount(db);
    const fieldErrors: Record<string, string> = {};

    if (!req.currentPassword) {
      fieldErrors.currentPassword = 'Vui lòng nhập mật khẩu hiện tại.';
    } else if (acc.password !== req.currentPassword) {
      fieldErrors.currentPassword = 'Mật khẩu hiện tại không đúng.';
    }

    const pwdErr = validatePassword(req.newPassword);
    if (pwdErr) {
      fieldErrors.newPassword = pwdErr;
    } else if (req.newPassword === req.currentPassword) {
      fieldErrors.newPassword = 'Mật khẩu mới không được trùng với mật khẩu hiện tại.';
    }

    if (req.newPassword !== req.confirmPassword) {
      fieldErrors.confirmPassword = 'Mật khẩu xác nhận không khớp.';
    }

    if (Object.keys(fieldErrors).length > 0) {
      throw new AppError({
        code: 'VALIDATION_ERROR',
        status: 400,
        message: 'Thông tin đổi mật khẩu chưa hợp lệ.',
        fieldErrors,
      });
    }

    const nowIso = new Date(getMockNowMs()).toISOString();
    acc.password = req.newPassword;
    acc.authVersion += 1;
    acc.profile.updatedAt = nowIso;
    if (db.currentUserId === acc.profile.id) {
      db.currentAuthVersion = acc.authVersion;
    }

    return {
      message: 'Đổi mật khẩu thành công.',
    };
  });
}

/**
 * Helper CHỈ dành cho DevToolbar & Vitest để kiểm tra mã OTP mock mới nhất.
 */
export function getLatestDevOtpForEmail(email: string, purpose?: OtpPurpose): MockOtpCodeRecord | null {
  const db = loadMockDb();
  const normalized = email.trim().toLowerCase();
  const matches = db.otpCodes.filter(
    (c) =>
      c.email === normalized &&
      (!purpose || c.purpose === purpose) &&
      !c.invalidated &&
      !c.used,
  );
  return matches[matches.length - 1] ?? null;
}

export function listAllDevOtps(): MockOtpCodeRecord[] {
  const db = loadMockDb();
  return [...db.otpCodes].filter((c) => !c.invalidated && !c.used).slice(-8).reverse();
}
