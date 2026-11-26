import type { UserProfile } from '@/api/contracts';
import type { StaffPermissionCode } from '@/config/constants';
import { isValidInternalRedirect } from '@/shared/utils/validation';

export type AccessPolicy =
  | { kind: 'public' }
  | { kind: 'guest-only' }
  | { kind: 'authenticated' }
  | { kind: 'backoffice'; permission?: StaffPermissionCode; adminOnly?: boolean };

export type GuardResult =
  | { allowed: true }
  | { allowed: false; action: 'redirect-login'; loginUrl: string }
  | { allowed: false; action: 'redirect-home'; targetUrl: string }
  | { allowed: false; action: 'forbidden'; reason: string };

export function canUserAccessBackoffice(user: UserProfile | null): boolean {
  if (!user) return false;
  if (user.role === 'ADMIN') return true;
  return user.role === 'STAFF' && user.staffStatus === 'ACTIVE';
}

export function hasBackofficePermission(
  user: UserProfile | null,
  permission?: StaffPermissionCode,
  adminOnly?: boolean,
): boolean {
  if (!canUserAccessBackoffice(user)) return false;
  if (user!.role === 'ADMIN') return true;
  if (adminOnly) return false;
  if (!permission) return true;
  return user!.permissions.includes(permission);
}

export function evaluateRouteAccess(
  policy: AccessPolicy,
  user: UserProfile | null,
  requestedFullPath: string,
): GuardResult {
  // Tách biệt hoàn toàn phiên Quản trị/Nhân viên: khi đã đăng nhập Backoffice thì chỉ hoạt động trong /quan-tri
  if (policy.kind !== 'backoffice' && canUserAccessBackoffice(user)) {
    return { allowed: false, action: 'redirect-home', targetUrl: '/quan-tri' };
  }

  if (policy.kind === 'public') {
    return { allowed: true };
  }

  if (policy.kind === 'guest-only') {
    if (!user) return { allowed: true };
    const defaultTarget = canUserAccessBackoffice(user) ? '/quan-tri' : '/ca-nhan';
    return { allowed: false, action: 'redirect-home', targetUrl: defaultTarget };
  }

  if (!user) {
    if (policy.kind === 'backoffice') {
      const safeBoRedirect =
        isValidInternalRedirect(requestedFullPath) && requestedFullPath.startsWith('/quan-tri')
          ? requestedFullPath
          : '/quan-tri';
      return {
        allowed: false,
        action: 'redirect-login',
        loginUrl: `/quan-tri/dang-nhap?redirect=${encodeURIComponent(safeBoRedirect)}`,
      };
    }

    const safeRedirect = isValidInternalRedirect(requestedFullPath) ? requestedFullPath : '/ca-nhan';
    return {
      allowed: false,
      action: 'redirect-login',
      loginUrl: `/dang-nhap?redirect=${encodeURIComponent(safeRedirect)}`,
    };
  }

  if (policy.kind === 'authenticated') {
    return { allowed: true };
  }

  // Backoffice guard
  if (!canUserAccessBackoffice(user)) {
    return {
      allowed: false,
      action: 'forbidden',
      reason: 'Khu vực này chỉ dành cho Quản trị viên hoặc Nhân viên đang hoạt động.',
    };
  }

  if (policy.adminOnly && user.role !== 'ADMIN') {
    return {
      allowed: false,
      action: 'forbidden',
      reason: 'Chức năng này chỉ dành cho Quản trị viên hệ thống.',
    };
  }

  if (policy.permission && !hasBackofficePermission(user, policy.permission, false)) {
    return {
      allowed: false,
      action: 'forbidden',
      reason: 'Tài khoản nhân viên của bạn chưa được cấp nhóm quyền cho mục này.',
    };
  }

  return { allowed: true };
}

export function resolvePostLoginDestination(user: UserProfile, redirectParam: string | null): string {
  if (canUserAccessBackoffice(user)) {
    if (
      isValidInternalRedirect(redirectParam) &&
      redirectParam.startsWith('/quan-tri') &&
      !redirectParam.startsWith('/quan-tri/dang-nhap')
    ) {
      return redirectParam;
    }
    return '/quan-tri';
  }

  if (isValidInternalRedirect(redirectParam)) {
    // Không điều hướng người dùng thường vào /quan-tri sau khi đăng nhập
    if (redirectParam.startsWith('/quan-tri')) {
      return '/ca-nhan';
    }
    return redirectParam;
  }
  return '/ca-nhan';
}
