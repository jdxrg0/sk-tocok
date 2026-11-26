"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { Search, X, AlertCircle, RotateCw } from "lucide-react";

export interface SearchModalProps {
  open: boolean;
  onClose: () => void;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void | Promise<void>;
  title?: string;
  placeholder?: string;
  ariaLabel?: string;
  hintText?: string;
  submitLabel?: string;
  loadingLabel?: string;
  loading?: boolean;
  required?: boolean;
  error?: string | null;
  clearActiveLabel?: string;
  onClearActive?: () => void;
  accent?: "brand" | "indigo";
}

export default function SearchModal({
  open,
  onClose,
  value,
  onChange,
  onSubmit,
  title,
  placeholder = "Search...",
  ariaLabel = "Search",
  hintText = "Press Enter to search",
  submitLabel = "Search",
  loadingLabel = "Searching...",
  loading = false,
  required = false,
  error = null,
  clearActiveLabel = "Clear active search",
  onClearActive,
  accent = "brand",
}: SearchModalProps) {
  const [mounted, setMounted] = useState(false);
  const [rendered, setRendered] = useState(false);
  const [closing, setClosing] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Track visual viewport so modal stays centered above mobile on-screen keyboard
  const [vvHeight, setVvHeight] = useState<number | null>(null);
  const [vvTop, setVvTop] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Coordinate smooth enter/exit animations with `open` prop
  useEffect(() => {
    if (open) {
      if (!rendered) {
        previousFocusRef.current = document.activeElement as HTMLElement | null;
      }
      setRendered(true);
      setClosing(false);
      setLocalError(null);
      return;
    }

    if (rendered) {
      setClosing(true);
      const timer = setTimeout(() => {
        setRendered(false);
        setClosing(false);
        setLocalError(null);
        const prev = previousFocusRef.current;
        previousFocusRef.current = null;
        if (prev && document.contains(prev)) {
          prev.focus({ preventScroll: true });
        }
      }, 190);
      return () => clearTimeout(timer);
    }
  }, [open, rendered]);

  // Visual viewport tracking for mobile virtual keyboards (iOS Safari & Chrome Android)
  useEffect(() => {
    if (!rendered || typeof window === "undefined" || !window.visualViewport) return;

    const handleViewportChange = () => {
      if (!window.visualViewport) return;
      setVvHeight(window.visualViewport.height);
      setVvTop(window.visualViewport.offsetTop);
    };

    handleViewportChange();
    window.visualViewport.addEventListener("resize", handleViewportChange);
    window.visualViewport.addEventListener("scroll", handleViewportChange);

    return () => {
      window.visualViewport?.removeEventListener("resize", handleViewportChange);
      window.visualViewport?.removeEventListener("scroll", handleViewportChange);
    };
  }, [rendered]);

  // Lock background body scroll completely across mobile & desktop while modal is open
  useEffect(() => {
    if (!rendered) return;

    const prevModalOpen = document.documentElement.dataset.modalOpen;
    if (!prevModalOpen) {
      document.documentElement.dataset.modalOpen = "true";
    }

    const isAlreadyLocked = document.body.style.position === "fixed";
    const savedScrollY =
      window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;
    const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;

    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevHtmlOverscroll = document.documentElement.style.overscrollBehavior;
    const prevBodyPosition = document.body.style.position;
    const prevBodyTop = document.body.style.top;
    const prevBodyLeft = document.body.style.left;
    const prevBodyRight = document.body.style.right;
    const prevBodyWidth = document.body.style.width;
    const prevBodyOverflow = document.body.style.overflow;
    const prevBodyOverscroll = document.body.style.overscrollBehavior;
    const prevBodyPaddingRight = document.body.style.paddingRight;

    if (!isAlreadyLocked) {
      document.documentElement.style.overflow = "hidden";
      document.documentElement.style.overscrollBehavior = "none";
      document.body.style.position = "fixed";
      document.body.style.top = `-${savedScrollY}px`;
      document.body.style.left = "0";
      document.body.style.right = "0";
      document.body.style.width = "100%";
      document.body.style.overflow = "hidden";
      document.body.style.overscrollBehavior = "none";
      if (scrollBarWidth > 0) {
        document.body.style.paddingRight = `${scrollBarWidth}px`;
      }
    }

    // Keep window scroll at 0 while modal is open so mobile browsers cannot displace page
    const handleWindowScroll = () => {
      if (window.scrollY !== 0) {
        window.scrollTo(0, 0);
      }
    };
    window.addEventListener("scroll", handleWindowScroll, { passive: true });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    // Prevent background touch gestures from moving or rubber-banding the page underneath
    const preventTouch = (e: TouchEvent) => {
      if (e.cancelable) {
        e.preventDefault();
      }
    };
    window.addEventListener("touchmove", preventTouch, { passive: false });

    return () => {
      window.removeEventListener("scroll", handleWindowScroll);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("touchmove", preventTouch);

      if (!prevModalOpen) {
        delete document.documentElement.dataset.modalOpen;
      }

      if (!isAlreadyLocked) {
        document.documentElement.style.overflow = prevHtmlOverflow;
        document.documentElement.style.overscrollBehavior = prevHtmlOverscroll;
        document.body.style.position = prevBodyPosition;
        document.body.style.top = prevBodyTop;
        document.body.style.left = prevBodyLeft;
        document.body.style.right = prevBodyRight;
        document.body.style.width = prevBodyWidth;
        document.body.style.overflow = prevBodyOverflow;
        document.body.style.overscrollBehavior = prevBodyOverscroll;
        document.body.style.paddingRight = prevBodyPaddingRight;
        window.scrollTo(0, savedScrollY);
      }
    };
  }, [rendered, onClose]);

  // Focus helper to activate input and pop up the on-screen mobile keyboard without layout shifts
  const focusInput = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.focus({ preventScroll: true });
      const len = inputRef.current.value.length;
      if (len > 0) {
        try {
          inputRef.current.setSelectionRange(len, len);
        } catch {
          // Ignore if unsupported
        }
      }
    }
  }, []);

  // Synchronously focus the input element upon DOM mount
  const setInputRef = useCallback(
    (node: HTMLInputElement | null) => {
      inputRef.current = node;
      if (node && open) {
        node.focus({ preventScroll: true });
      }
    },
    [open]
  );

  // Multi-pass focus ensures virtual keyboard triggers reliably across iOS Safari & Android
  useEffect(() => {
    if (!open) return;
    focusInput();
    const raf = requestAnimationFrame(focusInput);
    const timer1 = setTimeout(focusInput, 50);
    const timer2 = setTimeout(focusInput, 150);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [open, focusInput]);

  if (!mounted || !rendered) return null;

  const displayError = error || localError;
  const submitButtonClass =
    accent === "indigo"
      ? "bg-indigo-600 hover:bg-indigo-700"
      : "bg-brand-600 hover:bg-brand-700";

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      className={`fixed z-[9999] bg-slate-950/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overscroll-contain select-none touch-none ${
        closing ? "animate-modal-backdrop-out" : "animate-modal-backdrop-in"
      }`}
      style={{
        position: "fixed",
        top: vvTop ? `${vvTop}px` : "0px",
        left: "0px",
        right: "0px",
        bottom: "0px",
        height: vvHeight ? `${vvHeight}px` : "100%",
        paddingTop: "max(0.75rem, env(safe-area-inset-top, 0px))",
        paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))",
        paddingLeft: "max(0.75rem, env(safe-area-inset-left, 0px))",
        paddingRight: "max(0.75rem, env(safe-area-inset-right, 0px))",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onWheel={(e) => {
        if (e.target === e.currentTarget) e.preventDefault();
      }}
      onTouchMove={(e) => {
        if (e.cancelable) e.preventDefault();
      }}
    >
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (required && !value.trim()) {
            setLocalError("Please enter a search term.");
            focusInput();
            return;
          }
          setLocalError(null);
          onSubmit();
        }}
        className={`relative bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200/90 dark:border-slate-800 overflow-hidden overscroll-contain select-text font-sans touch-auto ${
          closing ? "animate-modal-card-out" : "animate-modal-card-in"
        }`}
        onClick={(e) => e.stopPropagation()}
        onTouchMove={(e) => {
          // Modal has no inner scroll container; prevent background touch drags
          if (e.cancelable) e.preventDefault();
        }}
      >
        {/* Optional Context Header */}
        {title && (
          <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-2 border-b border-slate-100/80 dark:border-slate-800/80 bg-slate-50/40 dark:bg-slate-800/30">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 tracking-tight truncate">
              {title}
            </span>
            <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 rounded shrink-0">
              ESC
            </kbd>
          </div>
        )}

        {/* Minimalist Search Input Row */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 dark:border-slate-800">
          <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
          <input
            ref={setInputRef}
            type="text"
            inputMode="search"
            enterKeyHint="search"
            autoFocus
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder={placeholder}
            value={value}
            onChange={(e) => {
              if (localError) setLocalError(null);
              onChange(e.target.value);
            }}
            className="w-full bg-transparent text-sm [line-height:normal] py-0.5 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
          />
          {value && (
            <button
              type="button"
              onClick={() => {
                if (localError) setLocalError(null);
                onChange("");
                focusInput();
              }}
              className="p-1 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-90 transition-all cursor-pointer shrink-0"
              title="Clear input"
              aria-label="Clear input"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Optional Inline Error Row */}
        {displayError && (
          <div
            role="alert"
            aria-live="polite"
            className="flex items-center gap-2 px-4 py-2 bg-rose-50 dark:bg-rose-950/50 border-b border-rose-100 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs"
          >
            <AlertCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
            <span>{displayError}</span>
          </div>
        )}

        {/* Subtle Footer Bar */}
        <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-slate-50/70 dark:bg-slate-800/60">
          {onClearActive ? (
            <button
              type="button"
              onClick={onClearActive}
              className="text-xs font-medium text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 active:scale-95 transition-all cursor-pointer"
            >
              {clearActiveLabel}
            </button>
          ) : (
            <span className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
              <span>{hintText}</span>
            </span>
          )}

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 active:scale-95 transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`px-3.5 py-1.5 rounded-lg ${submitButtonClass} active:scale-95 text-white text-xs font-semibold transition-all cursor-pointer shadow-sm disabled:opacity-60 inline-flex items-center gap-1.5`}
            >
              {loading ? (
                <>
                  <RotateCw className="w-3.5 h-3.5 animate-spin" />
                  <span>{loadingLabel}</span>
                </>
              ) : (
                <span>{submitLabel}</span>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>,
    document.body
  );
}
