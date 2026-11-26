"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  FileText,
  GraduationCap,
  Megaphone,
  UserCheck,
} from "lucide-react";
import { useOverviewCardTransition } from "@/components/useOverviewCardTransition";

const SERVICES = [
  {
    href: "/printing",
    title: "Free Printing",
    description: "Free student document printing",
    icon: FileText,
    circleClass:
      "bg-brand-600 shadow-brand-600/20 ring-brand-100 dark:ring-brand-950/70",
    activeClass:
      "ring-2 ring-brand-500/40 border-brand-400/80 dark:border-brand-600/80 scale-[0.985]",
  },
  {
    href: "/attendance",
    title: "SK Attendance",
    description: "Session logs & roll call records",
    icon: UserCheck,
    circleClass:
      "bg-indigo-600 shadow-indigo-600/20 ring-indigo-100 dark:ring-indigo-950/70",
    activeClass:
      "ring-2 ring-indigo-500/40 border-indigo-400/80 dark:border-indigo-600/80 scale-[0.985]",
  },
  {
    href: "/messages",
    title: "Bumo-Boses",
    description: "Anonymous youth feedback & voice",
    icon: Megaphone,
    circleClass:
      "bg-emerald-600 shadow-emerald-600/20 ring-emerald-100 dark:ring-emerald-950/70",
    activeClass:
      "ring-2 ring-emerald-500/40 border-emerald-400/80 dark:border-emerald-600/80 scale-[0.985]",
  },
  {
    href: "/cse",
    title: "Exam Subsidy",
    description: "CSE, LET, PhilNITS & TESDA",
    icon: GraduationCap,
    circleClass:
      "bg-amber-500 shadow-amber-500/20 ring-amber-100 dark:ring-amber-950/70",
    activeClass:
      "ring-2 ring-amber-500/40 border-amber-400/80 dark:border-amber-600/80 scale-[0.985]",
  },
] as const;

/**
 * Quick-launch Youth Services & Programs dock with animated page transitions.
 */
export default function OverviewServicesDock() {
  const { containerRef, navigatingHref, handleCardClick } =
    useOverviewCardTransition();

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3 sm:p-4 shadow-xs">
      <div ref={containerRef} className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
        {SERVICES.map((service) => {
          const Icon = service.icon;
          const isActive = navigatingHref === service.href;
          return (
            <Link
              key={service.href}
              href={service.href}
              prefetch={true}
              onClick={(e) => handleCardClick(e, service.href)}
              className={`group relative flex flex-col justify-between p-3 sm:p-3.5 rounded-xl bg-slate-50/80 hover:bg-slate-100/90 dark:bg-slate-800/40 dark:hover:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 hover:border-slate-300 dark:hover:border-slate-600 transition-all duration-150 active:scale-[0.98] cursor-pointer touch-manipulation select-none ${
                isActive ? service.activeClass : ""
              }`}
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
  );
}
