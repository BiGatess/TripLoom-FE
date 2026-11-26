import type { RouteContext } from '@/app/router';
import { toUserErrorMessage } from '@/api/errors';
import { destinationsService } from '@/features/destinations/destinations.service';
import { renderPublicShell } from '@/layouts/public/PublicShell';
import { renderDestinationCard } from '@/shared/components/DestinationCard';
import { renderEmptyState, renderErrorBanner } from '@/shared/components/EmptyErrorState';
import { bindImageFallbacks, escapeHtml, finishAsyncRender } from '@/shared/utils/dom';
import { STITCH_IMAGES } from '@/shared/utils/media';

const MONTHLY_PICKS: Record<string, Array<{ id: string; name: string; tag: string; desc: string; img: string }>> = {
  '10': [
    { id: 'HA001', name: 'Phố cổ Hội An', tag: 'Hội An · Dịu nhẹ', desc: 'Không khí thu dễ chịu, phù hợp tham quan nhà cổ và dạo phố đèn lồng.', img: STITCH_IMAGES.HA001 },
    { id: 'DN004', name: 'Bảo tàng Điêu khắc Chăm', tag: 'Đà Nẵng · Trong nhà', desc: 'Trải nghiệm nghệ thuật Chăm Pa không phụ thuộc thời tiết.', img: STITCH_IMAGES.DN004 },
    { id: 'HA002', name: 'Làng gốm Thanh Hà', tag: 'Hội An · Làng nghề', desc: 'Tận tay nặn gốm truyền thống bên bờ sông Thu Bồn.', img: STITCH_IMAGES.HA002 },
    { id: 'DN005', name: 'Chợ Cồn Đà Nẵng', tag: 'Đà Nẵng · Ẩm thực', desc: 'Khám phá ẩm thực địa phương ấm nóng giữa tiết trời thu dịu mát.', img: STITCH_IMAGES.heroVietnam },
    { id: 'DN003', name: 'Bán đảo Sơn Trà', tag: 'Đà Nẵng · Thiên nhiên', desc: 'Đón gió thu trong lành trên cung đường ven biển Sơn Trà.', img: STITCH_IMAGES.DN003 },
  ],
  '11': [
    { id: 'HA001', name: 'Phố cổ Hội An', tag: 'Hội An · Dịu mát', desc: 'Thời tiết mát mẻ, ngắm đèn lồng về đêm bên sông Hoài rất đẹp.', img: STITCH_IMAGES.HA001 },
    { id: 'DN002', name: 'Danh thắng Ngũ Hành Sơn', tag: 'Đà Nẵng · Ít nắng gắt', desc: 'Thuận tiện leo núi, tham quan hang động yên bình.', img: STITCH_IMAGES.DN002 },
    { id: 'HA002', name: 'Làng gốm Thanh Hà', tag: 'Hội An · Làng nghề', desc: 'Trải nghiệm nặn gốm truyền thống bên sông Thu Bồn.', img: STITCH_IMAGES.HA002 },
    { id: 'DN003', name: 'Bán đảo Sơn Trà', tag: 'Đà Nẵng · Thiên nhiên', desc: 'Đường ven biển xanh mát, ngắm toàn cảnh thành phố.', img: STITCH_IMAGES.DN003 },
    { id: 'DN005', name: 'Chợ Cồn Đà Nẵng', tag: 'Đà Nẵng · Ẩm thực', desc: 'Thưởng thức đặc sản miền Trung nóng hổi trong tiết trời se lạnh.', img: STITCH_IMAGES.heroVietnam },
    { id: 'DN001', name: 'Biển Mỹ Khê', tag: 'Đà Nẵng · Nghỉ dưỡng', desc: 'Dạo bộ bờ biển dịu êm, hít thở không khí biển đầu đông.', img: STITCH_IMAGES.DN001 },
  ],
  '12': [
    { id: 'DN002', name: 'Danh thắng Ngũ Hành Sơn', tag: 'Đà Nẵng · Se lạnh', desc: 'Khí hậu se lạnh dễ chịu để khám phá Thủy Sơn và động Huyền Không.', img: STITCH_IMAGES.DN002 },
    { id: 'HA001', name: 'Phố cổ Hội An', tag: 'Hội An · Noel', desc: 'Không khí Noel & cuối năm rực rỡ sắc đèn lồng bên sông Hoài.', img: STITCH_IMAGES.HA001 },
    { id: 'DN004', name: 'Bảo tàng Điêu khắc Chăm', tag: 'Đà Nẵng · Văn hóa', desc: 'Điểm dừng chân ấm áp, giàu giá trị lịch sử giữa trung tâm.', img: STITCH_IMAGES.DN004 },
    { id: 'DN005', name: 'Chợ Cồn Đà Nẵng', tag: 'Đà Nẵng · Ấm áp', desc: 'Thưởng thức đặc sản nóng hổi và không khí mua sắm nhộn nhịp cuối năm.', img: STITCH_IMAGES.heroVietnam },
    { id: 'HA002', name: 'Làng gốm Thanh Hà', tag: 'Hội An · Làng nghề', desc: 'Trải nghiệm lò gốm ấm áp bên sông Thu Bồn vào ngày đông.', img: STITCH_IMAGES.HA002 },
  ],
  '1': [
    { id: 'DN001', name: 'Biển Mỹ Khê', tag: 'Đà Nẵng · Đón xuân', desc: 'Dạo biển sáng đầu năm yên bình, nắng dịu nhẹ.', img: STITCH_IMAGES.DN001 },
    { id: 'HA001', name: 'Phố cổ Hội An', tag: 'Hội An · Du xuân', desc: 'Tham quan di sản đầu năm cùng gia đình và bạn bè.', img: STITCH_IMAGES.HA001 },
    { id: 'DN003', name: 'Bán đảo Sơn Trà', tag: 'Đà Nẵng · Tâm linh', desc: 'Viếng chùa Linh Ứng Bãi Bụt và ngắm vịnh Đà Nẵng.', img: STITCH_IMAGES.DN003 },
    { id: 'HA002', name: 'Làng gốm Thanh Hà', tag: 'Hội An · Đầu năm', desc: 'Dạo làng nghề yên ả đầu xuân và chọn quà lưu niệm thủ công.', img: STITCH_IMAGES.HA002 },
    { id: 'DN002', name: 'Danh thắng Ngũ Hành Sơn', tag: 'Đà Nẵng · Khai xuân', desc: 'Vãn cảnh chùa cổ đầu năm và ngắm toàn cảnh biển Đà Nẵng.', img: STITCH_IMAGES.DN002 },
  ],
};

const WINTER_SNOWFLAKES = [
  { left: '4%', size: '14px', duration: '11s', delay: '-2s', drift: '18px', opacity: '0.55', glyph: '❄' },
  { left: '13%', size: '10px', duration: '13s', delay: '-7s', drift: '-14px', opacity: '0.45', glyph: '✦' },
  { left: '22%', size: '16px', duration: '12s', delay: '-4s', drift: '22px', opacity: '0.6', glyph: '❄' },
  { left: '34%', size: '9px', duration: '10s', delay: '-1s', drift: '-16px', opacity: '0.42', glyph: '•' },
  { left: '45%', size: '13px', duration: '14s', delay: '-9s', drift: '20px', opacity: '0.5', glyph: '❄' },
  { left: '56%', size: '11px', duration: '11.5s', delay: '-3s', drift: '-18px', opacity: '0.45', glyph: '✦' },
  { left: '67%', size: '15px', duration: '12.5s', delay: '-6s', drift: '16px', opacity: '0.58', glyph: '❄' },
  { left: '78%', size: '10px', duration: '9.5s', delay: '-5s', drift: '-12px', opacity: '0.42', glyph: '•' },
  { left: '87%', size: '14px', duration: '13.5s', delay: '-8s', drift: '20px', opacity: '0.55', glyph: '❄' },
  { left: '95%', size: '12px', duration: '10.5s', delay: '-4.5s', drift: '-15px', opacity: '0.5', glyph: '❅' },
];

function renderFeaturedSkeleton(): string {
  return `
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5" aria-busy="true" aria-label="Đang tải dữ liệu">
      ${Array.from({ length: 4 })
        .map(
          (_, idx) => `
        <div class="bg-surface border border-border rounded-lg p-space-4 flex flex-col gap-space-3 ${idx >= 2 ? 'hidden lg:flex' : idx === 1 ? 'hidden sm:flex' : ''}">
          <div class="tl-skeleton w-full aspect-[16/10]"></div>
          <div class="tl-skeleton h-5 w-3/4"></div>
          <div class="tl-skeleton h-4 w-1/2"></div>
          <div class="tl-skeleton h-11 w-full mt-space-2"></div>
        </div>
      `,
        )
        .join('')}
    </div>
  `;
}

function initLoopCarousel(carouselHost: HTMLElement): () => void {
  const viewport = carouselHost.querySelector<HTMLElement>('[data-carousel-viewport]');
  const track = carouselHost.querySelector<HTMLElement>('[data-carousel-track]');
  const prevBtn = carouselHost.querySelector<HTMLButtonElement>('[data-carousel-prev]');
  const nextBtn = carouselHost.querySelector<HTMLButtonElement>('[data-carousel-next]');
  if (!viewport || !track) return () => {};

  const baseCount = Number(track.dataset.baseCount ?? '0');
  if (baseCount <= 0) return () => {};

  const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  let offset = 0;
  let animTarget: number | null = null;
  let isHovered = false;
  let isFocusWithin = false;
  let isPointerDown = false;
  let isDragging = false;
  let activePointerId: number | null = null;
  let dragStartX = 0;
  let dragStartOffset = 0;
  let suppressClickUntil = 0;
  let rafId = 0;
  let lastTime = performance.now();

  const getStepMetrics = () => {
    const slides = track.querySelectorAll<HTMLElement>('.tl-featured-slide');
    const first = slides[0];
    const second = slides[1];
    if (!first) return { stepPx: 300, halfWidth: 1200 };
    const stepPx = second ? second.offsetLeft - first.offsetLeft : first.getBoundingClientRect().width + 20;
    const halfWidth = Math.max(stepPx * baseCount, 1);
    return { stepPx, halfWidth };
  };

  const normalizeOffset = (val: number, halfWidth: number) => ((val % halfWidth) + halfWidth) % halfWidth;

  const applyTransform = () => {
    const { halfWidth } = getStepMetrics();
    const visual = normalizeOffset(offset, halfWidth);
    track.style.transform = `translate3d(${-visual.toFixed(2)}px, 0, 0)`;
  };

  const stepBy = (direction: -1 | 1) => {
    const { stepPx } = getStepMetrics();
    const baseTarget = animTarget ?? offset;
    animTarget = baseTarget + direction * stepPx;
  };

  const onEnter = () => {
    isHovered = true;
  };
  const onLeave = () => {
    isHovered = false;
  };
  const onFocusIn = () => {
    isFocusWithin = true;
  };
  const onFocusOut = (e: FocusEvent) => {
    if (!carouselHost.contains(e.relatedTarget as Node | null)) {
      isFocusWithin = false;
    }
  };

  carouselHost.addEventListener('mouseenter', onEnter);
  carouselHost.addEventListener('mouseleave', onLeave);
  carouselHost.addEventListener('focusin', onFocusIn);
  carouselHost.addEventListener('focusout', onFocusOut);

  prevBtn?.addEventListener('click', () => stepBy(-1));
  nextBtn?.addEventListener('click', () => stepBy(1));

  viewport.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest('button')) return;

    isPointerDown = true;
    isDragging = false;
    activePointerId = e.pointerId;
    dragStartX = e.clientX;
    dragStartOffset = offset;
    animTarget = null;
  });

  const onPointerMove = (e: PointerEvent) => {
    if (!document.body.contains(viewport)) {
      cleanup();
      return;
    }
    if (!isPointerDown || e.pointerId !== activePointerId) return;
    const dx = e.clientX - dragStartX;
    if (!isDragging && Math.abs(dx) > 6) {
      isDragging = true;
      viewport.classList.add('is-dragging');
      try {
        viewport.setPointerCapture(e.pointerId);
      } catch {
        // ignore pointer capture failures on synthetic events
      }
    }
    if (isDragging) {
      offset = dragStartOffset - dx;
      applyTransform();
    }
  };

  const onPointerEnd = (e: PointerEvent) => {
    if (!document.body.contains(viewport)) {
      cleanup();
      return;
    }
    if (!isPointerDown || e.pointerId !== activePointerId) return;
    if (isDragging) {
      suppressClickUntil = performance.now() + 140;
      const { halfWidth } = getStepMetrics();
      offset = normalizeOffset(offset, halfWidth);
      applyTransform();
    }
    isPointerDown = false;
    isDragging = false;
    activePointerId = null;
    viewport.classList.remove('is-dragging');
    try {
      if (viewport.hasPointerCapture(e.pointerId)) {
        viewport.releasePointerCapture(e.pointerId);
      }
    } catch {
      // ignore
    }
  };

  const onClickCapture = (e: MouseEvent) => {
    if (performance.now() < suppressClickUntil) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const onResize = () => {
    if (!document.body.contains(viewport)) {
      cleanup();
      return;
    }
    const { halfWidth } = getStepMetrics();
    offset = normalizeOffset(offset, halfWidth);
    animTarget = null;
    applyTransform();
  };

  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerEnd);
  window.addEventListener('pointercancel', onPointerEnd);
  window.addEventListener('resize', onResize);
  viewport.addEventListener('click', onClickCapture, true);

  function cleanup() {
    cancelAnimationFrame(rafId);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerEnd);
    window.removeEventListener('pointercancel', onPointerEnd);
    window.removeEventListener('resize', onResize);
  }

  const tick = (now: number) => {
    if (!document.body.contains(track)) {
      cleanup();
      return;
    }
    const dt = Math.min(Math.max((now - lastTime) / 1000, 0), 0.05);
    lastTime = now;

    if (!isDragging) {
      const { halfWidth } = getStepMetrics();
      if (animTarget !== null) {
        const diff = animTarget - offset;
        if (Math.abs(diff) <= 0.6) {
          offset = normalizeOffset(animTarget, halfWidth);
          animTarget = null;
        } else {
          offset += diff * Math.min(1, dt * 11);
        }
        applyTransform();
      } else if (!isHovered && !isFocusWithin && !prefersReducedMotion) {
        offset = normalizeOffset(offset + 42 * dt, halfWidth);
        applyTransform();
      }
    }

    rafId = requestAnimationFrame(tick);
  };

  applyTransform();
  rafId = requestAnimationFrame(tick);
  return cleanup;
}

export async function renderHomePage(ctx: RouteContext): Promise<void> {
  const main = renderPublicShell({
    container: ctx.container,
    activeNav: 'home',
    contentHtml: `
      <!-- Hero Banner + Integrated Search -->
      <section class="max-w-[1280px] w-full mx-auto px-space-4 md:px-space-6 pt-space-6 pb-space-6">
        <div class="relative rounded-xl overflow-hidden border border-border shadow-sm min-h-[420px] md:min-h-[460px] flex flex-col justify-between">
          <img src="${STITCH_IMAGES.heroVietnam}" alt="Cảnh đẹp Đà Nẵng và Phố cổ Hội An" data-fallback-label="Việt Nam" class="absolute inset-0 w-full h-full object-cover" />
          <div class="absolute inset-0 bg-gradient-to-r from-on-surface/90 via-on-surface/75 to-on-surface/35"></div>

          <div class="relative z-10 p-space-6 md:p-space-12 flex flex-col gap-space-6 my-auto">
            <div class="max-w-[660px] flex flex-col gap-space-3">
              <span class="inline-flex items-center gap-space-2 self-start px-space-3 py-space-1 rounded-full bg-primary text-on-primary font-label text-label-sm">
                <span class="material-symbols-outlined text-[16px]" aria-hidden="true">explore</span>
                Du lịch cá nhân hóa tại Việt Nam
              </span>
              <h1 class="font-display text-display-lg-mobile md:text-display-lg text-on-primary">Lập lịch trình du lịch theo nhu cầu của bạn</h1>
              <p class="font-body text-body-lg text-on-primary/90">Khám phá địa điểm từ danh mục chuẩn hóa, nhận đề xuất lịch trình theo ngày bằng AI và đặt dịch vụ trải nghiệm minh bạch.</p>
              <div class="pt-space-2">
                <a href="/lap-lich-trinh" class="inline-flex items-center justify-center gap-space-2 min-h-[44px] px-space-6 rounded bg-primary text-on-primary hover:bg-primary-hover font-label text-label-lg transition-colors">
                  <span class="material-symbols-outlined text-[20px]" aria-hidden="true">auto_awesome</span>
                  <span>Lập lịch trình ngay</span>
                </a>
              </div>
            </div>

            <form id="homeSearchForm" class="bg-surface rounded-lg p-space-3 md:p-space-4 shadow-md border border-border grid grid-cols-1 md:grid-cols-12 gap-space-3 items-end">
              <label class="md:col-span-6 flex flex-col gap-space-1">
                <span class="font-label text-label-sm text-text-secondary">Bạn muốn đi đâu?</span>
                <div class="relative flex items-center">
                  <span class="material-symbols-outlined text-[20px] text-text-secondary absolute left-space-3 pointer-events-none" aria-hidden="true">search</span>
                  <input id="homeQuery" type="search" placeholder="Phố cổ Hội An, Biển Mỹ Khê, Sơn Trà..." class="w-full min-h-[44px] pl-10 pr-space-3 rounded bg-surface-muted border border-border text-body-md text-on-surface focus:bg-surface focus:border-primary focus:ring-2 focus:ring-primary/20" />
                </div>
              </label>

              <label class="md:col-span-4 flex flex-col gap-space-1">
                <span class="font-label text-label-sm text-text-secondary">Khu vực</span>
                <select id="homeRegion" class="w-full min-h-[44px] px-space-3 rounded bg-surface-muted border border-border text-body-md text-on-surface focus:bg-surface focus:border-primary focus:ring-2 focus:ring-primary/20">
                  <option value="">Tất cả khu vực</option>
                  <option value="Đà Nẵng">Đà Nẵng</option>
                  <option value="Hội An">Hội An</option>
                </select>
              </label>

              <div class="md:col-span-2">
                <button type="submit" class="w-full min-h-[44px] px-space-4 rounded bg-primary text-on-primary hover:bg-primary-hover font-label text-label-md inline-flex items-center justify-center gap-space-2 transition-colors">
                  <span class="material-symbols-outlined text-[18px]" aria-hidden="true">search</span>
                  <span>Tìm kiếm</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      <!-- Category Quick Menu -->
      <section aria-label="Danh mục khám phá nhanh" class="max-w-[1280px] w-full mx-auto px-space-4 md:px-space-6 pb-space-6">
        <div class="flex flex-wrap items-center gap-space-2">
          <a href="/dia-diem" class="inline-flex items-center gap-space-2 min-h-[44px] px-space-4 rounded-full bg-primary text-on-primary font-label text-label-md">
            <span class="material-symbols-outlined text-[18px]" aria-hidden="true">apps</span>
            Tất cả điểm đến
          </a>
          <a href="/dia-diem?category=CAT02" class="inline-flex items-center gap-space-2 min-h-[44px] px-space-4 rounded-full bg-surface border border-border text-on-surface hover:border-primary hover:bg-primary-light font-label text-label-md transition-colors">
            <span class="material-symbols-outlined text-[18px] text-primary" aria-hidden="true">beach_access</span>
            Biển &amp; Nghỉ dưỡng
          </a>
          <a href="/dia-diem?category=CAT01" class="inline-flex items-center gap-space-2 min-h-[44px] px-space-4 rounded-full bg-surface border border-border text-on-surface hover:border-primary hover:bg-primary-light font-label text-label-md transition-colors">
            <span class="material-symbols-outlined text-[18px] text-primary" aria-hidden="true">temple_buddhist</span>
            Phố cổ &amp; Văn hóa
          </a>
          <a href="/dia-diem?category=CAT03" class="inline-flex items-center gap-space-2 min-h-[44px] px-space-4 rounded-full bg-surface border border-border text-on-surface hover:border-primary hover:bg-primary-light font-label text-label-md transition-colors">
            <span class="material-symbols-outlined text-[18px] text-primary" aria-hidden="true">landscape</span>
            Thiên nhiên
          </a>
          <a href="/dia-diem?category=CAT04" class="inline-flex items-center gap-space-2 min-h-[44px] px-space-4 rounded-full bg-surface border border-border text-on-surface hover:border-primary hover:bg-primary-light font-label text-label-md transition-colors">
            <span class="material-symbols-outlined text-[18px] text-primary" aria-hidden="true">palette</span>
            Làng nghề &amp; Ẩm thực
          </a>
        </div>
      </section>

      <!-- Monthly Recommendation Banner (Winter / Noel Carousel) -->
      <section class="max-w-[1280px] w-full mx-auto px-space-4 md:px-space-6 py-space-4">
        <div class="tl-winter-banner text-on-primary rounded-xl p-space-6 md:p-space-8 flex flex-col gap-space-6">
          <div class="pointer-events-none absolute inset-0 overflow-hidden z-0" aria-hidden="true">
            ${WINTER_SNOWFLAKES.map(
              (f) =>
                `<span class="tl-snowflake" style="--snow-left:${f.left};--snow-size:${f.size};--snow-duration:${f.duration};--snow-delay:${f.delay};--snow-drift:${f.drift};--snow-opacity:${f.opacity}">${f.glyph}</span>`,
            ).join('')}
          </div>

          <div class="relative z-10 flex flex-wrap items-center justify-between gap-space-4">
            <div class="flex flex-col gap-space-1.5">
              <span class="inline-flex items-center gap-1.5 self-start px-3 py-1 rounded-full bg-white/12 border border-sky-200/30 font-label text-label-sm text-sky-100 backdrop-blur-sm">
                <span class="material-symbols-outlined text-[15px] text-sky-200" aria-hidden="true">ac_unit</span>
                <span>Gợi ý theo tháng · Không khí Noel &amp; Mùa lạnh</span>
              </span>
              <h2 id="monthHeading" class="font-headline text-headline-lg text-white">Tháng 11 nên đi đâu?</h2>
            </div>

            <div class="flex flex-wrap items-center gap-space-2" role="tablist" aria-label="Chọn tháng du lịch">
              ${['10', '11', '12', '1']
                .map(
                  (m) => `<button type="button" role="tab" data-month="${m}" aria-selected="${m === '11' ? 'true' : 'false'}" class="month-tab min-h-[44px] px-space-4 rounded-full font-label text-label-md transition-colors ${
                    m === '11'
                      ? 'bg-surface text-primary shadow-sm'
                      : 'bg-white/10 text-sky-100 border border-sky-200/30 hover:bg-surface hover:text-primary'
                  }">Tháng ${m}</button>`,
                )
                .join('')}
            </div>
          </div>

          <div id="monthCards" class="relative z-10"></div>
        </div>
      </section>

      <!-- Featured Destinations -->
      <section class="max-w-[1280px] w-full mx-auto px-space-4 md:px-space-6 py-space-8 flex flex-col gap-space-6">
        <div class="flex flex-wrap items-end justify-between gap-space-4">
          <div>
            <h2 class="font-headline text-headline-lg text-on-surface">Địa điểm nổi bật từ danh mục nội bộ</h2>
            <p class="font-body text-body-md text-text-secondary">Thông tin, ảnh và chi phí tham khảo đồng nhất trên toàn hệ thống TripLoom.</p>
          </div>
          <a href="/dia-diem" class="group inline-flex items-center gap-space-2 px-space-4 py-space-2 rounded-full border border-border bg-surface font-label text-label-md text-primary hover:bg-primary-light hover:border-primary/35 no-underline transition-all">
            <span>Xem tất cả địa điểm</span>
            <span class="material-symbols-outlined text-[18px] transition-transform group-hover:translate-x-0.5" aria-hidden="true">arrow_forward</span>
          </a>
        </div>
        <div id="featuredGrid">${renderFeaturedSkeleton()}</div>
      </section>

      <!-- 3 Steps How It Works -->
      <section class="max-w-[1280px] w-full mx-auto px-space-4 md:px-space-6 py-space-8">
        <div class="bg-surface border border-border rounded-xl p-space-6 md:p-space-8 shadow-sm flex flex-col gap-space-6">
          <div class="text-center max-w-2xl mx-auto">
            <h2 class="font-headline text-headline-lg text-on-surface">Ba bước thiết kế hành trình cùng TripLoom</h2>
            <p class="font-body text-body-md text-text-secondary mt-space-1">Quy trình rõ ràng từ chọn điểm đến, tạo lịch trình theo ngày đến đặt dịch vụ.</p>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-space-6">
            <article class="p-space-4 rounded-lg bg-background border border-border flex flex-col gap-space-2">
              <span class="w-10 h-10 rounded-full bg-primary-light text-primary inline-flex items-center justify-center font-headline text-headline-md">1</span>
              <h3 class="font-title text-title-md text-on-surface">Nhập nhu cầu chuyến đi</h3>
              <p class="font-body text-body-md text-text-secondary">Chọn khu vực, ngày đi, số ngày, số khách, ngân sách hoạt động toàn đoàn và nhịp độ phù hợp.</p>
            </article>
            <article class="p-space-4 rounded-lg bg-background border border-border flex flex-col gap-space-2">
              <span class="w-10 h-10 rounded-full bg-primary-light text-primary inline-flex items-center justify-center font-headline text-headline-md">2</span>
              <h3 class="font-title text-title-md text-on-surface">Tạo và tinh chỉnh lịch trình AI</h3>
              <p class="font-body text-body-md text-text-secondary">Xem địa điểm phù hợp, tạo bản nháp theo ngày, chỉnh sửa thủ công hoặc tái tạo riêng từng ngày rồi lưu chính thức.</p>
            </article>
            <article class="p-space-4 rounded-lg bg-background border border-border flex flex-col gap-space-2">
              <span class="w-10 h-10 rounded-full bg-primary-light text-primary inline-flex items-center justify-center font-headline text-headline-md">3</span>
              <h3 class="font-title text-title-md text-on-surface">Đặt dịch vụ &amp; thanh toán SePay</h3>
              <p class="font-body text-body-md text-text-secondary">Chọn trải nghiệm địa phương, giữ chỗ 15 phút, quét QR chuyển khoản và theo dõi xác nhận minh bạch.</p>
            </article>
          </div>
        </div>
      </section>
    `,
  });

  // Search submit
  main.querySelector<HTMLFormElement>('#homeSearchForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = main.querySelector<HTMLInputElement>('#homeQuery')?.value.trim() ?? '';
    const region = main.querySelector<HTMLSelectElement>('#homeRegion')?.value ?? '';
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (region) params.set('region', region);
    const qs = params.toString();
    ctx.navigate(qs ? `/dia-diem?${qs}` : '/dia-diem');
  });

  // Monthly picks carousel + tabs
  let cleanupMonthCarousel: (() => void) | null = null;

  const renderMonthCards = (month: string) => {
    const cardsEl = main.querySelector<HTMLElement>('#monthCards');
    const heading = main.querySelector<HTMLElement>('#monthHeading');
    if (heading) heading.textContent = `Tháng ${month} nên đi đâu?`;
    if (!cardsEl) return;

    cleanupMonthCarousel?.();
    cleanupMonthCarousel = null;

    const picks = MONTHLY_PICKS[month] ?? MONTHLY_PICKS['11']!;
    const basePicks = [...picks];
    while (basePicks.length < 4) {
      basePicks.push(...picks);
    }
    const loopPicks = [...basePicks, ...basePicks];

    cardsEl.innerHTML = `
      <div class="group/carousel relative" data-month-carousel>
        <div class="tl-featured-viewport rounded-lg" data-carousel-viewport>
          <div class="tl-featured-track" data-carousel-track data-base-count="${basePicks.length}">
            ${loopPicks
              .map(
                (item) => `
              <div class="tl-featured-slide">
                <a href="/dia-diem/${encodeURIComponent(item.id)}" class="group flex items-center gap-space-3 p-space-3 rounded-lg bg-surface text-on-surface border border-white/80 hover:shadow-md transition-shadow">
                  <img src="${escapeHtml(item.img)}" alt="${escapeHtml(item.name)}" data-fallback-label="${escapeHtml(item.name)}" class="w-20 h-20 rounded-md object-cover shrink-0" />
                  <div class="flex flex-col gap-space-1 min-w-0">
                    <span class="font-label text-label-sm text-primary">${escapeHtml(item.tag)}</span>
                    <h3 class="font-title text-title-md text-on-surface group-hover:text-primary truncate">${escapeHtml(item.name)}</h3>
                    <p class="font-body text-body-md text-text-secondary line-clamp-2">${escapeHtml(item.desc)}</p>
                  </div>
                </a>
              </div>
            `,
              )
              .join('')}
          </div>
        </div>

        <button
          type="button"
          data-carousel-prev
          aria-label="Xem gợi ý trước"
          class="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-surface/95 text-primary border border-sky-200/80 shadow-lg backdrop-blur-md inline-flex items-center justify-center hover:bg-primary hover:text-white opacity-95 md:opacity-0 md:scale-90 md:pointer-events-none md:group-hover/carousel:opacity-100 md:group-hover/carousel:scale-100 md:group-hover/carousel:pointer-events-auto focus-visible:opacity-100 focus-visible:scale-100 focus-visible:pointer-events-auto transition-all duration-200"
        >
          <span class="material-symbols-outlined text-[20px]" aria-hidden="true">chevron_left</span>
        </button>

        <button
          type="button"
          data-carousel-next
          aria-label="Xem gợi ý tiếp theo"
          class="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-surface/95 text-primary border border-sky-200/80 shadow-lg backdrop-blur-md inline-flex items-center justify-center hover:bg-primary hover:text-white opacity-95 md:opacity-0 md:scale-90 md:pointer-events-none md:group-hover/carousel:opacity-100 md:group-hover/carousel:scale-100 md:group-hover/carousel:pointer-events-auto focus-visible:opacity-100 focus-visible:scale-100 focus-visible:pointer-events-auto transition-all duration-200"
        >
          <span class="material-symbols-outlined text-[20px]" aria-hidden="true">chevron_right</span>
        </button>
      </div>
    `;
    bindImageFallbacks(cardsEl);
    const carouselHost = cardsEl.querySelector<HTMLElement>('[data-month-carousel]');
    if (carouselHost) {
      cleanupMonthCarousel = initLoopCarousel(carouselHost);
    }
  };

  renderMonthCards('11');
  main.querySelectorAll<HTMLButtonElement>('.month-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      const m = btn.dataset.month ?? '11';
      main.querySelectorAll<HTMLButtonElement>('.month-tab').forEach((other) => {
        const active = other === btn;
        other.setAttribute('aria-selected', active ? 'true' : 'false');
        other.className = active
          ? 'month-tab min-h-[44px] px-space-4 rounded-full bg-surface text-primary shadow-sm font-label text-label-md transition-colors'
          : 'month-tab min-h-[44px] px-space-4 rounded-full bg-white/10 text-sky-100 border border-sky-200/30 hover:bg-surface hover:text-primary font-label text-label-md transition-colors';
      });
      renderMonthCards(m);
    });
  });

  // Load featured destinations via service (4 cards across)
  const loadFeatured = async () => {
    const gridEl = main.querySelector<HTMLElement>('#featuredGrid');
    if (!gridEl) return;
    gridEl.innerHTML = renderFeaturedSkeleton();
    try {
      const res = await destinationsService.listDestinations({ page: 1, pageSize: 4 });
      if (res.items.length === 0) {
        gridEl.innerHTML = renderEmptyState({
          icon: 'location_off',
          title: 'Chưa có địa điểm công khai',
          description: 'Danh mục hiện chưa có địa điểm nào ở trạng thái hoạt động.',
        });
        return;
      }
      finishAsyncRender(
        gridEl,
        `<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          ${res.items.map((d) => renderDestinationCard({ destination: d })).join('')}
        </div>`,
      );
      bindImageFallbacks(gridEl);
    } catch (err) {
      gridEl.innerHTML = renderErrorBanner(toUserErrorMessage(err), 'retryFeaturedBtn');
      gridEl.querySelector('#retryFeaturedBtn')?.addEventListener('click', () => void loadFeatured());
    }
  };

  bindImageFallbacks(main);
  await loadFeatured();
}
