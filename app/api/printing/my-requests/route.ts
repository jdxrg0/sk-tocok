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

    // Link any previous requests with matching student name that had no user_id attached
    try {
      if (user.id && user.email && user.name) {
        await sql`
          UPDATE print_requests 
          SET user_id = ${user.id}, user_email = ${user.email} 
          WHERE (user_id IS NULL OR user_id = 0) AND LOWER(TRIM(student_name)) = LOWER(TRIM(${user.name}))
        `;
      }
    } catch {
      // Ignore migration error if any
    }

    const jobs = await sql`
      SELECT 
        id, tracking_code, student_name, school, grade_level, purok,
        file_name, print_type, paper_size, copies, page_range,
        notes, pickup_station, is_urgent, status, admin_notes,
        picked_up_at, created_at, updated_at
      FROM print_requests 
      WHERE user_id = ${user.id} 
         OR LOWER(user_email) = LOWER(${user.email}) 
         OR LOWER(TRIM(student_name)) = LOWER(TRIM(${user.name}))
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
