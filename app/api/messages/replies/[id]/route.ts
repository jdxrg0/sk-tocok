import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getCurrentUser, isOfficialUser } from "@/lib/auth";
import { ensureMessagesTable } from "@/lib/messages";
import { getOrAssignDeviceIdentity } from "@/lib/deviceIdentity";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/messages/replies/[id]
 * Allows deleting a comment/reply by:
 * 1. Logged-in SK Official (admin)
 * 2. Anonymous author whose alias matches
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureMessagesTable();

    const { id } = await params;
    const replyId = parseInt(id, 10);
    if (isNaN(replyId)) {
      return NextResponse.json(
        { success: false, error: "Invalid comment ID" },
        { status: 400 }
      );
    }

    // Check if user is an authenticated SK official
    const user = await getCurrentUser();
    const isAdmin = user && isOfficialUser(user);

    let alias: string | null = null;
    try {
      const body = await request.json().catch(() => ({}));
      if (body.alias) alias = String(body.alias).trim();
    } catch {
      // ignore
    }

    // Fallback to query param
    const { searchParams } = new URL(request.url);
    if (!alias && searchParams.get("alias")) {
      alias = searchParams.get("alias")!.trim();
    }

    // Find the reply
    const existing = await sql`
      SELECT id, message_id, alias FROM anonymous_message_replies WHERE id = ${replyId} LIMIT 1
    `;

    if (existing.length === 0) {
      return NextResponse.json(
        { success: false, error: "Comment not found." },
        { status: 404 }
      );
    }

    const reply = existing[0];

    // Check device identity authorization
    const deviceIdentity = await getOrAssignDeviceIdentity(request, alias);
    const verifiedDeviceAlias = deviceIdentity.alias;

    const isOwner = Boolean(
      (alias && reply.alias && reply.alias.toLowerCase() === alias.toLowerCase()) ||
      (verifiedDeviceAlias && reply.alias && reply.alias.toLowerCase() === verifiedDeviceAlias.toLowerCase())
    );

    if (!isAdmin && !isOwner) {
      return NextResponse.json(
        { success: false, error: "You can only delete your own comments." },
        { status: 403 }
      );
    }

    // Delete nested children if any
    await sql`
      DELETE FROM anonymous_message_replies WHERE parent_id = ${replyId}
    `;

    // Delete the reply itself
    await sql`
      DELETE FROM anonymous_message_replies WHERE id = ${replyId}
    `;

    return NextResponse.json({
      success: true,
      message: "Comment deleted successfully.",
      message_id: reply.message_id,
    });
  } catch (err: unknown) {
    console.error("DELETE /api/messages/replies/[id] error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to delete comment." },
      { status: 500 }
    );
  }
}
