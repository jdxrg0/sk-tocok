"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Bell,
  BellOff,
  BellRing,
  Check,
  Loader2,
  AlertCircle,
  ShieldAlert,
  Smartphone,
  Share,
  PlusSquare,
  ArrowDown,
  X,
  Sparkles,
  DownloadCloud,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

interface PushNotificationPromptProps {
  variant?: "card" | "banner" | "button" | "compact";
  className?: string;
  onSubscribed?: () => void;
}

export default function PushNotificationManager({
  variant = "card",
  className = "",
  onSubscribed,
}: PushNotificationPromptProps) {
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [isSecure, setIsSecure] = useState(true);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 1-Tap Install on Android / Chromium
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  // Guided Install Sheet on iOS
  const [showIOSModal, setShowIOSModal] = useState(false);
  // Custom in-app HTTPS modal (no native browser alert())
  const [showHTTPSModal, setShowHTTPSModal] = useState(false);

  // Prevent background scroll and hide bottom navigation while modal is active
  useEffect(() => {
    if (!showIOSModal && !showHTTPSModal) return;

    document.documentElement.dataset.modalOpen = "true";
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowIOSModal(false);
        setShowHTTPSModal(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      delete document.documentElement.dataset.modalOpen;
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [showIOSModal, showHTTPSModal]);

  const checkStatus = useCallback(async () => {
    if (typeof window === "undefined") return;

    // Check secure context (localhost, 127.0.0.1, or https)
    const secure =
      window.isSecureContext ||
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";
    setIsSecure(secure);

    // Detect iOS
    const ua = window.navigator.userAgent || "";
    const iOSDevice =
      /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    setIsIOS(iOSDevice);

    const standaloneMode =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsStandalone(standaloneMode);

    const hasSW = "serviceWorker" in navigator;
    const hasPush = "PushManager" in window;
    const hasNotif = "Notification" in window;

    const supported = Boolean(hasSW && hasPush && hasNotif);
    setIsSupported(supported);

    if (hasNotif) {
      setPermission(Notification.permission);
    }

    if (supported && secure) {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          const subscription = await registration.pushManager.getSubscription();
          setIsSubscribed(Boolean(subscription));
        }
      } catch (err) {
        console.error("Error checking push subscription:", err);
      }
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    checkStatus();

    // Listen for 1-tap install prompt on Android / Chromium
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    // Register service worker if supported and secure
    if (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      (window.isSecureContext ||
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1")
    ) {
      navigator.serviceWorker
        .register("/sw.js")
        .then(() => checkStatus())
        .catch((err) => console.error("Service worker registration error:", err));
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, [checkStatus]);

  // 1-Tap Trigger for Android (or modal for iOS)
  const handle1TapInstall = async () => {
    if (deferredPrompt) {
      // Android 1-tap native prompt
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === "accepted") {
          setDeferredPrompt(null);
        }
      } catch (e) {
        console.error("Install prompt error:", e);
      }
    } else if (isIOS) {
      // iOS Guided Sheet
      setShowIOSModal(true);
    }
  };

  const handleSubscribe = async () => {
    setErrorMsg(null);
    setLoading(true);

    try {
      if (!isSecure) {
        throw new Error(
          "Web Push requires HTTPS when accessing from mobile devices or external network."
        );
      }

      if (!("Notification" in window)) {
        if (isIOS && !isStandalone) {
          setShowIOSModal(true);
          return;
        }
        throw new Error("Push notifications are not supported in this browser.");
      }

      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm !== "granted") {
        if (perm === "denied") {
          throw new Error(
            "Notifications are blocked in your browser settings. Please allow notifications in site settings."
          );
        }
        return;
      }

      let registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        registration = await navigator.serviceWorker.register("/sw.js");
      }
      await navigator.serviceWorker.ready;

      // Get VAPID public key
      let vapidKey: string | undefined = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        const res = await fetch("/api/notifications/vapid-key");
        const data = await res.json();
        if (!res.ok || !data.publicKey) {
          throw new Error(data.error || "Could not retrieve VAPID key from server.");
        }
        vapidKey = data.publicKey;
      }

      if (!vapidKey) {
        throw new Error("Could not retrieve VAPID key from server.");
      }

      const convertedKey = urlBase64ToUint8Array(vapidKey);

      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedKey,
        });
      }

      const res = await fetch("/api/notifications/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || "Failed to register subscription on server.");
      }

      setIsSubscribed(true);
      if (onSubscribed) onSubscribed();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to enable notifications.";
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleUnsubscribe = async () => {
    setErrorMsg(null);
    setLoading(true);

    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          const endpoint = subscription.endpoint;
          await subscription.unsubscribe();

          await fetch("/api/notifications/subscribe", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint }),
          });
        }
      }
      setIsSubscribed(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to disable notifications.";
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  // Helper Modal for iOS users
  const renderIOSModal = () => {
    if (!showIOSModal || typeof document === "undefined") return null;

    return createPortal(
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => {
          if (e.target === e.currentTarget) setShowIOSModal(false);
        }}
        className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200"
        style={{
          paddingTop: "max(0.75rem, env(safe-area-inset-top, 0px))",
          paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))",
          paddingLeft: "max(0.75rem, env(safe-area-inset-left, 0px))",
          paddingRight: "max(0.75rem, env(safe-area-inset-right, 0px))",
        }}
      >
        <div
          className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-5 space-y-4 animate-in zoom-in-95 duration-200 relative text-left"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            type="button"
            onClick={() => setShowIOSModal(false)}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 flex items-center justify-center transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>

          {/* App Header */}
          <div className="flex items-center gap-3 pr-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/sk-logo.jpg"
              alt="SK Tocok Seal"
              className="w-12 h-12 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs object-cover"
            />
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Install SK Tocok on iPhone
              </h3>
              <p className="text-xs text-brand-700 dark:text-brand-400 font-semibold flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Required for iPhone Push Alerts
              </p>
            </div>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Apple requires saving web apps to your Home Screen before allowing notification alerts. Follow these 2 quick steps:
          </p>

          {/* Steps */}
          <div className="space-y-2.5">
            <div className="flex items-start gap-3 p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
              <div className="w-7 h-7 rounded-xl bg-sky-100 dark:bg-sky-950/70 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0 font-bold text-xs">
                1
              </div>
              <div className="text-xs text-slate-700 dark:text-slate-300">
                Tap the <strong className="text-slate-900 dark:text-slate-100 inline-flex items-center gap-1">Share <Share className="w-3.5 h-3.5 text-sky-500 inline" /></strong> button at the bottom of Safari.
              </div>
            </div>

            <div className="flex items-start gap-3 p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
              <div className="w-7 h-7 rounded-xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 font-bold text-xs">
                2
              </div>
              <div className="text-xs text-slate-700 dark:text-slate-300">
                Scroll down and tap <strong className="text-slate-900 dark:text-slate-100 inline-flex items-center gap-1">Add to Home Screen <PlusSquare className="w-3.5 h-3.5 text-emerald-500 inline" /></strong>, then tap <strong>Add</strong>.
              </div>
            </div>

            <div className="flex items-start gap-3 p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
              <div className="w-7 h-7 rounded-xl bg-amber-100 dark:bg-amber-950/70 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 font-bold text-xs">
                3
              </div>
              <div className="text-xs text-slate-700 dark:text-slate-300">
                Open <strong className="text-slate-900 dark:text-slate-100">SK Tocok</strong> from your home screen and tap <strong>Enable Alerts</strong>!
              </div>
            </div>
          </div>

          {/* Animated pointer indicator */}
          <div className="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-brand-600 dark:text-brand-400 animate-bounce pt-1">
            <ArrowDown className="w-4 h-4" />
            <span>Look for the Share icon at the bottom of your screen</span>
          </div>

          <button
            type="button"
            onClick={() => setShowIOSModal(false)}
            className="w-full py-2.5 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs transition cursor-pointer active:scale-98 shadow-sm"
          >
            Got It!
          </button>
        </div>
      </div>,
      document.body
    );
  };

  // Helper Modal for Insecure (HTTP) Contexts (replacing native browser alert)
  const renderHTTPSModal = () => {
    if (!showHTTPSModal || typeof document === "undefined") return null;

    return createPortal(
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => {
          if (e.target === e.currentTarget) setShowHTTPSModal(false);
        }}
        className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200"
        style={{
          paddingTop: "max(0.75rem, env(safe-area-inset-top, 0px))",
          paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))",
          paddingLeft: "max(0.75rem, env(safe-area-inset-left, 0px))",
          paddingRight: "max(0.75rem, env(safe-area-inset-right, 0px))",
        }}
      >
        <div
          className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-5 space-y-4 animate-in zoom-in-95 duration-200 relative text-left font-sans"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            type="button"
            onClick={() => setShowHTTPSModal(false)}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 flex items-center justify-center transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Header */}
          <div className="flex items-center gap-3 pr-8">
            <div className="w-11 h-11 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                HTTPS Connection Required
              </h3>
              <p className="text-xs text-amber-700 dark:text-amber-400 font-semibold">
                Web Push Security Standard
              </p>
            </div>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Mobile browsers strictly prohibit push notifications over insecure local Wi-Fi / HTTP addresses.
          </p>

          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 space-y-1.5">
            <div className="font-semibold text-slate-900 dark:text-slate-100 text-[11.5px]">
              How to enable push alerts:
            </div>
            <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">
              Open this website using your live <strong>HTTPS</strong> address or secure Cloudflare tunnel. Alerts will activate with one tap.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowHTTPSModal(false)}
            className="w-full py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-bold text-xs transition cursor-pointer active:scale-98 shadow-sm"
          >
            Got It
          </button>
        </div>
      </div>,
      document.body
    );
  };

  if (!mounted) {
    return null;
  }

  // -------------------------------------------------------------
  // Case A: Insecure context
  // -------------------------------------------------------------
  if (!isSecure) {
    if (variant === "compact" || variant === "button") {
      const isCompact = variant === "compact";
      return (
        <>
          <button
            type="button"
            onClick={() => setShowHTTPSModal(true)}
            title="Push notifications require HTTPS on mobile"
            className={`inline-flex items-center justify-center gap-1.5 ${
              isCompact ? "w-8 h-8 sm:w-auto sm:px-2.5 sm:py-1.5" : "px-2.5 py-1.5"
            } rounded-xl text-xs font-medium bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 transition cursor-pointer active:scale-95 shadow-2xs shrink-0 ${className}`}
          >
            <ShieldAlert className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className={isCompact ? "hidden sm:inline" : "inline"}>Requires HTTPS</span>
          </button>
          {renderHTTPSModal()}
        </>
      );
    }

    return (
      <>
        <div
          onClick={() => setShowHTTPSModal(true)}
          className={`p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-200 space-y-1 cursor-pointer hover:border-amber-300 transition shadow-2xs ${className}`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-amber-900 dark:text-amber-100">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Web Push Notifications</span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200/80 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200">
              HTTPS Needed
            </span>
          </div>
          <p className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">
            Mobile browsers strictly require a secure <strong>HTTPS</strong> connection for push notifications. When deployed to your live domain with SSL (or on <code>localhost</code>), you will be able to enable instant ticket alerts here with one tap.
          </p>
        </div>
        {renderHTTPSModal()}
      </>
    );
  }

  // -------------------------------------------------------------
  // Case B: iOS Safari without Add to Home Screen (PWA)
  // -------------------------------------------------------------
  if (isIOS && !isStandalone && !("Notification" in window)) {
    if (variant === "compact" || variant === "button") {
      const isCompact = variant === "compact";
      return (
        <>
          <button
            type="button"
            onClick={() => setShowIOSModal(true)}
            title="Tap for quick steps to add SK Tocok to your iPhone Home Screen"
            className={`inline-flex items-center justify-center gap-1.5 ${
              isCompact ? "w-8 h-8 sm:w-auto sm:px-3 sm:py-1.5" : "px-3 py-1.5"
            } rounded-xl text-xs font-bold bg-brand-50 hover:bg-brand-100 dark:bg-brand-950/60 dark:hover:bg-brand-900/60 border border-brand-200 dark:border-brand-800/70 text-brand-700 dark:text-brand-300 transition cursor-pointer active:scale-95 shadow-2xs shrink-0 ${className}`}
          >
            <Smartphone className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-brand-600 dark:text-brand-400 shrink-0" />
            <span className={isCompact ? "hidden sm:inline" : "inline"}>Add to Home Screen</span>
          </button>
          {renderIOSModal()}
        </>
      );
    }

    return (
      <>
        <div
          onClick={() => setShowIOSModal(true)}
          className={`p-3.5 rounded-2xl bg-gradient-to-r from-brand-50/90 to-amber-50/60 dark:from-brand-950/40 dark:to-amber-950/20 border border-brand-200/90 dark:border-brand-800/70 text-xs text-slate-700 dark:text-slate-300 space-y-2 cursor-pointer hover:border-brand-400 transition shadow-2xs ${className}`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100">
              <Smartphone className="w-4 h-4 text-brand-600 dark:text-brand-400 shrink-0" />
              <span>Enable Ticket Alerts on iPhone</span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-100 dark:bg-brand-900/60 text-brand-800 dark:text-brand-200">
              Tap for Guide
            </span>
          </div>
          <p className="text-[11.5px] leading-relaxed text-slate-600 dark:text-slate-400">
            To receive instant push notifications on iOS: Tap the <strong>Share</strong> button (📤) at the bottom of Safari, then choose <strong>&ldquo;Add to Home Screen&rdquo;</strong>.
          </p>
        </div>
        {renderIOSModal()}
      </>
    );
  }

  // -------------------------------------------------------------
  // Case C: Standard Button / Compact Variant
  // -------------------------------------------------------------
  if (variant === "compact" || variant === "button") {
    const isCompact = variant === "compact";

    // If Android user hasn't installed app yet and 1-tap install prompt is ready:
    if (deferredPrompt && !isStandalone) {
      return (
        <button
          type="button"
          onClick={handle1TapInstall}
          title="Install SK Tocok App to your Home Screen in 1 tap"
          className={`inline-flex items-center justify-center gap-1.5 ${
            isCompact ? "w-8 h-8 sm:w-auto sm:px-3 sm:py-1.5" : "px-3 py-1.5"
          } rounded-xl text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white transition cursor-pointer active:scale-95 shadow-sm shadow-brand-500/20 shrink-0 ${className}`}
        >
          <DownloadCloud className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
          <span className={isCompact ? "hidden sm:inline" : "inline"}>Install App</span>
        </button>
      );
    }

    if (isSubscribed) {
      return (
        <button
          type="button"
          onClick={handleUnsubscribe}
          disabled={loading}
          title="Push notifications active on this device. Click to disable."
          className={`inline-flex items-center justify-center gap-1.5 ${
            isCompact ? "w-8 h-8 sm:w-auto sm:px-3 sm:py-1.5" : "px-3 py-1.5"
          } rounded-xl text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/70 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition cursor-pointer active:scale-95 shadow-2xs shrink-0 ${className}`}
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin shrink-0" />
          ) : (
            <span className="relative flex items-center justify-center">
              <BellRing className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </span>
          )}
          <span className={isCompact ? "hidden sm:inline" : "inline"}>Alerts On</span>
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={handleSubscribe}
        disabled={loading}
        title="Enable push alerts on this device"
        className={`inline-flex items-center justify-center gap-1.5 ${
          isCompact ? "w-8 h-8 sm:w-auto sm:px-3 sm:py-1.5" : "px-3 py-1.5"
        } rounded-xl text-xs font-bold bg-brand-50 hover:bg-brand-100 dark:bg-brand-950/60 dark:hover:bg-brand-900/60 border border-brand-200 dark:border-brand-800/70 text-brand-700 dark:text-brand-300 transition cursor-pointer active:scale-95 shadow-2xs shrink-0 ${className}`}
      >
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin shrink-0" />
        ) : (
          <Bell className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-brand-600 dark:text-brand-400 shrink-0" />
        )}
        <span className={isCompact ? "hidden sm:inline" : "inline"}>Enable Alerts</span>
      </button>
    );
  }

  // -------------------------------------------------------------
  // Case D: Full Banner / Card Variant (Default)
  // -------------------------------------------------------------
  return (
    <>
      <div
        className={`p-3.5 sm:p-4 rounded-2xl border transition-all shadow-2xs font-sans ${
          isSubscribed
            ? "bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200/90 dark:border-emerald-800/70"
            : "bg-gradient-to-r from-brand-50/90 to-amber-50/60 dark:from-brand-950/40 dark:to-amber-950/20 border-brand-200/90 dark:border-brand-800/70"
        } ${className}`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                isSubscribed
                  ? "bg-emerald-100 dark:bg-emerald-900/60 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300"
                  : "bg-brand-100 dark:bg-brand-900/60 border-brand-300 dark:border-brand-700 text-brand-700 dark:text-brand-300"
              }`}
            >
              {isSubscribed ? <BellRing className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
            </div>

            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-sm">
                  {isSubscribed ? "Push Notifications Active" : "Get Notified for Ticket Updates"}
                </h4>
                {isSubscribed && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/80 text-emerald-800 dark:text-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    This Device
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug">
                {isSubscribed
                  ? "You will receive an instant notification on this device when SK officials print your documents."
                  : "Receive a phone/browser notification when your document is printing or ready for pickup."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            {/* If Android has 1-tap install available */}
            {deferredPrompt && !isStandalone && (
              <button
                type="button"
                onClick={handle1TapInstall}
                className="px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 text-xs font-bold transition cursor-pointer shadow-xs inline-flex items-center gap-1.5 active:scale-95"
              >
                <DownloadCloud className="w-3.5 h-3.5" />
                <span>Add to Home Screen</span>
              </button>
            )}

            {isSubscribed ? (
              <button
                type="button"
                onClick={handleUnsubscribe}
                disabled={loading}
                className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-rose-50 hover:border-rose-300 hover:text-rose-600 dark:hover:bg-rose-950/50 text-slate-700 dark:text-slate-300 text-xs font-semibold transition cursor-pointer shadow-2xs"
              >
                {loading ? "Updating..." : "Disable Alerts"}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubscribe}
                disabled={loading}
                className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition cursor-pointer shadow-sm shadow-brand-500/20 inline-flex items-center gap-1.5 active:scale-95"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Enabling...</span>
                  </>
                ) : (
                  <>
                    <Bell className="w-3.5 h-3.5" />
                    <span>Enable Push Alerts</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {errorMsg && (
          <div className="mt-2.5 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/70 text-rose-800 dark:text-rose-300 text-[11.5px] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {permission === "denied" && !errorMsg && (
          <div className="mt-2.5 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/70 text-amber-900 dark:text-amber-200 text-[11px] flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              Notifications are blocked in your browser. Tap the site permissions / lock icon in your address bar and toggle <strong>Notifications</strong> to <strong>Allow</strong>.
            </span>
          </div>
        )}
      </div>
      {renderIOSModal()}
    </>
  );
}
