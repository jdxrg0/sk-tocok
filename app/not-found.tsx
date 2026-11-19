import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-20 text-center space-y-4">
      <h2 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100">Page Not Found</h2>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-600 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-300"
      >
        <ArrowLeft className="w-4 h-4" /> Return to Overview
      </Link>
    </div>
  );
}
