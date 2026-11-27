"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Phone,
  PhoneCall,
  Mail,
  Send,
  X,
  Copy,
  Check,
  Plus,
  Pencil,
  Award,
  FileText,
  Landmark,
  Leaf,
  HeartPulse,
  GraduationCap,
  Trophy,
  Briefcase,
  Users,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { useAuth, isSuperAdminRole } from "@/components/AuthProvider";
import OfficialModal, { type OfficialModalData } from "@/components/OfficialModal";
import { useRouter } from "next/navigation";
import { sanitizeEmailHref, sanitizePhoneHref } from "@/lib/clientUrlSafety";

export interface OfficialSummary {
  id?: number;
  name: string;
  email?: string | null;
  role: string;
  contact_number: string | null;
  avatar_url: string | null;
}

interface CouncilTreeSectionProps {
  chairperson?: OfficialSummary;
  executiveOfficers: OfficialSummary[];
  councilors: OfficialSummary[];
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

function getOfficialCommitteeInfo(official: OfficialSummary): { label: string; fullTitle: string } {
  const r = (official.role || "").trim();
  const rLower = r.toLowerCase();
  const nameLower = (official.name || "").toLowerCase();

  if (rLower.includes("chair")) return { label: "SK Chairperson", fullTitle: "SK Chairperson" };
  if (rLower.includes("secretary")) return { label: "SK Secretary", fullTitle: "SK Secretary" };
  if (rLower.includes("treasurer")) return { label: "SK Treasurer", fullTitle: "SK Treasurer" };

  // Explicit committee mappings
  if (rLower.includes("health") || nameLower.includes("sandro") || nameLower.includes("quinto")) {
    return { label: "Health", fullTitle: "Committee on Health" };
  }
  if (rLower.includes("livelihood") || nameLower.includes("dannah") || nameLower.includes("aquino")) {
    return { label: "Livelihood", fullTitle: "Committee on Youth Employment & Livelihood" };
  }
  if (rLower.includes("sports") || nameLower.includes("renz") || nameLower.includes("ramos")) {
    return { label: "Sports", fullTitle: "Committee on Sports Development" };
  }
  if (rLower.includes("gad") || nameLower.includes("baby") || nameLower.includes("picar")) {
    return { label: "GAD", fullTitle: "Committee on Gender and Development (GAD)" };
  }
  if (rLower.includes("education") || nameLower.includes("dovie") || nameLower.includes("ellares")) {
    return { label: "Education", fullTitle: "Committee on Education & Culture" };
  }
  if (rLower.includes("environment") || nameLower.includes("angela") || nameLower.includes("serrana")) {
    return { label: "Environment", fullTitle: "Committee on Environmental Protection & Disaster Preparedness" };
  }
  if (rLower.includes("peace") || nameLower.includes("robbie") || nameLower.includes("barro")) {
    return { label: "Peace & Order", fullTitle: "Committee on Peace and Order & Anti-Drug Abuse" };
  }

  return { label: r || "SK Kagawad", fullTitle: r || "SK Kagawad" };
}

function getOfficialRoleStyle(role: string) {
  const r = role.toLowerCase();
  if (r.includes("chair")) {
    return {
      circleRing: "ring-brand-500/30 dark:ring-brand-400/40",
      gradient: "from-brand-600 via-brand-700 to-brand-900 text-white",
      badge: "bg-brand-50 text-brand-700 border-brand-200 dark:bg-brand-950/60 dark:text-brand-300 dark:border-brand-800/80",
      textColor: "text-brand-700 dark:text-brand-400",
    };
  }
  if (r.includes("secretary")) {
    return {
      circleRing: "ring-indigo-500/30 dark:ring-indigo-400/40",
      gradient: "from-indigo-600 via-purple-600 to-indigo-800 text-white",
      badge: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800/80",
      textColor: "text-indigo-700 dark:text-indigo-400",
    };
  }
  if (r.includes("treasurer")) {
    return {
      circleRing: "ring-slate-400/30 dark:ring-slate-400/40",
      gradient: "from-slate-600 via-slate-700 to-slate-900 text-white",
      badge: "bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700",
      textColor: "text-slate-800 dark:text-slate-200",
    };
  }
  if (r.includes("education")) {
    return {
      circleRing: "ring-blue-400/25 dark:ring-blue-400/35",
      gradient: "from-blue-600 via-sky-700 to-blue-900 text-white",
      badge: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800/80",
      textColor: "text-blue-700 dark:text-blue-400",
    };
  }
  if (r.includes("livelihood") || r.includes("employ")) {
    return {
      circleRing: "ring-orange-400/25 dark:ring-orange-400/35",
      gradient: "from-orange-600 via-amber-700 to-orange-900 text-white",
      badge: "bg-orange-50 text-orange-800 border-orange-200 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-800/80",
      textColor: "text-orange-800 dark:text-orange-400",
    };
  }
  if (r.includes("sport")) {
    return {
      circleRing: "ring-amber-400/25 dark:ring-amber-400/35",
      gradient: "from-amber-600 via-orange-600 to-amber-800 text-white",
      badge: "bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/80",
      textColor: "text-amber-900 dark:text-amber-400",
    };
  }
  if (r.includes("health")) {
    return {
      circleRing: "ring-rose-400/25 dark:ring-rose-400/35",
      gradient: "from-rose-600 via-pink-700 to-rose-900 text-white",
      badge: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/80",
      textColor: "text-rose-700 dark:text-rose-400",
    };
  }
  if (r.includes("environment") || r.includes("disaster")) {
    return {
      circleRing: "ring-emerald-400/25 dark:ring-emerald-400/35",
      gradient: "from-emerald-600 via-green-700 to-emerald-900 text-white",
      badge: "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/80",
      textColor: "text-emerald-800 dark:text-emerald-400",
    };
  }
  if (r.includes("gad") || r.includes("gender")) {
    return {
      circleRing: "ring-purple-400/25 dark:ring-purple-400/35",
      gradient: "from-purple-600 via-fuchsia-700 to-purple-900 text-white",
      badge: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800/80",
      textColor: "text-purple-700 dark:text-purple-400",
    };
  }
  if (r.includes("peace") || r.includes("order") || r.includes("drug")) {
    return {
      circleRing: "ring-cyan-400/25 dark:ring-cyan-400/35",
      gradient: "from-cyan-600 via-sky-700 to-cyan-900 text-white",
      badge: "bg-cyan-50 text-cyan-800 border-cyan-200 dark:bg-cyan-950/60 dark:text-cyan-300 dark:border-cyan-800/80",
      textColor: "text-cyan-800 dark:text-cyan-400",
    };
  }
  return {
    circleRing: "ring-slate-300 dark:ring-slate-700",
    gradient: "from-brand-700 via-slate-800 to-slate-900 text-white",
    badge: "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
    textColor: "text-slate-700 dark:text-slate-300",
  };
}

function getCommitteeIcon(label: string) {
  const l = label.toLowerCase();
  if (l.includes("chair")) return Award;
  if (l.includes("sec")) return FileText;
  if (l.includes("treas")) return Landmark;
  if (l.includes("environ") || l.includes("disaster")) return Leaf;
  if (l.includes("health")) return HeartPulse;
  if (l.includes("edu")) return GraduationCap;
  if (l.includes("sport")) return Trophy;
  if (l.includes("livelihood") || l.includes("employ")) return Briefcase;
  if (l.includes("gad") || l.includes("gender")) return Users;
  if (l.includes("peace") || l.includes("order") || l.includes("drug")) return ShieldCheck;
  return UserCheck;
}

function categorizeOfficials(officials: OfficialSummary[]) {
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
      const isBabyA = a.name.toLowerCase().includes("baby") || a.name.toLowerCase().includes("picar");
      const isBabyB = b.name.toLowerCase().includes("baby") || b.name.toLowerCase().includes("picar");
      if (isBabyA && !isBabyB) return 1;
      if (!isBabyA && isBabyB) return -1;
      return 0;
    });
  return { chairperson, executiveOfficers, councilors };
}

// Tapable Cardless Tree Node
function OfficialTreeNode({
  official,
  size = "sm",
  onSelect,
}: {
  official: OfficialSummary;
  size?: "lg" | "md" | "sm" | "xs";
  onSelect: (official: OfficialSummary) => void;
}) {
  const initials = getOfficialInitials(official.name);
  const committeeInfo = getOfficialCommitteeInfo(official);
  const style = getOfficialRoleStyle(committeeInfo.label);
  const nameObj = parseOfficialName(official.name);

  const isLg = size === "lg";
  const isMd = size === "md";
  const isXs = size === "xs";

  const avatarClass = isLg
    ? "w-16 h-16 sm:w-20 sm:h-20"
    : isMd
    ? "w-14 h-14 sm:w-16 sm:h-16"
    : isXs
    ? "w-10 h-10"
    : "w-12 h-12 sm:w-14 sm:h-14";
  const avatarDimension = isLg ? 80 : isMd ? 64 : isXs ? 40 : 56;

  return (
    <button
      type="button"
      onClick={() => onSelect(official)}
      className="flex flex-col items-center text-center w-full px-0.5 cursor-pointer focus:outline-none rounded-2xl p-0.5 sm:p-1 touch-manipulation min-w-0"
      title={`Tap to view official details for ${official.name}`}
      aria-label={`View details for ${official.name}`}
    >
      {/* Profile Picture Circle (Completely static, no hover animation) */}
      <div className="relative flex items-center justify-center">
        <div
          className={`${avatarClass} aspect-square shrink-0 rounded-full p-0.5 ring-2 sm:ring-[2.5px] ${style.circleRing} shadow-2xs bg-white dark:bg-slate-900 flex items-center justify-center overflow-hidden`}
        >
          {official.avatar_url ? (
            <picture className="w-full h-full block">
              <source
                srcSet={official.avatar_url.replace(/\.(jpg|jpeg|png)$/i, ".webp")}
                type="image/webp"
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={official.avatar_url}
                alt={official.name}
                width={avatarDimension}
                height={avatarDimension}
                loading="lazy"
                decoding="async"
                className="w-full h-full aspect-square shrink-0 rounded-full object-cover"
              />
            </picture>
          ) : (
            <div
              className={`w-full h-full aspect-square shrink-0 rounded-full bg-gradient-to-br ${style.gradient} flex items-center justify-center shadow-inner`}
            >
              <span
                className={`font-black tracking-tight select-none ${
                  isLg
                    ? "text-base sm:text-lg"
                    : isMd
                    ? "text-sm sm:text-base"
                    : isXs
                    ? "text-[10px]"
                    : "text-xs sm:text-sm"
                }`}
              >
                {initials}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Name Details Under Profile Picture */}
      <div className="mt-1 flex flex-col items-center w-full min-w-0">
        <span
          className={`block font-black text-slate-900 dark:text-slate-100 tracking-wider uppercase leading-tight truncate w-full ${
            isLg
              ? "text-xs sm:text-sm"
              : isXs
              ? "text-[9.5px]"
              : "text-[10px] sm:text-[11.5px]"
          }`}
        >
          {nameObj.lastName}
        </span>
        <span
          className={`block font-semibold text-slate-500 dark:text-slate-400 tracking-wide uppercase leading-tight truncate w-full mt-0.5 ${
            isXs ? "text-[7.5px]" : "text-[8.5px] sm:text-[9.5px]"
          }`}
        >
          {nameObj.prefix ? `${nameObj.prefix} ` : ""}{nameObj.firstName}
        </span>
      </div>

      {/* Committee / Role Badge */}
      <div className="mt-1 w-full flex justify-center min-w-0">
        <span
          className={`inline-block font-semibold rounded-full border truncate max-w-full ${style.badge} ${
            isXs
              ? "text-[7.5px] px-1.5 py-0.5"
              : "text-[8.5px] sm:text-[9.5px] px-2 py-0.5"
          }`}
        >
          {committeeInfo.label}
        </span>
      </div>
    </button>
  );
}

export default function CouncilTreeSection({
  chairperson,
  executiveOfficers,
  councilors,
}: CouncilTreeSectionProps) {
  const { user } = useAuth();
  const canManage = Boolean(user && isSuperAdminRole(user.role));
  const router = useRouter();

  // Local state for instant reflection of edits/adds/deletions
  const [chairpersonState, setChairpersonState] = useState<OfficialSummary | undefined>(chairperson);
  const [execState, setExecState] = useState<OfficialSummary[]>(executiveOfficers);
  const [councilorsState, setCouncilorsState] = useState<OfficialSummary[]>(councilors);

  useEffect(() => {
    setChairpersonState(chairperson);
  }, [chairperson]);

  useEffect(() => {
    setExecState(executiveOfficers);
  }, [executiveOfficers]);

  useEffect(() => {
    setCouncilorsState(councilors);
  }, [councilors]);

  // Modal states
  const [selectedOfficial, setSelectedOfficial] = useState<OfficialSummary | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  const [copiedField, setCopiedField] = useState<"phone" | "email" | null>(null);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Official management modal
  const [officialModalOpen, setOfficialModalOpen] = useState(false);
  const [editingOfficial, setEditingOfficial] = useState<OfficialModalData | null>(null);

  const handleOpenEdit = (official: OfficialSummary) => {
    setEditingOfficial({
      id: official.id,
      name: official.name,
      email: official.email,
      role: official.role,
      contact_number: official.contact_number,
      avatar_url: official.avatar_url,
    });
    setOfficialModalOpen(true);
  };

  const handleOpenAdd = () => {
    setEditingOfficial(null);
    setOfficialModalOpen(true);
  };

  const refreshOfficials = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/users");
      if (res.ok) {
        const data = await res.json();
        if (data.users && Array.isArray(data.users)) {
          const { chairperson: newChair, executiveOfficers: newExec, councilors: newCounc } = categorizeOfficials(data.users);
          setChairpersonState(newChair);
          setExecState(newExec);
          setCouncilorsState(newCounc);
        }
      }
    } catch (err) {
      console.error("Failed to refresh officials:", err);
    }
    router.refresh();
  }, [router]);

  // Close modal with smooth exit animation
  const closeModal = useCallback(() => {
    if (isAnimatingOut || !selectedOfficial) return;
    setIsAnimatingOut(true);
    setIsOpen(false);
    closeTimeoutRef.current = setTimeout(() => {
      setSelectedOfficial(null);
      setIsAnimatingOut(false);
      setCopiedField(null);
    }, 200);
  }, [isAnimatingOut, selectedOfficial]);

  // Open modal with smooth entry animation
  const openModal = (official: OfficialSummary) => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
    }
    setSelectedOfficial(official);
    setIsAnimatingOut(false);
    setIsOpen(false);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setIsOpen(true);
      });
    });
  };

  // Close modal on Escape key
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") {
      closeModal();
    }
  }, [closeModal]);

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (selectedOfficial) {
      window.addEventListener("keydown", handleKeyDown);
      const originalBodyOverflow = document.body.style.overflow;
      const originalHtmlOverflow = document.documentElement.style.overflow;

      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";

      const handleScrollPrevent = (e: TouchEvent | WheelEvent) => {
        const target = e.target as HTMLElement | null;
        if (!target || !target.closest(".allow-modal-scroll")) {
          e.preventDefault();
        }
      };

      window.addEventListener("touchmove", handleScrollPrevent, { passive: false });
      window.addEventListener("wheel", handleScrollPrevent, { passive: false });

      return () => {
        window.removeEventListener("keydown", handleKeyDown);
        document.body.style.overflow = originalBodyOverflow;
        document.documentElement.style.overflow = originalHtmlOverflow;
        window.removeEventListener("touchmove", handleScrollPrevent);
        window.removeEventListener("wheel", handleScrollPrevent);
      };
    } else {
      setCopiedField(null);
    }
  }, [selectedOfficial, handleKeyDown]);

  const handleCopy = (text: string, field: "phone" | "email") => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => {});
    } else {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand("copy");
      } catch {
        // fallback failed
      }
      document.body.removeChild(textArea);
    }
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const selectedInitials = selectedOfficial ? getOfficialInitials(selectedOfficial.name) : "";
  const selectedCommittee = selectedOfficial ? getOfficialCommitteeInfo(selectedOfficial) : null;
  const selectedStyle = selectedCommittee ? getOfficialRoleStyle(selectedCommittee.label) : null;
  const selectedName = selectedOfficial ? parseOfficialName(selectedOfficial.name) : null;

  // Split councilors into balanced rows for mobile view (e.g. 4 on row 1, 3 on row 2)
  const mobileRow1 = councilorsState.length <= 4 ? councilorsState : councilorsState.slice(0, 4);
  const mobileRow2 = councilorsState.length <= 4 ? [] : councilorsState.slice(4);

  return (
    <section id="officials" className="space-y-3">
      {/* Section Header */}
      <div className="flex items-center justify-between pb-0.5">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            SK Council
          </h2>
        </div>
        <span className="text-[10px] sm:text-[10.5px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
          Term 2023–2028
        </span>
      </div>

      {/* Responsive Organizational Tree View */}
      <div className="w-full pt-1 pb-3 sm:pb-4">
        {/* MOBILE VIEW (< 640px): 100% width, no horizontal scroll, balanced 1 -> 2 -> 4+3 pyramid */}
        <div className="flex sm:hidden flex-col items-center w-full">
          {/* TIER 1: SK CHAIRPERSON */}
          {chairpersonState && (
            <div className="flex flex-col items-center">
              <OfficialTreeNode
                official={chairpersonState}
                size="md"
                onSelect={openModal}
              />
              {(execState.length > 0 || councilorsState.length > 0) && (
                <div className="w-px h-3.5 bg-slate-300 dark:bg-slate-700" />
              )}
            </div>
          )}

          {/* TIER 2: APPOINTED EXECUTIVE OFFICERS (SECRETARY & TREASURER) */}
          {execState.length > 0 && (
            <div className="flex flex-col items-center w-full">
              <div className="relative flex justify-center items-start w-full">
                <div className="relative grid grid-cols-2 w-full max-w-[260px]">
                  <div className="absolute top-0 left-1/4 right-1/4 h-px bg-slate-300 dark:bg-slate-700" />
                  {execState.map((officer) => (
                    <div key={officer.id || officer.name} className="flex flex-col items-center">
                      <div className="w-px h-2.5 bg-slate-300 dark:bg-slate-700" />
                      <OfficialTreeNode
                        official={officer}
                        size="sm"
                        onSelect={openModal}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {councilorsState.length > 0 && (
                <div className="w-px h-3.5 bg-slate-300 dark:bg-slate-700" />
              )}
            </div>
          )}

          {/* TIER 3: SK KAGAWADS (SPLIT INTO BALANCED ROWS ON MOBILE) */}
          {councilorsState.length > 0 && (
            <div className="flex flex-col items-center w-full">
              {/* Row 1 (up to 4 Kagawads) */}
              <div className="relative w-full">
                {mobileRow1.length > 1 && (
                  <div
                    className="absolute top-0 h-px bg-slate-300 dark:bg-slate-700"
                    style={{
                      left: `${100 / (mobileRow1.length * 2)}%`,
                      right: `${100 / (mobileRow1.length * 2)}%`,
                    }}
                  />
                )}
                <div
                  className="grid w-full"
                  style={{ gridTemplateColumns: `repeat(${mobileRow1.length}, minmax(0, 1fr))` }}
                >
                  {mobileRow1.map((official) => (
                    <div key={official.id || official.name} className="flex flex-col items-center px-0.5">
                      <div className="w-px h-2.5 bg-slate-300 dark:bg-slate-700" />
                      <OfficialTreeNode
                        official={official}
                        size="xs"
                        onSelect={openModal}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Vertical connector stem to Row 2 */}
              {mobileRow2.length > 0 && (
                <>
                  <div className="w-px h-3.5 bg-slate-300 dark:bg-slate-700 my-0.5" />
                  {/* Row 2 (remaining Kagawads) */}
                  <div className="relative w-full max-w-[270px]">
                    {mobileRow2.length > 1 && (
                      <div
                        className="absolute top-0 h-px bg-slate-300 dark:bg-slate-700"
                        style={{
                          left: `${100 / (mobileRow2.length * 2)}%`,
                          right: `${100 / (mobileRow2.length * 2)}%`,
                        }}
                      />
                    )}
                    <div
                      className="grid w-full"
                      style={{ gridTemplateColumns: `repeat(${mobileRow2.length}, minmax(0, 1fr))` }}
                    >
                      {mobileRow2.map((official) => (
                        <div key={official.id || official.name} className="flex flex-col items-center px-0.5">
                          <div className="w-px h-2.5 bg-slate-300 dark:bg-slate-700" />
                          <OfficialTreeNode
                            official={official}
                            size="xs"
                            onSelect={openModal}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* TABLET & DESKTOP VIEW (>= 640px): wide single unbroken 1 -> 2 -> 7 tree */}
        <div className="hidden sm:flex flex-col items-center w-full">
          {/* TIER 1: SK CHAIRPERSON */}
          {chairpersonState && (
            <div className="flex flex-col items-center">
              <OfficialTreeNode
                official={chairpersonState}
                size="lg"
                onSelect={openModal}
              />
              {(execState.length > 0 || councilorsState.length > 0) && (
                <div className="w-px h-5 sm:h-6 bg-slate-300 dark:bg-slate-700" />
              )}
            </div>
          )}

          {/* TIER 2: APPOINTED EXECUTIVE OFFICERS (SECRETARY & TREASURER) */}
          {execState.length > 0 && (
            <div className="flex flex-col items-center w-full">
              <div className="relative flex justify-center items-start w-full">
                <div className="relative grid grid-cols-2 w-full max-w-[260px] sm:max-w-[300px]">
                  <div className="absolute top-0 left-1/4 right-1/4 h-px bg-slate-300 dark:bg-slate-700" />
                  {execState.map((officer) => (
                    <div key={officer.id || officer.name} className="flex flex-col items-center">
                      <div className="w-px h-3.5 sm:h-4 bg-slate-300 dark:bg-slate-700" />
                      <OfficialTreeNode
                        official={officer}
                        size="md"
                        onSelect={openModal}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {councilorsState.length > 0 && (
                <div className="w-px h-5 sm:h-6 bg-slate-300 dark:bg-slate-700" />
              )}
            </div>
          )}

          {/* TIER 3: SK KAGAWADS */}
          {councilorsState.length > 0 && (
            <div className="w-full">
              <div
                className="grid w-full"
                style={{ gridTemplateColumns: `repeat(${councilorsState.length}, minmax(0, 1fr))` }}
              >
                {councilorsState.map((official, idx) => (
                  <div key={official.id || official.name} className="relative flex flex-col items-center px-1 sm:px-1.5">
                    <div
                      className={`absolute top-0 h-px bg-slate-300 dark:bg-slate-700 ${
                        idx === 0
                          ? "left-1/2 right-0"
                          : idx === councilorsState.length - 1
                          ? "left-0 right-1/2"
                          : "left-0 right-0"
                      }`}
                    />
                    <div className="w-px h-3.5 sm:h-4 bg-slate-300 dark:bg-slate-700" />
                    <OfficialTreeNode
                      official={official}
                      size="sm"
                      onSelect={openModal}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* POPUP MODAL FOR OFFICIAL INFORMATION (ANIMATED ENTRY & EXIT) */}
      {selectedOfficial && selectedCommittee && selectedStyle && selectedName && (
        <div
          className={`fixed inset-0 z-[120] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 touch-none overscroll-contain select-none transition-opacity duration-200 ${
            isOpen ? "opacity-100 ease-out" : "opacity-0 ease-in pointer-events-none"
          }`}
          onClick={closeModal}
          role="dialog"
          aria-modal="true"
          style={{
            paddingTop: "max(1rem, env(safe-area-inset-top, 0px))",
            paddingBottom: "max(1rem, env(safe-area-inset-bottom, 0px))",
            paddingLeft: "max(1rem, env(safe-area-inset-left, 0px))",
            paddingRight: "max(1rem, env(safe-area-inset-right, 0px))",
          }}
        >
          <div
            className={`bg-white dark:bg-slate-900 rounded-3xl max-w-sm w-full p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-2xl relative space-y-4 touch-auto transition-all duration-200 ${
              isOpen
                ? "opacity-100 scale-100 translate-y-0 ease-out"
                : "opacity-0 scale-95 translate-y-3 ease-in pointer-events-none"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Close Button */}
            <button
              type="button"
              onClick={closeModal}
              className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer z-10"
              aria-label="Close official popup"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Profile Avatar and Name */}
            <div className="flex flex-col items-center text-center space-y-2 pt-1">
              <div
                className={`w-20 h-20 sm:w-24 sm:h-24 aspect-square rounded-full p-1 ring-4 ${selectedStyle.circleRing} shadow-md bg-white dark:bg-slate-900 flex items-center justify-center overflow-hidden`}
              >
                {selectedOfficial.avatar_url ? (
                  <picture className="w-full h-full block">
                    <source
                      srcSet={selectedOfficial.avatar_url.replace(/\.(jpg|jpeg|png)$/i, ".webp")}
                      type="image/webp"
                    />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={selectedOfficial.avatar_url}
                      alt={selectedOfficial.name}
                      width={96}
                      height={96}
                      className="w-full h-full aspect-square rounded-full object-cover"
                    />
                  </picture>
                ) : (
                  <div
                    className={`w-full h-full aspect-square rounded-full bg-gradient-to-br ${selectedStyle.gradient} flex items-center justify-center shadow-inner`}
                  >
                    <span className="text-xl sm:text-2xl font-black tracking-tight text-white select-none">
                      {selectedInitials}
                    </span>
                  </div>
                )}
              </div>

              <div className="pt-1">
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 tracking-wider uppercase leading-tight">
                  {selectedName.lastName}
                </h3>
                <p className="text-xs sm:text-[13px] font-semibold text-slate-500 dark:text-slate-400 uppercase mt-0.5">
                  {selectedName.prefix ? `${selectedName.prefix} ` : ""}{selectedName.firstName}
                </p>
              </div>

              {/* Official Designation - Pure Minimalist Typography (No Pills / No Borders) */}
              <div className="pt-0.5 text-center max-w-[280px] mx-auto space-y-0.5">
                {(() => {
                  const roleLower = (selectedOfficial.role || "").toLowerCase();
                  const committeeLower = selectedCommittee.label.toLowerCase();
                  const isExecutive =
                    committeeLower.includes("chair") ||
                    committeeLower.includes("secretary") ||
                    committeeLower.includes("treasurer") ||
                    roleLower.includes("chair") ||
                    roleLower.includes("secretary") ||
                    roleLower.includes("treasurer");

                  if (isExecutive) {
                    return (
                      <p className={`text-xs font-black uppercase tracking-wider ${selectedStyle.textColor}`}>
                        {selectedCommittee.fullTitle}
                      </p>
                    );
                  }

                  return (
                    <>
                      <p className={`text-xs font-black uppercase tracking-wider ${selectedStyle.textColor}`}>
                        SK Kagawad
                      </p>
                      {selectedCommittee.fullTitle && (
                        <p className="text-[11.5px] sm:text-xs font-medium text-slate-500 dark:text-slate-400 leading-snug">
                          {selectedCommittee.fullTitle}
                        </p>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Ultra-Minimalist Contact Details */}
            {(selectedOfficial.contact_number || selectedOfficial.email) && (
              <div className="w-full pt-1 divide-y divide-slate-100 dark:divide-slate-800/80 text-xs sm:text-[13px]">
                {/* Mobile Number Row */}
                {selectedOfficial.contact_number && (
                  <div className="flex items-center justify-between py-2.5 gap-2">
                    <a
                      href={sanitizePhoneHref(selectedOfficial.contact_number)}
                      className="flex items-center gap-2.5 font-mono text-slate-700 dark:text-slate-300 hover:text-brand-600 dark:hover:text-brand-400 transition-colors min-w-0 truncate"
                    >
                      <Phone className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                      <span className="truncate">{selectedOfficial.contact_number}</span>
                    </a>

                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleCopy(selectedOfficial.contact_number || "", "phone")}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        title={copiedField === "phone" ? "Copied to clipboard" : "Copy mobile number"}
                        aria-label="Copy mobile number"
                      >
                        {copiedField === "phone" ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>

                      <a
                        href={sanitizePhoneHref(selectedOfficial.contact_number)}
                        className="p-1.5 rounded-lg text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 transition-colors cursor-pointer"
                        title="Call mobile number"
                        aria-label="Call mobile number"
                      >
                        <PhoneCall className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                )}

                {/* Official Email Row */}
                {selectedOfficial.email && (
                  <div className="flex items-center justify-between py-2.5 gap-2">
                    <a
                      href={sanitizeEmailHref(selectedOfficial.email)}
                      className="flex items-center gap-2.5 text-slate-600 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors truncate min-w-0"
                    >
                      <Mail className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                      <span className="truncate">{selectedOfficial.email}</span>
                    </a>

                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleCopy(selectedOfficial.email || "", "email")}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        title={copiedField === "email" ? "Copied to clipboard" : "Copy email address"}
                        aria-label="Copy email address"
                      >
                        {copiedField === "email" ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>

                      <a
                        href={sanitizeEmailHref(selectedOfficial.email)}
                        className="p-1.5 rounded-lg text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 hover:bg-brand-50 dark:hover:bg-brand-950/60 transition-colors cursor-pointer"
                        title="Send email"
                        aria-label="Send email"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="pt-1 space-y-2">
              {canManage && (
                <button
                  type="button"
                  onClick={() => {
                    const off = selectedOfficial;
                    closeModal();
                    handleOpenEdit(off);
                  }}
                  className="w-full py-2.5 px-4 rounded-2xl text-xs sm:text-[13px] font-bold text-brand-700 dark:text-brand-300 bg-brand-50 hover:bg-brand-100 dark:bg-brand-950/60 dark:hover:bg-brand-900/60 border border-brand-200 dark:border-brand-800 transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Edit Official Profile & Access
                </button>
              )}

              <button
                type="button"
                onClick={closeModal}
                className="w-full py-2.5 px-4 rounded-2xl text-xs sm:text-[13px] font-bold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors cursor-pointer active:scale-[0.99] select-none"
              >
                Got it, close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Action Button (FAB) for adding official when authenticated */}
      {canManage && (
        <div data-page-fab className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] md:bottom-8 right-4 md:right-8 z-40 flex items-center gap-2.5 sm:gap-3 pointer-events-auto">
          <button
            type="button"
            onClick={handleOpenAdd}
            title="Add SK Official"
            aria-label="Add SK Official"
            className="w-12 h-12 sm:w-13 sm:h-13 rounded-full bg-brand-600 hover:bg-brand-700 hover:scale-105 active:scale-90 active:brightness-95 text-white flex items-center justify-center shadow-lg shadow-brand-900/25 hover:shadow-xl hover:shadow-brand-900/35 border border-white/20 dark:border-brand-400/20 transition-all duration-150 cursor-pointer group select-none"
          >
            <Plus className="w-6 h-6 stroke-[2.5] transition-transform duration-200 group-hover:rotate-90" />
            <span className="hidden md:group-hover:block absolute bottom-full mb-2.5 right-0 px-2.5 py-1 rounded-lg bg-slate-900 dark:bg-slate-800 dark:border dark:border-slate-700 text-white text-xs font-semibold whitespace-nowrap shadow-md pointer-events-none animate-in fade-in zoom-in-95 duration-150">
              Add SK Official
            </span>
          </button>
        </div>
      )}

      {/* Official Add/Edit Modal */}
      <OfficialModal
        isOpen={officialModalOpen}
        onClose={() => setOfficialModalOpen(false)}
        onSuccess={refreshOfficials}
        editingOfficial={editingOfficial}
      />
    </section>
  );
}
