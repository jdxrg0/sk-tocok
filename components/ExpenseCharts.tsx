"use client";

import React, { useState, useEffect } from "react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useTheme } from "@/components/ThemeProvider";

interface CategoryStat {
  category: string;
  total: number;
  count: number;
  color?: string;
}

interface MonthlyStat {
  month: string;
  total: number;
  count: number;
}

interface ExpenseChartsProps {
  categoryStats: CategoryStat[];
  monthlyStats: MonthlyStat[];
  totalSpent: number;
  annualBudget?: number;
  onSelectCategory?: (category: string) => void;
  selectedCategory?: string;
}

const COLOR_MAP: Record<string, string> = {
  brand: "#548701",
  blue: "#548701",
  amber: "#d97706",
  rose: "#e11d48",
  emerald: "#059669",
  orange: "#ea580c",
  indigo: "#4f46e5",
  purple: "#9333ea",
  teal: "#0d9488",
  cyan: "#0891b2",
};

const DEFAULT_COLORS = [
  "#548701", // brand green
  "#d97706", // amber
  "#0d9488", // teal
  "#e11d48", // rose
  "#4f46e5", // indigo
  "#059669", // emerald
  "#ea580c", // orange
  "#0891b2", // cyan
  "#9333ea", // purple
];

export default function ExpenseCharts({
  categoryStats,
  monthlyStats,
  totalSpent,
  annualBudget,
  onSelectCategory,
  selectedCategory,
}: ExpenseChartsProps) {
  const [activeTab, setActiveTab] = useState<"category" | "monthly">("category");
  const [mounted, setMounted] = useState(false);
  const { chartColors } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5 sm:p-6 shadow-xs animate-pulse">
        <div className="h-6 w-48 bg-slate-200 dark:bg-slate-800 rounded mb-4"></div>
        <div className="h-[500px] lg:h-[380px] w-full bg-slate-100 dark:bg-slate-800/70 rounded-xl sm:rounded-2xl"></div>
      </div>
    );
  }

  // Format month label like "2026-08" -> "Aug 2026"
  const formatMonth = (monthStr: string) => {
    try {
      const [year, month] = monthStr.split("-");
      const date = new Date(parseInt(year), parseInt(month) - 1, 1);
      return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    } catch {
      return monthStr;
    }
  };

  const chartCategoryData = categoryStats.map((item, idx) => {
    const numValue = Number(item.total) || 0;
    const numSpent = Number(totalSpent) || 0;
    const resolvedColor =
      item.color === "brand" || item.color === "blue"
        ? chartColors.accentPrimary
        : item.color && COLOR_MAP[item.color]
        ? COLOR_MAP[item.color]
        : idx === 0
        ? chartColors.accentPrimary
        : DEFAULT_COLORS[idx % DEFAULT_COLORS.length];
    return {
      name: item.category,
      value: numValue,
      count: Number(item.count) || 0,
      color: resolvedColor,
      percentage: numSpent > 0 ? ((numValue / numSpent) * 100).toFixed(1) : "0",
    };
  });

  const chartMonthlyData = monthlyStats.map((item) => {
    let shortName = item.month;
    let fullName = item.month;
    try {
      const [year, month] = item.month.split("-");
      const date = new Date(parseInt(year), parseInt(month) - 1, 1);
      shortName = date.toLocaleDateString("en-US", { month: "short" });
      fullName = date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    } catch {}
    return {
      rawMonth: item.month,
      name: shortName,
      fullName: fullName,
      total: Number(item.total) || 0,
      count: Number(item.count) || 0,
    };
  });

  // Custom bar tooltip

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const CustomBarTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload as { total: number; count: number; fullName?: string };
      const displayLabel = data.fullName || label;
      return (
        <div className="bg-slate-900 dark:bg-slate-800 text-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl shadow-xl text-xs space-y-1 border border-slate-700 dark:border-slate-600 pointer-events-none">
          <p className="font-bold text-slate-100 text-xs sm:text-sm">{displayLabel}</p>
          <p className="text-brand-400 font-extrabold text-sm sm:text-base font-mono">
            ₱{data.total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-slate-300 text-[10px] sm:text-[11px] pt-1 border-t border-slate-800 dark:border-slate-700">
            {data.count} recorded transaction{data.count === 1 ? "" : "s"}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5 sm:p-6 space-y-4 sm:space-y-6 shadow-xs">
      {/* Header with Tab Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 border-b border-slate-100 dark:border-slate-800 pb-3 sm:pb-4">
        <div>
          <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Financial Breakdown &amp; Monthly Trajectory
          </h2>
          <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
            Interactive distribution of youth funds across statutory categories and fiscal periods
          </p>
        </div>

        {/* Tab Controls */}
        <div className="grid grid-cols-2 sm:flex sm:items-center p-0.5 bg-slate-100 dark:bg-slate-800/90 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 w-full sm:w-auto">
          <button
            onClick={() => setActiveTab("category")}
            className={`w-full sm:w-auto text-center px-3 py-1.5 rounded-md transition-colors ${
              activeTab === "category"
                ? "bg-white dark:bg-slate-700 text-slate-950 dark:text-slate-50 font-semibold shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-slate-200"
            }`}
          >
            By Committee
          </button>
          <button
            onClick={() => setActiveTab("monthly")}
            className={`w-full sm:w-auto text-center px-3 py-1.5 rounded-md transition-colors ${
              activeTab === "monthly"
                ? "bg-white dark:bg-slate-700 text-slate-950 dark:text-slate-50 font-semibold shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-slate-200"
            }`}
          >
            Monthly Trend
          </button>
        </div>
      </div>

      {/* Fixed-size Tab Content Viewport */}
      <div className="w-full h-[500px] lg:h-[380px]">
        {/* Tab 1: Category Breakdown (Donut Chart + Side Legend) */}
        {activeTab === "category" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-8 items-start lg:items-center h-full">
            {/* Donut Chart (Non-tappable clean visual display) */}
            <div className="lg:col-span-6 h-52 sm:h-56 lg:h-full w-full min-w-0 relative flex items-center justify-center shrink-0 pointer-events-none select-none">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartCategoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius="56%"
                    outerRadius="82%"
                    paddingAngle={3}
                    dataKey="value"
                    isAnimationActive={false}
                  >
                    {chartCategoryData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.color}
                        stroke={chartColors.cardBg}
                        strokeWidth={2}
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>

              {/* Center Label inside Donut */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[9.5px] sm:text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Total Spent</span>
                <span className="text-base sm:text-xl font-black text-slate-900 dark:text-slate-100 font-mono tracking-tight">
                  ₱{(Number(totalSpent) / 1000).toFixed(1)}k
                </span>
                <span className="text-[9px] sm:text-[10px] text-brand-600 dark:text-brand-400 font-bold">{categoryStats.length} Categories</span>
              </div>
            </div>

            {/* Side Legend & Quick Stats */}
            <div className="lg:col-span-6 flex flex-col justify-start lg:justify-center h-full min-h-0">
              {/* Stationary Header (Permanent 100% Static Divider, Never Appears/Disappears) */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800 shrink-0">
                <p className="text-[10.5px] sm:text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  Committee Breakdown
                </p>
                <span className="text-[10px] sm:text-xs font-medium text-slate-400 dark:text-slate-500">
                  {chartCategoryData.length} {chartCategoryData.length === 1 ? "Category" : "Categories"}
                </span>
              </div>

              {/* Scrollable Cards with Static CSS Bottom Dissolve Mask */}
              <div
                style={{
                  maskImage: "linear-gradient(to bottom, black 0%, black calc(100% - 24px), transparent 100%)",
                  WebkitMaskImage: "linear-gradient(to bottom, black 0%, black calc(100% - 24px), transparent 100%)",
                }}
                className="space-y-1.5 overflow-y-auto max-h-[225px] sm:max-h-[240px] lg:max-h-full pt-1.5 pb-2 pr-1 flex-1 min-h-0 themed-scrollbar"
              >
                {chartCategoryData.map((item) => {
                  const isSelected = selectedCategory === item.name;
                  return (
                    <div
                      key={item.name}
                      onClick={() => {
                        if (onSelectCategory) {
                          onSelectCategory(isSelected ? "all" : item.name);
                        }
                      }}
                      className={`flex items-center justify-between py-1.5 sm:py-2 px-2.5 sm:px-3 rounded-xl border transition-all ${
                        isSelected
                          ? "border-brand-500 bg-brand-50/80 dark:bg-brand-950/60 shadow-xs ring-1 ring-brand-500/20"
                          : "border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 hover:bg-slate-100/80 dark:hover:bg-slate-800 hover:border-slate-200 dark:hover:border-slate-700"
                      } ${onSelectCategory ? "cursor-pointer" : ""}`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className="w-3 h-3 rounded-full shrink-0 shadow-2xs ring-1 ring-black/5 dark:ring-white/10"
                          style={{ backgroundColor: item.color }}
                        ></span>
                        <div className="truncate">
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate leading-snug">{item.name}</p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                            {item.count} voucher{item.count === 1 ? "" : "s"}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0 pl-2">
                        <p className="text-xs font-black text-slate-900 dark:text-slate-100 font-mono leading-snug">
                          ₱{Number(item.value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                        <span className="inline-block text-[9.5px] font-bold text-brand-800 dark:text-brand-300 bg-brand-100/90 dark:bg-brand-950/80 px-1.5 py-0.2 rounded font-mono">
                          {item.percentage}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Monthly Trajectory (Bar Chart) */}
        {activeTab === "monthly" && (
          <div className="flex flex-col h-full space-y-2.5 sm:space-y-3">
            <div className="flex items-center justify-between gap-2 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 shrink-0">
              <span className="font-medium text-slate-600 dark:text-slate-400">Disbursement trajectory across fiscal periods</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300 shrink-0 bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 px-2 py-0.5 rounded-md text-[10px] sm:text-xs">
                {chartMonthlyData.length} Active Months
              </span>
            </div>

            <div className="flex-1 w-full min-h-0 relative">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartMonthlyData} margin={{ top: 12, right: 12, left: -12, bottom: 6 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartColors.grid} />
                  <XAxis
                    dataKey="name"
                    interval={0}
                    tick={{ fontSize: 11, fill: chartColors.tick }}
                    axisLine={{ stroke: chartColors.axis }}
                    tickLine={false}
                  />
                  <YAxis
                    width={44}
                    tickFormatter={(val) => `₱${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                    tick={{ fontSize: 10, fill: chartColors.tick }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    content={<CustomBarTooltip />}
                    cursor={{ fill: chartColors.tooltipCursor }}
                  />
                  <Bar
                    dataKey="total"
                    fill={chartColors.barFill}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={48}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
