import { escapeHtml } from '@/shared/utils/dom';

export interface ModalOptions {
  title: string;
  subtitle?: string;
  bodyHtml: string;
  size?: 'sm' | 'md' | 'lg' | 'drawer';
  closeOnBackdrop?: boolean;
  onMount?: (modalEl: HTMLElement, close: () => void) => void;
  onClose?: () => void;
}

let modalSeq = 0;
let openModalCount = 0;

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export function openModal(options: ModalOptions): { close: () => void; element: HTMLElement } {
  const root = document.getElementById('modal-root') ?? document.body;
  const previouslyFocused = document.activeElement as HTMLElement | null;
  const headingId = `tl-modal-title-${++modalSeq}`;
  const isDrawer = options.size === 'drawer';

  const wrapper = document.createElement('div');
  wrapper.className = isDrawer
    ? 'fixed inset-0 z-[80] flex justify-end'
    : 'fixed inset-0 z-[80] flex items-center justify-center p-space-4';
  wrapper.setAttribute('role', 'dialog');
  wrapper.setAttribute('aria-modal', 'true');
  wrapper.setAttribute('aria-labelledby', headingId);

  const panelSize = isDrawer
    ? 'w-full max-w-lg h-full bg-surface border-l border-border shadow-lg flex flex-col overflow-hidden tl-drawer-enter'
    : options.size === 'lg'
      ? 'w-full max-w-2xl max-h-[90vh] bg-surface border border-border rounded-xl shadow-lg flex flex-col overflow-hidden tl-modal-enter'
      : options.size === 'sm'
        ? 'w-full max-w-md max-h-[90vh] bg-surface border border-border rounded-xl shadow-lg flex flex-col overflow-hidden tl-modal-enter'
        : 'w-full max-w-lg max-h-[90vh] bg-surface border border-border rounded-xl shadow-lg flex flex-col overflow-hidden tl-modal-enter';

  wrapper.innerHTML = `
    <div data-modal-backdrop class="fixed inset-0 bg-on-surface/45 tl-backdrop-enter transition-opacity duration-150"></div>
    <div data-modal-panel class="relative z-10 ${panelSize} transition-all duration-150">
      <div class="flex items-start justify-between gap-space-4 p-space-6 pb-space-4 border-b border-border shrink-0">
        <div class="min-w-0">
          <h2 id="${headingId}" class="font-headline text-headline-md text-on-surface">${escapeHtml(options.title)}</h2>
          ${options.subtitle ? `<p class="font-body text-body-md text-text-secondary mt-space-1">${escapeHtml(options.subtitle)}</p>` : ''}
        </div>
        <button type="button" data-modal-close aria-label="Đóng hộp thoại" class="w-[44px] h-[44px] shrink-0 inline-flex items-center justify-center rounded hover:bg-surface-muted text-text-secondary">
          <span class="material-symbols-outlined text-[20px]" aria-hidden="true">close</span>
        </button>
      </div>
      <div data-modal-body class="p-space-6 overflow-y-auto flex-1">
        ${options.bodyHtml}
      </div>
    </div>
  `;

  const panel = wrapper.querySelector<HTMLElement>('[data-modal-panel]') ?? wrapper;
  const backdrop = wrapper.querySelector<HTMLElement>('[data-modal-backdrop]');

  openModalCount += 1;
  document.body.style.overflow = 'hidden';

  let closed = false;
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }

    if (e.key === 'Tab') {
      const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => el.offsetParent !== null,
      );
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      const active = document.activeElement as HTMLElement | null;

      if (e.shiftKey) {
        if (active === first || !panel.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last || !panel.contains(active)) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  };

  const finalizeRemove = () => {
    wrapper.remove();
    openModalCount = Math.max(0, openModalCount - 1);
    if (openModalCount === 0) {
      document.body.style.overflow = '';
    }
    options.onClose?.();
    if (previouslyFocused && document.contains(previouslyFocused)) {
      previouslyFocused.focus();
    }
  };

  const close = () => {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKeyDown);

    if (prefersReducedMotion()) {
      finalizeRemove();
      return;
    }

    if (backdrop) backdrop.style.opacity = '0';
    panel.style.opacity = '0';
    panel.style.transform = isDrawer ? 'translateX(24px)' : 'scale(0.97) translateY(4px)';
    window.setTimeout(finalizeRemove, 130);
  };

  wrapper.querySelector('[data-modal-close]')?.addEventListener('click', close);
  if (options.closeOnBackdrop !== false) {
    backdrop?.addEventListener('click', close);
  }
  document.addEventListener('keydown', onKeyDown);
  root.appendChild(wrapper);

  options.onMount?.(panel, close);

  // Di chuyển focus vào phần tử đầu tiên có thể tương tác trong modal (ưu tiên ô nhập hoặc nút Hủy)
  const firstInput = panel.querySelector<HTMLElement>(
    'input:not([disabled]):not([readonly]), select:not([disabled]), textarea:not([disabled])',
  );
  const cancelBtn = panel.querySelector<HTMLElement>('[data-confirm-cancel]');
  const fallbackBtn = panel.querySelector<HTMLElement>('button:not([disabled])');
  (firstInput ?? cancelBtn ?? fallbackBtn)?.focus();

  return { close, element: panel };
}

export interface ConfirmModalOptions {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  requireReason?: boolean;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  onConfirm: (reason: string) => Promise<void> | void;
}

export function openConfirmModal(options: ConfirmModalOptions): void {
  const confirmBtnClass = options.destructive
    ? 'bg-error text-on-error hover:bg-error/90'
    : 'bg-primary text-on-primary hover:bg-primary-hover';

  openModal({
    title: options.title,
    size: 'sm',
    bodyHtml: `
      <div class="flex flex-col gap-space-4">
        <p class="font-body text-body-md text-text-secondary">${escapeHtml(options.description)}</p>
        ${
          options.requireReason
            ? `<label class="flex flex-col gap-space-2">
                <span class="font-label text-label-md text-on-surface">${escapeHtml(options.reasonLabel ?? 'Lý do thực hiện (tối thiểu 5 ký tự)')} <span class="text-error">*</span></span>
                <textarea id="confirmReasonInput" rows="3" placeholder="${escapeHtml(options.reasonPlaceholder ?? 'Nhập lý do cụ thể...')}" class="w-full p-space-3 rounded border border-border bg-surface text-body-md text-on-surface focus:border-primary focus:ring-2 focus:ring-primary/20"></textarea>
                <p id="confirmReasonError" class="hidden font-body text-body-md text-error"></p>
              </label>`
            : ''
        }
        <p id="confirmGlobalError" class="hidden p-space-3 rounded bg-error-bg text-on-error-bg font-body text-body-md"></p>
        <div class="flex items-center justify-end gap-space-3 pt-space-2">
          <button type="button" data-confirm-cancel class="min-h-[44px] px-space-4 rounded bg-surface border border-border text-on-surface hover:bg-surface-muted font-label text-label-md">${escapeHtml(options.cancelLabel ?? 'Hủy')}</button>
          <button type="button" data-confirm-submit class="min-h-[44px] px-space-6 rounded ${confirmBtnClass} disabled:opacity-60 disabled:cursor-not-allowed font-label text-label-md inline-flex items-center gap-space-2 transition-colors">${escapeHtml(options.confirmLabel)}</button>
        </div>
      </div>
    `,
    onMount: (panel, close) => {
      const cancelBtn = panel.querySelector<HTMLButtonElement>('[data-confirm-cancel]');
      const submitBtn = panel.querySelector<HTMLButtonElement>('[data-confirm-submit]');
      const reasonInput = panel.querySelector<HTMLTextAreaElement>('#confirmReasonInput');
      const reasonErr = panel.querySelector<HTMLElement>('#confirmReasonError');
      const globalErr = panel.querySelector<HTMLElement>('#confirmGlobalError');

      cancelBtn?.addEventListener('click', close);

      // Không đặt nút phá hủy làm hành động mặc định khi nhấn Enter trong ô nhập khác
      submitBtn?.addEventListener('click', async () => {
        if (!submitBtn || submitBtn.disabled) return;
        const reason = reasonInput?.value.trim() ?? '';
        if (options.requireReason && (reason.length < 5 || reason.length > 500)) {
          if (reasonErr) {
            reasonErr.textContent = 'Vui lòng nhập lý do từ 5 đến 500 ký tự.';
            reasonErr.classList.remove('hidden');
          }
          reasonInput?.focus();
          return;
        }
        reasonErr?.classList.add('hidden');
        globalErr?.classList.add('hidden');

        submitBtn.disabled = true;
        if (cancelBtn) cancelBtn.disabled = true;
        const origHtml = submitBtn.innerHTML;
        submitBtn.innerHTML = `<span class="material-symbols-outlined text-[18px] animate-spin" aria-hidden="true">progress_activity</span><span>Đang xử lý...</span>`;
        try {
          await options.onConfirm(reason);
          close();
        } catch (err) {
          if (globalErr) {
            globalErr.textContent = err instanceof Error ? err.message : 'Không thể hoàn tất thao tác. Vui lòng thử lại.';
            globalErr.classList.remove('hidden');
          }
          submitBtn.disabled = false;
          if (cancelBtn) cancelBtn.disabled = false;
          submitBtn.innerHTML = origHtml;
        }
      });
    },
  });
}
