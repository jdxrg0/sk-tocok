export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";
import { signToken, getAuthCookieOptions } from "@/lib/auth";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/rateLimit";
import { logSecurityEvent } from "@/lib/securityLogger";
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

    const passwordHash = bcrypt.hashSync(password, 12);

    const result = await sql`
      INSERT INTO users (name, email, password_hash, role, auth_provider)
      VALUES (${trimmedName}, ${trimmedEmail}, ${passwordHash}, 'Student', 'email')
      RETURNING id
    `;
    const userId = Number((result[0] as { id: number }).id);

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
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: userId,
        name: trimmedName,
        email: trimmedEmail,
        role: "Student",
      },
    });

    response.cookies.set({
      ...getAuthCookieOptions(request),
      value: token,
    });

    return response;
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred during account creation." },
      { status: 500 }
    );
  }
}
