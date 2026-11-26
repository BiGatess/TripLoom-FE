import type { RouteContext } from '@/app/router';
import { sessionStore } from '@/app/session-store';
import { canUserAccessBackoffice } from '@/app/route-guards';
import { renderBackofficeShell } from '@/layouts/backoffice/BackofficeShell';
import { renderMemberShell } from '@/layouts/member/MemberShell';
import { renderPublicShell } from '@/layouts/public/PublicShell';
import { escapeHtml } from '@/shared/utils/dom';

export interface ErrorPageOptions {
  code: '401' | '403' | '404' | '500';
  title?: string;
  description?: string;
  retryHref?: string;
}

export function renderErrorPage(ctx: RouteContext, opts: ErrorPageOptions): void {
  const defaults: Record<ErrorPageOptions['code'], { icon: string; title: string; desc: string; tone: string }> = {
    '401': {
      icon: 'lock_clock',
      title: 'Phiên đăng nhập đã hết hạn',
      desc: 'Vui lòng đăng nhập lại để tiếp tục sử dụng không gian cá nhân hoặc vận hành.',
      tone: 'bg-warning-bg text-on-warning-bg',
    },
    '403': {
      icon: 'gpp_maybe',
      title: 'Bạn không có quyền truy cập mục này',
      desc: 'Tài khoản hiện tại không đủ quyền hoặc nội dung thuộc về một tài khoản khác.',
      tone: 'bg-error-bg text-on-error-bg',
    },
    '404': {
      icon: 'travel_explore',
      title: 'Không tìm thấy trang hoặc tài nguyên',
      desc: 'Đường dẫn không tồn tại, hoặc địa điểm/dịch vụ đã ngừng công khai trên hệ thống.',
      tone: 'bg-info-bg text-on-info-bg',
    },
    '500': {
      icon: 'cloud_off',
      title: 'Hệ thống đang tạm gián đoạn',
      desc: 'Không thể hoàn tất yêu cầu lúc này. Vui lòng thử lại sau ít phút.',
      tone: 'bg-error-bg text-on-error-bg',
    },
  };

  const preset = defaults[opts.code];
  const user = sessionStore.user;
  const isBackoffice = canUserAccessBackoffice(user);
  const primaryHref =
    opts.code === '401'
      ? ctx.path.startsWith('/quan-tri')
        ? `/quan-tri/dang-nhap?redirect=${encodeURIComponent(ctx.fullPath)}`
        : `/dang-nhap?redirect=${encodeURIComponent(ctx.fullPath)}`
      : isBackoffice
        ? '/quan-tri'
        : user
          ? '/ca-nhan'
          : '/';
  const primaryLabel =
    opts.code === '401'
      ? 'Đăng nhập ngay'
      : isBackoffice
        ? 'Về Tổng quan quản trị'
        : user
          ? 'Về Không gian cá nhân'
          : 'Về Trang chủ';

  const bodyHtml = `
    <section class="max-w-xl mx-auto my-space-8 bg-surface border border-border rounded-xl p-space-8 shadow-sm text-center flex flex-col items-center gap-space-4">
      <span class="w-16 h-16 rounded-full ${preset.tone} inline-flex items-center justify-center">
        <span class="material-symbols-outlined text-[32px]" aria-hidden="true">${preset.icon}</span>
      </span>
      <span class="px-space-3 py-space-1 rounded-full bg-surface-muted text-text-secondary font-label text-label-sm tabular-nums">Mã trạng thái ${escapeHtml(opts.code)}</span>
      <h1 class="font-headline text-headline-lg text-on-surface">${escapeHtml(opts.title ?? preset.title)}</h1>
      <p class="font-body text-body-lg text-text-secondary">${escapeHtml(opts.description ?? preset.desc)}</p>
      <div class="flex flex-wrap items-center justify-center gap-space-3 pt-space-2">
        <a href="${escapeHtml(primaryHref)}" class="inline-flex items-center justify-center min-h-[44px] px-space-6 rounded bg-primary text-on-primary hover:bg-primary-hover font-label text-label-md no-underline transition-colors">${escapeHtml(primaryLabel)}</a>
        ${
          isBackoffice
            ? ''
            : `<a href="/dia-diem" class="inline-flex items-center justify-center min-h-[44px] px-space-4 rounded bg-surface border border-border text-on-surface hover:bg-surface-muted font-label text-label-md no-underline transition-colors">Khám phá địa điểm</a>`
        }
      </div>
    </section>
  `;

  if (isBackoffice) {
    renderBackofficeShell({
      container: ctx.container,
      activeNav: 'overview',
      breadcrumbs: [{ label: 'Quản trị', href: '/quan-tri' }, { label: `Lỗi ${opts.code}` }],
      contentHtml: bodyHtml,
    });
  } else if (user) {
    renderMemberShell({
      container: ctx.container,
      activeNav: 'overview',
      contentHtml: bodyHtml,
    });
  } else {
    renderPublicShell({
      container: ctx.container,
      contentHtml: `<div class="max-w-[1200px] mx-auto w-full px-space-4">${bodyHtml}</div>`,
    });
  }
}
