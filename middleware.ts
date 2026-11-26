import { NextResponse, type NextRequest } from "next/server";
import { verifyHs256JwtEdge, verifyHmacToken } from "@/lib/edgeCrypto";
import {
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  createCsrfToken,
  isAllowedCrossOrigin,
  verifyRequestOrigin,
} from "@/lib/csrf";
import { OFFICIAL_ROLES } from "@/lib/validation";

const AUTH_COOKIE_NAME = "sk_tocok_admin_token";
const JWT_ISSUER = "sk-tocok-portal";
const JWT_AUDIENCE = "sk-tocok-portal";
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const OFFICIAL_ROLE_SET = new Set(OFFICIAL_ROLES.map((r) => r.toLowerCase()));

function isSecureRequest(request: NextRequest): boolean {
  if (process.env.COOKIE_SECURE === "true") return true;
  if (process.env.COOKIE_SECURE === "false") return false;
  if (process.env.VERCEL === "1") return true;
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (proto) return proto.toLowerCase() === "https";
  return request.nextUrl.protocol === "https:";
}

function applySecurityHeaders(response: NextResponse, isSecure: boolean): NextResponse {
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-DNS-Prefetch-Control", "off");
  response.headers.set("X-Permitted-Cross-Domain-Policies", "none");
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
  );
  if (process.env.NODE_ENV === "production" || isSecure) {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload"
    );
  }
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isHttps = isSecureRequest(request);
  const rawHostHeader = request.headers.get("host")?.trim() || request.nextUrl.host;
  const rawForwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() || "";
  const isSafeHostToken = (h: string) => /^[a-zA-Z0-9.-]+(?::\d{1,5})?$/.test(h);

  // Only honor x-forwarded-host when it matches our own deployment/configured hosts (prevents host-header open redirects)
  const trustedRedirectHosts = new Set<string>([rawHostHeader.toLowerCase()]);
  for (const envHost of [process.env.VERCEL_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL]) {
    if (envHost) trustedRedirectHosts.add(envHost.trim().toLowerCase());
  }
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    try {
      trustedRedirectHosts.add(new URL(process.env.NEXT_PUBLIC_SITE_URL).host.toLowerCase());
    } catch {
      // ignore invalid site URL
    }
  }

  const host =
    rawForwardedHost && isSafeHostToken(rawForwardedHost) && trustedRedirectHosts.has(rawForwardedHost.toLowerCase())
      ? rawForwardedHost
      : isSafeHostToken(rawHostHeader)
      ? rawHostHeader
      : request.nextUrl.host;

  const isLocalHost =
    host.startsWith("localhost") ||
    host.startsWith("127.0.0.1") ||
    host.startsWith("[::1]");

  // 1. Enforce HTTPS in production (when behind reverse proxy terminating TLS)
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  if (
    (process.env.NODE_ENV === "production" || process.env.VERCEL === "1") &&
    !isLocalHost &&
    forwardedProto === "http"
  ) {
    const httpsUrl = new URL(`https://${host}${pathname}${search}`);
    return NextResponse.redirect(httpsUrl, 308);
  }

  const isApiRoute = pathname.startsWith("/api/");
  const origin = request.headers.get("origin");

  // 2. Strict CORS checks on API routes
  if (isApiRoute && origin) {
    if (!isAllowedCrossOrigin(origin, request)) {
      const blocked = NextResponse.json(
        { error: "Cross-origin request blocked by CORS policy." },
        { status: 403 }
      );
      return applySecurityHeaders(blocked, isHttps);
    }

    if (request.method === "OPTIONS") {
      const preflight = new NextResponse(null, { status: 204 });
      preflight.headers.set("Access-Control-Allow-Origin", origin);
      preflight.headers.set("Vary", "Origin");
      preflight.headers.set("Access-Control-Allow-Credentials", "true");
      preflight.headers.set(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, PATCH, DELETE, OPTIONS"
      );
      preflight.headers.set(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization, X-CSRF-Token"
      );
      preflight.headers.set("Access-Control-Max-Age", "600");
      return applySecurityHeaders(preflight, isHttps);
    }
  }

  const secret = process.env.JWT_SECRET?.trim() || "";

  // 3. CSRF protection for state-changing API routes
  if (isApiRoute && MUTATING_METHODS.has(request.method)) {
    const isCronBearer =
      pathname.startsWith("/api/cron/") &&
      Boolean(request.headers.get("authorization")?.startsWith("Bearer "));

    if (!isCronBearer) {
      const originCheck = verifyRequestOrigin(request);
      if (!originCheck.ok) {
        const forbidden = NextResponse.json(
          { error: "Cross-site state-changing request rejected (CSRF origin check)." },
          { status: 403 }
        );
        return applySecurityHeaders(forbidden, isHttps);
      }

      const hasSessionCookie = Boolean(request.cookies.get(AUTH_COOKIE_NAME)?.value);
      if (hasSessionCookie && secret.length >= 32) {
        const csrfCookie = request.cookies.get(CSRF_COOKIE_NAME)?.value;
        const csrfHeader = request.headers.get(CSRF_HEADER_NAME);
        if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
          const forbidden = NextResponse.json(
            { error: "Missing or invalid CSRF token." },
            { status: 403 }
          );
          return applySecurityHeaders(forbidden, isHttps);
        }
        const validSig = await verifyHmacToken(csrfCookie, secret);
        if (!validSig) {
          const forbidden = NextResponse.json(
            { error: "Invalid CSRF token signature." },
            { status: 403 }
          );
          return applySecurityHeaders(forbidden, isHttps);
        }
      }
    }
  }

  // 4. Edge Admin Route Guard (/admin and /api/admin/* except public settings GET)
  const isAdminPage = pathname === "/admin" || pathname.startsWith("/admin/");
  const isPublicSettingsGet = pathname === "/api/admin/settings" && request.method === "GET";
  const isAdminApi = pathname.startsWith("/api/admin/") && !isPublicSettingsGet;

  if (isAdminPage || isAdminApi) {
    const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
    const payload =
      token && secret.length >= 32
        ? await verifyHs256JwtEdge(token, secret, {
            issuer: JWT_ISSUER,
            audience: JWT_AUDIENCE,
          })
        : null;

    const role = typeof payload?.role === "string" ? payload.role.trim().toLowerCase() : "";
    const isOfficial = Boolean(payload && OFFICIAL_ROLE_SET.has(role));

    if (!payload) {
      if (isAdminApi) {
        const unauth = NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
        return applySecurityHeaders(unauth, isHttps);
      }
      return NextResponse.redirect(new URL("/", request.url));
    }

    if (!isOfficial) {
      if (isAdminApi) {
        const forbidden = NextResponse.json(
          { error: "Forbidden: SK Officials only" },
          { status: 403 }
        );
        return applySecurityHeaders(forbidden, isHttps);
      }
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  const response = NextResponse.next();

  // Set strict CORS reflection ONLY for validated trusted origins
  if (isApiRoute && origin && isAllowedCrossOrigin(origin, request)) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Vary", "Origin");
    response.headers.set("Access-Control-Allow-Credentials", "true");
  }

  // Ensure double-submit CSRF cookie is issued on page / GET requests
  if (secret.length >= 32) {
    const existingCsrf = request.cookies.get(CSRF_COOKIE_NAME)?.value;
    const csrfValid = existingCsrf ? await verifyHmacToken(existingCsrf, secret) : null;
    if (!csrfValid) {
      const freshCsrf = await createCsrfToken(secret);
      response.cookies.set(CSRF_COOKIE_NAME, freshCsrf, {
        path: "/",
        httpOnly: false, // Readable by same-origin client scripts for x-csrf-token header
        sameSite: "strict",
        secure: isHttps,
        maxAge: 60 * 60 * 24 * 7,
      });
    }
  }

  return applySecurityHeaders(response, isHttps);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|ico|svg)$).*)",
  ],
};
