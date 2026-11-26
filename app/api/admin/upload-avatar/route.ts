import { NextResponse } from "next/server";
import { getCurrentUser, isOfficialUser } from "@/lib/auth";
import { uploadToCloudStorage } from "@/lib/googleDrive";
import { validateUploadedFile } from "@/lib/fileValidation";
import { logSecurityEvent } from "@/lib/securityLogger";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }
    if (!isOfficialUser(currentUser)) {
      return NextResponse.json({ error: "Forbidden: SK Officials only" }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    const validation = await validateUploadedFile(file, "avatar");
    if (!validation.ok) {
      await logSecurityEvent({
        eventType: "UPLOAD_REJECTED",
        severity: "warning",
        request,
        userId: currentUser.id,
        details: { category: "avatar", reason: validation.reason },
      });
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Save to Google Drive first (15 GB free), with Vercel Blob & Neon DB failover
    const result = await uploadToCloudStorage(file!, "officials");
    return NextResponse.json({ success: true, url: result.filePath });
  } catch (error) {
    console.error("Profile picture upload error:", error);
    return NextResponse.json({ error: "Failed to upload image file." }, { status: 500 });
  }
}
