export type FieldErrors = Record<string, string>;

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function validatePassword(password: string): string | null {
  if (password.length < 8) {
    return 'Mật khẩu phải có ít nhất 8 ký tự.';
  }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return 'Mật khẩu cần gồm cả chữ cái và chữ số.';
  }
  return null;
}

export function validateOtpCode(code: string): string | null {
  if (!/^\d{6}$/.test(code.trim())) {
    return 'Vui lòng nhập đủ 6 chữ số mã xác thực.';
  }
  return null;
}

export function validateReason(reason: string, min = 5, max = 500): string | null {
  const trimmed = reason.trim();
  if (trimmed.length < min) {
    return `Vui lòng nhập lý do ít nhất ${min} ký tự.`;
  }
  if (trimmed.length > max) {
    return `Lý do không vượt quá ${max} ký tự.`;
  }
  return null;
}

export function validateStaffCode(code: string): string | null {
  const normalized = code.trim().toUpperCase();
  if (normalized.length < 3 || normalized.length > 30) {
    return 'Mã nhân viên phải từ 3 đến 30 ký tự.';
  }
  if (!/^[A-Z0-9_-]+$/.test(normalized)) {
    return 'Mã nhân viên chỉ gồm chữ hoa, chữ số, dấu gạch ngang hoặc gạch dưới.';
  }
  return null;
}

export function isValidInternalRedirect(path: string | null | undefined): path is string {
  if (!path) return false;
  return path.startsWith('/') && !path.startsWith('//') && !path.startsWith('/dang-nhap');
}
