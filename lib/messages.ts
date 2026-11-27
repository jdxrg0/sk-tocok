import crypto from "crypto";
import { sql } from "@/lib/db";

export const MESSAGE_CATEGORIES = [
  "Suggestion",
  "Concern / Grievance",
  "Community Project Idea",
  "Question / Inquiry",
  "Appreciation / Shoutout",
  "General",
] as const;

export type MessageCategory = (typeof MESSAGE_CATEGORIES)[number];

export const PUROK_OPTIONS = [
  "Purok 1",
  "Purok 2",
  "Purok 3",
  "Purok 4",
  "Purok 5",
  "Purok 6",
  "Purok 7",
  "Not Specified",
] as const;

export type MessageStatus =
  | "pending"
  | "approved"
  | "private_answered"
  | "rejected"
  | "archived";

export interface AnonymousMessageItem {
  id: number;
  tracking_code: string;
  alias: string;
  category: string;
  purok: string | null;
  subject: string;
  message: string;
  status: MessageStatus;
  is_public: boolean;
  is_pinned: boolean;
  admin_reply: string | null;
  replied_by: string | null;
  replied_at: string | null;
  likes_count: number;
  created_at: string;
  updated_at: string;
}

export interface AnonymousMessageReply {
  id: number;
  message_id: number;
  parent_id?: number | null;
  alias: string;
  reply: string;
  likes_count: number;
  created_at: string;
}

export interface PublicMessageItem {
  id: number;
  tracking_code: string;
  alias: string;
  category: string;
  purok: string | null;
  subject: string;
  message: string;
  is_pinned: boolean;
  admin_reply: string | null;
  replied_by: string | null;
  replied_at: string | null;
  likes_count: number;
  replies_count: number;
  created_at: string;
}

export interface TrackedMessageResult {
  tracking_code: string;
  alias: string;
  category: string;
  purok: string | null;
  subject: string;
  message: string;
  status: MessageStatus;
  is_public: boolean;
  admin_reply: string | null;
  replied_by: string | null;
  replied_at: string | null;
  created_at: string;
}

/**
 * Generate a friendly, cryptographically random tracking code: SKM-XXXXXXXX
 */
export function generateTrackingCode(): string {
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  let code = "SKM-";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(crypto.randomInt(0, chars.length));
  }
  return code;
}

const ALIAS_ADJECTIVES = [
  "Curious",
  "Hopeful",
  "Bright",
  "Kind",
  "Active",
  "Creative",
  "Mindful",
  "Helpful",
  "Friendly",
  "Dedicated",
  "Inspiring",
  "Thoughtful",
  "Passionate",
  "Silent",
  "Brave",
  "Cheerful",
  "Visionary",
  "Humble",
  "Motivated",
] as const;

const ALIAS_NOUNS = [
  "Tocokan",
  "Katipunero",
  "Youth",
  "Neighbor",
  "Student",
  "Dreamer",
  "Citizen",
  "Resident",
  "Advocate",
  "Observer",
  "Leader",
] as const;

/**
 * Generate a random, friendly anonymous alias: e.g. "Creative Tocokan #412"
 */
export function generateRandomAlias(): string {
  const adj =
    ALIAS_ADJECTIVES[crypto.randomInt(0, ALIAS_ADJECTIVES.length)];
  const noun = ALIAS_NOUNS[crypto.randomInt(0, ALIAS_NOUNS.length)];
  const num = crypto.randomInt(100, 1000);
  return `${adj} ${noun} #${num}`;
}

/**
 * Generate a deterministic avatar URL from an anonymous alias (Reddit-style avatar)
 */
export function getAvatarUrl(alias: string, size = 120): string {
  const seed = encodeURIComponent((alias || "anonymous").trim().toLowerCase());
  return `https://api.dicebear.com/9.x/bottts/svg?seed=${seed}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf,c7f9cc,ffeedb&size=${size}`;
}

export function getCategoryBadgeClass(category: string): string {
  const cat = (category || "").toLowerCase();
  if (cat.includes("suggestion")) {
    return "bg-blue-50/80 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300";
  }
  if (cat.includes("concern") || cat.includes("grievance")) {
    return "bg-rose-50/80 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300";
  }
  if (cat.includes("project") || cat.includes("idea")) {
    return "bg-emerald-50/80 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300";
  }
  if (cat.includes("question") || cat.includes("inquiry")) {
    return "bg-amber-50/80 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300";
  }
  if (cat.includes("appreciation") || cat.includes("shoutout")) {
    return "bg-purple-50/80 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300";
  }
  return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400";
}

export function getStatusBadge(status: MessageStatus, isPublic: boolean): {
  label: string;
  badgeClass: string;
} {
  switch (status) {
    case "approved":
      return {
        label: isPublic ? "Public on Board" : "Approved",
        badgeClass:
          "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/80",
      };
    case "private_answered":
      return {
        label: "Answered Privately",
        badgeClass:
          "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800/80",
      };
    case "rejected":
      return {
        label: "Hidden / Declined",
        badgeClass:
          "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/80",
      };
    case "archived":
      return {
        label: "Archived",
        badgeClass:
          "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
      };
    case "pending":
    default:
      return {
        label: "Pending Review",
        badgeClass:
          "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/80",
      };
  }
}

export function formatTimeAgo(dateString: string): string {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 45) return "just now";
    const minutes = Math.floor(diffInSeconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    const years = Math.floor(months / 12);
    return `${years}y ago`;
  } catch {
    return dateString;
  }
}

let messagesLikesTablesPromise: Promise<void> | null = null;

export function ensureMessagesTable(): Promise<void> {
  if (!messagesLikesTablesPromise) {
    messagesLikesTablesPromise = (async () => {
      try {
        await sql`
          CREATE TABLE IF NOT EXISTS anonymous_message_likes (
            message_id INTEGER NOT NULL REFERENCES anonymous_messages(id) ON DELETE CASCADE,
            device_id  VARCHAR(100) NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            PRIMARY KEY (message_id, device_id)
          )
        `;
        await sql`
          CREATE TABLE IF NOT EXISTS anonymous_reply_likes (
            reply_id   INTEGER NOT NULL REFERENCES anonymous_message_replies(id) ON DELETE CASCADE,
            device_id  VARCHAR(100) NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            PRIMARY KEY (reply_id, device_id)
          )
        `;
      } catch (err) {
        messagesLikesTablesPromise = null;
        console.error("Failed to ensure message like deduplication tables:", err);
      }
    })();
  }
  return messagesLikesTablesPromise;
}
