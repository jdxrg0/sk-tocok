import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getCurrentUser, isOfficialUser } from "@/lib/auth";
import { ensureMessagesTable } from "@/lib/messages";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const messageId = parseInt(id, 10);
    if (isNaN(messageId)) {
      return NextResponse.json({ error: "Invalid message ID" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const { status, is_public, is_pinned, admin_reply } = body;

    // Check existing message
    const existing = await sql`
      SELECT id, admin_reply FROM anonymous_messages WHERE id = ${messageId} LIMIT 1
    `;
    if (existing.length === 0) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    // Determine reply metadata
    const isUpdatingReply = admin_reply !== undefined;
    const repliedBy = isUpdatingReply ? user.name || "SK Council" : null;

    // Build update query dynamically
    const rows = await sql`
      UPDATE anonymous_messages
      SET 
        status = COALESCE(${status !== undefined ? status : null}, status),
        is_public = COALESCE(${is_public !== undefined ? Boolean(is_public) : null}, is_public),
        is_pinned = COALESCE(${is_pinned !== undefined ? Boolean(is_pinned) : null}, is_pinned),
        admin_reply = COALESCE(${admin_reply !== undefined ? admin_reply : null}, admin_reply),
        replied_by = CASE WHEN ${isUpdatingReply} THEN ${repliedBy} ELSE replied_by END,
        replied_at = CASE WHEN ${isUpdatingReply} THEN NOW() ELSE replied_at END,
        updated_at = NOW()
      WHERE id = ${messageId}
      RETURNING *
    `;

    return NextResponse.json({
      success: true,
      message: "Message updated successfully",
      item: rows[0],
    });
  } catch (err: unknown) {
    console.error("PATCH /api/admin/messages/[id] error:", err);
    return NextResponse.json(
      { error: "Failed to update message" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const messageId = parseInt(id, 10);
    if (isNaN(messageId)) {
      return NextResponse.json({ error: "Invalid message ID" }, { status: 400 });
    }

    await sql`DELETE FROM anonymous_messages WHERE id = ${messageId}`;

    return NextResponse.json({
      success: true,
      message: "Message deleted successfully.",
    });
  } catch (err: unknown) {
    console.error("DELETE /api/admin/messages/[id] error:", err);
    return NextResponse.json(
      { error: "Failed to delete message" },
      { status: 500 }
    );
  }
}
