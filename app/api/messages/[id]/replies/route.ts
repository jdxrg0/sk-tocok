import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureMessagesTable, generateRandomAlias } from "@/lib/messages";

export const dynamic = "force-dynamic";

/**
 * GET /api/messages/[id]/replies
 * Get all anonymous replies for a message/post
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureMessagesTable();

    const { id } = await params;
    const messageId = parseInt(id, 10);
    if (isNaN(messageId)) {
      return NextResponse.json(
        { success: false, error: "Invalid post ID" },
        { status: 400 }
      );
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
 * Add an anonymous reply/comment to a post (no approval required!)
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureMessagesTable();

    const { id } = await params;
    const messageId = parseInt(id, 10);
    if (isNaN(messageId)) {
      return NextResponse.json(
        { success: false, error: "Invalid post ID" },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { alias, reply, parent_id } = body;

    const cleanReply = String(reply || "").trim();
    if (!cleanReply || cleanReply.length < 1 || cleanReply.length > 2000) {
      return NextResponse.json(
        {
          success: false,
          error: "Please enter your reply (1-2000 characters).",
        },
        { status: 400 }
      );
    }

    const cleanAlias = String(alias || "").trim() || generateRandomAlias();

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
        reply
      ) VALUES (
        ${messageId},
        ${validParentId},
        ${cleanAlias.slice(0, 50)},
        ${cleanReply}
      )
      RETURNING id, message_id, parent_id, alias, reply, likes_count, created_at
    `;

    return NextResponse.json({
      success: true,
      reply: rows[0],
    });
  } catch (err: unknown) {
    console.error("POST /api/messages/[id]/replies error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to post reply." },
      { status: 500 }
    );
  }
}
