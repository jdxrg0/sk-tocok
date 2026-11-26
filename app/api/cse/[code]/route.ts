import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getCurrentUser, isOfficialUser } from "@/lib/auth";
import { ensureCseTable, getExamCycleGate, maskName } from "@/lib/cse";
import { saveUploadedFile } from "@/lib/storage";
import { validateUploadedFile } from "@/lib/fileValidation";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/rateLimit";
import { logSecurityEvent } from "@/lib/securityLogger";
import { sanitizeText } from "@/lib/validation";

export const dynamic = "force-dynamic";

function isApplicationOwnerOrOfficial(
  user: { id: number; email: string; role: string } | null,
  row: { user_id?: number | null; user_email?: string | null; email?: string | null }
): boolean {
  if (!user) return false;
  if (isOfficialUser(user)) return true;
  if (row.user_id !== null && row.user_id !== undefined && Number(row.user_id) === user.id) {
    return true;
  }
  const normalizedUserEmail = user.email.trim().toLowerCase();
  if (row.user_email && String(row.user_email).trim().toLowerCase() === normalizedUserEmail) {
    return true;
  }
  return false;
}

/**
 * GET: Fetch application details by tracking code.
 * Full PII and document URLs are returned ONLY to the verified owner or SK Officials.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const limit = await checkRateLimit({
      request,
      bucket: "cse_lookup",
      max: 30,
      windowMs: 15 * 60 * 1000,
    });
    if (!limit.allowed) {
      return rateLimitExceededResponse(limit.retryAfterSeconds);
    }

    await ensureCseTable();
    const { code } = await params;
    const cleanCode = sanitizeText(code, 40).toUpperCase();
    if (!cleanCode) {
      return NextResponse.json(
        { success: false, error: "Invalid tracking code." },
        { status: 400 }
      );
    }

    const rows = await sql`
      SELECT
        id, tracking_code, full_name, contact_number, email, purok,
        birthdate, age, school_or_employment, exam_category, exam_level, exam_date, exam_fee_paid, is_first_time,
        prior_sitting_proof_url, peer_review_attended,
        payout_preference, gcash_number, gcash_account_name,
        valid_id_url, csc_receipt_url, csc_receipt_no, exam_schedule_proof_url,
        reimbursement_status, reimbursement_amount, disbursement_voucher_no,
        reimbursed_at, payout_station_or_method, admin_notes,
        attendance_status, exam_attendance_proof_url, exam_attendance_notes,
        attendance_verified_at, exam_result_status, rating, result_proof_url,
        passer_avatar_url, is_featured_in_hall_of_fame, result_verified_at,
        user_id, user_email, created_at, updated_at
      FROM cse_applications
      WHERE UPPER(tracking_code) = ${cleanCode}
      LIMIT 1
    `;

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Tracking code not found. Please double-check your code." },
        { status: 404 }
      );
    }

    const row = rows[0] as Record<string, unknown> & {
      id: number;
      tracking_code: string;
      full_name: string;
      user_id?: number | null;
      user_email?: string | null;
      email?: string | null;
    };

    const currentUser = await getCurrentUser(request);
    const canViewFull = isApplicationOwnerOrOfficial(currentUser, row);

    if (canViewFull) {
      const safeFull = { ...row };
      delete safeFull.user_id;
      delete safeFull.user_email;
      return NextResponse.json({
        success: true,
        isOwner: true,
        application: { ...safeFull, is_owner: true },
      });
    }

    // Public non-PII status summary only (protects resident IDs, phones, birthdates, GCash)
    return NextResponse.json({
      success: true,
      isOwner: false,
      application: {
        id: row.id,
        tracking_code: row.tracking_code,
        full_name: maskName(String(row.full_name || "")),
        purok: row.purok,
        exam_category: row.exam_category || "Civil Service Exam (CSE)",
        exam_level: row.exam_level,
        exam_date: row.exam_date,
        exam_fee_paid: row.exam_fee_paid ?? row.reimbursement_amount,
        is_first_time: row.is_first_time,
        reimbursement_status: row.reimbursement_status,
        reimbursement_amount: row.reimbursement_amount,
        reimbursed_at: row.reimbursed_at,
        attendance_status: row.attendance_status,
        attendance_verified_at: row.attendance_verified_at,
        exam_result_status: row.exam_result_status,
        rating: row.rating,
        result_verified_at: row.result_verified_at,
        created_at: row.created_at,
        updated_at: row.updated_at,
        is_owner: false,
      },
    });
  } catch (error) {
    console.error("Error looking up CSE application:", error);
    return NextResponse.json(
      { success: false, error: "Failed to query tracking code." },
      { status: 500 }
    );
  }
}

/**
 * Authenticated PATCH: Applicant owner self-service updates for Attendance Proof (Stage 3) and Exam Result (Stage 4)
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const limit = await checkRateLimit({
      request,
      bucket: "cse_self_update",
      max: 15,
      windowMs: 15 * 60 * 1000,
      persistToDb: true,
    });
    if (!limit.allowed) {
      return rateLimitExceededResponse(limit.retryAfterSeconds);
    }

    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json(
        { error: "Please sign in with your applicant account before updating proof documents." },
        { status: 401 }
      );
    }

    await ensureCseTable();
    const { code } = await params;
    const cleanCode = sanitizeText(code, 40).toUpperCase();

    const existingRows = await sql`
      SELECT id, tracking_code, birthdate, contact_number, exam_date, attendance_status, exam_result_status, reimbursement_status, result_verified_at, user_id, user_email
      FROM cse_applications
      WHERE UPPER(tracking_code) = ${cleanCode}
      LIMIT 1
    `;

    if (existingRows.length === 0) {
      return NextResponse.json(
        { error: "Application tracking code not found." },
        { status: 404 }
      );
    }

    const app = existingRows[0] as {
      id: number;
      tracking_code: string;
      birthdate: string;
      contact_number: string;
      exam_date: string;
      attendance_status: string;
      exam_result_status: string;
      reimbursement_status: string;
      result_verified_at?: string | null;
      user_id?: number | null;
      user_email?: string | null;
    };

    if (!isApplicationOwnerOrOfficial(currentUser, app)) {
      await logSecurityEvent({
        eventType: "IDOR_CSE_PATCH_BLOCKED",
        severity: "high",
        request,
        userId: currentUser.id,
        email: currentUser.email,
        details: { trackingCode: cleanCode },
      });
      return NextResponse.json(
        { error: "Forbidden: you are not the registered owner of this application." },
        { status: 403 }
      );
    }

    if (app.reimbursement_status === "Disapproved") {
      return NextResponse.json(
        { error: "Disapproved applications cannot submit exam attendance or results." },
        { status: 400 }
      );
    }

    const examGate = getExamCycleGate(app.exam_date);
    const formData = await request.formData();
    const action = sanitizeText(formData.get("action"), 40);

    if (action === "submit_attendance") {
      if (examGate.locked) {
        return NextResponse.json(
          { error: `Exam-day attendance proof can only be uploaded once your scheduled exam cycle (${app.exam_date}) begins.` },
          { status: 400 }
        );
      }
      if (app.attendance_status === "Attendance Submitted") {
        return NextResponse.json(
          { error: "Your exam attendance proof has already been uploaded and is awaiting SK Official verification." },
          { status: 409 }
        );
      }
      if (app.attendance_status === "Verified Attended") {
        return NextResponse.json(
          { error: "Your exam attendance has already been verified." },
          { status: 409 }
        );
      }
      if (app.attendance_status !== "Not Yet Taken") {
        return NextResponse.json(
          { error: "Attendance proof cannot be uploaded for your current attendance status." },
          { status: 400 }
        );
      }

      const attendanceProofFile = formData.get("attendanceProof") as File | null;
      const notes = sanitizeText(formData.get("notes"), 1000) || null;

      const fileCheck = await validateUploadedFile(attendanceProofFile, "cse_doc");
      if (!fileCheck.ok) {
        await logSecurityEvent({
          eventType: "UPLOAD_REJECTED",
          severity: "warning",
          request,
          userId: currentUser.id,
          details: { category: "cse_attendance", reason: fileCheck.reason },
        });
        return NextResponse.json({ error: fileCheck.error }, { status: 400 });
      }

      const savedFile = await saveUploadedFile(attendanceProofFile!, "cse");

      await sql`
        UPDATE cse_applications
        SET
          attendance_status = 'Attendance Submitted',
          exam_attendance_proof_url = ${savedFile.filePath},
          exam_attendance_notes = ${notes},
          updated_at = NOW()
        WHERE id = ${app.id}
      `;

      return NextResponse.json({
        success: true,
        message: "Exam attendance proof submitted successfully! SK officials will verify your attendance.",
      });
    }

    if (action === "submit_result") {
      if (examGate.locked) {
        return NextResponse.json(
          { error: `Exam results cannot be submitted yet — your scheduled exam cycle (${app.exam_date}) has not started.` },
          { status: 400 }
        );
      }
      if (app.attendance_status !== "Verified Attended") {
        return NextResponse.json(
          { error: "Your exam-day attendance proof must be verified by an SK Official before submitting exam results." },
          { status: 400 }
        );
      }
      if (app.exam_result_status !== "Awaiting Results") {
        return NextResponse.json(
          { error: "Your exam result has already been submitted and cannot be overwritten repeatedly." },
          { status: 409 }
        );
      }

      const rawExamResult = sanitizeText(formData.get("examResult") || "Passed", 30);
      if (rawExamResult !== "Passed" && rawExamResult !== "Did Not Pass") {
        return NextResponse.json({ error: "Invalid exam result status." }, { status: 400 });
      }

      const ratingStr = sanitizeText(formData.get("rating"), 20);
      let rating: number | null = null;
      if (ratingStr) {
        const parsed = parseFloat(ratingStr);
        if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
          return NextResponse.json({ error: "Rating must be a number between 0 and 100." }, { status: 400 });
        }
        rating = Math.round(parsed * 100) / 100;
      }

      const resultProofFile = formData.get("resultProof") as File | null;
      const passerAvatarFile = formData.get("passerAvatar") as File | null;
      const featureConsent = String(formData.get("featureConsent") || "true").toLowerCase() === "true";

      let resultProofUrl: string | null = null;
      if (resultProofFile && resultProofFile.size > 0) {
        const fileCheck = await validateUploadedFile(resultProofFile, "cse_doc");
        if (!fileCheck.ok) {
          await logSecurityEvent({
            eventType: "UPLOAD_REJECTED",
            severity: "warning",
            request,
            userId: currentUser.id,
            details: { category: "cse_result", reason: fileCheck.reason },
          });
          return NextResponse.json({ error: fileCheck.error }, { status: 400 });
        }
        const saved = await saveUploadedFile(resultProofFile, "cse");
        resultProofUrl = saved.filePath;
      }

      let passerAvatarUrl: string | null = null;
      if (passerAvatarFile && passerAvatarFile.size > 0) {
        const avatarCheck = await validateUploadedFile(passerAvatarFile, "avatar");
        if (!avatarCheck.ok) {
          await logSecurityEvent({
            eventType: "UPLOAD_REJECTED",
            severity: "warning",
            request,
            userId: currentUser.id,
            details: { category: "cse_passer_avatar", reason: avatarCheck.reason },
          });
          return NextResponse.json({ error: avatarCheck.error }, { status: 400 });
        }
        const savedAvatar = await saveUploadedFile(passerAvatarFile, "passers");
        passerAvatarUrl = savedAvatar.filePath;
      }

      await sql`
        UPDATE cse_applications
        SET
          exam_result_status = ${rawExamResult},
          rating = ${rating},
          result_proof_url = COALESCE(${resultProofUrl}, result_proof_url),
          passer_avatar_url = COALESCE(${passerAvatarUrl}, passer_avatar_url),
          is_featured_in_hall_of_fame = ${featureConsent},
          result_verified_at = NULL,
          updated_at = NOW()
        WHERE id = ${app.id}
      `;

      return NextResponse.json({
        success: true,
        message:
          rawExamResult === "Passed"
            ? "Exam result submitted! An SK Official will verify your proof before featuring you on the Hall of Fame."
            : "Thank you for updating your exam record. Keep striving for public service!",
      });
    }

    return NextResponse.json(
      { error: "Invalid action specified." },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error updating CSE application:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred while updating the application." },
      { status: 500 }
    );
  }
}
