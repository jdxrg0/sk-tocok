import { sql } from "@/lib/db";

export type SecuritySeverity = "info" | "warning" | "high" | "critical";

let securityTablesPromise: Promise<void> | null = null;

export function ensureSecurityTables(): Promise<void> {
  if (!securityTablesPromise) {
    securityTablesPromise = (async () => {
      try {
        await sql`
          CREATE TABLE IF NOT EXISTS security_events (
            id         SERIAL PRIMARY KEY,
            event_type TEXT NOT NULL,
            severity   TEXT NOT NULL DEFAULT 'info',
            ip_address TEXT,
            user_id    INTEGER,
            email      TEXT,
            method     TEXT,
            path       TEXT,
            user_agent TEXT,
            details    JSONB,
            created_at TIMESTAMPTZ DEFAULT NOW()
          )
        `;
        await sql`CREATE INDEX IF NOT EXISTS idx_sec_events_created ON security_events(created_at DESC)`;
        await sql`CREATE INDEX IF NOT EXISTS idx_sec_events_type ON security_events(event_type, created_at DESC)`;
        await sql`
          CREATE TABLE IF NOT EXISTS rate_limits (
            key          TEXT PRIMARY KEY,
            count        INTEGER NOT NULL DEFAULT 1,
            window_start TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `;
      } catch (err) {
        securityTablesPromise = null;
        console.error("[SecurityLogger] Failed to ensure security tables:", err);
      }
    })();
  }
  return securityTablesPromise;
}

export function extractClientIp(request?: Request): string {
  if (!request) return "unknown";
  const vercelIp = request.headers.get("x-vercel-forwarded-for");
  if (vercelIp) {
    const first = vercelIp.split(",")[0]?.trim();
    if (first) return first.slice(0, 64);
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp && realIp.trim()) return realIp.trim().slice(0, 64);

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first.slice(0, 64);
  }
  return "127.0.0.1";
}

function redactDetails(details?: Record<string, unknown>): Record<string, unknown> | null {
  if (!details) return null;
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(details)) {
    if (/(password|secret|token|cookie|key|authorization)/i.test(k)) {
      clean[k] = "[REDACTED]";
    } else if (typeof v === "string") {
      clean[k] = v.slice(0, 300);
    } else {
      clean[k] = v;
    }
  }
  return clean;
}

export async function logSecurityEvent(params: {
  eventType: string;
  severity?: SecuritySeverity;
  request?: Request;
  userId?: number | null;
  email?: string | null;
  details?: Record<string, unknown>;
}): Promise<void> {
  const severity = params.severity || "info";
  const ip = extractClientIp(params.request);
  const method = params.request?.method || null;
  let path = null;
  if (params.request?.url) {
    try {
      path = new URL(params.request.url).pathname;
    } catch {
      path = null;
    }
  }
  const userAgent = params.request?.headers.get("user-agent")?.slice(0, 250) || null;
  const safeDetails = redactDetails(params.details);

  const logRecord = {
    ts: new Date().toISOString(),
    event: params.eventType,
    severity,
    ip,
    userId: params.userId ?? null,
    email: params.email ?? null,
    method,
    path,
    details: safeDetails,
  };

  if (severity === "critical" || severity === "high") {
    console.warn("[SECURITY_EVENT]", JSON.stringify(logRecord));
  } else if (severity === "warning") {
    console.warn("[SECURITY_EVENT]", JSON.stringify(logRecord));
  } else {
    console.info("[SECURITY_EVENT]", JSON.stringify(logRecord));
  }

  try {
    await ensureSecurityTables();
    await sql`
      INSERT INTO security_events (event_type, severity, ip_address, user_id, email, method, path, user_agent, details)
      VALUES (
        ${params.eventType},
        ${severity},
        ${ip},
        ${params.userId ?? null},
        ${params.email ? params.email.slice(0, 254) : null},
        ${method},
        ${path},
        ${userAgent},
        ${safeDetails ? JSON.stringify(safeDetails) : null}::jsonb
      )
    `;
  } catch (err) {
    console.error("[SecurityLogger] Persist failed:", err);
  }
}
