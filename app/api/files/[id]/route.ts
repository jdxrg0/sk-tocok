import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureStoredFilesTable } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cleanId = decodeURIComponent(id || "").trim();

    if (!cleanId || cleanId.includes("/") || cleanId.includes("..")) {
      return NextResponse.json({ error: "Invalid file identifier" }, { status: 400 });
    }

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

    const buffer = Buffer.from(row.data_base64, "base64");
    const safeFileName = (row.file_name || cleanId).replace(/["\r\n\\]/g, "_");

    const headers: Record<string, string> = {
      "Content-Type": row.mime_type || "application/octet-stream",
      "Content-Length": String(buffer.length),
      "Content-Disposition": `inline; filename="${safeFileName}"`,
      // Files have immutable UUID identifiers, so aggressive browser/CDN caching minimizes DB egress
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    };

    // Harden inline SVG rendering against script execution
    if (row.mime_type === "image/svg+xml") {
      headers["Content-Security-Policy"] = "default-src 'none'; style-src 'unsafe-inline'; img-src data:;";
    }

    return new NextResponse(buffer, { status: 200, headers });
  } catch (error) {
    console.error("Serve stored file error:", error);
    return NextResponse.json({ error: "Failed to load file from cloud database" }, { status: 500 });
  }
}
