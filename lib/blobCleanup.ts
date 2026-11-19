import { list, del } from "@vercel/blob";
import { sql } from "./db";

/**
 * Automatically purges Vercel Blob files that are older than the specified retention period (default: 90 days).
 * Updates corresponding database records so transparency statistics and audit logs are preserved.
 */
export async function cleanupExpiredBlobs(retentionDays = 90): Promise<{
  success: boolean;
  deletedCount: number;
  message: string;
}> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return {
      success: true,
      deletedCount: 0,
      message: "Vercel Blob is not configured. No files to clean up.",
    };
  }

  const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  let cursor: string | undefined;
  let totalDeleted = 0;
  const deletedUrls: string[] = [];

  do {
    const result = await list({
      prefix: "prints/",
      cursor,
      limit: 1000,
    });

    const expired = result.blobs.filter(
      (blob) => new Date(blob.uploadedAt) < cutoffDate
    );

    if (expired.length > 0) {
      const urls = expired.map((b) => b.url);
      await del(urls);
      totalDeleted += urls.length;
      deletedUrls.push(...urls);
    }

    cursor = result.cursor;
  } while (cursor);

  // Retain historical transparency record while noting that the temporary document has expired
  if (deletedUrls.length > 0) {
    for (const url of deletedUrls) {
      try {
        await sql`
          UPDATE print_requests
          SET file_path = '[Archived / Expired after 90 days]'
          WHERE file_path = ${url}
        `;
      } catch (_) {}
    }
  }

  return {
    success: true,
    deletedCount: totalDeleted,
    message: `Cleaned up ${totalDeleted} files older than ${retentionDays} days.`,
  };
}
