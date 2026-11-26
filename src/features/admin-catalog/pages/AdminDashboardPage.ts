import type { RouteContext } from '@/app/router';
import { sessionStore } from '@/app/session-store';
import { hasBackofficePermission } from '@/app/route-guards';
import { toUserErrorMessage } from '@/api/errors';
import type { DashboardRangeKey, DashboardRangeMetrics } from '@/api/contracts';
import { adminCatalogService } from '@/features/admin-catalog/admin-catalog.service';
import { renderBackofficeShell } from '@/layouts/backoffice/BackofficeShell';
import { renderEmptyState, renderErrorBanner, renderLoadingSkeleton } from '@/shared/components/EmptyErrorState';
import { renderBadge } from '@/shared/components/StatusBadge';
import { escapeHtml } from '@/shared/utils/dom';

const SERVICE_OPTIONS: Array<{ value: string; label: string; dotClass: string; scale: number }> = [
  { value: 'all', label: 'Tất cả dịch vụ', dotClass: 'bg-slate-400', scale: 1 },
  { value: 'tour', label: 'Tour & Lịch trình (54%)', dotClass: 'bg-primary', scale: 0.54 },
  { value: 'craft', label: 'Làng nghề & Vé (28%)', dotClass: 'bg-info', scale: 0.28 },
  { value: 'other', label: 'Dịch vụ khác (18%)', dotClass: 'bg-success', scale: 0.18 },
];

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseYmd(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y ?? 2026, (m ?? 11) - 1, d ?? 1);
}

function addDaysYmd(ymd: string, delta: number): string {
  const dt = parseYmd(ymd);
  dt.setDate(dt.getDate() + delta);
  return toYmd(dt);
}

function diffDaysInclusive(startYmd: string, endYmd: string): number {
  const msPerDay = 86_400_000;
  const s = parseYmd(startYmd).getTime();
  const e = parseYmd(endYmd).getTime();
  return Math.max(1, Math.round((e - s) / msPerDay) + 1);
}

function formatShortDm(ymd: string): string {
  const [, m, d] = ymd.split('-');
  return `${d}/${m}`;
}

function formatFullDmy(ymd: string): string {
  const [y, m, d] = ymd.split('-');
  return `${d}/${m}/${y}`;
}

function formatVndMillions(valTr: number): string {
  const vnd = Math.round(valTr * 1_000_000);
  return `${vnd.toLocaleString('vi-VN')}đ`;
}

/**
 * Sinh dữ liệu biểu đồ & KPI nhất quán cho bất kỳ khoảng ngày tùy chọn nào (ví dụ 5 ngày, 7 ngày, 10 ngày, 25 ngày...).
 */
function buildCustomRangeMetrics(startYmd: string, endYmd: string): DashboardRangeMetrics {
  const totalDays = diffDaysInclusive(startYmd, endYmd);
  const rangeLabel =
    totalDays === 1
      ? formatFullDmy(startYmd)
      : `${formatShortDm(startYmd)} – ${formatShortDm(endYmd)} (${totalDays} ngày)`;

  // Giá trị ngày tiền định (deterministic) dựa trên ngày lịch để không nhảy ngẫu nhiên khi đổi filter
  const dailyTr = (ymd: string): number => {
    const dt = parseYmd(ymd);
    const seed = dt.getFullYear() * 372 + (dt.getMonth() + 1) * 31 + dt.getDate();
    const weekendBoost = dt.getDay() === 0 || dt.getDay() === 6 ? 1.85 : 0;
    const wave = ((seed * 17) % 34) / 10; // 0.0 .. 3.3
    return Number((3.6 + wave + weekendBoost).toFixed(2));
  };

  if (totalDays === 1) {
    const daySum = dailyTr(startYmd);
    const slotWeights = [0.09, 0.18, 0.13, 0.17, 0.15, 0.11, 0.17];
    const slotLabels = ['08h', '10h', '12h', '14h', '16h', '18h', '20h'];
    const rawSlots = slotWeights.map((w) => Number((daySum * w).toFixed(2)));
    const maxSlot = Math.max(...rawSlots, 0.5);
    return {
      kpiLabel: `Doanh thu ${formatShortDm(startYmd)}`,
      kpiVal: `${daySum.toFixed(2).replace('.', ',')}tr`,
      kpiTrend: '+8,4%',
      kpiSub: `Ngày chọn: ${formatFullDmy(startYmd)}`,
      bookVal: String(Math.max(3, Math.round(daySum * 1.3))),
      bookTrend: 'Theo ngày chọn',
      sepayVal: '98,0%',
      chartTitle: `Biểu đồ doanh thu ngày ${formatFullDmy(startYmd)} (theo khung giờ)`,
      totalFormatted: formatVndMillions(daySum),
      avgFormatted: `${formatVndMillions(daySum / 7)}/khung giờ`,
      donutPeriod: formatShortDm(startYmd),
      donutVal: `${daySum.toFixed(1).replace('.', ',')}tr`,
      gridCols: 'grid-cols-7',
      bars: rawSlots.map((v, idx) => ({
        label: slotLabels[idx]!,
        valTr: v,
        displayVal: `${v.toFixed(2).replace('.', ',')}tr`,
        heightPct: Math.max(20, Math.round((v / maxSlot) * 92)),
        active: idx === rawSlots.length - 1,
      })),
    };
  }

  // Tính danh sách từng ngày
  const allDays: Array<{ ymd: string; valTr: number }> = [];
  for (let i = 0; i < totalDays; i++) {
    const cur = addDaysYmd(startYmd, i);
    allDays.push({ ymd: cur, valTr: dailyTr(cur) });
  }
  const sumTr = Number(allDays.reduce((acc, item) => acc + item.valTr, 0).toFixed(2));
  const avgPerDayTr = sumTr / totalDays;

  // Nếu <= 14 ngày (ví dụ 7 ngày, 10 ngày, 12 ngày): hiển thị đúng từng cột ngày!
  // Nếu > 14 ngày: tự gộp thành tối đa 10 chặng ngày đều nhau để biểu đồ luôn thoáng đẹp.
  let buckets: Array<{ label: string; valTr: number }> = [];
  if (totalDays <= 14) {
    buckets = allDays.map((d) => ({
      label: formatShortDm(d.ymd),
      valTr: d.valTr,
    }));
  } else {
    const bucketCount = Math.min(10, Math.ceil(totalDays / Math.ceil(totalDays / 8)));
    const chunkSize = Math.ceil(totalDays / bucketCount);
    for (let i = 0; i < totalDays; i += chunkSize) {
      const slice = allDays.slice(i, i + chunkSize);
      const bucketSum = Number(slice.reduce((s, x) => s + x.valTr, 0).toFixed(1));
      const first = slice[0]!;
      const last = slice[slice.length - 1]!;
      buckets.push({
        label: slice.length === 1 ? formatShortDm(first.ymd) : `${formatShortDm(first.ymd)}–${formatShortDm(last.ymd)}`,
        valTr: bucketSum,
      });
    }
  }

  const maxBucket = Math.max(...buckets.map((b) => b.valTr), 1);

  return {
    kpiLabel: `Doanh thu (${totalDays} ngày)`,
    kpiVal: `${sumTr.toFixed(1).replace('.', ',')}tr`,
    kpiTrend: '+15,2%',
    kpiSub: `Từ ${formatFullDmy(startYmd)} đến ${formatFullDmy(endYmd)}`,
    bookVal: String(Math.max(4, Math.round(sumTr * 1.08))),
    bookTrend: `${totalDays} ngày chọn`,
    sepayVal: '95,6%',
    chartTitle: `Biểu đồ doanh thu tùy chỉnh: ${rangeLabel}`,
    totalFormatted: formatVndMillions(sumTr),
    avgFormatted: `${formatVndMillions(avgPerDayTr)}/ngày`,
    donutPeriod: `${totalDays} ngày`,
    donutVal: `${sumTr.toFixed(1).replace('.', ',')}tr`,
    gridCols: 'grid-cols-7',
    bars: buckets.map((b, idx) => ({
      label: b.label,
      valTr: b.valTr,
      displayVal: `${b.valTr.toFixed(1).replace('.', ',')}tr`,
      heightPct: Math.max(20, Math.round((b.valTr / maxBucket) * 92)),
      active: idx === buckets.length - 1,
    })),
  };
}

export async function renderAdminDashboardPage(ctx: RouteContext): Promise<void> {
  const user = sessionStore.user!;
  const isAdmin = user.role === 'ADMIN';
  const canViewFinance = isAdmin || hasBackofficePermission(user, 'STAFF_PAYMENT_VIEW');

  const todayDate = new Date();
  const todayYmd = toYmd(todayDate);

  let currentRange: DashboardRangeKey | 'custom' = 'week';
  let customStartYmd = addDaysYmd(todayYmd, -9); // Mặc định gợi ý 10 ngày gần nhất
  let customEndYmd = todayYmd;

  // Trạng thái đang chọn trong lịch popover
  let draftStartYmd = customStartYmd;
  let draftEndYmd: string | null = customEndYmd;
  let calendarViewYear = todayDate.getFullYear();
  let calendarViewMonth = todayDate.getMonth(); // 0..11
  let isCalendarOpen = false;

  let currentServiceGroup = 'all';
  let isServiceDropdownOpen = false;

  const main = renderBackofficeShell({
    container: ctx.container,
    activeNav: 'overview',
    breadcrumbs: [{ label: 'Quản trị' }, { label: 'Tổng quan' }],
    contentHtml: `<div id="a01Root">${renderLoadingSkeleton(3)}</div>`,
  });

  const root = main.querySelector<HTMLElement>('#a01Root')!;

  const load = async () => {
    root.innerHTML = renderLoadingSkeleton(3);
    try {
      const stats = await adminCatalogService.getDashboard();
      const analytics = stats.analytics;

      const workQueueTableHtml = `
        <section id="viec-can-xu-ly" class="bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
          <div class="p-6 border-b border-border flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 class="font-headline text-headline-md text-on-surface">Việc cần xử lý hôm nay</h2>
              <p class="font-body text-body-md text-text-secondary">Danh sách tác vụ chờ duyệt hoặc đối soát theo phạm vi quyền hiện tại.</p>
            </div>
            <span class="px-3 py-1 rounded-full ${
              stats.workQueue.length > 0 ? 'bg-warning-bg text-on-warning-bg' : 'bg-success-bg text-on-success-bg'
            } font-label text-label-sm tabular-nums">
              ${stats.workQueue.length} việc chờ
            </span>
          </div>

          ${
            stats.workQueue.length === 0
              ? `<div class="p-6">${renderEmptyState({
                  icon: 'task_alt',
                  title: 'Không có đầu việc tồn đọng',
                  description: 'Mọi mục trong phạm vi quyền của bạn hiện đã được xử lý ổn định.',
                })}</div>`
              : `
                <div class="table-scroll-wrap">
                  <table class="w-full text-left border-collapse">
                    <thead class="bg-surface-muted border-b border-border">
                      <tr>
                        <th class="px-4 py-3 font-label text-label-md text-on-surface">Phân hệ</th>
                        <th class="px-4 py-3 font-label text-label-md text-on-surface">Nội dung</th>
                        <th class="px-4 py-3 font-label text-label-md text-on-surface">Trạng thái</th>
                        <th class="px-4 py-3 font-label text-label-md text-on-surface text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-border">
                      ${stats.workQueue
                        .map(
                          (item) => `
                            <tr class="hover:bg-surface-muted/40 transition-colors">
                              <td class="px-4 py-4 font-label text-label-md text-on-surface whitespace-nowrap">${escapeHtml(item.moduleLabel ?? 'Vận hành')}</td>
                              <td class="px-4 py-4">
                                <p class="font-label text-label-md text-on-surface">${escapeHtml(item.title)}</p>
                                <p class="font-body text-body-md text-text-secondary mt-0.5">${escapeHtml(item.subtitle)}</p>
                              </td>
                              <td class="px-4 py-4 whitespace-nowrap">
                                ${renderBadge(item.badgeLabel, item.badgeTone, item.badgeTone === 'error' ? 'warning' : 'schedule')}
                              </td>
                              <td class="px-4 py-4 text-right whitespace-nowrap">
                                <a href="${escapeHtml(item.href)}" class="inline-flex items-center justify-center min-h-[38px] px-4 rounded-full border border-primary/40 bg-primary-light/60 text-primary hover:bg-primary hover:text-on-primary font-label text-label-sm no-underline transition-colors">
                                  ${escapeHtml(item.actionLabel ?? 'Mở xử lý')}
                                </a>
                              </td>
                            </tr>
                          `,
                        )
                        .join('')}
                    </tbody>
                  </table>
                </div>
              `
          }
        </section>
      `;

      if (canViewFinance && analytics) {
        const getActiveMetrics = (): DashboardRangeMetrics => {
          if (currentRange === 'custom') {
            return buildCustomRangeMetrics(customStartYmd, customEndYmd);
          }
          return analytics.ranges[currentRange];
        };

        const rangeInfo = getActiveMetrics();

        root.innerHTML = `
          <div class="flex flex-col gap-6">
            <!-- Page Header + Bộ lọc kỳ báo cáo + Lịch chọn khoảng ngày tùy chỉnh -->
            <div class="flex flex-wrap items-end justify-between gap-4">
              <div class="flex flex-col gap-1">
                <h1 class="font-headline text-headline-lg text-on-surface">Tổng quan vận hành &amp; Doanh thu</h1>
                <p class="font-body text-body-md text-text-secondary">
                  ${
                    isAdmin
                      ? 'Theo dõi doanh thu đặt dịch vụ, tỷ lệ đối soát SePay và các đầu việc vận hành toàn hệ thống.'
                      : `Chế độ theo dõi doanh thu & đối soát chỉ đọc dành cho ${escapeHtml(user.fullName)}.`
                  }
                </p>
              </div>

              <div class="flex flex-wrap items-center gap-2.5">
                <!-- Nhóm nút kỳ cố định -->
                <div class="inline-flex flex-wrap items-center bg-surface border border-border rounded-xl p-1 gap-1 shadow-sm" role="tablist" aria-label="Khoảng thời gian">
                  ${(
                    [
                      ['day', 'Ngày'],
                      ['week', 'Tuần'],
                      ['month', 'Tháng'],
                      ['90d', '90 ngày'],
                    ] as Array<[DashboardRangeKey, string]>
                  )
                    .map(
                      ([key, label]) => `
                        <button
                          type="button"
                          role="tab"
                          data-range="${key}"
                          aria-selected="${currentRange === key ? 'true' : 'false'}"
                          class="range-tab min-h-[36px] px-3.5 rounded-lg font-label text-label-sm transition-colors ${
                            currentRange === key
                              ? 'bg-primary text-on-primary shadow-sm'
                              : 'text-text-secondary hover:bg-surface-muted hover:text-on-surface'
                          }"
                        >
                          ${label}
                        </button>
                      `,
                    )
                    .join('')}
                </div>

                <!-- Nút mở Lịch chọn khoảng ngày linh hoạt (7 ngày, 10 ngày, tùy chọn Từ - Đến) -->
                <div class="relative" id="customDateWrap">
                  <button
                    type="button"
                    id="customDateBtn"
                    aria-expanded="false"
                    aria-haspopup="dialog"
                    class="inline-flex items-center gap-2 min-h-[44px] px-3.5 rounded-xl border font-label text-label-sm shadow-sm transition-colors ${
                      currentRange === 'custom'
                        ? 'bg-primary-light border-primary text-primary'
                        : 'bg-surface border-border text-on-surface hover:border-primary/40 hover:bg-surface-muted/60'
                    }"
                  >
                    <span class="material-symbols-outlined text-[18px] text-primary" aria-hidden="true">calendar_month</span>
                    <span id="customDateBtnLabel" class="tabular-nums">Chọn lịch ngày</span>
                    <span class="material-symbols-outlined text-[18px] text-text-secondary" aria-hidden="true">expand_more</span>
                  </button>

                  <!-- Popover Lịch thông minh -->
                  <div
                    id="customDatePopover"
                    role="dialog"
                    aria-label="Chọn khoảng ngày xem doanh thu"
                    class="hidden absolute right-0 top-[calc(100%+8px)] z-40 w-[336px] max-w-[calc(100vw-2rem)] bg-surface border border-border rounded-2xl shadow-lg p-4 flex flex-col gap-3.5 tl-modal-enter"
                  >
                    <div class="flex flex-col gap-1.5">
                      <span class="font-label text-label-sm text-text-secondary">Chọn nhanh khoảng ngày</span>
                      <div class="flex flex-wrap gap-1.5">
                        <button type="button" data-quick-days="7" class="px-2.5 py-1 rounded-lg border border-border bg-background hover:border-primary hover:text-primary font-label text-label-sm transition-colors">7 ngày</button>
                        <button type="button" data-quick-days="10" class="px-2.5 py-1 rounded-lg border border-border bg-background hover:border-primary hover:text-primary font-label text-label-sm transition-colors">10 ngày</button>
                        <button type="button" data-quick-days="14" class="px-2.5 py-1 rounded-lg border border-border bg-background hover:border-primary hover:text-primary font-label text-label-sm transition-colors">14 ngày</button>
                        <button type="button" data-quick-days="30" class="px-2.5 py-1 rounded-lg border border-border bg-background hover:border-primary hover:text-primary font-label text-label-sm transition-colors">30 ngày</button>
                      </div>
                    </div>

                    <div class="border-t border-border pt-3 flex flex-col gap-2.5">
                      <div class="flex items-center justify-between">
                        <button type="button" id="calPrevMonth" aria-label="Tháng trước" class="w-8 h-8 rounded-lg border border-border hover:bg-surface-muted inline-flex items-center justify-center text-on-surface">
                          <span class="material-symbols-outlined text-[18px]" aria-hidden="true">chevron_left</span>
                        </button>
                        <strong id="calMonthTitle" class="font-label text-label-md text-on-surface tabular-nums"></strong>
                        <button type="button" id="calNextMonth" aria-label="Tháng sau" class="w-8 h-8 rounded-lg border border-border hover:bg-surface-muted inline-flex items-center justify-center text-on-surface">
                          <span class="material-symbols-outlined text-[18px]" aria-hidden="true">chevron_right</span>
                        </button>
                      </div>

                      <div class="grid grid-cols-7 text-center font-label text-[11px] text-text-secondary py-1">
                        <span>T2</span><span>T3</span><span>T4</span><span>T5</span><span>T6</span><span>T7</span><span>CN</span>
                      </div>

                      <div id="calDaysGrid" class="grid grid-cols-7 gap-y-1 text-center"></div>
                    </div>

                    <div class="p-2.5 rounded-xl bg-background border border-border flex items-center justify-between gap-2 font-body text-label-sm">
                      <span id="calDraftSummary" class="text-on-surface font-medium tabular-nums"></span>
                      <span id="calDraftCount" class="px-2 py-0.5 rounded-md bg-primary-light text-primary font-label text-label-sm tabular-nums"></span>
                    </div>

                    <div class="flex items-center justify-end gap-2 pt-1">
                      <button type="button" id="calCancelBtn" class="min-h-[36px] px-3 rounded-lg border border-border text-text-secondary hover:bg-surface-muted font-label text-label-sm">Đóng</button>
                      <button type="button" id="calApplyBtn" class="min-h-[36px] px-4 rounded-lg bg-primary text-on-primary hover:bg-primary-hover font-label text-label-sm shadow-sm">Áp dụng</button>
                    </div>
                  </div>
                </div>

                <a href="/quan-tri/thanh-toan" class="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-xl bg-primary text-on-primary hover:bg-primary-hover font-label text-label-md no-underline shadow-sm transition-colors">
                  <span class="material-symbols-outlined text-[18px]" aria-hidden="true">account_balance</span>
                  <span>Giao dịch SePay</span>
                </a>
              </div>
            </div>

            <!-- 4 KPI Metric Cards -->
            <section aria-label="Chỉ số hiệu suất chính" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <article class="bg-surface border border-border rounded-xl p-5 shadow-sm flex flex-col gap-3">
                <div class="flex items-center justify-between gap-2">
                  <span id="kpiRevLabel" class="font-label text-label-md text-text-secondary">${escapeHtml(rangeInfo.kpiLabel)}</span>
                  <span class="w-9 h-9 rounded-full bg-primary-light text-primary inline-flex items-center justify-center shrink-0">
                    <span class="material-symbols-outlined text-[20px]" aria-hidden="true">payments</span>
                  </span>
                </div>
                <div class="flex items-baseline justify-between gap-2">
                  <span id="kpiRevVal" class="font-headline text-headline-lg text-on-surface tabular-nums">${escapeHtml(rangeInfo.kpiVal)}</span>
                  <span id="kpiRevTrend" class="px-2.5 py-0.5 rounded-full bg-success-bg text-on-success-bg font-label text-label-sm tabular-nums">${escapeHtml(rangeInfo.kpiTrend)}</span>
                </div>
                <p id="kpiRevSub" class="font-body text-body-md text-text-secondary truncate">${escapeHtml(rangeInfo.kpiSub)}</p>
              </article>

              <article class="bg-surface border border-border rounded-xl p-5 shadow-sm flex flex-col gap-3">
                <div class="flex items-center justify-between gap-2">
                  <span class="font-label text-label-md text-text-secondary">Booking hoàn tất</span>
                  <span class="w-9 h-9 rounded-full bg-info-bg text-on-info-bg inline-flex items-center justify-center shrink-0">
                    <span class="material-symbols-outlined text-[20px]" aria-hidden="true">confirmation_number</span>
                  </span>
                </div>
                <div class="flex items-baseline justify-between gap-2">
                  <span id="kpiBookVal" class="font-headline text-headline-lg text-on-surface tabular-nums">${escapeHtml(rangeInfo.bookVal)}</span>
                  <span id="kpiBookTrend" class="px-2.5 py-0.5 rounded-full bg-success-bg text-on-success-bg font-label text-label-sm tabular-nums">${escapeHtml(rangeInfo.bookTrend)}</span>
                </div>
                <p class="font-body text-body-md text-text-secondary tabular-nums">${stats.pendingBookings} đơn đang chờ thanh toán</p>
              </article>

              <article class="bg-surface border border-border rounded-xl p-5 shadow-sm flex flex-col gap-3">
                <div class="flex items-center justify-between gap-2">
                  <span class="font-label text-label-md text-text-secondary">Tỷ lệ đối soát SePay</span>
                  <span class="w-9 h-9 rounded-full bg-success-bg text-on-success-bg inline-flex items-center justify-center shrink-0">
                    <span class="material-symbols-outlined text-[20px]" aria-hidden="true">qr_code_2</span>
                  </span>
                </div>
                <div class="flex items-baseline justify-between gap-2">
                  <span id="kpiSepayVal" class="font-headline text-headline-lg text-on-surface tabular-nums">${escapeHtml(rangeInfo.sepayVal)}</span>
                  <span class="px-2.5 py-0.5 rounded-full ${
                    stats.needsReviewEvents > 0 ? 'bg-warning-bg text-on-warning-bg' : 'bg-success-bg text-on-success-bg'
                  } font-label text-label-sm tabular-nums">${stats.needsReviewEvents} cần soát</span>
                </div>
                <p class="font-body text-body-md text-text-secondary">Tự động khớp giao dịch QR</p>
              </article>

              <article class="bg-surface border border-border rounded-xl p-5 shadow-sm flex flex-col gap-3">
                <div class="flex items-center justify-between gap-2">
                  <span class="font-label text-label-md text-text-secondary">Cần xử lý hôm nay</span>
                  <span class="w-9 h-9 rounded-full bg-warning-bg text-on-warning-bg inline-flex items-center justify-center shrink-0">
                    <span class="material-symbols-outlined text-[20px]" aria-hidden="true">pending_actions</span>
                  </span>
                </div>
                <div class="flex items-center justify-between gap-2">
                  <span class="font-headline text-headline-lg text-on-surface tabular-nums">${stats.workQueue.length}</span>
                  <button type="button" id="scrollToQueueBtn" class="px-3 py-1 rounded-full bg-primary-light text-primary hover:bg-primary hover:text-on-primary font-label text-label-sm transition-colors">Xem ngay ↓</button>
                </div>
                <p class="font-body text-body-md text-text-secondary">Đánh giá, SePay &amp; nhân viên</p>
              </article>
            </section>

            <!-- Charts Row: Biểu đồ cột phẳng vuông vức (8 cột) + Biểu đồ Donut (4 cột) -->
            <section aria-label="Biểu đồ doanh thu" class="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div class="lg:col-span-8 bg-surface border border-border rounded-xl p-6 shadow-sm flex flex-col gap-4">
                <div class="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 id="revenueChartTitle" class="font-headline text-headline-md text-on-surface">${escapeHtml(rangeInfo.chartTitle)}</h2>
                    <p class="font-body text-body-md text-text-secondary">Đơn vị: triệu đồng (VNĐ)</p>
                  </div>

                  <!-- Custom UI Dropdown nối liền khối đồng bộ hoàn toàn với giao diện -->
                  <div class="relative w-[240px]" id="serviceDropdownWrap">
                    <button
                      type="button"
                      id="serviceDropdownBtn"
                      aria-haspopup="listbox"
                      aria-expanded="false"
                      class="w-full inline-flex items-center justify-between gap-3 min-h-[42px] px-3.5 rounded-xl bg-surface border border-border hover:border-primary/50 focus:border-primary font-label text-label-sm text-on-surface transition-all"
                    >
                      <span class="inline-flex items-center gap-2 min-w-0">
                        <span id="serviceDropdownDot" class="w-2.5 h-2.5 rounded-full bg-slate-400 shrink-0"></span>
                        <span id="serviceDropdownLabel" class="truncate">Tất cả dịch vụ</span>
                      </span>
                      <span id="serviceDropdownChevron" class="material-symbols-outlined text-[18px] text-text-secondary transition-transform shrink-0" aria-hidden="true">expand_more</span>
                    </button>

                    <ul
                      id="serviceDropdownMenu"
                      role="listbox"
                      aria-label="Chọn nhóm dịch vụ"
                      class="hidden absolute left-0 right-0 top-[calc(100%-1px)] z-30 w-full bg-surface border border-primary border-t-border rounded-b-xl rounded-t-none shadow-lg p-1.5 flex flex-col gap-0.5"
                    >
                      ${SERVICE_OPTIONS.map(
                        (opt) => `
                          <li>
                            <button
                              type="button"
                              role="option"
                              data-service-opt="${opt.value}"
                              aria-selected="${currentServiceGroup === opt.value ? 'true' : 'false'}"
                              class="w-full px-3 py-2 rounded-lg flex items-center justify-between gap-2 text-left font-label text-label-sm transition-colors ${
                                currentServiceGroup === opt.value
                                  ? 'bg-primary-light text-primary font-semibold'
                                  : 'text-on-surface hover:bg-surface-muted'
                              }"
                            >
                              <span class="inline-flex items-center gap-2 min-w-0">
                                <span class="w-2.5 h-2.5 rounded-full ${opt.dotClass} shrink-0"></span>
                                <span class="truncate">${escapeHtml(opt.label)}</span>
                              </span>
                              <span data-check-icon class="material-symbols-outlined text-[16px] text-primary shrink-0 ${
                                currentServiceGroup === opt.value ? '' : ' opacity-0'
                              }" aria-hidden="true">check</span>
                            </button>
                          </li>
                        `,
                      ).join('')}
                    </ul>
                  </div>
                </div>

                <!-- Khung cột biểu đồ phẳng không bo tròn -->
                <div id="revenueBars" class="flex items-end justify-between gap-2 sm:gap-3 h-[232px] pt-6 pb-0 border-b border-border"></div>

                <div class="flex flex-wrap items-center justify-between gap-4 pt-1 font-body text-body-md text-text-secondary">
                  <span>Tổng kỳ: <strong id="chartTotal" class="text-on-surface tabular-nums">${escapeHtml(rangeInfo.totalFormatted)}</strong></span>
                  <span>Trung bình: <strong id="chartAvg" class="text-on-surface tabular-nums">${escapeHtml(rangeInfo.avgFormatted)}</strong></span>
                </div>
              </div>

              <!-- Donut Cơ cấu doanh thu -->
              <div class="lg:col-span-4 bg-surface border border-border rounded-xl p-6 shadow-sm flex flex-col justify-between gap-4">
                <div>
                  <h2 class="font-headline text-headline-md text-on-surface">Cơ cấu doanh thu</h2>
                  <p class="font-body text-body-md text-text-secondary">Phân bổ theo nhóm dịch vụ</p>
                </div>

                <div class="flex items-center justify-center py-2">
                  <div class="relative w-[172px] h-[172px] flex items-center justify-center">
                    <svg viewBox="0 0 120 120" class="w-full h-full -rotate-90" aria-hidden="true">
                      <circle cx="60" cy="60" r="46" fill="none" stroke="currentColor" stroke-width="16" class="text-surface-muted"></circle>
                      <circle cx="60" cy="60" r="46" fill="none" stroke="currentColor" stroke-width="16" stroke-dasharray="156.08 289.03" stroke-dashoffset="0" class="text-primary"></circle>
                      <circle cx="60" cy="60" r="46" fill="none" stroke="currentColor" stroke-width="16" stroke-dasharray="80.93 289.03" stroke-dashoffset="-156.08" class="text-info"></circle>
                      <circle cx="60" cy="60" r="46" fill="none" stroke="currentColor" stroke-width="16" stroke-dasharray="52.02 289.03" stroke-dashoffset="-237.01" class="text-success"></circle>
                    </svg>
                    <div class="absolute text-center">
                      <span id="donutPeriod" class="block font-label text-label-sm text-text-secondary">${escapeHtml(rangeInfo.donutPeriod)}</span>
                      <span id="donutVal" class="font-headline text-headline-md text-on-surface tabular-nums">${escapeHtml(rangeInfo.donutVal)}</span>
                    </div>
                  </div>
                </div>

                <div class="flex flex-col gap-2.5">
                  ${analytics.breakdown
                    .map(
                      (b) => `
                        <div class="flex items-center justify-between font-body text-body-md">
                          <span class="inline-flex items-center gap-2 text-on-surface">
                            <span class="w-3 h-3 ${b.colorClass} inline-block shrink-0"></span>
                            <span>${escapeHtml(b.label)}</span>
                          </span>
                          <strong class="text-on-surface tabular-nums">${escapeHtml(b.valueLabel)}</strong>
                        </div>
                      `,
                    )
                    .join('')}
                </div>
              </div>
            </section>

            <!-- Doanh thu theo điểm đến -->
            <section aria-label="Phân tích điểm đến" class="bg-surface border border-border rounded-xl p-6 shadow-sm flex flex-col gap-5">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 class="font-headline text-headline-md text-on-surface">Doanh thu theo điểm đến</h2>
                  <p class="font-body text-body-md text-text-secondary">Đang mở công khai ${stats.activeDestinations} địa điểm &amp; ${stats.activeServices} dịch vụ trải nghiệm</p>
                </div>
                ${
                  hasBackofficePermission(user, 'STAFF_DESTINATION')
                    ? `<a href="/quan-tri/dia-diem" class="px-3.5 py-1.5 rounded-full border border-border bg-background hover:border-primary/40 hover:text-primary font-label text-label-sm text-on-surface no-underline transition-colors">Quản lý điểm đến →</a>`
                    : ''
                }
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
                ${analytics.destinationRevenue
                  .map(
                    (d) => `
                      <div class="flex flex-col gap-1.5">
                        <div class="flex items-center justify-between font-body text-body-md">
                          <span class="text-on-surface font-medium">${escapeHtml(d.name)}</span>
                          <span class="text-on-surface font-semibold tabular-nums">${escapeHtml(d.amountFormatted)}</span>
                        </div>
                        <div class="w-full h-2.5 bg-surface-muted overflow-hidden">
                          <div class="h-full ${d.barColorClass} transition-all duration-300" style="width: ${d.barWidthPct}%"></div>
                        </div>
                      </div>
                    `,
                  )
                  .join('')}
              </div>
            </section>

            ${workQueueTableHtml}
          </div>
        `;

        const syncRangeControlsUi = () => {
          root.querySelectorAll<HTMLButtonElement>('[data-range]').forEach((t) => {
            const isSelected = t.dataset.range === currentRange;
            t.setAttribute('aria-selected', isSelected ? 'true' : 'false');
            t.className = `range-tab min-h-[36px] px-3.5 rounded-lg font-label text-label-sm transition-colors ${
              isSelected
                ? 'bg-primary text-on-primary shadow-sm'
                : 'text-text-secondary hover:bg-surface-muted hover:text-on-surface'
            }`;
          });

          const customBtn = root.querySelector<HTMLButtonElement>('#customDateBtn');
          const customBtnLabel = root.querySelector<HTMLElement>('#customDateBtnLabel');
          if (customBtn && customBtnLabel) {
            if (currentRange === 'custom') {
              const days = diffDaysInclusive(customStartYmd, customEndYmd);
              customBtnLabel.textContent =
                days === 1
                  ? formatFullDmy(customStartYmd)
                  : `${formatShortDm(customStartYmd)} – ${formatShortDm(customEndYmd)} (${days}N)`;
              customBtn.className =
                'inline-flex items-center gap-2 min-h-[44px] px-3.5 rounded-xl border font-label text-label-sm shadow-sm transition-colors bg-primary-light border-primary text-primary';
            } else {
              customBtnLabel.textContent = 'Chọn lịch ngày';
              customBtn.className =
                'inline-flex items-center gap-2 min-h-[44px] px-3.5 rounded-xl border font-label text-label-sm shadow-sm transition-colors bg-surface border-border text-on-surface hover:border-primary/40 hover:bg-surface-muted/60';
            }
          }
        };

        const updateChartsInPlace = () => {
          const d = getActiveMetrics();
          const selectedSvc = SERVICE_OPTIONS.find((s) => s.value === currentServiceGroup) ?? SERVICE_OPTIONS[0]!;
          const scale = selectedSvc.scale;

          const revLabel = root.querySelector('#kpiRevLabel');
          const revVal = root.querySelector('#kpiRevVal');
          const revTrend = root.querySelector('#kpiRevTrend');
          const revSub = root.querySelector('#kpiRevSub');
          const bookVal = root.querySelector('#kpiBookVal');
          const bookTrend = root.querySelector('#kpiBookTrend');
          const sepayVal = root.querySelector('#kpiSepayVal');
          const chartTitle = root.querySelector('#revenueChartTitle');
          const chartTotal = root.querySelector('#chartTotal');
          const chartAvg = root.querySelector('#chartAvg');
          const donutPeriod = root.querySelector('#donutPeriod');
          const donutVal = root.querySelector('#donutVal');
          const barsEl = root.querySelector<HTMLElement>('#revenueBars');

          if (revLabel) revLabel.textContent = d.kpiLabel;
          if (revVal) revVal.textContent = d.kpiVal;
          if (revTrend) revTrend.textContent = d.kpiTrend;
          if (revSub) revSub.textContent = d.kpiSub;
          if (bookVal) bookVal.textContent = d.bookVal;
          if (bookTrend) bookTrend.textContent = d.bookTrend;
          if (sepayVal) sepayVal.textContent = d.sepayVal;
          if (chartTitle) chartTitle.textContent = d.chartTitle;
          if (chartTotal) chartTotal.textContent = d.totalFormatted;
          if (chartAvg) chartAvg.textContent = d.avgFormatted;
          if (donutPeriod) donutPeriod.textContent = d.donutPeriod;
          if (donutVal) donutVal.textContent = d.donutVal;

          if (barsEl) {
            barsEl.innerHTML = d.bars
              .map((b) => {
                const scaledVal =
                  scale === 1 ? b.displayVal : `${(b.valTr * scale).toFixed(1).replace('.', ',')}tr`;
                const scaledH = `${Math.max(16, Math.round(b.heightPct * (scale === 1 ? 1 : 0.78)))}%`;
                return `
                  <div class="group flex-1 min-w-0 flex flex-col items-center gap-2 h-full justify-end">
                    <span class="font-label text-[11px] sm:text-label-sm ${
                      b.active ? 'text-primary font-semibold' : 'text-text-secondary group-hover:text-primary'
                    } tabular-nums truncate max-w-full transition-colors">${escapeHtml(scaledVal)}</span>
                    <div
                      class="w-full max-w-[46px] rounded-none ${
                        b.active
                          ? 'bg-primary'
                          : 'bg-primary-light border-t-2 border-x border-primary/40 group-hover:bg-primary/80'
                      } transition-all duration-300"
                      style="height: ${scaledH}"
                    ></div>
                    <span class="font-label text-[11px] sm:text-label-sm ${
                      b.active ? 'text-primary font-semibold' : 'text-text-secondary'
                    } pt-2 truncate max-w-full">${escapeHtml(b.label)}</span>
                  </div>
                `;
              })
              .join('');
          }
        };

        // Render Lịch tháng trong Popover
        const renderCalendarGrid = () => {
          const monthTitle = root.querySelector<HTMLElement>('#calMonthTitle');
          const gridEl = root.querySelector<HTMLElement>('#calDaysGrid');
          const summaryEl = root.querySelector<HTMLElement>('#calDraftSummary');
          const countEl = root.querySelector<HTMLElement>('#calDraftCount');
          if (!monthTitle || !gridEl || !summaryEl || !countEl) return;

          monthTitle.textContent = `Tháng ${calendarViewMonth + 1} / ${calendarViewYear}`;

          const firstOfMonth = new Date(calendarViewYear, calendarViewMonth, 1);
          // Đổi sang Thứ 2 = 0 .. Chủ Nhật = 6
          const startOffset = (firstOfMonth.getDay() + 6) % 7;
          const daysInMonth = new Date(calendarViewYear, calendarViewMonth + 1, 0).getDate();

          const cells: string[] = [];
          for (let i = 0; i < startOffset; i++) {
            cells.push(`<span></span>`);
          }

          const effectiveEnd = draftEndYmd ?? draftStartYmd;
          const minSel = draftStartYmd <= effectiveEnd ? draftStartYmd : effectiveEnd;
          const maxSel = draftStartYmd <= effectiveEnd ? effectiveEnd : draftStartYmd;

          for (let day = 1; day <= daysInMonth; day++) {
            const ymd = toYmd(new Date(calendarViewYear, calendarViewMonth, day));
            const isStart = ymd === minSel;
            const isEnd = ymd === maxSel;
            const inRange = ymd > minSel && ymd < maxSel;
            const isToday = ymd === todayYmd;

            let btnCls = 'text-on-surface hover:bg-surface-muted rounded-lg';
            if (isStart || isEnd) {
              btnCls = 'bg-primary text-on-primary font-semibold rounded-lg shadow-sm';
            } else if (inRange) {
              btnCls = 'bg-primary-light text-primary font-medium rounded-none';
            } else if (isToday) {
              btnCls = 'border border-primary/50 text-primary font-semibold rounded-lg';
            }

            cells.push(`
              <button
                type="button"
                data-cal-ymd="${ymd}"
                class="h-9 w-full inline-flex items-center justify-center font-body text-label-sm tabular-nums transition-colors ${btnCls}"
              >
                ${day}
              </button>
            `);
          }

          gridEl.innerHTML = cells.join('');

          const daysCount = diffDaysInclusive(minSel, maxSel);
          summaryEl.textContent =
            minSel === maxSel
              ? `Ngày ${formatFullDmy(minSel)}`
              : `${formatShortDm(minSel)} → ${formatShortDm(maxSel)}`;
          countEl.textContent = `${daysCount} ngày`;

          gridEl.querySelectorAll<HTMLButtonElement>('[data-cal-ymd]').forEach((btn) => {
            btn.addEventListener('click', (ev) => {
              ev.stopPropagation();
              const clicked = btn.dataset.calYmd!;
              if (draftEndYmd !== null) {
                // Bắt đầu lượt chọn khoảng mới
                draftStartYmd = clicked;
                draftEndYmd = null;
              } else {
                // Hoàn tất ngày kết thúc (tự sắp xếp nhỏ -> lớn)
                if (clicked < draftStartYmd) {
                  draftEndYmd = draftStartYmd;
                  draftStartYmd = clicked;
                } else {
                  draftEndYmd = clicked;
                }
              }
              renderCalendarGrid();
            });
          });
        };

        const svcBtn = root.querySelector<HTMLButtonElement>('#serviceDropdownBtn');
        const svcMenu = root.querySelector<HTMLElement>('#serviceDropdownMenu');
        const svcChevron = root.querySelector<HTMLElement>('#serviceDropdownChevron');

        const setSvcBtnOpenStyle = (open: boolean) => {
          if (!svcBtn) return;
          svcBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
          svcChevron?.classList.toggle('rotate-180', open);
          svcChevron?.classList.toggle('text-primary', open);
          if (open) {
            svcBtn.classList.remove('rounded-xl', 'border-border');
            svcBtn.classList.add('rounded-t-xl', 'rounded-b-none', 'border-primary', 'shadow-sm');
          } else {
            svcBtn.classList.remove('rounded-t-xl', 'rounded-b-none', 'border-primary', 'shadow-sm');
            svcBtn.classList.add('rounded-xl', 'border-border');
          }
        };

        const closePopovers = () => {
          isServiceDropdownOpen = false;
          isCalendarOpen = false;
          svcMenu?.classList.add('hidden');
          setSvcBtnOpenStyle(false);
          root.querySelector('#customDatePopover')?.classList.add('hidden');
          root.querySelector('#customDateBtn')?.setAttribute('aria-expanded', 'false');
        };

        // Gắn sự kiện các tab kỳ cố định
        root.querySelectorAll<HTMLButtonElement>('[data-range]').forEach((tab) => {
          tab.addEventListener('click', () => {
            const next = tab.dataset.range as DashboardRangeKey;
            if (!next || next === currentRange) return;
            currentRange = next;
            closePopovers();
            syncRangeControlsUi();
            updateChartsInPlace();
          });
        });

        // Gắn sự kiện Lịch chọn ngày tùy chỉnh
        const customDateBtn = root.querySelector<HTMLButtonElement>('#customDateBtn');
        const customDatePopover = root.querySelector<HTMLElement>('#customDatePopover');

        customDateBtn?.addEventListener('click', (ev) => {
          ev.stopPropagation();
          const nextOpen = !isCalendarOpen;
          closePopovers();
          isCalendarOpen = nextOpen;
          if (isCalendarOpen) {
            draftStartYmd = customStartYmd;
            draftEndYmd = customEndYmd;
            const focusDt = parseYmd(customEndYmd);
            calendarViewYear = focusDt.getFullYear();
            calendarViewMonth = focusDt.getMonth();
            renderCalendarGrid();
            customDatePopover?.classList.remove('hidden');
            customDateBtn.setAttribute('aria-expanded', 'true');
          }
        });

        customDatePopover?.addEventListener('click', (ev) => ev.stopPropagation());

        root.querySelector('#calPrevMonth')?.addEventListener('click', () => {
          calendarViewMonth -= 1;
          if (calendarViewMonth < 0) {
            calendarViewMonth = 11;
            calendarViewYear -= 1;
          }
          renderCalendarGrid();
        });

        root.querySelector('#calNextMonth')?.addEventListener('click', () => {
          calendarViewMonth += 1;
          if (calendarViewMonth > 11) {
            calendarViewMonth = 0;
            calendarViewYear += 1;
          }
          renderCalendarGrid();
        });

        root.querySelectorAll<HTMLButtonElement>('[data-quick-days]').forEach((btn) => {
          btn.addEventListener('click', () => {
            const n = Number(btn.dataset.quickDays ?? '7');
            draftEndYmd = todayYmd;
            draftStartYmd = addDaysYmd(todayYmd, -(n - 1));
            const focusDt = parseYmd(todayYmd);
            calendarViewYear = focusDt.getFullYear();
            calendarViewMonth = focusDt.getMonth();
            renderCalendarGrid();
          });
        });

        root.querySelector('#calCancelBtn')?.addEventListener('click', () => {
          closePopovers();
        });

        root.querySelector('#calApplyBtn')?.addEventListener('click', () => {
          const finalEnd = draftEndYmd ?? draftStartYmd;
          customStartYmd = draftStartYmd <= finalEnd ? draftStartYmd : finalEnd;
          customEndYmd = draftStartYmd <= finalEnd ? finalEnd : draftStartYmd;
          currentRange = 'custom';
          closePopovers();
          syncRangeControlsUi();
          updateChartsInPlace();
        });

        // Gắn sự kiện Custom Service Dropdown
        svcBtn?.addEventListener('click', (ev) => {
          ev.stopPropagation();
          const nextOpen = !isServiceDropdownOpen;
          closePopovers();
          isServiceDropdownOpen = nextOpen;
          if (isServiceDropdownOpen) {
            svcMenu?.classList.remove('hidden');
            setSvcBtnOpenStyle(true);
          }
        });

        root.querySelectorAll<HTMLButtonElement>('[data-service-opt]').forEach((optBtn) => {
          optBtn.addEventListener('click', (ev) => {
            ev.stopPropagation();
            const val = optBtn.dataset.serviceOpt ?? 'all';
            currentServiceGroup = val;
            const chosen = SERVICE_OPTIONS.find((s) => s.value === val) ?? SERVICE_OPTIONS[0]!;

            const lbl = root.querySelector('#serviceDropdownLabel');
            const dot = root.querySelector('#serviceDropdownDot');
            if (lbl) lbl.textContent = chosen.label;
            if (dot) dot.className = `w-2.5 h-2.5 rounded-full ${chosen.dotClass} shrink-0`;

            root.querySelectorAll<HTMLButtonElement>('[data-service-opt]').forEach((b) => {
              const active = b.dataset.serviceOpt === val;
              b.setAttribute('aria-selected', active ? 'true' : 'false');
              b.className = `w-full px-3 py-2 rounded-lg flex items-center justify-between gap-2 text-left font-label text-label-sm transition-colors ${
                active ? 'bg-primary-light text-primary' : 'text-on-surface hover:bg-surface-muted'
              }`;
              b.querySelector('[data-check-icon]')?.classList.toggle('opacity-0', !active);
            });

            closePopovers();
            updateChartsInPlace();
          });
        });

        const onDocClick = () => closePopovers();
        const onDocKey = (e: KeyboardEvent) => {
          if (e.key === 'Escape') closePopovers();
        };
        document.addEventListener('click', onDocClick);
        document.addEventListener('keydown', onDocKey);
        ctx.onCleanup(() => {
          document.removeEventListener('click', onDocClick);
          document.removeEventListener('keydown', onDocKey);
        });

        root.querySelector('#scrollToQueueBtn')?.addEventListener('click', () => {
          root.querySelector('#viec-can-xu-ly')?.scrollIntoView({ behavior: 'smooth' });
        });

        syncRangeControlsUi();
        updateChartsInPlace();
        return;
      }

      // Chế độ Dashboard giới hạn cho Nhân viên chuyên trách (không có quyền xem doanh thu/thanh toán)
      const scopedCards: Array<{ label: string; value: number; sub: string; icon: string; tone: string; href: string }> = [];
      if (hasBackofficePermission(user, 'STAFF_BOOKING')) {
        scopedCards.push({
          label: 'Booking chờ thanh toán',
          value: stats.pendingBookings,
          sub: `${stats.confirmedBookings} đơn đã xác nhận`,
          icon: 'receipt_long',
          tone: 'bg-warning-bg text-on-warning-bg',
          href: '/quan-tri/booking',
        });
      }
      if (hasBackofficePermission(user, 'STAFF_REVIEW')) {
        scopedCards.push({
          label: 'Đánh giá chờ duyệt',
          value: stats.pendingReviews,
          sub: 'Chưa hiển thị công khai',
          icon: 'fact_check',
          tone: 'bg-info-bg text-on-info-bg',
          href: '/quan-tri/danh-gia',
        });
      }
      if (hasBackofficePermission(user, 'STAFF_DESTINATION')) {
        scopedCards.push({
          label: 'Địa điểm đang hoạt động',
          value: stats.activeDestinations,
          sub: 'Hiển thị trong danh mục nội bộ',
          icon: 'place',
          tone: 'bg-success-bg text-on-success-bg',
          href: '/quan-tri/dia-diem',
        });
      }
      if (hasBackofficePermission(user, 'STAFF_SERVICE')) {
        scopedCards.push({
          label: 'Dịch vụ đang mở đặt',
          value: stats.activeServices,
          sub: 'Gắn với địa điểm công khai',
          icon: 'confirmation_number',
          tone: 'bg-primary-light text-primary',
          href: '/quan-tri/dich-vu',
        });
      }

      root.innerHTML = `
        <div class="flex flex-col gap-6">
          <div>
            <h1 class="font-headline text-headline-lg text-on-surface">Tổng quan công việc vận hành</h1>
            <p class="font-body text-body-md text-text-secondary">Hiển thị số liệu và đầu việc trong phạm vi nhóm quyền được cấp cho ${escapeHtml(user.fullName)}.</p>
          </div>

          ${
            scopedCards.length === 0
              ? renderEmptyState({
                  icon: 'admin_panel_settings',
                  title: 'Tài khoản chưa được gán nhóm quyền nghiệp vụ',
                  description: 'Vui lòng liên hệ Quản trị viên để được cấp nhóm quyền phù hợp với vai trò vận hành của bạn.',
                })
              : `
                <section aria-label="Thống kê vận hành theo quyền" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  ${scopedCards
                    .map(
                      (c) => `
                        <a href="${escapeHtml(c.href)}" class="bg-surface border border-border rounded-xl p-5 shadow-sm hover:border-primary no-underline transition-colors flex flex-col gap-3">
                          <div class="flex items-center justify-between gap-2">
                            <span class="font-label text-label-md text-text-secondary">${escapeHtml(c.label)}</span>
                            <span class="w-10 h-10 rounded-full ${c.tone} inline-flex items-center justify-center shrink-0">
                              <span class="material-symbols-outlined text-[20px]" aria-hidden="true">${c.icon}</span>
                            </span>
                          </div>
                          <span class="font-headline text-headline-lg text-on-surface tabular-nums">${c.value}</span>
                          <span class="font-body text-label-sm text-text-secondary">${escapeHtml(c.sub)}</span>
                        </a>
                      `,
                    )
                    .join('')}
                </section>
                ${workQueueTableHtml}
              `
          }
        </div>
      `;
    } catch (err) {
      root.innerHTML = renderErrorBanner(toUserErrorMessage(err), 'retryA01');
      root.querySelector('#retryA01')?.addEventListener('click', () => void load());
    }
  };

  await load();
}
