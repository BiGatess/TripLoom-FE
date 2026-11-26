import { beforeEach, describe, expect, it } from 'vitest';
import { authService } from '@/features/auth/auth.service';
import { chatService } from '@/features/chat/chat.service';
import { favoritesService } from '@/features/favorites/favorites.service';
import { reviewsService } from '@/features/reviews/reviews.service';
import { mutateMockDb, resetMockDatabase } from '@/mocks/storage/mock-db';

describe('Favorites idempotency, review moderation integrity & chat retry without duplication', () => {
  beforeEach(async () => {
    resetMockDatabase(Date.UTC(2027, 0, 15, 8, 0, 0));
    await authService.login({ email: 'minh.anh@example.com', password: 'TripLoom@123' });
  });

  it('keeps ADD/REMOVE favorites idempotent without toggling on repeated calls', async () => {
    await favoritesService.addFavorite('DN002');
    await favoritesService.addFavorite('DN002');
    let favs = await favoritesService.listFavorites();
    expect(favs.filter((d) => d.id === 'DN002').length).toBe(1);

    await favoritesService.removeFavorite('DN002');
    await favoritesService.removeFavorite('DN002');
    favs = await favoritesService.listFavorites();
    expect(favs.some((d) => d.id === 'DN002')).toBe(false);
  });

  it('keeps one review per user per destination, resets edits to PENDING, and preserves user content during moderation', async () => {
    const updated = await reviewsService.upsertMyReview({
      destinationId: 'HA001',
      rating: 5,
      comment: 'Cập nhật lại đánh giá: trải nghiệm phố cổ buổi chiều và tối rất đáng nhớ.',
    });
    expect(updated.id).toBe('RV001'); // vẫn 1 bản duy nhất cho USR001 + HA001
    expect(updated.status).toBe('PENDING');

    // Nhân viên NV001 kiểm duyệt công khai mà không sửa lời nhận xét hay số sao
    await authService.login({ email: 'ha.tran@triploom.vn', password: 'Staff@123' });
    const moderated = await reviewsService.moderateReview('RV001', {
      status: 'PUBLISHED',
      reason: 'Nội dung phù hợp quy chuẩn cộng đồng.',
    });
    expect(moderated.status).toBe('PUBLISHED');
    expect(moderated.rating).toBe(5);
    expect(moderated.comment).toBe(updated.comment);
  });

  it('retries failed AI chat turn without duplicating the user message', async () => {
    mutateMockDb((db) => {
      db.devFlags.simulateAiFailure = true;
    });

    const conv = await chatService.createConversation('LT001');
    const initialCount = conv.messages.length;

    const failedConv = await chatService.sendMessage(conv.id, 'Nên đi Ngũ Hành Sơn mấy giờ?');
    expect(failedConv.messages.length).toBe(initialCount + 1);
    const failedMsg = failedConv.messages[failedConv.messages.length - 1]!;
    expect(failedMsg.status).toBe('ERROR');

    // Tắt lỗi AI và bấm thử lại -> không thêm câu hỏi trùng, chỉ thêm câu trả lời AI
    mutateMockDb((db) => {
      db.devFlags.simulateAiFailure = false;
    });
    const retried = await chatService.retryMessage(conv.id, failedMsg.id);
    const userQuestions = retried.messages.filter((m) => m.sender === 'USER' && m.content === 'Nên đi Ngũ Hành Sơn mấy giờ?');
    expect(userQuestions.length).toBe(1);
    expect(retried.messages[retried.messages.length - 1]?.sender).toBe('AI');
  });
});
