import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureUserAppearanceColumns } from "@/lib/auth";
import {
  createAndSendVerificationEmail,
  isEmailVerificationEnforced,
} from "@/lib/emailVerification";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/rateLimit";
import { extractClientIp, logSecurityEvent } from "@/lib/securityLogger";
import { isValidEmail, sanitizeText } from "@/lib/validation";

export const dynamic = "force-dynamic";

const GENERIC_RESEND_MESSAGE =
  "If an unverified account exists for that email, a fresh verification link has been sent.";

export async function POST(request: Request) {
  try {
    const ipLimit = await checkRateLimit({
      request,
      bucket: "resend_verify_ip",
      max: 6,
      windowMs: 15 * 60 * 1000,
      persistToDb: true,
    });
    if (!ipLimit.allowed) {
      return rateLimitExceededResponse(
        ipLimit.retryAfterSeconds,
        "Too many verification email requests. Please try again later."
      );
    }

    const body = await request.json().catch(() => ({}));
    const email = sanitizeText(body?.email, 254).toLowerCase();

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    const emailLimit = await checkRateLimit({
      request,
      bucket: "resend_verify_email",
      identifier: email,
      max: 3,
      windowMs: 15 * 60 * 1000,
      persistToDb: true,
    });
    if (!emailLimit.allowed) {
      return rateLimitExceededResponse(
        emailLimit.retryAfterSeconds,
        "Please wait a few minutes before requesting another verification email."
      );
    }

    if (!isEmailVerificationEnforced()) {
      return NextResponse.json({
        success: true,
        message: "Email verification delivery is not currently required on this environment.",
      });
    }

    await ensureUserAppearanceColumns();

    const rows = await sql`
      SELECT id, name, email, COALESCE(email_verified, FALSE) AS email_verified
      FROM users
      WHERE LOWER(email) = ${email}
      LIMIT 1
    `;

    if (rows.length > 0) {
      const target = rows[0] as {
        id: number;
        name: string;
        email: string;
        email_verified: boolean;
      };
      if (!target.email_verified) {
        const { emailed } = await createAndSendVerificationEmail({
          userId: Number(target.id),
          email: target.email,
          name: target.name,
          ipAddress: extractClientIp(request),
          request,
        });

        await logSecurityEvent({
          eventType: "EMAIL_VERIFICATION_RESENT",
          severity: "info",
          request,
          userId: Number(target.id),
          email: target.email,
          details: { emailed },
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: GENERIC_RESEND_MESSAGE,
    });
  } catch (error) {
    console.error("[ResendVerification POST] Error:", error);
    return NextResponse.json(
      { error: "Unable to resend verification email right now." },
      { status: 500 }
    );
  }
}
