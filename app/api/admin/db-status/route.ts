import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getCurrentUser, isOfficialUser } from "@/lib/auth";
import { ensureStoredFilesTable } from "@/lib/storage";
import { ensureAttendanceTables } from "@/lib/attendance";

export const dynamic = "force-dynamic";

const DEFAULT_FREE_LIMIT_MB = 1024; // Neon Free Tier: 1 GB per project

const REGION_LABELS: Record<string, string> = {
  "ap-southeast-1": "AWS Singapore (ap-southeast-1)",
  "ap-southeast-2": "AWS Sydney (ap-southeast-2)",
  "us-east-1": "AWS N. Virginia (us-east-1)",
  "us-east-2": "AWS Ohio (us-east-2)",
  "us-west-2": "AWS Oregon (us-west-2)",
  "eu-central-1": "AWS Frankfurt (eu-central-1)",
  "eu-west-2": "AWS London (eu-west-2)",
  "sa-east-1": "AWS São Paulo (sa-east-1)",
};

function detectProviderAndRegion(): { provider: string; region: string } {
  const url = process.env.DATABASE_URL || "";
  const isNeon = url.includes("neon.tech");
  const provider = isNeon ? "Neon Postgres" : "PostgreSQL";

  let region = "Cloud Hosted";
  const regionMatch = url.match(/\.([a-z]{2}-[a-z]+-\d+)\./i);
  if (regionMatch) {
    const code = regionMatch[1].toLowerCase();
    region = REGION_LABELS[code] || code;
  }

  return { provider, region };
}

function parsePostgresVersion(rawVersion: string): string {
  const match = rawVersion.match(/PostgreSQL\s+[\d.]+/i);
  return match ? match[0] : "PostgreSQL";
}

const TABLE_LABELS: Record<string, string> = {
  expenses: "Expenses & Vouchers",
  deposits: "Bank Deposits",
  print_requests: "Student Print Requests",
  users: "Users & SK Officials",
  categories: "Budget Categories",
  settings: "Portal Settings",
  stored_files: "Fallback Files (DB Cache)",
  attendance_sessions: "SK Attendance Sessions & Activities",
  attendance_records: "SK Official Attendance Records",
};

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }
    if (!isOfficialUser(user)) {
      return NextResponse.json({ error: "Forbidden: SK Officials only" }, { status: 403 });
    }

    await Promise.all([ensureStoredFilesTable(), ensureAttendanceTables()]);

    const startTime = Date.now();

    const [dbInfoRows, tableSizeRows, exactCountRows] = await Promise.all([
      sql`
        SELECT
          current_database() AS db_name,
          version() AS pg_version,
          pg_database_size(current_database())::bigint AS total_bytes
      `,
      sql`
        SELECT
          relname AS table_name,
          pg_total_relation_size(relid)::bigint AS total_bytes,
          pg_relation_size(relid)::bigint AS data_bytes,
          pg_indexes_size(relid)::bigint AS index_bytes,
          n_live_tup::bigint AS est_rows
        FROM pg_stat_user_tables
        ORDER BY pg_total_relation_size(relid) DESC, relname ASC
      `,
      sql`
        SELECT
          (SELECT COUNT(*) FROM expenses)::int AS expenses,
          (SELECT COUNT(*) FROM deposits)::int AS deposits,
          (SELECT COUNT(*) FROM print_requests)::int AS print_requests,
          (SELECT COUNT(*) FROM categories)::int AS categories,
          (SELECT COUNT(*) FROM users)::int AS users,
          (SELECT COUNT(*) FROM settings)::int AS settings,
          (SELECT COUNT(*) FROM stored_files)::int AS stored_files,
          (SELECT COUNT(*) FROM attendance_sessions)::int AS attendance_sessions,
          (SELECT COUNT(*) FROM attendance_records)::int AS attendance_records
      `,
    ]);

    const latencyMs = Math.max(1, Date.now() - startTime);
    const dbInfo = dbInfoRows[0] as {
      db_name: string;
      pg_version: string;
      total_bytes: string | number;
    };

    const exactCounts = (exactCountRows[0] || {}) as Record<string, number>;

    const limitMbEnv = Number(process.env.NEON_STORAGE_LIMIT_MB);
    const limitMb =
      Number.isFinite(limitMbEnv) && limitMbEnv > 0 ? limitMbEnv : DEFAULT_FREE_LIMIT_MB;
    const limitBytes = limitMb * 1024 * 1024;

    const usedBytes = Number(dbInfo?.total_bytes || 0);
    const remainingBytes = Math.max(0, limitBytes - usedBytes);
    const usagePercent = Math.min(100, Number(((usedBytes / limitBytes) * 100).toFixed(2)));

    let statusLevel: "healthy" | "warning" | "critical" = "healthy";
    if (usagePercent >= 90) {
      statusLevel = "critical";
    } else if (usagePercent >= 70) {
      statusLevel = "warning";
    }

    const tables = (
      tableSizeRows as {
        table_name: string;
        total_bytes: string | number;
        data_bytes: string | number;
        index_bytes: string | number;
        est_rows: string | number;
      }[]
    ).map((t) => {
      const name = String(t.table_name);
      const rows =
        typeof exactCounts[name] === "number" ? exactCounts[name] : Number(t.est_rows || 0);
      return {
        name,
        label: TABLE_LABELS[name] || name,
        rows,
        totalBytes: Number(t.total_bytes || 0),
        dataBytes: Number(t.data_bytes || 0),
        indexBytes: Number(t.index_bytes || 0),
      };
    });

    const totalTablesBytes = tables.reduce((sum, t) => sum + t.totalBytes, 0);
    const totalRows = tables.reduce((sum, t) => sum + t.rows, 0);
    const { provider, region } = detectProviderAndRegion();

    return NextResponse.json({
      success: true,
      status: "online",
      statusLevel,
      latencyMs,
      provider,
      region,
      branch: process.env.NEON_BRANCH || "production",
      databaseName: String(dbInfo?.db_name || "neondb"),
      postgresVersion: parsePostgresVersion(String(dbInfo?.pg_version || "")),
      storage: {
        usedBytes,
        limitBytes,
        remainingBytes,
        usagePercent,
        tablesBytes: totalTablesBytes,
        systemBytes: Math.max(0, usedBytes - totalTablesBytes),
      },
      plan: {
        name: "Neon Free Tier",
        storageLimitLabel: `${(limitMb / 1024).toFixed(limitMb % 1024 === 0 ? 0 : 1)} GB`,
        computeAllowanceLabel: "100 CU-hrs / mo",
        egressAllowanceLabel: "5 GB / mo",
      },
      totalRows,
      tables,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Database status check error:", error);
    return NextResponse.json(
      {
        success: false,
        status: "offline",
        statusLevel: "critical",
        error: "Unable to reach the cloud database right now.",
        checkedAt: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
