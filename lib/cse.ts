import crypto from "crypto";
import { sql } from "./db";

export type ExamCategory =
  | "Civil Service Exam (CSE)"
  | "LET / PRC Board Exam"
  | "PhilNITS Certification"
  | "TESDA NC Assessment"
  | "Other Licensure / Certification";

export type ExamLevel = string;
export type PayoutPreference = "Barangay Hall Cash Pickup" | "GCash";
export type ReimbursementStatus =
  | "Pending Review"
  | "Approved for Payout"
  | "Reimbursed"
  | "Disapproved";
export type AttendanceStatus =
  | "Not Yet Taken"
  | "Attendance Submitted"
  | "Verified Attended"
  | "Did Not Attend";
export type ExamResultStatus =
  | "Awaiting Results"
  | "Passed"
  | "Did Not Pass";

export const PUROK_OPTIONS = [
  "Purok 1 (Sitio Bio, Sitio Sagur, Sitio Baybay)",
  "Purok 2 (Centro)",
  "Purok 3 (Sitio Boquig)",
  "Purok 4 (Sitio Buatan)",
  "Purok 5 (Sitio Sapdaan)",
  "Purok 6 (Sitio Cabanlig, Sitio Biek)",
  "Purok 7 (Sitio Torres)",
] as const;

export const PUROK_CARDS = [
  { value: PUROK_OPTIONS[0], shortLabel: "Purok 1", subLabel: "Bio, Sagur, Baybay" },
  { value: PUROK_OPTIONS[1], shortLabel: "Purok 2", subLabel: "Centro" },
  { value: PUROK_OPTIONS[2], shortLabel: "Purok 3", subLabel: "Sitio Boquig" },
  { value: PUROK_OPTIONS[3], shortLabel: "Purok 4", subLabel: "Sitio Buatan" },
  { value: PUROK_OPTIONS[4], shortLabel: "Purok 5", subLabel: "Sitio Sapdaan" },
  { value: PUROK_OPTIONS[5], shortLabel: "Purok 6", subLabel: "Cabanlig, Biek" },
  { value: PUROK_OPTIONS[6], shortLabel: "Purok 7", subLabel: "Sitio Torres" },
] as const;

export const DEFAULT_ANNUAL_SLOTS = 20;
export const DEFAULT_REIMBURSEMENT_AMOUNT = 500;
export const MAX_EXAM_SUBSIDY_CAP = 1000;
export const RETAKER_SLOT_RATIO = 0.2;
export const DEFAULT_ANNUAL_BUDGET = 20000;

export const STANDARD_CSE_BATCHES = [
  "March 2027 CSE-PPT",
  "August 2027 CSE-PPT",
  "March 2028 CSE-PPT",
  "August 2028 CSE-PPT",
  "CSC Computerized Examination (COMEX)",
] as const;

export const EXAM_CATEGORY_OPTIONS: ReadonlyArray<{
  id: ExamCategory;
  shortLabel: string;
  levelLabel: string;
  defaultLevel: string;
  levelOptions: ReadonlyArray<{
    value: string;
    label: string;
    hint: string;
  }>;
  batchOptions: ReadonlyArray<string>;
  defaultFee: number;
  isFixedFee: boolean;
  minAge: number;
  agencyHint: string;
}> = [
  {
    id: "Civil Service Exam (CSE)",
    shortLabel: "CSE (₱500)",
    levelLabel: "CSE Examination Level *",
    defaultLevel: "Professional",
    levelOptions: [
      { value: "Professional", label: "Professional", hint: "College grads & graduating" },
      { value: "SubProfessional", label: "SubProfessional", hint: "HS grads & undergrads" },
    ],
    batchOptions: [...STANDARD_CSE_BATCHES],
    defaultFee: 500,
    isFixedFee: true,
    minAge: 18,
    agencyHint: "CSC Official Receipt & NOA / ONSA",
  },
  {
    id: "LET / PRC Board Exam",
    shortLabel: "LET / PRC (₱900)",
    levelLabel: "LET / PRC Board Track *",
    defaultLevel: "LET (Secondary)",
    levelOptions: [
      { value: "LET (Elementary)", label: "LET Elem", hint: "BEEd / GenEd" },
      { value: "LET (Secondary)", label: "LET Sec", hint: "BSEd / Major" },
      { value: "PRC Licensure (Non-LET)", label: "Other PRC", hint: "Nurse / Crim / Eng" },
    ],
    batchOptions: [
      "March 2027 LEPT (LET)",
      "September 2027 LEPT (LET)",
      "May 2027 PRC Board",
      "November 2027 PRC Board",
      "March 2028 LEPT (LET)",
      "September 2028 LEPT (LET)",
    ],
    defaultFee: 900,
    isFixedFee: true,
    minAge: 18,
    agencyHint: "PRC LERIS e-OR & Notice of Admission",
  },
  {
    id: "PhilNITS Certification",
    shortLabel: "PhilNITS",
    levelLabel: "PhilNITS Certification Level *",
    defaultLevel: "IT Passport (IP)",
    levelOptions: [
      { value: "IT Passport (IP)", label: "IP Level", hint: "IT Passport" },
      { value: "Fundamental IT Engineer (FE)", label: "FE Level", hint: "Fundamental IT" },
      { value: "Applied IT Engineer (AP)", label: "AP Level", hint: "Applied IT" },
    ],
    batchOptions: [
      "April 2027 PhilNITS Exam",
      "October 2027 PhilNITS Exam",
      "April 2028 PhilNITS Exam",
      "October 2028 PhilNITS Exam",
    ],
    defaultFee: 1000,
    isFixedFee: false,
    minAge: 15,
    agencyHint: "PhilNITS Official Receipt & Admission Slip",
  },
  {
    id: "TESDA NC Assessment",
    shortLabel: "TESDA NC",
    levelLabel: "TESDA Certificate Level *",
    defaultLevel: "NC II",
    levelOptions: [
      { value: "NC I", label: "NC I", hint: "Level 1" },
      { value: "NC II", label: "NC II", hint: "Level 2" },
      { value: "NC III", label: "NC III", hint: "Level 3" },
      { value: "NC IV", label: "NC IV", hint: "Level 4" },
    ],
    batchOptions: [
      "Q1 2027 Assessment (Jan–Mar)",
      "Q2 2027 Assessment (Apr–Jun)",
      "Q3 2027 Assessment (Jul–Sep)",
      "Q4 2027 Assessment (Oct–Dec)",
      "Rolling / School-Based Batch",
    ],
    defaultFee: 1000,
    isFixedFee: false,
    minAge: 15,
    agencyHint: "TESDA Assessment Receipt & Admission Slip",
  },
  {
    id: "Other Licensure / Certification",
    shortLabel: "Other Exam",
    levelLabel: "Specific Exam / Qualification Title *",
    defaultLevel: "",
    levelOptions: [],
    batchOptions: [],
    defaultFee: 1000,
    isFixedFee: false,
    minAge: 15,
    agencyHint: "Official Receipt (OR/e-OR) & Exam Permit",
  },
];

/**
 * Resolves the authoritative exam fee and subsidy grant for an exam category.
 * Fixed-rate exams (CSE ₱500, LET/PRC ₱900) ignore client-supplied overrides.
 */
export function resolveExamFeeAndSubsidy(
  category: ExamCategory,
  rawFeeInput: number | string | null | undefined
): { examFeePaid: number; subsidyAmount: number; isFixedFee: boolean } {
  const config =
    EXAM_CATEGORY_OPTIONS.find((c) => c.id === category) || EXAM_CATEGORY_OPTIONS[0];
  if (config.isFixedFee) {
    return {
      examFeePaid: config.defaultFee,
      subsidyAmount: Math.min(config.defaultFee, MAX_EXAM_SUBSIDY_CAP),
      isFixedFee: true,
    };
  }
  const parsed = Number(rawFeeInput);
  const examFeePaid =
    Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) / 100 : 0;
  return {
    examFeePaid,
    subsidyAmount: Math.min(examFeePaid, MAX_EXAM_SUBSIDY_CAP),
    isFixedFee: false,
  };
}

export interface CseApplication {
  id: number;
  tracking_code: string;
  user_id?: number | null;
  user_email?: string | null;
  full_name: string;
  contact_number: string;
  email: string | null;
  facebook_name: string | null;
  purok: string;
  birthdate: string;
  age: number;
  school_or_employment: string | null;
  
  exam_category?: string | null;
  exam_level: ExamLevel;
  exam_date: string;
  exam_fee_paid?: number | null;
  is_first_time: boolean;
  prior_sitting_proof_url?: string | null;
  peer_review_attended?: boolean;
  
  // Payout details
  payout_preference: PayoutPreference;
  gcash_number: string | null;
  gcash_account_name: string | null;
  
  // Stage 1: Registration documents
  valid_id_url: string;
  csc_receipt_url: string;
  csc_receipt_no: string | null;
  exam_schedule_proof_url: string;
  
  // Stage 2: Reimbursement & Council Audit
  reimbursement_status: ReimbursementStatus;
  reimbursement_amount: number;
  disbursement_voucher_no: string | null;
  reimbursed_at: string | null;
  reimbursed_by: string | null;
  payout_station_or_method: string | null;
  admin_notes: string | null;
  
  // Stage 3: Exam Attendance
  attendance_status: AttendanceStatus;
  exam_attendance_proof_url: string | null;
  exam_attendance_notes: string | null;
  attendance_verified_at: string | null;
  
  // Stage 4: Exam Result & Hall of Fame
  exam_result_status: ExamResultStatus;
  rating: number | null;
  result_proof_url: string | null;
  passer_avatar_url?: string | null;
  is_featured_in_hall_of_fame: boolean;
  result_verified_at: string | null;
  
  created_at: string;
  updated_at: string;
}

export interface CsePublicPasser {
  id: number;
  full_name: string; // May be partially masked if preferred or shown with pride
  avatar_url?: string | null;
  purok: string;
  exam_category?: string | null;
  exam_level: ExamLevel;
  exam_date: string;
  rating: number | null;
  result_verified_at: string | null;
}

export interface CsePublicStats {
  quotaSlots: number;
  totalBudget: number;
  totalApplications: number;
  approvedOrReimbursedCount: number;
  reimbursedCount: number;
  totalReimbursedAmount: number;
  remainingSlots: number;
  remainingBudget: number;
  verifiedAttendedCount: number;
  totalPassers: number;
  retakerSlotCap?: number;
  retakerSlotsUsed?: number;
  purokBreakdown: Record<string, number>;
}

let tableEnsured = false;

export async function ensureCseTable(): Promise<void> {
  if (tableEnsured) return;

  await sql`
    CREATE TABLE IF NOT EXISTS cse_applications (
      id                          SERIAL PRIMARY KEY,
      tracking_code               TEXT UNIQUE NOT NULL,
      
      full_name                   TEXT NOT NULL,
      contact_number              TEXT NOT NULL,
      email                       TEXT,
      facebook_name               TEXT,
      purok                       TEXT NOT NULL,
      birthdate                   TEXT NOT NULL,
      age                         INTEGER NOT NULL,
      school_or_employment        TEXT,
      
      exam_level                  TEXT NOT NULL,
      exam_date                   TEXT NOT NULL,
      is_first_time               BOOLEAN DEFAULT TRUE,
      
      payout_preference           TEXT NOT NULL DEFAULT 'Barangay Hall Cash Pickup',
      gcash_number                TEXT,
      gcash_account_name          TEXT,
      
      valid_id_url                TEXT NOT NULL,
      csc_receipt_url             TEXT NOT NULL,
      csc_receipt_no              TEXT,
      exam_schedule_proof_url     TEXT NOT NULL,
      
      reimbursement_status        TEXT NOT NULL DEFAULT 'Pending Review',
      reimbursement_amount        NUMERIC NOT NULL DEFAULT 500,
      disbursement_voucher_no     TEXT,
      reimbursed_at               TIMESTAMPTZ,
      reimbursed_by               TEXT,
      payout_station_or_method    TEXT,
      admin_notes                 TEXT,
      
      attendance_status           TEXT NOT NULL DEFAULT 'Not Yet Taken',
      exam_attendance_proof_url   TEXT,
      exam_attendance_notes       TEXT,
      attendance_verified_at      TIMESTAMPTZ,
      
      exam_result_status          TEXT NOT NULL DEFAULT 'Awaiting Results',
      rating                      NUMERIC,
      result_proof_url            TEXT,
      is_featured_in_hall_of_fame BOOLEAN DEFAULT TRUE,
      result_verified_at          TIMESTAMPTZ,
      user_id                     INTEGER,
      user_email                  TEXT,
      
      created_at                  TIMESTAMPTZ DEFAULT NOW(),
      updated_at                  TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`ALTER TABLE cse_applications ADD COLUMN IF NOT EXISTS user_id INTEGER`;
  await sql`ALTER TABLE cse_applications ADD COLUMN IF NOT EXISTS user_email TEXT`;
  await sql`ALTER TABLE cse_applications ADD COLUMN IF NOT EXISTS prior_sitting_proof_url TEXT`;
  await sql`ALTER TABLE cse_applications ADD COLUMN IF NOT EXISTS peer_review_attended BOOLEAN DEFAULT FALSE`;
  await sql`ALTER TABLE cse_applications ADD COLUMN IF NOT EXISTS exam_category TEXT DEFAULT 'Civil Service Exam (CSE)'`;
  await sql`ALTER TABLE cse_applications ADD COLUMN IF NOT EXISTS exam_fee_paid NUMERIC DEFAULT 500`;
  await sql`ALTER TABLE cse_applications ADD COLUMN IF NOT EXISTS passer_avatar_url TEXT`;
  await sql`CREATE INDEX IF NOT EXISTS idx_cse_tracking ON cse_applications(tracking_code)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_cse_status ON cse_applications(reimbursement_status, exam_result_status)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_cse_purok ON cse_applications(purok)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_cse_user_id ON cse_applications(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_cse_user_email ON cse_applications(user_email)`;

  // Insert default settings if not exists
  await sql`
    INSERT INTO settings (key, value)
    VALUES 
      ('cse_program_active', 'true'),
      ('cse_slot_quota', '20'),
      ('cse_annual_budget', '20000'),
      ('cse_target_exam_batch', 'March 2027 CSE-PPT')
    ON CONFLICT (key) DO NOTHING
  `;

  tableEnsured = true;
}

export function generateCseTrackingCode(): string {
  const year = new Date().getFullYear();
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let rand = "";
  for (let i = 0; i < 8; i++) {
    rand += chars.charAt(crypto.randomInt(0, chars.length));
  }
  return `CSE-${year}-${rand}`;
}

export function maskName(fullName: string): string {
  if (!fullName) return "Resident";
  const parts = fullName.trim().split(/\s+/);
  return parts
    .map((part) => {
      if (part.length <= 2) return part.charAt(0) + "*";
      return part.charAt(0) + "*".repeat(part.length - 2) + part.slice(-1);
    })
    .join(" ");
}

export function getReimbursementBadge(
  status: ReimbursementStatus,
  amount?: number | null
): {
  label: string;
  badgeClass: string;
} {
  const formattedAmt =
    amount && Number(amount) > 0 ? `₱${Number(amount).toLocaleString()}` : "Subsidy";
  switch (status) {
    case "Reimbursed":
      return {
        label: `${formattedAmt} Released`,
        badgeClass:
          "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/80",
      };
    case "Approved for Payout":
      return {
        label: "Ready for Payout",
        badgeClass:
          "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800/80",
      };
    case "Disapproved":
      return {
        label: "Disapproved",
        badgeClass:
          "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/80",
      };
    case "Pending Review":
    default:
      return {
        label: "Pending Verification",
        badgeClass:
          "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/80",
      };
  }
}

export function getAttendanceBadge(status: AttendanceStatus): {
  label: string;
  badgeClass: string;
} {
  switch (status) {
    case "Verified Attended":
      return {
        label: "Attended Exam",
        badgeClass:
          "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/80",
      };
    case "Attendance Submitted":
      return {
        label: "Proof Submitted",
        badgeClass:
          "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800/80",
      };
    case "Did Not Attend":
      return {
        label: "Did Not Attend",
        badgeClass:
          "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/80",
      };
    case "Not Yet Taken":
    default:
      return {
        label: "Upcoming Exam",
        badgeClass:
          "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
      };
  }
}

export function getResultBadge(status: ExamResultStatus): {
  label: string;
  badgeClass: string;
} {
  switch (status) {
    case "Passed":
      return {
        label: "Passed Exam",
        badgeClass:
          "bg-amber-50 text-amber-900 border-amber-300 dark:bg-amber-950/70 dark:text-amber-200 dark:border-amber-700 font-bold",
      };
    case "Did Not Pass":
      return {
        label: "Completed Exam",
        badgeClass:
          "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
      };
    case "Awaiting Results":
    default:
      return {
        label: "Awaiting Results",
        badgeClass:
          "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800/80",
      };
  }
}

const MONTH_NAME_MAP: Array<{ pattern: RegExp; monthIndex: number; fullName: string }> = [
  { pattern: /^jan(?:uary)?$/i, monthIndex: 0, fullName: "January" },
  { pattern: /^feb(?:ruary)?$/i, monthIndex: 1, fullName: "February" },
  { pattern: /^mar(?:ch)?$/i, monthIndex: 2, fullName: "March" },
  { pattern: /^apr(?:il)?$/i, monthIndex: 3, fullName: "April" },
  { pattern: /^may$/i, monthIndex: 4, fullName: "May" },
  { pattern: /^jun(?:e)?$/i, monthIndex: 5, fullName: "June" },
  { pattern: /^jul(?:y)?$/i, monthIndex: 6, fullName: "July" },
  { pattern: /^aug(?:ust)?$/i, monthIndex: 7, fullName: "August" },
  { pattern: /^sep(?:t(?:ember)?)?$/i, monthIndex: 8, fullName: "September" },
  { pattern: /^oct(?:ober)?$/i, monthIndex: 9, fullName: "October" },
  { pattern: /^nov(?:ember)?$/i, monthIndex: 10, fullName: "November" },
  { pattern: /^dec(?:ember)?$/i, monthIndex: 11, fullName: "December" },
];

function getManilaTodayParts(now: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(now);
  const year = Number(parts.find((p) => p.type === "year")?.value || now.getUTCFullYear());
  const month = Number(parts.find((p) => p.type === "month")?.value || now.getUTCMonth() + 1) - 1;
  const day = Number(parts.find((p) => p.type === "day")?.value || now.getUTCDate());
  return { year, month, day };
}

/**
 * Checks whether an exam batch / schedule date is still in the future (Asia/Manila time).
 * Conservative: unparseable or rolling batches remain unlocked.
 */
export function getExamCycleGate(
  examDateStr: string | null | undefined,
  now: Date = new Date()
): { locked: boolean; opensLabel?: string; reason?: string } {
  const raw = String(examDateStr || "").trim();
  if (!raw || /\brolling\b/i.test(raw)) {
    return { locked: false };
  }

  let targetYear: number | null = null;
  let targetMonth: number | null = null; // 0-indexed
  let targetDay = 1;
  let opensLabel = raw;

  // 1. Quarter format: "Q1 2027 ..." -> Jan 1 / Apr 1 / Jul 1 / Oct 1
  const quarterMatch = raw.match(/\bQ([1-4])\s+(20\d{2})\b/i);
  if (quarterMatch) {
    const q = Number(quarterMatch[1]);
    targetYear = Number(quarterMatch[2]);
    targetMonth = (q - 1) * 3;
    targetDay = 1;
    const quarterMonths = ["January", "April", "July", "October"];
    opensLabel = `${quarterMonths[q - 1]} ${targetYear}`;
  }

  // 2. ISO date format: YYYY-MM-DD
  if (targetYear === null) {
    const isoMatch = raw.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
    if (isoMatch) {
      targetYear = Number(isoMatch[1]);
      targetMonth = Number(isoMatch[2]) - 1;
      targetDay = Number(isoMatch[3]);
      opensLabel = `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    }
  }

  // 3. Named month + optional day + year: "March 2027 CSE-PPT" or "March 21, 2027"
  if (targetYear === null) {
    const monthMatch = raw.match(
      /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(?:(\d{1,2}),?\s+)?(20\d{2})\b/i
    );
    if (monthMatch) {
      const mEntry = MONTH_NAME_MAP.find((m) => m.pattern.test(monthMatch[1]));
      if (mEntry) {
        targetYear = Number(monthMatch[3]);
        targetMonth = mEntry.monthIndex;
        targetDay = monthMatch[2] ? Math.max(1, Math.min(31, Number(monthMatch[2]))) : 1;
        opensLabel = monthMatch[2]
          ? `${mEntry.fullName} ${targetDay}, ${targetYear}`
          : `${mEntry.fullName} ${targetYear}`;
      }
    }
  }

  if (targetYear === null || targetMonth === null) {
    return { locked: false };
  }

  const today = getManilaTodayParts(now);
  const todaySerial = today.year * 10000 + today.month * 100 + today.day;
  const targetSerial = targetYear * 10000 + targetMonth * 100 + targetDay;

  if (todaySerial < targetSerial) {
    return {
      locked: true,
      opensLabel,
      reason: `Scheduled exam cycle (${raw}) opens in ${opensLabel}.`,
    };
  }

  return { locked: false };
}
