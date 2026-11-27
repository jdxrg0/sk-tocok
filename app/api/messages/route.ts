import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import {
  ensureMessagesTable,
  generateTrackingCode,
  generateRandomAlias,
  MESSAGE_CATEGORIES,
  PUROK_OPTIONS,
} from "@/lib/messages";
import {
  getOrAssignDeviceIdentity,
  attachDeviceCookie,
} from "@/lib/deviceIdentity";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/rateLimit";
import { sanitizeText } from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * Public GET: Fetch approved & public messages for the Freedom Wall & Q&A Board
 */
export async function GET(request: Request) {
  try {
    await ensureMessagesTable();

    const { searchParams } = new URL(request.url);
    const category = (searchParams.get("category") || "all").trim();
    const sort = (searchParams.get("sort") || "latest").trim().toLowerCase();
    const q = (searchParams.get("q") || "").trim().slice(0, 100);

    if (q) {
      const searchLimit = await checkRateLimit({
        request,
        bucket: "messages_search",
        max: 60,
        windowMs: 60 * 1000,
        persistToDb: true,
      });
      if (!searchLimit.allowed) {
        return rateLimitExceededResponse(searchLimit.retryAfterSeconds);
      }
    }

    const isPopular = sort === "popular" || sort === "top";
    const isDiscussed = sort === "discussed";
    const isOldest = sort === "oldest";
    const rawLimit = parseInt(searchParams.get("limit") || "500", 10);
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 1000) : 500;

    // Fetch category counts for approved public messages
    const [countsRows, messagesRows] = await Promise.all([
      sql`
        SELECT category, COUNT(*) as count
        FROM anonymous_messages
        WHERE is_public = TRUE AND status != 'rejected' AND status != 'archived'
        GROUP BY category
      `,
      isPopular
        ? sql`
            SELECT 
              m.id, 
              m.tracking_code, 
              m.alias, 
              m.category, 
              m.purok, 
              m.subject, 
              m.message, 
              m.is_pinned, 
              m.admin_reply, 
              m.replied_by, 
              m.replied_at, 
              m.likes_count, 
              m.created_at,
              COUNT(r.id)::int as replies_count
            FROM anonymous_messages m
            LEFT JOIN anonymous_message_replies r ON r.message_id = m.id
            WHERE m.is_public = TRUE AND m.status != 'rejected' AND m.status != 'archived'
            GROUP BY m.id
            ORDER BY m.is_pinned DESC, m.likes_count DESC, m.created_at DESC
            LIMIT ${limit}
          `
        : isDiscussed
        ? sql`
            SELECT 
              m.id, 
              m.tracking_code, 
              m.alias, 
              m.category, 
              m.purok, 
              m.subject, 
              m.message, 
              m.is_pinned, 
              m.admin_reply, 
              m.replied_by, 
              m.replied_at, 
              m.likes_count, 
              m.created_at,
              COUNT(r.id)::int as replies_count
            FROM anonymous_messages m
            LEFT JOIN anonymous_message_replies r ON r.message_id = m.id
            WHERE m.is_public = TRUE AND m.status != 'rejected' AND m.status != 'archived'
            GROUP BY m.id
            ORDER BY m.is_pinned DESC, COUNT(r.id) DESC, m.created_at DESC
            LIMIT ${limit}
          `
        : isOldest
        ? sql`
            SELECT 
              m.id, 
              m.tracking_code, 
              m.alias, 
              m.category, 
              m.purok, 
              m.subject, 
              m.message, 
              m.is_pinned, 
              m.admin_reply, 
              m.replied_by, 
              m.replied_at, 
              m.likes_count, 
              m.created_at,
              COUNT(r.id)::int as replies_count
            FROM anonymous_messages m
            LEFT JOIN anonymous_message_replies r ON r.message_id = m.id
            WHERE m.is_public = TRUE AND m.status != 'rejected' AND m.status != 'archived'
            GROUP BY m.id
            ORDER BY m.is_pinned DESC, m.created_at ASC
            LIMIT ${limit}
          `
        : sql`
            SELECT 
              m.id, 
              m.tracking_code, 
              m.alias, 
              m.category, 
              m.purok, 
              m.subject, 
              m.message, 
              m.is_pinned, 
              m.admin_reply, 
              m.replied_by, 
              m.replied_at, 
              m.likes_count, 
              m.created_at,
              COUNT(r.id)::int as replies_count
            FROM anonymous_messages m
            LEFT JOIN anonymous_message_replies r ON r.message_id = m.id
            WHERE m.is_public = TRUE AND m.status != 'rejected' AND m.status != 'archived'
            GROUP BY m.id
            ORDER BY m.is_pinned DESC, m.created_at DESC
            LIMIT ${limit}
          `,
    ]);

    // Format counts
    const categoryCounts: Record<string, number> = { all: 0 };
    let totalPublic = 0;
    for (const row of countsRows) {
      const c = (row.category as string) || "General";
      const count = Number(row.count) || 0;
      categoryCounts[c] = count;
      totalPublic += count;
    }
    categoryCounts.all = totalPublic;

    // Apply client filters if requested
    let filtered = messagesRows;
    if (category !== "all") {
      filtered = filtered.filter(
        (m) =>
          ((m.category as string) || "").toLowerCase() === category.toLowerCase()
      );
    }
    if (q) {
      const queryLower = q.toLowerCase();
      filtered = filtered.filter(
        (m) =>
          ((m.subject as string) || "").toLowerCase().includes(queryLower) ||
          ((m.message as string) || "").toLowerCase().includes(queryLower) ||
          ((m.alias as string) || "").toLowerCase().includes(queryLower) ||
          ((m.admin_reply as string) || "").toLowerCase().includes(queryLower)
      );
    }

    return NextResponse.json({
      success: true,
      total: filtered.length,
      categoryCounts,
      messages: filtered,
    });
  } catch (err: unknown) {
    console.error("GET /api/messages error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to load community messages." },
      { status: 500 }
    );
  }
}

/**
 * Public POST: Submit an anonymous message to the SK Council
 */
export async function POST(request: Request) {
  try {
    const limit = await checkRateLimit({
      request,
      bucket: "messages_post",
      max: 8,
      windowMs: 15 * 60 * 1000,
      persistToDb: true,
    });
    if (!limit.allowed) {
      return rateLimitExceededResponse(
        limit.retryAfterSeconds,
        "You are posting too quickly. Please wait a few minutes before submitting another message."
      );
    }

    await ensureMessagesTable();

    const body = await request.json().catch(() => ({}));
    const { category, subject, message, purok, honeypot } = body;

    // Honeypot spam trap
    if (honeypot && String(honeypot).trim() !== "") {
      return NextResponse.json({
        success: true,
        tracking_code: generateTrackingCode(),
        message: "Message received.",
      });
    }

    // Validation: Message is the only required user input
    const cleanMessage = sanitizeText(message, 3000);
    if (!cleanMessage || cleanMessage.length < 5 || cleanMessage.length > 3000) {
      return NextResponse.json(
        {
          success: false,
          error: "Please enter your suggestion or message (at least 5 characters).",
        },
        { status: 400 }
      );
    }

    // Resolve and lock permanent alias tied to cryptographically signed device session
    const deviceIdentity = await getOrAssignDeviceIdentity(request);
    const cleanAlias = deviceIdentity.alias;

    // Auto-generate subject from first sentence/line if none provided
    let cleanSubject = sanitizeText(subject, 120);
    if (!cleanSubject) {
      const firstLine = cleanMessage.split(/[\n.!?]/)[0]?.trim() || "";
      cleanSubject =
        firstLine.length >= 3
          ? firstLine.length > 60
            ? firstLine.slice(0, 57) + "..."
            : firstLine
          : "Community Suggestion";
    }

    // Category defaults to "Suggestion"
    const rawCategory = String(category || "Suggestion").trim();
    const validCategory = (MESSAGE_CATEGORIES as readonly string[]).includes(
      rawCategory
    )
      ? rawCategory
      : "Suggestion";

    const cleanPurok = String(purok || "").trim();
    const validPurok = (PUROK_OPTIONS as readonly string[]).includes(cleanPurok)
      ? cleanPurok
      : null;

    // Generate unique tracking code
    let trackingCode = generateTrackingCode();
    for (let attempts = 0; attempts < 5; attempts++) {
      const existing = await sql`
        SELECT id FROM anonymous_messages WHERE tracking_code = ${trackingCode} LIMIT 1
      `;
      if (existing.length === 0) break;
      trackingCode = generateTrackingCode();
    }

    const requiresModeration = validCategory === "Concern / Grievance";
    const initialStatus = requiresModeration ? "pending" : "approved";
    const initialIsPublic = !requiresModeration;

    const rows = await sql`
      INSERT INTO anonymous_messages (
        tracking_code,
        alias,
        device_id,
        category,
        purok,
        subject,
        message,
        status,
        is_public,
        is_pinned
      ) VALUES (
        ${trackingCode},
        ${cleanAlias.slice(0, 50)},
        ${deviceIdentity.deviceId},
        ${validCategory},
        ${validPurok},
        ${cleanSubject},
        ${cleanMessage},
        ${initialStatus},
        ${initialIsPublic},
        FALSE
      )
      RETURNING id, tracking_code, created_at
    `;

    const res = NextResponse.json({
      success: true,
      id: rows[0].id,
      tracking_code: rows[0].tracking_code,
      alias: cleanAlias,
      status: initialStatus,
      is_public: initialIsPublic,
      message: requiresModeration
        ? "Your concern was submitted privately to the SK Council for review. Save your tracking code to view responses."
        : "Your anonymous post is live! You can use your tracking code to follow up anytime.",
    });

    return await attachDeviceCookie(res, deviceIdentity.deviceId, request);
  } catch (err: unknown) {
    console.error("POST /api/messages error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to submit anonymous message." },
      { status: 500 }
    );
  }
}
