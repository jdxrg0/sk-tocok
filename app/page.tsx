import Link from "next/link";
import { unstable_cache } from "next/cache";
import { sql } from "@/lib/db";
import { ensureAttendanceTables } from "@/lib/attendance";
import { ensureMessagesTable } from "@/lib/messages";
import BudgetNoticeTooltip from "@/components/BudgetNoticeTooltip";
import CouncilTreeSection, { type OfficialSummary } from "@/components/CouncilTreeSection";
import { 
  ArrowRight, 
  FileText, 
  UserCheck,
  Megaphone,
  GraduationCap,
  Info, 
  CheckCircle2,
  Phone,
  ArrowUpRight
} from "lucide-react";

export const dynamic = "force-dynamic";

const getCachedData = unstable_cache(
  async () => {
    return await Promise.all([
      sql`SELECT key, value FROM settings WHERE key IN ('barangay_budget', 'annual_budget', 'printing_active', 'printing_announcement')`,
      sql`SELECT COALESCE(SUM(amount), 0) AS total FROM deposits`,
      sql`SELECT COUNT(*) AS count FROM deposits`,
      sql`SELECT COALESCE(SUM(amount), 0) AS total FROM expenses`,
      sql`SELECT COUNT(*) AS count FROM print_requests`,
      sql`SELECT name, email, role, contact_number, avatar_url FROM users WHERE LOWER(TRIM(COALESCE(role, ''))) NOT IN ('student', 'guest', '') ORDER BY id ASC`,
      sql`
        SELECT
          (SELECT COUNT(*) FROM attendance_sessions)::int AS total_sessions,
          (SELECT COUNT(*) FROM attendance_records WHERE status = 'Present')::int AS present_records,
          (SELECT COUNT(*) FROM attendance_records)::int AS total_records
      `,
      sql`
        SELECT
          (SELECT COUNT(*) FROM anonymous_messages WHERE is_public = TRUE AND status = 'approved')::int AS public_messages
      `.catch(() => [{ public_messages: 0 }]),
      sql`
        SELECT 
          COUNT(*)::int AS total_cse,
          COUNT(CASE WHEN exam_result_status = 'Passed' THEN 1 END)::int AS total_passers
        FROM cse_applications
      `.catch(() => [{ total_cse: 0, total_passers: 0 }]),
    ]);
  },
  ['home-data'],
  { revalidate: 60 } // Revalidate every minute
);

const SERVICES = [
  {
    href: "/printing",
    title: "Free Printing",
    description: "Free student document printing",
    icon: FileText,
    circleClass: "bg-brand-600 shadow-brand-600/20 ring-brand-100 dark:ring-brand-950/70",
  },
  {
    href: "/attendance",
    title: "SK Attendance",
    description: "Session logs & roll call records",
    icon: UserCheck,
    circleClass: "bg-indigo-600 shadow-indigo-600/20 ring-indigo-100 dark:ring-indigo-950/70",
  },
  {
    href: "/messages",
    title: "Bumo-Boses",
    description: "Anonymous youth feedback & voice",
    icon: Megaphone,
    circleClass: "bg-emerald-600 shadow-emerald-600/20 ring-emerald-100 dark:ring-emerald-950/70",
  },
  {
    href: "/cse",
    title: "CSE Subsidy",
    description: "Civil Service exam subsidy grant",
    icon: GraduationCap,
    circleClass: "bg-amber-500 shadow-amber-500/20 ring-amber-100 dark:ring-amber-950/70",
  },
];

export default async function HomePage() {
  await Promise.all([
    ensureAttendanceTables(),
    ensureMessagesTable(),
  ]);

  // 1. Concurrently fetch settings, totals, attendance stats, and officials
  const [
    settingRows,
    totalDepositedRows,
    depositCountRows,
    spentRows,
    totalPrintsRows,
    officialsRows,
    attendanceStatsRows,
    messagesStatsRows,
    cseStatsRows,
  ] = await getCachedData();

  const cseRow = ((cseStatsRows as { total_cse?: number; total_passers?: number }[])[0]) || { total_cse: 0, total_passers: 0 };
  const totalCsePassers = Number(cseRow.total_passers || 0);

  const totalPublicMessages = Number(
    ((messagesStatsRows as { public_messages?: number }[])[0]?.public_messages) || 0
  );

  const attRow = (attendanceStatsRows[0] || {}) as {
    total_sessions?: number;
    present_records?: number;
    total_records?: number;
  };
  const totalAttendanceSessions = Number(attRow.total_sessions || 0);
  const totalAttendanceRecords = Number(attRow.total_records || 0);
  const avgAttendanceRate =
    totalAttendanceRecords > 0
      ? (Number(attRow.present_records || 0) / totalAttendanceRecords) * 100
      : 0;

  const settings: Record<string, string> = {};
  for (const r of settingRows as { key: string; value: string }[]) {
    settings[r.key] = r.value;
  }

  const barangayBudget = parseFloat(settings.barangay_budget ?? "7000000");
  // Statutory 10% SK allocation under Republic Act No. 10742
  const annualBudget = barangayBudget * 0.10;
  const totalDeposited = Number((totalDepositedRows[0] as { total: number }).total);
  const totalDepositsCount = Number((depositCountRows[0] as { count: number }).count);
  const fundsReceived = totalDeposited;
  const totalSpent = Number((spentRows[0] as { total: number }).total);

  // Actual cash physically in the bank right now from monthly releases minus disbursements
  const currentBankBalance = Math.max(0, fundsReceived - totalSpent);

  // Utilization calculation against full estimated year
  const utilizationRate = annualBudget > 0 ? (totalSpent / annualBudget) * 100 : 0;

  // 2. Fetch Free Printing Program Info
  const totalPrints = Number((totalPrintsRows[0] as { count: number }).count);
  const isPrintingActive = settings.printing_active ? settings.printing_active === "true" : true;
  const announcement = settings.printing_announcement || "Free Student Printing Program is active. SK Hall is open Mon-Fri, 8:00 AM - 5:00 PM.";

  // 3. SK Council Officials
  const officials = officialsRows as OfficialSummary[];

  // Separate hierarchy tiers for pyramid display
  const chairperson = officials.find((o) => o.role.toLowerCase().includes("chair"));
  const executiveOfficers = officials
    .filter((o) => {
      const r = o.role.toLowerCase();
      return (r.includes("secretary") || r.includes("treasurer")) && !r.includes("chair");
    })
    .sort((a, b) => {
      if (a.role.toLowerCase().includes("sec")) return -1;
      if (b.role.toLowerCase().includes("sec")) return 1;
      return 0;
    });
  const councilors = officials
    .filter((o) => {
      const r = o.role.toLowerCase();
      if (r.includes("chair") || r.includes("secretary") || r.includes("treasurer")) return false;
      return (
        r.includes("kagawad") ||
        r.includes("council") ||
        r.includes("health") ||
        r.includes("livelihood") ||
        r.includes("sports") ||
        r.includes("gad") ||
        r.includes("education") ||
        (!r.includes("staff") && !r.includes("custodian"))
      );
    })
    .sort((a, b) => {
      // Keep Baby Julhitz R. Picar as the centered anchor of the councilors tier
      const isBabyA = a.name.toLowerCase().includes("baby") || a.name.toLowerCase().includes("picar");
      const isBabyB = b.name.toLowerCase().includes("baby") || b.name.toLowerCase().includes("picar");
      if (isBabyA && !isBabyB) return 1;
      if (!isBabyA && isBabyB) return -1;
      return 0;
    });

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-4 pb-20 sm:pt-6 sm:pb-10 space-y-6 sm:space-y-8">
      {/* =========================================================================
          SECTION 1: FINANCIAL OVERVIEW
          Live SK Cash Flow & Budget Benchmarks
         ========================================================================= */}
      <section className="space-y-3">
        {/* Section Header with Title & Discreet (i) Info Tooltip */}
        <div className="flex items-center justify-between pb-0.5">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Financial Overview
            </h2>
            <BudgetNoticeTooltip
              variant="pill"
              align="left"
              currentBankBalance={currentBankBalance}
              fundsReceived={fundsReceived}
              totalSpent={totalSpent}
              totalDepositsCount={totalDepositsCount}
              annualBudget={annualBudget}
              barangayBudget={barangayBudget}
              utilizationRate={utilizationRate}
            />
          </div>
          <span className="text-[10px] sm:text-[10.5px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider hidden xs:inline">
            Live Budget
          </span>
        </div>

        {/* TIER 1: LIVE SK CASH OPERATIONS (THE REAL MONEY) */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 font-sans">
          {/* Hero Card: Current Cash in Bank (Net Actual Unspent Balance) */}
          <Link
            href="/transparency"
            prefetch={true}
            className="group col-span-2 lg:col-span-1 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-sm active:scale-[0.99] transition-all flex flex-col justify-between gap-1.5 cursor-pointer select-none"
          >
            <span className="text-xs sm:text-[13px] font-medium text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-300 transition-colors">
              Current Cash in Bank
            </span>
            <p className="text-2xl sm:text-3xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 tabular-nums leading-none">
              ₱{currentBankBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </p>
          </Link>

          {/* Inflow Card: Monthly Funds Deposited to Date */}
          <Link
            href="/transparency?tab=ledgers&ledger=deposits"
            prefetch={true}
            className="group col-span-1 lg:col-span-1 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-sm active:scale-[0.99] transition-all flex flex-col justify-between gap-1.5 cursor-pointer select-none"
          >
            <span className="text-xs sm:text-[13px] font-medium text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-300 transition-colors">
              Funds Deposited
            </span>
            <p className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 tabular-nums leading-none">
              ₱{fundsReceived.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </p>
          </Link>

          {/* Outflow Card: Total Disbursed to Date */}
          <Link
            href="/transparency?tab=ledgers&ledger=expenses"
            prefetch={true}
            className="group col-span-1 lg:col-span-1 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-sm active:scale-[0.99] transition-all flex flex-col justify-between gap-1.5 cursor-pointer select-none"
          >
            <span className="text-xs sm:text-[13px] font-medium text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-300 transition-colors">
              Total Disbursed
            </span>
            <p className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 tabular-nums leading-none">
              ₱{totalSpent.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </p>
          </Link>
        </div>

        {/* Progress Bar and Percent */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3 sm:p-3.5 shadow-xs font-sans">
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden flex shadow-inner">
              <div
                className="bg-gradient-to-r from-brand-600 via-brand-500 to-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(utilizationRate, 100)}%` }}
              />
            </div>
            <span className="text-xs sm:text-[13px] font-bold text-brand-700 dark:text-brand-400 tabular-nums whitespace-nowrap">
              {utilizationRate.toFixed(1)}%
            </span>
          </div>
        </div>
      </section>

      {/* Section Divider */}
      <div className="relative" aria-hidden="true">
        <div className="w-full border-t border-slate-200/80 dark:border-slate-800/80" />
      </div>

      {/* =========================================================================
          SECTION 2: YOUTH SERVICES & PROGRAMS (CIVIC QUICK-LAUNCH DOCK)
         ========================================================================= */}
      <section className="space-y-3">
        {/* Section Header */}
        <div className="flex items-center justify-between pb-0.5">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Youth Services & Programs
            </h2>
          </div>
          <span className="text-[10px] sm:text-[10.5px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            Public Portal
          </span>
        </div>

        {/* Quick-Launch Dock Container */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3 sm:p-4 shadow-xs">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
            {SERVICES.map((service) => {
              const Icon = service.icon;
              return (
                <Link
                  key={service.href}
                  href={service.href}
                  prefetch={true}
                  scroll={false}
                  className="group relative flex flex-col justify-between p-3 sm:p-3.5 rounded-xl bg-slate-50/80 hover:bg-slate-100/90 dark:bg-slate-800/40 dark:hover:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 hover:border-slate-300 dark:hover:border-slate-600 transition-all duration-150 active:scale-[0.98] cursor-pointer touch-manipulation select-none"
                  style={{ WebkitTapHighlightColor: "transparent" }}
                >
                  <div className="flex items-center justify-between gap-1.5 mb-2.5">
                    <div
                      className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl ${service.circleClass} text-white flex items-center justify-center shadow-xs ring-2 shrink-0 transition-transform duration-150 group-hover:scale-105`}
                    >
                      <Icon className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                    </div>
                    <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors shrink-0" />
                  </div>
                  <div>
                    <span className="block text-xs sm:text-[13px] font-bold text-slate-900 dark:text-slate-100 leading-tight">
                      {service.title}
                    </span>
                    <span className="block text-[10px] sm:text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                      {service.description}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Section Divider */}
      <div className="relative" aria-hidden="true">
        <div className="w-full border-t border-slate-200/80 dark:border-slate-800/80" />
      </div>

      {/* =========================================================================
          SECTION 3: SK COUNCIL OFFICIALS (HIERARCHICAL TREE)
         ========================================================================= */}
      <CouncilTreeSection
        chairperson={chairperson}
        executiveOfficers={executiveOfficers}
        councilors={councilors}
      />
    </div>
  );
}
