"use client";

import { useState } from "react";
import {
  RefreshCw,
  ChevronDown,
  XCircle,
  ExternalLink,
  Folder,
} from "lucide-react";
import type { GoogleDriveStatusData, DriveFolderStat } from "@/lib/googleDrive";
import { sanitizeSafeUrl } from "@/lib/clientUrlSafety";

export type { GoogleDriveStatusData, DriveFolderStat };

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

function GoogleDriveIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M8.27 3.5L1.5 15.22h6.77L15.04 3.5H8.27z"
        fill="#4285F4"
      />
      <path
        d="M15.73 3.5L8.96 15.22h13.54L15.73 3.5z"
        fill="#FBBC04"
      />
      <path
        d="M1.5 15.22l3.38 5.86c.38.66.93 1.2 1.59 1.58L13.24 11H6.47L1.5 15.22z"
        fill="#34A853"
      />
      <path
        d="M22.5 15.22l-3.38 5.86c-.38.66-.93 1.2-1.59 1.58H6.47l4.98-8.66h11.05z"
        fill="#0F9D58"
      />
    </svg>
  );
}

interface GoogleDriveStatusCardProps {
  data: GoogleDriveStatusData | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

export default function GoogleDriveStatusCard({
  data,
  loading,
  error,
  onRefresh,
}: GoogleDriveStatusCardProps) {
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
        pill: "bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700",
        dot: "bg-slate-400",
        bar: "bg-slate-300 dark:bg-slate-700",
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
          <GoogleDriveIcon className="w-4 h-4 shrink-0" />
          <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider truncate">
            Google Drive
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
          title="Refresh Google Drive status"
          aria-label="Refresh Google Drive status"
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
          <span>{error || data?.error || "Unable to reach Google Drive storage."}</span>
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
                {usagePct > 0 && usagePct < 0.01 ? "<0.01%" : `${usagePct.toFixed(2)}%`}
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
                ? "Not connected · Primary Storage"
                : `${(data.totalFiles ?? 0).toLocaleString()} ${data.totalFiles === 1 ? "file" : "files"} · Primary Storage`}
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

          {/* Animated Collapsible Details & Folder Breakdown */}
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
                {/* Folder Header & Direct Drive Link */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <Folder className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                    <span className="truncate">{data.rootFolder?.name || "SK Tocok Google Drive"}</span>
                  </div>

                  {data.rootFolder?.webViewLink && (
                    <a
                      href={sanitizeSafeUrl(data.rootFolder.webViewLink)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 hover:underline"
                    >
                      <span>Open in Drive</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                {/* Folder breakdown (Prints, Vouchers, Deposits, Officials) */}
                {data.folders && data.folders.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    {data.folders.map((folder, idx) => (
                      <a
                        key={folder.key}
                        href={sanitizeSafeUrl(folder.webViewLink)}
                        target={folder.webViewLink ? "_blank" : undefined}
                        rel={folder.webViewLink ? "noopener noreferrer" : undefined}
                        style={{
                          transitionDelay: showDetails ? `${idx * 28}ms` : "0ms",
                        }}
                        className={`group p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 transition-all ${
                          folder.webViewLink ? "cursor-pointer" : ""
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 truncate group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                            {folder.label}
                          </span>
                          {folder.webViewLink && (
                            <ExternalLink className="w-2.5 h-2.5 text-slate-400 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors shrink-0" />
                          )}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                          <strong className="font-semibold text-slate-800 dark:text-slate-200">
                            {folder.files.toLocaleString()}
                          </strong>{" "}
                          · {formatBytes(folder.totalBytes)}
                        </div>
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {isNotConfigured
                      ? "Configure GOOGLE_DRIVE_FOLDER_ID or Google Service Account in your environment to monitor drive storage."
                      : "No files found in designated subfolders."}
                  </p>
                )}

                {/* Bottom connection details */}
                <div className="pt-2 border-t border-slate-100/80 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-[10.5px] text-slate-400 dark:text-slate-500">
                  <div className="font-mono truncate">
                    {data.method}
                    {data.serviceAccountEmail && (
                      <span className="opacity-80"> · {data.serviceAccountEmail}</span>
                    )}
                  </div>
                  <span className="shrink-0">
                    Auto-sorted into Prints, Vouchers, Deposits &amp; Officials
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
