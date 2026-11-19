"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import {
  Palette,
  ChevronDown,
  LogIn,
  LogOut,
  ArrowLeft,
  Users,
  RotateCcw,
  Loader2,
  User,
  UserPlus,
  Mail,
  Lock,
  Eye,
  EyeOff,
  X,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { useAuth, isOfficialRole } from "@/components/AuthProvider";
import { AppearanceControls } from "@/components/ThemeToggle";
import PushNotificationManager from "@/components/PushNotificationManager";
import { SURFACE_THEME_MAP, ACCENT_THEME_MAP } from "@/lib/themes";

interface AccountMenuProps {
  className?: string;
}

const loadGoogleGisScript = (): Promise<void> =>
  new Promise((resolve, reject) => {
    if (typeof window === "undefined") return resolve();
    if (
      (window as Window & { google?: { accounts?: { oauth2?: unknown } } }).google?.accounts
        ?.oauth2
    ) {
      return resolve();
    }
    const existing = document.getElementById("google-gsi-client");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error("Failed to load Google Sign-In script."))
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

function getAvatarInitial(name: string) {
  if (!name) return "U";
  const clean = name
    .replace(/^(HON\.|HON|MR\.|MR|MS\.|MS|MRS\.|MRS|DR\.|DR)\s+/i, "")
    .trim();
  return clean.charAt(0).toUpperCase() || name.charAt(0).toUpperCase() || "U";
}

export default function AccountMenu({ className = "" }: AccountMenuProps) {
  const {
    theme,
    resolvedSurface,
    resolvedTheme,
    accent,
    isCustomized,
    syncStatus,
    resetAppearance,
    mounted,
  } = useTheme();
  const { user, loggingOut, setUser, logout, requestNavigation } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [appearanceExpanded, setAppearanceExpanded] = useState(false);
  const [showSignInModal, setShowSignInModal] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "register">("signin");

  // Visual viewport tracking for mobile devices (active only when Auth modal is open)
  const [vvHeight, setVvHeight] = useState<number | null>(null);
  const [vvTop, setVvTop] = useState(0);

  useEffect(() => {
    if (!showSignInModal || typeof window === "undefined" || !window.visualViewport) return;

    const handleViewportChange = () => {
      if (!window.visualViewport) return;
      setVvHeight(window.visualViewport.height);
      setVvTop(window.visualViewport.offsetTop);
    };

    handleViewportChange();
    window.visualViewport.addEventListener("resize", handleViewportChange);
    window.visualViewport.addEventListener("scroll", handleViewportChange);

    return () => {
      window.visualViewport?.removeEventListener("resize", handleViewportChange);
      window.visualViewport?.removeEventListener("scroll", handleViewportChange);
    };
  }, [showSignInModal]);

  // Sign In Form
  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [showSignInPassword, setShowSignInPassword] = useState(false);

  // Register Form
  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState("");
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);

  // Statuses
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [avatarError, setAvatarError] = useState(false);

  const signInError = authError;
  const setSignInError = setAuthError;
  const signInSubmitting = authSubmitting || googleSubmitting;
  const setSignInSubmitting = setAuthSubmitting;
  const containerRef = useRef<HTMLDivElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const registerNameInputRef = useRef<HTMLInputElement>(null);

  // Automatically focus active input on desktop devices (skipping mobile touchscreens to avoid jarring keyboard pops)
  useEffect(() => {
    if (!showSignInModal) return;
    if (typeof window !== "undefined" && window.matchMedia("(hover: none) and (pointer: coarse)").matches) {
      return;
    }
    const timer = setTimeout(() => {
      if (authMode === "signin") {
        emailInputRef.current?.focus();
      } else {
        registerNameInputRef.current?.focus();
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [showSignInModal, authMode]);

  // Close popover on outside click, Escape, or window scroll
  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
      }
    };

    const handleWindowScroll = () => {
      setOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleWindowScroll, { passive: true });

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleWindowScroll);
    };
  }, [open]);

  // Collapse Appearance accordion whenever popover closes or route changes
  useEffect(() => {
    if (!open) {
      setAppearanceExpanded(false);
    }
  }, [open]);

  useEffect(() => {
    setOpen(false);
    setShowSignInModal(false);
  }, [pathname]);

  // Lock background scroll across mobile (iOS/Android) & desktop while Sign In modal is open
  useEffect(() => {
    if (!showSignInModal) return;

    const savedScrollY = window.scrollY || window.pageYOffset || 0;
    const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;

    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevHtmlOverscroll = document.documentElement.style.overscrollBehavior;
    const prevBodyPosition = document.body.style.position;
    const prevBodyTop = document.body.style.top;
    const prevBodyLeft = document.body.style.left;
    const prevBodyRight = document.body.style.right;
    const prevBodyWidth = document.body.style.width;
    const prevBodyOverflow = document.body.style.overflow;
    const prevBodyOverscroll = document.body.style.overscrollBehavior;
    const prevBodyPaddingRight = document.body.style.paddingRight;

    document.documentElement.style.overflow = "hidden";
    document.documentElement.style.overscrollBehavior = "none";
    document.documentElement.dataset.modalOpen = "true";
    document.body.style.position = "fixed";
    document.body.style.top = `-${savedScrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    if (scrollBarWidth > 0) {
      document.body.style.paddingRight = `${scrollBarWidth}px`;
    }

    // Enforce 0 window scroll while modal is active so Safari does not push the layout viewport
    const handleWindowScroll = () => {
      if (window.scrollY !== 0) {
        window.scrollTo(0, 0);
      }
    };
    window.addEventListener("scroll", handleWindowScroll, { passive: true });

    const preventBackgroundTouch = (e: TouchEvent) => {
      const target = e.target as HTMLElement | null;
      const scrollContainer = target?.closest(".sign-in-modal-scroll") as HTMLElement | null;
      if (scrollContainer && scrollContainer.scrollHeight > scrollContainer.clientHeight) {
        return;
      }
      if (e.cancelable) {
        e.preventDefault();
      }
    };

    window.addEventListener("touchmove", preventBackgroundTouch, { passive: false });

    return () => {
      delete document.documentElement.dataset.modalOpen;
      window.removeEventListener("scroll", handleWindowScroll);
      window.removeEventListener("touchmove", preventBackgroundTouch);
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.documentElement.style.overscrollBehavior = prevHtmlOverscroll;
      document.body.style.position = prevBodyPosition;
      document.body.style.top = prevBodyTop;
      document.body.style.left = prevBodyLeft;
      document.body.style.right = prevBodyRight;
      document.body.style.width = prevBodyWidth;
      document.body.style.overflow = prevBodyOverflow;
      document.body.style.overscrollBehavior = prevBodyOverscroll;
      document.body.style.paddingRight = prevBodyPaddingRight;
      window.scrollTo({ top: savedScrollY, behavior: "instant" });
    };
  }, [showSignInModal]);

  // Close Sign In modal on Escape key
  useEffect(() => {
    if (!showSignInModal) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !signInSubmitting) {
        setShowSignInModal(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showSignInModal, signInSubmitting]);

  const containerStyle: React.CSSProperties = {
    right: "calc((50% - var(--logo-half-start)) * (1 - var(--p)) + var(--logo-left-end) * var(--p))",
    top: "calc(var(--logo-top-start) * (1 - var(--p)) + var(--logo-top-end) * var(--p))",
    width: "calc(var(--logo-size-start) * (1 - var(--p)) + var(--logo-size-end) * var(--p))",
    height: "calc(var(--logo-size-start) * (1 - var(--p)) + var(--logo-size-end) * var(--p))",
    opacity: open ? 1 : "calc(min(1, max(0, var(--p) * 8)))",
    transform: "translate3d(0, 0, 0)",
    WebkitTransform: "translate3d(0, 0, 0)",
  };

  if (!mounted) {
    return (
      <div
        className={`pointer-events-none absolute z-20 ${className}`}
        style={containerStyle}
        aria-hidden="true"
      >
        <div className="w-full h-full rounded-full border-2 border-slate-300/80 dark:border-slate-700/80 bg-slate-100 dark:bg-slate-800" />
      </div>
    );
  }

  const activeSurfaceMeta = SURFACE_THEME_MAP[resolvedSurface] ?? SURFACE_THEME_MAP.light;
  const activeAccentMeta = ACCENT_THEME_MAP[accent] ?? ACCENT_THEME_MAP["sk-green"];
  const themeLabel = theme === "system" ? "Auto" : activeSurfaceMeta.label;
  const accentDotColor =
    resolvedTheme === "dark"
      ? activeAccentMeta.darkPrimaryHex
      : activeAccentMeta.lightPrimaryHex;

  const isOfficial = isOfficialRole(user?.role);
  const isOnAdmin = Boolean(pathname?.startsWith("/admin"));

  const handleNavigate = (href: string) => {
    setOpen(false);
    requestNavigation(href, () => {
      router.push(href, { scroll: false });
    });
  };

  const handleSignOut = async () => {
    setOpen(false);
    const didLogout = await logout();
    if (didLogout) {
      if (isOnAdmin) {
        router.replace("/");
      }
      router.refresh();
    }
  };

  const openSignInModal = (mode: "signin" | "register" = "signin") => {
    setOpen(false);
    setAuthMode(mode);
    setAuthError(null);
    setSignInPassword("");
    setRegisterPassword("");
    setRegisterConfirmPassword("");
    setShowSignInPassword(false);
    setShowRegisterPassword(false);
    setShowSignInModal(true);
  };

  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signInEmail.trim() || !signInPassword) {
      setAuthError("Please enter both your email and password.");
      return;
    }

    try {
      setAuthSubmitting(true);
      setAuthError(null);
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: signInEmail.trim(),
          password: signInPassword,
        }),
      });
      const text = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch {
        data = { error: text || "Server returned an unexpected response." };
      }
      if (!res.ok) {
        throw new Error(data.error || "Sign in failed");
      }

      setUser(data.user);
      setShowSignInModal(false);
      setSignInEmail("");
      setSignInPassword("");
      setShowSignInPassword(false);
      router.refresh();
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : "Failed to sign in");
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (!registerName.trim()) {
      setAuthError("Please enter your full student name.");
      return;
    }
    if (!registerEmail.trim()) {
      setAuthError("Please enter your email address.");
      return;
    }
    if (registerPassword.length < 6) {
      setAuthError("Password must be at least 6 characters long.");
      return;
    }
    if (registerPassword !== registerConfirmPassword) {
      setAuthError("Passwords do not match.");
      return;
    }

    try {
      setAuthSubmitting(true);
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: registerName.trim(),
          email: registerEmail.trim(),
          password: registerPassword,
        }),
      });
      const text = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch {
        data = { error: text || "Failed to create account" };
      }
      if (!res.ok) {
        throw new Error(data.error || "Failed to create account");
      }

      setUser(data.user);
      setShowSignInModal(false);
      setRegisterName("");
      setRegisterEmail("");
      setRegisterPassword("");
      setRegisterConfirmPassword("");
      router.refresh();
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : "Failed to create account");
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleContinueWithGoogle = async () => {
    setAuthError(null);
    try {
      setGoogleSubmitting(true);
      const res = await fetch("/api/auth/google");
      const data = await res.json();
      const mode: "redirect" | "gis" | "unconfigured" =
        data.mode === "redirect" || data.mode === "gis" ? data.mode : "unconfigured";

      if (mode === "redirect") {
        const returnTo =
          typeof window !== "undefined"
            ? `${window.location.pathname}${window.location.search}`
            : "/";
        window.location.href = `/api/auth/google/start?returnTo=${encodeURIComponent(returnTo)}`;
        return;
      }

      if (mode === "gis" && data.clientId) {
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
          client_id: data.clientId,
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
              const authRes = await fetch("/api/auth/google", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ accessToken: tokenResponse.access_token }),
              });
              const authData = await authRes.json();
              if (!authRes.ok) {
                throw new Error(authData.error || "Google sign-in failed");
              }
              setUser(authData.user);
              setShowSignInModal(false);
              router.refresh();
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
        return;
      }

      setGoogleSubmitting(false);
      setAuthError(
        "Google Sign-In is not configured yet. Please sign in or register with email below."
      );
    } catch (err: unknown) {
      setGoogleSubmitting(false);
      setAuthError(err instanceof Error ? err.message : "Unable to start Google sign-in.");
    }
  };

  return (
    <div
      ref={containerRef}
      style={containerStyle}
      className={`pointer-events-auto absolute ${open ? "z-40" : "z-20"} ${className}`}
    >
      {user ? (
        /* LOGGED-IN ACCOUNT TRIGGER: MIRRORS SK LOGO SPLIT ANIMATION TO THE RIGHT */
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={`Account menu for ${user.name}. Click to manage session and appearance.`}
          title={`${user.name} (${user.role}) • Theme: ${themeLabel}`}
          className={`group relative w-full h-full rounded-full border-2 border-brand-600/80 dark:border-brand-500/80 overflow-hidden shadow-sm bg-brand-50 dark:bg-brand-950/60 text-brand-800 dark:text-brand-300 font-bold text-base sm:text-lg transition-transform cursor-pointer select-none hover:scale-105 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 flex items-center justify-center ${
            open
              ? "ring-4 ring-brand-500/35 dark:ring-brand-400/35 scale-105"
              : "ring-2 ring-brand-500/20 dark:ring-brand-400/25"
          }`}
        >
          {user.avatar_url && !avatarError ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatar_url}
              alt={user.name}
              onError={() => setAvatarError(true)}
              className="w-full h-full object-cover"
            />
          ) : (
            getAvatarInitial(user.name)
          )}
        </button>
      ) : (
        /* GUEST TRIGGER: MATCHING CIRCULAR SILHOUETTE WITH IDENTICAL SPLIT ANIMATION */
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={`Guest menu and appearance settings (${themeLabel}, ${activeAccentMeta.label} accent)`}
          title={`Guest • Theme: ${themeLabel} (${activeAccentMeta.label})`}
          className={`group relative w-full h-full rounded-full border-2 overflow-hidden shadow-sm bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 transition-transform cursor-pointer select-none hover:scale-105 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 flex items-center justify-center ${
            open
              ? "border-brand-600/80 dark:border-brand-500/80 ring-4 ring-brand-500/35 dark:ring-brand-400/35 scale-105 text-brand-700 dark:text-brand-300"
              : "border-slate-300/90 dark:border-slate-600/90 ring-2 ring-slate-400/15 dark:ring-slate-500/20 hover:border-brand-500/70 dark:hover:border-brand-500/70 hover:text-brand-700 dark:hover:text-brand-300"
          }`}
        >
          <User className="w-[48%] h-[48%]" strokeWidth={2} />
        </button>
      )}

      {/* POPOVER PANEL */}
      {open && (
        <div
          role="dialog"
          aria-label={user ? "Account and appearance menu" : "Appearance and color settings"}
          className="fixed sm:absolute right-3 sm:right-0 top-[calc(64px+env(safe-area-inset-top,0px))] sm:top-full sm:mt-2 w-[284px] sm:w-[312px] max-w-[calc(100vw-24px)] max-h-[calc(100dvh-84px-env(safe-area-inset-top,0px))] overflow-y-auto themed-scrollbar rounded-2xl border border-slate-200 dark:border-slate-700/90 bg-white dark:bg-slate-900 shadow-2xl dark:shadow-black/70 p-3 z-[70] font-sans overscroll-contain"
        >
          {user ? (
            <div className="space-y-2.5">
              {/* 1. Profile Header */}
              <div className="flex items-start gap-2.5 pb-2.5 border-b border-slate-100 dark:border-slate-800">
                <div className="w-10 h-10 rounded-full ring-2 ring-brand-300/80 dark:ring-brand-700/80 flex items-center justify-center shrink-0 overflow-hidden bg-brand-50 dark:bg-brand-950/50 text-brand-800 dark:text-brand-300 font-bold text-sm">
                  {user.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={user.avatar_url}
                      alt={user.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    getAvatarInitial(user.name)
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-xs font-extrabold text-slate-900 dark:text-slate-100 tracking-tight leading-snug break-words">
                      {user.name}
                    </p>
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-brand-50 dark:bg-brand-950/60 text-brand-800 dark:text-brand-300 border border-brand-200/70 dark:border-brand-800/70 leading-none">
                      {user.role}
                    </span>
                    <span className="text-[10.5px] text-slate-400 dark:text-slate-500 truncate">
                      {isOfficial ? "Barangay Tocok SK Council" : "Student Account"}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {user.email}
                  </p>
                </div>
              </div>

              {/* 2. Officials Quick Navigation (shown only for signed-in SK officials) */}
              {isOfficial && (
                <div className="space-y-1">
                  {isOnAdmin ? (
                    <button
                      type="button"
                      onClick={() => handleNavigate("/")}
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                      <span>Public Site</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleNavigate("/admin")}
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      <Users className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400 shrink-0" />
                      <span>Officials Portal</span>
                    </button>
                  )}
                </div>
              )}

              {/* 3. Collapsible Appearance Accordion */}
              <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 overflow-hidden">
                <div className="flex items-center justify-between gap-1">
                  <button
                    type="button"
                    onClick={() => setAppearanceExpanded((prev) => !prev)}
                    aria-expanded={appearanceExpanded}
                    className="flex-1 flex items-center justify-between gap-2 px-2.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <Palette className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400 shrink-0" />
                      <span>Appearance</span>
                    </span>
                    <span className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10.5px] font-semibold text-slate-500 dark:text-slate-400">
                        {themeLabel}
                      </span>
                      <span
                        className="w-2.5 h-2.5 rounded-full ring-1 ring-white dark:ring-slate-900 shrink-0"
                        style={{ backgroundColor: accentDotColor }}
                      />
                      <ChevronDown
                        className={`w-3.5 h-3.5 text-slate-400 dark:text-slate-500 transition-transform duration-150 ${
                          appearanceExpanded ? "rotate-180" : ""
                        }`}
                      />
                    </span>
                  </button>
                </div>

                {appearanceExpanded && (
                  <div className="px-2.5 pb-2.5 pt-2 border-t border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900/70 space-y-2.5">
                    <div className="flex items-center justify-between h-6">
                      <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                        {syncStatus === "saving"
                          ? "Saving to account..."
                          : isCustomized
                          ? "Synced to account"
                          : isOfficial
                          ? "SK Official • Synced"
                          : "Student • Synced"}
                      </span>
                      <button
                        type="button"
                        onClick={resetAppearance}
                        disabled={!isCustomized}
                        className={`inline-flex items-center gap-1 h-6 text-[10.5px] font-bold px-1.5 rounded-md transition-colors ${
                          isCustomized
                            ? "text-slate-500 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                            : "text-slate-300 dark:text-slate-600 opacity-50 cursor-default"
                        }`}
                        title="Reset to Auto theme and SK Green accent"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Reset</span>
                      </button>
                    </div>
                    <AppearanceControls showHeader={false} />
                  </div>
                )}
              </div>

              {/* Push Notifications Toggle */}
              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Ticket Alerts</span>
                <PushNotificationManager variant="button" />
              </div>

              {/* 4. Sign Out Action */}
              <div className="pt-1 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  disabled={loggingOut}
                  onClick={handleSignOut}
                  className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/70 hover:bg-rose-50 dark:hover:bg-rose-950/60 hover:border-rose-200 dark:hover:border-rose-900/80 text-slate-700 dark:text-slate-300 hover:text-rose-700 dark:hover:text-rose-300 text-xs font-bold transition-colors cursor-pointer active:scale-[0.98] disabled:opacity-50"
                >
                  {loggingOut ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <LogOut className="w-3.5 h-3.5" />
                  )}
                  <span>{loggingOut ? "Signing Out..." : "Sign Out"}</span>
                </button>
              </div>
            </div>
          ) : (
            /* GUEST MODE: GUEST HEADER + SIGN IN / REGISTER + APPEARANCE CONTROLS */
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-center text-slate-500 dark:text-slate-400 shrink-0">
                    <User className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold text-slate-900 dark:text-slate-100 leading-tight">
                      Guest Visitor
                    </p>
                    <p className="text-[10.5px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
                      Not signed in
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openSignInModal("signin")}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-[11px] font-bold shadow-xs transition-colors cursor-pointer active:scale-95 shrink-0"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Sign In / Sign Up</span>
                </button>
              </div>
              <AppearanceControls showHeader={true} />
            </div>
          )}
        </div>
      )}

      {/* PUBLIC SK TOCOK PORTAL AUTHENTICATION MODAL */}
      {showSignInModal &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="SK Tocok Portal"
            className="fixed z-[100] bg-slate-950/55 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overscroll-contain touch-none font-sans"
            style={{
              position: "fixed",
              top: vvTop ? `${vvTop}px` : "0px",
              left: "0px",
              right: "0px",
              bottom: "0px",
              height: vvHeight ? `${vvHeight}px` : "100%",
              paddingTop: "max(0.5rem, env(safe-area-inset-top, 0px))",
              paddingBottom: "max(0.5rem, env(safe-area-inset-bottom, 0px))",
              paddingLeft: "max(0.75rem, env(safe-area-inset-left, 0px))",
              paddingRight: "max(0.75rem, env(safe-area-inset-right, 0px))",
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget && !authSubmitting && !googleSubmitting) {
                setShowSignInModal(false);
              }
            }}
          >
            <div
              className="sign-in-modal-scroll relative bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full overflow-y-auto touch-pan-y p-5 sm:p-7 shadow-2xl border border-slate-200/90 dark:border-slate-800 space-y-4 animate-in fade-in zoom-in-95"
              style={{
                maxHeight: vvHeight
                  ? `calc(${vvHeight}px - 1rem - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))`
                  : "calc(100dvh - 2rem)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Public Modal Header */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full border-2 border-brand-600/80 overflow-hidden shadow-xs bg-white ring-2 ring-brand-500/20 shrink-0 flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/sk-logo.jpg"
                      alt="Sangguniang Kabataan Barangay Tocok Official Seal"
                      className="w-full h-full object-cover scale-[1.03]"
                    />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 tracking-tight leading-tight">
                      SK Tocok Portal
                    </h2>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSignInModal(false)}
                  disabled={authSubmitting || googleSubmitting}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-40"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Continue with Google (One-Click Public Access) */}
              <button
                type="button"
                disabled={googleSubmitting || authSubmitting}
                onClick={handleContinueWithGoogle}
                className="w-full flex items-center justify-center gap-2.5 py-2.5 px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold text-xs sm:text-sm transition shadow-2xs hover:shadow-xs cursor-pointer active:scale-[0.99] disabled:opacity-60"
              >
                {googleSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-slate-600 dark:text-slate-300" />
                    <span>Connecting to Google...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3h3.88c2.27-2.09 3.66-5.17 3.66-9.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.1C3.25 21.36 7.33 24 12 24z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.28 14.32a7.18 7.18 0 0 1 0-4.64V6.58H1.26a11.96 11.96 0 0 0 0 10.84l4.02-3.1z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.25 2.64 1.26 6.58l4.02 3.1c.95-2.83 3.6-4.93 6.72-4.93z"
                      />
                    </svg>
                    <span>Continue with Google</span>
                  </>
                )}
              </button>

              {/* Divider */}
              <div className="relative my-1">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200 dark:border-slate-800"></div>
                </div>
                <div className="relative flex justify-center text-[10.5px] uppercase tracking-wider">
                  <span className="bg-white dark:bg-slate-900 px-2.5 text-slate-400 dark:text-slate-500 font-semibold">
                    or with email
                  </span>
                </div>
              </div>

              {/* Sub-Tabs: Sign In vs Create Account */}
              <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("signin");
                    setAuthError(null);
                  }}
                  className={`py-2 text-xs font-bold rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
                    authMode === "signin"
                      ? "bg-white dark:bg-slate-900 text-brand-700 dark:text-brand-400 shadow-2xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                  }`}
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Sign In</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("register");
                    setAuthError(null);
                  }}
                  className={`py-2 text-xs font-bold rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
                    authMode === "register"
                      ? "bg-white dark:bg-slate-900 text-brand-700 dark:text-brand-400 shadow-2xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Create Account</span>
                </button>
              </div>

              {authError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/70 text-rose-800 dark:text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              {authMode === "signin" ? (
                /* ---------------- TAB 1: SIGN IN FORM ---------------- */
                <form onSubmit={handleSignInSubmit} className="space-y-3.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                      <input
                        ref={emailInputRef}
                        type="email"
                        required
                        autoComplete="email"
                        placeholder="Enter your email address"
                        value={signInEmail}
                        onChange={(e) => setSignInEmail(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-base sm:text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-600 bg-slate-50/50 dark:bg-slate-800/50"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                      <input
                        type={showSignInPassword ? "text" : "password"}
                        required
                        autoComplete="current-password"
                        placeholder="Enter your password"
                        value={signInPassword}
                        onChange={(e) => setSignInPassword(e.target.value)}
                        className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-base sm:text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-600 bg-slate-50/50 dark:bg-slate-800/50"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSignInPassword((prev) => !prev)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 p-0.5 rounded cursor-pointer"
                        title={showSignInPassword ? "Hide password" : "Show password"}
                        aria-label={showSignInPassword ? "Hide password" : "Show password"}
                      >
                        {showSignInPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={authSubmitting || googleSubmitting}
                    className="w-full py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm shadow-sm transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95"
                  >
                    {authSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Signing In...</span>
                      </>
                    ) : (
                      <>
                        <LogIn className="w-4 h-4" />
                        <span>Sign In</span>
                      </>
                    )}
                  </button>
                </form>
              ) : (
                /* ---------------- TAB 2: REGISTER FORM ---------------- */
                <form onSubmit={handleRegisterSubmit} className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                      Full Student Name
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                      <input
                        ref={registerNameInputRef}
                        type="text"
                        required
                        placeholder="e.g. Maria Santos"
                        value={registerName}
                        onChange={(e) => setRegisterName(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-base sm:text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-600 bg-slate-50/50 dark:bg-slate-800/50"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                      <input
                        type="email"
                        required
                        autoComplete="email"
                        placeholder="student@example.com"
                        value={registerEmail}
                        onChange={(e) => setRegisterEmail(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-base sm:text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-600 bg-slate-50/50 dark:bg-slate-800/50"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                        Password <span className="text-slate-400 font-normal lowercase">(6+ chars)</span>
                      </label>
                      <div className="relative">
                        <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                        <input
                          type={showRegisterPassword ? "text" : "password"}
                          required
                          placeholder="••••••••"
                          value={registerPassword}
                          onChange={(e) => setRegisterPassword(e.target.value)}
                          className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-base sm:text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-600 bg-slate-50/50 dark:bg-slate-800/50"
                        />
                        <button
                          type="button"
                          onClick={() => setShowRegisterPassword((prev) => !prev)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 p-0.5 rounded cursor-pointer"
                          title={showRegisterPassword ? "Hide password" : "Show password"}
                          aria-label={showRegisterPassword ? "Hide password" : "Show password"}
                        >
                          {showRegisterPassword ? (
                            <EyeOff className="w-3.5 h-3.5" />
                          ) : (
                            <Eye className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                        Confirm Password
                      </label>
                      <div className="relative">
                        <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                        <input
                          type={showRegisterPassword ? "text" : "password"}
                          required
                          placeholder="••••••••"
                          value={registerConfirmPassword}
                          onChange={(e) => setRegisterConfirmPassword(e.target.value)}
                          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-base sm:text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-600 bg-slate-50/50 dark:bg-slate-800/50"
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={authSubmitting || googleSubmitting}
                    className="w-full py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm shadow-sm transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95"
                  >
                    {authSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Creating Account...</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4" />
                        <span>Create Student Account</span>
                      </>
                    )}
                  </button>

                  <div className="pt-2 text-center">
                    <p className="text-[11.5px] text-slate-500 dark:text-slate-400">
                      Already have an account?{" "}
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode("signin");
                          setAuthError(null);
                        }}
                        className="font-bold text-brand-700 dark:text-brand-400 hover:underline cursor-pointer"
                      >
                        Sign In here
                      </button>
                    </p>
                  </div>
                </form>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
