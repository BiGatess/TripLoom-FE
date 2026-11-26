import type { RouteContext } from '@/app/router';
import { sessionStore } from '@/app/session-store';
import { toUserErrorMessage } from '@/api/errors';
import type { Category } from '@/api/contracts';
import { REGIONS } from '@/config/constants';
import { destinationsService } from '@/features/destinations/destinations.service';
import { favoritesService } from '@/features/favorites/favorites.service';
import { renderPublicShell } from '@/layouts/public/PublicShell';
import { renderDestinationCard } from '@/shared/components/DestinationCard';
import { renderEmptyState, renderErrorBanner, renderLoadingSkeleton } from '@/shared/components/EmptyErrorState';
import { renderPagination } from '@/shared/components/Pagination';
import { showToast } from '@/shared/components/Toast';
import { beginAsyncRender, bindImageFallbacks, escapeHtml, finishAsyncRender } from '@/shared/utils/dom';

export async function renderDestinationSearchPage(ctx: RouteContext): Promise<void> {
  let queryText = ctx.query.get('q') ?? '';
  let selectedRegion = ctx.query.get('region') ?? '';
  let selectedCategory = ctx.query.get('category') ?? ctx.query.get('cat') ?? '';
  let currentPage = Math.max(1, Number(ctx.query.get('page') ?? '1') || 1);
  let categories: Category[] = [];

  const main = renderPublicShell({
    container: ctx.container,
    activeNav: 'explore',
    contentHtml: `
      <div class="max-w-[1360px] w-full mx-auto px-4 md:px-6 py-space-6 flex flex-col gap-space-6">
        <div class="flex flex-col lg:flex-row lg:items-end justify-between gap-space-4 pb-space-4 border-b border-border">
          <div>
            <h1 class="font-headline text-headline-lg text-on-surface">Khám phá địa điểm</h1>
            <p class="font-body text-body-md text-text-secondary">Tìm kiếm địa điểm du lịch từ danh mục nội bộ theo tên, khu vực và danh mục.</p>
          </div>
          <div class="flex flex-wrap items-center justify-between lg:justify-end gap-space-3">
            <div id="activeChips" class="flex flex-wrap items-center gap-space-2"></div>
            <p id="resultCountText" class="font-body text-body-md text-text-secondary whitespace-nowrap"></p>
            <button type="button" id="mobileFilterToggle" class="lg:hidden inline-flex items-center justify-center gap-space-2 min-h-[44px] px-space-4 rounded-xl border border-border bg-surface text-on-surface font-label text-label-md">
              <span class="material-symbols-outlined text-[20px]" aria-hidden="true">tune</span>
              <span>Bộ lọc</span>
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)] gap-5 items-start">
          <!-- Sidebar Filter (Desktop) / Collapsible Panel (Mobile) -->
          <aside id="filterSidebar" class="hidden lg:block bg-surface border border-border rounded-xl p-space-4 shadow-sm">
            <form id="filterForm" class="flex flex-col gap-space-4">
              <div class="flex items-center justify-between">
                <h2 class="font-headline text-headline-md text-on-surface">Bộ lọc</h2>
                <button type="button" id="clearFiltersBtn" class="font-label text-label-sm text-primary hover:underline">Xóa bộ lọc</button>
              </div>

              <label class="flex flex-col gap-space-1">
                <span class="font-label text-label-md text-on-surface">Tìm theo tên</span>
                <input id="filterQueryInput" type="search" value="${escapeHtml(queryText)}" placeholder="Tên địa điểm..." class="w-full min-h-[44px] px-space-3 rounded-xl border border-border bg-surface text-body-md focus:border-primary focus:ring-2 focus:ring-primary/20" />
              </label>

              <label class="flex flex-col gap-space-1">
                <span class="font-label text-label-md text-on-surface">Khu vực</span>
                <select id="filterRegionSelect" class="w-full min-h-[44px] px-space-3 rounded-xl border border-border bg-surface text-body-md focus:border-primary focus:ring-2 focus:ring-primary/20">
                  <option value="">Tất cả khu vực</option>
                  ${REGIONS.map(
                    (r) =>
                      `<option value="${escapeHtml(r)}" ${selectedRegion === r ? 'selected' : ''}>${escapeHtml(r)}</option>`,
                  ).join('')}
                </select>
              </label>

              <label class="flex flex-col gap-space-1">
                <span class="font-label text-label-md text-on-surface">Danh mục</span>
                <select id="filterCategorySelect" class="w-full min-h-[44px] px-space-3 rounded-xl border border-border bg-surface text-body-md focus:border-primary focus:ring-2 focus:ring-primary/20">
                  <option value="">Tất cả danh mục</option>
                  ${categories
                    .map(
                      (c) =>
                        `<option value="${escapeHtml(c.id)}" ${selectedCategory === c.id || selectedCategory === c.slug ? 'selected' : ''}>${escapeHtml(c.name)}</option>`,
                    )
                    .join('')}
                </select>
              </label>

              <button type="submit" class="w-full min-h-[44px] px-space-4 rounded-xl bg-primary text-on-primary hover:bg-primary-hover font-label text-label-md transition-colors">
                Áp dụng bộ lọc
              </button>
            </form>
          </aside>

          <!-- Results Area (nằm thẳng hàng ngang ngay mép trên cùng Bộ lọc) -->
          <section class="flex flex-col gap-space-4 min-w-0">
            <div id="searchResults">${renderLoadingSkeleton(8)}</div>
            <div id="searchPagination"></div>
          </section>
        </div>
      </div>
    `,
  });

  const filterSidebar = main.querySelector<HTMLElement>('#filterSidebar');
  main.querySelector('#mobileFilterToggle')?.addEventListener('click', () => {
    filterSidebar?.classList.toggle('hidden');
  });

  const buildCurrentQueryString = () => {
    const p = new URLSearchParams();
    if (queryText) p.set('q', queryText);
    if (selectedRegion) p.set('region', selectedRegion);
    if (selectedCategory) p.set('category', selectedCategory);
    if (currentPage > 1) p.set('page', String(currentPage));
    return p.toString();
  };

  const syncUrl = () => {
    const qs = buildCurrentQueryString();
    window.history.replaceState({}, '', qs ? `/dia-diem?${qs}` : '/dia-diem');
  };

  const renderChips = () => {
    const chipsEl = main.querySelector<HTMLElement>('#activeChips');
    if (!chipsEl) return;
    const chips: Array<{ label: string; key: string }> = [];
    if (queryText) chips.push({ label: `Từ khóa: "${queryText}"`, key: 'q' });
    if (selectedRegion) chips.push({ label: `Khu vực: ${selectedRegion}`, key: 'region' });
    if (selectedCategory) {
      const cat = categories.find((c) => c.id === selectedCategory || c.slug === selectedCategory);
      chips.push({ label: `Danh mục: ${cat?.name ?? selectedCategory}`, key: 'category' });
    }
    chipsEl.innerHTML = chips
      .map(
        (ch) => `
        <button type="button" data-remove-chip="${ch.key}" class="inline-flex items-center gap-1 px-space-3 py-space-1 rounded-full bg-primary-light text-primary font-label text-label-sm hover:bg-primary hover:text-on-primary transition-colors">
          <span>${escapeHtml(ch.label)}</span>
          <span class="material-symbols-outlined text-[16px]" aria-hidden="true">close</span>
        </button>
      `,
      )
      .join('');

    chipsEl.querySelectorAll<HTMLButtonElement>('[data-remove-chip]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.removeChip;
        if (key === 'q') {
          queryText = '';
          const inp = main.querySelector<HTMLInputElement>('#filterQueryInput');
          if (inp) inp.value = '';
        } else if (key === 'region') {
          selectedRegion = '';
          const sel = main.querySelector<HTMLSelectElement>('#filterRegionSelect');
          if (sel) {
            sel.value = '';
            sel.dispatchEvent(new Event('tl:sync'));
          }
        } else if (key === 'category') {
          selectedCategory = '';
          const sel = main.querySelector<HTMLSelectElement>('#filterCategorySelect');
          if (sel) {
            sel.value = '';
            sel.dispatchEvent(new Event('tl:sync'));
          }
        }
        currentPage = 1;
        syncUrl();
        void loadResults();
      });
    });
  };

  const loadResults = async () => {
    const resultsEl = main.querySelector<HTMLElement>('#searchResults');
    const pagEl = main.querySelector<HTMLElement>('#searchPagination');
    const countEl = main.querySelector<HTMLElement>('#resultCountText');
    if (!resultsEl || !pagEl || !countEl) return;

    renderChips();
    beginAsyncRender(resultsEl, renderLoadingSkeleton(8));
    pagEl.innerHTML = '';

    try {
      const res = await destinationsService.listDestinations({
        query: queryText,
        region: selectedRegion || undefined,
        categoryId: selectedCategory || undefined,
        page: currentPage,
        pageSize: 8,
      });

      countEl.innerHTML = `Tìm thấy <strong class="text-on-surface tabular-nums">${res.total}</strong> địa điểm phù hợp`;

      if (res.items.length === 0) {
        finishAsyncRender(
          resultsEl,
          renderEmptyState({
            icon: 'search_off',
            title: 'Không tìm thấy địa điểm phù hợp',
            description: 'Thử nới lỏng từ khóa, đổi khu vực hoặc xóa bộ lọc để xem toàn bộ địa điểm trong danh mục.',
            actionLabel: 'Đổi bộ lọc',
            actionId: 'emptyResetFilterBtn',
          }),
        );
        resultsEl.querySelector('#emptyResetFilterBtn')?.addEventListener('click', () => {
          resetFilters();
        });
        return;
      }

      const currentQs = buildCurrentQueryString();
      finishAsyncRender(
        resultsEl,
        `<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          ${res.items
            .map((d) =>
              renderDestinationCard({
                destination: d,
                showFavoriteButton: true,
                returnQuery: currentQs,
              }),
            )
            .join('')}
        </div>`,
      );
      bindImageFallbacks(resultsEl);

      // Gắn thao tác Yêu thích (ADD/REMOVE rõ ràng; nếu chưa đăng nhập chuyển T01 giữ địa điểm đích)
      resultsEl.querySelectorAll<HTMLButtonElement>('[data-fav-toggle]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const destId = btn.dataset.favToggle!;
          if (!sessionStore.isAuthenticated) {
            ctx.navigate(`/dang-nhap?redirect=${encodeURIComponent(`/dia-diem/${destId}`)}`);
            return;
          }
          if (btn.disabled) return;
          const isFav = btn.dataset.favActive === '1';
          const destName = btn.dataset.favName ?? destId;
          btn.disabled = true;
          try {
            if (isFav) {
              await favoritesService.removeFavorite(destId);
              btn.dataset.favActive = '0';
              btn.setAttribute('aria-pressed', 'false');
              btn.setAttribute('aria-label', `Thêm yêu thích ${destName}`);
              btn.classList.remove('text-error');
              btn.classList.add('text-text-secondary', 'hover:text-error');
              btn.querySelector('.material-symbols-outlined')?.classList.remove('icon-filled', 'tl-heart-pop');
              showToast('Đã bỏ địa điểm khỏi danh sách yêu thích.', 'info');
            } else {
              await favoritesService.addFavorite(destId);
              btn.dataset.favActive = '1';
              btn.setAttribute('aria-pressed', 'true');
              btn.setAttribute('aria-label', `Bỏ yêu thích ${destName}`);
              btn.classList.add('text-error');
              btn.classList.remove('text-text-secondary', 'hover:text-error');
              const iconEl = btn.querySelector('.material-symbols-outlined');
              iconEl?.classList.remove('tl-heart-pop');
              void (iconEl as HTMLElement | null)?.offsetWidth;
              iconEl?.classList.add('icon-filled', 'tl-heart-pop');
              showToast('Đã thêm địa điểm vào danh sách yêu thích.', 'success');
            }
          } catch (err) {
            showToast(toUserErrorMessage(err), 'error');
          } finally {
            btn.disabled = false;
          }
        });
      });

      pagEl.innerHTML = renderPagination(res.page, res.totalPages, res.total);
      pagEl.querySelectorAll<HTMLButtonElement>('[data-page]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const next = Number(btn.dataset.page);
          if (next >= 1 && next <= res.totalPages && next !== currentPage) {
            currentPage = next;
            syncUrl();
            void loadResults();
          }
        });
      });
    } catch (err) {
      finishAsyncRender(resultsEl, renderErrorBanner(toUserErrorMessage(err), 'retrySearchBtn'));
      resultsEl.querySelector('#retrySearchBtn')?.addEventListener('click', () => void loadResults());
    }
  };

  const resetFilters = () => {
    queryText = '';
    selectedRegion = '';
    selectedCategory = '';
    currentPage = 1;
    const qInput = main.querySelector<HTMLInputElement>('#filterQueryInput');
    const rSelect = main.querySelector<HTMLSelectElement>('#filterRegionSelect');
    const cSelect = main.querySelector<HTMLSelectElement>('#filterCategorySelect');
    if (qInput) qInput.value = '';
    if (rSelect) {
      rSelect.value = '';
      rSelect.dispatchEvent(new Event('tl:sync'));
    }
    if (cSelect) {
      cSelect.value = '';
      cSelect.dispatchEvent(new Event('tl:sync'));
    }
    syncUrl();
    void loadResults();
  };

  const applySearchFilters = () => {
    queryText = main.querySelector<HTMLInputElement>('#filterQueryInput')?.value.trim() ?? '';
    selectedRegion = main.querySelector<HTMLSelectElement>('#filterRegionSelect')?.value ?? '';
    selectedCategory = main.querySelector<HTMLSelectElement>('#filterCategorySelect')?.value ?? '';
    currentPage = 1;
    syncUrl();
    void loadResults();
  };

  main.querySelector<HTMLFormElement>('#filterForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    applySearchFilters();
  });
  main.querySelectorAll('#filterRegionSelect, #filterCategorySelect').forEach((sel) => {
    sel.addEventListener('change', applySearchFilters);
  });

  main.querySelector('#clearFiltersBtn')?.addEventListener('click', resetFilters);

  const loadCategoriesPromise = destinationsService
    .listCategories({ includeHidden: false, pageSize: 50 })
    .then((catRes) => {
      categories = catRes.items;
      const cSelect = main.querySelector<HTMLSelectElement>('#filterCategorySelect');
      if (cSelect) {
        cSelect.innerHTML = [
          `<option value="">Tất cả danh mục</option>`,
          ...categories.map(
            (c) =>
              `<option value="${escapeHtml(c.id)}" ${selectedCategory === c.id || selectedCategory === c.slug ? 'selected' : ''}>${escapeHtml(c.name)}</option>`,
          ),
        ].join('');
        cSelect.dispatchEvent(new Event('tl:sync'));
      }
      renderChips();
    })
    .catch(() => {
      categories = [];
    });

  await Promise.all([loadCategoriesPromise, loadResults()]);
}
