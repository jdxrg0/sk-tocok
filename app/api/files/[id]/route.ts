import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureStoredFilesTable } from "@/lib/storage";
import sharp from "sharp";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cleanId = decodeURIComponent(id || "").trim();

    if (!cleanId || cleanId.includes("/") || cleanId.includes("..")) {
      return NextResponse.json({ error: "Invalid file identifier" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const targetWidthRaw = searchParams.get("w") || searchParams.get("width");
    const targetWidth = targetWidthRaw ? parseInt(targetWidthRaw, 10) : 0;

    await ensureStoredFilesTable();

    const rows = await sql`
      SELECT file_name, mime_type, file_size, encode(data, 'base64') AS data_base64
      FROM stored_files
      WHERE id = ${cleanId}
      LIMIT 1
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const row = rows[0] as {
      file_name: string;
      mime_type: string;
      file_size: number;
      data_base64: string;
    };

    const rawBuffer = Buffer.from(row.data_base64, "base64");
    const safeFileName = (row.file_name || cleanId).replace(/["\r\n\\]/g, "_");

    let finalBuffer = rawBuffer;
    let finalContentType = row.mime_type || "application/octet-stream";
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
            width: Math.min(Math.max(targetWidth, 50), 1600),
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

    const headers: Record<string, string> = {
      "Content-Type": finalContentType,
      "Content-Length": String(finalBuffer.length),
      "Content-Disposition": `inline; filename="${finalFileName}"`,
      // Files have immutable UUID identifiers, so aggressive browser/CDN caching minimizes DB egress
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    };

    // Harden inline SVG rendering against script execution
    if (finalContentType === "image/svg+xml") {
      headers["Content-Security-Policy"] = "default-src 'none'; style-src 'unsafe-inline'; img-src data:;";
    }

    return new NextResponse(new Uint8Array(finalBuffer), { status: 200, headers });
  } catch (error) {
    console.error("Serve stored file error:", error);
    return NextResponse.json({ error: "Failed to load file from cloud database" }, { status: 500 });
  }
}
