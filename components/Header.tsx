"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Home, Landmark, Printer, LayoutGrid, ClipboardCheck, MessageSquareQuote, X } from "lucide-react";
import AccountMenu from "@/components/AccountMenu";

const DESKTOP_NAV_LINKS = [
  { href: "/", label: "Overview", icon: Home },
  { href: "/transparency", label: "Finances", icon: Landmark },
  { href: "/printing", label: "Printing", icon: Printer },
  { href: "/attendance", label: "Attendance", icon: ClipboardCheck },
  { href: "/messages", label: "Bumo-Boses", icon: MessageSquareQuote },
];

const MOBILE_NAV_LINKS = [
  { href: "/", label: "Overview", shortLabel: "Overview", icon: Home },
  { href: "/transparency", label: "Finances", shortLabel: "Finances", icon: Landmark },
  { href: "/printing", label: "Printing", shortLabel: "Printing", icon: Printer },
  { href: "/others", label: "Others", shortLabel: "Others", icon: LayoutGrid },
];

const OTHERS_POPUP_OPTIONS = [
  { href: "/messages", label: "Bumo-Boses", icon: MessageSquareQuote },
  { href: "/attendance", label: "Attendance", icon: ClipboardCheck },
];

export default function Header() {
  const headerRef = useRef<HTMLElement>(null);
  const pathname = usePathname();
  const router = useRouter();
  const isNavigatingRef = useRef(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [othersMenuOpen, setOthersMenuOpen] = useState(false);

  // Clear optimistic pending state whenever route changes
  useEffect(() => {
    setPendingHref(null);
    setOthersMenuOpen(false);
  }, [pathname]);

  // Suppress in-page floating action buttons when mobile navigation speed-dial is open
  useEffect(() => {
    if (othersMenuOpen) {
      document.documentElement.dataset.navMenuOpen = "true";
    } else {
      delete document.documentElement.dataset.navMenuOpen;
    }
    return () => {
      delete document.documentElement.dataset.navMenuOpen;
    };
  }, [othersMenuOpen]);

  // Matches the exact delta height of the brand container:
  // Mobile: 236px - 58px = 178px
  // Desktop: 260px - 64px = 196px
  // Content scrolls in 1:1 lockstep with the folding header, eliminating any gap.
  const getCollapseDistance = () => {
    if (typeof window === "undefined") return 178;
    return window.innerWidth >= 768 ? 196 : 178;
  };

  useEffect(() => {
    let ticking = false;
    let lastProgress = -1;
    let lastStoredState: string | null = null;
    let scrollTimeout: NodeJS.Timeout | null = null;
    let isTouching = false;
    let isAutoSnapping = false;
    const supportsScrollEnd = typeof window !== "undefined" && "onscrollend" in window;

    // 51% Auto-Snap:
    // If stopped halfway in the transition zone (0 < y < collapseDistance):
    // >= 51%: smooth scroll to collapseDistance (auto-collapses)
    // < 51%: smooth scroll to 0 (auto-expands)
    const snapToNearest = () => {
      if (isTouching || isAutoSnapping || isNavigatingRef.current) return;
      if (
        typeof document !== "undefined" &&
        (document.documentElement.style.overflow === "hidden" ||
          document.body.style.overflow === "hidden" ||
          document.body.style.position === "fixed")
      ) {
        return;
      }
      const y = window.scrollY;
      const collapseDistance = getCollapseDistance();
      const maxScroll = Math.max(
        0,
        document.documentElement.scrollHeight - window.innerHeight
      );

      // If page cannot scroll at all, do nothing
      if (maxScroll <= 0) return;

      if (y > 16 && y < collapseDistance - 16) {
        // Guard against unreachable targets when content height is constrained
        const reachableTarget =
          maxScroll >= collapseDistance
            ? collapseDistance
            : maxScroll >= collapseDistance * 0.51
            ? maxScroll
            : 0;
        const targetY = y >= collapseDistance * 0.51 ? reachableTarget : 0;

        // If already at or within 1.5px of the target, avoid redundant scroll triggers
        if (Math.abs(y - targetY) < 1.5) return;

        isAutoSnapping = true;

        window.scrollTo({
          top: targetY,
          behavior: "smooth",
        });

        setTimeout(() => {
          isAutoSnapping = false;
        }, 500);
      }
    };

    let latestY = 0;
    const getScrollY = () => {
      if (typeof window === "undefined") return 0;
      return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
    };

    const update = () => {
      ticking = false;
      if (isNavigatingRef.current) return;
      if (!headerRef.current) return;

      // If page scrolling is locked (e.g. modal popup is open), freeze header state
      if (
        typeof document !== "undefined" &&
        (document.documentElement.style.overflow === "hidden" ||
          document.body.style.overflow === "hidden" ||
          document.body.style.position === "fixed")
      ) {
        return;
      }

      const y = latestY;
      const collapseDistance = getCollapseDistance();

      const clampedY = Math.max(0, y);
      const progress = Math.min(1, clampedY / collapseDistance);
      // Quantize to ~1px steps to eliminate continuous font reshaping and layout thrashing in Chromium
      const rounded = Math.round(progress * 200) / 200;

      if (rounded !== lastProgress) {
        lastProgress = rounded;
        headerRef.current.style.setProperty("--p", rounded.toString());
      }

      // Automatically remember state only when crossing state boundaries
      // (avoids running synchronous sessionStorage IPC calls on every scroll frame in Safari)
      try {
        if (progress >= 1 && lastStoredState !== "1") {
          lastStoredState = "1";
          sessionStorage.setItem("sk_header_collapsed", "1");
        } else if (clampedY < 40 && lastStoredState !== "0") {
          lastStoredState = "0";
          sessionStorage.setItem("sk_header_collapsed", "0");
        }
      } catch {}
    };

    let lastSnapY = -1;

    const checkAndSnap = () => {
      if (isTouching || isAutoSnapping || isNavigatingRef.current) return;
      const currentY = getScrollY();
      // If momentum scroll is still gliding, let it finish naturally without interruption
      if (Math.abs(currentY - lastSnapY) > 0.5) {
        lastSnapY = currentY;
        scrollTimeout = setTimeout(checkAndSnap, 150);
        return;
      }
      snapToNearest();
    };

    const handleScroll = () => {
      if (isNavigatingRef.current) return;
      latestY = getScrollY();

      if (!ticking) {
        window.requestAnimationFrame(update);
        ticking = true;
      }

      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }

      // In browsers without native scrollend, check that momentum scrolling has completely stopped
      if (!supportsScrollEnd && !isTouching && !isAutoSnapping && !isNavigatingRef.current) {
        lastSnapY = latestY;
        scrollTimeout = setTimeout(checkAndSnap, 300);
      }
    };

    const handleTouchStart = () => {
      isTouching = true;
      isAutoSnapping = false;
      if (scrollTimeout) clearTimeout(scrollTimeout);
    };

    const handleTouchEnd = () => {
      isTouching = false;
      if (scrollTimeout) clearTimeout(scrollTimeout);
      if (!supportsScrollEnd && !isAutoSnapping && !isNavigatingRef.current) {
        lastSnapY = getScrollY();
        scrollTimeout = setTimeout(checkAndSnap, 300);
      }
    };

    const handleScrollEnd = () => {
      if (!isTouching && !isAutoSnapping && !isNavigatingRef.current) {
        snapToNearest();
      }
    };

    // On page navigation: check if previously collapsed, and position at collapseDistance seamlessly
    isNavigatingRef.current = true;
    const navTimers: NodeJS.Timeout[] = [];

    try {
      const wasCollapsed = sessionStorage.getItem("sk_header_collapsed") === "1";
      lastStoredState = wasCollapsed ? "1" : "0";
      if (wasCollapsed) {
        const collapseDistance = getCollapseDistance();

        const applyCollapsed = () => {
          window.scrollTo({ top: collapseDistance, behavior: "instant" });
          if (headerRef.current) {
            headerRef.current.style.setProperty("--p", "1");
          }
          lastProgress = 1;
        };

        applyCollapsed();
        requestAnimationFrame(applyCollapsed);
        navTimers.push(setTimeout(applyCollapsed, 50));
        navTimers.push(setTimeout(applyCollapsed, 120));
        navTimers.push(setTimeout(applyCollapsed, 250));
      } else {
        const applyExpanded = () => {
          window.scrollTo({ top: 0, behavior: "instant" });
          if (headerRef.current) {
            headerRef.current.style.setProperty("--p", "0");
          }
          lastProgress = 0;
        };

        applyExpanded();
        requestAnimationFrame(applyExpanded);
      }
    } catch {
      latestY = getScrollY();
      update();
    }

    const navTimer = setTimeout(() => {
      isNavigatingRef.current = false;
    }, 350);

    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setOthersMenuOpen(false);
      }
      latestY = getScrollY();
      if (!ticking) {
        window.requestAnimationFrame(update);
        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleResize, { passive: true });
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });
    window.addEventListener("touchcancel", handleTouchEnd, { passive: true });
    window.addEventListener("scrollend", handleScrollEnd, { passive: true });

    return () => {
      clearTimeout(navTimer);
      navTimers.forEach(clearTimeout);
      if (scrollTimeout) clearTimeout(scrollTimeout);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("touchcancel", handleTouchEnd);
      window.removeEventListener("scrollend", handleScrollEnd);
    };
  }, [pathname]);

  // Close "Others" floating options popup on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOthersMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Eagerly prefetch all routes on header mount so page navigation loads instantly
  useEffect(() => {
    const hrefs = new Set([
      ...DESKTOP_NAV_LINKS.map((l) => l.href),
      ...MOBILE_NAV_LINKS.map((l) => l.href),
      ...OTHERS_POPUP_OPTIONS.map((l) => l.href),
    ]);
    hrefs.forEach((href) => {
      router.prefetch(href);
    });
  }, [router]);

  // Optimistic path provides 0ms instant visual feedback when a tab is tapped
  const currentPath = pendingHref ?? pathname;

  const isActive = (path: string) => {
    if (!currentPath) return path === "/";
    if (path === "/") return currentPath === "/";
    if (path === "/printing" && currentPath.startsWith("/track")) return true;
    if (
      path === "/others" &&
      (currentPath.startsWith("/attendance") || currentPath.startsWith("/messages") || currentPath === "/others")
    ) {
      return true;
    }
    return currentPath.startsWith(path);
  };

  const isOptionActive = (href: string) => {
    if (href === "/others") {
      return currentPath === "/others";
    }
    return currentPath?.startsWith(href) ?? false;
  };

  const handleNavClick = (href: string) => {
    setPendingHref(href);
  };

  return (
    <>
      {/* =========================================================================
          STATIC PLACEHOLDER SPACER IN DOCUMENT FLOW
          Matches the uncollapsed header height (236px mobile / 306px desktop).
          Content underneath NEVER jumps because this spacer stays static in flow.
          ========================================================================= */}
      <div
        className="w-full shrink-0 pointer-events-none"
        style={{ height: "var(--header-spacer-h)" }}
        aria-hidden="true"
      />

      {/* =========================================================================
          FIXED STICKY HEADER: CONTINUOUS 1:1 SCROLL-DRIVEN FOLDING ANIMATION
          Pins to top: 0 through the entire page.
          Driven smoothly at 60/120fps by --p (0 = expanded, 1 = collapsed).
          ========================================================================= */}
      <header
        ref={headerRef}
        className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-slate-900 md:bg-white/95 md:dark:bg-slate-900/95 md:backdrop-blur-md shadow-xs dark:shadow-slate-950/40 border-b border-slate-200 dark:border-slate-800"
        style={{
          paddingTop: "env(safe-area-inset-top, 0px)",
          WebkitTransform: "translate3d(0, 0, 0)",
          transform: "translate3d(0, 0, 0)",
          WebkitBackfaceVisibility: "hidden",
          backfaceVisibility: "hidden",
        }}
      >
        {/* Unclipped Floating Layer: SK Circular Seal (z-30, on top when overlapping) & Account/Appearance Menu (splits to right on scroll) */}
        <div
          className="pointer-events-none absolute inset-x-0 z-30"
          style={{
            top: "env(safe-area-inset-top, 0px)",
            WebkitTransform: "translate3d(0, 0, 0)",
            transform: "translate3d(0, 0, 0)",
          }}
        >
          <div className="relative w-full max-w-6xl mx-auto">
            {/* SK Circular Seal: Clicking scrolls smoothly to top (unfolding the header) */}
            <Link
              href="/"
              prefetch={true}
              scroll={false}
              onClick={(e) => {
                if (pathname === "/") {
                  e.preventDefault();
                  window.scrollTo({ top: 0, behavior: "smooth" });
                } else {
                  setPendingHref("/");
                }
              }}
              className="pointer-events-auto absolute z-30 group"
              style={{
                left: "calc((50% - var(--logo-half-start)) * (1 - var(--p)) + var(--logo-left-end) * var(--p))",
                top: "calc(var(--logo-top-start) * (1 - var(--p)) + var(--logo-top-end) * var(--p))",
                width:
                  "calc(var(--logo-size-start) * (1 - var(--p)) + var(--logo-size-end) * var(--p))",
                height:
                  "calc(var(--logo-size-start) * (1 - var(--p)) + var(--logo-size-end) * var(--p))",
                willChange: "transform, left, top",
                WebkitTransform: "translate3d(0, 0, 0)",
                transform: "translate3d(0, 0, 0)",
              }}
              aria-label="SK Tocok Home"
            >
              <div className="w-full h-full rounded-full border-2 border-brand-600/80 dark:border-brand-500/80 overflow-hidden shadow-sm bg-[#ffffff] ring-2 ring-brand-500/20 dark:ring-brand-400/25 group-hover:scale-105 transition-transform flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <picture>
                  <source srcSet="/images/sk-logo-sm.webp" type="image/webp" />
                  <img
                    src="/images/sk-logo-sm.png"
                    alt="Sangguniang Kabataan Barangay Tocok Official Seal"
                    width={48}
                    height={48}
                    className="w-full h-full object-cover scale-[1.03]"
                  />
                </picture>
              </div>
            </Link>

            {/* User Profile Picture (starts behind SK Seal at center, splits symmetrically to right on scroll) / Guest Appearance Toggle */}
            <AccountMenu />
          </div>
        </div>

        {/* -----------------------------------------------------------------------
            ROW 1: BRAND HEADER (ANIMATES & FOLDS AS USER SCROLLS)
            ----------------------------------------------------------------------- */}
        <div
          className="relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-6 overflow-hidden"
          style={{
            height:
              "calc(var(--brand-h-start) * (1 - var(--p)) + var(--brand-h-end) * var(--p))",
            willChange: "height",
            WebkitTransform: "translate3d(0, 0, 0)",
            transform: "translate3d(0, 0, 0)",
          }}
        >

          {/* JURISDICTION KICKER (Fades out in place as user scrolls down) */}
          <div
            className="absolute inset-x-0 text-center pointer-events-none px-4"
            style={{
              top: "var(--kicker-top)",
              opacity: "calc(max(0, 1 - (var(--p) * 2.8)))",
              willChange: "opacity",
            }}
          >
            <p className="text-[8.5px] sm:text-xs font-semibold uppercase tracking-wider sm:tracking-widest text-slate-500 dark:text-slate-400 whitespace-nowrap">
              Republic of the Philippines • San Fabian, Pangasinan
            </p>
          </div>

          {/* CORE BRAND IDENTITY: GLIDES CONTINUOUSLY FROM CENTER TO TARGET */}
          <div
            className="absolute z-10 flex flex-col items-center text-center pointer-events-none"
            style={{
              left: "calc(50% * (1 - var(--p)) + var(--brand-text-left-end) * var(--p))",
              top: "calc(var(--brand-text-top-start) * (1 - var(--p)) + var(--brand-text-top-end) * var(--p))",
              willChange: "transform, left, top",
              WebkitTransform:
                "translate3d(calc(-50% * (1 - var(--p)) + var(--brand-text-transform-end) * var(--p)), 0, 0)",
              transform:
                "translate3d(calc(-50% * (1 - var(--p)) + var(--brand-text-transform-end) * var(--p)), 0, 0)",
              width: "max-content",
              maxWidth: "calc(100% - 32px)",
            }}
          >
            {/* Primary Identity: "Sangguniang Kabataan" */}
            <h1
              className="font-black tracking-tight leading-tight whitespace-nowrap"
              style={{
                fontSize:
                  "calc(var(--title-size-start) * (1 - var(--p)) + var(--title-size-end) * var(--p))",
                fontOpticalSizing: "none",
                WebkitFontSmoothing: "antialiased",
              }}
            >
              <span className="text-brand-600 dark:text-brand-400">Sangguniang</span>{" "}
              <span className="text-brand-800 dark:text-brand-200">Kabataan</span>
            </h1>

            {/* Locality: "Barangay Tocok" */}
            <div className="pt-0.5">
              <span
                className="font-bold text-slate-800 dark:text-slate-100 tracking-tight whitespace-nowrap block"
                style={{
                  fontSize:
                    "calc(var(--sub-size-start) * (1 - var(--p)) + var(--sub-size-end) * var(--p))",
                  fontOpticalSizing: "none",
                  WebkitFontSmoothing: "antialiased",
                }}
              >
                Barangay Tocok
              </span>
            </div>

            {/* Portal Subtitle (Fades out cleanly on scroll) */}
            <div
              style={{
                opacity: "calc(max(0, 1 - (var(--p) * 2.8)))",
                transform: "translate3d(0, calc(var(--p) * -4px), 0)",
                willChange: "opacity, transform",
                pointerEvents: "none",
              }}
            >
              <p className="text-[10.5px] sm:text-xs font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap pt-0.5">
                Financial Transparency &amp; Youth Services Portal
              </p>
            </div>
          </div>

          {/* COMPLIANCE DISCLOSURE (Fades out in place as user scrolls down) */}
          <div
            className="absolute inset-x-0 text-center pointer-events-none px-4"
            style={{
              top: "var(--compliance-top)",
              opacity: "calc(max(0, 1 - (var(--p) * 2.8)))",
              willChange: "opacity",
            }}
          >
            <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 max-w-sm sm:max-w-xl mx-auto leading-normal sm:leading-relaxed text-center">
              Official public disclosure under Republic Act No. 10742
              <span className="block">(SK Reform Act of 2015)</span>
            </p>
          </div>
        </div>

        {/* -----------------------------------------------------------------------
            ROW 2: DEDICATED SEPARATE NAVIGATION BAR (DESKTOP ONLY)
            ----------------------------------------------------------------------- */}
        <div className="hidden md:block bg-slate-50/95 dark:bg-slate-950/85 backdrop-blur-md border-t border-slate-200/90 dark:border-slate-800/90">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            {/* Desktop Navigation */}
            <nav className="flex items-center justify-center gap-1.5 lg:gap-2 py-2 overflow-x-auto no-scrollbar">
              {DESKTOP_NAV_LINKS.map((link) => {
                const active = isActive(link.href);
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    prefetch={true}
                    scroll={false}
                    onClick={() => handleNavClick(link.href)}
                    className={`group inline-flex items-center gap-2 text-xs font-bold px-3.5 lg:px-4 py-2 rounded-lg transition-colors whitespace-nowrap ${
                      active
                        ? "bg-white dark:bg-slate-800 text-brand-700 dark:text-brand-300 shadow-xs border border-slate-200/90 dark:border-slate-700/90 font-extrabold"
                        : "text-slate-600 dark:text-slate-400 hover:text-brand-800 dark:hover:text-brand-300 hover:bg-brand-50/60 dark:hover:bg-slate-800/60"
                    }`}
                  >
                    <Icon
                      className={`w-3.5 h-3.5 shrink-0 relative -top-[1.5px] transition-colors ${
                        active
                          ? "text-brand-600 dark:text-brand-400"
                          : "text-slate-400 dark:text-slate-500 group-hover:text-brand-700 dark:group-hover:text-brand-300"
                      }`}
                      strokeWidth={active ? 2.5 : 2}
                    />
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      {/* =========================================================================
          MOBILE BOTTOM NAVIGATION BAR (FIXED DOCKED DOCK, NATIVE APP STYLE)
          Eliminates horizontal scrolling completely.
          Direct 1-tap navigation to all 4 primary public destinations in the thumb zone.
          ========================================================================= */}
      {/* Mobile Click-Outside Overlay when "Others" floating popup is open */}
      <div
        role="button"
        tabIndex={-1}
        aria-label="Close menu"
        onClick={() => setOthersMenuOpen(false)}
        onTouchMove={() => setOthersMenuOpen(false)}
        className={`fixed inset-0 z-40 md:hidden bg-transparent transition-all ${
          othersMenuOpen ? "pointer-events-auto" : "pointer-events-none"
        }`}
      />

      <nav
        aria-label="Mobile Navigation"
        className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] dark:shadow-[0_-4px_20px_rgba(0,0,0,0.45)] pb-[max(0.375rem,env(safe-area-inset-bottom))]"
        style={{
          WebkitTransform: "translate3d(0, 0, 0)",
          transform: "translate3d(0, 0, 0)",
          WebkitBackfaceVisibility: "hidden",
          backfaceVisibility: "hidden",
        }}
      >
        <div className="grid grid-cols-4 items-center h-15 max-w-md mx-auto px-1">
          {MOBILE_NAV_LINKS.map((link) => {
            const isOthers = link.href === "/others";
            const active = isActive(link.href);
            const Icon = isOthers && othersMenuOpen ? X : link.icon;
            const labelText = isOthers && othersMenuOpen ? "Close" : link.shortLabel;

            if (isOthers) {
              return (
                <div key={link.href} className="relative flex flex-col items-center justify-center py-1 px-1">
                  {/* Floating Speed Dial Options Popup with Enhanced Show/Hide Physics Animations */}
                  <div
                    role="menu"
                    aria-label="Other pages options"
                    aria-hidden={!othersMenuOpen}
                    className={`absolute bottom-[calc(100%+0.875rem)] left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 z-50 ${
                      othersMenuOpen ? "pointer-events-auto" : "pointer-events-none"
                    }`}
                  >
                    {OTHERS_POPUP_OPTIONS.map((option, idx) => {
                      const optionActive = isOptionActive(option.href);
                      const OptionIcon = option.icon;
                      // Index 0 is top button (Freedom Wall), index 1 is bottom button (Attendance, closest to dock)
                      const isBottomItem = idx === OTHERS_POPUP_OPTIONS.length - 1;
                      const openDelay = isBottomItem ? 0 : 75;
                      const closeDelay = isBottomItem ? 75 : 0;
                      const closeTranslateY = isBottomItem ? "translate-y-10" : "translate-y-16";

                      return (
                        <Link
                          key={option.href}
                          href={option.href}
                          prefetch={true}
                          scroll={false}
                          tabIndex={othersMenuOpen ? 0 : -1}
                          onClick={() => {
                            setOthersMenuOpen(false);
                            handleNavClick(option.href);
                          }}
                          className={`relative flex items-center justify-center group cursor-pointer touch-manipulation active:scale-95 ${
                            othersMenuOpen
                              ? "opacity-100 translate-y-0 scale-100 pointer-events-auto"
                              : `opacity-0 ${closeTranslateY} scale-50 pointer-events-none`
                          }`}
                          style={{
                            transitionProperty: "transform, opacity",
                            transitionDuration: othersMenuOpen ? "320ms" : "280ms",
                            transitionTimingFunction: othersMenuOpen
                              ? "cubic-bezier(0.34, 1.4, 0.64, 1)"
                              : "cubic-bezier(0.4, 0, 0.2, 1)",
                            transitionDelay: `${othersMenuOpen ? openDelay : closeDelay}ms`,
                          }}
                        >
                          {/* Label Pill on the Left */}
                          <span
                            className={`font-sans absolute right-[calc(100%+0.625rem)] top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-xl text-xs font-bold shadow-lg shadow-slate-900/15 dark:shadow-black/50 border whitespace-nowrap ${
                              othersMenuOpen
                                ? "opacity-100 translate-x-0 scale-100"
                                : "opacity-0 translate-x-4 scale-75"
                            } ${
                              optionActive
                                ? "bg-brand-50 dark:bg-brand-950 text-brand-700 dark:text-brand-300 border-brand-300 dark:border-brand-700 ring-1 ring-brand-500/25 font-extrabold"
                                : "bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 border-slate-200/90 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
                            }`}
                            style={{
                              transitionProperty: "transform, opacity",
                              transitionDuration: othersMenuOpen ? "280ms" : "220ms",
                              transitionTimingFunction: othersMenuOpen
                                ? "cubic-bezier(0.34, 1.3, 0.64, 1)"
                                : "cubic-bezier(0.4, 0, 0.2, 1)",
                              transitionDelay: `${othersMenuOpen ? openDelay + 30 : closeDelay}ms`,
                            }}
                          >
                            {option.label}
                          </span>

                          {/* Circular Floating Action Button */}
                          <div
                            className={`w-12 h-12 rounded-full flex items-center justify-center text-white shadow-xl border border-white/25 dark:border-brand-400/30 transition-all duration-200 group-hover:scale-105 group-active:scale-90 ${
                              optionActive
                                ? "bg-brand-700 dark:bg-brand-500 shadow-brand-950/35 ring-2 ring-brand-400/50"
                                : "bg-brand-600 hover:bg-brand-700 shadow-brand-900/25 dark:shadow-black/60"
                            }`}
                          >
                            <OptionIcon className="w-5 h-5 stroke-[2.2]" />
                          </div>
                        </Link>
                      );
                    })}
                  </div>

                  {/* Others Button in the Bar */}
                  <button
                    type="button"
                    onClick={() => setOthersMenuOpen((prev) => !prev)}
                    aria-expanded={othersMenuOpen}
                    aria-label={othersMenuOpen ? "Close other pages menu" : "Other pages menu"}
                    className="w-full flex flex-col items-center justify-center touch-manipulation select-none active:scale-95 transition-transform duration-75 group cursor-pointer"
                  >
                    <div
                      className={`flex flex-col items-center justify-center gap-0.5 w-full rounded-xl py-1 transition-colors ${
                        othersMenuOpen
                          ? "text-slate-900 dark:text-slate-100 font-extrabold"
                          : active
                          ? "text-brand-700 dark:text-brand-300 font-extrabold"
                          : "text-slate-500 dark:text-slate-400"
                      }`}
                    >
                      <div
                        className={`flex items-center justify-center w-8 h-8 rounded-xl transition-all duration-200 ${
                          othersMenuOpen
                            ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm scale-105"
                            : active
                            ? "bg-brand-50 dark:bg-brand-950/70 text-brand-600 dark:text-brand-400 shadow-2xs scale-105"
                            : "text-slate-500 dark:text-slate-400 group-active:text-slate-700 dark:group-active:text-slate-200"
                        }`}
                      >
                        <Icon
                          className={`w-5 h-5 transition-transform duration-200 ease-out ${
                            othersMenuOpen ? "rotate-90 stroke-[2.5]" : "rotate-0 stroke-2"
                          }`}
                        />
                      </div>
                      <span
                        className={`text-[10.5px] font-sans tracking-tight leading-none text-center transition-colors duration-200 ${
                          othersMenuOpen
                            ? "font-bold text-slate-900 dark:text-slate-100"
                            : active
                            ? "font-bold text-brand-700 dark:text-brand-300"
                            : "font-medium text-slate-500 dark:text-slate-400"
                        }`}
                      >
                        {labelText}
                      </span>
                    </div>
                  </button>
                </div>
              );
            }

            return (
              <Link
                key={link.href}
                href={link.href}
                prefetch={true}
                scroll={false}
                onClick={() => {
                  setOthersMenuOpen(false);
                  handleNavClick(link.href);
                }}
                className="relative flex flex-col items-center justify-center py-1 px-1 touch-manipulation select-none active:scale-95 transition-transform duration-75 group cursor-pointer"
                aria-current={active ? "page" : undefined}
              >
                <div
                  className={`flex flex-col items-center justify-center gap-0.5 w-full rounded-xl py-1 transition-colors ${
                    active ? "text-brand-700 dark:text-brand-300 font-extrabold" : "text-slate-500 dark:text-slate-400"
                  }`}
                >
                  <div
                    className={`flex items-center justify-center w-8 h-8 rounded-xl transition-all ${
                      active
                        ? "bg-brand-50 dark:bg-brand-950/70 text-brand-600 dark:text-brand-400 shadow-2xs scale-105"
                        : "text-slate-500 dark:text-slate-400 group-active:text-slate-700 dark:group-active:text-slate-200"
                    }`}
                  >
                    <Icon className="w-5 h-5" strokeWidth={active ? 2.5 : 2} />
                  </div>
                  <span
                    className={`text-[10.5px] font-sans tracking-tight leading-none text-center ${
                      active ? "font-bold text-brand-700 dark:text-brand-300" : "font-medium text-slate-500 dark:text-slate-400"
                    }`}
                  >
                    {link.shortLabel}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
