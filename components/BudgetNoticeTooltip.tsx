"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Info,
  Landmark,
  ShieldCheck,
  ArrowDown,
  HelpCircle,
  X,
} from "lucide-react";

export interface BudgetNoticeTooltipProps {
  variant?: "pill" | "icon";
  align?: "left" | "right" | "center";
  currentBankBalance?: number;
  fundsReceived?: number;
  totalSpent?: number;
  totalDepositsCount?: number;
  annualBudget?: number;
  barangayBudget?: number;
  utilizationRate?: number;
}

export default function BudgetNoticeTooltip({
  variant = "pill",
  currentBankBalance = 0,
  fundsReceived = 0,
  totalSpent = 0,
  totalDepositsCount = 0,
  annualBudget = 0,
  barangayBudget = 0,
  utilizationRate = 0,
}: BudgetNoticeTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleOpen = () => {
    setIsClosing(false);
    setIsOpen(true);
  };

  const handleClose = () => {
    if (isClosing) return;
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      setIsOpen(false);
    }, 200);
  };

  // Lock body & html scroll while modal is open
  useEffect(() => {
    if (!isOpen) return;

    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label="View More Information and Simple Financial Guide"
        className={`inline-flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded-full cursor-pointer select-none shrink-0 ${
          variant === "icon"
            ? "w-5 h-5 justify-center bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
            : "text-[11px] font-semibold text-slate-600 dark:text-slate-300 bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200/90 dark:border-slate-700/90 px-2.5 py-0.5 shadow-2xs"
        }`}
      >
        <Info
          className={`shrink-0 text-brand-600 dark:text-brand-400 ${
            variant === "icon" ? "w-3 h-3" : "w-3.5 h-3.5"
          }`}
        />
        {variant === "pill" && <span className="truncate">More Information</span>}
      </button>

      {/* Render Educational Modal into document body via portal */}
      {mounted &&
        isOpen &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="dumbproof-guide-title"
            className={`fixed inset-0 z-[9999] bg-slate-950/70 dark:bg-black/85 flex items-center justify-center p-3 sm:p-4 overscroll-contain select-none touch-none ${
              isClosing ? "animate-modal-backdrop-out pointer-events-none" : "animate-modal-backdrop-in"
            }`}
            style={{
              paddingTop: "max(0.75rem, env(safe-area-inset-top, 0px))",
              paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))",
              paddingLeft: "max(0.75rem, env(safe-area-inset-left, 0px))",
              paddingRight: "max(0.75rem, env(safe-area-inset-right, 0px))",
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) handleClose();
            }}
            onTouchMove={(e) => {
              if (e.target === e.currentTarget) {
                e.preventDefault();
              }
            }}
          >
            <div
              className={`relative bg-white dark:bg-slate-900 rounded-2xl max-w-xl w-full max-h-[calc(100dvh-1.5rem)] flex flex-col shadow-2xl border border-slate-200/90 dark:border-slate-800 overflow-hidden select-text text-left font-sans touch-auto ${
                isClosing ? "animate-modal-card-out" : "animate-modal-card-in"
              }`}
              style={{
                maxHeight:
                  "calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 1.5rem)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header (Pinned & Fully Opaque) */}
              <div className="relative z-10 px-4 sm:px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 shadow-2xs flex items-center justify-between gap-3">
                <div>
                  <h3
                    id="dumbproof-guide-title"
                    className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 leading-tight"
                  >
                    How SK Tocok Money Works
                  </h3>
                  <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 leading-tight pt-0.5">
                    Live Bank &amp; Statutory Accounts
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  aria-label="Close modal"
                  className="p-1.5 -mr-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable Educational Body (Scrolls if viewport is compact) */}
              <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs overscroll-contain">
                {/* 1. THE 5-STEP MONEY TRAIL (Visual Pipeline) */}
                <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200/90 dark:border-slate-800 rounded-xl p-3.5 sm:p-4 space-y-3">
                  <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block px-0.5">
                    The Money Trail: From Barangay to Bank
                  </span>

                  {/* Flow Steps */}
                  <div className="space-y-2">
                    {/* Step 1 */}
                    <div className="flex items-start gap-2.5 p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-700/60">
                      <div className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                        1
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center justify-between gap-1">
                          <span className="font-bold text-slate-900 dark:text-slate-100 text-[11.5px]">
                            Mother Barangay Budget (~₱{barangayBudget.toLocaleString("en-US", { minimumFractionDigits: 2 })})
                          </span>
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-sky-100 dark:bg-sky-950/80 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-800/80 shrink-0">
                            LGU Est.
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          The total estimated income of Barangay Tocok for the whole year.
                        </p>
                      </div>
                    </div>

                    <div className="flex justify-center -my-1 text-slate-400 dark:text-slate-600">
                      <ArrowDown className="w-3.5 h-3.5" />
                    </div>

                    {/* Step 2 */}
                    <div className="flex items-start gap-2.5 p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-700/60">
                      <div className="w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                        2
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center justify-between gap-1">
                          <span className="font-bold text-slate-900 dark:text-slate-100 text-[11.5px]">
                            SK Youth Fund (10%): ~₱{annualBudget.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </span>
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/80 shrink-0">
                            RA 10742
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          By law, the SK is legally entitled to exactly 10% of the Barangay budget for youth projects.
                        </p>
                      </div>
                    </div>

                    <div className="flex justify-center -my-1 text-slate-400 dark:text-slate-600">
                      <ArrowDown className="w-3.5 h-3.5" />
                    </div>

                    {/* Step 3 */}
                    <div className="flex items-start gap-2.5 p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-700/60">
                      <div className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-800 dark:text-indigo-300 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                        3
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center justify-between gap-1">
                          <span className="font-bold text-slate-900 dark:text-slate-100 text-[11.5px]">
                            Funds Deposited So Far: ₱{fundsReceived.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </span>
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-indigo-100 dark:bg-indigo-950/80 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/80 shrink-0">
                            {totalDepositsCount} Tranches
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Money doesn&apos;t arrive all at once! It comes as <strong>monthly bank remittances</strong> as taxes get collected.
                        </p>
                      </div>
                    </div>

                    <div className="flex justify-center -my-1 text-slate-400 dark:text-slate-600">
                      <ArrowDown className="w-3.5 h-3.5" />
                    </div>

                    {/* Step 4 */}
                    <div className="flex items-start gap-2.5 p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-700/60">
                      <div className="w-5 h-5 rounded-full bg-brand-100 dark:bg-brand-950/80 text-brand-800 dark:text-brand-300 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                        4
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center justify-between gap-1">
                          <span className="font-bold text-slate-900 dark:text-slate-100 text-[11.5px]">
                            Spent on Youth Services: ₱{totalSpent.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </span>
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-brand-100 dark:bg-brand-950/80 text-brand-800 dark:text-brand-300 border border-brand-200 dark:border-brand-800/80 shrink-0">
                            {utilizationRate.toFixed(1)}% Spent
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Disbursed for authorized youth projects and community activities. Backed by <strong>audited vouchers &amp; receipts</strong>.
                        </p>
                      </div>
                    </div>

                    <div className="flex justify-center -my-1 text-slate-400 dark:text-slate-600">
                      <ArrowDown className="w-3.5 h-3.5" />
                    </div>

                    {/* Step 5 - Hero Outcome */}
                    <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/30 border-2 border-emerald-400/80 dark:border-emerald-700/70">
                      <div className="w-5 h-5 rounded-full bg-emerald-500 text-white font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                        5
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2">
                          <span className="font-bold text-emerald-950 dark:text-emerald-100 text-[12px] leading-tight">
                            CURRENT CASH IN BANK: ₱{currentBankBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </span>
                          <span className="self-start sm:self-auto text-[9px] sm:text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/80 shrink-0 max-w-full">
                            Mangaldan Land Bank of the Philippines
                          </span>
                        </div>
                        <p className="text-[11px] font-medium text-emerald-900 dark:text-emerald-200 pt-1">
                          <strong>Actual unspent funds physically available right now</strong>, safely stored in the official government bank account.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. DUMB-PROOF Q&A: CLEARING COMMON MISCONCEPTIONS */}
                <div className="space-y-2.5">
                  <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block px-1">
                    Quick Answers to Big Questions (FAQs)
                  </span>

                  {/* Q1: Why not 700k in the bank? */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-3.5 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-slate-900 dark:text-slate-100 font-bold text-xs">
                      <HelpCircle className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400 shrink-0" />
                      <span>&ldquo;If our annual budget is ~₱{annualBudget.toLocaleString("en-US", { minimumFractionDigits: 0 })}, why is there only ₱{currentBankBalance.toLocaleString("en-US", { minimumFractionDigits: 0 })} left? Did someone take it?&rdquo;</span>
                    </div>
                    <p className="text-[11.5px] text-slate-600 dark:text-slate-300 leading-relaxed pl-5">
                      <strong>Definitely not!</strong> Two simple reasons:
                    </p>
                    <ul className="text-[11px] text-slate-600 dark:text-slate-300 space-y-1 pl-5">
                      <li className="flex items-start gap-1.5">
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">•</span>
                        <span>
                          The barangay has only transferred <strong>₱{fundsReceived.toLocaleString("en-US", { minimumFractionDigits: 0 })}</strong> so far (in <strong>{totalDepositsCount} monthly installments</strong>). The rest arrives as monthly taxes come in.
                        </span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">•</span>
                        <span>
                          We already spent <strong>₱{totalSpent.toLocaleString("en-US", { minimumFractionDigits: 0 })}</strong> ({utilizationRate.toFixed(1)}%) on real youth projects.
                        </span>
                      </li>
                      <li className="pt-1">
                        <span className="font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[10px] sm:text-[10.5px] text-slate-900 dark:text-slate-100 inline-block max-w-full break-words">
                          Net: ₱{fundsReceived.toLocaleString("en-US", { minimumFractionDigits: 0 })} in − ₱{totalSpent.toLocaleString("en-US", { minimumFractionDigits: 0 })} spent = ₱{currentBankBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })} remaining
                        </span>
                      </li>
                    </ul>
                  </div>

                  {/* Q2: Where is the money stored? */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-3.5 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-slate-900 dark:text-slate-100 font-bold text-xs">
                      <Landmark className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>&ldquo;Where is the cash kept right now? Can SK officials take it out?&rdquo;</span>
                    </div>
                    <p className="text-[11.5px] text-slate-600 dark:text-slate-300 leading-relaxed pl-5">
                      The money is <strong>NOT</strong> in cash at the SK Hall, nor in anyone&apos;s personal GCash or pocket. It is physically in our statutory account at{" "}
                      <strong className="text-slate-900 dark:text-slate-100 font-semibold">Mangaldan Land Bank of the Philippines</strong>. No one can withdraw a single peso without official council resolutions and signed checks.
                    </p>
                  </div>

                  {/* Q3: How do we know expenses are honest? */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-3.5 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-slate-900 dark:text-slate-100 font-bold text-xs">
                      <ShieldCheck className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400 shrink-0" />
                      <span>&ldquo;How do I know the ₱{totalSpent.toLocaleString("en-US", { minimumFractionDigits: 0 })} wasn&apos;t wasted or corrupted?&rdquo;</span>
                    </div>
                    <p className="text-[11.5px] text-slate-600 dark:text-slate-300 leading-relaxed pl-5">
                      Every single payment is backed 100% by{" "}
                      <strong className="text-slate-900 dark:text-slate-100">audited vouchers &amp; receipts</strong>. The Commission on Audit (COA) checks all receipts, invoices, and photos before any project is closed. You can inspect every receipt right now on our public transparency ledger!
                    </p>
                  </div>
                </div>
              </div>

              {/* Footer Actions (Pinned & Fully Opaque) */}
              <div className="relative z-10 p-3.5 sm:p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end shrink-0 shadow-2xs">
                <button
                  type="button"
                  onClick={handleClose}
                  className="w-full sm:w-auto text-xs font-semibold px-4 py-2 rounded-lg bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer text-center"
                >
                  Got it, close
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
