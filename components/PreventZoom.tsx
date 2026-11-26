"use client";

import { useEffect } from "react";

const INTERACTIVE_SELECTOR =
  'a, button, input, select, textarea, label, [role="button"], [contenteditable="true"]';

function isHorizontallyScrollable(target: EventTarget | null): boolean {
  let el = target instanceof Element ? target : null;
  while (el && el !== document.documentElement) {
    const style = window.getComputedStyle(el);
    const overflowX = style.overflowX;
    if (
      (overflowX === "auto" || overflowX === "scroll") &&
      el.scrollWidth > el.clientWidth
    ) {
      return true;
    }
    el = el.parentElement;
  }
  return false;
}

export default function PreventZoom() {
  useEffect(() => {
    const isIOS =
      /iP(hone|ad|od)/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

    let edgeTouchStart: { x: number; y: number } | null = null;

    const handleGesture = (e: Event) => e.preventDefault();
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) e.preventDefault();
    };
    const handleKeydown = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === "+" || e.key === "-" || e.key === "=" || e.key === "_")
      ) {
        e.preventDefault();
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) {
        edgeTouchStart = null;
        return;
      }

      const touch = e.touches[0];
      const x = touch.clientX;
      const y = touch.clientY;

      if (x <= 32 && !isHorizontallyScrollable(e.target)) {
        edgeTouchStart = { x, y };
      } else {
        edgeTouchStart = null;
      }

      // iOS Safari decides edge-swipe history navigation on touchstart in the outer ~20px.
      // Avoid blocking taps/focus on interactive controls or horizontal scrollers.
      if (
        isIOS &&
        x <= 20 &&
        !(e.target instanceof Element && e.target.closest(INTERACTIVE_SELECTOR)) &&
        !isHorizontallyScrollable(e.target)
      ) {
        e.preventDefault();
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!edgeTouchStart || e.touches.length !== 1) return;
      const touch = e.touches[0];
      const dx = touch.clientX - edgeTouchStart.x;
      const dy = touch.clientY - edgeTouchStart.y;

      if (Math.abs(dy) > 10 && Math.abs(dy) >= Math.abs(dx)) {
        edgeTouchStart = null;
        return;
      }

      if (dx > 8 && dx > Math.abs(dy)) {
        e.preventDefault();
      }
    };

    const clearEdgeTouch = () => {
      edgeTouchStart = null;
    };

    document.addEventListener("touchstart", handleTouchStart, { passive: false });
    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.addEventListener("touchend", clearEdgeTouch, { passive: true });
    document.addEventListener("touchcancel", clearEdgeTouch, { passive: true });
    document.addEventListener("gesturestart", handleGesture);
    document.addEventListener("gesturechange", handleGesture);
    document.addEventListener("gestureend", handleGesture);
    window.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("keydown", handleKeydown);

    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", clearEdgeTouch);
      document.removeEventListener("touchcancel", clearEdgeTouch);
      document.removeEventListener("gesturestart", handleGesture);
      document.removeEventListener("gesturechange", handleGesture);
      document.removeEventListener("gestureend", handleGesture);
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("keydown", handleKeydown);
    };
  }, []);

  return null;
}
