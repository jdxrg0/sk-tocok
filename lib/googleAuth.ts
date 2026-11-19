import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import {
  signToken,
  COOKIE_NAME,
  ensureUserAppearanceColumns,
  isOfficialUser,
  getAuthCookieOptions,
} from "@/lib/auth";

export interface VerifiedGoogleProfile {
  email: string;
  name: string;
  avatarUrl: string;
  googleId: string;
}

export interface AuthenticatedStudentUser {
  id: number;
  name: string;
  email: string;
  role: string;
  avatar_url?: string | null;
  theme_preference?: string | null;
  accent_preference?: string | null;
}

export const GOOGLE_OAUTH_STATE_COOKIE = "sk_tocok_google_oauth_state";

let googleColumnsPromise: Promise<void> | null = null;

async function ensureGoogleUserColumns(): Promise<void> {
  await ensureUserAppearanceColumns();
  if (!googleColumnsPromise) {
    googleColumnsPromise = (async () => {
      try {
        await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider TEXT DEFAULT 'email'`;
        await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT`;
        await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT`;
      } catch (err) {
        googleColumnsPromise = null;
        console.error("Failed to ensure Google auth user columns:", err);
      }
    })();
  }
  return googleColumnsPromise;
}

export function getGoogleOAuthConfig() {
  const clientId = (
    process.env.GOOGLE_CLIENT_ID ||
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
    ""
  ).trim();
  const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || "").trim();

  const mode: "redirect" | "gis" | "unconfigured" =
    clientId && clientSecret ? "redirect" : clientId ? "gis" : "unconfigured";

  return {
    clientId: clientId || null,
    clientSecret: clientSecret || null,
    configured: Boolean(clientId),
    mode,
  };
}

export function getRequestOrigin(request: Request): string {
  const forwardedHost = request.headers
    .get("x-forwarded-host")
    ?.split(",")[0]
    ?.trim();
  const forwardedProto = request.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim();

  if (forwardedHost) {
    const isLocal =
      forwardedHost.startsWith("localhost") ||
      forwardedHost.startsWith("127.0.0.1");
    const proto = forwardedProto || (isLocal ? "http" : "https");
    return `${proto}://${forwardedHost}`;
  }

  return new URL(request.url).origin;
}

export function getGoogleRedirectUri(request: Request): string {
  const explicit = process.env.GOOGLE_REDIRECT_URI?.trim();
  if (explicit) return explicit;
  return `${getRequestOrigin(request)}/api/auth/google/callback`;
}

export function sanitizeReturnTo(value: string | null | undefined): string {
  if (!value) return "/printing";
  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.startsWith("/\\")) {
    return "/printing";
  }
  return trimmed;
}

export async function verifyGoogleIdToken(
  idToken: string,
  expectedClientId: string
): Promise<VerifiedGoogleProfile> {
  const googleRes = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
    { cache: "no-store" }
  );

  if (!googleRes.ok) {
    throw new Error("Failed to verify Google sign-in token.");
  }

  const payload = await googleRes.json();

  if (expectedClientId && payload.aud !== expectedClientId) {
    throw new Error("Invalid Google authentication audience.");
  }

  const emailVerified =
    payload.email_verified === true || payload.email_verified === "true";
  if (!emailVerified || !payload.email) {
    throw new Error("Your Google account email is not verified.");
  }

  const email = String(payload.email).trim().toLowerCase();
  const name =
    String(payload.name || payload.given_name || "").trim() ||
    email.split("@")[0];

  return {
    email,
    name,
    avatarUrl: typeof payload.picture === "string" ? payload.picture : "",
    googleId: typeof payload.sub === "string" ? payload.sub : "",
  };
}

export async function verifyGoogleAccessToken(
  accessToken: string,
  expectedClientId: string
): Promise<VerifiedGoogleProfile> {
  const tokenInfoRes = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`,
    { cache: "no-store" }
  );

  if (!tokenInfoRes.ok) {
    throw new Error("Failed to verify Google access token.");
  }

  const tokenInfo = await tokenInfoRes.json();
  const tokenAud = tokenInfo.aud || tokenInfo.azp;
  if (expectedClientId && tokenAud && tokenAud !== expectedClientId) {
    throw new Error("Invalid Google authentication audience.");
  }

  const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!userInfoRes.ok) {
    throw new Error("Unable to retrieve your Google account profile.");
  }

  const profile = await userInfoRes.json();
  const emailVerified =
    profile.email_verified === true || profile.email_verified === "true";
  if (!emailVerified || !profile.email) {
    throw new Error("Your Google account email is not verified.");
  }

  const email = String(profile.email).trim().toLowerCase();
  const name =
    String(profile.name || profile.given_name || "").trim() ||
    email.split("@")[0];

  return {
    email,
    name,
    avatarUrl: typeof profile.picture === "string" ? profile.picture : "",
    googleId: typeof profile.sub === "string" ? profile.sub : "",
  };
}

export async function upsertGoogleStudentUser(
  profile: VerifiedGoogleProfile
): Promise<{ user: AuthenticatedStudentUser; token: string }> {
  await ensureGoogleUserColumns();

  const existing = await sql`
    SELECT id, name, email, role, avatar_url, auth_provider, password_hash, theme_preference, accent_preference
    FROM users WHERE LOWER(email) = LOWER(${profile.email})
  `;

  let user: AuthenticatedStudentUser;

  if (existing.length > 0) {
    const found = existing[0] as AuthenticatedStudentUser & {
      auth_provider?: string | null;
      password_hash?: string | null;
    };

    // Never allow Google sign-in to hijack SK Official accounts
    if (isOfficialUser(found)) {
      const err = new Error(
        "This email belongs to an SK Official account. Please sign in with email and password."
      ) as Error & { status?: number };
      err.status = 403;
      throw err;
    }

    const updated = await sql`
      UPDATE users
      SET avatar_url    = COALESCE(${profile.avatarUrl || null}, avatar_url),
          google_id     = COALESCE(${profile.googleId || null}, google_id),
          auth_provider = COALESCE(auth_provider, 'google')
      WHERE id = ${found.id}
      RETURNING id, name, email, role, avatar_url, theme_preference, accent_preference
    `;
    user = (updated[0] as AuthenticatedStudentUser) || found;
  } else {
    const inserted = await sql`
      INSERT INTO users (name, email, password_hash, role, auth_provider, avatar_url, google_id)
      VALUES (${profile.name}, ${profile.email}, '', 'Student', 'google', ${profile.avatarUrl || null}, ${profile.googleId || null})
      RETURNING id, name, email, role, avatar_url, theme_preference, accent_preference
    `;
    user = inserted[0] as AuthenticatedStudentUser;
  }

  const token = signToken({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatar_url: user.avatar_url ?? undefined,
  });

  return { user, token };
}

export function attachAuthCookie(response: NextResponse, token: string, request?: Request): void {
  response.cookies.set({
    ...getAuthCookieOptions(request),
    value: token,
  });
}
