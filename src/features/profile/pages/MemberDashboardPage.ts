import type { RouteContext } from '@/app/router';
import { sessionStore } from '@/app/session-store';
import { toUserErrorMessage } from '@/api/errors';
import { bookingsService } from '@/features/bookings/bookings.service';
import { itinerariesService } from '@/features/itineraries/itineraries.service';
import { renderMemberShell } from '@/layouts/member/MemberShell';
import { renderEmptyState, renderErrorBanner, renderLoadingSkeleton } from '@/shared/components/EmptyErrorState';
import { renderBadge, renderBookingStatusBadge } from '@/shared/components/StatusBadge';
import { escapeHtml } from '@/shared/utils/dom';
import { formatCountdownMmSs, formatDateVi, formatVnd, secondsRemaining } from '@/shared/utils/format';

export async function renderMemberDashboardPage(ctx: RouteContext): Promise<void> {
  const user = sessionStore.user!;

  const main = renderMemberShell({
    container: ctx.container,
    activeNav: 'overview',
    contentHtml: `<div id="memberDashRoot" class="flex flex-col gap-space-8">${renderLoadingSkeleton(2)}</div>`,
  });

  const root = main.querySelector<HTMLElement>('#memberDashRoot')!;

  const load = async () => {
    root.innerHTML = renderLoadingSkeleton(2);
    try {
      const [itRes, bkRes] = await Promise.all([
        itinerariesService.listMyItineraries({ page: 1, pageSize: 4 }),
        bookingsService.listMyBookings({ page: 1, pageSize: 4 }),
      ]);

      const attentionBookings = bkRes.items.filter(
        (b) => b.status === 'PENDING_PAYMENT' || b.paymentStatus === 'NEEDS_REVIEW',
      );
      const displayBookings = attentionBookings.length > 0 ? attentionBookings : bkRes.items.slice(0, 2);

      root.innerHTML = `
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-space-4">
          <div>
            <h1 class="font-headline text-headline-lg text-on-surface">Chào ${escapeHtml(user.displayName)}</h1>
            <p class="font-body text-body-lg text-text-secondary">Theo dõi các chuyến đi và đơn dịch vụ của bạn tại TripLoom.</p>
          </div>
          <a href="/lap-lich-trinh" class="inline-flex items-center justify-center gap-space-2 min-h-[44px] px-space-6 rounded bg-primary text-on-primary hover:bg-primary-hover font-label text-label-lg transition-colors">
            <span class="material-symbols-outlined text-[20px]" aria-hidden="true">auto_awesome</span>
            <span>Lập lịch trình</span>
          </a>
        </div>

        <!-- Recent Trips -->
        <section class="flex flex-col gap-space-4">
          <div class="flex items-center justify-between">
            <h2 class="font-headline text-headline-md text-on-surface">Chuyến đi gần đây</h2>
            <a href="/lich-trinh-cua-toi" class="font-label text-label-md text-primary hover:underline">Xem tất cả</a>
          </div>
          ${
            itRes.items.length === 0
              ? renderEmptyState({
                  icon: 'map',
                  title: 'Bạn chưa lưu lịch trình nào',
                  description: 'Bắt đầu nhập nhu cầu chuyến đi để TripLoom AI đề xuất địa điểm và lịch trình theo ngày.',
                  actionHref: '/lap-lich-trinh',
                  actionLabel: 'Bắt đầu lập lịch trình',
                })
              : `<div class="grid grid-cols-1 md:grid-cols-2 gap-space-6">
                  ${itRes.items
                    .map(
                      (it) => `
                    <article class="bg-surface border border-border rounded-lg p-space-6 shadow-sm flex flex-col justify-between gap-space-4">
                      <div class="flex flex-col gap-space-2">
                        <div class="flex items-center justify-between gap-space-2">
                          <span class="font-label text-label-sm text-primary tabular-nums">${escapeHtml(it.id)}</span>
                          ${renderBadge('Đã lưu', 'success', 'check_circle')}
                        </div>
                        <h3 class="font-title text-title-md text-on-surface">${escapeHtml(it.title)}</h3>
                        <p class="font-body text-body-md text-text-secondary tabular-nums">${formatDateVi(it.startDate)} – ${formatDateVi(it.endDate)} · ${it.daysCount} ngày · ${it.partySize} khách</p>
                        <p class="font-body text-body-md text-text-secondary">Ngân sách hoạt động toàn đoàn: <strong class="text-on-surface tabular-nums">${formatVnd(it.budgetVnd)}</strong></p>
                      </div>
                      <div class="flex flex-wrap gap-space-3">
                        <a href="/lich-trinh/${encodeURIComponent(it.id)}" class="inline-flex items-center justify-center flex-1 min-h-[44px] px-space-4 rounded bg-primary text-on-primary hover:bg-primary-hover font-label text-label-md">Mở lịch trình</a>
                        <a href="/chat?itinerary=${encodeURIComponent(it.id)}" class="inline-flex items-center justify-center min-h-[44px] px-space-4 rounded bg-surface text-primary border border-primary hover:bg-primary-light font-label text-label-md">Tiếp tục chat</a>
                      </div>
                    </article>
                  `,
                    )
                    .join('')}
                </div>`
          }
        </section>

        <!-- Bookings Needing Attention -->
        <section class="flex flex-col gap-space-4">
          <div class="flex items-center justify-between">
            <h2 class="font-headline text-headline-md text-on-surface">Đơn dịch vụ cần chú ý</h2>
            <a href="/don-dich-vu" class="font-label text-label-md text-primary hover:underline">Tất cả đơn</a>
          </div>
          ${
            displayBookings.length === 0
              ? renderEmptyState({
                  icon: 'receipt_long',
                  title: 'Chưa có đơn dịch vụ nào',
                  description: 'Khám phá địa điểm để xem các trải nghiệm địa phương có thể đặt trước.',
                  actionHref: '/dia-diem',
                  actionLabel: 'Khám phá địa điểm',
                })
              : `<div class="flex flex-col gap-space-4">
                  ${displayBookings
                    .map(
                      (bk) => `
                    <article class="bg-surface border border-border rounded-lg p-space-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-space-4">
                      <div class="flex flex-col gap-space-2">
                        <div class="flex flex-wrap items-center gap-space-3">
                          <span class="font-label text-label-md text-primary tabular-nums">${escapeHtml(bk.id)}</span>
                          ${renderBookingStatusBadge(bk.status)}
                          ${
                            bk.status === 'PENDING_PAYMENT'
                              ? `<span data-dash-countdown="${escapeHtml(bk.expiresAt)}" class="font-label text-label-sm text-warning tabular-nums">Còn lại: ${formatCountdownMmSs(secondsRemaining(bk.expiresAt))}</span>`
                              : ''
                          }
                        </div>
                        <h3 class="font-title text-title-md text-on-surface">${escapeHtml(bk.serviceName)} (${escapeHtml(bk.serviceId)})</h3>
                        <p class="font-body text-body-md text-text-secondary tabular-nums">Ngày sử dụng: ${formatDateVi(bk.serviceDate)} · ${bk.guestCount} khách · Tổng tiền: <strong class="text-on-surface">${formatVnd(bk.totalAmountVnd)}</strong></p>
                      </div>
                      <div class="flex flex-wrap gap-space-3 shrink-0">
                        <a href="/don-dich-vu/${encodeURIComponent(bk.id)}" class="inline-flex items-center justify-center min-h-[44px] px-space-4 rounded bg-surface text-on-surface border border-border hover:bg-surface-muted font-label text-label-md">Chi tiết đơn</a>
                        ${
                          bk.status === 'PENDING_PAYMENT'
                            ? `<a href="/thanh-toan/${encodeURIComponent(bk.id)}" class="inline-flex items-center justify-center min-h-[44px] px-space-4 rounded bg-primary text-on-primary hover:bg-primary-hover font-label text-label-md">Thanh toán QR</a>`
                            : ''
                        }
                      </div>
                    </article>
                  `,
                    )
                    .join('')}
                </div>`
          }
        </section>
      `;

      const timer = window.setInterval(() => {
        root.querySelectorAll<HTMLElement>('[data-dash-countdown]').forEach((el) => {
          const sec = secondsRemaining(el.dataset.dashCountdown);
          el.textContent = sec > 0 ? `Còn lại: ${formatCountdownMmSs(sec)}` : 'Đã hết hạn giữ chỗ';
        });
      }, 1000);
      ctx.onCleanup(() => window.clearInterval(timer));
    } catch (err) {
      root.innerHTML = renderErrorBanner(toUserErrorMessage(err), 'retryDashBtn');
      root.querySelector('#retryDashBtn')?.addEventListener('click', () => void load());
    }
  };

  await load();
}
