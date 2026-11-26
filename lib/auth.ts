import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { sql } from "./db";
import { getJwtSecret } from "./env";
import { OFFICIAL_ROLES } from "./validation";

export const JWT_ISSUER = "sk-tocok-portal";
export const JWT_AUDIENCE = "sk-tocok-portal";
const COOKIE_NAME = "sk_tocok_admin_token";

const OFFICIAL_ROLE_SET = new Set(OFFICIAL_ROLES.map((r) => r.toLowerCase()));

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: string;
  contact_number?: string;
  avatar_url?: string;
  auth_provider?: string;
  theme_preference?: string | null;
  accent_preference?: string | null;
  token_version?: number;
  must_change_password?: boolean;
}

export type AuthUser = AdminUser;

export function isOfficialUser(
  user: Pick<AdminUser, "role"> | null | undefined
): boolean {
  if (!user || typeof user.role !== "string") return false;
  const normalizedRole = user.role.trim().toLowerCase();
  if (!normalizedRole || normalizedRole === "student" || normalizedRole === "guest") {
    return false;
  }
  return OFFICIAL_ROLE_SET.has(normalizedRole);
}

export async function getCurrentOfficial(request?: Request): Promise<AdminUser | null> {
  const user = await getCurrentUser(request);
  return isOfficialUser(user) ? user : null;
}

let appearanceColumnsPromise: Promise<void> | null = null;

export function ensureUserAppearanceColumns(): Promise<void> {
  if (!appearanceColumnsPromise) {
    appearanceColumnsPromise = (async () => {
      try {
        await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS theme_preference TEXT`;
        await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS accent_preference TEXT`;
        await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 1`;
        await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE`;
      } catch (err) {
        appearanceColumnsPromise = null;
        console.error("Failed to ensure user security/appearance columns:", err);
      }
    })();
  }
  return appearanceColumnsPromise;
}

export function signToken(user: AdminUser): string {
  const secret = getJwtSecret();
  return jwt.sign(
    {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      token_version: Number(user.token_version ?? 1),
    },
    secret,
    {
      algorithm: "HS256",
      expiresIn: "7d",
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    }
  );
}

export function verifyToken(token: string): AdminUser | null {
  try {
    const secret = getJwtSecret();
    const decoded = jwt.verify(token, secret, {
      algorithms: ["HS256"],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    }) as AdminUser;
    if (!decoded || typeof decoded.id !== "number") {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

export function isRequestSecure(request?: Request): boolean {
  if (process.env.COOKIE_SECURE === "true") return true;
  if (process.env.COOKIE_SECURE === "false") return false;
  if (process.env.VERCEL === "1") return true;

  if (request) {
    const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    if (proto) {
      return proto.toLowerCase() === "https";
    }
    try {
      const parsed = new URL(request.url);
      if (parsed.protocol === "https:") return true;
      const host = parsed.hostname.toLowerCase();
      if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
        return false;
      }
    } catch {
      // fall through
    }
  }

  return process.env.NODE_ENV === "production";
}

export function getAuthCookieOptions(request?: Request) {
  return {
    name: COOKIE_NAME,
    httpOnly: true,
    secure: isRequestSecure(request),
    path: "/",
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 24 * 7,
  };
}

export async function getCurrentUser(request?: Request): Promise<AdminUser | null> {
  let token: string | undefined;

  if (request) {
    const cookieHeader = request.headers.get("cookie") || "";
    const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
    if (match) {
      try {
        token = decodeURIComponent(match[1]);
      } catch {
        return null;
      }
    }
  }

  if (!token) {
    try {
      const cookieStore = await cookies();
      token = cookieStore.get(COOKIE_NAME)?.value;
    } catch {
      // In case cookies() cannot be called in some context
    }
  }

  if (!token) return null;

  const decoded = verifyToken(token);
  if (!decoded) return null;

  await ensureUserAppearanceColumns();

  // Confirm user still exists in DB and token_version has not been revoked
  const rows = await sql`
    SELECT id, name, email, role, contact_number, avatar_url, auth_provider,
           theme_preference, accent_preference, token_version, must_change_password
    FROM users WHERE id = ${decoded.id}
  `;
  const dbUser = rows[0] as AdminUser | undefined;
  if (!dbUser) return null;

  const dbVersion = Number(dbUser.token_version ?? 1);
  const tokenVersion = Number(decoded.token_version ?? 1);
  if (dbVersion !== tokenVersion) {
    return null;
  }

  return dbUser;
}

export { COOKIE_NAME };
