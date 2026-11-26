import { showToast } from '@/shared/components/Toast';
import { bindImageFallbacks, escapeHtml } from '@/shared/utils/dom';

export interface ImageGalleryState {
  mainImageUrl: string;
  subImageUrls: [string, string, string, string];
}

export interface ImageGalleryController {
  getMainImageUrl: () => string;
  getGalleryUrls: () => string[];
}

const MAX_FILE_SIZE_BYTES = 12 * 1024 * 1024; // 12MB trước khi nén

/**
 * Đọc file ảnh từ máy tính và tối ưu kích thước qua Canvas (tối đa 1200x750)
 * để ảnh sắc nét mà không làm đầy bộ nhớ trình duyệt ở chế độ mock.
 */
export async function readLocalImageFile(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Vui lòng chọn tệp hình ảnh hợp lệ (JPG, PNG, WEBP, SVG).');
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error('Kích thước ảnh vượt quá 12MB. Vui lòng chọn ảnh nhẹ hơn.');
  }

  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Không thể đọc tệp ảnh từ máy tính.'));
    reader.readAsDataURL(file);
  });

  if (file.type === 'image/svg+xml') {
    return rawDataUrl;
  }

  return new Promise<string>((resolve) => {
    const img = new Image();
    img.onload = () => {
      const maxW = 1200;
      const maxH = 750;
      let w = img.naturalWidth || maxW;
      let h = img.naturalHeight || maxH;

      if (w > maxW || h > maxH) {
        const ratio = Math.min(maxW / w, maxH / h);
        w = Math.max(1, Math.round(w * ratio));
        h = Math.max(1, Math.round(h * ratio));
      }

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(rawDataUrl);
        return;
      }
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => resolve(rawDataUrl);
    img.src = rawDataUrl;
  });
}

function normalizeFourSlots(urls?: string[]): [string, string, string, string] {
  const src = urls ?? [];
  return [src[0] ?? '', src[1] ?? '', src[2] ?? '', src[3] ?? ''];
}

export function mountImageGalleryUploader(options: {
  container: HTMLElement;
  initialMainUrl: string;
  initialGalleryUrls?: string[];
  onChange?: () => void;
}): ImageGalleryController {
  let mainUrl = options.initialMainUrl.trim();
  const subUrls: [string, string, string, string] = normalizeFourSlots(options.initialGalleryUrls);

  const render = () => {
    const filledSubCount = subUrls.filter(Boolean).length;

    options.container.innerHTML = `
      <div class="flex flex-col gap-5">
        <!-- 1. Ô ẢNH CHÍNH -->
        <div class="flex flex-col gap-2.5">
          <div class="flex items-center justify-between gap-2">
            <h2 class="font-headline text-headline-md text-on-surface">Ảnh chính (16:10)</h2>
            <span class="px-2.5 py-0.5 rounded-full bg-primary-light text-primary font-label text-label-sm">Ảnh đại diện</span>
          </div>

          <input type="file" data-upload-main accept="image/*" class="hidden" />

          <div
            data-dropzone-main
            class="group relative aspect-[16/10] rounded-xl overflow-hidden border-2 ${
              mainUrl ? 'border-border' : 'border-dashed border-border hover:border-primary'
            } bg-surface-muted transition-colors cursor-pointer"
          >
            ${
              mainUrl
                ? `
                  <img
                    src="${escapeHtml(mainUrl)}"
                    alt="Xem trước ảnh chính"
                    data-fallback-label="Ảnh chính"
                    class="w-full h-full object-cover"
                  />
                  <div class="absolute inset-0 bg-on-surface/0 group-hover:bg-on-surface/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <span class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-surface text-on-surface font-label text-label-sm shadow-md">
                      <span class="material-symbols-outlined text-[18px] text-primary" aria-hidden="true">upload</span>
                      <span>Đổi ảnh từ máy</span>
                    </span>
                  </div>
                `
                : `
                  <div class="w-full h-full flex flex-col items-center justify-center gap-2 p-4 text-center">
                    <span class="w-11 h-11 rounded-full bg-primary-light text-primary inline-flex items-center justify-center">
                      <span class="material-symbols-outlined text-[24px]" aria-hidden="true">add_photo_alternate</span>
                    </span>
                    <p class="font-label text-label-md text-on-surface">Bấm để chọn ảnh chính từ máy</p>
                    <p class="font-body text-label-sm text-text-secondary">Hỗ trợ JPG, PNG, WEBP, SVG (kéo thả hoặc chọn tệp)</p>
                  </div>
                `
            }
          </div>

          <button
            type="button"
            data-trigger-main
            class="w-full min-h-[40px] px-4 rounded-lg border border-primary/40 bg-primary-light/60 text-primary hover:bg-primary hover:text-on-primary inline-flex items-center justify-center gap-2 font-label text-label-md transition-colors"
          >
            <span class="material-symbols-outlined text-[18px]" aria-hidden="true">upload_file</span>
            <span>${mainUrl ? 'Tải ảnh chính khác từ máy' : 'Tải ảnh chính từ máy tính'}</span>
          </button>
          <span data-err="imageUrl" class="hidden font-body text-body-md text-error"></span>
        </div>

        <!-- 2. BỐN Ô ẢNH PHỤ -->
        <div class="border-t border-border pt-4 flex flex-col gap-3">
          <div class="flex items-center justify-between gap-2">
            <div>
              <h3 class="font-label text-label-lg text-on-surface">Ảnh phụ chi tiết (${filledSubCount}/4)</h3>
              <p class="font-body text-label-sm text-text-secondary">Tối đa 4 ảnh phụ tải trực tiếp từ máy tính</p>
            </div>
            <input type="file" data-upload-multi accept="image/*" multiple class="hidden" />
            <button
              type="button"
              data-trigger-multi
              class="px-3 py-1.5 rounded-lg border border-border bg-background hover:border-primary hover:text-primary font-label text-label-sm text-on-surface inline-flex items-center gap-1 transition-colors shrink-0"
            >
              <span class="material-symbols-outlined text-[16px]" aria-hidden="true">library_add</span>
              <span>Chọn nhanh</span>
            </button>
          </div>

          <div class="grid grid-cols-2 gap-3">
            ${subUrls
              .map(
                (url, idx) => `
                  <div class="relative flex flex-col">
                    <input type="file" data-upload-sub="${idx}" accept="image/*" class="hidden" />
                    <div
                      data-dropzone-sub="${idx}"
                      class="group relative aspect-[16/10] rounded-lg overflow-hidden border-2 ${
                        url
                          ? 'border-border bg-surface-muted'
                          : 'border-dashed border-border bg-background hover:border-primary hover:bg-primary-light/25'
                      } transition-colors cursor-pointer"
                    >
                      ${
                        url
                          ? `
                            <img
                              src="${escapeHtml(url)}"
                              alt="Ảnh phụ ${idx + 1}"
                              data-fallback-label="Ảnh phụ ${idx + 1}"
                              class="w-full h-full object-cover"
                            />
                            <span class="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-on-surface/75 text-white font-label text-[10px] tabular-nums">
                              #${idx + 1}
                            </span>
                            <button
                              type="button"
                              data-remove-sub="${idx}"
                              aria-label="Xóa ảnh phụ ${idx + 1}"
                              title="Xóa ảnh phụ ${idx + 1}"
                              class="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-surface/95 text-error hover:bg-error hover:text-white shadow inline-flex items-center justify-center transition-colors"
                            >
                              <span class="material-symbols-outlined text-[15px]" aria-hidden="true">close</span>
                            </button>
                            <div class="absolute inset-x-0 bottom-0 py-1 bg-on-surface/65 text-white text-[11px] font-label text-center opacity-0 group-hover:opacity-100 transition-opacity">
                              Bấm để đổi ảnh
                            </div>
                          `
                          : `
                            <div class="w-full h-full flex flex-col items-center justify-center gap-1 p-2 text-center">
                              <span class="material-symbols-outlined text-[22px] text-primary/80" aria-hidden="true">add_a_photo</span>
                              <span class="font-label text-label-sm text-text-secondary">Ảnh phụ ${idx + 1}</span>
                            </div>
                          `
                      }
                    </div>
                  </div>
                `,
              )
              .join('')}
          </div>
        </div>
      </div>
    `;

    bindImageFallbacks(options.container);

    const mainInput = options.container.querySelector<HTMLInputElement>('[data-upload-main]');
    const multiInput = options.container.querySelector<HTMLInputElement>('[data-upload-multi]');

    const handleMainFile = async (file: File | undefined) => {
      if (!file) return;
      try {
        mainUrl = await readLocalImageFile(file);
        options.onChange?.();
        render();
        showToast('Đã tải ảnh chính lên.', 'info');
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Không thể đọc ảnh.', 'error');
      }
    };

    options.container.querySelector('[data-trigger-main]')?.addEventListener('click', () => mainInput?.click());
    options.container.querySelector('[data-dropzone-main]')?.addEventListener('click', () => mainInput?.click());
    mainInput?.addEventListener('change', () => {
      void handleMainFile(mainInput.files?.[0]);
    });

    const mainZone = options.container.querySelector<HTMLElement>('[data-dropzone-main]');
    mainZone?.addEventListener('dragover', (e) => {
      e.preventDefault();
      mainZone.classList.add('border-primary');
    });
    mainZone?.addEventListener('dragleave', () => {
      mainZone.classList.remove('border-primary');
    });
    mainZone?.addEventListener('drop', (e) => {
      e.preventDefault();
      mainZone.classList.remove('border-primary');
      void handleMainFile(e.dataTransfer?.files?.[0]);
    });

    // Từng ô ảnh phụ 0..3
    options.container.querySelectorAll<HTMLElement>('[data-dropzone-sub]').forEach((zone) => {
      const idx = Number(zone.dataset.dropzoneSub ?? '0') as 0 | 1 | 2 | 3;
      const subInput = options.container.querySelector<HTMLInputElement>(`[data-upload-sub="${idx}"]`);

      zone.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('[data-remove-sub]')) return;
        subInput?.click();
      });

      subInput?.addEventListener('change', async () => {
        const file = subInput.files?.[0];
        if (!file) return;
        try {
          subUrls[idx] = await readLocalImageFile(file);
          options.onChange?.();
          render();
        } catch (err) {
          showToast(err instanceof Error ? err.message : 'Không thể tải ảnh phụ.', 'error');
        }
      });

      zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        zone.classList.add('border-primary');
      });
      zone.addEventListener('dragleave', () => {
        zone.classList.remove('border-primary');
      });
      zone.addEventListener('drop', async (e) => {
        e.preventDefault();
        zone.classList.remove('border-primary');
        const file = e.dataTransfer?.files?.[0];
        if (!file) return;
        try {
          subUrls[idx] = await readLocalImageFile(file);
          options.onChange?.();
          render();
        } catch (err) {
          showToast(err instanceof Error ? err.message : 'Không thể tải ảnh phụ.', 'error');
        }
      });
    });

    options.container.querySelectorAll<HTMLButtonElement>('[data-remove-sub]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = Number(btn.dataset.removeSub ?? '0') as 0 | 1 | 2 | 3;
        subUrls[idx] = '';
        options.onChange?.();
        render();
      });
    });

    // Chọn nhanh nhiều ảnh phụ cùng lúc
    options.container.querySelector('[data-trigger-multi]')?.addEventListener('click', () => multiInput?.click());
    multiInput?.addEventListener('change', async () => {
      const files = Array.from(multiInput.files ?? []).slice(0, 4);
      if (files.length === 0) return;
      try {
        let fileCursor = 0;
        // Điền ưu tiên vào các ô trống trước, nếu đầy thì ghi đè lần lượt từ ô 1..4
        for (let i = 0; i < 4 && fileCursor < files.length; i++) {
          if (!subUrls[i]) {
            subUrls[i] = await readLocalImageFile(files[fileCursor]!);
            fileCursor++;
          }
        }
        for (let i = 0; i < 4 && fileCursor < files.length; i++) {
          subUrls[i] = await readLocalImageFile(files[fileCursor]!);
          fileCursor++;
        }
        options.onChange?.();
        render();
        showToast(`Đã cập nhật ${Math.min(files.length, 4)} ảnh phụ.`, 'success');
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Không thể đọc tệp ảnh.', 'error');
      }
    });
  };

  render();

  return {
    getMainImageUrl: () => mainUrl,
    getGalleryUrls: () => subUrls.filter((u) => u.trim().length > 0),
  };
}

/**
 * Hiển thị khung Ảnh chính + dải 4 Ảnh phụ tương tác trên trang Chi tiết Địa điểm / Dịch vụ.
 */
export function renderDetailImageGallery(mainImageUrl: string, galleryUrls: string[] | undefined, altLabel: string): string {
  const subs = (galleryUrls ?? []).filter((u) => u.trim().length > 0).slice(0, 4);
  const allPhotos = [mainImageUrl, ...subs];

  if (allPhotos.length <= 1) {
    return `
      <div class="rounded-xl overflow-hidden border border-border bg-surface-muted aspect-[16/10] shadow-sm">
        <img src="${escapeHtml(mainImageUrl)}" alt="${escapeHtml(altLabel)}" data-fallback-label="${escapeHtml(altLabel)}" class="w-full h-full object-cover" />
      </div>
    `;
  }

  return `
    <div class="flex flex-col gap-3" data-detail-gallery>
      <div class="rounded-xl overflow-hidden border border-border bg-surface-muted aspect-[16/10] shadow-sm">
        <img
          data-gallery-hero
          src="${escapeHtml(allPhotos[0]!)}"
          alt="${escapeHtml(altLabel)}"
          data-fallback-label="${escapeHtml(altLabel)}"
          class="w-full h-full object-cover transition-opacity duration-150"
        />
      </div>
      <div class="grid grid-cols-5 gap-2.5" role="listbox" aria-label="Bộ sưu tập ảnh ${escapeHtml(altLabel)}">
        ${allPhotos
          .map(
            (url, idx) => `
              <button
                type="button"
                data-gallery-thumb="${escapeHtml(url)}"
                aria-label="${idx === 0 ? 'Ảnh chính' : `Ảnh phụ ${idx}`}"
                class="aspect-[16/10] rounded-lg overflow-hidden border-2 ${
                  idx === 0 ? 'border-primary ring-2 ring-primary/25' : 'border-border opacity-80 hover:opacity-100'
                } bg-surface-muted transition-all"
              >
                <img src="${escapeHtml(url)}" alt="${escapeHtml(altLabel)} - ảnh ${idx + 1}" data-fallback-label="Ảnh ${idx + 1}" class="w-full h-full object-cover" />
              </button>
            `,
          )
          .join('')}
      </div>
    </div>
  `;
}

export function bindDetailImageGallery(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>('[data-detail-gallery]').forEach((wrap) => {
    const hero = wrap.querySelector<HTMLImageElement>('[data-gallery-hero]');
    const thumbs = wrap.querySelectorAll<HTMLButtonElement>('[data-gallery-thumb]');
    if (!hero) return;

    thumbs.forEach((btn) => {
      btn.addEventListener('click', () => {
        const nextSrc = btn.dataset.galleryThumb;
        if (!nextSrc) return;
        hero.dataset.fallbackApplied = '0';
        hero.src = nextSrc;
        thumbs.forEach((t) => {
          const active = t === btn;
          t.className = `aspect-[16/10] rounded-lg overflow-hidden border-2 ${
            active ? 'border-primary ring-2 ring-primary/25' : 'border-border opacity-80 hover:opacity-100'
          } bg-surface-muted transition-all`;
        });
      });
    });
  });
}
