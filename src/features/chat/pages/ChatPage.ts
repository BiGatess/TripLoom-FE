import type { RouteContext } from '@/app/router';
import { toUserErrorMessage } from '@/api/errors';
import type { ChatConversation } from '@/api/contracts';
import { chatService } from '@/features/chat/chat.service';
import { renderMemberShell } from '@/layouts/member/MemberShell';
import { renderEmptyState, renderErrorBanner, renderLoadingSkeleton } from '@/shared/components/EmptyErrorState';
import { showToast } from '@/shared/components/Toast';
import { escapeHtml } from '@/shared/utils/dom';
import { formatDateVi, formatTimeVi } from '@/shared/utils/format';

export async function renderChatPage(ctx: RouteContext): Promise<void> {
  const initialItineraryId = ctx.query.get('itinerary');
  let activeConversationId = ctx.params.conversationId ?? '';
  let conversations: ChatConversation[] = [];
  let isSending = false;
  let mobileSessionsOpen = false;
  let draftMessage = '';
  let composerError = '';

  const main = renderMemberShell({
    container: ctx.container,
    activeNav: 'chat',
    contentHtml: `<div id="chatRoot">${renderLoadingSkeleton(2)}</div>`,
  });

  const root = main.querySelector<HTMLElement>('#chatRoot')!;

  const load = async () => {
    root.innerHTML = renderLoadingSkeleton(2);
    try {
      if (initialItineraryId) {
        const linked = await chatService.createConversation(initialItineraryId);
        activeConversationId = linked.id;
      }
      conversations = await chatService.listConversations();
      if (!activeConversationId && conversations.length > 0) {
        activeConversationId = conversations[0]!.id;
      }
      if (activeConversationId) {
        window.history.replaceState({}, '', `/chat/${encodeURIComponent(activeConversationId)}`);
      }
      renderView();
    } catch (err) {
      root.innerHTML = renderErrorBanner(toUserErrorMessage(err), 'retryChatLoad');
      root.querySelector('#retryChatLoad')?.addEventListener('click', () => void load());
    }
  };

  const renderView = () => {
    const activeConv = conversations.find((c) => c.id === activeConversationId) ?? conversations[0] ?? null;

    const sessionListHtml =
      conversations.length === 0
        ? `<p class="font-body text-body-md text-text-secondary p-space-2">Chưa có phiên hội thoại nào.</p>`
        : conversations
            .map((c) => {
              const selected = c.id === activeConv?.id;
              return `
                <button type="button" data-select-conv="${escapeHtml(c.id)}" class="text-left p-space-3 rounded-lg border transition-colors ${
                  selected
                    ? 'bg-primary-light border-primary'
                    : 'bg-background border-border hover:bg-surface-muted'
                }">
                  <p class="font-label text-label-md ${selected ? 'text-primary' : 'text-on-surface'} truncate">${escapeHtml(c.title)}</p>
                  <p class="font-body text-label-sm text-text-secondary tabular-nums mt-0.5">
                    ${formatDateVi(c.updatedAt)} · ${c.itineraryLinked ? 'Đang liên kết lịch trình' : 'Không còn liên kết lịch trình'}
                  </p>
                </button>
              `;
            })
            .join('');

    root.innerHTML = `
      <div class="flex items-center justify-between gap-space-3">
        <div>
          <h1 class="font-headline text-headline-lg text-on-surface">Trợ lý AI TripLoom</h1>
          <p class="font-body text-body-md text-text-secondary">Hỏi đáp theo ngữ cảnh chuyến đi và danh mục địa điểm nội bộ.</p>
        </div>
        <button type="button" id="mobileSessionsBtn" class="lg:hidden inline-flex items-center gap-space-2 min-h-[44px] px-space-3 rounded border border-border bg-surface font-label text-label-sm">
          <span class="material-symbols-outlined text-[18px]" aria-hidden="true">forum</span>
          <span>Phiên chat (${conversations.length})</span>
        </button>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-12 gap-space-6 items-stretch">
        <!-- Sessions Column -->
        <section class="${mobileSessionsOpen ? 'flex' : 'hidden'} lg:flex lg:col-span-4 bg-surface border border-border rounded-xl p-space-4 flex-col gap-space-3 shadow-sm">
          <div class="flex items-center justify-between">
            <h2 class="font-headline text-headline-md text-on-surface">Phiên hội thoại</h2>
            <button type="button" id="newConvBtn" class="min-h-[44px] px-space-3 rounded bg-primary text-on-primary hover:bg-primary-hover font-label text-label-md">+ Mới</button>
          </div>
          <div class="flex flex-col gap-space-2 overflow-y-auto max-h-[520px]">
            ${sessionListHtml}
          </div>
        </section>

        <!-- Active Thread Column -->
        <section class="lg:col-span-8 bg-surface border border-border rounded-xl shadow-sm flex flex-col justify-between overflow-hidden min-h-[540px]">
          ${
            !activeConv
              ? `<div class="p-space-8 my-auto">
                   ${renderEmptyState({
                     icon: 'chat',
                     title: 'Bắt đầu hội thoại cùng Trợ lý AI',
                     description: 'Tạo phiên hội thoại mới để hỏi gợi ý lịch trình, thời điểm tham quan hoặc chi phí hoạt động.',
                     actionLabel: 'Tạo phiên hội thoại mới',
                     actionId: 'emptyNewConvBtn',
                   })}
                 </div>`
              : `
                <!-- Context Header -->
                <div class="p-space-4 border-b border-border flex flex-wrap items-center justify-between gap-space-2 bg-background">
                  <div class="flex items-center gap-space-2 min-w-0">
                    <span class="material-symbols-outlined text-[20px] text-primary shrink-0" aria-hidden="true">travel_explore</span>
                    <span class="font-label text-label-md text-on-surface truncate">
                      ${
                        activeConv.itineraryLinked && activeConv.itineraryTitle
                          ? `Ngữ cảnh: ${escapeHtml(activeConv.itineraryTitle)} (${escapeHtml(activeConv.itineraryId ?? '')})`
                          : 'Ngữ cảnh chung (không liên kết lịch trình)'
                      }
                    </span>
                  </div>
                  ${
                    activeConv.itineraryLinked && activeConv.itineraryId
                      ? `<a href="${activeConv.itineraryIsDraft ? `/lich-trinh/nhap/${encodeURIComponent(activeConv.itineraryId)}` : `/lich-trinh/${encodeURIComponent(activeConv.itineraryId)}`}" class="font-label text-label-md text-primary hover:underline shrink-0">Mở lịch trình</a>`
                      : ''
                  }
                </div>

                <!-- Messages -->
                <div id="chatMessages" class="flex-1 p-space-4 md:p-space-6 flex flex-col gap-space-4 overflow-y-auto max-h-[460px]">
                  ${
                    activeConv.messages.length === 0
                      ? `<p class="font-body text-body-md text-text-secondary text-center my-auto">Hãy đặt câu hỏi về địa điểm, sắp xếp khung giờ hoặc chi phí tham khảo cho chuyến đi của bạn.</p>`
                      : activeConv.messages
                          .map((m) =>
                            m.sender === 'USER'
                              ? `
                                <div class="self-end max-w-[85%] flex flex-col items-end gap-space-1">
                                  <div class="bg-primary text-on-primary rounded-lg p-space-4">
                                    <p class="font-body text-body-md">${escapeHtml(m.content)}</p>
                                    <span class="block text-right font-label text-label-sm text-primary-light mt-space-1 tabular-nums">${formatTimeVi(m.createdAt)}</span>
                                  </div>
                                  ${
                                    m.status === 'ERROR'
                                      ? `<div class="p-space-3 rounded-lg bg-error-bg text-on-error-bg font-body text-label-sm flex flex-wrap items-center gap-space-2">
                                           <span>${escapeHtml(m.errorMessage ?? 'Không nhận được phản hồi AI.')}</span>
                                           <button type="button" data-retry-msg="${escapeHtml(m.id)}" ${isSending ? 'disabled' : ''} class="px-space-3 py-space-1 rounded bg-surface border border-error text-error font-label text-label-sm hover:bg-error hover:text-on-error">Thử lại</button>
                                         </div>`
                                      : ''
                                  }
                                </div>
                              `
                              : `
                                <div class="self-start max-w-[85%] bg-background border border-border rounded-lg p-space-4 flex flex-col gap-space-2">
                                  <p class="font-body text-body-md text-on-surface">${escapeHtml(m.content)}</p>
                                  ${
                                    activeConv.itineraryLinked && activeConv.itineraryId
                                      ? `<a href="${activeConv.itineraryIsDraft ? `/lich-trinh/nhap/${encodeURIComponent(activeConv.itineraryId)}` : `/lich-trinh/${encodeURIComponent(activeConv.itineraryId)}`}" class="inline-flex items-center gap-space-1 self-start px-space-3 py-space-1 rounded-full bg-primary-light text-primary hover:bg-primary hover:text-on-primary no-underline font-label text-label-sm transition-colors">
                                           <span class="material-symbols-outlined text-[16px]" aria-hidden="true">route</span>
                                           <span>Xem lịch trình ${escapeHtml(activeConv.itineraryTitle ?? activeConv.itineraryId)}</span>
                                         </a>`
                                      : ''
                                  }
                                  <span class="block font-label text-label-sm text-text-secondary tabular-nums">${formatTimeVi(m.createdAt)} · Trợ lý AI TripLoom</span>
                                </div>
                              `,
                          )
                          .join('')
                  }
                  ${
                    isSending
                      ? `<div class="self-start max-w-[80%] bg-surface-muted border border-border rounded-lg p-space-4 flex items-center gap-space-2 font-body text-body-md text-text-secondary">
                           <span class="material-symbols-outlined text-[18px] animate-spin text-primary" aria-hidden="true">progress_activity</span>
                           <span>Trợ lý AI đang chuẩn bị câu trả lời...</span>
                         </div>`
                      : ''
                  }
                </div>

                <!-- Composer -->
                <form id="chatComposer" class="p-space-4 border-t border-border flex flex-col gap-space-2">
                  <div class="flex gap-space-3">
                    <label for="chatInput" class="sr-only">Nhập câu hỏi</label>
                    <input id="chatInput" type="text" maxlength="2000" value="${escapeHtml(draftMessage)}" ${isSending ? 'disabled' : ''} placeholder="Nhập câu hỏi về chuyến đi..." class="flex-1 min-h-[44px] px-space-4 rounded bg-surface border border-border text-body-md focus:border-primary focus:ring-2 focus:ring-primary/20" />
                    <button type="submit" ${isSending ? 'disabled' : ''} class="min-h-[44px] px-space-6 rounded bg-primary text-on-primary hover:bg-primary-hover disabled:opacity-50 font-label text-label-md transition-colors">
                      ${isSending ? 'Đang gửi...' : 'Gửi'}
                    </button>
                  </div>
                  <p id="chatInputErr" class="${composerError ? '' : 'hidden'} font-body text-label-sm text-error">${escapeHtml(composerError)}</p>
                </form>
              `
          }
        </section>
      </div>
    `;

    // Scroll to bottom of thread
    const msgBox = root.querySelector<HTMLElement>('#chatMessages');
    if (msgBox) msgBox.scrollTop = msgBox.scrollHeight;

    root.querySelector('#mobileSessionsBtn')?.addEventListener('click', () => {
      mobileSessionsOpen = !mobileSessionsOpen;
      renderView();
    });

    const handleNewConv = async () => {
      try {
        const created = await chatService.createConversation(null);
        conversations = [created, ...conversations];
        activeConversationId = created.id;
        composerError = '';
        mobileSessionsOpen = false;
        window.history.replaceState({}, '', `/chat/${encodeURIComponent(created.id)}`);
        renderView();
      } catch (err) {
        showToast(toUserErrorMessage(err), 'error');
      }
    };

    root.querySelector('#newConvBtn')?.addEventListener('click', () => void handleNewConv());
    root.querySelector('#emptyNewConvBtn')?.addEventListener('click', () => void handleNewConv());

    root.querySelectorAll<HTMLButtonElement>('[data-select-conv]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const nextId = btn.dataset.selectConv!;
        const currentInput = root.querySelector<HTMLInputElement>('#chatInput');
        if (currentInput) draftMessage = currentInput.value;
        activeConversationId = nextId;
        composerError = '';
        mobileSessionsOpen = false;
        window.history.replaceState({}, '', `/chat/${encodeURIComponent(nextId)}`);
        renderView();
      });
    });

    root.querySelectorAll<HTMLButtonElement>('[data-retry-msg]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!activeConv || isSending) return;
        const currentInput = root.querySelector<HTMLInputElement>('#chatInput');
        if (currentInput) draftMessage = currentInput.value;
        const msgId = btn.dataset.retryMsg!;
        isSending = true;
        composerError = '';
        renderView();
        try {
          const updated = await chatService.retryMessage(activeConv.id, msgId);
          conversations = conversations.map((c) => (c.id === updated.id ? updated : c));
        } catch (err) {
          composerError = toUserErrorMessage(err);
        } finally {
          isSending = false;
          renderView();
        }
      });
    });

    root.querySelector<HTMLFormElement>('#chatComposer')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!activeConv || isSending) return;
      const input = root.querySelector<HTMLInputElement>('#chatInput');
      const rawValue = input?.value ?? '';
      const text = rawValue.trim();
      if (!text) {
        composerError = 'Vui lòng nhập câu hỏi trước khi gửi.';
        renderView();
        root.querySelector<HTMLInputElement>('#chatInput')?.focus();
        return;
      }
      draftMessage = rawValue;
      composerError = '';
      isSending = true;
      renderView();
      try {
        const updated = await chatService.sendMessage(activeConv.id, text);
        conversations = conversations.map((c) => (c.id === updated.id ? updated : c));
        draftMessage = '';
      } catch (err) {
        // Giữ nguyên dữ liệu người dùng vừa nhập khi gửi thất bại
        composerError = toUserErrorMessage(err);
      } finally {
        isSending = false;
        renderView();
        root.querySelector<HTMLInputElement>('#chatInput')?.focus();
      }
    });
  };

  await load();
}
