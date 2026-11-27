import { NextResponse } from "next/server";
import { getCurrentUser, isSuperAdminUser } from "@/lib/auth";
import { getGoogleDriveStatus } from "@/lib/googleDrive";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }
    if (!isSuperAdminUser(user)) {
      return NextResponse.json({ error: "Forbidden: SK Chairperson privileges required" }, { status: 403 });
    }

    const data = await getGoogleDriveStatus();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Google Drive status route error:", error);
    return NextResponse.json(
      {
        success: false,
        configured: Boolean(
          process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ||
            process.env.GOOGLE_APPLICATION_CREDENTIALS ||
            process.env.GOOGLE_APPS_SCRIPT_URL
        ),
        status: "offline",
        statusLevel: "critical",
        error: "Unable to reach Google Drive storage right now.",
        checkedAt: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
