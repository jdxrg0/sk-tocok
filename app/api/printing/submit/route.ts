import crypto from "crypto";
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { savePrintDocument } from "@/lib/googleDrive";
import { getCurrentUser } from "@/lib/auth";
import { validateUploadedFile } from "@/lib/fileValidation";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/rateLimit";
import { logSecurityEvent } from "@/lib/securityLogger";
import { PAPER_SIZES, PRINT_TYPES, sanitizeText } from "@/lib/validation";

export const dynamic = "force-dynamic";

const TRACKING_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

async function generateTrackingCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    let rand = "";
    for (let i = 0; i < 6; i++) {
      rand += TRACKING_ALPHABET.charAt(crypto.randomInt(0, TRACKING_ALPHABET.length));
    }
    const candidate = `SK-${rand}`;
    try {
      const existing = await sql`
        SELECT id FROM print_requests WHERE UPPER(tracking_code) = ${candidate} LIMIT 1
      `;
      if (existing.length === 0) return candidate;
    } catch (err) {
      console.warn("Failed to check tracking code uniqueness, retrying:", err);
    }
  }

  let fallback = "";
  for (let i = 0; i < 8; i++) {
    fallback += TRACKING_ALPHABET.charAt(crypto.randomInt(0, TRACKING_ALPHABET.length));
  }
  return `SK-${fallback}`;
}

export async function POST(request: Request) {
  try {
    const limit = await checkRateLimit({
      request,
      bucket: "printing_submit",
      max: 12,
      windowMs: 60 * 60 * 1000,
      persistToDb: true,
    });
    if (!limit.allowed) {
      return rateLimitExceededResponse(limit.retryAfterSeconds);
    }

    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json(
        { error: "You must be logged in to submit a print request. Please sign in or create an account." },
        { status: 401 }
      );
    }

    const activeSettingRows = await sql`SELECT value FROM settings WHERE key = 'printing_active'`;
    const activeSetting = activeSettingRows[0] as { value: string } | undefined;
    if (activeSetting && activeSetting.value === "false") {
      return NextResponse.json(
        { error: "The Free Student Printing Program has reached its monthly supply limit. It will resume next month upon budget allocation." },
        { status: 400 }
      );
    }

    const formData = await request.formData();

    const student_name = sanitizeText(formData.get("student_name"), 120);
    const contact_number = sanitizeText(formData.get("contact_number"), 30);
    const facebook_name = sanitizeText(formData.get("facebook_name"), 100);
    const purok = sanitizeText(formData.get("purok"), 60);
    const school = sanitizeText(formData.get("school"), 150);
    const grade_level = sanitizeText(formData.get("grade_level"), 60);
    const print_type = sanitizeText(formData.get("print_type"), 40);
    const paper_size = sanitizeText(formData.get("paper_size"), 40);
    const rawCopies = parseInt(String(formData.get("copies") || "1"), 10);
    const page_range = sanitizeText(formData.get("page_range") || "All pages", 60) || "All pages";
    const notes = sanitizeText(formData.get("notes"), 1000);
    const pickup_station = sanitizeText(formData.get("pickup_station"), 120);
    const is_urgent = formData.get("is_urgent") === "true" || formData.get("is_urgent") === "1" ? 1 : 0;
    const file = formData.get("file") as File | null;

    if (!student_name || !purok || !grade_level) {
      return NextResponse.json({ error: "Please fill out all required student information fields." }, { status: 400 });
    }

    if (!PRINT_TYPES.includes(print_type as (typeof PRINT_TYPES)[number])) {
      return NextResponse.json({ error: "Please select a valid print color (Black & White or Colored)." }, { status: 400 });
    }

    if (!PAPER_SIZES.includes(paper_size as (typeof PAPER_SIZES)[number])) {
      return NextResponse.json({ error: "Please select a valid bond paper size (A4, Letter (Short), or Legal (Long))." }, { status: 400 });
    }

    if (!Number.isInteger(rawCopies) || rawCopies < 1 || rawCopies > 500) {
      return NextResponse.json({ error: "Number of copies must be between 1 and 500." }, { status: 400 });
    }

    if (!pickup_station) {
      return NextResponse.json({ error: "Please select your preferred claiming station." }, { status: 400 });
    }

    const fileValidation = await validateUploadedFile(file, "print_doc");
    if (!fileValidation.ok) {
      await logSecurityEvent({
        eventType: "UPLOAD_REJECTED",
        severity: "warning",
        request,
        userId: currentUser.id,
        details: { category: "print_doc", reason: fileValidation.reason },
      });
      return NextResponse.json({ error: fileValidation.error }, { status: 400 });
    }

    const { filePath, fileName, fileSize } = await savePrintDocument(file!);

    let trackingCode = await generateTrackingCode();
    let codeExists = await sql`SELECT id FROM print_requests WHERE UPPER(tracking_code) = ${trackingCode.toUpperCase()}`;
    while (codeExists.length > 0) {
      trackingCode = await generateTrackingCode();
      codeExists = await sql`SELECT id FROM print_requests WHERE UPPER(tracking_code) = ${trackingCode.toUpperCase()}`;
    }

    await sql`
      INSERT INTO print_requests (
        tracking_code, student_name, contact_number, facebook_name, purok,
        school, grade_level, file_name, file_path, file_size, print_type,
        paper_size, copies, page_range, notes, pickup_station, is_urgent, status,
        user_id, user_email
      ) VALUES (
        ${trackingCode},
        ${student_name},
        ${contact_number},
        ${facebook_name},
        ${purok},
        ${school},
        ${grade_level},
        ${fileName},
        ${filePath},
        ${fileSize},
        ${print_type},
        ${paper_size},
        ${rawCopies},
        ${page_range},
        ${notes},
        ${pickup_station},
        ${is_urgent},
        'Pending Review',
        ${currentUser.id},
        ${currentUser.email}
      )
    `;

    return NextResponse.json({
      success: true,
      tracking_code: trackingCode,
      message: "Print request submitted successfully! Please save your tracking code.",
    });
  } catch (error) {
    console.error("Submit print error:", error);
    const message = error instanceof Error && error.message.includes("Google Drive")
      ? "Google Drive storage is temporarily unreachable. Your form is saved—please try submitting again in a moment."
      : "Failed to submit print request. Please try again.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
