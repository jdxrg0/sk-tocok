import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    const body = await request.json();
    const { subscription } = body;

    if (!subscription || !subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
      return NextResponse.json({ error: "Invalid subscription payload." }, { status: 400 });
    }

    const { endpoint, keys } = subscription;
    const { p256dh, auth } = keys;

    const userId = user ? user.id : null;
    const userEmail = user ? user.email : null;

    // Insert or update push subscription
    await sql`
      INSERT INTO push_subscriptions (user_id, user_email, endpoint, p256dh, auth, updated_at)
      VALUES (${userId}, ${userEmail}, ${endpoint}, ${p256dh}, ${auth}, NOW())
      ON CONFLICT (endpoint)
      DO UPDATE SET
        user_id = COALESCE(EXCLUDED.user_id, push_subscriptions.user_id),
        user_email = COALESCE(EXCLUDED.user_email, push_subscriptions.user_email),
        p256dh = EXCLUDED.p256dh,
        auth = EXCLUDED.auth,
        updated_at = NOW()
    `;

    return NextResponse.json({ success: true, message: "Subscribed to push notifications successfully." });
  } catch (error) {
    console.error("Push subscription error:", error);
    return NextResponse.json({ error: "Failed to save push subscription." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { endpoint } = body;

    if (!endpoint) {
      return NextResponse.json({ error: "Endpoint is required to unsubscribe." }, { status: 400 });
    }

    await sql`DELETE FROM push_subscriptions WHERE endpoint = ${endpoint}`;

    return NextResponse.json({ success: true, message: "Unsubscribed successfully." });
  } catch (error) {
    console.error("Push unsubscribe error:", error);
    return NextResponse.json({ error: "Failed to remove push subscription." }, { status: 500 });
  }
}
