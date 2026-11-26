import type { RouteContext } from '@/app/router';
import { sessionStore } from '@/app/session-store';
import { isAppError, toUserErrorMessage } from '@/api/errors';
import type { ServiceAvailability } from '@/api/contracts';
import { servicesService } from '@/features/services/services.service';
import { renderErrorPage } from '@/features/system/pages/ErrorPage';
import { renderPublicShell } from '@/layouts/public/PublicShell';
import { renderErrorBanner, renderLoadingSkeleton } from '@/shared/components/EmptyErrorState';
import { bindDetailImageGallery, renderDetailImageGallery } from '@/shared/components/ImageGalleryUploader';
import { renderBadge } from '@/shared/components/StatusBadge';
import { bindImageFallbacks, escapeHtml } from '@/shared/utils/dom';
import { formatDateVi, formatVnd } from '@/shared/utils/format';

export async function renderServiceDetailPage(ctx: RouteContext): Promise<void> {
  const serviceId = ctx.params.id ?? '';
  let selectedDate = ctx.query.get('date') || '2027-01-16';
  const rawInitialGuests = Number(ctx.query.get('guests') || '2');
  let guestCount = Number.isInteger(rawInitialGuests) && rawInitialGuests >= 1 ? rawInitialGuests : 2;

  const main = renderPublicShell({
    container: ctx.container,
    activeNav: 'explore',
    contentHtml: `<div id="svcDetailRoot" class="max-w-[1200px] w-full mx-auto px-space-4 md:px-space-6 py-space-6">${renderLoadingSkeleton(2)}</div>`,
  });

  const root = main.querySelector<HTMLElement>('#svcDetailRoot')!;

  const syncQuery = () => {
    const p = new URLSearchParams();
    if (selectedDate) p.set('date', selectedDate);
    if (guestCount > 0) p.set('guests', String(guestCount));
    window.history.replaceState({}, '', `/dich-vu/${encodeURIComponent(serviceId)}?${p.toString()}`);
  };

  const load = async () => {
    root.innerHTML = renderLoadingSkeleton(2);
    try {
      const svc = await servicesService.getDetail(serviceId);
      let avail: ServiceAvailability | null = null;
      let availabilityError = '';
      try {
        avail = await servicesService.checkAvailability(svc.id, selectedDate);
      } catch (err) {
        availabilityError = toUserErrorMessage(err);
      }

      root.innerHTML = `
        <div class="flex flex-col gap-space-6">
          <div class="flex flex-wrap items-center justify-between gap-space-3">
            <a href="/dia-diem/${encodeURIComponent(svc.destinationId)}" class="tl-back-btn">
              <span class="tl-back-icon" aria-hidden="true">
                <span class="material-symbols-outlined text-[16px]">arrow_back</span>
              </span>
              <span>Về ${escapeHtml(svc.destinationName)}</span>
            </a>
            <nav aria-label="Breadcrumb" class="flex flex-wrap items-center gap-space-2 font-body text-body-md text-text-secondary">
              <a href="/" class="tl-breadcrumb-link">Trang chủ</a>
              <span class="text-border">/</span>
              <a href="/dia-diem/${encodeURIComponent(svc.destinationId)}" class="tl-breadcrumb-link">${escapeHtml(svc.destinationName)}</a>
              <span class="text-border">/</span>
              <strong class="text-on-surface">${escapeHtml(svc.name)}</strong>
            </nav>
          </div>

          ${
            !svc.effectivelyBookable
              ? `<div role="alert" class="p-space-4 rounded-lg bg-warning-bg text-on-warning-bg font-body text-body-md flex items-center gap-space-3">
                   <span class="material-symbols-outlined text-[22px]">block</span>
                   <span>Dịch vụ hiện ngừng hoạt động hoặc địa điểm liên kết đang tạm ẩn nên không thể đặt mới.</span>
                 </div>`
              : ''
          }

          <div class="grid grid-cols-1 lg:grid-cols-12 gap-space-6 items-start">
            <!-- Left Info -->
            <section class="lg:col-span-7 flex flex-col gap-space-6">
              ${renderDetailImageGallery(svc.imageUrl, svc.galleryUrls, svc.name)}

              <div class="bg-surface border border-border rounded-xl p-space-6 shadow-sm flex flex-col gap-space-4">
                <div class="flex flex-wrap items-center gap-space-2">
                  <span class="px-space-3 py-space-1 rounded-full bg-primary-light text-primary font-label text-label-sm">${escapeHtml(svc.serviceType)}</span>
                  <span class="px-space-3 py-space-1 rounded-full bg-surface-muted text-text-secondary font-label text-label-sm tabular-nums">${escapeHtml(svc.id)}</span>
                  ${
                    svc.effectivelyBookable
                      ? renderBadge('Đang nhận đặt', 'success', 'check_circle')
                      : renderBadge('Ngừng nhận đặt', 'neutral', 'block')
                  }
                </div>
                <h1 class="font-headline text-headline-lg text-on-surface">${escapeHtml(svc.name)}</h1>
                <p class="font-body text-body-lg text-text-secondary">${escapeHtml(svc.description)}</p>
                <div class="flex flex-wrap items-center gap-space-4 pt-space-2 border-t border-border font-body text-body-md text-text-secondary">
                  <span>Địa điểm liên kết: <a href="/dia-diem/${encodeURIComponent(svc.destinationId)}" class="font-label text-primary hover:underline">${escapeHtml(svc.destinationName)}</a></span>
                  <span>Sức chứa tối đa/ngày: <strong class="text-on-surface tabular-nums">${svc.maxDailyCapacity} khách</strong></span>
                </div>
                <div class="p-space-4 rounded-lg bg-info-bg/60 border border-info/20 font-body text-body-md text-on-surface">
                  <strong>Lưu ý nghiệp vụ:</strong> Đây là đơn dịch vụ nội bộ trên TripLoom. Giá hiển thị trước khi xác nhận là ước tính; giá chụp, chỗ trống và tổng tiền chính thức được máy chủ xác định khi bạn xác nhận đặt đơn.
                </div>
              </div>
            </section>

            <!-- Right Booking Calculator -->
            <aside class="lg:col-span-5 bg-surface border border-border rounded-xl p-space-6 shadow-sm flex flex-col gap-space-5">
              <div>
                <p class="font-label text-label-sm text-text-secondary">Đơn giá tham khảo</p>
                <p class="font-headline text-headline-lg text-primary tabular-nums">${formatVnd(svc.pricePerGuestVnd)} <span class="font-body text-body-md text-text-secondary">/ người</span></p>
              </div>

              <form id="svcCheckForm" novalidate class="flex flex-col gap-space-4">
                <label class="flex flex-col gap-space-1">
                  <span class="font-label text-label-md text-on-surface">Ngày sử dụng <span class="text-error">*</span></span>
                  <input id="svcDateInput" type="date" value="${escapeHtml(selectedDate)}" class="w-full min-h-[44px] px-space-3 rounded border border-border bg-surface text-body-md tabular-nums focus:border-primary focus:ring-2 focus:ring-primary/20" />
                  <span id="svcDateErr" class="hidden font-body text-body-md text-error"></span>
                </label>

                <label class="flex flex-col gap-space-1">
                  <span class="font-label text-label-md text-on-surface">Số lượng khách (1 – ${svc.maxDailyCapacity}) <span class="text-error">*</span></span>
                  <input id="svcGuestsInput" type="number" min="1" max="${svc.maxDailyCapacity}" value="${guestCount}" class="w-full min-h-[44px] px-space-3 rounded border border-border bg-surface text-body-md tabular-nums focus:border-primary focus:ring-2 focus:ring-primary/20" />
                  <span id="svcGuestsErr" class="hidden font-body text-body-md text-error"></span>
                </label>

                <div id="availabilityBox" class="p-space-3 rounded-lg font-body text-body-md"></div>

                <!-- Summary -->
                <div class="p-space-4 rounded-lg bg-background border border-border flex flex-col gap-space-2 font-body text-body-md">
                  <div class="flex justify-between gap-space-2">
                    <span id="svcCalcLabel" class="text-text-secondary"></span>
                    <strong id="svcCalcTotal" class="text-on-surface tabular-nums"></strong>
                  </div>
                  <p class="text-label-sm text-text-secondary">Chưa tạo đơn dịch vụ hay đồng hồ giữ chỗ 15 phút ở bước này.</p>
                </div>

                <button
                  id="proceedBookingBtn"
                  type="submit"
                  class="w-full min-h-[44px] px-space-6 rounded bg-primary text-on-primary hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed font-label text-label-lg transition-colors"
                >
                  Tiếp tục xác nhận đặt dịch vụ
                </button>
              </form>
            </aside>
          </div>
        </div>
      `;

      bindImageFallbacks(root);
      bindDetailImageGallery(root);

      const dateInput = root.querySelector<HTMLInputElement>('#svcDateInput')!;
      const guestsInput = root.querySelector<HTMLInputElement>('#svcGuestsInput')!;
      const dateErr = root.querySelector<HTMLElement>('#svcDateErr')!;
      const guestsErr = root.querySelector<HTMLElement>('#svcGuestsErr')!;
      const availBox = root.querySelector<HTMLElement>('#availabilityBox')!;
      const calcLabel = root.querySelector<HTMLElement>('#svcCalcLabel')!;
      const calcTotal = root.querySelector<HTMLElement>('#svcCalcTotal')!;
      const proceedBtn = root.querySelector<HTMLButtonElement>('#proceedBookingBtn')!;

      const updateSummaryUi = () => {
        dateErr.classList.add('hidden');
        guestsErr.classList.add('hidden');

        let validInputs = true;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
          dateErr.textContent = 'Vui lòng chọn ngày sử dụng hợp lệ.';
          dateErr.classList.remove('hidden');
          validInputs = false;
        }
        const parsedGuests = Number(guestsInput.value);
        if (!Number.isInteger(parsedGuests) || parsedGuests < 1) {
          guestsErr.textContent = 'Số lượng khách phải là số nguyên dương từ 1 trở lên.';
          guestsErr.classList.remove('hidden');
          validInputs = false;
        } else if (parsedGuests > svc.maxDailyCapacity) {
          guestsErr.textContent = `Số khách vượt quá sức chứa tối đa ${svc.maxDailyCapacity} khách/ngày.`;
          guestsErr.classList.remove('hidden');
          validInputs = false;
        } else {
          guestCount = parsedGuests;
        }

        const displayGuests = validInputs ? guestCount : 0;
        calcLabel.textContent = `Tạm tính (${displayGuests} khách × ${formatVnd(svc.pricePerGuestVnd)})`;
        calcTotal.textContent = formatVnd(displayGuests * svc.pricePerGuestVnd);

        if (availabilityError) {
          availBox.className = 'p-space-3 rounded-lg bg-error-bg text-on-error-bg font-body text-body-md';
          availBox.textContent = availabilityError;
          proceedBtn.disabled = true;
          return;
        }

        if (!svc.effectivelyBookable) {
          availBox.className = 'p-space-3 rounded-lg bg-warning-bg text-on-warning-bg font-body text-body-md';
          availBox.textContent = 'Dịch vụ hiện ngừng hoạt động.';
          proceedBtn.disabled = true;
          return;
        }

        if (!avail) {
          availBox.className = 'p-space-3 rounded-lg bg-surface-muted text-text-secondary font-body text-body-md';
          availBox.textContent = 'Đang kiểm tra chỗ trống...';
          proceedBtn.disabled = true;
          return;
        }

        if (!validInputs) {
          availBox.className = 'p-space-3 rounded-lg bg-surface-muted text-text-secondary font-body text-body-md';
          availBox.innerHTML = `Ngày ${formatDateVi(selectedDate)} hiện còn <strong>${avail.remainingCapacity}</strong> / ${avail.maxDailyCapacity} chỗ tham khảo.`;
          proceedBtn.disabled = true;
          return;
        }

        if (avail.remainingCapacity >= guestCount) {
          availBox.className = 'p-space-3 rounded-lg bg-success-bg text-on-success-bg font-body text-body-md';
          availBox.innerHTML = `Ngày ${formatDateVi(selectedDate)} còn khoảng <strong>${avail.remainingCapacity}</strong> / ${avail.maxDailyCapacity} chỗ tham khảo.`;
          proceedBtn.disabled = false;
        } else {
          availBox.className = 'p-space-3 rounded-lg bg-error-bg text-on-error-bg font-body text-body-md';
          availBox.innerHTML = `Ngày ${formatDateVi(selectedDate)} chỉ còn <strong>${avail.remainingCapacity}</strong> chỗ, không đủ cho ${guestCount} khách.`;
          proceedBtn.disabled = true;
        }
      };

      updateSummaryUi();

      dateInput.addEventListener('change', async () => {
        selectedDate = dateInput.value;
        availabilityError = '';
        if (!/^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
          updateSummaryUi();
          return;
        }
        avail = null;
        updateSummaryUi();
        try {
          avail = await servicesService.checkAvailability(svc.id, selectedDate);
        } catch (err) {
          availabilityError = toUserErrorMessage(err);
        }
        syncQuery();
        updateSummaryUi();
      });

      guestsInput.addEventListener('input', () => {
        updateSummaryUi();
        if (!proceedBtn.disabled) syncQuery();
      });

      root.querySelector<HTMLFormElement>('#svcCheckForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        updateSummaryUi();
        if (proceedBtn.disabled) return;
        const target = `/dat-dich-vu/${encodeURIComponent(svc.id)}?date=${encodeURIComponent(selectedDate)}&guests=${guestCount}`;
        if (!sessionStore.isAuthenticated) {
          ctx.navigate(`/dang-nhap?redirect=${encodeURIComponent(target)}`);
          return;
        }
        ctx.navigate(target);
      });
    } catch (err) {
      if (isAppError(err) && err.code === 'NOT_FOUND') {
        renderErrorPage(ctx, { code: '404', title: 'Không tìm thấy dịch vụ', description: err.message });
        return;
      }
      root.innerHTML = renderErrorBanner(toUserErrorMessage(err), 'retrySvcBtn');
      root.querySelector('#retrySvcBtn')?.addEventListener('click', () => void load());
    }
  };

  await load();
}
