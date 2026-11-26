import { appEnv } from '@/config/env';
import { router } from '@/app/router';
import { sessionStore } from '@/app/session-store';
import { listAllDevOtps } from '@/mocks/handlers/auth-handler';
import { simulateDevSePayWebhook } from '@/mocks/handlers/booking-handler';
import { loadMockDb, mutateMockDb, resetMockDatabase } from '@/mocks/storage/mock-db';
import { showToast } from '@/shared/components/Toast';
import { escapeHtml } from '@/shared/utils/dom';

/**
 * Công cụ mô phỏng CHỈ dành cho môi trường phát triển khi VITE_DATA_SOURCE=mock.
 * Tách biệt hoàn toàn khỏi giao diện sản phẩm (không đặt nút đổi vai trò trong form đăng nhập
 * và không đặt nút "Tôi đã chuyển tiền" trong luồng khách hàng).
 */
export function mountDevToolbar(): void {
  if (!appEnv.enableDevTools) return;
  const root = document.getElementById('dev-toolbar-root');
  if (!root) return;

  let expanded = false;

  const render = () => {
    const db = loadMockDb();
    const pendingBookings = db.bookings.filter((b) => b.status === 'PENDING_PAYMENT');
    const latestOtps = listAllDevOtps();

    if (!expanded) {
      root.innerHTML = `
        <button type="button" id="devToolOpenBtn" class="fixed bottom-3 left-3 z-[70] min-h-[36px] px-space-3 rounded-full bg-on-surface/90 text-surface shadow-md border border-border inline-flex items-center gap-space-1 font-label text-label-sm opacity-85 hover:opacity-100 hover:bg-primary transition-all">
          <span class="material-symbols-outlined text-[16px]" aria-hidden="true">developer_mode</span>
          <span>Dev Tools</span>
        </button>
      `;
      root.querySelector('#devToolOpenBtn')?.addEventListener('click', () => {
        expanded = true;
        render();
      });
      return;
    }

    root.innerHTML = `
      <aside aria-label="Công cụ phát triển môi trường Mock" class="fixed bottom-3 left-3 z-[70] w-[360px] max-w-[calc(100vw-1.5rem)] max-h-[80vh] overflow-y-auto bg-surface border-2 border-primary rounded-xl shadow-lg p-space-4 flex flex-col gap-space-4">
        <div class="flex items-center justify-between gap-space-2 pb-space-2 border-b border-border">
          <div>
            <p class="font-label text-label-md text-primary">Công cụ phát triển (Mock Mode)</p>
            <p class="font-body text-label-sm text-text-secondary">Chỉ hiển thị ở môi trường phát triển</p>
          </div>
          <button type="button" id="devToolCloseBtn" aria-label="Thu gọn công cụ phát triển" class="w-9 h-9 inline-flex items-center justify-center rounded hover:bg-surface-muted">
            <span class="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <!-- 1. Tài khoản demo tham khảo -->
        <section class="flex flex-col gap-space-2">
          <h3 class="font-label text-label-sm text-on-surface">Chuyển nhanh tài khoản demo</h3>
          <div class="grid grid-cols-2 gap-space-2">
            <button type="button" data-dev-login="USR001" class="min-h-[38px] px-space-2 rounded border border-border hover:bg-primary-light text-label-sm font-label text-left">Khách (USR001)</button>
            <button type="button" data-dev-login="ADM001" class="min-h-[38px] px-space-2 rounded border border-border hover:bg-primary-light text-label-sm font-label text-left">Admin (ADM001)</button>
            <button type="button" data-dev-login="STF_NV001" class="min-h-[38px] px-space-2 rounded border border-border hover:bg-primary-light text-label-sm font-label text-left">NV001 (Địa điểm+Review)</button>
            <button type="button" data-dev-login="STF_NV004" class="min-h-[38px] px-space-2 rounded border border-border hover:bg-primary-light text-label-sm font-label text-left">NV004 (Chỉ xem Payment)</button>
          </div>
          <p class="font-body text-label-sm text-text-secondary">NV002 (bao.le@triploom.vn) đang INVITED · NV003 đang LOCKED.</p>
        </section>

        <!-- 2. Hộp thư OTP mock -->
        <section class="flex flex-col gap-space-2 border-t border-border pt-space-3">
          <h3 class="font-label text-label-sm text-on-surface">Hộp thư OTP Mock (chỉ dev)</h3>
          ${
            latestOtps.length === 0
              ? `<p class="font-body text-label-sm text-text-secondary">Chưa có mã OTP nào còn hiệu lực.</p>`
              : `<ul class="flex flex-col gap-space-1">
                  ${latestOtps
                    .slice(0, 4)
                    .map(
                      (otp) => `
                    <li class="p-space-2 rounded bg-surface-muted flex items-center justify-between gap-space-2 text-label-sm">
                      <span class="truncate text-text-secondary">${escapeHtml(otp.email)} (${escapeHtml(otp.purpose)})</span>
                      <strong class="text-primary tabular-nums">${escapeHtml(otp.code)}</strong>
                    </li>`,
                    )
                    .join('')}
                </ul>`
          }
        </section>

        <!-- 3. Mô phỏng Webhook SePay -->
        <section class="flex flex-col gap-space-2 border-t border-border pt-space-3">
          <h3 class="font-label text-label-sm text-on-surface">Giả lập sự kiện SePay (Webhook)</h3>
          ${
            pendingBookings.length === 0
              ? `<p class="font-body text-label-sm text-text-secondary">Không có đơn PENDING_PAYMENT nào.</p>`
              : `
                <select id="devBookingSelect" data-native-select="1" class="w-full min-h-[40px] px-space-3 rounded border border-border text-body-md">
                  ${pendingBookings
                    .map(
                      (b) =>
                        `<option value="${escapeHtml(b.id)}">${escapeHtml(b.id)} · ${escapeHtml(b.paymentCode)} (${b.totalAmountVnd.toLocaleString('vi-VN')}đ)</option>`,
                    )
                    .join('')}
                </select>
                <div class="grid grid-cols-2 gap-space-2">
                  <button type="button" data-dev-sepay="EXACT_PAID" class="min-h-[38px] px-space-2 rounded bg-success-bg text-on-success-bg font-label text-label-sm">Khớp PAID</button>
                  <button type="button" data-dev-sepay="WRONG_AMOUNT" class="min-h-[38px] px-space-2 rounded bg-warning-bg text-on-warning-bg font-label text-label-sm">Sai tiền</button>
                  <button type="button" data-dev-sepay="LATE_PAYMENT" class="min-h-[38px] px-space-2 rounded bg-error-bg text-on-error-bg font-label text-label-sm">Chuyển muộn</button>
                  <button type="button" data-dev-sepay="EXPIRE_NOW" class="min-h-[38px] px-space-2 rounded border border-border text-on-surface font-label text-label-sm">Hết hạn ngay</button>
                </div>
              `
          }
        </section>

        <!-- 4. Giả lập lỗi & Reset -->
        <section class="flex flex-col gap-space-2 border-t border-border pt-space-3">
          <h3 class="font-label text-label-sm text-on-surface">Chế độ giả lập lỗi</h3>
          <label class="flex items-center gap-space-2 text-body-md">
            <input type="checkbox" id="devFlagAi" ${db.devFlags.simulateAiFailure ? 'checked' : ''} class="rounded border-border text-primary" />
            <span>Giả lập AI lỗi / timeout</span>
          </label>
          <label class="flex items-center gap-space-2 text-body-md">
            <input type="checkbox" id="devFlagEmail" ${db.devFlags.simulateEmailFailure ? 'checked' : ''} class="rounded border-border text-primary" />
            <span>Giả lập lỗi gửi email</span>
          </label>
          <label class="flex items-center gap-space-2 text-body-md">
            <input type="checkbox" id="devFlagNet" ${db.devFlags.simulateNetworkFailure ? 'checked' : ''} class="rounded border-border text-primary" />
            <span>Giả lập lỗi kết nối mạng</span>
          </label>
          <button type="button" id="devResetDbBtn" class="mt-space-2 min-h-[40px] px-space-3 rounded border border-error text-error hover:bg-error-bg font-label text-label-sm">
            Reset toàn bộ dữ liệu demo
          </button>
        </section>
      </aside>
    `;

    root.querySelector('#devToolCloseBtn')?.addEventListener('click', () => {
      expanded = false;
      render();
    });

    root.querySelectorAll<HTMLButtonElement>('[data-dev-login]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const targetId = btn.dataset.devLogin!;
        mutateMockDb((state) => {
          const acc = state.accounts.find((a) => a.profile.id === targetId);
          if (acc) {
            state.currentUserId = acc.profile.id;
            state.currentAuthVersion = acc.authVersion;
          }
        });
        await sessionStore.refresh();
        showToast(`Đã chuyển phiên demo sang ${sessionStore.user?.fullName ?? targetId}.`, 'info');
        render();
        const nextUser = sessionStore.user;
        if (nextUser && (nextUser.role === 'ADMIN' || (nextUser.role === 'STAFF' && nextUser.staffStatus === 'ACTIVE'))) {
          router.navigate('/quan-tri');
        } else if (window.location.pathname.startsWith('/quan-tri')) {
          router.navigate('/ca-nhan');
        } else {
          router.reloadCurrent();
        }
      });
    });

    root.querySelectorAll<HTMLButtonElement>('[data-dev-sepay]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const select = root.querySelector<HTMLSelectElement>('#devBookingSelect');
        const bookingId = select?.value;
        if (!bookingId) return;
        const scenario = btn.dataset.devSepay as 'EXACT_PAID' | 'LATE_PAYMENT' | 'WRONG_AMOUNT' | 'EXPIRE_NOW';
        simulateDevSePayWebhook({ bookingId, scenario });
        showToast(`Đã giả lập sự kiện SePay (${scenario}) cho đơn ${bookingId}. Bấm "Kiểm tra thanh toán" hoặc tải lại để xem.`, 'success');
        render();
        router.reloadCurrent();
      });
    });

    root.querySelector('#devFlagAi')?.addEventListener('change', (e) => {
      const checked = (e.target as HTMLInputElement).checked;
      mutateMockDb((s) => {
        s.devFlags.simulateAiFailure = checked;
      });
    });
    root.querySelector('#devFlagEmail')?.addEventListener('change', (e) => {
      const checked = (e.target as HTMLInputElement).checked;
      mutateMockDb((s) => {
        s.devFlags.simulateEmailFailure = checked;
      });
    });
    root.querySelector('#devFlagNet')?.addEventListener('change', (e) => {
      const checked = (e.target as HTMLInputElement).checked;
      mutateMockDb((s) => {
        s.devFlags.simulateNetworkFailure = checked;
      });
    });

    root.querySelector('#devResetDbBtn')?.addEventListener('click', async () => {
      resetMockDatabase();
      await sessionStore.refresh();
      showToast('Đã khôi phục toàn bộ dữ liệu demo về trạng thái ban đầu.', 'success');
      render();
      router.navigate('/');
    });
  };

  render();
}
