"use client";

import { useState, useEffect, useRef, Suspense } from "react";
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
  LogIn,
  UserPlus,
  LogOut,
  User,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import {
  PUROK_OPTIONS,
  DEFAULT_ANNUAL_SLOTS,
  STANDARD_CSE_BATCHES,
  getReimbursementBadge,
  getAttendanceBadge,
  getResultBadge,
  type ExamLevel,
  type PayoutPreference,
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
  purokBreakdown: Record<string, number>;
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
}: {
  label: string;
  sublabel: string;
  file: File | null;
  onFileSelect: (f: File | null) => void;
  accept?: string;
  required?: boolean;
  icon?: React.ElementType;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        onChange={(e) => onFileSelect(e.target.files?.[0] || null)}
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
            <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-100/90 dark:bg-emerald-950/80 text-emerald-900 dark:text-emerald-200 text-xs font-semibold max-w-full">
              <span className="truncate">{file.name}</span>
              <span className="shrink-0 text-[10px] text-emerald-700 dark:text-emerald-400">
                ({(file.size / 1024).toFixed(0)} KB)
              </span>
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

const CSE_TABS = [
  { id: "apply", label: "Apply for Reimbursement", shortLabel: "Apply", icon: FileText },
  { id: "track", label: "Track & Upload Proof", shortLabel: "Track", icon: Clock },
  { id: "transparency", label: "Transparency & Passers", shortLabel: "Passers", icon: Trophy },
] as const;

type CseTab = (typeof CSE_TABS)[number]["id"];

function CseContent() {
  const searchParams = useSearchParams();
  const initialTrackCode = searchParams.get("code") || "";

  const {
    user: currentUser,
    authLoading: authChecking,
    setUser: setCurrentUser,
    logout,
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

  const [activeTab, setActiveTab] = useState<CseTab>("apply");
  const [stats, setStats] = useState<CseProgramStats | null>(null);
  const [passers, setPassers] = useState<CsePublicPasser[]>([]);
  const [targetBatch, setTargetBatch] = useState<string>("March 2027 CSE-PPT");

  // Track Form State
  const [trackInput, setTrackInput] = useState(initialTrackCode);
  const [trackedApp, setTrackedApp] = useState<CseApplication | null>(null);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackError, setTrackError] = useState<string | null>(null);
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
  const [facebookName, setFacebookName] = useState("");
  const [purok, setPurok] = useState<string>(PUROK_OPTIONS[0]);
  const [birthdate, setBirthdate] = useState("");
  const [schoolOrWork, setSchoolOrWork] = useState("");

  const [examLevel, setExamLevel] = useState<ExamLevel>("Professional");
  const [selectedBatchOption, setSelectedBatchOption] = useState<string>("March 2027 CSE-PPT");
  const [customBatch, setCustomBatch] = useState<string>("");
  const [examDate, setExamDate] = useState("March 2027 CSE-PPT");
  const [isFirstTime, setIsFirstTime] = useState(true);

  const [payoutPreference, setPayoutPreference] = useState<PayoutPreference>("Barangay Hall Cash Pickup");
  const [gcashNumber, setGcashNumber] = useState("");
  const [gcashAccountName, setGcashAccountName] = useState("");
  const [cscReceiptNo, setCscReceiptNo] = useState("");

  // Files
  const [validIdFile, setValidIdFile] = useState<File | null>(null);
  const [cscReceiptFile, setCscReceiptFile] = useState<File | null>(null);
  const [examScheduleFile, setExamScheduleFile] = useState<File | null>(null);

  // Self-service modal updates in tracking
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [attendanceProofFile, setAttendanceProofFile] = useState<File | null>(null);
  const [attendanceNotes, setAttendanceNotes] = useState("");
  const [attendanceKey, setAttendanceKey] = useState("");
  const [attendanceSubmitting, setAttendanceSubmitting] = useState(false);
  const [attendanceMsg, setAttendanceMsg] = useState<string | null>(null);

  const [showResultModal, setShowResultModal] = useState(false);
  const [resultStatus, setResultStatus] = useState<"Passed" | "Did Not Pass">("Passed");
  const [ratingInput, setRatingInput] = useState("");
  const [resultProofFile, setResultProofFile] = useState<File | null>(null);
  const [featureConsent, setFeatureConsent] = useState(true);
  const [resultKey, setResultKey] = useState("");
  const [resultSubmitting, setResultSubmitting] = useState(false);
  const [resultMsg, setResultMsg] = useState<string | null>(null);

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
      if (data.user?.name) setFullName(data.user.name);
      if (data.user?.email) setEmail(data.user.email);
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : "Failed to create account");
    } finally {
      setAuthSubmitting(false);
    }
  };

  const renderAuthCard = (subtitleText: string) => (
    <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 p-5 sm:p-8 shadow-xs max-w-md mx-auto space-y-4 animate-in fade-in font-sans">
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

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] sm:text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Password <span className="text-slate-400 text-[10px]">(6+ chars)</span>
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

  const handleTrackLookup = async (codeToLookup?: string) => {
    const code = (codeToLookup || trackInput).trim().toUpperCase();
    if (!code) {
      setTrackError("Please enter your tracking code.");
      return;
    }

    setTrackingLoading(true);
    setTrackError(null);
    try {
      const res = await fetch(`/api/cse/${encodeURIComponent(code)}`);
      const data = await res.json();
      if (data.success && data.application) {
        setTrackedApp(data.application);
      } else {
        setTrackError(data.error || "Application not found. Please check your code.");
        setTrackedApp(null);
      }
    } catch (err) {
      console.error("Track error:", err);
      setTrackError("Failed to look up application. Please try again.");
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

  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    // Final Validations
    const age = calculateAge(birthdate);
    if (age < 18 || age > 30) {
      setSubmitError("Examinee must be between 18 and 30 years old.");
      return;
    }
    if (!validIdFile || !cscReceiptFile || !examScheduleFile) {
      setSubmitError("Please attach all three required documents.");
      return;
    }
    if (payoutPreference === "GCash" && !gcashNumber) {
      setSubmitError("Please provide your GCash mobile number.");
      return;
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("fullName", fullName);
      fd.append("contactNumber", contactNumber);
      fd.append("email", email);
      fd.append("facebookName", facebookName);
      fd.append("purok", purok);
      fd.append("birthdate", birthdate);
      fd.append("schoolOrEmployment", schoolOrWork);

      fd.append("examLevel", examLevel);
      fd.append("examDate", examDate);
      fd.append("isFirstTime", String(isFirstTime));

      fd.append("payoutPreference", payoutPreference);
      fd.append("gcashNumber", gcashNumber);
      fd.append("gcashAccountName", gcashAccountName);
      fd.append("cscReceiptNo", cscReceiptNo);

      fd.append("validId", validIdFile);
      fd.append("cscReceipt", cscReceiptFile);
      fd.append("examSchedule", examScheduleFile);

      const res = await fetch("/api/cse", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to submit application.");
      }

      setGeneratedCode(data.trackingCode);
      setApplyStep(4);
      fetchProgramData();
    } catch (err: unknown) {
      setSubmitError((err as Error).message || "An unexpected error occurred.");
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
    if (!attendanceKey) {
      setAttendanceMsg("Please enter your birthdate (YYYY-MM-DD) or last 4 digits of your phone.");
      return;
    }

    setAttendanceSubmitting(true);
    setAttendanceMsg(null);
    try {
      const fd = new FormData();
      fd.append("action", "submit_attendance");
      fd.append("verificationKey", attendanceKey);
      fd.append("attendanceProof", attendanceProofFile);
      fd.append("notes", attendanceNotes);

      const res = await fetch(`/api/cse/${trackedApp.tracking_code}`, {
        method: "PATCH",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to submit attendance proof.");
      }

      alert("Exam day proof submitted successfully!");
      setShowAttendanceModal(false);
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
    if (!resultKey) {
      setResultMsg("Please enter your birthdate (YYYY-MM-DD) or last 4 digits of your phone.");
      return;
    }

    setResultSubmitting(true);
    setResultMsg(null);
    try {
      const fd = new FormData();
      fd.append("action", "submit_result");
      fd.append("verificationKey", resultKey);
      fd.append("examResult", resultStatus);
      fd.append("rating", ratingInput);
      fd.append("featureConsent", String(featureConsent));
      if (resultProofFile) {
        fd.append("resultProof", resultProofFile);
      }

      const res = await fetch(`/api/cse/${trackedApp.tracking_code}`, {
        method: "PATCH",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to submit exam result.");
      }

      alert("Exam result updated successfully! Thank you for updating the SK council.");
      setShowResultModal(false);
      handleTrackLookup(trackedApp.tracking_code);
      fetchProgramData();
    } catch (err: unknown) {
      setResultMsg((err as Error).message);
    } finally {
      setResultSubmitting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const quotaSlots = stats?.quotaSlots ?? DEFAULT_ANNUAL_SLOTS;
  const remainingSlots = stats?.remainingSlots ?? DEFAULT_ANNUAL_SLOTS;
  const totalPassers = stats?.totalPassers ?? 0;
  const reimbursedCount = stats?.reimbursedCount ?? 0;
  const totalReimbursedAmount = stats?.totalReimbursedAmount ?? 0;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-32 sm:pb-24">
      {/* Hero Header - Clean, compact header */}
      <div className="pt-3 pb-1.5 sm:pt-6 sm:pb-2 px-3 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white mb-1 sm:mb-1.5 leading-snug sm:leading-tight">
            Free Civil Service Exam (CSE) <br />
            <span className="text-amber-600 dark:text-amber-400">₱500 Registration Subsidy</span>
          </h1>

          <p className="text-slate-600 dark:text-slate-300 text-xs sm:text-sm max-w-2xl leading-relaxed mb-3 sm:mb-4">
            <span className="sm:hidden">
              ₱500 exam fee reimbursement for Tocok youth (18–30). Pay at CSC first, upload your Official Receipt, and get reimbursed.
            </span>
            <span className="hidden sm:inline">
              Empowering the young people of Barangay Tocok to enter government service. 
              Because this is public funding, you pay your ₱500 exam fee at CSC first, submit your Official Receipt, 
              and the SK will reimburse your ₱500. We also track your exam attendance and celebrate your passing result!
            </span>
          </p>

          {/* Quick Metrics Strip: Compact & Hierarchical Single Bar */}
          <div className="max-w-3xl bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xs p-2 sm:p-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
              {/* Primary Level 1 Hero: Quota & Subsidy (The core applicant value) */}
              <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-amber-500/10 dark:bg-amber-500/20 border border-amber-300 dark:border-amber-600/60 text-amber-600 dark:text-amber-400 flex items-center justify-center font-black text-sm sm:text-base shrink-0 shadow-2xs">
                  {remainingSlots}
                </div>
                <div className="min-w-0">
                  <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white block truncate leading-tight">
                    {remainingSlots} of {quotaSlots} Slots Available
                  </span>
                  <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 truncate leading-normal">
                    <span className="font-bold text-amber-600 dark:text-amber-400">₱500 full subsidy</span> per approved examinee
                  </p>
                </div>
              </div>

              {/* Secondary Level 2 Trackers: Released & Passers */}
              <div className="flex items-center gap-3 sm:gap-4 shrink-0 pt-1.5 sm:pt-0 border-t sm:border-t-0 sm:border-l border-slate-100 dark:border-slate-800 sm:pl-4">
                <div className="flex-1 sm:flex-initial text-left sm:text-right">
                  <span className="text-[9px] sm:text-[10px] text-slate-400 dark:text-slate-500 block font-semibold uppercase tracking-wider leading-none">
                    Released
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400 block leading-tight mt-0.5">
                    ₱{totalReimbursedAmount.toLocaleString()}
                  </span>
                </div>
                <div className="w-px h-5 sm:h-6 bg-slate-200 dark:bg-slate-800 shrink-0" />
                <div className="flex-1 sm:flex-initial text-left sm:text-right">
                  <span className="text-[9px] sm:text-[10px] text-slate-400 dark:text-slate-500 block font-semibold uppercase tracking-wider leading-none">
                    Passers
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white block leading-tight mt-0.5">
                    {totalPassers}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop 2-Column Layout: Left Navigation Sidebar Rail + Main Content Area */}
      <div className="max-w-6xl mx-auto px-2.5 sm:px-6 mt-3 sm:mt-6">
        <div className="flex flex-col md:flex-row gap-4 sm:gap-6 items-start">
          {/* Left Navigation Icon Rail (Desktop view: Just Icons, sticky on left) */}
          <aside
            className="hidden md:flex flex-col w-14 lg:w-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-1.5 shadow-xs shrink-0 sticky items-center gap-1.5"
            style={{ top: "132px" }}
          >
            {CSE_TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  title={tab.label}
                  aria-label={tab.label}
                  className={`w-11 h-11 flex items-center justify-center rounded-xl transition-all cursor-pointer ${
                    isActive
                      ? "bg-brand-600 text-white shadow-xs font-bold scale-102"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </button>
              );
            })}
          </aside>

          {/* Main Content Area */}
          <main className="flex-1 min-w-0 w-full flex flex-col gap-3.5 sm:gap-6">
            {/* Mobile Module Switcher (Full-Width 3-Column Segmented Tabs, md:hidden) */}
            <div className="md:hidden grid grid-cols-3 gap-0.5 bg-slate-100/90 dark:bg-slate-800/90 p-0.5 rounded-xl border border-slate-200/80 dark:border-slate-800/90 shadow-xs">
              {CSE_TABS.map((tab) => {
                const isActive = activeTab === tab.id;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center justify-center gap-1 py-1.5 px-1 rounded-lg text-[11px] font-bold transition-all select-none active:scale-95 cursor-pointer touch-manipulation whitespace-nowrap ${
                      isActive
                        ? "bg-white dark:bg-slate-900 text-brand-700 dark:text-brand-400 shadow-xs border border-slate-200/60 dark:border-slate-700/70 font-extrabold"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-white/50 dark:hover:bg-slate-700/50"
                    }`}
                  >
                    <Icon
                      className={`w-3 h-3 shrink-0 ${
                        isActive ? "text-brand-600 dark:text-brand-400" : "text-slate-500 dark:text-slate-400"
                      }`}
                    />
                    <span className="truncate">{tab.shortLabel}</span>
                  </button>
                );
              })}
            </div>
        {/* ================= TAB 1: APPLY ================= */}
        {activeTab === "apply" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
            {/* Left 2 Cols: Step-by-step Form */}
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl p-4 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
              {authChecking ? (
                <div className="py-16 text-center space-y-3">
                  <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400">
                    Checking resident account status...
                  </p>
                </div>
              ) : !currentUser ? (
                renderAuthCard("Sign in or create an account to apply for the Civil Service Exam ₱500 registration subsidy.")
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
                    Your request for the ₱500 Civil Service Exam reimbursement has been received. Please keep your tracking code safe to check payout status and submit exam proofs later.
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
                        setValidIdFile(null);
                        setCscReceiptFile(null);
                        setExamScheduleFile(null);
                      }}
                      className="w-full sm:w-auto px-5 py-3 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-all touch-manipulation min-h-[46px]"
                    >
                      Submit Another Application
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleApplySubmit}>
                  {/* Logged in Resident Identity Banner */}
                  <div className="flex items-center justify-between p-3 sm:p-3.5 rounded-2xl bg-brand-50/70 dark:bg-brand-950/40 border border-brand-200/80 dark:border-brand-800/60 mb-4 sm:mb-5 text-xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-brand-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                        {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : "U"}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <span className="font-bold text-slate-900 dark:text-white truncate">
                            {currentUser.name}
                          </span>
                          <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/80 px-2 py-0.5 rounded-md shrink-0">
                            Logged In
                          </span>
                        </div>
                        <span className="text-slate-500 dark:text-slate-400 text-[11px] block truncate">
                          {currentUser.email}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => logout()}
                      className="text-xs text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 font-semibold px-2 py-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition shrink-0 ml-2 cursor-pointer touch-manipulation"
                    >
                      Sign out
                    </button>
                  </div>

                  {/* Step Progress Bar on Mobile */}
                  <div className="flex items-center gap-1.5 mb-4 sm:mb-5">
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
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-5">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400">
                        Step {applyStep} of 3
                      </span>
                      <h2 className="text-base sm:text-xl font-black text-slate-900 dark:text-white">
                        {applyStep === 1 && "Personal & Residency Profile"}
                        {applyStep === 2 && "Exam Details & Payout Preference"}
                        {applyStep === 3 && "Upload Official Receipts & Proof"}
                      </h2>
                    </div>
                    <span className="text-[11px] font-medium text-slate-400 hidden sm:inline">
                      {targetBatch}
                    </span>
                  </div>

                  {submitError && (
                    <div className="mb-5 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-medium flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{submitError}</span>
                    </div>
                  )}

                  {/* Step 1: Personal & Residency */}
                  {applyStep === 1 && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Full Name (as registered with CSC) *
                        </label>
                        <input
                          type="text"
                          required
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="e.g. Juan Dela Cruz"
                          className="w-full min-w-0 max-w-full px-3.5 py-3 sm:py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-base sm:text-sm focus:ring-2 focus:ring-brand-500 outline-none box-border"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="min-w-0">
                          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Contact Number (Mobile / SMS) *
                          </label>
                          <input
                            type="tel"
                            required
                            value={contactNumber}
                            onChange={(e) => setContactNumber(e.target.value)}
                            placeholder="0912 345 6789"
                            className="w-full min-w-0 max-w-full px-3.5 py-3 sm:py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-base sm:text-sm focus:ring-2 focus:ring-brand-500 outline-none box-border"
                          />
                        </div>

                        <div className="min-w-0">
                          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Birthdate (Aged 18–30) *
                          </label>
                          <input
                            type="date"
                            required
                            value={birthdate}
                            onChange={(e) => setBirthdate(e.target.value)}
                            className="w-full px-3.5 py-3 sm:py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-base sm:text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                          />
                          {birthdate && (
                            <span className="text-[11px] text-slate-500 mt-1 block">
                              Age: <strong>{calculateAge(birthdate)} years old</strong>{" "}
                              {calculateAge(birthdate) < 18 || calculateAge(birthdate) > 30 ? (
                                <span className="text-rose-500 font-semibold">(18-30 bracket only)</span>
                              ) : (
                                <span className="text-emerald-500 font-semibold">(Eligible)</span>
                              )}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="min-w-0">
                          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Barangay Tocok Purok *
                          </label>
                          <select
                            value={purok}
                            onChange={(e) => setPurok(e.target.value)}
                            className="w-full min-w-0 max-w-full px-3.5 py-3 sm:py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-base sm:text-sm focus:ring-2 focus:ring-brand-500 outline-none box-border"
                          >
                            {PUROK_OPTIONS.map((p) => (
                              <option key={p} value={p}>
                                {p}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="min-w-0">
                          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Facebook Name / Link (Optional)
                          </label>
                          <input
                            type="text"
                            value={facebookName}
                            onChange={(e) => setFacebookName(e.target.value)}
                            placeholder="e.g. facebook.com/juan"
                            className="w-full min-w-0 max-w-full px-3.5 py-3 sm:py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-base sm:text-sm focus:ring-2 focus:ring-brand-500 outline-none box-border"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Current School / Workplace (Optional)
                        </label>
                        <input
                          type="text"
                          value={schoolOrWork}
                          onChange={(e) => setSchoolOrWork(e.target.value)}
                          placeholder="e.g. Graduating Senior / Fresh Grad / Jobseeker"
                          className="w-full min-w-0 max-w-full px-3.5 py-3 sm:py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-base sm:text-sm focus:ring-2 focus:ring-brand-500 outline-none box-border"
                        />
                      </div>

                      <div className="pt-3 sm:pt-4">
                        <button
                          type="button"
                          onClick={() => {
                            if (!fullName || !contactNumber || !birthdate) {
                              setSubmitError("Please fill in required personal fields.");
                              return;
                            }
                            const age = calculateAge(birthdate);
                            if (age < 18 || age > 30) {
                              setSubmitError("Examinee must be between 18 and 30 years old.");
                              return;
                            }
                            setSubmitError(null);
                            setApplyStep(2);
                          }}
                          className="w-full sm:w-auto px-6 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all touch-manipulation min-h-[46px] ml-auto"
                        >
                          <span>Next: Exam & Payout</span>
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Step 2: Exam & Payout Details */}
                  {applyStep === 2 && (
                    <div className="space-y-5">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                          Examination Level Category *
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <label
                            className={`p-3.5 sm:p-4 rounded-xl border cursor-pointer flex flex-col transition-all touch-manipulation ${
                              examLevel === "Professional"
                                ? "border-brand-500 bg-brand-50/70 dark:bg-brand-950/40 text-brand-900 dark:text-brand-200 ring-2 ring-brand-500/20"
                                : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                            }`}
                          >
                            <input
                              type="radio"
                              name="examLevel"
                              value="Professional"
                              checked={examLevel === "Professional"}
                              onChange={() => setExamLevel("Professional")}
                              className="sr-only"
                            />
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-bold text-sm">Professional Level</span>
                              <GraduationCap className="w-4 h-4 text-brand-600" />
                            </div>
                            <span className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                              Best for college graduates &amp; graduating students. Qualifies you for all government positions (entry-level up to officer level).
                            </span>
                          </label>

                          <label
                            className={`p-3.5 sm:p-4 rounded-xl border cursor-pointer flex flex-col transition-all touch-manipulation ${
                              examLevel === "SubProfessional"
                                ? "border-brand-500 bg-brand-50/70 dark:bg-brand-950/40 text-brand-900 dark:text-brand-200 ring-2 ring-brand-500/20"
                                : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                            }`}
                          >
                            <input
                              type="radio"
                              name="examLevel"
                              value="SubProfessional"
                              checked={examLevel === "SubProfessional"}
                              onChange={() => setExamLevel("SubProfessional")}
                              className="sr-only"
                            />
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-bold text-sm">SubProfessional Level</span>
                              <Award className="w-4 h-4 text-brand-600" />
                            </div>
                            <span className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                              Best for high school graduates &amp; college undergrads. Qualifies you for entry-level office and clerk positions.
                            </span>
                          </label>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="min-w-0">
                          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Target Exam Batch / Schedule *
                          </label>
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
                            className="w-full min-w-0 max-w-full px-3.5 py-3 sm:py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-base sm:text-sm focus:ring-2 focus:ring-brand-500 outline-none box-border"
                          >
                            {targetBatch && !STANDARD_CSE_BATCHES.includes(targetBatch as (typeof STANDARD_CSE_BATCHES)[number]) && (
                              <option value={targetBatch}>
                                {targetBatch}
                              </option>
                            )}
                            {STANDARD_CSE_BATCHES.map((b) => (
                              <option key={b} value={b}>
                                {b}
                              </option>
                            ))}
                            <option value="Other">Other / Different Schedule...</option>
                          </select>

                          {selectedBatchOption === "Other" && (
                            <div className="mt-2">
                              <input
                                type="text"
                                required
                                value={customBatch}
                                onChange={(e) => {
                                  setCustomBatch(e.target.value);
                                  setExamDate(e.target.value);
                                }}
                                placeholder="e.g. Special CSE / FOE schedule"
                                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                              />
                              <span className="text-[11px] text-slate-500 mt-1 block">
                                Enter your target CSC examination schedule.
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="min-w-0">
                          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Taker Status
                          </label>
                          <div className="flex items-center gap-4 mt-2.5">
                            <label className="flex items-center gap-2 text-xs font-medium cursor-pointer touch-manipulation">
                              <input
                                type="radio"
                                name="firstTime"
                                checked={isFirstTime}
                                onChange={() => setIsFirstTime(true)}
                                className="w-4 h-4 accent-brand-600"
                              />
                              <span>First-time Taker</span>
                            </label>
                            <label className="flex items-center gap-2 text-xs font-medium cursor-pointer touch-manipulation">
                              <input
                                type="radio"
                                name="firstTime"
                                checked={!isFirstTime}
                                onChange={() => setIsFirstTime(false)}
                                className="w-4 h-4 accent-brand-600"
                              />
                              <span>Retaker</span>
                            </label>
                          </div>
                        </div>
                      </div>

                      {/* ₱500 Reimbursement Payout Preference */}
                      <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                          Preferred ₱500 Reimbursement Method *
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-4">
                          <label
                            className={`p-3.5 rounded-xl border cursor-pointer flex items-center gap-3 transition-all touch-manipulation min-h-[48px] ${
                              payoutPreference === "Barangay Hall Cash Pickup"
                                ? "border-brand-500 bg-brand-50/70 dark:bg-brand-950/40 text-brand-900 dark:text-brand-200 font-bold"
                                : "border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs sm:text-sm"
                            }`}
                          >
                            <input
                              type="radio"
                              name="payout"
                              value="Barangay Hall Cash Pickup"
                              checked={payoutPreference === "Barangay Hall Cash Pickup"}
                              onChange={() => setPayoutPreference("Barangay Hall Cash Pickup")}
                              className="w-4 h-4 accent-brand-600"
                            />
                            <span>Cash Pickup at Barangay Hall</span>
                          </label>

                          <label
                            className={`p-3.5 rounded-xl border cursor-pointer flex items-center gap-3 transition-all touch-manipulation min-h-[48px] ${
                              payoutPreference === "GCash"
                                ? "border-brand-500 bg-brand-50/70 dark:bg-brand-950/40 text-brand-900 dark:text-brand-200 font-bold"
                                : "border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs sm:text-sm"
                            }`}
                          >
                            <input
                              type="radio"
                              name="payout"
                              value="GCash"
                              checked={payoutPreference === "GCash"}
                              onChange={() => setPayoutPreference("GCash")}
                              className="w-4 h-4 accent-brand-600"
                            />
                            <span>GCash Electronic Transfer</span>
                          </label>
                        </div>

                        {payoutPreference === "GCash" && (
                          <div className="bg-sky-50/60 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/60 rounded-xl p-3.5 sm:p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="min-w-0">
                              <label className="block text-xs font-bold text-sky-900 dark:text-sky-200 mb-1">
                                GCash Mobile Number *
                              </label>
                              <input
                                type="tel"
                                required
                                value={gcashNumber}
                                onChange={(e) => setGcashNumber(e.target.value)}
                                placeholder="09XX XXX XXXX"
                                className="w-full min-w-0 max-w-full px-3.5 py-2.5 rounded-lg border border-sky-300 dark:border-sky-700 bg-white dark:bg-slate-800 text-base sm:text-sm outline-none box-border"
                              />
                            </div>
                            <div className="min-w-0">
                              <label className="block text-xs font-bold text-sky-900 dark:text-sky-200 mb-1">
                                GCash Account Name
                              </label>
                              <input
                                type="text"
                                value={gcashAccountName}
                                onChange={(e) => setGcashAccountName(e.target.value)}
                                placeholder="Full name on GCash"
                                className="w-full min-w-0 max-w-full px-3.5 py-2.5 rounded-lg border border-sky-300 dark:border-sky-700 bg-white dark:bg-slate-800 text-base sm:text-sm outline-none box-border"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="pt-3 sm:pt-4 flex flex-col-reverse sm:flex-row items-center justify-between gap-2.5">
                        <button
                          type="button"
                          onClick={() => setApplyStep(1)}
                          className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-semibold flex items-center justify-center gap-1.5 transition-all touch-manipulation min-h-[44px]"
                        >
                          <ChevronLeft className="w-4 h-4" />
                          <span>Back</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (payoutPreference === "GCash" && !gcashNumber) {
                              setSubmitError("Please provide your GCash mobile number.");
                              return;
                            }
                            setSubmitError(null);
                            setApplyStep(3);
                          }}
                          className="w-full sm:w-auto px-6 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all touch-manipulation min-h-[46px]"
                        >
                          <span>Next: Upload Documents</span>
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Step 3: Document Uploads */}
                  {applyStep === 3 && (
                    <div className="space-y-4">
                      <div className="bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 rounded-xl p-3.5 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
                        <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <span>
                          <strong>Audit Rule:</strong> Upload photos or clear scans. The SK will verify your residency and official payment receipt before releasing the ₱500.
                        </span>
                      </div>

                      {/* File 1: Valid ID */}
                      <MobileUploadCard
                        label="1. Valid ID / Proof of Residency *"
                        sublabel="Student ID, Voter's ID, National ID, or Barangay Clearance."
                        file={validIdFile}
                        onFileSelect={setValidIdFile}
                        required={true}
                        icon={Award}
                      />

                      {/* File 2: CSC Official Receipt ₱500 */}
                      <MobileUploadCard
                        label="2. CSC Official Receipt (₱500 Payment Proof) *"
                        sublabel="Official receipt issued by the Civil Service Commission."
                        file={cscReceiptFile}
                        onFileSelect={setCscReceiptFile}
                        required={true}
                        icon={Receipt}
                      />

                      <div className="pl-1">
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          CSC Receipt / OR Number (Optional)
                        </label>
                        <input
                          type="text"
                          value={cscReceiptNo}
                          onChange={(e) => setCscReceiptNo(e.target.value)}
                          placeholder="e.g. OR #104928"
                          className="w-full sm:w-1/2 px-3.5 py-2.5 text-base sm:text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                        />
                      </div>

                      {/* File 3: CSC Examination Slip / ONSA */}
                      <MobileUploadCard
                        label="3. CSC Exam Schedule / ONSA *"
                        sublabel="CSC Application Receipt or Online Notice of School Assignment."
                        file={examScheduleFile}
                        onFileSelect={setExamScheduleFile}
                        required={true}
                        icon={FileText}
                      />

                      <div className="pt-3 sm:pt-4 flex flex-col-reverse sm:flex-row items-center justify-between gap-2.5">
                        <button
                          type="button"
                          onClick={() => setApplyStep(2)}
                          className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-semibold flex items-center justify-center gap-1.5 transition-all touch-manipulation min-h-[44px]"
                        >
                          <ChevronLeft className="w-4 h-4" />
                          <span>Back</span>
                        </button>
                        <button
                          type="submit"
                          disabled={submitting}
                          className="w-full sm:w-auto px-7 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm shadow-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 touch-manipulation min-h-[46px]"
                        >
                          {submitting ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>Uploading & Submitting...</span>
                            </>
                          ) : (
                            <>
                              <span>Submit Application for ₱500</span>
                              <CheckCircle2 className="w-4 h-4" />
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </form>
              )}
            </div>

            {/* Right 1 Col: Program Guidelines & Info */}
            <div className="space-y-4 sm:space-y-6">
              <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-xs">
                <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base mb-3 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Program Guidelines</span>
                </h3>
                <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-2.5 leading-relaxed">
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-500 mt-1.5 shrink-0" />
                    <span><strong>Who can apply:</strong> Bona fide Katipunan ng Kabataan of Barangay Tocok aged 18 to 30.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-500 mt-1.5 shrink-0" />
                    <span><strong>Subsidy Amount:</strong> Fixed ₱500.00 cash reimbursement corresponding to the standard CSC exam fee.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-500 mt-1.5 shrink-0" />
                    <span><strong>Annual Limit:</strong> Strictly 20 slots per year (₱10,000 total council allocation).</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-500 mt-1.5 shrink-0" />
                    <span><strong>Audit Liquidation:</strong> Disbursement Voucher (DV) is issued upon payout for full COA compliance.</span>
                  </li>
                </ul>
              </div>

              <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl sm:rounded-3xl p-5 sm:p-6 text-white shadow-xs">
                <div className="flex items-center gap-2 mb-1.5">
                  <Trophy className="w-4 h-4 text-white" />
                  <span className="font-black text-xs uppercase tracking-wider">Hall of Fame</span>
                </div>
                <h4 className="font-bold text-sm sm:text-base mb-1.5">Passers Honor Roll</h4>
                <p className="text-xs text-amber-50 leading-relaxed mb-3.5">
                  Pass the Civil Service Exam and be featured on the official Barangay Tocok Hall of Fame wall!
                </p>
                <button
                  onClick={() => setActiveTab("transparency")}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-white text-amber-800 font-bold text-xs hover:bg-amber-50 transition-all shadow-xs touch-manipulation min-h-[40px]"
                >
                  View Active Passers ({totalPassers})
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 2: TRACK & LIFECYCLE ================= */}
        {activeTab === "track" && (
          <div className="space-y-4 sm:space-y-6">
            {/* Logged-in User's Applications */}
            {currentUser && myApplications.length > 0 && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-xs max-w-2xl mx-auto space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                    <span>Your CSE Applications</span>
                  </h3>
                  <span className="text-[11px] font-semibold text-slate-500">
                    {myApplications.length} {myApplications.length === 1 ? "record" : "records"}
                  </span>
                </div>

                <div className="space-y-2.5">
                  {myApplications.map((app) => {
                    const isSelected = trackedApp?.tracking_code === app.tracking_code;
                    return (
                      <div
                        key={app.id}
                        onClick={() => {
                          setTrackInput(app.tracking_code);
                          setTrackedApp(app);
                          setTrackError(null);
                        }}
                        className={`p-3 sm:p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 touch-manipulation ${
                          isSelected
                            ? "border-brand-500 bg-brand-50/40 dark:bg-brand-950/30 ring-2 ring-brand-500/20"
                            : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 hover:border-slate-300 dark:hover:border-slate-700"
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-mono text-xs font-bold text-brand-600 dark:text-brand-400">
                              {app.tracking_code}
                            </span>
                            <span className="text-slate-300 dark:text-slate-600">•</span>
                            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                              {app.exam_date}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate">
                            {app.full_name} • {app.exam_level} Level
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              getReimbursementBadge(app.reimbursement_status).badgeClass
                            }`}
                          >
                            {getReimbursementBadge(app.reimbursement_status).label}
                          </span>
                          <span className="text-xs font-bold text-brand-600 dark:text-brand-400 flex items-center">
                            <span>{isSelected ? "Viewing" : "View"}</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Search Bar */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-xs max-w-2xl mx-auto">
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white mb-1 text-center">
                Check Reimbursement Status &amp; Submit Proof
              </h2>
              <p className="text-xs text-slate-500 text-center mb-4">
                Enter your unique tracking code (e.g. <code>CSE-2027-A1B2</code>)
              </p>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={trackInput}
                    onChange={(e) => setTrackInput(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === "Enter" && handleTrackLookup()}
                    placeholder="Enter Tracking Code..."
                    className="w-full pl-10 pr-4 py-3 sm:py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-base sm:text-sm font-mono tracking-wider focus:ring-2 focus:ring-brand-500 outline-none uppercase"
                  />
                </div>
                <button
                  onClick={() => handleTrackLookup()}
                  disabled={trackingLoading}
                  className="w-full sm:w-auto px-6 py-3 sm:py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 shrink-0 touch-manipulation min-h-[46px]"
                >
                  {trackingLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Track Application</span>}
                </button>
              </div>

              {trackError && (
                <div className="mt-3.5 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{trackError}</span>
                </div>
              )}
            </div>

            {/* Tracked Application Card */}
            {trackedApp && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl p-4 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xs max-w-3xl mx-auto space-y-5 sm:space-y-6">
                {/* Header details */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs sm:text-sm font-bold text-brand-600 dark:text-brand-400">
                        {trackedApp.tracking_code}
                      </span>
                      <button
                        onClick={() => copyToClipboard(trackedApp.tracking_code)}
                        className="text-slate-400 hover:text-slate-600 p-1"
                        title="Copy code"
                      >
                        {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                      {trackedApp.full_name}
                    </h3>
                    <span className="text-xs text-slate-500 block mt-0.5">
                      {trackedApp.purok} • {trackedApp.exam_level} ({trackedApp.exam_date})
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-bold border ${
                        getReimbursementBadge(trackedApp.reimbursement_status).badgeClass
                      }`}
                    >
                      {getReimbursementBadge(trackedApp.reimbursement_status).label}
                    </span>
                    <span
                      className={`px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-bold border ${
                        getAttendanceBadge(trackedApp.attendance_status).badgeClass
                      }`}
                    >
                      {getAttendanceBadge(trackedApp.attendance_status).label}
                    </span>
                    {trackedApp.exam_result_status === "Passed" && (
                      <span className="px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-bold border bg-amber-50 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-200">
                        🎉 Passed
                      </span>
                    )}
                  </div>
                </div>

                {/* 4-Stage Lifecycle Stepper: 2x2 grid on mobile */}
                <div>
                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">
                    Audit &amp; Progress Lifecycle
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                    {/* Stage 1 */}
                    <div className="p-3 rounded-xl sm:rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80">
                      <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold text-xs mb-1">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">1. Applied</span>
                      </div>
                      <span className="text-[10px] sm:text-[11px] text-slate-500 block leading-tight">
                        Docs uploaded
                      </span>
                    </div>

                    {/* Stage 2 */}
                    <div
                      className={`p-3 rounded-xl sm:rounded-2xl border ${
                        trackedApp.reimbursement_status === "Reimbursed"
                          ? "bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800"
                          : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/80"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-xs mb-1">
                        {trackedApp.reimbursement_status === "Reimbursed" ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        ) : (
                          <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        )}
                        <span className="truncate">2. ₱500 Payout</span>
                      </div>
                      <span className="text-[10px] sm:text-[11px] text-slate-500 block leading-tight truncate">
                        {trackedApp.reimbursement_status === "Reimbursed"
                          ? `DV: ${trackedApp.disbursement_voucher_no || "Issued"}`
                          : "Council Review"}
                      </span>
                    </div>

                    {/* Stage 3 */}
                    <div
                      className={`p-3 rounded-xl sm:rounded-2xl border ${
                        trackedApp.attendance_status === "Verified Attended"
                          ? "bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800"
                          : trackedApp.attendance_status === "Attendance Submitted"
                          ? "bg-sky-50/50 dark:bg-sky-950/30 border-sky-200 dark:border-sky-800"
                          : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/80"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-xs mb-1">
                        {trackedApp.attendance_status === "Verified Attended" ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        ) : (
                          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        )}
                        <span className="truncate">3. Attendance</span>
                      </div>
                      <span className="text-[10px] sm:text-[11px] text-slate-500 block leading-tight truncate">
                        {trackedApp.attendance_status}
                      </span>
                    </div>

                    {/* Stage 4 */}
                    <div
                      className={`p-3 rounded-xl sm:rounded-2xl border ${
                        trackedApp.exam_result_status === "Passed"
                          ? "bg-amber-50/60 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700"
                          : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/80"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-xs mb-1">
                        {trackedApp.exam_result_status === "Passed" ? (
                          <Trophy className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        ) : (
                          <Award className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        )}
                        <span className="truncate">4. Result</span>
                      </div>
                      <span className="text-[10px] sm:text-[11px] text-slate-500 block leading-tight truncate">
                        {trackedApp.exam_result_status === "Passed"
                          ? `Passed (${trackedApp.rating ? `${trackedApp.rating}%` : "Eligible"})`
                          : trackedApp.exam_result_status}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Disbursement info if reimbursed */}
                {trackedApp.reimbursement_status === "Reimbursed" && (
                  <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 text-xs">
                    <span className="font-bold text-emerald-900 dark:text-emerald-200 block mb-1">
                      ₱500.00 Subsidy Successfully Reimbursed!
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-emerald-800 dark:text-emerald-300 mt-2">
                      <div>
                        <span className="text-[10px] opacity-75 block">Voucher No:</span>
                        <span className="font-mono font-bold">{trackedApp.disbursement_voucher_no}</span>
                      </div>
                      <div>
                        <span className="text-[10px] opacity-75 block">Channel:</span>
                        <span className="font-semibold">{trackedApp.payout_station_or_method || trackedApp.payout_preference}</span>
                      </div>
                      <div className="col-span-2 sm:col-span-1">
                        <span className="text-[10px] opacity-75 block">Date Released:</span>
                        <span className="font-semibold">
                          {trackedApp.reimbursed_at ? new Date(trackedApp.reimbursed_at).toLocaleDateString() : "Recorded"}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Self-service actions: Full width on mobile */}
                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-2.5">
                  <button
                    onClick={() => {
                      setShowAttendanceModal(true);
                      setAttendanceMsg(null);
                    }}
                    className="w-full sm:w-auto px-4 py-3 rounded-xl bg-brand-50 hover:bg-brand-100 dark:bg-brand-950/60 dark:hover:bg-brand-900/60 text-brand-700 dark:text-brand-300 text-xs font-bold flex items-center justify-center gap-2 transition-all border border-brand-200 dark:border-brand-800 touch-manipulation min-h-[44px]"
                  >
                    <Upload className="w-3.5 h-3.5 shrink-0" />
                    <span>Upload Exam Day Attendance Proof</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowResultModal(true);
                      setResultMsg(null);
                    }}
                    className="w-full sm:w-auto px-4 py-3 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-200 text-xs font-bold flex items-center justify-center gap-2 transition-all border border-amber-200 dark:border-amber-800 touch-manipulation min-h-[44px]"
                  >
                    <Trophy className="w-3.5 h-3.5 shrink-0" />
                    <span>Submit Civil Service Result (Pass / Fail)</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 3: TRANSPARENCY & HALL OF FAME ================= */}
        {activeTab === "transparency" && (
          <div className="space-y-6 sm:space-y-8">
            {/* Top Stat Cards: 2x2 grid on mobile */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4">
              <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-xs">
                <span className="text-[10px] sm:text-xs font-bold text-slate-400 block mb-0.5">Subsidies Released</span>
                <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white truncate block">
                  ₱{totalReimbursedAmount.toLocaleString()}
                </span>
                <span className="text-[10px] sm:text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5 block truncate">
                  {reimbursedCount} examinees
                </span>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-xs">
                <span className="text-[10px] sm:text-xs font-bold text-slate-400 block mb-0.5">Slots Budget</span>
                <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white truncate block">
                  {remainingSlots} <span className="text-xs text-slate-400 font-normal">/ {quotaSlots} left</span>
                </span>
                <span className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 block truncate">
                  ₱{(quotaSlots * 500).toLocaleString()} cap
                </span>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-xs">
                <span className="text-[10px] sm:text-xs font-bold text-slate-400 block mb-0.5">Exam Attendees</span>
                <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white block">
                  {stats?.verifiedAttendedCount || 0}
                </span>
                <span className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 block truncate">
                  Verified took test
                </span>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-xs">
                <span className="text-[10px] sm:text-xs font-bold text-slate-400 block mb-0.5">Eligibles</span>
                <span className="text-xl sm:text-2xl font-black text-amber-500 block">
                  {totalPassers} 🎉
                </span>
                <span className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 block truncate">
                  Tocok Passers
                </span>
              </div>
            </div>

            {/* Hall of Fame Wall */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl p-4 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 sm:pb-4 mb-5 sm:mb-6">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[10px] sm:text-xs font-bold mb-1">
                    <Trophy className="w-3 h-3 text-amber-600" />
                    <span>Honor Roll</span>
                  </div>
                  <h3 className="text-base sm:text-xl font-black text-slate-900 dark:text-white">
                    Barangay Tocok Civil Service Hall of Fame
                  </h3>
                  <p className="text-[11px] sm:text-xs text-slate-500">
                    Recognizing our brilliant youth who passed the Civil Service Examination and earned their government eligibility!
                  </p>
                </div>
              </div>

              {passers.length === 0 ? (
                <div className="text-center py-8 sm:py-12 text-slate-400">
                  <Award className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2.5 opacity-40 text-amber-500" />
                  <p className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Upcoming Exam Results
                  </p>
                  <p className="text-[11px] sm:text-xs max-w-sm mx-auto">
                    The current exam cycle results are awaiting official CSC publication. 
                    Passers will be proudly honored here once verified!
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
                  {passers.map((passer) => (
                    <div
                      key={passer.id}
                      className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-amber-50/50 to-white dark:from-slate-800/60 dark:to-slate-800/30 border border-amber-200/80 dark:border-amber-900/40 shadow-xs flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] sm:text-xs font-bold text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-md bg-amber-100/80 dark:bg-amber-950/60">
                            {passer.exam_level}
                          </span>
                          <Trophy className="w-3.5 h-3.5 text-amber-500" />
                        </div>
                        <h4 className="font-black text-sm sm:text-base text-slate-900 dark:text-white mb-0.5">
                          {passer.full_name}
                        </h4>
                        <span className="text-[11px] text-slate-500 block mb-2">{passer.purok}</span>
                      </div>

                      <div className="pt-2.5 border-t border-amber-100 dark:border-slate-700/60 flex items-center justify-between text-xs">
                        <span className="text-slate-400 text-[10px] sm:text-xs">{passer.exam_date}</span>
                        {passer.rating && (
                          <span className="font-black text-emerald-600 dark:text-emerald-400 text-xs">
                            {passer.rating}%
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Purok Distribution */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl p-4 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xs">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base mb-1">
                Fair Distribution Across Purok 1 to 7
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500 mb-4 sm:mb-6">
                Monitoring distribution so that opportunities are accessible across all sitios in Barangay Tocok.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
                {PUROK_OPTIONS.map((p) => {
                  const count = stats?.purokBreakdown?.[p] || 0;
                  return (
                    <div
                      key={p}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 flex items-center justify-between"
                    >
                      <div className="pr-1.5 min-w-0">
                        <span className="text-xs font-bold text-slate-900 dark:text-white block truncate">
                          {p.split("(")[0].trim()}
                        </span>
                        <span className="text-[10px] text-slate-400 block truncate">
                          {p.includes("(") ? `(${p.split("(")[1]}` : ""}
                        </span>
                      </div>
                      <span className="font-black text-brand-600 dark:text-brand-400 text-sm sm:text-base shrink-0">
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
          </main>
        </div>
      </div>

      {/* ================= MODAL: SUBMIT ATTENDANCE (Mobile Bottom-Sheet on mobile, centered modal on desktop) ================= */}
      {showAttendanceModal && trackedApp && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl max-w-md w-full p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-xl space-y-4 max-h-[88vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="font-black text-slate-900 dark:text-white text-sm sm:text-base flex items-center gap-2">
                <Upload className="w-4 h-4 text-brand-600" />
                <span>Upload Exam Attendance Proof</span>
              </h3>
              <button
                onClick={() => setShowAttendanceModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg touch-manipulation"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {attendanceMsg && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs">
                {attendanceMsg}
              </div>
            )}

            <form onSubmit={handleAttendanceSubmit} className="space-y-4 text-xs">
              <MobileUploadCard
                label="Exam Day Proof (Stamped ONSA / Photo) *"
                sublabel="Tap to capture photo or select file."
                file={attendanceProofFile}
                onFileSelect={setAttendanceProofFile}
                required={true}
                icon={Camera}
              />

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Optional Notes (Testing School / Room)
                </label>
                <input
                  type="text"
                  value={attendanceNotes}
                  onChange={(e) => setAttendanceNotes(e.target.value)}
                  placeholder="e.g. Took exam at DMMMSU-MLUC Room 302"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-base sm:text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Security Check: Birthdate (YYYY-MM-DD) or Last 4 Digits of Phone *
                </label>
                <input
                  type="text"
                  required
                  value={attendanceKey}
                  onChange={(e) => setAttendanceKey(e.target.value.trim())}
                  placeholder="e.g. 2004-05-18 or 6789"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-base sm:text-xs"
                />
              </div>

              <div className="pt-2 flex flex-col-reverse sm:flex-row justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAttendanceModal(false)}
                  className="w-full sm:w-auto px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 font-semibold touch-manipulation min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={attendanceSubmitting}
                  className="w-full sm:w-auto px-5 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold touch-manipulation min-h-[44px]"
                >
                  {attendanceSubmitting ? "Uploading..." : "Submit Attendance Proof"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: SUBMIT EXAM RESULT (Mobile Bottom-Sheet on mobile, centered modal on desktop) ================= */}
      {showResultModal && trackedApp && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl max-w-md w-full p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-xl space-y-4 max-h-[88vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="font-black text-slate-900 dark:text-white text-sm sm:text-base flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-500" />
                <span>Submit Civil Service Result</span>
              </h3>
              <button
                onClick={() => setShowResultModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg touch-manipulation"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {resultMsg && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs">
                {resultMsg}
              </div>
            )}

            <form onSubmit={handleResultSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Examination Result *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label
                    className={`p-3 rounded-xl border text-center cursor-pointer font-bold touch-manipulation min-h-[44px] flex items-center justify-center ${
                      resultStatus === "Passed"
                        ? "border-amber-500 bg-amber-50 dark:bg-amber-950 text-amber-900 dark:text-amber-200"
                        : "border-slate-200 dark:border-slate-700 text-slate-600"
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
                    <span>Passed 🎉</span>
                  </label>

                  <label
                    className={`p-3 rounded-xl border text-center cursor-pointer font-bold touch-manipulation min-h-[44px] flex items-center justify-center ${
                      resultStatus === "Did Not Pass"
                        ? "border-slate-500 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white"
                        : "border-slate-200 dark:border-slate-700 text-slate-600"
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

              {resultStatus === "Passed" && (
                <>
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Exam Rating % (Optional, e.g. 84.50)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={ratingInput}
                      onChange={(e) => setRatingInput(e.target.value)}
                      placeholder="e.g. 85.20"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-base sm:text-xs"
                    />
                  </div>

                  <MobileUploadCard
                    label="Result Attachment"
                    sublabel="Screenshot of CSC Passer List / Rating / CoE."
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
                      Feature my name on the <strong>Barangay Tocok CSE Hall of Fame</strong> to inspire fellow youth!
                    </span>
                  </label>
                </>
              )}

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Security Check: Birthdate (YYYY-MM-DD) or Last 4 Digits of Phone *
                </label>
                <input
                  type="text"
                  required
                  value={resultKey}
                  onChange={(e) => setResultKey(e.target.value.trim())}
                  placeholder="e.g. 2004-05-18 or 6789"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-base sm:text-xs"
                />
              </div>

              <div className="pt-2 flex flex-col-reverse sm:flex-row justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowResultModal(false)}
                  className="w-full sm:w-auto px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 font-semibold touch-manipulation min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resultSubmitting}
                  className="w-full sm:w-auto px-5 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold touch-manipulation min-h-[44px]"
                >
                  {resultSubmitting ? "Saving..." : "Submit Result"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CsePage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-sm text-slate-400">Loading CSE Program Hub...</div>}>
      <CseContent />
    </Suspense>
  );
}
