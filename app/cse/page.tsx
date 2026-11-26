"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "next/navigation";
import {
  Award,
  GraduationCap,
  Receipt,
  Upload,
  CheckCircle2,
  AlertCircle,
  Clock,
  Search,
  Copy,
  Check,
  ChevronRight,
  ChevronLeft,
  ShieldCheck,
  Info,
  FileText,
  X,
  Loader2,
  Trophy,
  Camera,
  Lock,
  RotateCw,
} from "lucide-react";
import SearchModal from "@/components/SearchModal";
import { useAuth, isOfficialRole, type AuthUser } from "@/components/AuthProvider";
import {
  getHorizontalPillStyle,
  getVerticalRailPillStyle,
  useTabPanelDirection,
} from "@/components/useTabPanelDirection";
import {
  PUROK_OPTIONS,
  PUROK_CARDS,
  DEFAULT_ANNUAL_SLOTS,
  MAX_EXAM_SUBSIDY_CAP,
  EXAM_CATEGORY_OPTIONS,
  resolveExamFeeAndSubsidy,
  getReimbursementBadge,
  getAttendanceBadge,
  getResultBadge,
  getExamCycleGate,
  type ExamCategory,
  type ExamLevel,
  type CseApplication,
  type CsePublicPasser,
} from "@/lib/cse";

interface CseProgramStats {
  quotaSlots: number;
  totalBudget: number;
  totalApplications: number;
  approvedOrReimbursedCount: number;
  reimbursedCount: number;
  totalReimbursedAmount: number;
  remainingSlots: number;
  remainingBudget: number;
  verifiedAttendedCount: number;
  totalPassers: number;
  retakerSlotCap?: number;
  retakerSlotsUsed?: number;
  purokBreakdown: Record<string, number>;
}

async function compressImageForUpload(file: File): Promise<File> {
  if (
    typeof window === "undefined" ||
    file.type === "application/pdf" ||
    file.name.toLowerCase().endsWith(".pdf") ||
    file.size <= 450 * 1024
  ) {
    return file;
  }

  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      try {
        const maxDim = 1600;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          resolve(file);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(objectUrl);
            if (blob && blob.size > 0 && blob.size < file.size) {
              const baseName = file.name.replace(/\.[^.]+$/, "") || "document";
              resolve(new File([blob], `${baseName}.jpg`, { type: "image/jpeg" }));
            } else {
              resolve(file);
            }
          },
          "image/jpeg",
          0.82
        );
      } catch {
        URL.revokeObjectURL(objectUrl);
        resolve(file);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };

    img.src = objectUrl;
  });
}

async function parseApiResponse<T extends { error?: string; success?: boolean }>(
  res: Response
): Promise<T> {
  const raw = await res.text();
  try {
    return JSON.parse(raw) as T;
  } catch {
    if (res.status === 413) {
      throw new Error("Uploaded photos are too large for the server. Please use smaller images.");
    }
    throw new Error(
      `Server returned an unexpected response (HTTP ${res.status}). Please refresh and try again.`
    );
  }
}

// Touch-optimized file uploader component
function MobileUploadCard({
  label,
  sublabel,
  file,
  onFileSelect,
  accept = "image/*,.pdf",
  required = false,
  icon: Icon = Upload,
  compact = false,
}: {
  label: string;
  sublabel: string;
  file: File | null;
  onFileSelect: (f: File | null) => void;
  accept?: string;
  required?: boolean;
  icon?: React.ElementType;
  compact?: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0] || null;
    if (!picked) {
      onFileSelect(null);
      return;
    }
    const processed = await compressImageForUpload(picked);
    onFileSelect(processed);
  };

  if (compact) {
    return (
      <div
        onClick={() => fileInputRef.current?.click()}
        className={`border rounded-xl px-2.5 py-2 transition-all cursor-pointer touch-manipulation active:scale-[0.99] ${
          file
            ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20"
            : "border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/40 hover:border-brand-500 hover:bg-brand-50/30"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          required={required}
          onChange={handleFileChange}
          className="sr-only"
        />
        <div className="flex items-center gap-2.5">
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
              file
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300"
                : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
            }`}
          >
            {file ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Icon className="w-4 h-4" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-900 dark:text-white leading-tight truncate">
                {label}
              </span>
              {file ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (fileInputRef.current) fileInputRef.current.value = "";
                    onFileSelect(null);
                  }}
                  className="shrink-0 px-1.5 py-0.5 rounded-md text-[10px] font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors touch-manipulation"
                >
                  Remove
                </button>
              ) : (
                <span className="shrink-0 inline-flex items-center gap-1 text-[10.5px] font-bold text-brand-600 dark:text-brand-400">
                  <Camera className="w-3 h-3" />
                  <span>Upload</span>
                </span>
              )}
            </div>
            {file ? (
              <p className="text-[10.5px] font-semibold text-emerald-700 dark:text-emerald-300 truncate mt-0.5 leading-tight">
                {file.name} ({(file.size / 1024).toFixed(0)} KB)
              </p>
            ) : (
              <p className="text-[10.5px] text-slate-500 dark:text-slate-400 truncate mt-0.5 leading-tight">
                {sublabel}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={() => fileInputRef.current?.click()}
      className={`border-2 rounded-2xl p-4 sm:p-4 transition-all cursor-pointer touch-manipulation active:scale-[0.99] ${
        file
          ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20"
          : "border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/40 hover:border-brand-500 hover:bg-brand-50/30"
      }`}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        required={required}
        onChange={handleFileChange}
        className="sr-only"
      />
      <div className="flex items-start gap-3">
        <div
          className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
            file
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300"
              : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
          }`}
        >
          {file ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <Icon className="w-5 h-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <span className="block text-xs sm:text-sm font-bold text-slate-900 dark:text-white leading-tight">
            {label}
          </span>
          <span className="text-[11px] text-slate-500 block leading-normal mt-0.5">
            {sublabel}
          </span>
          {file ? (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-100/90 dark:bg-emerald-950/80 text-emerald-900 dark:text-emerald-200 text-xs font-semibold max-w-full min-w-0">
                <span className="truncate">{file.name}</span>
                <span className="shrink-0 text-[10px] text-emerald-700 dark:text-emerald-400">
                  ({(file.size / 1024).toFixed(0)} KB)
                </span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (fileInputRef.current) fileInputRef.current.value = "";
                  onFileSelect(null);
                }}
                className="px-2 py-1 rounded-lg text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors touch-manipulation"
              >
                Remove
              </button>
            </div>
          ) : (
            <span className="inline-flex items-center gap-1 mt-2 text-[11px] font-bold text-brand-600 dark:text-brand-400">
              <Camera className="w-3 h-3" />
              <span>Tap to pick file or take photo</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

const MOCK_PREVIEW_PASSERS: CsePublicPasser[] = [
  {
    id: -1,
    full_name: "Maria Clara Bautista",
    avatar_url: "/images/passers/bautista.jpg",
    purok: "Purok 2 (Centro)",
    exam_category: "Civil Service Exam (CSE)",
    exam_level: "Professional",
    exam_date: "March 2027 CSE-PPT",
    rating: 86.42,
    result_verified_at: null,
  },
  {
    id: -2,
    full_name: "Mark Anthony Soriano",
    avatar_url: "/images/passers/soriano.jpg",
    purok: "Purok 5 (Sitio Sapdaan)",
    exam_category: "LET / PRC Board Exam",
    exam_level: "LET (Secondary)",
    exam_date: "September 2027 LEPT (LET)",
    rating: 84.8,
    result_verified_at: null,
  },
  {
    id: -3,
    full_name: "Angelica Mae Ferrer",
    avatar_url: "/images/passers/ferrer.jpg",
    purok: "Purok 7 (Sitio Torres)",
    exam_category: "TESDA NC Assessment",
    exam_level: "NC II",
    exam_date: "Q1 2027 Assessment (Jan–Mar)",
    rating: null,
    result_verified_at: null,
  },
  {
    id: -4,
    full_name: "John Carlo Mendoza",
    avatar_url: "/images/passers/mendoza.jpg",
    purok: "Purok 1 (Sitio Bio, Sitio Sagur, Sitio Lablabay)",
    exam_category: "PhilNITS Certification",
    exam_level: "IT Passport (IP)",
    exam_date: "April 2027 PhilNITS Exam",
    rating: null,
    result_verified_at: null,
  },
  {
    id: -5,
    full_name: "Clarisse Joy Villanueva",
    avatar_url: "/images/passers/villanueva.jpg",
    purok: "Purok 3 (Sitio Boquig)",
    exam_category: "Civil Service Exam (CSE)",
    exam_level: "SubProfessional",
    exam_date: "March 2027 CSE-PPT",
    rating: 83.15,
    result_verified_at: null,
  },
  {
    id: -6,
    full_name: "Gabriel Luis Padilla",
    avatar_url: "/images/passers/padilla.jpg",
    purok: "Purok 4 (Sitio Buatan)",
    exam_category: "LET / PRC Board Exam",
    exam_level: "PRC Licensure (Non-LET)",
    exam_date: "May 2027 PRC Board",
    rating: 85.6,
    result_verified_at: null,
  },
  {
    id: -7,
    full_name: "Patricia Anne Aquino",
    avatar_url: "/images/passers/aquino.jpg",
    purok: "Purok 6 (Sitio Cabanlig, Sitio Biday, Sitio Apatut)",
    exam_category: "LET / PRC Board Exam",
    exam_level: "LET (Elementary)",
    exam_date: "March 2027 LEPT (LET)",
    rating: 87.2,
    result_verified_at: null,
  },
  {
    id: -8,
    full_name: "Kevin Paolo Ramos",
    avatar_url: "/images/passers/ramos.jpg",
    purok: "Purok 1 (Sitio Bio, Sitio Sagur, Sitio Lablabay)",
    exam_category: "TESDA NC Assessment",
    exam_level: "NC III",
    exam_date: "Q2 2027 Assessment (Apr–Jun)",
    rating: null,
    result_verified_at: null,
  },
  {
    id: -9,
    full_name: "Bianca Nicole Navarro",
    avatar_url: "/images/passers/navarro.jpg",
    purok: "Purok 6 (Sitio Cabanlig, Sitio Biday, Sitio Apatut)",
    exam_category: "Civil Service Exam (CSE)",
    exam_level: "Professional",
    exam_date: "August 2027 CSE-PPT",
    rating: 88.05,
    result_verified_at: null,
  },
];

function parsePasserName(rawName: string): { firstName: string; lastName: string; initials: string } {
  const trimmed = String(rawName || "").trim();
  if (!trimmed) {
    return { firstName: "", lastName: "PASSER", initials: "PR" };
  }

  // Handle "Last, First Middle" format
  if (trimmed.includes(",")) {
    const [rawLast, ...rest] = trimmed.split(",");
    const lastParts = rawLast.trim().split(/\s+/).filter(Boolean);
    const firstParts = rest.join(" ").trim().split(/\s+/).filter(Boolean);
    if (lastParts.length > 0 && firstParts.length > 0) {
      const lastName = lastParts.join(" ").toUpperCase();
      const firstName = firstParts.join(" ");
      const initials = (firstParts[0][0] + lastParts[0][0]).toUpperCase();
      return { firstName, lastName, initials };
    }
  }

  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { firstName: "", lastName: "PASSER", initials: "PR" };
  }
  if (parts.length === 1) {
    const clean = parts[0];
    return {
      firstName: "",
      lastName: clean.toUpperCase(),
      initials: clean.slice(0, 2).toUpperCase(),
    };
  }
  const lastName = parts[parts.length - 1].toUpperCase();
  const firstName = parts.slice(0, parts.length - 1).join(" ");
  const initials = (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return { firstName, lastName, initials };
}

const EXAM_BADGE_MAP: Record<
  string,
  { short: string; pillClass: string; cardAccent: string; ringClass: string; avatarBg: string }
> = {
  "Civil Service Exam (CSE)": {
    short: "CSE",
    pillClass:
      "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/70 dark:text-blue-300 dark:border-blue-800/80",
    cardAccent:
      "from-blue-50/50 to-white dark:from-slate-800/60 dark:to-slate-800/30 border-blue-200/80 dark:border-blue-900/40",
    ringClass: "ring-blue-500/85 dark:ring-blue-400/75",
    avatarBg: "from-blue-500 to-indigo-600 text-white",
  },
  "LET / PRC Board Exam": {
    short: "LET / PRC",
    pillClass:
      "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800/80",
    cardAccent:
      "from-emerald-50/50 to-white dark:from-slate-800/60 dark:to-slate-800/30 border-emerald-200/80 dark:border-emerald-900/40",
    ringClass: "ring-emerald-500/85 dark:ring-emerald-400/75",
    avatarBg: "from-emerald-500 to-teal-600 text-white",
  },
  "PhilNITS Certification": {
    short: "PhilNITS",
    pillClass:
      "bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-950/70 dark:text-violet-300 dark:border-violet-800/80",
    cardAccent:
      "from-violet-50/50 to-white dark:from-slate-800/60 dark:to-slate-800/30 border-violet-200/80 dark:border-violet-900/40",
    ringClass: "ring-violet-500/85 dark:ring-violet-400/75",
    avatarBg: "from-violet-500 to-purple-600 text-white",
  },
  "TESDA NC Assessment": {
    short: "TESDA NC",
    pillClass:
      "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800/80",
    cardAccent:
      "from-amber-50/50 to-white dark:from-slate-800/60 dark:to-slate-800/30 border-amber-200/80 dark:border-amber-900/40",
    ringClass: "ring-amber-500/85 dark:ring-amber-400/75",
    avatarBg: "from-amber-500 to-orange-600 text-white",
  },
  "Other Licensure / Certification": {
    short: "Certification",
    pillClass:
      "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-800/80",
    cardAccent:
      "from-rose-50/50 to-white dark:from-slate-800/60 dark:to-slate-800/30 border-rose-200/80 dark:border-rose-900/40",
    ringClass: "ring-rose-500/85 dark:ring-rose-400/75",
    avatarBg: "from-rose-500 to-pink-600 text-white",
  },
};

function useAnimatedModal() {
  const [open, setOpenState] = useState(false);
  const [closing, setClosing] = useState(false);
  const stateRef = useRef({ open: false, closing: false });
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  const setOpen = useCallback((next: boolean) => {
    if (next) {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      stateRef.current = { open: true, closing: false };
      setClosing(false);
      setOpenState(true);
      return;
    }
    if (!stateRef.current.open || stateRef.current.closing) return;
    stateRef.current = { open: true, closing: true };
    setClosing(true);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      stateRef.current = { open: false, closing: false };
      setOpenState(false);
      setClosing(false);
    }, 190);
  }, []);

  return { open, closing, setOpen };
}

const CSE_TABS = [
  { id: "apply", label: "Apply for Reimbursement", shortLabel: "Apply", icon: FileText },
  { id: "track", label: "Track & Upload Proof", shortLabel: "Track", icon: Clock },
  { id: "transparency", label: "Transparency & Passers", shortLabel: "Passers", icon: Trophy },
] as const;

type CseTab = (typeof CSE_TABS)[number]["id"];
const CSE_TAB_ORDER: readonly CseTab[] = CSE_TABS.map((t) => t.id);

function CseContent() {
  const searchParams = useSearchParams();
  const initialTrackCode = searchParams.get("code") || "";

  const {
    user: currentUser,
    authLoading: authChecking,
    setUser: setCurrentUser,
  } = useAuth();

  // Resident / Katipunan ng Kabataan Auth State
  const [authMode, setAuthMode] = useState<"signin" | "register">("signin");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authConfirmPassword, setAuthConfirmPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [googleConfig, setGoogleConfig] = useState<{
    loaded: boolean;
    configured: boolean;
    clientId: string | null;
    mode: "gis" | "redirect" | "unconfigured" | null;
  }>({
    loaded: false,
    configured: false,
    clientId: null,
    mode: null,
  });

  const [myApplications, setMyApplications] = useState<CseApplication[]>([]);
  const [myAppPage, setMyAppPage] = useState(1);

  const [activeTab, setActiveTab] = useState<CseTab>("apply");
  const tabAnimClass = useTabPanelDirection(activeTab, CSE_TAB_ORDER);
  const [stats, setStats] = useState<CseProgramStats | null>(null);
  const [passers, setPassers] = useState<CsePublicPasser[]>([]);
  const [passersPage, setPassersPage] = useState(1);
  const [targetBatch, setTargetBatch] = useState<string>("March 2027 CSE-PPT");

  // Track Form State
  const [trackInput, setTrackInput] = useState(initialTrackCode);
  const [trackedApp, setTrackedApp] = useState<CseApplication | null>(null);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackError, setTrackError] = useState<string | null>(null);
  const [showManualSearch, setShowManualSearch] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Apply Form State
  const [applyStep, setApplyStep] = useState<1 | 2 | 3 | 4>(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);

  // Form Fields
  const [fullName, setFullName] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [email, setEmail] = useState("");
  const [purok, setPurok] = useState<string>(PUROK_OPTIONS[0]);
  const [birthdate, setBirthdate] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthDay, setBirthDay] = useState("");
  const [birthYear, setBirthYear] = useState("");

  const currentYear = new Date().getFullYear();
  const eligibleBirthYears = Array.from({ length: 17 }, (_, idx) => String(currentYear - 15 - idx));
  const maxDaysInBirthMonth =
    birthMonth ? new Date(Number(birthYear || 2000), Number(birthMonth), 0).getDate() : 31;

  const handleBirthPartChange = (part: "m" | "d" | "y", val: string) => {
    const nextM = part === "m" ? val : birthMonth;
    let nextD = part === "d" ? val : birthDay;
    const nextY = part === "y" ? val : birthYear;

    if (nextM && nextD) {
      const maxD = new Date(Number(nextY || 2000), Number(nextM), 0).getDate();
      if (Number(nextD) > maxD) {
        nextD = String(maxD).padStart(2, "0");
      }
    }

    setBirthMonth(nextM);
    setBirthDay(nextD);
    setBirthYear(nextY);

    if (nextM && nextD && nextY) {
      setBirthdate(`${nextY}-${nextM}-${nextD}`);
    } else {
      setBirthdate("");
    }
  };

  const [examCategory, setExamCategory] = useState<ExamCategory>("Civil Service Exam (CSE)");
  const [examSwitchDir, setExamSwitchDir] = useState<"next" | "prev" | null>(null);
  const [examLevel, setExamLevel] = useState<ExamLevel>("Professional");
  const [examFeePaid, setExamFeePaid] = useState<string>("500");
  const [selectedBatchOption, setSelectedBatchOption] = useState<string>("March 2027 CSE-PPT");
  const [customBatch, setCustomBatch] = useState<string>("");
  const [examDate, setExamDate] = useState("March 2027 CSE-PPT");
  const [isFirstTime, setIsFirstTime] = useState(true);
  const [warningNotice, setWarningNotice] = useState<string | null>(null);
  const [cscReceiptNo, setCscReceiptNo] = useState("");

  // Files
  const [validIdFile, setValidIdFile] = useState<File | null>(null);
  const [cscReceiptFile, setCscReceiptFile] = useState<File | null>(null);
  const [examScheduleFile, setExamScheduleFile] = useState<File | null>(null);
  const [priorSittingProofFile, setPriorSittingProofFile] = useState<File | null>(null);

  // Self-service modal updates in tracking
  const {
    open: showAttendanceModal,
    closing: attendanceModalClosing,
    setOpen: setShowAttendanceModal,
  } = useAnimatedModal();
  const [attendanceProofFile, setAttendanceProofFile] = useState<File | null>(null);
  const [attendanceSubmitting, setAttendanceSubmitting] = useState(false);
  const [attendanceMsg, setAttendanceMsg] = useState<string | null>(null);

  const {
    open: showResultModal,
    closing: resultModalClosing,
    setOpen: setShowResultModal,
  } = useAnimatedModal();
  const [resultStatus, setResultStatus] = useState<"Passed" | "Did Not Pass">("Passed");
  const [ratingInput, setRatingInput] = useState("");
  const [resultProofFile, setResultProofFile] = useState<File | null>(null);
  const [passerAvatarFile, setPasserAvatarFile] = useState<File | null>(null);
  const [passerAvatarPreviewUrl, setPasserAvatarPreviewUrl] = useState<string | null>(null);
  const [featureConsent, setFeatureConsent] = useState(true);

  useEffect(() => {
    if (!passerAvatarFile) {
      setPasserAvatarPreviewUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(passerAvatarFile);
    setPasserAvatarPreviewUrl(objectUrl);
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [passerAvatarFile]);

  const [resultSubmitting, setResultSubmitting] = useState(false);
  const [resultMsg, setResultMsg] = useState<string | null>(null);
  const [trackSuccessMsg, setTrackSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!trackSuccessMsg) return;
    const timer = window.setTimeout(() => {
      setTrackSuccessMsg(null);
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [trackSuccessMsg]);
  const {
    open: showInfoModal,
    closing: infoModalClosing,
    setOpen: setShowInfoModal,
  } = useAnimatedModal();
  const {
    open: showPasserModal,
    closing: passerModalClosing,
    setOpen: setShowPasserModal,
  } = useAnimatedModal();
  const [selectedPasser, setSelectedPasser] = useState<CsePublicPasser | null>(null);
  const [failedPasserAvatars, setFailedPasserAvatars] = useState<Record<number, boolean>>({});
  const [mounted, setMounted] = useState(false);
  const formCardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock background scroll, close on Escape, & hide mobile bottom nav when modal bottom-sheets are open
  useEffect(() => {
    if (showAttendanceModal || showResultModal || showInfoModal || showPasserModal) {
      document.documentElement.dataset.modalOpen = "true";
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          setShowInfoModal(false);
          setShowAttendanceModal(false);
          setShowResultModal(false);
          setShowPasserModal(false);
        }
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => {
        window.removeEventListener("keydown", handleKeyDown);
        delete document.documentElement.dataset.modalOpen;
        document.body.style.overflow = prevOverflow;
      };
    }
    delete document.documentElement.dataset.modalOpen;
  }, [
    showAttendanceModal,
    showResultModal,
    showInfoModal,
    showPasserModal,
    setShowAttendanceModal,
    setShowResultModal,
    setShowInfoModal,
    setShowPasserModal,
  ]);

  // Floating validation toast renders in a fixed viewport portal, so keep card scroll steady
  const scrollFormErrorIntoView = () => {};

  // Snap mobile viewport back after virtual keyboard closes or user moves between steps
  useEffect(() => {
    if (activeTab !== "apply" || typeof window === "undefined") return;
    const formCardEl = formCardRef.current;
    if (!formCardEl) return;

    let savedScrollY: number | null = null;
    let keyboardWasOpen = false;
    let restoreTimer: number | null = null;
    const maxViewportHeight = Math.max(window.innerHeight, window.visualViewport?.height ?? 0);

    const isFormControl = (target: EventTarget | null) =>
      target instanceof HTMLInputElement ||
      target instanceof HTMLSelectElement ||
      target instanceof HTMLTextAreaElement;

    const clearRestoreTimer = () => {
      if (restoreTimer !== null) {
        window.clearTimeout(restoreTimer);
        restoreTimer = null;
      }
    };

    const scheduleScrollRestore = () => {
      clearRestoreTimer();
      restoreTimer = window.setTimeout(() => {
        if (window.innerWidth >= 768) return;
        const active = document.activeElement;
        if (active && formCardEl.contains(active) && isFormControl(active)) return;
        const targetY = savedScrollY ?? 0;
        savedScrollY = null;
        keyboardWasOpen = false;
        if (Math.abs(window.scrollY - targetY) > 4) {
          window.scrollTo({ top: targetY, behavior: "smooth" });
        }
      }, 140);
    };

    const handleFocusIn = (e: FocusEvent) => {
      if (window.innerWidth >= 768 || !isFormControl(e.target)) return;
      clearRestoreTimer();
      if (savedScrollY === null) {
        savedScrollY = window.scrollY;
      }
    };

    const handleFocusOut = (e: FocusEvent) => {
      if (window.innerWidth >= 768 || !isFormControl(e.target)) return;
      scheduleScrollRestore();
    };

    const vv = window.visualViewport;
    const handleViewportResize = () => {
      if (!vv || window.innerWidth >= 768) return;
      const heightDrop = Math.max(maxViewportHeight, window.innerHeight) - vv.height;
      if (heightDrop > 120) {
        keyboardWasOpen = true;
      } else if (keyboardWasOpen && heightDrop < 80) {
        keyboardWasOpen = false;
        scheduleScrollRestore();
      }
    };

    formCardEl.addEventListener("focusin", handleFocusIn);
    formCardEl.addEventListener("focusout", handleFocusOut);
    vv?.addEventListener("resize", handleViewportResize);

    return () => {
      clearRestoreTimer();
      formCardEl.removeEventListener("focusin", handleFocusIn);
      formCardEl.removeEventListener("focusout", handleFocusOut);
      vv?.removeEventListener("resize", handleViewportResize);
    };
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "apply" && typeof window !== "undefined" && window.innerWidth < 768 && window.scrollY > 0) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [activeTab, applyStep]);

  // Fetch public stats & Hall of Fame
  const fetchProgramData = async () => {
    try {
      const res = await fetch("/api/cse");
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
        setPassers(data.passers || []);
        if (data.myApplications) {
          setMyApplications(data.myApplications);
        }
        if (data.program?.targetExamBatch) {
          setTargetBatch(data.program.targetExamBatch);
          setExamDate(data.program.targetExamBatch);
          setSelectedBatchOption(data.program.targetExamBatch);
        }
      }
    } catch (err) {
      console.error("Failed to fetch CSE program data:", err);
    }
  };

  useEffect(() => {
    fetchProgramData();
  }, []);

  // Sync resident data when currentUser changes
  useEffect(() => {
    if (currentUser) {
      if (currentUser.name) setFullName((prev) => prev || currentUser.name || "");
      if (currentUser.email) setEmail((prev) => prev || currentUser.email || "");
      if (currentUser.contact_number) setContactNumber((prev) => prev || currentUser.contact_number || "");
    }
    fetchProgramData();
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
          : "/cse";
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
              if (data.user?.name) setFullName(data.user.name);
              if (data.user?.email) setEmail(data.user.email);
              if (data.user?.contact_number) setContactNumber(data.user.contact_number);
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
      "Google Sign-In is not configured yet. Please sign in with email below."
    );
  };

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
      let data: { error?: string; user?: AuthUser } = {};
      try {
        data = JSON.parse(text);
      } catch {
        data = { error: text || "Login failed" };
      }
      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }
      setCurrentUser(data.user ?? null);
      if (data.user?.name) setFullName(data.user.name);
      if (data.user?.email) setEmail(data.user.email);
      if (data.user?.contact_number) setContactNumber(data.user.contact_number);
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
      setAuthError("Please enter your full name.");
      return;
    }
    if (!authEmail.trim()) {
      setAuthError("Please enter your email address.");
      return;
    }
    if (
      authPassword.length < 8 ||
      !/[a-zA-Z]/.test(authPassword) ||
      !/[0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(authPassword)
    ) {
      setAuthError("Password must be at least 8 characters and include a letter plus a number or symbol.");
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
      let data: { error?: string; user?: AuthUser } = {};
      try {
        data = JSON.parse(text);
      } catch {
        data = { error: text || "Registration failed" };
      }
      if (!res.ok) {
        throw new Error(data.error || "Registration failed");
      }
      setCurrentUser(data.user ?? null);
      if (data.user?.name) setFullName(data.user.name);
      if (data.user?.email) setEmail(data.user.email);
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : "Failed to create account");
    } finally {
      setAuthSubmitting(false);
    }
  };

  const renderAuthCard = (subtitleText: string) => (
    <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl sm:border border-slate-200 dark:border-slate-800 p-1 sm:p-8 sm:shadow-xs max-w-md mx-auto space-y-4 animate-in fade-in font-sans">
      <div className="text-center space-y-1.5">
        <div className="inline-flex items-center justify-center gap-2">
          <span className="w-8 h-8 rounded-xl bg-brand-50 dark:bg-brand-950/60 border border-brand-200 dark:border-brand-800/70 text-brand-700 dark:text-brand-400 flex items-center justify-center shrink-0">
            <Lock className="w-4 h-4" />
          </span>
          <h2 className="text-base sm:text-xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
            Account Login Required
          </h2>
        </div>
        <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          {subtitleText}
        </p>
      </div>

      <div className="space-y-3">
        {/* Continue with Google button */}
        <button
          type="button"
          disabled={googleSubmitting || authSubmitting}
          onClick={handleContinueWithGoogle}
          className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold text-xs sm:text-sm transition shadow-2xs hover:shadow-xs cursor-pointer active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed min-h-[44px]"
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
            <div className="w-full border-t border-slate-200 dark:border-slate-800" />
          </div>
          <div className="relative flex justify-center text-[10px] sm:text-[11px] uppercase tracking-wider">
            <span className="bg-white dark:bg-slate-900 px-2.5 text-slate-400 dark:text-slate-500 font-semibold">
              or with email
            </span>
          </div>
        </div>

        {/* Sub-Tabs: Sign In vs Create Account */}
        <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
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
          <form onSubmit={handleEmailSignIn} className="space-y-3">
            <div>
              <label className="block text-[11px] sm:text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Email Address
              </label>
              <input
                type="email"
                required
                placeholder="youth@example.com"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-600 bg-slate-50/50 dark:bg-slate-800/50 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-[11px] sm:text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Password
              </label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-600 bg-slate-50/50 dark:bg-slate-800/50 text-slate-900 dark:text-white"
              />
            </div>

            <button
              type="submit"
              disabled={authSubmitting}
              className="w-full py-2.5 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs sm:text-sm shadow-sm shadow-brand-500/20 transition cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2 active:scale-95 min-h-[44px]"
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
          <form onSubmit={handleEmailRegister} className="space-y-3">
            <div>
              <label className="block text-[11px] sm:text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Full Name
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Juan Dela Cruz"
                value={authName}
                onChange={(e) => setAuthName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-600 bg-slate-50/50 dark:bg-slate-800/50 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-[11px] sm:text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Email Address
              </label>
              <input
                type="email"
                required
                placeholder="youth@example.com"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-600 bg-slate-50/50 dark:bg-slate-800/50 text-slate-900 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-2">
              <div>
                <label className="block text-[11px] sm:text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Password <span className="text-slate-400 text-[10px]">(8+ chars)</span>
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-600 bg-slate-50/50 dark:bg-slate-800/50 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] sm:text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Confirm Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={authConfirmPassword}
                  onChange={(e) => setAuthConfirmPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-600 bg-slate-50/50 dark:bg-slate-800/50 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={authSubmitting}
              className="w-full py-2.5 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs sm:text-sm shadow-sm shadow-brand-500/20 transition cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2 active:scale-95 min-h-[44px]"
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
    </div>
  );

  // Auto-search if code in URL
  useEffect(() => {
    if (initialTrackCode) {
      setActiveTab("track");
      handleTrackLookup(initialTrackCode);
    }
  }, [initialTrackCode]);

  const handleTrackLookup = async (codeToLookup?: string): Promise<boolean> => {
    const code = (codeToLookup || trackInput).trim().toUpperCase();
    if (!code) {
      setTrackError("Please enter your tracking code.");
      return false;
    }

    setTrackingLoading(true);
    setTrackError(null);
    try {
      const res = await fetch(`/api/cse/${encodeURIComponent(code)}`);
      const data = await parseApiResponse<{
        success?: boolean;
        application?: CseApplication;
        error?: string;
      }>(res);
      if (data.success && data.application) {
        setTrackedApp(data.application);
        return true;
      }
      setTrackError(data.error || "Application not found. Please check your code.");
      setTrackedApp(null);
      return false;
    } catch (err) {
      console.error("Track error:", err);
      setTrackError(
        err instanceof Error ? err.message : "Failed to look up application. Please try again."
      );
      return false;
    } finally {
      setTrackingLoading(false);
    }
  };

  const calculateAge = (bdate: string) => {
    if (!bdate) return 0;
    const birth = new Date(bdate);
    if (isNaN(birth.getTime())) return 0;
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  };

  const selectedCategoryConfig =
    EXAM_CATEGORY_OPTIONS.find((c) => c.id === examCategory) || EXAM_CATEGORY_OPTIONS[0];
  const minAgeRequired = selectedCategoryConfig.minAge;
  const {
    examFeePaid: parsedExamFee,
    subsidyAmount: computedSubsidyGrant,
    isFixedFee,
  } = resolveExamFeeAndSubsidy(examCategory, examFeePaid);

  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    // Final Validations
    const age = calculateAge(birthdate);
    if (age < minAgeRequired || age > 30) {
      setSubmitError(
        `Examinee must be aged ${minAgeRequired}–30 years old on exam day for ${examCategory}.`
      );
      scrollFormErrorIntoView();
      return;
    }
    if (parsedExamFee <= 0) {
      setSubmitError("Please enter the examination fee amount shown on your Official Receipt.");
      scrollFormErrorIntoView();
      return;
    }
    if (!validIdFile || !cscReceiptFile || !examScheduleFile) {
      setSubmitError("Please attach all three required documents.");
      scrollFormErrorIntoView();
      return;
    }
    if (!isFirstTime && !priorSittingProofFile) {
      setSubmitError(
        "Retakers must upload their stamped Notice of Admission or prior exam result proving they sat for their first exam."
      );
      scrollFormErrorIntoView();
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("fullName", fullName);
      fd.append("contactNumber", contactNumber);
      fd.append("email", email);
      fd.append("purok", purok);
      fd.append("birthdate", birthdate);

      fd.append("examCategory", examCategory);
      fd.append("examLevel", examLevel);
      fd.append("examFeePaid", String(parsedExamFee));
      fd.append("examDate", examDate);
      fd.append("isFirstTime", String(isFirstTime));

      fd.append("payoutPreference", "Barangay Hall Cash Pickup");
      fd.append("cscReceiptNo", cscReceiptNo);

      fd.append("validId", validIdFile);
      fd.append("cscReceipt", cscReceiptFile);
      fd.append("examSchedule", examScheduleFile);
      if (!isFirstTime && priorSittingProofFile) {
        fd.append("priorSittingProof", priorSittingProofFile);
      }

      const res = await fetch("/api/cse", {
        method: "POST",
        body: fd,
      });
      const data = await parseApiResponse<{
        success?: boolean;
        trackingCode?: string;
        error?: string;
      }>(res);

      if (!res.ok || !data.success || !data.trackingCode) {
        throw new Error(data.error || "Failed to submit application.");
      }

      setGeneratedCode(data.trackingCode);
      setApplyStep(4);
      fetchProgramData();
    } catch (err: unknown) {
      setSubmitError((err as Error).message || "An unexpected error occurred.");
      scrollFormErrorIntoView();
    } finally {
      setSubmitting(false);
    }
  };

  // Submit attendance proof
  const handleAttendanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackedApp) return;
    if (!attendanceProofFile) {
      setAttendanceMsg("Please upload your exam day proof.");
      return;
    }

    setAttendanceSubmitting(true);
    setAttendanceMsg(null);
    try {
      const fd = new FormData();
      fd.append("action", "submit_attendance");
      fd.append("attendanceProof", attendanceProofFile);

      const res = await fetch(`/api/cse/${trackedApp.tracking_code}`, {
        method: "PATCH",
        body: fd,
      });
      const data = await parseApiResponse<{ success?: boolean; error?: string }>(res);
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to submit attendance proof.");
      }

      setShowAttendanceModal(false);
      setAttendanceProofFile(null);
      setTrackSuccessMsg("Exam day proof submitted successfully!");
      handleTrackLookup(trackedApp.tracking_code);
    } catch (err: unknown) {
      setAttendanceMsg((err as Error).message);
    } finally {
      setAttendanceSubmitting(false);
    }
  };

  // Submit exam result
  const handleResultSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackedApp) return;

    setResultSubmitting(true);
    setResultMsg(null);
    try {
      const fd = new FormData();
      fd.append("action", "submit_result");
      fd.append("examResult", resultStatus);
      fd.append("rating", ratingInput);
      fd.append("featureConsent", String(featureConsent));
      if (resultProofFile) {
        fd.append("resultProof", resultProofFile);
      }
      if (resultStatus === "Passed" && featureConsent && passerAvatarFile) {
        fd.append("passerAvatar", passerAvatarFile);
      }

      const res = await fetch(`/api/cse/${trackedApp.tracking_code}`, {
        method: "PATCH",
        body: fd,
      });
      const data = await parseApiResponse<{ success?: boolean; error?: string }>(res);
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to submit exam result.");
      }

      setShowResultModal(false);
      setPasserAvatarFile(null);
      setTrackSuccessMsg("Exam result updated successfully! Thank you for updating the SK council.");
      handleTrackLookup(trackedApp.tracking_code);
      fetchProgramData();
    } catch (err: unknown) {
      setResultMsg((err as Error).message);
    } finally {
      setResultSubmitting(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    let copied = false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        copied = true;
      }
    } catch {
      // Fall through to legacy textarea copy fallback on HTTP/restricted contexts
    }

    if (!copied) {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.top = "0";
      textarea.style.left = "0";
      textarea.style.opacity = "0";
      textarea.style.fontSize = "16px";
      textarea.style.pointerEvents = "none";
      document.body.appendChild(textarea);
      try {
        textarea.focus({ preventScroll: true });
        textarea.select();
        textarea.setSelectionRange(0, text.length);
        copied = document.execCommand("copy");
      } finally {
        document.body.removeChild(textarea);
      }
    }

    if (copied) {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const quotaSlots = stats?.quotaSlots ?? DEFAULT_ANNUAL_SLOTS;
  const remainingSlots = stats?.remainingSlots ?? DEFAULT_ANNUAL_SLOTS;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-32 sm:pb-24">
      {/* Desktop 2-Column Layout: Left Navigation Sidebar Rail + Main Content Area */}
      <div className="max-w-6xl mx-auto px-2.5 sm:px-6 pt-1.5 sm:pt-4">
        <div className="flex flex-col md:flex-row gap-4 sm:gap-6 items-start">
          {/* Left Navigation Icon Rail (Desktop view: Just Icons, sticky on left) */}
          <aside
            role="tablist"
            aria-label="CSE desktop navigation"
            className="relative hidden md:flex flex-col w-14 lg:w-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-1.5 shadow-xs shrink-0 sticky items-center gap-1.5"
            style={{ top: "132px" }}
          >
            <div
              aria-hidden="true"
              className="tab-sliding-pill absolute rounded-xl bg-brand-600 shadow-xs pointer-events-none"
              style={getVerticalRailPillStyle(
                Math.max(0, CSE_TAB_ORDER.indexOf(activeTab))
              )}
            />
            {CSE_TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(tab.id)}
                  title={tab.label}
                  aria-label={tab.label}
                  className={`relative z-10 w-11 h-11 flex items-center justify-center rounded-xl transition-colors duration-200 cursor-pointer ${
                    isActive
                      ? "text-white font-bold scale-102"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/70 dark:hover:bg-slate-800/70"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </button>
              );
            })}
            <div className="w-8 h-px bg-slate-200 dark:bg-slate-800 my-0.5" />
            <button
              type="button"
              onClick={() => setShowInfoModal(true)}
              title="Program Guidelines"
              aria-label="Program Guidelines"
              className="w-11 h-11 flex items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-950/50 hover:bg-brand-100 dark:hover:bg-brand-900/60 border border-brand-200 dark:border-brand-800/70 text-brand-700 dark:text-brand-400 transition-all cursor-pointer active:scale-95"
            >
              <Info className="w-5 h-5" />
            </button>
          </aside>

          {/* Main Content Area */}
          <main className="flex-1 min-w-0 w-full flex flex-col gap-1.5 sm:gap-4 md:gap-6">
            {/* Mobile Top Controls: Mode Switcher & Guidelines Info (md:hidden) */}
            <div className="md:hidden flex flex-row items-stretch justify-between gap-1.5 sm:gap-2 w-full">
              <div
                role="tablist"
                aria-label="CSE views"
                className="relative flex-1 min-w-0 grid grid-cols-3 gap-1 bg-slate-100/90 dark:bg-slate-800/90 p-1 rounded-xl border border-slate-200/80 dark:border-slate-800/90 shadow-xs"
              >
                <div
                  aria-hidden="true"
                  className="tab-sliding-pill absolute top-1 bottom-1 rounded-lg bg-white dark:bg-slate-900 shadow-xs border border-slate-200/60 dark:border-slate-700/70 pointer-events-none"
                  style={getHorizontalPillStyle(
                    CSE_TABS.length,
                    Math.max(0, CSE_TAB_ORDER.indexOf(activeTab)),
                    0.25,
                    0.25
                  )}
                />
                {CSE_TABS.map((tab) => {
                  const isActive = activeTab === tab.id;
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      aria-label={tab.label}
                      title={tab.label}
                      onClick={() => setActiveTab(tab.id)}
                      className={`relative z-10 flex flex-col min-[360px]:flex-row items-center justify-center gap-0.5 min-[360px]:gap-1 sm:gap-1.5 py-1 sm:py-2 px-0.5 min-[360px]:px-1 sm:px-2 rounded-lg font-sans text-[10.5px] min-[390px]:text-[11.5px] sm:text-xs transition-colors duration-200 select-none active:scale-95 cursor-pointer ${
                        isActive
                          ? "text-brand-700 dark:text-brand-400 font-bold"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 font-semibold"
                      }`}
                    >
                      <Icon
                        className={`w-3.5 h-3.5 shrink-0 transition-colors ${
                          isActive ? "text-brand-600 dark:text-brand-400" : "text-slate-500 dark:text-slate-400"
                        }`}
                      />
                      <span className="whitespace-nowrap tracking-tight leading-none">
                        {tab.shortLabel}
                      </span>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => setShowInfoModal(true)}
                aria-label="Program Guidelines"
                title="Program Guidelines"
                className="inline-flex items-center justify-center gap-1.5 w-[34px] sm:w-auto sm:px-3.5 rounded-xl bg-brand-50 dark:bg-brand-950/50 hover:bg-brand-100 dark:hover:bg-brand-900/60 border border-brand-200 dark:border-brand-800/70 text-brand-700 dark:text-brand-400 text-xs font-bold transition-all shadow-xs shrink-0 cursor-pointer active:scale-95 touch-manipulation"
              >
                <Info className="w-4 h-4 text-brand-600 dark:text-brand-400 shrink-0" />
                <span className="hidden sm:inline">Guidelines</span>
              </button>
            </div>
        {/* ================= TAB 1: APPLY ================= */}
        <div key={activeTab} className={`overflow-x-clip ${tabAnimClass}`}>
        {activeTab === "apply" && (
          <div className="max-w-2xl mx-auto w-full">
            {/* Step-by-step Form (Fixed mobile card size matching Printing page, no internal scroll) */}
            <div
              ref={formCardRef}
              className="bg-white dark:bg-slate-900 rounded-2xl p-3 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-xs scroll-mt-24 min-h-[486px] sm:min-h-0 flex flex-col"
            >
              {authChecking ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center space-y-3">
                  <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400">
                    Checking resident account status...
                  </p>
                </div>
              ) : !currentUser ? (
                <div className="flex-1">
                  {renderAuthCard("Sign in or create an account to apply for the SK Exam Fee Assistance Program (up to ₱1,000 grant).")}
                </div>
              ) : isOfficialRole(currentUser.role) ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center space-y-3 max-w-md mx-auto">
                  <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                    SK Officials Exclusion Rule
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    Under COA conflict-of-interest rules and CBYDP guidelines, incumbent Sangguniang Kabataan officials are disqualified from availing of exam fee subsidies during their term.
                  </p>
                </div>
              ) : applyStep === 4 ? (
                /* Success Screen */
                <div className="text-center py-6 sm:py-8">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center mb-3 sm:mb-4">
                    <CheckCircle2 className="w-7 h-7 sm:w-8 sm:h-8" />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mb-2">
                    Application Submitted!
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400 text-xs sm:text-sm max-w-md mx-auto mb-5 sm:mb-6">
                    Your application for the <strong>₱{computedSubsidyGrant.toLocaleString()}</strong> {examCategory} subsidy has been received. Save your tracking code to upload exam-day attendance proof after sitting for the test.
                  </p>

                  <div className="bg-brand-50 dark:bg-brand-950/50 border border-brand-200 dark:border-brand-800/80 rounded-2xl p-4 max-w-sm mx-auto mb-6">
                    <span className="text-[11px] sm:text-xs uppercase font-bold text-brand-700 dark:text-brand-300 block mb-1">
                      Your Unique Tracking Code
                    </span>
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-xl sm:text-2xl font-black tracking-wider text-slate-900 dark:text-white font-mono">
                        {generatedCode}
                      </span>
                      <button
                        onClick={() => generatedCode && copyToClipboard(generatedCode)}
                        className="p-2 rounded-lg bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 shadow-xs touch-manipulation"
                        title="Copy tracking code"
                      >
                        {copiedCode ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 sm:gap-3">
                    <button
                      onClick={() => {
                        if (generatedCode) {
                          setActiveTab("track");
                          handleTrackLookup(generatedCode);
                        }
                      }}
                      className="w-full sm:w-auto px-6 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm transition-all touch-manipulation min-h-[46px]"
                    >
                      Track My Application Now
                    </button>
                    <button
                      onClick={() => {
                        setApplyStep(1);
                        setGeneratedCode(null);
                        setFullName("");
                        setContactNumber("");
                        setExamCategory("Civil Service Exam (CSE)");
                        setExamLevel("Professional");
                        setExamFeePaid("500");
                        setValidIdFile(null);
                        setCscReceiptFile(null);
                        setExamScheduleFile(null);
                        setPriorSittingProofFile(null);
                        setIsFirstTime(true);
                      }}
                      className="w-full sm:w-auto px-5 py-3 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-all touch-manipulation min-h-[46px]"
                    >
                      Submit Another Application
                    </button>
                  </div>
                </div>
              ) : (
                <form noValidate onSubmit={handleApplySubmit} className="flex-1 min-h-0 flex flex-col">
                  {/* Step Progress Bar */}
                  <div className="shrink-0 flex items-center gap-1.5 mb-2">
                    {[1, 2, 3].map((s) => (
                      <div
                        key={s}
                        className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                          applyStep >= s ? "bg-brand-600 dark:bg-brand-500" : "bg-slate-200 dark:bg-slate-800"
                        }`}
                      />
                    ))}
                  </div>

                  {/* Step Header */}
                  <div className="shrink-0 flex items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 mb-2">
                    <div className="min-w-0">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400 block leading-none">
                        Step {applyStep} of 3
                      </span>
                      <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white leading-tight mt-0.5 truncate">
                        {applyStep === 1 && "Personal & Residency Profile"}
                        {applyStep === 2 && "Exam Details & Subsidy Cap"}
                        {applyStep === 3 && "Upload Official Receipts & Proof"}
                      </h2>
                    </div>
                    <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-full shrink-0">
                      Up to ₱{MAX_EXAM_SUBSIDY_CAP.toLocaleString()} Cap
                    </span>
                  </div>

                  <div className="flex-1 flex flex-col">

                  {/* Step 1: Personal & Residency */}
                  {applyStep === 1 && (
                    <div className="flex-1 flex flex-col gap-2">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Full Name (as registered with Examining Agency) *
                        </label>
                        <input
                          type="text"
                          required
                          autoComplete="name"
                          autoCapitalize="words"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="e.g. Juan Dela Cruz"
                          className="w-full min-w-0 max-w-full h-[38px] min-h-[38px] px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500 outline-none box-border"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="min-w-0">
                          <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Contact Number (Mobile / SMS) *
                          </label>
                          <input
                            type="tel"
                            required
                            inputMode="tel"
                            autoComplete="tel"
                            value={contactNumber}
                            onChange={(e) => setContactNumber(e.target.value)}
                            placeholder="0912 345 6789"
                            className="w-full min-w-0 max-w-full h-[38px] min-h-[38px] px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500 outline-none box-border"
                          />
                        </div>

                        <div className="min-w-0">
                          <div className="h-4 flex items-center justify-between gap-2 mb-1">
                            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap truncate">
                              Birthdate (Ages 15–30) *
                            </label>
                            {birthdate && (
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap shrink-0 leading-none ${
                                  calculateAge(birthdate) < 15 || calculateAge(birthdate) > 30
                                    ? "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                                    : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                                }`}
                              >
                                {calculateAge(birthdate)} yrs{" "}
                                {calculateAge(birthdate) < 15 || calculateAge(birthdate) > 30
                                  ? "• 15–30"
                                  : "• Eligible"}
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-[1.2fr_0.85fr_1fr] gap-1.5">
                            <select
                              aria-label="Birth Month"
                              required
                              value={birthMonth}
                              onChange={(e) => handleBirthPartChange("m", e.target.value)}
                              className="w-full min-w-0 h-[38px] !min-h-[38px] px-2 !py-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                            >
                              <option value="">Month</option>
                              {[
                                ["01", "Jan"],
                                ["02", "Feb"],
                                ["03", "Mar"],
                                ["04", "Apr"],
                                ["05", "May"],
                                ["06", "Jun"],
                                ["07", "Jul"],
                                ["08", "Aug"],
                                ["09", "Sep"],
                                ["10", "Oct"],
                                ["11", "Nov"],
                                ["12", "Dec"],
                              ].map(([val, label]) => (
                                <option key={val} value={val}>
                                  {label}
                                </option>
                              ))}
                            </select>

                            <select
                              aria-label="Birth Day"
                              required
                              value={birthDay}
                              onChange={(e) => handleBirthPartChange("d", e.target.value)}
                              className="w-full min-w-0 h-[38px] !min-h-[38px] px-2 !py-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                            >
                              <option value="">Day</option>
                              {Array.from({ length: maxDaysInBirthMonth }, (_, i) => {
                                const d = String(i + 1).padStart(2, "0");
                                return (
                                  <option key={d} value={d}>
                                    {i + 1}
                                  </option>
                                );
                              })}
                            </select>

                            <select
                              aria-label="Birth Year"
                              required
                              value={birthYear}
                              onChange={(e) => handleBirthPartChange("y", e.target.value)}
                              className="w-full min-w-0 h-[38px] !min-h-[38px] px-2 !py-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                            >
                              <option value="">Year</option>
                              {eligibleBirthYears.map((y) => (
                                <option key={y} value={y}>
                                  {y}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Purok / Sitio in Tocok <span className="text-rose-500 dark:text-rose-400">*</span>
                        </label>
                        <div className="grid grid-cols-3 gap-1.5">
                          {PUROK_CARDS.map((p, idx) => {
                            const selected = purok === p.value;
                            const isLast = idx === PUROK_CARDS.length - 1;
                            return (
                              <button
                                key={p.value}
                                type="button"
                                onClick={() => {
                                  setPurok(p.value);
                                  if (submitError) setSubmitError(null);
                                }}
                                aria-label={p.value}
                                aria-pressed={selected}
                                className={`rounded-xl border text-center transition-all cursor-pointer touch-manipulation active:scale-[0.98] flex items-center justify-center ${
                                  isLast
                                    ? "col-span-3 min-h-[32px] px-2.5 py-1 flex-row gap-1.5"
                                    : "min-h-[36px] px-1.5 py-1 flex-col"
                                } ${
                                  selected
                                    ? "bg-brand-50 dark:bg-brand-950/60 border-brand-500 text-brand-800 dark:text-brand-300 ring-1 ring-brand-500/30 font-bold"
                                    : "bg-slate-50/70 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-200 hover:border-slate-300"
                                }`}
                              >
                                <span className="text-[11px] font-bold leading-none shrink-0">{p.shortLabel}</span>
                                <span
                                  className={`text-[9px] leading-none truncate max-w-full ${isLast ? "" : "mt-0.5"} ${
                                    selected
                                      ? "text-brand-700/80 dark:text-brand-300/80 font-medium"
                                      : "text-slate-500 dark:text-slate-400"
                                  }`}
                                >
                                  {isLast ? `· ${p.subLabel}` : p.subLabel}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="mt-auto pt-1 flex justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            if (!fullName || !contactNumber || !birthdate) {
                              setSubmitError("Please fill in required personal fields.");
                              scrollFormErrorIntoView();
                              return;
                            }
                            const age = calculateAge(birthdate);
                            if (age < 15 || age > 30) {
                              setSubmitError("Applicant must be a Katipunan ng Kabataan member aged 15–30 on exam day.");
                              scrollFormErrorIntoView();
                              return;
                            }
                            setSubmitError(null);
                            setApplyStep(2);
                          }}
                          className="w-full sm:w-auto px-5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm flex items-center justify-center gap-1.5 transition-all active:scale-[0.99] touch-manipulation h-[40px] min-h-[40px] shadow-xs"
                        >
                          <span>Next: Exam Details</span>
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Step 2: Exam Details */}
                  {applyStep === 2 && (
                    <div className="flex-1 flex flex-col gap-3">
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                            Covered Exam Program *
                          </label>
                          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                            Min age {minAgeRequired}+
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          {EXAM_CATEGORY_OPTIONS.map((cat, idx) => {
                            const selected = examCategory === cat.id;
                            return (
                              <button
                                key={cat.id}
                                type="button"
                                onClick={() => {
                                  if (cat.id !== examCategory) {
                                    const prevIdx = EXAM_CATEGORY_OPTIONS.findIndex((c) => c.id === examCategory);
                                    setExamSwitchDir(idx >= prevIdx ? "next" : "prev");
                                  }
                                  setExamCategory(cat.id);
                                  setExamFeePaid(String(cat.defaultFee));
                                  setExamLevel(cat.defaultLevel);
                                  setCustomBatch("");
                                  if (cat.batchOptions.length > 0) {
                                    const initialBatch =
                                      cat.id === "Civil Service Exam (CSE)" && targetBatch
                                        ? targetBatch
                                        : cat.batchOptions[0];
                                    setSelectedBatchOption(initialBatch);
                                    setExamDate(initialBatch);
                                  } else {
                                    setSelectedBatchOption("");
                                    setExamDate("");
                                  }
                                }}
                                className={`h-[34px] px-2 rounded-xl border text-center transition-all duration-200 active:scale-[0.98] touch-manipulation cursor-pointer flex items-center justify-center ${
                                  selected
                                    ? "border-brand-500 bg-brand-50/70 dark:bg-brand-950/40 text-brand-900 dark:text-brand-200 ring-1 ring-brand-500/30 font-bold"
                                    : "border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/40 font-semibold"
                                }`}
                              >
                                <span className="text-[11px] leading-none whitespace-nowrap">
                                  {cat.shortLabel}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="overflow-x-hidden">
                        <div
                          key={examCategory}
                          className={
                            examSwitchDir === "next"
                              ? "exam-field-slide-next"
                              : examSwitchDir === "prev"
                              ? "exam-field-slide-prev"
                              : ""
                          }
                        >
                          {selectedCategoryConfig.levelOptions.length > 0 ? (
                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                                {selectedCategoryConfig.levelLabel}
                              </label>
                              <div
                                className={`grid gap-1.5 sm:gap-2 ${
                                  selectedCategoryConfig.levelOptions.length === 2
                                    ? "grid-cols-2"
                                    : selectedCategoryConfig.levelOptions.length === 3
                                    ? "grid-cols-3"
                                    : "grid-cols-4"
                                }`}
                              >
                                {selectedCategoryConfig.levelOptions.map((opt) => {
                                  const isSelected = examLevel === opt.value;
                                  const showCseIcon = examCategory === "Civil Service Exam (CSE)";
                                  return (
                                    <label
                                      key={opt.value}
                                      className={`min-h-[42px] px-2 sm:px-2.5 py-1.5 rounded-xl border cursor-pointer flex flex-col justify-center transition-all touch-manipulation ${
                                        isSelected
                                          ? "border-brand-500 bg-brand-50/70 dark:bg-brand-950/40 text-brand-900 dark:text-brand-200 ring-1 ring-brand-500/30"
                                          : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                                      }`}
                                    >
                                      <input
                                        type="radio"
                                        name="examLevel"
                                        value={opt.value}
                                        checked={isSelected}
                                        onChange={() => setExamLevel(opt.value)}
                                        className="sr-only"
                                      />
                                      <div className="flex items-center justify-between gap-1">
                                        <span className="font-bold text-[11.5px] sm:text-xs leading-none truncate">
                                          {opt.label}
                                        </span>
                                        {showCseIcon &&
                                          (opt.value === "Professional" ? (
                                            <GraduationCap
                                              className={`w-3.5 h-3.5 shrink-0 ${
                                                isSelected ? "text-brand-600" : "text-slate-400"
                                              }`}
                                            />
                                          ) : (
                                            <Award
                                              className={`w-3.5 h-3.5 shrink-0 ${
                                                isSelected ? "text-brand-600" : "text-slate-400"
                                              }`}
                                            />
                                          ))}
                                      </div>
                                      <span className="text-[9.5px] text-slate-500 dark:text-slate-400 leading-tight truncate mt-0.5">
                                        {opt.hint}
                                      </span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          ) : (
                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                                {selectedCategoryConfig.levelLabel}
                              </label>
                              <input
                                type="text"
                                required
                                value={examLevel}
                                onChange={(e) => setExamLevel(e.target.value)}
                                placeholder="e.g. Bar Exam, NAPOLCOM, Fire Officer, or Cert Name"
                                className="w-full h-[42px] min-h-[42px] px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-[1.15fr_0.85fr] gap-2">
                        <div className="min-w-0 overflow-x-hidden">
                          <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1 truncate">
                            Target Batch / Date *
                          </label>
                          <div
                            key={examCategory}
                            className={
                              examSwitchDir === "next"
                                ? "exam-field-slide-next"
                                : examSwitchDir === "prev"
                                ? "exam-field-slide-prev"
                                : ""
                            }
                          >
                            {selectedCategoryConfig.batchOptions.length > 0 ? (
                              <>
                                <select
                                  value={selectedBatchOption}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setSelectedBatchOption(val);
                                    if (val !== "Other") {
                                      setExamDate(val);
                                    } else {
                                      setExamDate(customBatch.trim() || "");
                                    }
                                  }}
                                  className="w-full min-w-0 max-w-full h-[40px] !min-h-[40px] px-2.5 !py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500 outline-none box-border"
                                >
                                  {examCategory === "Civil Service Exam (CSE)" &&
                                    targetBatch &&
                                    !selectedCategoryConfig.batchOptions.includes(targetBatch) && (
                                      <option value={targetBatch}>
                                        {targetBatch}
                                      </option>
                                    )}
                                  {selectedCategoryConfig.batchOptions.map((b) => (
                                    <option key={b} value={b}>
                                      {b}
                                    </option>
                                  ))}
                                  <option value="Other">Other Schedule...</option>
                                </select>

                                {selectedBatchOption === "Other" && (
                                  <input
                                    type="text"
                                    required
                                    value={customBatch}
                                    onChange={(e) => {
                                      setCustomBatch(e.target.value);
                                      setExamDate(e.target.value);
                                    }}
                                    placeholder="Enter custom schedule / date"
                                    className="w-full mt-1.5 h-[38px] min-h-[38px] px-2.5 py-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                                  />
                                )}
                              </>
                            ) : (
                              <input
                                type="text"
                                required
                                value={examDate}
                                onChange={(e) => setExamDate(e.target.value)}
                                placeholder="e.g. Oct 2027 Exam Date"
                                className="w-full min-w-0 max-w-full h-[40px] min-h-[40px] px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500 outline-none box-border"
                              />
                            )}
                          </div>
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                              Fee (₱) *
                            </label>
                            {isFixedFee ? (
                              <span className="inline-flex items-center gap-0.5 text-[9.5px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 shrink-0 leading-none">
                                <Lock className="w-2.5 h-2.5" />
                                <span>Fixed ₱{computedSubsidyGrant.toLocaleString()}</span>
                              </span>
                            ) : (
                              <span
                                className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded-full shrink-0 leading-none ${
                                  parsedExamFee > MAX_EXAM_SUBSIDY_CAP
                                    ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                                    : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                                }`}
                              >
                                {parsedExamFee > MAX_EXAM_SUBSIDY_CAP
                                  ? `Cap ₱${MAX_EXAM_SUBSIDY_CAP.toLocaleString()}`
                                  : `Grant ₱${computedSubsidyGrant.toLocaleString()}`}
                              </span>
                            )}
                          </div>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            required
                            readOnly={isFixedFee}
                            aria-readonly={isFixedFee}
                            inputMode="decimal"
                            value={isFixedFee ? String(parsedExamFee) : examFeePaid}
                            onChange={(e) => {
                              if (!isFixedFee) setExamFeePaid(e.target.value);
                            }}
                            placeholder="500"
                            className={`w-full min-w-0 max-w-full h-[40px] min-h-[40px] px-2.5 py-1.5 rounded-xl border text-sm outline-none box-border ${
                              isFixedFee
                                ? "border-slate-200 dark:border-slate-700/80 bg-slate-100/90 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 cursor-not-allowed"
                                : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500"
                            }`}
                          />
                        </div>
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                            Taker Status *
                          </label>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400">
                            Max 1 retake per term
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <label
                            className={`h-[38px] px-2.5 rounded-xl border cursor-pointer flex items-center justify-center text-xs font-bold transition-all touch-manipulation ${
                              isFirstTime
                                ? "border-brand-500 bg-brand-50/70 dark:bg-brand-950/40 text-brand-900 dark:text-brand-200 ring-1 ring-brand-500/30"
                                : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                            }`}
                          >
                            <input
                              type="radio"
                              name="firstTime"
                              checked={isFirstTime}
                              onChange={() => {
                                setIsFirstTime(true);
                                setWarningNotice(null);
                              }}
                              className="sr-only"
                            />
                            <span>First-time (80%)</span>
                          </label>
                          <label
                            className={`h-[38px] px-2.5 rounded-xl border cursor-pointer flex items-center justify-center text-xs font-bold transition-all touch-manipulation ${
                              !isFirstTime
                                ? "border-brand-500 bg-brand-50/70 dark:bg-brand-950/40 text-brand-900 dark:text-brand-200 ring-1 ring-brand-500/30"
                                : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                            }`}
                          >
                            <input
                              type="radio"
                              name="firstTime"
                              checked={!isFirstTime}
                              onChange={() => {
                                setIsFirstTime(false);
                                setWarningNotice(
                                  "1 Retake Cap: Upload your stamped previous NOA or official test rating in Step 3."
                                );
                              }}
                              className="sr-only"
                            />
                            <span>Retaker (20%)</span>
                          </label>
                        </div>
                      </div>

                      <div className="mt-auto pt-1 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setWarningNotice(null);
                            setApplyStep(1);
                          }}
                          className="px-4 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-semibold flex items-center justify-center gap-1 transition-all touch-manipulation h-[42px] min-h-[42px] shrink-0"
                        >
                          <ChevronLeft className="w-4 h-4" />
                          <span>Back</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const age = calculateAge(birthdate);
                            if (age < minAgeRequired || age > 30) {
                              setSubmitError(
                                `Examinee must be aged ${minAgeRequired}–30 on exam day for ${examCategory}.`
                              );
                              scrollFormErrorIntoView();
                              return;
                            }
                            if (!examLevel.trim() || !examDate.trim()) {
                              setSubmitError("Please specify your examination title/level and target schedule.");
                              scrollFormErrorIntoView();
                              return;
                            }
                            if (parsedExamFee <= 0) {
                              setSubmitError("Please enter the exam fee amount on your Official Receipt.");
                              scrollFormErrorIntoView();
                              return;
                            }
                            setSubmitError(null);
                            setWarningNotice(null);
                            setApplyStep(3);
                          }}
                          className="flex-1 sm:flex-none sm:ml-auto px-5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm flex items-center justify-center gap-1.5 transition-all active:scale-[0.99] touch-manipulation h-[42px] min-h-[42px] shadow-xs"
                        >
                          <span>Next: Documents</span>
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Step 3: Document Uploads */}
                  {applyStep === 3 && (
                    <div className="flex-1 flex flex-col gap-2">
                      <div className="bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 rounded-xl p-2 text-[10.5px] leading-snug text-amber-900 dark:text-amber-200 flex items-start gap-1.5">
                        <Info className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                        <span>
                          <strong>Post-Exam Release:</strong> ₱{computedSubsidyGrant.toLocaleString()} unlocks only after you upload your stamped NOA / test-day proof in <strong>Track</strong>.
                        </span>
                      </div>

                      {/* File 1: Valid ID */}
                      <MobileUploadCard
                        compact
                        label="1. Valid ID / Residency Proof *"
                        sublabel="Gov't/School ID w/ birthdate & Tocok address, or Brgy Cert."
                        file={validIdFile}
                        onFileSelect={setValidIdFile}
                        required={true}
                        icon={Award}
                      />

                      {/* File 2: Official Receipt (OR / e-OR) */}
                      <MobileUploadCard
                        compact
                        label={`2. Official Receipt / e-OR (₱${parsedExamFee.toLocaleString()}) *`}
                        sublabel={selectedCategoryConfig.agencyHint}
                        file={cscReceiptFile}
                        onFileSelect={setCscReceiptFile}
                        required={true}
                        icon={Receipt}
                      />

                      {/* File 3: Notice of Admission / Exam Permit / Assessment Slip */}
                      <MobileUploadCard
                        compact
                        label="3. Notice of Admission / Permit *"
                        sublabel="NOA, ONSA, Exam Permit, or Assessment Slip w/ exam date."
                        file={examScheduleFile}
                        onFileSelect={setExamScheduleFile}
                        required={true}
                        icon={FileText}
                      />

                      {/* File 4: Retaker Prior Sitting Proof */}
                      {!isFirstTime && (
                        <MobileUploadCard
                          compact
                          label="4. Prior Sitting Proof (Retaker) *"
                          sublabel="Stamped previous NOA or official test rating slip."
                          file={priorSittingProofFile}
                          onFileSelect={setPriorSittingProofFile}
                          required={true}
                          icon={ShieldCheck}
                        />
                      )}

                      <div className="flex items-center gap-2">
                        <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 shrink-0 whitespace-nowrap">
                          OR / e-OR #
                        </label>
                        <input
                          type="text"
                          value={cscReceiptNo}
                          onChange={(e) => setCscReceiptNo(e.target.value)}
                          placeholder="Optional (e.g. OR #104928)"
                          className="flex-1 min-w-0 h-[36px] min-h-[36px] px-2.5 py-1 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-brand-500 outline-none"
                        />
                      </div>

                      <div className="mt-auto pt-1 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setApplyStep(2)}
                          className="px-3.5 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-semibold flex items-center justify-center gap-1 transition-all touch-manipulation h-[40px] min-h-[40px] shrink-0"
                        >
                          <ChevronLeft className="w-4 h-4" />
                          <span>Back</span>
                        </button>
                        <button
                          type="submit"
                          disabled={submitting}
                          className="flex-1 sm:flex-none sm:ml-auto px-5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm shadow-xs flex items-center justify-center gap-1.5 transition-all active:scale-[0.99] disabled:opacity-50 touch-manipulation h-[40px] min-h-[40px]"
                        >
                          {submitting ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>Submitting...</span>
                            </>
                          ) : (
                            <>
                              <span>Submit (₱{computedSubsidyGrant.toLocaleString()})</span>
                              <CheckCircle2 className="w-4 h-4" />
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* ================= TAB 2: TRACK & LIFECYCLE ================= */}
        {activeTab === "track" && (
          <div className="space-y-4 sm:space-y-6">
            {/* Unified Your Applications & Lifecycle Card (1 application per page, paginated when > 1) */}
            {(() => {
              const totalAppPages = myApplications.length;
              const safeAppPage = Math.max(1, Math.min(myAppPage, Math.max(1, totalAppPages)));
              const activeApp = trackedApp ?? (totalAppPages > 0 ? myApplications[safeAppPage - 1] : null);
              const isExternalLookup = Boolean(
                trackedApp && totalAppPages > 0 && !myApplications.some((a) => a.tracking_code === trackedApp.tracking_code)
              );

              return (
                <div
                  id="cse-tracked-details"
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs max-w-2xl mx-auto min-h-[486px] sm:min-h-0 flex flex-col overflow-hidden"
                >
                  {/* Card Header */}
                  <div className="shrink-0 p-3 sm:p-5 pb-2.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <FileText className="w-4 h-4 text-brand-600 dark:text-brand-400 shrink-0" />
                      <h2 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-slate-100 tracking-tight truncate">
                        {currentUser ? "Your Applications" : "Track Subsidy Status"}
                      </h2>
                      {currentUser && (
                        <span
                          className={`shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-bold tabular-nums border ${
                            totalAppPages === 0
                              ? "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200/70 dark:border-slate-700/70"
                              : "bg-brand-50 dark:bg-brand-950/50 text-brand-700 dark:text-brand-400 border-brand-200 dark:border-brand-800/70"
                          }`}
                        >
                          {totalAppPages}
                        </span>
                      )}
                      {totalAppPages > 1 && !isExternalLookup && (
                        <span className="text-[10.5px] font-medium text-slate-400 dark:text-slate-500 tabular-nums shrink-0">
                          • Page {safeAppPage}/{totalAppPages}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isExternalLookup && (
                        <button
                          type="button"
                          onClick={() => {
                            setTrackedApp(null);
                            setMyAppPage(1);
                          }}
                          className="h-9 px-2.5 rounded-xl border border-brand-200 dark:border-brand-800/70 bg-brand-50/70 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 text-[11px] font-bold transition cursor-pointer"
                        >
                          My Apps
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setTrackError(null);
                          setShowManualSearch(true);
                        }}
                        className="w-9 h-9 sm:w-auto sm:px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/70 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center gap-1.5 text-xs font-semibold transition cursor-pointer active:scale-95 touch-manipulation"
                        title="Check subsidy status by tracking code"
                        aria-label="Check subsidy status by tracking code"
                      >
                        <Search className="w-4 h-4 shrink-0" />
                        <span className="hidden sm:inline">Find Code</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          fetchProgramData();
                          if (activeApp) handleTrackLookup(activeApp.tracking_code);
                        }}
                        disabled={trackingLoading}
                        className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/70 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center transition cursor-pointer disabled:opacity-60 active:scale-95 touch-manipulation"
                        title="Refresh application status"
                        aria-label="Refresh application status"
                      >
                        <RotateCw className={`w-4 h-4 ${trackingLoading ? "animate-spin text-brand-600 dark:text-brand-400" : ""}`} />
                      </button>
                    </div>
                  </div>

                  {/* Card Body */}
                  {activeApp ? (
                    <div className="flex-1 p-3 sm:p-5 flex flex-col gap-3">
                      {/* Header details */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-mono text-xs sm:text-sm font-bold text-brand-600 dark:text-brand-400 truncate">
                              {activeApp.tracking_code}
                            </span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(activeApp.tracking_code)}
                              className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0 cursor-pointer"
                              title="Copy code"
                            >
                              {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>

                          <div className="flex flex-wrap items-center justify-end gap-1 shrink-0">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                getReimbursementBadge(activeApp.reimbursement_status, activeApp.reimbursement_amount).badgeClass
                              }`}
                            >
                              {getReimbursementBadge(activeApp.reimbursement_status, activeApp.reimbursement_amount).label}
                            </span>
                            {activeApp.exam_result_status === "Passed" && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-amber-50 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-200">
                                Passed
                              </span>
                            )}
                          </div>
                        </div>

                        {(() => {
                          const catBadge =
                            EXAM_BADGE_MAP[activeApp.exam_category || "Civil Service Exam (CSE)"] ||
                            EXAM_BADGE_MAP["Civil Service Exam (CSE)"];
                          return (
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between gap-2">
                                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-tight truncate">
                                  {activeApp.full_name}
                                </h3>
                                <span className="text-[10.5px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md shrink-0">
                                  {activeApp.purok.split("(")[0].trim()}
                                </span>
                              </div>
                              <div className="flex items-center flex-wrap gap-1.5 text-[10.5px]">
                                <span
                                  className={`font-extrabold px-2 py-0.5 rounded-md border uppercase tracking-wide shrink-0 ${catBadge.pillClass}`}
                                >
                                  {catBadge.short}
                                </span>
                                <span className="font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md truncate">
                                  {activeApp.exam_level}
                                </span>
                                <span className="text-slate-500 dark:text-slate-400 font-medium truncate">
                                  {activeApp.exam_date}
                                </span>
                              </div>
                            </div>
                          );
                        })()}
                      </div>

                      {/* 4-Stage Lifecycle Stepper: 2x2 grid on mobile */}
                      <div>
                        <h4 className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                          Audit &amp; Progress Lifecycle
                        </h4>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {/* Stage 1 */}
                          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80">
                            <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold text-[11.5px] mb-0.5">
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">1. Applied</span>
                            </div>
                            <span className="text-[10px] text-slate-500 block leading-tight truncate">
                              Docs uploaded
                            </span>
                          </div>

                          {/* Stage 2: Exam Attendance */}
                          <div
                            className={`p-2.5 rounded-xl border ${
                              activeApp.attendance_status === "Verified Attended"
                                ? "bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800"
                                : activeApp.attendance_status === "Attendance Submitted"
                                ? "bg-sky-50/50 dark:bg-sky-950/30 border-sky-200 dark:border-sky-800"
                                : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/80"
                            }`}
                          >
                            <div className="flex items-center gap-1 font-bold text-[11.5px] mb-0.5">
                              {activeApp.attendance_status === "Verified Attended" ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              ) : (
                                <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                              )}
                              <span className="truncate">2. Attendance</span>
                            </div>
                            <span className="text-[10px] text-slate-500 block leading-tight truncate">
                              {activeApp.attendance_status}
                            </span>
                          </div>

                          {/* Stage 3: Post-Exam Subsidy Payout */}
                          <div
                            className={`p-2.5 rounded-xl border ${
                              activeApp.reimbursement_status === "Reimbursed"
                                ? "bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800"
                                : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/80"
                            }`}
                          >
                            <div className="flex items-center gap-1 font-bold text-[11.5px] mb-0.5">
                              {activeApp.reimbursement_status === "Reimbursed" ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              ) : (
                                <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              )}
                              <span className="truncate">3. ₱{Number(activeApp.reimbursement_amount || 500).toLocaleString()} Payout</span>
                            </div>
                            <span className="text-[10px] text-slate-500 block leading-tight truncate">
                              {activeApp.reimbursement_status === "Reimbursed"
                                ? `DV: ${activeApp.disbursement_voucher_no || "Issued"}`
                                : activeApp.attendance_status === "Verified Attended"
                                ? "Ready for Payout"
                                : "After Exam Sitting"}
                            </span>
                          </div>

                          {/* Stage 4 */}
                          <div
                            className={`p-2.5 rounded-xl border ${
                              activeApp.exam_result_status === "Passed"
                                ? activeApp.result_verified_at
                                  ? "bg-amber-50/60 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700"
                                  : "bg-sky-50/50 dark:bg-sky-950/30 border-sky-200 dark:border-sky-800"
                                : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/80"
                            }`}
                          >
                            <div className="flex items-center gap-1 font-bold text-[11.5px] mb-0.5">
                              {activeApp.exam_result_status === "Passed" && activeApp.result_verified_at ? (
                                <Trophy className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                              ) : activeApp.exam_result_status === "Passed" ? (
                                <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                              ) : (
                                <Award className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              )}
                              <span className="truncate">4. Result</span>
                            </div>
                            <span className="text-[10px] text-slate-500 block leading-tight truncate">
                              {activeApp.exam_result_status === "Passed"
                                ? activeApp.result_verified_at
                                  ? `Verified (${activeApp.rating ? `${activeApp.rating}%` : "Passed"})`
                                  : "Pending Verification"
                                : activeApp.exam_result_status}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Disbursement info if reimbursed */}
                      {activeApp.reimbursement_status === "Reimbursed" && (
                        <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 text-[11px] flex items-center justify-between gap-2 flex-wrap">
                          <span className="font-bold text-emerald-900 dark:text-emerald-200">
                            ₱{Number(activeApp.reimbursement_amount || 500).toLocaleString()} Disbursed
                          </span>
                          <span className="font-mono text-emerald-800 dark:text-emerald-300">
                            DV #{activeApp.disbursement_voucher_no || "Issued"} •{" "}
                            {activeApp.reimbursed_at ? new Date(activeApp.reimbursed_at).toLocaleDateString() : "Recorded"}
                          </span>
                        </div>
                      )}

                      {/* Self-service actions (single-submission, gated by exam cycle & verified attendance) */}
                      {(() => {
                        const examGate = getExamCycleGate(activeApp.exam_date);
                        const isDisapproved = activeApp.reimbursement_status === "Disapproved";
                        const attendanceAlreadyHandled = activeApp.attendance_status !== "Not Yet Taken";
                        const resultAlreadySubmitted = activeApp.exam_result_status !== "Awaiting Results";
                        const attendanceLocked =
                          isDisapproved || examGate.locked || attendanceAlreadyHandled;
                        const resultLocked =
                          isDisapproved ||
                          examGate.locked ||
                          activeApp.attendance_status !== "Verified Attended" ||
                          resultAlreadySubmitted;

                        const attendanceButtonLabel =
                          activeApp.attendance_status === "Verified Attended"
                            ? "Attendance Verified"
                            : activeApp.attendance_status === "Attendance Submitted"
                            ? "Attendance Proof Submitted"
                            : activeApp.attendance_status === "Did Not Attend"
                            ? "Marked Did Not Attend"
                            : "Upload Exam Day Attendance Proof";

                        const resultButtonLabel = activeApp.result_verified_at
                          ? "Exam Result Verified"
                          : resultAlreadySubmitted
                          ? "Exam Result Submitted"
                          : "Submit Exam Result (Pass / Fail)";

                        const lockHint = isDisapproved
                          ? "Application disapproved — post-exam submissions disabled."
                          : examGate.locked
                          ? `Attendance & result uploads open in ${examGate.opensLabel} (${activeApp.exam_date}).`
                          : activeApp.attendance_status === "Attendance Submitted"
                          ? "Attendance proof submitted — awaiting SK Official verification before submitting results."
                          : activeApp.attendance_status !== "Verified Attended"
                          ? "SK Official verification of your exam attendance is required before submitting exam results."
                          : resultAlreadySubmitted && !activeApp.result_verified_at
                          ? "Exam result submitted — awaiting SK Official verification for the Hall of Fame."
                          : null;

                        return (
                          <div className="mt-auto pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                            {lockHint && (
                              <p className="text-[10.5px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5 px-0.5">
                                <Lock className="w-3 h-3 text-slate-400 shrink-0" />
                                <span className="leading-snug">{lockHint}</span>
                              </p>
                            )}

                            <div className="flex flex-col sm:flex-row gap-2">
                              <button
                                type="button"
                                disabled={attendanceLocked}
                                onClick={() => {
                                  setTrackedApp(activeApp);
                                  setShowAttendanceModal(true);
                                  setAttendanceMsg(null);
                                }}
                                title={
                                  attendanceLocked
                                    ? lockHint || attendanceButtonLabel
                                    : "Upload your exam-day attendance proof"
                                }
                                className={`w-full sm:flex-1 px-4 h-[40px] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all border touch-manipulation ${
                                  attendanceLocked
                                    ? "bg-slate-100 dark:bg-slate-800/60 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-800 cursor-not-allowed"
                                    : "bg-brand-50 hover:bg-brand-100 dark:bg-brand-950/60 dark:hover:bg-brand-900/60 text-brand-700 dark:text-brand-300 border-brand-200 dark:border-brand-800 cursor-pointer"
                                }`}
                              >
                                {attendanceAlreadyHandled ? (
                                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                ) : (
                                  <Upload className="w-3.5 h-3.5 shrink-0" />
                                )}
                                <span>{attendanceButtonLabel}</span>
                              </button>

                              <button
                                type="button"
                                disabled={resultLocked}
                                onClick={() => {
                                  setTrackedApp(activeApp);
                                  setPasserAvatarFile(null);
                                  setShowResultModal(true);
                                  setResultMsg(null);
                                }}
                                title={
                                  resultLocked
                                    ? lockHint || resultButtonLabel
                                    : "Submit exam result for admin verification"
                                }
                                className={`w-full sm:flex-1 px-4 h-[40px] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all border touch-manipulation ${
                                  resultLocked
                                    ? "bg-slate-100 dark:bg-slate-800/60 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-800 cursor-not-allowed"
                                    : "bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-800 cursor-pointer"
                                }`}
                              >
                                <Trophy className="w-3.5 h-3.5 shrink-0" />
                                <span>{resultButtonLabel}</span>
                              </button>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  ) : (
                    <div className="flex-1 p-5 flex flex-col items-center justify-center text-center space-y-3">
                      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                        {currentUser
                          ? "No exam applications filed under this account yet. Use your tracking code to check status or submit exam proof."
                          : "Have a tracking code? Look up your subsidy status and upload post-exam attendance or result proof."}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setTrackError(null);
                          setShowManualSearch(true);
                        }}
                        className="inline-flex items-center justify-center gap-2 px-5 h-[42px] rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs sm:text-sm shadow-xs transition-all cursor-pointer active:scale-[0.99] touch-manipulation"
                      >
                        <Search className="w-4 h-4" />
                        <span>Check Subsidy Status &amp; Proof</span>
                      </button>
                    </div>
                  )}

                  {/* Compact Pagination Footer when > 1 application */}
                  {totalAppPages > 1 && !isExternalLookup && (
                    <div className="shrink-0 px-3 sm:px-5 py-2 flex items-center justify-between border-t border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/40 text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          const prevPage = Math.max(1, safeAppPage - 1);
                          setMyAppPage(prevPage);
                          setTrackedApp(myApplications[prevPage - 1]);
                        }}
                        disabled={safeAppPage === 1}
                        className="h-[36px] inline-flex items-center gap-1 px-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs active:scale-95 touch-manipulation"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        <span>Prev</span>
                      </button>

                      <div className="flex items-center gap-1 font-mono text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold border border-slate-200 dark:border-slate-800">
                          {safeAppPage}
                        </span>
                        <span>/ {totalAppPages}</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const nextPage = Math.min(totalAppPages, safeAppPage + 1);
                          setMyAppPage(nextPage);
                          setTrackedApp(myApplications[nextPage - 1]);
                        }}
                        disabled={safeAppPage === totalAppPages}
                        className="h-[36px] inline-flex items-center gap-1 px-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs active:scale-95 touch-manipulation"
                      >
                        <span>Next</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* ================= TAB 3: TRANSPARENCY & HALL OF FAME ================= */}
        {activeTab === "transparency" && (
          <div className="max-w-2xl mx-auto w-full space-y-4 sm:space-y-5">
            {/* Hall of Fame Wall (Fixed card dimensions matching Apply & Track tabs) */}
            {(() => {
              const displayedPassers = [...passers, ...MOCK_PREVIEW_PASSERS];
              const PASSERS_PER_PAGE = 6;
              const totalPasserPages = Math.max(1, Math.ceil(displayedPassers.length / PASSERS_PER_PAGE));
              const safePassersPage = Math.max(1, Math.min(passersPage, totalPasserPages));
              const passerPages = Array.from({ length: totalPasserPages }, (_, pageIdx) =>
                displayedPassers.slice(pageIdx * PASSERS_PER_PAGE, (pageIdx + 1) * PASSERS_PER_PAGE)
              );

              return (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs h-[486px] sm:h-[520px] flex flex-col overflow-hidden">
                  {/* Card Header */}
                  <div className="shrink-0 px-3.5 py-2.5 sm:px-5 sm:py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[9.5px] sm:text-[11px] font-extrabold uppercase tracking-[0.1em] text-slate-400 dark:text-slate-500 truncate">
                        Barangay Tocok Licensure &amp; Eligibility
                      </p>
                      <h3 className="mt-0.5 flex items-center gap-1.5 text-lg sm:text-xl font-black tracking-tight leading-none">
                        <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500 shrink-0 drop-shadow-xs" />
                        <span className="bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-500 dark:from-amber-300 dark:via-yellow-300 dark:to-amber-400 bg-clip-text text-transparent">
                          Hall of Fame
                        </span>
                      </h3>
                    </div>
                    {totalPasserPages > 1 && (
                      <span className="text-[10.5px] font-semibold text-slate-400 shrink-0">
                        Page {safePassersPage}/{totalPasserPages}
                      </span>
                    )}
                  </div>

                  {/* Fixed-Height Persistent Slide Track (keeps portraits mounted so navigation never re-fetches or flickers) */}
                  <div className="flex-1 min-h-0 overflow-hidden">
                    <div
                      className="flex h-full transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform"
                      style={{ transform: `translate3d(-${(safePassersPage - 1) * 100}%, 0, 0)` }}
                    >
                      {passerPages.map((pageItems, pageIdx) => {
                        const isActivePage = pageIdx + 1 === safePassersPage;
                        return (
                          <div
                            key={pageIdx}
                            aria-hidden={!isActivePage}
                            className="w-full shrink-0 px-3 py-3 sm:px-5 sm:py-4"
                          >
                            <div className="grid grid-cols-3 gap-x-2.5 gap-y-3 sm:gap-x-6 sm:gap-y-4 content-start">
                              {pageItems.map((passer) => {
                                const badge =
                                  EXAM_BADGE_MAP[passer.exam_category || "Civil Service Exam (CSE)"] ||
                                  EXAM_BADGE_MAP["Civil Service Exam (CSE)"];
                                const nameParts = parsePasserName(passer.full_name);
                                const hasAvatar = Boolean(passer.avatar_url) && !failedPasserAvatars[passer.id];

                                return (
                                  <button
                                    key={passer.id}
                                    type="button"
                                    tabIndex={isActivePage ? 0 : -1}
                                    onClick={() => {
                                      setSelectedPasser(passer);
                                      setShowPasserModal(true);
                                    }}
                                    aria-label={`View passer profile for ${passer.full_name}`}
                                    className="group flex flex-col items-center text-center w-full min-w-0 cursor-pointer touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded-2xl p-0.5"
                                  >
                                    {/* Circular Profile Picture */}
                                    <div className="relative flex items-center justify-center">
                                      <div
                                        className={`w-16 h-16 sm:w-[82px] sm:h-[82px] aspect-square shrink-0 rounded-full p-0.5 ring-2 sm:ring-[3px] ${badge.ringClass} shadow-sm bg-white dark:bg-slate-900 flex items-center justify-center overflow-hidden transition-transform duration-200 group-hover:scale-[1.03] group-active:scale-95`}
                                      >
                                        {hasAvatar ? (
                                          /* eslint-disable-next-line @next/next/no-img-element */
                                          <img
                                            src={passer.avatar_url as string}
                                            alt={passer.full_name}
                                            decoding="sync"
                                            onError={() =>
                                              setFailedPasserAvatars((prev) => ({
                                                ...prev,
                                                [passer.id]: true,
                                              }))
                                            }
                                            className="w-full h-full aspect-square rounded-full object-cover"
                                          />
                                        ) : (
                                          <div
                                            className={`w-full h-full aspect-square rounded-full bg-gradient-to-br ${badge.avatarBg} flex items-center justify-center shadow-inner`}
                                          >
                                            <span className="text-sm sm:text-lg font-black tracking-tight select-none">
                                              {nameParts.initials}
                                            </span>
                                          </div>
                                        )}
                                      </div>

                                      <span
                                        aria-hidden="true"
                                        className="absolute -bottom-0.5 -right-0.5 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-amber-400 text-white border-2 border-white dark:border-slate-900 flex items-center justify-center shadow-xs"
                                      >
                                        <Trophy className="w-2.5 h-2.5" />
                                      </span>
                                    </div>

                                    {/* Surname Under Profile Picture */}
                                    <div className="mt-1.5 flex flex-col items-center w-full min-w-0">
                                      <span className="block font-black text-[10.5px] sm:text-xs text-slate-900 dark:text-slate-100 tracking-wider uppercase leading-tight truncate w-full">
                                        {nameParts.lastName}
                                      </span>
                                      <span
                                        aria-hidden={!nameParts.firstName}
                                        className="block font-semibold text-[9px] sm:text-[10.5px] text-slate-500 dark:text-slate-400 leading-tight truncate w-full mt-0.5 min-h-[11.5px] sm:min-h-[13.5px]"
                                      >
                                        {nameParts.firstName || "\u00A0"}
                                      </span>
                                    </div>

                                    {/* Key Info Under Surname */}
                                    <div className="mt-1 flex flex-col items-center gap-0.5 w-full min-w-0">
                                      <span
                                        className={`inline-block text-[8px] sm:text-[9.5px] font-extrabold px-1.5 sm:px-2 py-0.5 rounded-full border uppercase tracking-wide truncate max-w-full ${badge.pillClass}`}
                                      >
                                        {badge.short}
                                      </span>
                                      <span className="text-[9px] sm:text-[10.5px] font-bold text-slate-600 dark:text-slate-300 truncate max-w-full">
                                        {passer.rating !== null && passer.rating !== undefined ? (
                                          <span className="text-emerald-600 dark:text-emerald-400 font-black">
                                            {passer.rating}%
                                          </span>
                                        ) : (
                                          passer.exam_level
                                        )}
                                      </span>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Compact Pagination Footer when > 6 passers */}
                  {totalPasserPages > 1 && (
                    <div className="mt-auto shrink-0 px-3 sm:px-5 py-2 flex items-center justify-between border-t border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/40 text-xs">
                      <button
                        type="button"
                        onClick={() => setPassersPage((prev) => Math.max(1, prev - 1))}
                        disabled={safePassersPage === 1}
                        className="h-[34px] inline-flex items-center gap-1 px-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs active:scale-95 touch-manipulation"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        <span>Prev</span>
                      </button>

                      <div className="flex items-center gap-1 font-mono text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold border border-slate-200 dark:border-slate-800">
                          {safePassersPage}
                        </span>
                        <span>/ {totalPasserPages}</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setPassersPage((prev) => Math.min(totalPasserPages, prev + 1))}
                        disabled={safePassersPage === totalPasserPages}
                        className="h-[34px] inline-flex items-center gap-1 px-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs active:scale-95 touch-manipulation"
                      >
                        <span>Next</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Geographic Reach by Purok */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-3 sm:p-4 border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <h3 className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
                  Passers by Purok (1 to 7)
                </h3>
                <span className="text-[10px] sm:text-[11px] font-medium text-slate-400 shrink-0">
                  Verified passers only
                </span>
              </div>

              <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5 sm:gap-2">
                {PUROK_OPTIONS.map((p) => {
                  const count = stats?.purokBreakdown?.[p] || 0;
                  return (
                    <div
                      key={p}
                      title={p}
                      className="px-1.5 sm:px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between gap-1"
                    >
                      <span className="text-[10px] sm:text-[11px] font-bold text-slate-600 dark:text-slate-300 truncate">
                        {p.split("(")[0].trim()}
                      </span>
                      <span className="font-black text-brand-600 dark:text-brand-400 text-xs sm:text-sm tabular-nums shrink-0">
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
        </div>
          </main>
        </div>
      </div>

      {/* ================= MODAL: SUBMIT ATTENDANCE (Mobile Bottom-Sheet on mobile, centered modal on desktop) ================= */}
      {mounted && showAttendanceModal && trackedApp && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setShowAttendanceModal(false)}
          className={`fixed inset-0 z-[9999] bg-slate-950/70 dark:bg-black/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 ${
            attendanceModalClosing ? "animate-modal-backdrop-out" : "animate-modal-backdrop-in"
          }`}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl max-w-md w-full px-4 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 max-h-[88dvh] overflow-y-auto z-[10000] ${
              attendanceModalClosing ? "animate-modal-card-out" : "animate-modal-card-in"
            }`}
          >
            <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto sm:hidden" />
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="font-black text-slate-900 dark:text-white text-sm sm:text-base flex items-center gap-2">
                <Upload className="w-4 h-4 text-brand-600" />
                <span>Upload Exam Attendance Proof</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAttendanceModal(false)}
                aria-label="Close modal"
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg touch-manipulation cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {attendanceMsg && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs animate-in fade-in">
                {attendanceMsg}
              </div>
            )}

            <form noValidate onSubmit={handleAttendanceSubmit} className="space-y-4 text-xs">
              <MobileUploadCard
                label="Exam Day Proof (Stamped ONSA / Photo) *"
                sublabel="Tap to capture photo or select file."
                file={attendanceProofFile}
                onFileSelect={setAttendanceProofFile}
                required={true}
                icon={Camera}
              />

              <div className="pt-2 flex flex-col-reverse sm:flex-row justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAttendanceModal(false)}
                  className="w-full sm:w-auto px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 font-semibold touch-manipulation min-h-[44px] cursor-pointer active:scale-[0.98] transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={attendanceSubmitting}
                  className="w-full sm:w-auto px-5 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold touch-manipulation min-h-[44px] cursor-pointer active:scale-[0.98] transition-all"
                >
                  {attendanceSubmitting ? "Uploading..." : "Submit Attendance Proof"}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ================= MODAL: SUBMIT EXAM RESULT (Mobile Bottom-Sheet on mobile, centered modal on desktop) ================= */}
      {mounted && showResultModal && trackedApp && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setShowResultModal(false)}
          className={`fixed inset-0 z-[9999] bg-slate-950/70 dark:bg-black/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 ${
            resultModalClosing ? "animate-modal-backdrop-out" : "animate-modal-backdrop-in"
          }`}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl max-w-md w-full px-4 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 max-h-[88dvh] overflow-y-auto z-[10000] ${
              resultModalClosing ? "animate-modal-card-out" : "animate-modal-card-in"
            }`}
          >
            <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto sm:hidden" />
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="font-black text-slate-900 dark:text-white text-sm sm:text-base flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-500" />
                <span>Submit Exam Result</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowResultModal(false)}
                aria-label="Close modal"
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg touch-manipulation cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {resultMsg && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs animate-in fade-in">
                {resultMsg}
              </div>
            )}

            <form noValidate onSubmit={handleResultSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Examination Result *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label
                    className={`p-3 rounded-xl border text-center cursor-pointer font-bold touch-manipulation min-h-[44px] flex items-center justify-center transition-all duration-200 active:scale-[0.98] ${
                      resultStatus === "Passed"
                        ? "border-amber-500 bg-amber-50 dark:bg-amber-950 text-amber-900 dark:text-amber-200 ring-1 ring-amber-500/30"
                        : "border-slate-200 dark:border-slate-700 text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    }`}
                  >
                    <input
                      type="radio"
                      name="res"
                      value="Passed"
                      checked={resultStatus === "Passed"}
                      onChange={() => setResultStatus("Passed")}
                      className="sr-only"
                    />
                    <span>Passed</span>
                  </label>

                  <label
                    className={`p-3 rounded-xl border text-center cursor-pointer font-bold touch-manipulation min-h-[44px] flex items-center justify-center transition-all duration-200 active:scale-[0.98] ${
                      resultStatus === "Did Not Pass"
                        ? "border-slate-500 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white ring-1 ring-slate-400/30"
                        : "border-slate-200 dark:border-slate-700 text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    }`}
                  >
                    <input
                      type="radio"
                      name="res"
                      value="Did Not Pass"
                      checked={resultStatus === "Did Not Pass"}
                      onChange={() => setResultStatus("Did Not Pass")}
                      className="sr-only"
                    />
                    <span>Did Not Pass</span>
                  </label>
                </div>
              </div>

              <div
                aria-hidden={resultStatus !== "Passed"}
                className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
                  resultStatus === "Passed"
                    ? "grid-rows-[1fr] opacity-100"
                    : "grid-rows-[0fr] opacity-0 pointer-events-none"
                }`}
              >
                <div className="overflow-hidden min-h-0">
                  <div className="space-y-4 pt-0.5">
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Exam Rating % (Optional, e.g. 84.50)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        inputMode="decimal"
                        value={ratingInput}
                        onChange={(e) => setRatingInput(e.target.value)}
                        placeholder="e.g. 85.20"
                        className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-base sm:text-xs"
                      />
                    </div>

                    <MobileUploadCard
                      label="Result Attachment"
                      sublabel="Screenshot of Passer List / Rating / Certificate."
                      file={resultProofFile}
                      onFileSelect={setResultProofFile}
                      required={false}
                      icon={Trophy}
                    />

                    <label className="flex items-start gap-2.5 cursor-pointer mt-1 touch-manipulation">
                      <input
                        type="checkbox"
                        checked={featureConsent}
                        onChange={(e) => setFeatureConsent(e.target.checked)}
                        className="w-4 h-4 accent-amber-600 rounded mt-0.5"
                      />
                      <span className="text-[11px] text-slate-600 dark:text-slate-400 leading-tight">
                        Feature my name on the <strong>Barangay Tocok Hall of Fame</strong> to inspire fellow youth!
                      </span>
                    </label>

                    <div
                      aria-hidden={!featureConsent}
                      className={`grid transition-[grid-template-rows,opacity] duration-250 ease-out ${
                        featureConsent
                          ? "grid-rows-[1fr] opacity-100"
                          : "grid-rows-[0fr] opacity-0 pointer-events-none"
                      }`}
                    >
                      <div className="overflow-hidden min-h-0">
                        <div className="flex items-center gap-2.5 pt-0.5">
                          <div className="w-11 h-11 rounded-full shrink-0 p-0.5 ring-2 ring-amber-400/80 bg-white dark:bg-slate-900 overflow-hidden flex items-center justify-center">
                            {(() => {
                              const existingPreview =
                                passerAvatarPreviewUrl ||
                                trackedApp.passer_avatar_url ||
                                currentUser?.avatar_url;
                              if (existingPreview) {
                                return (
                                  /* eslint-disable-next-line @next/next/no-img-element */
                                  <img
                                    src={existingPreview}
                                    alt={trackedApp.full_name}
                                    className="w-full h-full rounded-full object-cover"
                                  />
                                );
                              }
                              return (
                                <div className="w-full h-full rounded-full bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center">
                                  <span className="text-xs font-black">
                                    {parsePasserName(trackedApp.full_name).initials}
                                  </span>
                                </div>
                              );
                            })()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <MobileUploadCard
                              compact
                              label="Hall of Fame Profile Photo"
                              sublabel="Optional portrait (or uses account photo)"
                              file={passerAvatarFile}
                              onFileSelect={setPasserAvatarFile}
                              accept="image/*"
                              required={false}
                              icon={Camera}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex flex-col-reverse sm:flex-row justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowResultModal(false)}
                  className="w-full sm:w-auto px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 font-semibold touch-manipulation min-h-[44px] cursor-pointer active:scale-[0.98] transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resultSubmitting}
                  className="w-full sm:w-auto px-5 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold touch-manipulation min-h-[44px] cursor-pointer active:scale-[0.98] transition-all"
                >
                  {resultSubmitting ? "Saving..." : "Submit Result"}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ================= MODAL: PROGRAM GUIDELINES & INFO ================= */}
      {mounted && showInfoModal && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          className={`fixed inset-0 z-[9999] bg-slate-950/75 dark:bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-6 pt-[max(2.5rem,env(safe-area-inset-top,0px))] overscroll-none touch-none select-none ${
            infoModalClosing ? "animate-modal-backdrop-out" : "animate-modal-backdrop-in"
          }`}
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
            className={`relative bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl max-w-4xl lg:max-w-5xl w-full max-h-[90dvh] sm:max-h-[calc(100dvh-3rem)] shadow-2xl border border-slate-200 dark:border-slate-800 sm:my-auto z-[10000] flex flex-col overflow-hidden font-sans overscroll-contain touch-auto select-text ${
              infoModalClosing ? "animate-modal-card-out" : "animate-modal-card-in"
            }`}
            onClick={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
          >
            {/* Mobile Bottom-Sheet Drag Handle */}
            <div className="sm:hidden flex justify-center pt-2.5 pb-0.5 shrink-0 bg-white dark:bg-slate-900">
              <div className="w-10 h-1 rounded-full bg-slate-200 dark:bg-slate-700" />
            </div>

            {/* Modal Header */}
            <div className="flex items-center justify-between gap-3 px-4 py-3.5 sm:p-6 lg:px-8 border-b border-slate-100 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900">
              <div>
                <h2 className="text-base sm:text-2xl font-black text-slate-950 dark:text-slate-50 tracking-tight">
                  Youth Licensure, Eligibility &amp; Certification Exam Assistance
                </h2>
                <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  3-Year CBYDP (Education / Economic Empowerment) • Ratified by KK Assembly • Funded via ABYIP
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowInfoModal(false)}
                aria-label="Close guidelines"
                className="w-9 h-9 rounded-xl text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div
              className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-7 lg:p-8 space-y-4 lg:space-y-5 overscroll-contain no-scrollbar"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              {/* Program Highlights */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-slate-50/80 dark:bg-slate-800/70 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3.5 sm:p-4 shadow-2xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">Peso Ceiling</span>
                    <span className="text-[9.5px] font-bold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/70 px-2 py-0.5 rounded-full">Up to ₱1,000</span>
                  </div>
                  <p className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <Receipt className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    CSE, LET, PhilNITS &amp; TESDA
                  </p>
                  <p className="text-[11.5px] text-slate-600 dark:text-slate-400 leading-relaxed">
                    Covers actual exam fee paid up to <strong>₱1,000.00 max</strong> per grant so the ABYIP fund protects all <strong>{quotaSlots} annual slots</strong> fairly.
                  </p>
                </div>

                <div className="bg-slate-50/80 dark:bg-slate-800/70 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3.5 sm:p-4 shadow-2xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">80 / 20 Slot Split</span>
                    <span className="text-[9.5px] font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/70 px-2 py-0.5 rounded-full">{remainingSlots} / {quotaSlots} Left</span>
                  </div>
                  <p className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    Max 1 Retake / Term
                  </p>
                  <p className="text-[11.5px] text-slate-600 dark:text-slate-400 leading-relaxed">
                    <strong>80%</strong> of annual slots reserved for first-timers; <strong>20%</strong> cap for qualified retakers (max 1 retake in 3 yrs).
                  </p>
                </div>

                <div className="bg-slate-50/80 dark:bg-slate-800/70 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3.5 sm:p-4 shadow-2xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-brand-700 dark:text-brand-400">Post-Exam Release</span>
                    <span className="text-[9.5px] font-bold bg-brand-50 dark:bg-brand-950/50 text-brand-700 dark:text-brand-400 border border-brand-200 dark:border-brand-800/70 px-2 py-0.5 rounded-full">COA Ready</span>
                  </div>
                  <p className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <GraduationCap className="w-4 h-4 text-brand-600 dark:text-brand-400 shrink-0" />
                    No Pre-Exam Payout
                  </p>
                  <p className="text-[11.5px] text-slate-600 dark:text-slate-400 leading-relaxed">
                    Grants are released <strong>only after</strong> you sit for the exam and upload your stamped NOA / test-day proof.
                  </p>
                </div>
              </div>

              {/* Program Guidelines */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-2xs space-y-3">
                <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Implementing Rules &amp; COA Safeguards</h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">RA 11768 &amp; DBM-DILG-NYC JMC No. 1, s. 2025 Aligned</p>
                  </div>
                </div>

                <ul className="mt-2.5 space-y-2.5 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-600 mt-1.5 shrink-0" />
                    <span><strong className="text-slate-800 dark:text-slate-200">Covered Examinations &amp; Why ₱1,000 Max:</strong> Covers Civil Service Exam (CSE — ₱500), LET &amp; PRC Board Exams (₱900), PhilNITS, and TESDA NC assessments up to a <strong>₱1,000.00 ceiling</strong> (any excess is shouldered by the applicant). This covers full CSE and PRC fees while dividing the ₱{(stats?.totalBudget ?? 20000).toLocaleString()} ABYIP fund fairly across all <strong>{quotaSlots} annual slots</strong> so high-cost certifications never drain grants meant for fellow youth.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-600 mt-1.5 shrink-0" />
                    <span><strong className="text-slate-800 dark:text-slate-200">Age &amp; Residency:</strong> Must be a bonafide Barangay Tocok resident and KK member aged <strong>15–30 on the actual exam date</strong> (18–30 for CSE/PRC boards).</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-600 mt-1.5 shrink-0" />
                    <span><strong className="text-slate-800 dark:text-slate-200">SK Officials Exclusion:</strong> Incumbent SK officials (Chairperson, Kagawads, Secretary, Treasurer) are disqualified during their term to prevent conflict of interest.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-600 mt-1.5 shrink-0" />
                    <span><strong className="text-slate-800 dark:text-slate-200">Post-Exam Subsidy Release:</strong> Zero cash is released prior to exam day. Submit your OR/e-OR and NOA upfront, sit for the test, and upload your stamped NOA / test-day proof to release payout via Disbursement Voucher (DV).</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-600 mt-1.5 shrink-0" />
                    <span><strong className="text-slate-800 dark:text-slate-200">1 Retake Cap &amp; 80/20 Priority:</strong> 80% of annual slots go to first-timers and 20% to retakers. Maximum <strong>2 grants per person across the 3-year CBYDP term</strong> (1 first-time + 1 retake). Retakers must attach their stamped prior NOA or test rating proving they sat for the first attempt; prior no-shows are ineligible.</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 lg:px-8 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-5 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-end shrink-0">
              <button
                type="button"
                onClick={() => setShowInfoModal(false)}
                className="w-full sm:w-auto min-h-[46px] px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs sm:text-sm shadow-sm transition-colors cursor-pointer"
              >
                Got It, Return to Exam Portal
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ================= MODAL: PASSER PROFILE & HONORS DETAILS ================= */}
      {mounted && showPasserModal && selectedPasser && createPortal(
        (() => {
          const badge =
            EXAM_BADGE_MAP[selectedPasser.exam_category || "Civil Service Exam (CSE)"] ||
            EXAM_BADGE_MAP["Civil Service Exam (CSE)"];
          const nameParts = parsePasserName(selectedPasser.full_name);
          const hasAvatar =
            Boolean(selectedPasser.avatar_url) && !failedPasserAvatars[selectedPasser.id];

          return (
            <div
              role="dialog"
              aria-modal="true"
              aria-label={`Passer profile for ${selectedPasser.full_name}`}
              onClick={() => setShowPasserModal(false)}
              className={`fixed inset-0 z-[9999] bg-slate-950/70 dark:bg-black/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 overscroll-none ${
                passerModalClosing ? "animate-modal-backdrop-out" : "animate-modal-backdrop-in"
              }`}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className={`relative bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl max-w-md w-full px-4 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-5 max-h-[88dvh] overflow-y-auto z-[10000] overscroll-contain ${
                  passerModalClosing ? "animate-modal-card-out" : "animate-modal-card-in"
                }`}
              >
                <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto sm:hidden" />

                <button
                  type="button"
                  onClick={() => setShowPasserModal(false)}
                  aria-label="Close passer details"
                  className="absolute top-3.5 right-3.5 w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer touch-manipulation"
                >
                  <X className="w-4 h-4" />
                </button>

                {/* Centered Portrait & Name */}
                <div className="flex flex-col items-center text-center pt-1">
                  <div className="relative flex items-center justify-center">
                    <div
                      className={`w-24 h-24 sm:w-28 sm:h-28 aspect-square rounded-full p-1 ring-4 ${badge.ringClass} shadow-md bg-white dark:bg-slate-900 flex items-center justify-center overflow-hidden`}
                    >
                      {hasAvatar ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={selectedPasser.avatar_url as string}
                          alt={selectedPasser.full_name}
                          onError={() =>
                            setFailedPasserAvatars((prev) => ({
                              ...prev,
                              [selectedPasser.id]: true,
                            }))
                          }
                          className="w-full h-full aspect-square rounded-full object-cover"
                        />
                      ) : (
                        <div
                          className={`w-full h-full aspect-square rounded-full bg-gradient-to-br ${badge.avatarBg} flex items-center justify-center shadow-inner`}
                        >
                          <span className="text-2xl sm:text-3xl font-black tracking-tight select-none">
                            {nameParts.initials}
                          </span>
                        </div>
                      )}
                    </div>

                    <span
                      aria-hidden="true"
                      className="absolute -bottom-0.5 -right-0.5 w-7 h-7 rounded-full bg-amber-400 text-white border-2 border-white dark:border-slate-900 flex items-center justify-center shadow-sm"
                    >
                      <Trophy className="w-3.5 h-3.5" />
                    </span>
                  </div>

                  <div className="mt-3 space-y-0.5">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[10px] font-bold mb-1">
                      <Trophy className="w-3 h-3 text-amber-600" />
                      <span>Honor Roll Passer</span>
                    </div>
                    <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight leading-snug">
                      {selectedPasser.full_name}
                    </h3>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      {selectedPasser.purok}
                    </p>
                  </div>
                </div>

                {/* Detailed Examination Breakdown */}
                <div className="rounded-2xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/70 divide-y divide-slate-200/70 dark:divide-slate-700/60 text-xs">
                  <div className="flex items-center justify-between gap-3 px-4 py-3">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">Exam Program</span>
                    <div className="flex items-center gap-1.5 min-w-0 justify-end">
                      <span
                        className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border uppercase tracking-wide shrink-0 ${badge.pillClass}`}
                      >
                        {badge.short}
                      </span>
                      <span className="font-bold text-slate-900 dark:text-slate-100 truncate">
                        {selectedPasser.exam_category || "Civil Service Exam (CSE)"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 px-4 py-3">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">Track / Level</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100 text-right">
                      {selectedPasser.exam_level}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3 px-4 py-3">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">Exam Batch</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100 text-right">
                      {selectedPasser.exam_date}
                    </span>
                  </div>

                  {selectedPasser.rating !== null && selectedPasser.rating !== undefined && (
                    <div className="flex items-center justify-between gap-3 px-4 py-3">
                      <span className="text-slate-500 dark:text-slate-400 font-medium">Exam Rating</span>
                      <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm">
                        {selectedPasser.rating}%
                      </span>
                    </div>
                  )}

                  {selectedPasser.result_verified_at && (
                    <div className="flex items-center justify-between gap-3 px-4 py-3">
                      <span className="text-slate-500 dark:text-slate-400 font-medium">Verified On</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {new Date(selectedPasser.result_verified_at).toLocaleDateString("en-PH", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setShowPasserModal(false)}
                  className="w-full min-h-[44px] py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs sm:text-sm shadow-xs transition-all active:scale-[0.98] cursor-pointer touch-manipulation"
                >
                  Close
                </button>
              </div>
            </div>
          );
        })(),
        document.body
      )}
      {/* Floating Form Validation & Notice Toast (prevents shifting card/form position on mobile) */}
      {mounted && (submitError || warningNotice || trackSuccessMsg) && createPortal(
        <div
          role={submitError ? "alert" : "status"}
          className="fixed left-1/2 -translate-x-1/2 z-[9000] w-[calc(100%-1.5rem)] max-w-md pointer-events-auto animate-in fade-in"
          style={{ top: "calc(var(--header-spacer-h, 68px) + 0.5rem)" }}
        >
          {submitError ? (
            <div className="p-3 rounded-xl bg-rose-50/95 dark:bg-rose-950/95 backdrop-blur-md border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs font-semibold shadow-lg flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                <span className="leading-snug">{submitError}</span>
              </div>
              <button
                type="button"
                onClick={() => setSubmitError(null)}
                aria-label="Dismiss error"
                className="p-1 rounded-lg text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-900/50 shrink-0 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : trackSuccessMsg ? (
            <div className="p-3 rounded-xl bg-emerald-50/95 dark:bg-emerald-950/95 backdrop-blur-md border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-semibold shadow-lg flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="leading-snug">{trackSuccessMsg}</span>
              </div>
              <button
                type="button"
                onClick={() => setTrackSuccessMsg(null)}
                aria-label="Dismiss confirmation"
                className="p-1 rounded-lg text-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 shrink-0 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-amber-50/95 dark:bg-amber-950/95 backdrop-blur-md border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs font-semibold shadow-lg flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span className="leading-snug">{warningNotice}</span>
              </div>
              <button
                type="button"
                onClick={() => setWarningNotice(null)}
                aria-label="Dismiss warning"
                className="p-1 rounded-lg text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900/50 shrink-0 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>,
        document.body
      )}
      <SearchModal
        open={showManualSearch}
        onClose={() => setShowManualSearch(false)}
        title="Check Subsidy Status & Submit Proof"
        ariaLabel="Lookup exam tracking code"
        placeholder="Enter tracking code (e.g. CSE-2027-A1B2)..."
        hintText="Enter your unique tracking code to view status or upload proof"
        submitLabel="Track Application"
        loadingLabel="Looking up..."
        value={trackInput}
        onChange={(val) => {
          setTrackInput(val.toUpperCase());
          if (trackError) setTrackError(null);
        }}
        onSubmit={async () => {
          const ok = await handleTrackLookup(trackInput);
          if (ok) {
            setShowManualSearch(false);
            setTimeout(() => {
              document.getElementById("cse-tracked-details")?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              });
            }, 150);
          }
        }}
        loading={trackingLoading}
        required
        error={trackError}
      />
    </div>
  );
}

export default function CsePage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-sm text-slate-400">Loading Exam Subsidy Hub...</div>}>
      <CseContent />
    </Suspense>
  );
}
