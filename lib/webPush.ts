import * as webpush from "web-push";
import { sql } from "@/lib/db";
import { ALLOWED_PUSH_HOSTS, validatePublicExternalUrl } from "@/lib/urlSafety";

// Ensure VAPID keys are configured
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || "mailto:sktocok2023@gmail.com";

let isVapidConfigured = false;
if (vapidPublicKey && vapidPrivateKey) {
  try {
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
    isVapidConfigured = true;
  } catch (err) {
    console.error("Failed to initialize web-push VAPID details:", err);
  }
}

export function getVapidPublicKey(): string | null {
  return vapidPublicKey || null;
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  icon?: string;
  badge?: string;
}

interface PushSubscriptionRow {
  id: number;
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * Sends a web push notification to all active devices subscribed for a specific user ID or user email.
 * Automatically cleans up invalid or expired subscriptions (HTTP 404 or 410).
 */
export async function sendPushNotificationToUser(
  userIdentifier: { userId?: number | null; userEmail?: string | null },
  payload: PushNotificationPayload
): Promise<{ success: boolean; sentCount: number; failureCount: number }> {
  if (!isVapidConfigured) {
    console.warn("Web Push is not configured: Missing NEXT_PUBLIC_VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY.");
    return { success: false, sentCount: 0, failureCount: 0 };
  }

  const { userId, userEmail } = userIdentifier;
  if (!userId && !userEmail) {
    return { success: false, sentCount: 0, failureCount: 0 };
  }

  let subs: PushSubscriptionRow[] = [];

  try {
    if (userId) {
      const rows = await sql`
        SELECT id, endpoint, p256dh, auth
        FROM push_subscriptions
        WHERE user_id = ${userId}
      `;
      subs = rows as PushSubscriptionRow[];
    } else if (userEmail) {
      const rows = await sql`
        SELECT ps.id, ps.endpoint, ps.p256dh, ps.auth
        FROM push_subscriptions ps
        JOIN users u ON u.id = ps.user_id
        WHERE LOWER(ps.user_email) = LOWER(${userEmail})
          AND COALESCE(u.email_verified, FALSE) = TRUE
      `;
      subs = rows as PushSubscriptionRow[];
    }
  } catch (err) {
    console.error("Failed to query push subscriptions:", err);
    return { success: false, sentCount: 0, failureCount: 0 };
  }

  if (subs.length === 0) {
    return { success: true, sentCount: 0, failureCount: 0 };
  }

  const jsonPayload = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url || "/printing?tab=track",
    tag: payload.tag || "sk-printing-update",
    icon: payload.icon || "/favicon.ico",
    badge: payload.badge || "/favicon.ico",
  });

  let sentCount = 0;
  let failureCount = 0;

  const expiredIds: number[] = [];

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await validatePublicExternalUrl(sub.endpoint, {
          requireHttps: true,
          allowedHosts: ALLOWED_PUSH_HOSTS,
        });
      } catch {
        failureCount++;
        expiredIds.push(sub.id);
        return;
      }

      const pushConfig = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      };

      try {
        await webpush.sendNotification(pushConfig, jsonPayload);
        sentCount++;
      } catch (err: unknown) {
        failureCount++;
        const statusCode = (err as { statusCode?: number })?.statusCode;
        // 404 (Not Found) or 410 (Gone) indicates unsubscribed or expired endpoint
        if (statusCode === 404 || statusCode === 410) {
          expiredIds.push(sub.id);
        } else {
          console.error(`Web push error to endpoint ${sub.endpoint.slice(0, 30)}...:`, err);
        }
      }
    })
  );

  // Clean up any stale endpoints in background
  if (expiredIds.length > 0) {
    try {
      for (const id of expiredIds) {
        await sql`DELETE FROM push_subscriptions WHERE id = ${id}`;
      }
    } catch (cleanupErr) {
      console.error("Failed to clean up expired push subscriptions:", cleanupErr);
    }
  }

  return { success: true, sentCount, failureCount };
}
