import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getCurrentOfficial } from "@/lib/auth";
import { ensureCseTable } from "@/lib/cse";

export const dynamic = "force-dynamic";

/**
 * Admin GET: List all CSE applications with complete unmasked details & statistics
 */
export async function GET(request: Request) {
  try {
    const official = await getCurrentOfficial();
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
        exam_level,
        exam_date,
        is_first_time,
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
    const official = await getCurrentOfficial();
    if (!official) {
      return NextResponse.json({ error: "Unauthorized. SK Official access required." }, { status: 401 });
    }

    await ensureCseTable();
    const body = await request.json();
    const { id, action } = body;

    if (!id || !action) {
      return NextResponse.json({ error: "Application ID and action are required." }, { status: 400 });
    }

    if (action === "update_status") {
      const { reimbursementStatus, adminNotes } = body;
      await sql`
        UPDATE cse_applications
        SET
          reimbursement_status = ${reimbursementStatus},
          admin_notes = ${adminNotes || null},
          updated_at = NOW()
        WHERE id = ${id}
      `;
      return NextResponse.json({ success: true, message: "Application status updated." });
    }

    if (action === "record_reimbursement") {
      const { voucherNo, payoutMethod, amount = 500, adminNotes } = body;
      if (!voucherNo) {
        return NextResponse.json({ error: "Disbursement Voucher (DV) number is required for audit liquidation." }, { status: 400 });
      }

      await sql`
        UPDATE cse_applications
        SET
          reimbursement_status = 'Reimbursed',
          reimbursement_amount = ${amount},
          disbursement_voucher_no = ${voucherNo},
          reimbursed_at = NOW(),
          reimbursed_by = ${official.name},
          payout_station_or_method = ${payoutMethod || 'Barangay Hall'},
          admin_notes = COALESCE(${adminNotes || null}, admin_notes),
          updated_at = NOW()
        WHERE id = ${id}
      `;
      return NextResponse.json({ success: true, message: "₱500 reimbursement recorded and logged for COA liquidation." });
    }

    if (action === "verify_attendance") {
      const { attendanceStatus, adminNotes } = body;
      await sql`
        UPDATE cse_applications
        SET
          attendance_status = ${attendanceStatus},
          attendance_verified_at = NOW(),
          admin_notes = COALESCE(${adminNotes || null}, admin_notes),
          updated_at = NOW()
        WHERE id = ${id}
      `;
      return NextResponse.json({ success: true, message: "Exam attendance status updated." });
    }

    if (action === "verify_result") {
      const { resultStatus, rating, isFeatured, adminNotes } = body;
      await sql`
        UPDATE cse_applications
        SET
          exam_result_status = ${resultStatus},
          rating = ${rating != null && rating !== '' ? Number(rating) : null},
          is_featured_in_hall_of_fame = ${isFeatured !== false},
          result_verified_at = NOW(),
          admin_notes = COALESCE(${adminNotes || null}, admin_notes),
          updated_at = NOW()
        WHERE id = ${id}
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
    const official = await getCurrentOfficial();
    if (!official) {
      return NextResponse.json({ error: "Unauthorized. SK Official access required." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Application ID is required." }, { status: 400 });
    }

    await sql`DELETE FROM cse_applications WHERE id = ${Number(id)}`;
    return NextResponse.json({ success: true, message: "Application deleted successfully." });
  } catch (error) {
    console.error("Error deleting CSE application:", error);
    return NextResponse.json({ error: "Failed to delete application." }, { status: 500 });
  }
}
