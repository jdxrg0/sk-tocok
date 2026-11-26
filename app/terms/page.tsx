import type { Metadata } from "next";
import Link from "next/link";
import { FileText, ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Terms of Service | SK Tocok Portal",
  description:
    "Terms of Service for the Sangguniang Kabataan ng Barangay Tocok Transparency & Service Portal.",
};

export default function TermsOfServicePage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 pb-24 md:pb-16 space-y-6 font-sans">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-brand-700 dark:text-slate-400 dark:hover:text-brand-300 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Portal
      </Link>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex items-start gap-3.5 border-b border-slate-100 dark:border-slate-800 pb-5">
          <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-950/60 border border-brand-200/70 dark:border-brand-800/70 text-brand-700 dark:text-brand-300 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">
              Terms of Service
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Sangguniang Kabataan ng Barangay Tocok, San Fabian, Pangasinan • Last updated: November 27, 2026
            </p>
          </div>
        </div>

        <section className="space-y-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            1. Acceptable Use
          </h2>
          <p>
            The SK Tocok Portal is provided for Barangay Tocok youth and residents to view public transparency records and apply for SK services such as student printing and Civil Service Exam fee assistance. You agree to provide accurate information and submit only lawful academic or program-related files.
          </p>
        </section>

        <section className="space-y-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            2. Program Availability
          </h2>
          <p>
            Services and subsidies are subject to SK Barangay Tocok guidelines, verification, and budget availability. For questions, contact{" "}
            <a
              href="mailto:sktocok2023@gmail.com"
              className="font-semibold text-brand-700 dark:text-brand-300 underline underline-offset-2"
            >
              sktocok2023@gmail.com
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
