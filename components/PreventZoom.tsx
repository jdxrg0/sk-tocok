"use client";

import { useEffect } from "react";

export default function PreventZoom() {
  useEffect(() => {
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

    const handleTouchStart = () => {};
    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("gesturestart", handleGesture);
    document.addEventListener("gesturechange", handleGesture);
    document.addEventListener("gestureend", handleGesture);
    window.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("keydown", handleKeydown);

    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("gesturestart", handleGesture);
      document.removeEventListener("gesturechange", handleGesture);
      document.removeEventListener("gestureend", handleGesture);
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("keydown", handleKeydown);
    };
  }, []);

  return null;
}
