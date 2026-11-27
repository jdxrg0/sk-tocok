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
    const messageId = parsePositiveIntId(id);
    if (!messageId) {
      return NextResponse.json(
        { success: false, error: "Invalid message ID" },
        { status: 400 }
      );
    }

    const limit = await checkRateLimit({
      request,
      bucket: "message_like",
      identifier: String(messageId),
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

    const postRows = await sql`
      SELECT id, COALESCE(likes_count, 0)::int AS likes_count
      FROM anonymous_messages
      WHERE id = ${messageId}
        AND is_public = TRUE
        AND status NOT IN ('rejected', 'archived')
      LIMIT 1
    `;
    if (postRows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Message not found or not public." },
        { status: 404 }
      );
    }

    let likesCount = Number((postRows[0] as { likes_count: number }).likes_count || 0);

    if (isUnlike) {
      const deleted = await sql`
        DELETE FROM anonymous_message_likes
        WHERE message_id = ${messageId} AND device_id = ${deviceIdentity.deviceId}
        RETURNING message_id
      `;
      if (deleted.length > 0) {
        const updated = await sql`
          UPDATE anonymous_messages
          SET likes_count = GREATEST(0, COALESCE(likes_count, 0) - 1),
              updated_at = NOW()
          WHERE id = ${messageId}
          RETURNING likes_count
        `;
        likesCount = Number((updated[0] as { likes_count: number }).likes_count || 0);
      }
    } else {
      const inserted = await sql`
        INSERT INTO anonymous_message_likes (message_id, device_id)
        VALUES (${messageId}, ${deviceIdentity.deviceId})
        ON CONFLICT (message_id, device_id) DO NOTHING
        RETURNING message_id
      `;
      if (inserted.length > 0) {
        const updated = await sql`
          UPDATE anonymous_messages
          SET likes_count = COALESCE(likes_count, 0) + 1,
              updated_at = NOW()
          WHERE id = ${messageId}
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
    console.error("POST /api/messages/[id]/like error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to record like." },
      { status: 500 }
    );
  }
}
