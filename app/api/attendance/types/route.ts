import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getCurrentUser, isOfficialUser } from "@/lib/auth";
import { ACTIVITY_TYPES } from "@/lib/attendance";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await sql`
      SELECT value FROM settings WHERE key = 'attendance_activity_types' LIMIT 1
    `;
    let types = [...ACTIVITY_TYPES];
    if (rows && rows.length > 0 && rows[0].value) {
      try {
        const parsed = JSON.parse(rows[0].value);
        if (Array.isArray(parsed) && parsed.length > 0) {
          types = parsed;
        }
      } catch {
        // Fallback to default
      }
    }
    return NextResponse.json({ success: true, types });
  } catch (error) {
    console.error("Failed to load activity types:", error);
    return NextResponse.json({ success: true, types: [...ACTIVITY_TYPES] });
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
    const rawTypes = body.types;
    if (!Array.isArray(rawTypes)) {
      return NextResponse.json({ error: "Invalid types format. Expected an array." }, { status: 400 });
    }

    // Sanitize and deduplicate
    const sanitized: string[] = [];
    for (const item of rawTypes) {
      const clean = String(item || "").trim();
      if (clean && !sanitized.includes(clean)) {
        sanitized.push(clean);
      }
    }

    // Guarantee Regular Session is always present
    if (!sanitized.includes("Regular Session")) {
      sanitized.unshift("Regular Session");
    }

    await sql`
      INSERT INTO settings (key, value)
      VALUES ('attendance_activity_types', ${JSON.stringify(sanitized)})
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    `;

    return NextResponse.json({ success: true, types: sanitized });
  } catch (error) {
    console.error("Failed to save activity types:", error);
    return NextResponse.json({ error: "Failed to save activity types." }, { status: 500 });
  }
}
