"use client";

import { useState, type CSSProperties } from "react";

/**
 * Returns a directional horizontal slide CSS class (`tab-panel-slide-next` or
 * `tab-panel-slide-prev`) whenever `activeTab` changes relative to `tabOrder`.
 * Returns an empty string on initial mount so `page-enter` handles route entry cleanly.
 */
export function useTabPanelDirection<T extends string>(
  activeTab: T,
  tabOrder: readonly T[]
): string {
  const [prevTab, setPrevTab] = useState<T>(activeTab);
  const [animClass, setAnimClass] = useState<string>("");

  if (activeTab !== prevTab) {
    const prevIdx = tabOrder.indexOf(prevTab);
    const nextIdx = tabOrder.indexOf(activeTab);
    setPrevTab(activeTab);
    if (prevIdx !== -1 && nextIdx !== -1 && prevIdx !== nextIdx) {
      setAnimClass(
        nextIdx > prevIdx ? "tab-panel-slide-next" : "tab-panel-slide-prev"
      );
    } else {
      setAnimClass("tab-panel-slide-next");
    }
  }

  return animClass;
}

/**
 * Computes CSS positioning and transform for a sliding pill inside an equal-column
 * horizontal CSS grid tablist (`grid-cols-N`).
 */
export function getHorizontalPillStyle(
  count: number,
  activeIndex: number,
  padRem = 0.25,
  gapRem = 0.25
): CSSProperties {
  const safeCount = Math.max(1, count);
  const safeIdx = Math.max(0, Math.min(activeIndex, safeCount - 1));
  const totalPadRem = padRem * 2;
  const totalGapRem = Math.max(0, safeCount - 1) * gapRem;

  return {
    left: `${padRem}rem`,
    width: `calc((100% - ${totalPadRem}rem - ${totalGapRem}rem) / ${safeCount})`,
    transform: `translateX(calc(${safeIdx} * (100% + ${gapRem}rem)))`,
  };
}

/**
 * Computes CSS positioning and transform for a sliding pill inside a vertical
 * icon rail (`flex-col`).
 */
export function getVerticalRailPillStyle(
  activeIndex: number,
  padRem = 0.375,
  itemRem = 2.75,
  gapRem = 0.375
): CSSProperties {
  const safeIdx = Math.max(0, activeIndex);
  return {
    top: `${padRem}rem`,
    left: `${padRem}rem`,
    width: `${itemRem}rem`,
    height: `${itemRem}rem`,
    transform: `translateY(calc(${safeIdx} * (${itemRem}rem + ${gapRem}rem)))`,
  };
}
