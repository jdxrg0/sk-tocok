import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureMessagesTable } from "@/lib/messages";
import {
  getOrAssignDeviceIdentity,
  attachDeviceCookie,
} from "@/lib/deviceIdentity";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/rateLimit";
import { getCurrentUser, isOfficialUser } from "@/lib/auth";
import { parsePositiveIntId, sanitizeText } from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * GET /api/messages/[id]/replies
 * Get all anonymous replies for a public message/post (or any post for SK Officials)
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureMessagesTable();

    const { id } = await params;
    const messageId = parsePositiveIntId(id);
    if (!messageId) {
      return NextResponse.json(
        { success: false, error: "Invalid post ID" },
        { status: 400 }
      );
    }

    const user = await getCurrentUser(request);
    const isAdmin = isOfficialUser(user);

    if (!isAdmin) {
      const parentCheck = await sql`
        SELECT id
        FROM anonymous_messages
        WHERE id = ${messageId}
          AND is_public = TRUE
          AND status NOT IN ('rejected', 'archived')
        LIMIT 1
      `;
      if (parentCheck.length === 0) {
        return NextResponse.json(
          { success: false, error: "Post not found or not public." },
          { status: 404 }
        );
      }
    }

    const rows = await sql`
      SELECT
        id,
        message_id,
        parent_id,
        alias,
        reply,
        likes_count,
        created_at
      FROM anonymous_message_replies
      WHERE message_id = ${messageId}
      ORDER BY created_at ASC
    `;

    return NextResponse.json({
      success: true,
      replies: rows,
    });
  } catch (err: unknown) {
    console.error("GET /api/messages/[id]/replies error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to load replies." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/messages/[id]/replies
 * Add an anonymous reply/comment to a post
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const limit = await checkRateLimit({
      request,
      bucket: "message_reply_post",
      max: 20,
      windowMs: 15 * 60 * 1000,
      persistToDb: true,
    });
    if (!limit.allowed) {
      return rateLimitExceededResponse(limit.retryAfterSeconds);
    }

    await ensureMessagesTable();

    const { id } = await params;
    const messageId = parsePositiveIntId(id);
    if (!messageId) {
      return NextResponse.json(
        { success: false, error: "Invalid post ID" },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { reply, parent_id } = body;

    const cleanReply = sanitizeText(reply, 2000);
    if (!cleanReply || cleanReply.length < 1 || cleanReply.length > 2000) {
      return NextResponse.json(
        {
          success: false,
          error: "Please enter your reply (1-2000 characters).",
        },
        { status: 400 }
      );
    }

    // Resolve and lock permanent alias tied strictly to verified device cookie
    const deviceIdentity = await getOrAssignDeviceIdentity(request);
    const cleanAlias = deviceIdentity.alias;

    // Verify post exists and is public
    const postCheck = await sql`
      SELECT id FROM anonymous_messages WHERE id = ${messageId} AND is_public = TRUE LIMIT 1
    `;
    if (postCheck.length === 0) {
      return NextResponse.json(
        { success: false, error: "Post not found or not active." },
        { status: 404 }
      );
    }

    let validParentId: number | null = null;
    if (parent_id) {
      const pId = parseInt(String(parent_id), 10);
      if (!isNaN(pId) && pId > 0) {
        const parentCheck = await sql`
          SELECT id FROM anonymous_message_replies
          WHERE id = ${pId} AND message_id = ${messageId}
          LIMIT 1
        `;
        if (parentCheck.length > 0) {
          validParentId = pId;
        }
      }
    }

    const rows = await sql`
      INSERT INTO anonymous_message_replies (
        message_id,
        parent_id,
        alias,
        device_id,
        reply
      ) VALUES (
        ${messageId},
        ${validParentId},
        ${cleanAlias.slice(0, 50)},
        ${deviceIdentity.deviceId},
        ${cleanReply}
      )
      RETURNING id, message_id, parent_id, alias, reply, likes_count, created_at
    `;

    const res = NextResponse.json({
      success: true,
      reply: rows[0],
    });

    return await attachDeviceCookie(res, deviceIdentity.deviceId, request);
  } catch (err: unknown) {
    console.error("POST /api/messages/[id]/replies error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to post reply." },
      { status: 500 }
    );
  }
}
