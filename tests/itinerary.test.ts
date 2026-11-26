import { beforeEach, describe, expect, it } from 'vitest';
import { authService } from '@/features/auth/auth.service';
import { chatService } from '@/features/chat/chat.service';
import { itinerariesService } from '@/features/itineraries/itineraries.service';
import { tripPlanningService } from '@/features/trip-planning/trip-planning.service';
import { resetMockDatabase } from '@/mocks/storage/mock-db';

describe('Itinerary draft/save, partial regeneration, version conflict & delete behavior', () => {
  beforeEach(async () => {
    resetMockDatabase(Date.UTC(2027, 0, 15, 8, 0, 0));
    await authService.login({ email: 'minh.anh@example.com', password: 'TripLoom@123' });
  });

  it('separates draft from saved history, preserves other days on partial regenerate, and detects version conflicts', async () => {
    const req = await tripPlanningService.createTripRequest({
      region: 'Đà Nẵng',
      startDate: '2027-03-01',
      daysCount: 3,
      partySize: 2,
      budgetVnd: 2500000,
      budgetScopeNote: 'Chi phí hoạt động toàn đoàn trong 3 ngày.',
      categoryIds: ['CAT01', 'CAT03'],
      pace: 'MODERATE',
    });

    const draft = await tripPlanningService.generateDraftItinerary(req.id);
    expect(draft.isDraft).toBe(true);
    expect(draft.draftExpiresAt).not.toBeNull();

    // Bản nháp chưa xuất hiện trong lịch sử đã lưu
    const historyBefore = await itinerariesService.listMyItineraries();
    expect(historyBefore.items.some((i) => i.id === draft.id)).toBe(false);

    // Tái tạo riêng Ngày 1 -> Ngày 2 và Ngày 3 giữ nguyên
    const day2Before = JSON.stringify(draft.days[1]);
    const day3Before = JSON.stringify(draft.days[2]);
    const preview = await itinerariesService.previewRegenerateDay(draft.id, 1, 'Ưu tiên đi biển nhẹ nhàng');
    const updatedDraft = await itinerariesService.applyRegeneratedDay(draft.id, 1, preview.afterActivities, draft.version);
    expect(JSON.stringify(updatedDraft.days[1])).toBe(day2Before);
    expect(JSON.stringify(updatedDraft.days[2])).toBe(day3Before);
    expect(updatedDraft.version).toBe(draft.version + 1);

    // Xung đột phiên bản khi dùng version cũ -> 409 CONFLICT
    await expect(
      itinerariesService.saveItinerary(draft.id, draft.version),
    ).rejects.toMatchObject({ code: 'CONFLICT' });

    // Lưu chính thức bằng version mới nhất -> chuyển sang lịch sử đã lưu
    const saved = await itinerariesService.saveItinerary(draft.id, updatedDraft.version);
    expect(saved.isDraft).toBe(false);
    expect(saved.draftExpiresAt).toBeNull();

    const historyAfter = await itinerariesService.listMyItineraries();
    expect(historyAfter.items.some((i) => i.id === saved.id)).toBe(true);
  });

  it('rejects overlapping times and keeps chat history unlinked when itinerary is deleted', async () => {
    const lt001 = await itinerariesService.getItinerary('LT001');

    // Trùng khung giờ với 08:00-10:30 ở Ngày 1
    await expect(
      itinerariesService.upsertActivity(
        lt001.id,
        {
          dayNumber: 1,
          type: 'REST_NOTE',
          destinationId: null,
          title: 'Hoạt động chồng giờ',
          startTime: '09:00',
          endTime: '11:00',
          estimatedGroupCostVnd: 0,
          notes: '',
        },
        lt001.version,
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });

    // Xóa LT001 -> CONV001 vẫn tồn tại nhưng itineraryLinked = false
    await itinerariesService.deleteItinerary('LT001');
    const convs = await chatService.listConversations();
    const conv1 = convs.find((c) => c.id === 'CONV001');
    expect(conv1).toBeDefined();
    expect(conv1?.itineraryLinked).toBe(false);
    expect(conv1?.messages.length).toBeGreaterThan(0);
  });

  it('stages edits to a saved itinerary in pendingDraftDays without overwriting saved history until saveItinerary is called', async () => {
    const initial = await itinerariesService.getItinerary('LT001');
    expect(initial.isDraft).toBe(false);
    const originalDay1Count = initial.days[0]!.activities.length;

    // Áp dụng chỉnh sửa vào Ngày 1 của lịch trình ĐÃ LƯU -> mới ghi vào bản nháp chỉnh sửa
    const preview = await itinerariesService.previewRegenerateDay('LT001', 1, 'Đi biển buổi sáng');
    const afterApply = await itinerariesService.applyRegeneratedDay('LT001', 1, preview.afterActivities, initial.version);
    expect(afterApply.hasUnsavedChanges).toBe(true);

    // Lịch sử đã lưu (listMyItineraries) vẫn giữ nguyên bản gốc chưa bị ghi đè!
    const historyWhilePending = await itinerariesService.listMyItineraries();
    const savedRow = historyWhilePending.items.find((i) => i.id === 'LT001')!;
    expect(savedRow.days[0]!.activities[0]!.destinationId).toBe('DN002'); // Ngũ Hành Sơn gốc

    // Nếu người dùng bấm Khôi phục bản đã lưu -> hủy thay đổi nháp
    const discarded = await itinerariesService.discardChanges('LT001');
    expect(discarded.hasUnsavedChanges).toBe(false);
    expect(discarded.days[0]!.activities.length).toBe(originalDay1Count);
    expect(discarded.days[0]!.activities[0]!.destinationId).toBe('DN002');

    // Khi áp dụng lại rồi bấm Lưu lịch trình -> mới ghi chính thức vào bản đã lưu
    const afterApply2 = await itinerariesService.applyRegeneratedDay('LT001', 1, preview.afterActivities, discarded.version);
    const committed = await itinerariesService.saveItinerary('LT001', afterApply2.version);
    expect(committed.hasUnsavedChanges).toBe(false);

    const historyAfterCommit = await itinerariesService.listMyItineraries();
    const committedRow = historyAfterCommit.items.find((i) => i.id === 'LT001')!;
    expect(committedRow.days[0]!.activities[0]!.destinationId).toBe('DN001');
  });
});
