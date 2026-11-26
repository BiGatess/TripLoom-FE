import type { RouteContext } from '@/app/router';
import { toUserErrorMessage } from '@/api/errors';
import type { Itinerary } from '@/api/contracts';
import { itinerariesService } from '@/features/itineraries/itineraries.service';
import { renderMemberShell } from '@/layouts/member/MemberShell';
import { renderEmptyState, renderErrorBanner, renderTableSkeleton } from '@/shared/components/EmptyErrorState';
import { openConfirmModal, openModal } from '@/shared/components/Modal';
import { renderPagination } from '@/shared/components/Pagination';
import { renderBadge } from '@/shared/components/StatusBadge';
import { showToast } from '@/shared/components/Toast';
import { beginAsyncRender, escapeHtml, finishAsyncRender } from '@/shared/utils/dom';
import { formatDateTimeVi, formatDateVi, formatVnd } from '@/shared/utils/format';

export async function renderItineraryHistoryPage(ctx: RouteContext): Promise<void> {
  let searchQuery = '';
  let page = 1;

  const main = renderMemberShell({
    container: ctx.container,
    activeNav: 'itineraries',
    contentHtml: `
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-space-4">
        <div>
          <h1 class="font-headline text-headline-lg text-on-surface">Lịch trình của tôi</h1>
          <p class="font-body text-body-md text-text-secondary">Danh sách các lịch trình đã lưu chính thức của tài khoản bạn.</p>
        </div>
        <a href="/lap-lich-trinh" class="inline-flex items-center justify-center gap-space-2 min-h-[44px] px-space-6 rounded bg-primary text-on-primary hover:bg-primary-hover font-label text-label-md">
          <span class="material-symbols-outlined text-[20px]">add</span>
          <span>Lập lịch trình mới</span>
        </a>
      </div>

      <form id="itSearchForm" class="bg-surface border border-border rounded-lg p-space-4 flex flex-col sm:flex-row gap-space-3">
        <input id="itSearchInput" type="search" placeholder="Tìm theo tên chuyến đi hoặc khu vực..." class="flex-1 min-h-[44px] px-space-4 rounded border border-border bg-surface text-body-md" />
        <button type="submit" class="min-h-[44px] px-space-6 rounded bg-primary text-on-primary hover:bg-primary-hover font-label text-label-md">Tìm kiếm</button>
      </form>

      <div id="itHistoryList">${renderTableSkeleton(3)}</div>
      <div id="itHistoryPag"></div>
    `,
  });

  const openCloneModal = (source: Itinerary) => {
    openModal({
      title: 'Sao chép lịch trình',
      subtitle: `Tạo bản sao độc lập từ "${source.title}". Khi chọn ngày bắt đầu mới, các ngày trong lịch trình sẽ tự động dịch chuyển tương ứng.`,
      size: 'sm',
      bodyHtml: `
        <form id="u09CloneForm" novalidate class="flex flex-col gap-space-4">
          <div id="u09CloneErr" role="alert" class="hidden p-space-3 rounded bg-error-bg text-on-error-bg font-body text-body-md"></div>
          <label class="flex flex-col gap-space-1">
            <span class="font-label text-label-md text-on-surface">Tên lịch trình mới <span class="text-error">*</span></span>
            <input id="u09CloneTitle" type="text" value="${escapeHtml(`${source.title} (Bản sao)`)}" class="w-full min-h-[44px] px-space-3 rounded border border-border bg-surface text-body-md" />
          </label>
          <label class="flex flex-col gap-space-1">
            <span class="font-label text-label-md text-on-surface">Ngày bắt đầu mới (tùy chọn)</span>
            <input id="u09CloneDate" type="date" value="${escapeHtml(source.startDate)}" class="w-full min-h-[44px] px-space-3 rounded border border-border bg-surface text-body-md tabular-nums" />
          </label>
          <div class="flex justify-end gap-space-3 pt-space-2">
            <button type="button" data-clone-cancel class="min-h-[44px] px-space-4 rounded border border-border bg-surface text-on-surface font-label text-label-md">Hủy</button>
            <button type="submit" id="u09CloneSubmit" class="min-h-[44px] px-space-6 rounded bg-primary text-on-primary hover:bg-primary-hover font-label text-label-md">Tạo bản sao</button>
          </div>
        </form>
      `,
      onMount: (panel, close) => {
        panel.querySelector('[data-clone-cancel]')?.addEventListener('click', close);
        panel.querySelector<HTMLFormElement>('#u09CloneForm')?.addEventListener('submit', async (e) => {
          e.preventDefault();
          const btn = panel.querySelector<HTMLButtonElement>('#u09CloneSubmit');
          const errBox = panel.querySelector<HTMLElement>('#u09CloneErr');
          if (!btn || btn.disabled) return;
          const title = panel.querySelector<HTMLInputElement>('#u09CloneTitle')?.value.trim() ?? '';
          const newStartDate = panel.querySelector<HTMLInputElement>('#u09CloneDate')?.value || undefined;
          errBox?.classList.add('hidden');
          btn.disabled = true;
          btn.textContent = 'Đang sao chép...';
          try {
            const cloned = await itinerariesService.cloneItinerary(source.id, { title, newStartDate });
            close();
            showToast(`Đã tạo bản sao lịch trình ${cloned.id}.`, 'success');
            ctx.navigate(`/lich-trinh/${encodeURIComponent(cloned.id)}`);
          } catch (err) {
            if (errBox) {
              errBox.textContent = toUserErrorMessage(err);
              errBox.classList.remove('hidden');
            }
            btn.disabled = false;
            btn.textContent = 'Tạo bản sao';
          }
        });
      },
    });
  };

  const load = async () => {
    const listEl = main.querySelector<HTMLElement>('#itHistoryList')!;
    const pagEl = main.querySelector<HTMLElement>('#itHistoryPag')!;
    beginAsyncRender(listEl, renderTableSkeleton(3));
    pagEl.innerHTML = '';

    try {
      const res = await itinerariesService.listMyItineraries({ query: searchQuery, page, pageSize: 6 });
      if (res.items.length === 0) {
        finishAsyncRender(
          listEl,
          renderEmptyState({
            icon: 'map',
            title: searchQuery ? 'Không tìm thấy lịch trình phù hợp' : 'Bạn chưa lưu lịch trình nào',
            description: searchQuery
              ? 'Thử nhập từ khóa khác hoặc xóa từ khóa tìm kiếm.'
              : 'Các lịch trình sau khi bấm "Lưu lịch trình" sẽ xuất hiện tại đây.',
            actionHref: searchQuery ? undefined : '/lap-lich-trinh',
            actionLabel: searchQuery ? undefined : 'Lập lịch trình ngay',
          }),
        );
        return;
      }

      finishAsyncRender(
        listEl,
        `<div class="grid grid-cols-1 md:grid-cols-2 gap-space-6">
          ${res.items
            .map(
              (it) => `
            <article class="bg-surface border border-border rounded-xl p-space-6 shadow-sm flex flex-col justify-between gap-space-4">
              <div class="flex flex-col gap-space-2">
                <div class="flex items-center justify-between gap-space-2">
                  <span class="font-label text-label-sm text-primary tabular-nums">${escapeHtml(it.id)}</span>
                  ${renderBadge('Đã lưu', 'success', 'check_circle')}
                </div>
                <h2 class="font-title text-title-md text-on-surface">${escapeHtml(it.title)}</h2>
                <p class="font-body text-body-md text-text-secondary tabular-nums">${escapeHtml(it.region)} · ${formatDateVi(it.startDate)} – ${formatDateVi(it.endDate)} (${it.daysCount} ngày)</p>
                <p class="font-body text-body-md text-text-secondary tabular-nums">${it.partySize} khách · Ngân sách hoạt động: <strong class="text-on-surface">${formatVnd(it.budgetVnd)}</strong></p>
                <p class="font-body text-label-sm text-text-secondary tabular-nums">Cập nhật: ${formatDateTimeVi(it.updatedAt)}</p>
              </div>
              <div class="flex flex-wrap gap-space-2 pt-space-2 border-t border-border">
                <a href="/lich-trinh/${encodeURIComponent(it.id)}" class="flex-1 inline-flex items-center justify-center min-h-[44px] px-space-4 rounded bg-primary text-on-primary hover:bg-primary-hover font-label text-label-md">Xem chi tiết</a>
                <button type="button" data-clone-it="${escapeHtml(it.id)}" class="min-h-[44px] px-space-3 rounded border border-border bg-surface text-on-surface hover:bg-surface-muted font-label text-label-md">Sao chép</button>
                <button type="button" data-del-it="${escapeHtml(it.id)}" class="min-h-[44px] px-space-3 rounded border border-error/40 text-error hover:bg-error-bg font-label text-label-md">Xóa</button>
              </div>
            </article>
          `,
            )
            .join('')}
        </div>`,
      );

      listEl.querySelectorAll<HTMLButtonElement>('[data-clone-it]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const item = res.items.find((x) => x.id === btn.dataset.cloneIt);
          if (item) openCloneModal(item);
        });
      });

      listEl.querySelectorAll<HTMLButtonElement>('[data-del-it]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const item = res.items.find((x) => x.id === btn.dataset.delIt);
          if (!item) return;
          openConfirmModal({
            title: `Xóa lịch trình "${item.title}"?`,
            description:
              'Lịch trình sẽ bị xóa khỏi danh sách. Lịch sử hội thoại Chat AI liên quan (sẽ chuyển sang trạng thái không còn liên kết) và các đơn dịch vụ đã đặt vẫn được giữ nguyên.',
            confirmLabel: 'Xóa lịch trình',
            destructive: true,
            onConfirm: async () => {
              await itinerariesService.deleteItinerary(item.id);
              showToast(`Đã xóa lịch trình ${item.id}.`, 'info');
              await load();
            },
          });
        });
      });

      pagEl.innerHTML = renderPagination(res.page, res.totalPages, res.total);
      pagEl.querySelectorAll<HTMLButtonElement>('[data-page]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const p = Number(btn.dataset.page);
          if (p >= 1 && p <= res.totalPages && p !== page) {
            page = p;
            void load();
          }
        });
      });
    } catch (err) {
      finishAsyncRender(listEl, renderErrorBanner(toUserErrorMessage(err), 'retryItListBtn'));
      listEl.querySelector('#retryItListBtn')?.addEventListener('click', () => void load());
    }
  };

  main.querySelector<HTMLFormElement>('#itSearchForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    searchQuery = main.querySelector<HTMLInputElement>('#itSearchInput')?.value.trim() ?? '';
    page = 1;
    void load();
  });

  await load();
}
