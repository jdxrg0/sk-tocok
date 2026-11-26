export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { sql, query } from "@/lib/db";
import { getCurrentUser, isOfficialUser } from "@/lib/auth";
import { uploadToCloudStorage } from "@/lib/googleDrive";
import {
  getCachedDeposits,
  setCachedDeposits,
  invalidateAllTransparencyCache,
} from "@/lib/transparencyCache";
import { validateUploadedFile } from "@/lib/fileValidation";
import { logSecurityEvent } from "@/lib/securityLogger";
import { isValidDateYMD, parseMoney, sanitizeText } from "@/lib/validation";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q");

    if (!q) {
      const cached = getCachedDeposits();
      if (cached) {
        return NextResponse.json(cached);
      }
    }

    let deposits;
    let totalDeposited = 0;

    if (q) {
      const pattern = `%${q}%`;
      const [depRows, totalRow] = await Promise.all([
        query(
          "SELECT * FROM deposits WHERE reference_no ILIKE $1 OR source ILIKE $2 OR description ILIKE $3 ORDER BY date DESC, id DESC",
          [pattern, pattern, pattern]
        ),
        sql`SELECT COALESCE(SUM(amount), 0) AS total FROM deposits`
      ]);
      deposits = depRows;
      totalDeposited = Number((totalRow[0] as { total: number }).total);
    } else {
      deposits = await sql`SELECT * FROM deposits ORDER BY date DESC, id DESC`;
    }

    const formattedDeposits = (deposits as Record<string, unknown>[]).map((d) => ({
      ...d,
      amount: Number(d.amount) || 0,
    }));

    if (!q) {
      totalDeposited = formattedDeposits.reduce((acc, d) => acc + d.amount, 0);
    }

    const payload = {
      success: true,
      deposits: formattedDeposits,
      totalDeposited,
      count: formattedDeposits.length,
    };

    if (!q) {
      setCachedDeposits(payload);
    }

    return NextResponse.json(payload);
  } catch (error) {
    console.error("Deposits fetch error:", error);
    return NextResponse.json({ error: "Failed to load bank remittances and deposits" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json({ error: "Unauthorized. Please log in as an SK Official." }, { status: 401 });
    if (!isOfficialUser(user)) return NextResponse.json({ error: "Forbidden: SK Officials only." }, { status: 403 });

    const formData = await request.formData();
    const reference_no = sanitizeText(formData.get("reference_no"), 100);
    const source = sanitizeText(formData.get("source"), 150);
    const amount = parseMoney(formData.get("amount"));
    const date = sanitizeText(formData.get("date"), 20);
    const description = sanitizeText(formData.get("description"), 1000);
    const file = formData.get("attachment_file") as File | null;

    if (!reference_no || !source || amount === null || !date) {
      return NextResponse.json({ error: "Please fill out reference no, source, valid amount, and deposit date." }, { status: 400 });
    }

    if (!isValidDateYMD(date)) {
      return NextResponse.json({ error: "Invalid deposit date (expected YYYY-MM-DD)." }, { status: 400 });
    }

    let attachment_url: string | null = null;
    if (file && file.size > 0) {
      const fileCheck = await validateUploadedFile(file, "financial_doc");
      if (!fileCheck.ok) {
        await logSecurityEvent({
          eventType: "UPLOAD_REJECTED",
          severity: "warning",
          request,
          userId: user.id,
          details: { category: "deposit_attachment", reason: fileCheck.reason },
        });
        return NextResponse.json({ error: fileCheck.error }, { status: 400 });
      }
      const saved = await uploadToCloudStorage(file, "deposits");
      attachment_url = saved.filePath;
    }

    const result = await sql`
      INSERT INTO deposits (reference_no, source, amount, date, description, attachment_url, recorded_by)
      VALUES (
        ${reference_no}, ${source}, ${amount}, ${date},
        ${description}, ${attachment_url}, ${`${user.name} (${user.role})`}
      )
      RETURNING id
    `;

    invalidateAllTransparencyCache();

    await logSecurityEvent({
      eventType: "DEPOSIT_CREATED",
      severity: "info",
      request,
      userId: user.id,
      email: user.email,
      details: { reference_no, amount },
    });

    return NextResponse.json({
      success: true,
      id: (result[0] as { id: number }).id,
      message: "Monthly remittance / bank deposit recorded successfully!",
    });
  } catch (error: unknown) {
    console.error("Create deposit error:", error);
    const msg = error instanceof Error ? error.message : "";
    if (msg.includes("unique") || msg.includes("deposits_reference_no")) {
      return NextResponse.json({ error: "A deposit with this reference number already exists." }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to record deposit. Please check values." }, { status: 500 });
  }
}
