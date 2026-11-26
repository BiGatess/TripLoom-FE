export function renderPagination(page: number, totalPages: number, totalItems: number): string {
  if (totalPages <= 1 && totalItems === 0) return '';
  const pages: number[] = [];
  for (let i = 1; i <= totalPages; i++) {
    pages.push(i);
  }

  return `
    <nav aria-label="Phân trang" class="flex flex-wrap items-center justify-between gap-space-4 pt-space-4 border-t border-border">
      <p class="font-body text-body-md text-text-secondary tabular-nums">
        Hiển thị trang <strong class="text-on-surface">${page}</strong> / ${totalPages} (${totalItems} mục)
      </p>
      <div class="flex items-center gap-space-2">
        <button type="button" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''} class="min-h-[44px] px-space-3 rounded border border-border bg-surface text-on-surface hover:bg-surface-muted disabled:opacity-40 disabled:cursor-not-allowed font-label text-label-md inline-flex items-center gap-space-1">
          <span class="material-symbols-outlined text-[18px]" aria-hidden="true">chevron_left</span>
          <span>Trước</span>
        </button>
        ${pages
          .map(
            (p) => `<button type="button" data-page="${p}" aria-current="${p === page ? 'page' : 'false'}" class="min-w-[44px] min-h-[44px] px-space-3 rounded font-label text-label-md tabular-nums ${
              p === page
                ? 'bg-primary text-on-primary'
                : 'border border-border bg-surface text-on-surface hover:bg-surface-muted'
            }">${p}</button>`,
          )
          .join('')}
        <button type="button" data-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''} class="min-h-[44px] px-space-3 rounded border border-border bg-surface text-on-surface hover:bg-surface-muted disabled:opacity-40 disabled:cursor-not-allowed font-label text-label-md inline-flex items-center gap-space-1">
          <span>Sau</span>
          <span class="material-symbols-outlined text-[18px]" aria-hidden="true">chevron_right</span>
        </button>
      </div>
    </nav>
  `;
}
