export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";
import {
  signToken,
  getAuthCookieOptions,
  ensureUserAppearanceColumns,
  isRequestSecure,
} from "@/lib/auth";
import { attachFreshCsrfCookie } from "@/lib/csrf";
import {
  createAndSendVerificationEmail,
  isEmailVerificationEnforced,
} from "@/lib/emailVerification";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/rateLimit";
import { extractClientIp, logSecurityEvent } from "@/lib/securityLogger";
import {
  isValidEmail,
  sanitizeText,
  validatePasswordStrength,
} from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const limit = await checkRateLimit({
      request,
      bucket: "auth_register",
      max: 8,
      windowMs: 60 * 60 * 1000,
      persistToDb: true,
    });
    if (!limit.allowed) {
      return rateLimitExceededResponse(
        limit.retryAfterSeconds,
        "Too many account registrations from this IP. Please try again later."
      );
    }

    const body = await request.json().catch(() => ({}));
    const trimmedName = sanitizeText(body?.name, 80);
    const trimmedEmail = sanitizeText(body?.email, 254).toLowerCase();
    const password = typeof body?.password === "string" ? body.password : "";

    if (!trimmedName || !trimmedEmail || !password) {
      return NextResponse.json(
        { error: "Name, email, and password are required." },
        { status: 400 }
      );
    }

    if (trimmedName.length < 2) {
      return NextResponse.json(
        { error: "Please enter your full name (at least 2 characters)." },
        { status: 400 }
      );
    }

    if (!isValidEmail(trimmedEmail)) {
      return NextResponse.json(
        { error: "Please provide a valid email address." },
        { status: 400 }
      );
    }

    const pwdError = validatePasswordStrength(password);
    if (pwdError) {
      return NextResponse.json({ error: pwdError }, { status: 400 });
    }

    await ensureUserAppearanceColumns();

    const existing =
      await sql`SELECT id FROM users WHERE LOWER(email) = LOWER(${trimmedEmail}) LIMIT 1`;
    if (existing.length > 0) {
      return NextResponse.json(
        {
          error:
            "An account with this email already exists. Please sign in instead.",
        },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await sql`
      INSERT INTO users (name, email, password_hash, role, auth_provider, email_verified)
      VALUES (${trimmedName}, ${trimmedEmail}, ${passwordHash}, 'Student', 'email', FALSE)
      RETURNING id
    `;
    const userId = Number((result[0] as { id: number }).id);

    const requireVerification = isEmailVerificationEnforced();

    if (requireVerification) {
      const { emailed } = await createAndSendVerificationEmail({
        userId,
        email: trimmedEmail,
        name: trimmedName,
        ipAddress: extractClientIp(request),
        request,
      });

      await logSecurityEvent({
        eventType: "USER_REGISTERED_PENDING_VERIFICATION",
        severity: "info",
        request,
        userId,
        email: trimmedEmail,
        details: { emailed },
      });

      return NextResponse.json(
        {
          success: true,
          requiresVerification: true,
          email: trimmedEmail,
          message: emailed
            ? "Account created! Please check your email inbox for a verification link before signing in."
            : "Account created, but we could not send your verification email right now. Please click Resend Verification Email shortly.",
        },
        { status: 201 }
      );
    }

    // Isolated dev/unconfigured-mailer fallback: signs in with email_verified = false
    // so the user only accesses records owned strictly by their own user_id.
    const token = signToken({
      id: userId,
      name: trimmedName,
      email: trimmedEmail,
      role: "Student",
      token_version: 1,
    });

    await logSecurityEvent({
      eventType: "USER_REGISTERED",
      severity: "info",
      request,
      userId,
      email: trimmedEmail,
      details: { emailVerified: false },
    });

    const response = NextResponse.json({
      success: true,
      requiresVerification: false,
      user: {
        id: userId,
        name: trimmedName,
        email: trimmedEmail,
        role: "Student",
        email_verified: false,
      },
    });

    response.cookies.set({
      ...getAuthCookieOptions(request),
      value: token,
    });
    await attachFreshCsrfCookie(response, isRequestSecure(request));

    return response;
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred during account creation." },
      { status: 500 }
    );
  }
}
