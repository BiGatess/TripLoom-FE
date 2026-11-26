import type { RouteContext } from '@/app/router';
import { isAppError, toUserErrorMessage } from '@/api/errors';
import type { ActiveStatus, TravelService } from '@/api/contracts';
import { adminCatalogService } from '@/features/admin-catalog/admin-catalog.service';
import { destinationsService } from '@/features/destinations/destinations.service';
import { servicesService } from '@/features/services/services.service';
import { renderErrorPage } from '@/features/system/pages/ErrorPage';
import { renderBackofficeShell } from '@/layouts/backoffice/BackofficeShell';
import { renderErrorBanner, renderLoadingSkeleton } from '@/shared/components/EmptyErrorState';
import { mountImageGalleryUploader } from '@/shared/components/ImageGalleryUploader';
import { openConfirmModal } from '@/shared/components/Modal';
import { showToast } from '@/shared/components/Toast';
import { bindImageFallbacks, escapeHtml } from '@/shared/utils/dom';

export async function renderServiceFormPage(ctx: RouteContext): Promise<void> {
  const editId = ctx.params.id ?? null;
  const isEdit = Boolean(editId);

  const main = renderBackofficeShell({
    container: ctx.container,
    activeNav: 'services',
    breadcrumbs: [
      { label: 'Quản trị', href: '/quan-tri' },
      { label: 'Dịch vụ', href: '/quan-tri/dich-vu' },
      { label: isEdit ? `Chỉnh sửa ${editId}` : 'Thêm dịch vụ' },
    ],
    contentHtml: `<div id="a06Root">${renderLoadingSkeleton(2)}</div>`,
  });

  const root = main.querySelector<HTMLElement>('#a06Root')!;

  try {
    const [destRes, svc] = await Promise.all([
      destinationsService.listDestinations({ includeHidden: true, pageSize: 100 }),
      editId ? servicesService.getDetail(editId, { includeHiddenForAdmin: true }) : Promise.resolve(null),
    ]);
    const s: TravelService | null = svc;

    root.innerHTML = `
      <div class="flex flex-col gap-space-6">
        <div class="flex items-center justify-between gap-space-4">
          <h1 class="font-headline text-headline-lg text-on-surface">${isEdit ? `Chỉnh sửa dịch vụ ${escapeHtml(s?.id ?? '')}` : 'Thêm dịch vụ mới'}</h1>
          <button type="button" data-a06-cancel class="tl-back-btn">
            <span class="tl-back-icon" aria-hidden="true">
              <span class="material-symbols-outlined text-[16px]">arrow_back</span>
            </span>
            <span>Quay lại danh sách</span>
          </button>
        </div>

        <div id="a06Alert" role="alert" class="hidden p-space-4 rounded-lg bg-error-bg text-on-error-bg font-body text-body-md"></div>

        <form id="a06Form" novalidate class="grid grid-cols-1 lg:grid-cols-12 gap-space-6 items-start">
          <section class="lg:col-span-8 bg-surface border border-border rounded-xl p-space-6 shadow-sm flex flex-col gap-space-4">
            <label class="flex flex-col gap-space-1">
              <span class="font-label text-label-md text-on-surface">Địa điểm liên kết <span class="text-error">*</span></span>
              <select id="a06Dest" class="w-full min-h-[44px] px-space-3 rounded border border-border bg-surface text-body-md">
                ${destRes.items
                  .map(
                    (d) =>
                      `<option value="${escapeHtml(d.id)}" ${(s?.destinationId ?? destRes.items[0]?.id) === d.id ? 'selected' : ''}>${escapeHtml(d.name)} (${escapeHtml(d.id)})${!d.effectivelyPublic ? ' — Đang ẩn' : ''}</option>`,
                  )
                  .join('')}
              </select>
              <span data-err="destinationId" class="hidden text-body-md text-error"></span>
            </label>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-space-4">
              <label class="flex flex-col gap-space-1">
                <span class="font-label text-label-md text-on-surface">Tên dịch vụ <span class="text-error">*</span></span>
                <input id="a06Name" type="text" value="${escapeHtml(s?.name ?? '')}" class="w-full min-h-[44px] px-space-4 rounded border border-border bg-surface text-body-md" />
                <span data-err="name" class="hidden text-body-md text-error"></span>
              </label>

              <label class="flex flex-col gap-space-1">
                <span class="font-label text-label-md text-on-surface">Loại hình dịch vụ</span>
                <input id="a06Type" type="text" value="${escapeHtml(s?.serviceType ?? 'Workshop trải nghiệm')}" class="w-full min-h-[44px] px-space-4 rounded border border-border bg-surface text-body-md" />
              </label>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-space-4">
              <label class="flex flex-col gap-space-1">
                <span class="font-label text-label-md text-on-surface">Đơn giá / người (VND) <span class="text-error">*</span></span>
                <input id="a06Price" type="number" min="0" step="1000" value="${s?.pricePerGuestVnd ?? 150000}" class="w-full min-h-[44px] px-space-4 rounded border border-border bg-surface text-body-md tabular-nums" />
                <span class="text-label-sm text-text-secondary">Thay đổi đơn giá chỉ áp dụng cho các đơn đặt mới.</span>
                <span data-err="pricePerGuestVnd" class="hidden text-body-md text-error"></span>
              </label>

              <label class="flex flex-col gap-space-1">
                <span class="font-label text-label-md text-on-surface">Sức chứa tối đa / ngày (khách) <span class="text-error">*</span></span>
                <input id="a06Cap" type="number" min="1" value="${s?.maxDailyCapacity ?? 20}" class="w-full min-h-[44px] px-space-4 rounded border border-border bg-surface text-body-md tabular-nums" />
                <span data-err="maxDailyCapacity" class="hidden text-body-md text-error"></span>
              </label>
            </div>

            <label class="flex flex-col gap-space-1">
              <span class="font-label text-label-md text-on-surface">Mô tả dịch vụ <span class="text-error">*</span></span>
              <textarea id="a06Desc" rows="4" class="w-full p-space-3 rounded border border-border bg-surface text-body-md">${escapeHtml(s?.description ?? '')}</textarea>
              <span data-err="description" class="hidden text-body-md text-error"></span>
            </label>

            <label class="flex flex-col gap-space-1">
              <span class="font-label text-label-md text-on-surface">Trạng thái</span>
              <select id="a06Status" class="w-full min-h-[44px] px-space-3 rounded border border-border bg-surface text-body-md">
                <option value="ACTIVE" ${(s?.status ?? 'ACTIVE') === 'ACTIVE' ? 'selected' : ''}>Đang hoạt động</option>
                <option value="HIDDEN" ${s?.status === 'HIDDEN' ? 'selected' : ''}>Đã ẩn</option>
              </select>
            </label>

            <div class="flex justify-end gap-space-3 pt-space-4 border-t border-border">
              <button type="button" data-a06-cancel class="min-h-[44px] px-space-4 rounded border border-border bg-surface text-on-surface hover:bg-surface-muted font-label text-label-md inline-flex items-center">Hủy</button>
              <button type="submit" id="a06SaveBtn" class="min-h-[44px] px-space-6 rounded bg-primary text-on-primary hover:bg-primary-hover font-label text-label-lg">Lưu dịch vụ</button>
            </div>
          </section>

          <aside class="lg:col-span-4 bg-surface border border-border rounded-xl p-space-6 shadow-sm">
            <div id="a06GalleryMount"></div>
          </aside>
        </form>
      </div>
    `;

    bindImageFallbacks(root);

    let isDirty = false;
    const galleryCtrl = mountImageGalleryUploader({
      container: root.querySelector<HTMLElement>('#a06GalleryMount')!,
      initialMainUrl: s?.imageUrl ?? '',
      initialGalleryUrls: s?.galleryUrls,
      onChange: () => {
        isDirty = true;
      },
    });

    root.querySelector<HTMLFormElement>('#a06Form')?.addEventListener('input', () => {
      isDirty = true;
    });
    root.querySelector<HTMLFormElement>('#a06Form')?.addEventListener('change', () => {
      isDirty = true;
    });
    root.querySelectorAll<HTMLButtonElement>('[data-a06-cancel]').forEach((cancelBtn) => {
      cancelBtn.addEventListener('click', () => {
        if (!isDirty) {
          ctx.navigate('/quan-tri/dich-vu');
          return;
        }
        openConfirmModal({
          title: 'Hủy các thay đổi dịch vụ chưa lưu?',
          description: 'Các trường bạn vừa thay đổi chưa được lưu. Bạn có chắc muốn quay lại danh sách dịch vụ?',
          confirmLabel: 'Rời trang & hủy thay đổi',
          destructive: true,
          onConfirm: () => {
            ctx.navigate('/quan-tri/dich-vu');
          },
        });
      });
    });

    root.querySelector<HTMLFormElement>('#a06Form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = root.querySelector<HTMLButtonElement>('#a06SaveBtn');
      const alertEl = root.querySelector<HTMLElement>('#a06Alert');
      if (!btn || btn.disabled) return;
      alertEl?.classList.add('hidden');
      root.querySelectorAll('[data-err]').forEach((el) => el.classList.add('hidden'));

      btn.disabled = true;
      btn.textContent = 'Đang lưu...';
      try {
        await adminCatalogService.upsertService(editId, {
          destinationId: root.querySelector<HTMLSelectElement>('#a06Dest')?.value ?? '',
          name: root.querySelector<HTMLInputElement>('#a06Name')?.value.trim() ?? '',
          serviceType: root.querySelector<HTMLInputElement>('#a06Type')?.value.trim() ?? '',
          pricePerGuestVnd: Number(root.querySelector<HTMLInputElement>('#a06Price')?.value ?? '0'),
          maxDailyCapacity: Number(root.querySelector<HTMLInputElement>('#a06Cap')?.value ?? '1'),
          imageUrl: galleryCtrl.getMainImageUrl(),
          galleryUrls: galleryCtrl.getGalleryUrls(),
          description: root.querySelector<HTMLTextAreaElement>('#a06Desc')?.value.trim() ?? '',
          status: (root.querySelector<HTMLSelectElement>('#a06Status')?.value ?? 'ACTIVE') as ActiveStatus,
          expectedVersion: s?.version,
        });
        showToast(isEdit ? 'Đã cập nhật dịch vụ.' : 'Đã thêm dịch vụ mới.', 'success');
        ctx.navigate('/quan-tri/dich-vu');
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
        btn.textContent = 'Lưu dịch vụ';
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
