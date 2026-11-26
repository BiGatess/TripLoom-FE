import type { RouteContext } from '@/app/router';
import { isAppError, toUserErrorMessage } from '@/api/errors';
import type { ActiveStatus, Category, Destination } from '@/api/contracts';
import { REGIONS } from '@/config/constants';
import { adminCatalogService } from '@/features/admin-catalog/admin-catalog.service';
import { destinationsService } from '@/features/destinations/destinations.service';
import { renderErrorPage } from '@/features/system/pages/ErrorPage';
import { renderBackofficeShell } from '@/layouts/backoffice/BackofficeShell';
import { renderErrorBanner, renderLoadingSkeleton } from '@/shared/components/EmptyErrorState';
import { mountImageGalleryUploader } from '@/shared/components/ImageGalleryUploader';
import { openConfirmModal } from '@/shared/components/Modal';
import { showToast } from '@/shared/components/Toast';
import { bindImageFallbacks, escapeHtml } from '@/shared/utils/dom';
import { STITCH_IMAGES } from '@/shared/utils/media';

export async function renderDestinationFormPage(ctx: RouteContext): Promise<void> {
  const editId = ctx.params.id ?? null;
  const isEdit = Boolean(editId);

  const main = renderBackofficeShell({
    container: ctx.container,
    activeNav: 'destinations',
    breadcrumbs: [
      { label: 'Quản trị', href: '/quan-tri' },
      { label: 'Địa điểm', href: '/quan-tri/dia-diem' },
      { label: isEdit ? `Chỉnh sửa ${editId}` : 'Thêm địa điểm' },
    ],
    contentHtml: `<div id="a04Root">${renderLoadingSkeleton(2)}</div>`,
  });

  const root = main.querySelector<HTMLElement>('#a04Root')!;

  try {
    const [catRes, existingDetail] = await Promise.all([
      destinationsService.listCategories({ includeHidden: true, pageSize: 50 }),
      editId ? destinationsService.getDetail(editId, { includeHiddenForAdmin: true }) : Promise.resolve(null),
    ]);
    const categories: Category[] = catRes.items;
    const d: Destination | null = existingDetail?.destination ?? null;

    root.innerHTML = `
      <div class="flex flex-col gap-space-6">
        <div class="flex items-center justify-between gap-space-4">
          <h1 class="font-headline text-headline-lg text-on-surface">${isEdit ? `Chỉnh sửa địa điểm ${escapeHtml(d?.id ?? '')}` : 'Thêm địa điểm mới'}</h1>
          <button type="button" data-a04-cancel class="tl-back-btn">
            <span class="tl-back-icon" aria-hidden="true">
              <span class="material-symbols-outlined text-[16px]">arrow_back</span>
            </span>
            <span>Quay lại danh sách</span>
          </button>
        </div>

        <div id="a04Alert" role="alert" class="hidden p-space-4 rounded-lg bg-error-bg text-on-error-bg font-body text-body-md"></div>

        <form id="a04Form" novalidate class="grid grid-cols-1 lg:grid-cols-12 gap-space-6 items-start">
          <section class="lg:col-span-8 bg-surface border border-border rounded-xl p-space-6 shadow-sm flex flex-col gap-space-4">
            <label class="flex flex-col gap-space-1">
              <span class="font-label text-label-md text-on-surface">Tên địa điểm <span class="text-error">*</span></span>
              <input id="a04Name" type="text" value="${escapeHtml(d?.name ?? '')}" class="w-full min-h-[44px] px-space-4 rounded border border-border bg-surface text-body-md" />
              <span data-err="name" class="hidden text-body-md text-error"></span>
            </label>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-space-4">
              <label class="flex flex-col gap-space-1">
                <span class="font-label text-label-md text-on-surface">Tỉnh / Thành phố <span class="text-error">*</span></span>
                <select id="a04Region" class="w-full min-h-[44px] px-space-3 rounded border border-border bg-surface text-body-md">
                  ${REGIONS.map((r) => `<option value="${escapeHtml(r)}" ${(d?.region ?? 'Đà Nẵng') === r ? 'selected' : ''}>${escapeHtml(r)}</option>`).join('')}
                </select>
                <span data-err="region" class="hidden text-body-md text-error"></span>
              </label>

              <label class="flex flex-col gap-space-1">
                <span class="font-label text-label-md text-on-surface">Danh mục <span class="text-error">*</span></span>
                <select id="a04Category" class="w-full min-h-[44px] px-space-3 rounded border border-border bg-surface text-body-md">
                  ${categories
                    .map(
                      (c) =>
                        `<option value="${escapeHtml(c.id)}" ${(d?.categoryId ?? categories[0]?.id) === c.id ? 'selected' : ''}>${escapeHtml(c.name)}${c.status === 'HIDDEN' ? ' (Đang ẩn)' : ''}</option>`,
                    )
                    .join('')}
                </select>
                <span data-err="categoryId" class="hidden text-body-md text-error"></span>
              </label>
            </div>

            <label class="flex flex-col gap-space-1">
              <span class="font-label text-label-md text-on-surface">Địa chỉ cụ thể <span class="text-error">*</span></span>
              <input id="a04Address" type="text" value="${escapeHtml(d?.address ?? '')}" class="w-full min-h-[44px] px-space-4 rounded border border-border bg-surface text-body-md" />
              <span data-err="address" class="hidden text-body-md text-error"></span>
            </label>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-space-4">
              <label class="flex flex-col gap-space-1">
                <span class="font-label text-label-md text-on-surface">Giá / người / lượt (VND)</span>
                <input id="a04Cost" type="number" min="0" step="1000" value="${d?.estimatedCostVnd ?? ''}" placeholder="Để trống nếu chưa có thông tin giá" class="w-full min-h-[44px] px-space-4 rounded border border-border bg-surface text-body-md tabular-nums" />
                <span class="text-label-sm text-text-secondary">Nhập 0 cho miễn phí; để trống để hiển thị "Chưa có thông tin giá".</span>
                <span data-err="estimatedCostVnd" class="hidden text-body-md text-error"></span>
              </label>

              <label class="flex flex-col gap-space-1">
                <span class="font-label text-label-md text-on-surface">Giờ hoạt động</span>
                <input id="a04Hours" type="text" value="${escapeHtml(d?.openingHours ?? '07:00 – 18:00 hằng ngày')}" class="w-full min-h-[44px] px-space-4 rounded border border-border bg-surface text-body-md" />
              </label>
            </div>

            <label class="flex flex-col gap-space-1">
              <span class="font-label text-label-md text-on-surface">Mô tả địa điểm <span class="text-error">*</span></span>
              <textarea id="a04Desc" rows="4" class="w-full p-space-3 rounded border border-border bg-surface text-body-md">${escapeHtml(d?.description ?? '')}</textarea>
              <span data-err="description" class="hidden text-body-md text-error"></span>
            </label>

            <label class="flex flex-col gap-space-1">
              <span class="font-label text-label-md text-on-surface">Trạng thái hiển thị</span>
              <select id="a04Status" class="w-full min-h-[44px] px-space-3 rounded border border-border bg-surface text-body-md">
                <option value="ACTIVE" ${(d?.status ?? 'ACTIVE') === 'ACTIVE' ? 'selected' : ''}>Đang hoạt động</option>
                <option value="HIDDEN" ${d?.status === 'HIDDEN' ? 'selected' : ''}>Đã ẩn</option>
              </select>
            </label>

            <div class="flex justify-end gap-space-3 pt-space-4 border-t border-border">
              <button type="button" data-a04-cancel class="min-h-[44px] px-space-4 rounded border border-border bg-surface text-on-surface hover:bg-surface-muted font-label text-label-md inline-flex items-center">Hủy</button>
              <button type="submit" id="a04SaveBtn" class="min-h-[44px] px-space-6 rounded bg-primary text-on-primary hover:bg-primary-hover font-label text-label-lg">Lưu địa điểm</button>
            </div>
          </section>

          <aside class="lg:col-span-4 bg-surface border border-border rounded-xl p-space-6 shadow-sm">
            <div id="a04GalleryMount"></div>
          </aside>
        </form>
      </div>
    `;

    bindImageFallbacks(root);

    let isDirty = false;
    const galleryCtrl = mountImageGalleryUploader({
      container: root.querySelector<HTMLElement>('#a04GalleryMount')!,
      initialMainUrl: d?.imageUrl ?? (isEdit ? STITCH_IMAGES.heroVietnam : ''),
      initialGalleryUrls: d?.galleryUrls,
      onChange: () => {
        isDirty = true;
      },
    });

    root.querySelector<HTMLFormElement>('#a04Form')?.addEventListener('input', () => {
      isDirty = true;
    });
    root.querySelector<HTMLFormElement>('#a04Form')?.addEventListener('change', () => {
      isDirty = true;
    });
    root.querySelectorAll<HTMLButtonElement>('[data-a04-cancel]').forEach((cancelBtn) => {
      cancelBtn.addEventListener('click', () => {
        if (!isDirty) {
          ctx.navigate('/quan-tri/dia-diem');
          return;
        }
        openConfirmModal({
          title: 'Hủy các thay đổi chưa lưu?',
          description: 'Thông tin bạn vừa nhập hoặc chỉnh sửa chưa được lưu lên hệ thống. Bạn có chắc muốn rời khỏi trang?',
          confirmLabel: 'Rời trang & hủy thay đổi',
          destructive: true,
          onConfirm: () => {
            ctx.navigate('/quan-tri/dia-diem');
          },
        });
      });
    });

    root.querySelector<HTMLFormElement>('#a04Form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = root.querySelector<HTMLButtonElement>('#a04SaveBtn');
      const alertEl = root.querySelector<HTMLElement>('#a04Alert');
      if (!btn || btn.disabled) return;
      alertEl?.classList.add('hidden');
      root.querySelectorAll('[data-err]').forEach((el) => el.classList.add('hidden'));

      const mainImageUrl = galleryCtrl.getMainImageUrl() || STITCH_IMAGES.heroVietnam;
      const rawCost = root.querySelector<HTMLInputElement>('#a04Cost')?.value.trim() ?? '';
      const estimatedCostVnd = rawCost === '' ? null : Number(rawCost);

      btn.disabled = true;
      btn.textContent = 'Đang lưu...';
      try {
        await adminCatalogService.upsertDestination(editId, {
          name: root.querySelector<HTMLInputElement>('#a04Name')?.value.trim() ?? '',
          region: root.querySelector<HTMLSelectElement>('#a04Region')?.value ?? 'Đà Nẵng',
          categoryId: root.querySelector<HTMLSelectElement>('#a04Category')?.value ?? '',
          address: root.querySelector<HTMLInputElement>('#a04Address')?.value.trim() ?? '',
          description: root.querySelector<HTMLTextAreaElement>('#a04Desc')?.value.trim() ?? '',
          imageUrl: mainImageUrl,
          galleryUrls: galleryCtrl.getGalleryUrls(),
          estimatedCostVnd,
          openingHours: root.querySelector<HTMLInputElement>('#a04Hours')?.value.trim() ?? '',
          status: (root.querySelector<HTMLSelectElement>('#a04Status')?.value ?? 'ACTIVE') as ActiveStatus,
          expectedVersion: d?.version,
        });
        showToast(isEdit ? 'Đã cập nhật địa điểm thành công.' : 'Đã thêm địa điểm mới.', 'success');
        ctx.navigate('/quan-tri/dia-diem');
      } catch (err) {
        if (isAppError(err)) {
          Object.entries(err.fieldErrors).forEach(([k, v]) => {
            const el = root.querySelector<HTMLElement>(`[data-err="${k}"]`);
            if (el) {
              el.textContent = v;
              el.classList.remove('hidden');
            }
          });
        }
        if (alertEl) {
          alertEl.textContent = toUserErrorMessage(err);
          alertEl.classList.remove('hidden');
        }
        btn.disabled = false;
        btn.textContent = 'Lưu địa điểm';
      }
    });
  } catch (err) {
    if (isAppError(err) && err.code === 'NOT_FOUND') {
      renderErrorPage(ctx, { code: '404', description: err.message });
      return;
    }
    root.innerHTML = renderErrorBanner(toUserErrorMessage(err));
  }
}
