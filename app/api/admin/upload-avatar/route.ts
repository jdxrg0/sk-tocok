import { NextResponse } from "next/server";
import { getCurrentUser, isOfficialUser } from "@/lib/auth";
import { uploadToCloudStorage } from "@/lib/googleDrive";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }
    if (!isOfficialUser(currentUser)) {
      return NextResponse.json({ error: "Forbidden: SK Officials only" }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Please provide an image file to upload." }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Uploaded file must be an image (PNG, JPG, WEBP, or GIF)." }, { status: 400 });
    }

    // Limit to 10MB
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "Image file exceeds maximum size limit of 10MB." }, { status: 400 });
    }

    // Save to Google Drive first (15 GB free), with Vercel Blob & Neon DB failover
    const result = await uploadToCloudStorage(file, "officials");
    return NextResponse.json({ success: true, url: result.filePath });
  } catch (error) {
    console.error("Profile picture upload error:", error);
    return NextResponse.json({ error: "Failed to upload image file." }, { status: 500 });
  }
}
