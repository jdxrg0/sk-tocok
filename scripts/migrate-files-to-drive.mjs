/**
 * Migrates all files currently stored in Neon Postgres (`stored_files` / `/api/files/...`)
 * into Google Drive via GOOGLE_APPS_SCRIPT_URL, updates all database references to
 * `/api/drive/<fileId>` (or `https://drive.google.com/file/d/<fileId>/view` for prints),
 * and deletes the migrated binary rows from `stored_files` to keep Neon Postgres lean.
 *
 * Run:
 *   node scripts/migrate-files-to-drive.mjs
 */

import { neon } from "@neondatabase/serverless";
import fs from "fs";

if (fs.existsSync(".env.local") && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(".env.local");
}

const DATABASE_URL = process.env.DATABASE_URL;
const APPS_SCRIPT_URL = process.env.GOOGLE_APPS_SCRIPT_URL;

if (!DATABASE_URL || !APPS_SCRIPT_URL) {
  console.error("Missing DATABASE_URL or GOOGLE_APPS_SCRIPT_URL in .env.local");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

function extractDriveFileId(rawId, rawUrl) {
  if (rawId && /^[a-zA-Z0-9_-]{10,}$/.test(String(rawId).trim())) {
    return String(rawId).trim();
  }
  if (rawUrl) {
    const m1 = String(rawUrl).match(/\/d\/([a-zA-Z0-9_-]{10,})/);
    if (m1) return m1[1];
    const m2 = String(rawUrl).match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
    if (m2) return m2[1];
  }
  return null;
}

async function uploadToDrive({ fileName, mimeType, base64, folder }) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName, mimeType, base64, folder }),
      redirect: "follow",
    });

    const text = await res.text();
    if (res.ok) {
      const data = JSON.parse(text);
      if (data && data.success) {
        const fileId = extractDriveFileId(data.fileId, data.url);
        if (fileId) {
          return {
            fileId,
            webViewLink: data.url || `https://drive.google.com/file/d/${fileId}/view`,
          };
        }
      }
      throw new Error(`Apps Script returned error: ${text}`);
    }

    if (attempt < 3) {
      await new Promise((r) => setTimeout(r, attempt * 1000));
    } else {
      throw new Error(`HTTP ${res.status}: ${text}`);
    }
  }
}

async function main() {
  const rows = await sql`
    SELECT id, folder, file_name, mime_type, file_size, encode(data, 'base64') AS data_base64
    FROM stored_files
    ORDER BY created_at ASC
  `;

  if (rows.length === 0) {
    console.log("No files found in stored_files. Everything is already clean!");
    return;
  }

  console.log(`Migrating ${rows.length} files from Neon Postgres -> Google Drive...`);

  const prefixMap = {
    receipts: "[SK-Tocok Voucher]",
    officials: "[SK-Tocok Official]",
    prints: "[SK-Tocok]",
  };
  const driveFolderMap = {
    receipts: "Vouchers",
    officials: "Officials",
    prints: "Prints",
  };

  let migratedCount = 0;

  for (const row of rows) {
    const oldUrl = `/api/files/${row.id}`;
    const isDeposit = String(row.file_name).toLowerCase().includes("deposit");
    const prefix = isDeposit
      ? "[SK-Tocok Deposit]"
      : prefixMap[row.folder] || "[SK-Tocok]";
    const driveFolder = isDeposit
      ? "Deposits"
      : driveFolderMap[row.folder] || "Uploads";

    const driveFileName = `${prefix} ${row.file_name}`;

    const uploaded = await uploadToDrive({
      fileName: driveFileName,
      mimeType: row.mime_type || "application/octet-stream",
      base64: row.data_base64,
      folder: driveFolder,
    });

    const proxyUrl = `/api/drive/${uploaded.fileId}`;

    // Update all referencing tables
    await sql`UPDATE expenses SET receipt_url = ${proxyUrl} WHERE receipt_url = ${oldUrl}`;
    await sql`UPDATE deposits SET attachment_url = ${proxyUrl} WHERE attachment_url = ${oldUrl}`;
    await sql`UPDATE users SET avatar_url = ${proxyUrl} WHERE avatar_url = ${oldUrl}`;
    await sql`UPDATE print_requests SET file_path = ${uploaded.webViewLink} WHERE file_path = ${oldUrl}`;

    // Remove binary from Neon Postgres now that Google Drive has it safely
    await sql`DELETE FROM stored_files WHERE id = ${row.id}`;

    migratedCount += 1;
    console.log(
      `  [${migratedCount}/${rows.length}] ${row.file_name} (${(row.file_size / 1024).toFixed(1)} KB) -> ${
        row.folder === "prints" ? uploaded.webViewLink : proxyUrl
      }`
    );
  }

  const remaining = await sql`
    SELECT
      (SELECT COUNT(*) FROM stored_files)::int AS stored_files,
      pg_size_pretty(pg_database_size(current_database())) AS db_size
  `;

  console.log("\nGoogle Drive migration complete!");
  console.log("Remaining in Neon stored_files:", remaining[0]);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
