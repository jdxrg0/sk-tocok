import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getCurrentUser, isOfficialUser } from "@/lib/auth";
import { ensureMessagesTable } from "@/lib/messages";
import { getVerifiedDeviceId } from "@/lib/deviceIdentity";
import { constantTimeEqual } from "@/lib/edgeCrypto";
import { logSecurityEvent } from "@/lib/securityLogger";
import { parsePositiveIntId } from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/messages/replies/[id]
 * Strictly requires EITHER logged-in SK Official OR verified HMAC device session cookie matching comment owner.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureMessagesTable();

    const { id } = await params;
    const replyId = parsePositiveIntId(id);
    if (!replyId) {
      return NextResponse.json(
        { success: false, error: "Invalid comment ID" },
        { status: 400 }
      );
    }

    const user = await getCurrentUser(request);
    const isAdmin = Boolean(user && isOfficialUser(user));

    const existing = await sql`
      SELECT id, message_id, alias, device_id
      FROM anonymous_message_replies
      WHERE id = ${replyId}
      LIMIT 1
    `;

    if (existing.length === 0) {
      return NextResponse.json(
        { success: false, error: "Comment not found." },
        { status: 404 }
      );
    }

    const reply = existing[0] as {
      id: number;
      message_id: number;
      alias: string | null;
      device_id?: string | null;
    };

    let isOwner = false;
    if (!isAdmin) {
      const verifiedDeviceId = await getVerifiedDeviceId(request);
      if (verifiedDeviceId) {
        if (reply.device_id) {
          isOwner = constantTimeEqual(String(reply.device_id), verifiedDeviceId);
        } else if (reply.alias) {
          const devRows = await sql`
            SELECT alias FROM anonymous_device_identities WHERE device_id = ${verifiedDeviceId} LIMIT 1
          `;
          const ownedAlias = (devRows[0] as { alias?: string } | undefined)?.alias;
          if (ownedAlias && ownedAlias.toLowerCase() === reply.alias.toLowerCase()) {
            isOwner = true;
          }
        }
      }
    }

    if (!isAdmin && !isOwner) {
      await logSecurityEvent({
        eventType: "IDOR_REPLY_DELETE_BLOCKED",
        severity: "high",
        request,
        userId: user?.id ?? null,
        details: { replyId },
      });
      return NextResponse.json(
        { success: false, error: "You can only delete your own comments." },
        { status: 403 }
      );
    }

    await sql`DELETE FROM anonymous_message_replies WHERE parent_id = ${replyId}`;
    await sql`DELETE FROM anonymous_message_replies WHERE id = ${replyId}`;

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
