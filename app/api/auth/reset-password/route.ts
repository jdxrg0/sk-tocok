import { NextResponse } from "next/server";
import { consumePasswordResetToken, verifyPasswordResetToken } from "@/lib/passwordReset";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/rateLimit";
import { logSecurityEvent } from "@/lib/securityLogger";

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***";
  const prefix = local.length <= 2 ? local[0] : local.slice(0, 2);
  return `${prefix}***@${domain}`;
}

export async function GET(request: Request) {
  try {
    const limit = await checkRateLimit({
      request,
      bucket: "reset_password_check",
      max: 20,
      windowMs: 15 * 60 * 1000,
      persistToDb: true,
    });
    if (!limit.allowed) {
      return rateLimitExceededResponse(limit.retryAfterSeconds);
    }

    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token") || "";
    const info = await verifyPasswordResetToken(token);

    if (!info) {
      return NextResponse.json(
        {
          valid: false,
          error: "This password reset link is invalid, already used, or has expired.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      valid: true,
      name: info.name,
      email: maskEmail(info.email),
      expiresAt: info.expiresAt,
    });
  } catch (err) {
    console.error("[ResetPassword GET] Error:", err);
    return NextResponse.json(
      { valid: false, error: "Unable to validate reset link." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const limit = await checkRateLimit({
      request,
      bucket: "reset_password_consume",
      max: 10,
      windowMs: 15 * 60 * 1000,
      persistToDb: true,
    });
    if (!limit.allowed) {
      return rateLimitExceededResponse(limit.retryAfterSeconds);
    }

    const body = await request.json().catch(() => ({}));
    const token = typeof body?.token === "string" ? body.token : "";
    const password = typeof body?.password === "string" ? body.password : "";

    const result = await consumePasswordResetToken(token, password);

    if (!result.ok) {
      await logSecurityEvent({
        eventType: "PASSWORD_RESET_FAILED",
        severity: "warning",
        request,
        details: { reason: result.error },
      });
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    await logSecurityEvent({
      eventType: "PASSWORD_RESET_COMPLETED",
      severity: "info",
      request,
      userId: result.userId,
      email: result.email,
    });

    return NextResponse.json({
      success: true,
      message: "Password updated successfully. All previous sessions have been signed out.",
    });
  } catch (err) {
    console.error("[ResetPassword POST] Error:", err);
    return NextResponse.json(
      { error: "Failed to reset password." },
      { status: 500 }
    );
  }
}
