"use client";

import { useState } from "react";
import {
  HardDrive,
  RefreshCw,
  ChevronDown,
  XCircle,
  Trash2,
  Loader2,
  CheckCircle2,
} from "lucide-react";

export interface BlobFolderStat {
  name: string;
  label: string;
  files: number;
  totalBytes: number;
}

export interface BlobStatusData {
  success: boolean;
  configured: boolean;
  status: "online" | "not_configured" | "offline";
  statusLevel: "healthy" | "warning" | "critical";
  latencyMs?: number;
  storage?: {
    usedBytes: number;
    limitBytes: number;
    remainingBytes: number;
    usagePercent: number;
  };
  totalFiles?: number;
  expiredFiles?: number;
  folders?: BlobFolderStat[];
  plan?: {
    name: string;
    storageLimitLabel: string;
    transferAllowanceLabel: string;
    simpleOpsLabel: string;
    advancedOpsLabel: string;
  };
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

interface VercelBlobStatusCardProps {
  data: BlobStatusData | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  cleaningBlobs: boolean;
  cleanupMessage: string | null;
  onManualCleanup: () => void;
}

export default function VercelBlobStatusCard({
  data,
  loading,
  error,
  onRefresh,
  cleaningBlobs,
  cleanupMessage,
  onManualCleanup,
}: VercelBlobStatusCardProps) {
  const [showDetails, setShowDetails] = useState(false);

  const isOffline = Boolean(error) || data?.status === "offline";
  const isNotConfigured = !isOffline && data?.status === "not_configured";
  const isOnline = !isOffline && data?.status === "online";
  const level = isOffline ? "critical" : data?.statusLevel || "healthy";

  const theme = isOffline
    ? {
        label: "Offline",
        pill: "bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/70",
        dot: "bg-rose-500",
        bar: "bg-rose-500",
        track: "bg-slate-100 dark:bg-slate-800",
        accentText: "text-rose-600 dark:text-rose-400",
      }
    : isNotConfigured
    ? {
        label: "Standby",
        pill: "bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700",
        dot: "bg-slate-400",
        bar: "bg-slate-400",
        track: "bg-slate-100 dark:bg-slate-800",
        accentText: "text-slate-500 dark:text-slate-400",
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
          <HardDrive className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
          <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider truncate">
            Vercel Blob
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
          title="Refresh Vercel Blob status"
          aria-label="Refresh Vercel Blob status"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${loading ? "animate-spin text-brand-600 dark:text-brand-400" : ""}`}
          />
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
      {!loading && isOffline && (
        <div className="flex items-center gap-2 text-xs text-rose-700 dark:text-rose-300">
          <XCircle className="w-4 h-4 shrink-0" />
          <span>{error || data?.error || "Unable to reach Vercel Blob storage."}</span>
        </div>
      )}

      {/* Minimalist Usage Meter */}
      {!isOffline && storage && data && (
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
              style={{
                width: `${usagePct > 0 ? Math.max(1.5, Math.min(100, usagePct)) : 0}%`,
              }}
            />
          </div>

          {/* Subtle Single-Line Meta + Expandable Details Toggle */}
          <div className="flex items-center justify-between gap-2 pt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
            <span className="truncate">
              {isNotConfigured
                ? "Auto-failover on Vercel"
                : `${(data.totalFiles ?? 0).toLocaleString()} ${data.totalFiles === 1 ? "file" : "files"} · 90d purge`}
            </span>

            <button
              type="button"
              onClick={() => setShowDetails((prev) => !prev)}
              aria-expanded={showDetails}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 active:scale-95 transition-all cursor-pointer select-none shrink-0"
            >
              <span>{showDetails ? "Hide details" : "Details"}</span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform duration-300 ease-out ${
                  showDetails ? "rotate-180" : "rotate-0"
                }`}
              />
            </button>
          </div>

          {/* Animated Collapsible Details & 90-Day Purge Controls */}
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
                className={`pt-2.5 mt-2.5 border-t border-slate-100 dark:border-slate-800 space-y-2.5 transition-transform duration-300 ease-out ${
                  showDetails ? "translate-y-0" : "-translate-y-1.5"
                }`}
              >
                {/* Folder breakdown (when files exist) */}
                {data.folders && data.folders.length > 0 ? (
                  <div className="grid grid-cols-1 gap-y-1.5">
                    {data.folders.map((folder, idx) => (
                      <div
                        key={folder.name}
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
                          {folder.label}
                        </span>
                        <span className="font-mono text-slate-400 dark:text-slate-500 shrink-0">
                          <strong className="font-semibold text-slate-700 dark:text-slate-200">
                            {folder.files.toLocaleString()}
                          </strong>{" "}
                          · {formatBytes(folder.totalBytes)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {isNotConfigured
                      ? "Set BLOB_READ_WRITE_TOKEN in Vercel Storage to enable backup failover when Google Drive is unreachable."
                      : "No files currently stored in Vercel Blob. Student print uploads are going directly to Google Drive."}
                  </p>
                )}

                {/* 90-Day Auto-Purge Row */}
                <div className="pt-2 border-t border-slate-100/80 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="text-[10.5px] text-slate-400 dark:text-slate-500 font-mono">
                    {data.plan?.transferAllowanceLabel} transfer · {data.plan?.advancedOpsLabel} · {data.plan?.simpleOpsLabel}
                    {isOnline && typeof data.expiredFiles === "number" && (
                      <span> · {data.expiredFiles} expired (&gt;90d)</span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={onManualCleanup}
                    disabled={cleaningBlobs}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/70 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold text-[11px] transition-all cursor-pointer active:scale-95 inline-flex items-center gap-1.5 shrink-0 self-start sm:self-auto disabled:opacity-50"
                  >
                    {cleaningBlobs ? (
                      <Loader2 className="w-3 h-3 animate-spin text-brand-600 dark:text-brand-400" />
                    ) : (
                      <Trash2 className="w-3 h-3 text-slate-400" />
                    )}
                    <span>{cleaningBlobs ? "Purging..." : "Purge >90d Files"}</span>
                  </button>
                </div>

                {cleanupMessage && (
                  <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>{cleanupMessage}</span>
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
