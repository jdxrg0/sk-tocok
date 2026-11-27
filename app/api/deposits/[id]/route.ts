export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getCurrentUser, isTreasuryUser } from "@/lib/auth";
import { deleteStoredFileByUrl } from "@/lib/storage";
import { uploadToCloudStorage } from "@/lib/googleDrive";
import { invalidateAllTransparencyCache } from "@/lib/transparencyCache";
import { validateUploadedFile } from "@/lib/fileValidation";
import { logSecurityEvent } from "@/lib/securityLogger";
import { isValidDateYMD, parseMoney, parsePositiveIntId, sanitizeText } from "@/lib/validation";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    if (!isTreasuryUser(user)) return NextResponse.json({ error: "Forbidden: SK Chairperson or SK Treasurer privileges required" }, { status: 403 });

    const { id } = await params;
    const depositId = parsePositiveIntId(id);
    if (!depositId) {
      return NextResponse.json({ error: "Invalid deposit ID" }, { status: 400 });
    }

    const result = await sql`DELETE FROM deposits WHERE id = ${depositId} RETURNING id, attachment_url`;

    if (result.length === 0) {
      return NextResponse.json({ error: "Deposit record not found" }, { status: 404 });
    }
    const deletedUrl = (result[0] as { attachment_url?: string | null }).attachment_url;
    if (deletedUrl) {
      await deleteStoredFileByUrl(deletedUrl);
    }
    invalidateAllTransparencyCache();
    await logSecurityEvent({
      eventType: "DEPOSIT_DELETED",
      severity: "warning",
      request,
      userId: user.id,
      email: user.email,
      details: { depositId },
    });
    return NextResponse.json({ success: true, message: "Deposit record deleted successfully" });
  } catch (error) {
    console.error("Delete deposit error:", error);
    return NextResponse.json({ error: "Failed to delete deposit record" }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    if (!isTreasuryUser(user)) return NextResponse.json({ error: "Forbidden: SK Chairperson or SK Treasurer privileges required" }, { status: 403 });

    const { id } = await params;
    const depositId = parsePositiveIntId(id);
    if (!depositId) {
      return NextResponse.json({ error: "Invalid deposit ID" }, { status: 400 });
    }

    const formData = await request.formData();
    const reference_no = sanitizeText(formData.get("reference_no"), 100);
    const source = sanitizeText(formData.get("source"), 150);
    const amount = parseMoney(formData.get("amount"));
    const date = sanitizeText(formData.get("date"), 20);
    const description = sanitizeText(formData.get("description"), 1000);
    const file = formData.get("attachment_file") as File | null;

    if (!reference_no || !source || !date) {
      return NextResponse.json({ error: "Please fill out all required fields." }, { status: 400 });
    }

    if (amount === null) {
      return NextResponse.json({ error: "Please enter a valid deposit amount." }, { status: 400 });
    }

    if (!isValidDateYMD(date)) {
      return NextResponse.json({ error: "Invalid deposit date (expected YYYY-MM-DD)." }, { status: 400 });
    }

    if (file && file.size > 0) {
      const fileCheck = await validateUploadedFile(file, "financial_doc");
      if (!fileCheck.ok) {
        await logSecurityEvent({
          eventType: "UPLOAD_REJECTED",
          severity: "warning",
          request,
          userId: user.id,
          details: { category: "deposit_update", reason: fileCheck.reason },
        });
        return NextResponse.json({ error: fileCheck.error }, { status: 400 });
      }
      const existingRows = await sql`SELECT attachment_url FROM deposits WHERE id = ${depositId}`;
      const oldAttachmentUrl = (existingRows[0] as { attachment_url?: string | null } | undefined)?.attachment_url;
      const saved = await uploadToCloudStorage(file, "deposits");
      await sql`
        UPDATE deposits
        SET reference_no = ${reference_no}, source = ${source},
            amount = ${amount}, date = ${date},
            description = ${description}, attachment_url = ${saved.filePath}
        WHERE id = ${depositId}
      `;
      if (oldAttachmentUrl) {
        await deleteStoredFileByUrl(oldAttachmentUrl);
      }
    } else {
      await sql`
        UPDATE deposits
        SET reference_no = ${reference_no}, source = ${source},
            amount = ${amount}, date = ${date}, description = ${description}
        WHERE id = ${depositId}
      `;
    }

    invalidateAllTransparencyCache();

    return NextResponse.json({ success: true, message: "Deposit record updated successfully" });
  } catch (error) {
    console.error("Update deposit error:", error);
    return NextResponse.json({ error: "Failed to update deposit record" }, { status: 500 });
  }
}
