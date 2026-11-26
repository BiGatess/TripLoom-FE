import type { RouteContext } from '@/app/router';
import { toUserErrorMessage } from '@/api/errors';
import type { Review } from '@/api/contracts';
import { reviewsService } from '@/features/reviews/reviews.service';
import { renderMemberShell } from '@/layouts/member/MemberShell';
import { renderEmptyState, renderErrorBanner, renderTableSkeleton } from '@/shared/components/EmptyErrorState';
import { openModal } from '@/shared/components/Modal';
import { renderReviewStatusBadge } from '@/shared/components/StatusBadge';
import { showToast } from '@/shared/components/Toast';
import { beginAsyncRender, escapeHtml, finishAsyncRender } from '@/shared/utils/dom';
import { formatDateTimeVi } from '@/shared/utils/format';

export async function renderMyReviewsPage(ctx: RouteContext): Promise<void> {
  const main = renderMemberShell({
    container: ctx.container,
    activeNav: 'reviews',
    contentHtml: `
      <div>
        <h1 class="font-headline text-headline-lg text-on-surface">Đánh giá của tôi</h1>
        <p class="font-body text-body-md text-text-secondary">Theo dõi trạng thái kiểm duyệt các đánh giá bạn đã gửi. Mỗi khi chỉnh sửa, đánh giá sẽ chuyển về Chờ duyệt.</p>
      </div>
      <div id="myReviewsRoot">${renderTableSkeleton(3)}</div>
    `,
  });

  const root = main.querySelector<HTMLElement>('#myReviewsRoot')!;

  const openEditReviewModal = (rv: Review) => {
    openModal({
      title: `Chỉnh sửa đánh giá · ${rv.destinationName}`,
      subtitle: 'Sau khi gửi lại, đánh giá sẽ chuyển về trạng thái Chờ duyệt cho tới khi được kiểm duyệt.',
      size: 'md',
      bodyHtml: `
        <form id="editReviewForm" novalidate class="flex flex-col gap-space-4">
          <div id="editRvAlert" role="alert" class="hidden p-space-3 rounded bg-error-bg text-on-error-bg font-body text-body-md"></div>
          <fieldset class="flex flex-col gap-space-2">
            <legend class="font-label text-label-md text-on-surface">Số sao (1 – 5)</legend>
            <div class="flex gap-space-2">
              ${[1, 2, 3, 4, 5]
                .map(
                  (n) => `
                <label class="cursor-pointer">
                  <input type="radio" name="editRating" value="${n}" ${rv.rating === n ? 'checked' : ''} class="sr-only peer" />
                  <span class="min-w-[44px] min-h-[44px] px-space-3 rounded border border-border peer-checked:border-primary peer-checked:bg-primary-light peer-checked:text-primary inline-flex items-center justify-center gap-1 font-label text-label-md">
                    ${n}<span class="material-symbols-outlined text-[16px] icon-filled text-warning">star</span>
                  </span>
                </label>
              `,
                )
                .join('')}
            </div>
          </fieldset>
          <label class="flex flex-col gap-space-1">
            <span class="font-label text-label-md text-on-surface">Nhận xét (tối đa 2.000 ký tự)</span>
            <textarea id="editRvComment" rows="4" maxlength="2000" class="w-full p-space-3 rounded border border-border bg-surface text-body-md">${escapeHtml(rv.comment)}</textarea>
          </label>
          <div class="flex justify-end gap-space-3 pt-space-2">
            <button type="button" data-rv-cancel class="min-h-[44px] px-space-4 rounded border border-border bg-surface text-on-surface font-label text-label-md">Hủy</button>
            <button type="submit" id="editRvSubmit" class="min-h-[44px] px-space-6 rounded bg-primary text-on-primary hover:bg-primary-hover font-label text-label-md">Gửi duyệt lại</button>
          </div>
        </form>
      `,
      onMount: (panel, close) => {
        panel.querySelector('[data-rv-cancel]')?.addEventListener('click', close);
        panel.querySelector<HTMLFormElement>('#editReviewForm')?.addEventListener('submit', async (e) => {
          e.preventDefault();
          const btn = panel.querySelector<HTMLButtonElement>('#editRvSubmit');
          const alertEl = panel.querySelector<HTMLElement>('#editRvAlert');
          if (!btn || btn.disabled) return;
          const rating = Number(panel.querySelector<HTMLInputElement>('input[name="editRating"]:checked')?.value ?? rv.rating);
          const comment = panel.querySelector<HTMLTextAreaElement>('#editRvComment')?.value.trim() ?? '';
          alertEl?.classList.add('hidden');
          btn.disabled = true;
          btn.textContent = 'Đang gửi...';
          try {
            await reviewsService.upsertMyReview({ destinationId: rv.destinationId, rating, comment });
            close();
            showToast('Đã cập nhật đánh giá và chuyển về trạng thái Chờ duyệt.', 'success');
            await load();
          } catch (err) {
            if (alertEl) {
              alertEl.textContent = toUserErrorMessage(err);
              alertEl.classList.remove('hidden');
            }
            btn.disabled = false;
            btn.textContent = 'Gửi duyệt lại';
          }
        });
      },
    });
  };

  const load = async () => {
    beginAsyncRender(root, renderTableSkeleton(3));
    try {
      const reviews = await reviewsService.listMyReviews();
      if (reviews.length === 0) {
        finishAsyncRender(
          root,
          renderEmptyState({
            icon: 'rate_review',
            title: 'Bạn chưa gửi đánh giá nào',
            description: 'Mở trang chi tiết địa điểm bạn đã ghé thăm để chia sẻ cảm nhận.',
            actionHref: '/dia-diem',
            actionLabel: 'Khám phá địa điểm',
          }),
        );
        return;
      }

      finishAsyncRender(
        root,
        `<div class="flex flex-col gap-space-4">
          ${reviews
            .map(
              (rv) => `
            <article class="bg-surface border border-border rounded-xl p-space-6 shadow-sm flex flex-col gap-space-3">
              <div class="flex flex-wrap items-center justify-between gap-space-3">
                <div class="flex flex-wrap items-center gap-space-2">
                  <span class="font-label text-label-sm text-primary tabular-nums">${escapeHtml(rv.id)}</span>
                  <h2 class="font-title text-title-md text-on-surface">${escapeHtml(rv.destinationName)}</h2>
                  ${renderReviewStatusBadge(rv.status)}
                </div>
                <span class="font-body text-label-sm text-text-secondary tabular-nums">Cập nhật: ${formatDateTimeVi(rv.updatedAt)}</span>
              </div>

              <div class="flex items-center gap-0.5">
                ${Array.from({ length: 5 })
                  .map(
                    (_, i) =>
                      `<span class="material-symbols-outlined text-[18px] ${i < rv.rating ? 'icon-filled text-warning' : 'text-border'}">star</span>`,
                  )
                  .join('')}
              </div>

              <p class="font-body text-body-md text-on-surface">${escapeHtml(rv.comment)}</p>

              <div class="flex flex-wrap items-center justify-between gap-space-3 pt-space-3 border-t border-border">
                ${
                  rv.destinationPublic
                    ? `<a href="/dia-diem/${encodeURIComponent(rv.destinationId)}" class="font-label text-label-md text-primary hover:underline">Mở trang địa điểm</a>`
                    : `<span class="font-body text-label-sm text-text-secondary">Địa điểm hiện đã tạm ẩn</span>`
                }
                ${
                  rv.destinationPublic
                    ? `<button type="button" data-edit-rv="${escapeHtml(rv.id)}" class="min-h-[44px] px-space-4 rounded border border-border bg-surface text-on-surface hover:bg-surface-muted font-label text-label-md">Chỉnh sửa đánh giá</button>`
                    : ''
                }
              </div>
            </article>
          `,
            )
            .join('')}
        </div>`,
      );

      root.querySelectorAll<HTMLButtonElement>('[data-edit-rv]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const item = reviews.find((r) => r.id === btn.dataset.editRv);
          if (item) openEditReviewModal(item);
        });
      });
    } catch (err) {
      finishAsyncRender(root, renderErrorBanner(toUserErrorMessage(err), 'retryMyRvBtn'));
      root.querySelector('#retryMyRvBtn')?.addEventListener('click', () => void load());
    }
  };

  await load();
}
