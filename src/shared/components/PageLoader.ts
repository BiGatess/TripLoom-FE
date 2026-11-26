/**
 * Hiệu ứng thanh tiến trình chuyển trang & tải dữ liệu (Top Progress Bar + Loading Pill).
 * Dùng bộ đếm tham chiếu (activeCount) để xử lý mượt cả khi chuyển trang lẫn gọi nhiều service song song.
 */

let activeCount = 0;
let trickleTimer: number | null = null;
let pillTimer: number | null = null;
let hideTimer: number | null = null;
let currentProgress = 0;

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

function ensureLoaderElements(): { bar: HTMLElement; pill: HTMLElement } | null {
  if (typeof document === 'undefined') return null;

  let root = document.getElementById('tl-page-loader-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'tl-page-loader-root';
    root.setAttribute('aria-hidden', 'true');
    root.innerHTML = `
      <div class="tl-top-loader-track">
        <div id="tl-top-loader-bar" class="tl-top-loader-bar"></div>
      </div>
      <div id="tl-route-loading-pill" class="tl-route-loading-pill">
        <span class="material-symbols-outlined text-[16px] animate-spin text-primary" aria-hidden="true">progress_activity</span>
        <span>Đang tải thông tin...</span>
      </div>
    `;
    document.body.appendChild(root);
  }

  const bar = document.getElementById('tl-top-loader-bar');
  const pill = document.getElementById('tl-route-loading-pill');
  if (!bar || !pill) return null;
  return { bar, pill };
}

function setBarProgress(bar: HTMLElement, pct: number): void {
  currentProgress = pct;
  bar.style.width = `${pct}%`;
}

export function startPageLoading(): void {
  if (typeof window === 'undefined') return;
  activeCount += 1;
  if (activeCount > 1) return;

  const els = ensureLoaderElements();
  if (!els) return;

  if (hideTimer !== null) {
    window.clearTimeout(hideTimer);
    hideTimer = null;
  }
  if (pillTimer !== null) {
    window.clearTimeout(pillTimer);
    pillTimer = null;
  }
  if (trickleTimer !== null) {
    window.clearInterval(trickleTimer);
    trickleTimer = null;
  }

  els.bar.style.transition = 'none';
  setBarProgress(els.bar, 0);
  els.bar.style.opacity = '1';
  void els.bar.offsetWidth;

  els.bar.style.transition = prefersReducedMotion()
    ? 'opacity 80ms linear'
    : 'width 320ms cubic-bezier(0.22, 1, 0.36, 1), opacity 220ms ease-out';
  setBarProgress(els.bar, 28);

  // Chỉ hiện badge góc phải nếu tác vụ thực sự kéo dài > 320ms để tránh nhấp nháy nhanh gây giật mắt
  pillTimer = window.setTimeout(() => {
    if (activeCount > 0) {
      els.pill.classList.add('is-visible');
    }
  }, 320);

  trickleTimer = window.setInterval(() => {
    if (currentProgress < 86) {
      const step = currentProgress < 65 ? 10 : 4;
      setBarProgress(els.bar, Math.min(86, currentProgress + step));
    }
  }, 200);
}

export function finishPageLoading(): void {
  if (typeof window === 'undefined') return;
  activeCount = Math.max(0, activeCount - 1);
  if (activeCount > 0) return;

  if (trickleTimer !== null) {
    window.clearInterval(trickleTimer);
    trickleTimer = null;
  }
  if (pillTimer !== null) {
    window.clearTimeout(pillTimer);
    pillTimer = null;
  }

  const els = ensureLoaderElements();
  if (!els) return;

  setBarProgress(els.bar, 100);
  els.pill.classList.remove('is-visible');

  hideTimer = window.setTimeout(() => {
    els.bar.style.opacity = '0';
    hideTimer = window.setTimeout(() => {
      els.bar.style.transition = 'none';
      setBarProgress(els.bar, 0);
    }, 240);
  }, 220);
}

export function waitRouteTransitionMs(ms = 180): Promise<void> {
  if (typeof window === 'undefined' || prefersReducedMotion()) {
    return Promise.resolve();
  }
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
