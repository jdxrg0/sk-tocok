export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { cleanupExpiredBlobs } from "@/lib/blobCleanup";
import { getCurrentUser, isSuperAdminUser } from "@/lib/auth";
import { getCronSecret } from "@/lib/env";
import { constantTimeEqual } from "@/lib/edgeCrypto";
import { logSecurityEvent } from "@/lib/securityLogger";

export async function GET(request: Request) {
  // Allow verified Cron bearer secret or authenticated SK Official
  const authHeader = request.headers.get("authorization") || "";
  const cronSecret = getCronSecret();
  const isVercelCron =
    Boolean(cronSecret) &&
    constantTimeEqual(authHeader, `Bearer ${cronSecret}`);

  const currentUser = await getCurrentUser(request);
  const isAdmin = isSuperAdminUser(currentUser);

  if (!isVercelCron && !isAdmin) {
    await logSecurityEvent({
      eventType: "UNAUTHORIZED_CRON_ACCESS",
      severity: "high",
      request,
      userId: currentUser?.id ?? null,
    });
    return NextResponse.json({ error: "Unauthorized access." }, { status: 401 });
  }

  try {
    const result = await cleanupExpiredBlobs(90);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Cron blob cleanup error:", error);
    return NextResponse.json({ error: "Failed to execute cleanup." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  // Allow manual trigger from SK Officials Admin Portal
  const currentUser = await getCurrentUser(request);
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized access." }, { status: 401 });
  }
  if (!isSuperAdminUser(currentUser)) {
    return NextResponse.json({ error: "Forbidden: SK Chairperson privileges required." }, { status: 403 });
  }

  try {
    const result = await cleanupExpiredBlobs(90);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Manual blob cleanup error:", error);
    return NextResponse.json({ error: "Failed to execute cleanup." }, { status: 500 });
  }
}
