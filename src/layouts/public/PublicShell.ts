import { sessionStore } from '@/app/session-store';
import { canUserAccessBackoffice } from '@/app/route-guards';
import { renderLogoMark } from '@/shared/components/Logo';
import { bindSharedChrome, renderSharedFooter, renderSharedHeader, type TopNavKey } from '@/shared/components/SiteChrome';
import { bindImageFallbacks } from '@/shared/utils/dom';

export interface PublicShellOptions {
  container: HTMLElement;
  activeNav?: TopNavKey;
  variant?: 'default' | 'auth';
  contentHtml: string;
}

export function renderPublicShell(opts: PublicShellOptions): HTMLElement {
  const user = sessionStore.user;
  const workspaceHref = canUserAccessBackoffice(user) ? '/quan-tri' : '/ca-nhan';
  const workspaceLabel = canUserAccessBackoffice(user) ? 'Khu quản trị' : 'Không gian cá nhân';

  opts.container.innerHTML = `
    <div class="min-h-screen flex flex-col bg-background">
      ${renderSharedHeader({ activeTopNav: opts.activeNav, menuAriaLabel: 'Mở menu điều hướng' })}

      <!-- Ngăn kéo điều hướng di động -->
      <div data-public-drawer class="fixed inset-0 z-50 hidden lg:hidden">
        <div data-public-drawer-backdrop class="fixed inset-0 bg-on-surface/40 tl-backdrop-enter"></div>
        <aside class="relative w-72 max-w-[85vw] min-h-screen bg-surface border-r border-border p-6 flex flex-col justify-between gap-6 z-10 overflow-y-auto tl-drawer-left-enter">
          <div class="flex flex-col gap-4">
            <div class="flex items-center justify-between pb-4 border-b border-border">
              <div class="flex items-center gap-2.5">
                ${renderLogoMark(30)}
                <span class="font-headline text-headline-md text-on-surface">TripLoom</span>
              </div>
              <button type="button" data-public-menu-close aria-label="Đóng menu" class="w-10 h-10 inline-flex items-center justify-center rounded-full hover:bg-surface-muted">
                <span class="material-symbols-outlined text-[20px]" aria-hidden="true">close</span>
              </button>
            </div>

            <nav aria-label="Menu điều hướng di động" class="flex flex-col gap-1.5">
              <a href="/" class="min-h-[44px] px-3.5 rounded-lg flex items-center gap-3 font-label text-label-lg no-underline ${opts.activeNav === 'home' ? 'text-primary bg-primary-light' : 'text-on-surface hover:bg-surface-muted'}">
                <span class="material-symbols-outlined text-[20px]" aria-hidden="true">home</span>
                <span>Trang chủ</span>
              </a>
              <a href="/dia-diem" class="min-h-[44px] px-3.5 rounded-lg flex items-center gap-3 font-label text-label-lg no-underline ${opts.activeNav === 'explore' ? 'text-primary bg-primary-light' : 'text-on-surface hover:bg-surface-muted'}">
                <span class="material-symbols-outlined text-[20px]" aria-hidden="true">travel_explore</span>
                <span>Khám phá</span>
              </a>
              <a href="/lap-lich-trinh" class="min-h-[44px] px-3.5 rounded-lg flex items-center gap-3 font-label text-label-lg no-underline ${opts.activeNav === 'plan' ? 'text-primary bg-primary-light' : 'text-on-surface hover:bg-surface-muted'}">
                <span class="material-symbols-outlined text-[20px]" aria-hidden="true">auto_awesome</span>
                <span>Lập lịch trình</span>
              </a>
              <a href="/chat" class="min-h-[44px] px-3.5 rounded-lg flex items-center gap-3 font-label text-label-lg no-underline ${opts.activeNav === 'chat' ? 'text-primary bg-primary-light' : 'text-on-surface hover:bg-surface-muted'}">
                <span class="material-symbols-outlined text-[20px]" aria-hidden="true">forum</span>
                <span>Trợ lý AI</span>
              </a>
            </nav>
          </div>

          <div class="border-t border-border pt-4 flex flex-col gap-2.5">
            ${
              user
                ? `
                  <a href="${workspaceHref}" class="min-h-[44px] px-4 rounded-full bg-primary text-on-primary flex items-center justify-center font-label text-label-md no-underline">${workspaceLabel}</a>
                  <button type="button" data-site-logout class="min-h-[42px] px-4 rounded-full border border-border text-error flex items-center justify-center font-label text-label-md">Đăng xuất</button>
                `
                : `
                  <a href="/dang-nhap" class="min-h-[44px] px-4 rounded-full border border-border text-on-surface flex items-center justify-center font-label text-label-lg no-underline hover:bg-surface-muted">Đăng nhập</a>
                  <a href="/dang-ky" class="min-h-[44px] px-4 rounded-full bg-primary text-on-primary flex items-center justify-center font-label text-label-lg no-underline">Đăng ký</a>
                `
            }
          </div>
        </aside>
      </div>

      <main id="shell-main" class="flex-1 flex flex-col tl-page-enter">${opts.contentHtml}</main>
      ${renderSharedFooter()}
    </div>
  `;

  bindSharedChrome(opts.container, {
    drawerSelector: '[data-public-drawer]',
    drawerBackdropSelector: '[data-public-drawer-backdrop]',
    drawerCloseSelector: '[data-public-menu-close]',
  });
  bindImageFallbacks(opts.container);

  return opts.container.querySelector<HTMLElement>('#shell-main')!;
}
