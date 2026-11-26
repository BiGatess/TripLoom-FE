import { describe, expect, it } from 'vitest';
import type { UserProfile } from '@/api/contracts';
import { evaluateRouteAccess, resolvePostLoginDestination } from '@/app/route-guards';

const basePrefs = {
  categoryIds: [],
  defaultBudgetVnd: null,
  defaultPartySize: 2,
  pace: 'MODERATE' as const,
};

const memberUser: UserProfile = {
  id: 'USR001',
  email: 'minh.anh@example.com',
  fullName: 'Nguyễn Minh Anh',
  displayName: 'Minh Anh',
  avatarUrl: null,
  phone: '',
  role: 'MEMBER',
  permissions: [],
  preferences: basePrefs,
  updatedAt: '2027-01-01T00:00:00Z',
};

const staffDestUser: UserProfile = {
  ...memberUser,
  id: 'STF_NV001',
  role: 'STAFF',
  staffCode: 'NV001',
  staffStatus: 'ACTIVE',
  permissions: ['STAFF_DESTINATION', 'STAFF_REVIEW'],
};

const staffLockedUser: UserProfile = {
  ...staffDestUser,
  id: 'STF_NV003',
  staffCode: 'NV003',
  staffStatus: 'LOCKED',
};

const adminUser: UserProfile = {
  ...memberUser,
  id: 'ADM001',
  role: 'ADMIN',
  staffCode: 'ADM001',
  staffStatus: 'ACTIVE',
  permissions: ['STAFF_DESTINATION', 'STAFF_SERVICE', 'STAFF_BOOKING', 'STAFF_REVIEW', 'STAFF_PAYMENT_VIEW'],
};

describe('Route guards & RBAC', () => {
  it('redirects guests on authenticated routes preserving internal redirect URL', () => {
    const res = evaluateRouteAccess({ kind: 'authenticated' }, null, '/dat-dich-vu/SV001?date=2027-01-16&guests=2');
    expect(res).toEqual({
      allowed: false,
      action: 'redirect-login',
      loginUrl: `/dang-nhap?redirect=${encodeURIComponent('/dat-dich-vu/SV001?date=2027-01-16&guests=2')}`,
    });
  });

  it('forbids members and locked/invited staff from backoffice routes', () => {
    expect(evaluateRouteAccess({ kind: 'backoffice' }, memberUser, '/quan-tri')).toMatchObject({
      allowed: false,
      action: 'forbidden',
    });
    expect(evaluateRouteAccess({ kind: 'backoffice' }, staffLockedUser, '/quan-tri')).toMatchObject({
      allowed: false,
      action: 'forbidden',
    });
  });

  it('enforces granular staff permissions and admin-only routes', () => {
    expect(evaluateRouteAccess({ kind: 'backoffice', permission: 'STAFF_DESTINATION' }, staffDestUser, '/quan-tri/dia-diem')).toEqual({
      allowed: true,
    });
    expect(evaluateRouteAccess({ kind: 'backoffice', permission: 'STAFF_SERVICE' }, staffDestUser, '/quan-tri/dich-vu')).toMatchObject({
      allowed: false,
      action: 'forbidden',
    });
    expect(evaluateRouteAccess({ kind: 'backoffice', adminOnly: true }, staffDestUser, '/quan-tri/nhan-vien')).toMatchObject({
      allowed: false,
      action: 'forbidden',
    });
    expect(evaluateRouteAccess({ kind: 'backoffice', adminOnly: true }, adminUser, '/quan-tri/nhan-vien')).toEqual({
      allowed: true,
    });
  });

  it('prevents redirecting a member into /quan-tri after login and isolates backoffice sessions to /quan-tri', () => {
    expect(resolvePostLoginDestination(memberUser, '/quan-tri/nhan-vien')).toBe('/ca-nhan');
    expect(resolvePostLoginDestination(memberUser, '/dat-dich-vu/SV001')).toBe('/dat-dich-vu/SV001');
    expect(resolvePostLoginDestination(adminUser, null)).toBe('/quan-tri');
    expect(resolvePostLoginDestination(adminUser, '/ca-nhan')).toBe('/quan-tri');
    expect(resolvePostLoginDestination(adminUser, '/quan-tri/thanh-toan')).toBe('/quan-tri/thanh-toan');

    expect(evaluateRouteAccess({ kind: 'backoffice' }, null, '/quan-tri/thanh-toan')).toEqual({
      allowed: false,
      action: 'redirect-login',
      loginUrl: `/quan-tri/dang-nhap?redirect=${encodeURIComponent('/quan-tri/thanh-toan')}`,
    });
    expect(evaluateRouteAccess({ kind: 'public' }, adminUser, '/')).toEqual({
      allowed: false,
      action: 'redirect-home',
      targetUrl: '/quan-tri',
    });
    expect(evaluateRouteAccess({ kind: 'authenticated' }, staffDestUser, '/ca-nhan')).toEqual({
      allowed: false,
      action: 'redirect-home',
      targetUrl: '/quan-tri',
    });
  });
});
