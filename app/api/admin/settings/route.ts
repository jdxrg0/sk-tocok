import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getCurrentUser, isOfficialUser, isSuperAdminUser } from "@/lib/auth";
import { invalidateAllTransparencyCache } from "@/lib/transparencyCache";
import { logSecurityEvent } from "@/lib/securityLogger";
import { ALLOWED_SETTINGS_KEYS, PUBLIC_SETTINGS_KEYS, sanitizeText } from "@/lib/validation";

export const dynamic = "force-dynamic";

const NUMERIC_SETTING_KEYS = new Set([
  "barangay_budget",
  "annual_budget",
  "funds_received",
  "bank_balance",
  "fiscal_year",
  "monthly_paper_budget",
  "estimated_pages_remaining",
  "cse_slot_quota",
  "cse_annual_budget",
  "google_drive_limit_tb",
]);

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser(request);
    const isOfficial = isOfficialUser(user);

    const rows = await sql`SELECT key, value FROM settings`;
    const settings: Record<string, string> = {};
    for (const r of rows as { key: string; value: string }[]) {
      if (isOfficial ? ALLOWED_SETTINGS_KEYS.has(r.key) : PUBLIC_SETTINGS_KEYS.has(r.key)) {
        settings[r.key] = r.value;
      }
    }
    return NextResponse.json({ success: true, settings });
  } catch (error) {
    console.error("Settings fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }
    if (!isSuperAdminUser(user)) {
      return NextResponse.json({ error: "Forbidden: SK Chairperson privileges required" }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid settings payload" }, { status: 400 });
    }

    const entries = Object.entries(body as Record<string, unknown>);
    const rejectedKeys: string[] = [];
    const updates: Array<[string, string]> = [];

    for (const [key, val] of entries) {
      if (!ALLOWED_SETTINGS_KEYS.has(key)) {
        rejectedKeys.push(key);
        continue;
      }
      if (NUMERIC_SETTING_KEYS.has(key)) {
        const parsed = parseFloat(String(val ?? ""));
        if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1_000_000_000) {
          return NextResponse.json(
            { error: `Invalid numeric value for setting: ${key}` },
            { status: 400 }
          );
        }
        updates.push([key, String(parsed)]);
      } else if (key === "printing_active" || key === "cse_program_active") {
        const normalized = String(val).toLowerCase() === "true" ? "true" : "false";
        updates.push([key, normalized]);
      } else {
        updates.push([key, sanitizeText(String(val ?? ""), 500)]);
      }
    }

    if (rejectedKeys.length > 0) {
      return NextResponse.json(
        { error: `Disallowed settings key(s): ${rejectedKeys.slice(0, 5).join(", ")}` },
        { status: 400 }
      );
    }

    // Automatically enforce statutory 10% allocation under RA 10742
    const barangayEntry = updates.find(([k]) => k === "barangay_budget");
    if (barangayEntry) {
      const bBudget = parseFloat(barangayEntry[1]);
      if (Number.isFinite(bBudget)) {
        const computedAnnual = (Math.round(bBudget * 0.10 * 100) / 100).toString();
        const existingAnnualIdx = updates.findIndex(([k]) => k === "annual_budget");
        if (existingAnnualIdx >= 0) {
          updates[existingAnnualIdx][1] = computedAnnual;
        } else {
          updates.push(["annual_budget", computedAnnual]);
        }
      }
    }

    for (const [key, val] of updates) {
      await sql`
        INSERT INTO settings (key, value) VALUES (${key}, ${val})
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
      `;
    }

    invalidateAllTransparencyCache();

    await logSecurityEvent({
      eventType: "ADMIN_SETTINGS_UPDATED",
      severity: "info",
      request,
      userId: user.id,
      email: user.email,
      details: { keys: updates.map(([k]) => k) },
    });

    return NextResponse.json({ success: true, message: "Settings updated successfully" });
  } catch (error) {
    console.error("Settings update error:", error);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
