import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { sql } from "./db";

const JWT_SECRET = process.env.JWT_SECRET || "sk-tocok-transparency-secret-key-2026";
const COOKIE_NAME = "sk_tocok_admin_token";

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
}

export type AuthUser = AdminUser;

export function isOfficialUser(
  user: Pick<AdminUser, "role"> | null | undefined
): boolean {
  if (!user || typeof user.role !== "string") return false;
  const normalizedRole = user.role.trim().toLowerCase();
  return (
    normalizedRole !== "" &&
    normalizedRole !== "student" &&
    normalizedRole !== "guest"
  );
}

export async function getCurrentOfficial(): Promise<AdminUser | null> {
  const user = await getCurrentUser();
  return isOfficialUser(user) ? user : null;
}

let appearanceColumnsPromise: Promise<void> | null = null;

export function ensureUserAppearanceColumns(): Promise<void> {
  if (!appearanceColumnsPromise) {
    appearanceColumnsPromise = (async () => {
      try {
        await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS theme_preference TEXT`;
        await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS accent_preference TEXT`;
      } catch (err) {
        appearanceColumnsPromise = null;
        console.error("Failed to ensure user appearance columns:", err);
      }
    })();
  }
  return appearanceColumnsPromise;
}

export function signToken(user: AdminUser): string {
  return jwt.sign(
    {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

export function verifyToken(token: string): AdminUser | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AdminUser;
    return decoded;
  } catch {
    return null;
  }
}

export function isRequestSecure(request?: Request): boolean {
  if (process.env.COOKIE_SECURE === "true") return true;
  if (process.env.COOKIE_SECURE === "false") return false;
  if (process.env.VERCEL === "1") return true;
  if (!request) {
    return false;
  }
  const proto = request.headers.get("x-forwarded-proto");
  if (proto) {
    return proto.toLowerCase() === "https";
  }
  try {
    return new URL(request.url).protocol === "https:";
  } catch {
    return false;
  }
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
      token = decodeURIComponent(match[1]);
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

  // Confirm user still exists in DB
  const rows = await sql`
    SELECT id, name, email, role, contact_number, avatar_url, auth_provider, theme_preference, accent_preference
    FROM users WHERE id = ${decoded.id}
  `;
  return (rows[0] as AdminUser) || null;
}

export { COOKIE_NAME };
