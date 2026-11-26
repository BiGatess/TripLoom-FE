import { sessionStore } from '@/app/session-store';
import { canUserAccessBackoffice } from '@/app/route-guards';
import { renderLogoMark } from '@/shared/components/Logo';
import { bindSharedChrome, renderSharedFooter, renderSharedHeader, type TopNavKey } from '@/shared/components/SiteChrome';
import { bindImageFallbacks } from '@/shared/utils/dom';

export type MemberNavKey =
  | 'overview'
  | 'plan'
  | 'itineraries'
  | 'chat'
  | 'favorites'
  | 'reviews'
  | 'bookings'
  | 'profile';

const MEMBER_NAV_ITEMS: Array<{ key: MemberNavKey; label: string; href: string; icon: string }> = [
  { key: 'overview', label: 'Tổng quan', href: '/ca-nhan', icon: 'dashboard' },
  { key: 'plan', label: 'Lập lịch trình', href: '/lap-lich-trinh', icon: 'add_circle' },
  { key: 'itineraries', label: 'Lịch trình của tôi', href: '/lich-trinh-cua-toi', icon: 'map' },
  { key: 'chat', label: 'Chat AI', href: '/chat', icon: 'chat' },
  { key: 'favorites', label: 'Yêu thích', href: '/yeu-thich', icon: 'favorite' },
  { key: 'reviews', label: 'Đánh giá của tôi', href: '/danh-gia-cua-toi', icon: 'rate_review' },
  { key: 'bookings', label: 'Đơn dịch vụ', href: '/don-dich-vu', icon: 'receipt_long' },
  { key: 'profile', label: 'Hồ sơ cá nhân', href: '/ca-nhan/ho-so', icon: 'person' },
];

export interface MemberShellOptions {
  container: HTMLElement;
  activeNav: MemberNavKey;
  contentHtml: string;
}

export function renderMemberShell(opts: MemberShellOptions): HTMLElement {
  const user = sessionStore.user;
  const activeTopNav: TopNavKey | undefined =
    opts.activeNav === 'plan' ? 'plan' : opts.activeNav === 'chat' ? 'chat' : undefined;

  const navLinks = MEMBER_NAV_ITEMS.map((item) => {
    const active = item.key === opts.activeNav;
    return `
      <a href="${item.href}" class="min-h-[44px] px-3 rounded-lg flex items-center gap-3 font-label text-label-md no-underline transition-colors ${
        active ? 'bg-primary-light text-primary' : 'text-on-surface hover:bg-surface-muted'
      }">
        <span class="material-symbols-outlined text-[20px]" aria-hidden="true">${item.icon}</span>
        <span>${item.label}</span>
      </a>
    `;
  }).join('');

  const backofficeShortcut = canUserAccessBackoffice(user)
    ? `<a href="/quan-tri" class="min-h-[44px] px-3 rounded-lg flex items-center gap-3 font-label text-label-md text-primary border border-primary/30 bg-primary-light/50 hover:bg-primary-light mt-3 no-underline">
         <span class="material-symbols-outlined text-[20px]" aria-hidden="true">admin_panel_settings</span>
         <span>Chuyển khu quản trị</span>
       </a>`
    : '';

  opts.container.innerHTML = `
    <div class="min-h-screen flex flex-col bg-background">
      ${renderSharedHeader({ activeTopNav, menuAriaLabel: 'Mở menu cá nhân' })}

      <div class="flex-1 flex min-w-0">
        <!-- Desktop Sidebar -->
        <aside class="hidden lg:flex w-[248px] shrink-0 bg-surface border-r border-border p-4 flex-col">
          <nav aria-label="Menu không gian cá nhân" class="flex flex-col gap-1">
            ${navLinks}
            ${backofficeShortcut}
          </nav>
        </aside>

        <!-- Mobile Drawer -->
        <div data-member-drawer class="fixed inset-0 z-50 hidden lg:hidden">
          <div data-member-drawer-backdrop class="fixed inset-0 bg-on-surface/40 tl-backdrop-enter"></div>
          <aside class="relative w-72 max-w-[85vw] min-h-screen bg-surface border-r border-border p-4 flex flex-col justify-between gap-4 z-10 overflow-y-auto tl-drawer-left-enter">
            <div class="flex flex-col gap-3">
              <div class="flex items-center justify-between pb-3 border-b border-border">
                <div class="flex items-center gap-2">
                  ${renderLogoMark(28)}
                  <span class="font-headline text-headline-md text-on-surface">TripLoom</span>
                </div>
                <button type="button" data-member-menu-close aria-label="Đóng menu" class="w-10 h-10 inline-flex items-center justify-center rounded-full hover:bg-surface-muted">
                  <span class="material-symbols-outlined text-[20px]" aria-hidden="true">close</span>
                </button>
              </div>
              <nav aria-label="Menu không gian cá nhân di động" class="flex flex-col gap-1">
                ${navLinks}
                ${backofficeShortcut}
                <div class="border-t border-border mt-2 pt-2 flex flex-col gap-1">
                  <a href="/" class="min-h-[42px] px-3 rounded-lg flex items-center gap-3 text-text-secondary hover:bg-surface-muted font-label text-label-md no-underline">
                    <span class="material-symbols-outlined text-[20px]" aria-hidden="true">home</span>
                    <span>Trang chủ</span>
                  </a>
                  <a href="/dia-diem" class="min-h-[42px] px-3 rounded-lg flex items-center gap-3 text-text-secondary hover:bg-surface-muted font-label text-label-md no-underline">
                    <span class="material-symbols-outlined text-[20px]" aria-hidden="true">travel_explore</span>
                    <span>Khám phá</span>
                  </a>
                </div>
              </nav>
            </div>
            <button type="button" data-site-logout class="min-h-[42px] px-4 rounded-full border border-border text-error flex items-center justify-center font-label text-label-md">Đăng xuất</button>
          </aside>
        </div>

        <main id="shell-main" class="flex-1 min-w-0 p-4 md:p-8 tl-page-enter">
          <div class="max-w-6xl mx-auto w-full flex flex-col gap-6">
            ${opts.contentHtml}
          </div>
        </main>
      </div>

      ${renderSharedFooter()}
    </div>
  `;

  bindSharedChrome(opts.container, {
    drawerSelector: '[data-member-drawer]',
    drawerBackdropSelector: '[data-member-drawer-backdrop]',
    drawerCloseSelector: '[data-member-menu-close]',
  });
  bindImageFallbacks(opts.container);

  return opts.container.querySelector<HTMLElement>('#shell-main')!;
}
