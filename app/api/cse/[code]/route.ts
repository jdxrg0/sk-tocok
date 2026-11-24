import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureCseTable } from "@/lib/cse";
import { saveUploadedFile } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * Public GET: Fetch single application details by tracking code
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    await ensureCseTable();
    const { code } = await params;
    const cleanCode = (code || "").trim().toUpperCase();

    const rows = await sql`
      SELECT 
        id,
        tracking_code,
        full_name,
        contact_number,
        email,
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
      WHERE UPPER(tracking_code) = ${cleanCode}
      LIMIT 1
    `;

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Tracking code not found. Please double-check your code." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      application: rows[0],
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
 * Public PATCH: Applicant self-service updates for Attendance Proof (Stage 3) and Exam Result (Stage 4)
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    await ensureCseTable();
    const { code } = await params;
    const cleanCode = (code || "").trim().toUpperCase();

    // Verify existing record
    const existingRows = await sql`
      SELECT id, tracking_code, birthdate, contact_number, reimbursement_status 
      FROM cse_applications 
      WHERE UPPER(tracking_code) = ${cleanCode}
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
      reimbursement_status: string;
    };

    const formData = await request.formData();
    const action = String(formData.get("action") || "").trim(); // "submit_attendance" | "submit_result"
    const verificationKey = String(formData.get("verificationKey") || "").trim(); // birthdate (YYYY-MM-DD) or last 4 digits of phone

    // Security check: Verify applicant identity
    const last4 = (app.contact_number || "").slice(-4);
    const birthMatch = app.birthdate && verificationKey === app.birthdate;
    const phoneMatch = last4 && verificationKey === last4;

    if (!birthMatch && !phoneMatch) {
      return NextResponse.json(
        { error: "Verification failed. Please enter your birthdate (YYYY-MM-DD) or the last 4 digits of your registered phone number." },
        { status: 403 }
      );
    }

    if (action === "submit_attendance") {
      const attendanceProofFile = formData.get("attendanceProof") as File | null;
      const notes = String(formData.get("notes") || "").trim() || null;

      if (!attendanceProofFile || attendanceProofFile.size === 0) {
        return NextResponse.json(
          { error: "Please upload your exam day proof (e.g. stamped ONSA slip or photo at testing center)." },
          { status: 400 }
        );
      }

      const savedFile = await saveUploadedFile(attendanceProofFile, "cse");

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
      const examResult = String(formData.get("examResult") || "Passed").trim(); // "Passed" | "Did Not Pass"
      const ratingStr = String(formData.get("rating") || "").trim();
      const rating = ratingStr ? parseFloat(ratingStr) : null;
      const resultProofFile = formData.get("resultProof") as File | null;
      const featureConsent = String(formData.get("featureConsent") || "true").toLowerCase() === "true";

      let resultProofUrl: string | null = null;
      if (resultProofFile && resultProofFile.size > 0) {
        const saved = await saveUploadedFile(resultProofFile, "cse");
        resultProofUrl = saved.filePath;
      }

      await sql`
        UPDATE cse_applications
        SET
          exam_result_status = ${examResult},
          rating = ${rating},
          result_proof_url = COALESCE(${resultProofUrl}, result_proof_url),
          is_featured_in_hall_of_fame = ${featureConsent},
          updated_at = NOW()
        WHERE id = ${app.id}
      `;

      return NextResponse.json({
        success: true,
        message: examResult === "Passed"
          ? "Congratulations on passing the Civil Service Exam! Your result has been submitted for validation."
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
