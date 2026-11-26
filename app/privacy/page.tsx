import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck, ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Privacy Policy | SK Tocok Portal",
  description:
    "Privacy Policy for the Sangguniang Kabataan ng Barangay Tocok Transparency & Service Portal.",
};

export default function PrivacyPolicyPage() {
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
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">
              Privacy Policy
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Sangguniang Kabataan ng Barangay Tocok, San Fabian, Pangasinan • Last updated: November 27, 2026
            </p>
          </div>
        </div>

        <section className="space-y-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            1. Information We Collect
          </h2>
          <p>
            When you sign in to the SK Tocok Portal using Google Sign-In or email registration, we collect only the basic account details needed to identify you and provide youth services:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Your name and email address (and profile photo URL when signing in with Google).</li>
            <li>Information and documents you voluntarily submit for youth programs, such as Free Student Printing requests and Civil Service Exam (CSE) fee assistance applications.</li>
          </ul>
        </section>

        <section className="space-y-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            2. How We Use Your Information
          </h2>
          <p>
            Your information is used strictly to authenticate your account, process and track your submitted SK service requests, send status updates if enabled, and maintain transparent public service records. We do not sell, rent, or share your personal information with third parties for advertising or marketing.
          </p>
        </section>

        <section className="space-y-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            3. Google User Data
          </h2>
          <p>
            Google Sign-In requests only standard identity scopes (<code>openid</code>, <code>email</code>, and <code>profile</code>) to verify your email and create or access your SK Tocok Portal account. We do not access your Gmail, Drive, Contacts, or other Google services.
          </p>
        </section>

        <section className="space-y-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            4. Data Security &amp; Contact
          </h2>
          <p>
            Sessions are secured with HTTP-only authentication cookies over HTTPS. If you would like your account or submitted request records updated or removed, please contact the SK Tocok Council at{" "}
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
