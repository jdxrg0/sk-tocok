import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getCurrentUser, isOfficialUser } from "@/lib/auth";
import {
  ensureCseTable,
  generateCseTrackingCode,
  DEFAULT_ANNUAL_SLOTS,
  DEFAULT_ANNUAL_BUDGET,
  DEFAULT_REIMBURSEMENT_AMOUNT,
  MAX_EXAM_SUBSIDY_CAP,
  RETAKER_SLOT_RATIO,
  resolveExamFeeAndSubsidy,
  EXAM_CATEGORY_OPTIONS,
  maskName,
  type ExamCategory,
  type ExamLevel,
  type PayoutPreference,
} from "@/lib/cse";
import { saveUploadedFile } from "@/lib/storage";
import { validateUploadedFile } from "@/lib/fileValidation";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/rateLimit";
import { logSecurityEvent } from "@/lib/securityLogger";
import { isValidDateYMD, isValidEmail, isValidPhoneNumber, sanitizeText } from "@/lib/validation";

export const dynamic = "force-dynamic";

function maskTrackingCode(code: string): string {
  const clean = String(code || "").trim();
  if (clean.length <= 6) return "******";
  return `${clean.slice(0, 7)}****${clean.slice(-2)}`;
}

/**
 * Public GET: Fetch statistics, public transparency overview, and Hall of Fame passers
 */
export async function GET(request: Request) {
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
          COUNT(CASE WHEN exam_result_status = 'Passed' AND result_verified_at IS NOT NULL THEN 1 END)::int as total_passers,
          COUNT(CASE WHEN is_first_time = FALSE AND reimbursement_status != 'Disapproved' THEN 1 END)::int as retaker_slots_used
        FROM cse_applications
      `,
      sql`
        SELECT purok, COUNT(*)::int as count
        FROM cse_applications
        WHERE exam_result_status = 'Passed'
          AND result_verified_at IS NOT NULL
        GROUP BY purok
      `,
      sql`
        SELECT 
          c.id, 
          c.full_name, 
          c.purok, 
          c.exam_category,
          c.exam_level, 
          c.exam_date, 
          c.rating, 
          c.result_verified_at,
          COALESCE(
            c.passer_avatar_url,
            (
              SELECT u.avatar_url
              FROM users u
              WHERE (c.user_id IS NOT NULL AND u.id = c.user_id)
                 OR (c.user_email IS NOT NULL AND LOWER(u.email) = LOWER(c.user_email))
              ORDER BY CASE WHEN c.user_id IS NOT NULL AND u.id = c.user_id THEN 0 ELSE 1 END
              LIMIT 1
            )
          ) AS avatar_url
        FROM cse_applications c
        WHERE c.exam_result_status = 'Passed'
          AND c.result_verified_at IS NOT NULL
          AND c.is_featured_in_hall_of_fame = TRUE
        ORDER BY c.result_verified_at DESC NULLS LAST, c.id DESC
      `,
      sql`
        SELECT 
          id, 
          tracking_code, 
          full_name, 
          purok, 
          exam_category,
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
      retaker_slots_used?: number;
    };

    const approvedOrReimbursed = stats.approved_or_reimbursed || 0;
    const reimbursedCount = stats.reimbursed_count || 0;
    const totalReimbursedAmount = Number(stats.total_reimbursed_amount || 0);
    const remainingSlots = Math.max(0, quotaSlots - approvedOrReimbursed);
    const remainingBudget = Math.max(0, totalBudget - totalReimbursedAmount);
    const retakerSlotCap = Math.max(1, Math.floor(quotaSlots * RETAKER_SLOT_RATIO));
    const retakerSlotsUsed = Number(stats.retaker_slots_used || 0);

    const purokBreakdown: Record<string, number> = {};
    for (const r of purokRows as { purok: string; count: number }[]) {
      purokBreakdown[r.purok] = Number(r.count || 0);
    }

    // Mask applicant names and tracking codes for public transparency feed
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
      tracking_code: maskTrackingCode(app.tracking_code),
      full_name: maskName(app.full_name),
    }));

    const user = await getCurrentUser(request);
    let myApplications: Record<string, unknown>[] = [];
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
          passer_avatar_url,
          is_featured_in_hall_of_fame,
          result_verified_at,
          user_id,
          user_email,
          created_at,
          updated_at
        FROM cse_applications 
        WHERE user_id = ${user.id} OR (email IS NOT NULL AND LOWER(email) = LOWER(${user.email}))
        ORDER BY created_at DESC
      `) as Record<string, unknown>[];
    }

    return NextResponse.json({
      success: true,
      program: {
        isActive: isProgramActive,
        quotaSlots,
        totalBudget,
        targetExamBatch,
        reimbursementAmount: DEFAULT_REIMBURSEMENT_AMOUNT,
        maxSubsidyCap: MAX_EXAM_SUBSIDY_CAP,
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
        retakerSlotCap,
        retakerSlotsUsed,
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
    const limit = await checkRateLimit({
      request,
      bucket: "cse_submit",
      max: 8,
      windowMs: 60 * 60 * 1000,
      persistToDb: true,
    });
    if (!limit.allowed) {
      return rateLimitExceededResponse(limit.retryAfterSeconds);
    }

    await ensureCseTable();

    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json(
        { error: "Authentication required. Please sign in or create an account first before applying for the exam fee subsidy." },
        { status: 401 }
      );
    }

    // Conflict-of-interest exclusion: Incumbent SK Officials cannot claim during their term
    if (isOfficialUser(currentUser)) {
      return NextResponse.json(
        {
          error:
            "Conflict-of-interest exclusion: Incumbent Sangguniang Kabataan officials are disqualified from availing of exam fee subsidies during their term.",
        },
        { status: 403 }
      );
    }

    const formData = await request.formData();

    const fullName = sanitizeText(formData.get("fullName"), 120);
    const contactNumber = sanitizeText(formData.get("contactNumber"), 30);
    const email = sanitizeText(formData.get("email"), 254).toLowerCase() || null;
    const facebookName = sanitizeText(formData.get("facebookName"), 100) || null;
    const purok = sanitizeText(formData.get("purok"), 60);
    const birthdate = sanitizeText(formData.get("birthdate"), 20);
    const schoolOrEmployment = sanitizeText(formData.get("schoolOrEmployment"), 150) || null;

    const rawCategory = sanitizeText(formData.get("examCategory") || "Civil Service Exam (CSE)", 80);
    const matchedCategory = EXAM_CATEGORY_OPTIONS.find((c) => c.id === rawCategory);
    if (!matchedCategory) {
      return NextResponse.json(
        { error: "Selected examination program is not supported." },
        { status: 400 }
      );
    }
    const examCategory: ExamCategory = matchedCategory.id;

    const rawExamLevel = sanitizeText(formData.get("examLevel") || "Professional", 100);
    const examLevel = (rawExamLevel || "Professional") as ExamLevel;
    const examDate = sanitizeText(formData.get("examDate"), 60);
    const rawFeeValue = formData.get("examFeePaid") || matchedCategory?.defaultFee || DEFAULT_REIMBURSEMENT_AMOUNT;
    if (!matchedCategory?.isFixedFee) {
      const numericFee = Number(rawFeeValue);
      if (!Number.isFinite(numericFee) || numericFee <= 0 || numericFee > 50000) {
        return NextResponse.json({ error: "Please enter a valid examination fee amount." }, { status: 400 });
      }
    }
    const { examFeePaid, subsidyAmount } = resolveExamFeeAndSubsidy(
      examCategory,
      rawFeeValue as string
    );

    const isFirstTime = String(formData.get("isFirstTime") || "true").toLowerCase() === "true";

    const rawPref = sanitizeText(formData.get("payoutPreference") || "Barangay Hall Cash Pickup", 60);
    const payoutPreference = (rawPref === "GCash" ? "GCash" : "Barangay Hall Cash Pickup") as PayoutPreference;
    const gcashNumber = sanitizeText(formData.get("gcashNumber"), 30) || null;
    const gcashAccountName = sanitizeText(formData.get("gcashAccountName"), 100) || null;

    const cscReceiptNo = sanitizeText(formData.get("cscReceiptNo"), 64) || null;

    // Required files
    const validIdFile = formData.get("validId") as File | null;
    const cscReceiptFile = formData.get("cscReceipt") as File | null;
    const examScheduleFile = formData.get("examSchedule") as File | null;
    const priorSittingProofFile = formData.get("priorSittingProof") as File | null;

    // Validation
    if (!fullName || fullName.length < 2 || !contactNumber || !purok || !birthdate || !examDate) {
      return NextResponse.json(
        { error: "Please fill in all required personal and exam fields." },
        { status: 400 }
      );
    }
    if (!isValidPhoneNumber(contactNumber)) {
      return NextResponse.json({ error: "Please enter a valid contact number." }, { status: 400 });
    }
    if (email && !isValidEmail(email)) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }
    if (!isValidDateYMD(birthdate)) {
      return NextResponse.json({ error: "Invalid birthdate format (expected YYYY-MM-DD)." }, { status: 400 });
    }

    const validIdCheck = await validateUploadedFile(validIdFile, "cse_doc");
    if (!validIdCheck.ok) {
      await logSecurityEvent({ eventType: "UPLOAD_REJECTED", severity: "warning", request, userId: currentUser.id, details: { category: "cse_valid_id", reason: validIdCheck.reason } });
      return NextResponse.json({ error: `Valid ID: ${validIdCheck.error}` }, { status: 400 });
    }
    const receiptCheck = await validateUploadedFile(cscReceiptFile, "cse_doc");
    if (!receiptCheck.ok) {
      await logSecurityEvent({ eventType: "UPLOAD_REJECTED", severity: "warning", request, userId: currentUser.id, details: { category: "cse_receipt", reason: receiptCheck.reason } });
      return NextResponse.json({ error: `CSC Receipt: ${receiptCheck.error}` }, { status: 400 });
    }
    const scheduleCheck = await validateUploadedFile(examScheduleFile, "cse_doc");
    if (!scheduleCheck.ok) {
      await logSecurityEvent({ eventType: "UPLOAD_REJECTED", severity: "warning", request, userId: currentUser.id, details: { category: "cse_schedule", reason: scheduleCheck.reason } });
      return NextResponse.json({ error: `Exam Schedule Slip: ${scheduleCheck.error}` }, { status: 400 });
    }

    if (!isFirstTime) {
      const priorCheck = await validateUploadedFile(priorSittingProofFile, "cse_doc");
      if (!priorCheck.ok) {
        await logSecurityEvent({ eventType: "UPLOAD_REJECTED", severity: "warning", request, userId: currentUser.id, details: { category: "cse_prior_sitting", reason: priorCheck.reason } });
        return NextResponse.json(
          {
            error: `Prior Exam Sitting Proof (Stamped NOA / Result): ${priorCheck.error}`,
          },
          { status: 400 }
        );
      }
    }

    if (payoutPreference === "GCash" && (!gcashNumber || !isValidPhoneNumber(gcashNumber))) {
      return NextResponse.json(
        { error: "Please provide a valid GCash mobile number." },
        { status: 400 }
      );
    }

    // Validate Age (15 to 30 Katipunan ng Kabataan; 18+ for CSE & PRC Board Exams)
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

    const minAgeForExam = matchedCategory?.minAge ?? 15;
    if (age < minAgeForExam) {
      return NextResponse.json(
        {
          error:
            minAgeForExam >= 18
              ? `Examinees must be at least 18 years old for ${examCategory}.`
              : "Examinees must be at least 15 years old to qualify as a Katipunan ng Kabataan member.",
        },
        { status: 400 }
      );
    }

    if (age > 30) {
      return NextResponse.json(
        { error: "This SK subsidy is specifically funded for Katipunan ng Kabataan members aged 15–30 on exam day." },
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
        { error: "The Exam Fee Subsidy Program is currently closed or has reached its program deadline." },
        { status: 400 }
      );
    }

    const quotaSlots = parseInt(settingsMap.get("cse_slot_quota") || String(DEFAULT_ANNUAL_SLOTS), 10);

    // Enforce 3-year SK term cap: 1st-time attempt + hard limit of 1 retake (max 2 active slots per person)
    const priorPersonApps = (await sql`
      SELECT id, tracking_code, exam_date, attendance_status, exam_result_status
      FROM cse_applications
      WHERE reimbursement_status != 'Disapproved'
        AND (
          user_id = ${currentUser.id}
          OR (email IS NOT NULL AND LOWER(email) = LOWER(${currentUser.email}))
          OR (LOWER(TRIM(full_name)) = LOWER(TRIM(${fullName})) AND birthdate = ${birthdate})
        )
      ORDER BY created_at DESC
    `) as Array<{
      id: number;
      tracking_code: string;
      exam_date: string;
      attendance_status: string;
      exam_result_status: string;
    }>;

    const sameBatch = priorPersonApps.find((a) => a.exam_date === examDate);
    if (sameBatch) {
      return NextResponse.json(
        {
          error: `You already have an existing exam subsidy application (${sameBatch.tracking_code}) submitted for ${examDate}. Please track your application status instead.`,
        },
        { status: 400 }
      );
    }

    if (priorPersonApps.some((a) => a.exam_result_status === "Passed")) {
      return NextResponse.json(
        {
          error:
            "You already have a verified passing CSE record under this program and are no longer eligible for additional exam fee subsidies.",
        },
        { status: 400 }
      );
    }

    if (priorPersonApps.some((a) => a.attendance_status === "Did Not Attend")) {
      return NextResponse.json(
        {
          error:
            "Applicants who no-showed on a prior subsidized exam are ineligible for another slot under CBYDP rules.",
        },
        { status: 400 }
      );
    }

    if (priorPersonApps.length >= 2) {
      return NextResponse.json(
        {
          error:
            "Term limit reached: Assistance is strictly capped at 1 first-time attempt plus a hard limit of 1 retake (max 2 slots) per person across the 3-year SK term.",
        },
        { status: 400 }
      );
    }

    if (isFirstTime && priorPersonApps.length >= 1) {
      return NextResponse.json(
        {
          error:
            "You already have a prior exam subsidy record. Please select 'Retaker' and attach your stamped Notice of Admission / prior test result proving you sat for your first exam.",
        },
        { status: 400 }
      );
    }

    // 80/20 Slot Split: 80% reserved for first-timers, max 20% for qualified retakers
    if (!isFirstTime) {
      const retakeCap = Math.max(1, Math.floor(quotaSlots * RETAKER_SLOT_RATIO));
      const retakerCountRows = await sql`
        SELECT COUNT(*)::int as count FROM cse_applications
        WHERE is_first_time = FALSE AND reimbursement_status != 'Disapproved'
      `;
      const retakerCount = Number((retakerCountRows[0] as { count: number })?.count || 0);
      if (retakerCount >= retakeCap) {
        return NextResponse.json(
          {
            error: `Retake slot cap reached (${retakerCount} of ${retakeCap} slots / 20% max). Remaining annual slots are reserved for first-time examinees.`,
          },
          { status: 400 }
        );
      }
    }

    const existingCountRows = await sql`
      SELECT COUNT(*)::int as count FROM cse_applications 
      WHERE reimbursement_status IN ('Approved for Payout', 'Reimbursed')
    `;
    const approvedCount = Number((existingCountRows[0] as { count: number })?.count || 0);

    // Save uploaded files to Neon Postgres storage
    const [validIdSaved, cscReceiptSaved, examScheduleSaved, priorSittingSaved] = await Promise.all([
      saveUploadedFile(validIdFile!, "cse"),
      saveUploadedFile(cscReceiptFile!, "cse"),
      saveUploadedFile(examScheduleFile!, "cse"),
      !isFirstTime && priorSittingProofFile
        ? saveUploadedFile(priorSittingProofFile, "cse")
        : Promise.resolve(null),
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
        ${examCategory},
        ${examLevel},
        ${examDate},
        ${examFeePaid},
        ${isFirstTime},
        ${priorSittingSaved ? priorSittingSaved.filePath : null},
        ${false},
        ${payoutPreference},
        ${gcashNumber},
        ${gcashAccountName},
        ${validIdSaved.filePath},
        ${cscReceiptSaved.filePath},
        ${cscReceiptNo},
        ${examScheduleSaved.filePath},
        ${initialStatus},
        ${subsidyAmount},
        ${initialNote},
        ${currentUser.id},
        ${currentUser.email}
      )
      RETURNING id, tracking_code
    `;

    return NextResponse.json({
      success: true,
      trackingCode: inserted[0].tracking_code,
      subsidyAmount,
      message: `Application submitted! Save your tracking code to monitor your ₱${subsidyAmount.toLocaleString()} post-exam subsidy and upload your test-day & result proofs.`,
    });
  } catch (error) {
    console.error("Error submitting CSE application:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred while processing your application." },
      { status: 500 }
    );
  }
}
