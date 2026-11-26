import type { Destination } from '@/api/contracts';
import { escapeHtml } from '@/shared/utils/dom';
import { formatVnd } from '@/shared/utils/format';

export interface DestinationCardOptions {
  destination: Destination;
  showFavoriteButton?: boolean;
  matchReasons?: string[];
  estimatedGroupCostVnd?: number | null;
  partySize?: number;
  unavailableMode?: boolean;
  returnQuery?: string;
}

interface CategoryBadgeStyle {
  icon: string;
  overlayClass: string;
  inlineClass: string;
}

const CATEGORY_STYLE_BY_ID: Record<string, CategoryBadgeStyle> = {
  CAT01: {
    icon: 'temple_buddhist',
    overlayClass: 'bg-amber-700/95 text-white border-white/80',
    inlineClass: 'bg-amber-700 text-white border-amber-800/20',
  },
  CAT02: {
    icon: 'beach_access',
    overlayClass: 'bg-sky-700/95 text-white border-white/80',
    inlineClass: 'bg-sky-700 text-white border-sky-800/20',
  },
  CAT03: {
    icon: 'landscape',
    overlayClass: 'bg-emerald-700/95 text-white border-white/80',
    inlineClass: 'bg-emerald-700 text-white border-emerald-800/20',
  },
  CAT04: {
    icon: 'palette',
    overlayClass: 'bg-rose-600/95 text-white border-white/80',
    inlineClass: 'bg-rose-600 text-white border-rose-700/20',
  },
};

const DEFAULT_CATEGORY_STYLE: CategoryBadgeStyle = {
  icon: 'sell',
  overlayClass: 'bg-primary/95 text-white border-white/80',
  inlineClass: 'bg-primary text-white border-primary/20',
};

function resolveCategoryBadgeStyle(categoryId: string, categoryName: string): CategoryBadgeStyle {
  const byId = CATEGORY_STYLE_BY_ID[categoryId];
  if (byId) return byId;
  const lower = categoryName.toLowerCase();
  if (lower.includes('biển') || lower.includes('nghỉ dưỡng')) return CATEGORY_STYLE_BY_ID.CAT02 ?? DEFAULT_CATEGORY_STYLE;
  if (lower.includes('phố cổ') || lower.includes('văn hóa') || lower.includes('di sản')) {
    return CATEGORY_STYLE_BY_ID.CAT01 ?? DEFAULT_CATEGORY_STYLE;
  }
  if (lower.includes('thiên nhiên') || lower.includes('núi') || lower.includes('rừng')) {
    return CATEGORY_STYLE_BY_ID.CAT03 ?? DEFAULT_CATEGORY_STYLE;
  }
  if (lower.includes('làng nghề') || lower.includes('ẩm thực')) return CATEGORY_STYLE_BY_ID.CAT04 ?? DEFAULT_CATEGORY_STYLE;
  return DEFAULT_CATEGORY_STYLE;
}

export function renderCategoryBadge(
  categoryId: string,
  categoryName: string,
  variant: 'overlay' | 'inline' = 'overlay',
): string {
  const style = resolveCategoryBadgeStyle(categoryId, categoryName);
  const baseClass =
    variant === 'overlay'
      ? `pointer-events-none absolute top-2.5 left-2.5 z-[5] inline-flex items-center gap-1 px-2.5 py-1 rounded-full border shadow-md backdrop-blur-md font-label text-[11px] leading-tight font-semibold ${style.overlayClass}`
      : `inline-flex items-center gap-1.5 px-space-3 py-1 rounded-full border shadow-sm font-label text-label-sm font-semibold ${style.inlineClass}`;

  return `<span class="${baseClass}"><span class="material-symbols-outlined ${variant === 'overlay' ? 'text-[13px]' : 'text-[15px]'} leading-none" aria-hidden="true">${style.icon}</span><span>${escapeHtml(categoryName)}</span></span>`;
}

export function renderDestinationCard(opts: DestinationCardOptions): string {
  const { destination: d } = opts;
  const detailHref = opts.returnQuery
    ? `/dia-diem/${encodeURIComponent(d.id)}?from=${encodeURIComponent(opts.returnQuery)}`
    : `/dia-diem/${encodeURIComponent(d.id)}`;

  const costText =
    d.estimatedCostVnd === null
      ? 'Chưa có thông tin giá'
      : d.estimatedCostVnd === 0
        ? '0đ (Miễn phí)'
        : `${formatVnd(d.estimatedCostVnd)}/người/lượt`;

  return `
    <article class="h-full bg-surface border border-border rounded-lg shadow-sm overflow-hidden flex flex-col justify-between transition-shadow hover:shadow-md">
      <div>
        <div class="relative aspect-[16/9] bg-surface-muted overflow-hidden">
          ${
            opts.unavailableMode
              ? `<img
                  src="${escapeHtml(d.imageUrl)}"
                  alt="${escapeHtml(d.name)}"
                  data-fallback-label="${escapeHtml(d.name)}"
                  loading="lazy"
                  class="w-full h-full object-cover grayscale opacity-65"
                />`
              : `<a href="${escapeHtml(detailHref)}" aria-label="Xem chi tiết ${escapeHtml(d.name)}" class="group block w-full h-full no-underline">
                  <img
                    src="${escapeHtml(d.imageUrl)}"
                    alt="${escapeHtml(d.name)}"
                    data-fallback-label="${escapeHtml(d.name)}"
                    loading="lazy"
                    class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                </a>`
          }
          ${renderCategoryBadge(d.categoryId, d.categoryName, 'overlay')}
          ${
            opts.showFavoriteButton
              ? `<button
                  type="button"
                  data-fav-toggle="${escapeHtml(d.id)}"
                  data-fav-name="${escapeHtml(d.name)}"
                  data-fav-active="${d.isFavorite ? '1' : '0'}"
                  aria-pressed="${d.isFavorite ? 'true' : 'false'}"
                  aria-label="${d.isFavorite ? `Bỏ yêu thích ${escapeHtml(d.name)}` : `Thêm yêu thích ${escapeHtml(d.name)}`}"
                  class="absolute top-2.5 right-2.5 z-10 w-9 h-9 rounded-full bg-surface/95 border border-border inline-flex items-center justify-center ${
                    d.isFavorite ? 'text-error' : 'text-text-secondary hover:text-error'
                  } shadow-sm transition-colors disabled:opacity-60"
                >
                  <span class="material-symbols-outlined text-[18px] ${d.isFavorite ? 'icon-filled' : ''}" aria-hidden="true">favorite</span>
                </button>`
              : ''
          }
        </div>
        <div class="p-3 flex flex-col gap-1.5">
          <div class="flex items-center justify-between gap-space-2 text-[12px] text-text-secondary">
            <span class="inline-flex items-center gap-1">
              <span class="material-symbols-outlined text-[14px] text-primary" aria-hidden="true">location_on</span>
              ${escapeHtml(d.region)}
            </span>
            <span class="font-label text-[11px] text-text-secondary tabular-nums">${escapeHtml(d.id)}</span>
          </div>
          <h3 class="font-title text-[15px] leading-[21px] font-semibold text-on-surface line-clamp-1">
            ${
              opts.unavailableMode
                ? escapeHtml(d.name)
                : `<a href="${escapeHtml(detailHref)}" class="text-on-surface hover:text-primary no-underline transition-colors">${escapeHtml(d.name)}</a>`
            }
          </h3>
          ${
            opts.unavailableMode
              ? `<p class="font-label text-[11px] text-on-warning-bg bg-warning-bg px-2.5 py-0.5 rounded-full self-start">Không còn khả dụng</p>`
              : `<p class="font-body text-[13px] leading-[18px] text-text-secondary line-clamp-2">${escapeHtml(d.description)}</p>`
          }
          ${
            opts.matchReasons && opts.matchReasons.length > 0
              ? `<ul class="flex flex-wrap gap-1 pt-0.5">
                  ${opts.matchReasons
                    .map(
                      (reason) =>
                        `<li class="px-2 py-0.5 rounded-full bg-primary-light text-primary font-label text-[11px]">${escapeHtml(reason)}</li>`,
                    )
                    .join('')}
                </ul>`
              : ''
          }
        </div>
      </div>

      <div class="px-3 pb-3 pt-2 border-t border-border flex flex-col gap-2">
        <div class="flex items-center justify-between gap-space-2">
          <div class="flex flex-col min-w-0">
            <span class="font-label text-[11px] text-text-secondary">Giá</span>
            <span class="font-label text-[13px] font-semibold text-primary tabular-nums truncate">${escapeHtml(costText)}</span>
          </div>
          ${
            d.averageRating !== null
              ? `<span class="inline-flex items-center gap-1 font-label text-[12px] text-on-surface tabular-nums shrink-0 whitespace-nowrap">
                  <span class="material-symbols-outlined text-[15px] text-warning icon-filled" aria-hidden="true">star</span>
                  ${d.averageRating} (${d.publishedReviewCount})
                </span>`
              : `<span class="inline-flex items-center gap-1 font-label text-[12px] text-text-secondary tabular-nums shrink-0 whitespace-nowrap" aria-label="0 sao (0 đánh giá)">
                  <span class="material-symbols-outlined text-[15px] text-border" aria-hidden="true">star</span>
                  0 (0)
                </span>`
          }
        </div>
        ${
          opts.partySize && opts.estimatedGroupCostVnd !== undefined
            ? `<p class="font-body text-[12px] text-text-secondary tabular-nums">
                Ước tính đoàn ${opts.partySize} khách: <strong class="text-on-surface">${
                  opts.estimatedGroupCostVnd === null ? 'Chưa có thông tin giá' : formatVnd(opts.estimatedGroupCostVnd)
                }</strong>
              </p>`
            : ''
        }
        ${
          opts.unavailableMode
            ? `<button type="button" data-fav-remove-only="${escapeHtml(d.id)}" class="w-full min-h-[38px] px-3 rounded-md border border-error text-error hover:bg-error-bg font-label text-[13px] transition-colors">Bỏ khỏi danh sách</button>`
            : `<a href="${escapeHtml(detailHref)}" class="w-full min-h-[38px] px-3 rounded-md bg-primary-light text-primary hover:bg-primary hover:text-on-primary font-label text-[13px] inline-flex items-center justify-center gap-1.5 no-underline transition-colors">
                <span>Xem chi tiết</span>
                <span class="material-symbols-outlined text-[16px]" aria-hidden="true">arrow_forward</span>
              </a>`
        }
      </div>
    </article>
  `;
}
