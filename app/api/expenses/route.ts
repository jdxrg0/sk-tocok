export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { sql, query } from "@/lib/db";
import { getCurrentUser, isOfficialUser } from "@/lib/auth";
import { uploadToCloudStorage } from "@/lib/googleDrive";
import {
  getCachedExpenses,
  setCachedExpenses,
  invalidateAllTransparencyCache,
} from "@/lib/transparencyCache";

export async function GET(request: Request) {
  const t0 = performance.now();
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const q = searchParams.get("q");

    const isUnfiltered = (!category || category === "all") && !q;

    if (isUnfiltered) {
      const cached = getCachedExpenses();
      if (cached) {
        console.log(`[/api/expenses] Cache hit! Response ready in ${(performance.now() - t0).toFixed(1)}ms`);
        return NextResponse.json(cached);
      }
    }

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

    const combinedQuery = `
      SELECT
        (SELECT json_agg(s) FROM (SELECT key, value FROM settings WHERE key IN ('barangay_budget','annual_budget','fiscal_year')) s) AS settings,
        (SELECT row_to_json(d) FROM (SELECT COALESCE(SUM(amount),0) AS total, COUNT(*) AS count FROM deposits) d) AS deposits_summary,
        (SELECT json_agg(c) FROM (
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
        ) c) AS category_stats,
        (SELECT json_agg(m) FROM (
          SELECT
            SUBSTRING(date, 1, 7) AS month,
            SUM(amount) AS total,
            COUNT(*) AS count
          FROM expenses
          GROUP BY SUBSTRING(date, 1, 7)
          ORDER BY month ASC
        ) m) AS monthly_stats,
        (SELECT COALESCE(SUM(amount),0) FROM expenses) AS total_spent,
        (SELECT json_agg(ex) FROM (SELECT * FROM expenses WHERE ${conditions.join(" AND ")} ORDER BY date DESC, id DESC) ex) AS expenses
    `;

    const rows = await query(combinedQuery, params);
    const raw = (rows[0] || {}) as Record<string, unknown>;

    const settings: Record<string, string> = {};
    if (Array.isArray(raw.settings)) {
      for (const r of raw.settings as { key: string; value: string }[]) {
        settings[r.key] = r.value;
      }
    }

    const barangayBudget = parseFloat(settings.barangay_budget ?? "7000000");
    const annualBudget = barangayBudget * 0.10;
    const fiscalYear = settings.fiscal_year ?? "2026";

    const depSummary = (raw.deposits_summary || {}) as { total?: number | string; count?: number | string };
    const totalDeposited = Number(depSummary.total || 0);
    const depositCount = Number(depSummary.count || 0);
    const fundsReceived = totalDeposited;

    const totalSpent = Number(raw.total_spent || 0);
    const currentBankBalance = Math.max(0, fundsReceived - totalSpent);
    const remainingBudget = annualBudget - totalSpent;
    const utilizationRate = annualBudget > 0 ? (totalSpent / annualBudget) * 100 : 0;

    const formattedCategoryStats = Array.isArray(raw.category_stats)
      ? (raw.category_stats as Record<string, unknown>[]).map((c) => ({
          category: String(c.category || ""),
          total: Number(c.total) || 0,
          count: Number(c.count) || 0,
          color: String(c.color || "blue"),
          allocated_budget: Number(c.allocated_budget) || 0,
        }))
      : [];

    const formattedMonthlyStats = Array.isArray(raw.monthly_stats)
      ? (raw.monthly_stats as Record<string, unknown>[]).map((m) => ({
          month: String(m.month || ""),
          total: Number(m.total) || 0,
          count: Number(m.count) || 0,
        }))
      : [];

    const formattedExpenses = Array.isArray(raw.expenses)
      ? (raw.expenses as Record<string, unknown>[]).map((e) => ({
          ...e,
          amount: Number(e.amount) || 0,
        }))
      : [];

    const payload = {
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
    };

    if (isUnfiltered) {
      setCachedExpenses(payload);
    }

    console.log(`[/api/expenses] DB query + format finished in ${(performance.now() - t0).toFixed(1)}ms`);

    return NextResponse.json(payload);
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

    invalidateAllTransparencyCache();

    return NextResponse.json({ success: true, message: "Expense record published to the transparency portal successfully." });
  } catch (error) {
    console.error("Create expense error:", error);
    return NextResponse.json({ error: "Failed to record expense." }, { status: 500 });
  }
}
