"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";
import {
  type SurfaceThemeId,
  type ThemePreference,
  type AccentId,
  type ChartColors,
  THEME_STORAGE_KEY,
  ACCENT_STORAGE_KEY,
  SURFACE_THEME_MAP,
  isValidThemePreference,
  isValidAccentId,
  getChartColors,
} from "@/lib/themes";
import { useAuth } from "@/components/AuthProvider";

export type { SurfaceThemeId, ThemePreference, AccentId, ChartColors };
export type ResolvedTheme = "light" | "dark";
export type SyncStatus = "idle" | "saving" | "saved";

interface ThemeContextValue {
  theme: ThemePreference;
  resolvedSurface: SurfaceThemeId;
  resolvedTheme: ResolvedTheme;
  accent: AccentId;
  chartColors: ChartColors;
  isCustomized: boolean;
  syncStatus: SyncStatus;
  setTheme: (next: ThemePreference) => void;
  setAccent: (next: AccentId) => void;
  resetAppearance: () => void;
  mounted: boolean;
}

const DEFAULT_CHART_COLORS = getChartColors("light", "sk-green");

const ThemeContext = createContext<ThemeContextValue>({
  theme: "system",
  resolvedSurface: "light",
  resolvedTheme: "light",
  accent: "sk-green",
  chartColors: DEFAULT_CHART_COLORS,
  isCustomized: false,
  syncStatus: "idle",
  setTheme: () => {},
  setAccent: () => {},
  resetAppearance: () => {},
  mounted: false,
});

function getSystemSurface(): SurfaceThemeId {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function readStoredTheme(): ThemePreference {
  if (typeof window === "undefined") return "system";
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (isValidThemePreference(raw)) return raw;
  } catch {}
  return "system";
}

function readStoredAccent(): AccentId {
  if (typeof window === "undefined") return "sk-green";
  try {
    const raw = window.localStorage.getItem(ACCENT_STORAGE_KEY);
    if (isValidAccentId(raw)) return raw;
  } catch {}
  return "sk-green";
}

function resolveSurface(pref: ThemePreference): SurfaceThemeId {
  return pref === "system" ? getSystemSurface() : pref;
}

function applyAppearanceToDOM(
  surface: SurfaceThemeId,
  accent: AccentId,
  suppressTransitions = false
) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const meta = SURFACE_THEME_MAP[surface] ?? SURFACE_THEME_MAP.light;

  if (suppressTransitions) {
    root.classList.add("theme-transitioning");
  }

  root.dataset.theme = surface;
  root.dataset.accent = accent;
  root.classList.toggle("dark", meta.isDark);
  root.style.colorScheme = meta.isDark ? "dark" : "light";

  let themeColorMeta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
  if (!themeColorMeta) {
    themeColorMeta = document.createElement("meta");
    themeColorMeta.name = "theme-color";
    document.head.appendChild(themeColorMeta);
  }
  themeColorMeta.content = meta.metaThemeColor;

  if (suppressTransitions) {
    void root.offsetHeight;
    window.requestAnimationFrame(() => {
      root.classList.remove("theme-transitioning");
    });
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { user, updateUserPreferences } = useAuth();
  const [theme, setThemeState] = useState<ThemePreference>("system");
  const [resolvedSurface, setResolvedSurface] = useState<SurfaceThemeId>("light");
  const [accent, setAccentState] = useState<AccentId>("sk-green");
  const [mounted, setMounted] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");

  // Track which user ID has already been hydrated from DB and manage debounced saves
  const syncedUserIdRef = useRef<number | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveSeqRef = useRef(0);
  const userRef = useRef(user);
  userRef.current = user;

  // Persist appearance to the signed-in user's account in the database (debounced, latest-wins)
  const persistToAccount = useCallback(
    (nextTheme: ThemePreference, nextAccent: AccentId) => {
      if (!userRef.current) return;

      updateUserPreferences(nextTheme, nextAccent);
      setSyncStatus("saving");

      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }

      const seq = ++saveSeqRef.current;
      saveTimerRef.current = setTimeout(async () => {
        try {
          const res = await fetch("/api/auth/preferences", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              theme_preference: nextTheme,
              accent_preference: nextAccent,
            }),
          });
          if (seq === saveSeqRef.current) {
            setSyncStatus(res.ok ? "saved" : "idle");
          }
        } catch {
          if (seq === saveSeqRef.current) {
            setSyncStatus("idle");
          }
        }
      }, 180);
    },
    [updateUserPreferences]
  );

  // Cleanup pending debounce timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  // Sync initial preference from localStorage & DOM on mount
  useEffect(() => {
    const storedTheme = readStoredTheme();
    const storedAccent = readStoredAccent();
    const surface = resolveSurface(storedTheme);
    setThemeState(storedTheme);
    setResolvedSurface(surface);
    setAccentState(storedAccent);
    applyAppearanceToDOM(surface, storedAccent, false);
    setMounted(true);
  }, []);

  // Sync theme/accent with signed-in user account whenever user logs in or switches accounts
  useEffect(() => {
    if (!mounted) return;

    if (!user) {
      syncedUserIdRef.current = null;
      setSyncStatus("idle");
      return;
    }

    if (syncedUserIdRef.current === user.id) return;
    syncedUserIdRef.current = user.id;

    const hasAccountTheme = isValidThemePreference(user.theme_preference);
    const hasAccountAccent = isValidAccentId(user.accent_preference);

    if (hasAccountTheme || hasAccountAccent) {
      // Account already has saved preferences — apply them & update localStorage cache
      const nextTheme: ThemePreference = hasAccountTheme
        ? (user.theme_preference as ThemePreference)
        : "system";
      const nextAccent: AccentId = hasAccountAccent
        ? (user.accent_preference as AccentId)
        : "sk-green";

      const currentTheme = readStoredTheme();
      const currentAccent = readStoredAccent();
      const nextSurface = resolveSurface(nextTheme);

      setThemeState(nextTheme);
      setResolvedSurface(nextSurface);
      setAccentState(nextAccent);
      setSyncStatus("saved");

      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
        window.localStorage.setItem(ACCENT_STORAGE_KEY, nextAccent);
      } catch {}

      if (nextTheme !== currentTheme || nextAccent !== currentAccent) {
        applyAppearanceToDOM(nextSurface, nextAccent, true);
      }
    } else {
      // First time on this account — carry over any custom guest preference already picked on this device
      const localTheme = readStoredTheme();
      const localAccent = readStoredAccent();
      if (localTheme !== "system" || localAccent !== "sk-green") {
        persistToAccount(localTheme, localAccent);
      }
    }
  }, [mounted, user, persistToAccount]);

  // Listen to OS color-scheme changes when theme === "system"
  useEffect(() => {
    if (!mounted) return;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleMediaChange = () => {
      if (theme === "system") {
        const nextSurface: SurfaceThemeId = mediaQuery.matches ? "dark" : "light";
        setResolvedSurface(nextSurface);
        applyAppearanceToDOM(nextSurface, accent, true);
      }
    };

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleMediaChange);
      return () => mediaQuery.removeEventListener("change", handleMediaChange);
    } else {
      mediaQuery.addListener(handleMediaChange);
      return () => mediaQuery.removeListener(handleMediaChange);
    }
  }, [theme, accent, mounted]);

  // Cross-tab synchronization via storage event
  useEffect(() => {
    if (!mounted) return;

    const handleStorage = (e: StorageEvent) => {
      if (e.key === THEME_STORAGE_KEY) {
        const nextTheme: ThemePreference = isValidThemePreference(e.newValue) ? e.newValue : "system";
        const nextSurface = resolveSurface(nextTheme);
        setThemeState(nextTheme);
        setResolvedSurface(nextSurface);
        applyAppearanceToDOM(nextSurface, accent, true);
      } else if (e.key === ACCENT_STORAGE_KEY) {
        const nextAccent: AccentId = isValidAccentId(e.newValue) ? e.newValue : "sk-green";
        setAccentState(nextAccent);
        applyAppearanceToDOM(resolvedSurface, nextAccent, true);
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [mounted, accent, resolvedSurface]);

  const setTheme = useCallback(
    (next: ThemePreference) => {
      const nextSurface = resolveSurface(next);
      setThemeState(next);
      setResolvedSurface(nextSurface);
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch {}
      applyAppearanceToDOM(nextSurface, accent, true);
      persistToAccount(next, accent);
    },
    [accent, persistToAccount]
  );

  const setAccent = useCallback(
    (next: AccentId) => {
      setAccentState(next);
      try {
        window.localStorage.setItem(ACCENT_STORAGE_KEY, next);
      } catch {}
      applyAppearanceToDOM(resolvedSurface, next, true);
      persistToAccount(theme, next);
    },
    [theme, resolvedSurface, persistToAccount]
  );

  const resetAppearance = useCallback(() => {
    const nextSurface = resolveSurface("system");
    setThemeState("system");
    setResolvedSurface(nextSurface);
    setAccentState("sk-green");
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, "system");
      window.localStorage.setItem(ACCENT_STORAGE_KEY, "sk-green");
    } catch {}
    applyAppearanceToDOM(nextSurface, "sk-green", true);
    persistToAccount("system", "sk-green");
  }, [persistToAccount]);

  const resolvedTheme: ResolvedTheme = SURFACE_THEME_MAP[resolvedSurface]?.isDark ? "dark" : "light";
  const chartColors = useMemo(() => getChartColors(resolvedSurface, accent), [resolvedSurface, accent]);
  const isCustomized = theme !== "system" || accent !== "sk-green";

  return (
    <ThemeContext.Provider
      value={{
        theme,
        resolvedSurface,
        resolvedTheme,
        accent,
        chartColors,
        isCustomized,
        syncStatus,
        setTheme,
        setAccent,
        resetAppearance,
        mounted,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
