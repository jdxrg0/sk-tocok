export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { cleanupExpiredBlobs } from "@/lib/blobCleanup";
import { getCurrentUser, isOfficialUser } from "@/lib/auth";

export async function GET(request: Request) {
  // Allow Vercel Cron invocation or authenticated SK Official
  const authHeader = request.headers.get("authorization");
  const isVercelCron = process.env.CRON_SECRET
    ? authHeader === `Bearer ${process.env.CRON_SECRET}`
    : request.headers.get("user-agent")?.includes("vercel-cron");

  const currentUser = await getCurrentUser();
  const isAdmin = isOfficialUser(currentUser);

  if (!isVercelCron && !isAdmin) {
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

export async function POST() {
  // Allow manual trigger from SK Officials Admin Portal
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized access." }, { status: 401 });
  }
  if (!isOfficialUser(currentUser)) {
    return NextResponse.json({ error: "Forbidden: SK Officials only." }, { status: 403 });
  }

  try {
    const result = await cleanupExpiredBlobs(90);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Manual blob cleanup error:", error);
    return NextResponse.json({ error: "Failed to execute cleanup." }, { status: 500 });
  }
}
