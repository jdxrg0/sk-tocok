import { NextResponse } from "next/server";
import {
  getOrAssignDeviceIdentity,
  attachDeviceCookie,
} from "@/lib/deviceIdentity";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/**
 * GET /api/messages/alias
 * Resolve or register the permanent alias locked to this device's HMAC-signed HttpOnly cookie.
 */
export async function GET(request: Request) {
  try {
    const limit = await checkRateLimit({
      request,
      bucket: "messages_alias",
      max: 30,
      windowMs: 15 * 60 * 1000,
      persistToDb: true,
    });
    if (!limit.allowed) {
      return rateLimitExceededResponse(limit.retryAfterSeconds);
    }

    const identity = await getOrAssignDeviceIdentity(request);

    const res = NextResponse.json({
      success: true,
      alias: identity.alias,
      is_new: identity.isNew,
    });

    return await attachDeviceCookie(res, identity.deviceId, request);
  } catch (err: unknown) {
    console.error("GET /api/messages/alias error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to resolve device alias." },
      { status: 500 }
    );
  }
}
