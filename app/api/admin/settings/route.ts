import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getCurrentUser, isOfficialUser } from "@/lib/auth";
import { invalidateAllTransparencyCache } from "@/lib/transparencyCache";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await sql`SELECT key, value FROM settings`;
    const settings: Record<string, string> = {};
    for (const r of rows as { key: string; value: string }[]) {
      settings[r.key] = r.value;
    }
    return NextResponse.json({ success: true, settings });
  } catch (error) {
    console.error("Settings fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }
    if (!isOfficialUser(user)) {
      return NextResponse.json({ error: "Forbidden: SK Officials only" }, { status: 403 });
    }

    const body = await request.json();
    // Automatically enforce statutory 10% allocation under RA 10742
    if (body.barangay_budget !== undefined) {
      const bBudget = parseFloat(body.barangay_budget);
      if (!isNaN(bBudget)) {
        body.annual_budget = (Math.round(bBudget * 0.10 * 100) / 100).toString();
      }
    }
    for (const [key, val] of Object.entries(body)) {
      await sql`
        INSERT INTO settings (key, value) VALUES (${key}, ${String(val)})
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
      `;
    }

    invalidateAllTransparencyCache();

    return NextResponse.json({ success: true, message: "Settings updated successfully" });
  } catch (error) {
    console.error("Settings update error:", error);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
