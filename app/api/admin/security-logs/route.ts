import { NextResponse } from "next/server";
import { getCurrentUser, isSuperAdminUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { auditEnvironmentConfig } from "@/lib/env";
import { ensureSecurityTables } from "@/lib/securityLogger";

export async function GET(request: Request) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isSuperAdminUser(currentUser)) {
      return NextResponse.json(
        { error: "Forbidden: SK Chairperson privileges required" },
        { status: 403 }
      );
    }

    await ensureSecurityTables();

    const { searchParams } = new URL(request.url);
    const severityFilter = searchParams.get("severity")?.trim().toLowerCase() || "";
    const typeFilter = searchParams.get("event_type")?.trim() || "";
    const rawLimit = parseInt(searchParams.get("limit") || "50", 10);
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 200) : 50;

    let events;
    if (severityFilter && typeFilter) {
      events = await sql`
        SELECT id, event_type, severity, ip_address, user_id, email, method, path, user_agent, details, created_at
        FROM security_events
        WHERE severity = ${severityFilter} AND event_type = ${typeFilter}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;
    } else if (severityFilter) {
      events = await sql`
        SELECT id, event_type, severity, ip_address, user_id, email, method, path, user_agent, details, created_at
        FROM security_events
        WHERE severity = ${severityFilter}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;
    } else if (typeFilter) {
      events = await sql`
        SELECT id, event_type, severity, ip_address, user_id, email, method, path, user_agent, details, created_at
        FROM security_events
        WHERE event_type = ${typeFilter}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;
    } else {
      events = await sql`
        SELECT id, event_type, severity, ip_address, user_id, email, method, path, user_agent, details, created_at
        FROM security_events
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;
    }

    const summaryRows = await sql`
      SELECT
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours')::INTEGER AS events_24h,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours' AND severity IN ('high', 'critical'))::INTEGER AS critical_24h,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours' AND event_type = 'LOGIN_FAILED')::INTEGER AS failed_logins_24h,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours' AND event_type = 'RATE_LIMIT_EXCEEDED')::INTEGER AS rate_limits_24h
      FROM security_events
    `;

    const envAudit = auditEnvironmentConfig();

    return NextResponse.json({
      events,
      summary: summaryRows[0] || {
        events_24h: 0,
        critical_24h: 0,
        failed_logins_24h: 0,
        rate_limits_24h: 0,
      },
      envAudit,
    });
  } catch (err) {
    console.error("[AdminSecurityLogs] Error:", err);
    return NextResponse.json(
      { error: "Failed to retrieve security logs." },
      { status: 500 }
    );
  }
}
