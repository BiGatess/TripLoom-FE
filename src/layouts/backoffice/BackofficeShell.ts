import { sessionStore } from '@/app/session-store';
import { hasBackofficePermission } from '@/app/route-guards';
import { router } from '@/app/router';
import type { StaffPermissionCode } from '@/config/constants';
import { authService } from '@/features/auth/auth.service';
import { renderLogoMark } from '@/shared/components/Logo';
import { openConfirmModal } from '@/shared/components/Modal';
import { showToast } from '@/shared/components/Toast';
import { bindImageFallbacks, escapeHtml } from '@/shared/utils/dom';

export type BackofficeNavKey =
  | 'overview'
  | 'categories'
  | 'destinations'
  | 'services'
  | 'bookings'
  | 'reviews'
  | 'payments'
  | 'staff'
  | 'audit';

interface BackofficeNavItem {
  key: BackofficeNavKey;
  label: string;
  href: string;
  icon: string;
  permission?: StaffPermissionCode;
  adminOnly?: boolean;
}

const BACKOFFICE_NAV_ITEMS: BackofficeNavItem[] = [
  { key: 'overview', label: 'Tổng quan', href: '/quan-tri', icon: 'dashboard' },
  { key: 'categories', label: 'Danh mục', href: '/quan-tri/danh-muc', icon: 'category', adminOnly: true },
  { key: 'destinations', label: 'Địa điểm', href: '/quan-tri/dia-diem', icon: 'place', permission: 'STAFF_DESTINATION' },
  { key: 'services', label: 'Dịch vụ', href: '/quan-tri/dich-vu', icon: 'confirmation_number', permission: 'STAFF_SERVICE' },
  { key: 'bookings', label: 'Booking', href: '/quan-tri/booking', icon: 'receipt_long', permission: 'STAFF_BOOKING' },
  { key: 'reviews', label: 'Kiểm duyệt đánh giá', href: '/quan-tri/danh-gia', icon: 'fact_check', permission: 'STAFF_REVIEW' },
  { key: 'payments', label: 'Thanh toán & đối soát', href: '/quan-tri/thanh-toan', icon: 'account_balance', permission: 'STAFF_PAYMENT_VIEW' },
  { key: 'staff', label: 'Nhân viên', href: '/quan-tri/nhan-vien', icon: 'badge', adminOnly: true },
  { key: 'audit', label: 'Nhật ký', href: '/quan-tri/nhat-ky', icon: 'history', adminOnly: true },
];

export interface BackofficeShellOptions {
  container: HTMLElement;
  activeNav: BackofficeNavKey;
  breadcrumbs: Array<{ label: string; href?: string }>;
  contentHtml: string;
}

/**
 * Giao diện khu Quản trị & Vận hành hoàn toàn tách biệt (KHÔNG hiển thị Header/Footer của trang du khách).
 */
export function renderBackofficeShell(opts: BackofficeShellOptions): HTMLElement {
  const user = sessionStore.user;
  const visibleItems = BACKOFFICE_NAV_ITEMS.filter((item) =>
    hasBackofficePermission(user, item.permission, item.adminOnly),
  );

  const navLinks = visibleItems
    .map((item) => {
      const active = item.key === opts.activeNav;
      return `
        <a href="${item.href}" class="min-h-[44px] px-3.5 rounded-lg flex items-center gap-3 font-label text-label-md no-underline transition-colors ${
          active ? 'bg-primary text-on-primary shadow-sm' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
        }">
          <span class="material-symbols-outlined text-[20px]" aria-hidden="true">${item.icon}</span>
          <span>${item.label}</span>
        </a>
      `;
    })
    .join('');

  const roleSubtitle =
    user?.role === 'ADMIN'
      ? 'Quản trị viên hệ thống'
      : `Nhân viên · ${user?.staffCode ?? ''}`;

  const breadcrumbHtml = opts.breadcrumbs
    .map((b, i) => {
      const isLast = i === opts.breadcrumbs.length - 1;
      if (isLast || !b.href) {
        return `<strong class="text-on-surface font-medium">${escapeHtml(b.label)}</strong>`;
      }
      return `<a href="${escapeHtml(b.href)}" class="tl-breadcrumb-link">${escapeHtml(b.label)}</a>`;
    })
    .join(' <span aria-hidden="true" class="mx-1 text-border">/</span> ');

  const profileCardHtml = `
    <div class="pt-4 pb-12 border-t border-slate-800 flex flex-col gap-3">
      <div class="flex items-center gap-3 px-2">
        <span class="w-9 h-9 rounded-full bg-primary text-on-primary font-label text-label-md inline-flex items-center justify-center shrink-0">
          ${escapeHtml((user?.displayName ?? 'A').slice(0, 1).toUpperCase())}
        </span>
        <div class="min-w-0 leading-tight">
          <p class="font-label text-label-md text-white truncate">${escapeHtml(user?.fullName ?? '')}</p>
          <p class="font-body text-[11px] text-slate-400 truncate">${escapeHtml(roleSubtitle)}</p>
        </div>
      </div>
      <button
        type="button"
        data-bo-logout
        class="w-full min-h-[40px] px-3 rounded-lg border border-slate-700 bg-slate-800/70 text-slate-200 hover:bg-error hover:border-error hover:text-white inline-flex items-center justify-center gap-2 font-label text-label-sm transition-colors"
      >
        <span class="material-symbols-outlined text-[18px]" aria-hidden="true">logout</span>
        <span>Đăng xuất Quản trị</span>
      </button>
    </div>
  `;

  opts.container.innerHTML = `
    <div class="min-h-screen flex bg-background">
      <!-- Sidebar Quản trị cố định bên trái (Desktop) — Không Header, Không Footer -->
      <aside class="hidden lg:flex w-[260px] shrink-0 bg-[#0F172A] text-white p-4 flex-col justify-between sticky top-0 h-screen overflow-y-auto">
        <div class="flex flex-col gap-6">
          <a href="/quan-tri" class="flex items-center gap-3 px-2 pt-1 no-underline">
            ${renderLogoMark(34)}
            <div class="leading-tight">
              <span class="font-headline text-headline-md text-white block">TripLoom</span>
              <span class="font-label text-[11px] text-teal-300 uppercase tracking-wider">Admin Console</span>
            </div>
          </a>

          <nav aria-label="Menu khu quản trị" class="flex flex-col gap-1">
            ${navLinks}
          </nav>
        </div>

        ${profileCardHtml}
      </aside>

      <!-- Ngăn kéo Sidebar Quản trị trên màn hình nhỏ (< 1024px) -->
      <div data-bo-drawer class="fixed inset-0 z-50 hidden lg:hidden">
        <div data-bo-drawer-backdrop class="fixed inset-0 bg-on-surface/50 tl-backdrop-enter"></div>
        <aside class="relative w-72 max-w-[85vw] min-h-screen bg-[#0F172A] text-white p-4 flex flex-col justify-between gap-6 z-10 overflow-y-auto tl-drawer-left-enter">
          <div class="flex flex-col gap-5">
            <div class="flex items-center justify-between pb-3 border-b border-slate-800">
              <div class="flex items-center gap-2.5">
                ${renderLogoMark(30)}
                <div class="leading-tight">
                  <span class="font-headline text-headline-md text-white block">TripLoom</span>
                  <span class="font-label text-[11px] text-teal-300 uppercase">Admin Console</span>
                </div>
              </div>
              <button type="button" data-bo-menu-close aria-label="Đóng menu quản trị" class="w-9 h-9 inline-flex items-center justify-center rounded-full text-slate-300 hover:bg-slate-800 hover:text-white">
                <span class="material-symbols-outlined text-[20px]" aria-hidden="true">close</span>
              </button>
            </div>
            <nav aria-label="Menu khu quản trị di động" class="flex flex-col gap-1">
              ${navLinks}
            </nav>
          </div>
          ${profileCardHtml}
        </aside>
      </div>

      <!-- Khu vực nội dung làm việc chính (Không Header công khai, Không Footer) -->
      <main id="shell-main" class="flex-1 min-w-0 p-4 md:p-8 tl-page-enter">
        <div class="max-w-[1320px] mx-auto w-full flex flex-col gap-6">
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-3">
              <button
                type="button"
                data-bo-menu-open
                aria-expanded="false"
                aria-label="Mở menu quản trị"
                class="lg:hidden w-10 h-10 inline-flex items-center justify-center rounded-lg border border-border bg-surface text-on-surface hover:bg-surface-muted"
              >
                <span class="material-symbols-outlined text-[22px]" aria-hidden="true">menu</span>
              </button>
              <nav aria-label="Breadcrumb" class="font-body text-body-md text-text-secondary">${breadcrumbHtml}</nav>
            </div>
          </div>

          ${opts.contentHtml}
        </div>
      </main>
    </div>
  `;

  const drawer = opts.container.querySelector<HTMLElement>('[data-bo-drawer]');
  const openBtn = opts.container.querySelector<HTMLButtonElement>('[data-bo-menu-open]');
  const closeBtn = opts.container.querySelector<HTMLButtonElement>('[data-bo-menu-close]');

  const closeDrawer = () => {
    if (!drawer || drawer.classList.contains('hidden')) return;
    drawer.classList.add('hidden');
    openBtn?.setAttribute('aria-expanded', 'false');
    openBtn?.focus();
  };

  openBtn?.addEventListener('click', () => {
    drawer?.classList.remove('hidden');
    openBtn.setAttribute('aria-expanded', 'true');
    closeBtn?.focus();
  });
  closeBtn?.addEventListener('click', closeDrawer);
  opts.container.querySelector('[data-bo-drawer-backdrop]')?.addEventListener('click', closeDrawer);
  drawer?.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeDrawer();
    }
  });

  opts.container.querySelectorAll('[data-bo-logout]').forEach((btn) => {
    btn.addEventListener('click', () => {
      openConfirmModal({
        title: 'Đăng xuất khỏi trang Quản trị?',
        description: 'Phiên làm việc Quản trị hiện tại sẽ kết thúc và quay về cổng đăng nhập Quản trị.',
        confirmLabel: 'Đăng xuất',
        onConfirm: async () => {
          await authService.logout();
          sessionStore.clear();
          showToast('Đã đăng xuất khỏi khu Quản trị.', 'info');
          router.navigate('/quan-tri/dang-nhap');
        },
      });
    });
  });

  bindImageFallbacks(opts.container);
  return opts.container.querySelector<HTMLElement>('#shell-main')!;
}
