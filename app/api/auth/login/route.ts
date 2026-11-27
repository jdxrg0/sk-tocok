export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";
import {
  signToken,
  getAuthCookieOptions,
  ensureUserAppearanceColumns,
  isOfficialUser,
  isRequestSecure,
} from "@/lib/auth";
import { attachFreshCsrfCookie } from "@/lib/csrf";
import { isEmailVerificationEnforced } from "@/lib/emailVerification";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/rateLimit";
import { logSecurityEvent } from "@/lib/securityLogger";
import { isValidEmail, sanitizeText } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const ipLimit = await checkRateLimit({
      request,
      bucket: "auth_login_ip",
      max: 25,
      windowMs: 15 * 60 * 1000,
      persistToDb: true,
    });
    if (!ipLimit.allowed) {
      return rateLimitExceededResponse(
        ipLimit.retryAfterSeconds,
        "Too many login attempts. Please try again later."
      );
    }

    const body = await request.json().catch(() => ({}));
    const rawEmail = sanitizeText(body?.email, 254).toLowerCase();
    const password = typeof body?.password === "string" ? body.password : "";

    if (!rawEmail || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    if (!isValidEmail(rawEmail)) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    const accountLimit = await checkRateLimit({
      request,
      bucket: "auth_login_acct",
      identifier: rawEmail,
      max: 10,
      windowMs: 15 * 60 * 1000,
      persistToDb: true,
    });
    if (!accountLimit.allowed) {
      return rateLimitExceededResponse(
        accountLimit.retryAfterSeconds,
        "Too many login attempts for this account. Please wait 15 minutes or reset your password."
      );
    }

    await ensureUserAppearanceColumns();

    const rows = await sql`
      SELECT id, name, email, password_hash, role, contact_number, avatar_url,
             auth_provider, theme_preference, accent_preference,
             COALESCE(token_version, 1) AS token_version,
             COALESCE(must_change_password, FALSE) AS must_change_password,
             COALESCE(email_verified, FALSE) AS email_verified
      FROM users
      WHERE LOWER(email) = LOWER(${rawEmail})
      LIMIT 1
    `;

    const user = rows[0] as
      | {
          id: number;
          name: string;
          email: string;
          password_hash: string;
          role: string;
          contact_number?: string;
          avatar_url?: string | null;
          auth_provider?: string;
          theme_preference?: string | null;
          accent_preference?: string | null;
          token_version?: number;
          must_change_password?: boolean;
          email_verified?: boolean;
        }
      | undefined;

    if (!user) {
      await logSecurityEvent({
        eventType: "LOGIN_FAILED",
        severity: "warning",
        request,
        email: rawEmail,
        details: { reason: "unknown_account" },
      });
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    if (!user.password_hash || !(await bcrypt.compare(password, user.password_hash))) {
      await logSecurityEvent({
        eventType: "LOGIN_FAILED",
        severity: "warning",
        request,
        userId: user.id,
        email: user.email,
        details: {
          reason: !user.password_hash && user.auth_provider === "google" ? "google_oauth_account" : "invalid_password",
        },
      });
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    if (
      !isOfficialUser(user) &&
      !user.email_verified &&
      isEmailVerificationEnforced()
    ) {
      await logSecurityEvent({
        eventType: "LOGIN_BLOCKED_UNVERIFIED_EMAIL",
        severity: "info",
        request,
        userId: user.id,
        email: user.email,
      });
      return NextResponse.json(
        {
          error:
            "Please verify your email address before signing in. Check your inbox or request a fresh verification link.",
          requiresVerification: true,
          email: user.email,
        },
        { status: 403 }
      );
    }

    if (user.must_change_password) {
      await logSecurityEvent({
        eventType: "LOGIN_BLOCKED_PASSWORD_ROTATION",
        severity: "warning",
        request,
        userId: user.id,
        email: user.email,
      });
      return NextResponse.json(
        {
          error:
            "Your account password was rotated for security and must be reset before signing in. Please use 'Forgot Password' or contact your SK Administrator.",
          mustChangePassword: true,
        },
        { status: 403 }
      );
    }

    const tokenVersion = Number(user.token_version ?? 1);
    const token = signToken({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      contact_number: user.contact_number,
      token_version: tokenVersion,
    });

    await logSecurityEvent({
      eventType: isOfficialUser(user) ? "OFFICIAL_LOGIN" : "USER_LOGIN",
      severity: "info",
      request,
      userId: user.id,
      email: user.email,
      details: { role: user.role },
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        contact_number: user.contact_number,
        avatar_url: user.avatar_url,
        theme_preference: user.theme_preference ?? null,
        accent_preference: user.accent_preference ?? null,
        email_verified: Boolean(user.email_verified),
      },
    });

    response.cookies.set({
      ...getAuthCookieOptions(request),
      value: token,
    });
    await attachFreshCsrfCookie(response, isRequestSecure(request));

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred during login" },
      { status: 500 }
    );
  }
}
