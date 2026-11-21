import { NextResponse } from "next/server";
import { sql, query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    if (!code) {
      return NextResponse.json({ error: "Tracking code is required" }, { status: 400 });
    }

    const rawCode = decodeURIComponent(code).trim();
    // Normalize: strip leading # or "ticket", "no.", "PRN-"
    const cleanNumber = rawCode.replace(/^[#\s]+/, "").replace(/^(ticket|no\.?)\s*/i, "").trim();
    const withoutHyphen = cleanNumber.replace(/[\s-]+/g, "");
    const skPrefixed = `SK${cleanNumber}`;
    const num = parseInt(cleanNumber, 10);
    const isNum = !isNaN(num) && String(num) === cleanNumber;

    let jobs: Record<string, unknown>[];
    if (isNum) {
      jobs = await query<Record<string, unknown>>(
        `SELECT 
          id, tracking_code, student_name, school, grade_level, purok,
          file_name, print_type, paper_size, copies, page_range, notes,
          pickup_station, is_urgent,
          status, admin_notes, picked_up_at, created_at, updated_at,
          user_id, user_email
        FROM print_requests 
        WHERE LOWER(tracking_code) = LOWER($1) 
           OR LOWER(tracking_code) = LOWER($2)
           OR id = $3
           OR tracking_code = $4
           OR LOWER(tracking_code) = LOWER($5)
        ORDER BY id ASC
        LIMIT 1`,
        [rawCode, cleanNumber, num, String(num), skPrefixed]
      );
    } else {
      jobs = await query<Record<string, unknown>>(
        `SELECT 
          id, tracking_code, student_name, school, grade_level, purok,
          file_name, print_type, paper_size, copies, page_range, notes,
          pickup_station, is_urgent,
          status, admin_notes, picked_up_at, created_at, updated_at,
          user_id, user_email
        FROM print_requests 
        WHERE LOWER(tracking_code) = LOWER($1) 
           OR LOWER(tracking_code) = LOWER($2)
           OR LOWER(tracking_code) = LOWER($3)
        ORDER BY id ASC
        LIMIT 1`,
        [rawCode, cleanNumber, withoutHyphen]
      );
    }

    if (jobs.length === 0) {
      return NextResponse.json({ error: "No print request found with this ticket number." }, { status: 404 });
    }

    const job = jobs[0];

    // Check if the current viewer owns this request
    const currentUser = await getCurrentUser();
    const isOwner = !!(
      currentUser && (
        (job.user_id && job.user_id === currentUser.id) ||
        (job.user_email && String(job.user_email).toLowerCase() === currentUser.email.toLowerCase()) ||
        (job.student_name && String(job.student_name).toLowerCase().trim() === currentUser.name.toLowerCase().trim())
      )
    );

    // If the ticket is not ours, don't show any personal or document details (progress only)
    if (!isOwner) {
      const progressOnlyJob = {
        id: job.id,
        tracking_code: job.tracking_code,
        status: job.status,
        created_at: job.created_at,
        updated_at: job.updated_at,
        picked_up_at: job.picked_up_at,
        pickup_station: job.pickup_station,
        is_urgent: job.is_urgent,
        is_owner: false,
      };
      return NextResponse.json({ success: true, job: progressOnlyJob });
    }

    return NextResponse.json({
      success: true,
      job: {
        ...job,
        is_owner: true,
      },
    });
  } catch (error) {
    console.error("Tracking lookup error:", error);
    return NextResponse.json({ error: "Error looking up tracking code" }, { status: 500 });
  }
}
