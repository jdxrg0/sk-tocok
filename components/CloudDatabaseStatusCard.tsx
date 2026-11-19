"use client";

import { useState } from "react";
import {
  Database,
  RefreshCw,
  ChevronDown,
  XCircle,
} from "lucide-react";

export interface DbTableStat {
  name: string;
  label: string;
  rows: number;
  totalBytes: number;
  dataBytes: number;
  indexBytes: number;
}

export interface DbStatusData {
  success: boolean;
  status: "online" | "offline";
  statusLevel: "healthy" | "warning" | "critical";
  latencyMs?: number;
  provider?: string;
  region?: string;
  branch?: string;
  databaseName?: string;
  postgresVersion?: string;
  storage?: {
    usedBytes: number;
    limitBytes: number;
    remainingBytes: number;
    usagePercent: number;
    tablesBytes: number;
    systemBytes: number;
  };
  plan?: {
    name: string;
    storageLimitLabel: string;
    computeAllowanceLabel: string;
    egressAllowanceLabel: string;
  };
  totalRows?: number;
  tables?: DbTableStat[];
  checkedAt?: string;
  error?: string;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIdx = 0;
  while (value >= 1024 && unitIdx < units.length - 1) {
    value /= 1024;
    unitIdx += 1;
  }
  const decimals = unitIdx === 0 ? 0 : value >= 100 ? 1 : 2;
  return `${value.toFixed(decimals)} ${units[unitIdx]}`;
}

function formatTime(iso?: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

interface CloudDatabaseStatusCardProps {
  data: DbStatusData | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

export default function CloudDatabaseStatusCard({
  data,
  loading,
  error,
  onRefresh,
}: CloudDatabaseStatusCardProps) {
  const [showDetails, setShowDetails] = useState(false);

  const isOnline = data?.status === "online" && !error;
  const level = !isOnline ? "critical" : data?.statusLevel || "healthy";

  const theme =
    !isOnline
      ? {
          label: "Offline",
          pill: "bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/70",
          dot: "bg-rose-500",
          bar: "bg-rose-500",
          track: "bg-slate-100 dark:bg-slate-800",
          accentText: "text-rose-600 dark:text-rose-400",
        }
      : level === "critical"
      ? {
          label: "Almost Full",
          pill: "bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/70",
          dot: "bg-rose-500 animate-pulse",
          bar: "bg-rose-500",
          track: "bg-slate-100 dark:bg-slate-800",
          accentText: "text-rose-600 dark:text-rose-400",
        }
      : level === "warning"
      ? {
          label: "Getting Full",
          pill: "bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/70",
          dot: "bg-amber-500 animate-pulse",
          bar: "bg-amber-500",
          track: "bg-slate-100 dark:bg-slate-800",
          accentText: "text-amber-700 dark:text-amber-400",
        }
      : {
          label: "Healthy",
          pill: "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/70",
          dot: "bg-emerald-500",
          bar: "bg-emerald-500",
          track: "bg-slate-100 dark:bg-slate-800",
          accentText: "text-emerald-700 dark:text-emerald-400",
        };

  const storage = data?.storage;
  const usagePct = storage ? storage.usagePercent : 0;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-xs space-y-3">
      {/* Compact Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Database className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
          <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider truncate">
            Cloud Database
          </h3>
          {data && (
            <span
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10.5px] font-semibold shrink-0 ${theme.pill}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${theme.dot}`} />
              <span>{theme.label}</span>
              {isOnline && data.latencyMs !== undefined && (
                <span className="font-mono opacity-75">· {data.latencyMs}ms</span>
              )}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
          title="Refresh database status"
          aria-label="Refresh database status"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-brand-600 dark:text-brand-400" : ""}`} />
        </button>
      </div>

      {/* Initial Loading Skeleton */}
      {loading && !data && (
        <div className="space-y-2 animate-pulse">
          <div className="h-4 w-40 rounded bg-slate-100 dark:bg-slate-800" />
          <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800" />
        </div>
      )}

      {/* Offline / Error State */}
      {!loading && (error || (data && !isOnline)) && (
        <div className="flex items-center gap-2 text-xs text-rose-700 dark:text-rose-300">
          <XCircle className="w-4 h-4 shrink-0" />
          <span>{error || data?.error || "Unable to reach cloud database."}</span>
        </div>
      )}

      {/* Minimalist Usage Meter */}
      {isOnline && storage && data && (
        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-2 flex-wrap">
            <div className="flex items-baseline gap-1.5">
              <span className="text-base font-bold font-mono text-slate-900 dark:text-slate-100">
                {formatBytes(storage.usedBytes)}
              </span>
              <span className="text-xs text-slate-400 dark:text-slate-500">
                / {data.plan?.storageLimitLabel || formatBytes(storage.limitBytes)}
              </span>
            </div>

            <div className="flex items-center gap-2 text-[11px]">
              <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                {usagePct.toFixed(2)}%
              </span>
              <span className="text-slate-300 dark:text-slate-700">·</span>
              <span className={`font-medium ${theme.accentText}`}>
                {formatBytes(storage.remainingBytes)} free
              </span>
            </div>
          </div>

          {/* Slim Progress Bar */}
          <div className={`w-full h-2 rounded-full overflow-hidden ${theme.track}`}>
            <div
              className={`h-full rounded-full transition-all duration-500 ${theme.bar}`}
              style={{ width: `${Math.max(usagePct > 0 ? 1.5 : 0, Math.min(100, usagePct))}%` }}
            />
          </div>

          {/* Subtle Single-Line Meta + Expandable Details Toggle */}
          <div className="flex items-center justify-between gap-2 pt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
            <span className="truncate">
              {(data.totalRows ?? 0).toLocaleString()} records · {data.provider || "Neon Postgres"}
            </span>

            {data.tables && data.tables.length > 0 && (
              <button
                type="button"
                onClick={() => setShowDetails((prev) => !prev)}
                aria-expanded={showDetails}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 active:scale-95 transition-all cursor-pointer select-none shrink-0"
              >
                <span>{showDetails ? "Hide details" : "Details"}</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-300 ease-out ${showDetails ? "rotate-180" : "rotate-0"}`}
                />
              </button>
            )}
          </div>

          {/* Animated Collapsible Minimal Table Breakdown */}
          {data.tables && data.tables.length > 0 && (
            <div
              className={`!mt-0 grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
                showDetails
                  ? "grid-rows-[1fr] opacity-100"
                  : "grid-rows-[0fr] opacity-0 pointer-events-none"
              }`}
              aria-hidden={!showDetails}
            >
              <div className="overflow-hidden">
                <div
                  className={`pt-2.5 mt-2.5 border-t border-slate-100 dark:border-slate-800 space-y-2 transition-transform duration-300 ease-out ${
                    showDetails ? "translate-y-0" : "-translate-y-1.5"
                  }`}
                >
                  <div className="grid grid-cols-1 gap-y-1.5">
                    {data.tables.map((tbl, idx) => (
                      <div
                        key={tbl.name}
                        style={{
                          transitionDelay: showDetails ? `${idx * 28}ms` : "0ms",
                        }}
                        className={`flex items-center justify-between text-[11px] py-0.5 transition-[opacity,transform] duration-300 ease-out ${
                          showDetails
                            ? "opacity-100 translate-y-0"
                            : "opacity-0 translate-y-1"
                        }`}
                      >
                        <span className="text-slate-600 dark:text-slate-300 truncate pr-2">
                          {tbl.label}
                        </span>
                        <span className="font-mono text-slate-400 dark:text-slate-500 shrink-0">
                          <strong className="font-semibold text-slate-700 dark:text-slate-200">
                            {tbl.rows.toLocaleString()}
                          </strong>{" "}
                          · {formatBytes(tbl.totalBytes)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div
                    style={{
                      transitionDelay: showDetails ? `${data.tables.length * 28}ms` : "0ms",
                    }}
                    className={`pt-1.5 border-t border-slate-100/80 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[10.5px] text-slate-400 dark:text-slate-500 transition-opacity duration-300 ease-out ${
                      showDetails ? "opacity-100" : "opacity-0"
                    }`}
                  >
                    <span className="font-mono">
                      {data.postgresVersion} · {data.region} · {data.plan?.computeAllowanceLabel} · {data.plan?.egressAllowanceLabel}
                    </span>
                    <span>All files (vouchers, slips, avatars &amp; prints) stored on Google Drive</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
