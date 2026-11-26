"use client";

import Link from "next/link";
import { useState, useEffect, useRef, useCallback, type MouseEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Home, Landmark, Printer, LayoutGrid, ClipboardCheck, MessageSquareQuote, X, Award, Compass } from "lucide-react";
import AccountMenu from "@/components/AccountMenu";
import {
  clearPageExitClasses,
  consumePendingScrollReset,
  triggerPageTransition,
} from "@/components/useOverviewCardTransition";

const DESKTOP_NAV_LINKS = [
  { href: "/", label: "Overview", icon: Home },
  { href: "/transparency", label: "Finances", icon: Landmark },
  { href: "/printing", label: "Printing", icon: Printer },
  { href: "/cse", label: "CSE Subsidy", icon: Award },
  { href: "/attendance", label: "Attendance", icon: ClipboardCheck },
  { href: "/messages", label: "Bumo-Boses", icon: MessageSquareQuote },
];

const MOBILE_NAV_LINKS = [
  { href: "/", label: "Overview", shortLabel: "Overview", icon: Home },
  { href: "/transparency", label: "Finances", shortLabel: "Finances", icon: Landmark },
  { href: "/attendance", label: "Attendance", shortLabel: "Attendance", icon: ClipboardCheck },
  { href: "/others", label: "Others", shortLabel: "Others", icon: LayoutGrid },
];

const OTHERS_POPUP_OPTIONS = [
  { href: "/cse", label: "Free CSE Subsidy", icon: Award },
  { href: "/messages", label: "Bumo-Boses", icon: MessageSquareQuote },
  { href: "/printing", label: "Student Printing", icon: Printer },
];

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [othersMenuOpen, setOthersMenuOpen] = useState(false);
  const [desktopNavOpen, setDesktopNavOpen] = useState(false);

  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const navTransitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastClickTimeRef = useRef<number>(0);

  // Clear optimistic pending state, click timer, and close menus whenever route changes
  useEffect(() => {
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
    }
    if (navTransitionTimerRef.current) {
      clearTimeout(navTransitionTimerRef.current);
      navTransitionTimerRef.current = null;
    }
    clearPageExitClasses();
    setPendingHref(null);
    setOthersMenuOpen(false);
    setDesktopNavOpen(false);

    if (consumePendingScrollReset()) {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }
  }, [pathname]);

  // Clean up click timeout on unmount
  useEffect(() => {
    return () => {
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
      }
      if (navTransitionTimerRef.current) {
        clearTimeout(navTransitionTimerRef.current);
      }
    };
  }, []);

  // Lock background scroll and suppress in-page floating action buttons when any navigation speed-dial is open
  useEffect(() => {
    if (othersMenuOpen || desktopNavOpen) {
      document.documentElement.dataset.navMenuOpen = "true";
      const prevHtmlOverflow = document.documentElement.style.overflow;
      const prevBodyOverflow = document.body.style.overflow;
      document.documentElement.style.overflow = "hidden";
      document.body.style.overflow = "hidden";

      return () => {
        delete document.documentElement.dataset.navMenuOpen;
        document.documentElement.style.overflow = prevHtmlOverflow;
        document.body.style.overflow = prevBodyOverflow;
      };
    } else {
      delete document.documentElement.dataset.navMenuOpen;
    }
  }, [othersMenuOpen, desktopNavOpen]);

  // Close floating options popups on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOthersMenuOpen(false);
        setDesktopNavOpen(false);
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
      (currentPath.startsWith("/printing") ||
        currentPath.startsWith("/track") ||
        currentPath.startsWith("/messages") ||
        currentPath.startsWith("/cse") ||
        currentPath === "/others")
    ) {
      return true;
    }
    return currentPath.startsWith(path);
  };

  const isOptionActive = (href: string) => {
    if (href === "/") {
      return currentPath === "/";
    }
    if (href === "/printing" && currentPath?.startsWith("/track")) {
      return true;
    }
    if (href === "/others") {
      return currentPath === "/others";
    }
    return currentPath?.startsWith(href) ?? false;
  };

  const handleNavClick = (
    e: MouseEvent<HTMLAnchorElement>,
    href: string,
    closeMenus?: () => void
  ) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
      closeMenus?.();
      return;
    }

    e.preventDefault();
    closeMenus?.();
    setPendingHref(href);

    if (navTransitionTimerRef.current) {
      clearTimeout(navTransitionTimerRef.current);
    }
    navTransitionTimerRef.current = triggerPageTransition(pathname, href, () => {
      navTransitionTimerRef.current = null;
      router.push(href);
    });
  };

  // Directly navigate to Overview (or scroll smoothly to top if already there) on double-tap
  const goToOverview = useCallback(() => {
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
    }
    lastClickTimeRef.current = 0;
    setDesktopNavOpen(false);
    setPendingHref("/");

    if (pathname === "/") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      if (navTransitionTimerRef.current) {
        clearTimeout(navTransitionTimerRef.current);
      }
      navTransitionTimerRef.current = triggerPageTransition(pathname, "/", () => {
        navTransitionTimerRef.current = null;
        router.push("/");
      });
    }
  }, [pathname, router]);

  // Handle single-tap to toggle navigation speed-dial, double-tap to jump directly to Overview
  const handleFabClick = () => {
    const now = Date.now();
    const timeSinceLastClick = now - lastClickTimeRef.current;

    // Double-tap threshold (< 350ms)
    if (timeSinceLastClick > 0 && timeSinceLastClick < 350) {
      goToOverview();
      return;
    }

    lastClickTimeRef.current = now;

    // If menu is already open, closing it is instantaneous
    if (desktopNavOpen) {
      setDesktopNavOpen(false);
      return;
    }

    // When menu is closed, debounce opening slightly (220ms) so rapid double-tap doesn't flash the menu
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
    }
    clickTimeoutRef.current = setTimeout(() => {
      setDesktopNavOpen(true);
      clickTimeoutRef.current = null;
    }, 220);
  };

  const handleFabDoubleClick = () => {
    goToOverview();
  };

  return (
    <>
      {/* =========================================================================
          STATIC PLACEHOLDER SPACER IN DOCUMENT FLOW
          Matches the fixed header height. Content underneath stays static in flow.
          ========================================================================= */}
      <div
        className="w-full shrink-0 pointer-events-none"
        style={{ height: "var(--header-spacer-h)" }}
        aria-hidden="true"
      />

      {/* =========================================================================
          FIXED STICKY HEADER
          Pins cleanly to top: 0 with no expand/collapse animation.
          ========================================================================= */}
      <header
        className="fixed top-0 left-0 right-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-xs dark:shadow-slate-950/40 border-b border-slate-200/90 dark:border-slate-800/90"
        style={{
          paddingTop: "env(safe-area-inset-top, 0px)",
        }}
      >
        {/* ROW 1: BRAND HEADER */}
        <div
          className="relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between"
          style={{ height: "var(--brand-h)" }}
        >
          {/* Left: SK Circular Seal (Static display, non-clickable) */}
          <div
            className="relative z-20 shrink-0 flex items-center justify-center rounded-full select-none"
            style={{
              width: "var(--logo-size)",
              height: "var(--logo-size)",
            }}
          >
            <div className="w-full h-full rounded-full border-2 border-brand-600/80 dark:border-brand-500/80 overflow-hidden shadow-xs bg-[#ffffff] ring-2 ring-brand-500/20 dark:ring-brand-400/25 flex items-center justify-center">
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
          </div>

          {/* Center: Jurisdiction, Primary Identity, and Subtitle */}
          <div className="absolute inset-x-0 mx-auto flex flex-col items-center justify-center text-center pointer-events-none px-14 sm:px-20">
            {/* Kicker: San Fabian, Pangasinan */}
            <p className="text-[8.5px] sm:text-[9.5px] font-semibold uppercase tracking-wider sm:tracking-widest text-slate-500 dark:text-slate-400 whitespace-nowrap leading-tight">
              San Fabian, Pangasinan
            </p>

            {/* Primary Identity: SK Tocok */}
            <h1 className="text-base sm:text-lg lg:text-xl font-black tracking-tight leading-tight whitespace-nowrap pt-0.5">
              <span className="text-[#023baf] dark:text-[#60a5fa]">S</span>
              <span className="text-[#e0001a] dark:text-[#f87171]">K</span>{" "}
              <span className="text-brand-800 dark:text-brand-200">Tocok</span>
            </h1>

            {/* Portal Subtitle */}
            <p className="text-[9.5px] sm:text-[11px] font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap pt-0.5 leading-tight">
              Transparency &amp; Service Portal
            </p>
          </div>

          {/* Right: Account Menu */}
          <div
            className="relative z-20 shrink-0 flex items-center justify-center"
            style={{
              width: "var(--logo-size)",
              height: "var(--logo-size)",
            }}
          >
            <AccountMenu />
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
                      // Stagger animations from bottom (closest to dock) to top
                      const reverseIdx = OTHERS_POPUP_OPTIONS.length - 1 - idx;
                      const openDelay = reverseIdx * 50;
                      const closeDelay = idx * 40;
                      const closeTranslateY = idx === 0 ? "translate-y-20" : idx === 1 ? "translate-y-14" : "translate-y-8";

                      return (
                        <Link
                          key={option.href}
                          href={option.href}
                          prefetch={true}
                          tabIndex={othersMenuOpen ? 0 : -1}
                          onClick={(e) =>
                            handleNavClick(e, option.href, () =>
                              setOthersMenuOpen(false)
                            )
                          }
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
                onClick={(e) =>
                  handleNavClick(e, link.href, () => setOthersMenuOpen(false))
                }
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

      {/* =========================================================================
          DESKTOP FLOATING NAVIGATION (SPEED-DIAL FAB IN BOTTOM-RIGHT CORNER)
          Replaces the horizontal header navigation bar with sleek floating icons.
          ========================================================================= */}
      {/* Desktop Click-Outside Overlay */}
      <div
        role="button"
        tabIndex={-1}
        aria-label="Close navigation menu"
        onClick={() => setDesktopNavOpen(false)}
        onWheel={(e) => e.preventDefault()}
        onTouchMove={(e) => e.preventDefault()}
        className={`fixed inset-0 z-40 hidden md:block bg-slate-900/15 dark:bg-black/35 backdrop-blur-[1.5px] overscroll-none touch-none transition-opacity duration-200 ${
          desktopNavOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      />

      <div
        data-nav-fab
        className="fixed right-6 md:right-8 bottom-6 md:bottom-8 z-40 hidden md:flex flex-col items-end pointer-events-auto select-none"
      >
        {/* Speed-Dial Options Menu */}
        <div
          role="menu"
          aria-label="Navigation pages"
          aria-hidden={!desktopNavOpen}
          className={`absolute bottom-[calc(100%+0.875rem)] right-0 flex flex-col items-end gap-3 z-50 ${
            desktopNavOpen ? "pointer-events-auto" : "pointer-events-none"
          }`}
        >
          {DESKTOP_NAV_LINKS.map((link, idx) => {
            const linkActive = isOptionActive(link.href);
            const LinkIcon = link.icon;
            const reverseIdx = DESKTOP_NAV_LINKS.length - 1 - idx;
            const openDelay = reverseIdx * 45;
            const closeDelay = idx * 30;

            return (
              <Link
                key={link.href}
                href={link.href}
                prefetch={true}
                tabIndex={desktopNavOpen ? 0 : -1}
                onClick={(e) =>
                  handleNavClick(e, link.href, () => setDesktopNavOpen(false))
                }
                className={`relative flex items-center justify-end group cursor-pointer touch-manipulation active:scale-95 ${
                  desktopNavOpen
                    ? "opacity-100 translate-y-0 scale-100 pointer-events-auto"
                    : "opacity-0 translate-y-8 scale-50 pointer-events-none"
                }`}
                style={{
                  transitionProperty: "transform, opacity",
                  transitionDuration: desktopNavOpen ? "300ms" : "240ms",
                  transitionTimingFunction: desktopNavOpen
                    ? "cubic-bezier(0.34, 1.4, 0.64, 1)"
                    : "cubic-bezier(0.4, 0, 0.2, 1)",
                  transitionDelay: `${desktopNavOpen ? openDelay : closeDelay}ms`,
                }}
              >
                {/* Label Pill on the Left */}
                <span
                  className={`font-sans mr-3 px-3.5 py-1.5 rounded-xl text-xs font-bold shadow-lg shadow-slate-900/15 dark:shadow-black/50 border whitespace-nowrap transition-all duration-150 ${
                    desktopNavOpen
                      ? "opacity-100 translate-x-0 scale-100"
                      : "opacity-0 translate-x-4 scale-75"
                  } ${
                    linkActive
                      ? "bg-brand-50 dark:bg-brand-950 text-brand-700 dark:text-brand-300 border-brand-300 dark:border-brand-700 ring-1 ring-brand-500/25 font-extrabold"
                      : "bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 border-slate-200/90 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-brand-700 dark:hover:text-brand-300"
                  }`}
                >
                  {link.label}
                </span>

                {/* Circular Floating Action Button */}
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center text-white shadow-xl border border-white/25 dark:border-brand-400/30 transition-all duration-200 group-hover:scale-110 group-active:scale-90 ${
                    linkActive
                      ? "bg-brand-700 dark:bg-brand-500 shadow-brand-950/35 ring-2 ring-brand-400/50"
                      : "bg-brand-600 hover:bg-brand-700 shadow-brand-900/25 dark:shadow-black/60"
                  }`}
                >
                  <LinkIcon className="w-5 h-5 stroke-[2.2]" />
                </div>
              </Link>
            );
          })}
        </div>

        {/* Primary Navigation FAB Trigger */}
        <button
          type="button"
          onClick={handleFabClick}
          onDoubleClick={handleFabDoubleClick}
          aria-expanded={desktopNavOpen}
          aria-label={desktopNavOpen ? "Close navigation menu" : "Navigation menu (Double-tap for Overview)"}
          title={desktopNavOpen ? "Close navigation menu" : "Navigation menu — Double-tap for Overview"}
          className="relative w-14 h-14 md:w-13 md:h-13 rounded-full bg-brand-600 hover:bg-brand-700 text-white shadow-xl md:shadow-lg shadow-brand-950/25 hover:shadow-brand-900/35 border-2 border-white/20 dark:border-brand-400/25 flex items-center justify-center cursor-pointer hover:scale-105 active:scale-90 transition-all duration-200 group focus:outline-none focus:ring-4 focus:ring-brand-500/30 select-none touch-manipulation"
        >
          <div
            className={`transition-transform duration-250 ease-out ${
              desktopNavOpen ? "rotate-90 scale-105" : "rotate-0 scale-100 group-hover:rotate-45"
            }`}
          >
            {desktopNavOpen ? (
              <X className="w-6 h-6 stroke-[2.5]" />
            ) : (
              <Compass className="w-6 h-6 stroke-[2.2]" />
            )}
          </div>
        </button>
      </div>
    </>
  );
}
