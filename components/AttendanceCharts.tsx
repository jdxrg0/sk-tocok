"use client";

import React, { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
  Legend,
} from "recharts";
import { BarChart3, TrendingUp } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import {
  getHorizontalPillStyle,
  useTabPanelDirection,
} from "@/components/useTabPanelDirection";
import {
  getActivityStanding,
  getOfficialShortName,
  type MonthlyAttendanceTrend,
  type OfficialAttendanceStat,
} from "@/lib/attendance";

interface AttendanceChartsProps {
  officials: OfficialAttendanceStat[];
  monthlyTrend: MonthlyAttendanceTrend[];
  onSelectOfficial?: (official: OfficialAttendanceStat) => void;
}

const ATTENDANCE_CHART_TAB_ORDER = ["ranking", "monthly"] as const;

export default function AttendanceCharts({
  officials,
  monthlyTrend,
  onSelectOfficial,
}: AttendanceChartsProps) {
  const [activeTab, setActiveTab] = useState<"ranking" | "monthly">("ranking");
  const tabAnimClass = useTabPanelDirection(activeTab, ATTENDANCE_CHART_TAB_ORDER);
  const [mounted, setMounted] = useState(false);
  const { chartColors } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-xs animate-pulse">
        <div className="h-6 w-52 bg-slate-200 dark:bg-slate-800 rounded mb-4" />
        <div className="h-[340px] w-full bg-slate-100 dark:bg-slate-800/70 rounded-xl" />
      </div>
    );
  }

  const rankingData = officials.map((o) => {
    const standing = getActivityStanding(o.overallRate, o.totalCount);
    const barFill =
      standing.key === "active" ? chartColors.accentPrimary : standing.hex;
    return {
      official: o,
      shortName: getOfficialShortName(o.name),
      fullName: o.name,
      role: o.role,
      overallRate: o.overallRate,
      regularRate: o.regularRate,
      otherRate: o.otherRate,
      presentCount: o.presentCount,
      totalCount: o.totalCount,
      regularPresent: o.regularPresent,
      regularTotal: o.regularTotal,
      otherPresent: o.otherPresent,
      otherTotal: o.otherTotal,
      standingLabel: standing.label,
      fill: barFill,
    };
  });

  const monthlyData = monthlyTrend.map((m) => {
    let shortMonth = m.month;
    let fullMonth = m.month;
    try {
      const [y, mo] = m.month.split("-");
      const d = new Date(parseInt(y, 10), parseInt(mo, 10) - 1, 1);
      shortMonth = d.toLocaleDateString("en-US", { month: "short" });
      fullMonth = d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    } catch {}
    return {
      ...m,
      shortMonth,
      fullMonth,
    };
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const RankingTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const d = payload[0].payload as (typeof rankingData)[number];
    return (
      <div className="bg-slate-900 dark:bg-slate-800 text-white px-3.5 py-2.5 rounded-xl shadow-xl text-xs space-y-1.5 border border-slate-700 dark:border-slate-600 pointer-events-none max-w-[240px]">
        <div>
          <p className="font-bold text-slate-100 leading-tight">{d.fullName}</p>
          <p className="text-[10px] text-slate-400">{d.role}</p>
        </div>
        <div className="flex items-baseline justify-between gap-3 pt-1 border-t border-slate-800 dark:border-slate-700">
          <span className="text-slate-300">Overall:</span>
          <span className="font-black text-sm text-emerald-400 font-mono">
            {d.overallRate.toFixed(1)}% ({d.presentCount}/{d.totalCount})
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 text-[11px] text-slate-300">
          <span>Regular Sessions:</span>
          <span className="font-mono font-semibold">
            {d.regularTotal > 0 ? `${d.regularPresent}/${d.regularTotal} (${d.regularRate.toFixed(0)}%)` : "—"}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 text-[11px] text-slate-300">
          <span>Other Activities:</span>
          <span className="font-mono font-semibold">
            {d.otherTotal > 0 ? `${d.otherPresent}/${d.otherTotal} (${d.otherRate.toFixed(0)}%)` : "—"}
          </span>
        </div>
        <div className="pt-1 border-t border-slate-800 dark:border-slate-700 text-[10px] text-slate-400">
          Standing: <span className="text-slate-200 font-semibold">{d.standingLabel}</span>
        </div>
      </div>
    );
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const MonthlyTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const d = payload[0].payload as (typeof monthlyData)[number];
    return (
      <div className="bg-slate-900 dark:bg-slate-800 text-white px-3.5 py-2.5 rounded-xl shadow-xl text-xs space-y-1.5 border border-slate-700 dark:border-slate-600 pointer-events-none">
        <p className="font-bold text-slate-100">{d.fullMonth}</p>
        <div className="space-y-1 pt-1 border-t border-slate-800 dark:border-slate-700 text-[11px]">
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-300">Regular Sessions ({d.regularCount}):</span>
            <span className="font-mono font-bold text-emerald-400">
              {d.regularRate !== null ? `${d.regularRate}%` : "No session"}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-300">Other Activities ({d.otherCount}):</span>
            <span className="font-mono font-bold text-indigo-300">
              {d.otherRate !== null ? `${d.otherRate}%` : "No activity"}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4 pt-1 border-t border-slate-800 dark:border-slate-700">
            <span className="text-slate-400">Combined Avg:</span>
            <span className="font-mono font-bold text-white">{d.overallRate}%</span>
          </div>
        </div>
      </div>
    );
  };

  const chartHeight = Math.max(290, rankingData.length * 36 + 36);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5 shadow-xs space-y-4">
      {/* Header & Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Attendance Analytics
          </h3>
          <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
            {activeTab === "ranking"
              ? "Participation rate per SK Official across Regular Sessions & other activities (70% = Active benchmark)"
              : "Monthly council attendance rate comparing Regular Sessions vs. other activities"}
          </p>
        </div>

        <div className="relative inline-grid grid-cols-2 gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200/80 dark:border-slate-700/80 self-start sm:self-auto">
          <div
            aria-hidden="true"
            className="tab-sliding-pill absolute top-1 bottom-1 rounded-lg bg-white dark:bg-slate-900 shadow-2xs pointer-events-none"
            style={getHorizontalPillStyle(2, activeTab === "monthly" ? 1 : 0, 0.25, 0.25)}
          />
          <button
            type="button"
            onClick={() => setActiveTab("ranking")}
            className={`relative z-10 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors duration-200 cursor-pointer ${
              activeTab === "ranking"
                ? "text-brand-700 dark:text-brand-300"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>By Official</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("monthly")}
            className={`relative z-10 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors duration-200 cursor-pointer ${
              activeTab === "monthly"
                ? "text-brand-700 dark:text-brand-300"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Monthly Trend</span>
          </button>
        </div>
      </div>

      {/* Chart Canvas */}
      <div key={activeTab} className={`overflow-x-clip ${tabAnimClass}`}>
      {activeTab === "ranking" ? (
        rankingData.length === 0 ? (
          <div className="h-56 flex items-center justify-center text-xs text-slate-400">
            No attendance records to visualize yet.
          </div>
        ) : (
          <div className="space-y-3">
            <div style={{ height: `${chartHeight}px` }} className="w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  accessibilityLayer={false}
                  data={rankingData}
                  layout="vertical"
                  margin={{ top: 6, right: 24, left: 4, bottom: 6 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    horizontal={false}
                    stroke={chartColors.grid}
                  />
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                    tick={{ fill: chartColors.tick, fontSize: 11 }}
                    axisLine={{ stroke: chartColors.axis }}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="shortName"
                    width={125}
                    tick={{ fill: chartColors.tick, fontSize: 11, fontWeight: 600 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    content={<RankingTooltip />}
                    cursor={{ fill: chartColors.tooltipCursor }}
                    isAnimationActive={false}
                  />
                  <ReferenceLine
                    x={70}
                    stroke={chartColors.accentPrimary}
                    strokeDasharray="4 4"
                    strokeOpacity={0.7}
                  />
                  <Bar
                    dataKey="overallRate"
                    radius={[0, 6, 6, 0]}
                    barSize={20}
                    isAnimationActive={false}
                    onClick={(_entry, index) => {
                      const item = rankingData[index];
                      if (onSelectOfficial && item?.official) {
                        onSelectOfficial(item.official);
                      }
                    }}
                    className={onSelectOfficial ? "cursor-pointer" : ""}
                  >
                    {rankingData.map((entry) => (
                      <Cell key={entry.official.id} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Standing Legend */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0 -translate-y-0.5" />
                  <span>Good Standing (80%+)</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-brand-600 shrink-0 -translate-y-0.5" />
                  <span>Satisfactory (60–79%)</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0 -translate-y-0.5" />
                  <span>Fair (50–59%)</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0 -translate-y-0.5" />
                  <span>Needs Review (&lt;50%)</span>
                </span>
              </div>
              {onSelectOfficial && (
                <span className="text-[10.5px] text-slate-400 dark:text-slate-500">
                  Tip: Click any bar to inspect an official&apos;s full history
                </span>
              )}
            </div>
          </div>
        )
      ) : monthlyData.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-xs text-slate-400">
          No monthly attendance sessions recorded yet.
        </div>
      ) : (
        <div className="h-[310px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              accessibilityLayer={false}
              data={monthlyData}
              margin={{ top: 10, right: 16, left: 0, bottom: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartColors.grid} />
              <XAxis
                dataKey="shortMonth"
                tick={{ fill: chartColors.tick, fontSize: 11, fontWeight: 600 }}
                axisLine={{ stroke: chartColors.axis }}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
                tick={{ fill: chartColors.tick, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={42}
              />
              <Tooltip
                content={<MonthlyTooltip />}
                cursor={{ fill: chartColors.tooltipCursor }}
                isAnimationActive={false}
              />
              <Legend
                wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
              />
              <Bar
                dataKey="regularRate"
                name="Regular Sessions"
                fill={chartColors.accentPrimary}
                radius={[6, 6, 0, 0]}
                maxBarSize={28}
                isAnimationActive={false}
              />
              <Bar
                dataKey="otherRate"
                name="Other Activities"
                fill="#6366f1"
                radius={[6, 6, 0, 0]}
                maxBarSize={28}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      </div>
    </div>
  );
}
