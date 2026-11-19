import { NextResponse } from "next/server";
import { inferMimeType } from "@/lib/storage";

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

/**
 * Streams a public Google Drive file cleanly so it renders reliably inside `<img>` tags
 * (deposit slips, official avatars, voucher scans) as well as inline PDF/SVG browser tabs,
 * with immutable CDN/browser caching.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    const { fileId } = await params;
    const cleanId = decodeURIComponent(fileId || "").trim();

    if (!FILE_ID_PATTERN.test(cleanId)) {
      return NextResponse.json({ error: "Invalid Google Drive file ID" }, { status: 400 });
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
        const lh3Type = lh3Res.headers.get("content-type") || "";
        if (lh3Res.ok && lh3Type && !lh3Type.includes("text/html")) {
          const lh3Buf = Buffer.from(await lh3Res.arrayBuffer());
          return new NextResponse(lh3Buf, {
            status: 200,
            headers: {
              "Content-Type": lh3Type,
              "Content-Length": String(lh3Buf.length),
              "Content-Disposition": "inline",
              "Cache-Control": "public, max-age=31536000, immutable",
              "X-Content-Type-Options": "nosniff",
            },
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

    const buffer = Buffer.from(await res.arrayBuffer());
    const disposition = res.headers.get("content-disposition") || "";
    const fileNameMatch = disposition.match(/filename\*?=(?:UTF-8''|")?([^";\r\n]+)/i);
    const safeFileName = fileNameMatch
      ? decodeURIComponent(fileNameMatch[1].replace(/"/g, "")).replace(/["\r\n\\]/g, "_")
      : cleanId;

    const contentType = detectMimeType(rawContentType, safeFileName, buffer);

    const headers: Record<string, string> = {
      "Content-Type": contentType,
      "Content-Length": String(buffer.length),
      "Content-Disposition": `inline; filename="${safeFileName}"`,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    };

    if (contentType === "image/svg+xml") {
      headers["Content-Security-Policy"] =
        "default-src 'none'; style-src 'unsafe-inline'; img-src data:;";
    }

    return new NextResponse(buffer, { status: 200, headers });
  } catch (error) {
    console.error("Google Drive proxy error:", error);
    return NextResponse.json(
      { error: "Failed to load file from Google Drive" },
      { status: 502 }
    );
  }
}
