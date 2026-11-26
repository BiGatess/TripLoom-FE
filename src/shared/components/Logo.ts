export function renderLogoMark(size = 32): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 36 36" fill="none" aria-hidden="true" class="shrink-0">
    <rect width="36" height="36" rx="10" fill="#0F766E"></rect>
    <path d="M10 24C12.5 17 16 12 18 12C20 12 23.5 17 26 24" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round"></path>
    <path d="M9 17.5C13.5 15 22.5 15 27 17.5" stroke="#E6F5F2" stroke-width="2" stroke-linecap="round"></path>
    <circle cx="18" cy="11.5" r="2.2" fill="#FFFFFF"></circle>
  </svg>`;
}
