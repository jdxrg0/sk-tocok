"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "next/navigation";
import PrintStatusBadge from "@/components/PrintStatusBadge";
import SearchModal from "@/components/SearchModal";
import PushNotificationManager from "@/components/PushNotificationManager";
import { useAuth } from "@/components/AuthProvider";
import { 
  Printer, 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  Copy, 
  Check, 
  ArrowRight, 
  School, 
  Search,
  MapPin,
  ShieldAlert,
  Clock,
  RotateCw,
  FileCheck,
  FileText,
  Info,
  X,
  Lock,
  Mail,
  User,
  Trash2,
  XCircle,
  Loader2,
  ChevronLeft,
  ChevronRight
} from "lucide-react";

interface PrintJobDetails {
  id?: number;
  tracking_code: string;
  student_name?: string | null;
  school?: string | null;
  grade_level?: string | null;
  purok?: string | null;
  file_name?: string | null;
  print_type?: string | null;
  paper_size?: string | null;
  copies?: number | null;
  page_range?: string | null;
  notes?: string | null;
  pickup_station?: string | null;
  is_urgent?: number | boolean | null;
  status: string;
  admin_notes?: string | null;
  picked_up_at?: string | null;
  created_at: string;
  updated_at?: string | null;
  is_owner?: boolean;
}

const PUROK_OPTIONS = [
  "Purok 1 (Sitio Bio, Sitio Sagur, Sitio Baybay)",
  "Purok 2 (Centro)",
  "Purok 3 (Sitio Boquig)",
  "Purok 4 (Sitio Buatan)",
  "Purok 5 (Sitio Sapdaan)",
  "Purok 6 (Sitio Cabanlig, Sitio Biek)",
  "Purok 7 (Sitio Torres)",
];

const CLAIMING_STATIONS = [
  {
    id: "purok5",
    label: "Purok 5 Station — Sitio Sapdaan (SK Treasurer)",
    puroks: "Best for: Purok 5 (Sitio Sapdaan) and neighboring puroks",
  },
  {
    id: "purok1",
    label: "Purok 1 Station — Sitio Bio, Sitio Sagur, Sitio Baybay (SK Chairperson)",
    puroks: "Best for: Purok 1 (Sitio Bio, Sitio Sagur, Sitio Baybay)",
  },
];

const SCHOOL_OPTIONS = [
  "SFNHS",
  "MNHS",
  "DMMMSU",
  "PCLU",
  "UDD",
  "UPANG",
  "UL",
  "OTHERS",
];

const GRADE_LEVEL_OPTIONS = [
  "Junior Highschool",
  "Senior Highschool",
  "College",
];

const DRAFT_STORAGE_KEY = "sk_tocok_print_form_draft";

const DEFAULT_FORM_DATA = {
  student_name: "",
  contact_number: "",
  facebook_name: "",
  purok: "",
  school: "",
  custom_school: "",
  grade_level: "",
  print_type: "",
  paper_size: "",
  copies: 1,
  page_range: "All pages",
  notes: "",
  pickup_station: "",
  is_urgent: false,
};

function HoldToConfirmButton({
  onConfirm,
  loading = false,
  durationMs = 1500,
  label = "Tap & Hold to Cancel",
  holdingLabel = "Keep holding...",
  loadingLabel = "Cancelling...",
  className = "",
}: {
  onConfirm: () => void;
  loading?: boolean;
  durationMs?: number;
  label?: string;
  holdingLabel?: string;
  loadingLabel?: string;
  className?: string;
}) {
  const [progress, setProgress] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const startTimeRef = useRef<number | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const confirmedRef = useRef(false);

  const cancelHold = useCallback(() => {
    if (confirmedRef.current) return;
    setIsHolding(false);
    startTimeRef.current = null;
    startPosRef.current = null;
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    setProgress(0);
  }, []);

  const startHold = useCallback(() => {
    if (loading || confirmedRef.current) return;
    if (typeof window !== "undefined") {
      try {
        window.getSelection()?.removeAllRanges();
      } catch {}
    }
    setIsHolding(true);
    confirmedRef.current = false;
    startTimeRef.current = performance.now();

    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      try {
        navigator.vibrate(25);
      } catch {}
    }

    const updateProgress = (now: number) => {
      if (!startTimeRef.current) return;
      const elapsed = now - startTimeRef.current;
      const pct = Math.min(100, (elapsed / durationMs) * 100);
      setProgress(pct);

      if (pct >= 100) {
        confirmedRef.current = true;
        setIsHolding(false);
        startTimeRef.current = null;
        startPosRef.current = null;
        if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
          try {
            navigator.vibrate([40, 50, 40]);
          } catch {}
        }
        onConfirm();
      } else {
        animFrameRef.current = requestAnimationFrame(updateProgress);
      }
    };

    animFrameRef.current = requestAnimationFrame(updateProgress);
  }, [durationMs, loading, onConfirm]);

  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  useEffect(() => {
    if (!loading) {
      confirmedRef.current = false;
      setProgress(0);
      setIsHolding(false);
    }
  }, [loading]);

  // Prevent context menu and select start directly on the button element
  useEffect(() => {
    const btn = buttonRef.current;
    if (!btn) return;

    const preventDefault = (e: Event) => {
      e.preventDefault();
    };

    btn.addEventListener("contextmenu", preventDefault);
    btn.addEventListener("selectstart", preventDefault);

    return () => {
      btn.removeEventListener("contextmenu", preventDefault);
      btn.removeEventListener("selectstart", preventDefault);
    };
  }, []);

  // While actively holding, suppress any global document selection attempt and clear ranges immediately
  useEffect(() => {
    if (!isHolding) return;

    const preventSelection = (e: Event) => {
      e.preventDefault();
    };

    const clearSelection = () => {
      try {
        window.getSelection()?.removeAllRanges();
      } catch {}
    };

    document.addEventListener("selectstart", preventSelection);
    document.addEventListener("selectionchange", clearSelection);

    return () => {
      document.removeEventListener("selectstart", preventSelection);
      document.removeEventListener("selectionchange", clearSelection);
    };
  }, [isHolding]);

  return (
    <button
      ref={buttonRef}
      type="button"
      onPointerDown={(e) => {
        if (loading || confirmedRef.current) return;
        if (e.button !== 0 && e.pointerType === "mouse") return;
        if (typeof window !== "undefined") {
          try {
            window.getSelection()?.removeAllRanges();
          } catch {}
        }
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {}
        startPosRef.current = { x: e.clientX, y: e.clientY };
        startHold();
      }}
      onPointerMove={(e) => {
        if (!isHolding || !startPosRef.current) return;
        // Allow slight finger jitter (up to 35px), but cancel if dragged away
        const dx = e.clientX - startPosRef.current.x;
        const dy = e.clientY - startPosRef.current.y;
        if (Math.hypot(dx, dy) > 35) {
          cancelHold();
        }
      }}
      onPointerUp={(e) => {
        try {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
          }
        } catch {}
        startPosRef.current = null;
        cancelHold();
      }}
      onPointerCancel={(e) => {
        try {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
          }
        } catch {}
        startPosRef.current = null;
        cancelHold();
      }}
      disabled={loading}
      draggable={false}
      style={{
        touchAction: "none",
        WebkitTouchCallout: "none",
        WebkitUserSelect: "none",
        userSelect: "none",
        WebkitTapHighlightColor: "transparent",
      }}
      className={`relative overflow-hidden select-none active:scale-[0.98] transition-all cursor-pointer select-none-callout ${className}`}
    >
      {/* Background base track */}
      <div className="absolute inset-0 bg-rose-600 hover:bg-rose-700 transition-colors pointer-events-none select-none select-none-callout" />

      {/* Progress fill bar (darker rose filling up smoothly from left to right) */}
      <div
        className="absolute inset-0 bg-rose-800 pointer-events-none select-none select-none-callout"
        style={{
          width: `${progress}%`,
          transition: isHolding ? "none" : "width 250ms ease-out",
        }}
      />

      {/* Subtle shimmer highlight when actively holding */}
      {isHolding && (
        <div
          className="absolute inset-y-0 w-24 bg-gradient-to-r from-transparent via-white/25 to-transparent pointer-events-none select-none select-none-callout"
          style={{ left: `calc(${progress}% - 48px)` }}
        />
      )}

      {/* Button Content */}
      <span
        style={{ WebkitTouchCallout: "none", WebkitUserSelect: "none", userSelect: "none" }}
        className="relative z-10 flex items-center justify-center gap-2 py-0.5 pointer-events-none select-none select-none-callout"
      >
        {loading ? (
          <>
            <RotateCw className="w-4 h-4 animate-spin shrink-0" />
            <span>{loadingLabel}</span>
          </>
        ) : isHolding ? (
          <>
            <Trash2 className="w-4 h-4 animate-pulse shrink-0" />
            <span className="font-extrabold">{holdingLabel} {Math.round(progress)}%</span>
          </>
        ) : (
          <>
            <Trash2 className="w-4 h-4 shrink-0" />
            <span>{label}</span>
          </>
        )}
      </span>
    </button>
  );
}

function JobDetailsView({
  job,
  onRefresh,
  getStepStatus,
  isOwner = false,
  onClose,
  onCancel,
  cancelling = false,
}: {
  job: PrintJobDetails;
  onRefresh: () => void;
  getStepStatus: (currentStatus: string, stepName: string) => string;
  isOwner?: boolean;
  onClose?: () => void;
  onCancel?: (job: PrintJobDetails) => void;
  cancelling?: boolean;
}) {
  const isMyTicket = isOwner || job.is_owner === true;
  const isPending = job.status === "Pending Review";
  const isCancelled = job.status === "Cancelled";
  const isDeclined = job.status === "Declined";
  const isReady = job.status === "Ready for Pickup";

  const specs = [
    job.copies ? `${job.copies} ${job.copies > 1 ? "copies" : "copy"}` : (job.paper_size || job.print_type ? "1 copy" : null),
    job.paper_size,
    job.print_type,
    job.page_range ? `(${job.page_range})` : null,
  ]
    .filter(Boolean)
    .join(" • ");

  const steps = [
    { name: "Pending Review", label: "Received" },
    { name: "Printing In Progress", label: "Printing" },
    { name: "Ready for Pickup", label: "Ready" },
    { name: "Completed", label: "Claimed" },
  ];

  return (
    <div id="claim-ticket-details" className="bg-white dark:bg-slate-900 flex flex-col font-sans flex-1 min-h-0 h-full max-h-full overflow-hidden">
      {/* Header: Clean white, prominent ticket code & status (Pinned shrink-0) */}
      <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-3 shrink-0 bg-white dark:bg-slate-900">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 id="claim-ticket-title" className="font-mono text-lg sm:text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
              {job.tracking_code.startsWith("PRN") ? job.tracking_code : `Ticket #${job.tracking_code}`}
            </h3>
            <PrintStatusBadge status={job.status} size="sm" />
            {Number(job.is_urgent) === 1 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/70">
                Urgent
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            Submitted {new Date(job.created_at).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onRefresh}
            title="Refresh status"
            className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <RotateCw className="w-4 h-4" />
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              title="Close"
              className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Middle Content: Scrollable Details (flex-1 min-h-0 overflow-y-auto) */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4 overscroll-contain">
        {/* Stepper Progress Bar */}
        {!isCancelled && !isDeclined ? (
          <div className="space-y-2 py-1">
            <div className="flex items-center gap-1.5">
              {steps.map((s) => {
                const state = getStepStatus(job.status, s.name);
                const isStepActive = state === "completed" || job.status === s.name;
                return (
                  <div
                    key={s.name}
                    className={`h-1.5 flex-1 rounded-full transition-all ${
                      isStepActive ? "bg-brand-600" : "bg-slate-100 dark:bg-slate-800"
                    }`}
                  />
                );
              })}
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 font-medium px-0.5">
              {steps.map((s) => (
                <span
                  key={s.name}
                  className={job.status === s.name ? "text-brand-700 dark:text-brand-400 font-bold" : ""}
                >
                  {s.label}
                </span>
              ))}
            </div>
          </div>
        ) : isCancelled ? (
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs flex items-center gap-2">
            <XCircle className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
            <span>This print request was cancelled.</span>
          </div>
        ) : (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/70 text-rose-800 dark:text-rose-300 text-xs space-y-1">
            <p className="font-bold flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" /> Request Declined
            </p>
            {job.admin_notes && <p className="text-rose-700 dark:text-rose-300">{job.admin_notes}</p>}
          </div>
        )}

        {/* Web Push Prompt if ticket is still in progress */}
        {!isCancelled && !isDeclined && !isReady && job.status !== "Completed" && (
          <PushNotificationManager variant="banner" />
        )}

        {/* Pickup Notice if Ready */}
        {isReady && (
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/70 text-emerald-900 dark:text-emerald-200 text-xs flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5 leading-snug">
              <p className="font-bold">Ready for Pickup!</p>
              <p className="text-emerald-800 dark:text-emerald-300">
                Claim at <strong>{job.pickup_station || "SK Printing Station"}</strong> with your Student ID.
              </p>
              {job.admin_notes && (
                <p className="text-slate-600 dark:text-slate-400 pt-1 text-[11px]">Note: {job.admin_notes}</p>
              )}
            </div>
          </div>
        )}

        {/* Clean Key-Value Details */}
        <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/60 p-3.5 text-xs divide-y divide-slate-200/60 dark:divide-slate-800/80">
          <div className="pb-2.5 grid grid-cols-[90px_1fr] sm:grid-cols-[105px_1fr] gap-3 items-start">
            <span className="text-slate-400 dark:text-slate-500 shrink-0">Document</span>
            {job.file_name ? (
              <span className="font-bold text-slate-900 dark:text-slate-100 text-left truncate" title={job.file_name}>
                {job.file_name}
              </span>
            ) : (
              <span className="text-left text-slate-500 dark:text-slate-400 font-normal">
                Document name hidden
              </span>
            )}
          </div>
          {specs ? (
            <div className="py-2.5 grid grid-cols-[90px_1fr] sm:grid-cols-[105px_1fr] gap-3 items-start">
              <span className="text-slate-400 dark:text-slate-500 shrink-0">Specifications</span>
              <span className="text-slate-700 dark:text-slate-300 text-left font-medium">
                {specs}
              </span>
            </div>
          ) : null}
          <div className="py-2.5 grid grid-cols-[90px_1fr] sm:grid-cols-[105px_1fr] gap-3 items-start">
            <span className="text-slate-400 dark:text-slate-500 shrink-0">Student</span>
            {isMyTicket && job.student_name ? (
              <div className="text-left text-slate-700 dark:text-slate-300 font-medium space-y-0.5">
                <p className="font-bold text-slate-900 dark:text-slate-100">{job.student_name}</p>
                {(job.school || job.grade_level) && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {[job.school, job.grade_level].filter(Boolean).join(" • ")}
                  </p>
                )}
                {job.purok && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">{job.purok}, Brgy. Tocok</p>
                )}
              </div>
            ) : (
              <span className="text-left text-slate-500 dark:text-slate-400 font-normal">
                Student details hidden
              </span>
            )}
          </div>
          <div className="pt-2.5 grid grid-cols-[90px_1fr] sm:grid-cols-[105px_1fr] gap-3 items-start">
            <span className="text-slate-400 dark:text-slate-500 shrink-0">Station</span>
            <span className="text-slate-800 dark:text-slate-200 font-semibold text-left">
              {job.pickup_station || "SK Printing Station"}
            </span>
          </div>
        </div>
      </div>

      {/* Footer: Simple actions (Pinned shrink-0) */}
      <div className="p-3 sm:p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-2.5 shrink-0">
        {isMyTicket && isPending && onCancel ? (
          <button
            type="button"
            onClick={() => onCancel(job)}
            disabled={cancelling}
            className="px-3.5 py-2 rounded-xl border border-rose-200 dark:border-rose-800/70 bg-white dark:bg-slate-900 hover:bg-rose-50 dark:hover:bg-rose-950/60 text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 text-xs font-bold transition cursor-pointer shadow-2xs"
          >
            Cancel Request
          </button>
        ) : <div />}

        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 font-bold text-xs sm:text-sm transition cursor-pointer shadow-xs"
        >
          Close
        </button>
      </div>
    </div>
  );
}

// Module-level cache for instant printing tab transitions (Stale-While-Revalidate)
let cachedPrintingActive = true;
let cachedMyJobs: PrintJobDetails[] = [];
let cachedMyJobsLoaded = false;

function UnifiedPrintingContent() {
  const searchParams = useSearchParams();
  const initialTabParam = searchParams?.get("tab");
  const initialCodeParam = searchParams?.get("code") || "";

  // Determine starting tab
  const [activeTab, setActiveTab] = useState<"submit" | "track">(
    initialTabParam === "track" || initialCodeParam ? "track" : "submit"
  );

  // Form State (Submit)
  const [formData, setFormData] = useState(DEFAULT_FORM_DATA);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatusText, setUploadStatusText] = useState("Uploading document to server...");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedCode, setSubmittedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isActive, setIsActive] = useState(cachedPrintingActive);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Student Auth State (synced with global Header AccountMenu)
  const {
    user: currentUser,
    authLoading: authChecking,
    setUser: setCurrentUser,
  } = useAuth();
  const [authMode, setAuthMode] = useState<"signin" | "register">("signin");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authConfirmPassword, setAuthConfirmPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Google OAuth State
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [googleConfig, setGoogleConfig] = useState<{
    loaded: boolean;
    configured: boolean;
    clientId: string | null;
    mode: "redirect" | "gis" | "unconfigured";
  }>({
    loaded: false,
    configured: false,
    clientId: null,
    mode: "unconfigured",
  });

  // Student's own past requests for convenient tracking
  const [myJobs, setMyJobs] = useState<PrintJobDetails[]>(cachedMyJobs);
  const [myJobsLoading, setMyJobsLoading] = useState(false);
  const [myJobsPage, setMyJobsPage] = useState(1);
  const myJobsListRef = useRef<HTMLDivElement | null>(null);
  const JOBS_PER_PAGE = 2;

  const totalJobsPages = Math.max(1, Math.ceil(myJobs.length / JOBS_PER_PAGE));
  const currentJobsPage = Math.min(Math.max(1, myJobsPage), totalJobsPages);
  const startJobIndex = (currentJobsPage - 1) * JOBS_PER_PAGE;
  const visibleJobs = myJobs.slice(startJobIndex, startJobIndex + JOBS_PER_PAGE);

  useEffect(() => {
    if (myJobsListRef.current) {
      myJobsListRef.current.scrollTop = 0;
    }
  }, [currentJobsPage]);

  // Background scroll lock state tracking
  const scrollPosRef = useRef<number | null>(null);

  // Restore saved form draft on mount
  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === "object") {
          let schoolVal = parsed.school || "";
          let customSchoolVal = parsed.custom_school || "";
          if (parsed.school === "Others" || (parsed.school && !SCHOOL_OPTIONS.includes(parsed.school))) {
            schoolVal = "OTHERS";
            customSchoolVal = parsed.school === "Others" ? "" : parsed.school;
          }
          let gradeVal = parsed.grade_level || "";
          if (parsed.grade_level && !GRADE_LEVEL_OPTIONS.includes(parsed.grade_level)) {
            gradeVal = "";
          }
          let purokVal = parsed.purok || "";
          if (parsed.purok && !PUROK_OPTIONS.includes(parsed.purok)) {
            purokVal = "";
          }
          const printTypeVal = parsed.print_type || "";
          const paperSizeVal = parsed.paper_size || "";
          const pickupStationVal = parsed.pickup_station || "";

          setFormData((prev) => ({
            ...prev,
            ...parsed,
            school: schoolVal,
            custom_school: customSchoolVal,
            grade_level: gradeVal,
            purok: purokVal,
            print_type: printTypeVal,
            paper_size: paperSizeVal,
            pickup_station: pickupStationVal,
          }));
        }
      }
    } catch (e) {
      console.error("Failed to restore print form draft:", e);
    }
  }, []);

  // Auto-save form draft so sudden page refresh won't lose typed data
  useEffect(() => {
    if (!mounted || submittedCode) return;
    try {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(formData));
    } catch (e) {}
  }, [formData, mounted, submittedCode]);

  // Tracker State (Track)
  const [trackingCode, setTrackingCode] = useState(initialCodeParam);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [job, setJob] = useState<PrintJobDetails | null>(null);
  const [trackError, setTrackError] = useState<string | null>(null);
  const [showManualSearch, setShowManualSearch] = useState(false);

  // Cancellation State
  const [jobToCancel, setJobToCancel] = useState<PrintJobDetails | null>(null);
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Fetch settings on mount
  useEffect(() => {
    fetch("/api/admin/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.settings) {
          const active = data.settings.printing_active === "true";
          setIsActive(active);
          cachedPrintingActive = active;
        }
      })
      .catch(() => {});
  }, []);

  // Handle initial code query lookup
  useEffect(() => {
    if (initialCodeParam) {
      setTrackingCode(initialCodeParam);
      setActiveTab("track");
      handleLookup(initialCodeParam);
    }
  }, [initialCodeParam]);

  // Any active modal open state
  const isAnyModalOpen = Boolean(
    showInfoModal || showManualSearch || jobToCancel || job || submitting
  );

  // Close modals on Escape key and lock background body scroll across all mobile & desktop browsers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Disallow closing or cycling keys when an upload is in progress
      if (submitting) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (e.key === "Escape") {
        setShowInfoModal(false);
        setShowManualSearch(false);
        if (!cancelSubmitting) setJobToCancel(null);
        if (job) {
          setJob(null);
          setTrackingCode("");
          setTrackError(null);
        }
      }
    };

    const preventBackgroundTouch = (e: TouchEvent) => {
      const target = e.target as HTMLElement | null;
      // Allow touch scrolling ONLY inside scrollable modal dialog containers
      if (target?.closest(".overflow-y-auto, .overflow-y-scroll")) {
        return;
      }
      if (e.cancelable) {
        e.preventDefault();
      }
    };

    if (isAnyModalOpen) {
      if (scrollPosRef.current === null) {
        const scrollY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;
        scrollPosRef.current = scrollY;
        const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;

        document.documentElement.style.overflow = "hidden";
        document.documentElement.style.overscrollBehavior = "none";
        document.body.style.overflow = "hidden";
        document.body.style.overscrollBehavior = "none";
        if (scrollBarWidth > 0) {
          document.body.style.paddingRight = `${scrollBarWidth}px`;
        }
      }
      window.addEventListener("keydown", handleKeyDown);
      window.addEventListener("touchmove", preventBackgroundTouch, { passive: false });
    } else {
      if (scrollPosRef.current !== null) {
        scrollPosRef.current = null;

        document.documentElement.style.overflow = "";
        document.documentElement.style.overscrollBehavior = "";
        document.body.style.overflow = "";
        document.body.style.overscrollBehavior = "";
        document.body.style.paddingRight = "";
      }
    }

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("touchmove", preventBackgroundTouch);
    };
  }, [isAnyModalOpen, submitting, cancelSubmitting, job]);

  // Clean up body scroll lock if component unmounts while a modal is open
  useEffect(() => {
    return () => {
      if (scrollPosRef.current !== null) {
        scrollPosRef.current = null;
        document.documentElement.style.overflow = "";
        document.documentElement.style.overscrollBehavior = "";
        document.body.style.overflow = "";
        document.body.style.overscrollBehavior = "";
        document.body.style.paddingRight = "";
      }
    };
  }, []);

  // Prevent accidental tab closure or navigation while upload/submission is active
  useEffect(() => {
    if (!submitting) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [submitting]);

  // Automatically scroll to success card when a request is successfully submitted
  useEffect(() => {
    if (!submittedCode) return;

    const alignSuccessView = () => {
      const el = document.getElementById("submission-success-view");
      if (el) {
        // Mobile collapsed header is 58px. 58px + 12px breathing room = 70px.
        // Desktop collapsed header is 64px. 64px + 16px breathing room = 80px.
        const headerOffset = window.innerWidth >= 768 ? 80 : 70;
        const rect = el.getBoundingClientRect();
        const absoluteElementTop = rect.top + window.scrollY;
        const targetScrollY = Math.max(0, absoluteElementTop - headerOffset);

        window.scrollTo({
          top: targetScrollY,
          behavior: "instant",
        });
        window.dispatchEvent(new Event("scroll"));
      } else {
        window.scrollTo({ top: 0, behavior: "instant" });
        window.dispatchEvent(new Event("scroll"));
      }
    };

    // Trigger immediately and across frames to ensure alignment after overlay unmounts
    alignSuccessView();
    const rafId = requestAnimationFrame(alignSuccessView);
    const t1 = setTimeout(alignSuccessView, 60);
    const t2 = setTimeout(alignSuccessView, 150);
    const t3 = setTimeout(alignSuccessView, 350);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [submittedCode]);

  const loadMyRequests = async (autoSelect = false) => {
    try {
      if (!cachedMyJobsLoaded) {
        setMyJobsLoading(true);
      }
      const res = await fetch("/api/printing/my-requests");
      if (res.ok) {
        const data = await res.json();
        const list: PrintJobDetails[] = data.jobs || [];
        setMyJobs(list);
        cachedMyJobs = list;
        cachedMyJobsLoaded = true;
        if (list.length > 0) {
          setJob((prev) => {
            if (prev) {
              const matched = list.find((item) => item.tracking_code === prev.tracking_code);
              if (matched) return matched;
            }
            if (autoSelect) {
              setTrackingCode(list[0].tracking_code);
              return list[0];
            }
            return null;
          });
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setMyJobsLoading(false);
    }
  };

  // Sync student form & request history whenever global auth state changes
  useEffect(() => {
    if (authChecking) return;
    if (currentUser) {
      setFormData((prev) => ({
        ...prev,
        student_name: prev.student_name ? prev.student_name : (currentUser.name || ""),
      }));
      loadMyRequests(false);
    } else {
      setMyJobs([]);
      cachedMyJobs = [];
      cachedMyJobsLoaded = false;
      setJob(null);
    }
  }, [currentUser?.id, authChecking]);

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (!authEmail.trim() || !authPassword) {
      setAuthError("Please provide both your email and password.");
      return;
    }
    try {
      setAuthSubmitting(true);
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: authEmail.trim(), password: authPassword }),
      });
      const text = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch {
        data = { error: text || "Login failed" };
      }
      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }
      setCurrentUser(data.user);
      setFormData((prev) => ({
        ...prev,
        student_name: prev.student_name ? prev.student_name : (data.user.name || ""),
      }));
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : "Failed to sign in");
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleEmailRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (!authName.trim()) {
      setAuthError("Please enter your full student name.");
      return;
    }
    if (!authEmail.trim()) {
      setAuthError("Please enter your email address.");
      return;
    }
    if (authPassword.length < 6) {
      setAuthError("Password must be at least 6 characters long.");
      return;
    }
    if (authPassword !== authConfirmPassword) {
      setAuthError("Passwords do not match.");
      return;
    }
    try {
      setAuthSubmitting(true);
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: authName.trim(),
          email: authEmail.trim(),
          password: authPassword,
        }),
      });
      const text = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch {
        data = { error: text || "Registration failed" };
      }
      if (!res.ok) {
        throw new Error(data.error || "Registration failed");
      }
      setCurrentUser(data.user);
      setFormData((prev) => ({
        ...prev,
        student_name: data.user.name || prev.student_name,
      }));
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : "Failed to create account");
    } finally {
      setAuthSubmitting(false);
    }
  };

  // Surface Google OAuth redirect errors from callback query string and clean up URL
  useEffect(() => {
    const authErrorParam = searchParams?.get("auth_error");
    if (authErrorParam) {
      setAuthError(authErrorParam);
      if (typeof window !== "undefined") {
        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.delete("auth_error");
        window.history.replaceState({}, "", cleanUrl.pathname + cleanUrl.search + cleanUrl.hash);
      }
    }
  }, [searchParams]);

  // Preload Google OAuth configuration (and GIS script if client-only mode) while logged out
  useEffect(() => {
    if (currentUser) return;
    let active = true;
    fetch("/api/auth/google")
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        const mode: "redirect" | "gis" | "unconfigured" =
          data.mode === "redirect" || data.mode === "gis" ? data.mode : "unconfigured";
        setGoogleConfig({
          loaded: true,
          configured: Boolean(data.configured),
          clientId: data.clientId || null,
          mode,
        });
        if (mode === "gis" && data.clientId && typeof document !== "undefined") {
          if (!document.getElementById("google-gsi-client")) {
            const script = document.createElement("script");
            script.id = "google-gsi-client";
            script.src = "https://accounts.google.com/gsi/client";
            script.async = true;
            script.defer = true;
            document.head.appendChild(script);
          }
        }
      })
      .catch(() => {
        if (active) {
          setGoogleConfig((prev) => ({ ...prev, loaded: true }));
        }
      });
    return () => {
      active = false;
    };
  }, [currentUser]);

  const loadGoogleGisScript = () =>
    new Promise<void>((resolve, reject) => {
      type GoogleGisWindow = Window & {
        google?: { accounts?: { oauth2?: unknown } };
      };
      const win = window as GoogleGisWindow;
      if (win.google?.accounts?.oauth2) {
        resolve();
        return;
      }
      const existing = document.getElementById("google-gsi-client") as HTMLScriptElement | null;
      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener(
          "error",
          () => reject(new Error("Failed to load Google Sign-In script.")),
          { once: true }
        );
        return;
      }
      const script = document.createElement("script");
      script.id = "google-gsi-client";
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load Google Sign-In script."));
      document.head.appendChild(script);
    });

  const handleContinueWithGoogle = async () => {
    setAuthError(null);

    let cfg = googleConfig;
    if (!cfg.loaded) {
      try {
        setGoogleSubmitting(true);
        const res = await fetch("/api/auth/google");
        const data = await res.json();
        const mode: "redirect" | "gis" | "unconfigured" =
          data.mode === "redirect" || data.mode === "gis" ? data.mode : "unconfigured";
        cfg = {
          loaded: true,
          configured: Boolean(data.configured),
          clientId: data.clientId || null,
          mode,
        };
        setGoogleConfig(cfg);
      } catch {
        setGoogleSubmitting(false);
        setAuthError("Unable to reach authentication server. Please try again.");
        return;
      }
    }

    if (cfg.mode === "redirect") {
      setGoogleSubmitting(true);
      const returnTo =
        typeof window !== "undefined"
          ? `${window.location.pathname}${window.location.search}`
          : "/printing";
      window.location.href = `/api/auth/google/start?returnTo=${encodeURIComponent(returnTo)}`;
      return;
    }

    if (cfg.mode === "gis" && cfg.clientId) {
      try {
        setGoogleSubmitting(true);
        await loadGoogleGisScript();

        type GoogleTokenResponse = {
          access_token?: string;
          error?: string;
          error_description?: string;
        };
        type GoogleOAuth2Client = {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            prompt?: string;
            callback: (response: GoogleTokenResponse) => void;
            error_callback?: (err: { type?: string; message?: string }) => void;
          }) => { requestAccessToken: () => void };
        };
        const oauth2 = (
          window as Window & { google?: { accounts?: { oauth2?: GoogleOAuth2Client } } }
        ).google?.accounts?.oauth2;

        if (!oauth2) {
          throw new Error("Google Sign-In could not initialize in this browser.");
        }

        const tokenClient = oauth2.initTokenClient({
          client_id: cfg.clientId,
          scope: "openid email profile",
          prompt: "select_account",
          callback: async (tokenResponse) => {
            if (tokenResponse.error || !tokenResponse.access_token) {
              setGoogleSubmitting(false);
              if (tokenResponse.error !== "access_denied") {
                setAuthError(
                  tokenResponse.error_description || "Google sign-in was not completed."
                );
              }
              return;
            }
            try {
              const res = await fetch("/api/auth/google", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ accessToken: tokenResponse.access_token }),
              });
              const data = await res.json();
              if (!res.ok) {
                throw new Error(data.error || "Google sign-in failed");
              }
              setCurrentUser(data.user);
              setFormData((prev) => ({
                ...prev,
                student_name: data.user.name || prev.student_name,
              }));
            } catch (err: unknown) {
              setAuthError(err instanceof Error ? err.message : "Google sign-in failed");
            } finally {
              setGoogleSubmitting(false);
            }
          },
          error_callback: (err) => {
            setGoogleSubmitting(false);
            if (err?.type === "popup_closed") return;
            setAuthError(
              err?.type === "popup_failed_to_open"
                ? "Popup was blocked by your browser. Please allow popups and try again."
                : "Google sign-in failed. Please try again."
            );
          },
        });

        tokenClient.requestAccessToken();
      } catch (err: unknown) {
        setGoogleSubmitting(false);
        setAuthError(
          err instanceof Error ? err.message : "Unable to start Google sign-in."
        );
      }
      return;
    }

    setGoogleSubmitting(false);
    setAuthError(
      "Google Sign-In is not configured yet. Please add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your environment settings, or sign in with email below."
    );
  };

  const switchTab = (tab: "submit" | "track") => {
    if (activeTab === tab) return;

    const collapseDist =
      typeof window !== "undefined"
        ? window.innerWidth >= 768
          ? 196
          : 178
        : 178;

    const isCollapsed =
      typeof window !== "undefined" &&
      (sessionStorage.getItem("sk_header_collapsed") === "1" ||
        window.scrollY >= collapseDist * 0.51);

    setActiveTab(tab);

    // Update URL query smoothly without reload - keep URL clean without saving ticket
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    url.searchParams.delete("code");
    window.history.replaceState({}, "", url.toString());

    // Coordinate position and folding header state seamlessly across tabs
    if (typeof window !== "undefined") {
      const targetY = isCollapsed ? collapseDist : 0;
      try {
        sessionStorage.setItem("sk_header_collapsed", isCollapsed ? "1" : "0");
      } catch {}

      const applyScrollState = () => {
        window.scrollTo({ top: targetY, behavior: "instant" });
        window.dispatchEvent(new Event("scroll"));
      };

      applyScrollState();
      requestAnimationFrame(applyScrollState);
      setTimeout(applyScrollState, 50);
      setTimeout(applyScrollState, 150);
    }

    if (tab === "track") {
      setJob(null);
      setTrackingCode("");
      setTrackError(null);
      if (currentUser) {
        loadMyRequests(false);
      }
    }
  };

  // ----------------------------------------------------
  // SUBMIT HANDLERS
  // ----------------------------------------------------
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 100 * 1024 * 1024) {
        setSubmitError("File size exceeds 100MB limit.");
        return;
      }
      setSelectedFile(file);
      setSubmitError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!currentUser) {
      setSubmitError("Please sign in or create an account before submitting your print request.");
      return;
    }

    if (!selectedFile) {
      setSubmitError("Please attach the document file you need to print.");
      return;
    }

    if (!agreed) {
      setSubmitError("Please agree to the program guidelines before submitting.");
      return;
    }

    const effectiveSchool =
      formData.school === "OTHERS" || formData.school === "Others"
        ? (formData.custom_school || "").trim()
        : formData.school;

    if (!formData.student_name.trim()) {
      setSubmitError("Please enter your full name.");
      return;
    }

    if (!formData.school || !effectiveSchool) {
      setSubmitError("Please select or specify your school / university name.");
      return;
    }

    if (!formData.grade_level) {
      setSubmitError("Please select your grade or year level.");
      return;
    }

    if (!formData.purok) {
      setSubmitError("Please select your Purok / Sitio in Barangay Tocok.");
      return;
    }

    if (!formData.print_type) {
      setSubmitError("Please select your preferred print color (Black & White or Colored).");
      return;
    }

    if (!formData.paper_size) {
      setSubmitError("Please select your preferred paper size (A4, Letter, or Legal).");
      return;
    }

    if (!formData.pickup_station) {
      setSubmitError("Please select your preferred claiming station.");
      return;
    }

    let progressTimer: NodeJS.Timeout | null = null;
    let cloudTimer: NodeJS.Timeout | null = null;
    let targetProgress = 8;
    let currentProgress = 0;

    const startSmoothing = () => {
      progressTimer = setInterval(() => {
        if (currentProgress < targetProgress) {
          const diff = targetProgress - currentProgress;
          const step = Math.max(1, Math.ceil(diff * 0.18));
          currentProgress = Math.min(targetProgress, currentProgress + step);
          setUploadProgress(currentProgress);
        }
      }, 35);
    };

    try {
      setSubmitting(true);
      setUploadProgress(0);
      setUploadStatusText("Uploading document to server...");
      const data = new FormData();
      Object.entries(formData).forEach(([k, v]) => {
        if (k === "school") {
          data.append(k, effectiveSchool);
        } else if (k !== "custom_school") {
          data.append(k, String(v));
        }
      });
      data.append("file", selectedFile);

      let result: { tracking_code: string; message?: string };

      if (typeof XMLHttpRequest !== "undefined") {
        startSmoothing();
        result = await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("POST", "/api/printing/submit");
          xhr.withCredentials = true;

          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable && event.total > 0) {
              const rawRatio = event.loaded / event.total;
              // Map network upload to 0-65%
              const mapped = Math.round(rawRatio * 65);
              targetProgress = Math.max(targetProgress, mapped);
              if (rawRatio < 1) {
                setUploadStatusText("Uploading document to server...");
              } else if (!cloudTimer) {
                // Network upload complete; server is saving to Google Drive and Neon DB
                setUploadStatusText("Saving to Google Drive cloud storage...");
                cloudTimer = setInterval(() => {
                  if (targetProgress < 85) {
                    targetProgress = Math.min(85, targetProgress + 2);
                    setUploadStatusText("Saving to Google Drive cloud storage...");
                  } else if (targetProgress < 94) {
                    targetProgress = Math.min(94, targetProgress + 1);
                    setUploadStatusText("Registering ticket in SK queue...");
                  }
                }, 220);
              }
            }
          };

          xhr.onload = async () => {
            if (cloudTimer) clearInterval(cloudTimer);
            let responseJson: { tracking_code?: string; error?: string; message?: string } | null = null;
            try {
              responseJson = JSON.parse(xhr.responseText);
            } catch {
              // Non-JSON response
            }

            if (xhr.status >= 200 && xhr.status < 300) {
              if (responseJson && responseJson.tracking_code) {
                targetProgress = 100;
                setUploadStatusText("Ticket created successfully!");
                // Wait for the smooth visual counter to reach 100%
                await new Promise<void>((resolveWait) => {
                  const checkDone = setInterval(() => {
                    if (currentProgress >= 100) {
                      clearInterval(checkDone);
                      setTimeout(resolveWait, 350);
                    }
                  }, 30);
                });
                resolve({ tracking_code: responseJson.tracking_code, message: responseJson.message });
              } else {
                reject(new Error("Invalid response received from server."));
              }
            } else {
              if (xhr.status === 401) {
                setCurrentUser(null);
                setAuthError("Your session could not be verified by the server. Please sign in again.");
                reject(new Error("Your session has expired. Please sign in again."));
              } else {
                reject(new Error(responseJson?.error || "Failed to submit print request"));
              }
            }
          };

          xhr.onerror = () => {
            if (cloudTimer) clearInterval(cloudTimer);
            reject(new Error("Network connection error during upload. Please check your internet connection and try again."));
          };

          xhr.ontimeout = () => {
            if (cloudTimer) clearInterval(cloudTimer);
            reject(new Error("Upload request timed out. Please check your internet connection and try again."));
          };

          xhr.send(data);
        });
      } else {
        const res = await fetch("/api/printing/submit", {
          method: "POST",
          body: data,
        });

        const resJson = await res.json();
        if (!res.ok) {
          if (res.status === 401) {
            setCurrentUser(null);
            setAuthError("Your session could not be verified by the server. Please sign in again.");
            throw new Error("Your session has expired. Please sign in again.");
          }
          throw new Error(resJson.error || "Failed to submit print request");
        }
        result = resJson;
      }

      setSubmittedCode(result.tracking_code);
      loadMyRequests();
      try {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      } catch (e) {}
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setSubmitError(message);
    } finally {
      if (progressTimer) clearInterval(progressTimer);
      if (cloudTimer) clearInterval(cloudTimer);
      setSubmitting(false);
      setUploadProgress(0);
    }
  };

  const copyCode = () => {
    if (submittedCode) {
      navigator.clipboard.writeText(submittedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const goToTrackingWithCode = (code: string) => {
    setTrackingCode(code);
    switchTab("track");
    handleLookup(code);
  };

  // ----------------------------------------------------
  // TRACK HANDLERS
  // ----------------------------------------------------
  const handleLookup = async (codeToSearch: string): Promise<boolean> => {
    const code = codeToSearch.trim();
    if (!code) return false;

    try {
      setTrackingLoading(true);
      setTrackError(null);
      setJob(null);

      // Update URL query with tab without saving code
      const url = new URL(window.location.href);
      url.searchParams.set("tab", "track");
      url.searchParams.delete("code");
      window.history.replaceState({}, "", url.toString());

      const res = await fetch(`/api/printing/${encodeURIComponent(code)}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "No print request found with this code");
      }

      setJob(data.job);
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to look up tracking code";
      setTrackError(message);
      return false;
    } finally {
      setTrackingLoading(false);
    }
  };

  const handleConfirmCancel = async () => {
    if (!jobToCancel) return;
    try {
      setCancelSubmitting(true);
      setCancelError(null);
      const res = await fetch("/api/printing/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tracking_code: jobToCancel.tracking_code }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to cancel print request.");
      }

      const cancelledCode = jobToCancel.tracking_code;
      // Update active job if it matches
      setJob((prev) => (prev && prev.tracking_code === cancelledCode ? { ...prev, status: "Cancelled" } : prev));
      // Update myJobs list
      setMyJobs((prev) =>
        prev.map((j) => (j.tracking_code === cancelledCode ? { ...j, status: "Cancelled" } : j))
      );
      setJobToCancel(null);
      loadMyRequests(false);
    } catch (err: unknown) {
      setCancelError(err instanceof Error ? err.message : "Failed to cancel print request.");
    } finally {
      setCancelSubmitting(false);
    }
  };

  const getStepStatus = (currentStatus: string, stepName: string) => {
    const sequence = ["Pending Review", "Printing In Progress", "Ready for Pickup", "Completed"];
    const currentIndex = sequence.indexOf(currentStatus);
    const stepIndex = sequence.indexOf(stepName);

    if (currentStatus === "Declined" || currentStatus === "Cancelled") return "declined";
    if (currentIndex >= stepIndex) return "completed";
    return "upcoming";
  };

  const renderAuthCard = (subtitleText: string) => (
    <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 p-4 sm:p-7 shadow-xs max-w-md mx-auto space-y-3 sm:space-y-4 animate-in fade-in font-sans">
      <div className="text-center space-y-1">
        <div className="inline-flex items-center justify-center gap-2">
          <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-brand-50 dark:bg-brand-950/50 border border-brand-200 dark:border-brand-800/70 text-brand-700 dark:text-brand-400 flex items-center justify-center shrink-0">
            <Lock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </span>
          <h2 className="text-base sm:text-xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
            Student Login Required
          </h2>
        </div>
        <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
          {subtitleText}
        </p>
      </div>

      <div className="space-y-2.5 sm:space-y-3.5">
        {/* Continue with Google button */}
        <button
          type="button"
          disabled={googleSubmitting || authSubmitting}
          onClick={handleContinueWithGoogle}
          className="w-full flex items-center justify-center gap-2.5 py-2 sm:py-2.5 px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold text-xs sm:text-sm transition shadow-2xs hover:shadow-xs cursor-pointer active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {googleSubmitting ? (
            <>
              <div className="w-4 h-4 border-2 border-slate-500 dark:border-slate-300 border-t-transparent rounded-full animate-spin shrink-0" />
              <span>Connecting to Google...</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3h3.88c2.27-2.09 3.66-5.17 3.66-9.09z"/>
                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.1C3.25 21.36 7.33 24 12 24z"/>
                <path fill="#FBBC05" d="M5.28 14.32a7.18 7.18 0 0 1 0-4.64V6.58H1.26a11.96 11.96 0 0 0 0 10.84l4.02-3.1z"/>
                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.25 2.64 1.26 6.58l4.02 3.1c.95-2.83 3.6-4.93 6.72-4.93z"/>
              </svg>
              <span>Continue with Google</span>
            </>
          )}
        </button>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200 dark:border-slate-800"></div>
          </div>
          <div className="relative flex justify-center text-[10px] sm:text-[11px] uppercase tracking-wider">
            <span className="bg-white dark:bg-slate-900 px-2.5 text-slate-400 dark:text-slate-500 font-semibold">or with email</span>
          </div>
        </div>

        {/* Sub-Tabs: Sign In vs Create Account */}
        <div className="grid grid-cols-2 p-0.5 sm:p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
          <button
            type="button"
            onClick={() => { setAuthMode("signin"); setAuthError(null); }}
            className={`py-1.5 sm:py-2 text-[11px] sm:text-xs font-bold rounded-lg transition cursor-pointer ${
              authMode === "signin"
                ? "bg-white dark:bg-slate-900 text-brand-700 dark:text-brand-400 shadow-2xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setAuthMode("register"); setAuthError(null); }}
            className={`py-1.5 sm:py-2 text-[11px] sm:text-xs font-bold rounded-lg transition cursor-pointer ${
              authMode === "register"
                ? "bg-white dark:bg-slate-900 text-brand-700 dark:text-brand-400 shadow-2xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
            }`}
          >
            Create Account
          </button>
        </div>

        {authError && (
          <div className="p-2.5 sm:p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/70 text-rose-800 dark:text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            <span>{authError}</span>
          </div>
        )}

        {authMode === "signin" ? (
          <form onSubmit={handleEmailSignIn} className="space-y-2.5 sm:space-y-3">
            <div>
              <label className="block text-[11px] sm:text-xs font-semibold text-slate-700 dark:text-slate-300 mb-0.5 sm:mb-1">
                Email Address
              </label>
              <input
                type="email"
                required
                placeholder="student@example.com"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                className="w-full px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-600 bg-slate-50/50 dark:bg-slate-800/50"
              />
            </div>

            <div>
              <label className="block text-[11px] sm:text-xs font-semibold text-slate-700 dark:text-slate-300 mb-0.5 sm:mb-1">
                Password
              </label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                className="w-full px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-600 bg-slate-50/50 dark:bg-slate-800/50"
              />
            </div>

            <button
              type="submit"
              disabled={authSubmitting}
              className="w-full py-2 sm:py-2.5 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs sm:text-sm shadow-sm shadow-brand-500/20 transition cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2 active:scale-95"
            >
              {authSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white dark:border-slate-900 border-t-transparent rounded-full animate-spin" />
                  <span>Signing In...</span>
                </>
              ) : (
                <span>Sign In &amp; Continue</span>
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleEmailRegister} className="space-y-2 sm:space-y-3">
            <div>
              <label className="block text-[11px] sm:text-xs font-semibold text-slate-700 dark:text-slate-300 mb-0.5 sm:mb-1">
                Full Student Name
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Maria Santos"
                value={authName}
                onChange={(e) => setAuthName(e.target.value)}
                className="w-full px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-600 bg-slate-50/50 dark:bg-slate-800/50"
              />
            </div>

            <div>
              <label className="block text-[11px] sm:text-xs font-semibold text-slate-700 dark:text-slate-300 mb-0.5 sm:mb-1">
                Email Address
              </label>
              <input
                type="email"
                required
                placeholder="student@example.com"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                className="w-full px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-600 bg-slate-50/50 dark:bg-slate-800/50"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] sm:text-xs font-semibold text-slate-700 dark:text-slate-300 mb-0.5 sm:mb-1">
                  Password <span className="text-slate-400 dark:text-slate-500 font-normal">(6+ chars)</span>
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  className="w-full px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-600 bg-slate-50/50 dark:bg-slate-800/50"
                />
              </div>

              <div>
                <label className="block text-[11px] sm:text-xs font-semibold text-slate-700 dark:text-slate-300 mb-0.5 sm:mb-1">
                  Confirm Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={authConfirmPassword}
                  onChange={(e) => setAuthConfirmPassword(e.target.value)}
                  className="w-full px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-600 bg-slate-50/50 dark:bg-slate-800/50"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={authSubmitting}
              className="w-full py-2 sm:py-2.5 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs sm:text-sm shadow-sm shadow-brand-500/20 transition cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2 active:scale-95"
            >
              {authSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white dark:border-slate-900 border-t-transparent rounded-full animate-spin" />
                  <span>Creating Account...</span>
                </>
              ) : (
                <span>Create Account &amp; Continue</span>
              )}
            </button>
          </form>
        )}
      </div>

      <p className="text-[10px] sm:text-[11px] text-slate-400 dark:text-slate-500 text-center">
        SK Barangay Tocok • Student privacy protected
      </p>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-3.5 sm:px-6 py-3.5 sm:py-8 space-y-4 sm:space-y-6 pb-12 sm:pb-16 min-h-[calc(100vh-58px-3.5rem)] md:min-h-[calc(100vh-110px-4rem)]">
      {/* Top Controls: Mode Switcher & Guidelines Info */}
      <div className="flex flex-row items-center justify-between gap-2 sm:gap-3 max-w-2xl mx-auto w-full">
        <div className="flex-1 min-w-0 sm:max-w-md w-full bg-slate-100/90 dark:bg-slate-800/90 p-1 sm:p-1.5 rounded-2xl border border-slate-200/80 dark:border-slate-800/90 shadow-xs">
          <div className="grid grid-cols-2 gap-1 sm:gap-1.5">
            <button
              type="button"
              onClick={() => switchTab("submit")}
              className={`flex items-center justify-center gap-1.5 sm:gap-2 py-2 sm:py-2.5 px-2 sm:px-3 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer active:scale-95 touch-manipulation select-none ${
                activeTab === "submit"
                  ? "bg-white dark:bg-slate-900 text-brand-700 dark:text-brand-400 shadow-sm border border-slate-200/60 dark:border-slate-700/70 font-extrabold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-white/50 dark:hover:bg-slate-700/50"
              }`}
            >
              <Printer className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-brand-600 dark:text-brand-400 shrink-0" />
              <span>Submit Request</span>
            </button>

            <button
              type="button"
              onClick={() => switchTab("track")}
              className={`relative flex items-center justify-center gap-1.5 sm:gap-2 py-2 sm:py-2.5 px-2 sm:px-3 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer active:scale-95 touch-manipulation select-none ${
                activeTab === "track"
                  ? "bg-white dark:bg-slate-900 text-brand-700 dark:text-brand-400 shadow-sm border border-slate-200/60 dark:border-slate-700/70 font-extrabold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-white/50 dark:hover:bg-slate-700/50"
              }`}
            >
              <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-brand-600 dark:text-brand-400 shrink-0" />
              <span>Track Status</span>
              {submittedCode && (
                <span className="w-2 h-2 rounded-full bg-brand-500 animate-ping shrink-0" />
              )}
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowInfoModal(true)}
          aria-label="Guidelines & Station Info"
          title="Guidelines & Station Info"
          className="inline-flex items-center justify-center gap-1.5 w-11 h-11 sm:w-auto sm:h-auto sm:px-3.5 sm:py-2.5 rounded-2xl sm:rounded-xl bg-brand-50 dark:bg-brand-950/50 hover:bg-brand-100 dark:hover:bg-brand-900/60 border border-brand-200 dark:border-brand-800/70 text-brand-700 dark:text-brand-400 text-xs font-bold transition-all shadow-2xs shrink-0 cursor-pointer active:scale-95 touch-manipulation"
        >
          <Info className="w-[18px] h-[18px] sm:w-4 sm:h-4 text-brand-600 dark:text-brand-400 shrink-0" />
          <span className="hidden sm:inline">Guidelines &amp; Station Info</span>
        </button>
      </div>

      {/* Main Content Workspace (Clean, centered, uncluttered layout) */}
      <div className="w-full space-y-4 sm:space-y-6">
          {/* --------------------------------------------------------------- */}
          {/* TAB 1: SUBMIT PRINT REQUEST                                     */}
          {/* --------------------------------------------------------------- */}
          {activeTab === "submit" && (
            <div className="space-y-6">
              {/* Program Inactive Notice */}
              {!isActive && (
                <div className="p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/70 text-amber-900 dark:text-amber-200 flex items-start gap-3 shadow-xs">
                  <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-1 text-sm">
                    <p className="font-bold">Monthly Free Printing Supplies Limit Reached</p>
                    <p className="text-xs text-amber-800 dark:text-amber-300">
                      The allocation for this month&apos;s paper and ink budget has been fully served. The program will automatically reset on the 1st day of next month upon supply replenishment.
                    </p>
                  </div>
                </div>
              )}

              {/* Submission Success View */}
              {submittedCode ? (
                /* Submission Success View */
                <div
                  id="submission-success-view"
                  className="max-w-md sm:max-w-lg mx-auto bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-emerald-200/90 dark:border-emerald-800/70 p-4 sm:p-7 shadow-md text-center space-y-3.5 sm:space-y-5 animate-in fade-in zoom-in-95 duration-200 scroll-mt-20"
                >
                  {/* Minimalist Header */}
                  <div className="space-y-1">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-100 dark:border-emerald-900/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                      <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                    <h2 className="text-lg sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight pt-1">
                      Print Request Submitted!
                    </h2>
                    <p className="text-[11.5px] sm:text-xs text-slate-500 dark:text-slate-400 leading-snug">
                      Queued for printing. Save your ticket below to claim.
                    </p>
                  </div>

                  {/* Unified Minimalist Claim Ticket Card */}
                  <div className="bg-gradient-to-br from-brand-50/90 dark:from-brand-950/50 via-white dark:via-slate-900 to-amber-50/40 dark:to-amber-950/30 border-2 border-dashed border-brand-300 dark:border-brand-700/80 rounded-xl sm:rounded-2xl p-3.5 sm:p-5 space-y-2.5 shadow-2xs">
                    <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block">
                      Official Claim Ticket
                    </span>

                    <div className="flex items-center justify-center gap-2.5">
                      <span className="text-3xl sm:text-4xl font-mono font-black text-brand-700 dark:text-brand-400 tracking-wider leading-none">
                        {submittedCode.startsWith("SK") || submittedCode.startsWith("PRN") ? submittedCode : `#${submittedCode}`}
                      </span>
                      <button
                        type="button"
                        onClick={copyCode}
                        className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-brand-100 dark:bg-brand-950/70 hover:bg-brand-200 dark:hover:bg-brand-900/80 text-brand-800 dark:text-brand-300 transition-colors cursor-pointer"
                        title="Copy ticket code"
                      >
                        {copied ? <Check className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-4 h-4 sm:w-5 sm:h-5" />}
                      </button>
                    </div>

                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                      Screenshot or copy — present{" "}
                      <strong className="text-slate-700 dark:text-slate-300">
                        {submittedCode.startsWith("SK") || submittedCode.startsWith("PRN") ? submittedCode : `#${submittedCode}`}
                      </strong>{" "}
                      when claiming.
                    </p>

                    {/* Compact Station & Turnaround Meta */}
                    <div className="pt-2.5 border-t border-brand-200/70 dark:border-brand-800/70 flex flex-col items-center gap-1.5 text-[11px] sm:text-xs font-sans">
                      <span className="inline-flex items-center justify-center gap-1 text-emerald-800 dark:text-emerald-300 font-semibold leading-tight">
                        <MapPin className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span>
                          {formData.pickup_station
                            ? formData.pickup_station.includes("Purok 5")
                              ? "Purok 5 (Sitio Sapdaan · SK Treasurer)"
                              : "Purok 1 (Bio, Sagur, Baybay · SK Chair)"
                            : "Designated SK Printing Station"}
                        </span>
                      </span>
                      {formData.is_urgent ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100/80 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-700/80 text-amber-900 dark:text-amber-200 text-[10.5px] sm:text-[11px] font-bold">
                          Urgent Priority (Rush)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-800/90 text-slate-600 dark:text-slate-400 text-[10.5px] sm:text-[11px] font-medium">
                          <Clock className="w-3 h-3 text-slate-400 dark:text-slate-500 shrink-0" />
                          Turnaround: 1–2 Days
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Web Push Notification Opt-in */}
                  <PushNotificationManager variant="banner" />

                  {/* Compact Side-by-Side Action Buttons */}
                  <div className="grid grid-cols-2 gap-2 sm:gap-2.5 pt-0.5 font-sans">
                    <button
                      type="button"
                      onClick={() => goToTrackingWithCode(submittedCode)}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs sm:text-sm shadow-sm shadow-brand-500/20 transition-all cursor-pointer whitespace-nowrap"
                    >
                      <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                      <span>Track Request</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSubmittedCode(null);
                        setSelectedFile(null);
                        setAgreed(false);
                        setFormData(DEFAULT_FORM_DATA);
                        try {
                          localStorage.removeItem(DRAFT_STORAGE_KEY);
                        } catch (e) {}
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className="inline-flex items-center justify-center px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs sm:text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap"
                    >
                      New Request
                    </button>
                  </div>
                </div>
              ) : authChecking ? (
                /* Auth Checking State */
                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-12 text-center text-slate-500 dark:text-slate-400 shadow-xs space-y-3">
                  <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs sm:text-sm font-medium">Checking student account status...</p>
                </div>
              ) : !currentUser ? (
                renderAuthCard("Sign in or create an account to submit print requests.")
              ) : (
                /* Submission Form */
                <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5 sm:p-8 space-y-4 sm:space-y-6 shadow-xs font-sans">
                  {submitError && (
                    <div className="p-3 sm:p-4 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/70 text-rose-800 dark:text-rose-300 flex items-start gap-2.5 sm:gap-3 text-xs sm:text-sm">
                      <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                      <span>{submitError}</span>
                    </div>
                  )}

                  {/* Section 1: Student Information */}
                  <div className="space-y-3 sm:space-y-4">
                    <div className="border-b border-slate-100 dark:border-slate-800 pb-2 sm:pb-3">
                      <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                        1. Student &amp; Resident Information
                      </h3>
                      <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                        Verification of residency in Barangay Tocok, San Fabian
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-4">
                      <div>
                        <label className="block text-[11px] sm:text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 sm:mb-1.5">
                          Full Name <span className="text-rose-500 dark:text-rose-400">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Juan Dela Cruz"
                          value={formData.student_name}
                          onChange={(e) => setFormData({ ...formData, student_name: e.target.value })}
                          className="w-full px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-600 bg-slate-50/50 dark:bg-slate-800/50"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] sm:text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 sm:mb-1.5">
                          Facebook / Messenger Name <span className="text-slate-400 dark:text-slate-500 font-normal">(Optional)</span>
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Juan Tocok"
                          value={formData.facebook_name}
                          onChange={(e) => setFormData({ ...formData, facebook_name: e.target.value })}
                          className="w-full px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-600 bg-slate-50/50 dark:bg-slate-800/50"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] sm:text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 sm:mb-1.5">
                          School / University <span className="text-rose-500 dark:text-rose-400">*</span>
                        </label>
                        <select
                          required
                          value={formData.school}
                          onChange={(e) => setFormData({ ...formData, school: e.target.value })}
                          className={`w-full px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-600 bg-slate-50/50 dark:bg-slate-800/50 font-medium ${
                            !formData.school ? "text-slate-400 dark:text-slate-500" : "text-slate-800 dark:text-slate-200"
                          }`}
                        >
                          <option value="" disabled className="text-slate-400 dark:text-slate-500">
                            Select School / University...
                          </option>
                          {SCHOOL_OPTIONS.map((sch) => (
                            <option key={sch} value={sch} className="text-slate-800 dark:text-slate-200">
                              {sch}
                            </option>
                          ))}
                        </select>
                        {(formData.school === "OTHERS" || formData.school === "Others") && (
                          <input
                            type="text"
                            required
                            placeholder="Type your School / University name..."
                            value={formData.custom_school || ""}
                            onChange={(e) => setFormData({ ...formData, custom_school: e.target.value })}
                            className="w-full mt-2 px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-600 bg-white dark:bg-slate-900 animate-in fade-in"
                          />
                        )}
                      </div>

                      <div>
                        <label className="block text-[11px] sm:text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 sm:mb-1.5">
                          Grade / Year Level <span className="text-rose-500 dark:text-rose-400">*</span>
                        </label>
                        <select
                          required
                          value={formData.grade_level}
                          onChange={(e) => setFormData({ ...formData, grade_level: e.target.value })}
                          className={`w-full px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-600 bg-slate-50/50 dark:bg-slate-800/50 font-medium ${
                            !formData.grade_level ? "text-slate-400 dark:text-slate-500" : "text-slate-800 dark:text-slate-200"
                          }`}
                        >
                          <option value="" disabled className="text-slate-400 dark:text-slate-500">
                            Select Grade / Year Level...
                          </option>
                          {GRADE_LEVEL_OPTIONS.map((level) => (
                            <option key={level} value={level} className="text-slate-800 dark:text-slate-200">
                              {level}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-[11px] sm:text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 sm:mb-1.5">
                          Purok / Sitio in Tocok <span className="text-rose-500 dark:text-rose-400">*</span>
                        </label>
                        <select
                          required
                          value={formData.purok}
                          onChange={(e) => setFormData({ ...formData, purok: e.target.value })}
                          className={`w-full px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-600 bg-slate-50/50 dark:bg-slate-800/50 font-medium ${
                            !formData.purok ? "text-slate-400 dark:text-slate-500" : "text-slate-800 dark:text-slate-200"
                          }`}
                        >
                          <option value="" disabled className="text-slate-400 dark:text-slate-500">
                            Select your Purok / Sitio...
                          </option>
                          {PUROK_OPTIONS.map((purok) => (
                            <option key={purok} value={purok} className="text-slate-800 dark:text-slate-200">
                              {purok}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Print Specifications */}
                  <div className="space-y-3 sm:space-y-4">
                    <div className="border-b border-slate-100 dark:border-slate-800 pb-2 sm:pb-3">
                      <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                        2. Print Options &amp; Preferences
                      </h3>
                      <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                        Select color mode, bond paper size, and copies
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4">
                      <div>
                        <label className="block text-[11px] sm:text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 sm:mb-1.5">
                          Print Color <span className="text-rose-500 dark:text-rose-400">*</span>
                        </label>
                        <select
                          required
                          value={formData.print_type}
                          onChange={(e) => setFormData({ ...formData, print_type: e.target.value })}
                          className={`w-full px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-600 bg-slate-50/50 dark:bg-slate-800/50 font-medium ${
                            !formData.print_type ? "text-slate-400 dark:text-slate-500" : "text-slate-800 dark:text-slate-200"
                          }`}
                        >
                          <option value="" disabled className="text-slate-400 dark:text-slate-500">
                            Select Print Color...
                          </option>
                          <option value="Black & White" className="text-slate-800 dark:text-slate-200">Black &amp; White (Grayscale)</option>
                          <option value="Colored" className="text-slate-800 dark:text-slate-200">Colored</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] sm:text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 sm:mb-1.5">
                          Paper Size <span className="text-rose-500 dark:text-rose-400">*</span>
                        </label>
                        <select
                          required
                          value={formData.paper_size}
                          onChange={(e) => setFormData({ ...formData, paper_size: e.target.value })}
                          className={`w-full px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-600 bg-slate-50/50 dark:bg-slate-800/50 font-medium ${
                            !formData.paper_size ? "text-slate-400 dark:text-slate-500" : "text-slate-800 dark:text-slate-200"
                          }`}
                        >
                          <option value="" disabled className="text-slate-400 dark:text-slate-500">
                            Select Paper Size...
                          </option>
                          <option value="A4" className="text-slate-800 dark:text-slate-200">A4 (Standard 210 × 297 mm)</option>
                          <option value="Letter (Short)" className="text-slate-800 dark:text-slate-200">Letter / Short (8.5 × 11 in)</option>
                          <option value="Legal (Long)" className="text-slate-800 dark:text-slate-200">Legal / Long (8.5 × 13 in)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] sm:text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 sm:mb-1.5">
                          Number of Copies
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="5"
                          value={formData.copies}
                          onChange={(e) => setFormData({ ...formData, copies: parseInt(e.target.value) || 1 })}
                          className="w-full px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-600 bg-slate-50/50 dark:bg-slate-800/50 font-medium"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-4">
                      <div>
                        <label className="block text-[11px] sm:text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 sm:mb-1.5">
                          Page Range
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. All pages, or Pages 1-5"
                          value={formData.page_range}
                          onChange={(e) => setFormData({ ...formData, page_range: e.target.value })}
                          className="w-full px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-600 bg-slate-50/50 dark:bg-slate-800/50"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] sm:text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 sm:mb-1.5">
                          Special Instructions / Notes
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Back-to-back if possible / due tomorrow"
                          value={formData.notes}
                          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                          className="w-full px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-600 bg-slate-50/50 dark:bg-slate-800/50"
                        />
                      </div>
                    </div>

                    {/* Claiming Station Selector */}
                    <div>
                      <label className="block text-[11px] sm:text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 sm:mb-1.5 flex flex-wrap items-center justify-between gap-1">
                        <span>Preferred Claiming Station (Printer) <span className="text-rose-500 dark:text-rose-400">*</span></span>
                        <span className="text-[10.5px] sm:text-[11px] text-brand-700 dark:text-brand-400 font-semibold lowercase">Pick closest to you</span>
                      </label>
                      <select
                        required
                        value={formData.pickup_station}
                        onChange={(e) => setFormData({ ...formData, pickup_station: e.target.value })}
                        className={`w-full px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-600 bg-slate-50/50 dark:bg-slate-800/50 font-medium ${
                          !formData.pickup_station ? "text-slate-400 dark:text-slate-500" : "text-slate-800 dark:text-slate-200"
                        }`}
                      >
                        <option value="" disabled className="text-slate-400 dark:text-slate-500">
                          Select Preferred Claiming Station...
                        </option>
                        {CLAIMING_STATIONS.map((station) => (
                          <option key={station.id} value={station.label} className="text-slate-800 dark:text-slate-200">
                            {station.label}
                          </option>
                        ))}
                      </select>
                      <p className="text-[10.5px] sm:text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                        {formData.pickup_station
                          ? formData.pickup_station.includes("Purok 5")
                            ? "Near Purok 5 (Sitio Sapdaan) or surrounding puroks? Claim from our SK Treasurer."
                            : "Near Purok 1 (Sitio Bio, Sitio Sagur, Sitio Baybay)? Claim from our SK Chairperson."
                          : "Choose the printer station closest to your home in Barangay Tocok."}
                      </p>
                    </div>

                    {/* Needed Urgently Toggle */}
                    <div className={`p-2.5 sm:p-3.5 rounded-xl border transition-all ${
                      formData.is_urgent
                        ? "bg-amber-50/90 dark:bg-amber-950/45 border-amber-300 dark:border-amber-700/80 ring-2 ring-amber-200 dark:ring-amber-800/70"
                        : "bg-slate-50/70 dark:bg-slate-800/60 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
                    }`}>
                      <label className="flex items-start gap-2.5 sm:gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.is_urgent}
                          onChange={(e) => setFormData({ ...formData, is_urgent: e.target.checked })}
                          className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400 rounded border-slate-300 dark:border-slate-700 focus:ring-amber-500 cursor-pointer"
                        />
                        <div className="space-y-0.5">
                          <span className="block text-xs font-bold text-slate-900 dark:text-slate-100">
                            Needed Urgently (Rush / Urgent School Deadline)
                          </span>
                          <p className="text-[11px] sm:text-[11.5px] text-slate-600 dark:text-slate-400 leading-snug">
                            Standard turnaround is <strong>1–2 days</strong> because SK Officials attend classes and jobs. Check this if you need your copies ASAP so officials can prioritize it.
                          </p>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Section 3: File Upload */}
                  <div className="space-y-3 sm:space-y-4">
                    <div className="border-b border-slate-100 dark:border-slate-800 pb-2 sm:pb-3 flex items-center justify-between gap-2.5">
                      <div>
                        <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                          3. Attach Document
                        </h3>
                        <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                          PDF, DOCX, PPTX, JPG, PNG (Max: 100 MB)
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowInfoModal(true)}
                        className="text-[11px] sm:text-xs text-brand-600 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-300 font-bold inline-flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        <Info className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">File</span> guidelines
                      </button>
                    </div>

                    <div className="border-2 border-dashed border-brand-200 dark:border-brand-800/70 hover:border-brand-500 rounded-2xl p-4 sm:p-7 text-center bg-brand-50/20 dark:bg-brand-950/25 hover:bg-brand-50/40 dark:hover:bg-brand-950/40 transition-all cursor-pointer relative">
                      <input
                        type="file"
                        required
                        accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png"
                        onChange={handleFileChange}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <div className="space-y-2 sm:space-y-3">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-brand-100 dark:bg-brand-950/70 text-brand-700 dark:text-brand-400 flex items-center justify-center mx-auto shadow-xs">
                          <Upload className="w-5 h-5 sm:w-6 sm:h-6" />
                        </div>
                        {selectedFile ? (
                          <div className="space-y-0.5 sm:space-y-1">
                            <p className="font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-sm">{selectedFile.name}</p>
                            <p className="text-[11px] sm:text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                              {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • File attached! Click to replace
                            </p>
                          </div>
                        ) : (
                          <div>
                            <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">
                              Click to browse or drag and drop your document here
                            </p>
                            <p className="text-[10.5px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5 sm:mt-1">
                              PDF documents recommended for accurate margins and page breaks
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Guidelines Agreement */}
                  <div className="p-3 sm:p-4 rounded-xl bg-brand-50/70 dark:bg-brand-950/45 border border-brand-200 dark:border-brand-800/70 space-y-1 sm:space-y-2">
                    <div className="flex items-start gap-2.5 sm:gap-3">
                      <input
                        type="checkbox"
                        id="agree"
                        checked={agreed}
                        onChange={(e) => setAgreed(e.target.checked)}
                        className="mt-0.5 w-4 h-4 text-brand-600 dark:text-brand-400 rounded border-slate-300 dark:border-slate-700 focus:ring-brand-500 cursor-pointer"
                      />
                      <label htmlFor="agree" className="text-[11px] sm:text-xs text-slate-700 dark:text-slate-300 leading-relaxed cursor-pointer">
                        <span className="font-bold text-slate-900 dark:text-slate-100">Program Guidelines Confirmation:</span> I confirm that I am a youth resident (ages 15–30) of Barangay Tocok and this material complies with the program guidelines. I understand that printing is provided free of charge while monthly supplies last, and will claim my printouts promptly at my selected station.{" "}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setShowInfoModal(true);
                          }}
                          className="font-bold text-brand-700 dark:text-brand-400 hover:text-brand-900 dark:hover:text-brand-200 underline inline cursor-pointer ml-0.5"
                        >
                          View rules
                        </button>
                      </label>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div>
                    <button
                      type="submit"
                      disabled={submitting || !isActive}
                      className={`w-full py-2.5 sm:py-3.5 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 active:scale-[0.99] ${
                        submitting || !isActive
                          ? "bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed"
                          : "bg-brand-600 hover:bg-brand-700 text-white shadow-md shadow-brand-500/20 hover:shadow-lg cursor-pointer"
                      }`}
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Uploading &amp; Submitting...</span>
                        </>
                      ) : (
                        <>
                          <Printer className="w-4 h-4" />
                          Submit Print Request Now
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* --------------------------------------------------------------- */}
          {/* TAB 2: TRACK PRINT STATUS                                       */}
          {/* --------------------------------------------------------------- */}
          {activeTab === "track" && (
            <div className="space-y-6 min-h-[420px]">
              {currentUser ? (
                /* ============================================================== */
                /* LOGGED-IN VIEW: YOUR SUBMITTED REQUESTS                        */
                /* ============================================================== */
                <div className="space-y-6 font-sans">
                  {/* Unified Dashboard Card Container (Fixed size across pages, sized for 2 tickets) */}
                  <div
                    className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden flex flex-col ${
                      myJobs.length > 0
                        ? totalJobsPages > 1
                          ? "h-[500px] sm:h-[410px]"
                          : "h-[450px] sm:h-[356px]"
                        : "h-[560px] sm:h-[720px]"
                    }`}
                  >
                    {/* Dashboard Header Bar */}
                    <div className="shrink-0 bg-gradient-to-b from-slate-50/80 dark:from-slate-900 to-white dark:to-slate-900 border-b border-slate-200/80 dark:border-slate-800/90 p-3 sm:p-5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
                          <h2 className="text-sm sm:text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight shrink-0">
                            Your Print Requests
                          </h2>
                          {myJobs.length === 0 ? (
                            <span className="shrink-0 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10.5px] sm:text-xs font-semibold border border-slate-200/70 dark:border-slate-800/80">
                              0 Requests
                            </span>
                          ) : (
                            <span className="shrink-0 px-2 py-0.5 rounded-full bg-brand-50 dark:bg-brand-950/50 text-brand-700 dark:text-brand-400 text-[10.5px] sm:text-xs font-bold border border-brand-200 dark:border-brand-800/70">
                              {myJobs.length} {myJobs.length === 1 ? "Request" : "Requests"}
                            </span>
                          )}
                        </div>

                        {/* Action Toolbar: Sleek, compact icon-only buttons on the same top line */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <PushNotificationManager variant="compact" />

                          <button
                            type="button"
                            onClick={() => {
                              setTrackError(null);
                              setShowManualSearch(true);
                            }}
                            className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 flex items-center justify-center transition cursor-pointer shadow-2xs active:scale-95"
                            title="Lookup ticket number"
                            aria-label="Lookup ticket number"
                          >
                            <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              loadMyRequests(false);
                              if (job) handleLookup(job.tracking_code);
                            }}
                            disabled={myJobsLoading}
                            className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 flex items-center justify-center transition cursor-pointer disabled:opacity-60 shadow-2xs active:scale-95"
                            title="Refresh status of your print requests"
                            aria-label="Refresh status of your print requests"
                          >
                            <RotateCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${myJobsLoading ? "animate-spin text-brand-600 dark:text-brand-400" : ""}`} />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Main Content Area */}
                    {myJobsLoading && myJobs.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center p-8 sm:p-12 text-center text-slate-400 dark:text-slate-500 space-y-2">
                        <RotateCw className="w-5 h-5 sm:w-6 sm:h-6 animate-spin text-brand-600 dark:text-brand-400" />
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Loading your print requests...</p>
                      </div>
                    ) : myJobs.length === 0 ? (
                      /* Redesigned Clean Compact Empty State */
                      <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-10 flex flex-col overscroll-contain">
                        <div className="my-auto text-center space-y-3.5 sm:space-y-6">
                          <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-gradient-to-br from-brand-50 dark:from-brand-950/45 to-brand-100 dark:to-brand-950/60 text-brand-700 dark:text-brand-400 flex items-center justify-center mx-auto border border-brand-200/70 dark:border-brand-800/70 shadow-2xs">
                            <Printer className="w-6 h-6 sm:w-8 sm:h-8 text-brand-600 dark:text-brand-400" />
                          </div>

                          <div className="space-y-1 sm:space-y-2 max-w-md mx-auto">
                            <h3 className="text-sm sm:text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                              No Print Requests Submitted Yet
                            </h3>
                            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-sm mx-auto">
                              You haven&apos;t submitted any school documents for printing under this account. Free printing is available to all students of Barangay Tocok!
                            </p>
                          </div>

                          <div className="flex justify-center pt-0.5">
                            <button
                              type="button"
                              onClick={() => switchTab("submit")}
                              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 sm:px-6 sm:py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs sm:text-sm font-bold shadow-md shadow-brand-600/20 transition cursor-pointer active:scale-95"
                            >
                              <Printer className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                              <span>Submit a Print Request Now</span>
                            </button>
                          </div>

                          {/* Push Alert Opt-in Banner */}
                          <div className="max-w-md mx-auto w-full pt-1 text-left">
                            <PushNotificationManager variant="banner" />
                          </div>

                          {/* 3 Step Guidance Cards - Compact list on mobile */}
                          <div className="pt-3.5 sm:pt-6 border-t border-slate-100 dark:border-slate-800">
                            <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 text-center mb-2.5 sm:mb-4">
                              How Free Student Printing Works
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3.5 text-left">
                              <div className="p-2.5 sm:p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800/80 space-y-0.5 sm:space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-brand-100 dark:bg-brand-950/70 text-brand-800 dark:text-brand-300 text-[10px] sm:text-[11px] font-bold shrink-0">1</span>
                                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Upload &amp; Options</h4>
                                </div>
                                <p className="text-[10.5px] sm:text-[11px] text-slate-500 dark:text-slate-400 leading-snug pl-7 sm:pl-0">Submit your school PDF or Word file with preferred paper size and color.</p>
                              </div>
                              <div className="p-2.5 sm:p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800/80 space-y-0.5 sm:space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-brand-100 dark:bg-brand-950/70 text-brand-800 dark:text-brand-300 text-[10px] sm:text-[11px] font-bold shrink-0">2</span>
                                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">SK Queue &amp; Print</h4>
                                </div>
                                <p className="text-[10.5px] sm:text-[11px] text-slate-500 dark:text-slate-400 leading-snug pl-7 sm:pl-0">SK officials review, queue, and print your copies during active printing hours.</p>
                              </div>
                              <div className="p-2.5 sm:p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800/80 space-y-0.5 sm:space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-brand-100 dark:bg-brand-950/70 text-brand-800 dark:text-brand-300 text-[10px] sm:text-[11px] font-bold shrink-0">3</span>
                                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Pick Up at Station</h4>
                                </div>
                                <p className="text-[10.5px] sm:text-[11px] text-slate-500 dark:text-slate-400 leading-snug pl-7 sm:pl-0">Check live status here and claim at your designated Purok station with your Student ID.</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Has Requests: Compact Cards Grid (Max 2 per page, scrollable container) */
                      <div className="flex-1 min-h-0 flex flex-col">
                        <div className="shrink-0 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-3.5 sm:px-5 pt-3 sm:pt-4 pb-2">
                          <span className="font-bold uppercase tracking-wider text-[10px] sm:text-[10.5px] text-slate-600 dark:text-slate-400">
                            {myJobs.length === 1 ? "Your Submitted Request" : "Your Submitted Requests"}
                          </span>
                          <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                            {myJobs.length > JOBS_PER_PAGE
                              ? `Showing ${startJobIndex + 1}–${Math.min(startJobIndex + JOBS_PER_PAGE, myJobs.length)} of ${myJobs.length}`
                              : `${myJobs.length} ${myJobs.length === 1 ? "item" : "items"}`}
                          </span>
                        </div>

                        <div
                          ref={myJobsListRef}
                          className="flex-1 min-h-0 overflow-y-auto themed-scrollbar touch-pan-y px-3 sm:px-5 pb-3 sm:pb-4 space-y-2 sm:space-y-2.5 overscroll-contain"
                        >
                          {visibleJobs.map((mJob) => (
                            <div
                              key={mJob.tracking_code}
                              className="p-3 sm:p-3.5 rounded-xl sm:rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 transition-all shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4"
                            >
                              {/* Left Info */}
                              <div className="space-y-1 min-w-0 flex-1">
                                <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-mono font-bold text-[11px] sm:text-xs text-brand-800 dark:text-brand-300 bg-brand-50 dark:bg-brand-950/50 border border-brand-200/60 dark:border-brand-800/60 px-2 py-0.5 rounded-md whitespace-nowrap shrink-0">
                                      {mJob.tracking_code.startsWith("SK") || mJob.tracking_code.startsWith("PRN")
                                        ? `Ticket ${mJob.tracking_code}`
                                        : `Ticket #${mJob.tracking_code}`}
                                    </span>
                                    <PrintStatusBadge status={mJob.status} size="sm" />
                                  </div>
                                  <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium whitespace-nowrap">
                                    {new Date(mJob.created_at).toLocaleDateString("en-PH", {
                                      month: "short",
                                      day: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </span>
                                </div>

                                <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 truncate" title={mJob.file_name || undefined}>
                                  {mJob.file_name}
                                </p>

                                <p className="text-[10.5px] sm:text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                  {[
                                    `${mJob.copies || 1} ${(mJob.copies || 1) > 1 ? "copies" : "copy"}`,
                                    mJob.paper_size,
                                    mJob.print_type,
                                    mJob.pickup_station,
                                  ].filter(Boolean).join(" • ")}
                                </p>
                              </div>

                              {/* Right Actions */}
                              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800 w-full sm:w-auto justify-end">
                                {mJob.status === "Pending Review" && (
                                  <button
                                    type="button"
                                    onClick={() => setJobToCancel(mJob)}
                                    className="px-2.5 py-1.5 rounded-lg border border-rose-200 dark:border-rose-800/70 hover:bg-rose-50 dark:hover:bg-rose-950/60 text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 font-bold text-xs transition cursor-pointer shadow-2xs"
                                  >
                                    Cancel
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleLookup(mJob.tracking_code)}
                                  className="px-3 py-1.5 rounded-lg border border-transparent bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 font-bold text-xs transition cursor-pointer shadow-2xs flex items-center gap-1.5"
                                  title="View ticket details"
                                >
                                  <span>View</span>
                                  <ArrowRight className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Pagination Bar pinned to bottom when requests exceed 2 */}
                        {totalJobsPages > 1 && (
                          <div className="shrink-0 px-3 sm:px-5 py-2.5 sm:py-3 flex items-center justify-between border-t border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/40 text-xs">
                            <button
                              type="button"
                              onClick={() => setMyJobsPage((prev) => Math.max(1, prev - 1))}
                              disabled={currentJobsPage === 1}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs active:scale-95"
                            >
                              <ChevronLeft className="w-3.5 h-3.5" />
                              <span>Prev</span>
                            </button>

                            <div className="flex items-center gap-1 font-mono text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                              <span>Page</span>
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold border border-slate-200 dark:border-slate-800">
                                {currentJobsPage}
                              </span>
                              <span>of {totalJobsPages}</span>
                            </div>

                            <button
                              type="button"
                              onClick={() => setMyJobsPage((prev) => Math.min(totalJobsPages, prev + 1))}
                              disabled={currentJobsPage === totalJobsPages}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs active:scale-95"
                            >
                              <span>Next</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : authChecking ? (
                /* Auth Checking State */
                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-12 text-center text-slate-500 dark:text-slate-400 shadow-xs space-y-3">
                  <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs sm:text-sm font-medium">Checking student account status...</p>
                </div>
              ) : (
                /* ============================================================== */
                /* GUEST / NOT LOGGED IN VIEW: STUDENT LOGIN CARD                 */
                /* ============================================================== */
                renderAuthCard("Sign in or create an account to track print requests.")
              )}
            </div>
          )}
      </div>


      {/* ========================================================
          POPUP MODAL: PROGRAM GUIDELINES & STATION INFORMATION
         ======================================================== */}
      {mounted && showInfoModal && createPortal(
        <div 
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[9999] bg-slate-950/75 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overscroll-none touch-none select-none"
          style={{
            paddingTop: "max(0.75rem, env(safe-area-inset-top, 0px))",
            paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))",
            paddingLeft: "max(0.75rem, env(safe-area-inset-left, 0px))",
            paddingRight: "max(0.75rem, env(safe-area-inset-right, 0px))",
          }}
          onTouchMove={(e) => {
            if (e.target === e.currentTarget) e.preventDefault();
          }}
          onWheel={(e) => {
            if (e.target === e.currentTarget) e.preventDefault();
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowInfoModal(false);
          }}
        >
          <div 
            style={{
              maxHeight: "calc(100dvh - 1.5rem - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))",
            }}
            className="relative bg-white dark:bg-slate-900 rounded-3xl max-w-4xl lg:max-w-5xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 my-auto z-[10000] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150 font-sans overscroll-contain touch-auto select-text"
            onClick={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
          >
            {/* Modal Header (Pinned shrink-0) */}
            <div className="flex items-center p-5 sm:p-6 lg:px-8 border-b border-slate-100 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900">
              <h2 className="text-xl sm:text-2xl font-black text-slate-950 dark:text-slate-50 tracking-tight">
                Program Guidelines &amp; Station Information
              </h2>
            </div>

            {/* Modal Scrollable Body */}
            <div 
              className="flex-1 min-h-0 overflow-y-auto p-5 sm:p-7 lg:p-8 space-y-4 lg:space-y-5 overscroll-contain no-scrollbar"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              {/* Service Highlights */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-slate-50/80 dark:bg-slate-800/70 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3.5 sm:p-4 shadow-2xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-brand-700 dark:text-brand-400">Educational Assistance</span>
                  <span className="text-[9.5px] font-bold bg-brand-50 dark:bg-brand-950/50 text-brand-700 dark:text-brand-400 border border-brand-200 dark:border-brand-800/70 px-2 py-0.5 rounded-full">100% Free</span>
                </div>
                <p className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <Printer className="w-4 h-4 text-brand-600 dark:text-brand-400 shrink-0" />
                  Zero Printing Fees
                </p>
                <p className="text-[11.5px] text-slate-600 dark:text-slate-400 leading-relaxed">
                  Free paper and ink for modules, reviewers, assignments, and capstones for Tocok students.
                </p>
              </div>

              <div className="bg-slate-50/80 dark:bg-slate-800/70 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3.5 sm:p-4 shadow-2xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Claiming Stations</span>
                  <span className="text-[9.5px] font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/70 px-2 py-0.5 rounded-full">2 Printers</span>
                </div>
                <p className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  Purok 1 &amp; Purok 5
                </p>
                <p className="text-[11.5px] text-slate-600 dark:text-slate-400 leading-relaxed">
                  Printers are held by our Chairperson (Purok 1 - Sitio Bio, Sitio Sagur, Sitio Baybay) and Treasurer (Purok 5 - Sitio Sapdaan). Pick whoever is closest!
                </p>
              </div>

              <div className="bg-slate-50/80 dark:bg-slate-800/70 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3.5 sm:p-4 shadow-2xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">Printing Timeline</span>
                  <span className="text-[9.5px] font-bold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/70 px-2 py-0.5 rounded-full">1–2 Days</span>
                </div>
                <p className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  1–2 Days Turnaround
                </p>
                <p className="text-[11.5px] text-slate-600 dark:text-slate-400 leading-relaxed">
                  Officials attend school/work. Prints ready in 1–2 days, or toggle &quot;Needed Urgently&quot; for rush tasks.
                </p>
              </div>
            </div>

            {/* Program Guidelines */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-2xs space-y-3">
              <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
                <div className="w-7 h-7 rounded-lg bg-brand-50 dark:bg-brand-950/50 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0">
                  <FileCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Program Guidelines</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Barangay Tocok Youth Assistance</p>
                </div>
              </div>

              <ul className="mt-2.5 space-y-2.5 text-xs text-slate-600 dark:text-slate-400">
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-600 mt-1.5 shrink-0"></span>
                  <span><strong className="text-slate-800 dark:text-slate-200">Who is eligible:</strong> Youth aged 15–30 residing in Puroks 1 to 7 of Barangay Tocok, including enrolled students (Junior High, Senior High, and College) and out-of-school youth.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-600 mt-1.5 shrink-0"></span>
                  <span><strong className="text-slate-800 dark:text-slate-200">Accepted materials:</strong> School-related, employment, and other essential personal documents.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-600 mt-1.5 shrink-0"></span>
                  <span><strong className="text-slate-800 dark:text-slate-200">Supported formats:</strong> PDF (recommended for margins), DOCX, PPTX, JPG, and PNG up to 100 MB.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-600 mt-1.5 shrink-0"></span>
                  <span><strong className="text-slate-800 dark:text-slate-200">Paper sizes:</strong> Standard A4, Letter (Short 8.5×11), and Legal (Long 8.5×13).</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Modal Footer (Pinned shrink-0) */}
          <div className="p-4 sm:p-5 lg:px-8 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
            <p className="text-[11px] text-slate-400 dark:text-slate-500 hidden sm:block">
              Sangguniang Kabataan ng Barangay Tocok • Free Youth Printing Services
            </p>
            <button
              type="button"
              onClick={() => setShowInfoModal(false)}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs sm:text-sm shadow-sm transition-colors cursor-pointer"
            >
              Got It, Return to Printing Form
            </button>
          </div>
        </div>
      </div>,
      document.body
    )}

      {/* ========================================================
          POPUP MODAL: OFFICIAL CLAIM TICKET DETAILS
         ======================================================== */}
      {mounted && job && createPortal(
        <div 
          role="dialog"
          aria-modal="true"
          aria-labelledby="claim-ticket-title"
          className="fixed inset-0 z-[9990] bg-slate-950/70 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150 overscroll-none touch-none select-none-callout"
          style={{
            paddingTop: "max(0.75rem, env(safe-area-inset-top, 0px))",
            paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))",
            paddingLeft: "max(0.75rem, env(safe-area-inset-left, 0px))",
            paddingRight: "max(0.75rem, env(safe-area-inset-right, 0px))",
          }}
          onTouchMove={(e) => {
            if (e.target === e.currentTarget) e.preventDefault();
          }}
          onWheel={(e) => {
            if (e.target === e.currentTarget) e.preventDefault();
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !cancelSubmitting) {
              setJob(null);
              setTrackingCode("");
              setTrackError(null);
            }
          }}
        >
          <div 
            style={{
              maxHeight: "calc(100dvh - 1.5rem - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))",
            }}
            className="relative bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 dark:border-slate-800 flex flex-col overflow-hidden animate-in zoom-in-95 duration-150 font-sans my-auto overscroll-contain touch-auto"
            onClick={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
          >
            <JobDetailsView
              job={job}
              onRefresh={() => handleLookup(job.tracking_code)}
              getStepStatus={getStepStatus}
              isOwner={job.is_owner ?? myJobs.some((m) => m.tracking_code === job.tracking_code)}
              onClose={() => {
                setJob(null);
                setTrackingCode("");
                setTrackError(null);
              }}
              onCancel={(j) => setJobToCancel(j)}
              cancelling={cancelSubmitting}
            />
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================
          POPUP MODAL: TICKET LOOKUP / TRACK SEARCH (SHARED)
         ======================================================== */}
      <SearchModal
        open={showManualSearch}
        onClose={() => setShowManualSearch(false)}
        ariaLabel="Lookup ticket number"
        placeholder="Search ticket code (e.g. SK104, #12)..."
        value={trackingCode}
        onChange={(val) => {
          setTrackingCode(val);
          if (trackError) setTrackError(null);
        }}
        onSubmit={async () => {
          const ok = await handleLookup(trackingCode);
          if (ok) {
            setShowManualSearch(false);
            setTimeout(() => {
              document.getElementById("claim-ticket-details")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }, 150);
          }
        }}
        loading={trackingLoading}
        required
        error={trackError ? "Ticket not found. Please check your ticket number and try again." : null}
      />

      {/* ========================================================
          POPUP MODAL: CANCEL PRINT REQUEST CONFIRMATION
         ======================================================== */}
      {mounted && jobToCancel && createPortal(
        <div 
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[9999] bg-slate-950/70 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150 overscroll-none touch-none select-none select-none-callout"
          style={{
            paddingTop: "max(0.75rem, env(safe-area-inset-top, 0px))",
            paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))",
            paddingLeft: "max(0.75rem, env(safe-area-inset-left, 0px))",
            paddingRight: "max(0.75rem, env(safe-area-inset-right, 0px))",
          }}
          onTouchMove={(e) => {
            if (e.target === e.currentTarget) e.preventDefault();
          }}
          onWheel={(e) => {
            if (e.target === e.currentTarget) e.preventDefault();
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !cancelSubmitting) setJobToCancel(null);
          }}
        >
          <div 
            style={{
              maxHeight: "calc(100dvh - 1.5rem - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))",
              WebkitTouchCallout: "none",
              WebkitUserSelect: "none",
              userSelect: "none",
            }}
            className="relative bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 dark:border-slate-800 flex flex-col overflow-hidden animate-in zoom-in-95 duration-150 font-sans my-auto overscroll-contain touch-auto select-none select-none-callout"
            onClick={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
          >
            {/* Modal Header (Pinned shrink-0) */}
            <div className="flex items-start justify-between gap-3 p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900 select-none select-none-callout">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 flex items-center justify-center border border-rose-200/70 dark:border-rose-800/70 shadow-2xs shrink-0">
                  <Trash2 className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                    Cancel Print Request?
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {jobToCancel.tracking_code.startsWith("SK") || jobToCancel.tracking_code.startsWith("PRN") ? `Ticket ${jobToCancel.tracking_code}` : `Ticket #${jobToCancel.tracking_code}`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={cancelSubmitting}
                onClick={() => setJobToCancel(null)}
                className="p-1.5 rounded-xl text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer shrink-0 disabled:opacity-50"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body (Scrollable flex-1 min-h-0) */}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-5 sm:p-6 space-y-4 select-none select-none-callout">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-800 text-xs space-y-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500 block">Document to Cancel</span>
                <p className="font-bold text-slate-900 dark:text-slate-100 text-sm truncate">{jobToCancel.file_name}</p>
                <p className="text-slate-500 dark:text-slate-400">
                  {[
                    `${jobToCancel.copies || 1} ${(jobToCancel.copies || 1) > 1 ? "copies" : "copy"}`,
                    jobToCancel.paper_size,
                    jobToCancel.print_type,
                  ].filter(Boolean).join(" • ")}
                </p>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Are you sure you want to cancel this request? It will be removed from the SK printing review queue. This action cannot be undone.
              </p>

              {/* Tap & Hold Instructional Safety Hint */}
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-50/90 dark:bg-amber-950/45 border border-amber-200 dark:border-amber-800/70 text-[11.5px] text-amber-900 dark:text-amber-200">
                <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>
                  Press and hold the button below for <strong>1.5 seconds</strong> to confirm cancellation.
                </span>
              </div>

              {cancelError && (
                <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/70 text-rose-800 dark:text-rose-300 text-xs flex items-center gap-2 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                  <span>{cancelError}</span>
                </div>
              )}
            </div>

            {/* Modal Footer (Pinned shrink-0) */}
            <div className="flex flex-col sm:flex-row gap-2.5 p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 shrink-0 select-none select-none-callout">
              <button
                type="button"
                disabled={cancelSubmitting}
                onClick={() => setJobToCancel(null)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs sm:text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer disabled:opacity-50 select-none select-none-callout"
              >
                Keep Request
              </button>
              <HoldToConfirmButton
                onConfirm={handleConfirmCancel}
                loading={cancelSubmitting}
                durationMs={1500}
                label="Tap & Hold to Cancel"
                holdingLabel="Keep holding..."
                loadingLabel="Cancelling..."
                className="w-full sm:flex-1 py-3 px-4 rounded-xl text-white font-bold text-xs sm:text-sm shadow-md shadow-rose-500/20"
              />
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================
          FULL SCREEN NOTICE: SUBMISSION & UPLOAD IN PROGRESS
          Edge-to-edge full screen experience (no floating card)
         ======================================================== */}
      {mounted && submitting && createPortal(
        <div 
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="uploading-screen-title"
          aria-describedby="uploading-screen-desc"
          className="fixed inset-0 z-[99999] bg-white dark:bg-slate-900 flex flex-col justify-between select-none touch-none overscroll-contain animate-in fade-in duration-200 cursor-wait pointer-events-auto"
          style={{
            touchAction: "none",
            paddingTop: "max(1.25rem, env(safe-area-inset-top, 0px))",
            paddingBottom: "max(1.25rem, env(safe-area-inset-bottom, 0px))",
            paddingLeft: "max(1.25rem, env(safe-area-inset-left, 0px))",
            paddingRight: "max(1.25rem, env(safe-area-inset-right, 0px))",
          }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onTouchMove={(e) => e.preventDefault()}
          onWheel={(e) => e.preventDefault()}
          onContextMenu={(e) => e.preventDefault()}
        >
          {/* Top Brand Bar */}
          <div className="w-full max-w-md mx-auto flex items-center justify-between pt-1 px-1">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-brand-50 dark:bg-brand-950/50 border border-brand-200/80 dark:border-brand-800/70 flex items-center justify-center text-brand-700 dark:text-brand-400 shadow-2xs shrink-0">
                <Printer className="w-4 h-4" />
              </div>
              <div className="text-left">
                <p className="text-xs font-black text-slate-900 dark:text-slate-100 leading-tight">
                  Sangguniang Kabataan
                </p>
                <p className="text-[10px] font-bold text-brand-700 dark:text-brand-400 tracking-wider uppercase">
                  Barangay Tocok
                </p>
              </div>
            </div>

            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/70 text-emerald-800 dark:text-emerald-300 text-[11px] font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Uploading</span>
            </div>
          </div>

          {/* Center Content Area */}
          <div className="w-full max-w-sm mx-auto flex flex-col items-center text-center space-y-6 my-auto py-6">
            {/* Circular Progress Gauge */}
            <div className="relative w-32 h-32 flex items-center justify-center">
              {/* Subtle background glow */}
              <div className="absolute inset-2 rounded-full bg-brand-500/10 dark:bg-brand-500/15 blur-xl animate-pulse" />

              {/* Circular SVG Track & Dynamic Progress Ring */}
              <svg className="w-32 h-32 -rotate-90 transform" viewBox="0 0 120 120">
                <circle
                  cx="60"
                  cy="60"
                  r="50"
                  className="text-slate-100"
                  strokeWidth="8"
                  stroke="currentColor"
                  fill="transparent"
                />
                <circle
                  cx="60"
                  cy="60"
                  r="50"
                  className="text-brand-600 dark:text-brand-400 transition-all duration-300 ease-out"
                  strokeWidth="8"
                  strokeDasharray={2 * Math.PI * 50}
                  strokeDashoffset={2 * Math.PI * 50 * (1 - Math.max(uploadProgress, 5) / 100)}
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="transparent"
                />
              </svg>

              {/* Center Content inside Ring */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                <Upload className="w-6 h-6 text-brand-700 dark:text-brand-400 animate-bounce mb-0.5" />
                <span className="text-xl font-mono font-black text-slate-900 dark:text-slate-100 leading-none">
                  {uploadProgress}%
                </span>
              </div>
            </div>

            {/* Typography */}
            <div className="space-y-1.5 px-2">
              <h2 id="uploading-screen-title" className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                Uploading Your Request
              </h2>
              <p id="uploading-screen-desc" className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                {uploadProgress < 100
                  ? "Please stay on this page while your document is being uploaded so it completes properly."
                  : "Upload complete! Preparing your official claim ticket..."}
              </p>
            </div>

            {/* Document Capsule */}
            {selectedFile && (
              <div className="w-full max-w-xs inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-full bg-slate-50 dark:bg-slate-800/70 border border-slate-200/90 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium shadow-2xs">
                <FileText className="w-4 h-4 text-brand-600 dark:text-brand-400 shrink-0" />
                <span className="font-bold text-slate-900 dark:text-slate-100 truncate max-w-[150px]">
                  {selectedFile.name}
                </span>
                <span className="text-slate-400 dark:text-slate-500 shrink-0">•</span>
                <span className="text-slate-500 dark:text-slate-400 font-semibold shrink-0">
                  {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                </span>
              </div>
            )}

            {/* Linear Progress Bar with Step Label */}
            <div className="w-full max-w-xs space-y-1.5 pt-1">
              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-200/60 dark:border-slate-700/70">
                <div
                  className="bg-gradient-to-r from-brand-600 to-emerald-500 h-full rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${Math.max(uploadProgress, 5)}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400 px-0.5">
                <span className="flex items-center gap-1.5 text-brand-700 dark:text-brand-400">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  {uploadStatusText}
                </span>
                <span className="font-mono text-slate-600 dark:text-slate-400">{uploadProgress}%</span>
              </div>
            </div>
          </div>

          {/* Bottom Screen Lock Notice */}
          <div className="w-full max-w-sm mx-auto text-center pb-2 px-2">
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-800/90 text-slate-700 dark:text-slate-300 text-xs font-semibold mb-1.5 shadow-2xs">
              <Lock className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
              <span>Stay on this page until upload finishes</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-normal leading-relaxed">
              Keep this page open so your document uploads properly. Do not close, reload, or switch away.
            </p>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function PrintingFallback() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-5 sm:py-8 space-y-6 min-h-[120vh]">
      {/* Top Segmented Control Skeleton */}
      <div className="max-w-md mx-auto w-full h-11 bg-slate-200/70 dark:bg-slate-700/70 rounded-2xl animate-pulse" />

      {/* Form Container Skeleton */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xs">
        <div className="h-6 w-48 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse" />
        <div className="space-y-4">
          <div className="h-10 w-full bg-slate-50 dark:bg-slate-800/70 border border-slate-100 dark:border-slate-800 rounded-xl animate-pulse" />
          <div className="h-10 w-full bg-slate-50 dark:bg-slate-800/70 border border-slate-100 dark:border-slate-800 rounded-xl animate-pulse" />
          <div className="h-28 w-full bg-slate-50 dark:bg-slate-800/70 border border-slate-100 dark:border-slate-800 rounded-xl animate-pulse" />
        </div>
      </div>
    </div>
  );
}

export default function PrintingPage() {
  return (
    <Suspense fallback={<PrintingFallback />}>
      <UnifiedPrintingContent />
    </Suspense>
  );
}
