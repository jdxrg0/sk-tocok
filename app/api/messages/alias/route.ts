import { NextResponse } from "next/server";
import {
  getOrAssignDeviceIdentity,
  attachDeviceCookie,
} from "@/lib/deviceIdentity";

export const dynamic = "force-dynamic";

/**
 * GET /api/messages/alias
 * Resolve or register the permanent alias locked to this device / IP / browser.
 */
export async function GET(request: Request) {
  try {
    const storedAlias = request.headers.get("x-stored-alias");
    const identity = await getOrAssignDeviceIdentity(request, storedAlias);

    const res = NextResponse.json({
      success: true,
      alias: identity.alias,
      device_id: identity.deviceId,
      is_new: identity.isNew,
    });

    return attachDeviceCookie(res, identity.deviceId);
  } catch (err: unknown) {
    console.error("GET /api/messages/alias error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to resolve device alias." },
      { status: 500 }
    );
  }
}
