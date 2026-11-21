import crypto from "crypto";
import { sql } from "@/lib/db";
import { generateRandomAlias } from "@/lib/messages";
import { NextResponse } from "next/server";

export interface DeviceIdentity {
  deviceId: string;
  alias: string;
  isNew: boolean;
}

/**
 * Extract client IP address from proxy headers (Vercel, Cloudflare, standard proxy)
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "127.0.0.1";
}

/**
 * Extract device_id from cookie or header
 */
export function getClientDeviceId(request: Request): string | null {
  const headerDeviceId = request.headers.get("x-device-id");
  if (headerDeviceId && headerDeviceId.trim()) {
    return headerDeviceId.trim();
  }

  // Parse Cookie header
  const cookieHeader = request.headers.get("cookie") || "";
  const match = cookieHeader.match(/sk_device_id=([^;]+)/);
  if (match && match[1]) {
    return decodeURIComponent(match[1].trim());
  }

  return null;
}

/**
 * Resolve or assign a permanent, spoof-resistant alias tied to the device, IP, and browser
 */
export async function getOrAssignDeviceIdentity(
  request: Request,
  preferredAlias?: string | null
): Promise<DeviceIdentity> {
  const clientIp = getClientIp(request);
  const userAgent = request.headers.get("user-agent") || "unknown";

  const ipHash = crypto
    .createHash("sha256")
    .update(clientIp + "::sk_tocok_salt")
    .digest("hex")
    .slice(0, 32);

  const deviceFingerprint = crypto
    .createHash("sha256")
    .update(clientIp + "::" + userAgent)
    .digest("hex")
    .slice(0, 32);

  const providedDeviceId = getClientDeviceId(request);

  // 1. Try to find existing device record by device_id
  if (providedDeviceId) {
    const rows = await sql`
      SELECT id, device_id, alias
      FROM anonymous_device_identities
      WHERE device_id = ${providedDeviceId}
      LIMIT 1
    `;
    if (rows.length > 0) {
      await sql`
        UPDATE anonymous_device_identities
        SET last_seen_at = NOW(),
            ip_hash = ${ipHash},
            device_fingerprint = ${deviceFingerprint}
        WHERE device_id = ${providedDeviceId}
      `;
      return {
        deviceId: rows[0].device_id as string,
        alias: rows[0].alias as string,
        isNew: false,
      };
    }
  }

  // 2. Try to find existing device record by device_fingerprint (same device + IP, e.g. Incognito or cleared cookies)
  const fpRows = await sql`
    SELECT id, device_id, alias
    FROM anonymous_device_identities
    WHERE device_fingerprint = ${deviceFingerprint}
    ORDER BY last_seen_at DESC
    LIMIT 1
  `;
  if (fpRows.length > 0) {
    const existingAlias = fpRows[0].alias as string;
    const finalDeviceId = providedDeviceId || (fpRows[0].device_id as string);
    await sql`
      UPDATE anonymous_device_identities
      SET last_seen_at = NOW(),
          device_id = ${finalDeviceId}
      WHERE id = ${fpRows[0].id}
    `;
    return {
      deviceId: finalDeviceId,
      alias: existingAlias,
      isNew: false,
    };
  }

  // 3. If user previously had an alias in localStorage before this system was introduced:
  let candidateAlias = "";
  const cleanPreferred = (preferredAlias || "").trim().replace(/^u\//i, "");

  if (cleanPreferred && cleanPreferred.length >= 3 && cleanPreferred.length <= 50) {
    const aliasCheck = await sql`
      SELECT id FROM anonymous_device_identities WHERE alias = ${cleanPreferred} LIMIT 1
    `;
    if (aliasCheck.length === 0) {
      candidateAlias = cleanPreferred;
    }
  }

  // 4. Generate a unique new alias if none claimed
  if (!candidateAlias) {
    for (let attempts = 0; attempts < 10; attempts++) {
      const generated = generateRandomAlias();
      const exists = await sql`
        SELECT id FROM anonymous_device_identities WHERE alias = ${generated} LIMIT 1
      `;
      if (exists.length === 0) {
        candidateAlias = generated;
        break;
      }
    }
  }

  if (!candidateAlias) {
    candidateAlias = generateRandomAlias();
  }

  const newDeviceId = providedDeviceId || crypto.randomUUID();

  // 5. Insert new identity
  await sql`
    INSERT INTO anonymous_device_identities (
      device_id,
      alias,
      ip_hash,
      device_fingerprint,
      user_agent,
      created_at,
      last_seen_at
    ) VALUES (
      ${newDeviceId},
      ${candidateAlias},
      ${ipHash},
      ${deviceFingerprint},
      ${userAgent.slice(0, 500)},
      NOW(),
      NOW()
    )
    ON CONFLICT (device_id) DO UPDATE SET
      last_seen_at = NOW(),
      ip_hash = EXCLUDED.ip_hash,
      device_fingerprint = EXCLUDED.device_fingerprint
  `;

  return {
    deviceId: newDeviceId,
    alias: candidateAlias,
    isNew: true,
  };
}

/**
 * Attach long-lived device cookie to response
 */
export function attachDeviceCookie(
  response: NextResponse,
  deviceId: string
): NextResponse {
  response.cookies.set("sk_device_id", deviceId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365 * 5, // 5 years
    httpOnly: false, // accessible to client for fast hydration
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}
