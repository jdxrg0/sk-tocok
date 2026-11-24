"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Phone, PhoneCall, Mail, Send, X, Copy, Check } from "lucide-react";

export interface OfficialSummary {
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

  return { label: r || "SK Kagawad", fullTitle: r || "SK Kagawad" };
}

function getOfficialRoleStyle(role: string) {
  const r = role.toLowerCase();
  if (r.includes("chair")) {
    return {
      circleRing: "ring-brand-500/30 dark:ring-brand-400/40",
      gradient: "from-brand-600 via-brand-700 to-brand-900 text-white",
      badge: "bg-brand-50 text-brand-700 border-brand-200 dark:bg-brand-950/60 dark:text-brand-300 dark:border-brand-800/80",
    };
  }
  if (r.includes("secretary")) {
    return {
      circleRing: "ring-indigo-500/30 dark:ring-indigo-400/40",
      gradient: "from-indigo-600 via-purple-600 to-indigo-800 text-white",
      badge: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800/80",
    };
  }
  if (r.includes("treasurer")) {
    return {
      circleRing: "ring-emerald-500/30 dark:ring-emerald-400/40",
      gradient: "from-emerald-600 via-teal-600 to-emerald-800 text-white",
      badge: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/80",
    };
  }
  if (r.includes("education")) {
    return {
      circleRing: "ring-blue-400/25 dark:ring-blue-400/35",
      gradient: "from-blue-600 via-sky-700 to-blue-900 text-white",
      badge: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800/80",
    };
  }
  if (r.includes("health")) {
    return {
      circleRing: "ring-rose-400/25 dark:ring-rose-400/35",
      gradient: "from-rose-600 via-pink-700 to-rose-900 text-white",
      badge: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/80",
    };
  }
  if (r.includes("sport")) {
    return {
      circleRing: "ring-amber-400/25 dark:ring-amber-400/35",
      gradient: "from-amber-600 via-orange-600 to-amber-800 text-white",
      badge: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/80",
    };
  }
  if (r.includes("livelihood")) {
    return {
      circleRing: "ring-teal-400/25 dark:ring-teal-400/35",
      gradient: "from-teal-600 via-emerald-700 to-teal-900 text-white",
      badge: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800/80",
    };
  }
  if (r.includes("gad")) {
    return {
      circleRing: "ring-purple-400/25 dark:ring-purple-400/35",
      gradient: "from-purple-600 via-fuchsia-700 to-purple-900 text-white",
      badge: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800/80",
    };
  }
  return {
    circleRing: "ring-slate-300 dark:ring-slate-700",
    gradient: "from-brand-700 via-slate-800 to-slate-900 text-white",
    badge: "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
  };
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
  const [selectedOfficial, setSelectedOfficial] = useState<OfficialSummary | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  const [copiedField, setCopiedField] = useState<"phone" | "email" | null>(null);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
  const mobileRow1 = councilors.length <= 4 ? councilors : councilors.slice(0, 4);
  const mobileRow2 = councilors.length <= 4 ? [] : councilors.slice(4);

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
          {chairperson && (
            <div className="flex flex-col items-center">
              <OfficialTreeNode
                official={chairperson}
                size="md"
                onSelect={openModal}
              />
              {(executiveOfficers.length > 0 || councilors.length > 0) && (
                <div className="w-px h-3.5 bg-slate-300 dark:bg-slate-700" />
              )}
            </div>
          )}

          {/* TIER 2: APPOINTED EXECUTIVE OFFICERS (SECRETARY & TREASURER) */}
          {executiveOfficers.length > 0 && (
            <div className="flex flex-col items-center w-full">
              <div className="relative flex justify-center items-start w-full">
                <div className="relative grid grid-cols-2 w-full max-w-[260px]">
                  <div className="absolute top-0 left-1/4 right-1/4 h-px bg-slate-300 dark:bg-slate-700" />
                  {executiveOfficers.map((officer) => (
                    <div key={officer.name} className="flex flex-col items-center">
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

              {councilors.length > 0 && (
                <div className="w-px h-3.5 bg-slate-300 dark:bg-slate-700" />
              )}
            </div>
          )}

          {/* TIER 3: SK KAGAWADS (SPLIT INTO BALANCED ROWS ON MOBILE) */}
          {councilors.length > 0 && (
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
                    <div key={official.name} className="flex flex-col items-center px-0.5">
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
                        <div key={official.name} className="flex flex-col items-center px-0.5">
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
          {chairperson && (
            <div className="flex flex-col items-center">
              <OfficialTreeNode
                official={chairperson}
                size="lg"
                onSelect={openModal}
              />
              {(executiveOfficers.length > 0 || councilors.length > 0) && (
                <div className="w-px h-5 sm:h-6 bg-slate-300 dark:bg-slate-700" />
              )}
            </div>
          )}

          {/* TIER 2: APPOINTED EXECUTIVE OFFICERS (SECRETARY & TREASURER) */}
          {executiveOfficers.length > 0 && (
            <div className="flex flex-col items-center w-full">
              <div className="relative flex justify-center items-start w-full">
                <div className="relative grid grid-cols-2 w-full max-w-[260px] sm:max-w-[300px]">
                  <div className="absolute top-0 left-1/4 right-1/4 h-px bg-slate-300 dark:bg-slate-700" />
                  {executiveOfficers.map((officer) => (
                    <div key={officer.name} className="flex flex-col items-center">
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

              {councilors.length > 0 && (
                <div className="w-px h-5 sm:h-6 bg-slate-300 dark:bg-slate-700" />
              )}
            </div>
          )}

          {/* TIER 3: SK KAGAWADS (7 MEMBERS) */}
          {councilors.length > 0 && (
            <div className="w-full">
              <div className="grid grid-cols-7 w-full">
                {councilors.map((official, idx) => (
                  <div key={official.name} className="relative flex flex-col items-center px-1 sm:px-1.5">
                    <div
                      className={`absolute top-0 h-px bg-slate-300 dark:bg-slate-700 ${
                        idx === 0
                          ? "left-1/2 right-0"
                          : idx === councilors.length - 1
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

              <div className="pt-0.5">
                <span
                  className={`inline-block text-xs font-bold px-3 py-1 rounded-full border ${selectedStyle.badge}`}
                >
                  {selectedCommittee.fullTitle}
                </span>
              </div>
            </div>

            {/* Ultra-Minimalist Contact Details */}
            {(selectedOfficial.contact_number || selectedOfficial.email) && (
              <div className="w-full pt-1 divide-y divide-slate-100 dark:divide-slate-800/80 text-xs sm:text-[13px]">
                {/* Mobile Number Row */}
                {selectedOfficial.contact_number && (
                  <div className="flex items-center justify-between py-2.5 gap-2">
                    <a
                      href={`tel:${selectedOfficial.contact_number}`}
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
                        href={`tel:${selectedOfficial.contact_number}`}
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
                      href={`mailto:${selectedOfficial.email}`}
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
                        href={`mailto:${selectedOfficial.email}`}
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

            {/* Got it, close Button */}
            <div className="pt-1">
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
    </section>
  );
}
