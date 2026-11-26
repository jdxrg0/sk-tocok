"use client";

import { useState, useEffect, useRef, Fragment, useMemo, Suspense } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "next/navigation";
import { 
  Search, 
  Receipt, 
  X,
  ExternalLink,
  Landmark,
  FileCheck,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Calendar,
  Building2,
  FileText,
  CheckCircle2,
  SlidersHorizontal,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Layers,
  BarChart3,
  Copy,
  Check,
  Eye,
  CreditCard,
  Plus,
  Pencil,
  Trash2
} from "lucide-react";
import dynamic from "next/dynamic";
import { sanitizeSafeUrl } from "@/lib/clientUrlSafety";
const ExpenseCharts = dynamic(() => import("@/components/ExpenseCharts"), { ssr: false });
import SearchModal from "@/components/SearchModal";
import { getExpenseBreakdown, type ExpenseLineItem } from "@/lib/expenseBreakdown";
import { useAuth, isOfficialRole } from "@/components/AuthProvider";
import ExpenseModal, { type ExpenseModalData } from "@/components/ExpenseModal";
import DepositModal, { type DepositModalData } from "@/components/DepositModal";
import CategoryModal, { type CategoryModalData } from "@/components/CategoryModal";
import {
  getHorizontalPillStyle,
  getVerticalRailPillStyle,
  useTabPanelDirection,
} from "@/components/useTabPanelDirection";

interface Expense {
  id: number;
  title: string;
  description: string;
  category: string;
  amount: number;
  date: string;
  receipt_url: string | null;
  voucher_no: string | null;
  payee: string | null;
  line_items?: ExpenseLineItem[] | null;
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

function getCategoryBadge(category: string) {
  const cat = (category || "").toLowerCase();
  if (cat.includes("education") || cat.includes("culture")) {
    return "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/70";
  }
  if (cat.includes("livelihood") || cat.includes("employ")) {
    return "bg-orange-50 dark:bg-orange-950/50 text-orange-800 dark:text-orange-300 border-orange-200 dark:border-orange-800/70";
  }
  if (cat.includes("sport")) {
    return "bg-amber-50 dark:bg-amber-950/50 text-amber-900 dark:text-amber-300 border-amber-200 dark:border-amber-800/70";
  }
  if (cat.includes("environ") || cat.includes("disaster") || cat.includes("preparedness") || cat.includes("tree")) {
    return "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/70";
  }
  if (cat.includes("peace") || cat.includes("order") || cat.includes("anti-drug") || cat.includes("drug")) {
    return "bg-cyan-50 dark:bg-cyan-950/50 text-cyan-800 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800/70";
  }
  if (cat.includes("health")) {
    return "bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/70";
  }
  if (cat.includes("gad") || cat.includes("gender")) {
    return "bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/70";
  }
  if (cat.includes("admin") || cat.includes("training") || cat.includes("governance")) {
    return "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/70";
  }
  return "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800";
}

function getCategoryRowStyle(category: string) {
  const cat = (category || "").toLowerCase();
  if (cat.includes("education") || cat.includes("culture")) {
    return {
      rowBg: "bg-blue-100/75 dark:bg-blue-950/35 hover:bg-blue-100 dark:hover:bg-blue-950/55",
      cardBg: "bg-blue-50/90 dark:bg-blue-950/45 border-blue-200/90 dark:border-blue-800/70 shadow-2xs hover:border-blue-300 dark:hover:border-blue-700",
      dot: "bg-blue-500 ring-2 ring-blue-300 dark:ring-blue-700/60",
      label: "Education & Culture",
    };
  }
  if (cat.includes("livelihood") || cat.includes("employ")) {
    return {
      rowBg: "bg-orange-100/75 dark:bg-orange-950/35 hover:bg-orange-100 dark:hover:bg-orange-950/55",
      cardBg: "bg-orange-50/90 dark:bg-orange-950/45 border-orange-200/90 dark:border-orange-800/70 shadow-2xs hover:border-orange-300 dark:hover:border-orange-700",
      dot: "bg-orange-500 ring-2 ring-orange-300 dark:ring-orange-700/60",
      label: "Youth Employment & Livelihood",
    };
  }
  if (cat.includes("sport")) {
    return {
      rowBg: "bg-amber-100/75 dark:bg-amber-950/35 hover:bg-amber-100 dark:hover:bg-amber-950/55",
      cardBg: "bg-amber-50/90 dark:bg-amber-950/45 border-amber-200/90 dark:border-amber-800/70 shadow-2xs hover:border-amber-300 dark:hover:border-amber-700",
      dot: "bg-amber-500 ring-2 ring-amber-300 dark:ring-amber-700/60",
      label: "Sports Development",
    };
  }
  if (cat.includes("environ") || cat.includes("disaster") || cat.includes("preparedness") || cat.includes("tree")) {
    return {
      rowBg: "bg-emerald-100/75 dark:bg-emerald-950/35 hover:bg-emerald-100 dark:hover:bg-emerald-950/55",
      cardBg: "bg-emerald-50/90 dark:bg-emerald-950/45 border-emerald-200/90 dark:border-emerald-800/70 shadow-2xs hover:border-emerald-300 dark:hover:border-emerald-700",
      dot: "bg-emerald-500 ring-2 ring-emerald-300 dark:ring-emerald-700/60",
      label: "Environmental Protection & Disaster Preparedness",
    };
  }
  if (cat.includes("peace") || cat.includes("order") || cat.includes("anti-drug") || cat.includes("drug")) {
    return {
      rowBg: "bg-cyan-100/75 dark:bg-cyan-950/35 hover:bg-cyan-100 dark:hover:bg-cyan-950/55",
      cardBg: "bg-cyan-50/90 dark:bg-cyan-950/45 border-cyan-200/90 dark:border-cyan-800/70 shadow-2xs hover:border-cyan-300 dark:hover:border-cyan-700",
      dot: "bg-cyan-500 ring-2 ring-cyan-300 dark:ring-cyan-700/60",
      label: "Peace and Order & Anti-Drug",
    };
  }
  if (cat.includes("health")) {
    return {
      rowBg: "bg-rose-100/75 dark:bg-rose-950/35 hover:bg-rose-100 dark:hover:bg-rose-950/55",
      cardBg: "bg-rose-50/90 dark:bg-rose-950/45 border-rose-200/90 dark:border-rose-800/70 shadow-2xs hover:border-rose-300 dark:hover:border-rose-700",
      dot: "bg-rose-500 ring-2 ring-rose-300 dark:ring-rose-700/60",
      label: "Health",
    };
  }
  if (cat.includes("gad") || cat.includes("gender")) {
    return {
      rowBg: "bg-purple-100/75 dark:bg-purple-950/35 hover:bg-purple-100 dark:hover:bg-purple-950/55",
      cardBg: "bg-purple-50/90 dark:bg-purple-950/45 border-purple-200/90 dark:border-purple-800/70 shadow-2xs hover:border-purple-300 dark:hover:border-purple-700",
      dot: "bg-purple-500 ring-2 ring-purple-300 dark:ring-purple-700/60",
      label: "Gender and Development (GAD)",
    };
  }
  if (cat.includes("admin") || cat.includes("training") || cat.includes("governance")) {
    return {
      rowBg: "bg-indigo-100/75 dark:bg-indigo-950/35 hover:bg-indigo-100 dark:hover:bg-indigo-950/55",
      cardBg: "bg-indigo-50/90 dark:bg-indigo-950/45 border-indigo-200/90 dark:border-indigo-800/70 shadow-2xs hover:border-indigo-300 dark:hover:border-indigo-700",
      dot: "bg-indigo-500 ring-2 ring-indigo-300 dark:ring-indigo-700/60",
      label: "Administration & Training",
    };
  }
  return {
    rowBg: "bg-slate-100/75 dark:bg-slate-800/60 hover:bg-slate-200/80 dark:hover:bg-slate-700/80",
    cardBg: "bg-slate-50 dark:bg-slate-800/70 border-slate-200/90 dark:border-slate-800 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700",
    dot: "bg-slate-400 ring-2 ring-slate-300 dark:ring-slate-700",
    label: category || "General",
  };
}

function getCategoryCardTheme(category: string, isSelected: boolean) {
  const cat = (category || "").toLowerCase();
  
  if (cat.includes("education") || cat.includes("culture")) {
    return {
      card: isSelected
        ? "bg-blue-50/90 dark:bg-blue-950/45 border-blue-600 ring-2 ring-blue-500/25 shadow-sm"
        : "bg-gradient-to-br from-white dark:from-slate-900 via-white dark:via-slate-900 to-blue-50/70 dark:to-blue-950/40 border-blue-200/90 dark:border-blue-800/70 hover:border-blue-400 dark:hover:border-blue-600 hover:shadow-xs",
      bar: "bg-blue-600",
      track: "bg-blue-100/80 dark:bg-blue-950/70",
      link: isSelected ? "text-blue-800 dark:text-blue-300" : "text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300",
      borderTop: "border-blue-100 dark:border-blue-900/60",
    };
  }
  if (cat.includes("livelihood") || cat.includes("employ")) {
    return {
      card: isSelected
        ? "bg-orange-50/90 dark:bg-orange-950/45 border-orange-600 ring-2 ring-orange-500/25 shadow-sm"
        : "bg-gradient-to-br from-white dark:from-slate-900 via-white dark:via-slate-900 to-orange-50/70 dark:to-orange-950/40 border-orange-200/90 dark:border-orange-800/70 hover:border-orange-400 dark:hover:border-orange-600 hover:shadow-xs",
      bar: "bg-orange-500",
      track: "bg-orange-100/80 dark:bg-orange-950/70",
      link: isSelected ? "text-orange-800 dark:text-orange-300" : "text-orange-700 dark:text-orange-400 hover:text-orange-900 dark:hover:text-orange-200",
      borderTop: "border-orange-100 dark:border-orange-900/60",
    };
  }
  if (cat.includes("sport")) {
    return {
      card: isSelected
        ? "bg-amber-50/90 dark:bg-amber-950/45 border-amber-600 ring-2 ring-amber-500/25 shadow-sm"
        : "bg-gradient-to-br from-white dark:from-slate-900 via-white dark:via-slate-900 to-amber-50/70 dark:to-amber-950/40 border-amber-200/90 dark:border-amber-800/70 hover:border-amber-400 dark:hover:border-amber-600 hover:shadow-xs",
      bar: "bg-amber-500",
      track: "bg-amber-100/80 dark:bg-amber-950/70",
      link: isSelected ? "text-amber-800 dark:text-amber-300" : "text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-200",
      borderTop: "border-amber-100 dark:border-amber-900/60",
    };
  }
  if (cat.includes("environ") || cat.includes("disaster") || cat.includes("preparedness") || cat.includes("tree")) {
    return {
      card: isSelected
        ? "bg-emerald-50/90 dark:bg-emerald-950/45 border-emerald-600 ring-2 ring-emerald-500/25 shadow-sm"
        : "bg-gradient-to-br from-white dark:from-slate-900 via-white dark:via-slate-900 to-emerald-50/70 dark:to-emerald-950/40 border-emerald-200/90 dark:border-emerald-800/70 hover:border-emerald-400 dark:hover:border-emerald-600 hover:shadow-xs",
      bar: "bg-emerald-500",
      track: "bg-emerald-100/80 dark:bg-emerald-950/70",
      link: isSelected ? "text-emerald-800 dark:text-emerald-300" : "text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-200",
      borderTop: "border-emerald-100 dark:border-emerald-900/60",
    };
  }
  if (cat.includes("peace") || cat.includes("order") || cat.includes("anti-drug") || cat.includes("drug")) {
    return {
      card: isSelected
        ? "bg-cyan-50/90 dark:bg-cyan-950/45 border-cyan-600 ring-2 ring-cyan-500/25 shadow-sm"
        : "bg-gradient-to-br from-white dark:from-slate-900 via-white dark:via-slate-900 to-cyan-50/70 dark:to-cyan-950/40 border-cyan-200/90 dark:border-cyan-800/70 hover:border-cyan-400 dark:hover:border-cyan-600 hover:shadow-xs",
      bar: "bg-cyan-500",
      track: "bg-cyan-100/80 dark:bg-cyan-950/70",
      link: isSelected ? "text-cyan-800 dark:text-cyan-300" : "text-cyan-700 dark:text-cyan-400 hover:text-cyan-900 dark:hover:text-cyan-200",
      borderTop: "border-cyan-100 dark:border-cyan-900/60",
    };
  }
  if (cat.includes("health")) {
    return {
      card: isSelected
        ? "bg-rose-50/90 dark:bg-rose-950/45 border-rose-600 ring-2 ring-rose-500/25 shadow-sm"
        : "bg-gradient-to-br from-white dark:from-slate-900 via-white dark:via-slate-900 to-rose-50/70 dark:to-rose-950/40 border-rose-200/90 dark:border-rose-800/70 hover:border-rose-400 dark:hover:border-rose-600 hover:shadow-xs",
      bar: "bg-rose-500",
      track: "bg-rose-100/80 dark:bg-rose-950/70",
      link: isSelected ? "text-rose-800 dark:text-rose-300" : "text-rose-600 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-300",
      borderTop: "border-rose-100 dark:border-rose-900/60",
    };
  }
  if (cat.includes("gad") || cat.includes("gender")) {
    return {
      card: isSelected
        ? "bg-purple-50/90 dark:bg-purple-950/45 border-purple-600 ring-2 ring-purple-500/25 shadow-sm"
        : "bg-gradient-to-br from-white dark:from-slate-900 via-white dark:via-slate-900 to-purple-50/70 dark:to-purple-950/40 border-purple-200/90 dark:border-purple-800/70 hover:border-purple-400 dark:hover:border-purple-600 hover:shadow-xs",
      bar: "bg-purple-600",
      track: "bg-purple-100/80 dark:bg-purple-950/70",
      link: isSelected ? "text-purple-800 dark:text-purple-300" : "text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300",
      borderTop: "border-purple-100 dark:border-purple-900/60",
    };
  }
  if (cat.includes("admin") || cat.includes("training") || cat.includes("governance")) {
    return {
      card: isSelected
        ? "bg-indigo-50/90 dark:bg-indigo-950/45 border-indigo-600 ring-2 ring-indigo-500/25 shadow-sm"
        : "bg-gradient-to-br from-white dark:from-slate-900 via-white dark:via-slate-900 to-indigo-50/70 dark:to-indigo-950/40 border-indigo-200/90 dark:border-indigo-800/70 hover:border-indigo-400 dark:hover:border-indigo-600 hover:shadow-xs",
      bar: "bg-indigo-600",
      track: "bg-indigo-100/80 dark:bg-indigo-950/70",
      link: isSelected ? "text-indigo-800 dark:text-indigo-300" : "text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300",
      borderTop: "border-indigo-100 dark:border-indigo-900/60",
    };
  }
  return {
    card: isSelected
      ? "bg-slate-100 dark:bg-slate-800 border-slate-600 ring-2 ring-slate-500/25 shadow-sm"
      : "bg-gradient-to-br from-white dark:from-slate-900 via-white dark:via-slate-900 to-slate-50 dark:to-slate-800/60 border-slate-200/90 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-600 hover:shadow-xs",
    bar: "bg-slate-600",
    track: "bg-slate-200 dark:bg-slate-700",
    link: isSelected ? "text-slate-800 dark:text-slate-200" : "text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200",
    borderTop: "border-slate-100 dark:border-slate-800",
  };
}

// Helper to sanitize consecutively repeated phrases in payee field (e.g. mock/test data repetition)
function cleanPayeeName(payee: string | null | undefined): string {
  if (!payee) return "";
  const trimmed = payee.trim();
  const words = trimmed.split(/\s+/);
  if (words.length >= 6) {
    for (let len = 3; len <= Math.floor(words.length / 2); len++) {
      const phrase = words.slice(0, len).join(" ");
      const rest = words.slice(len).join(" ");
      if (rest.startsWith(phrase)) {
        return phrase;
      }
    }
  }
  return trimmed;
}

// Helper to calculate smart windowed pagination items with ellipses (e.g. [1, 2, 3, "...", 100])
function getPaginationItems(currentPage: number, totalPages: number): (number | "...")[] {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  if (currentPage <= 3) {
    return [1, 2, 3, "...", totalPages];
  }
  if (currentPage >= totalPages - 2) {
    return [1, "...", totalPages - 2, totalPages - 1, totalPages];
  }
  return [1, "...", currentPage, "...", totalPages];
}

// In-memory module cache for instant sub-page transitions (Stale-While-Revalidate)
let cachedExpensesData: {
  summary: SummaryData;
  categoryStats: CategoryStat[];
  monthlyStats: MonthlyStat[];
  expenses: Expense[];
} | null = null;
let cachedDeposits: Deposit[] | null = null;
let cachedCategories: string[] | null = null;

const EXPENSES_STORAGE_KEY = "sk_transparency_expenses_cache_v4";
const DEPOSITS_STORAGE_KEY = "sk_transparency_deposits_cache_v4";
const CATEGORIES_STORAGE_KEY = "sk_transparency_categories_cache_v4";

function getStoredExpenses(): typeof cachedExpensesData {
  if (cachedExpensesData) return cachedExpensesData;
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(EXPENSES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.expenses) && parsed.summary) {
        cachedExpensesData = parsed;
        return parsed;
      }
    }
  } catch {}
  return null;
}

const TRANSPARENCY_TABS = [
  { id: "analytics", label: "Visual Analytics", shortLabel: "Analytics", icon: BarChart3 },
  { id: "allocations", label: "Committee Allocations", shortLabel: "Allocations", icon: Layers },
  { id: "deposits", label: "Bank Remittances", shortLabel: "Deposits", icon: Landmark },
  { id: "expenses", label: "Disbursements", shortLabel: "Expenses", icon: FileCheck },
] as const;

type TransparencyTab = (typeof TRANSPARENCY_TABS)[number]["id"];
const TRANSPARENCY_TAB_ORDER: readonly TransparencyTab[] = TRANSPARENCY_TABS.map(
  (t) => t.id
);

function resolveTabFromUrl(
  tabParam: string | null,
  ledgerParam: string | null,
  hash?: string
): TransparencyTab | null {
  if (
    tabParam === "expenses" ||
    tabParam === "deposits" ||
    tabParam === "allocations" ||
    tabParam === "analytics"
  ) {
    return tabParam;
  }
  if (tabParam === "ledgers") {
    return ledgerParam === "deposits" ? "deposits" : "expenses";
  }
  if (ledgerParam === "deposits") {
    return "deposits";
  }
  if (ledgerParam === "expenses") {
    return "expenses";
  }
  if (hash === "#deposits") {
    return "deposits";
  }
  if (hash === "#expenses" || hash === "#ledgers") {
    return "expenses";
  }
  if (hash === "#allocations") {
    return "allocations";
  }
  if (hash === "#analytics") {
    return "analytics";
  }
  return null;
}

function TransparencyContent() {
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const [activeTab, setActiveTab] = useState<TransparencyTab>(() => {
    return (
      resolveTabFromUrl(
        searchParams?.get("tab") ?? null,
        searchParams?.get("ledger") ?? null
      ) ?? "expenses"
    );
  });
  const tabAnimClass = useTabPanelDirection(activeTab, TRANSPARENCY_TAB_ORDER);
  const [hasVisitedAnalytics, setHasVisitedAnalytics] = useState(
    () => activeTab === "analytics"
  );
  useEffect(() => {
    if (activeTab === "analytics") {
      setHasVisitedAnalytics(true);
    }
  }, [activeTab]);
  const [loading, setLoading] = useState(() => !cachedExpensesData);
  const [summary, setSummary] = useState<SummaryData>(
    cachedExpensesData?.summary || {
      fiscalYear: String(new Date().getFullYear()),
      barangayBudget: 0,
      annualBudget: 0,
      fundsReceived: 0,
      currentBankBalance: 0,
      totalSpent: 0,
      remainingBudget: 0,
      utilizationRate: 0,
    }
  );

  const [categoryStats, setCategoryStats] = useState<CategoryStat[]>(
    cachedExpensesData?.categoryStats || []
  );
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStat[]>(
    cachedExpensesData?.monthlyStats || []
  );
  const [availableCategories, setAvailableCategories] = useState<string[]>(
    cachedCategories || []
  );
  const [allExpenses, setAllExpenses] = useState<Expense[]>(
    cachedExpensesData?.expenses || []
  );
  const [deposits, setDeposits] = useState<Deposit[]>(
    cachedDeposits || []
  );
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showSearchModal, setShowSearchModal] = useState<boolean>(false);
  const [tempSearch, setTempSearch] = useState<string>("");

  const { user } = useAuth();
  const canManage = Boolean(user && isOfficialRole(user.role));

  const [categoriesList, setCategoriesList] = useState<CategoryModalData[]>([]);

  // Admin In-Place Modals State
  const [showExpenseModal, setShowExpenseModal] = useState<boolean>(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseModalData | null>(null);

  const [showDepositModal, setShowDepositModal] = useState<boolean>(false);
  const [editingDeposit, setEditingDeposit] = useState<DepositModalData | null>(null);

  const [showCategoryModal, setShowCategoryModal] = useState<boolean>(false);
  const [editingCategory, setEditingCategory] = useState<CategoryModalData | null>(null);

  const openAddExpense = () => {
    setEditingExpense(null);
    setShowExpenseModal(true);
  };

  const openEditExpense = (exp: Expense) => {
    setEditingExpense(exp);
    setShowExpenseModal(true);
  };

  const openAddDeposit = () => {
    setEditingDeposit(null);
    setShowDepositModal(true);
  };

  const openEditDeposit = (dep: Deposit) => {
    setEditingDeposit(dep);
    setShowDepositModal(true);
  };

  const openAddCategory = () => {
    setEditingCategory(null);
    setShowCategoryModal(true);
  };

  const openEditCategory = (cat: CategoryModalData) => {
    setEditingCategory(cat);
    setShowCategoryModal(true);
  };

  // Instant in-memory filtering: 0ms response, no loading spinner on filter or search
  const expenses = useMemo(() => {
    return allExpenses.filter((exp) => {
      if (selectedCategory !== "all" && exp.category !== selectedCategory) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          (exp.title || "").toLowerCase().includes(q) ||
          (exp.voucher_no || "").toLowerCase().includes(q) ||
          (exp.payee || "").toLowerCase().includes(q) ||
          (exp.description || "").toLowerCase().includes(q) ||
          (exp.category || "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [allExpenses, selectedCategory, searchQuery]);

  // Pagination (Show 3 transactions/committees at a time - fixed height)
  const [expensePage, setExpensePage] = useState<number>(1);
  const [depositPage, setDepositPage] = useState<number>(1);
  const [allocationPage, setAllocationPage] = useState<number>(1);
  const PAGE_SIZE = 3;
  
  // Modals
  const [selectedReceipt, setSelectedReceipt] = useState<Expense | null>(null);
  const [selectedDepositSlip, setSelectedDepositSlip] = useState<Deposit | null>(null);
  const [copiedVoucher, setCopiedVoucher] = useState<boolean>(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState<boolean>(false);
  const [isDescriptionClamped, setIsDescriptionClamped] = useState<boolean>(false);
  const descriptionRef = useRef<HTMLParagraphElement | null>(null);

  const openExpenseDetails = (exp: Expense) => {
    setSelectedReceipt(exp);
    setCopiedVoucher(false);
  };

  // Sorting
  const [expenseSort, setExpenseSort] = useState<{ field: "date" | "amount"; order: "asc" | "desc" }>({
    field: "date",
    order: "desc",
  });
  const [depositSort, setDepositSort] = useState<{ field: "date" | "amount"; order: "asc" | "desc" }>({
    field: "date",
    order: "desc",
  });

  const toggleExpenseSort = (field: "date" | "amount") => {
    setExpensePage(1);
    setExpenseSort((prev) => {
      if (prev.field === field) {
        return { field, order: prev.order === "asc" ? "desc" : "asc" };
      }
      return { field, order: "desc" };
    });
  };

  const toggleDepositSort = (field: "date" | "amount") => {
    setDepositPage(1);
    setDepositSort((prev) => {
      if (prev.field === field) {
        return { field, order: prev.order === "asc" ? "desc" : "asc" };
      }
      return { field, order: "desc" };
    });
  };

  const sortedExpenses = [...expenses].sort((a, b) => {
    if (expenseSort.field === "date") {
      return expenseSort.order === "asc"
        ? a.date.localeCompare(b.date)
        : b.date.localeCompare(a.date);
    } else {
      return expenseSort.order === "asc"
        ? a.amount - b.amount
        : b.amount - a.amount;
    }
  });

  const filteredDeposits = deposits.filter((dep) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      dep.reference_no?.toLowerCase().includes(q) ||
      dep.source?.toLowerCase().includes(q) ||
      (dep.description && dep.description.toLowerCase().includes(q))
    );
  });

  const sortedDeposits = [...filteredDeposits].sort((a, b) => {
    if (depositSort.field === "date") {
      return depositSort.order === "asc"
        ? a.date.localeCompare(b.date)
        : b.date.localeCompare(a.date);
    } else {
      return depositSort.order === "asc"
        ? a.amount - b.amount
        : b.amount - a.amount;
    }
  });

  // Paginated Slices
  const totalExpensePages = Math.max(1, Math.ceil(sortedExpenses.length / PAGE_SIZE));
  const currentExpensePage = Math.min(expensePage, totalExpensePages);
  const paginatedExpenses = sortedExpenses.slice(
    (currentExpensePage - 1) * PAGE_SIZE,
    currentExpensePage * PAGE_SIZE
  );

  const totalDepositPages = Math.max(1, Math.ceil(sortedDeposits.length / PAGE_SIZE));
  const currentDepositPage = Math.min(depositPage, totalDepositPages);
  const paginatedDeposits = sortedDeposits.slice(
    (currentDepositPage - 1) * PAGE_SIZE,
    currentDepositPage * PAGE_SIZE
  );

  const grandExpensesTotal = allExpenses.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);
  const grandDepositsTotal = deposits.reduce((sum, dep) => sum + (Number(dep.amount) || 0), 0);
  const displayedExpensesTotal = expenses.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);
  const displayedDepositsTotal = filteredDeposits.reduce((sum, dep) => sum + (Number(dep.amount) || 0), 0);

  useEffect(() => {
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    const resolved = resolveTabFromUrl(
      searchParams?.get("tab") ?? null,
      searchParams?.get("ledger") ?? null,
      hash
    );
    if (resolved) {
      setActiveTab(resolved);
    }
  }, [searchParams]);

  useEffect(() => {
    const handleHashOrPopState = () => {
      if (typeof window === "undefined") return;
      const params = new URLSearchParams(window.location.search);
      const resolved = resolveTabFromUrl(
        params.get("tab"),
        params.get("ledger"),
        window.location.hash
      );
      if (resolved) {
        setActiveTab(resolved);
      }
    };

    window.addEventListener("popstate", handleHashOrPopState);
    window.addEventListener("hashchange", handleHashOrPopState);

    const storedExpenses = getStoredExpenses();
    if (storedExpenses) {
      setSummary(storedExpenses.summary);
      setCategoryStats(storedExpenses.categoryStats || []);
      setMonthlyStats(storedExpenses.monthlyStats || []);
      setAllExpenses(storedExpenses.expenses || []);
      setLoading(false);
    }

    try {
      const storedDep = sessionStorage.getItem(DEPOSITS_STORAGE_KEY);
      if (storedDep) {
        const parsed = JSON.parse(storedDep);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setDeposits(parsed);
          cachedDeposits = parsed;
        }
      }
    } catch {}

    try {
      const storedCat = sessionStorage.getItem(CATEGORIES_STORAGE_KEY);
      if (storedCat) {
        const parsed = JSON.parse(storedCat);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setAvailableCategories(parsed);
          cachedCategories = parsed;
        }
      }
    } catch {}

    loadCategories();
    loadDeposits();
    fetchExpenses();

    return () => {
      window.removeEventListener("popstate", handleHashOrPopState);
      window.removeEventListener("hashchange", handleHashOrPopState);
    };
  }, []);

  useEffect(() => {
    setExpensePage(1);
    setDepositPage(1);
  }, [selectedCategory, searchQuery]);

  const isAnyModalOpen = Boolean(
    showSearchModal ||
    selectedReceipt ||
    selectedDepositSlip ||
    showExpenseModal ||
    showDepositModal ||
    showCategoryModal
  );

  // Lock background page scroll completely on mobile and desktop while any modal is open
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowSearchModal(false);
        setSelectedReceipt(null);
        setSelectedDepositSlip(null);
        setShowExpenseModal(false);
        setShowDepositModal(false);
        setShowCategoryModal(false);
      }
    };

    if (isAnyModalOpen) {
      const scrollY =
        window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;
      const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;

      const prevHtmlOverflow = document.documentElement.style.overflow;
      const prevHtmlOverscroll = document.documentElement.style.overscrollBehavior;
      const prevBodyPosition = document.body.style.position;
      const prevBodyTop = document.body.style.top;
      const prevBodyLeft = document.body.style.left;
      const prevBodyRight = document.body.style.right;
      const prevBodyWidth = document.body.style.width;
      const prevBodyOverflow = document.body.style.overflow;
      const prevBodyOverscroll = document.body.style.overscrollBehavior;
      const prevBodyPaddingRight = document.body.style.paddingRight;

      document.documentElement.style.overflow = "hidden";
      document.documentElement.style.overscrollBehavior = "none";
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollY}px`;
      document.body.style.left = "0";
      document.body.style.right = "0";
      document.body.style.width = "100%";
      document.body.style.overflow = "hidden";
      document.body.style.overscrollBehavior = "none";
      if (scrollBarWidth > 0) {
        document.body.style.paddingRight = `${scrollBarWidth}px`;
      }

      window.addEventListener("keydown", handleKeyDown);

      return () => {
        document.documentElement.style.overflow = prevHtmlOverflow;
        document.documentElement.style.overscrollBehavior = prevHtmlOverscroll;
        document.body.style.position = prevBodyPosition;
        document.body.style.top = prevBodyTop;
        document.body.style.left = prevBodyLeft;
        document.body.style.right = prevBodyRight;
        document.body.style.width = prevBodyWidth;
        document.body.style.overflow = prevBodyOverflow;
        document.body.style.overscrollBehavior = prevBodyOverscroll;
        document.body.style.paddingRight = prevBodyPaddingRight;
        window.scrollTo(0, scrollY);
        window.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, [isAnyModalOpen]);

  useEffect(() => {
    setIsDescriptionExpanded(false);
    setIsDescriptionClamped(false);
  }, [selectedReceipt?.id]);

  useEffect(() => {
    if (!selectedReceipt?.description) {
      setIsDescriptionClamped(false);
      return;
    }
    const checkClamp = () => {
      const el = descriptionRef.current;
      if (!el || isDescriptionExpanded) return;
      setIsDescriptionClamped(el.scrollHeight > el.clientHeight + 1);
    };
    const frameId = requestAnimationFrame(checkClamp);
    window.addEventListener("resize", checkClamp);
    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", checkClamp);
    };
  }, [selectedReceipt?.id, selectedReceipt?.description, isDescriptionExpanded]);

  const loadDeposits = async () => {
    try {
      const res = await fetch("/api/deposits");
      const data = await res.json();
      if (data.success) {
        setDeposits(data.deposits);
        cachedDeposits = data.deposits;
        try {
          sessionStorage.setItem(DEPOSITS_STORAGE_KEY, JSON.stringify(data.deposits));
        } catch {}
      }
    } catch (err) {
      console.error("Error loading deposits:", err);
    }
  };

  const fetchExpenses = async () => {
    try {
      if (!cachedExpensesData && !getStoredExpenses()) {
        setLoading(true);
      }
      const res = await fetch("/api/expenses");
      const data = await res.json();
      if (data.success) {
        setSummary(data.summary);
        setCategoryStats(data.categoryStats);
        setMonthlyStats(data.monthlyStats || []);
        setAllExpenses(data.expenses || []);

        const cacheObj = {
          summary: data.summary,
          categoryStats: data.categoryStats,
          monthlyStats: data.monthlyStats || [],
          expenses: data.expenses || [],
        };
        cachedExpensesData = cacheObj;
        try {
          sessionStorage.setItem(EXPENSES_STORAGE_KEY, JSON.stringify(cacheObj));
        } catch {}
      }
    } catch (err) {
      console.error("Error loading expenses:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const res = await fetch("/api/categories");
      const data = await res.json();
      if (data.success && Array.isArray(data.categories)) {
        setCategoriesList(data.categories);
        const cats = data.categories.map((c: { name: string }) => c.name);
        setAvailableCategories(cats);
        cachedCategories = cats;
        try {
          sessionStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(cats));
        } catch {}
      }
    } catch (err) {
      console.error("Error loading categories:", err);
    }
  };

  const handleDeleteExpense = async (id: number) => {
    if (!confirm("Are you sure you want to delete this expenditure record?")) return;
    try {
      const res = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchExpenses();
        loadCategories();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to delete expenditure record.");
      }
    } catch (err) {
      console.error("Delete expense error:", err);
    }
  };

  const handleDeleteDeposit = async (id: number) => {
    if (!confirm("Are you sure you want to delete this bank remittance record?")) return;
    try {
      const res = await fetch(`/api/deposits/${id}`, { method: "DELETE" });
      if (res.ok) {
        loadDeposits();
        fetchExpenses();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to delete bank remittance record.");
      }
    } catch (err) {
      console.error("Delete deposit error:", err);
    }
  };

  const handleDeleteCategory = async (id: number, name: string) => {
    if (!confirm(`Are you sure you want to delete category "${name}"?`)) return;
    try {
      const res = await fetch(`/api/categories?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to delete category.");
        return;
      }
      loadCategories();
      fetchExpenses();
    } catch (err) {
      console.error("Delete category error:", err);
    }
  };

  const handleTabChange = (tabId: TransparencyTab) => {
    setActiveTab(tabId);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  };

  return (
    <div
      className={`max-w-6xl mx-auto px-2.5 sm:px-6 pt-1.5 sm:pt-4 pb-[calc(8.5rem+env(safe-area-inset-bottom,0px))] md:pb-28 ${
        activeTab === "expenses" || activeTab === "deposits" || activeTab === "allocations"
          ? "min-h-[calc(100vh+100px)] min-h-[calc(100lvh+100px)] md:min-h-0"
          : ""
      }`}
    >
      {/* Desktop 2-Column Layout: Left Navigation Sidebar + Main Content Area */}
      <div className="flex flex-col md:flex-row gap-4 sm:gap-6 items-start">
        {/* Left Navigation Icon Rail (Desktop view: Just Icons) */}
        <aside
          role="tablist"
          aria-label="Transparency desktop navigation"
          className="relative hidden md:flex flex-col w-14 lg:w-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-1.5 shadow-xs shrink-0 sticky items-center gap-1.5"
          style={{ top: "132px" }}
        >
          <div
            aria-hidden="true"
            className="tab-sliding-pill absolute rounded-xl bg-brand-600 shadow-xs pointer-events-none"
            style={getVerticalRailPillStyle(
              Math.max(0, TRANSPARENCY_TAB_ORDER.indexOf(activeTab))
            )}
          />
          {TRANSPARENCY_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => handleTabChange(tab.id)}
                title={tab.label}
                aria-label={tab.label}
                className={`relative z-10 w-11 h-11 flex items-center justify-center rounded-xl transition-colors duration-200 cursor-pointer ${
                  isActive
                    ? "text-white font-bold scale-102"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/70 dark:hover:bg-slate-800/70"
                }`}
              >
                <Icon className="w-5 h-5" />
              </button>
            );
          })}
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 min-w-0 w-full flex flex-col gap-1.5 sm:gap-4 md:gap-6">
          {/* Mobile Module Switcher (Full-Width 4-Column Segmented Tabs, md:hidden) */}
          <div
            role="tablist"
            aria-label="Transparency views"
            className="relative md:hidden grid grid-cols-4 gap-1 bg-slate-100/90 dark:bg-slate-800/90 p-1 rounded-xl border border-slate-200/80 dark:border-slate-800/90 shadow-xs"
          >
            <div
              aria-hidden="true"
              className="tab-sliding-pill absolute top-1 bottom-1 rounded-lg bg-white dark:bg-slate-900 shadow-xs border border-slate-200/60 dark:border-slate-700/70 pointer-events-none"
              style={getHorizontalPillStyle(
                TRANSPARENCY_TABS.length,
                Math.max(0, TRANSPARENCY_TAB_ORDER.indexOf(activeTab)),
                0.25,
                0.25
              )}
            />
            {TRANSPARENCY_TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-label={tab.label}
                  title={tab.label}
                  onClick={() => handleTabChange(tab.id)}
                  className={`relative z-10 flex flex-col min-[360px]:flex-row items-center justify-center gap-0.5 min-[360px]:gap-1 sm:gap-1.5 py-1 sm:py-2 px-0.5 min-[360px]:px-1 sm:px-2 rounded-lg font-sans text-[10.5px] min-[390px]:text-[11.5px] sm:text-xs transition-colors duration-200 select-none active:scale-95 cursor-pointer ${
                    isActive
                      ? "text-brand-700 dark:text-brand-400 font-bold"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 font-semibold"
                  }`}
                >
                  <Icon
                    className={`w-3.5 h-3.5 shrink-0 transition-colors ${
                      isActive ? "text-brand-600 dark:text-brand-400" : "text-slate-500 dark:text-slate-400"
                    }`}
                  />
                  <span className="whitespace-nowrap tracking-tight leading-none">
                    {tab.shortLabel}
                  </span>
                </button>
              );
            })}
          </div>

          {/* TAB 1: VISUAL ANALYTICS (kept mounted once visited to prevent chart re-loading on tab switches) */}
          {hasVisitedAnalytics && (
            <div
              className={
                activeTab === "analytics"
                  ? `overflow-x-clip ${tabAnimClass}`
                  : "hidden"
              }
            >
              <ExpenseCharts
                categoryStats={categoryStats}
                monthlyStats={monthlyStats}
                totalSpent={summary.totalSpent}
                annualBudget={summary.annualBudget}
                summary={summary}
                allExpenses={allExpenses}
                deposits={deposits}
                selectedCategory={selectedCategory}
                onSelectCategory={(cat) => setSelectedCategory(cat)}
                onViewCategoryExpenses={(cat) => {
                  setSelectedCategory(cat);
                  handleTabChange("expenses");
                }}
                onSelectExpense={(exp) => setSelectedReceipt(exp)}
              />
            </div>
          )}

          {activeTab !== "analytics" && (
            <div key={activeTab} className={`overflow-x-clip ${tabAnimClass}`}>

          {/* TAB 2: STATUTORY COMMITTEE ALLOCATIONS (COMPACT LIST / TABLE VIEW) */}
          {activeTab === "allocations" && (() => {
            const totalAllocated = categoryStats.reduce((sum, c) => sum + (Number(c.allocated_budget) || 0), 0);
            const totalDisbursed = categoryStats.reduce((sum, c) => sum + (Number(c.total) || 0), 0);
            const totalRemaining = Math.max(0, totalAllocated - totalDisbursed);
            const overallUtilPercent = totalAllocated > 0 ? ((totalDisbursed / totalAllocated) * 100).toFixed(1) : "0";
            const totalVouchers = categoryStats.reduce((sum, c) => sum + (c.count || 0), 0);
            const totalAllocationPages = Math.max(1, Math.ceil(categoryStats.length / PAGE_SIZE));
            const currentAllocationPage = Math.min(allocationPage, totalAllocationPages);
            const paginatedCategories = categoryStats.slice(
              (currentAllocationPage - 1) * PAGE_SIZE,
              currentAllocationPage * PAGE_SIZE
            );

            return (
              <div className="bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden flex flex-col">
                <div className="px-2.5 py-2 sm:p-5 lg:p-6 space-y-2 sm:space-y-4">
                  {/* Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2 border-b border-slate-100 dark:border-slate-800 pb-1.5 sm:pb-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <h2 className="text-sm sm:text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight leading-snug">
                          Statutory Committee Allocations
                        </h2>
                        <span className="sm:hidden text-[10px] font-bold text-brand-800 dark:text-brand-300 bg-brand-50 dark:bg-brand-950/50 px-2 py-0.5 rounded-full border border-brand-200 dark:border-brand-800/70 shrink-0">
                          {categoryStats.length} Committees
                        </span>
                      </div>
                      <p className="md:hidden text-[11px] text-slate-500 dark:text-slate-400 leading-tight truncate">
                        ABYIP FY {summary.fiscalYear} budget caps vs. disbursements.
                      </p>
                      <p className="hidden md:block text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        Approved statutory committee budget caps (ABYIP FY {summary.fiscalYear}), actual disbursements, and remaining available funds.
                      </p>
                    </div>
                    <span className="hidden sm:inline-block text-xs font-bold text-brand-800 dark:text-brand-300 bg-brand-50 dark:bg-brand-950/50 px-2.5 py-1 rounded-full border border-brand-200 dark:border-brand-800/70 shrink-0">
                      {categoryStats.length} Active Committees
                    </span>
                  </div>

                {/* Desktop High-Density Table View (hidden md:block) - Fits 100% at a single glance with zero horizontal scroll */}
                <div className="hidden md:block rounded-xl border border-slate-200/80 dark:border-slate-800/90 overflow-hidden bg-white dark:bg-slate-900">
                  <table className="w-full text-left border-collapse table-fixed">
                    <thead>
                      <tr className="bg-slate-50/90 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 select-none">
                        <th className={`py-2.5 px-3 ${canManage ? "w-[26%]" : "w-[28%]"}`}>Committee</th>
                        <th className={`py-2.5 px-2.5 ${canManage ? "w-[22%]" : "w-[24%]"}`}>Utilization</th>
                        <th className={`py-2.5 px-2 text-center whitespace-nowrap ${canManage ? "w-[14%]" : "w-[16%]"}`}>Disbursed</th>
                        <th className={`py-2.5 px-2 text-center whitespace-nowrap ${canManage ? "w-[14%]" : "w-[16%]"}`}>Budget Cap</th>
                        <th className={`py-2.5 px-2 text-center whitespace-nowrap ${canManage ? "w-[14%]" : "w-[16%]"}`}>Remaining</th>
                        {canManage && (
                          <th className="py-2.5 px-2 text-center whitespace-nowrap w-[10%]">Actions</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                      {categoryStats.map((cat) => {
                        const allocated = Number(cat.allocated_budget) || 0;
                        const catTotal = Number(cat.total) || 0;
                        const remaining = Math.max(0, allocated - catTotal);
                        const utilPercent = allocated > 0 ? ((catTotal / allocated) * 100).toFixed(1) : "0";
                        const badgeClass = getCategoryBadge(cat.category);
                        const theme = getCategoryCardTheme(cat.category, false);
                        const matchedCat = categoriesList.find(
                          (c) => c.name.toLowerCase() === cat.category.toLowerCase()
                        ) || {
                          id: 0,
                          name: cat.category,
                          allocated_budget: allocated,
                          description: "",
                          color: "blue",
                        };

                        return (
                          <tr key={cat.category} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/60 transition-colors">
                            {/* Committee Name + Color Dot + Subline Voucher Count */}
                            <td className="py-2 px-3">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className={`w-2 h-2 rounded-full ${theme.bar} shrink-0`} />
                                <div className="min-w-0">
                                  <p className="font-bold text-slate-900 dark:text-slate-100 text-xs truncate leading-snug" title={cat.category}>
                                    {cat.category}
                                  </p>
                                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium leading-none mt-0.5">
                                    {cat.count} voucher{cat.count === 1 ? "" : "s"}
                                  </p>
                                </div>
                              </div>
                            </td>

                            {/* Utilization Progress Bar + % Pill */}
                            <td className="py-2 px-2.5">
                              <div className="flex items-center gap-1.5">
                                <div className={`flex-1 ${theme.track} rounded-full h-1.5 overflow-hidden min-w-[50px]`}>
                                  <div
                                    className={`${theme.bar} h-1.5 rounded-full transition-all duration-500`}
                                    style={{ width: `${Math.min(100, parseFloat(utilPercent))}%` }}
                                  />
                                </div>
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0 font-mono ${badgeClass}`}>
                                  {utilPercent}%
                                </span>
                              </div>
                            </td>

                            {/* Disbursed */}
                            <td className="py-2 px-2 text-center font-mono font-bold text-slate-900 dark:text-slate-100 text-xs whitespace-nowrap">
                              ₱{catTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                            </td>

                            {/* Budget Cap */}
                            <td className="py-2 px-2 text-center font-mono text-slate-600 dark:text-slate-400 text-xs whitespace-nowrap">
                              ₱{allocated.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                            </td>

                            {/* Remaining */}
                            <td className="py-2 px-2 text-center font-mono font-semibold text-emerald-700 dark:text-emerald-400 text-xs whitespace-nowrap">
                              ₱{remaining.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                            </td>

                            {/* Admin Actions */}
                            {canManage && (
                              <td className="py-2 px-2 text-center whitespace-nowrap">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => openEditCategory(matchedCat)}
                                    className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer active:scale-95 shadow-2xs"
                                    title="Edit Category & Budget"
                                    aria-label="Edit Category & Budget"
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteCategory(matchedCat.id, cat.category)}
                                    className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-white dark:bg-slate-900 hover:bg-rose-50 dark:hover:bg-rose-950/60 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer active:scale-95 shadow-2xs"
                                    title="Delete Category"
                                    aria-label="Delete Category"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-slate-50/90 dark:bg-slate-800/80 font-bold border-t border-slate-200 dark:border-slate-800 text-xs">
                      <tr>
                        <td className="py-2 px-3">
                          <p className="text-slate-900 dark:text-slate-100 text-xs font-bold leading-snug truncate">Total Allocation</p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium leading-none mt-0.5">
                            {categoryStats.length} Committees • {totalVouchers} vouchers
                          </p>
                        </td>
                        <td className="py-2 px-2.5">
                          <div className="flex items-center gap-1.5">
                            <div className="flex-1 bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden min-w-[50px]">
                              <div
                                className="bg-brand-600 h-1.5 rounded-full transition-all duration-500"
                                style={{ width: `${Math.min(100, parseFloat(overallUtilPercent))}%` }}
                              />
                            </div>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-mono shrink-0">
                              {overallUtilPercent}%
                            </span>
                          </div>
                        </td>
                        <td className="py-2 px-2 text-center font-mono text-slate-900 dark:text-slate-100 text-xs whitespace-nowrap">
                          ₱{totalDisbursed.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2 px-2 text-center font-mono text-slate-700 dark:text-slate-300 text-xs whitespace-nowrap">
                          ₱{totalAllocated.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2 px-2 text-center font-mono text-emerald-700 dark:text-emerald-400 text-xs whitespace-nowrap">
                          ₱{totalRemaining.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </td>
                        {canManage && (
                          <td className="py-2 px-2 text-center" />
                        )}
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Mobile High-Density Strip View (md:hidden, 3 committees per page) */}
                <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
                  {categoryStats.length === 0 ? (
                    <div className="py-10 text-center text-xs text-slate-500 dark:text-slate-400">
                      No committee allocations configured yet.
                    </div>
                  ) : (
                    <>
                      {paginatedCategories.map((cat) => {
                        const allocated = Number(cat.allocated_budget) || 0;
                        const catTotal = Number(cat.total) || 0;
                        const remaining = Math.max(0, allocated - catTotal);
                        const utilPercent = allocated > 0 ? ((catTotal / allocated) * 100).toFixed(1) : "0";
                        const badgeClass = getCategoryBadge(cat.category);
                        const theme = getCategoryCardTheme(cat.category, false);
                        const matchedCat = categoriesList.find(
                          (c) => c.name.toLowerCase() === cat.category.toLowerCase()
                        ) || {
                          id: 0,
                          name: cat.category,
                          allocated_budget: allocated,
                          description: "",
                          color: "blue",
                        };

                        return (
                          <div key={cat.category} className="py-1.5 first:pt-0 space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className={`w-2 h-2 rounded-full ${theme.bar} shrink-0`} />
                                <span className="font-bold text-slate-900 dark:text-slate-100 text-xs truncate">{cat.category}</span>
                                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium shrink-0">
                                  ({cat.count} vchr{cat.count === 1 ? "" : "s"})
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                {canManage && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => openEditCategory(matchedCat)}
                                      className="inline-flex items-center justify-center p-1 rounded-md bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer active:scale-95 shadow-2xs"
                                      title="Edit Category & Budget"
                                      aria-label="Edit Category & Budget"
                                    >
                                      <Pencil className="w-3 h-3" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteCategory(matchedCat.id, cat.category)}
                                      className="inline-flex items-center justify-center p-1 rounded-md bg-white dark:bg-slate-900 hover:bg-rose-50 dark:hover:bg-rose-950/60 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer active:scale-95 shadow-2xs"
                                      title="Delete Category"
                                      aria-label="Delete Category"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </>
                                )}
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${badgeClass}`}>
                                  {utilPercent}%
                                </span>
                              </div>
                            </div>

                            <div className={`w-full ${theme.track} rounded-full h-1.5 overflow-hidden`}>
                              <div
                                className={`${theme.bar} h-1.5 rounded-full transition-all duration-500`}
                                style={{ width: `${Math.min(100, parseFloat(utilPercent))}%` }}
                              />
                            </div>

                            <div className="flex items-center justify-between text-[11px]">
                              <div>
                                <span className="text-slate-400 dark:text-slate-500 text-[10px] block">Disbursed</span>
                                <span className="font-mono font-bold text-slate-900 dark:text-slate-100 text-xs">
                                  ₱{catTotal.toLocaleString("en-US", { minimumFractionDigits: 0 })}
                                </span>
                              </div>
                              <div className="text-center">
                                <span className="text-slate-400 dark:text-slate-500 text-[10px] block">Budget Cap</span>
                                <span className="font-mono text-slate-600 dark:text-slate-400 text-[11px]">
                                  ₱{allocated.toLocaleString("en-US", { minimumFractionDigits: 0 })}
                                </span>
                              </div>
                              <div className="text-right">
                                <span className="text-slate-400 dark:text-slate-500 text-[10px] block">Remaining</span>
                                <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-400 text-[11px]">
                                  ₱{remaining.toLocaleString("en-US", { minimumFractionDigits: 0 })}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {/* Filler slots on mobile to keep 3 committee slots constant */}
                      {categoryStats.length > 0 && paginatedCategories.length < PAGE_SIZE && (
                        Array.from({ length: PAGE_SIZE - paginatedCategories.length }).map((_, emptyIdx) => (
                          <div
                            key={`empty-mob-alloc-${emptyIdx}`}
                            className="h-[68px] select-none pointer-events-none opacity-0"
                            aria-hidden="true"
                          />
                        ))
                      )}
                    </>
                  )}

                  {/* Mobile Total Summary Strip */}
                  <div className="pt-1.5 border-t border-slate-200 dark:border-slate-800 space-y-0.5">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-900 dark:text-slate-100">
                      <span>Total Allocation ({overallUtilPercent}% Used)</span>
                      <span className="font-mono">₱{totalDisbursed.toLocaleString("en-US", { minimumFractionDigits: 0 })}</span>
                    </div>
                    <div className="flex items-center justify-between text-[10.5px] text-slate-500 dark:text-slate-400 font-mono">
                      <span>Cap: ₱{totalAllocated.toLocaleString("en-US", { minimumFractionDigits: 0 })}</span>
                      <span className="text-emerald-700 dark:text-emerald-400 font-semibold">Left: ₱{totalRemaining.toLocaleString("en-US", { minimumFractionDigits: 0 })}</span>
                    </div>
                  </div>
                </div>
                </div>

                {/* Mobile Allocations Pagination Footer */}
                <div className="md:hidden px-3 py-1.5 bg-slate-50/80 dark:bg-slate-800/70 border-t border-slate-200 dark:border-slate-800 flex flex-row items-center justify-between gap-2 text-[11px] shrink-0">
                  <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 text-[11px] min-w-0">
                    <span>
                      Showing{" "}
                      <strong className="font-mono font-bold text-slate-900 dark:text-slate-100">
                        {categoryStats.length === 0 ? 0 : (currentAllocationPage - 1) * PAGE_SIZE + 1}
                      </strong>
                      {"–"}
                      <strong className="font-mono font-bold text-slate-900 dark:text-slate-100">
                        {Math.min(currentAllocationPage * PAGE_SIZE, categoryStats.length)}
                      </strong>{" "}
                      of{" "}
                      <strong className="font-mono font-bold text-slate-900 dark:text-slate-100">
                        {categoryStats.length}
                      </strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setAllocationPage((p) => Math.max(1, Math.min(totalAllocationPages, p) - 1))}
                      disabled={currentAllocationPage === 1}
                      className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-35 disabled:cursor-not-allowed transition-all shadow-2xs cursor-pointer shrink-0"
                      aria-label="Previous page"
                      title="Previous page"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>

                    <div className="flex items-center gap-1 shrink-0">
                      {getPaginationItems(currentAllocationPage, totalAllocationPages).map((item, idx) => {
                        if (item === "...") {
                          const isFirstEllipsis = idx === 1;
                          const jumpTarget = isFirstEllipsis
                            ? Math.max(1, currentAllocationPage - 5)
                            : Math.min(totalAllocationPages, currentAllocationPage + 5);
                          return (
                            <button
                              key={`ellipsis-alloc-${idx}`}
                              type="button"
                              onClick={() => setAllocationPage(jumpTarget)}
                              className="w-5 h-7 flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 font-bold text-xs transition-colors cursor-pointer select-none"
                              title={`Jump ${isFirstEllipsis ? "backward" : "forward"} 5 pages (Page ${jumpTarget})`}
                              aria-label={`Jump ${isFirstEllipsis ? "backward" : "forward"} 5 pages`}
                            >
                              …
                            </button>
                          );
                        }

                        const isCurrent = currentAllocationPage === item;
                        return (
                          <button
                            key={`alloc-page-${item}`}
                            type="button"
                            onClick={() => setAllocationPage(item)}
                            className={`min-w-7 h-7 px-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center shrink-0 ${
                              isCurrent
                                ? "bg-brand-600 text-white shadow-xs cursor-default font-extrabold"
                                : "text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-slate-50 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 cursor-pointer shadow-2xs font-semibold"
                            }`}
                          >
                            {item}
                          </button>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      onClick={() => setAllocationPage((p) => Math.min(totalAllocationPages, p + 1))}
                      disabled={currentAllocationPage >= totalAllocationPages}
                      className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-35 disabled:cursor-not-allowed transition-all shadow-2xs cursor-pointer shrink-0"
                      aria-label="Next page"
                      title="Next page"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

      {/* TAB: AUDITED DISBURSEMENTS (EXPENSES) */}
      {activeTab === "expenses" && (
        <div
          className="bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden flex flex-col transition-all duration-150 md:h-[545px] md:min-h-[545px]"
        >
        {/* Active Search & Category Indicators with 1-click Clear (Only rendered when filters are active) */}
        {(selectedCategory !== "all" || searchQuery) && (
          <div className="px-3.5 py-2 sm:px-6 sm:py-2.5 border-b border-slate-200 dark:border-slate-800 shrink-0 bg-slate-50/50 dark:bg-slate-800/30">
            <div className="flex items-center gap-1.5 flex-wrap">
              {selectedCategory !== "all" && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategory("all");
                    setExpensePage(1);
                  }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-brand-50 dark:bg-brand-950/60 border border-brand-200 dark:border-brand-800/60 text-brand-700 dark:text-brand-300 text-xs font-medium transition hover:bg-brand-100 dark:hover:bg-brand-900/60 cursor-pointer shrink-0"
                  title="Clear category filter"
                >
                  <span className="max-w-[120px] sm:max-w-[180px] truncate">{selectedCategory}</span>
                  <X className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                </button>
              )}
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setTempSearch("");
                    setExpensePage(1);
                  }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium transition cursor-pointer shrink-0"
                  title="Clear search filter"
                >
                  <span className="max-w-[120px] sm:max-w-[180px] truncate">&ldquo;{searchQuery}&rdquo;</span>
                  <X className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* ========================================================
            AUDITED EXPENSES (MOBILE CARDS + DESKTOP TABLE)
           ======================================================== */}
        <div className="flex-1 flex flex-col min-h-0">
            {/* Mobile Card View (md:hidden) */}
            <div className="md:hidden p-1.5 space-y-1.5 flex flex-col bg-slate-50/50 dark:bg-slate-800/50">
              {loading ? (
                <div className="space-y-1.5 animate-pulse">
                  {Array.from({ length: PAGE_SIZE }).map((_, idx) => (
                    <div
                      key={`skeleton-card-${idx}`}
                      className="rounded-xl border border-slate-200/90 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 px-2.5 py-1.5 h-[112px] flex flex-col justify-between"
                    >
                      <div className="flex items-center justify-between">
                        <div className="h-4 w-28 bg-slate-200 dark:bg-slate-700/80 rounded" />
                        <div className="h-3.5 w-16 bg-slate-200 dark:bg-slate-700/80 rounded" />
                      </div>
                      <div className="space-y-1 my-0.5">
                        <div className="h-3.5 w-3/4 bg-slate-200 dark:bg-slate-700/80 rounded" />
                        <div className="h-3 w-1/2 bg-slate-100 dark:bg-slate-800 rounded" />
                      </div>
                      <div className="pt-1 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <div className="h-4 w-20 bg-slate-200 dark:bg-slate-700/80 rounded" />
                        <div className="h-5 w-16 bg-slate-200 dark:bg-slate-700/80 rounded-lg" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : sortedExpenses.length === 0 ? (
                <div className="h-full flex items-center justify-center text-center text-slate-500 dark:text-slate-400 text-xs py-12">
                  No expense records found matching your filter.
                </div>
              ) : (
                <>
                  {paginatedExpenses.map((exp) => {
                    const badgeClass = getCategoryBadge(exp.category);
                    const rowStyle = getCategoryRowStyle(exp.category);
                    const cleanPayee = cleanPayeeName(exp.payee);
                    return (
                      <div
                        key={exp.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => openExpenseDetails(exp)}
                        onKeyDown={(e) => {
                          if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
                            e.preventDefault();
                            openExpenseDetails(exp);
                          }
                        }}
                        className={`rounded-xl border px-2.5 py-1.5 transition-all h-[112px] flex flex-col justify-between overflow-hidden shadow-2xs cursor-pointer active:scale-[0.99] ${rowStyle.cardBg}`}
                      >
                        {/* Top: Category Badge + Date */}
                        <div className="flex items-center justify-between gap-2 shrink-0 min-w-0">
                          <span
                            title={exp.category}
                            className={`inline-block max-w-full truncate px-1.5 py-0.5 rounded-md text-[10px] font-bold border shadow-2xs leading-none ${badgeClass}`}
                          >
                            {exp.category}
                          </span>
                          <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 font-semibold shrink-0">{exp.date}</span>
                        </div>

                        {/* Middle: Title & Description */}
                        <div className="min-w-0">
                          <p
                            className="font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-[13px] leading-tight break-words line-clamp-1"
                            title={exp.title}
                          >
                            {exp.title}
                          </p>
                          {exp.description && (
                            <p
                              className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-tight break-words line-clamp-1"
                              title={exp.description}
                            >
                              {exp.description}
                            </p>
                          )}
                        </div>

                        {/* Bottom Section: Payee Row + Amount/Action Row */}
                        <div className="pt-1 border-t border-slate-200/70 dark:border-slate-800/80 shrink-0 space-y-0.5">
                          {/* Row 1: Voucher Badge + Payee Name (Full Width) */}
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-[10px] leading-tight bg-white/95 dark:bg-slate-900/95 px-1.5 py-0.5 rounded border border-slate-200/80 dark:border-slate-800/90 shadow-2xs shrink-0">
                              {exp.voucher_no || "DV"}
                            </span>
                            <span
                              className="text-slate-800 dark:text-slate-200 text-[11.5px] font-semibold truncate block min-w-0"
                              title={cleanPayee || "SK Barangay"}
                            >
                              {cleanPayee || "SK Barangay"}
                            </span>
                          </div>

                          {/* Row 2: Amount (Left) & Details Button (Right) */}
                          <div className="flex items-center justify-between">
                            <p className="font-black text-slate-950 dark:text-slate-50 font-mono text-[13.5px] sm:text-sm leading-none">
                              ₱{Number(exp.amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                            </p>
                            <div className="flex items-center gap-1.5">
                              {canManage && (
                                <>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openEditExpense(exp);
                                    }}
                                    className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer active:scale-95 shadow-2xs"
                                    title="Edit Expenditure Record"
                                    aria-label="Edit Expenditure Record"
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteExpense(exp.id);
                                    }}
                                    className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-white dark:bg-slate-900 hover:bg-rose-50 dark:hover:bg-rose-950/60 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer active:scale-95 shadow-2xs"
                                    title="Delete Expenditure Record"
                                    aria-label="Delete Expenditure Record"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </>
                              )}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openExpenseDetails(exp);
                                }}
                                className="inline-flex items-center gap-1 h-6 px-2 rounded-lg bg-white dark:bg-slate-900 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/80 transition-all cursor-pointer active:scale-95 shadow-2xs text-[11px] font-bold"
                                title="View Full Details & Itemized Breakdown"
                                aria-label="View Full Details & Itemized Breakdown"
                              >
                                <Eye className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                                <span>Details</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Filler cards on mobile to keep 3 slots constant */}
                  {sortedExpenses.length > 0 && paginatedExpenses.length < PAGE_SIZE && (
                    Array.from({ length: PAGE_SIZE - paginatedExpenses.length }).map((_, emptyIdx) => (
                      <div 
                        key={`empty-mob-exp-${emptyIdx}`} 
                        className="h-[112px] rounded-xl border border-dashed border-slate-200/70 dark:border-slate-800/80 select-none pointer-events-none opacity-40 bg-white/40 dark:bg-slate-900/40"
                      />
                    ))
                  )}
                </>
              )}
            </div>

            {/* Desktop Table View (hidden md:block) - High-Density Fixed-Height Grid */}
            <div className="hidden md:flex flex-col flex-1 min-h-0 relative w-full overflow-hidden">
              <table className="w-full h-full text-left border-collapse table-fixed">
                <thead className="sticky top-0 z-10 bg-slate-50/95 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-800 shadow-2xs shrink-0">
                  <tr className="text-slate-600 dark:text-slate-400 text-[10.5px] font-bold uppercase tracking-wider select-none">
                    <th
                      onClick={() => toggleExpenseSort("date")}
                      className="py-2.5 pl-4 sm:pl-6 pr-2 cursor-pointer hover:bg-slate-100/90 dark:hover:bg-slate-800/90 transition-colors w-[10%] group"
                    >
                      <div className="flex items-center gap-1">
                        <span>Date</span>
                        {expenseSort.field === "date" ? (
                          expenseSort.order === "asc" ? (
                            <ArrowUp className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                          ) : (
                            <ArrowDown className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                          )
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300" />
                        )}
                      </div>
                    </th>
                    <th className={`py-2.5 px-3 ${canManage ? "w-[46%]" : "w-[51%]"}`}>Project / Particulars</th>
                    <th className="py-2.5 px-2.5 w-[21%]">Voucher / Payee</th>
                    <th
                      onClick={() => toggleExpenseSort("amount")}
                      className="py-2.5 px-2.5 text-right cursor-pointer hover:bg-slate-100/90 dark:hover:bg-slate-800/90 transition-colors w-[11%] group"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Amount</span>
                        {expenseSort.field === "amount" ? (
                          expenseSort.order === "asc" ? (
                            <ArrowUp className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                          ) : (
                            <ArrowDown className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                          )
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300" />
                        )}
                      </div>
                    </th>
                    <th className={`py-2.5 pl-2 pr-4 sm:pr-6 text-center ${canManage ? "w-[12%]" : "w-[7%]"}`}>
                      {canManage ? "Actions" : "Details"}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/80 dark:divide-slate-800/80 text-xs h-full">
                  {loading ? (
                    Array.from({ length: 3 }).map((_, idx) => (
                      <tr
                        key={`skeleton-row-${idx}`}
                        className={`h-1/3 animate-pulse ${
                          idx % 2 === 1 ? "bg-slate-50/50 dark:bg-slate-800/40" : "bg-white dark:bg-slate-900"
                        }`}
                      >
                        {/* Date */}
                        <td className="py-2.5 pl-4 sm:pl-6 pr-2 w-[11%]">
                          <div className="h-3.5 w-16 bg-slate-200 dark:bg-slate-700/80 rounded" />
                        </td>
                        {/* Project / Particulars */}
                        <td className="py-2.5 px-3 w-[47%]">
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                              <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700/80 rounded" />
                              <div className="h-3.5 w-40 bg-slate-200 dark:bg-slate-700/80 rounded" />
                            </div>
                            <div className="h-3 w-56 bg-slate-100 dark:bg-slate-800 rounded" />
                          </div>
                        </td>
                        {/* Voucher / Payee */}
                        <td className="py-2.5 px-3 w-[22%]">
                          <div className="flex items-center gap-2">
                            <div className="h-4 w-14 bg-slate-200 dark:bg-slate-700/80 rounded" />
                            <div className="h-3.5 w-24 bg-slate-200 dark:bg-slate-700/80 rounded" />
                          </div>
                        </td>
                        {/* Amount */}
                        <td className="py-2.5 px-2.5 text-right w-[13%]">
                          <div className="h-4 w-20 bg-slate-200 dark:bg-slate-700/80 rounded ml-auto" />
                        </td>
                        {/* Details */}
                        <td className="py-2.5 pl-2 pr-4 sm:pr-6 text-center w-[7%]">
                          <div className="h-6 w-7 bg-slate-200 dark:bg-slate-700/80 rounded mx-auto" />
                        </td>
                      </tr>
                    ))
                  ) : sortedExpenses.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="h-full text-center text-slate-500 dark:text-slate-400 text-sm align-middle py-12">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Receipt className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                          <p className="font-semibold text-slate-700 dark:text-slate-300">No expense records found</p>
                          <p className="text-xs text-slate-400 dark:text-slate-500 max-w-sm">
                            Try adjusting your search query or reset your filters.
                          </p>
                          {(selectedCategory !== "all" || searchQuery.trim() !== "") && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedCategory("all");
                                setSearchQuery("");
                              }}
                              className="mt-1 px-3 py-1 text-xs font-semibold text-brand-700 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/50 hover:bg-brand-100 dark:hover:bg-brand-900/60 border border-brand-200 dark:border-brand-800/70 rounded-lg transition-colors cursor-pointer"
                            >
                              Reset filters
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <>
                      {paginatedExpenses.map((exp, idx) => {
                        const badgeClass = getCategoryBadge(exp.category);
                        const rowStyle = getCategoryRowStyle(exp.category);
                        const breakdownItems = getExpenseBreakdown(exp.voucher_no, exp.title, exp.amount, exp.description, exp.line_items);
                        return (
                          <tr 
                            key={exp.id}
                            tabIndex={0}
                            onClick={() => openExpenseDetails(exp)}
                            onKeyDown={(e) => {
                              if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
                                e.preventDefault();
                                openExpenseDetails(exp);
                              }
                            }}
                            className={`transition-colors group h-1/3 cursor-pointer ${rowStyle.rowBg}`}
                          >
                            {/* Date */}
                            <td className="py-2.5 pl-4 sm:pl-6 pr-2 align-middle min-w-0">
                              <span className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                                {exp.date}
                              </span>
                            </td>

                            {/* Project Title & Description & Category / Item Count */}
                            <td className="py-2.5 px-3 align-middle min-w-0">
                              <p className="font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-[13px] group-hover:text-brand-900 dark:group-hover:text-brand-300 transition-colors leading-snug break-words line-clamp-2" title={exp.title}>
                                {exp.title}
                              </p>
                              {exp.description && (
                                <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 leading-snug break-words line-clamp-3" title={exp.description}>
                                  {exp.description}
                                </p>
                              )}
                              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10.5px] font-bold border shadow-2xs leading-tight whitespace-nowrap ${badgeClass}`}
                                >
                                  {exp.category}
                                </span>
                                {breakdownItems.length > 1 && (
                                  <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-slate-600 dark:text-slate-400 bg-white/90 dark:bg-slate-900/90 px-1.5 py-0.5 rounded-md border border-slate-200/80 dark:border-slate-800/90 shrink-0 whitespace-nowrap shadow-2xs leading-tight">
                                    <Layers className="w-2.5 h-2.5 text-slate-400 dark:text-slate-500" />
                                    <span>{breakdownItems.length} items</span>
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Voucher / Payee */}
                            <td className="py-2.5 px-2.5 align-middle min-w-0">
                              <div className="min-w-0 leading-tight space-y-0.5">
                                <span className="font-mono font-bold text-slate-800 dark:text-slate-200 bg-white/90 dark:bg-slate-900/90 px-1.5 py-0.2 rounded border border-slate-200 dark:border-slate-800 text-[10.5px] inline-block whitespace-nowrap shadow-2xs">
                                  {exp.voucher_no || "DV-ON-FILE"}
                                </span>
                                {exp.payee ? (
                                  <p className="text-slate-600 dark:text-slate-400 text-xs font-medium leading-snug break-words line-clamp-3" title={cleanPayeeName(exp.payee)}>
                                    {cleanPayeeName(exp.payee)}
                                  </p>
                                ) : (
                                  <p className="text-slate-400 dark:text-slate-500 text-[10.5px] italic">SK Barangay</p>
                                )}
                              </div>
                            </td>

                            {/* Amount */}
                            <td className="py-2.5 px-2.5 text-right align-middle min-w-0">
                              <span className="font-mono font-bold text-slate-950 dark:text-slate-50 text-xs sm:text-[13px] tracking-tight whitespace-nowrap">
                                ₱{Number(exp.amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                              </span>
                            </td>

                            {/* Details & Actions Button */}
                            <td className="py-2.5 pl-2 pr-4 sm:pr-6 text-center align-middle min-w-0">
                              <div className="flex items-center justify-center gap-1 mx-auto">
                                {canManage && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openEditExpense(exp);
                                      }}
                                      className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-all shadow-2xs hover:shadow-xs active:scale-95 cursor-pointer"
                                      title="Edit Expenditure Record"
                                      aria-label="Edit Expenditure Record"
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteExpense(exp.id);
                                      }}
                                      className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-white dark:bg-slate-900 hover:bg-rose-50 dark:hover:bg-rose-950/60 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 border border-slate-200 dark:border-slate-700 transition-all shadow-2xs hover:shadow-xs active:scale-95 cursor-pointer"
                                      title="Delete Expenditure Record"
                                      aria-label="Delete Expenditure Record"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                )}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openExpenseDetails(exp);
                                  }}
                                  className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-white dark:bg-slate-900 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 hover:text-emerald-950 dark:hover:text-emerald-200 border border-emerald-300 dark:border-emerald-700/80 transition-all shadow-2xs hover:shadow-xs active:scale-95 cursor-pointer"
                                  title="View Full Details & Itemized Breakdown"
                                  aria-label="View Full Details & Itemized Breakdown"
                                >
                                  <Eye className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}

                      {/* Fixed height empty filler rows to keep table grid size constant */}
                      {sortedExpenses.length > 0 && paginatedExpenses.length < PAGE_SIZE && (
                        Array.from({ length: PAGE_SIZE - paginatedExpenses.length }).map((_, emptyIdx) => (
                          <tr 
                            key={`empty-exp-${emptyIdx}`} 
                            className={`h-1/3 select-none pointer-events-none ${
                              (paginatedExpenses.length + emptyIdx) % 2 === 1 ? "bg-slate-50/40 dark:bg-slate-800/40" : "bg-white dark:bg-slate-900"
                            }`}
                          >
                            <td colSpan={5} className="py-2.5 pl-4 sm:pl-6 pr-4 sm:pr-6 text-transparent">&nbsp;</td>
                          </tr>
                        ))
                      )}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Expenses Compact Ledger Footer / Page Navigation */}
          <div className="px-3 py-1.5 sm:px-6 sm:py-2.5 bg-slate-50/80 dark:bg-slate-800/70 border-t border-slate-200 dark:border-slate-800 flex flex-row items-center justify-between gap-2 text-[11px] sm:text-xs shrink-0 md:mt-auto">
            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 text-[11px] sm:text-xs min-w-0">
              <span>
                Showing{" "}
                <strong className="font-mono font-bold text-slate-900 dark:text-slate-100">
                  {loading
                    ? "..."
                    : sortedExpenses.length === 0
                    ? 0
                    : (currentExpensePage - 1) * PAGE_SIZE + 1}
                </strong>
                {"–"}
                <strong className="font-mono font-bold text-slate-900 dark:text-slate-100">
                  {loading
                    ? "..."
                    : Math.min(currentExpensePage * PAGE_SIZE, sortedExpenses.length)}
                </strong>{" "}
                of{" "}
                <strong className="font-mono font-bold text-slate-900 dark:text-slate-100">
                  {loading ? "..." : allExpenses.length}
                </strong>
              </span>
              <span className="hidden sm:inline text-slate-300 dark:text-slate-600">•</span>
              <span className="hidden sm:inline">
                Total:{" "}
                <strong className="font-mono text-slate-950 dark:text-slate-50 font-bold">
                  {loading
                    ? "..."
                    : `₱${grandExpensesTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
                </strong>
              </span>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setExpensePage((p) => Math.max(1, Math.min(totalExpensePages, p) - 1))}
                disabled={currentExpensePage === 1}
                className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-35 disabled:cursor-not-allowed transition-all shadow-2xs cursor-pointer shrink-0"
                aria-label="Previous page"
                title="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-1 shrink-0">
                {(() => {
                  const paginationItems = getPaginationItems(currentExpensePage, totalExpensePages);
                  return paginationItems.map((item, idx) => {
                    if (item === "...") {
                      const isFirstEllipsis = idx === 1;
                      const jumpTarget = isFirstEllipsis
                        ? Math.max(1, currentExpensePage - 5)
                        : Math.min(totalExpensePages, currentExpensePage + 5);
                      return (
                        <button
                          key={`ellipsis-exp-${idx}`}
                          type="button"
                          onClick={() => setExpensePage(jumpTarget)}
                          className="w-5 sm:w-6 h-7 sm:h-8 flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 font-bold text-xs transition-colors cursor-pointer select-none"
                          title={`Jump ${isFirstEllipsis ? "backward" : "forward"} 5 pages (Page ${jumpTarget})`}
                          aria-label={`Jump ${isFirstEllipsis ? "backward" : "forward"} 5 pages`}
                        >
                          …
                        </button>
                      );
                    }

                    const isCurrent = currentExpensePage === item;
                    return (
                      <button
                        key={`exp-page-${item}`}
                        type="button"
                        onClick={() => setExpensePage(item)}
                        className={`min-w-7 h-7 sm:min-w-8 sm:h-8 px-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center shrink-0 ${
                          isCurrent
                            ? "bg-brand-600 text-white shadow-xs cursor-default font-extrabold"
                            : "text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-slate-50 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 cursor-pointer shadow-2xs font-semibold"
                        }`}
                      >
                        {item}
                      </button>
                    );
                  });
                })()}
              </div>

              <button
                type="button"
                onClick={() => setExpensePage((p) => Math.min(totalExpensePages, p + 1))}
                disabled={currentExpensePage >= totalExpensePages}
                className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-35 disabled:cursor-not-allowed transition-all shadow-2xs cursor-pointer shrink-0"
                aria-label="Next page"
                title="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB: AUDITED BANK REMITTANCES (DEPOSITS) */}
      {activeTab === "deposits" && (
        <div
          className="bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden flex flex-col transition-all duration-150 md:h-[545px] md:min-h-[545px]"
        >
          {/* Active Search Term Indicator with 1-click Clear (Only rendered when search is active) */}
          {searchQuery && (
            <div className="px-3.5 py-2 sm:px-6 sm:py-2.5 border-b border-slate-200 dark:border-slate-800 shrink-0 bg-slate-50/50 dark:bg-slate-800/30">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setTempSearch("");
                    setDepositPage(1);
                  }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium transition cursor-pointer shrink-0"
                  title="Clear search filter"
                >
                  <span className="max-w-[120px] sm:max-w-[180px] truncate">&ldquo;{searchQuery}&rdquo;</span>
                  <X className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200" />
                </button>
              </div>
            </div>
          )}

          {/* ========================================================
              AUDITED BANK REMITTANCES (MOBILE CARDS + DESKTOP TABLE)
             ======================================================== */}
          <div className="flex-1 flex flex-col min-h-0">
            {/* Mobile Card View (md:hidden) */}
            <div className="md:hidden p-1.5 space-y-1.5 flex flex-col bg-slate-50/50 dark:bg-slate-800/50">
              {sortedDeposits.length === 0 ? (
                <div className="h-full flex items-center justify-center text-center text-slate-500 dark:text-slate-400 text-xs py-12">
                  No monthly remittances recorded yet.
                </div>
              ) : (
                <>
                  {paginatedDeposits.map((dep) => (
                    <div
                      key={dep.id}
                      className="rounded-xl border border-indigo-200/90 dark:border-indigo-800/70 bg-indigo-50/85 dark:bg-indigo-950/50 px-2.5 py-1.5 transition-all shadow-2xs h-[112px] flex flex-col justify-between overflow-hidden"
                    >
                      {/* Top: Reference + Date */}
                      <div className="flex items-center justify-between gap-2 shrink-0 min-w-0">
                        <span className="inline-block max-w-full truncate font-mono text-[10px] font-bold leading-none text-indigo-900 dark:text-indigo-200 bg-white/90 dark:bg-slate-900/90 px-1.5 py-0.5 rounded border border-indigo-200/80 dark:border-indigo-800/70 shadow-2xs">
                          {dep.reference_no}
                        </span>
                        <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 font-semibold shrink-0">{dep.date}</span>
                      </div>

                      {/* Middle: Source & Particulars */}
                      <div className="min-w-0">
                        <p
                          className="font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-[13px] leading-tight break-words line-clamp-1"
                          title={dep.source}
                        >
                          {dep.source}
                        </p>
                        <p
                          className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-tight break-words line-clamp-1"
                          title={dep.description || "10% Mandated SK Youth Fund remittance under RA 10742"}
                        >
                          {dep.description || "10% Mandated SK Youth Fund remittance under RA 10742"}
                        </p>
                      </div>

                      {/* Bottom Section: Depository Row + Amount/Action Row */}
                      <div className="pt-1 border-t border-indigo-200/70 dark:border-indigo-800/70 shrink-0 space-y-0.5">
                        {/* Row 1: Bank (Full Width) */}
                        <div className="flex items-center min-w-0">
                          <span className="text-slate-800 dark:text-slate-200 text-[11.5px] font-semibold truncate block min-w-0">
                            Land Bank of the Philippines
                          </span>
                        </div>

                        {/* Row 2: Amount (Left) & Slip/Validated Button (Right) */}
                        <div className="flex items-center justify-between">
                          <p className="font-black text-slate-950 dark:text-slate-50 font-mono text-[13.5px] sm:text-sm leading-none">
                            ₱{Number(dep.amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </p>
                          <div className="flex items-center gap-1.5">
                            {canManage && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => openEditDeposit(dep)}
                                  className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer active:scale-95 shadow-2xs"
                                  title="Edit Remittance Record"
                                  aria-label="Edit Remittance Record"
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteDeposit(dep.id)}
                                  className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-white dark:bg-slate-900 hover:bg-rose-50 dark:hover:bg-rose-950/60 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer active:scale-95 shadow-2xs"
                                  title="Delete Remittance Record"
                                  aria-label="Delete Remittance Record"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </>
                            )}
                            {dep.attachment_url ? (
                              <button
                                type="button"
                                onClick={() => setSelectedDepositSlip(dep)}
                                className="inline-flex items-center gap-1 h-6 px-2 rounded-lg bg-white dark:bg-slate-900 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/70 transition-all text-[11px] font-bold cursor-pointer active:scale-95 shadow-2xs"
                                title="View Official Remittance Details & Deposit Slip"
                                aria-label="View Official Remittance Details & Deposit Slip"
                              >
                                <Eye className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                                <span>Slip</span>
                              </button>
                            ) : (
                              <span
                                className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-white/90 dark:bg-slate-900/90 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/70"
                                title="Bank Validated"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                <span>Validated</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Filler cards on mobile to keep 3 slots constant */}
                  {sortedDeposits.length > 0 && paginatedDeposits.length < PAGE_SIZE && (
                    Array.from({ length: PAGE_SIZE - paginatedDeposits.length }).map((_, emptyIdx) => (
                      <div 
                        key={`empty-mob-dep-${emptyIdx}`} 
                        className="h-[112px] rounded-xl border border-dashed border-slate-200/70 dark:border-slate-800/80 select-none pointer-events-none opacity-40 bg-white/40 dark:bg-slate-900/40"
                      />
                    ))
                  )}
                </>
              )}
            </div>

            {/* Desktop Table View (hidden md:block) - High-Density Fixed-Height Grid */}
            <div className="hidden md:flex flex-col flex-1 min-h-0 relative w-full overflow-hidden">
              <table className="w-full h-full text-left border-collapse table-fixed">
                <thead className="sticky top-0 z-10 bg-slate-50/95 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-800 shadow-2xs shrink-0">
                  <tr className="text-slate-600 dark:text-slate-400 text-[10.5px] font-bold uppercase tracking-wider select-none">
                    <th
                      onClick={() => toggleDepositSort("date")}
                      className="py-2.5 pl-4 sm:pl-6 pr-2 cursor-pointer hover:bg-slate-100/90 dark:hover:bg-slate-800/90 transition-colors w-[9%] group"
                    >
                      <div className="flex items-center gap-1">
                        <span>Date</span>
                        {depositSort.field === "date" ? (
                          depositSort.order === "asc" ? (
                            <ArrowUp className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                          ) : (
                            <ArrowDown className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                          )
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300" />
                        )}
                      </div>
                    </th>
                    <th className="py-2.5 px-2.5 w-[14%]">Reference No.</th>
                    <th className="py-2.5 px-2.5 w-[23%]">Remitting Source</th>
                    <th className={`py-2.5 px-3 ${canManage ? "w-[31%]" : "w-[36%]"}`}>Particulars &amp; Legal Basis</th>
                    <th
                      onClick={() => toggleDepositSort("amount")}
                      className="py-2.5 px-2.5 text-right cursor-pointer hover:bg-slate-100/90 dark:hover:bg-slate-800/90 transition-colors w-[11%] group"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Amount</span>
                        {depositSort.field === "amount" ? (
                          depositSort.order === "asc" ? (
                            <ArrowUp className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                          ) : (
                            <ArrowDown className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                          )
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300" />
                        )}
                      </div>
                    </th>
                    <th className={`py-2.5 pl-2 pr-4 sm:pr-6 text-center ${canManage ? "w-[12%]" : "w-[7%]"}`}>
                      {canManage ? "Actions" : "Details"}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/80 dark:divide-slate-800/80 text-xs h-full">
                  {sortedDeposits.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="h-full text-center text-slate-500 dark:text-slate-400 text-sm align-middle py-12">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Landmark className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                          <p className="font-semibold text-slate-700 dark:text-slate-300">No monthly remittances recorded yet</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <>
                      {paginatedDeposits.map((dep, idx) => (
                        <tr 
                          key={dep.id} 
                          className={`transition-colors hover:bg-indigo-50/40 dark:hover:bg-indigo-950/40 group h-1/3 ${
                            idx % 2 === 1 ? "bg-slate-50/40 dark:bg-slate-800/40" : "bg-white dark:bg-slate-900"
                          }`}
                        >
                          {/* Date */}
                          <td className="py-2.5 pl-4 sm:pl-6 pr-2 align-middle min-w-0">
                            <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                              {dep.date}
                            </span>
                          </td>

                          {/* Reference No */}
                          <td className="py-2.5 px-2.5 align-middle min-w-0">
                            <span className="font-mono font-bold text-indigo-900 dark:text-indigo-200 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded border border-indigo-200/80 dark:border-indigo-800/70 text-[10.5px] inline-block whitespace-nowrap">
                              {dep.reference_no}
                            </span>
                          </td>

                          {/* Source */}
                          <td className="py-2.5 px-2.5 align-middle min-w-0">
                            <p className="font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-[12.5px] group-hover:text-indigo-950 dark:group-hover:text-indigo-200 transition-colors leading-snug break-words line-clamp-3" title={dep.source}>
                              {dep.source}
                            </p>
                            <p className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-0.5 leading-none">
                              Land Bank of the Philippines
                            </p>
                          </td>

                          {/* Description */}
                          <td className="py-2.5 px-3 align-middle min-w-0">
                            <p className="text-xs text-slate-600 dark:text-slate-400 leading-snug break-words line-clamp-3" title={dep.description || "10% Mandated SK Youth Fund remittance"}>
                              {dep.description || "10% Mandated SK Youth Fund remittance"}
                            </p>
                          </td>

                          {/* Amount */}
                          <td className="py-2.5 px-2.5 text-right align-middle min-w-0">
                            <span className="font-mono font-bold text-slate-950 dark:text-slate-50 text-xs sm:text-[13px] tracking-tight whitespace-nowrap">
                              ₱{Number(dep.amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                            </span>
                          </td>

                          {/* Remittance Details & Actions */}
                          <td className="py-2.5 pl-2 pr-4 sm:pr-6 text-center align-middle min-w-0">
                            <div className="flex items-center justify-center gap-1 mx-auto">
                              {canManage && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => openEditDeposit(dep)}
                                    className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-all shadow-2xs hover:shadow-xs active:scale-95 cursor-pointer"
                                    title="Edit Remittance Record"
                                    aria-label="Edit Remittance Record"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteDeposit(dep.id)}
                                    className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-white dark:bg-slate-900 hover:bg-rose-50 dark:hover:bg-rose-950/60 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 border border-slate-200 dark:border-slate-700 transition-all shadow-2xs hover:shadow-xs active:scale-95 cursor-pointer"
                                    title="Delete Remittance Record"
                                    aria-label="Delete Remittance Record"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                              {dep.attachment_url ? (
                                <button
                                  type="button"
                                  onClick={() => setSelectedDepositSlip(dep)}
                                  className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-950/55 text-indigo-700 dark:text-indigo-300 hover:text-indigo-900 dark:hover:text-indigo-200 border border-indigo-200 dark:border-indigo-800/70 transition-all shadow-2xs hover:shadow-xs active:scale-95 cursor-pointer"
                                  title="View Official Remittance Details & Deposit Slip"
                                  aria-label="View Official Remittance Details & Deposit Slip"
                                >
                                  <Eye className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                                </button>
                              ) : (
                                <span
                                  className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/70"
                                  title="Bank Validated (RA 10742)"
                                  aria-label="Bank Validated"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}

                      {/* Fixed height empty filler rows to keep table grid size constant */}
                      {sortedDeposits.length > 0 && paginatedDeposits.length < PAGE_SIZE && (
                        Array.from({ length: PAGE_SIZE - paginatedDeposits.length }).map((_, emptyIdx) => (
                          <tr 
                            key={`empty-dep-${emptyIdx}`} 
                            className={`h-1/3 select-none pointer-events-none ${
                              (paginatedDeposits.length + emptyIdx) % 2 === 1 ? "bg-slate-50/40 dark:bg-slate-800/40" : "bg-white dark:bg-slate-900"
                            }`}
                          >
                            <td colSpan={6} className="py-2.5 pl-4 sm:pl-6 pr-4 sm:pr-6 text-transparent">&nbsp;</td>
                          </tr>
                        ))
                      )}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Deposits Compact Ledger Footer / Page Navigation */}
          <div className="px-3 py-1.5 sm:px-6 sm:py-2.5 bg-slate-50/80 dark:bg-slate-800/70 border-t border-slate-200 dark:border-slate-800 flex flex-row items-center justify-between gap-2 text-[11px] sm:text-xs shrink-0 md:mt-auto">
            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 text-[11px] sm:text-xs min-w-0">
              <span>
                Showing{" "}
                <strong className="font-mono font-bold text-slate-900 dark:text-slate-100">
                  {sortedDeposits.length === 0 ? 0 : (currentDepositPage - 1) * PAGE_SIZE + 1}
                </strong>
                {"–"}
                <strong className="font-mono font-bold text-slate-900 dark:text-slate-100">
                  {Math.min(currentDepositPage * PAGE_SIZE, sortedDeposits.length)}
                </strong>{" "}
                of{" "}
                <strong className="font-mono font-bold text-slate-900 dark:text-slate-100">
                  {deposits.length}
                </strong>
              </span>
              <span className="hidden sm:inline text-slate-300 dark:text-slate-600">•</span>
              <span className="hidden sm:inline">
                Total:{" "}
                <strong className="font-mono text-slate-950 dark:text-slate-50 font-bold">
                  {`₱${grandDepositsTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
                </strong>
              </span>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setDepositPage((p) => Math.max(1, Math.min(totalDepositPages, p) - 1))}
                disabled={currentDepositPage === 1}
                className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-35 disabled:cursor-not-allowed transition-all shadow-2xs cursor-pointer shrink-0"
                aria-label="Previous page"
                title="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-1 shrink-0">
                {(() => {
                  const paginationItems = getPaginationItems(currentDepositPage, totalDepositPages);
                  return paginationItems.map((item, idx) => {
                    if (item === "...") {
                      const isFirstEllipsis = idx === 1;
                      const jumpTarget = isFirstEllipsis
                        ? Math.max(1, currentDepositPage - 5)
                        : Math.min(totalDepositPages, currentDepositPage + 5);
                      return (
                        <button
                          key={`ellipsis-dep-${idx}`}
                          type="button"
                          onClick={() => setDepositPage(jumpTarget)}
                          className="w-5 sm:w-6 h-7 sm:h-8 flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 font-bold text-xs transition-colors cursor-pointer select-none"
                          title={`Jump ${isFirstEllipsis ? "backward" : "forward"} 5 pages (Page ${jumpTarget})`}
                          aria-label={`Jump ${isFirstEllipsis ? "backward" : "forward"} 5 pages`}
                        >
                          …
                        </button>
                      );
                    }

                    const isCurrent = currentDepositPage === item;
                    return (
                      <button
                        key={`dep-page-${item}`}
                        type="button"
                        onClick={() => setDepositPage(item)}
                        className={`min-w-7 h-7 sm:min-w-8 sm:h-8 px-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center shrink-0 ${
                          isCurrent
                            ? "bg-indigo-600 text-white shadow-xs cursor-default font-extrabold"
                            : "text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-slate-50 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 cursor-pointer shadow-2xs font-semibold"
                        }`}
                      >
                        {item}
                      </button>
                    );
                  });
                })()}
              </div>

              <button
                type="button"
                onClick={() => setDepositPage((p) => Math.min(totalDepositPages, p + 1))}
                disabled={currentDepositPage >= totalDepositPages}
                className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-35 disabled:cursor-not-allowed transition-all shadow-2xs cursor-pointer shrink-0"
                aria-label="Next page"
                title="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
            </div>
          )}
    </main>
  </div>

      {/* ========================================================
          POPUP MODAL: TRANSPARENCY LEDGER SEARCH (SHARED)
         ======================================================== */}
      <SearchModal
        open={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        title={activeTab === "deposits" ? "Search Bank Remittances" : "Search Audited Disbursements"}
        ariaLabel={activeTab === "deposits" ? "Search bank remittances" : "Search audited disbursements"}
        placeholder={activeTab === "deposits" ? "Search source, reference no., particulars..." : "Search project, voucher no., payee, or particulars..."}
        value={tempSearch}
        onChange={setTempSearch}
        onSubmit={() => {
          setSearchQuery(tempSearch.trim());
          setExpensePage(1);
          setDepositPage(1);
          setShowSearchModal(false);
        }}
        onClearActive={
          searchQuery
            ? () => {
                setTempSearch("");
                setSearchQuery("");
                setExpensePage(1);
                setDepositPage(1);
                setShowSearchModal(false);
              }
            : undefined
        }
      />

      {/* ========================================================
          MODAL 1: OFFICIAL DISBURSEMENT VOUCHER & ITEMIZATION SCHEDULE
         ======================================================== */}
      {mounted && selectedReceipt && createPortal(
        <div 
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[100] bg-slate-950/70 dark:bg-black/80 backdrop-blur-md flex items-center justify-center p-2.5 sm:p-4 overscroll-contain select-none"
          style={{
            paddingTop: "max(0.75rem, env(safe-area-inset-top, 0px))",
            paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))",
            paddingLeft: "max(0.75rem, env(safe-area-inset-left, 0px))",
            paddingRight: "max(0.75rem, env(safe-area-inset-right, 0px))",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedReceipt(null);
          }}
          onWheel={(e) => {
            if (e.target === e.currentTarget) e.preventDefault();
          }}
          onTouchMove={(e) => {
            if (e.target === e.currentTarget) e.preventDefault();
          }}
        >
          <div 
            style={{
              maxHeight: "calc(100dvh - 1.5rem - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))",
            }}
            className="bg-white dark:bg-slate-900 rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-200/90 dark:border-slate-800 flex flex-col overflow-hidden overscroll-contain select-text animate-in fade-in zoom-in-95 duration-150 my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header (Frozen title only) */}
            <div className="p-4 sm:px-6 sm:py-4 border-b border-slate-200/80 dark:border-slate-800/90 bg-white dark:bg-slate-900 shrink-0">
              <h3 className="font-sans font-black text-slate-900 dark:text-slate-100 text-base sm:text-lg lg:text-xl leading-snug tracking-tight break-words">
                {selectedReceipt.title}
              </h3>
            </div>

            {/* Modal Body (Scrollable container for description, financial summary & breakdown) */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4 pr-3 sm:pr-5 themed-scrollbar overscroll-contain">

                  {/* Description (scrolls with the rest of the modal) */}
                  {selectedReceipt.description && (
                    <div className="space-y-1">
                      <p
                        ref={descriptionRef}
                        className={`text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-normal break-words ${
                          isDescriptionExpanded ? "" : "line-clamp-3"
                        }`}
                      >
                        {selectedReceipt.description}
                      </p>
                      {isDescriptionClamped && (
                        <button
                          type="button"
                          onClick={() => setIsDescriptionExpanded((prev) => !prev)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-300 transition-colors cursor-pointer"
                        >
                          <span>{isDescriptionExpanded ? "Show less" : "Read more"}</span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* Financial & Metadata Dossier (Hero Hierarchy) */}
                  <div className="bg-slate-50/70 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-800/90 p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* Left: Single Big Amount */}
                    <div className="shrink-0">
                      <span className="text-[10px] sm:text-[10.5px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                        Net Disbursed Amount
                      </span>
                      <p className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-3xl sm:text-4xl tracking-tight mt-0.5">
                        ₱{selectedReceipt.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </p>
                    </div>

                    {/* Right: Small Metadata + View Full Button */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs flex-1 min-w-0 md:pl-5 md:border-l md:border-slate-200/80 dark:md:border-slate-800">
                      {/* Single Column for Date, Voucher, and Payee */}
                      <div className="grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1.5 text-xs text-slate-600 dark:text-slate-400 min-w-0">
                        {/* 1. Disbursement Date */}
                        <span className="text-slate-400 dark:text-slate-500 font-bold text-[10px] sm:text-[10.5px] uppercase tracking-wider whitespace-nowrap">Date:</span>
                        <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{selectedReceipt.date}</span>

                        {/* 2. Voucher No. */}
                        <span className="text-slate-400 dark:text-slate-500 font-bold text-[10px] sm:text-[10.5px] uppercase tracking-wider whitespace-nowrap">Voucher:</span>
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{selectedReceipt.voucher_no || "DV-ON-FILE"}</span>
                          <button
                            type="button"
                            onClick={() => {
                              if (selectedReceipt.voucher_no) {
                                navigator.clipboard.writeText(selectedReceipt.voucher_no);
                                setCopiedVoucher(true);
                                setTimeout(() => setCopiedVoucher(false), 2000);
                              }
                            }}
                            className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors p-0.5 cursor-pointer active:scale-95 shrink-0"
                            title="Copy Voucher Reference Number"
                          >
                            {copiedVoucher ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>

                        {/* 3. Payee / Creditor */}
                        <span className="text-slate-400 dark:text-slate-500 font-bold text-[10px] sm:text-[10.5px] uppercase tracking-wider whitespace-nowrap">Payee:</span>
                        <span className="font-semibold text-slate-900 dark:text-slate-100 break-words leading-snug">{cleanPayeeName(selectedReceipt.payee) || "Barangay Tocok SK"}</span>
                      </div>

                      {/* View Full Button */}
                      {selectedReceipt.receipt_url && (
                        <a
                          href={sanitizeSafeUrl(selectedReceipt.receipt_url)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-brand-700 dark:text-brand-400 text-xs font-semibold border border-slate-300 dark:border-slate-700 shadow-2xs transition-colors shrink-0 self-start sm:self-center cursor-pointer active:scale-95 ml-auto sm:ml-0"
                          title="Open official document scan in a new tab"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>View Full</span>
                        </a>
                      )}
                    </div>
                  </div>


                  {/* Itemized Allocation Breakdown Schedule Table */}
                  {(() => {
                    const modalBreakdown = getExpenseBreakdown(
                      selectedReceipt.voucher_no,
                      selectedReceipt.title,
                      selectedReceipt.amount,
                      selectedReceipt.description,
                      selectedReceipt.line_items
                    );
                    return (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between px-1">
                          <span className="text-[10px] sm:text-[10.5px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                            Itemized Breakdown
                          </span>
                          <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
                            {modalBreakdown.length} {modalBreakdown.length === 1 ? "line item" : "line items"}
                          </span>
                        </div>

                        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
                          {/* Mobile Stacked Layout (< sm) — fits without horizontal scrolling */}
                          <div className="sm:hidden">
                            <div className="divide-y divide-slate-100 dark:divide-slate-800">
                              {modalBreakdown.map((item, idx) => (
                                <div key={idx} className="p-3 flex items-start justify-between gap-3">
                                  <div className="min-w-0 space-y-0.5">
                                    <p className="text-xs font-medium text-slate-900 dark:text-slate-100 leading-snug break-words">
                                      {item.name}
                                    </p>
                                    <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                                      {item.quantity} × ₱{item.unitPrice.toLocaleString("en-US", { minimumFractionDigits: item.unitPrice % 1 === 0 ? 0 : 2 })}
                                    </p>
                                  </div>
                                  <span className="font-mono font-semibold text-slate-900 dark:text-slate-100 text-xs whitespace-nowrap shrink-0 pt-0.5">
                                    ₱{item.total.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                                  </span>
                                </div>
                              ))}
                            </div>
                            <div className="px-3 py-2.5 bg-slate-50/60 dark:bg-slate-800/60 border-t border-slate-200/90 dark:border-slate-800 flex items-center justify-between gap-2">
                              <span className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px]">
                                Total
                              </span>
                              <span className="font-mono font-bold text-slate-900 dark:text-slate-100 text-xs whitespace-nowrap">
                                ₱{selectedReceipt.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          </div>

                          {/* Tablet / Desktop Full Table (>= sm) */}
                          <table className="hidden sm:table w-full text-left border-collapse text-xs">
                            <thead className="bg-slate-50/70 dark:bg-slate-800/60 text-[10.5px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200/80 dark:border-slate-800/90 select-none">
                              <tr>
                                <th className="py-2.5 px-3.5">Item Description</th>
                                <th className="py-2.5 px-3 text-center w-24">Qty</th>
                                <th className="py-2.5 px-3 text-right w-28">Price</th>
                                <th className="py-2.5 px-3.5 text-right w-32">Total</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                              {modalBreakdown.map((item, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                                  <td className="py-2.5 px-3.5 text-slate-900 dark:text-slate-100 font-medium leading-snug break-words">
                                    {item.name}
                                  </td>
                                  <td className="py-2.5 px-3 text-center text-slate-500 dark:text-slate-400 font-mono text-xs whitespace-nowrap">
                                    {item.quantity}
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-mono text-slate-500 dark:text-slate-400 text-xs whitespace-nowrap">
                                    ₱{item.unitPrice.toLocaleString("en-US", { minimumFractionDigits: item.unitPrice % 1 === 0 ? 0 : 2 })}
                                  </td>
                                  <td className="py-2.5 px-3.5 text-right font-mono font-semibold text-slate-900 dark:text-slate-100 text-[13px] whitespace-nowrap">
                                    ₱{item.total.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot className="bg-slate-50/60 dark:bg-slate-800/60 border-t border-slate-200/90 dark:border-slate-800 text-xs">
                              <tr>
                                <td colSpan={3} className="py-2.5 px-3.5 text-right font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px]">
                                  Total
                                </td>
                                <td className="py-2.5 px-3.5 text-right font-mono font-bold text-slate-900 dark:text-slate-100 text-sm whitespace-nowrap">
                                  ₱{selectedReceipt.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>
                    );
                  })()}



            </div>

            {/* Modal Actions Sticky Footer */}
            <div className="px-4 py-3 sm:px-6 bg-slate-50 dark:bg-slate-800/70 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2 text-xs shrink-0">
              {canManage && (
                <button
                  type="button"
                  onClick={() => {
                    const target = selectedReceipt;
                    setSelectedReceipt(null);
                    openEditExpense(target);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 font-bold transition-colors cursor-pointer shadow-xs active:scale-95"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Edit Expense</span>
                </button>
              )}
              <button
                onClick={() => setSelectedReceipt(null)}
                className="px-5 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 font-bold transition-colors cursor-pointer shadow-xs active:scale-95"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================
          MODAL 2: OFFICIAL BANK DEPOSIT SLIP PREVIEW
         ======================================================== */}
      {mounted && selectedDepositSlip && createPortal(
        <div 
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[100] bg-slate-950/70 dark:bg-black/80 backdrop-blur-md flex items-center justify-center p-2.5 sm:p-4 overscroll-contain select-none"
          style={{
            paddingTop: "max(0.75rem, env(safe-area-inset-top, 0px))",
            paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))",
            paddingLeft: "max(0.75rem, env(safe-area-inset-left, 0px))",
            paddingRight: "max(0.75rem, env(safe-area-inset-right, 0px))",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedDepositSlip(null);
          }}
          onWheel={(e) => {
            if (e.target === e.currentTarget) e.preventDefault();
          }}
          onTouchMove={(e) => {
            if (e.target === e.currentTarget) e.preventDefault();
          }}
        >
          <div 
            style={{
              maxHeight: "calc(100dvh - 1.5rem - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))",
            }}
            className="bg-white dark:bg-slate-900 rounded-3xl max-w-3xl w-full shadow-2xl border border-slate-200/90 dark:border-slate-800 flex flex-col overflow-hidden overscroll-contain select-text animate-in fade-in zoom-in-95 duration-150 my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header (Pinned shrink-0) */}
            <div className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-slate-800/90 bg-white dark:bg-slate-900 flex items-start justify-between gap-3 shrink-0">
              <div className="space-y-1 min-w-0 pr-2">
                <span className="text-[10px] sm:text-[10.5px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                  OFFICIAL REMITTANCE / DEPOSIT PARTICULARS:
                </span>
                <h3 className="font-sans font-black text-slate-900 dark:text-slate-100 text-base sm:text-lg lg:text-xl leading-snug tracking-tight">
                  {selectedDepositSlip.source} — {selectedDepositSlip.reference_no}
                </h3>
              </div>

              <button
                onClick={() => setSelectedDepositSlip(null)}
                className="p-1.5 sm:p-2 rounded-xl text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                title="Close Window (Esc)"
                aria-label="Close Window"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body (Middle content area: flex-1 min-h-0 overflow-y-auto) */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4 pr-3 sm:pr-5 themed-scrollbar overscroll-contain">
              {/* Financial Dossier Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                {/* Remitted Amount */}
                <div className="bg-gradient-to-br from-indigo-50/80 dark:from-indigo-950/45 via-white dark:via-slate-900 to-indigo-50/40 dark:to-indigo-950/35 rounded-2xl p-3.5 border border-indigo-200/90 dark:border-indigo-800/70 shadow-2xs flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-indigo-800 dark:text-indigo-300 uppercase tracking-wider block">
                      Remitted Amount
                    </span>
                    <p className="font-mono font-black text-emerald-700 dark:text-emerald-400 text-xl sm:text-2xl tracking-tight leading-none mt-1">
                      ₱{selectedDepositSlip.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold mt-2 pt-2 border-t border-indigo-100 dark:border-indigo-900/60">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>Bank Validated Credit</span>
                  </span>
                </div>

                {/* Reference Number */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-3.5 border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                      Reference No.
                    </span>
                    <p className="font-mono font-bold text-indigo-950 dark:text-indigo-200 text-sm sm:text-base tracking-tight mt-1">
                      {selectedDepositSlip.reference_no}
                    </p>
                  </div>
                  <span className="text-[10.5px] text-slate-500 dark:text-slate-400 font-medium block mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    Official Remittance Code
                  </span>
                </div>

                {/* Remitting Source */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-3.5 border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                      Remitting Agency
                    </span>
                    <p className="font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-sm leading-snug mt-1 break-words">
                      {selectedDepositSlip.source}
                    </p>
                  </div>
                  <span className="text-[10.5px] text-slate-500 dark:text-slate-400 font-medium block mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    Internal Revenue / NTA Share
                  </span>
                </div>

                {/* Validation Date */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-3.5 border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                      Date Validated
                    </span>
                    <p className="font-mono font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-sm leading-snug mt-1">
                      {selectedDepositSlip.date}
                    </p>
                  </div>
                  <span className="text-[10.5px] text-slate-500 dark:text-slate-400 font-medium block mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    Land Bank of the Philippines
                  </span>
                </div>
              </div>

              {/* Particulars Callout */}
              <div className="bg-indigo-50/40 dark:bg-indigo-950/35 rounded-2xl p-4 border-l-4 border-l-indigo-500 border-y border-r border-indigo-200/80 dark:border-indigo-800/70 text-xs space-y-1">
                <span className="text-indigo-900 dark:text-indigo-200 font-bold uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                  <Landmark className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  Mandated Particulars &amp; Legal Basis
                </span>
                <p className="text-slate-800 dark:text-slate-200 font-medium text-xs sm:text-sm leading-relaxed">
                  {selectedDepositSlip.description || "10% Mandated SK Youth Fund remittance under RA 10742 Section 20."}
                </p>
              </div>

              {/* Bank Deposit Slip Vector Preview */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <Landmark className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    Official Bank Deposit Slip / LBP Validation Record
                  </span>
                  {selectedDepositSlip.attachment_url && (
                    <a
                      href={sanitizeSafeUrl(selectedDepositSlip.attachment_url)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-indigo-700 dark:text-indigo-300 hover:text-indigo-900 dark:hover:text-indigo-200 inline-flex items-center gap-1 font-semibold hover:underline"
                    >
                      <span>Open full slip</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/80 dark:bg-slate-800/70 p-2 sm:p-4 flex items-center justify-center min-h-[300px] max-h-[480px] overflow-auto shadow-inner">
                  {selectedDepositSlip.attachment_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={sanitizeSafeUrl(selectedDepositSlip.attachment_url)}
                      alt="Official Bank Deposit Slip"
                      className="w-full max-w-xl h-auto rounded-lg shadow-xs bg-[#ffffff] mx-auto block"
                    />
                  ) : (
                    <div className="text-center py-10 text-slate-400 dark:text-slate-500 text-xs">
                      <FileText className="w-7 h-7 mx-auto mb-1.5 text-slate-300 dark:text-slate-600" />
                      No deposit slip attached
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Actions Footer */}
            <div className="p-4 sm:px-6 bg-slate-50 dark:bg-slate-800/70 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs shrink-0">
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 font-mono text-[11px] sm:text-xs">
                <span className="font-bold text-slate-800 dark:text-slate-200">{selectedDepositSlip.reference_no}</span>
                <span>•</span>
                <span className="font-black text-emerald-700 dark:text-emerald-400">₱{selectedDepositSlip.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                <span>•</span>
                <span>LBP San Fabian</span>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <a
                  href={sanitizeSafeUrl(selectedDepositSlip.attachment_url)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold border border-slate-300 dark:border-slate-700 shadow-2xs transition-colors cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                  <span>Open in New Tab</span>
                </a>

                <button
                  onClick={() => setSelectedDepositSlip(null)}
                  className="px-5 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 font-bold transition-colors cursor-pointer shadow-xs active:scale-95"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* =========================================================================
          FLOATING ACTION BUTTONS (FLOATING SEARCH + ADD/RECORD ACTIONS)
         ========================================================================= */}
      {((canManage && activeTab !== "analytics") || activeTab === "expenses" || activeTab === "deposits") && (
        <div data-page-fab className="fixed bottom-[calc(4.375rem+env(safe-area-inset-bottom,0px))] md:bottom-8 right-4 md:right-8 z-40 flex items-center gap-2 sm:gap-3 pointer-events-auto">
          {/* Floating Search Icon Button (Beside the Add Button) */}
          {(activeTab === "expenses" || activeTab === "deposits") && (
            <button
              type="button"
              onClick={() => {
                setTempSearch(searchQuery);
                setShowSearchModal(true);
              }}
              title={
                searchQuery
                  ? `Searching for "${searchQuery}" (Click to edit)`
                  : activeTab === "deposits"
                  ? "Search Bank Remittances"
                  : "Search Disbursements"
              }
              aria-label={activeTab === "deposits" ? "Search Bank Remittances" : "Search Disbursements"}
              className={`relative w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all duration-150 cursor-pointer group select-none hover:scale-105 active:scale-90 active:brightness-95 shadow-lg ${
                searchQuery
                  ? activeTab === "deposits"
                    ? "bg-indigo-50 dark:bg-indigo-950/80 border-2 border-indigo-500 text-indigo-700 dark:text-indigo-300 shadow-indigo-900/25 ring-2 ring-indigo-400/20 font-bold"
                    : "bg-brand-50 dark:bg-brand-950/80 border-2 border-brand-500 text-brand-700 dark:text-brand-300 shadow-brand-900/25 ring-2 ring-brand-400/20 font-bold"
                  : "bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-700/80 text-slate-700 dark:text-slate-200 shadow-slate-900/15 hover:shadow-xl hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}
            >
              <Search className="w-5 h-5 stroke-[2.2]" />
              {searchQuery && (
                <span
                  className={`absolute top-2 right-2 w-2.5 h-2.5 rounded-full ring-2 ring-white dark:ring-slate-900 ${
                    activeTab === "deposits" ? "bg-indigo-600" : "bg-brand-600"
                  }`}
                  title="Search filter active"
                />
              )}
              <span className="hidden md:group-hover:block absolute bottom-full mb-2.5 right-0 px-2.5 py-1 rounded-lg bg-slate-900 dark:bg-slate-800 dark:border dark:border-slate-700 text-white text-xs font-semibold whitespace-nowrap shadow-md pointer-events-none animate-in fade-in zoom-in-95 duration-150">
                {searchQuery
                  ? `Search: "${searchQuery}"`
                  : activeTab === "deposits"
                  ? "Search Remittances"
                  : "Search Disbursements"}
              </span>
            </button>
          )}

          {/* Floating Add Action Button */}
          {canManage && (
            activeTab === "allocations" ? (
              <button
                type="button"
                onClick={openAddCategory}
                title="Add Expense Category"
                aria-label="Add Expense Category"
                className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-brand-600 hover:bg-brand-700 hover:scale-105 active:scale-90 active:brightness-95 text-white flex items-center justify-center shadow-lg shadow-brand-900/25 hover:shadow-xl hover:shadow-brand-900/35 border border-white/20 dark:border-brand-400/20 transition-all duration-150 cursor-pointer group select-none"
              >
                <Plus className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.5] transition-transform duration-200 group-hover:rotate-90" />
                <span className="hidden md:group-hover:block absolute bottom-full mb-2.5 right-0 px-2.5 py-1 rounded-lg bg-slate-900 dark:bg-slate-800 dark:border dark:border-slate-700 text-white text-xs font-semibold whitespace-nowrap shadow-md pointer-events-none animate-in fade-in zoom-in-95 duration-150">
                  Add Category
                </span>
              </button>
            ) : activeTab === "deposits" ? (
              <button
                type="button"
                onClick={openAddDeposit}
                title="Record Bank Remittance"
                aria-label="Record Bank Remittance"
                className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-indigo-600 hover:bg-indigo-700 hover:scale-105 active:scale-90 active:brightness-95 text-white flex items-center justify-center shadow-lg shadow-indigo-900/25 hover:shadow-xl hover:shadow-indigo-900/35 border border-white/20 dark:border-indigo-400/20 transition-all duration-150 cursor-pointer group select-none"
              >
                <Plus className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.5] transition-transform duration-200 group-hover:rotate-90" />
                <span className="hidden md:group-hover:block absolute bottom-full mb-2.5 right-0 px-2.5 py-1 rounded-lg bg-slate-900 dark:bg-slate-800 dark:border dark:border-slate-700 text-white text-xs font-semibold whitespace-nowrap shadow-md pointer-events-none animate-in fade-in zoom-in-95 duration-150">
                  Record Bank Remittance
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={openAddExpense}
                title="Record Expenditure"
                aria-label="Record Expenditure / Disbursement"
                className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-brand-600 hover:bg-brand-700 hover:scale-105 active:scale-90 active:brightness-95 text-white flex items-center justify-center shadow-lg shadow-brand-900/25 hover:shadow-xl hover:shadow-brand-900/35 border border-white/20 dark:border-brand-400/20 transition-all duration-150 cursor-pointer group select-none"
              >
                <Plus className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.5] transition-transform duration-200 group-hover:rotate-90" />
                <span className="hidden md:group-hover:block absolute bottom-full mb-2.5 right-0 px-2.5 py-1 rounded-lg bg-slate-900 dark:bg-slate-800 dark:border dark:border-slate-700 text-white text-xs font-semibold whitespace-nowrap shadow-md pointer-events-none animate-in fade-in zoom-in-95 duration-150">
                  Record Disbursement
                </span>
              </button>
            )
          )}
        </div>
      )}

      {/* =========================================================================
          ADMIN IN-PLACE MODALS: EXPENSE, DEPOSIT, CATEGORY
         ========================================================================= */}
      <ExpenseModal
        isOpen={showExpenseModal}
        onClose={() => {
          setShowExpenseModal(false);
          setEditingExpense(null);
        }}
        onSuccess={() => {
          fetchExpenses();
          loadCategories();
        }}
        editingExpense={editingExpense}
        categories={availableCategories}
      />

      <DepositModal
        isOpen={showDepositModal}
        onClose={() => {
          setShowDepositModal(false);
          setEditingDeposit(null);
        }}
        onSuccess={() => {
          loadDeposits();
          fetchExpenses();
        }}
        editingDeposit={editingDeposit}
      />

      <CategoryModal
        isOpen={showCategoryModal}
        onClose={() => {
          setShowCategoryModal(false);
          setEditingCategory(null);
        }}
        onSuccess={() => {
          loadCategories();
          fetchExpenses();
        }}
        editingCategory={editingCategory}
      />
    </div>
  );
}

function TransparencyFallback() {
  return (
    <div className="max-w-6xl mx-auto px-2.5 sm:px-6 pt-1.5 sm:pt-4 pb-[calc(8.5rem+env(safe-area-inset-bottom,0px))] md:pb-28 min-h-[calc(100vh+100px)] min-h-[calc(100lvh+100px)] md:min-h-0">
      <div className="flex flex-col md:flex-row gap-4 sm:gap-6 items-start">
        <div className="hidden md:flex flex-col w-14 lg:w-16 h-52 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 animate-pulse shrink-0" />
        <div className="flex-1 min-w-0 w-full space-y-1.5 sm:space-y-4">
          <div className="md:hidden h-9 w-full bg-slate-200/70 dark:bg-slate-800 rounded-xl animate-pulse" />
          <div className="h-[400px] md:h-[545px] w-full bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 animate-pulse" />
        </div>
      </div>
    </div>
  );
}

export default function TransparencyPage() {
  return (
    <Suspense fallback={<TransparencyFallback />}>
      <TransparencyContent />
    </Suspense>
  );
}
