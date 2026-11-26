import type { RouteContext } from '@/app/router';
import { isAppError, toUserErrorMessage } from '@/api/errors';
import { bookingsService } from '@/features/bookings/bookings.service';
import { profileService } from '@/features/profile/profile.service';
import { servicesService } from '@/features/services/services.service';
import { renderErrorPage } from '@/features/system/pages/ErrorPage';
import { renderMemberShell } from '@/layouts/member/MemberShell';
import { renderErrorBanner, renderLoadingSkeleton } from '@/shared/components/EmptyErrorState';
import { showToast } from '@/shared/components/Toast';
import { escapeHtml } from '@/shared/utils/dom';
import { formatDateVi, formatVnd } from '@/shared/utils/format';

export async function renderBookingConfirmPage(ctx: RouteContext): Promise<void> {
  const serviceId = ctx.params.serviceId ?? '';
  let serviceDate = ctx.query.get('date') || '2027-01-16';
  const rawInitialGuests = Number(ctx.query.get('guests') || '2');
  let guestCount = Number.isInteger(rawInitialGuests) && rawInitialGuests >= 1 ? rawInitialGuests : 2;
  let contactNameState: string | null = null;
  let contactPhoneState: string | null = null;
  let idempotencyKey = `IDEMP_${serviceId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const main = renderMemberShell({
    container: ctx.container,
    activeNav: 'bookings',
    contentHtml: `<div id="b01Root">${renderLoadingSkeleton(2)}</div>`,
  });

  const root = main.querySelector<HTMLElement>('#b01Root')!;

  const load = async (priceChangeBanner?: string) => {
    // Lưu lại thông tin liên hệ người dùng đã nhập trước khi cập nhật giao diện
    const currentNameEl = root.querySelector<HTMLInputElement>('#b01ContactName');
    const currentPhoneEl = root.querySelector<HTMLInputElement>('#b01ContactPhone');
    if (currentNameEl) contactNameState = currentNameEl.value;
    if (currentPhoneEl) contactPhoneState = currentPhoneEl.value;

    if (!root.children.length || priceChangeBanner) {
      root.innerHTML = renderLoadingSkeleton(2);
    }
    try {
      const [svc, profile, avail] = await Promise.all([
        servicesService.getDetail(serviceId),
        profileService.getProfile(),
        servicesService.checkAvailability(serviceId, serviceDate),
      ]);

      const contactName = contactNameState ?? profile.fullName;
      const contactPhone = contactPhoneState ?? (profile.phone || '0905 123 456');
      const estimatedTotal = svc.pricePerGuestVnd * guestCount;
      const canSubmit = svc.effectivelyBookable && avail.remainingCapacity >= guestCount && guestCount >= 1;

      root.innerHTML = `
        <div class="flex flex-col gap-space-6">
          <div class="flex flex-col gap-space-2">
            <a href="/dich-vu/${encodeURIComponent(svc.id)}?date=${encodeURIComponent(serviceDate)}&guests=${guestCount}" class="tl-back-btn self-start">
              <span class="tl-back-icon" aria-hidden="true">
                <span class="material-symbols-outlined text-[16px]">arrow_back</span>
              </span>
              <span>Quay lại chi tiết dịch vụ</span>
            </a>
            <h1 class="font-headline text-headline-lg text-on-surface">Xác nhận đặt dịch vụ</h1>
            <p class="font-body text-body-md text-text-secondary">Kiểm tra lại ngày sử dụng, số khách và thông tin liên hệ trước khi tạo đơn giữ chỗ 15 phút.</p>
          </div>

          ${
            priceChangeBanner
              ? `<div role="alert" class="p-space-4 rounded-lg bg-warning-bg border border-warning/30 text-on-warning-bg font-body text-body-md">${escapeHtml(priceChangeBanner)}</div>`
              : ''
          }
          <div id="b01Alert" role="alert" class="hidden p-space-4 rounded-lg bg-error-bg text-on-error-bg font-body text-body-md"></div>

          <form id="b01Form" novalidate class="grid grid-cols-1 lg:grid-cols-12 gap-space-6 items-start">
            <section class="lg:col-span-7 bg-surface border border-border rounded-xl p-space-6 shadow-sm flex flex-col gap-space-4">
              <h2 class="font-headline text-headline-md text-on-surface">Thông tin đặt dịch vụ</h2>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-space-4">
                <label class="flex flex-col gap-space-1">
                  <span class="font-label text-label-md text-on-surface">Ngày sử dụng <span class="text-error">*</span></span>
                  <input id="b01Date" type="date" value="${escapeHtml(serviceDate)}" class="w-full min-h-[44px] px-space-3 rounded border border-border bg-surface text-body-md tabular-nums" />
                  <span data-err="serviceDate" class="hidden text-body-md text-error"></span>
                </label>

                <label class="flex flex-col gap-space-1">
                  <span class="font-label text-label-md text-on-surface">Số khách (1 – ${svc.maxDailyCapacity}) <span class="text-error">*</span></span>
                  <input id="b01Guests" type="number" min="1" max="${svc.maxDailyCapacity}" value="${guestCount}" class="w-full min-h-[44px] px-space-3 rounded border border-border bg-surface text-body-md tabular-nums" />
                  <span data-err="guestCount" class="hidden text-body-md text-error"></span>
                </label>
              </div>

              <div id="b01AvailBanner" class="p-space-3 rounded-lg ${
                canSubmit ? 'bg-success-bg text-on-success-bg' : 'bg-error-bg text-on-error-bg'
              } font-body text-body-md">
                ${
                  !svc.effectivelyBookable
                    ? 'Dịch vụ hiện đã ngừng hoạt động.'
                    : avail.remainingCapacity >= guestCount
                      ? `Ngày ${formatDateVi(serviceDate)} còn <strong>${avail.remainingCapacity}</strong> chỗ trống tham khảo.`
                      : `Ngày ${formatDateVi(serviceDate)} chỉ còn <strong>${avail.remainingCapacity}</strong> chỗ, không đủ cho ${guestCount} khách.`
                }
              </div>

              <h3 class="font-title text-title-md text-on-surface pt-space-2 border-t border-border">Thông tin liên hệ</h3>

              <label class="flex flex-col gap-space-1">
                <span class="font-label text-label-md text-on-surface">Họ và tên người liên hệ <span class="text-error">*</span></span>
                <input id="b01ContactName" type="text" value="${escapeHtml(contactName)}" class="w-full min-h-[44px] px-space-4 rounded border border-border bg-surface text-body-md" />
                <span data-err="contactName" class="hidden text-body-md text-error"></span>
              </label>

              <label class="flex flex-col gap-space-1">
                <span class="font-label text-label-md text-on-surface">Số điện thoại liên hệ <span class="text-error">*</span></span>
                <input id="b01ContactPhone" type="tel" value="${escapeHtml(contactPhone)}" placeholder="Ví dụ: 0905 123 456" class="w-full min-h-[44px] px-space-4 rounded border border-border bg-surface text-body-md tabular-nums" />
                <span data-err="contactPhone" class="hidden text-body-md text-error"></span>
              </label>

              <p class="font-body text-label-sm text-text-secondary bg-surface-muted p-space-3 rounded-lg">
                Đơn đặt dịch vụ được quản lý nội bộ trên TripLoom. Giá hiển thị ở đây là ước tính; sau khi bấm xác nhận, máy chủ sẽ chụp đơn giá, tính tổng tiền chính thức và giữ chỗ trong 15 phút để thanh toán qua SePay.
              </p>
            </section>

            <aside class="lg:col-span-5 bg-surface border border-border rounded-xl p-space-6 shadow-sm flex flex-col gap-space-4">
              <h2 class="font-headline text-headline-md text-on-surface">Tóm tắt đơn tạm tính</h2>
              <div class="flex flex-col gap-space-1">
                <span class="font-label text-label-sm text-primary tabular-nums">${escapeHtml(svc.id)} · ${escapeHtml(svc.destinationName)}</span>
                <p class="font-title text-title-md text-on-surface">${escapeHtml(svc.name)}</p>
              </div>
              <dl class="flex flex-col gap-space-2 font-body text-body-md border-y border-border py-space-4">
                <div class="flex justify-between">
                  <dt class="text-text-secondary">Ngày sử dụng</dt>
                  <dd id="b01SumDate" class="font-label text-on-surface tabular-nums">${formatDateVi(serviceDate)}</dd>
                </div>
                <div class="flex justify-between">
                  <dt class="text-text-secondary">Số khách</dt>
                  <dd id="b01SumGuests" class="font-label text-on-surface tabular-nums">${guestCount} khách</dd>
                </div>
                <div class="flex justify-between">
                  <dt class="text-text-secondary">Đơn giá ước tính</dt>
                  <dd class="font-label text-on-surface tabular-nums">${formatVnd(svc.pricePerGuestVnd)} / khách</dd>
                </div>
                <div class="flex justify-between pt-space-2 border-t border-border">
                  <dt id="b01SumFormula" class="font-label text-label-md text-on-surface">Tổng tạm tính (${guestCount} × ${formatVnd(svc.pricePerGuestVnd)})</dt>
                  <dd id="b01SumTotal" class="font-headline text-headline-md text-primary tabular-nums">${formatVnd(estimatedTotal)}</dd>
                </div>
              </dl>

              <button
                id="b01SubmitBtn"
                type="submit"
                ${!canSubmit ? 'disabled' : ''}
                class="w-full min-h-[44px] px-space-6 rounded bg-primary text-on-primary hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed font-label text-label-lg transition-colors"
              >
                Xác nhận đặt và thanh toán
              </button>
              <p class="font-body text-label-sm text-text-secondary text-center">Chưa bắt đầu đếm ngược 15 phút cho đến khi máy chủ tạo đơn thành công.</p>
            </aside>
          </form>
        </div>
      `;

      const setFieldErr = (key: string, msg: string | null) => {
        const el = root.querySelector<HTMLElement>(`[data-err="${key}"]`);
        if (!el) return;
        if (msg) {
          el.textContent = msg;
          el.classList.remove('hidden');
        } else {
          el.classList.add('hidden');
        }
      };

      root.querySelector<HTMLInputElement>('#b01Date')?.addEventListener('change', (e) => {
        const val = (e.target as HTMLInputElement).value;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(val)) {
          setFieldErr('serviceDate', 'Vui lòng chọn ngày sử dụng hợp lệ.');
          root.querySelector<HTMLButtonElement>('#b01SubmitBtn')?.setAttribute('disabled', 'true');
          return;
        }
        serviceDate = val;
        idempotencyKey = `IDEMP_${serviceId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        void load();
      });

      root.querySelector<HTMLInputElement>('#b01Guests')?.addEventListener('input', (e) => {
        const raw = Number((e.target as HTMLInputElement).value);
        const btn = root.querySelector<HTMLButtonElement>('#b01SubmitBtn');
        if (!Number.isInteger(raw) || raw < 1) {
          setFieldErr('guestCount', 'Số khách phải là số nguyên dương từ 1 trở lên.');
          if (btn) btn.disabled = true;
          return;
        }
        if (raw > avail.remainingCapacity) {
          setFieldErr('guestCount', `Ngày này chỉ còn ${avail.remainingCapacity} chỗ trống.`);
          if (btn) btn.disabled = true;
          return;
        }
        setFieldErr('guestCount', null);
        guestCount = raw;
        idempotencyKey = `IDEMP_${serviceId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const gEl = root.querySelector('#b01SumGuests');
        const fEl = root.querySelector('#b01SumFormula');
        const tEl = root.querySelector('#b01SumTotal');
        if (gEl) gEl.textContent = `${guestCount} khách`;
        if (fEl) fEl.textContent = `Tổng tạm tính (${guestCount} × ${formatVnd(svc.pricePerGuestVnd)})`;
        if (tEl) tEl.textContent = formatVnd(guestCount * svc.pricePerGuestVnd);
        if (btn) btn.disabled = !svc.effectivelyBookable;
      });

      root.querySelector<HTMLFormElement>('#b01Form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = root.querySelector<HTMLButtonElement>('#b01SubmitBtn');
        const alertEl = root.querySelector<HTMLElement>('#b01Alert');
        if (!btn || btn.disabled) return;

        alertEl?.classList.add('hidden');
        root.querySelectorAll('[data-err]').forEach((el) => el.classList.add('hidden'));

        const cName = root.querySelector<HTMLInputElement>('#b01ContactName')?.value.trim() ?? '';
        const cPhone = root.querySelector<HTMLInputElement>('#b01ContactPhone')?.value.trim() ?? '';
        contactNameState = cName;
        contactPhoneState = cPhone;

        let invalid = false;
        if (cName.length < 2) {
          setFieldErr('contactName', 'Vui lòng nhập họ tên người liên hệ (tối thiểu 2 ký tự).');
          invalid = true;
        }
        if (cPhone.length < 8) {
          setFieldErr('contactPhone', 'Vui lòng nhập số điện thoại liên hệ hợp lệ.');
          invalid = true;
        }
        if (invalid) return;

        btn.disabled = true;
        btn.textContent = 'Đang tạo đơn giữ chỗ...';
        try {
          const { booking } = await bookingsService.createBooking({
            serviceId: svc.id,
            serviceDate,
            guestCount,
            contactName: cName,
            contactPhone: cPhone,
            acknowledgedUnitPriceVnd: svc.pricePerGuestVnd,
            idempotencyKey,
          });
          showToast(`Đã tạo đơn ${booking.id}. Thời gian giữ chỗ là 15 phút.`, 'success');
          ctx.navigate(`/thanh-toan/${encodeURIComponent(booking.id)}`, { replace: true });
        } catch (err) {
          if (isAppError(err)) {
            if (err.code === 'PRICE_CHANGED') {
              idempotencyKey = `IDEMP_${serviceId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
              await load(err.message);
              return;
            }
            Object.entries(err.fieldErrors).forEach(([k, v]) => setFieldErr(k, v));
          }
          if (alertEl) {
            alertEl.textContent = toUserErrorMessage(err);
            alertEl.classList.remove('hidden');
          }
          btn.disabled = false;
          btn.textContent = 'Xác nhận đặt và thanh toán';
        }
      });
    } catch (err) {
      if (isAppError(err) && err.code === 'NOT_FOUND') {
        renderErrorPage(ctx, { code: '404', description: err.message });
        return;
      }
      root.innerHTML = renderErrorBanner(toUserErrorMessage(err), 'retryB01');
      root.querySelector('#retryB01')?.addEventListener('click', () => void load());
    }
  };

  await load();
}
