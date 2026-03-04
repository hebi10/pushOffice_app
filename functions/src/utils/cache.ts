/**
 * 인메모리 캐시
 * - 10분 TTL
 * - 동일 좌표/키 요청 시 재사용
 * - API 실패 시 만료된 캐시(stale)라도 반환 가능
 */

interface CacheEntry<T> {
  data: T;
  expiry: number;
}

class MemoryCache {
  private store = new Map<string, CacheEntry<unknown>>();

  /** 유효한 캐시 조회 (TTL 내) */
  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiry) {
      this.store.delete(key);
      return null;
    }
    return entry.data as T;
  }

  /** 캐시 저장 */
  set<T>(key: string, data: T, ttlMs: number): void {
    this.store.set(key, {data, expiry: Date.now() + ttlMs});
  }

  /** 만료된 캐시라도 반환 (fallback용) */
  getStale<T>(key: string): T | null {
    const entry = this.store.get(key);
    return entry ? (entry.data as T) : null;
  }
}

export const cache = new MemoryCache();
