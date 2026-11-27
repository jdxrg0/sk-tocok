"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  MailCheck,
  AlertTriangle,
  CheckCircle2,
  ArrowLeft,
  Loader2,
  Send,
} from "lucide-react";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [verifying, setVerifying] = useState(Boolean(token));
  const [verified, setVerified] = useState(false);
  const [verifiedEmail, setVerifiedEmail] = useState("");
  const [error, setError] = useState(token ? "" : "Missing verification token.");

  const [resendEmail, setResendEmail] = useState("");
  const [resendBusy, setResendBusy] = useState(false);
  const [resendNotice, setResendNotice] = useState("");

  useEffect(() => {
    let active = true;
    async function runVerification() {
      if (!token) return;
      try {
        const res = await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = await res.json();
        if (!active) return;
        if (res.ok && data.success) {
          setVerified(true);
          setVerifiedEmail(data.email || "");
          setError("");
        } else {
          setVerified(false);
          setError(data.error || "Unable to verify email address.");
        }
      } catch {
        if (active) {
          setVerified(false);
          setError("Network error while verifying your email.");
        }
      } finally {
        if (active) setVerifying(false);
      }
    }
    runVerification();
    return () => {
      active = false;
    };
  }, [token]);

  async function handleResend(e: React.FormEvent) {
    e.preventDefault();
    if (!resendEmail.trim()) {
      setResendNotice("Please enter your email address.");
      return;
    }
    setResendBusy(true);
    setResendNotice("");
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resendEmail.trim() }),
      });
      const data = await res.json();
      setResendNotice(
        data.message || data.error || "Verification request processed."
      );
    } catch {
      setResendNotice("Unable to send verification link right now.");
    } finally {
      setResendBusy(false);
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-lg p-6 sm:p-8 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-700 dark:text-emerald-300 shrink-0">
            <MailCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-slate-900 dark:text-slate-100">
              Email Verification
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              SK Barangay Tocok Transparency Portal
            </p>
          </div>
        </div>

        {verifying ? (
          <div className="py-8 flex flex-col items-center justify-center gap-3 text-slate-500 dark:text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
            <p className="text-sm font-medium">Verifying your email address...</p>
          </div>
        ) : verified ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/70 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-sm text-emerald-900 dark:text-emerald-100 space-y-1">
                <p className="font-bold">Email Verified Successfully</p>
                <p className="text-xs opacity-90">
                  {verifiedEmail
                    ? `${verifiedEmail} is now verified. `
                    : ""}
                  You may now sign in to submit print requests and exam subsidy applications.
                </p>
              </div>
            </div>
            <Link
              href="/printing"
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Go to Student Services & Sign In
            </Link>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/70 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs sm:text-sm text-amber-900 dark:text-amber-100 space-y-1">
                <p className="font-bold">Verification Could Not Be Completed</p>
                <p className="text-xs opacity-90">{error}</p>
              </div>
            </div>

            <form onSubmit={handleResend} className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Need a fresh verification link?
              </label>
              <input
                type="email"
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
              <button
                type="submit"
                disabled={resendBusy}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-bold text-xs sm:text-sm hover:opacity-90 disabled:opacity-50 cursor-pointer"
              >
                {resendBusy ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Resend Verification Email
              </button>
              {resendNotice && (
                <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg p-2.5">
                  {resendNotice}
                </p>
              )}
            </form>

            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Overview
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[60vh] flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
