import { generateRandomHex, signHmacToken, verifyHmacToken } from "@/lib/edgeCrypto";
import { getAllowedOrigins, getConfiguredTrustedHosts, isLocalHostName } from "@/lib/env";

export const CSRF_COOKIE_NAME = "sk_csrf_token";
export const CSRF_HEADER_NAME = "x-csrf-token";

const SAFE_HOST_RE = /^[a-zA-Z0-9.-]+(?::\d{1,5})?$/;

export async function createCsrfToken(secret: string): Promise<string> {
  const nonce = generateRandomHex(24);
  return signHmacToken(nonce, secret);
}

export async function attachFreshCsrfCookie(
  response: {
    cookies: {
      set: (
        name: string,
        value: string,
        options: {
          path: string;
          httpOnly: boolean;
          sameSite: "strict";
          secure: boolean;
          maxAge: number;
        }
      ) => void;
    };
  },
  isSecure: boolean
): Promise<void> {
  const secret = process.env.JWT_SECRET?.trim() || "";
  if (secret.length < 32) return;
  const freshCsrf = await createCsrfToken(secret);
  response.cookies.set(CSRF_COOKIE_NAME, freshCsrf, {
    path: "/",
    httpOnly: false,
    sameSite: "strict",
    secure: isSecure,
    maxAge: 60 * 60 * 24 * 7,
  });
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
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (siteUrl) {
    try {
      allowed.add(new URL(siteUrl).origin);
    } catch {
      // ignore
    }
  }
  for (const envHost of [process.env.VERCEL_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL]) {
    const h = envHost?.trim();
    if (h && SAFE_HOST_RE.test(h)) {
      allowed.add(`https://${h}`);
    }
  }

  try {
    const reqUrl = new URL(request.url);
    allowed.add(reqUrl.origin);
  } catch {
    // ignore
  }

  const trustedHosts = getConfiguredTrustedHosts();
  const rawHost = request.headers.get("host")?.trim() || "";
  const rawForwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() || "";
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();

  // Only honor x-forwarded-host on Vercel or when it matches explicitly configured trusted hosts
  const candidateHosts: string[] = [];
  if (rawHost && SAFE_HOST_RE.test(rawHost)) {
    candidateHosts.push(rawHost);
  }
  if (
    rawForwardedHost &&
    SAFE_HOST_RE.test(rawForwardedHost) &&
    (process.env.VERCEL === "1" ||
      trustedHosts.has(rawForwardedHost.toLowerCase()) ||
      (rawHost && rawForwardedHost.toLowerCase() === rawHost.toLowerCase()))
  ) {
    candidateHosts.push(rawForwardedHost);
  }

  for (const host of candidateHosts) {
    if (proto === "http" || proto === "https") {
      allowed.add(`${proto}://${host}`);
    } else if (isLocalHostName(host) || process.env.NODE_ENV !== "production") {
      allowed.add(`https://${host}`);
      allowed.add(`http://${host}`);
    } else {
      allowed.add(`https://${host}`);
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
      return { ok: true };
    } catch {
      return { ok: false, reason: "Malformed Referer header" };
    }
  }

  if (secFetchSite !== "same-origin") {
    return { ok: false, reason: "Missing Origin/Referer on mutating request" };
  }

  return { ok: true };
}
