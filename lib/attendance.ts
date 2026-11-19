export type AttendanceStatus = "Present" | "Absent";

export const ACTIVITY_TYPES = [
  "Regular Session",
  "Special Session",
  "Community Activity",
  "Youth Program",
  "Seminar & Training",
  "Other Activity",
] as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export interface OfficialBase {
  id: number;
  name: string;
  role: string;
  contact_number: string | null;
  avatar_url: string | null;
}

export interface SessionAttendanceEntry {
  user_id: number;
  status: AttendanceStatus;
}

export interface AttendanceSessionItem {
  id: number;
  title: string;
  activity_type: string;
  session_date: string;
  location: string | null;
  description: string | null;
  recorded_by: string | null;
  created_at: string;
  updated_at: string;
  presentCount: number;
  absentCount: number;
  totalCount: number;
  attendanceRate: number;
  records: SessionAttendanceEntry[];
}

export type ActivityStandingKey =
  | "highly_active"
  | "active"
  | "moderately_active"
  | "low_activity"
  | "no_records";

export interface ActivityStandingMeta {
  key: ActivityStandingKey;
  label: string;
  shortLabel: string;
  badgeClass: string;
  dotClass: string;
  textClass: string;
  barClass: string;
  hex: string;
}

export interface OfficialAttendanceStat extends OfficialBase {
  presentCount: number;
  absentCount: number;
  totalCount: number;
  overallRate: number;
  regularPresent: number;
  regularTotal: number;
  regularRate: number;
  otherPresent: number;
  otherTotal: number;
  otherRate: number;
  lastAttendedDate: string | null;
  currentStreak: number;
  standing: ActivityStandingKey;
  recentStatuses: {
    sessionId: number;
    title: string;
    date: string;
    activityType: string;
    status: AttendanceStatus;
  }[];
}

export interface MonthlyAttendanceTrend {
  month: string;
  regularRate: number | null;
  otherRate: number | null;
  overallRate: number;
  regularCount: number;
  otherCount: number;
  totalSessions: number;
}

export interface AttendanceSummary {
  totalSessions: number;
  regularSessionsCount: number;
  otherActivitiesCount: number;
  averageAttendanceRate: number;
  regularAverageRate: number;
  otherAverageRate: number;
  activeOfficialsCount: number;
  highlyActiveCount: number;
  lowActivityCount: number;
  totalOfficialsCount: number;
  mostActiveOfficial: {
    id: number;
    name: string;
    role: string;
    overallRate: number;
    presentCount: number;
    totalCount: number;
  } | null;
}

export interface AttendanceApiResponse {
  success: boolean;
  summary: AttendanceSummary;
  officials: OfficialAttendanceStat[];
  sessions: AttendanceSessionItem[];
  monthlyTrend: MonthlyAttendanceTrend[];
  availableYears: string[];
}

export function isRegularSessionType(activityType: string): boolean {
  return activityType.trim().toLowerCase() === "regular session";
}

export function getOfficialRoleRank(role: string): number {
  const r = (role || "").toLowerCase();
  if (r.includes("chair")) return 1;
  if (r.includes("secretary")) return 2;
  if (r.includes("treasurer")) return 3;
  return 4;
}

export function getActivityStanding(rate: number, totalCount: number): ActivityStandingMeta {
  if (totalCount === 0) {
    return {
      key: "no_records",
      label: "No Records Yet",
      shortLabel: "No Records",
      badgeClass:
        "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
      dotClass: "bg-slate-400 dark:bg-slate-500",
      textClass: "text-slate-500 dark:text-slate-400",
      barClass: "bg-slate-300 dark:bg-slate-700",
      hex: "#94a3b8",
    };
  }
  if (rate >= 100) {
    return {
      key: "highly_active",
      label: "Perfect Attendance",
      shortLabel: "Perfect",
      badgeClass:
        "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/80",
      dotClass: "bg-emerald-500",
      textClass: "text-emerald-700 dark:text-emerald-400",
      barClass: "bg-emerald-500 dark:bg-emerald-400",
      hex: "#10b981",
    };
  }
  if (rate >= 80) {
    return {
      key: "highly_active",
      label: "In Good Standing",
      shortLabel: "Good Standing",
      badgeClass:
        "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/80",
      dotClass: "bg-emerald-500",
      textClass: "text-emerald-700 dark:text-emerald-400",
      barClass: "bg-emerald-500 dark:bg-emerald-400",
      hex: "#10b981",
    };
  }
  if (rate >= 60) {
    return {
      key: "active",
      label: "Satisfactory",
      shortLabel: "Satisfactory",
      badgeClass:
        "bg-brand-50 text-brand-700 border-brand-200 dark:bg-brand-950/60 dark:text-brand-300 dark:border-brand-800/80",
      dotClass: "bg-brand-600 dark:bg-brand-400",
      textClass: "text-brand-700 dark:text-brand-400",
      barClass: "bg-brand-600 dark:bg-brand-400",
      hex: "#548701",
    };
  }
  if (rate >= 50) {
    return {
      key: "moderately_active",
      label: "Fair Attendance",
      shortLabel: "Fair",
      badgeClass:
        "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/80",
      dotClass: "bg-amber-500",
      textClass: "text-amber-700 dark:text-amber-400",
      barClass: "bg-amber-500 dark:bg-amber-400",
      hex: "#f59e0b",
    };
  }
  return {
    key: "low_activity",
    label: "Needs Review",
    shortLabel: "Needs Review",
    badgeClass:
      "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/80",
    dotClass: "bg-rose-500",
    textClass: "text-rose-700 dark:text-rose-400",
    barClass: "bg-rose-500 dark:bg-rose-400",
    hex: "#f43f5e",
  };
}

export function getActivityTypeBadge(activityType: string): string {
  const t = (activityType || "").toLowerCase();
  if (t === "regular session") {
    return "bg-brand-50 text-brand-700 border-brand-200 dark:bg-brand-950/60 dark:text-brand-300 dark:border-brand-800/80";
  }
  if (t.includes("special")) {
    return "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800/80";
  }
  if (t.includes("community")) {
    return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/80";
  }
  if (t.includes("youth") || t.includes("program")) {
    return "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/80";
  }
  if (t.includes("seminar") || t.includes("training")) {
    return "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800/80";
  }
  return "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";
}

export function getOfficialInitials(name: string): string {
  const cleanName = (name || "")
    .replace(/^(hon\.?|ms\.?|mr\.?|mrs\.?|dra\.?|dr\.?)\s+/i, "")
    .trim();
  const parts = cleanName.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return (name || "U").charAt(0).toUpperCase();
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function getOfficialShortName(name: string): string {
  const clean = (name || "")
    .replace(/^(hon\.?|ms\.?|mr\.?|mrs\.?|dra\.?|dr\.?)\s+/i, "")
    .trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return clean;
  const first = parts[0];
  const last = parts[parts.length - 1];
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  return `${cap(first)} ${cap(last)}`;
}

export function splitOfficialName(fullName: string): { surname: string; restOfName: string } {
  const clean = (fullName || "")
    .replace(/^(hon\.?|ms\.?|mr\.?|mrs\.?|dra\.?|dr\.?)\s+/i, "")
    .trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return { surname: clean.toUpperCase(), restOfName: "" };
  }
  const surname = parts[parts.length - 1].toUpperCase();
  const rawRest = parts.slice(0, parts.length - 1).join(" ");
  const restOfName = rawRest
    .split(/\s+/)
    .map((w) => {
      if (/^[A-Z]\.?$/i.test(w)) return w.toUpperCase();
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(" ");
  return { surname, restOfName };
}

export async function ensureAttendanceTables(): Promise<void> {
  // Table schema and indexes are initialized by init-db.mjs
}
