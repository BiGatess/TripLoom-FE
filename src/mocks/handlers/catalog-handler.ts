import { AppError } from '@/api/errors';
import type {
  ActiveStatus,
  Category,
  Destination,
  DestinationDetailResponse,
  DestinationFilterParams,
  ModerateReviewRequest,
  PaginatedCategories,
  PaginatedDestinations,
  PaginatedReviews,
  PaginatedServices,
  Review,
  ReviewFilterParams,
  ServiceAvailability,
  ServiceFilterParams,
  TravelService,
  UpsertCategoryRequest,
  UpsertDestinationRequest,
  UpsertReviewRequest,
  UpsertServiceRequest,
} from '@/api/contracts';
import type { MockDatabase } from '@/mocks/fixtures/seed-data';
import { getMockNowMs, loadMockDb, mutateMockDb, simulateDelay } from '@/mocks/storage/mock-db';
import {
  assertNetworkAvailable,
  getActiveAccount,
  requireAdminAccount,
  requireAuthAccount,
  requireBackofficePermission,
} from './auth-handler';
import { validateReason } from '@/shared/utils/validation';

function paginate<T>(items: T[], page = 1, pageSize = 8) {
  const safeSize = Math.max(1, pageSize);
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / safeSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * safeSize;
  return {
    items: items.slice(start, start + safeSize),
    total,
    page: safePage,
    pageSize: safeSize,
    totalPages,
  };
}

export function hydrateDestination(db: MockDatabase, dest: Destination, userId?: string | null): Destination {
  const cat = db.categories.find((c) => c.id === dest.categoryId);
  const categoryHidden = cat ? cat.status !== 'ACTIVE' : true;
  const effectivelyPublic = dest.status === 'ACTIVE' && !categoryHidden;
  const publishedReviews = db.reviews.filter((r) => r.destinationId === dest.id && r.status === 'PUBLISHED');
  const avg =
    publishedReviews.length > 0
      ? Number((publishedReviews.reduce((acc, r) => acc + r.rating, 0) / publishedReviews.length).toFixed(1))
      : null;
  const favs = userId ? (db.favoritesByUser[userId] ?? []) : [];

  return {
    ...dest,
    categoryName: cat?.name ?? dest.categoryName,
    categoryHidden,
    effectivelyPublic,
    averageRating: avg,
    publishedReviewCount: publishedReviews.length,
    isFavorite: favs.includes(dest.id),
  };
}

export function hydrateService(db: MockDatabase, svc: TravelService): TravelService {
  const dest = db.destinations.find((d) => d.id === svc.destinationId);
  const cat = dest ? db.categories.find((c) => c.id === dest.categoryId) : undefined;
  const destinationHidden = !dest || dest.status !== 'ACTIVE';
  const categoryHidden = !cat || cat.status !== 'ACTIVE';
  const effectivelyBookable = svc.status === 'ACTIVE' && !destinationHidden && !categoryHidden;

  return {
    ...svc,
    destinationName: dest?.name ?? svc.destinationName,
    destinationHidden,
    categoryHidden,
    effectivelyBookable,
  };
}

export async function mockListCategories(params?: {
  query?: string;
  includeHidden?: boolean;
  page?: number;
  pageSize?: number;
}): Promise<PaginatedCategories> {
  await simulateDelay(70);
  const db = loadMockDb();
  assertNetworkAvailable(db);
  const q = (params?.query ?? '').trim().toLowerCase();
  const list = db.categories
    .map((c) => ({
      ...c,
      destinationCount: db.destinations.filter((d) => d.categoryId === c.id).length,
    }))
    .filter((c) => (params?.includeHidden ? true : c.status === 'ACTIVE'))
    .filter((c) => (!q ? true : c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q)));

  return paginate(list, params?.page ?? 1, params?.pageSize ?? 20);
}

export async function mockUpsertCategory(id: string | null, req: UpsertCategoryRequest): Promise<Category> {
  await simulateDelay(130);
  return mutateMockDb((db) => {
    assertNetworkAvailable(db);
    const admin = requireAdminAccount(db);
    const name = req.name.trim();
    const description = req.description.trim();
    const fieldErrors: Record<string, string> = {};
    if (name.length < 2 || name.length > 80) {
      fieldErrors.name = 'Tên danh mục phải từ 2 đến 80 ký tự.';
    }
    if (description.length < 5 || description.length > 400) {
      fieldErrors.description = 'Mô tả danh mục phải từ 5 đến 400 ký tự.';
    }
    if (Object.keys(fieldErrors).length > 0) {
      throw new AppError({
        code: 'VALIDATION_ERROR',
        status: 400,
        message: 'Thông tin danh mục chưa hợp lệ.',
        fieldErrors,
      });
    }

    const dup = db.categories.find((c) => c.name.toLowerCase() === name.toLowerCase() && c.id !== id);
    if (dup) {
      throw new AppError({
        code: 'CONFLICT',
        status: 409,
        message: 'Tên danh mục đã tồn tại.',
        fieldErrors: { name: 'Tên danh mục này đã được sử dụng.' },
      });
    }

    const nowIso = new Date(getMockNowMs()).toISOString();
    if (!id) {
      const newCat: Category = {
        id: `CAT${String(db.counters.category++).padStart(2, '0')}`,
        slug: name
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, ''),
        name,
        description,
        status: req.status,
        destinationCount: 0,
        updatedAt: nowIso,
      };
      db.categories.push(newCat);
      db.auditLogs.unshift({
        id: `LOG${String(db.counters.audit++).padStart(3, '0')}`,
        timestamp: nowIso,
        actorId: admin.profile.id,
        actorName: admin.profile.fullName,
        targetType: 'CATALOG',
        targetId: newCat.id,
        targetLabel: `Danh mục ${newCat.name}`,
        action: 'CATEGORY_CREATED',
        actionLabel: 'Thêm danh mục du lịch',
        reason: 'Bổ sung danh mục mới vào hệ thống.',
        beforeSummary: { 'Trạng thái': 'Chưa tồn tại' },
        afterSummary: { 'Tên danh mục': newCat.name, 'Trạng thái': newCat.status === 'ACTIVE' ? 'Đang hoạt động' : 'Đã ẩn' },
      });
      return { ...newCat };
    }

    const existing = db.categories.find((c) => c.id === id);
    if (!existing) {
      throw new AppError({ code: 'NOT_FOUND', status: 404, message: 'Không tìm thấy danh mục cần cập nhật.' });
    }
    const prevName = existing.name;
    const prevStatus = existing.status;
    existing.name = name;
    existing.description = description;
    existing.status = req.status;
    existing.updatedAt = nowIso;

    db.auditLogs.unshift({
      id: `LOG${String(db.counters.audit++).padStart(3, '0')}`,
      timestamp: nowIso,
      actorId: admin.profile.id,
      actorName: admin.profile.fullName,
      targetType: 'CATALOG',
      targetId: existing.id,
      targetLabel: `Danh mục ${existing.name}`,
      action: 'CATEGORY_UPDATED',
      actionLabel: 'Cập nhật danh mục du lịch',
      reason: prevStatus !== req.status ? 'Thay đổi trạng thái hiển thị danh mục.' : 'Cập nhật thông tin danh mục.',
      beforeSummary: { 'Tên danh mục': prevName, 'Trạng thái': prevStatus === 'ACTIVE' ? 'Đang hoạt động' : 'Đã ẩn' },
      afterSummary: { 'Tên danh mục': existing.name, 'Trạng thái': existing.status === 'ACTIVE' ? 'Đang hoạt động' : 'Đã ẩn' },
    });

    return {
      ...existing,
      destinationCount: db.destinations.filter((d) => d.categoryId === existing.id).length,
    };
  });
}

export async function mockListDestinations(params: DestinationFilterParams = {}): Promise<PaginatedDestinations> {
  await simulateDelay(90);
  const db = loadMockDb();
  assertNetworkAvailable(db);
  const currentUser = getActiveAccount(db);
  const q = (params.query ?? '').trim().toLowerCase();

  let items = db.destinations.map((d) => hydrateDestination(db, d, currentUser?.profile.id));

  if (!params.includeHidden) {
    items = items.filter((d) => d.effectivelyPublic);
  } else if (params.status && params.status !== 'ALL') {
    items = items.filter((d) => d.status === params.status);
  }

  if (q) {
    items = items.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.region.toLowerCase().includes(q) ||
        d.id.toLowerCase().includes(q) ||
        d.description.toLowerCase().includes(q),
    );
  }

  if (params.region && params.region !== 'ALL') {
    const reg = params.region.toLowerCase();
    items = items.filter(
      (d) =>
        d.region.toLowerCase() === reg ||
        d.region
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-') === reg,
    );
  }

  if (params.categoryId && params.categoryId !== 'ALL') {
    const catParam = params.categoryId.toLowerCase();
    const catBySlug = db.categories.find((c) => c.slug.toLowerCase() === catParam);
    const targetCatId = catBySlug?.id ?? params.categoryId;
    items = items.filter((d) => d.categoryId === targetCatId);
  }

  return paginate(items, params.page ?? 1, params.pageSize ?? 9);
}

export async function mockGetDestinationDetail(
  id: string,
  options?: { includeHiddenForAdmin?: boolean },
): Promise<DestinationDetailResponse> {
  await simulateDelay(90);
  const db = loadMockDb();
  assertNetworkAvailable(db);
  const acc = getActiveAccount(db);
  const raw = db.destinations.find((d) => d.id.toUpperCase() === id.toUpperCase());
  if (!raw) {
    throw new AppError({ code: 'NOT_FOUND', status: 404, message: 'Không tìm thấy địa điểm này.' });
  }

  const destination = hydrateDestination(db, raw, acc?.profile.id);
  if (!options?.includeHiddenForAdmin && !destination.effectivelyPublic) {
    throw new AppError({
      code: 'NOT_FOUND',
      status: 404,
      message: 'Địa điểm này hiện không còn công khai hoặc đã tạm ẩn.',
    });
  }

  const services = db.services
    .filter((s) => s.destinationId === destination.id)
    .map((s) => hydrateService(db, s))
    .filter((s) => (options?.includeHiddenForAdmin ? true : s.effectivelyBookable));

  // Chỉ hiển thị đánh giá Đã công khai cho khách; người đăng nhập thấy thêm bản đánh giá riêng của chính mình
  const publishedReviews = db.reviews
    .filter((r) => r.destinationId === destination.id && r.status === 'PUBLISHED')
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const myReview = acc
    ? (db.reviews.find((r) => r.destinationId === destination.id && r.userId === acc.profile.id) ?? null)
    : null;

  return {
    destination,
    services,
    publishedReviews,
    myReview,
    isFavorite: Boolean(destination.isFavorite),
  };
}

export async function mockUpsertDestination(
  id: string | null,
  req: UpsertDestinationRequest,
): Promise<Destination> {
  await simulateDelay(140);
  return mutateMockDb((db) => {
    assertNetworkAvailable(db);
    const actor = requireBackofficePermission(db, 'STAFF_DESTINATION');
    const fieldErrors: Record<string, string> = {};

    const name = req.name.trim();
    if (name.length < 2 || name.length > 150) fieldErrors.name = 'Tên địa điểm phải từ 2 đến 150 ký tự.';
    if (!req.region.trim()) fieldErrors.region = 'Vui lòng chọn tỉnh/thành hoặc khu vực.';
    if (!db.categories.some((c) => c.id === req.categoryId)) fieldErrors.categoryId = 'Danh mục không hợp lệ.';
    if (req.address.trim().length < 5) fieldErrors.address = 'Vui lòng nhập địa chỉ cụ thể.';
    if (req.description.trim().length < 10) fieldErrors.description = 'Mô tả cần ít nhất 10 ký tự.';
    if (req.estimatedCostVnd !== null && req.estimatedCostVnd < 0) {
      fieldErrors.estimatedCostVnd = 'Chi phí tham khảo không được là số âm.';
    }
    if (req.imageUrl.trim() && !/^https?:\/\/|^data:image\/|^\//.test(req.imageUrl.trim())) {
      fieldErrors.imageUrl = 'Đường dẫn ảnh đại diện không đúng định dạng URL.';
    }

    if (Object.keys(fieldErrors).length > 0) {
      throw new AppError({
        code: 'VALIDATION_ERROR',
        status: 400,
        message: 'Thông tin địa điểm chưa hợp lệ.',
        fieldErrors,
      });
    }

    const cat = db.categories.find((c) => c.id === req.categoryId)!;
    const nowIso = new Date(getMockNowMs()).toISOString();

    if (!id) {
      const newId = `DN${String(db.counters.destination++).padStart(3, '0')}`;
      const sanitizedGallery = (req.galleryUrls ?? []).map((u) => u.trim()).filter(Boolean).slice(0, 4);
      const created: Destination = {
        id: newId,
        name,
        region: req.region.trim(),
        categoryId: cat.id,
        categoryName: cat.name,
        address: req.address.trim(),
        description: req.description.trim(),
        imageUrl: req.imageUrl.trim(),
        galleryUrls: sanitizedGallery,
        estimatedCostVnd: req.estimatedCostVnd,
        openingHours: req.openingHours.trim() || '07:00 – 18:00',
        status: req.status,
        effectivelyPublic: req.status === 'ACTIVE' && cat.status === 'ACTIVE',
        averageRating: null,
        publishedReviewCount: 0,
        version: 1,
        updatedAt: nowIso,
      };
      db.destinations.unshift(created);
      db.auditLogs.unshift({
        id: `LOG${String(db.counters.audit++).padStart(3, '0')}`,
        timestamp: nowIso,
        actorId: actor.profile.id,
        actorName: actor.profile.fullName,
        targetType: 'CATALOG',
        targetId: created.id,
        targetLabel: `${created.id} · ${created.name}`,
        action: 'DESTINATION_CREATED',
        actionLabel: 'Thêm địa điểm mới',
        reason: 'Thêm địa điểm vào danh mục nội bộ.',
        beforeSummary: { 'Trạng thái': 'Chưa tồn tại' },
        afterSummary: { 'Tên địa điểm': created.name, 'Khu vực': created.region },
      });
      return hydrateDestination(db, created, actor.profile.id);
    }

    const existing = db.destinations.find((d) => d.id === id);
    if (!existing) {
      throw new AppError({ code: 'NOT_FOUND', status: 404, message: 'Không tìm thấy địa điểm cần sửa.' });
    }
    if (req.expectedVersion !== undefined && existing.version !== req.expectedVersion) {
      throw new AppError({
        code: 'CONFLICT',
        status: 409,
        message: 'Địa điểm vừa được người khác cập nhật. Vui lòng tải lại dữ liệu mới nhất trước khi lưu.',
      });
    }

    const prevStatus = existing.status;
    existing.name = name;
    existing.region = req.region.trim();
    existing.categoryId = cat.id;
    existing.categoryName = cat.name;
    existing.address = req.address.trim();
    existing.description = req.description.trim();
    existing.imageUrl = req.imageUrl.trim();
    existing.galleryUrls = (req.galleryUrls ?? []).map((u) => u.trim()).filter(Boolean).slice(0, 4);
    existing.estimatedCostVnd = req.estimatedCostVnd;
    existing.openingHours = req.openingHours.trim() || '07:00 – 18:00';
    existing.status = req.status;
    existing.version += 1;
    existing.updatedAt = nowIso;

    db.auditLogs.unshift({
      id: `LOG${String(db.counters.audit++).padStart(3, '0')}`,
      timestamp: nowIso,
      actorId: actor.profile.id,
      actorName: actor.profile.fullName,
      targetType: 'CATALOG',
      targetId: existing.id,
      targetLabel: `${existing.id} · ${existing.name}`,
      action: 'DESTINATION_UPDATED',
      actionLabel: 'Cập nhật địa điểm',
      reason: 'Chỉnh sửa thông tin địa điểm trong hệ thống.',
      beforeSummary: { 'Trạng thái': prevStatus === 'ACTIVE' ? 'Đang hoạt động' : 'Đã ẩn' },
      afterSummary: { 'Tên địa điểm': existing.name, 'Trạng thái': existing.status === 'ACTIVE' ? 'Đang hoạt động' : 'Đã ẩn' },
    });

    return hydrateDestination(db, existing, actor.profile.id);
  });
}

export async function mockToggleDestinationStatus(id: string, status: ActiveStatus): Promise<Destination> {
  await simulateDelay(110);
  return mutateMockDb((db) => {
    assertNetworkAvailable(db);
    const actor = requireBackofficePermission(db, 'STAFF_DESTINATION');
    const existing = db.destinations.find((d) => d.id === id);
    if (!existing) {
      throw new AppError({ code: 'NOT_FOUND', status: 404, message: 'Không tìm thấy địa điểm.' });
    }
    const prev = existing.status;
    const nowIso = new Date(getMockNowMs()).toISOString();
    existing.status = status;
    existing.version += 1;
    existing.updatedAt = nowIso;

    db.auditLogs.unshift({
      id: `LOG${String(db.counters.audit++).padStart(3, '0')}`,
      timestamp: nowIso,
      actorId: actor.profile.id,
      actorName: actor.profile.fullName,
      targetType: 'CATALOG',
      targetId: existing.id,
      targetLabel: `${existing.id} · ${existing.name}`,
      action: 'DESTINATION_STATUS_CHANGED',
      actionLabel: status === 'ACTIVE' ? 'Kích hoạt địa điểm' : 'Ẩn địa điểm',
      reason: 'Cập nhật trạng thái hiển thị công khai.',
      beforeSummary: { 'Trạng thái': prev === 'ACTIVE' ? 'Đang hoạt động' : 'Đã ẩn' },
      afterSummary: { 'Trạng thái': status === 'ACTIVE' ? 'Đang hoạt động' : 'Đã ẩn' },
    });

    return hydrateDestination(db, existing, actor.profile.id);
  });
}

export async function mockListServices(params: ServiceFilterParams = {}): Promise<PaginatedServices> {
  await simulateDelay(80);
  const db = loadMockDb();
  assertNetworkAvailable(db);
  const q = (params.query ?? '').trim().toLowerCase();

  let items = db.services.map((s) => hydrateService(db, s));
  if (!params.includeHidden) {
    items = items.filter((s) => s.effectivelyBookable);
  } else if (params.status && params.status !== 'ALL') {
    items = items.filter((s) => s.status === params.status);
  }

  if (params.destinationId && params.destinationId !== 'ALL') {
    items = items.filter((s) => s.destinationId === params.destinationId);
  }

  if (q) {
    items = items.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.destinationName.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q),
    );
  }

  return paginate(items, params.page ?? 1, params.pageSize ?? 10);
}

export async function mockGetServiceDetail(
  id: string,
  options?: { includeHiddenForAdmin?: boolean },
): Promise<TravelService> {
  await simulateDelay(80);
  const db = loadMockDb();
  assertNetworkAvailable(db);
  const raw = db.services.find((s) => s.id.toUpperCase() === id.toUpperCase());
  if (!raw) {
    throw new AppError({ code: 'NOT_FOUND', status: 404, message: 'Không tìm thấy dịch vụ này.' });
  }
  const hydrated = hydrateService(db, raw);
  if (!options?.includeHiddenForAdmin && !hydrated.effectivelyBookable) {
    return hydrated; // Trả về kèm effectivelyBookable=false để P04 hiển thị rõ trạng thái ngừng hoạt động
  }
  return hydrated;
}

export async function mockCheckServiceAvailability(
  serviceId: string,
  serviceDate: string,
): Promise<ServiceAvailability> {
  await simulateDelay(70);
  const db = loadMockDb();
  assertNetworkAvailable(db);
  const raw = db.services.find((s) => s.id.toUpperCase() === serviceId.toUpperCase());
  if (!raw) {
    throw new AppError({ code: 'NOT_FOUND', status: 404, message: 'Không tìm thấy dịch vụ.' });
  }
  const svc = hydrateService(db, raw);
  const nowMs = getMockNowMs();
  const bookedGuests = db.bookings
    .filter((b) => {
      if (b.serviceId !== svc.id || b.serviceDate !== serviceDate) return false;
      if (b.status === 'CONFIRMED') return true;
      if (b.status === 'PENDING_PAYMENT' && new Date(b.expiresAt).getTime() > nowMs) return true;
      return false;
    })
    .reduce((sum, b) => sum + b.guestCount, 0);

  const remainingCapacity = Math.max(0, svc.maxDailyCapacity - bookedGuests);
  const available = svc.effectivelyBookable && remainingCapacity > 0;

  return {
    serviceId: svc.id,
    serviceDate,
    maxDailyCapacity: svc.maxDailyCapacity,
    bookedGuests,
    remainingCapacity,
    pricePerGuestVnd: svc.pricePerGuestVnd,
    available,
    message: !svc.effectivelyBookable
      ? 'Dịch vụ hiện ngừng hoạt động hoặc địa điểm liên kết đang tạm ẩn.'
      : remainingCapacity === 0
        ? 'Ngày đã chọn hiện đã hết chỗ.'
        : undefined,
  };
}

export async function mockUpsertService(id: string | null, req: UpsertServiceRequest): Promise<TravelService> {
  await simulateDelay(140);
  return mutateMockDb((db) => {
    assertNetworkAvailable(db);
    const actor = requireBackofficePermission(db, 'STAFF_SERVICE');
    const fieldErrors: Record<string, string> = {};

    const dest = db.destinations.find((d) => d.id === req.destinationId);
    if (!dest) fieldErrors.destinationId = 'Địa điểm liên kết không tồn tại.';
    if (req.name.trim().length < 3 || req.name.trim().length > 150) {
      fieldErrors.name = 'Tên dịch vụ phải từ 3 đến 150 ký tự.';
    }
    if (req.pricePerGuestVnd < 0) fieldErrors.pricePerGuestVnd = 'Đơn giá/người không được là số âm.';
    if (!Number.isInteger(req.maxDailyCapacity) || req.maxDailyCapacity < 1) {
      fieldErrors.maxDailyCapacity = 'Sức chứa tối đa/ngày phải là số nguyên dương.';
    }
    if (req.description.trim().length < 10) fieldErrors.description = 'Mô tả dịch vụ tối thiểu 10 ký tự.';

    if (Object.keys(fieldErrors).length > 0) {
      throw new AppError({
        code: 'VALIDATION_ERROR',
        status: 400,
        message: 'Thông tin dịch vụ chưa hợp lệ.',
        fieldErrors,
      });
    }

    const nowIso = new Date(getMockNowMs()).toISOString();
    if (!id) {
      const newSvc: TravelService = {
        id: `SV${String(db.counters.service++).padStart(3, '0')}`,
        destinationId: dest!.id,
        destinationName: dest!.name,
        name: req.name.trim(),
        serviceType: req.serviceType.trim() || 'Trải nghiệm',
        description: req.description.trim(),
        imageUrl: req.imageUrl.trim() || dest!.imageUrl,
        galleryUrls: (req.galleryUrls ?? []).map((u) => u.trim()).filter(Boolean).slice(0, 4),
        pricePerGuestVnd: req.pricePerGuestVnd,
        maxDailyCapacity: req.maxDailyCapacity,
        status: req.status,
        effectivelyBookable: req.status === 'ACTIVE' && dest!.status === 'ACTIVE',
        version: 1,
        updatedAt: nowIso,
      };
      db.services.unshift(newSvc);
      db.auditLogs.unshift({
        id: `LOG${String(db.counters.audit++).padStart(3, '0')}`,
        timestamp: nowIso,
        actorId: actor.profile.id,
        actorName: actor.profile.fullName,
        targetType: 'CATALOG',
        targetId: newSvc.id,
        targetLabel: `${newSvc.id} · ${newSvc.name}`,
        action: 'SERVICE_CREATED',
        actionLabel: 'Thêm dịch vụ du lịch',
        reason: 'Bổ sung dịch vụ mới vào danh mục đặt chỗ.',
        beforeSummary: { 'Trạng thái': 'Chưa tồn tại' },
        afterSummary: { 'Tên dịch vụ': newSvc.name, 'Đơn giá': `${newSvc.pricePerGuestVnd}đ/người` },
      });
      return hydrateService(db, newSvc);
    }

    const existing = db.services.find((s) => s.id === id);
    if (!existing) {
      throw new AppError({ code: 'NOT_FOUND', status: 404, message: 'Không tìm thấy dịch vụ cần sửa.' });
    }
    if (req.expectedVersion !== undefined && existing.version !== req.expectedVersion) {
      throw new AppError({
        code: 'CONFLICT',
        status: 409,
        message: 'Dịch vụ đã được cập nhật bởi tài khoản khác. Vui lòng tải lại trước khi lưu.',
      });
    }

    const prevPrice = existing.pricePerGuestVnd;
    existing.destinationId = dest!.id;
    existing.destinationName = dest!.name;
    existing.name = req.name.trim();
    existing.serviceType = req.serviceType.trim() || 'Trải nghiệm';
    existing.description = req.description.trim();
    existing.imageUrl = req.imageUrl.trim() || dest!.imageUrl;
    existing.galleryUrls = (req.galleryUrls ?? []).map((u) => u.trim()).filter(Boolean).slice(0, 4);
    existing.pricePerGuestVnd = req.pricePerGuestVnd;
    existing.maxDailyCapacity = req.maxDailyCapacity;
    existing.status = req.status;
    existing.version += 1;
    existing.updatedAt = nowIso;

    // Lưu ý: KHÔNG thay đổi unitPriceSnapshotVnd của các booking đã tạo trước đó!
    db.auditLogs.unshift({
      id: `LOG${String(db.counters.audit++).padStart(3, '0')}`,
      timestamp: nowIso,
      actorId: actor.profile.id,
      actorName: actor.profile.fullName,
      targetType: 'CATALOG',
      targetId: existing.id,
      targetLabel: `${existing.id} · ${existing.name}`,
      action: 'SERVICE_UPDATED',
      actionLabel: 'Cập nhật dịch vụ du lịch',
      reason: 'Thay đổi cấu hình dịch vụ (chỉ áp dụng cho đơn mới).',
      beforeSummary: { 'Đơn giá cũ': `${prevPrice}đ/người` },
      afterSummary: { 'Đơn giá mới': `${existing.pricePerGuestVnd}đ/người` },
    });

    return hydrateService(db, existing);
  });
}

export async function mockToggleServiceStatus(id: string, status: ActiveStatus): Promise<TravelService> {
  await simulateDelay(110);
  return mutateMockDb((db) => {
    assertNetworkAvailable(db);
    const actor = requireBackofficePermission(db, 'STAFF_SERVICE');
    const existing = db.services.find((s) => s.id === id);
    if (!existing) {
      throw new AppError({ code: 'NOT_FOUND', status: 404, message: 'Không tìm thấy dịch vụ.' });
    }
    const prev = existing.status;
    const nowIso = new Date(getMockNowMs()).toISOString();
    existing.status = status;
    existing.version += 1;
    existing.updatedAt = nowIso;

    db.auditLogs.unshift({
      id: `LOG${String(db.counters.audit++).padStart(3, '0')}`,
      timestamp: nowIso,
      actorId: actor.profile.id,
      actorName: actor.profile.fullName,
      targetType: 'CATALOG',
      targetId: existing.id,
      targetLabel: `${existing.id} · ${existing.name}`,
      action: 'SERVICE_STATUS_CHANGED',
      actionLabel: status === 'ACTIVE' ? 'Kích hoạt dịch vụ' : 'Ẩn dịch vụ',
      reason: 'Cập nhật trạng thái nhận đặt dịch vụ.',
      beforeSummary: { 'Trạng thái': prev === 'ACTIVE' ? 'Đang hoạt động' : 'Đã ẩn' },
      afterSummary: { 'Trạng thái': status === 'ACTIVE' ? 'Đang hoạt động' : 'Đã ẩn' },
    });

    return hydrateService(db, existing);
  });
}

// ===== FAVORITES (ADD / REMOVE rõ ràng, idempotent) =====

export async function mockListFavorites(): Promise<Destination[]> {
  await simulateDelay(80);
  const db = loadMockDb();
  assertNetworkAvailable(db);
  const acc = requireAuthAccount(db);
  const ids = db.favoritesByUser[acc.profile.id] ?? [];
  return ids
    .map((destId) => db.destinations.find((d) => d.id === destId))
    .filter((d): d is Destination => Boolean(d))
    .map((d) => hydrateDestination(db, d, acc.profile.id));
}

export async function mockAddFavorite(destinationId: string): Promise<{ isFavorite: true }> {
  await simulateDelay(90);
  return mutateMockDb((db) => {
    assertNetworkAvailable(db);
    const acc = requireAuthAccount(db);
    const dest = db.destinations.find((d) => d.id === destinationId);
    if (!dest) {
      throw new AppError({ code: 'NOT_FOUND', status: 404, message: 'Địa điểm không tồn tại.' });
    }
    const hydrated = hydrateDestination(db, dest, acc.profile.id);
    if (!hydrated.effectivelyPublic) {
      throw new AppError({ code: 'NOT_FOUND', status: 404, message: 'Địa điểm hiện không còn khả dụng.' });
    }
    const list = db.favoritesByUser[acc.profile.id] ?? [];
    if (!list.includes(destinationId)) {
      list.push(destinationId);
    }
    db.favoritesByUser[acc.profile.id] = list;
    return { isFavorite: true };
  });
}

export async function mockRemoveFavorite(destinationId: string): Promise<{ isFavorite: false }> {
  await simulateDelay(90);
  return mutateMockDb((db) => {
    assertNetworkAvailable(db);
    const acc = requireAuthAccount(db);
    const list = db.favoritesByUser[acc.profile.id] ?? [];
    db.favoritesByUser[acc.profile.id] = list.filter((id) => id !== destinationId);
    return { isFavorite: false };
  });
}

// ===== REVIEWS =====

export async function mockUpsertMyReview(req: UpsertReviewRequest): Promise<Review> {
  await simulateDelay(140);
  return mutateMockDb((db) => {
    assertNetworkAvailable(db);
    const acc = requireAuthAccount(db);
    const fieldErrors: Record<string, string> = {};
    if (!Number.isInteger(req.rating) || req.rating < 1 || req.rating > 5) {
      fieldErrors.rating = 'Vui lòng chọn số sao từ 1 đến 5.';
    }
    const comment = req.comment.trim();
    if (comment.length < 10) {
      fieldErrors.comment = 'Nhận xét cần ít nhất 10 ký tự để hữu ích cho du khách khác.';
    } else if (comment.length > 2000) {
      fieldErrors.comment = 'Nhận xét không được vượt quá 2.000 ký tự.';
    }
    if (Object.keys(fieldErrors).length > 0) {
      throw new AppError({
        code: 'VALIDATION_ERROR',
        status: 400,
        message: 'Nội dung đánh giá chưa hợp lệ.',
        fieldErrors,
      });
    }

    const dest = db.destinations.find((d) => d.id === req.destinationId);
    if (!dest) {
      throw new AppError({ code: 'NOT_FOUND', status: 404, message: 'Địa điểm không tồn tại.' });
    }
    const hydratedDest = hydrateDestination(db, dest, acc.profile.id);
    if (!hydratedDest.effectivelyPublic) {
      throw new AppError({
        code: 'FORBIDDEN',
        status: 403,
        message: 'Địa điểm hiện không còn công khai nên chưa thể gửi đánh giá.',
      });
    }

    const nowIso = new Date(getMockNowMs()).toISOString();
    // Quy tắc: Mỗi người có đúng 1 đánh giá cho mỗi địa điểm; mới hoặc sửa đều chuyển PENDING
    const existing = db.reviews.find((r) => r.destinationId === dest.id && r.userId === acc.profile.id);
    if (existing) {
      existing.rating = req.rating;
      existing.comment = comment;
      existing.status = 'PENDING';
      existing.moderationReason = undefined;
      existing.moderatedBy = undefined;
      existing.moderatedAt = undefined;
      existing.updatedAt = nowIso;
      existing.destinationName = dest.name;
      existing.destinationPublic = hydratedDest.effectivelyPublic;
      return { ...existing };
    }

    const created: Review = {
      id: `RV${String(db.counters.review++).padStart(3, '0')}`,
      destinationId: dest.id,
      destinationName: dest.name,
      destinationPublic: hydratedDest.effectivelyPublic,
      userId: acc.profile.id,
      userName: acc.profile.fullName,
      rating: req.rating,
      comment,
      status: 'PENDING',
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    db.reviews.unshift(created);
    return { ...created };
  });
}

export async function mockListMyReviews(): Promise<Review[]> {
  await simulateDelay(80);
  const db = loadMockDb();
  assertNetworkAvailable(db);
  const acc = requireAuthAccount(db);
  return db.reviews
    .filter((r) => r.userId === acc.profile.id)
    .map((r) => {
      const dest = db.destinations.find((d) => d.id === r.destinationId);
      const hydrated = dest ? hydrateDestination(db, dest, acc.profile.id) : null;
      return {
        ...r,
        destinationName: dest?.name ?? r.destinationName,
        destinationPublic: Boolean(hydrated?.effectivelyPublic),
      };
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function mockListAdminReviews(params: ReviewFilterParams = {}): Promise<PaginatedReviews> {
  await simulateDelay(90);
  const db = loadMockDb();
  assertNetworkAvailable(db);
  requireBackofficePermission(db, 'STAFF_REVIEW');
  const q = (params.query ?? '').trim().toLowerCase();

  let items = db.reviews.map((r) => {
    const dest = db.destinations.find((d) => d.id === r.destinationId);
    return {
      ...r,
      destinationName: dest?.name ?? r.destinationName,
    };
  });

  if (params.status && params.status !== 'ALL') {
    items = items.filter((r) => r.status === params.status);
  }
  if (params.destinationId && params.destinationId !== 'ALL') {
    items = items.filter((r) => r.destinationId === params.destinationId);
  }
  if (q) {
    items = items.filter(
      (r) =>
        r.userName.toLowerCase().includes(q) ||
        r.destinationName.toLowerCase().includes(q) ||
        r.comment.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q),
    );
  }

  items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return paginate(items, params.page ?? 1, params.pageSize ?? 10);
}

export async function mockModerateReview(reviewId: string, req: ModerateReviewRequest): Promise<Review> {
  await simulateDelay(130);
  return mutateMockDb((db) => {
    assertNetworkAvailable(db);
    const actor = requireBackofficePermission(db, 'STAFF_REVIEW');
    const reasonErr = validateReason(req.reason, 5, 500);
    if (reasonErr) {
      throw new AppError({
        code: 'VALIDATION_ERROR',
        status: 400,
        message: reasonErr,
        fieldErrors: { reason: reasonErr },
      });
    }

    const review = db.reviews.find((r) => r.id === reviewId);
    if (!review) {
      throw new AppError({ code: 'NOT_FOUND', status: 404, message: 'Không tìm thấy đánh giá cần kiểm duyệt.' });
    }

    // Người kiểm duyệt TUYỆT ĐỐI KHÔNG sửa comment hay rating của người dùng
    const prevStatus = review.status;
    const nowIso = new Date(getMockNowMs()).toISOString();
    review.status = req.status;
    review.moderationReason = req.reason.trim();
    review.moderatedBy = actor.profile.staffCode
      ? `${actor.profile.fullName} (${actor.profile.staffCode})`
      : actor.profile.fullName;
    review.moderatedAt = nowIso;
    review.updatedAt = nowIso;

    db.auditLogs.unshift({
      id: `LOG${String(db.counters.audit++).padStart(3, '0')}`,
      timestamp: nowIso,
      actorId: actor.profile.id,
      actorName: review.moderatedBy,
      targetType: 'REVIEW',
      targetId: review.id,
      targetLabel: `${review.id} · ${review.destinationName}`,
      action: 'REVIEW_MODERATED',
      actionLabel: req.status === 'PUBLISHED' ? 'Duyệt công khai đánh giá' : 'Ẩn đánh giá',
      reason: req.reason.trim(),
      beforeSummary: { 'Trạng thái': prevStatus },
      afterSummary: { 'Trạng thái': req.status, 'Số sao (giữ nguyên)': `${review.rating}/5` },
    });

    return { ...review };
  });
}
