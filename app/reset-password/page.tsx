"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ShieldCheck, KeyRound, AlertTriangle, CheckCircle2, ArrowLeft, Eye, EyeOff, Loader2 } from "lucide-react";

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [checking, setChecking] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [accountName, setAccountName] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [tokenError, setTokenError] = useState("");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [success, setSuccess] = useState(false);

  const [requestEmail, setRequestEmail] = useState("");
  const [requestSent, setRequestSent] = useState("");
  const [requestBusy, setRequestBusy] = useState(false);

  useEffect(() => {
    let active = true;
    async function verify() {
      if (!token) {
        if (active) {
          setChecking(false);
          setTokenValid(false);
          setTokenError("Missing password reset token.");
        }
        return;
      }
      try {
        const res = await fetch(`/api/auth/reset-password?token=${encodeURIComponent(token)}`);
        const data = await res.json();
        if (!active) return;
        if (res.ok && data.valid) {
          setTokenValid(true);
          setAccountName(data.name || "");
          setMaskedEmail(data.email || "");
          setExpiresAt(data.expiresAt || "");
        } else {
          setTokenValid(false);
          setTokenError(data.error || "This password reset link is invalid or has expired.");
        }
      } catch {
        if (active) {
          setTokenValid(false);
          setTokenError("Unable to verify reset link.");
        }
      } finally {
        if (active) setChecking(false);
      }
    }
    verify();
    return () => {
      active = false;
    };
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError("");
    if (password.length < 8) {
      setSubmitError("Password must be at least 8 characters long.");
      return;
    }
    if (!/[a-zA-Z]/.test(password) || !/[0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(password)) {
      setSubmitError("Password must include at least one letter and one number or symbol.");
      return;
    }
    if (password !== confirmPassword) {
      setSubmitError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error || "Failed to update password.");
      } else {
        setSuccess(true);
      }
    } catch {
      setSubmitError("Network error while updating password.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRequestNewLink(e: React.FormEvent) {
    e.preventDefault();
    if (!requestEmail.trim()) return;
    setRequestBusy(true);
    setRequestSent("");
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: requestEmail.trim() }),
      });
      const data = await res.json();
      setRequestSent(data.message || data.error || "Request processed.");
    } catch {
      setRequestSent("Unable to process request right now.");
    } finally {
      setRequestBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-xl bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">Reset Account Password</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">SK Barangay Tocok Transparency Portal</p>
          </div>
        </div>

        {checking ? (
          <div className="py-10 flex flex-col items-center justify-center text-slate-500 gap-3">
            <Loader2 className="w-7 h-7 animate-spin text-emerald-600" />
            <p className="text-sm font-medium">Verifying expiring reset link...</p>
          </div>
        ) : success ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 flex gap-3">
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold">Password Updated</p>
                <p className="text-xs mt-1 opacity-90">
                  Your password has been changed and all previous sessions were signed out. You can now sign in with your new password.
                </p>
              </div>
            </div>
            <Link
              href="/"
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Return to Portal
            </Link>
          </div>
        ) : !tokenValid ? (
          <div className="space-y-5">
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 flex gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold">Reset Link Invalid or Expired</p>
                <p className="text-xs mt-1">{tokenError}</p>
              </div>
            </div>

            <form onSubmit={handleRequestNewLink} className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Request a fresh 15-minute reset link:
              </p>
              <input
                type="email"
                required
                value={requestEmail}
                onChange={(e) => setRequestEmail(e.target.value)}
                placeholder="Enter your account email"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="submit"
                disabled={requestBusy}
                className="w-full py-2.5 rounded-xl bg-slate-900 dark:bg-emerald-600 hover:opacity-95 text-white text-sm font-semibold transition-opacity disabled:opacity-60"
              >
                {requestBusy ? "Sending..." : "Request New Reset Link"}
              </button>
              {requestSent && (
                <p className="text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 p-2.5 rounded-lg">
                  {requestSent}
                </p>
              )}
            </form>

            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Home
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 space-y-1">
              <p>
                Account: <span className="font-semibold text-slate-900 dark:text-white">{accountName}</span> ({maskedEmail})
              </p>
              {expiresAt && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Expires: {new Date(expiresAt).toLocaleString()}
                </p>
              )}
            </div>

            {submitError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-medium">
                {submitError}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 chars (letter + number/symbol)"
                  className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Confirm New Password
              </label>
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
            >
              <KeyRound className="w-4 h-4" />
              {submitting ? "Updating Password..." : "Save New Password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
