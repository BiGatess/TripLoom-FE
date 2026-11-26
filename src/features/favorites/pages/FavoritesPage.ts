import type { RouteContext } from '@/app/router';
import { toUserErrorMessage } from '@/api/errors';
import { favoritesService } from '@/features/favorites/favorites.service';
import { renderMemberShell } from '@/layouts/member/MemberShell';
import { renderDestinationCard } from '@/shared/components/DestinationCard';
import { renderEmptyState, renderErrorBanner, renderLoadingSkeleton } from '@/shared/components/EmptyErrorState';
import { showToast } from '@/shared/components/Toast';
import { beginAsyncRender, bindImageFallbacks, finishAsyncRender } from '@/shared/utils/dom';

export async function renderFavoritesPage(ctx: RouteContext): Promise<void> {
  const main = renderMemberShell({
    container: ctx.container,
    activeNav: 'favorites',
    contentHtml: `
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-space-4">
        <div>
          <h1 class="font-headline text-headline-lg text-on-surface">Địa điểm yêu thích</h1>
          <p class="font-body text-body-md text-text-secondary">Lưu lại những điểm đến bạn quan tâm để dễ dàng tham khảo khi lập lịch trình.</p>
        </div>
        <a href="/lap-lich-trinh" class="inline-flex items-center justify-center gap-space-2 min-h-[44px] px-space-6 rounded bg-primary text-on-primary hover:bg-primary-hover font-label text-label-md">
          <span class="material-symbols-outlined text-[20px]">auto_awesome</span>
          <span>Lập lịch trình</span>
        </a>
      </div>
      <div id="favRoot">${renderLoadingSkeleton(4)}</div>
    `,
  });

  const root = main.querySelector<HTMLElement>('#favRoot')!;

  const load = async () => {
    beginAsyncRender(root, renderLoadingSkeleton(4));
    try {
      const items = await favoritesService.listFavorites();
      if (items.length === 0) {
        finishAsyncRender(
          root,
          renderEmptyState({
            icon: 'favorite_border',
            title: 'Bạn chưa có địa điểm yêu thích nào',
            description: 'Khám phá danh mục địa điểm Việt Nam và bấm biểu tượng trái tim để lưu điểm đến yêu thích.',
            actionHref: '/dia-diem',
            actionLabel: 'Khám phá địa điểm',
          }),
        );
        return;
      }

      finishAsyncRender(
        root,
        `<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          ${items
            .map((d) =>
              renderDestinationCard({
                destination: d,
                showFavoriteButton: d.effectivelyPublic,
                unavailableMode: !d.effectivelyPublic,
              }),
            )
            .join('')}
        </div>`,
      );
      bindImageFallbacks(root);

      const handleRemove = async (destId: string, btn: HTMLButtonElement) => {
        if (btn.disabled) return;
        btn.disabled = true;
        try {
          await favoritesService.removeFavorite(destId);
          showToast('Đã bỏ địa điểm khỏi danh sách yêu thích.', 'info');
          await load();
        } catch (err) {
          showToast(toUserErrorMessage(err), 'error');
          btn.disabled = false;
        }
      };

      root.querySelectorAll<HTMLButtonElement>('[data-fav-toggle]').forEach((btn) => {
        btn.addEventListener('click', () => void handleRemove(btn.dataset.favToggle!, btn));
      });
      root.querySelectorAll<HTMLButtonElement>('[data-fav-remove-only]').forEach((btn) => {
        btn.addEventListener('click', () => void handleRemove(btn.dataset.favRemoveOnly!, btn));
      });
    } catch (err) {
      finishAsyncRender(root, renderErrorBanner(toUserErrorMessage(err), 'retryFavBtn'));
      root.querySelector('#retryFavBtn')?.addEventListener('click', () => void load());
    }
  };

  await load();
}
