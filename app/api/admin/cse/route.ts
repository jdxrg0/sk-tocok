import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getCurrentOfficial } from "@/lib/auth";
import { DEFAULT_REIMBURSEMENT_AMOUNT, MAX_EXAM_SUBSIDY_CAP, ensureCseTable } from "@/lib/cse";
import { logSecurityEvent } from "@/lib/securityLogger";
import {
  CSE_ATTENDANCE_STATUSES,
  CSE_REIMBURSEMENT_STATUSES,
  CSE_RESULT_STATUSES,
  sanitizeText,
} from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * Admin GET: List all CSE applications with complete unmasked details & statistics
 */
export async function GET(request: Request) {
  try {
    const official = await getCurrentOfficial(request);
    if (!official) {
      return NextResponse.json({ error: "Unauthorized. SK Official access required." }, { status: 401 });
    }

    await ensureCseTable();

    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") || "").trim().toLowerCase();
    const reimbursementStatus = searchParams.get("reimbursementStatus");
    const attendanceStatus = searchParams.get("attendanceStatus");
    const resultStatus = searchParams.get("resultStatus");
    const purok = searchParams.get("purok");

    // Fetch all for in-memory or DB filtering
    const rows = await sql`
      SELECT 
        id,
        tracking_code,
        full_name,
        contact_number,
        email,
        facebook_name,
        purok,
        birthdate,
        age,
        school_or_employment,
        exam_category,
        exam_level,
        exam_date,
        exam_fee_paid,
        is_first_time,
        prior_sitting_proof_url,
        peer_review_attended,
        payout_preference,
        gcash_number,
        gcash_account_name,
        valid_id_url,
        csc_receipt_url,
        csc_receipt_no,
        exam_schedule_proof_url,
        reimbursement_status,
        reimbursement_amount,
        disbursement_voucher_no,
        reimbursed_at,
        reimbursed_by,
        payout_station_or_method,
        admin_notes,
        attendance_status,
        exam_attendance_proof_url,
        exam_attendance_notes,
        attendance_verified_at,
        exam_result_status,
        rating,
        result_proof_url,
        is_featured_in_hall_of_fame,
        result_verified_at,
        created_at,
        updated_at
      FROM cse_applications
      ORDER BY created_at DESC
    `;

    // Filter in-memory for flexible multi-criteria search
    let filtered = rows as Array<{
      id: number;
      tracking_code: string;
      full_name: string;
      contact_number: string;
      email: string | null;
      purok: string;
      reimbursement_status: string;
      attendance_status: string;
      exam_result_status: string;
    }>;

    if (q) {
      filtered = filtered.filter(
        (r) =>
          r.tracking_code.toLowerCase().includes(q) ||
          r.full_name.toLowerCase().includes(q) ||
          (r.contact_number && r.contact_number.includes(q)) ||
          (r.email && r.email.toLowerCase().includes(q))
      );
    }

    if (reimbursementStatus && reimbursementStatus !== "all") {
      filtered = filtered.filter((r) => r.reimbursement_status === reimbursementStatus);
    }

    if (attendanceStatus && attendanceStatus !== "all") {
      filtered = filtered.filter((r) => r.attendance_status === attendanceStatus);
    }

    if (resultStatus && resultStatus !== "all") {
      filtered = filtered.filter((r) => r.exam_result_status === resultStatus);
    }

    if (purok && purok !== "all") {
      filtered = filtered.filter((r) => r.purok === purok);
    }

    return NextResponse.json({
      success: true,
      applications: filtered,
      totalCount: rows.length,
      filteredCount: filtered.length,
    });
  } catch (error) {
    console.error("Error fetching admin CSE applications:", error);
    return NextResponse.json({ error: "Failed to load applications." }, { status: 500 });
  }
}

/**
 * Admin PATCH: Update application statuses, log payouts, and verify proofs
 */
export async function PATCH(request: Request) {
  try {
    const official = await getCurrentOfficial(request);
    if (!official) {
      return NextResponse.json({ error: "Unauthorized. SK Official access required." }, { status: 401 });
    }

    await ensureCseTable();
    const body = await request.json();
    const numericId = Number(body?.id);
    const action = sanitizeText(body?.action, 50);

    if (!Number.isInteger(numericId) || numericId <= 0 || !action) {
      return NextResponse.json({ error: "Valid Application ID and action are required." }, { status: 400 });
    }

    if (action === "update_status") {
      const reimbursementStatus = sanitizeText(body?.reimbursementStatus, 60);
      const adminNotes = sanitizeText(body?.adminNotes, 1000) || null;
      if (!CSE_REIMBURSEMENT_STATUSES.includes(reimbursementStatus as (typeof CSE_REIMBURSEMENT_STATUSES)[number])) {
        return NextResponse.json({ error: "Invalid reimbursement status." }, { status: 400 });
      }
      const updated = await sql`
        UPDATE cse_applications
        SET
          reimbursement_status = ${reimbursementStatus},
          admin_notes = ${adminNotes},
          updated_at = NOW()
        WHERE id = ${numericId}
        RETURNING id
      `;
      if (updated.length === 0) {
        return NextResponse.json({ error: "Application not found." }, { status: 404 });
      }
      return NextResponse.json({ success: true, message: "Application status updated." });
    }

    if (action === "record_reimbursement") {
      const voucherNo = sanitizeText(body?.voucherNo, 64);
      const payoutMethod = sanitizeText(body?.payoutMethod, 100) || "Barangay Hall";
      const adminNotes = sanitizeText(body?.adminNotes, 1000) || null;
      if (!voucherNo) {
        return NextResponse.json({ error: "Disbursement Voucher (DV) number is required for audit liquidation." }, { status: 400 });
      }

      const quotaRows = await sql`SELECT value FROM settings WHERE key = 'cse_slot_quota' LIMIT 1`;
      const quota = Math.max(1, parseInt(String(quotaRows[0]?.value || "20"), 10) || 20);
      const countRows = await sql`
        SELECT COUNT(*)::INTEGER AS cnt
        FROM cse_applications
        WHERE reimbursement_status = 'Reimbursed' AND id != ${numericId}
      `;
      const reimbursedCount = Number((countRows[0] as { cnt: number })?.cnt || 0);
      if (reimbursedCount >= quota) {
        return NextResponse.json(
          { error: `Exam subsidy slot quota (${quota}) has already been reached.` },
          { status: 409 }
        );
      }

      // Post-exam release rule: never release cash before the applicant sits for the exam
      const appCheckRows = await sql`
        SELECT attendance_status, reimbursement_status, reimbursement_amount, exam_fee_paid
        FROM cse_applications
        WHERE id = ${numericId}
        LIMIT 1
      `;
      if (appCheckRows.length === 0) {
        return NextResponse.json({ error: "Application not found." }, { status: 404 });
      }
      const currentApp = appCheckRows[0] as {
        attendance_status: string;
        reimbursement_status: string;
        reimbursement_amount?: number | null;
        exam_fee_paid?: number | null;
      };
      if (currentApp.reimbursement_status === "Reimbursed") {
        return NextResponse.json(
          { error: "Application has already been disbursed." },
          { status: 409 }
        );
      }
      if (currentApp.attendance_status !== "Verified Attended") {
        return NextResponse.json(
          {
            error:
              "Post-exam release rule: Exam attendance must be verified ('Verified Attended') before the exam fee subsidy can be disbursed.",
          },
          { status: 400 }
        );
      }

      // Enforce ₱1,000 maximum grant ceiling server-side
      const baseFee = Number(currentApp.reimbursement_amount ?? currentApp.exam_fee_paid ?? DEFAULT_REIMBURSEMENT_AMOUNT);
      const amount = Math.min(Math.max(0, Number.isFinite(baseFee) ? baseFee : DEFAULT_REIMBURSEMENT_AMOUNT), MAX_EXAM_SUBSIDY_CAP);

      const updated = await sql`
        UPDATE cse_applications
        SET
          reimbursement_status = 'Reimbursed',
          reimbursement_amount = ${amount},
          disbursement_voucher_no = ${voucherNo},
          reimbursed_at = NOW(),
          reimbursed_by = ${official.name},
          payout_station_or_method = ${payoutMethod},
          admin_notes = COALESCE(${adminNotes}, admin_notes),
          updated_at = NOW()
        WHERE id = ${numericId}
          AND reimbursement_status != 'Reimbursed'
          AND attendance_status = 'Verified Attended'
          AND (
            SELECT COUNT(*)::INTEGER
            FROM cse_applications
            WHERE reimbursement_status = 'Reimbursed' AND id != ${numericId}
          ) < ${quota}
        RETURNING id, tracking_code
      `;
      if (updated.length === 0) {
        return NextResponse.json(
          { error: "Application not found or has already been disbursed." },
          { status: 409 }
        );
      }

      await logSecurityEvent({
        eventType: "CSE_REIMBURSEMENT_RECORDED",
        severity: "info",
        request,
        userId: official.id,
        email: official.email,
        details: { applicationId: numericId, amount, voucherNo },
      });

      return NextResponse.json({
        success: true,
        message: `₱${amount.toLocaleString()} subsidy recorded and logged for COA liquidation.`,
      });
    }

    if (action === "verify_attendance") {
      const attendanceStatus = sanitizeText(body?.attendanceStatus, 60);
      const adminNotes = sanitizeText(body?.adminNotes, 1000) || null;
      if (!CSE_ATTENDANCE_STATUSES.includes(attendanceStatus as (typeof CSE_ATTENDANCE_STATUSES)[number])) {
        return NextResponse.json({ error: "Invalid attendance status." }, { status: 400 });
      }
      await sql`
        UPDATE cse_applications
        SET
          attendance_status = ${attendanceStatus},
          attendance_verified_at = NOW(),
          admin_notes = COALESCE(${adminNotes}, admin_notes),
          updated_at = NOW()
        WHERE id = ${numericId}
      `;
      return NextResponse.json({ success: true, message: "Exam attendance status updated." });
    }

    if (action === "verify_result") {
      const resultStatus = sanitizeText(body?.resultStatus, 60);
      const adminNotes = sanitizeText(body?.adminNotes, 1000) || null;
      const isFeatured = body?.isFeatured !== false;
      if (!CSE_RESULT_STATUSES.includes(resultStatus as (typeof CSE_RESULT_STATUSES)[number])) {
        return NextResponse.json({ error: "Invalid exam result status." }, { status: 400 });
      }
      let parsedRating: number | null = null;
      if (body?.rating !== null && body?.rating !== undefined && String(body.rating).trim() !== "") {
        const r = Number(body.rating);
        if (!Number.isFinite(r) || r < 0 || r > 100) {
          return NextResponse.json({ error: "Exam rating must be between 0 and 100." }, { status: 400 });
        }
        parsedRating = Math.round(r * 100) / 100;
      }
      await sql`
        UPDATE cse_applications
        SET
          exam_result_status = ${resultStatus},
          rating = ${parsedRating},
          is_featured_in_hall_of_fame = ${isFeatured},
          result_verified_at = NOW(),
          admin_notes = COALESCE(${adminNotes}, admin_notes),
          updated_at = NOW()
        WHERE id = ${numericId}
      `;
      return NextResponse.json({ success: true, message: "Exam result and Hall of Fame status updated." });
    }

    return NextResponse.json({ error: "Unrecognized admin action." }, { status: 400 });
  } catch (error) {
    console.error("Error updating CSE application by admin:", error);
    return NextResponse.json({ error: "Failed to update application." }, { status: 500 });
  }
}

/**
 * Admin DELETE: Remove invalid, test, or fraudulent submission
 */
export async function DELETE(request: Request) {
  try {
    const official = await getCurrentOfficial(request);
    if (!official) {
      return NextResponse.json({ error: "Unauthorized. SK Official access required." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = parseInt(searchParams.get("id") || "", 10);

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "Valid Application ID is required." }, { status: 400 });
    }

    await sql`DELETE FROM cse_applications WHERE id = ${id}`;
    await logSecurityEvent({
      eventType: "CSE_APPLICATION_DELETED",
      severity: "warning",
      request,
      userId: official.id,
      email: official.email,
      details: { applicationId: id },
    });
    return NextResponse.json({ success: true, message: "Application deleted successfully." });
  } catch (error) {
    console.error("Error deleting CSE application:", error);
    return NextResponse.json({ error: "Failed to delete application." }, { status: 500 });
  }
}
