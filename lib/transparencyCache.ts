/**
 * In-memory cache for transparency portal financial datasets.
 * Reduces database round-trips to Neon Postgres while guaranteeing instant
 * cache invalidation on any write (create, update, delete).
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

let expensesCache: CacheEntry<unknown> | null = null;
let depositsCache: CacheEntry<unknown> | null = null;

// Keep cache alive for up to 60 seconds if no mutations occur
const CACHE_TTL_MS = 60 * 1000;

export function getCachedExpenses<T>(): T | null {
  if (expensesCache && Date.now() - expensesCache.timestamp < CACHE_TTL_MS) {
    return expensesCache.data as T;
  }
  return null;
}

export function setCachedExpenses<T>(data: T): void {
  expensesCache = {
    data,
    timestamp: Date.now(),
  };
}

export function invalidateExpensesCache(): void {
  expensesCache = null;
}

export function getCachedDeposits<T>(): T | null {
  if (depositsCache && Date.now() - depositsCache.timestamp < CACHE_TTL_MS) {
    return depositsCache.data as T;
  }
  return null;
}

export function setCachedDeposits<T>(data: T): void {
  depositsCache = {
    data,
    timestamp: Date.now(),
  };
}

export function invalidateDepositsCache(): void {
  depositsCache = null;
}

export function invalidateAllTransparencyCache(): void {
  expensesCache = null;
  depositsCache = null;
}
