import { NextResponse } from "next/server";
import { list } from "@vercel/blob";
import { getCurrentUser, isSuperAdminUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const DEFAULT_BLOB_LIMIT_MB = 1024; // Vercel Blob Hobby Free Tier: 1 GB
const RETENTION_DAYS = 90;
const MAX_LIST_PAGES = 10; // Safety cap (up to 10,000 blobs)

const FOLDER_LABELS: Record<string, string> = {
  prints: "Print Failover Files",
  officials: "Legacy Official Avatars",
  receipts: "Legacy Receipts",
  other: "Other Files",
};

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }
    if (!isSuperAdminUser(user)) {
      return NextResponse.json({ error: "Forbidden: SK Chairperson privileges required" }, { status: 403 });
    }

    const limitMbEnv = Number(process.env.VERCEL_BLOB_LIMIT_MB);
    const limitMb =
      Number.isFinite(limitMbEnv) && limitMbEnv > 0 ? limitMbEnv : DEFAULT_BLOB_LIMIT_MB;
    const limitBytes = limitMb * 1024 * 1024;

    const plan = {
      name: "Vercel Blob Hobby",
      storageLimitLabel: `${(limitMb / 1024).toFixed(limitMb % 1024 === 0 ? 0 : 1)} GB`,
      transferAllowanceLabel: "10 GB / mo",
      simpleOpsLabel: "10K reads / mo",
      advancedOpsLabel: "2K uploads / mo",
    };

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json({
        success: true,
        configured: false,
        status: "not_configured",
        statusLevel: "healthy",
        storage: {
          usedBytes: 0,
          limitBytes,
          remainingBytes: limitBytes,
          usagePercent: 0,
        },
        totalFiles: 0,
        expiredFiles: 0,
        folders: [],
        plan,
        checkedAt: new Date().toISOString(),
      });
    }

    const startTime = Date.now();
    const cutoffDate = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

    let cursor: string | undefined;
    let pages = 0;
    let usedBytes = 0;
    let totalFiles = 0;
    let expiredFiles = 0;
    const folderMap = new Map<string, { files: number; totalBytes: number }>();

    do {
      const result = await list({ cursor, limit: 1000 });
      for (const blob of result.blobs) {
        const size = Number(blob.size || 0);
        usedBytes += size;
        totalFiles += 1;

        const firstSegment = blob.pathname.includes("/")
          ? blob.pathname.split("/")[0].toLowerCase()
          : "other";
        const key = FOLDER_LABELS[firstSegment] ? firstSegment : "other";
        const existing = folderMap.get(key) || { files: 0, totalBytes: 0 };
        existing.files += 1;
        existing.totalBytes += size;
        folderMap.set(key, existing);

        if (blob.pathname.startsWith("prints/") && new Date(blob.uploadedAt) < cutoffDate) {
          expiredFiles += 1;
        }
      }

      cursor = result.cursor;
      pages += 1;
    } while (cursor && pages < MAX_LIST_PAGES);

    const latencyMs = Math.max(1, Date.now() - startTime);
    const remainingBytes = Math.max(0, limitBytes - usedBytes);
    const usagePercent = Math.min(100, Number(((usedBytes / limitBytes) * 100).toFixed(2)));

    let statusLevel: "healthy" | "warning" | "critical" = "healthy";
    if (usagePercent >= 90) {
      statusLevel = "critical";
    } else if (usagePercent >= 70) {
      statusLevel = "warning";
    }

    const folders = Array.from(folderMap.entries())
      .map(([name, stat]) => ({
        name,
        label: FOLDER_LABELS[name] || name,
        files: stat.files,
        totalBytes: stat.totalBytes,
      }))
      .sort((a, b) => b.totalBytes - a.totalBytes);

    return NextResponse.json({
      success: true,
      configured: true,
      status: "online",
      statusLevel,
      latencyMs,
      storage: {
        usedBytes,
        limitBytes,
        remainingBytes,
        usagePercent,
      },
      totalFiles,
      expiredFiles,
      folders,
      plan,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Vercel Blob status check error:", error);
    return NextResponse.json(
      {
        success: false,
        configured: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
        status: "offline",
        statusLevel: "critical",
        error: "Unable to reach Vercel Blob storage right now.",
        checkedAt: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
