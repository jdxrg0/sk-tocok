export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getCurrentUser, isOfficialUser } from "@/lib/auth";
import { validatePublicExternalUrl } from "@/lib/urlSafety";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/rateLimit";
import { logSecurityEvent } from "@/lib/securityLogger";

export async function POST(request: Request) {
  try {
    const limit = await checkRateLimit({
      request,
      bucket: "push_subscribe",
      max: 20,
      windowMs: 15 * 60 * 1000,
    });
    if (!limit.allowed) {
      return rateLimitExceededResponse(limit.retryAfterSeconds);
    }

    const user = await getCurrentUser(request);
    const body = await request.json().catch(() => ({}));
    const subscription = body?.subscription;

    if (
      !subscription ||
      typeof subscription.endpoint !== "string" ||
      typeof subscription.keys?.p256dh !== "string" ||
      typeof subscription.keys?.auth !== "string"
    ) {
      return NextResponse.json({ error: "Invalid subscription payload." }, { status: 400 });
    }

    try {
      await validatePublicExternalUrl(subscription.endpoint, { requireHttps: true });
    } catch {
      await logSecurityEvent({
        eventType: "INVALID_PUSH_ENDPOINT_BLOCKED",
        severity: "warning",
        request,
        userId: user?.id ?? null,
      });
      return NextResponse.json({ error: "Push endpoint must be a valid public HTTPS URL." }, { status: 400 });
    }

    const endpoint = subscription.endpoint.trim();
    const p256dh = subscription.keys.p256dh.trim();
    const auth = subscription.keys.auth.trim();

    if (endpoint.length > 1000 || p256dh.length < 16 || p256dh.length > 512 || auth.length < 8 || auth.length > 256) {
      return NextResponse.json({ error: "Invalid push subscription key lengths." }, { status: 400 });
    }

    // Prevent unauthenticated or cross-user takeover of an existing user-bound endpoint
    const existing = await sql`SELECT user_id FROM push_subscriptions WHERE endpoint = ${endpoint} LIMIT 1`;
    if (existing.length > 0) {
      const existingOwner = (existing[0] as { user_id: number | null }).user_id;
      if (existingOwner !== null && (!user || (existingOwner !== user.id && !isOfficialUser(user)))) {
        return NextResponse.json({ error: "Forbidden: push endpoint belongs to another account." }, { status: 403 });
      }
    }

    const userId = user ? user.id : null;
    const userEmail = user ? user.email : null;

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
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: "Authentication required to manage push subscriptions." }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const endpoint = typeof body?.endpoint === "string" ? body.endpoint.trim() : "";

    if (!endpoint) {
      return NextResponse.json({ error: "Endpoint is required to unsubscribe." }, { status: 400 });
    }

    if (isOfficialUser(user)) {
      await sql`DELETE FROM push_subscriptions WHERE endpoint = ${endpoint}`;
    } else {
      await sql`
        DELETE FROM push_subscriptions
        WHERE endpoint = ${endpoint}
          AND (user_id = ${user.id} OR LOWER(user_email) = LOWER(${user.email}))
      `;
    }

    return NextResponse.json({ success: true, message: "Unsubscribed successfully." });
  } catch (error) {
    console.error("Push unsubscribe error:", error);
    return NextResponse.json({ error: "Failed to remove push subscription." }, { status: 500 });
  }
}
