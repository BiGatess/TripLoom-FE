import type { RouteContext } from '@/app/router';
import { sessionStore } from '@/app/session-store';
import { isAppError, toUserErrorMessage } from '@/api/errors';
import { destinationsService } from '@/features/destinations/destinations.service';
import { favoritesService } from '@/features/favorites/favorites.service';
import { reviewsService } from '@/features/reviews/reviews.service';
import { renderErrorPage } from '@/features/system/pages/ErrorPage';
import { renderPublicShell } from '@/layouts/public/PublicShell';
import { renderCategoryBadge } from '@/shared/components/DestinationCard';
import { renderEmptyState, renderErrorBanner, renderLoadingSkeleton } from '@/shared/components/EmptyErrorState';
import { bindDetailImageGallery, renderDetailImageGallery } from '@/shared/components/ImageGalleryUploader';
import { renderReviewStatusBadge } from '@/shared/components/StatusBadge';
import { showToast } from '@/shared/components/Toast';
import { bindImageFallbacks, escapeHtml } from '@/shared/utils/dom';
import { formatDateVi, formatVnd } from '@/shared/utils/format';

export async function renderDestinationDetailPage(ctx: RouteContext): Promise<void> {
  const destId = ctx.params.id ?? '';
  const fromQuery = ctx.query.get('from');
  const backHref = fromQuery ? `/dia-diem?${fromQuery}` : '/dia-diem';

  const main = renderPublicShell({
    container: ctx.container,
    activeNav: 'explore',
    contentHtml: `<div id="destDetailRoot" class="max-w-[1200px] w-full mx-auto px-space-4 md:px-space-6 py-space-6">${renderLoadingSkeleton(2)}</div>`,
  });

  const root = main.querySelector<HTMLElement>('#destDetailRoot')!;

  const load = async () => {
    root.innerHTML = renderLoadingSkeleton(2);
    try {
      const detail = await destinationsService.getDetail(destId);
      const { destination: d, services, publishedReviews, myReview, isFavorite } = detail;
      const isLoggedIn = sessionStore.isAuthenticated;

      const costDisplay =
        d.estimatedCostVnd === null
          ? 'Chưa có thông tin giá'
          : d.estimatedCostVnd === 0
            ? '0đ (Miễn phí)'
            : `${formatVnd(d.estimatedCostVnd)}/người/lượt`;

      root.innerHTML = `
        <div class="flex flex-col gap-space-8">
          <!-- Back + Breadcrumb -->
          <div class="flex flex-wrap items-center justify-between gap-space-3">
            <a href="${escapeHtml(backHref)}" class="tl-back-btn">
              <span class="tl-back-icon" aria-hidden="true">
                <span class="material-symbols-outlined text-[16px]">arrow_back</span>
              </span>
              <span>Quay lại khám phá</span>
            </a>
            <nav aria-label="Breadcrumb" class="flex flex-wrap items-center gap-space-2 font-body text-body-md text-text-secondary">
              <a href="/" class="tl-breadcrumb-link">Trang chủ</a>
              <span class="text-border">/</span>
              <a href="${escapeHtml(backHref)}" class="tl-breadcrumb-link">Khám phá địa điểm</a>
              <span class="text-border">/</span>
              <strong class="text-on-surface">${escapeHtml(d.name)}</strong>
            </nav>
          </div>

          <!-- Hero Detail -->
          <section class="grid grid-cols-1 lg:grid-cols-12 gap-space-6 items-start">
            <div class="lg:col-span-7">
              ${renderDetailImageGallery(d.imageUrl, d.galleryUrls, d.name)}
            </div>

            <div class="lg:col-span-5 bg-surface border border-border rounded-xl p-space-6 shadow-sm flex flex-col gap-space-4">
              <div class="flex flex-wrap items-center gap-space-2">
                ${renderCategoryBadge(d.categoryId, d.categoryName, 'inline')}
                <span class="px-space-3 py-space-1 rounded-full bg-surface-muted text-text-secondary font-label text-label-sm tabular-nums">${escapeHtml(d.id)}</span>
              </div>
              <h1 class="font-headline text-headline-lg text-on-surface">${escapeHtml(d.name)}</h1>

              <dl class="flex flex-col gap-space-3 font-body text-body-md border-y border-border py-space-4">
                <div class="flex items-start gap-space-2">
                  <span class="material-symbols-outlined text-[20px] text-primary shrink-0">location_on</span>
                  <div>
                    <dt class="font-label text-label-sm text-text-secondary">Khu vực &amp; Địa chỉ</dt>
                    <dd class="text-on-surface">${escapeHtml(d.region)} · ${escapeHtml(d.address)}</dd>
                  </div>
                </div>
                <div class="flex items-start gap-space-2">
                  <span class="material-symbols-outlined text-[20px] text-primary shrink-0">schedule</span>
                  <div>
                    <dt class="font-label text-label-sm text-text-secondary">Giờ hoạt động</dt>
                    <dd class="text-on-surface">${escapeHtml(d.openingHours)}</dd>
                  </div>
                </div>
                <div class="flex items-start gap-space-2">
                  <span class="material-symbols-outlined text-[20px] text-primary shrink-0">payments</span>
                  <div>
                    <dt class="font-label text-label-sm text-text-secondary">Giá</dt>
                    <dd class="font-label text-label-lg text-primary tabular-nums">${escapeHtml(costDisplay)}</dd>
                  </div>
                </div>
              </dl>

              <p class="font-body text-body-md text-text-secondary">${escapeHtml(d.description)}</p>

              <div class="flex flex-wrap gap-space-3 pt-space-2">
                <a href="/lap-lich-trinh?region=${encodeURIComponent(d.region)}" class="flex-1 inline-flex items-center justify-center gap-space-2 min-h-[44px] px-space-4 rounded bg-primary text-on-primary hover:bg-primary-hover font-label text-label-md transition-colors">
                  <span class="material-symbols-outlined text-[20px]">auto_awesome</span>
                  <span>Thêm vào kế hoạch</span>
                </a>
                <button
                  type="button"
                  id="detailFavBtn"
                  data-is-fav="${isFavorite ? '1' : '0'}"
                  aria-pressed="${isFavorite ? 'true' : 'false'}"
                  class="inline-flex items-center justify-center gap-space-2 min-h-[44px] px-space-4 rounded border ${
                    isFavorite ? 'border-error text-error bg-error-bg/40' : 'border-primary text-primary hover:bg-primary-light'
                  } font-label text-label-md transition-colors disabled:opacity-60"
                >
                  <span id="detailFavIcon" class="material-symbols-outlined text-[20px] ${isFavorite ? 'icon-filled' : ''}" aria-hidden="true">favorite</span>
                  <span id="detailFavLabel">${isFavorite ? 'Bỏ yêu thích' : 'Yêu thích'}</span>
                </button>
              </div>
            </div>
          </section>

          <!-- Related Bookable Services -->
          <section class="flex flex-col gap-space-4">
            <h2 class="font-headline text-headline-md text-on-surface">Dịch vụ có thể đặt tại ${escapeHtml(d.name)}</h2>
            ${
              services.length === 0
                ? renderEmptyState({
                    icon: 'confirmation_number',
                    title: 'Chưa có dịch vụ đặt trước tại địa điểm này',
                    description: 'Bạn vẫn có thể thêm địa điểm này vào lịch trình tham quan tự túc của mình.',
                  })
                : `<div class="grid grid-cols-1 md:grid-cols-2 gap-space-6">
                    ${services
                      .map(
                        (s) => `
                      <article class="bg-surface border border-border rounded-lg p-space-4 shadow-sm flex flex-col sm:flex-row gap-space-4 justify-between">
                        <a href="/dich-vu/${encodeURIComponent(s.id)}" aria-label="Xem dịch vụ ${escapeHtml(s.name)}" class="group block w-full sm:w-32 h-32 rounded-md overflow-hidden shrink-0">
                          <img src="${escapeHtml(s.imageUrl)}" alt="${escapeHtml(s.name)}" data-fallback-label="${escapeHtml(s.name)}" class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.04]" />
                        </a>
                        <div class="flex-1 flex flex-col justify-between gap-space-2">
                          <div>
                            <span class="font-label text-label-sm text-primary">${escapeHtml(s.serviceType)} · ${escapeHtml(s.id)}</span>
                            <h3 class="font-title text-title-md text-on-surface">
                              <a href="/dich-vu/${encodeURIComponent(s.id)}" class="text-on-surface hover:text-primary no-underline transition-colors">${escapeHtml(s.name)}</a>
                            </h3>
                            <p class="font-body text-body-md text-text-secondary line-clamp-2 mt-space-1">${escapeHtml(s.description)}</p>
                          </div>
                          <div class="flex flex-wrap items-center justify-between gap-space-2 pt-space-2 border-t border-border">
                            <div>
                              <span class="font-label text-label-lg text-primary tabular-nums">${formatVnd(s.pricePerGuestVnd)}/người</span>
                              <p class="font-body text-label-sm text-text-secondary">Sức chứa tối đa: ${s.maxDailyCapacity} khách/ngày</p>
                            </div>
                            <a href="/dich-vu/${encodeURIComponent(s.id)}" class="inline-flex items-center justify-center min-h-[44px] px-space-4 rounded bg-primary text-on-primary hover:bg-primary-hover font-label text-label-md">Xem &amp; Đặt dịch vụ</a>
                          </div>
                        </div>
                      </article>
                    `,
                      )
                      .join('')}
                  </div>`
            }
          </section>

          <!-- Reviews Section -->
          <section class="grid grid-cols-1 lg:grid-cols-12 gap-space-6 items-start">
            <!-- Published Reviews List -->
            <div class="lg:col-span-7 bg-surface border border-border rounded-xl p-space-6 shadow-sm flex flex-col gap-space-4">
              <div class="flex items-center justify-between gap-space-2">
                <h2 class="font-headline text-headline-md text-on-surface">Đánh giá đã công khai (${publishedReviews.length})</h2>
                ${
                  d.averageRating !== null
                    ? `<span class="inline-flex items-center gap-1 font-label text-label-md text-on-surface tabular-nums">
                        <span class="material-symbols-outlined text-[20px] text-warning icon-filled" aria-hidden="true">star</span>
                        ${d.averageRating} / 5
                      </span>`
                    : `<span class="inline-flex items-center gap-1 font-label text-label-md text-text-secondary tabular-nums">
                        <span class="material-symbols-outlined text-[20px] text-border" aria-hidden="true">star</span>
                        0 / 5
                      </span>`
                }
              </div>

              ${
                publishedReviews.length === 0
                  ? `<div class="p-space-6 rounded-lg bg-surface-muted border border-border flex flex-col items-center justify-center text-center gap-space-2">
                      <div class="w-11 h-11 rounded-full bg-surface text-primary border border-border flex items-center justify-center">
                        <span class="material-symbols-outlined text-[22px]" aria-hidden="true">rate_review</span>
                      </div>
                      <h3 class="font-title text-title-md text-on-surface">Chưa có đánh giá công khai nào</h3>
                      <p class="font-body text-body-md text-text-secondary max-w-md">Hãy là người đầu tiên chia sẻ trải nghiệm sau khi ghé thăm địa điểm này.</p>
                    </div>`
                  : `<div class="flex flex-col gap-space-4">
                      ${publishedReviews
                        .map(
                          (rv) => `
                        <article class="bg-surface-muted border border-border rounded-lg p-space-4 flex flex-col gap-space-2">
                          <div class="flex items-center justify-between gap-space-2">
                            <strong class="font-label text-label-md text-on-surface">${escapeHtml(rv.userName)}</strong>
                            <span class="font-body text-label-sm text-text-secondary tabular-nums">${formatDateVi(rv.updatedAt)}</span>
                          </div>
                          <div class="flex items-center gap-0.5 text-warning" aria-label="${rv.rating} trên 5 sao">
                            ${Array.from({ length: 5 })
                              .map(
                                (_, i) =>
                                  `<span class="material-symbols-outlined text-[18px] ${i < rv.rating ? 'icon-filled text-warning' : 'text-border'}">star</span>`,
                              )
                              .join('')}
                          </div>
                          <p class="font-body text-body-md text-on-surface">${escapeHtml(rv.comment)}</p>
                        </article>
                      `,
                        )
                        .join('')}
                    </div>`
              }
            </div>

            <!-- My Review Form -->
            <aside class="lg:col-span-5 bg-surface border border-border rounded-xl p-space-6 shadow-sm flex flex-col gap-space-4">
              <div class="flex items-center justify-between gap-space-2">
                <h2 class="font-headline text-headline-md text-on-surface">${myReview ? 'Đánh giá của bạn' : 'Viết đánh giá'}</h2>
                ${myReview ? renderReviewStatusBadge(myReview.status) : ''}
              </div>

              ${
                !isLoggedIn
                  ? `<div class="p-space-4 rounded-lg bg-surface-muted border border-border flex flex-col gap-space-3">
                      <p class="font-body text-body-md text-text-secondary">Vui lòng đăng nhập để gửi đánh giá cho địa điểm này. Mỗi tài khoản có một bản đánh giá cho mỗi địa điểm.</p>
                      <a href="/dang-nhap?redirect=${encodeURIComponent(ctx.fullPath)}" class="self-start inline-flex items-center justify-center min-h-[44px] px-space-6 rounded bg-primary text-on-primary hover:bg-primary-hover font-label text-label-md">Đăng nhập để đánh giá</a>
                    </div>`
                  : `
                    ${
                      myReview?.status === 'PENDING'
                        ? `<p class="p-space-3 rounded-lg bg-warning-bg text-on-warning-bg font-body text-body-md">Đánh giá của bạn đang ở trạng thái <strong>Chờ duyệt</strong> và chưa hiển thị công khai cho khách khác.</p>`
                        : myReview?.status === 'HIDDEN'
                          ? `<p class="p-space-3 rounded-lg bg-surface-muted text-text-secondary font-body text-body-md">Đánh giá của bạn hiện đang <strong>Đã ẩn</strong>. Bạn có thể chỉnh sửa và gửi lại để kiểm duyệt.</p>`
                          : ''
                    }
                    <div id="reviewAlert" role="alert" class="hidden p-space-3 rounded bg-error-bg text-on-error-bg font-body text-body-md"></div>
                    <form id="reviewForm" novalidate class="flex flex-col gap-space-4">
                      <fieldset class="flex flex-col gap-space-2">
                        <legend class="font-label text-label-md text-on-surface">Số sao trải nghiệm (1 – 5)</legend>
                        <div class="flex items-center gap-space-2">
                          ${[1, 2, 3, 4, 5]
                            .map(
                              (n) => `
                            <label class="cursor-pointer">
                              <input type="radio" name="rating" value="${n}" ${(myReview?.rating ?? 5) === n ? 'checked' : ''} class="sr-only peer" />
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
                        <span class="font-label text-label-md text-on-surface">Nhận xét của bạn (tối đa 2.000 ký tự)</span>
                        <textarea id="reviewComment" rows="4" maxlength="2000" placeholder="Chia sẻ trải nghiệm thực tế của bạn..." class="w-full p-space-3 rounded border border-border bg-surface text-body-md focus:border-primary focus:ring-2 focus:ring-primary/20">${escapeHtml(myReview?.comment ?? '')}</textarea>
                        <span id="reviewCommentErr" class="hidden font-body text-body-md text-error"></span>
                      </label>

                      <p class="font-body text-label-sm text-text-secondary">Mọi đánh giá mới hoặc chỉnh sửa đều chuyển về trạng thái <strong>Chờ duyệt</strong> trước khi hiển thị công khai.</p>

                      <button id="reviewSubmitBtn" type="submit" class="w-full min-h-[44px] px-space-6 rounded bg-primary text-on-primary hover:bg-primary-hover disabled:opacity-60 font-label text-label-md transition-colors">
                        ${myReview ? 'Cập nhật đánh giá (gửi duyệt lại)' : 'Gửi đánh giá'}
                      </button>
                    </form>
                  `
              }
            </aside>
          </section>
        </div>
      `;

      bindImageFallbacks(root);
      bindDetailImageGallery(root);

      // Favorite ADD/REMOVE handler
      const favBtn = root.querySelector<HTMLButtonElement>('#detailFavBtn');
      favBtn?.addEventListener('click', async () => {
        if (!sessionStore.isAuthenticated) {
          ctx.navigate(`/dang-nhap?redirect=${encodeURIComponent(ctx.fullPath)}`);
          return;
        }
        if (favBtn.disabled) return;
        const currentlyFav = favBtn.dataset.isFav === '1';
        favBtn.disabled = true;
        const iconEl = root.querySelector<HTMLElement>('#detailFavIcon');
        const labelEl = root.querySelector<HTMLElement>('#detailFavLabel');
        try {
          if (currentlyFav) {
            await favoritesService.removeFavorite(d.id);
            favBtn.dataset.isFav = '0';
            favBtn.setAttribute('aria-pressed', 'false');
            favBtn.classList.remove('border-error', 'text-error', 'bg-error-bg/40');
            favBtn.classList.add('border-primary', 'text-primary', 'hover:bg-primary-light');
            iconEl?.classList.remove('icon-filled', 'tl-heart-pop');
            if (labelEl) labelEl.textContent = 'Yêu thích';
            showToast('Đã bỏ khỏi danh sách yêu thích.', 'info');
          } else {
            await favoritesService.addFavorite(d.id);
            favBtn.dataset.isFav = '1';
            favBtn.setAttribute('aria-pressed', 'true');
            favBtn.classList.remove('border-primary', 'text-primary', 'hover:bg-primary-light');
            favBtn.classList.add('border-error', 'text-error', 'bg-error-bg/40');
            iconEl?.classList.remove('tl-heart-pop');
            void iconEl?.offsetWidth;
            iconEl?.classList.add('icon-filled', 'tl-heart-pop');
            if (labelEl) labelEl.textContent = 'Bỏ yêu thích';
            showToast('Đã thêm vào danh sách yêu thích.', 'success');
          }
        } catch (err) {
          showToast(toUserErrorMessage(err), 'error');
        } finally {
          favBtn.disabled = false;
        }
      });

      // Review submit handler
      const reviewForm = root.querySelector<HTMLFormElement>('#reviewForm');
      reviewForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = root.querySelector<HTMLButtonElement>('#reviewSubmitBtn');
        const alertEl = root.querySelector<HTMLElement>('#reviewAlert');
        const commentErr = root.querySelector<HTMLElement>('#reviewCommentErr');
        if (!submitBtn || submitBtn.disabled) return;

        const ratingInput = reviewForm.querySelector<HTMLInputElement>('input[name="rating"]:checked');
        const rating = Number(ratingInput?.value ?? 5);
        const comment = root.querySelector<HTMLTextAreaElement>('#reviewComment')?.value.trim() ?? '';

        alertEl?.classList.add('hidden');
        commentErr?.classList.add('hidden');

        if (comment.length < 10) {
          if (commentErr) {
            commentErr.textContent = 'Nhận xét cần tối thiểu 10 ký tự.';
            commentErr.classList.remove('hidden');
          }
          return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Đang gửi đánh giá...';
        try {
          await reviewsService.upsertMyReview({ destinationId: d.id, rating, comment });
          showToast('Đã ghi nhận đánh giá ở trạng thái Chờ duyệt.', 'success');
          await load();
        } catch (err) {
          if (alertEl) {
            alertEl.textContent = toUserErrorMessage(err);
            alertEl.classList.remove('hidden');
          }
          submitBtn.disabled = false;
          submitBtn.textContent = myReview ? 'Cập nhật đánh giá (gửi duyệt lại)' : 'Gửi đánh giá';
        }
      });
    } catch (err) {
      if (isAppError(err) && err.code === 'NOT_FOUND') {
        renderErrorPage(ctx, { code: '404', title: 'Không tìm thấy địa điểm', description: err.message });
        return;
      }
      root.innerHTML = renderErrorBanner(toUserErrorMessage(err), 'retryDestBtn');
      root.querySelector('#retryDestBtn')?.addEventListener('click', () => void load());
    }
  };

  await load();
}
