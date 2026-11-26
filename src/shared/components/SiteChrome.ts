import { canUserAccessBackoffice } from '@/app/route-guards';
import { router } from '@/app/router';
import { sessionStore } from '@/app/session-store';
import { authService } from '@/features/auth/auth.service';
import { renderLogoMark } from '@/shared/components/Logo';
import { openConfirmModal } from '@/shared/components/Modal';
import { showToast } from '@/shared/components/Toast';
import { escapeHtml } from '@/shared/utils/dom';

export type TopNavKey = 'home' | 'explore' | 'plan' | 'chat';

export interface SharedHeaderOptions {
  activeTopNav?: TopNavKey;
  menuAriaLabel?: string;
  hideMobileMenuButton?: boolean;
}

const SOCIAL_LINKS: Array<{ label: string; svg: string }> = [
  {
    label: 'Facebook',
    svg: `<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c5.05-.5 9-4.76 9-9.95z"/></svg>`,
  },
  {
    label: 'Instagram',
    svg: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>`,
  },
  {
    label: 'TikTok',
    svg: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.29 0 .58.04.86.13V9.4a6.33 6.33 0 0 0-1-.08A6.34 6.34 0 0 0 3 15.66a6.34 6.34 0 0 0 10.86 4.49c1.22-1.2 1.91-2.84 1.91-4.55V8.76a8.18 8.18 0 0 0 4.77 1.52V6.84a4.85 4.85 0 0 1-.95-.15z"/></svg>`,
  },
  {
    label: 'YouTube',
    svg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21.58 7.19a2.51 2.51 0 0 0-1.77-1.77C18.25 5 12 5 12 5s-6.25 0-7.81.42a2.51 2.51 0 0 0-1.77 1.77C2 8.75 2 12 2 12s0 3.25.42 4.81a2.51 2.51 0 0 0 1.77 1.77C5.75 19 12 19 12 19s6.25 0 7.81-.42a2.51 2.51 0 0 0 1.77-1.77C22 15.25 22 12 22 12s0-3.25-.42-4.81zM10 15V9l5.2 3-5.2 3z"/></svg>`,
  },
];

export function renderSharedHeader(opts: SharedHeaderOptions = {}): string {
  const user = sessionStore.user;
  const isBackofficeUser = canUserAccessBackoffice(user);
  const workspaceHref = isBackofficeUser ? '/quan-tri' : '/ca-nhan';

  const navItemClass = (active: boolean) =>
    active
      ? 'inline-flex items-center justify-center min-h-[40px] px-4 rounded-full font-label text-label-md text-primary bg-primary-light whitespace-nowrap shrink-0 no-underline'
      : 'inline-flex items-center justify-center min-h-[40px] px-4 rounded-full font-label text-label-md text-on-surface hover:text-primary hover:bg-surface-muted transition-colors whitespace-nowrap shrink-0 no-underline';

  return `
    <header class="sticky top-0 z-30 h-[74px] bg-surface/95 backdrop-blur-md border-b border-border shadow-sm shrink-0">
      <div class="max-w-[1280px] h-full mx-auto px-4 md:px-6 flex items-center justify-between gap-6">
        <div class="flex items-center gap-3 shrink-0">
          ${
            opts.hideMobileMenuButton
              ? ''
              : `<button type="button" data-site-menu-open aria-expanded="false" aria-label="${escapeHtml(opts.menuAriaLabel ?? 'Mở menu điều hướng')}" class="lg:hidden inline-flex items-center justify-center w-10 h-10 rounded-full border border-border text-on-surface hover:bg-surface-muted">
                   <span class="material-symbols-outlined text-[22px]" aria-hidden="true">menu</span>
                 </button>`
          }
          <a href="/" class="flex items-center gap-3 min-h-[44px] rounded no-underline focus-visible:ring-2 focus-visible:ring-primary">
            ${renderLogoMark(36)}
            <span class="font-headline text-headline-md text-on-surface">TripLoom</span>
          </a>
        </div>

        <nav aria-label="Điều hướng chính" class="hidden lg:flex items-center gap-2">
          <a href="/" class="${navItemClass(opts.activeTopNav === 'home')}">Trang chủ</a>
          <a href="/dia-diem" class="${navItemClass(opts.activeTopNav === 'explore')}">Khám phá</a>
          <a href="/lap-lich-trinh" class="${navItemClass(opts.activeTopNav === 'plan')}">Lập lịch trình</a>
          <a href="/chat" class="${navItemClass(opts.activeTopNav === 'chat')}">Trợ lý AI</a>
        </nav>

        <div class="hidden lg:flex items-center gap-3 shrink-0">
          ${
            user
              ? `
                <a href="/yeu-thich" aria-label="Địa điểm yêu thích" title="Địa điểm yêu thích" class="w-10 h-10 inline-flex items-center justify-center rounded-full border border-border text-text-secondary hover:text-error hover:border-error/30 hover:bg-error-bg/30 no-underline transition-colors">
                  <span class="material-symbols-outlined text-[20px]" aria-hidden="true">favorite</span>
                </a>
                <a href="${workspaceHref}" class="inline-flex items-center gap-2 min-h-[40px] pl-1.5 pr-3.5 rounded-full border border-border bg-surface hover:border-primary/40 hover:bg-primary-light/50 no-underline transition-colors whitespace-nowrap">
                  ${
                    user.avatarUrl
                      ? `<img src="${escapeHtml(user.avatarUrl)}" alt="${escapeHtml(user.fullName)}" data-fallback-label="${escapeHtml(user.displayName)}" class="w-7 h-7 rounded-full object-cover border border-border" />`
                      : `<span class="w-7 h-7 rounded-full bg-primary text-on-primary font-label text-label-sm inline-flex items-center justify-center">${escapeHtml(user.displayName.slice(0, 1).toUpperCase())}</span>`
                  }
                  <div class="text-left leading-tight">
                    <p class="font-label text-label-sm text-on-surface max-w-[140px] truncate">${escapeHtml(user.displayName)}</p>
                    ${isBackofficeUser ? `<p class="font-body text-[11px] text-primary">Khu quản trị</p>` : ''}
                  </div>
                </a>
                <button type="button" data-site-logout aria-label="Đăng xuất" title="Đăng xuất" class="w-10 h-10 inline-flex items-center justify-center rounded-full border border-border text-text-secondary hover:text-error hover:bg-error-bg/40 transition-colors">
                  <span class="material-symbols-outlined text-[19px]" aria-hidden="true">logout</span>
                </button>
              `
              : `
                <a href="/dang-nhap" class="inline-flex items-center justify-center min-h-[40px] px-4 rounded-full font-label text-label-md text-on-surface hover:text-primary hover:bg-surface-muted no-underline transition-colors whitespace-nowrap">Đăng nhập</a>
                <a href="/dang-ky" class="inline-flex items-center justify-center min-h-[40px] px-5 rounded-full bg-primary text-on-primary hover:bg-primary-hover shadow-sm font-label text-label-md no-underline transition-colors whitespace-nowrap">Đăng ký</a>
              `
          }
        </div>

        <div class="flex lg:hidden items-center gap-2">
          ${
            user
              ? `<a href="${workspaceHref}" class="inline-flex items-center gap-2 py-1 px-2.5 rounded-full border border-border bg-surface no-underline">
                   <span class="w-7 h-7 rounded-full bg-primary text-on-primary font-label text-label-sm inline-flex items-center justify-center">${escapeHtml(user.displayName.slice(0, 1).toUpperCase())}</span>
                   <span class="font-label text-label-sm text-on-surface max-w-[90px] truncate">${escapeHtml(user.displayName)}</span>
                 </a>`
              : `<a href="/dang-nhap" class="inline-flex items-center justify-center min-h-[36px] px-3.5 rounded-full bg-primary text-on-primary font-label text-label-sm no-underline">Đăng nhập</a>`
          }
        </div>
      </div>
    </header>
  `;
}

export function renderSharedFooter(): string {
  const socialButtonsHtml = SOCIAL_LINKS.map(
    (s) => `
      <button
        type="button"
        data-social-link="${s.label}"
        aria-label="TripLoom trên ${s.label}"
        title="${s.label}"
        class="w-9 h-9 rounded-full border border-border bg-background text-text-secondary hover:bg-primary hover:text-on-primary hover:border-primary inline-flex items-center justify-center transition-colors"
      >
        ${s.svg}
      </button>
    `,
  ).join('');

  return `
    <footer class="bg-surface border-t border-border text-on-surface shrink-0">
      <div class="max-w-[1280px] mx-auto px-4 md:px-6 py-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-8">
        <!-- Cột 1: Thương hiệu + Mạng xã hội -->
        <div class="lg:col-span-4 flex flex-col gap-3.5">
          <a href="/" class="inline-flex items-center gap-3 self-start no-underline">
            ${renderLogoMark(34)}
            <span class="font-headline text-headline-md text-on-surface">TripLoom</span>
          </a>
          <p class="font-body text-body-md text-text-secondary max-w-xs leading-relaxed">
            Kết nối trải nghiệm, dệt nên hành trình du lịch Việt Nam cá nhân hóa cùng AI.
          </p>
          <div class="flex items-center gap-2.5 pt-1" aria-label="Kênh mạng xã hội TripLoom">
            ${socialButtonsHtml}
          </div>
        </div>

        <!-- Cột 2: Khám phá -->
        <div class="lg:col-span-3 flex flex-col gap-2.5">
          <h3 class="font-label text-label-lg text-on-surface">Khám phá</h3>
          <ul class="flex flex-col gap-2 font-body text-body-md">
            <li><a href="/dia-diem?region=%C4%90%C3%A0%20N%E1%BA%B5ng" class="text-text-secondary hover:text-primary no-underline transition-colors">Điểm đến Đà Nẵng</a></li>
            <li><a href="/dia-diem?region=H%E1%BB%99i%20An" class="text-text-secondary hover:text-primary no-underline transition-colors">Phố cổ Hội An</a></li>
            <li><a href="/dia-diem?category=CAT02" class="text-text-secondary hover:text-primary no-underline transition-colors">Biển &amp; Nghỉ dưỡng</a></li>
            <li><a href="/dia-diem?category=CAT01" class="text-text-secondary hover:text-primary no-underline transition-colors">Văn hóa &amp; Di sản</a></li>
          </ul>
        </div>

        <!-- Cột 3: Tiện ích -->
        <div class="lg:col-span-2 flex flex-col gap-2.5">
          <h3 class="font-label text-label-lg text-on-surface">Tiện ích</h3>
          <ul class="flex flex-col gap-2 font-body text-body-md">
            <li><a href="/lap-lich-trinh" class="text-text-secondary hover:text-primary no-underline transition-colors">Lập lịch trình AI</a></li>
            <li><a href="/chat" class="text-text-secondary hover:text-primary no-underline transition-colors">Trợ lý AI</a></li>
            <li><a href="/lich-trinh-cua-toi" class="text-text-secondary hover:text-primary no-underline transition-colors">Lịch trình đã lưu</a></li>
            <li><a href="/don-dich-vu" class="text-text-secondary hover:text-primary no-underline transition-colors">Đơn dịch vụ</a></li>
          </ul>
        </div>

        <!-- Cột 4: Liên hệ -->
        <div class="lg:col-span-3 flex flex-col gap-2.5">
          <h3 class="font-label text-label-lg text-on-surface">Liên hệ</h3>
          <ul class="flex flex-col gap-2 font-body text-body-md text-text-secondary">
            <li class="flex items-center gap-2">
              <span class="material-symbols-outlined text-[18px] text-primary shrink-0" aria-hidden="true">location_on</span>
              <span>Ngũ Hành Sơn, TP. Đà Nẵng</span>
            </li>
            <li class="flex items-center gap-2 tabular-nums">
              <span class="material-symbols-outlined text-[18px] text-primary shrink-0" aria-hidden="true">call</span>
              <span>1900 6868 (08:00 – 21:00)</span>
            </li>
            <li class="flex items-center gap-2">
              <span class="material-symbols-outlined text-[18px] text-primary shrink-0" aria-hidden="true">mail</span>
              <span>hotro@triploom.vn</span>
            </li>
          </ul>
        </div>
      </div>

      <div class="border-t border-border bg-background/60">
        <div class="max-w-[1280px] mx-auto px-4 md:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 font-body text-label-sm text-text-secondary">
          <p>© 2026 TripLoom. Kết nối trải nghiệm, dệt nên hành trình.</p>
          <div class="flex items-center gap-3 tabular-nums">
            <span>VND (₫) · GMT+7</span>
            <span class="text-border">|</span>
            <a href="/quan-tri/dang-nhap" class="hover:text-primary no-underline">Cổng Quản trị</a>
          </div>
        </div>
      </div>
    </footer>

    <!-- Cụm nút nổi nhanh bên phải: Lên đầu trang & Trợ lý AI -->
    <div class="tl-fab-dock" aria-label="Tác vụ nhanh">
      <button
        type="button"
        data-back-to-top
        aria-label="Lên đầu trang"
        title="Lên đầu trang"
        class="tl-fab-scroll-top"
      >
        <span class="material-symbols-outlined text-[20px]" aria-hidden="true">arrow_upward</span>
      </button>
      ${
        typeof window !== 'undefined' && window.location.pathname.startsWith('/chat')
          ? ''
          : `<a
               href="/chat"
               aria-label="Mở nhanh Trợ lý AI"
               title="Trò chuyện cùng Trợ lý AI"
               class="tl-fab-ai"
             >
               <span class="material-symbols-outlined text-[20px]" aria-hidden="true">auto_awesome</span>
               <span class="tl-fab-ai-label">Trợ lý AI</span>
             </a>`
      }
    </div>
  `;
}

let globalScrollBound = false;

function syncBackToTopVisibility(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const shouldShow = window.scrollY > 220;
  document.querySelectorAll<HTMLElement>('[data-back-to-top]').forEach((btn) => {
    btn.classList.toggle('is-visible', shouldShow);
  });
}

export function bindSharedChrome(
  container: HTMLElement,
  options?: {
    drawerSelector?: string;
    drawerBackdropSelector?: string;
    drawerCloseSelector?: string;
  },
): void {
  const openBtn = container.querySelector<HTMLButtonElement>('[data-site-menu-open]');
  const drawer = options?.drawerSelector ? container.querySelector<HTMLElement>(options.drawerSelector) : null;
  const closeBtn = options?.drawerCloseSelector
    ? container.querySelector<HTMLButtonElement>(options.drawerCloseSelector)
    : null;
  const backdrop = options?.drawerBackdropSelector ? container.querySelector(options.drawerBackdropSelector) : null;

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
  backdrop?.addEventListener('click', closeDrawer);
  drawer?.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeDrawer();
    }
  });

  container.querySelectorAll<HTMLButtonElement>('[data-social-link]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const name = btn.dataset.socialLink ?? 'mạng xã hội';
      showToast(`Kênh ${name} chính thức của TripLoom đang trong chế độ trình diễn.`, 'info');
    });
  });

  container.querySelectorAll<HTMLButtonElement>('[data-back-to-top]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
      window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
    });
  });

  if (typeof window !== 'undefined' && !globalScrollBound) {
    globalScrollBound = true;
    window.addEventListener('scroll', syncBackToTopVisibility, { passive: true });
  }
  syncBackToTopVisibility();

  container.querySelectorAll('[data-site-logout]').forEach((btn) => {
    btn.addEventListener('click', () => {
      openConfirmModal({
        title: 'Đăng xuất khỏi TripLoom?',
        description: 'Phiên làm việc hiện tại sẽ kết thúc và bạn sẽ quay về trang chủ công khai.',
        confirmLabel: 'Đăng xuất',
        onConfirm: async () => {
          await authService.logout();
          sessionStore.clear();
          showToast('Bạn đã đăng xuất thành công.', 'info');
          router.navigate('/');
        },
      });
    });
  });
}
