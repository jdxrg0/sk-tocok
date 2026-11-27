export const OFFICIAL_ROLES = [
  "SK Chairperson",
  "SK Secretary",
  "SK Treasurer",
  "SK Kagawad",
  "Health",
  "Livelihood",
  "Sports",
  "GAD",
  "Education",
  "Environment",
  "Peace & Order",
  "SK Staff / Custodian",
] as const;

export const ALLOWED_CATEGORY_COLORS = [
  "blue",
  "orange",
  "amber",
  "rose",
  "emerald",
  "purple",
  "cyan",
  "indigo",
  "slate",
  "teal",
] as const;

export const PRINT_STATUSES = [
  "Pending Review",
  "Printing In Progress",
  "Ready for Pickup",
  "Completed",
  "Declined",
  "Cancelled",
] as const;

export const PRINT_TYPES = ["Black & White", "Colored"] as const;
export const PAPER_SIZES = ["A4", "Letter (Short)", "Legal (Long)"] as const;

export const CSE_REIMBURSEMENT_STATUSES = [
  "Pending Review",
  "Approved for Payout",
  "Reimbursed",
  "Disapproved",
] as const;

export const CSE_ATTENDANCE_STATUSES = [
  "Not Yet Taken",
  "Attendance Submitted",
  "Verified Attended",
  "Did Not Attend",
] as const;

export const CSE_RESULT_STATUSES = [
  "Awaiting Results",
  "Passed",
  "Did Not Pass",
] as const;

export const MESSAGE_STATUSES = [
  "pending",
  "approved",
  "private_answered",
  "rejected",
  "archived",
] as const;

export const ALLOWED_SETTINGS_KEYS = new Set([
  "barangay_budget",
  "annual_budget",
  "funds_received",
  "bank_balance",
  "fiscal_year",
  "printing_active",
  "monthly_paper_budget",
  "estimated_pages_remaining",
  "printing_announcement",
  "hall_location",
  "contact_email",
  "contact_phone",
  "cse_program_active",
  "cse_slot_quota",
  "cse_annual_budget",
  "cse_target_exam_batch",
  "google_drive_limit_tb",
]);

export const PUBLIC_SETTINGS_KEYS = new Set([
  "barangay_budget",
  "annual_budget",
  "fiscal_year",
  "printing_active",
  "printing_announcement",
  "hall_location",
  "contact_email",
  "contact_phone",
  "cse_program_active",
  "cse_slot_quota",
  "cse_annual_budget",
  "cse_target_exam_batch",
]);

export function sanitizeText(value: unknown, maxLength = 500): string {
  if (typeof value !== "string") return "";
  return value.replace(/\0/g, "").trim().slice(0, maxLength);
}

export function isValidEmail(email: string): boolean {
  if (!email || email.length > 254) return false;
  return /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/.test(
    email
  );
}

export function validatePasswordStrength(password: string): string | null {
  if (!password || typeof password !== "string") {
    return "Password is required.";
  }
  if (password.length < 8) {
    return "Password must be at least 8 characters long.";
  }
  if (password.length > 128) {
    return "Password must be 128 characters or fewer.";
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(password)) {
    return "Password must include at least one letter and one number or symbol.";
  }
  return null;
}

export function isValidDateYMD(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d &&
    y >= 1900 &&
    y <= 2100
  );
}

export function parseMoney(
  raw: unknown,
  options?: { min?: number; max?: number }
): number | null {
  const num = typeof raw === "number" ? raw : parseFloat(String(raw ?? ""));
  if (!Number.isFinite(num)) return null;
  const rounded = Math.round(num * 100) / 100;
  const min = options?.min ?? 0.01;
  const max = options?.max ?? 100_000_000;
  if (rounded < min || rounded > max) return null;
  return rounded;
}

export function isValidPhoneNumber(phone: string): boolean {
  const digits = phone.replace(/[^\d]/g, "");
  return digits.length >= 7 && digits.length <= 15;
}

/**
 * Strictly parses a positive integer path/query ID (rejects trailing chars like "1.png").
 */
export function parsePositiveIntId(raw: unknown): number | null {
  if (typeof raw === "number") {
    return Number.isSafeInteger(raw) && raw > 0 ? raw : null;
  }
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const num = Number(trimmed);
  return Number.isSafeInteger(num) && num > 0 && num <= 2_147_483_647 ? num : null;
}

export const ALLOWED_THUMB_WIDTHS = [200, 400, 800, 1200] as const;

/**
 * Snaps an optional width parameter to discrete allowed tiers to prevent image-resize cache busting.
 */
export function snapThumbnailWidth(
  raw: string | null | undefined,
  tiers: readonly number[] = ALLOWED_THUMB_WIDTHS
): number {
  if (!raw) return 0;
  const parsed = Number(raw.trim());
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  for (const tier of tiers) {
    if (parsed <= tier) return tier;
  }
  return tiers[tiers.length - 1];
}
