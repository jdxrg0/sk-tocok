/**
 * Migrates all existing local-disk `/uploads/...` files referenced in Neon Postgres
 * (`expenses.receipt_url`, `deposits.attachment_url`, `users.avatar_url`, `print_requests.file_path`)
 * into the `stored_files` table in Neon Postgres, and updates each record to `/api/files/<id>`.
 *
 * Run:
 *   node scripts/migrate-uploads-to-db.mjs
 */

import { neon } from "@neondatabase/serverless";
import crypto from "crypto";
import fs from "fs";
import path from "path";

if (fs.existsSync(".env.local") && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(".env.local");
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("Missing DATABASE_URL in environment / .env.local");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

const EXTENSION_MIME_MAP = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".txt": "text/plain",
};

function inferMimeType(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  return EXTENSION_MIME_MAP[ext] || "application/octet-stream";
}

async function main() {
  console.log("Ensuring stored_files table exists in Neon Postgres...");
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

  // Deduplicate by local path so shared files (like sample-doc.pdf) are stored once
  const migratedByLocalPath = new Map();

  async function migrateLocalPath(localUrlPath, folder) {
    if (!localUrlPath || !localUrlPath.startsWith("/uploads/")) return null;

    if (migratedByLocalPath.has(localUrlPath)) {
      return migratedByLocalPath.get(localUrlPath);
    }

    const diskPath = path.join(process.cwd(), "public", localUrlPath.replace(/^\/+/, ""));
    if (!fs.existsSync(diskPath)) {
      console.warn(`  [SKIP] File not found on disk: ${localUrlPath}`);
      return null;
    }

    const buffer = fs.readFileSync(diskPath);
    const originalName = path.basename(diskPath);
    const rawExt = path.extname(originalName).toLowerCase();
    const safeExt = /^\.[a-z0-9]{1,8}$/.test(rawExt) ? rawExt : "";
    const fileId = `${crypto.randomUUID()}${safeExt}`;
    const mimeType = inferMimeType(originalName);
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

    const newUrl = `/api/files/${fileId}`;
    migratedByLocalPath.set(localUrlPath, newUrl);
    console.log(`  [UPLOADED] ${localUrlPath} (${(buffer.length / 1024).toFixed(1)} KB) -> ${newUrl}`);
    return newUrl;
  }

  let updatedCounts = { expenses: 0, deposits: 0, users: 0, print_requests: 0 };

  // 1. Expenses (vouchers / receipts)
  const expenses = await sql`SELECT id, receipt_url FROM expenses WHERE receipt_url LIKE '/uploads/%'`;
  for (const row of expenses) {
    const newUrl = await migrateLocalPath(row.receipt_url, "receipts");
    if (newUrl) {
      await sql`UPDATE expenses SET receipt_url = ${newUrl} WHERE id = ${row.id}`;
      updatedCounts.expenses++;
    }
  }

  // 2. Deposits (deposit slips)
  const deposits = await sql`SELECT id, attachment_url FROM deposits WHERE attachment_url LIKE '/uploads/%'`;
  for (const row of deposits) {
    const newUrl = await migrateLocalPath(row.attachment_url, "receipts");
    if (newUrl) {
      await sql`UPDATE deposits SET attachment_url = ${newUrl} WHERE id = ${row.id}`;
      updatedCounts.deposits++;
    }
  }

  // 3. Users (uploaded avatars)
  const users = await sql`SELECT id, avatar_url FROM users WHERE avatar_url LIKE '/uploads/%'`;
  for (const row of users) {
    const newUrl = await migrateLocalPath(row.avatar_url, "officials");
    if (newUrl) {
      await sql`UPDATE users SET avatar_url = ${newUrl} WHERE id = ${row.id}`;
      updatedCounts.users++;
    }
  }

  // 4. Print requests (legacy local sample PDFs)
  const prints = await sql`SELECT id, file_path FROM print_requests WHERE file_path LIKE '/uploads/%'`;
  for (const row of prints) {
    const newUrl = await migrateLocalPath(row.file_path, "prints");
    if (newUrl) {
      await sql`UPDATE print_requests SET file_path = ${newUrl} WHERE id = ${row.id}`;
      updatedCounts.print_requests++;
    }
  }

  const summary = await sql`
    SELECT
      COUNT(*)::int AS files,
      COALESCE(SUM(file_size), 0)::bigint AS total_bytes,
      pg_size_pretty(pg_database_size(current_database())) AS db_size
    FROM stored_files
  `;

  console.log("\nMigration complete!");
  console.log("Updated rows:", updatedCounts);
  console.log("stored_files summary:", summary[0]);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
