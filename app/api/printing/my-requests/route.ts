export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ authenticated: false, jobs: [] }, { status: 401 });
    }

    const isVerifiedLegacyOwner = Boolean(user.email_verified);
    const jobs = await sql`
      SELECT
        id, tracking_code, student_name, school, grade_level, purok,
        file_name, print_type, paper_size, copies, page_range,
        notes, pickup_station, is_urgent, status, admin_notes,
        picked_up_at, created_at, updated_at
      FROM print_requests
      WHERE user_id = ${user.id}
         OR (${isVerifiedLegacyOwner} AND user_id IS NULL AND LOWER(user_email) = LOWER(${user.email}))
      ORDER BY id DESC
    `;

    return NextResponse.json({
      authenticated: true,
      jobs,
    });
  } catch (error) {
    console.error("My requests error:", error);
    return NextResponse.json({ error: "Failed to fetch student requests." }, { status: 500 });
  }
}
