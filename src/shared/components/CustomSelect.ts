import { escapeHtml } from '@/shared/utils/dom';

/**
 * Bộ nâng cấp tự động mọi thẻ <select> trong giao diện thành Custom Dropdown liền khối (Connected Seamless Select).
 * - Khi mở: nút bấm bo góc trên, phẳng đáy và nối khít 100% với danh sách xổ xuống thành một khung liền mạch.
 * - Giữ nguyên thẻ <select> ẩn phía sau (ID, value, sự kiện input/change) để tương thích tuyệt đối với mọi form và bộ lọc.
 * - Tự động nhận diện cả các trang tải bất đồng bộ lẫn Modal/Drawer (<dialog> Top Layer).
 */

interface ActiveDropdownState {
  selectEl: HTMLSelectElement;
  triggerBtn: HTMLButtonElement;
  menuEl: HTMLElement;
  close: (restoreFocus?: boolean) => void;
}

let activeDropdown: ActiveDropdownState | null = null;
let initialized = false;

const LAYOUT_CLASS_PATTERN =
  /^(w-|min-w-|max-w-|flex-|shrink|grow|col-span-|sm:col-span-|md:col-span-|lg:col-span-|xl:col-span-|self-)/;

function closeActiveDropdown(restoreFocus = false): void {
  if (!activeDropdown) return;
  const current = activeDropdown;
  activeDropdown = null;
  current.close(restoreFocus);
}

function hasClippingAncestor(el: HTMLElement): boolean {
  let cur: HTMLElement | null = el.parentElement;
  while (cur && cur !== document.body && cur !== document.documentElement) {
    if (cur.tagName === 'DIALOG') return true;
    const style = window.getComputedStyle(cur);
    const ov = `${style.overflow} ${style.overflowX} ${style.overflowY}`;
    if (/(hidden|auto|scroll|clip)/.test(ov)) return true;
    cur = cur.parentElement;
  }
  return false;
}

function getSelectedOptionLabel(selectEl: HTMLSelectElement): string {
  const idx = selectEl.selectedIndex;
  if (idx >= 0 && selectEl.options[idx]) {
    return selectEl.options[idx]!.textContent?.trim() ?? '';
  }
  return selectEl.options[0]?.textContent?.trim() ?? '';
}

function interceptSelectValueSetter(selectEl: HTMLSelectElement, onValueChange: () => void): void {
  const proto = HTMLSelectElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
  if (!descriptor?.get || !descriptor?.set) return;

  Object.defineProperty(selectEl, 'value', {
    configurable: true,
    enumerable: true,
    get() {
      return descriptor.get!.call(this) as string;
    },
    set(nextVal: string) {
      descriptor.set!.call(this, nextVal);
      onValueChange();
    },
  });
}

function enhanceSingleSelect(selectEl: HTMLSelectElement): void {
  if (selectEl.dataset.tlEnhanced === '1' || selectEl.dataset.nativeSelect === '1' || selectEl.multiple) {
    return;
  }
  const parent = selectEl.parentElement;
  if (!parent) return;

  selectEl.dataset.tlEnhanced = '1';

  // Tách các class bố cục lưới / độ rộng từ <select> đưa ra thẻ bao ngoài .tl-select-wrap
  const origClasses = Array.from(selectEl.classList);
  const wrapLayoutClasses = origClasses.filter((c) => LAYOUT_CLASS_PATTERN.test(c));
  const hasMutedBg = origClasses.includes('bg-surface-muted');

  const wrapper = document.createElement('div');
  wrapper.className = ['tl-select-wrap', ...wrapLayoutClasses].join(' ');
  if (!wrapLayoutClasses.some((c) => c.startsWith('w-') || c.includes('col-span-') || c.startsWith('flex-'))) {
    wrapper.classList.add('w-full');
  }

  const triggerBtn = document.createElement('button');
  triggerBtn.type = 'button';
  triggerBtn.className = `tl-select-trigger ${hasMutedBg ? 'tl-select-trigger--muted' : ''}`;
  triggerBtn.setAttribute('aria-haspopup', 'listbox');
  triggerBtn.setAttribute('aria-expanded', 'false');
  if (selectEl.disabled) {
    triggerBtn.disabled = true;
  }
  const ariaLabel = selectEl.getAttribute('aria-label');
  if (ariaLabel) {
    triggerBtn.setAttribute('aria-label', ariaLabel);
  }

  const updateTriggerDisplay = () => {
    const label = getSelectedOptionLabel(selectEl);
    triggerBtn.disabled = selectEl.disabled;
    triggerBtn.innerHTML = `
      <span class="tl-select-label">${escapeHtml(label)}</span>
      <span class="material-symbols-outlined tl-select-chevron" aria-hidden="true">expand_more</span>
    `;
  };

  updateTriggerDisplay();
  interceptSelectValueSetter(selectEl, updateTriggerDisplay);

  // Ẩn <select> gốc nhưng giữ nguyên trong DOM để form/querySelector('#id') đọc ghi bình thường
  parent.insertBefore(wrapper, selectEl);
  wrapper.appendChild(triggerBtn);
  selectEl.className = 'sr-only';
  selectEl.tabIndex = -1;
  selectEl.setAttribute('aria-hidden', 'true');
  wrapper.appendChild(selectEl);

  // Nếu người dùng bấm vào chữ <label> bao quanh, chuyển tiêu điểm sang nút custom
  selectEl.addEventListener('focus', () => {
    triggerBtn.focus();
  });

  selectEl.addEventListener('change', () => {
    updateTriggerDisplay();
  });

  selectEl.addEventListener('tl:sync', () => {
    updateTriggerDisplay();
  });

  const openDropdown = () => {
    if (selectEl.disabled) return;
    if (activeDropdown?.selectEl === selectEl) {
      closeActiveDropdown(true);
      return;
    }
    closeActiveDropdown(false);

    const rect = triggerBtn.getBoundingClientRect();
    const options = Array.from(selectEl.options);
    const estimatedHeight = Math.min(272, options.length * 40 + 10);
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpward = spaceBelow < Math.min(estimatedHeight, 190) && rect.top > spaceBelow;

    triggerBtn.setAttribute('aria-expanded', 'true');
    triggerBtn.classList.add(openUpward ? 'is-open-up' : 'is-open-down');

    const useInlineHost = !hasClippingAncestor(wrapper);
    const menuEl = document.createElement('div');
    menuEl.setAttribute('role', 'listbox');
    menuEl.className = [
      'tl-select-menu',
      openUpward ? 'tl-select-menu--up' : 'tl-select-menu--down',
      useInlineHost ? 'tl-select-menu--inline' : '',
    ]
      .filter(Boolean)
      .join(' ');

    if (!useInlineHost) {
      menuEl.style.left = `${rect.left}px`;
      menuEl.style.width = `${rect.width}px`;
      if (openUpward) {
        menuEl.style.bottom = `${window.innerHeight - rect.top - 1}px`;
      } else {
        menuEl.style.top = `${rect.bottom - 1}px`;
      }
    }

    const currentVal = selectEl.value;
    menuEl.innerHTML = options
      .map((opt, idx) => {
        const isSelected = opt.value === currentVal;
        return `
          <button
            type="button"
            role="option"
            data-opt-idx="${idx}"
            aria-selected="${isSelected ? 'true' : 'false'}"
            ${opt.disabled ? 'disabled' : ''}
            class="tl-select-option ${isSelected ? 'is-selected' : ''}"
          >
            <span class="truncate">${escapeHtml(opt.textContent?.trim() ?? '')}</span>
            <span class="material-symbols-outlined tl-select-check ${isSelected ? '' : 'opacity-0'}" aria-hidden="true">check</span>
          </button>
        `;
      })
      .join('');

    // Gắn trực tiếp vào .tl-select-wrap nếu không bị cắt overflow để mép 2 bên trùng khít 100% theo CSS
    const hostRoot = useInlineHost ? wrapper : (triggerBtn.closest('dialog') ?? document.body);
    hostRoot.appendChild(menuEl);

    // Cuộn mục đang chọn vào vùng nhìn thấy
    const selectedBtn = menuEl.querySelector<HTMLButtonElement>('.tl-select-option.is-selected');
    selectedBtn?.scrollIntoView({ block: 'nearest' });

    let focusedIdx = Math.max(0, selectEl.selectedIndex);
    const optionButtons = Array.from(menuEl.querySelectorAll<HTMLButtonElement>('.tl-select-option'));

    const highlightIndex = (nextIdx: number) => {
      if (optionButtons.length === 0) return;
      focusedIdx = (nextIdx + optionButtons.length) % optionButtons.length;
      optionButtons[focusedIdx]?.focus();
    };

    const pickOptionAt = (idx: number) => {
      const opt = options[idx];
      if (!opt || opt.disabled) return;
      const changed = selectEl.value !== opt.value;
      selectEl.selectedIndex = idx;
      selectEl.value = opt.value;
      updateTriggerDisplay();
      closeActiveDropdown(true);
      if (changed) {
        selectEl.dispatchEvent(new Event('input', { bubbles: true }));
        selectEl.dispatchEvent(new Event('change', { bubbles: true }));
      }
    };

    optionButtons.forEach((btn) => {
      btn.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const idx = Number(btn.dataset.optIdx ?? '0');
        pickOptionAt(idx);
      });
    });

    const onMenuKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        ev.preventDefault();
        ev.stopPropagation();
        closeActiveDropdown(true);
      } else if (ev.key === 'ArrowDown') {
        ev.preventDefault();
        highlightIndex(focusedIdx + 1);
      } else if (ev.key === 'ArrowUp') {
        ev.preventDefault();
        highlightIndex(focusedIdx - 1);
      } else if (ev.key === 'Tab') {
        closeActiveDropdown(false);
      }
    };

    menuEl.addEventListener('keydown', onMenuKeyDown);

    activeDropdown = {
      selectEl,
      triggerBtn,
      menuEl,
      close: (restoreFocus = false) => {
        triggerBtn.setAttribute('aria-expanded', 'false');
        triggerBtn.classList.remove('is-open-down', 'is-open-up');
        menuEl.removeEventListener('keydown', onMenuKeyDown);
        menuEl.remove();
        if (restoreFocus && document.body.contains(triggerBtn)) {
          triggerBtn.focus();
        }
      },
    };
  };

  triggerBtn.addEventListener('click', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    openDropdown();
  });

  triggerBtn.addEventListener('keydown', (ev) => {
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
      ev.preventDefault();
      if (!activeDropdown || activeDropdown.selectEl !== selectEl) {
        openDropdown();
      }
      const firstSelected = activeDropdown?.menuEl.querySelector<HTMLButtonElement>(
        '.tl-select-option.is-selected, .tl-select-option',
      );
      firstSelected?.focus();
    } else if (ev.key === 'Escape' && activeDropdown?.selectEl === selectEl) {
      ev.preventDefault();
      closeActiveDropdown(true);
    }
  });
}

export function enhanceAllSelects(root: ParentNode = document): void {
  root.querySelectorAll<HTMLSelectElement>('select').forEach((sel) => {
    enhanceSingleSelect(sel);
  });
}

export function initCustomSelectEnhancer(): void {
  if (initialized || typeof window === 'undefined' || typeof document === 'undefined') return;
  initialized = true;

  enhanceAllSelects(document);

  let rafPending = false;
  const observer = new MutationObserver(() => {
    if (activeDropdown && !document.body.contains(activeDropdown.triggerBtn)) {
      closeActiveDropdown(false);
    }
    if (rafPending) return;
    rafPending = true;
    window.requestAnimationFrame(() => {
      rafPending = false;
      enhanceAllSelects(document);
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });

  document.addEventListener('click', (ev) => {
    if (!activeDropdown) return;
    const target = ev.target as Node | null;
    if (target && (activeDropdown.triggerBtn.contains(target) || activeDropdown.menuEl.contains(target))) {
      return;
    }
    closeActiveDropdown(false);
  });

  window.addEventListener(
    'scroll',
    (ev) => {
      if (!activeDropdown) return;
      if (activeDropdown.menuEl.classList.contains('tl-select-menu--inline')) {
        return; // Menu gắn inline tự trôi đồng bộ theo nút bấm khi cuộn trang
      }
      if (ev.target instanceof Node && activeDropdown.menuEl.contains(ev.target)) {
        return; // Cho phép cuộn danh sách bên trong chính menu dropdown
      }
      closeActiveDropdown(false);
    },
    { passive: true, capture: true },
  );

  window.addEventListener('resize', () => closeActiveDropdown(false), { passive: true });
}
