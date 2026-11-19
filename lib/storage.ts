import crypto from "crypto";
import path from "path";
import { sql } from "./db";

let tableEnsured = false;

const EXTENSION_MIME_MAP: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".txt": "text/plain",
};

export function inferMimeType(fileName: string, providedType?: string): string {
  if (providedType && providedType !== "application/octet-stream") {
    return providedType;
  }
  const ext = path.extname(fileName || "").toLowerCase();
  return EXTENSION_MIME_MAP[ext] || providedType || "application/octet-stream";
}

export async function ensureStoredFilesTable(): Promise<void> {
  if (tableEnsured) return;
  await sql`
    CREATE TABLE IF NOT EXISTS stored_files (
      id         TEXT PRIMARY KEY,
      folder     TEXT NOT NULL,
      file_name  TEXT NOT NULL,
      mime_type  TEXT NOT NULL,
      file_size  INTEGER NOT NULL,
      data       BYTEA NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  tableEnsured = true;
}

/**
 * Saves an uploaded file directly into the Neon Postgres Cloud Database (`stored_files` table)
 * and returns its immutable serving URL (`/api/files/<id>`).
 */
export async function saveUploadedFile(
  file: File,
  folder: "prints" | "receipts" | "officials"
): Promise<{ filePath: string; fileName: string; fileSize: number; fileId: string }> {
  await ensureStoredFilesTable();

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const originalName = file.name || "document.pdf";
  const rawExt = path.extname(originalName).toLowerCase();
  const safeExt = /^\.[a-z0-9]{1,8}$/.test(rawExt) ? rawExt : "";
  const fileId = `${crypto.randomUUID()}${safeExt}`;
  const mimeType = inferMimeType(originalName, file.type);
  const base64Data = buffer.toString("base64");

  await sql`
    INSERT INTO stored_files (id, folder, file_name, mime_type, file_size, data)
    VALUES (
      ${fileId},
      ${folder},
      ${originalName},
      ${mimeType},
      ${buffer.length},
      decode(${base64Data}, 'base64')
    )
  `;

  return {
    fileId,
    filePath: `/api/files/${fileId}`,
    fileName: originalName,
    fileSize: buffer.length,
  };
}

/**
 * Safely deletes a file from `stored_files` if it is a `/api/files/<id>` URL
 * and is no longer referenced by any expense, deposit, user, or print request.
 */
export async function deleteStoredFileByUrl(url: string | null | undefined): Promise<void> {
  if (!url || !url.startsWith("/api/files/")) return;
  const fileId = url.slice("/api/files/".length).split("?")[0].trim();
  if (!fileId) return;

  try {
    await ensureStoredFilesTable();
    const refs = await sql`
      SELECT (
        (SELECT COUNT(*) FROM expenses WHERE receipt_url = ${url}) +
        (SELECT COUNT(*) FROM deposits WHERE attachment_url = ${url}) +
        (SELECT COUNT(*) FROM users WHERE avatar_url = ${url}) +
        (SELECT COUNT(*) FROM print_requests WHERE file_path = ${url})
      )::int AS ref_count
    `;
    const refCount = Number((refs[0] as { ref_count: number } | undefined)?.ref_count || 0);
    if (refCount === 0) {
      await sql`DELETE FROM stored_files WHERE id = ${fileId}`;
    }
  } catch (err) {
    console.warn("Failed to clean up orphaned stored file:", fileId, err);
  }
}
