import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getCurrentUser, isOfficialUser } from "@/lib/auth";
import { ensureMessagesTable } from "@/lib/messages";
import { getVerifiedDeviceId } from "@/lib/deviceIdentity";
import { constantTimeEqual } from "@/lib/edgeCrypto";
import { logSecurityEvent } from "@/lib/securityLogger";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/messages/[id]
 * Strictly requires EITHER:
 * 1. Logged-in SK Official (admin)
 * 2. Cryptographically signed HttpOnly device session cookie matching post ownership
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureMessagesTable();

    const { id } = await params;
    const messageId = parseInt(id, 10);
    if (isNaN(messageId) || messageId <= 0) {
      return NextResponse.json(
        { success: false, error: "Invalid post ID" },
        { status: 400 }
      );
    }

    const user = await getCurrentUser(request);
    const isAdmin = Boolean(user && isOfficialUser(user));

    const existing = await sql`
      SELECT id, alias, device_id FROM anonymous_messages WHERE id = ${messageId} LIMIT 1
    `;

    if (existing.length === 0) {
      return NextResponse.json(
        { success: false, error: "Post not found." },
        { status: 404 }
      );
    }

    const post = existing[0] as {
      id: number;
      alias: string | null;
      device_id?: string | null;
    };

    let isOwner = false;
    if (!isAdmin) {
      const verifiedDeviceId = await getVerifiedDeviceId(request);
      if (verifiedDeviceId) {
        if (post.device_id) {
          isOwner = constantTimeEqual(String(post.device_id), verifiedDeviceId);
        } else if (post.alias) {
          // Fallback for legacy pre-migration rows without device_id column populated
          const devRows = await sql`
            SELECT alias FROM anonymous_device_identities WHERE device_id = ${verifiedDeviceId} LIMIT 1
          `;
          const ownedAlias = (devRows[0] as { alias?: string } | undefined)?.alias;
          if (ownedAlias && ownedAlias.toLowerCase() === post.alias.toLowerCase()) {
            isOwner = true;
          }
        }
      }
    }

    if (!isAdmin && !isOwner) {
      await logSecurityEvent({
        eventType: "IDOR_MESSAGE_DELETE_BLOCKED",
        severity: "high",
        request,
        userId: user?.id ?? null,
        details: { messageId },
      });
      return NextResponse.json(
        { success: false, error: "You can only delete your own posts." },
        { status: 403 }
      );
    }

    await sql`DELETE FROM anonymous_message_replies WHERE message_id = ${messageId}`;
    await sql`DELETE FROM anonymous_messages WHERE id = ${messageId}`;

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
