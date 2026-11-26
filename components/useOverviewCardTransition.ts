"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type MouseEvent } from "react";

const EXIT_DURATION_MS = 145;
const SAFETY_RESET_MS = 600;

let pendingScrollReset = false;

function getPathnameOnly(href: string): string {
  return href.split(/[?#]/)[0] || "/";
}

export function markPendingScrollReset() {
  pendingScrollReset = true;
}

export function consumePendingScrollReset(): boolean {
  if (!pendingScrollReset) return false;
  pendingScrollReset = false;
  return true;
}

export function clearPageExitClasses() {
  if (typeof document === "undefined") return;
  document.querySelectorAll(".page-exit-to-transparency").forEach((el) => {
    el.classList.remove("page-exit-to-transparency");
  });
}

/**
 * Triggers a smooth page-exit animation on `.page-enter` before executing `navigate`
 * when transitioning to a different route pathname.
 */
export function triggerPageTransition(
  currentPathname: string | null | undefined,
  targetHref: string,
  navigate: () => void
): ReturnType<typeof setTimeout> | null {
  const targetPathname = getPathnameOnly(targetHref);
  const isCrossRoute = currentPathname !== targetPathname;

  const runNavigate = () => {
    if (isCrossRoute) {
      markPendingScrollReset();
    }
    navigate();
  };

  if (
    typeof window === "undefined" ||
    !isCrossRoute ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    runNavigate();
    return null;
  }

  const pageWrapper = document.querySelector(".page-enter");
  if (!pageWrapper) {
    runNavigate();
    return null;
  }

  pageWrapper.classList.add("page-exit-to-transparency");

  const safetyTimer = setTimeout(() => {
    pageWrapper.classList.remove("page-exit-to-transparency");
  }, SAFETY_RESET_MS);

  return setTimeout(() => {
    clearTimeout(safetyTimer);
    runNavigate();
  }, EXIT_DURATION_MS);
}

/**
 * Coordinates an exit fade/slide on the Overview wrapper before navigating
 * to a destination page via Next.js App Router.
 */
export function useOverviewCardTransition() {
  const router = useRouter();
  const pathname = usePathname();
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [navigatingHref, setNavigatingHref] = useState<string | null>(null);

  useEffect(() => {
    const resetTransitionState = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setNavigatingHref(null);
      clearPageExitClasses();
    };

    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        resetTransitionState();
      }
    };

    window.addEventListener("pageshow", handlePageShow);
    return () => {
      window.removeEventListener("pageshow", handlePageShow);
      resetTransitionState();
    };
  }, []);

  const handleCardClick = (e: MouseEvent<HTMLAnchorElement>, href: string) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
      return;
    }

    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      if (pathname !== getPathnameOnly(href)) {
        markPendingScrollReset();
      }
      return;
    }

    e.preventDefault();
    if (navigatingHref) return;

    setNavigatingHref(href);
    timerRef.current = triggerPageTransition(pathname, href, () => {
      timerRef.current = null;
      router.push(href);
    });
  };

  return { containerRef, navigatingHref, handleCardClick };
}
