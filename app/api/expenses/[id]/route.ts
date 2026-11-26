export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getCurrentUser, isOfficialUser } from "@/lib/auth";
import { deleteStoredFileByUrl } from "@/lib/storage";
import { uploadToCloudStorage } from "@/lib/googleDrive";
import { parseExpenseLineItems } from "@/lib/expenseBreakdown";
import { ensureExpenseLineItemsColumn } from "@/lib/expenseSchema";
import { invalidateAllTransparencyCache } from "@/lib/transparencyCache";
import { validateUploadedFile } from "@/lib/fileValidation";
import { logSecurityEvent } from "@/lib/securityLogger";
import { isValidDateYMD, parseMoney, sanitizeText } from "@/lib/validation";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }
    if (!isOfficialUser(user)) {
      return NextResponse.json({ error: "Forbidden: SK Officials only" }, { status: 403 });
    }

    await ensureExpenseLineItemsColumn();

    const { id } = await params;
    const expenseId = parseInt(id, 10);
    if (!Number.isInteger(expenseId) || expenseId <= 0) {
      return NextResponse.json({ error: "Invalid expense ID" }, { status: 400 });
    }

    const existingRows = await sql`SELECT id, receipt_url FROM expenses WHERE id = ${expenseId}`;
    if (existingRows.length === 0) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }
    const existing = existingRows[0] as { id: number; receipt_url: string | null };

    const formData = await request.formData();
    const title = sanitizeText(formData.get("title"), 200);
    const description = sanitizeText(formData.get("description"), 1500);
    const category = sanitizeText(formData.get("category"), 100);
    const amount = parseMoney(formData.get("amount"));
    const date = sanitizeText(formData.get("date"), 20);
    const voucher_no = sanitizeText(formData.get("voucher_no"), 100);
    const payee = sanitizeText(formData.get("payee"), 150);
    const hasLineItemsField = formData.has("line_items");
    const parsedLineItems = hasLineItemsField ? parseExpenseLineItems(formData.get("line_items")) : null;
    const lineItemsJson = parsedLineItems && parsedLineItems.length > 0 ? JSON.stringify(parsedLineItems) : null;
    const receiptFile = (formData.get("receipt") || formData.get("receipt_file")) as File | null;

    if (!title || !category || !date) {
      return NextResponse.json({ error: "Title, category, amount, and date are required." }, { status: 400 });
    }

    if (amount === null) {
      return NextResponse.json({ error: "Please enter a valid positive amount." }, { status: 400 });
    }

    if (!isValidDateYMD(date)) {
      return NextResponse.json({ error: "Invalid expense date format (expected YYYY-MM-DD)." }, { status: 400 });
    }

    let receipt_url = existing.receipt_url;
    let replacedOldReceipt = false;
    if (receiptFile && receiptFile.size > 0 && typeof receiptFile.name === "string") {
      const fileCheck = await validateUploadedFile(receiptFile, "financial_doc");
      if (!fileCheck.ok) {
        await logSecurityEvent({
          eventType: "UPLOAD_REJECTED",
          severity: "warning",
          request,
          userId: user.id,
          details: { category: "expense_update_receipt", reason: fileCheck.reason },
        });
        return NextResponse.json({ error: fileCheck.error }, { status: 400 });
      }
      const saved = await uploadToCloudStorage(receiptFile, "vouchers");
      receipt_url = saved.filePath;
      replacedOldReceipt = true;
    }

    if (hasLineItemsField) {
      await sql`
        UPDATE expenses
        SET title = ${title}, description = ${description}, category = ${category},
            amount = ${amount}, date = ${date}, receipt_url = ${receipt_url},
            voucher_no = ${voucher_no}, payee = ${payee},
            line_items = ${lineItemsJson}::jsonb
        WHERE id = ${expenseId}
      `;
    } else {
      await sql`
        UPDATE expenses
        SET title = ${title}, description = ${description}, category = ${category},
            amount = ${amount}, date = ${date}, receipt_url = ${receipt_url},
            voucher_no = ${voucher_no}, payee = ${payee}
        WHERE id = ${expenseId}
      `;
    }

    if (replacedOldReceipt && existing.receipt_url) {
      await deleteStoredFileByUrl(existing.receipt_url);
    }

    invalidateAllTransparencyCache();

    const updatedRows = await sql`SELECT * FROM expenses WHERE id = ${expenseId}`;

    return NextResponse.json({
      success: true,
      expense: updatedRows[0],
      message: "Expense updated successfully",
    });
  } catch (error) {
    console.error("Update expense error:", error);
    return NextResponse.json({ error: "Failed to update expense" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }
    if (!isOfficialUser(user)) {
      return NextResponse.json({ error: "Forbidden: SK Officials only" }, { status: 403 });
    }

    const { id } = await params;
    const expenseId = parseInt(id, 10);
    if (!Number.isInteger(expenseId) || expenseId <= 0) {
      return NextResponse.json({ error: "Invalid expense ID" }, { status: 400 });
    }

    const result = await sql`DELETE FROM expenses WHERE id = ${expenseId} RETURNING id, receipt_url`;
    if (result.length === 0) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    const deletedReceiptUrl = (result[0] as { receipt_url?: string | null }).receipt_url;
    if (deletedReceiptUrl) {
      await deleteStoredFileByUrl(deletedReceiptUrl);
    }

    invalidateAllTransparencyCache();

    await logSecurityEvent({
      eventType: "EXPENSE_DELETED",
      severity: "warning",
      request,
      userId: user.id,
      email: user.email,
      details: { expenseId },
    });

    return NextResponse.json({ success: true, message: "Expense record removed" });
  } catch (error) {
    console.error("Delete expense error:", error);
    return NextResponse.json({ error: "Failed to delete expense" }, { status: 500 });
  }
}
