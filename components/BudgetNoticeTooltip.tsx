"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Info, X } from "lucide-react";

interface BudgetNoticeTooltipProps {
  variant?: "pill" | "icon";
  align?: "left" | "right" | "center";
}

interface PopoverPosition {
  left: number;
  top: number;
  width: number;
  arrowX: number;
  placeAbove: boolean;
}

export default function BudgetNoticeTooltip({
  variant = "pill",
  align = "left",
}: BudgetNoticeTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState<PopoverPosition | null>(null);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Compute strictly bounded coordinates to guarantee zero viewport overflow
  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const buttonRect = buttonRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const margin = 12; // Safety margin from screen boundaries

    // Clamped popover width
    const maxWidth = 340;
    const popoverWidth = Math.min(maxWidth, viewportWidth - margin * 2);

    // Calculate ideal horizontal placement
    let idealLeft = buttonRect.left;
    if (align === "right") {
      idealLeft = buttonRect.right - popoverWidth;
    } else if (align === "center" || viewportWidth < 640) {
      // Center relative to button on mobile or when center-aligned
      idealLeft = buttonRect.left + buttonRect.width / 2 - popoverWidth / 2;
    }

    // Strictly clamp within viewport
    const clampedLeft = Math.max(
      margin,
      Math.min(idealLeft, viewportWidth - popoverWidth - margin)
    );

    // Calculate vertical placement (flip above if constrained below)
    const estimatedHeight = 190;
    const spaceBelow = viewportHeight - buttonRect.bottom;
    const placeAbove = spaceBelow < estimatedHeight && buttonRect.top > estimatedHeight;

    const top = placeAbove
      ? Math.max(margin, buttonRect.top - estimatedHeight - 8)
      : buttonRect.bottom + 8;

    // Arrow pointing dynamically to button center
    const buttonCenter = buttonRect.left + buttonRect.width / 2;
    const arrowX = Math.max(16, Math.min(buttonCenter - clampedLeft - 6, popoverWidth - 24));

    setPosition({
      left: clampedLeft,
      top,
      width: popoverWidth,
      arrowX,
      placeAbove,
    });
  }, [align]);

  const handleOpen = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    updatePosition();
    setIsOpen(true);
  };

  const handleCloseDebounced = () => {
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 200);
  };

  const handleToggle = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (!isOpen) {
      updatePosition();
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  // Re-calculate position on scroll or viewport resize
  useEffect(() => {
    if (!isOpen) return;

    const handleScrollOrResize = () => {
      updatePosition();
    };

    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);

    return () => {
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [isOpen, updatePosition]);

  // Close on click outside or Escape key
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent | TouchEvent) {
      const target = event.target as Node;
      if (
        buttonRef.current &&
        !buttonRef.current.contains(target) &&
        popoverRef.current &&
        !popoverRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        onMouseEnter={handleOpen}
        onMouseLeave={handleCloseDebounced}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label="View Budget Estimate and Cash in Bank Notice"
        className={`group inline-flex items-center gap-1.5 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded-full cursor-pointer select-none shrink-0 ${
          variant === "icon"
            ? "w-5 h-5 justify-center bg-slate-100 dark:bg-slate-800 hover:bg-brand-50 dark:hover:bg-brand-950/60 text-slate-500 dark:text-slate-400 hover:text-brand-700 dark:hover:text-brand-300 border border-slate-200 dark:border-slate-700 hover:border-brand-300 dark:hover:border-brand-700"
            : "text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:text-brand-700 dark:hover:text-brand-300 bg-slate-100/90 dark:bg-slate-800/90 hover:bg-brand-50 dark:hover:bg-brand-950/60 border border-slate-200/90 dark:border-slate-700/90 hover:border-brand-300 dark:hover:border-brand-700 px-2.5 py-0.5 shadow-2xs"
        }`}
      >
        <Info
          className={`shrink-0 text-brand-600 dark:text-brand-400 transition-transform group-hover:scale-110 ${
            variant === "icon" ? "w-3 h-3" : "w-3.5 h-3.5"
          }`}
        />
        {variant === "pill" && <span className="truncate">Budget Notice</span>}
      </button>

      {/* Render popover into document body via portal with strict viewport bounds */}
      {mounted &&
        isOpen &&
        position &&
        createPortal(
          <div
            ref={popoverRef}
            role="dialog"
            aria-label="Budget Estimate Notice"
            onMouseEnter={() => {
              if (timeoutRef.current) clearTimeout(timeoutRef.current);
            }}
            onMouseLeave={handleCloseDebounced}
            style={{
              position: "fixed",
              top: `${position.top}px`,
              left: `${position.left}px`,
              width: `${position.width}px`,
            }}
            className="z-[9999] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl dark:shadow-black/60 p-4 text-left text-slate-700 dark:text-slate-300 animate-in fade-in zoom-in-95 duration-150"
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-md bg-brand-50 dark:bg-brand-950/70 text-brand-700 dark:text-brand-400 flex items-center justify-center shrink-0">
                  <Info className="w-3.5 h-3.5" />
                </span>
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                  Budget Estimate Notice
                </span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(false);
                }}
                className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 p-1 rounded-md transition-colors cursor-pointer"
                aria-label="Close notice"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <p className="text-[11.5px] leading-relaxed text-slate-600 dark:text-slate-300">
              Total annual budget amounts are provisional estimates based on projected National Tax Allotments (NTA). The SK does not receive the full budget lump-sum; allocations are remitted in monthly tranches into the official SK depository account. The <strong className="text-slate-900 dark:text-slate-100 font-semibold">Current Cash in Bank</strong> reflects actual unspent funds available today.
            </p>

            {/* Dynamic Arrow Indicator */}
            <div
              style={{
                left: `${position.arrowX}px`,
                top: position.placeAbove ? "auto" : "-6px",
                bottom: position.placeAbove ? "-6px" : "auto",
              }}
              className={`absolute w-3 h-3 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 rotate-45 pointer-events-none ${
                position.placeAbove
                  ? "border-b border-r"
                  : "border-t border-l"
              }`}
            />
          </div>,
          document.body
        )}
    </>
  );
}
