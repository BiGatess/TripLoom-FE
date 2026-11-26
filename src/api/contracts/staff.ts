import type { StaffPermissionCode } from '@/config/constants';
import type { PaginatedResponse, PaginationParams, StaffAccountStatus } from './common';

export interface StaffMember {
  id: string;
  staffCode: string;
  fullName: string;
  email: string;
  phone: string;
  notes: string;
  status: StaffAccountStatus;
  hasActivatedBefore: boolean;
  permissions: StaffPermissionCode[];
  emailDeliveryStatus: 'SENT' | 'FAILED' | 'NOT_REQUIRED';
  emailDeliveryMessage: string;
  lastActivationSentAt: string | null;
  createdBy: string;
  createdAt: string;
  lastLoginAt: string | null;
  updatedAt: string;
  authVersion: number;
}

export interface CreateStaffRequest {
  staffCode: string;
  fullName: string;
  email: string;
  phone: string;
  notes: string;
  permissions: StaffPermissionCode[];
}

export interface UpdateStaffRequest {
  fullName: string;
  phone: string;
  notes: string;
  expectedUpdatedAt: string;
}

export interface UpdateStaffPermissionsRequest {
  permissions: StaffPermissionCode[];
  reason: string;
  expectedUpdatedAt: string;
}

export interface LockUnlockStaffRequest {
  action: 'LOCK' | 'UNLOCK';
  reason: string;
  expectedUpdatedAt: string;
}

export interface StaffFilterParams extends PaginationParams {
  query?: string;
  status?: StaffAccountStatus | 'ALL';
  permission?: StaffPermissionCode | 'ALL';
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actorId: string;
  actorName: string;
  targetType: 'STAFF' | 'BOOKING' | 'PAYMENT_EVENT' | 'REVIEW' | 'CATALOG';
  targetId: string;
  targetLabel: string;
  action: string;
  actionLabel: string;
  reason: string;
  beforeSummary: Record<string, string>;
  afterSummary: Record<string, string>;
}

export interface AuditLogFilterParams extends PaginationParams {
  query?: string;
  targetId?: string;
  targetType?: AuditLogEntry['targetType'] | 'ALL';
  fromDate?: string;
  toDate?: string;
}

export type DashboardRangeKey = 'day' | 'week' | 'month' | '90d';

export interface DashboardRangeMetrics {
  kpiLabel: string;
  kpiVal: string;
  kpiTrend: string;
  kpiSub: string;
  bookVal: string;
  bookTrend: string;
  sepayVal: string;
  chartTitle: string;
  totalFormatted: string;
  avgFormatted: string;
  donutPeriod: string;
  donutVal: string;
  gridCols: 'grid-cols-7' | 'grid-cols-4' | 'grid-cols-6';
  bars: Array<{ label: string; valTr: number; displayVal: string; heightPct: number; active?: boolean }>;
}

export interface BackofficeDashboardStats {
  pendingBookings: number;
  confirmedBookings: number;
  needsReviewEvents: number;
  pendingReviews: number;
  invitedStaff: number;
  activeDestinations: number;
  activeServices: number;
  analytics?: {
    ranges: Record<DashboardRangeKey, DashboardRangeMetrics>;
    breakdown: Array<{ key: 'tour' | 'craft' | 'other'; label: string; sharePct: number; valueLabel: string; colorClass: string }>;
    destinationRevenue: Array<{ name: string; amountFormatted: string; sharePct: number; barWidthPct: number; barColorClass: string }>;
  };
  workQueue: Array<{
    id: string;
    moduleLabel?: string;
    title: string;
    subtitle: string;
    badgeLabel: string;
    badgeTone: 'warning' | 'error' | 'info';
    actionLabel?: string;
    href: string;
    requiredPermission?: StaffPermissionCode | 'ADMIN_ONLY';
  }>;
}

export type PaginatedStaff = PaginatedResponse<StaffMember>;
export type PaginatedAuditLogs = PaginatedResponse<AuditLogEntry>;
