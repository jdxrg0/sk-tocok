import Link from "next/link";
import { LayoutGrid, ArrowUpRight, Printer, MessageSquareQuote, Award, type LucideIcon } from "lucide-react";

interface OtherPageItem {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  badge?: string;
}

// Add new public pages here as they are created
const OTHER_PAGES: OtherPageItem[] = [
  {
    href: "/cse",
    title: "Free Civil Service Exam (CSE) ₱500 Subsidy",
    description:
      "₱500 examination fee reimbursement, attendance verification, and Hall of Fame recognition for Katipunan ng Kabataan examinees.",
    icon: Award,
    badge: "20 Annual Slots",
  },
  {
    href: "/messages",
    title: "Bumo-Boses",
    description:
      "Share suggestions, community project ideas, purok concerns, and questions with the SK Council 100% anonymously, and view official replies.",
    icon: MessageSquareQuote,
    badge: "Community Wall",
  },
  {
    href: "/printing",
    title: "Free Student Printing Service",
    description:
      "Submit school documents, modules, research papers, and reviewer prints for free with live status tracking.",
    icon: Printer,
    badge: "Free Service",
  },
];

export default function OthersPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10 pb-24 md:pb-16 space-y-6">
      {/* Page Header */}
      <div className="space-y-1">
        <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">
          Other Pages
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-sans">
          Explore additional Sangguniang Kabataan ng Barangay Tocok services and resources.
        </p>
      </div>

      {/* Pages Grid or Empty State */}
      {OTHER_PAGES.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 font-sans">
          {OTHER_PAGES.map((page) => {
            const Icon = page.icon;
            return (
              <Link
                key={page.href}
                href={page.href}
                className="group bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-brand-300 dark:hover:border-brand-700 p-5 shadow-xs hover:shadow-sm transition-all flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-950/60 border border-brand-200/70 dark:border-brand-800/70 text-brand-700 dark:text-brand-300 flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5" />
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-brand-600 dark:group-hover:text-brand-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all shrink-0" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-brand-700 dark:group-hover:text-brand-300 transition-colors">
                        {page.title}
                      </h3>
                      {page.badge && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 border border-brand-200/70 dark:border-brand-800/70">
                          {page.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      {page.description}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs px-6 py-14 sm:py-20 text-center font-sans">
          <div className="max-w-sm mx-auto space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-brand-50 dark:bg-brand-950/60 border border-brand-200/70 dark:border-brand-800/70 text-brand-700 dark:text-brand-300 flex items-center justify-center mx-auto">
              <LayoutGrid className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                No Other Pages Yet
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                Additional Barangay Tocok SK services, programs, and portal pages will appear here once they become available.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
