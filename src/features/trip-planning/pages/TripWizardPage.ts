import type { RouteContext } from '@/app/router';
import { isAppError, toUserErrorMessage } from '@/api/errors';
import type { Category, TravelPace } from '@/api/contracts';
import { PACE_LABELS, REGIONS } from '@/config/constants';
import { destinationsService } from '@/features/destinations/destinations.service';
import { profileService } from '@/features/profile/profile.service';
import { tripPlanningService } from '@/features/trip-planning/trip-planning.service';
import { renderMemberShell } from '@/layouts/member/MemberShell';
import { renderErrorBanner, renderLoadingSkeleton } from '@/shared/components/EmptyErrorState';
import { showToast } from '@/shared/components/Toast';
import { escapeHtml } from '@/shared/utils/dom';
import { computeEndDateYmd, formatDateVi, formatVnd } from '@/shared/utils/format';

export async function renderTripWizardPage(ctx: RouteContext): Promise<void> {
  const main = renderMemberShell({
    container: ctx.container,
    activeNav: 'plan',
    contentHtml: `<div id="wizardRoot">${renderLoadingSkeleton(2)}</div>`,
  });

  const root = main.querySelector<HTMLElement>('#wizardRoot')!;

  let step = 1;
  let categories: Category[] = [];
  const formState = {
    region: ctx.query.get('region') || 'Đà Nẵng',
    startDate: ctx.query.get('startDate') || '2027-01-15',
    daysCount: Math.max(1, Number(ctx.query.get('days') || '3') || 3),
    partySize: Math.max(1, Number(ctx.query.get('guests') || '2') || 2),
    budgetVnd: Math.max(0, Number(ctx.query.get('budget') || '3000000') || 3000000),
    categoryIds: [] as string[],
    pace: 'MODERATE' as TravelPace,
    notes: '',
  };

  try {
    const [profile, catRes] = await Promise.all([
      profileService.getProfile(),
      destinationsService.listCategories({ includeHidden: false, pageSize: 30 }),
    ]);
    categories = catRes.items;
    // Hồ sơ gợi ý giá trị mặc định nếu URL chưa chỉ định tiêu chí riêng
    if (!ctx.query.get('guests')) formState.partySize = profile.preferences.defaultPartySize;
    if (!ctx.query.get('budget') && profile.preferences.defaultBudgetVnd !== null) {
      formState.budgetVnd = profile.preferences.defaultBudgetVnd;
    }
    formState.categoryIds = [...profile.preferences.categoryIds];
    formState.pace = profile.preferences.pace;
  } catch (err) {
    root.innerHTML = renderErrorBanner(toUserErrorMessage(err));
    return;
  }

  let fieldErrors: Record<string, string> = {};
  let globalError = '';
  let submitting = false;

  const validateCurrentStep = (): boolean => {
    fieldErrors = {};
    if (step === 1) {
      if (!formState.region.trim()) fieldErrors.region = 'Vui lòng chọn khu vực du lịch.';
      if (!/^\d{4}-\d{2}-\d{2}$/.test(formState.startDate)) fieldErrors.startDate = 'Vui lòng chọn ngày bắt đầu hợp lệ.';
      if (!Number.isInteger(formState.daysCount) || formState.daysCount < 1 || formState.daysCount > 14) {
        fieldErrors.daysCount = 'Số ngày phải là số nguyên từ 1 đến 14.';
      }
    } else if (step === 2) {
      if (!Number.isInteger(formState.partySize) || formState.partySize < 1 || formState.partySize > 50) {
        fieldErrors.partySize = 'Số khách phải là số nguyên dương từ 1 đến 50.';
      }
      if (Number.isNaN(formState.budgetVnd) || formState.budgetVnd < 0) {
        fieldErrors.budgetVnd = 'Ngân sách hoạt động không được là số âm.';
      }
    }
    return Object.keys(fieldErrors).length === 0;
  };

  const render = () => {
    const endDate = computeEndDateYmd(formState.startDate, formState.daysCount);
    const selectedCatNames = categories
      .filter((c) => formState.categoryIds.includes(c.id))
      .map((c) => c.name);

    const stepBadge = (num: number, label: string) => {
      const cls =
        step === num
          ? 'bg-primary text-on-primary'
          : step > num
            ? 'bg-success-bg text-on-success-bg'
            : 'bg-surface-muted text-text-secondary';
      return `<div class="p-space-3 rounded-lg ${cls} font-label text-label-sm flex items-center gap-space-2">
        <span class="w-6 h-6 rounded-full bg-white/20 inline-flex items-center justify-center tabular-nums">${num}</span>
        <span class="truncate">${escapeHtml(label)}</span>
      </div>`;
    };

    const stepBody =
      step === 1
        ? `
          <div class="flex flex-col gap-space-4">
            <h2 class="font-headline text-headline-md text-on-surface">Bước 1: Điểm đến &amp; thời gian</h2>
            <label class="flex flex-col gap-space-1">
              <span class="font-label text-label-md text-on-surface">Khu vực du lịch <span class="text-error">*</span></span>
              <select id="wizRegion" class="w-full min-h-[44px] px-space-4 rounded border border-border bg-surface text-body-md">
                ${REGIONS.map(
                  (r) => `<option value="${escapeHtml(r)}" ${formState.region === r ? 'selected' : ''}>${escapeHtml(r)}</option>`,
                ).join('')}
              </select>
              ${fieldErrors.region ? `<span class="text-body-md text-error">${escapeHtml(fieldErrors.region)}</span>` : ''}
            </label>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-space-4">
              <label class="flex flex-col gap-space-1">
                <span class="font-label text-label-md text-on-surface">Ngày bắt đầu <span class="text-error">*</span></span>
                <input id="wizStartDate" type="date" value="${escapeHtml(formState.startDate)}" class="w-full min-h-[44px] px-space-4 rounded border border-border bg-surface text-body-md tabular-nums" />
                ${fieldErrors.startDate ? `<span class="text-body-md text-error">${escapeHtml(fieldErrors.startDate)}</span>` : ''}
              </label>

              <label class="flex flex-col gap-space-1">
                <span class="font-label text-label-md text-on-surface">Số ngày dự kiến (1 – 14) <span class="text-error">*</span></span>
                <input id="wizDays" type="number" min="1" max="14" value="${formState.daysCount}" class="w-full min-h-[44px] px-space-4 rounded border border-border bg-surface text-body-md tabular-nums" />
                ${fieldErrors.daysCount ? `<span class="text-body-md text-error">${escapeHtml(fieldErrors.daysCount)}</span>` : ''}
              </label>
            </div>

            <div id="wizEndDatePreview" class="p-space-3 rounded-lg bg-primary-light text-on-surface font-body text-body-md tabular-nums">
              Ngày kết thúc dự kiến: <strong class="text-primary">${formatDateVi(endDate)}</strong> (${formState.daysCount} ngày)
            </div>
          </div>
        `
        : step === 2
          ? `
            <div class="flex flex-col gap-space-4">
              <h2 class="font-headline text-headline-md text-on-surface">Bước 2: Thành viên &amp; ngân sách hoạt động</h2>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-space-4">
                <label class="flex flex-col gap-space-1">
                  <span class="font-label text-label-md text-on-surface">Số lượng khách <span class="text-error">*</span></span>
                  <input id="wizPartySize" type="number" min="1" max="50" value="${formState.partySize}" class="w-full min-h-[44px] px-space-4 rounded border border-border bg-surface text-body-md tabular-nums" />
                  ${fieldErrors.partySize ? `<span class="text-body-md text-error">${escapeHtml(fieldErrors.partySize)}</span>` : ''}
                </label>

                <label class="flex flex-col gap-space-1">
                  <span class="font-label text-label-md text-on-surface">Ngân sách hoạt động toàn đoàn (VND) <span class="text-error">*</span></span>
                  <input id="wizBudget" type="number" min="0" step="50000" value="${formState.budgetVnd}" class="w-full min-h-[44px] px-space-4 rounded border border-border bg-surface text-body-md tabular-nums" />
                  ${fieldErrors.budgetVnd ? `<span class="text-body-md text-error">${escapeHtml(fieldErrors.budgetVnd)}</span>` : ''}
                </label>
              </div>

              <div class="p-space-4 rounded-lg bg-info-bg/70 border border-info/25 font-body text-body-md text-on-surface">
                <p class="font-label text-label-md text-on-info-bg">Phạm vi ngân sách được tính</p>
                <p id="wizBudgetScopePreview" class="mt-space-1">Ngân sách này là <strong>tổng chi phí hoạt động tham quan cho toàn đoàn (${formState.partySize} khách) trong toàn chuyến đi (${formState.daysCount} ngày)</strong>. Phạm vi này <strong>không mặc nhiên bao gồm</strong> vé máy bay, khách sạn, ăn uống và di chuyển ngoài danh mục nội bộ.</p>
              </div>
            </div>
          `
          : `
            <div class="flex flex-col gap-space-4">
              <h2 class="font-headline text-headline-md text-on-surface">Bước 3: Sở thích &amp; xem lại yêu cầu</h2>
              <fieldset class="flex flex-col gap-space-2">
                <legend class="font-label text-label-md text-on-surface">Danh mục sở thích cho chuyến này</legend>
                <div class="flex flex-wrap gap-space-2">
                  ${categories
                    .map((c) => {
                      const checked = formState.categoryIds.includes(c.id);
                      return `
                        <label class="cursor-pointer">
                          <input type="checkbox" name="wizCat" value="${escapeHtml(c.id)}" ${checked ? 'checked' : ''} class="sr-only peer" />
                          <span class="inline-flex items-center min-h-[44px] px-space-4 rounded-full border border-border bg-surface peer-checked:border-primary peer-checked:bg-primary-light peer-checked:text-primary font-label text-label-md">${escapeHtml(c.name)}</span>
                        </label>
                      `;
                    })
                    .join('')}
                </div>
              </fieldset>

              <fieldset class="flex flex-col gap-space-2">
                <legend class="font-label text-label-md text-on-surface">Nhịp độ tham quan</legend>
                <div class="grid grid-cols-3 gap-space-2">
                  ${(['SLOW', 'MODERATE', 'FAST'] as TravelPace[])
                    .map(
                      (p) => `
                    <label class="cursor-pointer">
                      <input type="radio" name="wizPace" value="${p}" ${formState.pace === p ? 'checked' : ''} class="sr-only peer" />
                      <span class="w-full min-h-[44px] px-space-3 rounded border border-border bg-surface peer-checked:border-primary peer-checked:bg-primary-light peer-checked:text-primary inline-flex items-center justify-center font-label text-label-md">${PACE_LABELS[p]}</span>
                    </label>
                  `,
                    )
                    .join('')}
                </div>
              </fieldset>

              <label class="flex flex-col gap-space-1">
                <span class="font-label text-label-md text-on-surface">Ghi chú thêm (tùy chọn)</span>
                <textarea id="wizNotes" rows="2" placeholder="Ví dụ: ưu tiên buổi chiều ngắm hoàng hôn, tránh di chuyển quá nhiều..." class="w-full p-space-3 rounded border border-border bg-surface text-body-md">${escapeHtml(formState.notes)}</textarea>
              </label>
            </div>
          `;

    root.innerHTML = `
      <div class="flex flex-col gap-space-6">
        <div>
          <h1 class="font-headline text-headline-lg text-on-surface">Lập lịch trình chuyến đi</h1>
          <p class="font-body text-body-md text-text-secondary">Nhập yêu cầu của bạn theo 3 bước để xem danh sách địa điểm phù hợp từ danh mục nội bộ trước khi tạo lịch trình AI.</p>
        </div>

        <div class="grid grid-cols-3 gap-space-3" aria-label="Tiến độ lập lịch trình">
          ${stepBadge(1, 'Điểm đến & thời gian')}
          ${stepBadge(2, 'Thành viên & ngân sách')}
          ${stepBadge(3, 'Sở thích & xem lại')}
        </div>

        ${globalError ? `<div role="alert" class="p-space-4 rounded-lg bg-error-bg text-on-error-bg font-body text-body-md">${escapeHtml(globalError)}</div>` : ''}

        <div class="grid grid-cols-1 lg:grid-cols-12 gap-space-6 items-start">
          <section class="lg:col-span-8 bg-surface border border-border rounded-xl p-space-6 shadow-sm flex flex-col gap-space-6">
            ${stepBody}

            <div class="flex flex-wrap items-center justify-between gap-space-3 pt-space-4 border-t border-border">
              ${
                step > 1
                  ? `<button type="button" id="wizPrevBtn" class="tl-back-btn">
                       <span class="tl-back-icon" aria-hidden="true">
                         <span class="material-symbols-outlined text-[16px]">arrow_back</span>
                       </span>
                       <span>Quay lại bước trước</span>
                     </button>`
                  : `<span></span>`
              }
              ${
                step < 3
                  ? `<button type="button" id="wizNextBtn" class="min-h-[44px] px-space-6 rounded bg-primary text-on-primary hover:bg-primary-hover font-label text-label-md">Tiếp tục</button>`
                  : `<button type="button" id="wizSubmitBtn" ${submitting ? 'disabled' : ''} class="min-h-[44px] px-space-6 rounded bg-primary text-on-primary hover:bg-primary-hover disabled:opacity-60 font-label text-label-lg">${submitting ? 'Đang kiểm tra...' : 'Xem địa điểm phù hợp'}</button>`
              }
            </div>
          </section>

          <!-- TripSummary Panel -->
          <aside class="lg:col-span-4 bg-surface border border-border rounded-xl p-space-6 shadow-sm flex flex-col gap-space-4">
            <h2 class="font-headline text-headline-md text-on-surface">Tóm tắt chuyến đi</h2>
            <dl class="flex flex-col gap-space-3 font-body text-body-md">
              <div class="flex justify-between gap-space-2">
                <dt class="text-text-secondary">Khu vực</dt>
                <dd id="wizSumRegion" class="font-label text-on-surface text-right">${escapeHtml(formState.region)}</dd>
              </div>
              <div class="flex justify-between gap-space-2">
                <dt class="text-text-secondary">Thời gian</dt>
                <dd id="wizSumDuration" class="font-label text-on-surface text-right tabular-nums">${formatDateVi(formState.startDate)} – ${formatDateVi(endDate)} (${formState.daysCount} ngày)</dd>
              </div>
              <div class="flex justify-between gap-space-2">
                <dt class="text-text-secondary">Số khách</dt>
                <dd id="wizSumParty" class="font-label text-on-surface tabular-nums">${formState.partySize} khách</dd>
              </div>
              <div class="flex justify-between gap-space-2">
                <dt class="text-text-secondary">Ngân sách hoạt động</dt>
                <dd id="wizSumBudget" class="font-label text-primary tabular-nums">${formatVnd(formState.budgetVnd)}</dd>
              </div>
              <div class="flex justify-between gap-space-2">
                <dt class="text-text-secondary">Nhịp độ</dt>
                <dd id="wizSumPace" class="font-label text-on-surface">${PACE_LABELS[formState.pace]}</dd>
              </div>
              <div class="flex flex-col gap-space-1 border-t border-border pt-space-2">
                <dt class="text-text-secondary">Sở thích</dt>
                <dd id="wizSumCats" class="font-label text-on-surface">${selectedCatNames.length > 0 ? escapeHtml(selectedCatNames.join(', ')) : 'Tất cả danh mục'}</dd>
              </div>
            </dl>
            <p class="font-body text-label-sm text-text-secondary border-t border-border pt-space-3">
              Ngân sách áp dụng cho hoạt động toàn đoàn trong toàn chuyến đi; không mặc nhiên bao gồm vé máy bay, khách sạn và ăn uống ngoài danh mục.
            </p>
          </aside>
        </div>
      </div>
    `;

    // Bind current step inputs
    const syncStepInputs = () => {
      if (step === 1) {
        const reg = root.querySelector<HTMLSelectElement>('#wizRegion');
        const sd = root.querySelector<HTMLInputElement>('#wizStartDate');
        const dc = root.querySelector<HTMLInputElement>('#wizDays');
        if (reg) formState.region = reg.value;
        if (sd) formState.startDate = sd.value;
        if (dc) formState.daysCount = Number(dc.value);
      } else if (step === 2) {
        const ps = root.querySelector<HTMLInputElement>('#wizPartySize');
        const bg = root.querySelector<HTMLInputElement>('#wizBudget');
        if (ps) formState.partySize = Number(ps.value);
        if (bg) formState.budgetVnd = Number(bg.value);
      } else {
        formState.categoryIds = Array.from(root.querySelectorAll<HTMLInputElement>('input[name="wizCat"]:checked')).map(
          (i) => i.value,
        );
        const paceEl = root.querySelector<HTMLInputElement>('input[name="wizPace"]:checked');
        if (paceEl) formState.pace = paceEl.value as TravelPace;
        const notesEl = root.querySelector<HTMLTextAreaElement>('#wizNotes');
        if (notesEl) formState.notes = notesEl.value;
      }
    };

    const updateSummaryInPlace = () => {
      const nextEnd = computeEndDateYmd(formState.startDate, formState.daysCount);
      const nextCats = categories.filter((c) => formState.categoryIds.includes(c.id)).map((c) => c.name);
      const endPreview = root.querySelector<HTMLElement>('#wizEndDatePreview');
      if (endPreview) {
        endPreview.innerHTML = `Ngày kết thúc dự kiến: <strong class="text-primary">${formatDateVi(nextEnd)}</strong> (${formState.daysCount} ngày)`;
      }
      const scopePreview = root.querySelector<HTMLElement>('#wizBudgetScopePreview');
      if (scopePreview) {
        scopePreview.innerHTML = `Ngân sách này là <strong>tổng chi phí hoạt động tham quan cho toàn đoàn (${formState.partySize} khách) trong toàn chuyến đi (${formState.daysCount} ngày)</strong>. Phạm vi này <strong>không mặc nhiên bao gồm</strong> vé máy bay, khách sạn, ăn uống và di chuyển ngoài danh mục nội bộ.`;
      }
      const sumRegion = root.querySelector<HTMLElement>('#wizSumRegion');
      if (sumRegion) sumRegion.textContent = formState.region;
      const sumDuration = root.querySelector<HTMLElement>('#wizSumDuration');
      if (sumDuration) sumDuration.textContent = `${formatDateVi(formState.startDate)} – ${formatDateVi(nextEnd)} (${formState.daysCount} ngày)`;
      const sumParty = root.querySelector<HTMLElement>('#wizSumParty');
      if (sumParty) sumParty.textContent = `${formState.partySize} khách`;
      const sumBudget = root.querySelector<HTMLElement>('#wizSumBudget');
      if (sumBudget) sumBudget.textContent = formatVnd(formState.budgetVnd);
      const sumPace = root.querySelector<HTMLElement>('#wizSumPace');
      if (sumPace) sumPace.textContent = PACE_LABELS[formState.pace];
      const sumCats = root.querySelector<HTMLElement>('#wizSumCats');
      if (sumCats) sumCats.textContent = nextCats.length > 0 ? nextCats.join(', ') : 'Tất cả danh mục';
    };

    root.querySelectorAll('input, select, textarea').forEach((el) => {
      const handler = () => {
        syncStepInputs();
        updateSummaryInPlace();
      };
      el.addEventListener('input', handler);
      el.addEventListener('change', handler);
    });

    root.querySelector('#wizPrevBtn')?.addEventListener('click', () => {
      syncStepInputs();
      step = Math.max(1, step - 1);
      fieldErrors = {};
      render();
    });

    root.querySelector('#wizNextBtn')?.addEventListener('click', () => {
      syncStepInputs();
      if (!validateCurrentStep()) {
        render();
        return;
      }
      step = Math.min(3, step + 1);
      render();
    });

    root.querySelector('#wizSubmitBtn')?.addEventListener('click', async () => {
      syncStepInputs();
      if (submitting) return;
      submitting = true;
      globalError = '';
      render();

      try {
        const created = await tripPlanningService.createTripRequest({
          region: formState.region,
          startDate: formState.startDate,
          daysCount: formState.daysCount,
          partySize: formState.partySize,
          budgetVnd: formState.budgetVnd,
          budgetScopeNote: `Ngân sách áp dụng cho hoạt động tham quan của toàn đoàn (${formState.partySize} khách) trong ${formState.daysCount} ngày; không mặc nhiên bao gồm vé máy bay, khách sạn, ăn uống và di chuyển ngoài danh mục.`,
          categoryIds: formState.categoryIds,
          pace: formState.pace,
          notes: formState.notes.trim(),
        });
        ctx.navigate(`/de-xuat?draft_request=${encodeURIComponent(created.id)}`);
      } catch (err) {
        if (isAppError(err)) fieldErrors = err.fieldErrors;
        globalError = toUserErrorMessage(err);
        showToast(globalError, 'error');
        submitting = false;
        render();
      }
    });
  };

  render();
}
