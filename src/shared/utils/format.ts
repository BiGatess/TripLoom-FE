/**
 * Định dạng tiền VND, ngày dd/MM/yyyy, giờ 24h và bộ đếm theo chuẩn TripLoom (Asia/Ho_Chi_Minh).
 */

export function formatVnd(amount: number | null | undefined, options?: { freeLabel?: string; unknownLabel?: string }): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) {
    return options?.unknownLabel ?? 'Chưa có thông tin giá';
  }
  if (amount === 0 && options?.freeLabel) {
    return options.freeLabel;
  }
  const rounded = Math.round(amount);
  const formatted = rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${formatted}đ`;
}

export function formatDateVi(isoOrYmd: string | null | undefined): string {
  if (!isoOrYmd) return '—';
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoOrYmd)) {
    const [y, m, d] = isoOrYmd.split('-');
    return `${d}/${m}/${y}`;
  }
  const date = new Date(isoOrYmd);
  if (Number.isNaN(date.getTime())) return isoOrYmd;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(date);
  const d = parts.find((p) => p.type === 'day')?.value ?? '01';
  const m = parts.find((p) => p.type === 'month')?.value ?? '01';
  const y = parts.find((p) => p.type === 'year')?.value ?? '2027';
  return `${d}/${m}/${y}`;
}

export function formatDateTimeVi(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const d = parts.find((p) => p.type === 'day')?.value ?? '01';
  const m = parts.find((p) => p.type === 'month')?.value ?? '01';
  const y = parts.find((p) => p.type === 'year')?.value ?? '2027';
  const h = parts.find((p) => p.type === 'hour')?.value ?? '00';
  const min = parts.find((p) => p.type === 'minute')?.value ?? '00';
  return `${d}/${m}/${y} ${h}:${min}`;
}

export function formatTimeVi(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

export function formatCountdownMmSs(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function secondsRemaining(targetIso: string | null | undefined, nowMs = Date.now()): number {
  if (!targetIso) return 0;
  const targetMs = new Date(targetIso).getTime();
  if (Number.isNaN(targetMs)) return 0;
  return Math.max(0, Math.ceil((targetMs - nowMs) / 1000));
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return email;
  if (local.length <= 2) return `${local[0] ?? '*'}*@${domain}`;
  return `${local.slice(0, 2)}***${local.slice(-1)}@${domain}`;
}

export function addDaysYmd(startYmd: string, offsetDays: number): string {
  const parts = startYmd.split('-').map(Number);
  const y = parts[0] ?? 2027;
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  const dt = new Date(Date.UTC(y, m - 1, d + offsetDays));
  const ny = dt.getUTCFullYear();
  const nm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const nd = String(dt.getUTCDate()).padStart(2, '0');
  return `${ny}-${nm}-${nd}`;
}

export function computeEndDateYmd(startYmd: string, daysCount: number): string {
  return addDaysYmd(startYmd, Math.max(0, daysCount - 1));
}
