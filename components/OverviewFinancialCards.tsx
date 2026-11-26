"use client";

import Link from "next/link";
import { useOverviewCardTransition } from "@/components/useOverviewCardTransition";

interface FinancialCard {
  href: string;
  label: string;
  value: number;
  colSpanClass: string;
  valueClass: string;
  activeClass: string;
}

interface OverviewFinancialCardsProps {
  currentBankBalance: number;
  fundsReceived: number;
  totalSpent: number;
}

/**
 * Interactive Financial Overview cards with animated transition to the Transparency page.
 */
export default function OverviewFinancialCards({
  currentBankBalance,
  fundsReceived,
  totalSpent,
}: OverviewFinancialCardsProps) {
  const { containerRef, navigatingHref, handleCardClick } =
    useOverviewCardTransition();

  const cards: FinancialCard[] = [
    {
      href: "/transparency?tab=analytics",
      label: "Current Cash in Bank",
      value: currentBankBalance,
      colSpanClass: "col-span-2 lg:col-span-1",
      valueClass:
        "text-2xl sm:text-3xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 tabular-nums leading-none",
      activeClass:
        "ring-2 ring-emerald-500/40 border-emerald-400/80 dark:border-emerald-600/80 scale-[0.985]",
    },
    {
      href: "/transparency?tab=ledgers&ledger=deposits",
      label: "Funds Deposited",
      value: fundsReceived,
      colSpanClass: "col-span-1 lg:col-span-1",
      valueClass:
        "text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 tabular-nums leading-none",
      activeClass:
        "ring-2 ring-brand-500/40 border-brand-400/80 dark:border-brand-600/80 scale-[0.985]",
    },
    {
      href: "/transparency?tab=ledgers&ledger=expenses",
      label: "Total Disbursed",
      value: totalSpent,
      colSpanClass: "col-span-1 lg:col-span-1",
      valueClass:
        "text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 tabular-nums leading-none",
      activeClass:
        "ring-2 ring-brand-500/40 border-brand-400/80 dark:border-brand-600/80 scale-[0.985]",
    },
  ];

  return (
    <div ref={containerRef} className="grid grid-cols-2 lg:grid-cols-3 gap-3 font-sans">
      {cards.map((card) => {
        const isActive = navigatingHref === card.href;
        return (
          <Link
            key={card.href}
            href={card.href}
            prefetch={true}
            onClick={(e) => handleCardClick(e, card.href)}
            className={`group ${card.colSpanClass} bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-sm active:scale-[0.99] transition-all flex flex-col justify-between gap-1.5 cursor-pointer select-none ${
              isActive ? card.activeClass : ""
            }`}
          >
            <span className="text-xs sm:text-[13px] font-medium text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-300 transition-colors">
              {card.label}
            </span>
            <p className={card.valueClass}>
              ₱{card.value.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </p>
          </Link>
        );
      })}
    </div>
  );
}
