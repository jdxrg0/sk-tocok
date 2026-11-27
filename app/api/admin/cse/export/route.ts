import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getCurrentUser, isTreasuryUser } from "@/lib/auth";
import { ensureCseTable } from "@/lib/cse";
import { logSecurityEvent } from "@/lib/securityLogger";

export const dynamic = "force-dynamic";

/**
 * Admin GET: Export CSV Liquidation Payroll for COA & SK Treasurer
 */
export async function GET(request: Request) {
  try {
    const official = await getCurrentUser(request);
    if (!official) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    if (!isTreasuryUser(official)) {
      return NextResponse.json(
        { error: "Forbidden: SK Chairperson or SK Treasurer privileges required." },
        { status: 403 }
      );
    }

    await logSecurityEvent({
      eventType: "CSE_LIQUIDATION_CSV_EXPORTED",
      severity: "info",
      request,
      userId: official.id,
      email: official.email,
    });

    await ensureCseTable();

    const rows = await sql`
      SELECT 
        tracking_code,
        full_name,
        contact_number,
        email,
        purok,
        birthdate,
        age,
        school_or_employment,
        exam_category,
        exam_level,
        exam_date,
        exam_fee_paid,
        is_first_time,
        payout_preference,
        gcash_number,
        gcash_account_name,
        reimbursement_status,
        reimbursement_amount,
        disbursement_voucher_no,
        reimbursed_at,
        reimbursed_by,
        payout_station_or_method,
        attendance_status,
        exam_result_status,
        rating,
        created_at
      FROM cse_applications
      ORDER BY reimbursement_status ASC, created_at ASC
    `;

    // CSV Header
    const headers = [
      "Tracking Code",
      "Full Name",
      "Purok",
      "Birthdate",
      "Age",
      "Contact Number",
      "Email",
      "School / Workplace",
      "Exam Category",
      "Exam Level",
      "Exam Date",
      "Actual Exam Fee (PHP)",
      "First Time Taker?",
      "Payout Preference",
      "GCash Number",
      "GCash Name",
      "Reimbursement Status",
      "Amount (PHP)",
      "Disbursement Voucher No",
      "Reimbursed Date",
      "Reimbursed By",
      "Payout Station / Channel",
      "Exam Attendance",
      "Exam Result",
      "Exam Rating",
      "Date Applied",
    ];

    const escapeCsv = (val: unknown) => {
      if (val === null || val === undefined) return '""';
      const raw = String(val);
      const neutralized = /^[\s\r\n]*[=+\-@]|^[\t\r\n]/.test(raw) ? `'${raw}` : raw;
      const str = neutralized.replace(/"/g, '""');
      return `"${str}"`;
    };

    const csvLines = [headers.join(",")];

    for (const row of rows as Record<string, unknown>[]) {
      const line = [
        escapeCsv(row.tracking_code),
        escapeCsv(row.full_name),
        escapeCsv(row.purok),
        escapeCsv(row.birthdate),
        escapeCsv(row.age),
        escapeCsv(row.contact_number),
        escapeCsv(row.email || ""),
        escapeCsv(row.school_or_employment || ""),
        escapeCsv(row.exam_category || "Civil Service Exam (CSE)"),
        escapeCsv(row.exam_level),
        escapeCsv(row.exam_date),
        escapeCsv(row.exam_fee_paid ?? row.reimbursement_amount ?? 500),
        escapeCsv(row.is_first_time ? "Yes" : "No"),
        escapeCsv(row.payout_preference),
        escapeCsv(row.gcash_number || ""),
        escapeCsv(row.gcash_account_name || ""),
        escapeCsv(row.reimbursement_status),
        escapeCsv(row.reimbursement_amount),
        escapeCsv(row.disbursement_voucher_no || ""),
        escapeCsv(row.reimbursed_at ? new Date(String(row.reimbursed_at)).toLocaleDateString() : ""),
        escapeCsv(row.reimbursed_by || ""),
        escapeCsv(row.payout_station_or_method || ""),
        escapeCsv(row.attendance_status),
        escapeCsv(row.exam_result_status),
        escapeCsv(row.rating != null ? `${row.rating}%` : ""),
        escapeCsv(row.created_at ? new Date(String(row.created_at)).toLocaleDateString() : ""),
      ];
      csvLines.push(line.join(","));
    }

    const csvContent = csvLines.join("\n");
    const filename = `SK_Tocok_CSE_Subsidy_Liquidation_${new Date().toISOString().split("T")[0]}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Error generating CSE CSV:", error);
    return NextResponse.json({ error: "Failed to generate CSV export." }, { status: 500 });
  }
}
