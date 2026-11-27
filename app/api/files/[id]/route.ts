import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureStoredFilesTable } from "@/lib/storage";
import { getCurrentUser, isOfficialUser } from "@/lib/auth";
import { logSecurityEvent } from "@/lib/securityLogger";
import { snapThumbnailWidth } from "@/lib/validation";
import sharp from "sharp";

export const dynamic = "force-dynamic";

const INLINE_SAFE_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
  "application/pdf",
]);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    let cleanId = "";
    try {
      cleanId = decodeURIComponent(id || "").trim();
    } catch {
      return NextResponse.json({ error: "Malformed file identifier" }, { status: 400 });
    }

    if (!cleanId || cleanId.includes("/") || cleanId.includes("..") || !/^[a-zA-Z0-9._-]+$/.test(cleanId)) {
      return NextResponse.json({ error: "Invalid file identifier" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const targetWidth = snapThumbnailWidth(
      searchParams.get("w") || searchParams.get("width"),
      [200, 400, 800, 1200]
    );

    await ensureStoredFilesTable();

    const rows = await sql`
      SELECT folder, file_name, mime_type, file_size, encode(data, 'base64') AS data_base64
      FROM stored_files
      WHERE id = ${cleanId}
      LIMIT 1
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const row = rows[0] as {
      folder: string | null;
      file_name: string;
      mime_type: string;
      file_size: number;
      data_base64: string;
    };

    const folder = (row.folder || "").trim().toLowerCase();
    const exactFilePath = `/api/files/${cleanId}`;
    const queryPrefix = `/api/files/${cleanId}?%`;
    let isPrivateFolder = folder === "cse" || folder === "prints";

    // Allow public read access only for admin-verified Hall of Fame passer portraits
    if (folder === "cse" || folder === "passers") {
      const publicAvatarMatch = await sql`
        SELECT id
        FROM cse_applications
        WHERE (passer_avatar_url = ${exactFilePath} OR passer_avatar_url LIKE ${queryPrefix})
          AND exam_result_status = 'Passed'
          AND result_verified_at IS NOT NULL
          AND is_featured_in_hall_of_fame = TRUE
        LIMIT 1
      `;
      if (publicAvatarMatch.length > 0) {
        isPrivateFolder = false;
      } else if (folder === "passers") {
        isPrivateFolder = true;
      }
    }

    if (isPrivateFolder) {
      const currentUser = await getCurrentUser(request);
      if (!currentUser) {
        return NextResponse.json(
          { error: "Authentication required to access this protected document." },
          { status: 401 }
        );
      }

      if (!isOfficialUser(currentUser)) {
        let isOwner = false;

        const isVerifiedLegacyOwner = Boolean(currentUser.email_verified);

        if (folder === "cse") {
          const matches = await sql`
            SELECT id
            FROM cse_applications
            WHERE (
              user_id = ${currentUser.id}
              OR (${isVerifiedLegacyOwner} AND user_id IS NULL AND LOWER(user_email) = LOWER(${currentUser.email}))
            )
              AND (
                valid_id_url = ${exactFilePath} OR valid_id_url LIKE ${queryPrefix}
                OR csc_receipt_url = ${exactFilePath} OR csc_receipt_url LIKE ${queryPrefix}
                OR exam_schedule_proof_url = ${exactFilePath} OR exam_schedule_proof_url LIKE ${queryPrefix}
                OR prior_sitting_proof_url = ${exactFilePath} OR prior_sitting_proof_url LIKE ${queryPrefix}
                OR exam_attendance_proof_url = ${exactFilePath} OR exam_attendance_proof_url LIKE ${queryPrefix}
                OR result_proof_url = ${exactFilePath} OR result_proof_url LIKE ${queryPrefix}
                OR passer_avatar_url = ${exactFilePath} OR passer_avatar_url LIKE ${queryPrefix}
              )
            LIMIT 1
          `;
          isOwner = matches.length > 0;
        } else if (folder === "prints") {
          const matches = await sql`
            SELECT id
            FROM print_requests
            WHERE (
              user_id = ${currentUser.id}
              OR (${isVerifiedLegacyOwner} AND user_id IS NULL AND LOWER(user_email) = LOWER(${currentUser.email}))
            )
              AND (file_path = ${exactFilePath} OR file_path LIKE ${queryPrefix})
            LIMIT 1
          `;
          isOwner = matches.length > 0;
        }

        if (!isOwner) {
          await logSecurityEvent({
            eventType: "IDOR_FILE_ACCESS_BLOCKED",
            severity: "high",
            request,
            userId: currentUser.id,
            email: currentUser.email,
            details: { fileId: cleanId, folder },
          });
          return NextResponse.json(
            { error: "Forbidden: you do not have permission to access this file." },
            { status: 403 }
          );
        }
      }
    }

    const rawBuffer = Buffer.from(row.data_base64, "base64");
    const safeFileName = (row.file_name || cleanId).replace(/["\r\n\\]/g, "_");

    let finalBuffer = rawBuffer;
    let finalContentType = (row.mime_type || "application/octet-stream").split(";")[0].trim().toLowerCase();
    let finalFileName = safeFileName;

    if (
      targetWidth > 0 &&
      finalContentType.startsWith("image/") &&
      finalContentType !== "image/svg+xml"
    ) {
      try {
        finalBuffer = await sharp(rawBuffer)
          .rotate()
          .resize({
            width: targetWidth,
            withoutEnlargement: true,
          })
          .webp({ quality: 75 })
          .toBuffer();
        finalContentType = "image/webp";
        finalFileName = `${safeFileName.replace(/\.[^/.]+$/, "")}.webp`;
      } catch (err) {
        console.warn("Sharp thumbnail generation fallback for stored file:", err);
      }
    }

    const safeInline = INLINE_SAFE_MIMES.has(finalContentType);

    const headers: Record<string, string> = {
      "Content-Type": safeInline ? finalContentType : "application/octet-stream",
      "Content-Length": String(finalBuffer.length),
      "Content-Disposition": `${safeInline ? "inline" : "attachment"}; filename="${finalFileName}"`,
      "Cache-Control": isPrivateFolder
        ? "private, no-store"
        : "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    };

    if (!safeInline) {
      headers["Content-Security-Policy"] = "sandbox; default-src 'none'";
    }

    return new NextResponse(new Uint8Array(finalBuffer), { status: 200, headers });
  } catch (error) {
    console.error("Serve stored file error:", error);
    return NextResponse.json(
      { error: "Failed to load file from cloud database" },
      { status: 500 }
    );
  }
}
