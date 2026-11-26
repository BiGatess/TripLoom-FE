import type { RouteContext } from '@/app/router';
import { toUserErrorMessage } from '@/api/errors';
import { PACE_LABELS } from '@/config/constants';
import { tripPlanningService } from '@/features/trip-planning/trip-planning.service';
import { renderMemberShell } from '@/layouts/member/MemberShell';
import { renderDestinationCard } from '@/shared/components/DestinationCard';
import { renderEmptyState, renderErrorBanner, renderLoadingSkeleton } from '@/shared/components/EmptyErrorState';
import { showToast } from '@/shared/components/Toast';
import { bindImageFallbacks, escapeHtml } from '@/shared/utils/dom';
import { formatDateVi, formatVnd } from '@/shared/utils/format';

export async function renderRecommendationsPage(ctx: RouteContext): Promise<void> {
  const draftRequestId = ctx.query.get('draft_request') ?? '';

  const main = renderMemberShell({
    container: ctx.container,
    activeNav: 'plan',
    contentHtml: `<div id="recRoot" class="flex flex-col gap-space-6">${renderLoadingSkeleton(3)}</div>`,
  });

  const root = main.querySelector<HTMLElement>('#recRoot')!;

  if (!draftRequestId) {
    root.innerHTML = renderEmptyState({
      icon: 'route',
      title: 'Chưa có yêu cầu chuyến đi',
      description: 'Vui lòng nhập điểm đến, thời gian và ngân sách tại bước Lập lịch trình trước khi xem đề xuất.',
      actionHref: '/lap-lich-trinh',
      actionLabel: 'Đi tới Lập lịch trình',
    });
    return;
  }

  let selectedIds = new Set<string>();

  const load = async () => {
    root.innerHTML = renderLoadingSkeleton(3);
    try {
      const data = await tripPlanningService.getRecommendations(draftRequestId);
      const { request, recommendations } = data;
      selectedIds = new Set(recommendations.slice(0, 4).map((r) => r.destination.id));

      const editCriteriaHref = `/lap-lich-trinh?region=${encodeURIComponent(request.region)}&startDate=${encodeURIComponent(request.startDate)}&days=${request.daysCount}&guests=${request.partySize}&budget=${request.budgetVnd}`;

      root.innerHTML = `
        <!-- Trip Summary Header -->
        <section class="bg-surface border border-border rounded-xl p-space-6 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-space-4">
          <div class="flex flex-col gap-space-2">
            <h1 class="font-headline text-headline-lg text-on-surface">Địa điểm đề xuất cho chuyến đi của bạn</h1>
            <div class="flex flex-wrap gap-space-2">
              <span class="px-space-3 py-space-1 rounded-full bg-primary-light text-primary font-label text-label-sm">${escapeHtml(request.region)}</span>
              <span class="px-space-3 py-space-1 rounded-full bg-surface-muted text-on-surface font-label text-label-sm tabular-nums">${formatDateVi(request.startDate)} – ${formatDateVi(request.endDate)} (${request.daysCount} ngày)</span>
              <span class="px-space-3 py-space-1 rounded-full bg-surface-muted text-on-surface font-label text-label-sm tabular-nums">${request.partySize} khách</span>
              <span class="px-space-3 py-space-1 rounded-full bg-surface-muted text-on-surface font-label text-label-sm tabular-nums">Ngân sách hoạt động: ${formatVnd(request.budgetVnd)}</span>
              <span class="px-space-3 py-space-1 rounded-full bg-surface-muted text-on-surface font-label text-label-sm">Nhịp độ: ${PACE_LABELS[request.pace]}</span>
            </div>
            <p class="font-body text-label-sm text-text-secondary">${escapeHtml(request.budgetScopeNote)}</p>
          </div>

          <div class="flex flex-wrap gap-space-3 shrink-0">
            <a href="${escapeHtml(editCriteriaHref)}" class="tl-back-btn">
              <span class="tl-back-icon" aria-hidden="true">
                <span class="material-symbols-outlined text-[16px]">arrow_back</span>
              </span>
              <span>Đổi tiêu chí</span>
            </a>
            <button type="button" id="generateAiBtn" ${recommendations.length === 0 ? 'disabled' : ''} class="inline-flex items-center justify-center gap-space-2 min-h-[44px] px-space-6 rounded bg-primary text-on-primary hover:bg-primary-hover disabled:opacity-50 font-label text-label-lg transition-colors">
              <span class="material-symbols-outlined text-[20px]">auto_awesome</span>
              <span>Tạo lịch trình bằng AI</span>
            </button>
          </div>
        </section>

        <div id="aiGenStatus" class="hidden"></div>

        ${
          recommendations.length === 0
            ? renderEmptyState({
                icon: 'location_searching',
                title: 'Chưa có địa điểm phù hợp trong danh mục nội bộ',
                description: 'Khu vực hoặc tiêu chí hiện tại chưa có địa điểm công khai. Hãy chọn Đà Nẵng hoặc Hội An để trải nghiệm đầy đủ dữ liệu mẫu.',
                actionHref: editCriteriaHref,
                actionLabel: 'Đổi tiêu chí chuyến đi',
              })
            : `
              <p class="font-body text-body-md text-text-secondary">
                Danh sách địa điểm từ danh mục nội bộ được xếp hạng theo mức độ phù hợp. Gợi ý không đồng nghĩa đã đặt dịch vụ hay giữ chỗ.
              </p>
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                ${recommendations
                  .map(
                    (rec) => `
                  <div class="flex flex-col gap-space-2">
                    <label class="flex items-center gap-space-2 px-space-3 py-space-2 rounded-lg bg-surface border border-border cursor-pointer hover:border-primary">
                      <input type="checkbox" data-pick-dest="${escapeHtml(rec.destination.id)}" ${selectedIds.has(rec.destination.id) ? 'checked' : ''} class="h-5 w-5 rounded border-border text-primary focus:ring-primary" />
                      <span class="font-label text-label-sm text-on-surface">Ưu tiên đưa vào bản nháp AI</span>
                    </label>
                    ${renderDestinationCard({
                      destination: rec.destination,
                      matchReasons: rec.matchReasons,
                      estimatedGroupCostVnd: rec.estimatedGroupCostVnd,
                      partySize: request.partySize,
                    })}
                  </div>
                `,
                  )
                  .join('')}
              </div>
            `
        }
      `;

      bindImageFallbacks(root);

      root.querySelectorAll<HTMLInputElement>('[data-pick-dest]').forEach((cb) => {
        cb.addEventListener('change', () => {
          const id = cb.dataset.pickDest!;
          if (cb.checked) selectedIds.add(id);
          else selectedIds.delete(id);
        });
      });

      const genBtn = root.querySelector<HTMLButtonElement>('#generateAiBtn');
      const statusBox = root.querySelector<HTMLElement>('#aiGenStatus');

      const triggerAiGeneration = async () => {
        if (!genBtn || genBtn.disabled) return;
        genBtn.disabled = true;
        genBtn.textContent = 'Đang tạo bản nháp lịch trình...';
        if (statusBox) {
          statusBox.className = 'p-space-4 rounded-lg bg-info-bg text-on-info-bg flex items-center gap-space-3';
          statusBox.innerHTML = `
            <span class="material-symbols-outlined text-[22px] animate-spin">progress_activity</span>
            <div>
              <p class="font-label text-label-md">TripLoom AI đang sắp xếp lịch trình theo ngày...</p>
              <p class="font-body text-body-md">Hệ thống đang cân đối nhịp độ, khung giờ và chi phí hoạt động toàn đoàn.</p>
            </div>
          `;
        }

        try {
          const picks = Array.from(selectedIds);
          const draft = await tripPlanningService.generateDraftItinerary(
            draftRequestId,
            picks.length > 0 ? picks : undefined,
          );
          showToast('Đã tạo bản nháp lịch trình. Hãy kiểm tra và bấm "Lưu lịch trình" khi sẵn sàng.', 'success');
          ctx.navigate(`/lich-trinh/nhap/${encodeURIComponent(draft.id)}`);
        } catch (err) {
          if (statusBox) {
            statusBox.className = '';
            statusBox.innerHTML = renderErrorBanner(toUserErrorMessage(err), 'retryAiGenBtn');
            statusBox.querySelector('#retryAiGenBtn')?.addEventListener('click', () => void triggerAiGeneration());
          }
          genBtn.disabled = false;
          genBtn.innerHTML = `<span class="material-symbols-outlined text-[20px]">auto_awesome</span><span>Tạo lịch trình bằng AI</span>`;
        }
      };

      genBtn?.addEventListener('click', () => void triggerAiGeneration());
    } catch (err) {
      root.innerHTML = renderErrorBanner(toUserErrorMessage(err), 'retryRecBtn');
      root.querySelector('#retryRecBtn')?.addEventListener('click', () => void load());
    }
  };

  await load();
}
