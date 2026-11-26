import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureMessagesTable } from "@/lib/messages";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const limit = await checkRateLimit({
      request,
      bucket: "messages_track",
      max: 30,
      windowMs: 15 * 60 * 1000,
    });
    if (!limit.allowed) {
      return rateLimitExceededResponse(limit.retryAfterSeconds);
    }

    await ensureMessagesTable();

    const { searchParams } = new URL(request.url);
    const code = (searchParams.get("code") || "").trim().toUpperCase().slice(0, 40);

    if (!code) {
      return NextResponse.json(
        { success: false, error: "Please provide a valid tracking code." },
        { status: 400 }
      );
    }

    const rows = await sql`
      SELECT
        tracking_code,
        alias,
        category,
        purok,
        subject,
        message,
        status,
        is_public,
        admin_reply,
        replied_by,
        replied_at,
        created_at
      FROM anonymous_messages
      WHERE UPPER(tracking_code) = ${code}
      LIMIT 1
    `;

    if (rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No message found matching this tracking code. Please verify the code and try again.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: rows[0],
    });
  } catch (err: unknown) {
    console.error("GET /api/messages/track error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to look up message." },
      { status: 500 }
    );
  }
}
