import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureSecurityTables, extractClientIp, logSecurityEvent } from "@/lib/securityLogger";

interface MemoryEntry {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, MemoryEntry>();
const MAX_MEMORY_ENTRIES = 5000;

function checkMemoryRateLimit(key: string, max: number, windowMs: number): {
  count: number;
  resetAt: number;
  blocked: boolean;
} {
  const now = Date.now();
  if (memoryStore.size > MAX_MEMORY_ENTRIES) {
    for (const [k, v] of memoryStore.entries()) {
      if (v.resetAt <= now) memoryStore.delete(k);
    }
    if (memoryStore.size > MAX_MEMORY_ENTRIES) {
      memoryStore.clear();
    }
  }

  const existing = memoryStore.get(key);
  if (!existing || existing.resetAt <= now) {
    const entry = { count: 1, resetAt: now + windowMs };
    memoryStore.set(key, entry);
    return { count: 1, resetAt: entry.resetAt, blocked: false };
  }

  existing.count += 1;
  return {
    count: existing.count,
    resetAt: existing.resetAt,
    blocked: existing.count > max,
  };
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export async function checkRateLimit(options: {
  request?: Request;
  bucket: string;
  identifier?: string;
  max: number;
  windowMs: number;
  persistToDb?: boolean;
}): Promise<RateLimitResult> {
  const ip = extractClientIp(options.request);
  const idPart = options.identifier ? `${ip}:${options.identifier}` : ip;
  const key = `${options.bucket}:${idPart}`.slice(0, 200);

  const mem = checkMemoryRateLimit(key, options.max, options.windowMs);
  if (mem.blocked) {
    const retryAfterSeconds = Math.max(1, Math.ceil((mem.resetAt - Date.now()) / 1000));
    logSecurityEvent({
      eventType: "RATE_LIMIT_EXCEEDED",
      severity: "warning",
      request: options.request,
      details: { bucket: options.bucket, retryAfterSeconds },
    }).catch(() => {});
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }

  if (options.persistToDb) {
    try {
      await ensureSecurityTables();
      const windowSec = Math.max(1, Math.ceil(options.windowMs / 1000));
      const rows = await sql`
        INSERT INTO rate_limits (key, count, window_start)
        VALUES (${key}, 1, NOW())
        ON CONFLICT (key) DO UPDATE SET
          count = CASE
            WHEN rate_limits.window_start + (${windowSec} * INTERVAL '1 second') <= NOW()
            THEN 1
            ELSE rate_limits.count + 1
          END,
          window_start = CASE
            WHEN rate_limits.window_start + (${windowSec} * INTERVAL '1 second') <= NOW()
            THEN NOW()
            ELSE rate_limits.window_start
          END
        RETURNING count, EXTRACT(EPOCH FROM (window_start + (${windowSec} * INTERVAL '1 second') - NOW())) AS ttl_sec
      `;
      const row = rows[0] as { count: number; ttl_sec: number } | undefined;
      if (row) {
        const dbCount = Number(row.count);
        const ttl = Math.max(1, Math.ceil(Number(row.ttl_sec || windowSec)));
        if (dbCount > options.max) {
          // Sync local memory block so flood doesn't keep hammering DB
          memoryStore.set(key, { count: dbCount, resetAt: Date.now() + ttl * 1000 });
          logSecurityEvent({
            eventType: "RATE_LIMIT_EXCEEDED",
            severity: "warning",
            request: options.request,
            details: { bucket: options.bucket, source: "db", retryAfterSeconds: ttl },
          }).catch(() => {});
          return { allowed: false, remaining: 0, retryAfterSeconds: ttl };
        }
        return {
          allowed: true,
          remaining: Math.max(0, options.max - dbCount),
          retryAfterSeconds: 0,
        };
      }
    } catch {
      // Fallback gracefully to memory counter if DB check fails transiently
    }
  }

  return {
    allowed: true,
    remaining: Math.max(0, options.max - mem.count),
    retryAfterSeconds: 0,
  };
}

export function rateLimitExceededResponse(retryAfterSeconds: number, message?: string): NextResponse {
  return NextResponse.json(
    {
      error: message || "Too many requests. Please wait a moment before trying again.",
      retryAfterSeconds,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(Math.max(1, retryAfterSeconds)),
        "X-RateLimit-Remaining": "0",
      },
    }
  );
}
