import { AppError } from '@/api/errors';
import type {
  ChatConversation,
  ChatMessage,
  CloneItineraryRequest,
  Itinerary,
  ItineraryActivity,
  ItineraryDay,
  ItineraryListParams,
  PaginatedItineraries,
  RecommendationsResponse,
  RegenerateDayPreview,
  TripDraftRequest,
  TripRequestInput,
  UpsertActivityInput,
} from '@/api/contracts';
import { DRAFT_RULES, PACE_LABELS } from '@/config/constants';
import { addDaysYmd, computeEndDateYmd } from '@/shared/utils/format';
import { getMockNowMs, loadMockDb, mutateMockDb, simulateDelay } from '@/mocks/storage/mock-db';
import { assertNetworkAvailable, requireAuthAccount } from './auth-handler';
import { hydrateDestination } from './catalog-handler';

function computeDaysTotals(days: ItineraryDay[]): { total: number; hasUnknown: boolean } {
  let total = 0;
  let hasUnknown = false;
  for (const day of days) {
    day.activities.sort((a, b) => a.orderIndex - b.orderIndex);
    day.activities.forEach((act, idx) => {
      act.orderIndex = idx;
      if (act.estimatedGroupCostVnd === null) {
        hasUnknown = true;
      } else {
        total += act.estimatedGroupCostVnd;
      }
    });
  }
  return { total, hasUnknown };
}

function recomputeItineraryTotals(itinerary: Itinerary): void {
  const { total, hasUnknown } = computeDaysTotals(itinerary.days);
  itinerary.totalEstimatedCostVnd = total;
  itinerary.hasUnknownCostItems = hasUnknown;
}

function getWorkingDaysForEdit(itinerary: Itinerary): ItineraryDay[] {
  if (itinerary.isDraft) {
    return itinerary.days;
  }
  if (!itinerary.pendingDraftDays) {
    itinerary.pendingDraftDays = JSON.parse(JSON.stringify(itinerary.days)) as ItineraryDay[];
  }
  return itinerary.pendingDraftDays;
}

function toDetailItineraryDto(item: Itinerary): Itinerary {
  const cloned = JSON.parse(JSON.stringify(item)) as Itinerary;
  if (!cloned.isDraft && cloned.pendingDraftDays && cloned.pendingDraftDays.length > 0) {
    const { total, hasUnknown } = computeDaysTotals(cloned.pendingDraftDays);
    cloned.days = cloned.pendingDraftDays;
    cloned.totalEstimatedCostVnd = total;
    cloned.hasUnknownCostItems = hasUnknown;
    cloned.hasUnsavedChanges = true;
  } else {
    cloned.hasUnsavedChanges = false;
  }
  return cloned;
}

function cloneItineraryObj(item: Itinerary): Itinerary {
  const cloned = JSON.parse(JSON.stringify(item)) as Itinerary;
  cloned.pendingDraftDays = null;
  cloned.hasUnsavedChanges = false;
  return cloned;
}

function isTimeValid(hm: string): boolean {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(hm);
}

function timeToMinutes(hm: string): number {
  const [h, m] = hm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function checkDraftNotExpired(itinerary: Itinerary, nowMs: number): void {
  if (itinerary.isDraft && itinerary.draftExpiresAt) {
    if (new Date(itinerary.draftExpiresAt).getTime() <= nowMs) {
      throw new AppError({
        code: 'EXPIRED',
        status: 410,
        message: 'Bản nháp lịch trình này đã hết thời hạn lưu tạm (24 giờ). Vui lòng lập chuyến đi mới.',
      });
    }
  }
}

export async function mockCreateTripRequest(input: TripRequestInput): Promise<TripDraftRequest> {
  await simulateDelay(110);
  return mutateMockDb((db) => {
    assertNetworkAvailable(db);
    requireAuthAccount(db);
    const fieldErrors: Record<string, string> = {};

    if (!input.region.trim()) fieldErrors.region = 'Vui lòng chọn khu vực du lịch.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.startDate)) fieldErrors.startDate = 'Vui lòng chọn ngày bắt đầu hợp lệ.';
    if (!Number.isInteger(input.daysCount) || input.daysCount < 1 || input.daysCount > 14) {
      fieldErrors.daysCount = 'Số ngày phải là số nguyên dương từ 1 đến 14.';
    }
    if (!Number.isInteger(input.partySize) || input.partySize < 1 || input.partySize > 50) {
      fieldErrors.partySize = 'Số khách phải là số nguyên dương từ 1 đến 50.';
    }
    if (typeof input.budgetVnd !== 'number' || Number.isNaN(input.budgetVnd) || input.budgetVnd < 0) {
      fieldErrors.budgetVnd = 'Ngân sách hoạt động toàn đoàn không được là số âm.';
    }

    if (Object.keys(fieldErrors).length > 0) {
      throw new AppError({
        code: 'VALIDATION_ERROR',
        status: 400,
        message: 'Thông tin yêu cầu chuyến đi chưa hợp lệ.',
        fieldErrors,
      });
    }

    const req: TripDraftRequest = {
      ...input,
      id: `REQ${String(db.tripDraftRequests.length + 1).padStart(3, '0')}`,
      endDate: computeEndDateYmd(input.startDate, input.daysCount),
      budgetScopeNote:
        input.budgetScopeNote?.trim() ||
        `Ngân sách áp dụng cho các hoạt động tham quan của toàn đoàn (${input.partySize} khách) trong ${input.daysCount} ngày; không mặc nhiên bao gồm vé máy bay, khách sạn, ăn uống và di chuyển ngoài danh mục.`,
      createdAt: new Date(getMockNowMs()).toISOString(),
    };
    db.tripDraftRequests.push(req);
    return { ...req };
  });
}

export async function mockGetRecommendations(draftRequestId: string): Promise<RecommendationsResponse> {
  await simulateDelay(140);
  const db = loadMockDb();
  assertNetworkAvailable(db);
  const acc = requireAuthAccount(db);

  const req = db.tripDraftRequests.find((r) => r.id === draftRequestId);
  if (!req) {
    throw new AppError({
      code: 'NOT_FOUND',
      status: 404,
      message: 'Không tìm thấy yêu cầu chuyến đi. Vui lòng nhập lại tiêu chí tại bước Lập lịch trình.',
    });
  }

  const publicDests = db.destinations
    .map((d) => hydrateDestination(db, d, acc.profile.id))
    .filter((d) => d.effectivelyPublic);

  // Xếp hạng địa điểm theo khu vực (ưu tiên miền Trung Đà Nẵng - Hội An khi chọn một trong hai) & sở thích
  const scored = publicDests
    .filter((d) => {
      if (req.region === 'Đà Nẵng' || req.region === 'Hội An') {
        return d.region === 'Đà Nẵng' || d.region === 'Hội An';
      }
      return d.region.toLowerCase() === req.region.toLowerCase();
    })
    .map((dest) => {
      const reasons: string[] = [];
      let score = 0;

      if (dest.region === req.region) {
        score += 3;
        reasons.push(`Thuộc khu vực ${req.region}`);
      } else {
        score += 1;
        reasons.push(`Gần khu vực ${req.region}, thuận tiện kết hợp di chuyển`);
      }

      if (req.categoryIds.includes(dest.categoryId)) {
        score += 4;
        reasons.push(`Khớp sở thích ${dest.categoryName}`);
      }

      const groupCost = dest.estimatedCostVnd === null ? null : dest.estimatedCostVnd * req.partySize;
      if (groupCost === 0) {
        score += 2;
        reasons.push('Chi phí tham khảo miễn phí (0đ)');
      } else if (groupCost !== null && groupCost <= req.budgetVnd * 0.4) {
        score += 2;
        reasons.push('Phù hợp ngân sách hoạt động toàn đoàn');
      } else if (groupCost === null) {
        reasons.push('Chi phí thực tế chưa có thông tin giá cố định');
      }

      if (req.pace === 'SLOW' && (dest.categoryId === 'CAT02' || dest.categoryId === 'CAT01')) {
        score += 1;
        reasons.push('Phù hợp nhịp độ Chậm, thư thả');
      }

      return {
        score,
        item: {
          destination: dest,
          matchReasons: reasons.slice(0, 3),
          estimatedGroupCostVnd: groupCost,
        },
      };
    })
    .sort((a, b) => b.score - a.score)
    .map((s) => s.item);

  return {
    request: { ...req },
    recommendations: scored,
  };
}

export async function mockGenerateDraftItinerary(
  draftRequestId: string,
  selectedDestinationIds?: string[],
): Promise<Itinerary> {
  await simulateDelay(320);
  return mutateMockDb((db) => {
    assertNetworkAvailable(db);
    const acc = requireAuthAccount(db);

    if (db.devFlags.simulateAiFailure) {
      throw new AppError({
        code: 'AI_ERROR',
        status: 503,
        message: 'Trợ lý AI tạm thời không phản hồi hoặc đầu ra chưa hợp lệ. Tiêu chí của bạn vẫn được giữ nguyên để thử lại.',
      });
    }

    const req = db.tripDraftRequests.find((r) => r.id === draftRequestId);
    if (!req) {
      throw new AppError({ code: 'NOT_FOUND', status: 404, message: 'Không tìm thấy yêu cầu lập lịch trình.' });
    }

    const pool = db.destinations
      .map((d) => hydrateDestination(db, d, acc.profile.id))
      .filter((d) => d.effectivelyPublic)
      .filter((d) =>
        selectedDestinationIds && selectedDestinationIds.length > 0
          ? selectedDestinationIds.includes(d.id)
          : req.region === 'Đà Nẵng' || req.region === 'Hội An'
            ? d.region === 'Đà Nẵng' || d.region === 'Hội An'
            : d.region === req.region,
      );

    if (pool.length === 0) {
      throw new AppError({
        code: 'VALIDATION_ERROR',
        status: 400,
        message: 'Không có địa điểm phù hợp trong danh mục nội bộ để tạo lịch trình. Vui lòng đổi tiêu chí.',
      });
    }

    const nowMs = getMockNowMs();
    const nowIso = new Date(nowMs).toISOString();
    const activitiesPerDay = req.pace === 'FAST' ? 3 : req.pace === 'MODERATE' ? 2 : 1;
    const slots = [
      { start: '08:30', end: '11:00' },
      { start: '14:30', end: '17:30' },
      { start: '18:30', end: '20:30' },
    ];

    const days: ItineraryDay[] = [];
    let cursor = 0;

    for (let d = 1; d <= req.daysCount; d++) {
      const activities: ItineraryActivity[] = [];
      for (let s = 0; s < activitiesPerDay; s++) {
        const dest = pool[cursor % pool.length]!;
        cursor += 1;
        const slot = slots[s] ?? { start: '09:00', end: '11:30' };
        activities.push({
          id: `ACT_${nowMs}_${d}_${s}`,
          dayNumber: d,
          orderIndex: s,
          type: 'DESTINATION',
          destinationId: dest.id,
          destinationName: dest.name,
          title: `Tham quan ${dest.name}`,
          startTime: slot.start,
          endTime: slot.end,
          estimatedGroupCostVnd: dest.estimatedCostVnd === null ? null : dest.estimatedCostVnd * req.partySize,
          notes: `Gợi ý theo nhịp độ ${PACE_LABELS[req.pace]} tại ${dest.region}. Giờ mở cửa: ${dest.openingHours}.`,
        });
      }
      days.push({
        dayNumber: d,
        date: addDaysYmd(req.startDate, d - 1),
        activities,
      });
    }

    const draftId = `DRAFT${String(db.counters.draft++).padStart(3, '0')}`;
    const draft: Itinerary = {
      id: draftId,
      ownerId: acc.profile.id,
      title: `Hành trình ${req.region} ${req.daysCount} ngày`,
      region: req.region,
      startDate: req.startDate,
      endDate: req.endDate,
      daysCount: req.daysCount,
      partySize: req.partySize,
      budgetVnd: req.budgetVnd,
      budgetScopeNote: req.budgetScopeNote,
      pace: req.pace,
      categoryIds: [...req.categoryIds],
      isDraft: true,
      draftExpiresAt: new Date(nowMs + DRAFT_RULES.ttlHours * 60 * 60 * 1000).toISOString(),
      version: 1,
      days,
      totalEstimatedCostVnd: 0,
      hasUnknownCostItems: false,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    recomputeItineraryTotals(draft);
    db.itineraries.unshift(draft);
    return cloneItineraryObj(draft);
  });
}

export async function mockGetItinerary(id: string): Promise<Itinerary> {
  await simulateDelay(40);
  const db = loadMockDb();
  assertNetworkAvailable(db);
  const acc = requireAuthAccount(db);
  const found = db.itineraries.find((it) => it.id === id);
  if (!found) {
    throw new AppError({ code: 'NOT_FOUND', status: 404, message: 'Không tìm thấy lịch trình yêu cầu.' });
  }
  if (found.ownerId !== acc.profile.id) {
    throw new AppError({
      code: 'FORBIDDEN',
      status: 403,
      message: 'Bạn không có quyền xem lịch trình của tài khoản khác.',
    });
  }
  return toDetailItineraryDto(found);
}

export async function mockListMyItineraries(params: ItineraryListParams = {}): Promise<PaginatedItineraries> {
  await simulateDelay(80);
  const db = loadMockDb();
  assertNetworkAvailable(db);
  const acc = requireAuthAccount(db);
  const q = (params.query ?? '').trim().toLowerCase();

  // Chỉ hiển thị lịch trình ĐÃ LƯU của chủ tài khoản (không đưa bản nháp hết hạn vào như lịch trình đã lưu)
  let items = db.itineraries
    .filter((it) => it.ownerId === acc.profile.id && !it.isDraft)
    .map(cloneItineraryObj);

  if (q) {
    items = items.filter(
      (it) =>
        it.title.toLowerCase().includes(q) ||
        it.region.toLowerCase().includes(q) ||
        it.id.toLowerCase().includes(q),
    );
  }

  items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.max(1, params.pageSize ?? 8);
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (Math.min(page, totalPages) - 1) * pageSize;

  return {
    items: items.slice(start, start + pageSize),
    total,
    page: Math.min(page, totalPages),
    pageSize,
    totalPages,
  };
}

export async function mockUpsertItineraryActivity(
  itineraryId: string,
  input: UpsertActivityInput,
  expectedVersion: number,
): Promise<Itinerary> {
  await simulateDelay(120);
  return mutateMockDb((db) => {
    assertNetworkAvailable(db);
    const acc = requireAuthAccount(db);
    const it = db.itineraries.find((item) => item.id === itineraryId);
    if (!it) throw new AppError({ code: 'NOT_FOUND', status: 404, message: 'Không tìm thấy lịch trình.' });
    if (it.ownerId !== acc.profile.id) {
      throw new AppError({ code: 'FORBIDDEN', status: 403, message: 'Bạn không có quyền chỉnh sửa lịch trình này.' });
    }
    checkDraftNotExpired(it, getMockNowMs());

    if (it.version !== expectedVersion) {
      throw new AppError({
        code: 'CONFLICT',
        status: 409,
        message: 'Lịch trình đã thay đổi ở phiên khác (xung đột phiên bản). Vui lòng tải lại để tránh ghi đè.',
      });
    }

    const fieldErrors: Record<string, string> = {};
    if (!input.title.trim()) fieldErrors.title = 'Vui lòng nhập tiêu đề hoạt động.';
    if (!isTimeValid(input.startTime)) fieldErrors.startTime = 'Giờ bắt đầu phải theo định dạng HH:mm (24 giờ).';
    if (!isTimeValid(input.endTime)) fieldErrors.endTime = 'Giờ kết thúc phải theo định dạng HH:mm (24 giờ).';
    if (isTimeValid(input.startTime) && isTimeValid(input.endTime)) {
      if (timeToMinutes(input.endTime) <= timeToMinutes(input.startTime)) {
        fieldErrors.endTime = 'Giờ kết thúc phải sau giờ bắt đầu.';
      }
    }
    if (input.estimatedGroupCostVnd !== null && input.estimatedGroupCostVnd < 0) {
      fieldErrors.estimatedGroupCostVnd = 'Chi phí tham khảo không được âm.';
    }

    let destName: string | null = null;
    if (input.type === 'DESTINATION') {
      const dest = db.destinations.find((d) => d.id === input.destinationId);
      if (!dest) {
        fieldErrors.destinationId = 'Vui lòng chọn địa điểm hợp lệ từ danh mục nội bộ.';
      } else {
        destName = dest.name;
      }
    }

    if (Object.keys(fieldErrors).length > 0) {
      throw new AppError({
        code: 'VALIDATION_ERROR',
        status: 400,
        message: 'Thông tin hoạt động chưa hợp lệ.',
        fieldErrors,
      });
    }

    const workingDays = getWorkingDaysForEdit(it);
    const day = workingDays.find((d) => d.dayNumber === input.dayNumber);
    if (!day) {
      throw new AppError({ code: 'VALIDATION_ERROR', status: 400, message: 'Ngày được chọn không tồn tại trong lịch trình.' });
    }

    // Kiểm tra chồng giờ trong cùng một ngày
    const newStart = timeToMinutes(input.startTime);
    const newEnd = timeToMinutes(input.endTime);
    const overlap = day.activities.find((other) => {
      if (input.id && other.id === input.id) return false;
      const os = timeToMinutes(other.startTime);
      const oe = timeToMinutes(other.endTime);
      return newStart < oe && newEnd > os;
    });
    if (overlap) {
      throw new AppError({
        code: 'VALIDATION_ERROR',
        status: 400,
        message: `Khung giờ bị chồng chéo với hoạt động "${overlap.title}" (${overlap.startTime} – ${overlap.endTime}).`,
        fieldErrors: {
          startTime: `Trùng khung giờ với "${overlap.title}" (${overlap.startTime} – ${overlap.endTime}).`,
        },
      });
    }

    if (input.id) {
      const existing = day.activities.find((a) => a.id === input.id);
      if (!existing) {
        throw new AppError({ code: 'NOT_FOUND', status: 404, message: 'Không tìm thấy hoạt động cần chỉnh sửa.' });
      }
      existing.type = input.type;
      existing.destinationId = input.type === 'DESTINATION' ? input.destinationId : null;
      existing.destinationName = destName;
      existing.title = input.title.trim();
      existing.startTime = input.startTime;
      existing.endTime = input.endTime;
      existing.estimatedGroupCostVnd = input.estimatedGroupCostVnd;
      existing.notes = input.notes.trim();
    } else {
      day.activities.push({
        id: `ACT_${getMockNowMs()}_${Math.floor(Math.random() * 1000)}`,
        dayNumber: input.dayNumber,
        orderIndex: day.activities.length,
        type: input.type,
        destinationId: input.type === 'DESTINATION' ? input.destinationId : null,
        destinationName: destName,
        title: input.title.trim(),
        startTime: input.startTime,
        endTime: input.endTime,
        estimatedGroupCostVnd: input.estimatedGroupCostVnd,
        notes: input.notes.trim(),
      });
    }

    computeDaysTotals(workingDays);
    if (it.isDraft) {
      recomputeItineraryTotals(it);
      it.updatedAt = new Date(getMockNowMs()).toISOString();
    } else {
      it.hasUnsavedChanges = true;
    }
    it.version += 1;
    return toDetailItineraryDto(it);
  });
}

export async function mockReorderOrDeleteActivity(
  itineraryId: string,
  dayNumber: number,
  activityId: string,
  action: 'MOVE_UP' | 'MOVE_DOWN' | 'DELETE',
  expectedVersion: number,
): Promise<Itinerary> {
  await simulateDelay(50);
  return mutateMockDb((db) => {
    assertNetworkAvailable(db);
    const acc = requireAuthAccount(db);
    const it = db.itineraries.find((item) => item.id === itineraryId);
    if (!it) throw new AppError({ code: 'NOT_FOUND', status: 404, message: 'Không tìm thấy lịch trình.' });
    if (it.ownerId !== acc.profile.id) {
      throw new AppError({ code: 'FORBIDDEN', status: 403, message: 'Không có quyền sửa lịch trình này.' });
    }
    checkDraftNotExpired(it, getMockNowMs());
    if (it.version !== expectedVersion) {
      throw new AppError({
        code: 'CONFLICT',
        status: 409,
        message: 'Phiên bản lịch trình đã thay đổi. Vui lòng tải lại trước khi tiếp tục.',
      });
    }

    const workingDays = getWorkingDaysForEdit(it);
    const day = workingDays.find((d) => d.dayNumber === dayNumber);
    if (!day) throw new AppError({ code: 'NOT_FOUND', status: 404, message: 'Không tìm thấy ngày.' });
    const idx = day.activities.findIndex((a) => a.id === activityId);
    if (idx === -1) throw new AppError({ code: 'NOT_FOUND', status: 404, message: 'Không tìm thấy hoạt động.' });

    if (action === 'DELETE') {
      day.activities.splice(idx, 1);
    } else if (action === 'MOVE_UP' && idx > 0) {
      const prev = day.activities[idx - 1]!;
      const curr = day.activities[idx]!;
      day.activities[idx - 1] = curr;
      day.activities[idx] = prev;
    } else if (action === 'MOVE_DOWN' && idx < day.activities.length - 1) {
      const next = day.activities[idx + 1]!;
      const curr = day.activities[idx]!;
      day.activities[idx + 1] = curr;
      day.activities[idx] = next;
    }

    day.activities.forEach((a, i) => {
      a.orderIndex = i;
    });
    computeDaysTotals(workingDays);
    if (it.isDraft) {
      recomputeItineraryTotals(it);
      it.updatedAt = new Date(getMockNowMs()).toISOString();
    } else {
      it.hasUnsavedChanges = true;
    }
    it.version += 1;
    return toDetailItineraryDto(it);
  });
}

export async function mockPreviewRegenerateDay(
  itineraryId: string,
  dayNumber: number,
  prompt: string,
): Promise<RegenerateDayPreview> {
  await simulateDelay(260);
  const db = loadMockDb();
  assertNetworkAvailable(db);
  const acc = requireAuthAccount(db);

  if (db.devFlags.simulateAiFailure) {
    throw new AppError({
      code: 'AI_ERROR',
      status: 503,
      message: 'AI không thể tái tạo gợi ý lúc này. Lịch trình hiện tại của bạn vẫn được giữ nguyên.',
    });
  }

  const it = db.itineraries.find((item) => item.id === itineraryId);
  if (!it) throw new AppError({ code: 'NOT_FOUND', status: 404, message: 'Không tìm thấy lịch trình.' });
  if (it.ownerId !== acc.profile.id) {
    throw new AppError({ code: 'FORBIDDEN', status: 403, message: 'Không có quyền thao tác lịch trình này.' });
  }
  checkDraftNotExpired(it, getMockNowMs());

  const sourceDays = !it.isDraft && it.pendingDraftDays ? it.pendingDraftDays : it.days;
  const day = sourceDays.find((d) => d.dayNumber === dayNumber);
  if (!day) throw new AppError({ code: 'NOT_FOUND', status: 404, message: 'Không tìm thấy ngày cần tái tạo.' });

  const trimmed = prompt.trim();
  if (trimmed.length < 3) {
    throw new AppError({
      code: 'VALIDATION_ERROR',
      status: 400,
      message: 'Vui lòng mô tả mong muốn điều chỉnh ít nhất 3 ký tự.',
      fieldErrors: { prompt: 'Vui lòng nhập yêu cầu điều chỉnh.' },
    });
  }

  const publicDests = db.destinations
    .map((d) => hydrateDestination(db, d, acc.profile.id))
    .filter((d) => d.effectivelyPublic);

  const lower = trimmed.toLowerCase();
  const preferBeach = lower.includes('biển') || lower.includes('nhẹ') || lower.includes('mỹ khê');
  const preferCulture = lower.includes('văn hóa') || lower.includes('bảo tàng') || lower.includes('phố cổ');

  const firstPick =
    (preferBeach ? publicDests.find((d) => d.id === 'DN001') : undefined) ??
    (preferCulture ? publicDests.find((d) => d.id === 'DN004') : undefined) ??
    publicDests.find((d) => !day.activities.some((a) => a.destinationId === d.id)) ??
    publicDests[0]!;

  const secondPick =
    publicDests.find((d) => d.id !== firstPick.id && d.id !== day.activities[0]?.destinationId) ??
    publicDests[1] ??
    firstPick;

  const afterActivities: ItineraryActivity[] = [
    {
      id: `PREVIEW_${getMockNowMs()}_1`,
      dayNumber,
      orderIndex: 0,
      type: 'DESTINATION',
      destinationId: firstPick.id,
      destinationName: firstPick.name,
      title: `Trải nghiệm ${firstPick.name}`,
      startTime: '08:00',
      endTime: '10:30',
      estimatedGroupCostVnd: firstPick.estimatedCostVnd === null ? null : firstPick.estimatedCostVnd * it.partySize,
      notes: `Điều chỉnh theo yêu cầu: "${trimmed}".`,
    },
    {
      id: `PREVIEW_${getMockNowMs()}_2`,
      dayNumber,
      orderIndex: 1,
      type: 'DESTINATION',
      destinationId: secondPick.id,
      destinationName: secondPick.name,
      title: `Tham quan ${secondPick.name}`,
      startTime: '15:00',
      endTime: '18:00',
      estimatedGroupCostVnd: secondPick.estimatedCostVnd === null ? null : secondPick.estimatedCostVnd * it.partySize,
      notes: `Gợi ý kết hợp thuận tuyến cho Ngày ${dayNumber}.`,
    },
  ];

  const beforeTotalVnd = day.activities.reduce((s, a) => s + (a.estimatedGroupCostVnd ?? 0), 0);
  const afterTotalVnd = afterActivities.reduce((s, a) => s + (a.estimatedGroupCostVnd ?? 0), 0);

  return {
    itineraryId: it.id,
    dayNumber,
    date: day.date,
    prompt: trimmed,
    beforeActivities: JSON.parse(JSON.stringify(day.activities)) as ItineraryActivity[],
    afterActivities,
    beforeTotalVnd,
    afterTotalVnd,
    disclaimer:
      'Đây là gợi ý do AI tạo cho riêng ngày đang chọn. Các ngày khác giữ nguyên; chỉ khi bấm "Áp dụng vào bản nháp" thay đổi mới được đưa vào kế hoạch và cần bấm "Lưu lịch trình" để lưu chính thức.',
  };
}

export async function mockApplyRegeneratedDay(
  itineraryId: string,
  dayNumber: number,
  activities: ItineraryActivity[],
  expectedVersion: number,
): Promise<Itinerary> {
  await simulateDelay(120);
  return mutateMockDb((db) => {
    assertNetworkAvailable(db);
    const acc = requireAuthAccount(db);
    const it = db.itineraries.find((item) => item.id === itineraryId);
    if (!it) throw new AppError({ code: 'NOT_FOUND', status: 404, message: 'Không tìm thấy lịch trình.' });
    if (it.ownerId !== acc.profile.id) {
      throw new AppError({ code: 'FORBIDDEN', status: 403, message: 'Không có quyền áp dụng vào lịch trình này.' });
    }
    checkDraftNotExpired(it, getMockNowMs());
    if (it.version !== expectedVersion) {
      throw new AppError({
        code: 'CONFLICT',
        status: 409,
        message: 'Lịch trình đã thay đổi trên hệ thống. Vui lòng tải lại trước khi áp dụng gợi ý AI.',
      });
    }

    const workingDays = getWorkingDaysForEdit(it);
    const day = workingDays.find((d) => d.dayNumber === dayNumber);
    if (!day) throw new AppError({ code: 'NOT_FOUND', status: 404, message: 'Không tìm thấy ngày.' });

    // Chỉ thay thế đúng ngày được chọn trong bản nháp làm việc; các ngày khác và bản đã lưu chính thức giữ nguyên
    day.activities = activities.map((act, idx) => ({
      ...act,
      id: `ACT_${getMockNowMs()}_${dayNumber}_${idx}`,
      dayNumber,
      orderIndex: idx,
    }));

    computeDaysTotals(workingDays);
    if (it.isDraft) {
      recomputeItineraryTotals(it);
      it.updatedAt = new Date(getMockNowMs()).toISOString();
    } else {
      it.hasUnsavedChanges = true;
    }
    it.version += 1;
    return toDetailItineraryDto(it);
  });
}

export async function mockSaveItinerary(
  itineraryId: string,
  expectedVersion: number,
  title?: string,
): Promise<Itinerary> {
  await simulateDelay(80);
  return mutateMockDb((db) => {
    assertNetworkAvailable(db);
    const acc = requireAuthAccount(db);
    const it = db.itineraries.find((item) => item.id === itineraryId);
    if (!it) throw new AppError({ code: 'NOT_FOUND', status: 404, message: 'Không tìm thấy lịch trình.' });
    if (it.ownerId !== acc.profile.id) {
      throw new AppError({ code: 'FORBIDDEN', status: 403, message: 'Không có quyền lưu lịch trình này.' });
    }
    checkDraftNotExpired(it, getMockNowMs());
    if (it.version !== expectedVersion) {
      throw new AppError({
        code: 'CONFLICT',
        status: 409,
        message: 'Phiên bản lịch trình đã thay đổi. Vui lòng tải lại bản mới nhất trước khi lưu.',
      });
    }

    const nowIso = new Date(getMockNowMs()).toISOString();
    if (title && title.trim()) {
      it.title = title.trim();
    }

    if (!it.isDraft && it.pendingDraftDays) {
      it.days = JSON.parse(JSON.stringify(it.pendingDraftDays)) as ItineraryDay[];
      it.pendingDraftDays = null;
      it.hasUnsavedChanges = false;
    }

    if (it.isDraft) {
      const savedId = `LT${String(db.counters.itinerary++).padStart(3, '0')}`;
      const oldId = it.id;
      it.id = savedId;
      it.isDraft = false;
      it.draftExpiresAt = null;
      it.pendingDraftDays = null;
      it.hasUnsavedChanges = false;
      // Cập nhật liên kết hội thoại nếu đang gắn bản nháp
      for (const conv of db.conversations) {
        if (conv.itineraryId === oldId) {
          conv.itineraryId = savedId;
          conv.itineraryIsDraft = false;
          conv.itineraryTitle = it.title;
        }
      }
    }

    it.version += 1;
    it.updatedAt = nowIso;
    recomputeItineraryTotals(it);
    return toDetailItineraryDto(it);
  });
}

export async function mockDiscardItineraryChanges(itineraryId: string): Promise<Itinerary> {
  await simulateDelay(50);
  return mutateMockDb((db) => {
    assertNetworkAvailable(db);
    const acc = requireAuthAccount(db);
    const it = db.itineraries.find((item) => item.id === itineraryId);
    if (!it) throw new AppError({ code: 'NOT_FOUND', status: 404, message: 'Không tìm thấy lịch trình.' });
    if (it.ownerId !== acc.profile.id) {
      throw new AppError({ code: 'FORBIDDEN', status: 403, message: 'Không có quyền thao tác lịch trình này.' });
    }
    it.pendingDraftDays = null;
    it.hasUnsavedChanges = false;
    it.version += 1;
    return toDetailItineraryDto(it);
  });
}

export async function mockCloneItinerary(itineraryId: string, req: CloneItineraryRequest): Promise<Itinerary> {
  await simulateDelay(140);
  return mutateMockDb((db) => {
    assertNetworkAvailable(db);
    const acc = requireAuthAccount(db);
    const source = db.itineraries.find((item) => item.id === itineraryId);
    if (!source) throw new AppError({ code: 'NOT_FOUND', status: 404, message: 'Không tìm thấy lịch trình gốc.' });
    if (source.ownerId !== acc.profile.id) {
      throw new AppError({ code: 'FORBIDDEN', status: 403, message: 'Bạn không có quyền sao chép lịch trình này.' });
    }

    const newTitle = req.title.trim();
    const fieldErrors: Record<string, string> = {};
    if (newTitle.length < 2 || newTitle.length > 150) {
      fieldErrors.title = 'Tên lịch trình mới phải từ 2 đến 150 ký tự.';
    }
    if (req.newStartDate && !/^\d{4}-\d{2}-\d{2}$/.test(req.newStartDate)) {
      fieldErrors.newStartDate = 'Ngày bắt đầu mới không đúng định dạng.';
    }
    if (Object.keys(fieldErrors).length > 0) {
      throw new AppError({
        code: 'VALIDATION_ERROR',
        status: 400,
        message: 'Thông tin sao chép chưa hợp lệ.',
        fieldErrors,
      });
    }

    const nowIso = new Date(getMockNowMs()).toISOString();
    const startDate = req.newStartDate || source.startDate;
    const endDate = computeEndDateYmd(startDate, source.daysCount);
    const cloned = cloneItineraryObj(source);
    cloned.id = `LT${String(db.counters.itinerary++).padStart(3, '0')}`;
    cloned.title = newTitle;
    cloned.startDate = startDate;
    cloned.endDate = endDate;
    cloned.isDraft = false;
    cloned.draftExpiresAt = null;
    cloned.version = 1;
    cloned.createdAt = nowIso;
    cloned.updatedAt = nowIso;
    cloned.days.forEach((d, idx) => {
      d.date = addDaysYmd(startDate, idx);
      d.activities.forEach((a, ai) => {
        a.id = `ACT_${getMockNowMs()}_C_${idx}_${ai}`;
      });
    });

    db.itineraries.unshift(cloned);
    return cloneItineraryObj(cloned);
  });
}

export async function mockDeleteItinerary(itineraryId: string): Promise<void> {
  await simulateDelay(120);
  mutateMockDb((db) => {
    assertNetworkAvailable(db);
    const acc = requireAuthAccount(db);
    const idx = db.itineraries.findIndex((item) => item.id === itineraryId);
    if (idx === -1) {
      throw new AppError({ code: 'NOT_FOUND', status: 404, message: 'Lịch trình không tồn tại hoặc đã bị xóa.' });
    }
    const target = db.itineraries[idx]!;
    if (target.ownerId !== acc.profile.id) {
      throw new AppError({ code: 'FORBIDDEN', status: 403, message: 'Bạn không có quyền xóa lịch trình này.' });
    }

    db.itineraries.splice(idx, 1);

    // Xóa lịch trình KHÔNG xóa hội thoại AI hay booking; chỉ bỏ liên kết hội thoại
    for (const conv of db.conversations) {
      if (conv.itineraryId === itineraryId) {
        conv.itineraryId = null;
        conv.itineraryTitle = null;
        conv.itineraryLinked = false;
      }
    }
  });
}

// ===== CHAT AI =====

export async function mockListConversations(): Promise<ChatConversation[]> {
  await simulateDelay(80);
  const db = loadMockDb();
  assertNetworkAvailable(db);
  const acc = requireAuthAccount(db);
  return db.conversations
    .filter((c) => c.ownerId === acc.profile.id)
    .map((c) => JSON.parse(JSON.stringify(c)) as ChatConversation)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function mockCreateConversation(itineraryId?: string | null): Promise<ChatConversation> {
  await simulateDelay(90);
  return mutateMockDb((db) => {
    assertNetworkAvailable(db);
    const acc = requireAuthAccount(db);
    let linkedItinerary: Itinerary | undefined;
    if (itineraryId) {
      linkedItinerary = db.itineraries.find((it) => it.id === itineraryId && it.ownerId === acc.profile.id);
      if (linkedItinerary) {
        // Nếu đã có hội thoại liên kết lịch trình này, tái sử dụng để giữ ngữ cảnh liền mạch
        const existing = db.conversations.find(
          (c) => c.ownerId === acc.profile.id && c.itineraryId === linkedItinerary!.id,
        );
        if (existing) return JSON.parse(JSON.stringify(existing)) as ChatConversation;
      }
    }

    const nowIso = new Date(getMockNowMs()).toISOString();
    const conv: ChatConversation = {
      id: `CONV${String(db.counters.conversation++).padStart(3, '0')}`,
      ownerId: acc.profile.id,
      title: linkedItinerary ? `${linkedItinerary.title} (${linkedItinerary.id})` : 'Hội thoại du lịch mới',
      itineraryId: linkedItinerary?.id ?? null,
      itineraryTitle: linkedItinerary?.title ?? null,
      itineraryIsDraft: linkedItinerary?.isDraft,
      itineraryLinked: Boolean(linkedItinerary),
      messages: [],
      updatedAt: nowIso,
    };
    db.conversations.unshift(conv);
    return JSON.parse(JSON.stringify(conv)) as ChatConversation;
  });
}

function buildAiReply(question: string, itinerary?: Itinerary): string {
  const q = question.toLowerCase();
  const contextLead = itinerary
    ? `Dựa trên ngữ cảnh chuyến "${itinerary.title}" (${itinerary.daysCount} ngày, ${itinerary.partySize} khách): `
    : 'Theo dữ liệu danh mục nội bộ TripLoom: ';

  if (q.includes('ngân sách') || q.includes('chi phí') || q.includes('giá')) {
    return `${contextLead}Chi phí tham khảo hiện tại gồm Mỹ Khê (0đ), Ngũ Hành Sơn (40.000đ/người), Làng gốm Thanh Hà (35.000đ/người), Bảo tàng Chăm (60.000đ/người) và Phố cổ Hội An (150.000đ/người). Lưu ý ngân sách hoạt động không mặc nhiên gồm vé máy bay và khách sạn.`;
  }
  if (q.includes('đèn lồng') || q.includes('dịch vụ') || q.includes('đặt')) {
    return `${contextLead}Bạn có thể xem dịch vụ "Trải nghiệm làm đèn lồng tại Hội An" (150.000đ/người, sức chứa tối đa 20 khách/ngày) tại trang Chi tiết địa điểm Phố cổ Hội An. Lưu ý việc đặt dịch vụ thực hiện riêng tại mục Đặt dịch vụ.`;
  }
  return `${contextLead}Bạn nên nhóm các điểm gần nhau trong cùng buổi (ví dụ sáng tham quan Ngũ Hành Sơn hoặc Bán đảo Sơn Trà, chiều di chuyển về Làng gốm Thanh Hà và Phố cổ Hội An lúc 16:30 để tiết kiệm thời gian di chuyển).`;
}

export async function mockSendChatMessage(
  conversationId: string,
  content: string,
): Promise<ChatConversation> {
  await simulateDelay(240);
  return mutateMockDb((db) => {
    assertNetworkAvailable(db);
    const acc = requireAuthAccount(db);
    const conv = db.conversations.find((c) => c.id === conversationId);
    if (!conv) throw new AppError({ code: 'NOT_FOUND', status: 404, message: 'Không tìm thấy phiên hội thoại.' });
    if (conv.ownerId !== acc.profile.id) {
      throw new AppError({ code: 'FORBIDDEN', status: 403, message: 'Bạn không có quyền truy cập hội thoại này.' });
    }

    const trimmed = content.trim();
    if (!trimmed || trimmed.length > 2000) {
      throw new AppError({
        code: 'VALIDATION_ERROR',
        status: 400,
        message: 'Câu hỏi phải từ 1 đến 2.000 ký tự.',
        fieldErrors: { message: 'Vui lòng nhập câu hỏi hợp lệ (tối đa 2.000 ký tự).' },
      });
    }

    const nowIso = new Date(getMockNowMs()).toISOString();
    const userMsg: ChatMessage = {
      id: `MSG_${getMockNowMs()}_U`,
      conversationId: conv.id,
      sender: 'USER',
      content: trimmed,
      status: 'SENT',
      createdAt: nowIso,
    };
    conv.messages.push(userMsg);
    conv.updatedAt = nowIso;

    if (db.devFlags.simulateAiFailure) {
      userMsg.status = 'ERROR';
      userMsg.errorMessage = 'Trợ lý AI gặp sự cố khi trả lời. Bấm "Thử lại" để gửi lại mà không nhân đôi câu hỏi.';
      return JSON.parse(JSON.stringify(conv)) as ChatConversation;
    }

    const linked = conv.itineraryId ? db.itineraries.find((i) => i.id === conv.itineraryId) : undefined;
    conv.messages.push({
      id: `MSG_${getMockNowMs() + 1}_A`,
      conversationId: conv.id,
      sender: 'AI',
      content: buildAiReply(trimmed, linked),
      status: 'SENT',
      createdAt: new Date(getMockNowMs() + 500).toISOString(),
    });

    return JSON.parse(JSON.stringify(conv)) as ChatConversation;
  });
}

export async function mockRetryChatMessage(
  conversationId: string,
  failedUserMessageId: string,
): Promise<ChatConversation> {
  await simulateDelay(220);
  return mutateMockDb((db) => {
    assertNetworkAvailable(db);
    const acc = requireAuthAccount(db);
    const conv = db.conversations.find((c) => c.id === conversationId);
    if (!conv) throw new AppError({ code: 'NOT_FOUND', status: 404, message: 'Không tìm thấy phiên hội thoại.' });
    if (conv.ownerId !== acc.profile.id) {
      throw new AppError({ code: 'FORBIDDEN', status: 403, message: 'Không có quyền thao tác hội thoại này.' });
    }

    const msg = conv.messages.find((m) => m.id === failedUserMessageId && m.sender === 'USER');
    if (!msg) {
      throw new AppError({ code: 'NOT_FOUND', status: 404, message: 'Không tìm thấy tin nhắn cần thử lại.' });
    }

    // Thử lại KHÔNG nhân đôi tin nhắn người dùng!
    if (db.devFlags.simulateAiFailure) {
      msg.status = 'ERROR';
      msg.errorMessage = 'AI vẫn đang gặp lỗi phản hồi. Vui lòng thử lại sau.';
      return JSON.parse(JSON.stringify(conv)) as ChatConversation;
    }

    msg.status = 'SENT';
    msg.errorMessage = undefined;
    const linked = conv.itineraryId ? db.itineraries.find((i) => i.id === conv.itineraryId) : undefined;
    conv.messages.push({
      id: `MSG_${getMockNowMs() + 1}_A`,
      conversationId: conv.id,
      sender: 'AI',
      content: buildAiReply(msg.content, linked),
      status: 'SENT',
      createdAt: new Date(getMockNowMs()).toISOString(),
    });
    conv.updatedAt = new Date(getMockNowMs()).toISOString();

    return JSON.parse(JSON.stringify(conv)) as ChatConversation;
  });
}
