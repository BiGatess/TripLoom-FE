import { escapeHtml } from '@/shared/utils/dom';

export type ToastTone = 'success' | 'error' | 'warning' | 'info';

const STYLE_MAP: Record<ToastTone, { bg: string; icon: string }> = {
  success: { bg: 'bg-success-bg text-on-success-bg border-success/30', icon: 'check_circle' },
  error: { bg: 'bg-error-bg text-on-error-bg border-error/30', icon: 'error' },
  warning: { bg: 'bg-warning-bg text-on-warning-bg border-warning/30', icon: 'warning' },
  info: { bg: 'bg-info-bg text-on-info-bg border-info/30', icon: 'info' },
};

interface ActiveToastEntry {
  el: HTMLElement;
  timerId: number | null;
}

const activeToasts = new Map<string, ActiveToastEntry>();

/**
 * Hiển thị thông báo ngắn, chống nhân đôi khi người dùng thực hiện lặp cùng một thao tác.
 */
export function showToast(message: string, tone: ToastTone = 'info', durationMs = 4200): void {
  const root = document.getElementById('toast-root');
  if (!root) return;

  const key = `${tone}::${message.trim()}`;
  const existing = activeToasts.get(key);
  if (existing && document.contains(existing.el)) {
    if (existing.timerId !== null) {
      window.clearTimeout(existing.timerId);
    }
    existing.el.classList.remove('tl-toast-pulse');
    void existing.el.offsetWidth;
    existing.el.classList.add('tl-toast-pulse');
    if (durationMs > 0) {
      existing.timerId = window.setTimeout(() => dismiss(), durationMs);
    }
    function dismiss() {
      const curr = activeToasts.get(key);
      if (!curr) return;
      activeToasts.delete(key);
      curr.el.style.opacity = '0';
      window.setTimeout(() => curr.el.remove(), 150);
    }
    return;
  }

  const style = STYLE_MAP[tone];
  const el = document.createElement('div');
  el.setAttribute('role', tone === 'error' ? 'alert' : 'status');
  el.className = `pointer-events-auto flex items-start gap-space-3 p-space-4 rounded-md border shadow-md ${style.bg} tl-toast-enter transition-opacity duration-150`;
  el.innerHTML = `
    <span class="material-symbols-outlined text-[20px] shrink-0 mt-0.5" aria-hidden="true">${style.icon}</span>
    <p class="font-label text-label-md flex-1">${escapeHtml(message)}</p>
    <button type="button" aria-label="Đóng thông báo" class="shrink-0 w-7 h-7 inline-flex items-center justify-center rounded hover:bg-black/10">
      <span class="material-symbols-outlined text-[18px]" aria-hidden="true">close</span>
    </button>
  `;

  let removed = false;
  const remove = () => {
    if (removed) return;
    removed = true;
    const curr = activeToasts.get(key);
    if (curr?.timerId !== null && curr?.timerId !== undefined) {
      window.clearTimeout(curr.timerId);
    }
    activeToasts.delete(key);
    el.style.opacity = '0';
    window.setTimeout(() => el.remove(), 150);
  };

  el.querySelector('button')?.addEventListener('click', remove);
  root.appendChild(el);

  const timerId = durationMs > 0 ? window.setTimeout(remove, durationMs) : null;
  activeToasts.set(key, { el, timerId });
}
