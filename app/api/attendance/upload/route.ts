import { NextResponse } from "next/server";
import { getCurrentUser, isOfficialUser } from "@/lib/auth";
import { uploadToCloudStorage } from "@/lib/googleDrive";
import { sql } from "@/lib/db";
import sharp from "sharp";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }
    if (!isOfficialUser(currentUser)) {
      return NextResponse.json(
        { error: "Forbidden: Only SK Officials can upload attendance proof." },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const files = formData.getAll("files") as File[];
    const singleFile = formData.get("file") as File | null;
    const allFiles = files.length > 0 ? files : singleFile ? [singleFile] : [];

    if (allFiles.length === 0) {
      return NextResponse.json(
        { error: "Please provide at least one photo or picture to upload." },
        { status: 400 }
      );
    }

    const MAX_SIZE = 15 * 1024 * 1024; // 15MB per photo
    for (const f of allFiles) {
      if (!f.type.startsWith("image/") && !/\.(jpe?g|png|webp|gif|heic|heif)$/i.test(f.name || "")) {
        return NextResponse.json(
          { error: `"${f.name || "File"}" is not a supported image format. Please upload JPG, PNG, or WEBP.` },
          { status: 400 }
        );
      }
      if (f.size > MAX_SIZE) {
        return NextResponse.json(
          { error: `"${f.name || "File"}" exceeds maximum allowed file size of 15MB.` },
          { status: 400 }
        );
      }
    }

    // Pre-optimize images using sharp to keep uploads lightweight (max 2048px, auto-rotate EXIF, WebP 85%)
    const optimizedFiles = await Promise.all(
      allFiles.map(async (file) => {
        try {
          const rawBuffer = Buffer.from(await file.arrayBuffer());
          const meta = await sharp(rawBuffer).metadata();
          const isLarge =
            (meta.width && meta.width > 2048) ||
            (meta.height && meta.height > 2048) ||
            rawBuffer.length > 800 * 1024 ||
            /\.(jpe?g|png|heic|heif)$/i.test(file.name || "");

          if (isLarge) {
            const optimizedBuffer = await sharp(rawBuffer)
              .rotate() // Auto-orient smartphone photos
              .resize({
                width: 2048,
                height: 2048,
                fit: "inside",
                withoutEnlargement: true,
              })
              .webp({ quality: 85 })
              .toBuffer();

            const baseName = (file.name || "photo").replace(/\.[^/.]+$/, "");
            return new File([optimizedBuffer], `${baseName}.webp`, {
              type: "image/webp",
            });
          }
        } catch (err) {
          console.warn("Image pre-optimization warning, uploading original:", err);
        }
        return file;
      })
    );

    // Upload to cloud storage (Google Drive / Vercel Blob / Neon Postgres storage)
    const uploadResults = await Promise.all(
      optimizedFiles.map((file) => uploadToCloudStorage(file, "attendance"))
    );
    const newUrls = uploadResults.map((res) => res.filePath).filter(Boolean);

    // Optional direct attachment to existing session
    const sessionIdRaw = formData.get("sessionId");
    const sessionId = sessionIdRaw ? parseInt(String(sessionIdRaw), 10) : null;

    let updatedProofPhotos: string[] = newUrls;

    if (sessionId && !Number.isNaN(sessionId)) {
      const existing = await sql`
        SELECT proof_photos FROM attendance_sessions WHERE id = ${sessionId}
      `;
      if (existing.length > 0) {
        let existingArr: string[] = [];
        const raw = (existing[0] as { proof_photos?: string | null })?.proof_photos;
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) existingArr = parsed.map(String).filter(Boolean);
          } catch {
            existingArr = [];
          }
        }

        updatedProofPhotos = [...existingArr, ...newUrls];
        const updatedJson = JSON.stringify(updatedProofPhotos);

        await sql`
          UPDATE attendance_sessions
          SET proof_photos = ${updatedJson},
              updated_at = NOW()
          WHERE id = ${sessionId}
        `;
      }
    }

    return NextResponse.json({
      success: true,
      urls: newUrls,
      proof_photos: updatedProofPhotos,
    });
  } catch (error) {
    console.error("Attendance proof upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload attendance proof photo." },
      { status: 500 }
    );
  }
}
