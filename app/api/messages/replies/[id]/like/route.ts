import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureMessagesTable } from "@/lib/messages";
import {
  attachDeviceCookie,
  getOrAssignDeviceIdentity,
} from "@/lib/deviceIdentity";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/rateLimit";
import { parsePositiveIntId } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureMessagesTable();

    const { id } = await params;
    const replyId = parsePositiveIntId(id);
    if (!replyId) {
      return NextResponse.json(
        { success: false, error: "Invalid reply ID" },
        { status: 400 }
      );
    }

    const limit = await checkRateLimit({
      request,
      bucket: "reply_like",
      identifier: String(replyId),
      max: 20,
      windowMs: 15 * 60 * 1000,
      persistToDb: true,
    });
    if (!limit.allowed) {
      return rateLimitExceededResponse(limit.retryAfterSeconds);
    }

    const { searchParams } = new URL(request.url);
    const queryUnlike =
      searchParams.get("unlike") === "true" ||
      searchParams.get("action") === "unlike";

    let bodyUnlike = false;
    try {
      const text = await request.text();
      if (text) {
        const body = JSON.parse(text);
        bodyUnlike = Boolean(body?.unlike || body?.action === "unlike");
      }
    } catch {
      // ignore
    }

    const isUnlike = queryUnlike || bodyUnlike;
    const deviceIdentity = await getOrAssignDeviceIdentity(request);

    const replyRows = await sql`
      SELECT r.id, COALESCE(r.likes_count, 0)::int AS likes_count
      FROM anonymous_message_replies r
      JOIN anonymous_messages m ON m.id = r.message_id
      WHERE r.id = ${replyId}
        AND m.is_public = TRUE
        AND m.status NOT IN ('rejected', 'archived')
      LIMIT 1
    `;
    if (replyRows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Reply not found or post is not public." },
        { status: 404 }
      );
    }

    let likesCount = Number((replyRows[0] as { likes_count: number }).likes_count || 0);

    if (isUnlike) {
      const deleted = await sql`
        DELETE FROM anonymous_reply_likes
        WHERE reply_id = ${replyId} AND device_id = ${deviceIdentity.deviceId}
        RETURNING reply_id
      `;
      if (deleted.length > 0) {
        const updated = await sql`
          UPDATE anonymous_message_replies
          SET likes_count = GREATEST(0, COALESCE(likes_count, 0) - 1)
          WHERE id = ${replyId}
          RETURNING likes_count
        `;
        likesCount = Number((updated[0] as { likes_count: number }).likes_count || 0);
      }
    } else {
      const inserted = await sql`
        INSERT INTO anonymous_reply_likes (reply_id, device_id)
        VALUES (${replyId}, ${deviceIdentity.deviceId})
        ON CONFLICT (reply_id, device_id) DO NOTHING
        RETURNING reply_id
      `;
      if (inserted.length > 0) {
        const updated = await sql`
          UPDATE anonymous_message_replies
          SET likes_count = COALESCE(likes_count, 0) + 1
          WHERE id = ${replyId}
          RETURNING likes_count
        `;
        likesCount = Number((updated[0] as { likes_count: number }).likes_count || 0);
      }
    }

    const res = NextResponse.json({
      success: true,
      likes_count: likesCount,
    });
    return await attachDeviceCookie(res, deviceIdentity.deviceId, request);
  } catch (err: unknown) {
    console.error("POST /api/messages/replies/[id]/like error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to record like." },
      { status: 500 }
    );
  }
}
