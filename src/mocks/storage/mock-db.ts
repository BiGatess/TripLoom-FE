import { createSeedDatabase, MOCK_SCHEMA_VERSION, type MockDatabase } from '@/mocks/fixtures/seed-data';
import { finishPageLoading, startPageLoading } from '@/shared/components/PageLoader';

const STORAGE_KEY = 'triploom_mock_db_v1';

let memoryDb: MockDatabase | null = null;
let mockClockOffsetMs = 0;

function hasLocalStorage(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  } catch {
    return false;
  }
}

export function getMockNowMs(): number {
  return Date.now() + mockClockOffsetMs;
}

export function advanceMockClockMs(deltaMs: number): void {
  mockClockOffsetMs += deltaMs;
}

export function resetMockClock(): void {
  mockClockOffsetMs = 0;
}

export function loadMockDb(): MockDatabase {
  if (memoryDb) return memoryDb;

  if (hasLocalStorage()) {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as MockDatabase;
        if (parsed && parsed.schemaVersion === MOCK_SCHEMA_VERSION) {
          memoryDb = parsed;
          return memoryDb;
        }
      }
    } catch {
      // Nếu dữ liệu lưu bị hỏng, khởi tạo lại seed sạch
    }
  }

  memoryDb = createSeedDatabase(getMockNowMs());
  saveMockDb(memoryDb);
  return memoryDb;
}

export function saveMockDb(db: MockDatabase): void {
  memoryDb = db;
  if (hasLocalStorage()) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    } catch {
      // Bỏ qua lỗi quota trong môi trường trình duyệt bị giới hạn
    }
  }
}

export function resetMockDatabase(nowMs?: number): MockDatabase {
  resetMockClock();
  const fresh = createSeedDatabase(nowMs ?? Date.now());
  memoryDb = fresh;
  if (hasLocalStorage()) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
    } catch {
      // Ignore storage error
    }
  }
  return fresh;
}

export function mutateMockDb<T>(fn: (db: MockDatabase) => T): T {
  const db = loadMockDb();
  const result = fn(db);
  saveMockDb(db);
  return result;
}

export function simulateDelay(ms = 120): Promise<void> {
  // Trong môi trường test (Node / Vitest), chạy tức thì để bộ test không bị chậm
  if (typeof window === 'undefined') {
    return Promise.resolve();
  }
  const effectiveMs = Math.max(50, Math.min(ms, 280));
  startPageLoading();
  return new Promise((resolve) => {
    window.setTimeout(() => {
      finishPageLoading();
      resolve();
    }, effectiveMs);
  });
}
