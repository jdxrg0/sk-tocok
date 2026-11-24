import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import {
  ensureCseTable,
  generateCseTrackingCode,
  DEFAULT_ANNUAL_SLOTS,
  DEFAULT_ANNUAL_BUDGET,
  DEFAULT_REIMBURSEMENT_AMOUNT,
  maskName,
  type ExamLevel,
  type PayoutPreference,
} from "@/lib/cse";
import { saveUploadedFile } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * Public GET: Fetch statistics, public transparency overview, and Hall of Fame passers
 */
export async function GET() {
  try {
    await ensureCseTable();

    const [settingsRows, statsRows, purokRows, passersRows, recentAppsRows] = await Promise.all([
      sql`
        SELECT key, value FROM settings 
        WHERE key IN ('cse_program_active', 'cse_slot_quota', 'cse_annual_budget', 'cse_target_exam_batch')
      `,
      sql`
        SELECT
          COUNT(*)::int as total_applications,
          COUNT(CASE WHEN reimbursement_status IN ('Approved for Payout', 'Reimbursed') THEN 1 END)::int as approved_or_reimbursed,
          COUNT(CASE WHEN reimbursement_status = 'Reimbursed' THEN 1 END)::int as reimbursed_count,
          COALESCE(SUM(CASE WHEN reimbursement_status = 'Reimbursed' THEN reimbursement_amount ELSE 0 END), 0)::numeric as total_reimbursed_amount,
          COUNT(CASE WHEN attendance_status = 'Verified Attended' THEN 1 END)::int as verified_attended,
          COUNT(CASE WHEN exam_result_status = 'Passed' THEN 1 END)::int as total_passers
        FROM cse_applications
      `,
      sql`
        SELECT purok, COUNT(*)::int as count
        FROM cse_applications
        WHERE reimbursement_status != 'Disapproved'
        GROUP BY purok
      `,
      sql`
        SELECT 
          id, 
          full_name, 
          purok, 
          exam_level, 
          exam_date, 
          rating, 
          result_verified_at
        FROM cse_applications
        WHERE exam_result_status = 'Passed' AND is_featured_in_hall_of_fame = TRUE
        ORDER BY result_verified_at DESC NULLS LAST, id DESC
      `,
      sql`
        SELECT 
          id, 
          tracking_code, 
          full_name, 
          purok, 
          exam_level, 
          exam_date,
          reimbursement_status, 
          attendance_status, 
          exam_result_status, 
          created_at
        FROM cse_applications
        ORDER BY created_at DESC
        LIMIT 10
      `,
    ]);

    const settingsMap = new Map<string, string>();
    for (const row of settingsRows as { key: string; value: string }[]) {
      settingsMap.set(row.key, row.value);
    }

    const quotaSlots = parseInt(settingsMap.get("cse_slot_quota") || String(DEFAULT_ANNUAL_SLOTS), 10);
    const totalBudget = parseFloat(settingsMap.get("cse_annual_budget") || String(DEFAULT_ANNUAL_BUDGET));
    const isProgramActive = (settingsMap.get("cse_program_active") || "true").toLowerCase() !== "false";
    const targetExamBatch = settingsMap.get("cse_target_exam_batch") || "March 2027 CSE-PPT";

    const stats = (statsRows[0] || {}) as {
      total_applications?: number;
      approved_or_reimbursed?: number;
      reimbursed_count?: number;
      total_reimbursed_amount?: number;
      verified_attended?: number;
      total_passers?: number;
    };

    const approvedOrReimbursed = stats.approved_or_reimbursed || 0;
    const reimbursedCount = stats.reimbursed_count || 0;
    const totalReimbursedAmount = Number(stats.total_reimbursed_amount || 0);
    const remainingSlots = Math.max(0, quotaSlots - approvedOrReimbursed);
    const remainingBudget = Math.max(0, totalBudget - totalReimbursedAmount);

    const purokBreakdown: Record<string, number> = {};
    for (const r of purokRows as { purok: string; count: number }[]) {
      purokBreakdown[r.purok] = Number(r.count || 0);
    }

    // Mask applicant names for public transparency feed
    const sanitizedRecent = (recentAppsRows as Array<{
      id: number;
      tracking_code: string;
      full_name: string;
      purok: string;
      exam_level: string;
      exam_date: string;
      reimbursement_status: string;
      attendance_status: string;
      exam_result_status: string;
      created_at: string;
    }>).map((app) => ({
      ...app,
      full_name: maskName(app.full_name),
    }));

    const user = await getCurrentUser();
    let myApplications: any[] = [];
    if (user) {
      myApplications = (await sql`
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
          user_id,
          user_email,
          created_at,
          updated_at
        FROM cse_applications 
        WHERE user_id = ${user.id} OR (email IS NOT NULL AND LOWER(email) = LOWER(${user.email}))
        ORDER BY created_at DESC
      `) as any[];
    }

    return NextResponse.json({
      success: true,
      program: {
        isActive: isProgramActive,
        quotaSlots,
        totalBudget,
        targetExamBatch,
        reimbursementAmount: DEFAULT_REIMBURSEMENT_AMOUNT,
      },
      stats: {
        quotaSlots,
        totalBudget,
        totalApplications: stats.total_applications || 0,
        approvedOrReimbursedCount: approvedOrReimbursed,
        reimbursedCount,
        totalReimbursedAmount,
        remainingSlots,
        remainingBudget,
        verifiedAttendedCount: stats.verified_attended || 0,
        totalPassers: stats.total_passers || 0,
        purokBreakdown,
      },
      recentApplications: sanitizedRecent,
      passers: passersRows,
      myApplications,
    });
  } catch (error) {
    console.error("Error fetching CSE data:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load Civil Service Program data." },
      { status: 500 }
    );
  }
}

/**
 * Public POST: Submit new application for ₱500 Civil Service Exam Reimbursement
 */
export async function POST(request: Request) {
  try {
    await ensureCseTable();

    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json(
        { error: "Authentication required. Please sign in or create an account first before applying for the CSE subsidy." },
        { status: 401 }
      );
    }

    const formData = await request.formData();

    const fullName = String(formData.get("fullName") || "").trim();
    const contactNumber = String(formData.get("contactNumber") || "").trim();
    const email = String(formData.get("email") || "").trim() || null;
    const facebookName = String(formData.get("facebookName") || "").trim() || null;
    const purok = String(formData.get("purok") || "").trim();
    const birthdate = String(formData.get("birthdate") || "").trim();
    const schoolOrEmployment = String(formData.get("schoolOrEmployment") || "").trim() || null;

    const examLevel = String(formData.get("examLevel") || "Professional").trim() as ExamLevel;
    const examDate = String(formData.get("examDate") || "").trim();
    const isFirstTime = String(formData.get("isFirstTime") || "true").toLowerCase() === "true";

    const payoutPreference = (String(
      formData.get("payoutPreference") || "Barangay Hall Cash Pickup"
    ).trim()) as PayoutPreference;
    const gcashNumber = String(formData.get("gcashNumber") || "").trim() || null;
    const gcashAccountName = String(formData.get("gcashAccountName") || "").trim() || null;

    const cscReceiptNo = String(formData.get("cscReceiptNo") || "").trim() || null;

    // Required files
    const validIdFile = formData.get("validId") as File | null;
    const cscReceiptFile = formData.get("cscReceipt") as File | null;
    const examScheduleFile = formData.get("examSchedule") as File | null;

    // Validation
    if (!fullName || !contactNumber || !purok || !birthdate || !examDate) {
      return NextResponse.json(
        { error: "Please fill in all required personal and exam fields." },
        { status: 400 }
      );
    }

    if (!validIdFile || validIdFile.size === 0) {
      return NextResponse.json(
        { error: "Valid ID / Proof of Residency is required." },
        { status: 400 }
      );
    }

    if (!cscReceiptFile || cscReceiptFile.size === 0) {
      return NextResponse.json(
        { error: "CSC Official Receipt (₱500) proof of payment is required." },
        { status: 400 }
      );
    }

    if (!examScheduleFile || examScheduleFile.size === 0) {
      return NextResponse.json(
        { error: "CSC Examination Slip / ONSA confirmation is required." },
        { status: 400 }
      );
    }

    if (payoutPreference === "GCash" && !gcashNumber) {
      return NextResponse.json(
        { error: "Please provide your GCash mobile number." },
        { status: 400 }
      );
    }

    // Validate Age (18 to 30 for Katipunan ng Kabataan eligibility for CSE)
    const birth = new Date(birthdate);
    if (isNaN(birth.getTime())) {
      return NextResponse.json({ error: "Invalid birthdate." }, { status: 400 });
    }
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }

    if (age < 18) {
      return NextResponse.json(
        { error: "Examinees must be at least 18 years old to take the Civil Service Exam." },
        { status: 400 }
      );
    }

    if (age > 30) {
      return NextResponse.json(
        { error: "This SK subsidy is specifically funded for Katipunan ng Kabataan members (aged 18-30)." },
        { status: 400 }
      );
    }

    // Check program active & quota status
    const settingsRows = await sql`
      SELECT key, value FROM settings WHERE key IN ('cse_program_active', 'cse_slot_quota')
    `;
    const settingsMap = new Map<string, string>();
    for (const r of settingsRows as { key: string; value: string }[]) {
      settingsMap.set(r.key, r.value);
    }

    if (settingsMap.get("cse_program_active") === "false") {
      return NextResponse.json(
        { error: "The CSE Subsidy Program is currently closed or has reached its program deadline." },
        { status: 400 }
      );
    }

    const quotaSlots = parseInt(settingsMap.get("cse_slot_quota") || String(DEFAULT_ANNUAL_SLOTS), 10);

    // Prevent duplicate application from same logged-in user for the same exam batch
    const existingUserApp = await sql`
      SELECT id, tracking_code, reimbursement_status FROM cse_applications 
      WHERE (user_id = ${currentUser.id} OR (email IS NOT NULL AND LOWER(email) = LOWER(${currentUser.email})))
        AND reimbursement_status NOT IN ('Disapproved')
        AND exam_date = ${examDate}
      LIMIT 1
    `;
    if (existingUserApp.length > 0) {
      return NextResponse.json(
        {
          error: `You already have an existing CSE subsidy application (${existingUserApp[0].tracking_code}) submitted for ${examDate}. Please track your application status instead.`,
        },
        { status: 400 }
      );
    }

    const existingCountRows = await sql`
      SELECT COUNT(*)::int as count FROM cse_applications 
      WHERE reimbursement_status IN ('Approved for Payout', 'Reimbursed')
    `;
    const approvedCount = Number((existingCountRows[0] as { count: number })?.count || 0);

    // Save uploaded files to Neon Postgres storage
    const [validIdSaved, cscReceiptSaved, examScheduleSaved] = await Promise.all([
      saveUploadedFile(validIdFile, "cse"),
      saveUploadedFile(cscReceiptFile, "cse"),
      saveUploadedFile(examScheduleFile, "cse"),
    ]);

    // Generate unique tracking code
    let trackingCode = generateCseTrackingCode();
    // Check for collision just in case
    for (let attempts = 0; attempts < 5; attempts++) {
      const existing = await sql`SELECT id FROM cse_applications WHERE tracking_code = ${trackingCode}`;
      if (existing.length === 0) break;
      trackingCode = generateCseTrackingCode();
    }

    const isWaitlisted = approvedCount >= quotaSlots;
    const initialStatus = isWaitlisted ? "Pending Review" : "Pending Review";
    const initialNote = isWaitlisted
      ? "Submitted under waitlist (quota reached); pending council review."
      : null;

    const applicantEmail = email || currentUser.email;

    const inserted = await sql`
      INSERT INTO cse_applications (
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
        admin_notes,
        user_id,
        user_email
      ) VALUES (
        ${trackingCode},
        ${fullName},
        ${contactNumber},
        ${applicantEmail},
        ${facebookName},
        ${purok},
        ${birthdate},
        ${age},
        ${schoolOrEmployment},
        ${examLevel},
        ${examDate},
        ${isFirstTime},
        ${payoutPreference},
        ${gcashNumber},
        ${gcashAccountName},
        ${validIdSaved.filePath},
        ${cscReceiptSaved.filePath},
        ${cscReceiptNo},
        ${examScheduleSaved.filePath},
        ${initialStatus},
        ${DEFAULT_REIMBURSEMENT_AMOUNT},
        ${initialNote},
        ${currentUser.id},
        ${currentUser.email}
      )
      RETURNING id, tracking_code
    `;

    return NextResponse.json({
      success: true,
      trackingCode: inserted[0].tracking_code,
      message:
        "Application submitted successfully! Please save your tracking code to monitor your ₱500 reimbursement and upload your exam day & result proofs.",
    });
  } catch (error) {
    console.error("Error submitting CSE application:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred while processing your application." },
      { status: 500 }
    );
  }
}
