import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getCurrentUser, isOfficialUser } from "@/lib/auth";
import { ensureMessagesTable } from "@/lib/messages";
import { getOrAssignDeviceIdentity } from "@/lib/deviceIdentity";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/messages/[id]
 * Allows deleting a post by:
 * 1. Logged-in SK Official (admin)
 * 2. Anonymous author whose alias or tracking_code matches
 */
export async function DELETE(
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

    // Check if user is an authenticated SK official
    const user = await getCurrentUser();
    const isAdmin = user && isOfficialUser(user);

    let alias: string | null = null;
    let trackingCode: string | null = null;

    try {
      const body = await request.json().catch(() => ({}));
      if (body.alias) alias = String(body.alias).trim();
      if (body.tracking_code) trackingCode = String(body.tracking_code).trim();
    } catch {
      // ignore
    }

    // Also check search params as fallback
    const { searchParams } = new URL(request.url);
    if (!alias && searchParams.get("alias")) {
      alias = searchParams.get("alias")!.trim();
    }
    if (!trackingCode && searchParams.get("tracking_code")) {
      trackingCode = searchParams.get("tracking_code")!.trim();
    }

    // Find the message
    const existing = await sql`
      SELECT id, alias, tracking_code FROM anonymous_messages WHERE id = ${messageId} LIMIT 1
    `;

    if (existing.length === 0) {
      return NextResponse.json(
        { success: false, error: "Post not found." },
        { status: 404 }
      );
    }

    const post = existing[0];

    // Check device identity authorization
    const deviceIdentity = await getOrAssignDeviceIdentity(request, alias);
    const verifiedDeviceAlias = deviceIdentity.alias;

    // Check authorization: must be admin OR matching alias OR matching tracking_code OR matching device alias
    const isOwner =
      Boolean(alias && post.alias && post.alias.toLowerCase() === alias.toLowerCase()) ||
      Boolean(verifiedDeviceAlias && post.alias && post.alias.toLowerCase() === verifiedDeviceAlias.toLowerCase()) ||
      Boolean(trackingCode && post.tracking_code === trackingCode);

    if (!isAdmin && !isOwner) {
      return NextResponse.json(
        { success: false, error: "You can only delete your own posts." },
        { status: 403 }
      );
    }

    // Delete replies first
    await sql`
      DELETE FROM anonymous_message_replies WHERE message_id = ${messageId}
    `;

    // Delete post
    await sql`
      DELETE FROM anonymous_messages WHERE id = ${messageId}
    `;

    return NextResponse.json({
      success: true,
      message: "Post deleted successfully.",
    });
  } catch (err: unknown) {
    console.error("DELETE /api/messages/[id] error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to delete post." },
      { status: 500 }
    );
  }
}
