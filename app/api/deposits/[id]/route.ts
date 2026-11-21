export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getCurrentUser, isOfficialUser } from "@/lib/auth";
import { deleteStoredFileByUrl } from "@/lib/storage";
import { uploadToCloudStorage } from "@/lib/googleDrive";
import { invalidateAllTransparencyCache } from "@/lib/transparencyCache";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    if (!isOfficialUser(user)) return NextResponse.json({ error: "Forbidden: SK Officials only" }, { status: 403 });

    const { id } = await params;
    const result = await sql`DELETE FROM deposits WHERE id = ${id} RETURNING id, attachment_url`;

    if (result.length === 0) {
      return NextResponse.json({ error: "Deposit record not found" }, { status: 404 });
    }
    const deletedUrl = (result[0] as { attachment_url?: string | null }).attachment_url;
    if (deletedUrl) {
      await deleteStoredFileByUrl(deletedUrl);
    }
    invalidateAllTransparencyCache();
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
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    if (!isOfficialUser(user)) return NextResponse.json({ error: "Forbidden: SK Officials only" }, { status: 403 });

    const { id } = await params;
    const formData = await request.formData();
    const reference_no = formData.get("reference_no") as string;
    const source = formData.get("source") as string;
    const amountStr = formData.get("amount") as string;
    const date = formData.get("date") as string;
    const description = (formData.get("description") as string) || "";
    const file = formData.get("attachment_file") as File | null;

    if (!reference_no || !source || !amountStr || !date) {
      return NextResponse.json({ error: "Please fill out all required fields." }, { status: 400 });
    }

    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: "Please enter a valid deposit amount." }, { status: 400 });
    }

    if (file && file.size > 0) {
      const existingRows = await sql`SELECT attachment_url FROM deposits WHERE id = ${id}`;
      const oldAttachmentUrl = (existingRows[0] as { attachment_url?: string | null } | undefined)?.attachment_url;
      const saved = await uploadToCloudStorage(file, "deposits");
      await sql`
        UPDATE deposits
        SET reference_no = ${reference_no.trim()}, source = ${source.trim()},
            amount = ${amount}, date = ${date.trim()},
            description = ${description.trim()}, attachment_url = ${saved.filePath}
        WHERE id = ${id}
      `;
      if (oldAttachmentUrl) {
        await deleteStoredFileByUrl(oldAttachmentUrl);
      }
    } else {
      await sql`
        UPDATE deposits
        SET reference_no = ${reference_no.trim()}, source = ${source.trim()},
            amount = ${amount}, date = ${date.trim()}, description = ${description.trim()}
        WHERE id = ${id}
      `;
    }

    invalidateAllTransparencyCache();

    return NextResponse.json({ success: true, message: "Deposit record updated successfully" });
  } catch (error) {
    console.error("Update deposit error:", error);
    return NextResponse.json({ error: "Failed to update deposit record" }, { status: 500 });
  }
}
