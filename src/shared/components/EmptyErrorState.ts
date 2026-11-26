import { escapeHtml } from '@/shared/utils/dom';

export function renderLoadingSkeleton(cards = 3): string {
  const desktopCols = cards >= 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3';
  return `
    <div class="flex flex-col gap-space-4" aria-busy="true" aria-label="Đang tải dữ liệu">
      <div class="inline-flex items-center gap-space-2 self-start px-space-3 py-space-1 rounded-full bg-primary-light/75 text-primary font-label text-label-sm">
        <span class="material-symbols-outlined text-[16px] animate-spin" aria-hidden="true">progress_activity</span>
        <span>Đang tải thông tin...</span>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 ${desktopCols} gap-4">
        ${Array.from({ length: cards })
          .map(
            () => `
          <div class="bg-surface border border-border rounded-lg p-space-4 flex flex-col gap-space-3">
            <div class="tl-skeleton w-full aspect-[16/10]"></div>
            <div class="tl-skeleton h-5 w-3/4"></div>
            <div class="tl-skeleton h-4 w-1/2"></div>
            <div class="tl-skeleton h-11 w-full mt-space-2"></div>
          </div>
        `,
          )
          .join('')}
      </div>
    </div>
  `;
}

export function renderTableSkeleton(rows = 4): string {
  return `
    <div class="bg-surface border border-border rounded-lg p-space-6 flex flex-col gap-space-3" aria-busy="true" aria-label="Đang tải danh sách">
      <div class="inline-flex items-center gap-space-2 self-start px-space-3 py-space-1 rounded-full bg-primary-light/75 text-primary font-label text-label-sm mb-space-1">
        <span class="material-symbols-outlined text-[16px] animate-spin" aria-hidden="true">progress_activity</span>
        <span>Đang tải danh sách...</span>
      </div>
      ${Array.from({ length: rows })
        .map(() => `<div class="tl-skeleton h-11 w-full"></div>`)
        .join('')}
    </div>
  `;
}

export function renderEmptyState(options: {
  icon?: string;
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
  actionId?: string;
}): string {
  return `
    <div class="bg-surface border border-border rounded-lg p-space-8 text-center flex flex-col items-center gap-space-3">
      <div class="w-12 h-12 rounded-full bg-primary-light text-primary flex items-center justify-center">
        <span class="material-symbols-outlined text-[24px]" aria-hidden="true">${escapeHtml(options.icon ?? 'inbox')}</span>
      </div>
      <h2 class="font-headline text-headline-md text-on-surface">${escapeHtml(options.title)}</h2>
      <p class="font-body text-body-md text-text-secondary max-w-md">${escapeHtml(options.description)}</p>
      ${
        options.actionLabel && options.actionHref
          ? `<a href="${escapeHtml(options.actionHref)}" class="mt-space-2 inline-flex items-center justify-center min-h-[44px] px-space-6 rounded bg-primary text-on-primary hover:bg-primary-hover font-label text-label-md transition-colors">${escapeHtml(options.actionLabel)}</a>`
          : options.actionLabel && options.actionId
            ? `<button type="button" id="${escapeHtml(options.actionId)}" class="mt-space-2 inline-flex items-center justify-center min-h-[44px] px-space-6 rounded bg-primary text-on-primary hover:bg-primary-hover font-label text-label-md transition-colors">${escapeHtml(options.actionLabel)}</button>`
            : ''
      }
    </div>
  `;
}

export function renderErrorBanner(message: string, retryButtonId?: string): string {
  return `
    <div role="alert" class="bg-error-bg border border-error/30 text-on-error-bg rounded-lg p-space-4 flex flex-col sm:flex-row sm:items-center justify-between gap-space-3">
      <div class="flex items-start gap-space-3">
        <span class="material-symbols-outlined text-[22px] shrink-0 mt-0.5" aria-hidden="true">error</span>
        <div>
          <p class="font-label text-label-md">Không thể tải hoặc xử lý dữ liệu</p>
          <p class="font-body text-body-md mt-0.5">${escapeHtml(message)}</p>
        </div>
      </div>
      ${
        retryButtonId
          ? `<button type="button" id="${escapeHtml(retryButtonId)}" class="min-h-[44px] px-space-4 rounded bg-surface border border-error text-error hover:bg-error hover:text-on-error font-label text-label-md shrink-0 transition-colors">Thử lại</button>`
          : ''
      }
    </div>
  `;
}
