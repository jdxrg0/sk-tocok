import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { savePrintDocument } from "@/lib/googleDrive";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function generateTrackingCode(): Promise<string> {
  let existingCodes = new Set<string>();
  try {
    const rows = await sql`SELECT tracking_code FROM print_requests`;
    if (Array.isArray(rows)) {
      existingCodes = new Set(
        rows.map((r: { tracking_code?: string }) => String(r.tracking_code || "").toUpperCase().trim())
      );
    }
  } catch (err) {
    console.warn("Failed to load existing tracking codes, using fallback:", err);
  }

  // Generate random 3-digit code in SK[100-999] format (e.g. SK104, SK528)
  for (let i = 0; i < 1000; i++) {
    const num = Math.floor(100 + Math.random() * 900);
    const candidate = `SK${num}`;
    if (!existingCodes.has(candidate)) {
      return candidate;
    }
  }

  // Fallback to padded 000-099 if 100-999 are completely filled
  for (let i = 0; i < 100; i++) {
    const candidate = `SK${String(i).padStart(3, "0")}`;
    if (!existingCodes.has(candidate)) {
      return candidate;
    }
  }

  // Expansion fallback if all 1,000 three-digit codes are occupied
  return `SK${Math.floor(1000 + Math.random() * 9000)}`;
}

export async function POST(request: Request) {
  try {
    // Require user authentication before submitting
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json(
        { error: "You must be logged in to submit a print request. Please sign in or create an account." },
        { status: 401 }
      );
    }

    // Check if printing program is currently active
    const activeSettingRows = await sql`SELECT value FROM settings WHERE key = 'printing_active'`;
    const activeSetting = activeSettingRows[0] as { value: string } | undefined;
    if (activeSetting && activeSetting.value === "false") {
      return NextResponse.json(
        { error: "The Free Student Printing Program has reached its monthly supply limit. It will resume next month upon budget allocation." },
        { status: 400 }
      );
    }

    const formData = await request.formData();

    const student_name = formData.get("student_name") as string;
    const contact_number = (formData.get("contact_number") as string) || "";
    const facebook_name = (formData.get("facebook_name") as string) || "";
    const purok = formData.get("purok") as string;
    const school = formData.get("school") as string;
    const grade_level = formData.get("grade_level") as string;
    const print_type = (formData.get("print_type") as string) || "";
    const paper_size = (formData.get("paper_size") as string) || "";
    const copies = parseInt((formData.get("copies") as string) || "1", 10);
    const page_range = (formData.get("page_range") as string) || "All pages";
    const notes = (formData.get("notes") as string) || "";
    const pickup_station = (formData.get("pickup_station") as string) || "";
    const is_urgent = formData.get("is_urgent") === "true" || formData.get("is_urgent") === "1" ? 1 : 0;
    const file = formData.get("file") as File | null;

    if (!student_name || !purok || !school || !grade_level) {
      return NextResponse.json({ error: "Please fill out all required student information fields." }, { status: 400 });
    }

    if (!print_type) {
      return NextResponse.json({ error: "Please select your preferred print color (Black & White or Colored)." }, { status: 400 });
    }

    if (!paper_size) {
      return NextResponse.json({ error: "Please select your preferred bond paper size (A4, Letter, or Legal)." }, { status: 400 });
    }

    if (!pickup_station) {
      return NextResponse.json({ error: "Please select your preferred claiming station." }, { status: 400 });
    }

    if (!file) {
      return NextResponse.json({ error: "Please upload your document file to be printed." }, { status: 400 });
    }

    // Maximum file size: 100 MB
    const MAX_SIZE = 100 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "File exceeds maximum size limit of 100MB." }, { status: 400 });
    }

    // Save file (uploads to Google Drive if configured, otherwise local disk)
    const { filePath, fileName, fileSize } = await savePrintDocument(file);

    // Generate unique random ticket code in SK[random three digit number] format (e.g. SK104)
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
        ${student_name.trim()},
        ${contact_number.trim()},
        ${facebook_name.trim()},
        ${purok.trim()},
        ${school.trim()},
        ${grade_level.trim()},
        ${fileName},
        ${filePath},
        ${fileSize},
        ${print_type},
        ${paper_size},
        ${copies > 0 ? copies : 1},
        ${page_range.trim()},
        ${notes.trim()},
        ${pickup_station.trim()},
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
