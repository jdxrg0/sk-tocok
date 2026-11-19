import Link from "next/link";
import { unstable_cache } from "next/cache";
import { sql } from "@/lib/db";
import { ensureAttendanceTables } from "@/lib/attendance";
import { ensureMessagesTable } from "@/lib/messages";
import BudgetNoticeTooltip from "@/components/BudgetNoticeTooltip";
import { 
  ArrowRight, 
  Printer, 
  ClipboardCheck,
  MessageSquareQuote,
  Info, 
  CheckCircle2, 
  Phone
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
      sql`SELECT name, role, contact_number, avatar_url FROM users WHERE LOWER(TRIM(COALESCE(role, ''))) NOT IN ('student', 'guest', '') ORDER BY id ASC`,
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
    ]);
  },
  ['home-data'],
  { revalidate: 60 } // Revalidate every minute
);

interface OfficialSummary {
  name: string;
  role: string;
  contact_number: string | null;
  avatar_url: string | null;
}

// Official initials helper (handles titles like "Hon.", "Ms.", "Mr.")
function getOfficialInitials(name: string) {
  const cleanName = name.replace(/^(hon\.?|ms\.?|mr\.?|dra\.?|dr\.?)\s+/i, "").trim();
  const parts = cleanName.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return name.charAt(0).toUpperCase();
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Split full name into highlighted Surname and Given Name / Honorific
function parseOfficialName(rawName: string) {
  let name = rawName.trim();
  let prefix = "";

  const prefixMatch = name.match(/^(hon\.?|ms\.?|mr\.?|dra\.?|dr\.?)\s+/i);
  if (prefixMatch) {
    prefix = prefixMatch[1].toUpperCase();
    if (!prefix.endsWith(".")) prefix += ".";
    name = name.substring(prefixMatch[0].length).trim();
  }

  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return {
      prefix,
      firstName: "",
      lastName: (parts[0] || rawName).toUpperCase(),
    };
  }

  const lastName = parts[parts.length - 1].toUpperCase();
  const firstName = parts.slice(0, parts.length - 1).join(" ").toUpperCase();

  return {
    prefix,
    firstName,
    lastName,
  };
}

// Role badge and theme styling helper
function getOfficialRoleStyle(role: string) {
  const r = role.toLowerCase();
  if (r.includes("chair")) {
    return {
      circleRing: "ring-brand-500/25 dark:ring-brand-400/35",
      gradient: "from-brand-600 via-brand-700 to-brand-900 text-white",
      badge: "bg-brand-50 text-brand-700 border-brand-200 dark:bg-brand-950/60 dark:text-brand-300 dark:border-brand-800/80",
    };
  }
  if (r.includes("secretary")) {
    return {
      circleRing: "ring-indigo-500/25 dark:ring-indigo-400/35",
      gradient: "from-indigo-600 via-purple-600 to-indigo-800 text-white",
      badge: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800/80",
    };
  }
  if (r.includes("treasurer")) {
    return {
      circleRing: "ring-emerald-500/25 dark:ring-emerald-400/35",
      gradient: "from-emerald-600 via-teal-600 to-emerald-800 text-white",
      badge: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/80",
    };
  }
  return {
    circleRing: "ring-brand-400/20 dark:ring-brand-400/30",
    gradient: "from-brand-700 via-slate-800 to-slate-900 text-white",
    badge: "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
  };
}

// Unified Official Card component to guarantee identical dimensions across all tiers
function OfficialCard({ official }: { official: OfficialSummary }) {
  const initials = getOfficialInitials(official.name);
  const style = getOfficialRoleStyle(official.role);
  const nameObj = parseOfficialName(official.name);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-3 sm:p-3.5 flex flex-col items-center text-center justify-between gap-2 shadow-xs h-full w-full">
      {/* Profile Picture Circle */}
      <div className="relative pt-0.5 flex items-center justify-center">
        <div
          className={`w-14 h-14 sm:w-16 sm:h-16 aspect-square shrink-0 rounded-full p-0.5 ring-2 sm:ring-[2.5px] ${style.circleRing} shadow-xs bg-white dark:bg-slate-800 flex items-center justify-center overflow-hidden`}
        >
          {official.avatar_url ? (
            <img
              src={official.avatar_url}
              alt={official.name}
              className="w-full h-full aspect-square shrink-0 rounded-full object-cover"
            />
          ) : (
            <div
              className={`w-full h-full aspect-square shrink-0 rounded-full bg-gradient-to-br ${style.gradient} flex items-center justify-center shadow-inner`}
            >
              <span className="text-sm sm:text-base font-black tracking-tight select-none">
                {initials}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Details Under the Circle (Surname Highlighted) */}
      <div className="space-y-1 w-full flex-1 flex flex-col justify-between text-center">
        <div className="min-h-[46px] sm:min-h-[50px] flex flex-col items-center justify-center">
          <span className="block font-black text-slate-900 dark:text-slate-100 text-xs sm:text-[13px] tracking-wider uppercase leading-tight break-words">
            {nameObj.lastName}
          </span>
          <span className="block font-semibold text-slate-500 dark:text-slate-400 text-[9.5px] sm:text-[10px] tracking-wide uppercase leading-tight sm:leading-snug break-words mt-0.5">
            {nameObj.prefix ? `${nameObj.prefix} ` : ""}{nameObj.firstName}
          </span>
        </div>

        <div className="w-full">
          <span
            className={`inline-block text-[9.5px] font-semibold px-2 py-0.5 rounded-full border truncate max-w-full ${style.badge}`}
            title={official.role}
          >
            {official.role}
          </span>
        </div>

        {official.contact_number && (
          <div className="pt-1.5 border-t border-slate-100/80 dark:border-slate-800 w-full">
            <a
              href={`tel:${official.contact_number}`}
              className="inline-flex items-center justify-center gap-1 text-[10px] text-slate-400 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 font-mono transition-colors truncate max-w-full"
              title={`Call ${official.name} (${official.contact_number})`}
            >
              <Phone className="w-2.5 h-2.5 text-slate-400 dark:text-slate-500 shrink-0" />
              <span className="truncate">{official.contact_number}</span>
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

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
  ] = await getCachedData();

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
    <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-4 pb-8 sm:pt-6 sm:pb-8 space-y-14">
      {/* =========================================================================
          SECTION 1: 2-TIER FINANCIAL HIERARCHY
          Tier 1: Live SK Cash Flow & Real Money (Hero Cash in Bank + Inflow/Outflow)
          Tier 2: Statutory Context & Annual Benchmarks (Mother LGU & 10% Fund)
         ========================================================================= */}
      <section className="space-y-3">
        {/* Section Header with Title & Discreet (i) Info Tooltip */}
        <div className="flex items-center justify-between pb-0.5">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Financial Overview
            </h2>
            <BudgetNoticeTooltip variant="pill" align="left" />
          </div>
          <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 hidden sm:inline">
            Live Bank &amp; Statutory Accounts
          </span>
        </div>

        {/* TIER 1: LIVE SK CASH OPERATIONS (THE REAL MONEY) */}
        <div className="grid grid-cols-2 lg:grid-cols-12 gap-3">
          {/* Hero Card: Current Cash in Bank (Net Actual Unspent Balance) */}
          <div className="col-span-2 lg:col-span-6 bg-gradient-to-br from-emerald-500/10 via-white to-emerald-50/70 dark:from-emerald-950/40 dark:via-slate-900 dark:to-emerald-950/20 border-2 border-emerald-400/80 dark:border-emerald-600/70 rounded-xl p-4 sm:p-5 shadow-xs hover:border-emerald-500 dark:hover:border-emerald-500 hover:shadow-sm transition-all flex flex-col justify-between gap-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center">
                  <span className="text-xs sm:text-[13px] font-bold text-emerald-950 dark:text-emerald-100 uppercase tracking-wider">
                    Current Cash in Bank
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium pt-0.5">
                  Actual unspent funds physically available right now
                </p>
              </div>
            </div>

            <div>
              <p className="text-2xl sm:text-3xl lg:text-[34px] font-black tracking-tight text-emerald-700 dark:text-emerald-400 leading-none">
                ₱{currentBankBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </p>
            </div>

            <div className="pt-2 border-t border-emerald-200/60 dark:border-emerald-900/60 flex items-center justify-between text-[11px] leading-tight">
              <span className="text-slate-500 dark:text-slate-400 font-medium">
                Net: ₱{fundsReceived.toLocaleString("en-US", { minimumFractionDigits: 0 })} in − ₱{totalSpent.toLocaleString("en-US", { minimumFractionDigits: 0 })} spent
              </span>
              <span className="text-emerald-800 dark:text-emerald-300 font-bold hidden sm:inline">
                Land Bank of the Philippines
              </span>
            </div>
          </div>

          {/* Inflow Card: Monthly Funds Deposited to Date */}
          <div className="col-span-1 lg:col-span-3 bg-gradient-to-br from-white via-white to-indigo-50/70 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/40 border border-indigo-200 dark:border-indigo-800/70 rounded-xl p-3 sm:p-4 shadow-xs hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-sm transition-all flex flex-col justify-between gap-2">
            <div className="flex items-start justify-between gap-1.5 min-h-[26px]">
              <span className="text-[11px] sm:text-xs font-semibold text-slate-600 dark:text-slate-300 leading-tight">
                Funds Deposited
              </span>
              <span className="text-[9.5px] font-bold text-indigo-800 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-950/70 px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800/80 shrink-0">
                {totalDepositsCount} Tranches
              </span>
            </div>
            <div>
              <p className="text-lg sm:text-xl lg:text-[22px] font-black tracking-tight text-slate-900 dark:text-slate-100 leading-tight">
                ₱{fundsReceived.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </p>
            </div>
            <p className="text-[10px] sm:text-[10.5px] text-slate-500 dark:text-slate-400 font-medium pt-1.5 border-t border-indigo-100/80 dark:border-indigo-900/60 leading-tight truncate" title="Actual monthly tranches transferred to SK Land Bank account so far.">
              Monthly bank remittances
            </p>
          </div>

          {/* Outflow Card: Total Disbursed to Date */}
          <div className="col-span-1 lg:col-span-3 bg-gradient-to-br from-white via-white to-brand-50/70 dark:from-slate-900 dark:via-slate-900 dark:to-brand-950/50 border border-brand-200 dark:border-brand-800/70 rounded-xl p-3 sm:p-4 shadow-xs hover:border-brand-300 dark:hover:border-brand-700 hover:shadow-sm transition-all flex flex-col justify-between gap-2">
            <div className="flex items-start justify-between gap-1.5 min-h-[26px]">
              <span className="text-[11px] sm:text-xs font-semibold text-slate-600 dark:text-slate-300 leading-tight">
                Total Disbursed
              </span>
              <span className="text-[9.5px] font-bold text-brand-800 dark:text-brand-300 bg-brand-100 dark:bg-brand-950/80 px-2 py-0.5 rounded-full border border-brand-200 dark:border-brand-800/80 shrink-0">
                {utilizationRate.toFixed(1)}% Spent
              </span>
            </div>
            <div>
              <p className="text-lg sm:text-xl lg:text-[22px] font-black tracking-tight text-brand-950 dark:text-brand-300 leading-tight">
                ₱{totalSpent.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </p>
            </div>
            <p className="text-[10px] sm:text-[10.5px] text-slate-500 dark:text-slate-400 font-medium pt-1.5 border-t border-brand-100/80 dark:border-brand-900/60 leading-tight truncate" title="Audited disbursements backed by official vouchers and receipts.">
              Audited vouchers &amp; receipts
            </p>
          </div>
        </div>

        {/* TIER 2: STATUTORY ANNUAL BUDGET FRAMEWORK & UTILIZATION */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-3.5 sm:p-4 shadow-2xs space-y-3">
          {/* Statutory Context Strip */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-x-3 sm:gap-x-4 gap-y-2 text-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Statutory Framework:
              </span>

              {/* SK Youth Fund (10% Statutory Share) */}
              <div className="flex items-center gap-1.5 bg-amber-50/70 dark:bg-amber-950/40 px-2.5 py-1 rounded-lg border border-amber-200/70 dark:border-amber-800/60">
                <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                  SK Youth Fund (10%):
                </span>
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  ~₱{annualBudget.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </span>
                <span className="text-[9px] font-bold text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/60 px-1.5 py-0.2 rounded shrink-0">
                  RA 10742
                </span>
              </div>

              {/* Mother Barangay Budget Estimate */}
              <div className="flex items-center gap-1.5 bg-sky-50/70 dark:bg-sky-950/40 px-2.5 py-1 rounded-lg border border-sky-200/70 dark:border-sky-800/60">
                <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                  Mother Barangay Budget:
                </span>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  ~₱{barangayBudget.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </span>
                <span className="text-[9px] font-bold text-sky-800 dark:text-sky-300 bg-sky-100 dark:bg-sky-900/60 px-1.5 py-0.2 rounded shrink-0">
                  LGU Est.
                </span>
              </div>
            </div>

            <Link
              href="/transparency"
              prefetch={true}
              scroll={false}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-600 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-300 transition-colors whitespace-nowrap shrink-0 group self-start sm:self-auto"
            >
              <span>View complete itemized ledger</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>

          {/* Progress Bar & Rate */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
              Annual Budget Spent:
            </span>
            <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden flex min-w-[80px]">
              <div
                className="bg-gradient-to-r from-brand-600 to-brand-700 dark:from-brand-500 dark:to-brand-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(utilizationRate, 100)}%` }}
              />
            </div>
            <span className="text-xs font-bold text-brand-700 dark:text-brand-400 whitespace-nowrap">
              {utilizationRate.toFixed(1)}%
            </span>
            <span className="hidden md:inline text-[11px] text-slate-400 dark:text-slate-500 pl-1 border-l border-slate-200 dark:border-slate-800">
              ₱{totalSpent.toLocaleString("en-US", { minimumFractionDigits: 2 })} of ~₱{annualBudget.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 2: COMMUNITY PROGRAMS & YOUTH SERVICES (FEATURE APPS)
         ========================================================================= */}
      <section className="space-y-2.5">
        {/* Section Header */}
        <div className="flex items-center justify-between pb-0.5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Community Programs &amp; Youth Services
          </h2>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* -----------------------------------------------------------------
              FREE STUDENT PRINTING PROGRAM (COMPACT FEATURE CARD)
              ----------------------------------------------------------------- */}
          <Link
            href="/printing"
            prefetch={true}
            scroll={false}
            className="group bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-brand-300 dark:hover:border-brand-700 rounded-xl p-3.5 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-brand-600 text-white flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <Printer className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors leading-tight">
                    Free Student Printing &amp; Tracking
                  </h3>
                </div>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${
                  isPrintingActive 
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/80" 
                    : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/80"
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isPrintingActive ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`}></span>
                  {isPrintingActive ? "Active" : "Restocking"}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                Free ink and paper for modules and reviewers for Tocok students. Submit online and track job status in real-time.
              </p>
            </div>

            <div className="pt-2.5 mt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                {totalPrints} prints served
              </span>
              <span className="font-bold text-brand-600 dark:text-brand-400 group-hover:text-brand-700 dark:group-hover:text-brand-300 inline-flex items-center gap-1">
                Open Portal
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </span>
            </div>
          </Link>

          {/* -----------------------------------------------------------------
              SK OFFICIALS ATTENDANCE TRACKER (COMPACT FEATURE CARD)
              ----------------------------------------------------------------- */}
          <Link
            href="/attendance"
            prefetch={true}
            scroll={false}
            className="group bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-brand-300 dark:hover:border-brand-700 rounded-xl p-3.5 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <ClipboardCheck className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors leading-tight">
                    SK Officials Attendance Sheet
                  </h3>
                </div>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 bg-brand-50 text-brand-700 border-brand-200 dark:bg-brand-950/60 dark:text-brand-300 dark:border-brand-800/80">
                  {totalAttendanceSessions > 0 ? `${avgAttendanceRate.toFixed(0)}% Avg` : "Live Matrix"}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                Live roll call matrix across Regular Sessions so residents can see which SK officials are actively attending and participating.
              </p>
            </div>

            <div className="pt-2.5 mt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                {totalAttendanceSessions} {totalAttendanceSessions === 1 ? "session" : "sessions"} recorded
              </span>
              <span className="font-bold text-brand-600 dark:text-brand-400 group-hover:text-brand-700 dark:group-hover:text-brand-300 inline-flex items-center gap-1">
                View Attendance Matrix
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </span>
            </div>
          </Link>

          {/* -----------------------------------------------------------------
              BUMO-BOSES (COMPACT FEATURE CARD)
              ----------------------------------------------------------------- */}
          <Link
            href="/messages"
            prefetch={true}
            scroll={false}
            className="group bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-brand-300 dark:hover:border-brand-700 rounded-xl p-3.5 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <MessageSquareQuote className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors leading-tight">
                    Bumo-Boses
                  </h3>
                </div>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/80">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Zero-Log
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                Directly share suggestions, community project ideas, and concerns with the SK Council 100% anonymously. Track council answers.
              </p>
            </div>

            <div className="pt-2.5 mt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                {totalPublicMessages} {totalPublicMessages === 1 ? "post" : "posts"} on board
              </span>
              <span className="font-bold text-brand-600 dark:text-brand-400 group-hover:text-brand-700 dark:group-hover:text-brand-300 inline-flex items-center gap-1">
                Submit a Suggestion
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </span>
            </div>
          </Link>
        </div>
      </section>

      {/* =========================================================================
          SECTION 3: SK COUNCIL OFFICIALS (TIERED HIERARCHY)
          Tier 1: SK Chairperson
          Tier 2: 7 SK Councilors (Kagawads & Committee Heads)
          Tier 3: Appointed Executive Officers (Secretary & Treasurer)
         ========================================================================= */}
      <section id="officials" className="space-y-6">
        <div className="border-b border-slate-200 dark:border-slate-800 pb-3 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-950 dark:text-slate-100">
              Sangguniang Kabataan Council
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Elected and appointed youth governance of Barangay Tocok under RA 10742
            </p>
          </div>
        </div>

        <div className="space-y-6">
          {/* TIER 1: SK CHAIRPERSON */}
          {chairperson && (
            <div className="space-y-3">
              <div className="relative flex items-center justify-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200/80 dark:border-slate-800" />
                </div>
                <div className="relative bg-slate-50 dark:bg-slate-900 px-3.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-800 text-[10.5px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5 shadow-2xs">
                  <span>SK Chairperson</span>
                </div>
              </div>

              <div className="flex justify-center w-full">
                <div className="w-[calc((100%-0.625rem)/2)] sm:w-[calc((100%-1.5rem)/3)] md:w-[calc((100%-2.25rem)/4)] lg:w-[calc((100%-4.5rem)/7)]">
                  <OfficialCard official={chairperson} />
                </div>
              </div>
            </div>
          )}

          {/* TIER 2: SK COUNCILORS & COMMITTEE CHAIRS (7 KAGAWADS) */}
          {councilors.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="relative flex items-center justify-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200/80 dark:border-slate-800" />
                </div>
                <div className="relative bg-slate-50 dark:bg-slate-900 px-3.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-800 text-[10.5px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5 shadow-2xs">
                  <span>SK Councilors &amp; Committee Chairs ({councilors.length})</span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2.5 sm:gap-3">
                {councilors.map((official, idx) => {
                  const isLastAndOdd = councilors.length % 2 === 1 && idx === councilors.length - 1;
                  const isBaby = official.name.toLowerCase().includes("baby") || official.name.toLowerCase().includes("picar");
                  const shouldCenter = isLastAndOdd || (isBaby && idx === councilors.length - 1);

                  return (
                    <div
                      key={official.name}
                      className={
                        shouldCenter
                          ? "col-span-2 sm:col-span-3 md:col-span-1 lg:col-span-1 w-[calc((100%-0.625rem)/2)] sm:w-[calc((100%-1.5rem)/3)] md:w-full lg:w-full mx-auto justify-self-center md:mx-0 md:justify-self-auto h-full"
                          : "w-full h-full"
                      }
                    >
                      <OfficialCard official={official} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TIER 3: APPOINTED EXECUTIVE OFFICERS (SECRETARY & TREASURER) */}
          {executiveOfficers.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="relative flex items-center justify-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200/80 dark:border-slate-800" />
                </div>
                <div className="relative bg-slate-50 dark:bg-slate-900 px-3.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-800 text-[10.5px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5 shadow-2xs">
                  <span>Executive Officers</span>
                </div>
              </div>

              <div className="flex justify-center gap-2.5 sm:gap-3 w-full">
                {executiveOfficers.map((official) => (
                  <div
                    key={official.name}
                    className="w-[calc((100%-0.625rem)/2)] sm:w-[calc((100%-1.5rem)/3)] md:w-[calc((100%-2.25rem)/4)] lg:w-[calc((100%-4.5rem)/7)]"
                  >
                    <OfficialCard official={official} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
