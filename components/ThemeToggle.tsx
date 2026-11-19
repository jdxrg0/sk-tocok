"use client";

import { useState, useRef, useEffect } from "react";
import { Sun, Moon, Monitor, Check, RotateCcw, Palette } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import {
  SURFACE_THEMES,
  SURFACE_THEME_MAP,
  ACCENT_THEMES,
  ACCENT_THEME_MAP,
} from "@/lib/themes";

interface ThemeToggleProps {
  className?: string;
}

const LIGHT_SURFACES = SURFACE_THEMES.filter((t) => t.group === "light");
const DARK_SURFACES = SURFACE_THEMES.filter((t) => t.group === "dark");

export function AppearanceControls({ showHeader = true }: { showHeader?: boolean }) {
  const {
    theme,
    resolvedTheme,
    accent,
    isCustomized,
    setTheme,
    setAccent,
    resetAppearance,
  } = useTheme();

  const activeAccentMeta = ACCENT_THEME_MAP[accent] ?? ACCENT_THEME_MAP["sk-green"];

  return (
    <div className="space-y-3 font-sans">
      {/* Popover Header */}
      {showHeader && (
        <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800 h-8">
          <div className="flex items-center gap-1.5">
            <Palette className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400 shrink-0" />
            <span className="text-xs font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
              Appearance
            </span>
          </div>
          <button
            type="button"
            onClick={resetAppearance}
            disabled={!isCustomized}
            className={`inline-flex items-center gap-1 h-6 text-[10.5px] font-bold px-1.5 rounded-md transition-colors ${
              isCustomized
                ? "text-slate-500 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                : "text-slate-300 dark:text-slate-600 opacity-50 cursor-default"
            }`}
            title="Reset to Auto theme and SK Green accent"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset</span>
          </button>
        </div>
      )}

      {/* Section 1: Auto (System) Toggle */}
      <button
        type="button"
        onClick={() => setTheme("system")}
        aria-pressed={theme === "system"}
        className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
          theme === "system"
            ? "bg-brand-50 dark:bg-brand-950/60 border-brand-300 dark:border-brand-700 text-brand-700 dark:text-brand-300 shadow-2xs"
            : "bg-slate-50/80 dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-700/70 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
        }`}
      >
        <span className="flex items-center gap-2 min-w-0">
          <Monitor className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">Auto (Device)</span>
        </span>
        <span className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-white/80 dark:bg-slate-900/80 border border-slate-200/70 dark:border-slate-700 text-slate-500 dark:text-slate-400">
            {resolvedTheme === "dark" ? "Dark" : "Light"}
          </span>
          {theme === "system" && (
            <Check className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
          )}
        </span>
      </button>

      {/* Section 2: Light Atmospheres */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-0.5">
          Light Themes
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {LIGHT_SURFACES.map((item) => {
            const isSelected = theme === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTheme(item.id)}
                aria-pressed={isSelected}
                className={`flex items-center justify-between gap-1.5 px-2 py-1.5 rounded-xl border text-left transition-all cursor-pointer ${
                  isSelected
                    ? "bg-brand-50 dark:bg-brand-950/50 border-brand-500 dark:border-brand-500 ring-1 ring-brand-500/25 shadow-2xs"
                    : "bg-slate-50/60 dark:bg-slate-800/50 border-slate-200/80 dark:border-slate-700/70 hover:border-slate-300 dark:hover:border-slate-600"
                }`}
              >
                <span className="flex items-center gap-2 min-w-0">
                  {/* Dual-tone mini surface preview chip */}
                  <span
                    className="w-5 h-5 rounded-md border shrink-0 flex items-end justify-end p-0.5 shadow-2xs"
                    style={{
                      backgroundColor: item.preview.canvas,
                      borderColor: item.preview.border,
                    }}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-[3px] border"
                      style={{
                        backgroundColor: item.preview.card,
                        borderColor: item.preview.border,
                      }}
                    />
                  </span>
                  <span
                    className={`text-[11px] font-bold truncate ${
                      isSelected
                        ? "text-brand-700 dark:text-brand-300"
                        : "text-slate-700 dark:text-slate-200"
                    }`}
                  >
                    {item.label}
                  </span>
                </span>
                {isSelected && (
                  <Check className="w-3 h-3 text-brand-600 dark:text-brand-400 shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Section 3: Dark Atmospheres */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-0.5">
          Dark Themes
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {DARK_SURFACES.map((item, idx) => {
            const isSelected = theme === item.id;
            const isFullSpan = DARK_SURFACES.length % 2 === 1 && idx === DARK_SURFACES.length - 1;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTheme(item.id)}
                aria-pressed={isSelected}
                className={`${isFullSpan ? "col-span-2" : ""} flex items-center justify-between gap-1.5 px-2 py-1.5 rounded-xl border text-left transition-all cursor-pointer ${
                  isSelected
                    ? "bg-brand-50 dark:bg-brand-950/50 border-brand-500 dark:border-brand-500 ring-1 ring-brand-500/25 shadow-2xs"
                    : "bg-slate-50/60 dark:bg-slate-800/50 border-slate-200/80 dark:border-slate-700/70 hover:border-slate-300 dark:hover:border-slate-600"
                }`}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-5 h-5 rounded-md border shrink-0 flex items-end justify-end p-0.5 shadow-2xs"
                    style={{
                      backgroundColor: item.preview.canvas,
                      borderColor: item.preview.border,
                    }}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-[3px] border"
                      style={{
                        backgroundColor: item.preview.card,
                        borderColor: item.preview.border,
                      }}
                    />
                  </span>
                  <span
                    className={`text-[11px] font-bold truncate ${
                      isSelected
                        ? "text-brand-700 dark:text-brand-300"
                        : "text-slate-700 dark:text-slate-200"
                    }`}
                  >
                    {item.label}
                  </span>
                </span>
                {isSelected && (
                  <Check className="w-3 h-3 text-brand-600 dark:text-brand-400 shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Section 4: Accent Color Swatches */}
      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
        <div className="flex items-center justify-between px-0.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Accent Color
          </p>
          <span className="text-[10.5px] font-bold text-brand-700 dark:text-brand-300">
            {activeAccentMeta.label}
          </span>
        </div>
        <div className="flex items-center justify-between gap-1.5 px-1.5 py-0.5">
          {ACCENT_THEMES.map((item) => {
            const isSelected = accent === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setAccent(item.id)}
                aria-label={`${item.label} accent color`}
                aria-pressed={isSelected}
                title={item.label}
                className={`relative w-8 h-8 rounded-full flex items-center justify-center transition-transform cursor-pointer active:scale-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-brand-500 dark:focus-visible:ring-offset-slate-900 ${
                  isSelected
                    ? "scale-110 ring-2 ring-offset-2 ring-slate-900 dark:ring-slate-100 ring-offset-slate-50 dark:ring-offset-slate-900 shadow-sm"
                    : "hover:scale-105 opacity-90 hover:opacity-100"
                }`}
                style={{ backgroundColor: item.swatchHex }}
              >
                {isSelected && (
                  <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function ThemeToggle({ className = "" }: ThemeToggleProps) {
  const {
    theme,
    resolvedSurface,
    resolvedTheme,
    accent,
    mounted,
  } = useTheme();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  if (!mounted) {
    return (
      <div
        className={`w-9 h-9 md:w-[92px] md:h-9 rounded-xl border border-slate-200/90 dark:border-slate-700/80 bg-slate-50/90 dark:bg-slate-800/80 shrink-0 ${className}`}
        aria-hidden="true"
      />
    );
  }

  const activeSurfaceMeta = SURFACE_THEME_MAP[resolvedSurface] ?? SURFACE_THEME_MAP.light;
  const activeAccentMeta = ACCENT_THEME_MAP[accent] ?? ACCENT_THEME_MAP["sk-green"];

  const ActiveIcon = theme === "system" ? Monitor : resolvedTheme === "dark" ? Moon : Sun;
  const triggerText = theme === "system" ? "Auto" : activeSurfaceMeta.label;
  const ariaSummary = `Appearance: ${triggerText}, ${activeAccentMeta.label} accent. Click to customize.`;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaSummary}
        title={`Theme: ${triggerText} • Accent: ${activeAccentMeta.label}`}
        className="relative h-9 w-9 md:w-auto md:px-2.5 inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200/90 dark:border-slate-700/80 bg-slate-50/90 hover:bg-slate-100 dark:bg-slate-800/85 dark:hover:bg-slate-700/90 text-slate-700 dark:text-slate-200 shadow-2xs transition-colors cursor-pointer select-none active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        <ActiveIcon
          className={`w-4 h-4 shrink-0 ${
            resolvedTheme === "dark"
              ? "text-amber-300"
              : theme === "system"
              ? "text-brand-600 dark:text-brand-400"
              : "text-amber-500"
          }`}
        />
        <span className="hidden md:inline text-[11px] font-bold tracking-tight whitespace-nowrap">
          {triggerText}
        </span>
        {/* Live Accent Color Indicator Dot */}
        <span
          className="absolute bottom-1 right-1 md:static w-2 h-2 rounded-full ring-1 ring-white dark:ring-slate-900 shrink-0"
          style={{
            backgroundColor:
              resolvedTheme === "dark"
                ? activeAccentMeta.darkPrimaryHex
                : activeAccentMeta.lightPrimaryHex,
          }}
        />
      </button>

      {/* Appearance Popover */}
      {open && (
        <div
          role="dialog"
          aria-label="Appearance and color settings"
          className="absolute right-0 mt-2 w-[276px] sm:w-[304px] max-h-[calc(100dvh-84px)] overflow-y-auto themed-scrollbar rounded-2xl border border-slate-200 dark:border-slate-700/90 bg-white dark:bg-slate-900 shadow-2xl dark:shadow-black/70 p-3 z-[70]"
        >
          <AppearanceControls showHeader={true} />
        </div>
      )}
    </div>
  );
}
