import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { createPasswordResetToken, RESET_TOKEN_TTL_MINUTES } from "@/lib/passwordReset";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/rateLimit";
import { extractClientIp, logSecurityEvent } from "@/lib/securityLogger";
import { isValidEmail, sanitizeText } from "@/lib/validation";

const GENERIC_RESPONSE_MESSAGE =
  "If an account with that email exists, a password reset link (valid for 15 minutes) has been processed. Contact your SK Chairperson or Administrator if no email delivery provider is configured.";

async function sendResetEmailIfConfigured(params: {
  to: string;
  name: string;
  resetUrl: string;
}): Promise<boolean> {
  const resendKey = process.env.RESEND_API_KEY?.trim();
  if (!resendKey) return false;

  const fromEmail = process.env.EMAIL_FROM?.trim() || "SK Tocok Portal <onboarding@resend.dev>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [params.to],
      subject: "SK Tocok Portal - Password Reset (Expires in 15 minutes)",
      text: [
        `Hello ${params.name},`,
        "",
        "A password reset was requested for your SK Barangay Tocok Transparency Portal account.",
        `Open this link within ${RESET_TOKEN_TTL_MINUTES} minutes to set a new password:`,
        params.resetUrl,
        "",
        "This link can only be used once. If you did not request this, you can safely ignore this message.",
      ].join("\n"),
    }),
  });

  return res.ok;
}

export async function POST(request: Request) {
  try {
    const ipLimit = await checkRateLimit({
      request,
      bucket: "forgot_password_ip",
      max: 5,
      windowMs: 15 * 60 * 1000,
      persistToDb: true,
    });
    if (!ipLimit.allowed) {
      return rateLimitExceededResponse(
        ipLimit.retryAfterSeconds,
        "Too many password reset requests. Please try again later."
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
      bucket: "forgot_password_email",
      identifier: email,
      max: 3,
      windowMs: 15 * 60 * 1000,
      persistToDb: true,
    });
    if (!emailLimit.allowed) {
      return rateLimitExceededResponse(
        emailLimit.retryAfterSeconds,
        "Too many reset attempts for this email. Please try again in 15 minutes."
      );
    }

    const rows = await sql`
      SELECT id, name, email, role, auth_provider
      FROM users
      WHERE LOWER(email) = ${email}
      LIMIT 1
    `;

    if (rows.length > 0) {
      const user = rows[0] as {
        id: number;
        name: string;
        email: string;
        role: string;
        auth_provider: string | null;
      };

      const ip = extractClientIp(request);
      const { rawToken, expiresAt } = await createPasswordResetToken(
        Number(user.id),
        ip,
        RESET_TOKEN_TTL_MINUTES
      );

      let origin = "http://localhost:3000";
      try {
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
        origin = siteUrl ? new URL(siteUrl).origin : new URL(request.url).origin;
      } catch {
        // Fallback to localhost
      }
      const resetUrl = `${origin}/reset-password?token=${encodeURIComponent(rawToken)}`;

      const emailed = await sendResetEmailIfConfigured({
        to: user.email,
        name: user.name,
        resetUrl,
      }).catch(() => false);

      await logSecurityEvent({
        eventType: "PASSWORD_RESET_REQUESTED",
        severity: "info",
        request,
        userId: Number(user.id),
        email: user.email,
        details: { emailed, expiresAt },
      });
    } else {
      await logSecurityEvent({
        eventType: "PASSWORD_RESET_UNKNOWN_EMAIL",
        severity: "info",
        request,
        email,
      });
    }

    return NextResponse.json({
      success: true,
      message: GENERIC_RESPONSE_MESSAGE,
      expiresInMinutes: RESET_TOKEN_TTL_MINUTES,
    });
  } catch (err) {
    console.error("[ForgotPassword] Error:", err);
    return NextResponse.json(
      { error: "Unable to process password reset request." },
      { status: 500 }
    );
  }
}
