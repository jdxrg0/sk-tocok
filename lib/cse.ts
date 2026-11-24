import { sql } from "./db";

export type ExamLevel = "Professional" | "SubProfessional";
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

export const DEFAULT_ANNUAL_SLOTS = 20;
export const DEFAULT_REIMBURSEMENT_AMOUNT = 500;
export const DEFAULT_ANNUAL_BUDGET = 10000;

export const STANDARD_CSE_BATCHES = [
  "March 2027 CSE-PPT",
  "August 2027 CSE-PPT",
  "March 2028 CSE-PPT",
  "August 2028 CSE-PPT",
  "CSC Computerized Examination (COMEX)",
] as const;

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
  
  exam_level: ExamLevel;
  exam_date: string;
  is_first_time: boolean;
  
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
  is_featured_in_hall_of_fame: boolean;
  result_verified_at: string | null;
  
  created_at: string;
  updated_at: string;
}

export interface CsePublicPasser {
  id: number;
  full_name: string; // May be partially masked if preferred or shown with pride
  purok: string;
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
      ('cse_annual_budget', '10000'),
      ('cse_target_exam_batch', 'March 2027 CSE-PPT')
    ON CONFLICT (key) DO NOTHING
  `;

  tableEnsured = true;
}

export function generateCseTrackingCode(): string {
  const year = new Date().getFullYear();
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let rand = "";
  for (let i = 0; i < 4; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
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

export function getReimbursementBadge(status: ReimbursementStatus): {
  label: string;
  badgeClass: string;
} {
  switch (status) {
    case "Reimbursed":
      return {
        label: "₱500 Reimbursed",
        badgeClass:
          "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/80",
      };
    case "Approved for Payout":
      return {
        label: "Ready for Reimbursement",
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
        label: "Passed Civil Service Exam! 🎉",
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
        label: "Awaiting CSC Results",
        badgeClass:
          "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800/80",
      };
  }
}
