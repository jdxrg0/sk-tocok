import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getCurrentUser, isOfficialUser } from "@/lib/auth";
import { deleteStoredFileByUrl } from "@/lib/storage";
import { uploadToCloudStorage } from "@/lib/googleDrive";
import { invalidateAllTransparencyCache } from "@/lib/transparencyCache";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }
    if (!isOfficialUser(user)) {
      return NextResponse.json({ error: "Forbidden: SK Officials only" }, { status: 403 });
    }

    const { id } = await params;
    const expenseId = parseInt(id, 10);
    if (!expenseId) {
      return NextResponse.json({ error: "Invalid expense ID" }, { status: 400 });
    }

    const existingRows = await sql`SELECT id, receipt_url FROM expenses WHERE id = ${expenseId}`;
    if (existingRows.length === 0) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }
    const existing = existingRows[0] as { id: number; receipt_url: string | null };

    const formData = await request.formData();
    const title = formData.get("title") as string;
    const description = (formData.get("description") as string) || "";
    const category = formData.get("category") as string;
    const amountStr = formData.get("amount") as string;
    const date = formData.get("date") as string;
    const voucher_no = (formData.get("voucher_no") as string) || "";
    const payee = (formData.get("payee") as string) || "";
    const receiptFile = formData.get("receipt") as File | null;

    if (!title || !category || !amountStr || !date) {
      return NextResponse.json({ error: "Title, category, amount, and date are required." }, { status: 400 });
    }

    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: "Please enter a valid amount." }, { status: 400 });
    }

    let receipt_url = existing.receipt_url;
    let replacedOldReceipt = false;
    if (receiptFile && receiptFile.size > 0 && typeof receiptFile.name === "string") {
      const saved = await uploadToCloudStorage(receiptFile, "vouchers");
      receipt_url = saved.filePath;
      replacedOldReceipt = true;
    }

    await sql`
      UPDATE expenses
      SET title = ${title.trim()}, description = ${description.trim()}, category = ${category.trim()},
          amount = ${amount}, date = ${date}, receipt_url = ${receipt_url},
          voucher_no = ${voucher_no.trim()}, payee = ${payee.trim()}
      WHERE id = ${expenseId}
    `;

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
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }
    if (!isOfficialUser(user)) {
      return NextResponse.json({ error: "Forbidden: SK Officials only" }, { status: 403 });
    }

    const { id } = await params;
    const expenseId = parseInt(id, 10);
    if (!expenseId) {
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

    return NextResponse.json({ success: true, message: "Expense record removed" });
  } catch (error) {
    console.error("Delete expense error:", error);
    return NextResponse.json({ error: "Failed to delete expense" }, { status: 500 });
  }
}
