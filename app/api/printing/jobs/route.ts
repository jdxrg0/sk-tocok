export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { sql, query } from "@/lib/db";
import { getCurrentUser, isOfficialUser } from "@/lib/auth";
import { sendPushNotificationToUser } from "@/lib/webPush";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }
    if (!isOfficialUser(user)) {
      return NextResponse.json({ error: "Forbidden: SK Officials only." }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const q = searchParams.get("q");

    const conditions: string[] = ["1=1"];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (status && status !== "all") {
      conditions.push(`status = $${paramIdx++}`);
      params.push(status);
    }

    if (q) {
      const cleanQ = q.replace(/^[#\s]+/, "").trim();
      const pattern = `%${cleanQ}%`;
      conditions.push(`(tracking_code = $${paramIdx} OR tracking_code ILIKE $${paramIdx + 1} OR student_name ILIKE $${paramIdx + 2} OR school ILIKE $${paramIdx + 3} OR file_name ILIKE $${paramIdx + 4})`);
      params.push(cleanQ, pattern, pattern, pattern, pattern);
      paramIdx += 5;
    }

    const jobs = await query(
      `SELECT * FROM print_requests WHERE ${conditions.join(" AND ")} ORDER BY created_at DESC`,
      params
    );

    // Get statistics for the dashboard in a single query
    const statsRows = await sql`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'Pending Review') AS pending,
        COUNT(*) FILTER (WHERE status = 'Printing In Progress') AS printing,
        COUNT(*) FILTER (WHERE status = 'Ready for Pickup') AS ready,
        COUNT(*) FILTER (WHERE status = 'Completed') AS completed
      FROM print_requests
    `;

    const row = (statsRows[0] || {}) as {
      total?: number;
      pending?: number;
      printing?: number;
      ready?: number;
      completed?: number;
    };

    const stats = {
      total: Number(row.total || 0),
      pending: Number(row.pending || 0),
      printing: Number(row.printing || 0),
      ready: Number(row.ready || 0),
      completed: Number(row.completed || 0),
    };

    return NextResponse.json({ success: true, jobs, stats });
  } catch (error) {
    console.error("Admin jobs error:", error);
    return NextResponse.json({ error: "Failed to fetch print jobs" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }
    if (!isOfficialUser(user)) {
      return NextResponse.json({ error: "Forbidden: SK Officials only." }, { status: 403 });
    }

    const { id, status, admin_notes } = await request.json();

    if (!id || !status) {
      return NextResponse.json({ error: "Job ID and status are required" }, { status: 400 });
    }

    let picked_up_at: string | null = null;
    if (status === "Completed") {
      picked_up_at = new Date().toISOString();
    }

    // Retrieve previous job state to verify status change and student details
    const existingRows = await sql`
      SELECT id, tracking_code, student_name, pickup_station, status, user_id, user_email
      FROM print_requests
      WHERE id = ${id}
    `;
    const previousJob = existingRows[0] as {
      id: number;
      tracking_code: string;
      student_name: string;
      pickup_station: string | null;
      status: string;
      user_id: number | null;
      user_email: string | null;
    } | undefined;

    await sql`
      UPDATE print_requests 
      SET status = ${status},
          admin_notes = COALESCE(${admin_notes ?? null}, admin_notes),
          picked_up_at = COALESCE(${picked_up_at}, picked_up_at),
          updated_at = NOW()
      WHERE id = ${id}
    `;

    // Trigger Web Push Notification if status actually changed
    if (previousJob && previousJob.status !== status && (previousJob.user_id || previousJob.user_email)) {
      const codeDisplay = previousJob.tracking_code.startsWith("SK") || previousJob.tracking_code.startsWith("PRN")
        ? previousJob.tracking_code
        : `#${previousJob.tracking_code}`;

      let pushTitle = `Ticket ${codeDisplay} Updated`;
      let pushBody = `Your print request status is now: ${status}.`;

      if (status === "Ready for Pickup") {
        pushTitle = `🎉 Ready for Pickup: Ticket ${codeDisplay}`;
        pushBody = `Your prints are ready at ${previousJob.pickup_station || "SK Printing Station"}! Please bring your Student ID to claim.`;
      } else if (status === "Printing In Progress") {
        pushTitle = `🖨️ Printing In Progress: Ticket ${codeDisplay}`;
        pushBody = `Your document is currently being printed by SK Tocok officials.`;
      } else if (status === "Declined") {
        pushTitle = `⚠️ Request Declined: Ticket ${codeDisplay}`;
        pushBody = admin_notes
          ? `Notice: ${admin_notes}`
          : `Your print request could not be processed. Please check ticket details.`;
      } else if (status === "Completed") {
        pushTitle = `✅ Document Claimed: Ticket ${codeDisplay}`;
        pushBody = `Your print request has been marked as completed. Thank you for using SK Free Printing!`;
      }

      sendPushNotificationToUser(
        { userId: previousJob.user_id, userEmail: previousJob.user_email },
        {
          title: pushTitle,
          body: pushBody,
          url: `/printing?tab=track&code=${encodeURIComponent(previousJob.tracking_code)}`,
          tag: `sk-ticket-${previousJob.tracking_code}`,
        }
      ).catch((err) => {
        console.error("Failed to send push notification on status update:", err);
      });
    }

    return NextResponse.json({ success: true, message: "Status updated successfully" });
  } catch (error) {
    console.error("Update job error:", error);
    return NextResponse.json({ error: "Failed to update job status" }, { status: 500 });
  }
}
