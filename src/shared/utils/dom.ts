export function escapeHtml(input: unknown): string {
  const str = input === null || input === undefined ? '' : String(input);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function qs<T extends Element = HTMLElement>(root: ParentNode, selector: string): T | null {
  return root.querySelector<T>(selector);
}

export function qsa<T extends Element = HTMLElement>(root: ParentNode, selector: string): T[] {
  return Array.from(root.querySelectorAll<T>(selector));
}

export function createPlaceholderSvgDataUri(label = 'TripLoom'): string {
  const safe = label.replace(/[<>&"']/g, '').slice(0, 26);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500">
    <rect width="800" height="500" fill="#E6F5F2"/>
    <circle cx="400" cy="210" r="46" fill="#0F766E" opacity="0.14"/>
    <path d="M372 232C382 204 393 186 400 186C407 186 418 204 428 232" stroke="#0F766E" stroke-width="5" stroke-linecap="round" fill="none"/>
    <path d="M368 208C384 198 416 198 432 208" stroke="#115E59" stroke-width="4" stroke-linecap="round" fill="none"/>
    <circle cx="400" cy="184" r="6" fill="#0F766E"/>
    <text x="400" y="290" text-anchor="middle" font-family="Be Vietnam Pro, Arial, sans-serif" font-size="22" font-weight="600" fill="#0F766E">${safe}</text>
    <text x="400" y="320" text-anchor="middle" font-family="Be Vietnam Pro, Arial, sans-serif" font-size="14" fill="#475569">Ảnh minh họa đang tạm không khả dụng</text>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export function bindImageFallbacks(root: ParentNode): void {
  root.querySelectorAll<HTMLImageElement>('img[data-fallback-label]').forEach((img) => {
    if (img.dataset.fallbackBound === '1') return;
    img.dataset.fallbackBound = '1';
    img.addEventListener('error', () => {
      if (img.dataset.fallbackApplied === '1') return;
      img.dataset.fallbackApplied = '1';
      img.src = createPlaceholderSvgDataUri(img.dataset.fallbackLabel || img.alt || 'TripLoom');
    });
  });
}

export function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text).then(() => true).catch(() => false);
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.focus();
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return Promise.resolve(ok);
  } catch {
    return Promise.resolve(false);
  }
}

/** Hiển thị skeleton ở lần đầu, hoặc làm mờ nhẹ nội dung cũ khi đang lọc/tìm kiếm lại để không giật layout. */
export function beginAsyncRender(container: HTMLElement, skeletonHtml: string): void {
  if (container.dataset.tlLoaded === '1') {
    container.style.transition = 'opacity 160ms ease-out';
    container.style.opacity = '0.52';
    container.style.pointerEvents = 'none';
    container.setAttribute('aria-busy', 'true');
  } else {
    container.innerHTML = skeletonHtml;
  }
}

/** Thay thế nội dung mới kèm hiệu ứng hiện mượt mà (crossfade). */
export function finishAsyncRender(container: HTMLElement, html: string): void {
  container.style.transition = '';
  container.style.opacity = '';
  container.style.pointerEvents = '';
  container.removeAttribute('aria-busy');
  container.dataset.tlLoaded = '1';
  container.classList.remove('tl-content-enter');
  container.innerHTML = html;
  void container.offsetWidth;
  container.classList.add('tl-content-enter');
}
