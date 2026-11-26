import { generateRandomHex, signHmacToken, verifyHmacToken } from "@/lib/edgeCrypto";
import { getAllowedOrigins } from "@/lib/env";

export const CSRF_COOKIE_NAME = "sk_csrf_token";
export const CSRF_HEADER_NAME = "x-csrf-token";

export async function createCsrfToken(secret: string): Promise<string> {
  const nonce = generateRandomHex(24);
  return signHmacToken(nonce, secret);
}

export async function verifyCsrfTokenPair(
  cookieToken: string | undefined | null,
  headerToken: string | undefined | null,
  secret: string
): Promise<boolean> {
  if (!cookieToken || !headerToken) return false;
  if (cookieToken !== headerToken) return false;
  const verified = await verifyHmacToken(cookieToken, secret);
  return verified !== null;
}

export function getExpectedRequestOrigins(request: Request): Set<string> {
  const allowed = new Set<string>(getAllowedOrigins());
  try {
    const reqUrl = new URL(request.url);
    allowed.add(reqUrl.origin);
  } catch {
    // ignore
  }

  const host = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() || request.headers.get("host")?.trim();
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();

  if (host) {
    if (proto === "http" || proto === "https") {
      allowed.add(`${proto}://${host}`);
    } else {
      allowed.add(`https://${host}`);
      allowed.add(`http://${host}`);
    }
  }
  return allowed;
}

export function isAllowedCrossOrigin(origin: string | null, request: Request): boolean {
  if (!origin) return true;
  const allowed = getExpectedRequestOrigins(request);
  return allowed.has(origin);
}

/**
 * Verifies same-origin / trusted-origin semantics for state-changing browser requests.
 */
export function verifyRequestOrigin(request: Request): { ok: boolean; reason?: string } {
  const secFetchSite = request.headers.get("sec-fetch-site")?.toLowerCase();
  if (secFetchSite === "cross-site") {
    const origin = request.headers.get("origin");
    if (!origin || !isAllowedCrossOrigin(origin, request)) {
      return { ok: false, reason: "Cross-site fetch rejected" };
    }
  }

  const origin = request.headers.get("origin");
  if (origin) {
    if (!isAllowedCrossOrigin(origin, request)) {
      return { ok: false, reason: `Untrusted Origin: ${origin}` };
    }
    return { ok: true };
  }

  const referer = request.headers.get("referer");
  if (referer) {
    try {
      const refOrigin = new URL(referer).origin;
      if (!isAllowedCrossOrigin(refOrigin, request)) {
        return { ok: false, reason: `Untrusted Referer: ${refOrigin}` };
      }
    } catch {
      return { ok: false, reason: "Malformed Referer header" };
    }
  }

  return { ok: true };
}
