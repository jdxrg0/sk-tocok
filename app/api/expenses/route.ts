import { NextResponse } from "next/server";
import { sql, query } from "@/lib/db";
import { getCurrentUser, isOfficialUser } from "@/lib/auth";
import { uploadToCloudStorage } from "@/lib/googleDrive";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const q = searchParams.get("q");

    // Budget settings
    const settingRows = await sql`
      SELECT key, value FROM settings
      WHERE key IN ('barangay_budget','annual_budget','fiscal_year')
    `;
    const settings: Record<string, string> = {};
    for (const r of settingRows as { key: string; value: string }[]) settings[r.key] = r.value;

    const barangayBudget = parseFloat(settings.barangay_budget ?? "7000000");
    // Statutory 10% SK allocation under Republic Act No. 10742
    const annualBudget = barangayBudget * 0.10;
    const fiscalYear = settings.fiscal_year ?? "2026";

    const depTotalRow = await sql`SELECT COALESCE(SUM(amount),0) AS total FROM deposits`;
    const depCountRow = await sql`SELECT COUNT(*) AS count FROM deposits`;
    const totalDeposited = Number((depTotalRow[0] as { total: number }).total);
    const depositCount = Number((depCountRow[0] as { count: number }).count);
    const fundsReceived = totalDeposited;

    const categoryStats = await sql`
      SELECT
        c.name AS category,
        COALESCE(SUM(e.amount), 0) AS total,
        COUNT(e.id) AS count,
        COALESCE(c.color, 'blue') AS color,
        COALESCE(c.allocated_budget, 0) AS allocated_budget
      FROM categories c
      LEFT JOIN expenses e ON e.category = c.name
      GROUP BY c.id
      ORDER BY total DESC
    `;

    const monthlyStats = await sql`
      SELECT
        SUBSTRING(date, 1, 7) AS month,
        SUM(amount) AS total,
        COUNT(*) AS count
      FROM expenses
      GROUP BY SUBSTRING(date, 1, 7)
      ORDER BY month ASC
    `;

    const totalSpentRow = await sql`SELECT COALESCE(SUM(amount),0) AS total FROM expenses`;
    const totalSpent = Number((totalSpentRow[0] as { total: number }).total);
    const currentBankBalance = Math.max(0, fundsReceived - totalSpent);
    const remainingBudget = annualBudget - totalSpent;
    const utilizationRate = annualBudget > 0 ? (totalSpent / annualBudget) * 100 : 0;

    // Filtered expense list
    const conditions: string[] = ["1=1"];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (category && category !== "all") {
      conditions.push(`category = $${paramIdx++}`);
      params.push(category);
    }
    if (q) {
      const pattern = `%${q}%`;
      conditions.push(`(title ILIKE $${paramIdx} OR voucher_no ILIKE $${paramIdx + 1} OR payee ILIKE $${paramIdx + 2} OR description ILIKE $${paramIdx + 3})`);
      params.push(pattern, pattern, pattern, pattern);
      paramIdx += 4;
    }

    const expenses = await query(
      `SELECT * FROM expenses WHERE ${conditions.join(" AND ")} ORDER BY date DESC, id DESC`,
      params
    );

    const formattedCategoryStats = (categoryStats as Record<string, unknown>[]).map((c) => ({
      category: String(c.category || ""),
      total: Number(c.total) || 0,
      count: Number(c.count) || 0,
      color: String(c.color || "blue"),
      allocated_budget: Number(c.allocated_budget) || 0,
    }));

    const formattedMonthlyStats = (monthlyStats as Record<string, unknown>[]).map((m) => ({
      month: String(m.month || ""),
      total: Number(m.total) || 0,
      count: Number(m.count) || 0,
    }));

    const formattedExpenses = (expenses as Record<string, unknown>[]).map((e) => ({
      ...e,
      amount: Number(e.amount) || 0,
    }));

    return NextResponse.json({
      success: true,
      summary: {
        fiscalYear,
        barangayBudget,
        annualBudget,
        fundsReceived,
        currentBankBalance,
        totalSpent,
        remainingBudget,
        utilizationRate: Number(utilizationRate.toFixed(2)),
        depositCount,
      },
      categoryStats: formattedCategoryStats,
      monthlyStats: formattedMonthlyStats,
      expenses: formattedExpenses,
    });
  } catch (error) {
    console.error("Expenses fetch error:", error);
    return NextResponse.json({ error: "Failed to load financial transparency data" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized access. Please log in as an SK Official." }, { status: 401 });
    if (!isOfficialUser(user)) return NextResponse.json({ error: "Forbidden: SK Officials only." }, { status: 403 });

    const formData = await request.formData();
    const title = formData.get("title") as string;
    const description = (formData.get("description") as string) || "";
    const category = formData.get("category") as string;
    const amount = parseFloat((formData.get("amount") as string) || "0");
    const date = formData.get("date") as string;
    const voucher_no = (formData.get("voucher_no") as string) || "";
    const payee = (formData.get("payee") as string) || "";
    const receiptFile = formData.get("receipt_file") as File | null;

    if (!title || !category || !amount || !date) {
      return NextResponse.json({ error: "Title, category, amount, and date are required." }, { status: 400 });
    }

    let receipt_url: string | null = null;
    if (receiptFile && receiptFile.size > 0) {
      const saved = await uploadToCloudStorage(receiptFile, "vouchers");
      receipt_url = saved.filePath;
    }

    await sql`
      INSERT INTO expenses (title, description, category, amount, date, receipt_url, voucher_no, payee, created_by)
      VALUES (
        ${title.trim()}, ${description.trim()}, ${category.trim()}, ${amount}, ${date},
        ${receipt_url}, ${voucher_no.trim() || null}, ${payee.trim() || null},
        ${`${user.name} (${user.role})`}
      )
    `;

    return NextResponse.json({ success: true, message: "Expense record published to the transparency portal successfully." });
  } catch (error) {
    console.error("Create expense error:", error);
    return NextResponse.json({ error: "Failed to record expense." }, { status: 500 });
  }
}
