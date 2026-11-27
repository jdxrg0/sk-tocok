export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { sql, query } from "@/lib/db";
import { getCurrentUser, isOfficialUser } from "@/lib/auth";
import { logSecurityEvent } from "@/lib/securityLogger";
import { parsePositiveIntId } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json(
        { error: "You must be logged in to cancel a print request." },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const trackingCode = String(body?.tracking_code || body?.code || "").trim().slice(0, 50);

    if (!trackingCode) {
      return NextResponse.json({ error: "Ticket number is required." }, { status: 400 });
    }

    const cleanNumber = trackingCode.replace(/^[#\s]+/, "").replace(/^(ticket|no\.?)\s*/i, "").trim();
    const withoutHyphen = cleanNumber.replace(/[\s-]+/g, "");
    const skPrefixed = `SK${cleanNumber}`;
    const num = parsePositiveIntId(cleanNumber);

    let jobs: Record<string, unknown>[];
    if (num) {
      jobs = await query<Record<string, unknown>>(
        `SELECT id, tracking_code, student_name, status, user_id, user_email, file_name 
         FROM print_requests 
         WHERE tracking_code = $1 
            OR LOWER(tracking_code) = LOWER($2)
            OR id = $3
            OR tracking_code = $4
            OR LOWER(tracking_code) = LOWER($5)
         LIMIT 1`,
        [trackingCode, cleanNumber, num, String(num), skPrefixed]
      );
    } else {
      jobs = await query<Record<string, unknown>>(
        `SELECT id, tracking_code, student_name, status, user_id, user_email, file_name 
         FROM print_requests 
         WHERE tracking_code = $1 
            OR LOWER(tracking_code) = LOWER($2)
            OR LOWER(tracking_code) = LOWER($3)
         LIMIT 1`,
        [trackingCode, cleanNumber, withoutHyphen]
      );
    }

    if (jobs.length === 0) {
      return NextResponse.json({ error: "Print request not found." }, { status: 404 });
    }

    const job = jobs[0];

    // Check ownership strictly via authenticated user ID (or verified legacy unlinked email)
    const isOfficial = isOfficialUser(currentUser);
    const isOwner = Boolean(
      (job.user_id && Number(job.user_id) === currentUser.id) ||
        (!job.user_id &&
          currentUser.email_verified &&
          job.user_email &&
          String(job.user_email).toLowerCase() === currentUser.email.toLowerCase())
    );

    if (!isOwner && !isOfficial) {
      await logSecurityEvent({
        eventType: "IDOR_PRINT_CANCEL_BLOCKED",
        severity: "high",
        request,
        userId: currentUser.id,
        email: currentUser.email,
        details: { trackingCode: job.tracking_code },
      });
      return NextResponse.json(
        { error: "You are not authorized to cancel this request. Only the student who submitted it can cancel." },
        { status: 403 }
      );
    }

    // Check cancellable status
    if (job.status === "Cancelled") {
      return NextResponse.json({ error: "This request has already been cancelled." }, { status: 400 });
    }

    if (job.status === "Completed") {
      return NextResponse.json(
        { error: "This request has already been completed and claimed." },
        { status: 400 }
      );
    }

    if (job.status === "Ready for Pickup") {
      return NextResponse.json(
        { error: "This document has already been printed and is ready for pickup. Please contact your SK claiming station." },
        { status: 400 }
      );
    }

    if (job.status === "Printing In Progress") {
      return NextResponse.json(
        { error: "This document is currently being printed by SK officials and cannot be cancelled online." },
        { status: 400 }
      );
    }

    // Update status to Cancelled
    await sql`
      UPDATE print_requests 
      SET status = 'Cancelled',
          admin_notes = COALESCE(admin_notes, 'Cancelled by student'),
          updated_at = NOW()
      WHERE id = ${job.id}
    `;

    return NextResponse.json({
      success: true,
      message: `Ticket #${job.tracking_code} was successfully cancelled.`,
      tracking_code: job.tracking_code,
    });
  } catch (error) {
    console.error("Cancel request error:", error);
    return NextResponse.json({ error: "Failed to cancel print request. Please try again." }, { status: 500 });
  }
}
