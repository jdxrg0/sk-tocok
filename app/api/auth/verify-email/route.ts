import { NextResponse } from "next/server";
import { consumeEmailVerificationToken } from "@/lib/emailVerification";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/rateLimit";
import { logSecurityEvent } from "@/lib/securityLogger";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const limit = await checkRateLimit({
      request,
      bucket: "email_verify_consume",
      max: 15,
      windowMs: 15 * 60 * 1000,
      persistToDb: true,
    });
    if (!limit.allowed) {
      return rateLimitExceededResponse(limit.retryAfterSeconds);
    }

    const body = await request.json().catch(() => ({}));
    const token = typeof body?.token === "string" ? body.token : "";

    const result = await consumeEmailVerificationToken(token);
    if (!result.ok) {
      await logSecurityEvent({
        eventType: "EMAIL_VERIFICATION_FAILED",
        severity: "warning",
        request,
        details: { reason: result.error },
      });
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    await logSecurityEvent({
      eventType: "EMAIL_VERIFIED",
      severity: "info",
      request,
      userId: result.userId,
      email: result.email,
    });

    return NextResponse.json({
      success: true,
      email: result.email,
      name: result.name,
      message: "Email verified successfully! You can now sign in with your email and password.",
    });
  } catch (error) {
    console.error("[VerifyEmail POST] Error:", error);
    return NextResponse.json(
      { error: "Failed to verify email address." },
      { status: 500 }
    );
  }
}
