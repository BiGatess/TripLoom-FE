import type { RouteContext } from '@/app/router';
import { isAppError, toUserErrorMessage } from '@/api/errors';
import type { Destination, Itinerary, ItineraryActivity, RegenerateDayPreview } from '@/api/contracts';
import { PACE_LABELS } from '@/config/constants';
import { destinationsService } from '@/features/destinations/destinations.service';
import { itinerariesService } from '@/features/itineraries/itineraries.service';
import { renderErrorPage } from '@/features/system/pages/ErrorPage';
import { renderMemberShell } from '@/layouts/member/MemberShell';
import { renderEmptyState, renderErrorBanner, renderLoadingSkeleton } from '@/shared/components/EmptyErrorState';
import { openConfirmModal, openModal } from '@/shared/components/Modal';
import { renderBadge } from '@/shared/components/StatusBadge';
import { showToast } from '@/shared/components/Toast';
import { escapeHtml } from '@/shared/utils/dom';
import { formatDateTimeVi, formatDateVi, formatVnd } from '@/shared/utils/format';

export async function renderItineraryDetailPage(ctx: RouteContext): Promise<void> {
  const itineraryId = ctx.params.draftId ?? ctx.params.id ?? '';
  let activeDayNumber = 1;
  let current: Itinerary | null = null;
  let publicDestinations: Destination[] = [];

  const main = renderMemberShell({
    container: ctx.container,
    activeNav: 'itineraries',
    contentHtml: `<div id="itineraryRoot">${renderLoadingSkeleton(2)}</div>`,
  });

  const root = main.querySelector<HTMLElement>('#itineraryRoot')!;

  const load = async () => {
    root.innerHTML = renderLoadingSkeleton(2);
    try {
      const [it, destRes] = await Promise.all([
        itinerariesService.getItinerary(itineraryId),
        destinationsService.listDestinations({ page: 1, pageSize: 50 }),
      ]);
      current = it;
      publicDestinations = destRes.items;
      if (!it.days.some((d) => d.dayNumber === activeDayNumber)) {
        activeDayNumber = it.days[0]?.dayNumber ?? 1;
      }
      renderView();
    } catch (err) {
      if (isAppError(err) && (err.code === 'NOT_FOUND' || err.code === 'FORBIDDEN')) {
        renderErrorPage(ctx, {
          code: err.code === 'FORBIDDEN' ? '403' : '404',
          description: err.message,
        });
        return;
      }
      root.innerHTML = renderErrorBanner(toUserErrorMessage(err), 'retryItBtn');
      root.querySelector('#retryItBtn')?.addEventListener('click', () => void load());
    }
  };

  const isDraftExpired = (it: Itinerary): boolean => {
    if (!it.isDraft || !it.draftExpiresAt) return false;
    return new Date(it.draftExpiresAt).getTime() <= Date.now();
  };

  const openActivityDrawer = (it: Itinerary, existing?: ItineraryActivity) => {
    const isEdit = Boolean(existing);
    openModal({
      title: isEdit ? 'Sửa hoạt động' : `Thêm hoạt động vào Ngày ${activeDayNumber}`,
      subtitle: 'Áp dụng vào bản kế hoạch hiện tại của ngày đang chọn. Các ngày khác và đơn dịch vụ đã đặt giữ nguyên.',
      size: 'drawer',
      bodyHtml: `
        <form id="u06Form" novalidate class="flex flex-col gap-space-4">
          <div id="u06Alert" role="alert" class="hidden p-space-3 rounded bg-error-bg text-on-error-bg font-body text-body-md"></div>

          <fieldset class="flex flex-col gap-space-2">
            <legend class="font-label text-label-md text-on-surface">Loại hoạt động</legend>
            <div class="grid grid-cols-2 gap-space-2">
              <label class="cursor-pointer">
                <input type="radio" name="actType" value="DESTINATION" ${(existing?.type ?? 'DESTINATION') === 'DESTINATION' ? 'checked' : ''} class="sr-only peer" />
                <span class="w-full min-h-[44px] px-space-3 rounded border border-border peer-checked:border-primary peer-checked:bg-primary-light peer-checked:text-primary inline-flex items-center justify-center font-label text-label-md">Địa điểm danh mục</span>
              </label>
              <label class="cursor-pointer">
                <input type="radio" name="actType" value="REST_NOTE" ${existing?.type === 'REST_NOTE' ? 'checked' : ''} class="sr-only peer" />
                <span class="w-full min-h-[44px] px-space-3 rounded border border-border peer-checked:border-primary peer-checked:bg-primary-light peer-checked:text-primary inline-flex items-center justify-center font-label text-label-md">Nghỉ ngơi / Ghi chú</span>
              </label>
            </div>
          </fieldset>

          <label id="u06DestWrap" class="flex flex-col gap-space-1 ${existing?.type === 'REST_NOTE' ? 'hidden' : ''}">
            <span class="font-label text-label-md text-on-surface">Chọn địa điểm từ danh mục nội bộ</span>
            <select id="u06DestSelect" class="w-full min-h-[44px] px-space-3 rounded border border-border bg-surface text-body-md">
              <option value="">-- Chọn địa điểm --</option>
              ${publicDestinations
                .map(
                  (d) =>
                    `<option value="${escapeHtml(d.id)}" data-cost="${d.estimatedCostVnd ?? ''}" ${existing?.destinationId === d.id ? 'selected' : ''}>${escapeHtml(d.name)} (${escapeHtml(d.region)} · ${d.estimatedCostVnd === null ? 'Chưa có giá' : `${formatVnd(d.estimatedCostVnd)}/người`})</option>`,
                )
                .join('')}
            </select>
            <span data-err="destinationId" class="hidden text-body-md text-error"></span>
          </label>

          <label class="flex flex-col gap-space-1">
            <span class="font-label text-label-md text-on-surface">Tiêu đề hoạt động <span class="text-error">*</span></span>
            <input id="u06Title" type="text" value="${escapeHtml(existing?.title ?? '')}" placeholder="Ví dụ: Tham quan Phố cổ Hội An" class="w-full min-h-[44px] px-space-3 rounded border border-border bg-surface text-body-md" />
            <span data-err="title" class="hidden text-body-md text-error"></span>
          </label>

          <div class="grid grid-cols-2 gap-space-3">
            <label class="flex flex-col gap-space-1">
              <span class="font-label text-label-md text-on-surface">Giờ bắt đầu <span class="text-error">*</span></span>
              <input id="u06Start" type="time" value="${escapeHtml(existing?.startTime ?? '08:00')}" class="w-full min-h-[44px] px-space-3 rounded border border-border bg-surface text-body-md tabular-nums" />
              <span data-err="startTime" class="hidden text-body-md text-error"></span>
            </label>
            <label class="flex flex-col gap-space-1">
              <span class="font-label text-label-md text-on-surface">Giờ kết thúc <span class="text-error">*</span></span>
              <input id="u06End" type="time" value="${escapeHtml(existing?.endTime ?? '10:30')}" class="w-full min-h-[44px] px-space-3 rounded border border-border bg-surface text-body-md tabular-nums" />
              <span data-err="endTime" class="hidden text-body-md text-error"></span>
            </label>
          </div>

          <label class="flex flex-col gap-space-1">
            <span class="font-label text-label-md text-on-surface">Chi phí tham khảo toàn đoàn (${it.partySize} khách, VND)</span>
            <input id="u06Cost" type="number" min="0" step="1000" value="${existing?.estimatedGroupCostVnd ?? ''}" placeholder="Để trống nếu chưa có thông tin giá" class="w-full min-h-[44px] px-space-3 rounded border border-border bg-surface text-body-md tabular-nums" />
            <span class="text-label-sm text-text-secondary">Nhập 0 nếu miễn phí; để trống nếu chưa rõ chi phí.</span>
            <span data-err="estimatedGroupCostVnd" class="hidden text-body-md text-error"></span>
          </label>

          <label class="flex flex-col gap-space-1">
            <span class="font-label text-label-md text-on-surface">Ghi chú</span>
            <textarea id="u06Notes" rows="3" class="w-full p-space-3 rounded border border-border bg-surface text-body-md">${escapeHtml(existing?.notes ?? '')}</textarea>
          </label>

          <div class="flex items-center justify-end gap-space-3 pt-space-4 border-t border-border">
            <button type="button" data-u06-cancel class="min-h-[44px] px-space-4 rounded border border-border bg-surface text-on-surface hover:bg-surface-muted font-label text-label-md">Hủy</button>
            <button type="submit" id="u06SubmitBtn" class="min-h-[44px] px-space-6 rounded bg-primary text-on-primary hover:bg-primary-hover disabled:opacity-60 font-label text-label-md">Áp dụng vào bản nháp</button>
          </div>
        </form>
      `,
      onMount: (panel, close) => {
        const destWrap = panel.querySelector<HTMLElement>('#u06DestWrap');
        const destSelect = panel.querySelector<HTMLSelectElement>('#u06DestSelect');
        const titleInput = panel.querySelector<HTMLInputElement>('#u06Title');
        const costInput = panel.querySelector<HTMLInputElement>('#u06Cost');
        const alertEl = panel.querySelector<HTMLElement>('#u06Alert');

        panel.querySelectorAll<HTMLInputElement>('input[name="actType"]').forEach((r) => {
          r.addEventListener('change', () => {
            if (r.value === 'REST_NOTE') destWrap?.classList.add('hidden');
            else destWrap?.classList.remove('hidden');
          });
        });

        destSelect?.addEventListener('change', () => {
          const picked = publicDestinations.find((d) => d.id === destSelect.value);
          if (picked) {
            if (titleInput && !titleInput.value.trim()) titleInput.value = `Tham quan ${picked.name}`;
            if (costInput) {
              costInput.value = picked.estimatedCostVnd === null ? '' : String(picked.estimatedCostVnd * it.partySize);
            }
          }
        });

        panel.querySelector('[data-u06-cancel]')?.addEventListener('click', close);

        panel.querySelector<HTMLFormElement>('#u06Form')?.addEventListener('submit', async (e) => {
          e.preventDefault();
          const submitBtn = panel.querySelector<HTMLButtonElement>('#u06SubmitBtn');
          if (!submitBtn || submitBtn.disabled) return;

          alertEl?.classList.add('hidden');
          panel.querySelectorAll('[data-err]').forEach((el) => el.classList.add('hidden'));

          const type = (panel.querySelector<HTMLInputElement>('input[name="actType"]:checked')?.value ?? 'DESTINATION') as
            | 'DESTINATION'
            | 'REST_NOTE';
          const destinationId = type === 'DESTINATION' ? (destSelect?.value || null) : null;
          const title = titleInput?.value.trim() ?? '';
          const startTime = panel.querySelector<HTMLInputElement>('#u06Start')?.value ?? '';
          const endTime = panel.querySelector<HTMLInputElement>('#u06End')?.value ?? '';
          const rawCost = costInput?.value.trim() ?? '';
          const estimatedGroupCostVnd = rawCost === '' ? null : Number(rawCost);
          const notes = panel.querySelector<HTMLTextAreaElement>('#u06Notes')?.value.trim() ?? '';

          submitBtn.disabled = true;
          submitBtn.textContent = 'Đang áp dụng...';
          try {
            current = await itinerariesService.upsertActivity(
              it.id,
              {
                id: existing?.id,
                dayNumber: activeDayNumber,
                type,
                destinationId,
                title,
                startTime,
                endTime,
                estimatedGroupCostVnd,
                notes,
              },
              it.version,
            );
            close();
            showToast('Đã áp dụng thay đổi vào bản nháp Ngày ' + activeDayNumber + '. Bấm "Lưu lịch trình" để ghi chính thức.', 'success');
            renderView();
          } catch (err) {
            if (isAppError(err)) {
              Object.entries(err.fieldErrors).forEach(([k, v]) => {
                const errEl = panel.querySelector<HTMLElement>(`[data-err="${k}"]`);
                if (errEl) {
                  errEl.textContent = v;
                  errEl.classList.remove('hidden');
                }
              });
              if (err.code === 'CONFLICT' && alertEl) {
                alertEl.innerHTML = `${escapeHtml(err.message)} <button type="button" id="u06ReloadBtn" class="underline font-semibold ml-2">Tải lại ngay</button>`;
                alertEl.classList.remove('hidden');
                alertEl.querySelector('#u06ReloadBtn')?.addEventListener('click', () => {
                  close();
                  void load();
                });
                submitBtn.disabled = false;
                submitBtn.textContent = 'Áp dụng vào bản nháp';
                return;
              }
            }
            if (alertEl) {
              alertEl.textContent = toUserErrorMessage(err);
              alertEl.classList.remove('hidden');
            }
            submitBtn.disabled = false;
            submitBtn.textContent = 'Áp dụng vào bản nháp';
          }
        });
      },
    });
  };

  const openRegenerateDayModal = (it: Itinerary) => {
    const activeDay = it.days.find((d) => d.dayNumber === activeDayNumber);
    if (!activeDay) return;
    let preview: RegenerateDayPreview | null = null;

    openModal({
      title: `Tái tạo Ngày ${activeDay.dayNumber} bằng AI`,
      subtitle: `Chỉ tái tạo riêng Ngày ${activeDay.dayNumber} (${formatDateVi(activeDay.date)}), giữ nguyên toàn bộ các ngày khác.`,
      size: 'lg',
      bodyHtml: `
        <div class="flex flex-col gap-space-4">
          <div id="u07Alert" role="alert" class="hidden p-space-3 rounded bg-error-bg text-on-error-bg font-body text-body-md"></div>

          <label class="flex flex-col gap-space-1">
            <span class="font-label text-label-md text-on-surface">Mong muốn điều chỉnh cho Ngày ${activeDay.dayNumber} <span class="text-error">*</span></span>
            <input id="u07Prompt" type="text" value="Ưu tiên buổi sáng đi biển nhẹ nhàng, buổi chiều tham quan văn hóa" placeholder="Ví dụ: ưu tiên đi biển nhẹ nhàng buổi sáng..." class="w-full min-h-[44px] px-space-3 rounded border border-border bg-surface text-body-md" />
          </label>

          <div class="flex items-center justify-between gap-space-3">
            <p class="font-body text-label-sm text-text-secondary">Tiêu chí giữ nguyên: ${escapeHtml(it.region)} · ${it.partySize} khách · Nhịp độ ${PACE_LABELS[it.pace]}</p>
            <button type="button" id="u07GenerateBtn" class="min-h-[44px] px-space-4 rounded bg-primary text-on-primary hover:bg-primary-hover disabled:opacity-60 font-label text-label-md shrink-0 inline-flex items-center gap-space-2">
              <span class="material-symbols-outlined text-[18px]">auto_awesome</span>
              <span>Xem trước gợi ý AI</span>
            </button>
          </div>

          <div id="u07PreviewArea" class="hidden flex-col gap-space-4 border-t border-border pt-space-4"></div>

          <div class="flex items-center justify-end gap-space-3 pt-space-2 border-t border-border">
            <button type="button" data-u07-cancel class="min-h-[44px] px-space-4 rounded border border-border bg-surface text-on-surface font-label text-label-md">Hủy</button>
            <button type="button" id="u07ApplyBtn" disabled class="min-h-[44px] px-space-6 rounded bg-primary text-on-primary hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed font-label text-label-md">Áp dụng vào bản nháp</button>
          </div>
        </div>
      `,
      onMount: (panel, close) => {
        const promptInput = panel.querySelector<HTMLInputElement>('#u07Prompt')!;
        const genBtn = panel.querySelector<HTMLButtonElement>('#u07GenerateBtn')!;
        const applyBtn = panel.querySelector<HTMLButtonElement>('#u07ApplyBtn')!;
        const previewArea = panel.querySelector<HTMLElement>('#u07PreviewArea')!;
        const alertEl = panel.querySelector<HTMLElement>('#u07Alert')!;

        panel.querySelector('[data-u07-cancel]')?.addEventListener('click', close);

        genBtn.addEventListener('click', async () => {
          if (genBtn.disabled) return;
          alertEl.classList.add('hidden');
          genBtn.disabled = true;
          genBtn.textContent = 'Đang tạo gợi ý...';
          applyBtn.disabled = true;

          try {
            preview = await itinerariesService.previewRegenerateDay(it.id, activeDay.dayNumber, promptInput.value);
            previewArea.classList.remove('hidden');
            previewArea.classList.add('flex');
            previewArea.innerHTML = `
              <p class="p-space-3 rounded-lg bg-info-bg text-on-info-bg font-body text-body-md">${escapeHtml(preview.disclaimer)}</p>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-space-4">
                <div class="p-space-4 rounded-lg bg-background border border-border flex flex-col gap-space-2">
                  <div class="flex justify-between items-center">
                    <strong class="font-label text-label-md text-text-secondary">Trước khi đổi</strong>
                    <span class="font-label text-label-sm tabular-nums">${formatVnd(preview.beforeTotalVnd)}</span>
                  </div>
                  ${
                    preview.beforeActivities.length === 0
                      ? '<p class="text-body-md text-text-secondary">Chưa có hoạt động</p>'
                      : preview.beforeActivities
                          .map(
                            (a) => `<div class="p-space-2 rounded bg-surface border border-border text-body-md">
                              <span class="font-label text-label-sm text-text-secondary tabular-nums">${escapeHtml(a.startTime)} – ${escapeHtml(a.endTime)}</span>
                              <p class="font-medium text-on-surface">${escapeHtml(a.title)}</p>
                              <p class="text-label-sm text-text-secondary tabular-nums">${formatVnd(a.estimatedGroupCostVnd)}</p>
                            </div>`,
                          )
                          .join('')
                  }
                </div>

                <div class="p-space-4 rounded-lg bg-primary-light/50 border border-primary/40 flex flex-col gap-space-2">
                  <div class="flex justify-between items-center">
                    <strong class="font-label text-label-md text-primary">Sau (Gợi ý AI cần kiểm tra)</strong>
                    <span class="font-label text-label-sm text-primary tabular-nums">${formatVnd(preview.afterTotalVnd)}</span>
                  </div>
                  ${preview.afterActivities
                    .map(
                      (a) => `<div class="p-space-2 rounded bg-surface border border-primary/30 text-body-md">
                        <span class="font-label text-label-sm text-primary tabular-nums">${escapeHtml(a.startTime)} – ${escapeHtml(a.endTime)}</span>
                        <p class="font-medium text-on-surface">${escapeHtml(a.title)}</p>
                        <p class="text-label-sm text-text-secondary tabular-nums">${formatVnd(a.estimatedGroupCostVnd)}</p>
                      </div>`,
                    )
                    .join('')}
                </div>
              </div>
            `;
            applyBtn.disabled = false;
          } catch (err) {
            alertEl.textContent = toUserErrorMessage(err);
            alertEl.classList.remove('hidden');
          } finally {
            genBtn.disabled = false;
            genBtn.innerHTML = `<span class="material-symbols-outlined text-[18px]">auto_awesome</span><span>Xem trước gợi ý AI</span>`;
          }
        });

        applyBtn.addEventListener('click', async () => {
          if (!preview || applyBtn.disabled) return;
          applyBtn.disabled = true;
          applyBtn.textContent = 'Đang áp dụng...';
          try {
            current = await itinerariesService.applyRegeneratedDay(
              it.id,
              activeDay.dayNumber,
              preview.afterActivities,
              it.version,
            );
            close();
            showToast(`Đã áp dụng gợi ý AI vào bản nháp Ngày ${activeDay.dayNumber}. Bấm "Lưu lịch trình" để ghi chính thức.`, 'success');
            renderView();
          } catch (err) {
            alertEl.textContent = toUserErrorMessage(err);
            alertEl.classList.remove('hidden');
            applyBtn.disabled = false;
            applyBtn.textContent = 'Áp dụng vào bản nháp';
          }
        });
      },
    });
  };

  const renderView = () => {
    if (!current) return;
    const it = current;
    const expired = isDraftExpired(it);
    const activeDay = it.days.find((d) => d.dayNumber === activeDayNumber) ?? it.days[0];
    const remainingBudget = it.budgetVnd - it.totalEstimatedCostVnd;

    root.innerHTML = `
      <div class="flex flex-col gap-space-5">
        <div>
          <a href="/lich-trinh-cua-toi" class="tl-back-btn">
            <span class="tl-back-icon" aria-hidden="true">
              <span class="material-symbols-outlined text-[16px]">arrow_back</span>
            </span>
            <span>Về lịch trình của tôi</span>
          </a>
        </div>
        ${
          expired
            ? `<div role="alert" class="p-space-4 rounded-xl bg-error-bg border border-error/30 text-on-error-bg flex flex-wrap items-center justify-between gap-space-3">
                 <div>
                   <p class="font-label text-label-md">Bản nháp lịch trình đã hết thời hạn lưu tạm (24 giờ)</p>
                   <p class="font-body text-body-md">Bạn không thể chỉnh sửa hoặc lưu bản nháp đã hết hạn. Hãy lập chuyến đi mới.</p>
                 </div>
                 <a href="/lap-lich-trinh" class="inline-flex items-center justify-center min-h-[44px] px-space-4 rounded bg-primary text-on-primary font-label text-label-md">Lập lịch trình mới</a>
               </div>`
            : ''
        }

        <!-- Trip Summary Header -->
        ${
          !it.isDraft && it.hasUnsavedChanges
            ? `<div role="status" class="p-space-4 rounded-xl bg-warning-bg border border-warning/30 text-on-warning-bg flex flex-wrap items-center justify-between gap-space-3">
                 <div class="flex items-start gap-space-2">
                   <span class="material-symbols-outlined text-[20px] shrink-0 mt-0.5">pending_actions</span>
                   <div>
                     <p class="font-label text-label-md">Đang có thay đổi nháp chưa lưu chính thức</p>
                     <p class="font-body text-body-md">Bản đã lưu trong Lịch sử vẫn giữ nguyên cho đến khi bạn bấm <strong>Lưu lịch trình</strong>.</p>
                   </div>
                 </div>
                 <button type="button" id="discardDraftBtn" class="min-h-[40px] px-space-4 rounded border border-warning text-on-warning-bg bg-surface hover:bg-warning-bg/50 font-label text-label-sm">Khôi phục bản đã lưu</button>
               </div>`
            : ''
        }

        <section class="bg-surface border border-border rounded-xl p-space-6 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-space-4">
          <div class="flex flex-col gap-space-2">
            <div class="flex flex-wrap items-center gap-space-3">
              <span class="font-label text-label-md text-primary tabular-nums">${escapeHtml(it.id)}</span>
              ${
                it.isDraft
                  ? renderBadge(
                      `Bản nháp · hết hạn ${formatDateTimeVi(it.draftExpiresAt)}`,
                      expired ? 'error' : 'warning',
                      'edit_note',
                    )
                  : it.hasUnsavedChanges
                    ? `${renderBadge('Đã lưu chính thức', 'success', 'check_circle')} ${renderBadge('Có chỉnh sửa nháp chưa lưu', 'warning', 'edit_note')}`
                    : renderBadge('Đã lưu chính thức', 'success', 'check_circle')
              }
            </div>
            <h1 class="font-headline text-headline-lg text-on-surface">${escapeHtml(it.title)}</h1>
            <p class="font-body text-body-md text-text-secondary tabular-nums">
              ${formatDateVi(it.startDate)} – ${formatDateVi(it.endDate)} · ${it.daysCount} ngày · ${it.partySize} khách · Nhịp độ ${PACE_LABELS[it.pace]}
            </p>
          </div>

          <div class="flex flex-wrap gap-space-3">
            <a href="/chat?itinerary=${encodeURIComponent(it.id)}" class="inline-flex items-center justify-center gap-space-2 min-h-[44px] px-space-4 rounded bg-surface text-primary border border-primary hover:bg-primary-light font-label text-label-md">
              <span class="material-symbols-outlined text-[20px]">chat</span>
              <span>Hỏi AI</span>
            </a>
            <button type="button" id="openRegenBtn" ${expired ? 'disabled' : ''} class="inline-flex items-center justify-center gap-space-2 min-h-[44px] px-space-4 rounded bg-surface text-on-surface border border-border hover:bg-surface-muted disabled:opacity-50 font-label text-label-md">
              <span class="material-symbols-outlined text-[20px]">auto_awesome</span>
              <span>Tái tạo ngày bằng AI</span>
            </button>
            <button type="button" id="saveOfficialBtn" ${expired ? 'disabled' : ''} class="inline-flex items-center justify-center gap-space-2 min-h-[44px] px-space-6 rounded bg-primary text-on-primary hover:bg-primary-hover disabled:opacity-50 font-label text-label-lg transition-colors">
              <span class="material-symbols-outlined text-[20px]">save</span>
              <span>${it.isDraft ? 'Lưu lịch trình chính thức' : 'Lưu lịch trình'}</span>
            </button>
          </div>
        </section>

        <div class="grid grid-cols-1 lg:grid-cols-12 gap-space-6 items-start">
          <!-- DayTabs + Timeline -->
          <section class="lg:col-span-8 flex flex-col gap-space-4">
            <div class="flex flex-wrap gap-space-2" role="tablist" aria-label="Chọn ngày trong lịch trình">
              ${it.days
                .map((d) => {
                  const active = d.dayNumber === activeDay?.dayNumber;
                  return `<button type="button" role="tab" data-day-tab="${d.dayNumber}" aria-selected="${active ? 'true' : 'false'}" class="min-h-[44px] px-space-4 rounded font-label text-label-md tabular-nums transition-colors ${
                    active
                      ? 'bg-primary text-on-primary'
                      : 'bg-surface border border-border text-on-surface hover:bg-surface-muted'
                  }">Ngày ${d.dayNumber} · ${formatDateVi(d.date)}</button>`;
                })
                .join('')}
            </div>

            ${
              !activeDay || activeDay.activities.length === 0
                ? renderEmptyState({
                    icon: 'event_available',
                    title: `Ngày ${activeDay?.dayNumber ?? 1} chưa có hoạt động`,
                    description: 'Bạn có thể thêm hoạt động thủ công từ danh mục nội bộ hoặc dùng AI tái tạo riêng ngày này.',
                  })
                : `<div class="flex flex-col gap-space-4">
                    ${activeDay.activities
                      .map(
                        (act, idx) => `
                      <article class="bg-surface border border-border rounded-lg p-space-6 shadow-sm flex flex-col sm:flex-row sm:items-start justify-between gap-space-4">
                        <div class="flex flex-col gap-space-1 min-w-0">
                          <div class="flex flex-wrap items-center gap-space-2">
                            <span class="font-label text-label-md text-primary tabular-nums">${escapeHtml(act.startTime)} – ${escapeHtml(act.endTime)}</span>
                            ${
                              act.destinationId
                                ? `<a href="/dia-diem/${encodeURIComponent(act.destinationId)}" class="px-space-2 py-0.5 rounded-full bg-primary-light text-primary font-label text-label-sm hover:underline">${escapeHtml(act.destinationId)}</a>`
                                : `<span class="px-space-2 py-0.5 rounded-full bg-surface-muted text-text-secondary font-label text-label-sm">Nghỉ ngơi / Ghi chú</span>`
                            }
                          </div>
                          <h2 class="font-title text-title-md text-on-surface">${escapeHtml(act.title)}</h2>
                          <p class="font-body text-body-md text-text-secondary">
                            Chi phí toàn đoàn (${it.partySize} khách): <strong class="text-on-surface tabular-nums">${formatVnd(act.estimatedGroupCostVnd)}</strong>
                          </p>
                          ${act.notes ? `<p class="font-body text-body-md text-text-secondary">Ghi chú: ${escapeHtml(act.notes)}</p>` : ''}
                        </div>

                        <div class="flex flex-wrap items-center gap-space-2 shrink-0">
                          <button type="button" data-act-up="${escapeHtml(act.id)}" ${idx === 0 || expired ? 'disabled' : ''} aria-label="Di chuyển lên" class="w-[44px] h-[44px] inline-flex items-center justify-center rounded border border-border text-on-surface hover:bg-surface-muted disabled:opacity-35">
                            <span class="material-symbols-outlined text-[18px]">arrow_upward</span>
                          </button>
                          <button type="button" data-act-down="${escapeHtml(act.id)}" ${idx === activeDay.activities.length - 1 || expired ? 'disabled' : ''} aria-label="Di chuyển xuống" class="w-[44px] h-[44px] inline-flex items-center justify-center rounded border border-border text-on-surface hover:bg-surface-muted disabled:opacity-35">
                            <span class="material-symbols-outlined text-[18px]">arrow_downward</span>
                          </button>
                          <button type="button" data-act-edit="${escapeHtml(act.id)}" ${expired ? 'disabled' : ''} class="min-h-[44px] px-space-3 rounded border border-border bg-surface text-on-surface hover:bg-surface-muted disabled:opacity-40 font-label text-label-sm">Sửa</button>
                          <button type="button" data-act-del="${escapeHtml(act.id)}" ${expired ? 'disabled' : ''} aria-label="Xóa hoạt động" class="w-[44px] h-[44px] inline-flex items-center justify-center rounded border border-error/40 text-error hover:bg-error-bg disabled:opacity-40">
                            <span class="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        </div>
                      </article>
                    `,
                      )
                      .join('')}
                  </div>`
            }

            <button type="button" id="addActivityBtn" ${expired ? 'disabled' : ''} class="min-h-[44px] px-space-4 rounded border border-dashed border-primary text-primary hover:bg-primary-light disabled:opacity-40 font-label text-label-md inline-flex items-center justify-center gap-space-2">
              <span class="material-symbols-outlined text-[20px]">add</span>
              <span>Thêm hoạt động vào Ngày ${activeDay?.dayNumber ?? 1}</span>
            </button>
          </section>

          <!-- BudgetSummary Sidebar -->
          <aside class="lg:col-span-4 bg-surface border border-border rounded-xl p-space-6 shadow-sm flex flex-col gap-space-4">
            <h2 class="font-headline text-headline-md text-on-surface">Ngân sách hoạt động toàn đoàn</h2>
            <dl class="flex flex-col gap-space-2 font-body text-body-md">
              <div class="flex justify-between">
                <dt class="text-text-secondary">Ngân sách mục tiêu</dt>
                <dd class="font-semibold text-on-surface tabular-nums">${formatVnd(it.budgetVnd)}</dd>
              </div>
              <div class="flex justify-between">
                <dt class="text-text-secondary">Chi phí hoạt động ước tính</dt>
                <dd class="font-semibold text-primary tabular-nums">${formatVnd(it.totalEstimatedCostVnd)}</dd>
              </div>
              <div class="flex justify-between border-t border-border pt-space-2">
                <dt class="text-text-secondary">${remainingBudget >= 0 ? 'Còn lại tham khảo' : 'Vượt ngân sách'}</dt>
                <dd class="font-semibold ${remainingBudget >= 0 ? 'text-success' : 'text-error'} tabular-nums">${formatVnd(Math.abs(remainingBudget))}</dd>
              </div>
            </dl>
            ${
              it.hasUnknownCostItems
                ? `<p class="p-space-3 rounded bg-warning-bg text-on-warning-bg font-body text-label-sm">Một số hoạt động chưa có thông tin giá cố định nên chưa cộng vào tổng trên.</p>`
                : ''
            }
            <p class="font-body text-label-sm text-text-secondary border-t border-border pt-space-3">${escapeHtml(it.budgetScopeNote)}</p>
            <p class="font-body text-label-sm text-text-secondary">Chỉnh sửa lịch trình không tự thay đổi giá hoặc trạng thái các đơn dịch vụ đã đặt trước đó.</p>
            <a href="/lich-trinh-cua-toi" class="min-h-[44px] px-space-4 rounded border border-border text-on-surface hover:bg-surface-muted font-label text-label-md inline-flex items-center justify-center">Về Lịch sử lịch trình</a>
          </aside>
        </div>
      </div>
    `;

    root.querySelectorAll<HTMLButtonElement>('[data-day-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeDayNumber = Number(btn.dataset.dayTab);
        renderView();
      });
    });

    root.querySelector('#addActivityBtn')?.addEventListener('click', () => openActivityDrawer(it));
    root.querySelector('#openRegenBtn')?.addEventListener('click', () => openRegenerateDayModal(it));

    root.querySelectorAll<HTMLButtonElement>('[data-act-edit]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const act = activeDay?.activities.find((a) => a.id === btn.dataset.actEdit);
        if (act) openActivityDrawer(it, act);
      });
    });

    const runReorder = async (actId: string, action: 'MOVE_UP' | 'MOVE_DOWN') => {
      try {
        current = await itinerariesService.reorderOrDeleteActivity(it.id, activeDayNumber, actId, action, it.version);
        renderView();
      } catch (err) {
        showToast(toUserErrorMessage(err), 'error');
        if (isAppError(err) && err.code === 'CONFLICT') await load();
      }
    };

    root.querySelectorAll<HTMLButtonElement>('[data-act-up]').forEach((btn) => {
      btn.addEventListener('click', () => void runReorder(btn.dataset.actUp!, 'MOVE_UP'));
    });
    root.querySelectorAll<HTMLButtonElement>('[data-act-down]').forEach((btn) => {
      btn.addEventListener('click', () => void runReorder(btn.dataset.actDown!, 'MOVE_DOWN'));
    });

    root.querySelectorAll<HTMLButtonElement>('[data-act-del]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const act = activeDay?.activities.find((a) => a.id === btn.dataset.actDel);
        if (!act) return;
        openConfirmModal({
          title: 'Xóa hoạt động khỏi ngày?',
          description: `Bạn chắc chắn muốn xóa "${act.title}" khỏi Ngày ${activeDayNumber}?`,
          confirmLabel: 'Xóa hoạt động',
          destructive: true,
          onConfirm: async () => {
            current = await itinerariesService.reorderOrDeleteActivity(
              it.id,
              activeDayNumber,
              act.id,
              'DELETE',
              it.version,
            );
            showToast('Đã xóa hoạt động trong bản nháp hiện tại.', 'info');
            renderView();
          },
        });
      });
    });

    root.querySelector('#discardDraftBtn')?.addEventListener('click', () => {
      openConfirmModal({
        title: 'Khôi phục bản lịch trình đã lưu?',
        description: 'Mọi thay đổi nháp chưa lưu chính thức sẽ bị hủy và quay lại đúng phiên bản đã lưu gần nhất.',
        confirmLabel: 'Khôi phục bản đã lưu',
        destructive: true,
        onConfirm: async () => {
          current = await itinerariesService.discardChanges(it.id);
          showToast('Đã khôi phục lại phiên bản lịch trình đã lưu chính thức.', 'info');
          renderView();
        },
      });
    });

    const saveBtn = root.querySelector<HTMLButtonElement>('#saveOfficialBtn');
    saveBtn?.addEventListener('click', async () => {
      if (saveBtn.disabled) return;
      saveBtn.disabled = true;
      saveBtn.textContent = 'Đang lưu chính thức...';
      try {
        const saved = await itinerariesService.saveItinerary(it.id, it.version);
        current = saved;
        showToast(`Đã lưu lịch trình chính thức (${saved.id}) vào Lịch sử lịch trình.`, 'success');
        if (it.isDraft) {
          ctx.navigate(`/lich-trinh/${encodeURIComponent(saved.id)}`, { replace: true });
        } else {
          renderView();
        }
      } catch (err) {
        showToast(toUserErrorMessage(err), 'error');
        saveBtn.disabled = false;
        saveBtn.textContent = it.isDraft ? 'Lưu lịch trình chính thức' : 'Lưu lịch trình';
        if (isAppError(err) && err.code === 'CONFLICT') await load();
      }
    });
  };

  await load();
}
