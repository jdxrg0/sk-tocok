import { NextResponse } from "next/server";
import { inferMimeType } from "@/lib/storage";
import sharp from "sharp";

export const dynamic = "force-dynamic";

const FILE_ID_PATTERN = /^[a-zA-Z0-9_-]{10,128}$/;

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
  fileName: string
): Record<string, string> {
  const isSafeInline = INLINE_SAFE_MIMES.has(contentType.toLowerCase());
  const headers: Record<string, string> = {
    "Content-Type": isSafeInline ? contentType : "application/octet-stream",
    "Content-Length": String(bufferLength),
    "Content-Disposition": `${isSafeInline ? "inline" : "attachment"}; filename="${fileName}"`,
    "Cache-Control": "public, max-age=31536000, immutable",
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
          width: Math.min(Math.max(targetWidth, 50), 1600),
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

/**
 * Streams a public Google Drive file cleanly so it renders reliably inside `<img>` tags
 * (deposit slips, official avatars, voucher scans) as well as inline PDF/SVG browser tabs,
 * with optional width resizing (`?w=400`) and immutable CDN/browser caching.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    const { fileId } = await params;
    const cleanId = decodeURIComponent(fileId || "").trim();

    if (!FILE_ID_PATTERN.test(cleanId)) {
      return NextResponse.json({ error: "Invalid Google Drive file ID" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const targetWidthRaw = searchParams.get("w") || searchParams.get("width");
    const targetWidth = targetWidthRaw ? parseInt(targetWidthRaw, 10) : 0;

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
      // Connect timeout or network blip to drive.google.com -> fallback to view redirect
      return NextResponse.redirect(
        `https://drive.google.com/file/d/${encodeURIComponent(cleanId)}/view`,
        302
      );
    }

    const rawContentType = res.headers.get("content-type") || "application/octet-stream";

    // If Google Drive returned an HTML confirmation page instead of raw file bytes,
    // try the Googleusercontent direct image CDN first, otherwise redirect to Drive viewer.
    if (!res.ok || rawContentType.includes("text/html")) {
      try {
        const lh3Res = await fetch(
          `https://lh3.googleusercontent.com/d/${encodeURIComponent(cleanId)}`,
          { signal: AbortSignal.timeout(6000), redirect: "follow" }
        );
        const lh3Type = (lh3Res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
        if (lh3Res.ok && lh3Type && !lh3Type.includes("text/html") && !lh3Type.includes("svg")) {
          const lh3RawBuf = Buffer.from(await lh3Res.arrayBuffer());
          const { buffer: lh3Buf, contentType: finalLh3Type, fileName: finalLh3Name } =
            await maybeResizeImage(lh3RawBuf, lh3Type, targetWidth, cleanId);

          return new NextResponse(new Uint8Array(lh3Buf), {
            status: 200,
            headers: buildHardenedHeaders(finalLh3Type, lh3Buf.length, finalLh3Name),
          });
        }
      } catch {
        // Fall through to viewer redirect
      }

      return NextResponse.redirect(
        `https://drive.google.com/file/d/${encodeURIComponent(cleanId)}/view`,
        302
      );
    }

    const rawBuffer = Buffer.from(await res.arrayBuffer());
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

    const headers = buildHardenedHeaders(contentType, buffer.length, fileName);

    return new NextResponse(new Uint8Array(buffer), { status: 200, headers });
  } catch (error) {
    console.error("Google Drive proxy error:", error);
    return NextResponse.json(
      { error: "Failed to load file from Google Drive" },
      { status: 502 }
    );
  }
}
