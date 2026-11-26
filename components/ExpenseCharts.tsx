"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { ArrowRight } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import {
  getHorizontalPillStyle,
  useTabPanelDirection,
} from "@/components/useTabPanelDirection";

interface CategoryStat {
  category: string;
  total: number;
  count: number;
  color?: string;
  allocated_budget?: number;
}

interface MonthlyStat {
  month: string;
  total: number;
  count: number;
}

export interface Expense {
  id: number;
  title: string;
  description: string;
  category: string;
  amount: number;
  date: string;
  receipt_url: string | null;
  voucher_no: string | null;
  payee: string | null;
  created_by: string;
}

interface Deposit {
  id: number;
  reference_no: string;
  source: string;
  amount: number;
  date: string;
  description: string | null;
  attachment_url: string | null;
  recorded_by: string;
}

interface SummaryData {
  fiscalYear: string;
  barangayBudget: number;
  annualBudget: number;
  fundsReceived: number;
  currentBankBalance: number;
  totalSpent: number;
  remainingBudget: number;
  utilizationRate: number;
  depositCount?: number;
}

interface ExpenseChartsProps {
  categoryStats?: CategoryStat[];
  monthlyStats: MonthlyStat[];
  totalSpent?: number;
  annualBudget?: number;
  summary?: SummaryData;
  allExpenses?: Expense[];
  deposits?: Deposit[];
  onSelectCategory?: (category: string) => void;
  onViewCategoryExpenses?: (category: string) => void;
  onSelectExpense?: (expense: Expense) => void;
  selectedCategory?: string;
}

const CATEGORY_PALETTE = [
  "#2563eb",
  "#ea580c",
  "#d97706",
  "#e11d48",
  "#059669",
  "#9333ea",
  "#0891b2",
  "#4f46e5",
  "#548701",
  "#475569",
];

const COLOR_NAME_TO_HEX: Record<string, string> = {
  blue: "#2563eb",
  orange: "#ea580c",
  amber: "#d97706",
  rose: "#e11d48",
  emerald: "#059669",
  purple: "#9333ea",
  cyan: "#0891b2",
  indigo: "#4f46e5",
  teal: "#0d9488",
  slate: "#475569",
  brand: "#548701",
};

function getCategoryColorHex(catColor?: string, catName?: string, fallbackIdx = 0): string {
  if (catColor) {
    if (catColor.startsWith("#")) return catColor;
    const lower = catColor.toLowerCase();
    if (COLOR_NAME_TO_HEX[lower]) return COLOR_NAME_TO_HEX[lower];
  }
  if (catName) {
    const c = catName.toLowerCase();
    if (c.includes("education") || c.includes("culture")) return "#2563eb";
    if (c.includes("livelihood") || c.includes("employ")) return "#ea580c";
    if (c.includes("sport")) return "#d97706";
    if (c.includes("health")) return "#e11d48";
    if (c.includes("environ") || c.includes("disaster") || c.includes("preparedness")) return "#059669";
    if (c.includes("gad") || c.includes("gender")) return "#9333ea";
    if (c.includes("peace") || c.includes("order") || c.includes("drug")) return "#0891b2";
    if (c.includes("admin") || c.includes("training") || c.includes("governance")) return "#4f46e5";
  }
  return CATEGORY_PALETTE[fallbackIdx % CATEGORY_PALETTE.length];
}

function formatPesos(val: number): string {
  const safeVal = Number.isFinite(val) ? val : 0;
  const hasCents = Math.abs(safeVal - Math.round(safeVal)) >= 0.005;
  return `₱${safeVal.toLocaleString("en-US", {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: hasCents ? 2 : 0,
  })}`;
}

function formatAxisPesos(val: number): string {
  const safeVal = Number.isFinite(val) ? val : 0;
  if (safeVal >= 1000000) {
    return `₱${(safeVal / 1000000).toFixed(1)}M`;
  }
  return `₱${Math.round(safeVal).toLocaleString("en-US")}`;
}

interface MonthlyChartPoint {
  rawMonth: string;
  name: string;
  fullName: string;
  total: number;
  count: number;
  cumulative: number;
}

const EXPENSE_CHART_VIEW_ORDER = ["monthly", "cumulative", "volume"] as const;

let hasMountedChartsOnce = false;

export default function ExpenseCharts({
  categoryStats = [],
  monthlyStats = [],
  totalSpent = 0,
  annualBudget = 0,
  summary,
  allExpenses = [],
  deposits = [],
  onSelectCategory,
  onViewCategoryExpenses,
  selectedCategory,
}: ExpenseChartsProps) {
  const [mounted, setMounted] = useState(() => hasMountedChartsOnce);
  const [chartView, setChartView] = useState<"monthly" | "cumulative" | "volume">("monthly");
  const chartAnimClass = useTabPanelDirection(chartView, EXPENSE_CHART_VIEW_ORDER);
  const { chartColors, resolvedTheme } = useTheme();

  useEffect(() => {
    hasMountedChartsOnce = true;
    setMounted(true);
  }, []);

  const chartMonthlyData = useMemo<MonthlyChartPoint[]>(() => {
    const sorted = [...monthlyStats].sort((a, b) => a.month.localeCompare(b.month));
    let cumulative = 0;
    return sorted.map((item) => {
      let shortName = item.month;
      let fullName = item.month;
      try {
        const [year, month] = item.month.split("-");
        const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
        shortName = date.toLocaleDateString("en-US", { month: "short" });
        fullName = date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
      } catch {}

      const val = Number(item.total) || 0;
      cumulative += val;

      return {
        rawMonth: item.month,
        name: shortName,
        fullName,
        total: val,
        count: Number(item.count) || 0,
        cumulative,
      };
    });
  }, [monthlyStats]);

  const effectiveTotalSpent =
    totalSpent > 0 ? totalSpent : chartMonthlyData.reduce((sum, m) => sum + m.total, 0);
  const effectiveAnnualBudget =
    annualBudget > 0 ? annualBudget : summary?.annualBudget || 0;
  const effectiveUtilization =
    effectiveAnnualBudget > 0 ? (effectiveTotalSpent / effectiveAnnualBudget) * 100 : 0;
  const isOverBudget = effectiveAnnualBudget > 0 && effectiveTotalSpent > effectiveAnnualBudget;

  const totalPaymentsCount = useMemo(() => {
    if (allExpenses.length > 0) return allExpenses.length;
    return chartMonthlyData.reduce((sum, m) => sum + m.count, 0);
  }, [allExpenses, chartMonthlyData]);

  const activeMonthsCount = chartMonthlyData.length;
  const avgMonthlySpend = activeMonthsCount > 0 ? effectiveTotalSpent / activeMonthsCount : 0;
  const avgPaymentAmount =
    totalPaymentsCount > 0 ? effectiveTotalSpent / totalPaymentsCount : 0;

  const peakMonth = useMemo(() => {
    if (chartMonthlyData.length === 0) return null;
    return chartMonthlyData.reduce(
      (max, m) => (m.total > max.total ? m : max),
      chartMonthlyData[0]
    );
  }, [chartMonthlyData]);

  const totalInflow = useMemo(() => {
    if (deposits.length > 0) return deposits.reduce((sum, d) => sum + Number(d.amount), 0);
    return summary?.fundsReceived || 0;
  }, [deposits, summary]);

  const hasBankData = totalInflow > 0 || summary?.currentBankBalance !== undefined;
  const availableBankCash =
    summary?.currentBankBalance ?? Math.max(0, totalInflow - effectiveTotalSpent);

  const categoryChartData = useMemo(() => {
    return categoryStats
      .filter((c) => Number(c.total) > 0)
      .map((cat, idx) => {
        const value = Number(cat.total) || 0;
        const shareNum = effectiveTotalSpent > 0 ? (value / effectiveTotalSpent) * 100 : 0;
        return {
          name: cat.category,
          value,
          count: cat.count || 0,
          color: getCategoryColorHex(cat.color, cat.category, idx),
          shareNum,
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [categoryStats, effectiveTotalSpent]);

  if (!mounted) {
    return (
      <div className="space-y-3 sm:space-y-4 animate-pulse">
        <div className="h-32 bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-800" />
        <div className="h-[280px] bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-800" />
        <div className="h-[240px] bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-800" />
      </div>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const CustomTrajectoryTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0].payload as MonthlyChartPoint;
    const displayLabel = data.fullName || label;
    const valueText =
      chartView === "volume"
        ? `${data.count} ${data.count === 1 ? "expense" : "expenses"}`
        : chartView === "cumulative"
          ? formatPesos(data.cumulative)
          : formatPesos(data.total);

    return (
      <div className="bg-slate-900 dark:bg-slate-800 text-white px-3 py-2 rounded-lg shadow-lg text-xs border border-slate-700/80 pointer-events-none">
        <p className="text-slate-400 text-[10px] font-medium">{displayLabel}</p>
        <p className="font-bold font-mono text-sm text-white mt-0.5">{valueText}</p>
        {chartView !== "volume" && (
          <p className="text-slate-400 text-[10px] mt-0.5">
            {data.count} {data.count === 1 ? "expense" : "expenses"}
          </p>
        )}
      </div>
    );
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const CustomPieTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0].payload as {
      name: string;
      value: number;
      shareNum: number;
    };

    return (
      <div className="bg-slate-900 dark:bg-slate-800 text-white px-3 py-2 rounded-lg shadow-lg text-xs border border-slate-700/80 pointer-events-none">
        <p className="text-slate-300 font-medium text-[11px]">{data.name}</p>
        <p className="font-bold font-mono text-sm text-white mt-0.5">
          {formatPesos(data.value)}{" "}
          <span className="text-slate-400 font-sans font-normal text-[11px]">
            ({Math.round(data.shareNum)}%)
          </span>
        </p>
      </div>
    );
  };

  const selectedCategoryItem =
    selectedCategory && selectedCategory !== "all"
      ? categoryChartData.find((c) => c.name === selectedCategory)
      : null;

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* 1. SUMMARY & HIERARCHY */}
      <section className="bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5 space-y-3.5">
        <div className="space-y-2.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Total Spent
            </span>
            {effectiveAnnualBudget > 0 && (
              <span
                className={`text-xs font-medium tabular-nums ${
                  isOverBudget
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-slate-500 dark:text-slate-400"
                }`}
              >
                {Math.round(effectiveUtilization)}% of {formatPesos(effectiveAnnualBudget)}
              </span>
            )}
          </div>

          <div className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 font-mono tracking-tight tabular-nums">
            {formatPesos(effectiveTotalSpent)}
          </div>

          {effectiveAnnualBudget > 0 && (
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  isOverBudget ? "bg-rose-500" : "bg-brand-600"
                }`}
                style={{ width: `${Math.min(100, effectiveUtilization)}%` }}
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="min-w-0">
            <span className="text-[11px] text-slate-400 dark:text-slate-500 block truncate">
              Peak{peakMonth ? ` (${peakMonth.name})` : ""}
            </span>
            <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 font-mono tabular-nums block truncate mt-0.5">
              {peakMonth ? formatPesos(peakMonth.total) : "—"}
            </span>
          </div>

          <div className="min-w-0">
            <span className="text-[11px] text-slate-400 dark:text-slate-500 block truncate">
              Monthly Avg
            </span>
            <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 font-mono tabular-nums block truncate mt-0.5">
              {activeMonthsCount > 0 ? formatPesos(Math.round(avgMonthlySpend)) : "—"}
            </span>
          </div>

          <div className="min-w-0">
            <span className="text-[11px] text-slate-400 dark:text-slate-500 block truncate">
              {hasBankData ? "In Bank" : "Avg / Item"}
            </span>
            <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 font-mono tabular-nums block truncate mt-0.5">
              {hasBankData
                ? formatPesos(availableBankCash)
                : totalPaymentsCount > 0
                  ? formatPesos(Math.round(avgPaymentAmount))
                  : "—"}
            </span>
          </div>
        </div>
      </section>

      {/* 2. MONTHLY SPENDING */}
      <section className="bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Monthly Spending
          </h3>

          <div className="relative inline-grid grid-cols-3 gap-0.5 items-center bg-slate-100/90 dark:bg-slate-800/90 p-0.5 rounded-lg">
            <div
              aria-hidden="true"
              className="tab-sliding-pill absolute top-0.5 bottom-0.5 rounded-md bg-white dark:bg-slate-900 shadow-2xs pointer-events-none"
              style={getHorizontalPillStyle(
                EXPENSE_CHART_VIEW_ORDER.length,
                Math.max(0, EXPENSE_CHART_VIEW_ORDER.indexOf(chartView)),
                0.125,
                0.125
              )}
            />
            {(
              [
                { id: "monthly", label: "Monthly" },
                { id: "cumulative", label: "Total" },
                { id: "volume", label: "Count" },
              ] as const
            ).map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => setChartView(mode.id)}
                className={`relative z-10 px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors duration-200 cursor-pointer text-center ${
                  chartView === mode.id
                    ? "text-slate-900 dark:text-slate-100"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>

        <div key={chartView} className={`w-full h-[230px] sm:h-[260px] overflow-x-clip ${chartAnimClass}`}>
          {chartMonthlyData.length === 0 ? (
            <div className="flex items-center justify-center h-full text-slate-400 dark:text-slate-500 text-xs">
              No data yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              {chartView === "monthly" ? (
                <BarChart
                  accessibilityLayer={false}
                  data={chartMonthlyData}
                  margin={{ top: 8, right: 6, left: -4, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="2 4"
                    vertical={false}
                    stroke={chartColors.grid}
                    strokeOpacity={0.7}
                  />
                  <XAxis
                    dataKey="name"
                    interval={0}
                    tick={{ fontSize: 11, fill: chartColors.tick }}
                    axisLine={{ stroke: chartColors.axis }}
                    tickLine={false}
                  />
                  <YAxis
                    width={60}
                    tickFormatter={(val) => formatAxisPesos(val)}
                    tick={{ fontSize: 10, fill: chartColors.tick }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    content={<CustomTrajectoryTooltip />}
                    cursor={{ fill: chartColors.tooltipCursor }}
                    isAnimationActive={false}
                  />
                  <Bar
                    dataKey="total"
                    fill={chartColors.barFill}
                    radius={[5, 5, 0, 0]}
                    maxBarSize={42}
                    isAnimationActive={false}
                  />
                </BarChart>
              ) : chartView === "cumulative" ? (
                <AreaChart
                  accessibilityLayer={false}
                  data={chartMonthlyData}
                  margin={{ top: 8, right: 6, left: -4, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorCumulative" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={chartColors.barFill} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={chartColors.barFill} stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="2 4"
                    vertical={false}
                    stroke={chartColors.grid}
                    strokeOpacity={0.7}
                  />
                  <XAxis
                    dataKey="name"
                    interval={0}
                    tick={{ fontSize: 11, fill: chartColors.tick }}
                    axisLine={{ stroke: chartColors.axis }}
                    tickLine={false}
                  />
                  <YAxis
                    width={60}
                    tickFormatter={(val) => formatAxisPesos(val)}
                    tick={{ fontSize: 10, fill: chartColors.tick }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    content={<CustomTrajectoryTooltip />}
                    cursor={{
                      stroke: chartColors.barFill,
                      strokeWidth: 1,
                      strokeDasharray: "3 3",
                    }}
                    isAnimationActive={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="cumulative"
                    stroke={chartColors.barFill}
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorCumulative)"
                    isAnimationActive={false}
                  />
                </AreaChart>
              ) : (
                <BarChart
                  accessibilityLayer={false}
                  data={chartMonthlyData}
                  margin={{ top: 8, right: 6, left: -12, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="2 4"
                    vertical={false}
                    stroke={chartColors.grid}
                    strokeOpacity={0.7}
                  />
                  <XAxis
                    dataKey="name"
                    interval={0}
                    tick={{ fontSize: 11, fill: chartColors.tick }}
                    axisLine={{ stroke: chartColors.axis }}
                    tickLine={false}
                  />
                  <YAxis
                    width={36}
                    allowDecimals={false}
                    tick={{ fontSize: 10, fill: chartColors.tick }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    content={<CustomTrajectoryTooltip />}
                    cursor={{ fill: chartColors.tooltipCursor }}
                    isAnimationActive={false}
                  />
                  <Bar
                    dataKey="count"
                    fill={chartColors.barFill}
                    radius={[5, 5, 0, 0]}
                    maxBarSize={42}
                    isAnimationActive={false}
                  />
                </BarChart>
              )}
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* 3. BY COMMITTEE */}
      {categoryChartData.length > 0 && (
        <section className="bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              By Committee
            </h3>
            {selectedCategoryItem && onViewCategoryExpenses && (
              <button
                type="button"
                onClick={() => onViewCategoryExpenses(selectedCategoryItem.name)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 dark:text-brand-400 hover:underline cursor-pointer"
              >
                View expenses
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6 items-center">
            <div className="md:col-span-5 relative w-full h-[170px] sm:h-[190px] flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip content={<CustomPieTooltip />} />
                  <Pie
                    data={categoryChartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={74}
                    paddingAngle={2.5}
                    isAnimationActive={false}
                  >
                    {categoryChartData.map((entry, index) => {
                      const isDimmed =
                        Boolean(selectedCategory && selectedCategory !== "all") &&
                        selectedCategory !== entry.name;
                      return (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.color}
                          fillOpacity={isDimmed ? 0.3 : 1}
                          stroke={resolvedTheme === "dark" ? "#0f172a" : "#ffffff"}
                          strokeWidth={2}
                          onClick={() =>
                            onSelectCategory &&
                            onSelectCategory(selectedCategory === entry.name ? "all" : entry.name)
                          }
                          className="cursor-pointer transition-opacity hover:opacity-80"
                        />
                      );
                    })}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>

              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-4">
                <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 font-mono tabular-nums">
                  {formatPesos(
                    selectedCategoryItem ? selectedCategoryItem.value : effectiveTotalSpent
                  )}
                </span>
                {selectedCategoryItem && (
                  <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 mt-0.5">
                    {Math.round(selectedCategoryItem.shareNum)}%
                  </span>
                )}
              </div>
            </div>

            <div className="md:col-span-7 divide-y divide-slate-100 dark:divide-slate-800/80 select-none">
              {categoryChartData.map((item) => {
                const isSelected = selectedCategory === item.name;
                return (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() =>
                      onSelectCategory && onSelectCategory(isSelected ? "all" : item.name)
                    }
                    className={`w-full py-2.5 px-2.5 rounded-lg flex items-center justify-between gap-3 text-left transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-brand-50/60 dark:bg-brand-950/30"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <span
                        className={`text-xs sm:text-sm truncate ${
                          isSelected
                            ? "font-semibold text-brand-800 dark:text-brand-300"
                            : "font-medium text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        {item.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 font-mono tabular-nums">
                        {formatPesos(item.value)}
                      </span>
                      <span className="text-[11px] text-slate-400 dark:text-slate-500 w-8 text-right tabular-nums">
                        {Math.round(item.shareNum)}%
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
