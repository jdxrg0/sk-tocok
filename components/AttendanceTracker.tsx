"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Plus,
  Calendar,
  CheckCircle2,
  Pencil,
  X,
  Loader2,
  Check,
  AlertCircle,
  Search,
  ChevronRight,
  Users,
  MapPin,
  ArrowLeft,
  Trash2,
  XCircle,
} from "lucide-react";
import { useAuth, isOfficialRole } from "@/components/AuthProvider";
import {
  ACTIVITY_TYPES,
  getActivityStanding,
  getActivityTypeBadge,
  getOfficialInitials,
  getOfficialRoleRank,
  getOfficialShortName,
  splitOfficialName,
  type AttendanceApiResponse,
  type AttendanceSessionItem,
  type AttendanceStatus,
  type OfficialAttendanceStat,
} from "@/lib/attendance";

interface AttendanceTrackerProps {
  mode?: "public" | "admin";
}

const MONTHS = [
  { num: "01", short: "Jan", full: "January", quarter: "Q1" },
  { num: "02", short: "Feb", full: "February", quarter: "Q1" },
  { num: "03", short: "Mar", full: "March", quarter: "Q1" },
  { num: "04", short: "Apr", full: "April", quarter: "Q2" },
  { num: "05", short: "May", full: "May", quarter: "Q2" },
  { num: "06", short: "Jun", full: "June", quarter: "Q2" },
  { num: "07", short: "Jul", full: "July", quarter: "Q3" },
  { num: "08", short: "Aug", full: "August", quarter: "Q3" },
  { num: "09", short: "Sep", full: "September", quarter: "Q3" },
  { num: "10", short: "Oct", full: "October", quarter: "Q4" },
  { num: "11", short: "Nov", full: "November", quarter: "Q4" },
  { num: "12", short: "Dec", full: "December", quarter: "Q4" },
] as const;

interface MonthGroupModalState {
  month: (typeof MONTHS)[number];
  official: OfficialAttendanceStat;
  sessions: AttendanceSessionItem[];
}

function formatDateDisplay(isoDate: string): string {
  if (!isoDate) return "";
  try {
    const [y, m, d] = isoDate.split("-").map((n) => parseInt(n, 10));
    if (!y || !m || !d) return isoDate;
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return isoDate;
  }
}

function getSessionDateParts(isoDate: string): { month: string; day: string } {
  if (!isoDate) return { month: "", day: "" };
  try {
    const [y, m, d] = isoDate.split("-").map((n) => parseInt(n, 10));
    if (!y || !m || !d) return { month: "", day: "" };
    const date = new Date(y, m - 1, d);
    return {
      month: date.toLocaleDateString("en-US", { month: "short" }).toUpperCase(),
      day: String(d).padStart(2, "0"),
    };
  } catch {
    return { month: "", day: "" };
  }
}

function getTodayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function triggerHaptic(pattern: number | number[] = 15) {
  if (typeof window !== "undefined" && typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    try {
      navigator.vibrate(pattern);
    } catch {
      // Ignore vibration error if unsupported or blocked
    }
  }
}

export default function AttendanceTracker({ mode = "public" }: AttendanceTrackerProps) {
  const { user } = useAuth();
  const isOfficialUser = Boolean(user && isOfficialRole(user.role));
  const canManage = mode === "admin" || isOfficialUser;

  // Data state
  const [data, setData] = useState<AttendanceApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Filters & Search
  const [selectedYear, setSelectedYear] = useState<string>("2026");
  const [mounted, setMounted] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [officialSearch, setOfficialSearch] = useState("");
  const [tempOfficialSearch, setTempOfficialSearch] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Modals
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingSession, setEditingSession] = useState<AttendanceSessionItem | null>(null);
  const [viewingSession, setViewingSession] = useState<AttendanceSessionItem | null>(null);
  const [viewingOfficial, setViewingOfficial] = useState<OfficialAttendanceStat | null>(null);
  const [viewingMonthGroup, setViewingMonthGroup] = useState<MonthGroupModalState | null>(null);
  const [monthActiveSessionId, setMonthActiveSessionId] = useState<number | null>(null);
  const [monthMobileView, setMonthMobileView] = useState<"list" | "detail">("list");
  const [pressedSessionId, setPressedSessionId] = useState<number | null>(null);
  const [deletingSession, setDeletingSession] = useState<AttendanceSessionItem | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formActivityType, setFormActivityType] = useState<string>("Regular Session");
  const [formDate, setFormDate] = useState(getTodayIso());
  const [formLocation, setFormLocation] = useState("Barangay Tocok SK Hall");
  const [formDescription, setFormDescription] = useState("");
  const [formChecklist, setFormChecklist] = useState<Record<number, AttendanceStatus>>({});
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);


  // Smooth modal open/close animation states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isMonthOpen, setIsMonthOpen] = useState(false);
  const [isSessionOpen, setIsSessionOpen] = useState(false);
  const [isOfficialOpen, setIsOfficialOpen] = useState(false);

  useEffect(() => {
    if (showFormModal) {
      const t = setTimeout(() => setIsFormOpen(true), 25);
      return () => clearTimeout(t);
    } else {
      setIsFormOpen(false);
    }
  }, [showFormModal]);

  useEffect(() => {
    if (viewingMonthGroup) {
      const t = setTimeout(() => setIsMonthOpen(true), 25);
      return () => clearTimeout(t);
    } else {
      setIsMonthOpen(false);
    }
  }, [viewingMonthGroup]);

  useEffect(() => {
    if (viewingSession) {
      const t = setTimeout(() => setIsSessionOpen(true), 25);
      return () => clearTimeout(t);
    } else {
      setIsSessionOpen(false);
    }
  }, [viewingSession]);

  useEffect(() => {
    if (viewingOfficial) {
      const t = setTimeout(() => setIsOfficialOpen(true), 25);
      return () => clearTimeout(t);
    } else {
      setIsOfficialOpen(false);
    }
  }, [viewingOfficial]);

  const closeFormModal = useCallback(() => {
    if (formSaving) return;
    setIsFormOpen(false);
    setTimeout(() => {
      setShowFormModal(false);
      setEditingSession(null);
    }, 260);
  }, [formSaving]);

  const closeMonthModal = useCallback(() => {
    setIsMonthOpen(false);
    setTimeout(() => {
      setViewingMonthGroup(null);
    }, 260);
  }, []);

  const closeSessionModal = useCallback(() => {
    setIsSessionOpen(false);
    setTimeout(() => {
      setViewingSession(null);
    }, 260);
  }, []);

  const closeOfficialModal = useCallback(() => {
    setIsOfficialOpen(false);
    setTimeout(() => {
      setViewingOfficial(null);
    }, 260);
  }, []);

  // Handle Escape key to smoothly close active modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showFormModal) closeFormModal();
        else if (viewingMonthGroup) closeMonthModal();
        else if (viewingSession) closeSessionModal();
        else if (viewingOfficial) closeOfficialModal();
        else if (showSearchModal) setShowSearchModal(false);
        else if (deletingSession && !deleteBusy) setDeletingSession(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showFormModal, viewingMonthGroup, viewingSession, viewingOfficial, showSearchModal, deletingSession, deleteBusy, closeFormModal, closeMonthModal, closeSessionModal, closeOfficialModal]);


  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  // Set mounted flag for safe client-side portals
  useEffect(() => {
    setMounted(true);
  }, []);

  // Provide tactile physical haptic & acoustic click feedback whenever clicking interactive elements
  useEffect(() => {
    const handleTactileClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const interactive = target.closest(
        "button, [role='button'], a, input, select, .cursor-pointer"
      );
      if (interactive) {
        triggerHaptic(12);
      }
    };

    window.addEventListener("click", handleTactileClick, { capture: true, passive: true });
    return () => {
      window.removeEventListener("click", handleTactileClick, { capture: true });
    };
  }, []);

  // Lock both document body & documentElement scroll whenever a modal is open
  const anyModalOpen =
    showSearchModal ||
    showFormModal ||
    Boolean(viewingSession) ||
    Boolean(viewingOfficial) ||
    Boolean(viewingMonthGroup) ||
    Boolean(deletingSession);

  useEffect(() => {
    if (!anyModalOpen) return;
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, [anyModalOpen]);

  useEffect(() => {
    if (showSearchModal) {
      searchInputRef.current?.focus({ preventScroll: true });
      const timer = setTimeout(() => searchInputRef.current?.focus({ preventScroll: true }), 50);
      return () => clearTimeout(timer);
    }
  }, [showSearchModal]);

  const fetchAttendance = useCallback(
    async (silent = false) => {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const params = new URLSearchParams();
        if (selectedYear) params.set("year", selectedYear);

        const res = await fetch(`/api/attendance?${params.toString()}`, {
          cache: "no-store",
        });

        const contentType = res.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) {
          throw new Error(
            res.ok
              ? "Received unexpected non-JSON response from server."
              : `Server returned an error (${res.status}). Please try again.`
          );
        }

        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error || "Failed to load attendance records.");
        }
        setData(json as AttendanceApiResponse);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load attendance records.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [selectedYear]
  );

  useEffect(() => {
    fetchAttendance(Boolean(data));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchAttendance]);

  // Hierarchy-ordered officials (Chairperson -> Secretary -> Treasurer -> Kagawads)
  const hierarchyOfficials = useMemo(() => {
    if (!data?.officials) return [];
    return [...data.officials].sort((a, b) => {
      const rankDiff = getOfficialRoleRank(a.role) - getOfficialRoleRank(b.role);
      if (rankDiff !== 0) return rankDiff;
      return a.id - b.id;
    });
  }, [data?.officials]);

  const filteredOfficials = useMemo(() => {
    const q = officialSearch.trim().toLowerCase();
    if (!q) return hierarchyOfficials;
    return hierarchyOfficials.filter(
      (o) => o.name.toLowerCase().includes(q) || o.role.toLowerCase().includes(q)
    );
  }, [hierarchyOfficials, officialSearch]);

  // All sessions for the active year and type filter (ordered chronological Jan -> Dec)
  const yearSessions = useMemo(() => {
    if (!data?.sessions) return [];
    const list = [...data.sessions];
    list.sort((a, b) => {
      const cmp = a.session_date.localeCompare(b.session_date);
      return cmp !== 0 ? cmp : a.id - b.id;
    });
    return list;
  }, [data?.sessions]);

  // Group sessions by month ("01" to "12")
  const sessionsByMonth = useMemo(() => {
    const map = new Map<string, AttendanceSessionItem[]>();
    for (const m of MONTHS) {
      map.set(m.num, []);
    }
    for (const s of yearSessions) {
      const monthNum = s.session_date.slice(5, 7);
      const arr = map.get(monthNum);
      if (arr) {
        arr.push(s);
      }
    }
    return map;
  }, [yearSessions]);

  // Overall attendance stats per official for the active view
  const officialYearStats = useMemo(() => {
    const map = new Map<number, { present: number; total: number; rate: number }>();
    const totalSessions = yearSessions.length;

    for (const o of hierarchyOfficials) {
      let present = 0;
      for (const s of yearSessions) {
        const rec = s.records.find((r) => r.user_id === o.id);
        if (rec?.status === "Present") present += 1;
      }
      const rate = totalSessions > 0 ? (present / totalSessions) * 100 : 0;
      map.set(o.id, { present, total: totalSessions, rate });
    }
    return map;
  }, [hierarchyOfficials, yearSessions]);

  const openCreateModal = () => {
    setEditingSession(null);
    setFormTitle("");
    setFormActivityType("Regular Session");
    setFormDate(getTodayIso());
    setFormLocation("Barangay Tocok SK Hall");
    setFormDescription("");
    setFormError(null);

    const initial: Record<number, AttendanceStatus> = {};
    for (const o of hierarchyOfficials) {
      initial[o.id] = "Present";
    }
    setFormChecklist(initial);
    setShowFormModal(true);
  };

  const openEditModal = (session: AttendanceSessionItem) => {
    setEditingSession(session);
    setFormTitle(session.title);
    setFormActivityType(session.activity_type || "Regular Session");
    setFormDate(session.session_date);
    setFormLocation(session.location || "");
    setFormDescription(session.description || "");
    setFormError(null);

    const initial: Record<number, AttendanceStatus> = {};
    for (const o of hierarchyOfficials) {
      const rec = session.records.find((r) => r.user_id === o.id);
      initial[o.id] = rec?.status === "Present" ? "Present" : "Absent";
    }
    setFormChecklist(initial);
    setShowFormModal(true);
  };

  const toggleOfficialStatus = (userId: number) => {
    setFormChecklist((prev) => ({
      ...prev,
      [userId]: prev[userId] === "Present" ? "Absent" : "Present",
    }));
  };

  const setAllChecklistStatus = (status: AttendanceStatus) => {
    const next: Record<number, AttendanceStatus> = {};
    for (const o of hierarchyOfficials) {
      next[o.id] = status;
    }
    setFormChecklist(next);
  };

  const checklistPresentCount = useMemo(() => {
    return hierarchyOfficials.filter((o) => formChecklist[o.id] === "Present").length;
  }, [hierarchyOfficials, formChecklist]);

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setFormError("Please enter a session title.");
      return;
    }
    if (!formDate) {
      setFormError("Please select a date.");
      return;
    }

    setFormSaving(true);
    setFormError(null);

    try {
      const payload = {
        title: formTitle.trim(),
        activity_type: formActivityType,
        session_date: formDate,
        location: formLocation.trim(),
        description: formDescription.trim(),
        records: hierarchyOfficials.map((o) => ({
          user_id: o.id,
          status: formChecklist[o.id] === "Present" ? "Present" : "Absent",
        })),
      };

      const url = editingSession ? `/api/attendance/${editingSession.id}` : "/api/attendance";
      const method = editingSession ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        throw new Error(`Server returned an error (${res.status}). Please try again.`);
      }

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to save attendance.");
      }

      const wasEditing = Boolean(editingSession);
      closeFormModal();
      setToast({
        type: "success",
        message: wasEditing ? "Session updated." : "New session recorded.",
      });
      await fetchAttendance(true);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save attendance.");
    } finally {
      setFormSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingSession) return;
    setDeleteBusy(true);
    try {
      const res = await fetch(`/api/attendance/${deletingSession.id}`, {
        method: "DELETE",
      });
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        throw new Error(`Server returned an error (${res.status}). Please try again.`);
      }
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to delete session.");
      }
      setDeletingSession(null);
      if (viewingSession?.id === deletingSession.id) {
        setViewingSession(null);
      }
      setToast({ type: "success", message: "Attendance session removed." });
      await fetchAttendance(true);
    } catch (err) {
      setToast({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to delete session.",
      });
    } finally {
      setDeleteBusy(false);
    }
  };

  const summary = data?.summary;
  const availableYears = data?.availableYears || ["2026"];

  return (
    <div className={mode === "public" ? "max-w-6xl mx-auto px-3 sm:px-6 pt-3 pb-24 md:pb-12 space-y-4" : "space-y-4"}>
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-20 md:top-6 right-4 z-[70] flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg border text-xs font-bold transition-all ${
            toast.type === "success"
              ? "bg-emerald-600 text-white border-emerald-500"
              : "bg-rose-600 text-white border-rose-500"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* =========================================================================
          HEADER & LEGEND
         ========================================================================= */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-950 dark:text-slate-100">
              SK Council Attendance
            </h1>
            {availableYears.length > 1 ? (
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                aria-label="Filter year"
                className="px-2 py-0.5 text-xs font-bold bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer active:scale-95 transition-all select-none"
              >
                {availableYears.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-sm font-bold text-slate-400 dark:text-slate-500">
                ({selectedYear})
              </span>
            )}
            {refreshing && (
              <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                <Loader2 className="w-3 h-3 animate-spin text-brand-600" />
                Updating...
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
            Annual 12-month participation record for each SK official.
          </p>
        </div>

        {/* Legend right side of the title */}
        <div className="flex items-center gap-3 sm:gap-4 text-[11px] text-slate-500 dark:text-slate-400 flex-wrap shrink-0">
          <span className="inline-flex items-center gap-1.5 font-medium">
            <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-emerald-500 shadow-2xs shrink-0 -translate-y-0.5" />
            <span>Present</span>
          </span>
          <span className="inline-flex items-center gap-1.5 font-medium">
            <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full border-[1.5px] border-rose-500 bg-rose-50 dark:bg-rose-950 shrink-0 -translate-y-0.5" />
            <span>Absent</span>
          </span>
        </div>
      </div>

      {/* =========================================================================
          THE ANNUAL ATTENDANCE PUNCH STRIP (MAIN EVENT)
         ========================================================================= */}
      <section className="bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs overflow-hidden">
        {loading && !data ? (
          <div className="p-12 text-center text-xs text-slate-400 space-y-2">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-brand-600" />
            <p>Loading attendance punch strip...</p>
          </div>
        ) : error ? (
          <div className="p-6 text-center text-xs text-rose-600 dark:text-rose-400 space-y-2">
            <p>{error}</p>
            <button
              type="button"
              onClick={() => fetchAttendance(false)}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-lg font-bold cursor-pointer transition-all select-none"
            >
              Retry
            </button>
          </div>
        ) : hierarchyOfficials.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-400">
            No SK Officials found in database.
          </div>
        ) : filteredOfficials.length === 0 ? (
          <div className="py-12 text-center text-slate-400 dark:text-slate-500">
            <div className="flex flex-col items-center justify-center gap-1.5">
              <Search className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-1" />
              <p className="font-bold text-slate-700 dark:text-slate-300 text-sm">
                No officials match &ldquo;{officialSearch}&rdquo;
              </p>
              <button
                type="button"
                onClick={() => {
                  setOfficialSearch("");
                  setTempOfficialSearch("");
                }}
                className="text-xs text-brand-600 dark:text-brand-400 font-semibold hover:underline active:scale-95 transition-transform cursor-pointer select-none"
              >
                Clear search filter
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* =========================================================================
                DESKTOP VIEW: Full 12-Month Punch Matrix Table (Visible on md+ screens)
               ========================================================================= */}
            <div className="hidden md:block overflow-x-auto themed-scrollbar">
              <table className="w-full text-left border-collapse min-w-[760px] lg:min-w-0">
                <thead>
                  <tr className="border-b border-slate-200/90 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-800/80 text-[10.5px] uppercase tracking-wider font-extrabold text-slate-500 dark:text-slate-400">
                    <th scope="col" className="py-3 px-3 sm:px-4 min-w-[165px] sm:min-w-[195px] lg:min-w-[220px] sticky left-0 z-10 bg-slate-50 dark:bg-slate-800/90 backdrop-blur-xs">
                      SK Official
                    </th>
                    {MONTHS.map((m) => (
                      <th scope="col" key={m.num} className="py-3 px-1 text-center font-bold min-w-[56px] sm:min-w-[62px]">
                        <span title={m.full}>{m.short}</span>
                      </th>
                    ))}
                    <th scope="col" className="py-3 px-4 text-right min-w-[125px] whitespace-nowrap font-bold">
                      Score • Rate
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredOfficials.map((official) => {
                    const stat = officialYearStats.get(official.id) || {
                      present: 0,
                      total: yearSessions.length,
                      rate: 0,
                    };
                    const standing = getActivityStanding(stat.rate, stat.total);
                    const nameParts = splitOfficialName(official.name);

                    return (
                      <tr
                        key={official.id}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors group"
                      >
                        {/* Left: Official Avatar & Title (Sticky on horizontal scroll) */}
                        <td className="py-3 px-3 sm:px-4 sticky left-0 z-10 bg-white dark:bg-slate-900 group-hover:bg-slate-50/90 dark:group-hover:bg-slate-800/90 transition-colors">
                          <button
                            type="button"
                            onClick={() => setViewingOfficial(official)}
                            className="flex items-center gap-3 text-left group/btn cursor-pointer w-full select-none active:scale-[0.98] transition-transform duration-100 ease-out"
                          >
                            <div className="relative w-11 h-11 sm:w-12 sm:h-12 rounded-full overflow-hidden shrink-0 bg-brand-50 dark:bg-brand-950/60 flex items-center justify-center border border-slate-200 dark:border-slate-700 ring-2 ring-brand-500/15 shadow-xs">
                              <span className="text-sm font-black text-brand-700 dark:text-brand-300 select-none">
                                {getOfficialInitials(official.name)}
                              </span>
                              {official.avatar_url && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={official.avatar_url}
                                  alt={official.name}
                                  onError={(e) => {
                                    (e.currentTarget as HTMLElement).style.display = "none";
                                  }}
                                  className="absolute inset-0 w-full h-full object-cover"
                                />
                              )}
                            </div>
                            <div className="min-w-0 flex-1 leading-snug">
                              <p className="font-extrabold text-xs sm:text-[13px] text-slate-900 dark:text-slate-100 group-hover/btn:text-brand-600 dark:group-hover/btn:text-brand-400 transition-colors tracking-wide truncate uppercase">
                                {nameParts.surname}
                              </p>
                              {nameParts.restOfName && (
                                <p className="text-[10.5px] sm:text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                                  {nameParts.restOfName}
                                </p>
                              )}
                              <p className="text-[9.5px] sm:text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                                {official.role}
                              </p>
                            </div>
                          </button>
                        </td>

                        {/* Middle: The 12-Month Punch Strip */}
                        {MONTHS.map((month) => {
                          const sessionsInThisMonth = sessionsByMonth.get(month.num) || [];
                          const hasSessions = sessionsInThisMonth.length > 0;

                          return (
                            <td
                              key={month.num}
                              className="py-2.5 px-1 text-center align-middle"
                            >
                              {hasSessions ? (
                                <button
                                  type="button"
                                  onTouchStart={() => triggerHaptic(12)}
                                  onClick={() => {
                                    triggerHaptic(20);
                                    if (sessionsInThisMonth.length === 1) {
                                      setViewingSession(sessionsInThisMonth[0]);
                                    } else {
                                      setMonthActiveSessionId(sessionsInThisMonth[0]?.id || null);
                                      setMonthMobileView("list");
                                      setViewingMonthGroup({
                                        month,
                                        official,
                                        sessions: sessionsInThisMonth,
                                      });
                                    }
                                  }}
                                  title={`${month.full} (${sessionsInThisMonth.length} ${
                                    sessionsInThisMonth.length === 1 ? "activity" : "activities"
                                  })\n${official.name}\nClick to inspect all ${month.full} activities`}
                                  className="flex flex-wrap items-center justify-center gap-1 max-w-[56px] sm:max-w-[62px] min-h-[22px] mx-auto p-1 rounded-lg hover:bg-slate-100/90 dark:hover:bg-slate-800/90 active:scale-90 active:bg-slate-200/80 dark:active:bg-slate-700/80 transition-all duration-100 cursor-pointer group/cell focus:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500/50 select-none"
                                >
                                  {sessionsInThisMonth.map((s) => {
                                    const rec = s.records.find((r) => r.user_id === official.id);
                                    const isPresent = rec?.status === "Present";

                                    return (
                                      <span
                                        key={s.id}
                                        className={`group-hover/cell:scale-110 transition-transform rounded-full shrink-0 ${
                                          isPresent
                                            ? "w-2 h-2 sm:w-2.5 sm:h-2.5 bg-emerald-500 shadow-2xs"
                                            : "w-2 h-2 sm:w-2.5 sm:h-2.5 border-[1.5px] border-rose-500 bg-rose-50 dark:bg-rose-950/70"
                                        }`}
                                      />
                                    );
                                  })}
                                </button>
                              ) : (
                                <div className="flex items-center justify-center min-h-[22px]">
                                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 opacity-40" />
                                </div>
                              )}
                            </td>
                          );
                        })}

                        {/* Right: Score, Percentage, & Civic Standing */}
                        <td className="py-3 px-4 text-right align-middle whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setViewingOfficial(official)}
                            title={`${official.name}: ${standing.label} (${stat.rate.toFixed(0)}%)`}
                            className="text-right group/stat cursor-pointer inline-flex flex-col items-end select-none active:scale-95 transition-transform duration-100 ease-out"
                          >
                            <div className="flex items-baseline justify-end gap-1 font-mono font-bold text-xs text-slate-900 dark:text-slate-100 leading-tight group-hover/stat:text-brand-700 dark:group-hover/stat:text-brand-400 transition-colors">
                              <span>{stat.rate.toFixed(0)}%</span>
                              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">
                                ({stat.present}/{stat.total})
                              </span>
                            </div>
                            <div className="flex items-center justify-end gap-1.5 mt-0.5">
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 -translate-y-px ${standing.dotClass}`} />
                              <span className={`text-[10px] sm:text-[10.5px] font-semibold tracking-tight ${standing.textClass}`}>
                                {standing.shortLabel}
                              </span>
                            </div>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* =========================================================================
                MOBILE VIEW: Responsive Official Cards (Zero horizontal scroll)
               ========================================================================= */}
            <div className="block md:hidden divide-y divide-slate-100 dark:divide-slate-800">
              {filteredOfficials.map((official) => {
                const stat = officialYearStats.get(official.id) || {
                  present: 0,
                  total: yearSessions.length,
                  rate: 0,
                };
                const standing = getActivityStanding(stat.rate, stat.total);
                const nameParts = splitOfficialName(official.name);

                return (
                  <div
                    key={official.id}
                    className="p-3.5 space-y-2.5 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                  >
                    {/* Top Row: Official Identity & Overall Grade */}
                    <div className="flex items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => setViewingOfficial(official)}
                        className="flex items-center gap-3 text-left min-w-0 flex-1 cursor-pointer group select-none active:scale-[0.98] transition-transform duration-100 ease-out"
                      >
                        {/* Avatar (Large & clear, 44px) */}
                        <div className="relative w-11 h-11 rounded-full overflow-hidden shrink-0 bg-brand-50 dark:bg-brand-950/60 flex items-center justify-center border border-slate-200 dark:border-slate-700 ring-2 ring-brand-500/15 shadow-xs">
                          <span className="text-sm font-black text-brand-700 dark:text-brand-300 select-none">
                            {getOfficialInitials(official.name)}
                          </span>
                          {official.avatar_url && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={official.avatar_url}
                              alt={official.name}
                              onError={(e) => {
                                (e.currentTarget as HTMLElement).style.display = "none";
                              }}
                              className="absolute inset-0 w-full h-full object-cover"
                            />
                          )}
                        </div>

                        <div className="min-w-0 flex-1 leading-snug">
                          <p className="font-extrabold text-[13px] text-slate-900 dark:text-slate-100 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors tracking-wide truncate uppercase">
                            {nameParts.surname}
                          </p>
                          {nameParts.restOfName && (
                            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                              {nameParts.restOfName}
                            </p>
                          )}
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                            {official.role}
                          </p>
                        </div>
                      </button>

                      {/* Overall Score & Civic Standing */}
                      <button
                        type="button"
                        onClick={() => setViewingOfficial(official)}
                        className="flex flex-col items-end shrink-0 cursor-pointer text-right select-none active:scale-95 transition-transform duration-100 ease-out"
                      >
                        <div className="flex items-baseline gap-1 font-mono font-bold text-xs text-slate-900 dark:text-slate-100">
                          <span>{stat.rate.toFixed(0)}%</span>
                          <span className="text-[10px] text-slate-400 font-normal">
                            ({stat.present}/{stat.total})
                          </span>
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${standing.dotClass}`} />
                          <span className={`text-[10px] font-semibold ${standing.textClass}`}>
                            {standing.shortLabel}
                          </span>
                        </div>
                      </button>
                    </div>

                    {/* Bottom Grid: 12-Month Punch Grid (6 columns x 2 rows, fits screen perfectly) */}
                    <div className="grid grid-cols-6 gap-1 bg-slate-50/80 dark:bg-slate-800/40 p-1.5 rounded-xl border border-slate-100 dark:border-slate-800/80">
                      {MONTHS.map((month) => {
                        const sessionsInThisMonth = sessionsByMonth.get(month.num) || [];
                        const hasSessions = sessionsInThisMonth.length > 0;

                        return (
                          <div key={month.num} className="flex flex-col items-center">
                            <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tight mb-0.5">
                              {month.short}
                            </span>

                            {hasSessions ? (
                              <button
                                type="button"
                                onTouchStart={() => triggerHaptic(12)}
                                onClick={() => {
                                  triggerHaptic(20);
                                  if (sessionsInThisMonth.length === 1) {
                                    setViewingSession(sessionsInThisMonth[0]);
                                  } else {
                                    setMonthActiveSessionId(sessionsInThisMonth[0]?.id || null);
                                    setMonthMobileView("list");
                                    setViewingMonthGroup({
                                      month,
                                      official,
                                      sessions: sessionsInThisMonth,
                                    });
                                  }
                                }}
                                className="w-full min-h-[28px] p-1 rounded-md hover:bg-white dark:hover:bg-slate-700/60 active:bg-slate-200 dark:active:bg-slate-700 active:scale-90 transition-all duration-100 flex flex-wrap items-center justify-center gap-0.5 cursor-pointer select-none"
                                title={`${month.full} (${sessionsInThisMonth.length} activities)`}
                              >
                                {sessionsInThisMonth.map((s) => {
                                  const rec = s.records.find((r) => r.user_id === official.id);
                                  const isPresent = rec?.status === "Present";

                                  return (
                                    <span
                                      key={s.id}
                                      className={`rounded-full shrink-0 ${
                                        isPresent
                                          ? "w-2 h-2 bg-emerald-500 shadow-2xs"
                                          : "w-2 h-2 border-[1.5px] border-rose-500 bg-rose-50 dark:bg-rose-950/70"
                                      }`}
                                    />
                                  );
                                })}
                              </button>
                            ) : (
                              <div className="min-h-[28px] flex items-center justify-center">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 opacity-40" />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>

      {/* =========================================================================
          QUICK SUMMARY STRIP & FOOTER INSIGHTS
         ========================================================================= */}
      {summary && (
        <div className="bg-slate-50/80 dark:bg-slate-900/60 rounded-xl border border-slate-200/80 dark:border-slate-800/80 p-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-4 flex-wrap">
            <span>
              <strong>{yearSessions.length}</strong> sessions &amp; activities recorded in {selectedYear}
            </span>
            <span>•</span>
            <span>
              Council Turnout: <strong className="text-brand-700 dark:text-brand-400">{summary.averageAttendanceRate.toFixed(1)}%</strong>
            </span>
            <span>•</span>
            <span>
              Active Officials: <strong className="text-emerald-700 dark:text-emerald-400">{summary.activeOfficialsCount}/{summary.totalOfficialsCount}</strong>
            </span>
          </div>

          <div className="text-[11px] text-slate-400">
            Click any dot to inspect roll call • Click any official to view annual breakdown
          </div>
        </div>
      )}

      {/* =========================================================================
          FLOATING ACTION BUTTONS (SEARCH & RECORD SESSION)
         ========================================================================= */}
      <div data-page-fab className="fixed bottom-20 md:bottom-8 right-4 md:right-8 z-40 flex items-center gap-2.5 sm:gap-3 pointer-events-auto">
        {/* Floating Search Button */}
        <button
          type="button"
          onClick={() => {
            setTempOfficialSearch(officialSearch);
            setShowSearchModal(true);
          }}
          title={officialSearch ? `Search: "${officialSearch}"` : "Search Officials"}
          aria-label="Search Officials"
          className={`relative w-12 h-12 sm:w-13 sm:h-13 rounded-full ${
            officialSearch
              ? "bg-slate-900 dark:bg-slate-800 text-white ring-2 ring-brand-500 shadow-xl md:shadow-lg shadow-brand-950/25"
              : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 shadow-xl md:shadow-lg shadow-slate-900/15 dark:shadow-black/40 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/80"
          } flex items-center justify-center cursor-pointer hover:scale-105 active:scale-90 active:brightness-95 transition-all duration-150 group focus:outline-none focus:ring-4 focus:ring-brand-500/30 select-none`}
        >
          <Search className="w-5 h-5 sm:w-5.5 sm:h-5.5 transition-transform duration-200 group-hover:scale-110" />

          {/* Active dot indicator */}
          {officialSearch && (
            <span className="absolute top-1 right-1 w-3 h-3 rounded-full bg-brand-500 border-2 border-white dark:border-slate-900" />
          )}

          {/* Desktop Hover Tooltip */}
          <span className="hidden md:group-hover:block absolute bottom-full mb-2.5 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-lg bg-slate-900 dark:bg-slate-800 dark:border dark:border-slate-700 text-white text-xs font-semibold whitespace-nowrap shadow-md pointer-events-none animate-in fade-in zoom-in-95 duration-150">
            {officialSearch ? `Search: "${officialSearch}"` : "Search Officials"}
          </span>
        </button>

        {/* Floating Add Session Button */}
        {canManage && (
          <button
            type="button"
            onClick={openCreateModal}
            disabled={loading || hierarchyOfficials.length === 0}
            title="Record Session"
            aria-label="Record Attendance Session"
            className="w-12 h-12 sm:w-13 sm:h-13 rounded-full bg-brand-600 hover:bg-brand-700 hover:scale-105 active:scale-90 active:brightness-95 disabled:opacity-50 text-white flex items-center justify-center shadow-lg shadow-brand-900/25 hover:shadow-xl hover:shadow-brand-900/35 border border-white/20 dark:border-brand-400/20 transition-all duration-150 cursor-pointer group select-none"
          >
            <Plus className="w-6 h-6 stroke-[2.5] transition-transform duration-200 group-hover:rotate-90" />

            {/* Desktop Hover Tooltip */}
            <span className="hidden md:group-hover:block absolute bottom-full mb-2.5 right-0 px-2.5 py-1 rounded-lg bg-slate-900 dark:bg-slate-800 dark:border dark:border-slate-700 text-white text-xs font-semibold whitespace-nowrap shadow-md pointer-events-none animate-in fade-in zoom-in-95 duration-150">
              Record Session
            </span>
          </button>
        )}
      </div>

      {/* =========================================================================
          SEARCH OFFICIALS MODAL
         ========================================================================= */}
      {mounted && showSearchModal && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Search SK Officials"
          className="fixed inset-0 z-[100] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center overscroll-contain select-none touch-none"
          style={{
            paddingTop: "max(0.75rem, env(safe-area-inset-top, 0px))",
            paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))",
            paddingLeft: "max(0.75rem, env(safe-area-inset-left, 0px))",
            paddingRight: "max(0.75rem, env(safe-area-inset-right, 0px))",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowSearchModal(false);
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setOfficialSearch(tempOfficialSearch.trim());
              setShowSearchModal(false);
            }}
            className="relative bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200/90 dark:border-slate-800 overflow-hidden overscroll-contain select-text font-sans touch-auto flex flex-col animate-in zoom-in-95 duration-150"
            style={{
              maxHeight: "calc(100dvh - 1.5rem - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search Input Row */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                autoFocus
                inputMode="search"
                placeholder="Search official by name or role..."
                value={tempOfficialSearch}
                onChange={(e) => setTempOfficialSearch(e.target.value)}
                className="w-full bg-transparent text-sm [line-height:normal] py-0.5 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
              />
              {tempOfficialSearch && (
                <button
                  type="button"
                  onClick={() => setTempOfficialSearch("")}
                  className="p-1 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-90 active:bg-slate-200 dark:active:bg-slate-700 transition-all cursor-pointer shrink-0 select-none"
                  title="Clear input"
                  aria-label="Clear input"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Footer Bar */}
            <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-slate-50/70 dark:bg-slate-800/60 shrink-0">
              {officialSearch ? (
                <button
                  type="button"
                  onClick={() => {
                    setTempOfficialSearch("");
                    setOfficialSearch("");
                    setShowSearchModal(false);
                  }}
                  className="text-xs font-medium text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 active:scale-95 transition-all cursor-pointer select-none"
                >
                  Clear active search
                </button>
              ) : (
                <span className="text-[11px] text-slate-400 dark:text-slate-500">
                  Press Enter to search
                </span>
              )}

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowSearchModal(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 active:scale-95 transition-all cursor-pointer select-none"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 active:scale-95 active:brightness-95 text-white text-xs font-semibold transition-all cursor-pointer shadow-sm select-none"
                >
                  Search
                </button>
              </div>
            </div>
          </form>
        </div>,
        document.body
      )}

      {/* =========================================================================
          MODAL 1: RECORD / EDIT SESSION CHECKLIST
         ========================================================================= */}
      {mounted && showFormModal && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[100] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center overscroll-contain touch-none"
          style={{
            paddingTop: "max(0.75rem, env(safe-area-inset-top, 0px))",
            paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))",
            paddingLeft: "max(0.75rem, env(safe-area-inset-left, 0px))",
            paddingRight: "max(0.75rem, env(safe-area-inset-right, 0px))",
            opacity: isFormOpen ? 1 : 0,
            transition: "opacity 260ms cubic-bezier(0.16, 1, 0.3, 1)",
            pointerEvents: isFormOpen ? "auto" : "none",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !formSaving) closeFormModal();
          }}
        >
          <div
            className="bg-white dark:bg-slate-900 w-full sm:max-w-xl rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden touch-auto"
            style={{
              maxHeight: "calc(100dvh - 1.5rem - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))",
              opacity: isFormOpen ? 1 : 0,
              transform: isFormOpen
                ? "scale(1) translateY(0px)"
                : "scale(0.92) translateY(24px)",
              transition: "transform 260ms cubic-bezier(0.16, 1, 0.3, 1), opacity 240ms cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            {/* Header: shrink-0 */}
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                  {editingSession ? "Edit Attendance Session" : "Record Attendance Session"}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Mark Present or Absent for each council member.
                </p>
              </div>
              <button
                type="button"
                onClick={closeFormModal}
                disabled={formSaving}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveForm} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5 flex-1 min-h-0 themed-scrollbar overscroll-contain">
                {formError && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs font-semibold text-rose-700 dark:text-rose-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* Session Title */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Session / Activity Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="e.g. 7th Regular Session"
                    className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                  />
                </div>

                {/* Date & Type */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Type
                    </label>
                    <select
                      value={formActivityType}
                      onChange={(e) => setFormActivityType(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                    >
                      {ACTIVITY_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Venue / Location */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Location / Venue
                  </label>
                  <input
                    type="text"
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    placeholder="Barangay Tocok SK Hall"
                    className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                  />
                </div>

                {/* Roll Call Checklist */}
                <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      Roll Call ({checklistPresentCount}/{hierarchyOfficials.length} Present)
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setAllChecklistStatus("Present")}
                        className="px-2 py-0.5 rounded text-[10.5px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 active:scale-95 transition-all select-none cursor-pointer"
                      >
                        All Present
                      </button>
                      <button
                        type="button"
                        onClick={() => setAllChecklistStatus("Absent")}
                        className="px-2 py-0.5 rounded text-[10.5px] font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-900/40 active:scale-95 transition-all select-none cursor-pointer"
                      >
                        All Absent
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {hierarchyOfficials.map((official) => {
                      const isPresent = formChecklist[official.id] === "Present";
                      return (
                        <button
                          key={official.id}
                          type="button"
                          onClick={() => toggleOfficialStatus(official.id)}
                          className={`flex items-center justify-between gap-2 p-2.5 rounded-xl border text-left transition-all duration-100 cursor-pointer select-none active:scale-[0.97] ${
                            isPresent
                              ? "bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 active:bg-emerald-100/70"
                              : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:border-rose-300 active:bg-slate-100 dark:active:bg-slate-700"
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                              {getOfficialShortName(official.name)}
                            </p>
                            <p className="text-[10px] text-slate-400 truncate">{official.role}</p>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10.5px] font-extrabold flex items-center gap-1 shrink-0 ${
                              isPresent
                                ? "bg-emerald-600 text-white"
                                : "bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300"
                            }`}
                          >
                            {isPresent ? (
                              <>
                                <Check className="w-3 h-3 stroke-[3]" />
                                Present
                              </>
                            ) : (
                              <>
                                <X className="w-3 h-3 stroke-[2.5]" />
                                Absent
                              </>
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Footer: shrink-0 */}
              <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  disabled={formSaving}
                  onClick={closeFormModal}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 active:scale-95 transition-all cursor-pointer select-none"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSaving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 active:scale-95 active:brightness-95 text-white text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50 select-none"
                >
                  {formSaving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {editingSession ? "Save Changes" : "Save Session"}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* =========================================================================
          MODAL 2: VIEW SESSION ROLL CALL
         ========================================================================= */}
      {mounted && viewingSession && createPortal(
        <div
          className="fixed inset-0 z-[100] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center overscroll-contain touch-none"
          style={{
            paddingTop: "max(0.75rem, env(safe-area-inset-top, 0px))",
            paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))",
            paddingLeft: "max(0.75rem, env(safe-area-inset-left, 0px))",
            paddingRight: "max(0.75rem, env(safe-area-inset-right, 0px))",
            opacity: isSessionOpen ? 1 : 0,
            transition: "opacity 260ms cubic-bezier(0.16, 1, 0.3, 1)",
            pointerEvents: isSessionOpen ? "auto" : "none",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeSessionModal();
          }}
        >
          <div
            className="bg-white dark:bg-slate-900 w-full sm:max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden touch-auto"
            style={{
              maxHeight: "calc(100dvh - 1.5rem - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))",
              opacity: isSessionOpen ? 1 : 0,
              transform: isSessionOpen
                ? "scale(1) translateY(0px)"
                : "scale(0.92) translateY(24px)",
              transition: "transform 260ms cubic-bezier(0.16, 1, 0.3, 1), opacity 240ms cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div className="space-y-1 min-w-0">
                <span
                  className={`inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full border ${getActivityTypeBadge(
                    viewingSession.activity_type
                  )}`}
                >
                  {viewingSession.activity_type}
                </span>
                <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-100 leading-snug">
                  {viewingSession.title}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {formatDateDisplay(viewingSession.session_date)}
                  {viewingSession.location && ` • ${viewingSession.location}`}
                </p>
              </div>
            </div>

            <div className="p-4 overflow-y-auto space-y-2 flex-1 min-h-0 themed-scrollbar overscroll-contain">
              <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-300 pb-1">
                <span>Roll Call</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400">
                  {viewingSession.presentCount}/{viewingSession.totalCount} Present (
                  {viewingSession.attendanceRate.toFixed(0)}%)
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                {hierarchyOfficials.map((official) => {
                  const rec = viewingSession.records.find((r) => r.user_id === official.id);
                  const isPresent = rec?.status === "Present";
                  const { surname } = splitOfficialName(official.name);

                  return (
                    <button
                      key={official.id}
                      type="button"
                      onClick={() => {
                        setViewingSession(null);
                        setViewingOfficial(official);
                      }}
                      title={`View ${official.name}'s attendance history`}
                      className="flex items-center gap-2 sm:gap-2.5 p-2 sm:p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/60 bg-slate-50/40 dark:bg-slate-800/20 hover:bg-slate-100/70 dark:hover:bg-slate-800/50 hover:border-slate-300 dark:hover:border-slate-700 active:scale-[0.96] transition-all duration-100 cursor-pointer text-left select-none"
                    >
                      {/* Avatar with corner status badge */}
                      <div className="relative shrink-0">
                        <div
                          className={`relative w-9 h-9 sm:w-10 sm:h-10 rounded-full overflow-hidden bg-brand-50 dark:bg-brand-950/60 flex items-center justify-center border ${
                            isPresent
                              ? "border-emerald-200 dark:border-emerald-800"
                              : "border-slate-200 dark:border-slate-700 opacity-60 grayscale"
                          }`}
                        >
                          <span className="text-xs font-black text-brand-700 dark:text-brand-300 select-none">
                            {getOfficialInitials(official.name)}
                          </span>
                          {official.avatar_url && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={official.avatar_url}
                              alt={official.name}
                              onError={(e) => {
                                (e.currentTarget as HTMLElement).style.display = "none";
                              }}
                              className="absolute inset-0 w-full h-full object-cover"
                            />
                          )}
                        </div>

                        {/* Corner Status Badge */}
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full flex items-center justify-center ring-2 ring-white dark:ring-slate-900 shadow-2xs ${
                            isPresent
                              ? "bg-emerald-500 text-white"
                              : "bg-rose-500 text-white"
                          }`}
                        >
                          {isPresent ? (
                            <Check className="w-2 h-2 sm:w-2.5 sm:h-2.5 stroke-[3]" />
                          ) : (
                            <X className="w-2 h-2 sm:w-2.5 sm:h-2.5 stroke-[3]" />
                          )}
                        </span>
                      </div>

                      {/* Official Identity: Bold Surname + Clean Role */}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                          {surname}
                        </p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                          {official.role.replace("SK ", "")}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {canManage ? (
              <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900 flex items-center justify-between shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const s = viewingSession;
                    setViewingSession(null);
                    setDeletingSession(s);
                  }}
                  className="text-xs text-rose-600 hover:text-rose-700 active:scale-95 transition-all font-semibold cursor-pointer select-none"
                >
                  Delete Session
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const s = viewingSession;
                    setViewingSession(null);
                    openEditModal(s);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 active:scale-95 active:brightness-95 text-white text-xs font-bold transition-all cursor-pointer select-none"
                >
                  <Pencil className="w-3 h-3" />
                  <span>Edit Roll Call</span>
                </button>
              </div>
            ) : (
              <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900 flex items-center justify-end shrink-0">
                <button
                  type="button"
                  onTouchStart={() => triggerHaptic(12)}
                  onClick={() => {
                    triggerHaptic(15);
                    closeSessionModal();
                  }}
                  className="px-4 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold hover:bg-slate-800 dark:hover:bg-white/90 active:scale-95 active:brightness-90 transition-all cursor-pointer shrink-0 select-none shadow-xs"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* =========================================================================
          MODAL 2B: VIEW MONTH ACTIVITIES & SESSIONS GROUP (MINIMALIST & VISUAL)
         ========================================================================= */}
      {mounted && viewingMonthGroup && createPortal((() => {
        const sortedSessions = [...viewingMonthGroup.sessions].sort((a, b) =>
          a.session_date.localeCompare(b.session_date)
        );
        const attendedInMonth = viewingMonthGroup.sessions.filter((s) =>
          s.records.some((r) => r.user_id === viewingMonthGroup.official.id && r.status === "Present")
        ).length;
        const totalInMonth = viewingMonthGroup.sessions.length;

        const activeSession =
          sortedSessions.find((s) => s.id === monthActiveSessionId) || sortedSessions[0];

        return (
          <div
            className="fixed inset-0 z-[100] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center overscroll-contain touch-none"
            style={{
              paddingTop: "max(0.75rem, env(safe-area-inset-top, 0px))",
              paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))",
              paddingLeft: "max(0.75rem, env(safe-area-inset-left, 0px))",
              paddingRight: "max(0.75rem, env(safe-area-inset-right, 0px))",
              opacity: isMonthOpen ? 1 : 0,
              transition: "opacity 260ms cubic-bezier(0.16, 1, 0.3, 1)",
              pointerEvents: isMonthOpen ? "auto" : "none",
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) closeMonthModal();
            }}
          >
            <div
              className="bg-white dark:bg-slate-900 w-full max-w-4xl lg:max-w-5xl rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden touch-auto"
              style={{
                maxHeight: "calc(100dvh - 1.5rem - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))",
                height: "min(640px, calc(100dvh - 1.5rem - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px)))",
                opacity: isMonthOpen ? 1 : 0,
                transform: isMonthOpen
                  ? "scale(1) translateY(0px)"
                  : "scale(0.92) translateY(24px)",
                transition: "transform 260ms cubic-bezier(0.16, 1, 0.3, 1), opacity 240ms cubic-bezier(0.16, 1, 0.3, 1)",
              }}
            >
              {/* Ultra-Minimal Header: Visual & concise */}
              <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4 bg-slate-50/70 dark:bg-slate-900/80 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  {/* Official photo avatar */}
                  <div className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-full overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700 ring-2 ring-slate-200 dark:ring-slate-700 bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    <span className="text-xs font-black text-brand-700 dark:text-brand-300 select-none">
                      {getOfficialInitials(viewingMonthGroup.official.name)}
                    </span>
                    {viewingMonthGroup.official.avatar_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={viewingMonthGroup.official.avatar_url}
                        alt={viewingMonthGroup.official.name}
                        onError={(e) => {
                          (e.currentTarget as HTMLElement).style.display = "none";
                        }}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-slate-100 truncate">
                        {splitOfficialName(viewingMonthGroup.official.name).surname}
                      </h3>
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-[10.5px] font-bold text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60">
                        <Check className="w-3 h-3 stroke-[3]" />
                        {attendedInMonth}/{totalInMonth}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-medium truncate">
                      {viewingMonthGroup.month.full} {selectedYear}
                    </p>
                  </div>
                </div>
              </div>

              {/* Master-Detail Split Workspace (Responsive on Mobile, Side-by-Side on Desktop) */}
              <div className="flex-1 overflow-hidden min-h-0 relative flex flex-col md:flex-row">
                {/* Left Pane: Activities List (Visible on desktop OR when mobile view is 'list') */}
                <div
                  className={`w-full md:w-[290px] lg:w-[320px] shrink-0 flex flex-col h-full border-r border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/30 min-h-0 overflow-hidden ${
                    monthMobileView === "detail" ? "hidden md:flex" : "flex"
                  }`}
                >
                  <div className="p-2 space-y-1.5 overflow-y-auto flex-1 themed-scrollbar overscroll-contain min-h-0">
                    {sortedSessions.map((s) => {
                      const rec = s.records.find((r) => r.user_id === viewingMonthGroup.official.id);
                      const isPresent = rec?.status === "Present";
                      const isSelected = activeSession?.id === s.id;
                      const isPressed = pressedSessionId === s.id;
                      const dateParts = getSessionDateParts(s.session_date);

                      return (
                        <button
                          key={s.id}
                          type="button"
                          onTouchStart={() => {
                            triggerHaptic(45);
                            setPressedSessionId(s.id);
                          }}
                          onTouchEnd={() => {
                            setTimeout(() => setPressedSessionId(null), 150);
                          }}
                          onClick={() => {
                            triggerHaptic(45);
                            setPressedSessionId(s.id);
                            setMonthActiveSessionId(s.id);
                            setTimeout(() => {
                              setMonthMobileView("detail");
                              setPressedSessionId(null);
                            }, 75);
                          }}
                          className={`group w-full p-2.5 rounded-xl text-left transition-all duration-100 cursor-pointer flex items-center gap-2.5 border select-none ${
                            isPressed
                              ? "scale-95 bg-brand-100 dark:bg-brand-950/80 border-brand-400 dark:border-brand-600 ring-2 ring-brand-500/40 shadow-xs"
                              : isSelected
                              ? "border-slate-200/90 dark:border-slate-700/90 bg-white dark:bg-slate-800/90 shadow-2xs md:shadow-xs active:scale-95 active:bg-brand-50 active:border-brand-300"
                              : "border-slate-100 dark:border-slate-800/60 bg-white/60 dark:bg-slate-900/40 hover:bg-slate-100/70 dark:hover:bg-slate-800/50 hover:border-slate-200 dark:hover:border-slate-700 active:scale-95 active:bg-brand-50 active:border-brand-300"
                          } focus:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500/50`}
                        >
                          {/* Visual Calendar Tile */}
                          <div
                            className={`w-9 h-9 rounded-lg flex flex-col items-center justify-center shrink-0 border bg-slate-100 dark:bg-slate-800/80 border-slate-200/60 dark:border-slate-700/60 text-slate-500 dark:text-slate-400 transition-all duration-100 ${
                              isPressed ? "scale-90 bg-brand-200/80 dark:bg-brand-900" : "group-hover:scale-105 group-active:scale-90"
                            }`}
                          >
                            <span className="text-[8px] font-bold uppercase leading-none">
                              {dateParts.month}
                            </span>
                            <span className="text-xs font-black leading-none mt-0.5 text-slate-700 dark:text-slate-200">
                              {dateParts.day}
                            </span>
                          </div>

                          {/* Title & Turnout Icon */}
                          <div className="min-w-0 flex-1">
                            <h4
                              className={`text-xs font-semibold leading-snug truncate transition-colors duration-100 ${
                                isPressed
                                  ? "text-brand-900 dark:text-brand-100 font-bold"
                                  : "text-slate-900 dark:text-slate-100 group-hover:text-slate-950 dark:group-hover:text-white"
                              }`}
                            >
                              {s.title}
                            </h4>
                            <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5">
                              <Users className="w-2.5 h-2.5" />
                              <span>{s.presentCount}/{s.totalCount}</span>
                            </div>
                          </div>

                          {/* Status Icon */}
                          <div className="shrink-0 flex items-center gap-1.5">
                            {isPresent ? (
                              <CheckCircle2
                                className={`w-4 h-4 text-emerald-500 transition-transform duration-100 ${
                                  isPressed ? "scale-125" : "group-hover:scale-110 group-active:scale-125"
                                }`}
                              />
                            ) : (
                              <div
                                className={`w-4 h-4 rounded-full border-2 border-rose-400 dark:border-rose-600 flex items-center justify-center transition-transform duration-100 ${
                                  isPressed ? "scale-125" : "group-hover:scale-110 group-active:scale-125"
                                }`}
                              >
                                <div className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                              </div>
                            )}
                            <ChevronRight
                              className={`w-3.5 h-3.5 text-slate-300 dark:text-slate-600 transition-all duration-100 md:hidden ${
                                isPressed
                                  ? "translate-x-2 text-brand-600"
                                  : "group-hover:text-slate-500 group-hover:translate-x-0.5 group-active:translate-x-2 group-active:text-brand-600"
                              }`}
                            />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Right Pane: Selected Activity Roll Call Stage (Visible on desktop OR when mobile view is 'detail') */}
                <div
                  className={`w-full md:flex-1 shrink-0 flex flex-col h-full bg-white dark:bg-slate-900 min-w-0 min-h-0 overflow-hidden ${
                    monthMobileView === "list" ? "hidden md:flex" : "flex"
                  }`}
                >
                  {/* Mobile Back Button */}
                  <div className="md:hidden px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between shrink-0">
                    <button
                      type="button"
                      onTouchStart={() => triggerHaptic(30)}
                      onClick={() => {
                        triggerHaptic(30);
                        setMonthMobileView("list");
                      }}
                      className="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-brand-700 dark:text-brand-300 hover:text-brand-800 dark:hover:text-brand-200 hover:bg-brand-50 dark:hover:bg-brand-950/40 active:scale-95 active:bg-brand-100/80 dark:active:bg-brand-900/60 transition-all duration-150 cursor-pointer select-none"
                    >
                      <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5 group-active:-translate-x-1" />
                      <span>Back to activities</span>
                    </button>
                    <span className="text-[11px] font-semibold text-slate-400">
                      {viewingMonthGroup.month.full} {selectedYear}
                    </span>
                  </div>

                  {activeSession ? (
                    <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                      {/* Minimal Session Info Header */}
                      <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/30 dark:bg-slate-900/40 shrink-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 leading-snug">
                              {activeSession.title}
                            </h3>
                            <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-slate-400">
                              <span className="inline-flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {formatDateDisplay(activeSession.session_date)}
                              </span>
                              {activeSession.location && (
                                <span className="inline-flex items-center gap-1 truncate max-w-[200px]">
                                  <MapPin className="w-3 h-3 shrink-0" />
                                  <span className="truncate">{activeSession.location}</span>
                                </span>
                              )}
                              <span className="inline-flex items-center gap-1 font-medium">
                                <Users className="w-3 h-3" />
                                <strong className="text-slate-700 dark:text-slate-200 font-semibold">
                                  {activeSession.presentCount}/{activeSession.totalCount}
                                </strong>
                              </span>
                            </div>
                          </div>

                          {canManage && (
                            <div className="flex items-center gap-1 shrink-0 pt-0.5">
                              <button
                                type="button"
                                onTouchStart={() => triggerHaptic(12)}
                                onClick={() => {
                                  triggerHaptic(15);
                                  setViewingMonthGroup(null);
                                  openEditModal(activeSession);
                                }}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-90 active:bg-slate-200 dark:active:bg-slate-700 transition-all duration-150 cursor-pointer select-none"
                                title="Edit"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onTouchStart={() => triggerHaptic(12)}
                                onClick={() => {
                                  triggerHaptic(15);
                                  setViewingMonthGroup(null);
                                  setDeletingSession(activeSession);
                                }}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 active:scale-90 active:bg-rose-100 dark:active:bg-rose-900/60 transition-all duration-150 cursor-pointer select-none"
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 10 Council Members: Minimalist Photo Grid with Corner Status Badge (2-column grid on all viewports) */}
                      <div className="p-3 sm:p-4 overflow-y-auto flex-1 min-h-0 themed-scrollbar overscroll-contain">
                        <div className="grid grid-cols-2 gap-2">
                          {hierarchyOfficials.map((off) => {
                            const rec = activeSession.records.find((r) => r.user_id === off.id);
                            const isPresent = rec?.status === "Present";
                            const { surname } = splitOfficialName(off.name);

                            return (
                              <button
                                key={off.id}
                                type="button"
                                onClick={() => {
                                  setViewingMonthGroup(null);
                                  setViewingOfficial(off);
                                }}
                                title={`View ${off.name}'s attendance history`}
                                className="flex items-center gap-2 sm:gap-2.5 p-2 sm:p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/60 bg-slate-50/40 dark:bg-slate-800/20 hover:bg-slate-100/70 dark:hover:bg-slate-800/50 hover:border-slate-300 dark:hover:border-slate-700 active:scale-[0.96] transition-all duration-100 cursor-pointer text-left select-none"
                              >
                                {/* Avatar with corner status badge */}
                                <div className="relative shrink-0">
                                  <div
                                    className={`relative w-9 h-9 sm:w-10 sm:h-10 rounded-full overflow-hidden bg-brand-50 dark:bg-brand-950/60 flex items-center justify-center border ${
                                      isPresent
                                        ? "border-emerald-200 dark:border-emerald-800"
                                        : "border-slate-200 dark:border-slate-700 opacity-60 grayscale"
                                    }`}
                                  >
                                    <span className="text-xs font-black text-brand-700 dark:text-brand-300 select-none">
                                      {getOfficialInitials(off.name)}
                                    </span>
                                    {off.avatar_url && (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img
                                        src={off.avatar_url}
                                        alt={off.name}
                                        onError={(e) => {
                                          (e.currentTarget as HTMLElement).style.display = "none";
                                        }}
                                        className="absolute inset-0 w-full h-full object-cover"
                                      />
                                    )}
                                  </div>

                                  {/* Corner Status Badge */}
                                  <span
                                    className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full flex items-center justify-center ring-2 ring-white dark:ring-slate-900 shadow-2xs ${
                                      isPresent
                                        ? "bg-emerald-500 text-white"
                                        : "bg-rose-500 text-white"
                                    }`}
                                  >
                                    {isPresent ? (
                                      <Check className="w-2 h-2 sm:w-2.5 sm:h-2.5 stroke-[3]" />
                                    ) : (
                                      <X className="w-2 h-2 sm:w-2.5 sm:h-2.5 stroke-[3]" />
                                    )}
                                  </span>
                                </div>

                                {/* Official Identity: Bold Surname + Clean Role */}
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                                    {surname}
                                  </p>
                                  <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                                    {off.role.replace("SK ", "")}
                                  </p>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center p-8 text-center text-slate-400">
                      <p className="text-xs">No activity selected</p>
                    </div>
                  )}
                </div>
              </div>

            {/* Footer: Clean & quiet */}
              <div className="px-5 py-2.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 flex items-center justify-between text-xs shrink-0">
                <span className="text-[11px] text-slate-400 font-medium">
                  {sortedSessions.length} {sortedSessions.length === 1 ? "activity" : "activities"}
                </span>
                <button
                  type="button"
                  onTouchStart={() => triggerHaptic(12)}
                  onClick={() => {
                    triggerHaptic(15);
                    closeMonthModal();
                  }}
                  className="px-4 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold hover:bg-slate-800 dark:hover:bg-white/90 active:scale-95 active:opacity-90 transition-all duration-150 cursor-pointer select-none shadow-xs"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })(), document.body)}

      {/* =========================================================================
          MODAL 3: VIEW OFFICIAL ROLL CALL HISTORY
         ========================================================================= */}
      {mounted && viewingOfficial && createPortal(
        <div
          className="fixed inset-0 z-[100] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center overscroll-contain touch-none"
          style={{
            paddingTop: "max(0.75rem, env(safe-area-inset-top, 0px))",
            paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))",
            paddingLeft: "max(0.75rem, env(safe-area-inset-left, 0px))",
            paddingRight: "max(0.75rem, env(safe-area-inset-right, 0px))",
            opacity: isOfficialOpen ? 1 : 0,
            transition: "opacity 260ms cubic-bezier(0.16, 1, 0.3, 1)",
            pointerEvents: isOfficialOpen ? "auto" : "none",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeOfficialModal();
          }}
        >
          <div
            className="bg-white dark:bg-slate-900 w-full sm:max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden touch-auto"
            style={{
              maxHeight: "calc(100dvh - 1.5rem - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))",
              opacity: isOfficialOpen ? 1 : 0,
              transform: isOfficialOpen
                ? "scale(1) translateY(0px)"
                : "scale(0.92) translateY(24px)",
              transition: "transform 260ms cubic-bezier(0.16, 1, 0.3, 1), opacity 240ms cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-100 truncate">
                  {viewingOfficial.name}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {viewingOfficial.role} • {viewingOfficial.overallRate.toFixed(0)}% attendance (
                  {viewingOfficial.presentCount}/{viewingOfficial.totalCount})
                </p>
              </div>
            </div>

            <div className="p-4 overflow-y-auto space-y-2 flex-1 min-h-0 themed-scrollbar overscroll-contain">
              <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200/80 dark:border-slate-800 rounded-xl overflow-hidden text-xs">
                {yearSessions.map((s) => {
                  const rec = s.records.find((r) => r.user_id === viewingOfficial.id);
                  const isPresent = rec?.status === "Present";
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setViewingOfficial(null);
                        setViewingSession(s);
                      }}
                      title={`Inspect ${s.title}`}
                      className="w-full px-3 py-2.5 flex items-center justify-between gap-2 bg-white dark:bg-slate-900 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 active:bg-slate-100 dark:active:bg-slate-800 active:scale-[0.98] transition-all duration-100 cursor-pointer text-left select-none group"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-slate-900 dark:text-slate-100 truncate group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                          {s.title}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {formatDateDisplay(s.session_date)} • {s.activity_type}
                        </p>
                      </div>
                      <span
                        className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold shrink-0 transition-transform ${
                          isPresent
                            ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                            : "bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800"
                        }`}
                        title={isPresent ? "Present" : "Absent"}
                        aria-label={isPresent ? "Present" : "Absent"}
                      >
                        {isPresent ? (
                          <Check className="w-4 h-4 stroke-[2.75]" />
                        ) : (
                          <X className="w-4 h-4 stroke-[2.75]" />
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="px-5 py-2.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 flex items-center justify-end text-xs shrink-0">
              <button
                type="button"
                onTouchStart={() => triggerHaptic(12)}
                onClick={() => {
                  triggerHaptic(15);
                  closeOfficialModal();
                }}
                className="px-4 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold hover:bg-slate-800 dark:hover:bg-white/90 active:scale-95 active:opacity-90 transition-all duration-150 cursor-pointer shrink-0 select-none shadow-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* =========================================================================
          MODAL 4: DELETE CONFIRMATION
         ========================================================================= */}
      {mounted && deletingSession && createPortal(
        <div
          className="fixed inset-0 z-[100] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center overscroll-contain touch-none"
          style={{
            paddingTop: "max(0.75rem, env(safe-area-inset-top, 0px))",
            paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))",
            paddingLeft: "max(0.75rem, env(safe-area-inset-left, 0px))",
            paddingRight: "max(0.75rem, env(safe-area-inset-right, 0px))",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !deleteBusy) setDeletingSession(null);
          }}
        >
          <div
            className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-5 space-y-3 flex flex-col overflow-hidden touch-auto"
            style={{
              maxHeight: "calc(100dvh - 1.5rem - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))",
            }}
          >
            <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
              Delete Attendance Session?
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Are you sure you want to delete <strong>{deletingSession.title}</strong>? This will
              remove this session from the punch strip.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={deleteBusy}
                onClick={() => setDeletingSession(null)}
                className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-95 text-xs font-bold text-slate-600 dark:text-slate-300 transition-all cursor-pointer select-none"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteBusy}
                onClick={handleConfirmDelete}
                className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 active:brightness-95 text-white text-xs font-bold transition-all cursor-pointer disabled:opacity-50 select-none shadow-xs"
              >
                {deleteBusy ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
