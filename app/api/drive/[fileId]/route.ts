import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getCurrentUser, isOfficialUser } from "@/lib/auth";
import { getDriveClient } from "@/lib/googleDrive";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/rateLimit";
import { logSecurityEvent } from "@/lib/securityLogger";
import { inferMimeType } from "@/lib/storage";
import { snapThumbnailWidth } from "@/lib/validation";
import sharp from "sharp";

export const dynamic = "force-dynamic";

const FILE_ID_PATTERN = /^[a-zA-Z0-9_-]{10,128}$/;
const MAX_DRIVE_PROXY_BYTES = 25 * 1024 * 1024; // 25 MB cap

function detectMimeType(
  headerContentType: string,
  fileName: string,
  buffer: Buffer
): string {
  const cleanHeader = (headerContentType || "").split(";")[0].trim().toLowerCase();
  if (cleanHeader && cleanHeader !== "application/octet-stream") {
    return cleanHeader;
  }

  // Try filename extension from Content-Disposition first
  const byExt = inferMimeType(fileName);
  if (byExt !== "application/octet-stream") {
    return byExt;
  }

  // Fallback: sniff magic bytes / SVG header
  if (buffer.length >= 4) {
    if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
      return "application/pdf";
    }
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
      return "image/png";
    }
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return "image/jpeg";
    }
    if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) {
      return "image/gif";
    }
    if (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
      buffer.subarray(8, 12).toString("ascii") === "WEBP"
    ) {
      return "image/webp";
    }
  }

  const head = buffer.subarray(0, 256).toString("utf8").trimStart();
  if (head.startsWith("<svg") || (head.startsWith("<?xml") && head.includes("<svg"))) {
    return "image/svg+xml";
  }

  return "application/octet-stream";
}

const INLINE_SAFE_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
  "application/pdf",
]);

function buildHardenedHeaders(
  contentType: string,
  bufferLength: number,
  fileName: string,
  isPrivate: boolean
): Record<string, string> {
  const isSafeInline = INLINE_SAFE_MIMES.has(contentType.toLowerCase());
  const headers: Record<string, string> = {
    "Content-Type": isSafeInline ? contentType : "application/octet-stream",
    "Content-Length": String(bufferLength),
    "Content-Disposition": `${isSafeInline ? "inline" : "attachment"}; filename="${fileName}"`,
    "Cache-Control": isPrivate
      ? "private, no-store"
      : "public, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
  };
  if (!isSafeInline) {
    headers["Content-Security-Policy"] = "sandbox; default-src 'none'";
  }
  return headers;
}

async function maybeResizeImage(
  buffer: Buffer,
  contentType: string,
  targetWidth: number,
  safeFileName: string
): Promise<{ buffer: Buffer; contentType: string; fileName: string }> {
  if (
    targetWidth > 0 &&
    contentType.startsWith("image/") &&
    contentType !== "image/svg+xml"
  ) {
    try {
      const resized = await sharp(buffer)
        .rotate()
        .resize({
          width: targetWidth,
          withoutEnlargement: true,
        })
        .webp({ quality: 75 })
        .toBuffer();
      return {
        buffer: resized,
        contentType: "image/webp",
        fileName: `${safeFileName.replace(/\.[^/.]+$/, "")}.webp`,
      };
    } catch (err) {
      console.warn("Sharp thumbnail resize failed, using original:", err);
    }
  }
  return { buffer, contentType, fileName: safeFileName };
}

type DriveAuthResult =
  | { allowed: true; isPrivate: boolean }
  | { allowed: false; status: 401 | 403 | 404; error: string };

async function authorizeDriveFile(cleanId: string, request: Request): Promise<DriveAuthResult> {
  const proxyPath = `/api/drive/${cleanId}`;
  const proxyPrefix = `/api/drive/${cleanId}?`;

  // 1. Check public transparency & official portal tables first
  const publicMatch = await sql`
    SELECT 1
    WHERE EXISTS (
      SELECT 1 FROM expenses
      WHERE receipt_url = ${proxyPath}
         OR LEFT(COALESCE(receipt_url, ''), ${proxyPrefix.length}) = ${proxyPrefix}
         OR (POSITION('drive.google.com' IN COALESCE(receipt_url, '')) > 0 AND POSITION(${cleanId} IN COALESCE(receipt_url, '')) > 0)
    )
    OR EXISTS (
      SELECT 1 FROM deposits
      WHERE attachment_url = ${proxyPath}
         OR LEFT(COALESCE(attachment_url, ''), ${proxyPrefix.length}) = ${proxyPrefix}
         OR (POSITION('drive.google.com' IN COALESCE(attachment_url, '')) > 0 AND POSITION(${cleanId} IN COALESCE(attachment_url, '')) > 0)
    )
    OR EXISTS (
      SELECT 1 FROM users
      WHERE avatar_url = ${proxyPath}
         OR LEFT(COALESCE(avatar_url, ''), ${proxyPrefix.length}) = ${proxyPrefix}
         OR (POSITION('drive.google.com' IN COALESCE(avatar_url, '')) > 0 AND POSITION(${cleanId} IN COALESCE(avatar_url, '')) > 0)
    )
    OR EXISTS (
      SELECT 1 FROM attendance_sessions
      WHERE POSITION(${proxyPath} IN COALESCE(proof_photos, '')) > 0
         OR (POSITION('drive.google.com' IN COALESCE(proof_photos, '')) > 0 AND POSITION(${cleanId} IN COALESCE(proof_photos, '')) > 0)
    )
    OR EXISTS (
      SELECT 1 FROM cse_applications
      WHERE (
        passer_avatar_url = ${proxyPath}
        OR LEFT(COALESCE(passer_avatar_url, ''), ${proxyPrefix.length}) = ${proxyPrefix}
      )
      AND exam_result_status = 'Passed'
      AND result_verified_at IS NOT NULL
      AND is_featured_in_hall_of_fame = TRUE
    )
    LIMIT 1
  `;

  if (publicMatch.length > 0) {
    return { allowed: true, isPrivate: false };
  }

  // 2. Check private student print requests & CSE application documents
  const printMatches = await sql`
    SELECT id, user_id, user_email
    FROM print_requests
    WHERE file_path = ${proxyPath}
       OR LEFT(COALESCE(file_path, ''), ${proxyPrefix.length}) = ${proxyPrefix}
       OR (POSITION('drive.google.com' IN COALESCE(file_path, '')) > 0 AND POSITION(${cleanId} IN COALESCE(file_path, '')) > 0)
    LIMIT 1
  `;

  const cseMatches =
    printMatches.length === 0
      ? await sql`
          SELECT id, user_id, user_email
          FROM cse_applications
          WHERE POSITION(${proxyPath} IN COALESCE(valid_id_url, '')) > 0
             OR POSITION(${proxyPath} IN COALESCE(csc_receipt_url, '')) > 0
             OR POSITION(${proxyPath} IN COALESCE(exam_schedule_proof_url, '')) > 0
             OR POSITION(${proxyPath} IN COALESCE(prior_sitting_proof_url, '')) > 0
             OR POSITION(${proxyPath} IN COALESCE(exam_attendance_proof_url, '')) > 0
             OR POSITION(${proxyPath} IN COALESCE(result_proof_url, '')) > 0
             OR POSITION(${proxyPath} IN COALESCE(passer_avatar_url, '')) > 0
          LIMIT 1
        `
      : [];

  if (printMatches.length === 0 && cseMatches.length === 0) {
    return { allowed: false, status: 404, error: "File not found" };
  }

  const currentUser = await getCurrentUser(request);
  if (!currentUser) {
    return {
      allowed: false,
      status: 401,
      error: "Authentication required to access this protected document.",
    };
  }

  if (isOfficialUser(currentUser)) {
    return { allowed: true, isPrivate: true };
  }

  const record = (printMatches[0] || cseMatches[0]) as {
    user_id?: number | null;
    user_email?: string | null;
  };
  const isOwner = Boolean(
    (record.user_id !== null &&
      record.user_id !== undefined &&
      Number(record.user_id) === currentUser.id) ||
      (!record.user_id &&
        record.user_email &&
        String(record.user_email).trim().toLowerCase() === currentUser.email.trim().toLowerCase())
  );

  if (!isOwner) {
    await logSecurityEvent({
      eventType: "IDOR_DRIVE_FILE_ACCESS_BLOCKED",
      severity: "high",
      request,
      userId: currentUser.id,
      email: currentUser.email,
      details: { fileId: cleanId },
    });
    return {
      allowed: false,
      status: 403,
      error: "Forbidden: you do not have permission to access this document.",
    };
  }

  return { allowed: true, isPrivate: true };
}

/**
 * Streams a registered Google Drive file from this portal so it renders reliably inside `<img>` tags
 * and document tabs while enforcing authorization for private student files and preventing open proxying.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    const limit = await checkRateLimit({
      request,
      bucket: "drive_proxy",
      max: 120,
      windowMs: 60 * 1000,
    });
    if (!limit.allowed) {
      return rateLimitExceededResponse(limit.retryAfterSeconds);
    }

    const { fileId } = await params;
    const cleanId = decodeURIComponent(fileId || "").trim();

    if (!FILE_ID_PATTERN.test(cleanId)) {
      return NextResponse.json({ error: "Invalid Google Drive file ID" }, { status: 400 });
    }

    const authz = await authorizeDriveFile(cleanId, request);
    if (!authz.allowed) {
      return NextResponse.json({ error: authz.error }, { status: authz.status });
    }

    const { searchParams } = new URL(request.url);
    const targetWidth = snapThumbnailWidth(
      searchParams.get("w") || searchParams.get("width"),
      [200, 400, 800, 1200]
    );

    // 1. Prefer authenticated Service Account Drive API (works for private student files too)
    const driveInfo = getDriveClient();
    if (driveInfo) {
      try {
        const meta = await driveInfo.drive.files.get({
          fileId: cleanId,
          fields: "name, mimeType, size",
        });
        const declaredSize = Number(meta.data.size || 0);
        if (declaredSize > MAX_DRIVE_PROXY_BYTES) {
          return NextResponse.json(
            { error: "File exceeds maximum allowed proxy size" },
            { status: 413 }
          );
        }

        const mediaRes = await driveInfo.drive.files.get(
          { fileId: cleanId, alt: "media" },
          { responseType: "arraybuffer" }
        );
        const rawBuffer = Buffer.from(mediaRes.data as ArrayBuffer);
        if (rawBuffer.length > MAX_DRIVE_PROXY_BYTES) {
          return NextResponse.json(
            { error: "File exceeds maximum allowed proxy size" },
            { status: 413 }
          );
        }

        const safeFileName = (meta.data.name || cleanId).replace(/["\r\n\\]/g, "_");
        const detectedType = detectMimeType(
          meta.data.mimeType || "application/octet-stream",
          safeFileName,
          rawBuffer
        );
        const { buffer, contentType, fileName } = await maybeResizeImage(
          rawBuffer,
          detectedType,
          targetWidth,
          safeFileName
        );
        const headers = buildHardenedHeaders(contentType, buffer.length, fileName, authz.isPrivate);
        return new NextResponse(new Uint8Array(buffer), { status: 200, headers });
      } catch (driveApiErr) {
        if (authz.isPrivate) {
          console.error("Authenticated Drive fetch failed for private file:", driveApiErr);
          return NextResponse.json(
            { error: "Failed to load protected document from storage." },
            { status: 502 }
          );
        }
        // For public portal files, fall through to public CDN fetch below
      }
    }

    if (authz.isPrivate) {
      return NextResponse.json(
        { error: "Drive service account is unavailable for protected files." },
        { status: 503 }
      );
    }

    const downloadUrl = `https://drive.google.com/uc?export=download&id=${encodeURIComponent(cleanId)}`;
    let res: Response | null = null;
    try {
      res = await fetch(downloadUrl, {
        signal: AbortSignal.timeout(6000),
        redirect: "follow",
        headers: {
          "User-Agent": "SK-Tocok-Portal/1.0",
        },
      });
    } catch {
      return NextResponse.redirect(
        `https://drive.google.com/file/d/${encodeURIComponent(cleanId)}/view`,
        302
      );
    }

    const rawContentType = res.headers.get("content-type") || "application/octet-stream";

    if (!res.ok || rawContentType.includes("text/html")) {
      try {
        const lh3Res = await fetch(
          `https://lh3.googleusercontent.com/d/${encodeURIComponent(cleanId)}`,
          { signal: AbortSignal.timeout(6000), redirect: "follow" }
        );
        const lh3Type = (lh3Res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
        const lh3Len = parseInt(lh3Res.headers.get("content-length") || "0", 10);
        if (
          lh3Res.ok &&
          lh3Type &&
          !lh3Type.includes("text/html") &&
          !lh3Type.includes("svg") &&
          (!Number.isFinite(lh3Len) || lh3Len <= MAX_DRIVE_PROXY_BYTES)
        ) {
          const lh3RawBuf = Buffer.from(await lh3Res.arrayBuffer());
          if (lh3RawBuf.length <= MAX_DRIVE_PROXY_BYTES) {
            const { buffer: lh3Buf, contentType: finalLh3Type, fileName: finalLh3Name } =
              await maybeResizeImage(lh3RawBuf, lh3Type, targetWidth, cleanId);

            return new NextResponse(new Uint8Array(lh3Buf), {
              status: 200,
              headers: buildHardenedHeaders(finalLh3Type, lh3Buf.length, finalLh3Name, false),
            });
          }
        }
      } catch {
        // Fall through to viewer redirect
      }

      return NextResponse.redirect(
        `https://drive.google.com/file/d/${encodeURIComponent(cleanId)}/view`,
        302
      );
    }

    const declaredLength = parseInt(res.headers.get("content-length") || "0", 10);
    if (Number.isFinite(declaredLength) && declaredLength > MAX_DRIVE_PROXY_BYTES) {
      return NextResponse.json(
        { error: "File exceeds maximum allowed proxy size" },
        { status: 413 }
      );
    }

    const rawBuffer = Buffer.from(await res.arrayBuffer());
    if (rawBuffer.length > MAX_DRIVE_PROXY_BYTES) {
      return NextResponse.json(
        { error: "File exceeds maximum allowed proxy size" },
        { status: 413 }
      );
    }

    const disposition = res.headers.get("content-disposition") || "";
    const fileNameMatch = disposition.match(/filename\*?=(?:UTF-8''|")?([^";\r\n]+)/i);
    const safeFileName = fileNameMatch
      ? decodeURIComponent(fileNameMatch[1].replace(/"/g, "")).replace(/["\r\n\\]/g, "_")
      : cleanId;

    const detectedType = detectMimeType(rawContentType, safeFileName, rawBuffer);
    const { buffer, contentType, fileName } = await maybeResizeImage(
      rawBuffer,
      detectedType,
      targetWidth,
      safeFileName
    );

    const headers = buildHardenedHeaders(contentType, buffer.length, fileName, false);

    return new NextResponse(new Uint8Array(buffer), { status: 200, headers });
  } catch (error) {
    console.error("Google Drive proxy error:", error);
    return NextResponse.json(
      { error: "Failed to load file from Google Drive" },
      { status: 502 }
    );
  }
}
