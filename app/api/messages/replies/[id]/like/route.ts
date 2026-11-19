import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureMessagesTable } from "@/lib/messages";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureMessagesTable();

    const { id } = await params;
    const replyId = parseInt(id, 10);
    if (isNaN(replyId)) {
      return NextResponse.json(
        { success: false, error: "Invalid reply ID" },
        { status: 400 }
      );
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

    const rows = isUnlike
      ? await sql`
          UPDATE anonymous_message_replies
          SET likes_count = GREATEST(0, COALESCE(likes_count, 0) - 1)
          WHERE id = ${replyId}
          RETURNING id, likes_count
        `
      : await sql`
          UPDATE anonymous_message_replies
          SET likes_count = COALESCE(likes_count, 0) + 1
          WHERE id = ${replyId}
          RETURNING id, likes_count
        `;

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Reply not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      likes_count: rows[0].likes_count,
    });
  } catch (err: unknown) {
    console.error("POST /api/messages/replies/[id]/like error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to record like." },
      { status: 500 }
    );
  }
}
