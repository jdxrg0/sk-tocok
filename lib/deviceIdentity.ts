import crypto from "crypto";
import { sql } from "@/lib/db";
import { generateRandomAlias } from "@/lib/messages";
import { getJwtSecret } from "@/lib/env";
import { isRequestSecure } from "@/lib/auth";
import { signHmacToken, verifyHmacToken } from "@/lib/edgeCrypto";
import { extractClientIp } from "@/lib/securityLogger";
import { NextResponse } from "next/server";

export const DEVICE_SESSION_COOKIE = "sk_device_session";

export interface DeviceIdentity {
  deviceId: string;
  alias: string;
  isNew: boolean;
}

/**
 * Extract cryptographically verified device_id ONLY from the signed HttpOnly cookie.
 */
export async function getVerifiedDeviceId(request: Request): Promise<string | null> {
  const cookieHeader = request.headers.get("cookie") || "";
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${DEVICE_SESSION_COOKIE}=([^;]+)`));
  if (!match || !match[1]) return null;

  try {
    const rawCookie = decodeURIComponent(match[1].trim());
    const verified = await verifyHmacToken(rawCookie, getJwtSecret());
    if (!verified || !/^[a-zA-Z0-9-]{8,100}$/.test(verified)) {
      return null;
    }
    return verified;
  } catch {
    return null;
  }
}

/**
 * Resolve or assign a permanent, spoof-resistant alias tied to a cryptographically signed HttpOnly cookie.
 * Never trusts unsigned client headers or mutable IP+UA fingerprints to hijack existing identities.
 */
export async function getOrAssignDeviceIdentity(
  request: Request
): Promise<DeviceIdentity> {
  const clientIp = extractClientIp(request);
  const userAgent = request.headers.get("user-agent") || "unknown";
  const secret = getJwtSecret();

  const ipHash = crypto
    .createHmac("sha256", secret)
    .update(clientIp)
    .digest("hex")
    .slice(0, 32);

  const deviceFingerprint = crypto
    .createHmac("sha256", secret)
    .update(`${clientIp}::${userAgent}`)
    .digest("hex")
    .slice(0, 32);

  const verifiedDeviceId = await getVerifiedDeviceId(request);

  if (verifiedDeviceId) {
    const rows = await sql`
      SELECT id, device_id, alias
      FROM anonymous_device_identities
      WHERE device_id = ${verifiedDeviceId}
      LIMIT 1
    `;
    if (rows.length > 0) {
      await sql`
        UPDATE anonymous_device_identities
        SET last_seen_at = NOW(),
            ip_hash = ${ipHash},
            device_fingerprint = ${deviceFingerprint}
        WHERE device_id = ${verifiedDeviceId}
      `;
      return {
        deviceId: rows[0].device_id as string,
        alias: rows[0].alias as string,
        isNew: false,
      };
    }
  }

  let candidateAlias = "";
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

  if (!candidateAlias) {
    candidateAlias = generateRandomAlias();
  }

  const newDeviceId = crypto.randomUUID();

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
 * Attach signed HttpOnly device session cookie to response.
 */
export async function attachDeviceCookie(
  response: NextResponse,
  deviceId: string,
  request?: Request
): Promise<NextResponse> {
  const signed = await signHmacToken(deviceId, getJwtSecret());
  response.cookies.set(DEVICE_SESSION_COOKIE, signed, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365 * 5,
    httpOnly: true,
    sameSite: "lax",
    secure: isRequestSecure(request),
  });
  return response;
}
