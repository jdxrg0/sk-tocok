import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getCurrentUser, isOfficialUser } from "@/lib/auth";
import { ensureMessagesTable } from "@/lib/messages";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }
    if (!isOfficialUser(user)) {
      return NextResponse.json(
        { error: "Forbidden: SK Officials only" },
        { status: 403 }
      );
    }

    await ensureMessagesTable();

    const { searchParams } = new URL(request.url);
    const statusFilter = (searchParams.get("status") || "all").trim();
    const categoryFilter = (searchParams.get("category") || "all").trim();
    const q = (searchParams.get("q") || "").trim();
    const rawLimit = parseInt(searchParams.get("limit") || "500", 10);
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 1000) : 500;

    // Fetch summary stats & bounded messages list
    const [countsRows, messagesRows] = await Promise.all([
      sql`
        SELECT status, is_public, COUNT(*) as count
        FROM anonymous_messages
        GROUP BY status, is_public
      `,
      sql`
        SELECT 
          id, 
          tracking_code, 
          alias, 
          category, 
          purok, 
          subject, 
          message, 
          status,
          is_public, 
          is_pinned, 
          admin_reply, 
          replied_by, 
          replied_at, 
          likes_count, 
          created_at,
          updated_at
        FROM anonymous_messages
        ORDER BY is_pinned DESC, created_at DESC
        LIMIT ${limit}
      `,
    ]);

    // Calculate aggregated stats
    const stats = {
      total: 0,
      pending: 0,
      approved: 0,
      private_answered: 0,
      rejected: 0,
      archived: 0,
      publicCount: 0,
    };

    for (const r of countsRows) {
      const cnt = Number(r.count) || 0;
      stats.total += cnt;
      if (r.status === "pending") stats.pending += cnt;
      if (r.status === "approved") stats.approved += cnt;
      if (r.status === "private_answered") stats.private_answered += cnt;
      if (r.status === "rejected") stats.rejected += cnt;
      if (r.status === "archived") stats.archived += cnt;
      if (r.is_public === true) stats.publicCount += cnt;
    }

    // Apply filtering
    let filtered = messagesRows;
    if (statusFilter !== "all") {
      filtered = filtered.filter(
        (m) =>
          ((m.status as string) || "").toLowerCase() ===
          statusFilter.toLowerCase()
      );
    }
    if (categoryFilter !== "all") {
      filtered = filtered.filter(
        (m) =>
          ((m.category as string) || "").toLowerCase() ===
          categoryFilter.toLowerCase()
      );
    }
    if (q) {
      const qLower = q.toLowerCase();
      filtered = filtered.filter(
        (m) =>
          ((m.subject as string) || "").toLowerCase().includes(qLower) ||
          ((m.message as string) || "").toLowerCase().includes(qLower) ||
          ((m.tracking_code as string) || "").toLowerCase().includes(qLower) ||
          ((m.alias as string) || "").toLowerCase().includes(qLower) ||
          ((m.admin_reply as string) || "").toLowerCase().includes(qLower)
      );
    }

    return NextResponse.json({
      success: true,
      stats,
      messages: filtered,
    });
  } catch (err: unknown) {
    console.error("GET /api/admin/messages error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to load messages." },
      { status: 500 }
    );
  }
}
