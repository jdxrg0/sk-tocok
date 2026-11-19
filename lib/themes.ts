export type SurfaceThemeId =
  | "light"
  | "sepia"
  | "sage"
  | "breeze"
  | "dark"
  | "forest"
  | "ocean"
  | "dusk"
  | "amoled";

export type ThemePreference = "system" | SurfaceThemeId;

export type AccentId = "sk-green" | "blue" | "teal" | "violet" | "amber" | "rose";

export const THEME_STORAGE_KEY = "sk_tocok_theme";
export const ACCENT_STORAGE_KEY = "sk_tocok_accent";

export interface SurfaceThemeMeta {
  id: SurfaceThemeId;
  label: string;
  group: "light" | "dark";
  isDark: boolean;
  metaThemeColor: string;
  preview: {
    canvas: string;
    card: string;
    border: string;
    ink: string;
  };
  chart: {
    cardBg: string;
    grid: string;
    axis: string;
    tick: string;
    tooltipCursor: string;
  };
}

export interface AccentThemeMeta {
  id: AccentId;
  label: string;
  swatchHex: string;
  lightPrimaryHex: string;
  darkPrimaryHex: string;
}

export const SURFACE_THEMES: SurfaceThemeMeta[] = [
  {
    id: "light",
    label: "Classic",
    group: "light",
    isDark: false,
    metaThemeColor: "#ffffff",
    preview: {
      canvas: "#f1f5f9",
      card: "#ffffff",
      border: "#cbd5e1",
      ink: "#0f172a",
    },
    chart: {
      cardBg: "#ffffff",
      grid: "#e2e8f0",
      axis: "#cbd5e1",
      tick: "#64748b",
      tooltipCursor: "rgba(226, 232, 240, 0.45)",
    },
  },
  {
    id: "sepia",
    label: "Warm Sepia",
    group: "light",
    isDark: false,
    metaThemeColor: "#fdfaf3",
    preview: {
      canvas: "#ebe2d2",
      card: "#fdfaf3",
      border: "#c7b8a1",
      ink: "#221b14",
    },
    chart: {
      cardBg: "#fdfaf3",
      grid: "#ddd1be",
      axis: "#c7b8a1",
      tick: "#736451",
      tooltipCursor: "rgba(221, 209, 190, 0.45)",
    },
  },
  {
    id: "sage",
    label: "Soft Sage",
    group: "light",
    isDark: false,
    metaThemeColor: "#fafdf8",
    preview: {
      canvas: "#e3ede0",
      card: "#fafdf8",
      border: "#b3c9ae",
      ink: "#121e14",
    },
    chart: {
      cardBg: "#fafdf8",
      grid: "#cfdfcb",
      axis: "#b3c9ae",
      tick: "#5a7158",
      tooltipCursor: "rgba(207, 223, 203, 0.45)",
    },
  },
  {
    id: "breeze",
    label: "Cool Breeze",
    group: "light",
    isDark: false,
    metaThemeColor: "#fbfdff",
    preview: {
      canvas: "#e2ecf7",
      card: "#fbfdff",
      border: "#b2c8e0",
      ink: "#0d1829",
    },
    chart: {
      cardBg: "#fbfdff",
      grid: "#cedeef",
      axis: "#b2c8e0",
      tick: "#566f8a",
      tooltipCursor: "rgba(206, 222, 239, 0.45)",
    },
  },
  {
    id: "dark",
    label: "Midnight",
    group: "dark",
    isDark: true,
    metaThemeColor: "#0f172a",
    preview: {
      canvas: "#0f172a",
      card: "#334155",
      border: "#64748b",
      ink: "#f1f5f9",
    },
    chart: {
      cardBg: "#0f172a",
      grid: "#1e293b",
      axis: "#334155",
      tick: "#94a3b8",
      tooltipCursor: "rgba(148, 163, 184, 0.08)",
    },
  },
  {
    id: "forest",
    label: "Deep Forest",
    group: "dark",
    isDark: true,
    metaThemeColor: "#0b1f16",
    preview: {
      canvas: "#072015",
      card: "#1b4d37",
      border: "#34825e",
      ink: "#e2f4ea",
    },
    chart: {
      cardBg: "#0b1f16",
      grid: "#133124",
      axis: "#1f4233",
      tick: "#719e88",
      tooltipCursor: "rgba(113, 158, 136, 0.10)",
    },
  },
  {
    id: "ocean",
    label: "Ocean Abyss",
    group: "dark",
    isDark: true,
    metaThemeColor: "#0a192f",
    preview: {
      canvas: "#081b36",
      card: "#183f73",
      border: "#3b76bd",
      ink: "#e0effe",
    },
    chart: {
      cardBg: "#0a192f",
      grid: "#122745",
      axis: "#1e3a5f",
      tick: "#6d94ba",
      tooltipCursor: "rgba(109, 148, 186, 0.10)",
    },
  },
  {
    id: "dusk",
    label: "Velvet Dusk",
    group: "dark",
    isDark: true,
    metaThemeColor: "#181024",
    preview: {
      canvas: "#1c102e",
      card: "#402669",
      border: "#7c56b8",
      ink: "#eee8fc",
    },
    chart: {
      cardBg: "#181024",
      grid: "#251936",
      axis: "#382a54",
      tick: "#8c7cb0",
      tooltipCursor: "rgba(140, 124, 176, 0.10)",
    },
  },
  {
    id: "amoled",
    label: "AMOLED Black",
    group: "dark",
    isDark: true,
    metaThemeColor: "#000000",
    preview: {
      canvas: "#000000",
      card: "#18181b",
      border: "#52525b",
      ink: "#f4f4f5",
    },
    chart: {
      cardBg: "#0c0c0f",
      grid: "#18181e",
      axis: "#2a2a32",
      tick: "#9494a0",
      tooltipCursor: "rgba(148, 148, 160, 0.09)",
    },
  },
];

export const SURFACE_THEME_MAP: Record<SurfaceThemeId, SurfaceThemeMeta> = Object.fromEntries(
  SURFACE_THEMES.map((t) => [t.id, t])
) as Record<SurfaceThemeId, SurfaceThemeMeta>;

export const ACCENT_THEMES: AccentThemeMeta[] = [
  {
    id: "sk-green",
    label: "SK Green",
    swatchHex: "#548701",
    lightPrimaryHex: "#548701",
    darkPrimaryHex: "#8cb347",
  },
  {
    id: "blue",
    label: "Civic Blue",
    swatchHex: "#2563eb",
    lightPrimaryHex: "#1d4ed8",
    darkPrimaryHex: "#60a5fa",
  },
  {
    id: "teal",
    label: "Emerald Teal",
    swatchHex: "#0d9488",
    lightPrimaryHex: "#0f766e",
    darkPrimaryHex: "#2dd4bf",
  },
  {
    id: "violet",
    label: "Royal Violet",
    swatchHex: "#7c3aed",
    lightPrimaryHex: "#6d28d9",
    darkPrimaryHex: "#a78bfa",
  },
  {
    id: "amber",
    label: "Golden Amber",
    swatchHex: "#d97706",
    lightPrimaryHex: "#b45309",
    darkPrimaryHex: "#fbbf24",
  },
  {
    id: "rose",
    label: "Crimson Rose",
    swatchHex: "#e11d48",
    lightPrimaryHex: "#be123c",
    darkPrimaryHex: "#fb7185",
  },
];

export const ACCENT_THEME_MAP: Record<AccentId, AccentThemeMeta> = Object.fromEntries(
  ACCENT_THEMES.map((a) => [a.id, a])
) as Record<AccentId, AccentThemeMeta>;

export function isValidThemePreference(val: string | null | undefined): val is ThemePreference {
  if (!val) return false;
  return val === "system" || val in SURFACE_THEME_MAP;
}

export function isValidAccentId(val: string | null | undefined): val is AccentId {
  if (!val) return false;
  return val in ACCENT_THEME_MAP;
}

export interface ChartColors {
  cardBg: string;
  grid: string;
  axis: string;
  tick: string;
  tooltipCursor: string;
  barFill: string;
  accentPrimary: string;
}

export function getChartColors(surface: SurfaceThemeId, accent: AccentId): ChartColors {
  const s = SURFACE_THEME_MAP[surface] ?? SURFACE_THEME_MAP.light;
  const a = ACCENT_THEME_MAP[accent] ?? ACCENT_THEME_MAP["sk-green"];
  return {
    ...s.chart,
    barFill: s.isDark ? a.darkPrimaryHex : a.lightPrimaryHex,
    accentPrimary: s.isDark ? a.darkPrimaryHex : a.lightPrimaryHex,
  };
}
