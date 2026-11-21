"use client";

import { useState, useEffect, useMemo, useRef, Fragment } from "react";
import { useRouter } from "next/navigation";
import PrintStatusBadge from "@/components/PrintStatusBadge";
import AvatarCropModal from "@/components/AvatarCropModal";
import CloudDatabaseStatusCard, { type DbStatusData } from "@/components/CloudDatabaseStatusCard";
import GoogleDriveStatusCard, { type GoogleDriveStatusData } from "@/components/GoogleDriveStatusCard";
import VercelBlobStatusCard, { type BlobStatusData } from "@/components/VercelBlobStatusCard";
import AttendanceTracker from "@/components/AttendanceTracker";
import AnonymousCouncilMessages from "@/components/AnonymousCouncilMessages";
import { useAuth, isOfficialRole } from "@/components/AuthProvider";
import { 
  Printer, 
  FileCheck, 
  ClipboardCheck,
  MessageSquareQuote,
  Settings, 
  Users, 
  Lock, 
  Mail, 
  Search, 
  Plus, 
  Download, 
  CheckCircle2, 
  X, 
  AlertCircle,
  Receipt,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Pencil,
  Layers,
  Landmark,
  MapPin,
  Phone,
  Zap,
  SlidersHorizontal,
  Clock,
  Loader2,
  Check,
  ArrowRight,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Inbox,
  Eye,
  EyeOff,
  Copy,
  Filter,
  ChevronDown,
  Save,
  HardDrive,
  Upload,
  Camera,
  KeyRound,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ExternalLink,
  FileText,
  Database
} from "lucide-react";
import { getExpenseBreakdown } from "@/lib/expenseBreakdown";

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  contact_number?: string;
  avatar_url?: string | null;
  auth_provider?: string;
  created_at?: string;
}

interface CategoryItem {
  id: number;
  name: string;
  description: string | null;
  color: string;
  allocated_budget: number;
  total_spent: number;
  expense_count: number;
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

interface PrintJob {
  id: number;
  tracking_code: string;
  student_name: string;
  contact_number: string;
  facebook_name: string;
  purok: string;
  school: string;
  grade_level: string;
  file_name: string;
  file_path: string;
  file_size: number;
  print_type: string;
  paper_size: string;
  copies: number;
  page_range: string;
  notes: string;
  pickup_station?: string;
  is_urgent?: number | boolean;
  status: string;
  admin_notes: string | null;
  created_at: string;
}

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
  created_by: string;
}

function getCategoryBadge(category: string, color?: string) {
  const cat = (category || "").toLowerCase();
  const c = (color || "").toLowerCase();
  if (cat.includes("education") || cat.includes("culture") || c === "blue") {
    return "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/70";
  }
  if (cat.includes("sport") || c === "amber") {
    return "bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/70";
  }
  if (cat.includes("health") || cat.includes("drug") || c === "rose") {
    return "bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/70";
  }
  if (cat.includes("environ") || cat.includes("tree") || c === "emerald") {
    return "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/70";
  }
  if (cat.includes("disaster") || cat.includes("preparedness") || c === "orange") {
    return "bg-orange-50 dark:bg-orange-950/50 text-orange-800 dark:text-orange-300 border-orange-200 dark:border-orange-800/70";
  }
  if (cat.includes("admin") || cat.includes("training") || cat.includes("governance") || c === "indigo") {
    return "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/70";
  }
  if (c === "purple") {
    return "bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/70";
  }
  if (c === "teal") {
    return "bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800/70";
  }
  return "bg-brand-50 dark:bg-brand-950/50 text-brand-700 dark:text-brand-400 border-brand-200 dark:border-brand-800/70";
}

function getCategoryCardTheme(category: string, color?: string) {
  const cat = (category || "").toLowerCase();
  const c = (color || "").toLowerCase();
  if (cat.includes("education") || cat.includes("culture") || c === "blue") {
    return {
      bar: "bg-blue-600",
      track: "bg-blue-100/80 dark:bg-blue-950/70",
    };
  }
  if (cat.includes("sport") || c === "amber") {
    return {
      bar: "bg-amber-500",
      track: "bg-amber-100/80 dark:bg-amber-950/70",
    };
  }
  if (cat.includes("health") || cat.includes("drug") || c === "rose") {
    return {
      bar: "bg-rose-500",
      track: "bg-rose-100/80 dark:bg-rose-950/70",
    };
  }
  if (cat.includes("environ") || cat.includes("tree") || c === "emerald") {
    return {
      bar: "bg-emerald-500",
      track: "bg-emerald-100/80 dark:bg-emerald-950/70",
    };
  }
  if (cat.includes("disaster") || cat.includes("preparedness") || c === "orange") {
    return {
      bar: "bg-orange-500",
      track: "bg-orange-100/80 dark:bg-orange-950/70",
    };
  }
  if (cat.includes("admin") || cat.includes("training") || cat.includes("governance") || c === "indigo") {
    return {
      bar: "bg-indigo-600",
      track: "bg-indigo-100/80 dark:bg-indigo-950/70",
    };
  }
  if (c === "purple") {
    return {
      bar: "bg-purple-600",
      track: "bg-purple-100/80 dark:bg-purple-950/70",
    };
  }
  if (c === "teal") {
    return {
      bar: "bg-teal-600",
      track: "bg-teal-100/80 dark:bg-teal-950/70",
    };
  }
  return {
    bar: "bg-brand-600",
    track: "bg-brand-100/80 dark:bg-brand-950/70",
  };
}

function getCategoryRowStyle(category: string, color?: string) {
  const cat = (category || "").toLowerCase();
  const c = (color || "").toLowerCase();
  if (cat.includes("education") || cat.includes("culture") || c === "blue") {
    return {
      rowBg: "bg-blue-100/75 dark:bg-blue-950/35 hover:bg-blue-100 dark:hover:bg-blue-950/55",
      cardBg: "bg-blue-50/90 dark:bg-blue-950/45 border-blue-200/90 dark:border-blue-800/70 shadow-2xs hover:border-blue-300 dark:hover:border-blue-700",
      dot: "bg-blue-500 ring-2 ring-blue-300 dark:ring-blue-700/60",
    };
  }
  if (cat.includes("sport") || c === "amber") {
    return {
      rowBg: "bg-amber-100/75 dark:bg-amber-950/35 hover:bg-amber-100 dark:hover:bg-amber-950/55",
      cardBg: "bg-amber-50/90 dark:bg-amber-950/45 border-amber-200/90 dark:border-amber-800/70 shadow-2xs hover:border-amber-300 dark:hover:border-amber-700",
      dot: "bg-amber-500 ring-2 ring-amber-300 dark:ring-amber-700/60",
    };
  }
  if (cat.includes("health") || cat.includes("drug") || c === "rose") {
    return {
      rowBg: "bg-rose-100/75 dark:bg-rose-950/35 hover:bg-rose-100 dark:hover:bg-rose-950/55",
      cardBg: "bg-rose-50/90 dark:bg-rose-950/45 border-rose-200/90 dark:border-rose-800/70 shadow-2xs hover:border-rose-300 dark:hover:border-rose-700",
      dot: "bg-rose-500 ring-2 ring-rose-300 dark:ring-rose-700/60",
    };
  }
  if (cat.includes("environ") || cat.includes("tree") || c === "emerald") {
    return {
      rowBg: "bg-emerald-100/75 dark:bg-emerald-950/35 hover:bg-emerald-100 dark:hover:bg-emerald-950/55",
      cardBg: "bg-emerald-50/90 dark:bg-emerald-950/45 border-emerald-200/90 dark:border-emerald-800/70 shadow-2xs hover:border-emerald-300 dark:hover:border-emerald-700",
      dot: "bg-emerald-500 ring-2 ring-emerald-300 dark:ring-emerald-700/60",
    };
  }
  if (cat.includes("disaster") || cat.includes("preparedness") || c === "orange") {
    return {
      rowBg: "bg-orange-100/75 dark:bg-orange-950/35 hover:bg-orange-100 dark:hover:bg-orange-950/55",
      cardBg: "bg-orange-50/90 dark:bg-orange-950/45 border-orange-200/90 dark:border-orange-800/70 shadow-2xs hover:border-orange-300 dark:hover:border-orange-700",
      dot: "bg-orange-500 ring-2 ring-orange-300 dark:ring-orange-700/60",
    };
  }
  if (cat.includes("admin") || cat.includes("training") || cat.includes("governance") || c === "indigo") {
    return {
      rowBg: "bg-indigo-100/75 dark:bg-indigo-950/35 hover:bg-indigo-100 dark:hover:bg-indigo-950/55",
      cardBg: "bg-indigo-50/90 dark:bg-indigo-950/45 border-indigo-200/90 dark:border-indigo-800/70 shadow-2xs hover:border-indigo-300 dark:hover:border-indigo-700",
      dot: "bg-indigo-500 ring-2 ring-indigo-300 dark:ring-indigo-700/60",
    };
  }
  if (c === "purple") {
    return {
      rowBg: "bg-purple-100/75 dark:bg-purple-950/35 hover:bg-purple-100 dark:hover:bg-purple-950/55",
      cardBg: "bg-purple-50/90 dark:bg-purple-950/45 border-purple-200/90 dark:border-purple-800/70 shadow-2xs hover:border-purple-300 dark:hover:border-purple-700",
      dot: "bg-purple-500 ring-2 ring-purple-300 dark:ring-purple-700/60",
    };
  }
  if (c === "teal") {
    return {
      rowBg: "bg-teal-100/75 dark:bg-teal-950/35 hover:bg-teal-100 dark:hover:bg-teal-950/55",
      cardBg: "bg-teal-50/90 dark:bg-teal-950/45 border-teal-200/90 dark:border-teal-800/70 shadow-2xs hover:border-teal-300 dark:hover:border-teal-700",
      dot: "bg-teal-500 ring-2 ring-teal-300 dark:ring-teal-700/60",
    };
  }
  return {
    rowBg: "bg-slate-100/75 dark:bg-slate-800/60 hover:bg-slate-200/80 dark:hover:bg-slate-700/80",
    cardBg: "bg-slate-50 dark:bg-slate-800/70 border-slate-200/90 dark:border-slate-800 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700",
    dot: "bg-slate-400 ring-2 ring-slate-300 dark:ring-slate-700",
  };
}

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

function getPaginationItems(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 5) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  if (current <= 3) {
    return [1, 2, 3, "ellipsis", total];
  }
  if (current >= total - 2) {
    return [1, "ellipsis", total - 2, total - 1, total];
  }
  return [1, "ellipsis", current, "ellipsis", total];
}

export default function AdminDashboardClient() {
  const router = useRouter();
  const {
    user: currentUser,
    authLoading,
    refreshUser,
    logout,
    registerNavigationGuard,
  } = useAuth();
  const isOfficial = isOfficialRole(currentUser?.role);

  // Active Admin Tab: "queue" | "ledgers" | "attendance" | "messages" | "categories" | "settings" | "officials" | "accounts"
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"queue" | "ledgers" | "attendance" | "messages" | "categories" | "settings" | "officials" | "accounts">("queue");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const tabs = [
    { id: 'queue', label: 'Print Queue', shortLabel: 'Queue', icon: Printer },
    { id: 'ledgers', label: 'Audited Ledgers', shortLabel: 'Ledgers', icon: FileCheck },
    { id: 'attendance', label: 'Attendance', shortLabel: 'Attendance', icon: ClipboardCheck },
    { id: 'messages', label: 'Bumo-Boses', shortLabel: 'Bumo-Boses', icon: MessageSquareQuote },
    { id: 'categories', label: 'Categories', shortLabel: 'Categories', icon: Layers },
    { id: 'settings', label: 'Settings', shortLabel: 'Settings', icon: Settings },
    { id: 'officials', label: 'Officials', shortLabel: 'Officials', icon: Users },
    { id: 'accounts', label: 'All Accounts', shortLabel: 'Accounts', icon: Mail },
  ] as const;
  const [activeLedger, setActiveLedger] = useState<"expenses" | "deposits">("expenses");

  // Print Queue State
  const [allJobs, setAllJobs] = useState<PrintJob[]>([]);
  const [jobFilter, setJobFilter] = useState("all");
  const [jobSearch, setJobSearch] = useState("");
  const [showQueueSearchModal, setShowQueueSearchModal] = useState(false);
  const [tempQueueSearch, setTempQueueSearch] = useState("");
  const queueSearchInputRef = useRef<HTMLInputElement>(null);
  const [queueLoading, setQueueLoading] = useState(false);
  const [selectedJob, setSelectedJob] = useState<PrintJob | null>(null);
  const [adminNoteInput, setAdminNoteInput] = useState("");
  const [queuePage, setQueuePage] = useState(1);
  const [mobileQueuePage, setMobileQueuePage] = useState(1);
  const QUEUE_PAGE_SIZE = 4;
  const MOBILE_QUEUE_PAGE_SIZE = 6;

  const openJobModal = (job: PrintJob) => {
    setSelectedJob(job);
    setAdminNoteInput(job.admin_notes || "");
  };

  // Instant in-memory filter: no network latency or loading spinners on filter click
  const jobs = useMemo(() => {
    return allJobs.filter((job) => {
      if (jobFilter !== "all" && job.status !== jobFilter) {
        return false;
      }
      if (jobSearch.trim()) {
        const cleanQ = jobSearch.replace(/^[#\s]+/, "").trim().toLowerCase();
        const tracking = (job.tracking_code || "").toLowerCase();
        const student = (job.student_name || "").toLowerCase();
        const school = (job.school || "").toLowerCase();
        const file = (job.file_name || "").toLowerCase();
        const purok = (job.purok || "").toLowerCase();
        const contact = (job.contact_number || "").toLowerCase();
        return (
          tracking.includes(cleanQ) ||
          student.includes(cleanQ) ||
          school.includes(cleanQ) ||
          file.includes(cleanQ) ||
          purok.includes(cleanQ) ||
          contact.includes(cleanQ)
        );
      }
      return true;
    });
  }, [allJobs, jobFilter, jobSearch]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: allJobs.length,
      "Pending Review": 0,
      "Printing In Progress": 0,
      "Ready for Pickup": 0,
      "Completed": 0,
      "Declined": 0,
      "Cancelled": 0,
    };
    for (const job of allJobs) {
      if (counts[job.status] !== undefined) {
        counts[job.status]++;
      }
    }
    return counts;
  }, [allJobs]);

  // Expenses State
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expensesLoading, setExpensesLoading] = useState(false);
  const [expensePage, setExpensePage] = useState(1);
  const [expenseSearch, setExpenseSearch] = useState("");
  const [selectedExpenseCategory, setSelectedExpenseCategory] = useState<string>("all");
  const [showExpenseSearchModal, setShowExpenseSearchModal] = useState(false);
  const [tempExpenseSearch, setTempExpenseSearch] = useState("");
  const expenseSearchInputRef = useRef<HTMLInputElement>(null);
  const [expenseSort, setExpenseSort] = useState<{ field: "date" | "amount"; order: "asc" | "desc" }>({
    field: "date",
    order: "desc",
  });
  const [selectedExpenseReceipt, setSelectedExpenseReceipt] = useState<Expense | null>(null);
  const [copiedExpenseVoucher, setCopiedExpenseVoucher] = useState(false);
  const [isExpenseDescExpanded, setIsExpenseDescExpanded] = useState(false);
  const [isExpenseDescClamped, setIsExpenseDescClamped] = useState(false);
  const expenseDescRef = useRef<HTMLParagraphElement | null>(null);
  const EXPENSE_PAGE_SIZE = 3;

  const toggleExpenseSort = (field: "date" | "amount") => {
    setExpensePage(1);
    setExpenseSort((prev) => {
      if (prev.field === field) {
        return { field, order: prev.order === "asc" ? "desc" : "asc" };
      }
      return { field, order: "desc" };
    });
  };
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    title: "",
    description: "",
    category: "Education & Culture",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    voucher_no: "",
    payee: "",
  });
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [expenseSubmitting, setExpenseSubmitting] = useState(false);

  // Edit Expense State
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [showEditExpenseModal, setShowEditExpenseModal] = useState(false);
  const [editExpenseForm, setEditExpenseForm] = useState({
    title: "",
    description: "",
    category: "Education & Culture",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    voucher_no: "",
    payee: "",
  });
  const [editReceiptFile, setEditReceiptFile] = useState<File | null>(null);
  const [editExpenseSubmitting, setEditExpenseSubmitting] = useState(false);

  // Deposits State
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [depositsLoading, setDepositsLoading] = useState(false);
  const [depositPage, setDepositPage] = useState(1);
  const [depositSearch, setDepositSearch] = useState("");
  const [showDepositSearchModal, setShowDepositSearchModal] = useState(false);
  const [tempDepositSearch, setTempDepositSearch] = useState("");
  const depositSearchInputRef = useRef<HTMLInputElement>(null);
  const [selectedDepositSlip, setSelectedDepositSlip] = useState<Deposit | null>(null);
  const [depositSort, setDepositSort] = useState<{ field: "date" | "amount"; order: "asc" | "desc" }>({
    field: "date",
    order: "desc",
  });
  const DEPOSIT_PAGE_SIZE = 3;

  const toggleDepositSort = (field: "date" | "amount") => {
    setDepositPage(1);
    setDepositSort((prev) => {
      if (prev.field === field) {
        return { field, order: prev.order === "asc" ? "desc" : "asc" };
      }
      return { field, order: "desc" };
    });
  };
  const [showAddDepositModal, setShowAddDepositModal] = useState(false);
  const [depositForm, setDepositForm] = useState({
    reference_no: "",
    source: "Barangay Tocok Internal Revenue Allotment",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    description: "",
  });
  const [depositAttachmentFile, setDepositAttachmentFile] = useState<File | null>(null);
  const [depositSubmitting, setDepositSubmitting] = useState(false);

  // Edit Deposit State
  const [editingDeposit, setEditingDeposit] = useState<Deposit | null>(null);
  const [showEditDepositModal, setShowEditDepositModal] = useState(false);
  const [editDepositForm, setEditDepositForm] = useState({
    reference_no: "",
    source: "Barangay Tocok Internal Revenue Allotment",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    description: "",
  });
  const [editDepositAttachmentFile, setEditDepositAttachmentFile] = useState<File | null>(null);
  const [editDepositSubmitting, setEditDepositSubmitting] = useState(false);

  // Categories State
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoryPage, setCategoryPage] = useState(1);
  const CATEGORY_PAGE_SIZE = 5;

  const dynamicExpenseCategories = useMemo(() => [
    "all",
    ...Array.from(
      new Set([
        ...categories.map((c) => c.name),
        ...expenses.map((e) => e.category).filter(Boolean),
      ])
    ),
  ], [categories, expenses]);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryItem | null>(null);
  const [categoryForm, setCategoryForm] = useState({
    name: "",
    description: "",
    color: "blue",
    allocated_budget: "0",
  });
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [categorySubmitting, setCategorySubmitting] = useState(false);

  // Student/Guest Accounts Pagination & Search
  const [studentPage, setStudentPage] = useState(1);
  const [mobileStudentPage, setMobileStudentPage] = useState(1);
  const STUDENT_PAGE_SIZE = 5;
  const MOBILE_STUDENT_PAGE_SIZE = 4;
  const [studentSearch, setStudentSearch] = useState("");
  const [tempStudentSearch, setTempStudentSearch] = useState("");
  const [showStudentSearchModal, setShowStudentSearchModal] = useState(false);
  const studentSearchInputRef = useRef<HTMLInputElement>(null);

  const [settings, setSettings] = useState<Record<string, string>>({});
  const [savedSettings, setSavedSettings] = useState<Record<string, string>>({});
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState(false);

  // Cloud Database Monitor State
  const [dbStatus, setDbStatus] = useState<DbStatusData | null>(null);
  const [dbStatusLoading, setDbStatusLoading] = useState(false);
  const [dbStatusError, setDbStatusError] = useState<string | null>(null);

  // Google Drive Primary Cloud Storage Monitor State
  const [driveStatus, setDriveStatus] = useState<GoogleDriveStatusData | null>(null);
  const [driveStatusLoading, setDriveStatusLoading] = useState(false);
  const [driveStatusError, setDriveStatusError] = useState<string | null>(null);

  // Vercel Blob Storage Monitor State
  const [blobStatus, setBlobStatus] = useState<BlobStatusData | null>(null);
  const [blobStatusLoading, setBlobStatusLoading] = useState(false);
  const [blobStatusError, setBlobStatusError] = useState<string | null>(null);
  const [cleaningBlobs, setCleaningBlobs] = useState(false);
  const [cleanupMessage, setCleanupMessage] = useState<string | null>(null);
  const [showUnsavedSettingsModal, setShowUnsavedSettingsModal] = useState(false);
  const [pendingTab, setPendingTab] = useState<"queue" | "ledgers" | "attendance" | "messages" | "categories" | "settings" | "officials" | "accounts" | null>(null);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [pendingLogout, setPendingLogout] = useState(false);

  const hasUnsavedSettings = useMemo(() => {
    if (Object.keys(savedSettings).length === 0) return false;
    const keys = ["barangay_budget", "printing_active"];
    return keys.some((k) => (settings[k] ?? "") !== (savedSettings[k] ?? ""));
  }, [settings, savedSettings]);

  // Warn user before closing or refreshing if there are unsaved settings changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedSettings) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedSettings]);

  // Intercept Header AccountMenu navigation / sign-out while settings have unsaved changes
  useEffect(() => {
    return registerNavigationGuard((action) => {
      if (hasUnsavedSettings) {
        setPendingTab(null);
        if (action.type === "logout") {
          setPendingLogout(true);
          setPendingHref(null);
        } else {
          setPendingHref(action.href);
          setPendingLogout(false);
        }
        setShowUnsavedSettingsModal(true);
        return true;
      }
      return false;
    });
  }, [hasUnsavedSettings, registerNavigationGuard]);

  const handleManualCleanup = async () => {
    setCleaningBlobs(true);
    setCleanupMessage(null);
    try {
      const res = await fetch("/api/cron/cleanup-blobs", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setCleanupMessage(data.message || `Cleaned up ${data.deletedCount || 0} expired files.`);
        loadBlobStatus();
        setTimeout(() => setCleanupMessage(null), 5000);
      } else {
        setCleanupMessage(data.error || "Failed to clean up files.");
      }
    } catch {
      setCleanupMessage("Failed to connect to cleanup service.");
    } finally {
      setCleaningBlobs(false);
    }
  };

  // Officials State
  const [officials, setOfficials] = useState<User[]>([]);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userSaving, setUserSaving] = useState(false);
  const [showUserFormPassword, setShowUserFormPassword] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarUploadError, setAvatarUploadError] = useState<string | null>(null);
  const [pendingCropFile, setPendingCropFile] = useState<File | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [userForm, setUserForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "SK Kagawad",
    contact_number: "",
    avatar_url: "",
  });

  useEffect(() => {
    if (!authLoading && !isOfficial) {
      router.replace("/");
    }
  }, [authLoading, isOfficial, router]);

  useEffect(() => {
    if (isOfficial) {
      loadQueueData();
      loadExpenseData();
      loadDepositsData();
      loadCategoriesData();
      loadSettingsData();
      loadDbStatus();
      loadDriveStatus();
      loadBlobStatus();
      loadOfficialsData();
    }
  }, [currentUser?.id, isOfficial]);

  const loadQueueData = async (silent = false) => {
    try {
      if (!silent && allJobs.length === 0) setQueueLoading(true);
      const res = await fetch("/api/printing/jobs");
      if (res.ok) {
        const data = await res.json();
        setAllJobs(data.jobs || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setQueueLoading(false);
    }
  };

  useEffect(() => {
    setQueuePage(1);
    setMobileQueuePage(1);
  }, [jobFilter, jobSearch]);

  // Periodic silent background sync so the queue stays fresh without flickering
  useEffect(() => {
    if (!isOfficial) return;
    const interval = setInterval(() => {
      loadQueueData(true);
    }, 20000);
    return () => clearInterval(interval);
  }, [isOfficial]);

  // Prevent background page scrolling while any modal is open
  const isAnyModalOpen = Boolean(
    selectedJob ||
    showAddExpenseModal ||
    showEditExpenseModal ||
    showExpenseSearchModal ||
    showQueueSearchModal ||
    showStudentSearchModal ||
    selectedExpenseReceipt ||
    showAddUserModal ||
    showCategoryModal ||
    showAddDepositModal ||
    showEditDepositModal ||
    showDepositSearchModal ||
    selectedDepositSlip ||
    showUnsavedSettingsModal
  );

  // Prevent background page scrolling & shifting while any modal is open on mobile and desktop
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowDepositSearchModal(false);
        setSelectedDepositSlip(null);
        setShowExpenseSearchModal(false);
        setShowQueueSearchModal(false);
        setShowStudentSearchModal(false);
        setSelectedExpenseReceipt(null);
      }
    };

    if (isAnyModalOpen) {
      const scrollY = window.scrollY || window.pageYOffset || 0;
      const originalPosition = document.body.style.position;
      const originalTop = document.body.style.top;
      const originalLeft = document.body.style.left;
      const originalRight = document.body.style.right;
      const originalWidth = document.body.style.width;
      const originalOverflow = document.body.style.overflow;
      const originalHtmlOverflow = document.documentElement.style.overflow;

      document.documentElement.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollY}px`;
      document.body.style.left = "0";
      document.body.style.right = "0";
      document.body.style.width = "100%";

      window.addEventListener("keydown", handleKeyDown);

      return () => {
        document.documentElement.style.overflow = originalHtmlOverflow;
        document.body.style.overflow = originalOverflow;
        document.body.style.position = originalPosition;
        document.body.style.top = originalTop;
        document.body.style.left = originalLeft;
        document.body.style.right = originalRight;
        document.body.style.width = originalWidth;
        window.scrollTo(0, scrollY);
        window.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, [isAnyModalOpen]);

  // Auto-focus search input when search modals open on mobile/desktop without background scroll jumping
  useEffect(() => {
    if (showQueueSearchModal) {
      queueSearchInputRef.current?.focus({ preventScroll: true });
      const timer = setTimeout(() => {
        queueSearchInputRef.current?.focus({ preventScroll: true });
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [showQueueSearchModal]);

  useEffect(() => {
    if (showExpenseSearchModal) {
      expenseSearchInputRef.current?.focus({ preventScroll: true });
      const timer = setTimeout(() => {
        expenseSearchInputRef.current?.focus({ preventScroll: true });
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [showExpenseSearchModal]);

  useEffect(() => {
    if (showDepositSearchModal) {
      depositSearchInputRef.current?.focus({ preventScroll: true });
      const timer = setTimeout(() => {
        depositSearchInputRef.current?.focus({ preventScroll: true });
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [showDepositSearchModal]);

  useEffect(() => {
    if (showStudentSearchModal) {
      studentSearchInputRef.current?.focus({ preventScroll: true });
      const timer = setTimeout(() => {
        studentSearchInputRef.current?.focus({ preventScroll: true });
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [showStudentSearchModal]);

  useEffect(() => {
    setIsExpenseDescExpanded(false);
    setIsExpenseDescClamped(false);
  }, [selectedExpenseReceipt?.id]);

  useEffect(() => {
    if (!selectedExpenseReceipt?.description) {
      setIsExpenseDescClamped(false);
      return;
    }
    const checkClamp = () => {
      const el = expenseDescRef.current;
      if (!el || isExpenseDescExpanded) return;
      setIsExpenseDescClamped(el.scrollHeight > el.clientHeight + 1);
    };
    const frameId = requestAnimationFrame(checkClamp);
    window.addEventListener("resize", checkClamp);
    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", checkClamp);
    };
  }, [selectedExpenseReceipt?.id, selectedExpenseReceipt?.description, isExpenseDescExpanded]);

  const updateJobStatus = async (id: number, status: string, notes?: string) => {
    try {
      // Optimistic instant local update: 0ms UI delay
      setAllJobs((prev) =>
        prev.map((j) => (j.id === id ? { ...j, status, admin_notes: notes !== undefined ? notes : j.admin_notes } : j))
      );
      if (selectedJob && selectedJob.id === id) {
        setSelectedJob((prev) => (prev ? { ...prev, status, admin_notes: notes !== undefined ? notes : prev.admin_notes } : null));
      }

      const res = await fetch("/api/printing/jobs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status, admin_notes: notes }),
      });
      if (res.ok) {
        loadQueueData(true);
      }
    } catch (err) {
      console.error(err);
      loadQueueData(true);
    }
  };

  const loadExpenseData = async () => {
    try {
      setExpensesLoading(true);
      const res = await fetch("/api/expenses");
      if (res.ok) {
        const data = await res.json();
        setExpenses(data.expenses);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setExpensesLoading(false);
    }
  };

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setExpenseSubmitting(true);
      const formData = new FormData();
      Object.entries(expenseForm).forEach(([k, v]) => formData.append(k, v));
      if (receiptFile) formData.append("receipt_file", receiptFile);

      const res = await fetch("/api/expenses", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        setShowAddExpenseModal(false);
        setExpenseForm({
          title: "",
          description: "",
          category: "Education & Culture",
          amount: "",
          date: new Date().toISOString().split("T")[0],
          voucher_no: "",
          payee: "",
        });
        setReceiptFile(null);
        setExpensePage(1);
        loadExpenseData();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to record expense");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setExpenseSubmitting(false);
    }
  };

  const handleDeleteExpense = async (id: number) => {
    if (!confirm("Are you sure you want to delete this expense record?")) return;
    try {
      const res = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
      if (res.ok) {
        loadExpenseData();
        loadCategoriesData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const openEditExpenseModal = (exp: Expense) => {
    setEditingExpense(exp);
    setEditExpenseForm({
      title: exp.title,
      description: exp.description || "",
      category: exp.category,
      amount: String(exp.amount),
      date: exp.date,
      voucher_no: exp.voucher_no || "",
      payee: exp.payee || "",
    });
    setEditReceiptFile(null);
    setShowEditExpenseModal(true);
  };

  const handleEditExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExpense) return;
    try {
      setEditExpenseSubmitting(true);
      const formData = new FormData();
      formData.append("title", editExpenseForm.title);
      formData.append("description", editExpenseForm.description);
      formData.append("category", editExpenseForm.category);
      formData.append("amount", editExpenseForm.amount);
      formData.append("date", editExpenseForm.date);
      formData.append("voucher_no", editExpenseForm.voucher_no);
      formData.append("payee", editExpenseForm.payee);
      if (editReceiptFile) {
        formData.append("receipt", editReceiptFile);
      }

      const res = await fetch(`/api/expenses/${editingExpense.id}`, {
        method: "PUT",
        body: formData,
      });

      if (res.ok) {
        setShowEditExpenseModal(false);
        setEditingExpense(null);
        setEditReceiptFile(null);
        loadExpenseData();
        loadCategoriesData();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to update expense");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setEditExpenseSubmitting(false);
    }
  };

  // Deposits API functions
  const loadDepositsData = async () => {
    try {
      setDepositsLoading(true);
      const res = await fetch("/api/deposits");
      if (res.ok) {
        const data = await res.json();
        setDeposits(data.deposits || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDepositsLoading(false);
    }
  };

  const handleCreateDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setDepositSubmitting(true);
      const formData = new FormData();
      formData.append("reference_no", depositForm.reference_no);
      formData.append("source", depositForm.source);
      formData.append("amount", depositForm.amount);
      formData.append("date", depositForm.date);
      formData.append("description", depositForm.description);
      if (depositAttachmentFile) {
        formData.append("attachment_file", depositAttachmentFile);
      }

      const res = await fetch("/api/deposits", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        setShowAddDepositModal(false);
        setDepositForm({
          reference_no: "",
          source: "Barangay Tocok Internal Revenue Allotment",
          amount: "",
          date: new Date().toISOString().split("T")[0],
          description: "",
        });
        setDepositAttachmentFile(null);
        setDepositPage(1);
        loadDepositsData();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to record deposit");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDepositSubmitting(false);
    }
  };

  const openAddDepositModal = () => {
    setDepositForm({
      reference_no: `DEP-${new Date().getFullYear()}-${String(deposits.length + 1).padStart(2, '0')}-${Math.floor(100 + Math.random() * 900)}`,
      source: "Barangay Tocok Internal Revenue Allotment",
      amount: "",
      date: new Date().toISOString().split("T")[0],
      description: "",
    });
    setDepositAttachmentFile(null);
    setShowAddDepositModal(true);
  };

  const openEditDepositModal = (dep: Deposit) => {
    setEditingDeposit(dep);
    setEditDepositForm({
      reference_no: dep.reference_no,
      source: dep.source,
      amount: String(dep.amount),
      date: dep.date,
      description: dep.description || "",
    });
    setEditDepositAttachmentFile(null);
    setShowEditDepositModal(true);
  };

  const handleEditDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDeposit) return;
    try {
      setEditDepositSubmitting(true);
      const formData = new FormData();
      formData.append("reference_no", editDepositForm.reference_no);
      formData.append("source", editDepositForm.source);
      formData.append("amount", editDepositForm.amount);
      formData.append("date", editDepositForm.date);
      formData.append("description", editDepositForm.description);
      if (editDepositAttachmentFile) {
        formData.append("attachment_file", editDepositAttachmentFile);
      }

      const res = await fetch(`/api/deposits/${editingDeposit.id}`, {
        method: "PUT",
        body: formData,
      });

      if (res.ok) {
        setShowEditDepositModal(false);
        setEditingDeposit(null);
        setEditDepositAttachmentFile(null);
        loadDepositsData();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to update deposit");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setEditDepositSubmitting(false);
    }
  };

  const handleDeleteDeposit = async (id: number) => {
    if (!confirm("Are you sure you want to delete this bank remittance record?")) return;
    try {
      const res = await fetch(`/api/deposits/${id}`, { method: "DELETE" });
      if (res.ok) {
        loadDepositsData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Categories API functions
  const loadCategoriesData = async () => {
    try {
      setCategoriesLoading(true);
      const res = await fetch("/api/categories");
      if (res.ok) {
        const data = await res.json();
        setCategories(data.categories || []);
        if (data.categories?.length > 0 && !expenseForm.category) {
          setExpenseForm((prev) => ({ ...prev, category: data.categories[0].name }));
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCategoriesLoading(false);
    }
  };

  const openAddCategoryModal = () => {
    setEditingCategory(null);
    setCategoryForm({ name: "", description: "", color: "blue", allocated_budget: "0" });
    setCategoryError(null);
    setShowCategoryModal(true);
  };

  const openEditCategoryModal = (cat: CategoryItem) => {
    setEditingCategory(cat);
    setCategoryForm({
      name: cat.name,
      description: cat.description || "",
      color: cat.color || "blue",
      allocated_budget: String(cat.allocated_budget || 0),
    });
    setCategoryError(null);
    setShowCategoryModal(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setCategorySubmitting(true);
      setCategoryError(null);
      const method = editingCategory ? "PUT" : "POST";
      const payload = editingCategory
        ? { id: editingCategory.id, ...categoryForm }
        : categoryForm;

      const res = await fetch("/api/categories", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save category");
      }

      setShowCategoryModal(false);
      setEditingCategory(null);
      setCategoryForm({ name: "", description: "", color: "blue", allocated_budget: "0" });
      loadCategoriesData();
      loadExpenseData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error saving category";
      setCategoryError(msg);
    } finally {
      setCategorySubmitting(false);
    }
  };

  const handleDeleteCategory = async (id: number, name: string) => {
    if (!confirm(`Are you sure you want to delete category "${name}"?`)) return;
    try {
      const res = await fetch(`/api/categories?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to delete category");
        return;
      }
      loadCategoriesData();
    } catch (err) {
      console.error(err);
      alert("Error deleting category");
    }
  };

  const loadSettingsData = async () => {
    try {
      const res = await fetch("/api/admin/settings");
      if (res.ok) {
        const data = await res.json();
        const loaded: Record<string, string> = {
          barangay_budget: "7000000",
          printing_active: "true",
          ...(data.settings || {}),
        };
        setSettings(loaded);
        setSavedSettings(loaded);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadDbStatus = async () => {
    try {
      setDbStatusLoading(true);
      setDbStatusError(null);
      const res = await fetch("/api/admin/db-status", { cache: "no-store" });
      const data = await res.json();
      if (res.ok && data.success) {
        setDbStatus(data);
      } else {
        setDbStatus(data);
        setDbStatusError(data.error || "Unable to fetch cloud database status.");
      }
    } catch (err) {
      console.error("DB status fetch error:", err);
      setDbStatusError("Network error while checking cloud database status.");
    } finally {
      setDbStatusLoading(false);
    }
  };

  const loadDriveStatus = async () => {
    try {
      setDriveStatusLoading(true);
      setDriveStatusError(null);
      const res = await fetch("/api/admin/drive-status", { cache: "no-store" });
      const data = await res.json();
      if (res.ok && data.success) {
        setDriveStatus(data);
      } else {
        setDriveStatus(data);
        setDriveStatusError(data.error || "Unable to fetch Google Drive status.");
      }
    } catch (err) {
      console.error("Drive status fetch error:", err);
      setDriveStatusError("Network error while checking Google Drive status.");
    } finally {
      setDriveStatusLoading(false);
    }
  };

  const loadBlobStatus = async () => {
    try {
      setBlobStatusLoading(true);
      setBlobStatusError(null);
      const res = await fetch("/api/admin/blob-status", { cache: "no-store" });
      const data = await res.json();
      if (res.ok && data.success) {
        setBlobStatus(data);
      } else {
        setBlobStatus(data);
        setBlobStatusError(data.error || "Unable to fetch Vercel Blob status.");
      }
    } catch (err) {
      console.error("Blob status fetch error:", err);
      setBlobStatusError("Network error while checking Vercel Blob status.");
    } finally {
      setBlobStatusLoading(false);
    }
  };

  const saveSettingsPayload = async (payload: Record<string, string>) => {
    try {
      setSettingsSaving(true);
      setSettingsSuccess(false);
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setSavedSettings({ ...payload });
        setSettingsSuccess(true);
        setTimeout(() => setSettingsSuccess(false), 2500);
      }
    } catch (err) {
      console.error("Save settings error:", err);
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleSaveSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    await saveSettingsPayload(settings);
  };

  const loadOfficialsData = async () => {
    try {
      const res = await fetch("/api/admin/users");
      if (res.ok) {
        const data = await res.json();
        setOfficials(data.users);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const openAddUserModal = (defaultRole: string = "SK Kagawad") => {
    setEditingUser(null);
    setUserForm({
      name: "",
      email: "",
      password: "",
      role: defaultRole,
      contact_number: "",
      avatar_url: "",
    });
    setShowUserFormPassword(false);
    setAvatarUploadError(null);
    setAvatarUploading(false);
    setPendingCropFile(null);
    setShowAddUserModal(true);
  };

  const openEditUserModal = (user: User) => {
    setEditingUser(user);
    setUserForm({
      name: user.name,
      email: user.email,
      password: "",
      role: user.role,
      contact_number: user.contact_number || "",
      avatar_url: user.avatar_url || "",
    });
    setShowUserFormPassword(false);
    setAvatarUploadError(null);
    setAvatarUploading(false);
    setPendingCropFile(null);
    setShowAddUserModal(true);
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setAvatarUploadError("Please select a valid image file (PNG, JPG, WEBP, or GIF).");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setAvatarUploadError("Image size exceeds 10MB limit.");
      return;
    }

    setAvatarUploadError(null);
    setPendingCropFile(file);
  };

  const handleApplyCroppedAvatar = async (croppedFile: File) => {
    setAvatarUploading(true);
    setAvatarUploadError(null);

    try {
      const formData = new FormData();
      formData.append("file", croppedFile);

      const res = await fetch("/api/admin/upload-avatar", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.url) {
        setUserForm((prev) => ({ ...prev, avatar_url: data.url }));
        setPendingCropFile(null);
      } else {
        setAvatarUploadError(data.error || "Failed to upload image.");
      }
    } catch (err) {
      console.error("Avatar upload failed:", err);
      setAvatarUploadError("Network error while uploading picture.");
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userForm.password || userForm.password.trim().length < 6) {
      alert("Password is required and must be at least 6 characters.");
      return;
    }
    setUserSaving(true);
    try {
      if (editingUser) {
        const res = await fetch("/api/admin/users", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingUser.id,
            name: userForm.name,
            email: userForm.email,
            role: userForm.role,
            contact_number: userForm.contact_number,
            avatar_url: userForm.avatar_url,
            password: userForm.password.trim(),
          }),
        });
        if (res.ok) {
          const editedOwnAccount = currentUser && editingUser.id === currentUser.id;
          setShowAddUserModal(false);
          setEditingUser(null);
          loadOfficialsData();
          if (editedOwnAccount) {
            refreshUser();
          }
        } else {
          const err = await res.json();
          alert(err.error || "Failed to update official account");
        }
      } else {
        const res = await fetch("/api/admin/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(userForm),
        });
        if (res.ok) {
          setShowAddUserModal(false);
          setUserForm({
            name: "",
            email: "",
            password: "",
            role: "SK Kagawad",
            contact_number: "",
            avatar_url: "",
          });
          loadOfficialsData();
        } else {
          const err = await res.json();
          alert(err.error || "Failed to create user");
        }
      }
    } catch (err) {
      console.error(err);
      alert("Failed to save official account");
    } finally {
      setUserSaving(false);
    }
  };

  const handleDeleteUser = async (id: number, name: string) => {
    if (!window.confirm(`Are you sure you want to delete the official account for "${name}"?`)) {
      return;
    }
    try {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        loadOfficialsData();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to delete official account");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to delete official account");
    }
  };

  if (authLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-6 min-h-[120vh]">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="space-y-2">
            <div className="h-8 w-64 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse" />
            <div className="h-4 w-96 max-w-full bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
          </div>
          <div className="h-9 w-28 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
        </div>
        <div className="h-12 w-full max-w-xl bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4 shadow-xs">
          <div className="h-6 w-48 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
          <div className="space-y-3">
            <div className="h-10 w-full bg-slate-50 dark:bg-slate-800/70 rounded-lg animate-pulse" />
            <div className="h-10 w-full bg-slate-50 dark:bg-slate-800/70 rounded-lg animate-pulse" />
            <div className="h-10 w-full bg-slate-50 dark:bg-slate-800/70 rounded-lg animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  // Redirect silently if session is missing or not an SK Official (no login form or notice shown)
  if (!isOfficial) {
    return null;
  }

  const resetTabScroll = () => {
    if (typeof window === "undefined") return;
    const collapseDist = window.innerWidth >= 768 ? 196 : 178;
    const isCollapsed =
      sessionStorage.getItem("sk_header_collapsed") === "1" ||
      window.scrollY >= collapseDist * 0.51;
    const targetY = isCollapsed ? collapseDist : 0;
    try {
      sessionStorage.setItem("sk_header_collapsed", isCollapsed ? "1" : "0");
    } catch {}
    if (Math.abs(window.scrollY - targetY) > 4) {
      window.scrollTo({ top: targetY, behavior: "instant" });
    }
  };

  const switchTab = (tabId: "queue" | "ledgers" | "attendance" | "messages" | "categories" | "settings" | "officials" | "accounts") => {
    if (activeTab === "settings" && tabId !== "settings" && hasUnsavedSettings) {
      setPendingTab(tabId);
      setPendingHref(null);
      setPendingLogout(false);
      setShowUnsavedSettingsModal(true);
      return;
    }
    setActiveTab(tabId);
    resetTabScroll();
    if (tabId === "settings") {
      loadDbStatus();
      loadDriveStatus();
      loadBlobStatus();
    }
  };

  // Logged-in Admin Dashboard
  return (
    <>
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pt-2.5 sm:pt-4 pb-24 md:pb-16 w-full">
      {/* Mobile Module Navigation (md:hidden) */}
      <div className="md:hidden mb-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-xs">
        <div className="bg-slate-50/80 dark:bg-slate-800/70 p-1.5 flex flex-row items-center justify-between gap-1.5">
          <div className="flex items-center gap-2 min-w-0">
            <div className="relative shrink-0" ref={menuRef}>
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="w-9 h-9 rounded-lg text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all flex items-center justify-center cursor-pointer shrink-0"
                aria-label="Toggle Menu"
              >
                <div className="flex flex-col gap-1">
                  <div className="w-4 h-0.5 bg-slate-800 dark:bg-slate-200"></div>
                  <div className="w-4 h-0.5 bg-slate-800 dark:bg-slate-200"></div>
                  <div className="w-4 h-0.5 bg-slate-800 dark:bg-slate-200"></div>
                </div>
              </button>
              <div className={`absolute left-0 top-full mt-1 w-48 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-xl z-[60] p-1 transition-all duration-200 ease-in-out ${isMenuOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}`}>
                {tabs.map((tab) => {
                  const isActive = activeTab === tab.id;
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => { switchTab(tab.id); setIsMenuOpen(false); }}
                      className={`flex items-center gap-2 w-full p-2 rounded-md text-xs font-semibold transition-colors ${
                        isActive
                          ? 'bg-brand-600 text-white'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {tab.shortLabel}
                    </button>
                  );
                })}
              </div>
            </div>
            <span className="font-bold text-slate-800 dark:text-slate-200 text-sm whitespace-nowrap truncate">
              {tabs.find(t => t.id === activeTab)?.label}
            </span>
          </div>

          {/* Action Controls in Mobile Header (Ledgers tab: Filter + Tab Switcher + Search) */}
          {activeTab === "ledgers" && (
            <div className="flex items-center gap-1.5 shrink-0 ml-auto">
              {/* Category Filter Button */}
              {activeLedger === "expenses" && (
                <div className="relative inline-flex items-center">
                  <div
                    className={`w-9 h-9 rounded-xl border flex items-center justify-center transition cursor-pointer shadow-2xs ${
                      selectedExpenseCategory !== "all"
                        ? "border-brand-500 bg-brand-50 dark:bg-brand-950/50 text-brand-700 dark:text-brand-400 font-bold"
                        : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
                    }`}
                    title={selectedExpenseCategory !== "all" ? `Category: ${selectedExpenseCategory}` : "Filter by category"}
                    aria-label="Filter by category"
                  >
                    <Filter className="w-4 h-4" />
                  </div>
                  <select
                    value={selectedExpenseCategory}
                    onChange={(e) => {
                      setSelectedExpenseCategory(e.target.value);
                      setExpensePage(1);
                    }}
                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer text-xs font-semibold"
                    title="Filter by category"
                    aria-label="Filter by category"
                  >
                    <option value="all">All Categories ({expenses.length})</option>
                    {dynamicExpenseCategories
                      .filter((cat) => cat !== "all")
                      .map((cat) => {
                        const count = expenses.filter((e) => e.category === cat).length;
                        return (
                          <option key={cat} value={cat}>
                            {cat} {count > 0 ? `(${count})` : ""}
                          </option>
                        );
                      })}
                  </select>
                </div>
              )}

              {/* Disbursements & Remittances Switcher */}
              <div className="inline-flex p-0.5 bg-slate-200/70 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setActiveLedger("expenses");
                    setExpensePage(1);
                  }}
                  title={`Disbursements (Expenses) • ${expenses.length} records`}
                  aria-label="Disbursements (Expenses)"
                  className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all cursor-pointer ${
                    activeLedger === "expenses"
                      ? "bg-white dark:bg-slate-900 text-brand-900 dark:text-brand-200 shadow-2xs border border-slate-200/70 dark:border-slate-800/80"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                  }`}
                >
                  <FileCheck className={`w-4 h-4 ${activeLedger === "expenses" ? "text-brand-600 dark:text-brand-400" : "text-slate-400 dark:text-slate-500"}`} />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveLedger("deposits");
                    setDepositPage(1);
                  }}
                  title={`Bank Remittances (Deposits) • ${deposits.length} records`}
                  aria-label="Bank Remittances (Deposits)"
                  className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all cursor-pointer ${
                    activeLedger === "deposits"
                      ? "bg-white dark:bg-slate-900 text-indigo-950 dark:text-indigo-200 shadow-2xs border border-slate-200/70 dark:border-slate-800/80"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                  }`}
                >
                  <Landmark className={`w-4 h-4 ${activeLedger === "deposits" ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400 dark:text-slate-500"}`} />
                </button>
              </div>

              {/* Search Button */}
              <button
                type="button"
                onClick={() => {
                  if (activeLedger === "expenses") {
                    setTempExpenseSearch(expenseSearch);
                    setShowExpenseSearchModal(true);
                  } else {
                    setTempDepositSearch(depositSearch);
                    setShowDepositSearchModal(true);
                  }
                }}
                className={`w-9 h-9 rounded-xl border flex items-center justify-center transition cursor-pointer shadow-2xs active:scale-95 ${
                  (activeLedger === "expenses" ? expenseSearch : depositSearch)
                    ? activeLedger === "expenses"
                      ? "border-brand-300 dark:border-brand-700/80 bg-brand-50 dark:bg-brand-950/50 text-brand-700 dark:text-brand-400 font-bold"
                      : "border-indigo-300 dark:border-indigo-700/80 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-bold"
                    : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
                }`}
                title={
                  (activeLedger === "expenses" ? expenseSearch : depositSearch)
                    ? `Searching for "${activeLedger === "expenses" ? expenseSearch : depositSearch}"`
                    : activeLedger === "expenses"
                      ? "Search transactions"
                      : "Search remittances"
                }
                aria-label="Search"
              >
                <Search className="w-4 h-4" />
              </button>

              {/* Active Search Term Clear indicator */}
              {(activeLedger === "expenses" ? expenseSearch : depositSearch) && (
                <button
                  type="button"
                  onClick={() => {
                    if (activeLedger === "expenses") {
                      setExpenseSearch("");
                      setTempExpenseSearch("");
                      setExpensePage(1);
                    } else {
                      setDepositSearch("");
                      setTempDepositSearch("");
                      setDepositPage(1);
                    }
                  }}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium transition cursor-pointer"
                  title="Clear search filter"
                >
                  <span className="max-w-[50px] truncate">&ldquo;{activeLedger === "expenses" ? expenseSearch : depositSearch}&rdquo;</span>
                  <X className="w-2.5 h-2.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200" />
                </button>
              )}
            </div>
          )}

          {/* Action Controls in Mobile Header (Print Queue tab: Status Filter + Search) */}
          {activeTab === "queue" && (
            <div className="flex items-center gap-1.5 shrink-0 ml-auto">
              {/* Status Filter Button */}
              <div className="relative inline-flex items-center">
                <div
                  className={`w-9 h-9 rounded-xl border flex items-center justify-center transition cursor-pointer shadow-2xs ${
                    jobFilter !== "all"
                      ? "border-brand-500 bg-brand-50 dark:bg-brand-950/50 text-brand-700 dark:text-brand-400 font-bold"
                      : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
                  }`}
                  title={jobFilter !== "all" ? `Status: ${jobFilter}` : "Filter requests by status"}
                  aria-label="Filter requests by status"
                >
                  <Filter className={`w-4 h-4 ${jobFilter !== "all" ? "fill-brand-600 dark:fill-brand-400" : ""}`} />
                </div>
                <select
                  value={jobFilter}
                  onChange={(e) => setJobFilter(e.target.value)}
                  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer text-xs font-semibold"
                  title="Filter requests by status"
                  aria-label="Filter requests by status"
                >
                  <option value="all">All Statuses ({allJobs.length})</option>
                  <option value="Pending Review">Pending Review ({statusCounts["Pending Review"]})</option>
                  <option value="Printing In Progress">Printing In Progress ({statusCounts["Printing In Progress"]})</option>
                  <option value="Ready for Pickup">Ready for Pickup ({statusCounts["Ready for Pickup"]})</option>
                  <option value="Completed">Completed / Claimed ({statusCounts["Completed"]})</option>
                  <option value="Declined">Declined ({statusCounts["Declined"]})</option>
                  <option value="Cancelled">Cancelled ({statusCounts["Cancelled"] || 0})</option>
                </select>
              </div>

              {/* Search Button */}
              <button
                type="button"
                onClick={() => {
                  setTempQueueSearch(jobSearch);
                  setShowQueueSearchModal(true);
                }}
                className={`w-9 h-9 rounded-xl border flex items-center justify-center transition cursor-pointer shadow-2xs active:scale-95 ${
                  jobSearch
                    ? "border-brand-300 dark:border-brand-700/80 bg-brand-50 dark:bg-brand-950/50 text-brand-700 dark:text-brand-400 font-bold"
                    : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
                }`}
                title={jobSearch ? `Searching: "${jobSearch}"` : "Search print requests"}
                aria-label="Search print requests"
              >
                <Search className="w-4 h-4" />
              </button>

              {/* Active Filter Clear Tag */}
              {jobFilter !== "all" && (
                <button
                  type="button"
                  onClick={() => setJobFilter("all")}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-brand-50 dark:bg-brand-950/50 border border-brand-200 dark:border-brand-800 text-brand-700 dark:text-brand-300 text-xs font-bold transition cursor-pointer"
                  title="Reset filter to all"
                >
                  <span className="max-w-[70px] truncate">
                    {jobFilter === "Pending Review"
                      ? "Pending"
                      : jobFilter === "Printing In Progress"
                      ? "Printing"
                      : jobFilter === "Ready for Pickup"
                      ? "Ready"
                      : jobFilter === "Completed"
                      ? "Claimed"
                      : jobFilter}
                  </span>
                  <X className="w-3 h-3" />
                </button>
              )}

              {/* Active Search Term Clear indicator */}
              {jobSearch && (
                <button
                  type="button"
                  onClick={() => {
                    setJobSearch("");
                    setTempQueueSearch("");
                  }}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium transition cursor-pointer"
                  title="Clear search query"
                >
                  <span className="max-w-[55px] truncate">&ldquo;{jobSearch}&rdquo;</span>
                  <X className="w-3 h-3 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Desktop 2-Column Layout: Left Navigation Sidebar + Main Content Area */}
      <div className="flex flex-col md:flex-row gap-4 sm:gap-6 items-start min-h-[calc(100vh-140px)]">
        {/* Left Navigation Icon Rail (Desktop view: Just Icons) */}
        <aside
          className="hidden md:flex flex-col w-14 lg:w-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-1.5 shadow-xs shrink-0 sticky z-40 items-center gap-1.5"
          style={{ top: "132px" }}
        >
          {(
            [
              { id: 'queue', label: 'Student Printing Queue', icon: Printer },
              { id: 'ledgers', label: 'Audited Transparency Ledgers', icon: FileCheck },
              { id: 'attendance', label: 'SK Officials Attendance', icon: ClipboardCheck },
              { id: 'categories', label: 'Budget Categories', icon: Layers },
              { id: 'settings', label: 'Program Settings', icon: Settings },
              { id: 'officials', label: 'Official Accounts', icon: Users },
              { id: 'accounts', label: 'All Registered Accounts', icon: Mail },
            ] as const
          ).map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => switchTab(tab.id)}
                title={tab.label}
                aria-label={tab.label}
                className={`relative w-11 h-11 flex items-center justify-center rounded-xl transition-all cursor-pointer ${
                  isActive
                    ? 'bg-brand-600 text-white shadow-xs font-bold scale-102'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="w-5 h-5" />
                {tab.id === 'settings' && hasUnsavedSettings && (
                  <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-amber-500 rounded-full ring-2 ring-white dark:ring-slate-900 animate-pulse" title="Unsaved changes" />
                )}
              </button>
            );
          })}
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 min-w-0 w-full flex flex-col gap-4 sm:gap-6">

      {/* Automatic High-Usage Cloud Database Alert Banner (only shown if >= 70% full or offline) */}
      {activeTab !== "settings" && dbStatus && (dbStatus.status === "offline" || dbStatus.statusLevel === "warning" || dbStatus.statusLevel === "critical") && (
        <div
          className={`rounded-2xl border p-3.5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            dbStatus.status === "offline" || dbStatus.statusLevel === "critical"
              ? "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/70 text-rose-800 dark:text-rose-200"
              : "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/70 text-amber-900 dark:text-amber-200"
          }`}
        >
          <div className="flex items-center gap-2.5 text-xs">
            <Database className="w-4 h-4 shrink-0" />
            <span>
              {dbStatus.status === "offline" ? (
                <strong>Cloud Database connection issue detected.</strong>
              ) : (
                <>
                  <strong>Cloud Database is {dbStatus.storage?.usagePercent.toFixed(1)}% full</strong> — approaching the {dbStatus.plan?.storageLimitLabel || "1 GB"} free tier cap.
                </>
              )}
            </span>
          </div>
          <button
            type="button"
            onClick={() => switchTab("settings")}
            className="px-3 py-1.5 rounded-xl bg-white/90 dark:bg-slate-900/80 border border-current/20 text-[11px] font-bold hover:opacity-90 transition-opacity cursor-pointer shrink-0 self-start sm:self-auto"
          >
            View Database Status
          </button>
        </div>
      )}

      {/* TAB: SK OFFICIALS ATTENDANCE */}
      {activeTab === "attendance" && (
        <AttendanceTracker mode="admin" />
      )}

      {/* TAB: FREEDOM WALL & ANONYMOUS INBOX */}
      {activeTab === "messages" && (
        <AnonymousCouncilMessages mode="admin" />
      )}

      {/* TAB 1: PRINT QUEUE CONTENT */}
      {activeTab === "queue" && (() => {
        // Desktop pagination: exactly 4 tickets at a time
        const totalQueuePages = Math.max(1, Math.ceil(jobs.length / QUEUE_PAGE_SIZE));
        const paginatedJobs = jobs.slice((queuePage - 1) * QUEUE_PAGE_SIZE, queuePage * QUEUE_PAGE_SIZE);
        const startQueueIndex = jobs.length === 0 ? 0 : (queuePage - 1) * QUEUE_PAGE_SIZE + 1;
        const endQueueIndex = Math.min(queuePage * QUEUE_PAGE_SIZE, jobs.length);

        // Mobile pagination: exactly 6 tickets at a time
        const totalMobileQueuePages = Math.max(1, Math.ceil(jobs.length / MOBILE_QUEUE_PAGE_SIZE));
        const paginatedMobileJobs = jobs.slice((mobileQueuePage - 1) * MOBILE_QUEUE_PAGE_SIZE, mobileQueuePage * MOBILE_QUEUE_PAGE_SIZE);
        const startMobileQueueIndex = jobs.length === 0 ? 0 : (mobileQueuePage - 1) * MOBILE_QUEUE_PAGE_SIZE + 1;
        const endMobileQueueIndex = Math.min(mobileQueuePage * MOBILE_QUEUE_PAGE_SIZE, jobs.length);

        return (
          <>

            {/* Mobile Queue Card: Fixed Height & Unified Layout (md:hidden) */}
            <div className="md:hidden bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden flex flex-col min-h-[444px]">
              {/* 6 Request Slots (flex-1) */}
              <div className="divide-y divide-slate-100 dark:divide-slate-800 flex-1 flex flex-col justify-start">
                {queueLoading ? (
                  <div className="h-[396px] flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
                    <Loader2 className="w-7 h-7 text-brand-600 dark:text-brand-400 animate-spin mb-2" />
                    <p className="font-semibold text-slate-600 dark:text-slate-400 text-xs">Loading queue...</p>
                  </div>
                ) : jobs.length === 0 ? (
                  <div className="h-[396px] flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 p-6 text-center">
                    <Inbox className="w-9 h-9 text-slate-300 dark:text-slate-600 mb-2 stroke-[1.5]" />
                    <p className="font-semibold text-slate-700 dark:text-slate-300 text-xs">No print requests found</p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Try adjusting your search query or filter</p>
                  </div>
                ) : (
                  <>
                    {paginatedMobileJobs.map((job) => (
                      <div
                        key={job.id}
                        className="p-3 hover:bg-brand-50/20 dark:hover:bg-brand-950/30 transition-colors flex items-center justify-between gap-2.5 h-[66px]"
                      >
                        {/* Left: Code, Status & Student Name */}
                        <div 
                          onClick={() => openJobModal(job)}
                          className="min-w-0 flex-1 cursor-pointer"
                        >
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="font-mono font-bold text-brand-700 dark:text-brand-400 text-xs tracking-tight">
                              {job.tracking_code.startsWith("PRN") || job.tracking_code.startsWith("SK") ? job.tracking_code : `#${job.tracking_code}`}
                            </span>
                            {(Number(job.is_urgent) === 1 || job.is_urgent === true) && (
                              <span 
                                title="Urgent / Rush Request" 
                                className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700/80 shrink-0"
                              >
                                <Zap className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />
                              </span>
                            )}
                            <PrintStatusBadge status={job.status} size="sm" iconOnly />
                          </div>
                          <p className="font-bold text-slate-900 dark:text-slate-100 text-xs truncate">
                            {job.student_name}
                          </p>
                        </div>

                        {/* Right: Actions */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <a
                            href={job.file_path}
                            target="_blank"
                            rel="noopener noreferrer"
                            download={job.file_path.startsWith("http") ? undefined : job.file_name}
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 active:scale-95 transition-all inline-flex items-center justify-center cursor-pointer"
                            title={job.file_path.includes("drive.google.com") ? "Open in Google Drive" : job.file_path.startsWith("http") ? "Open Document (Cloud)" : "Download File"}
                            aria-label="Download or View File"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>

                          <button
                            type="button"
                            onClick={() => openJobModal(job)}
                            className="p-1.5 rounded-lg bg-brand-50 dark:bg-brand-950/50 hover:bg-brand-100 dark:hover:bg-brand-900/60 text-brand-700 dark:text-brand-400 border border-brand-200 dark:border-brand-800/70 active:scale-95 transition-all cursor-pointer"
                            title="Manage Job & View Details"
                            aria-label="Manage Job & View Details"
                          >
                            <SlidersHorizontal className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}

                    {/* Spacer slots so mobile card stays exactly 6 items tall */}
                    {paginatedMobileJobs.length < MOBILE_QUEUE_PAGE_SIZE && (
                      Array.from({ length: MOBILE_QUEUE_PAGE_SIZE - paginatedMobileJobs.length }).map((_, idx) => (
                        <div key={`mob-spacer-${idx}`} className="h-[66px] pointer-events-none select-none" />
                      ))
                    )}
                  </>
                )}
              </div>

              {/* Bottom: Fixed Mobile Pagination Bar */}
              <div className="px-3.5 py-2.5 bg-slate-50/80 dark:bg-slate-800/70 border-t border-slate-200/80 dark:border-slate-800/90 flex items-center justify-between text-xs shrink-0">
                <div className="text-slate-500 dark:text-slate-400 font-medium text-[11px]">
                  <span>Showing </span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{startMobileQueueIndex}</span>-
                  <span className="font-bold text-slate-800 dark:text-slate-200">{endMobileQueueIndex}</span>
                  <span> of </span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{jobs.length}</span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setMobileQueuePage((p) => Math.max(1, p - 1))}
                    disabled={mobileQueuePage <= 1}
                    className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-bold text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer flex items-center gap-0.5 text-[11px]"
                  >
                    <ChevronLeft className="w-3 h-3" />
                    <span>Prev</span>
                  </button>

                  <span className="px-1.5 font-bold text-slate-800 dark:text-slate-200 text-[11px]">
                    {mobileQueuePage} / {totalMobileQueuePages}
                  </span>

                  <button
                    type="button"
                    onClick={() => setMobileQueuePage((p) => Math.min(totalMobileQueuePages, p + 1))}
                    disabled={mobileQueuePage >= totalMobileQueuePages}
                    className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-bold text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer flex items-center gap-0.5 text-[11px]"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>

            {/* Desktop Jobs Table: Fixed Height Card (hidden md:flex) */}
            <div className="hidden md:flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden min-h-[454px]">
              {/* Table Header Toolbar: Search + Queue Status Stats */}
              <div className="px-3.5 py-2.5 bg-slate-50/70 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800/90 flex items-center justify-between gap-3 shrink-0">
                {/* Left: Search Input */}
                <div className="relative flex-1 max-w-sm">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search student, tracking code, or file..."
                    value={jobSearch}
                    onChange={(e) => setJobSearch(e.target.value)}
                    className="w-full pl-8 pr-7 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-600/30 focus:border-brand-600 bg-white dark:bg-slate-900 transition-all shadow-2xs"
                  />
                  {jobSearch && (
                    <button
                      type="button"
                      onClick={() => setJobSearch("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-slate-700/80 transition-colors cursor-pointer"
                      aria-label="Clear search"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Right: Total Count */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    Total: <strong className="font-mono font-bold text-slate-800 dark:text-slate-200">{allJobs.length}</strong>
                  </span>
                </div>
              </div>

              {/* Table Container (flex-1) */}
              <div className="overflow-x-auto flex-1">
                <table className="w-full text-left text-xs table-fixed min-w-[920px]">
                  <colgroup>
                    <col className="w-[10%]" />
                    <col className="w-[24%]" />
                    <col className="w-[30%]" />
                    <col className="w-[14%]" />
                    <col className="w-[11%]" />
                    <col className="w-[11%]" />
                  </colgroup>
                  <thead className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-3 whitespace-nowrap">Tracking #</th>
                      <th className="py-3 px-3 whitespace-nowrap">Student &amp; Location</th>
                      <th className="py-3 px-3 whitespace-nowrap">Document Details</th>
                      <th className="py-3 px-3 whitespace-nowrap">Specs &amp; Copies</th>
                      <th className="py-3 px-3 text-center whitespace-nowrap">
                        <div className="relative inline-flex items-center justify-center gap-1 cursor-pointer group select-none">
                          <span className="font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider text-xs group-hover:text-slate-900 dark:group-hover:text-slate-100 transition-colors">
                            Status
                          </span>
                          <Filter
                            className={`w-3 h-3 transition-colors shrink-0 ${
                              jobFilter !== "all"
                                ? "text-brand-600 dark:text-brand-400 fill-brand-600 dark:fill-brand-400"
                                : "text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300"
                            }`}
                          />
                          <ChevronDown className="w-3 h-3 text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors shrink-0" />

                          <select
                            value={jobFilter}
                            onChange={(e) => setJobFilter(e.target.value)}
                            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer text-xs font-semibold"
                            title="Filter requests by status"
                            aria-label="Filter requests by status"
                          >
                            <option value="all">All Statuses ({allJobs.length})</option>
                            <option value="Pending Review">Pending Review ({statusCounts["Pending Review"]})</option>
                            <option value="Printing In Progress">Printing In Progress ({statusCounts["Printing In Progress"]})</option>
                            <option value="Ready for Pickup">Ready for Pickup ({statusCounts["Ready for Pickup"]})</option>
                            <option value="Completed">Completed / Claimed ({statusCounts["Completed"]})</option>
                            <option value="Declined">Declined ({statusCounts["Declined"]})</option>
                            <option value="Cancelled">Cancelled ({statusCounts["Cancelled"] || 0})</option>
                          </select>
                        </div>
                      </th>
                      <th className="py-3 px-3 text-center whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {queueLoading ? (
                      <tr>
                        <td colSpan={6} className="h-[304px] text-center text-slate-400 dark:text-slate-500">
                          <div className="flex flex-col items-center justify-center py-20 text-slate-400 dark:text-slate-500">
                            <Loader2 className="w-7 h-7 text-brand-600 dark:text-brand-400 animate-spin mb-2" />
                            <p className="font-semibold text-slate-600 dark:text-slate-400 text-xs">Loading queue...</p>
                          </div>
                        </td>
                      </tr>
                    ) : jobs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="h-[304px] text-center text-slate-400 dark:text-slate-500">
                          <div className="flex flex-col items-center justify-center py-20 text-slate-400 dark:text-slate-500">
                            <Inbox className="w-9 h-9 text-slate-300 dark:text-slate-600 mb-2 stroke-[1.5]" />
                            <p className="font-semibold text-slate-700 dark:text-slate-300 text-sm">No print requests found</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Try adjusting your search query or status filter</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <>
                        {paginatedJobs.map((job) => (
                          <tr key={job.id} className="h-[76px] hover:bg-brand-50/20 dark:hover:bg-brand-950/30 transition-colors">
                            <td className="py-2.5 px-3 font-mono font-bold text-brand-700 dark:text-brand-400 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <span>{job.tracking_code.startsWith("PRN") || job.tracking_code.startsWith("SK") ? job.tracking_code : `#${job.tracking_code}`}</span>
                                {(Number(job.is_urgent) === 1 || job.is_urgent === true) && (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700/80 font-sans" title="Needed Urgently">
                                    <Zap className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" /> Rush
                                  </span>
                                )}
                              </div>
                              <span className="block text-[10px] text-slate-400 dark:text-slate-500 font-normal">
                                {new Date(job.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 min-w-0">
                              <p className="font-bold text-slate-900 dark:text-slate-100 leading-tight truncate">{job.student_name}</p>
                              <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-tight mt-0.5 truncate">
                                {[job.contact_number, job.purok].filter(Boolean).join(" • ")}
                              </p>
                              <div className="mt-1 flex items-center gap-1 text-[10px] font-medium text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/80 dark:border-emerald-800/70 rounded px-1.5 py-0.5 w-fit max-w-full">
                                <MapPin className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                <span className="truncate">{job.pickup_station ? (job.pickup_station.includes("Purok 5") ? "Purok 5 (Sapdaan)" : "Purok 1 (Chairperson)") : "SK Station"}</span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 min-w-0">
                              <p className="font-semibold text-slate-800 dark:text-slate-200 truncate text-xs" title={job.file_name}>
                                {job.file_name}
                              </p>
                              <a
                                href={job.file_path}
                                target="_blank"
                                rel="noopener noreferrer"
                                download={job.file_path.startsWith("http") ? undefined : job.file_name}
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-600 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-300 mt-0.5 truncate max-w-full"
                              >
                                <Download className="w-3 h-3 shrink-0" />
                                <span className="truncate">
                                  {job.file_path.includes("drive.google.com") ? "View in Google Drive" : job.file_path.startsWith("http") ? "View Document (Cloud)" : "Download File"} ({(job.file_size / 1024).toFixed(0)} KB)
                                </span>
                              </a>
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <span className="font-semibold text-slate-800 dark:text-slate-200">{job.print_type}</span>
                              <span className="block text-slate-500 dark:text-slate-400 text-[11px]">{job.paper_size} • {job.copies} cop{job.copies > 1 ? "ies" : "y"}</span>
                              <span className="block text-[10px] text-slate-400 dark:text-slate-500">{job.page_range}</span>
                            </td>
                            <td className="py-2.5 px-3 text-center whitespace-nowrap">
                              <div 
                                className="inline-flex items-center justify-center cursor-pointer"
                                title={job.admin_notes ? `${job.status} • Note: ${job.admin_notes}` : job.status}
                                onClick={() => openJobModal(job)}
                              >
                                <PrintStatusBadge status={job.status} size="md" iconOnly />
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-center whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => openJobModal(job)}
                                className="w-8 h-8 inline-flex items-center justify-center rounded-lg bg-brand-50 dark:bg-brand-950/50 hover:bg-brand-100 dark:hover:bg-brand-900/60 text-brand-700 dark:text-brand-400 border border-brand-200 dark:border-brand-800/70 hover:border-brand-300 dark:hover:border-brand-700 active:scale-95 transition-all cursor-pointer shadow-2xs"
                                title="Manage & View Details"
                                aria-label="Manage & View Details"
                              >
                                <SlidersHorizontal className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}

                        {/* Spacer rows so card stays exactly 4 rows tall on all filters */}
                        {paginatedJobs.length < QUEUE_PAGE_SIZE && (
                          Array.from({ length: QUEUE_PAGE_SIZE - paginatedJobs.length }).map((_, idx) => (
                            <tr key={`spacer-${idx}`} className="h-[76px] pointer-events-none select-none">
                              <td colSpan={6} className="py-2.5 px-3 text-transparent opacity-0">&nbsp;</td>
                            </tr>
                          ))
                        )}
                      </>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Desktop Table Footer: Fixed Pagination Bar */}
              <div className="px-4 py-2.5 bg-slate-50/80 dark:bg-slate-800/70 border-t border-slate-200/80 dark:border-slate-800/90 flex items-center justify-between gap-3 text-xs shrink-0">
                <div className="flex items-center gap-1.5 font-medium text-slate-500 dark:text-slate-400 text-[11px]">
                  <span>Showing</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{startQueueIndex}</span>
                  <span>to</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{endQueueIndex}</span>
                  <span>of</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{jobs.length}</span>
                  <span>requests</span>
                  {jobFilter !== 'all' && (
                    <span className="text-slate-400 dark:text-slate-500">({jobFilter})</span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setQueuePage((prev) => Math.max(1, prev - 1))}
                    disabled={queuePage <= 1}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Previous</span>
                  </button>

                  {/* Page Number Pills */}
                  <div className="flex items-center gap-1 px-1">
                    {Array.from({ length: totalQueuePages }, (_, i) => i + 1).map((pageNum) => (
                      <button
                        key={pageNum}
                        type="button"
                        onClick={() => setQueuePage(pageNum)}
                        className={`w-7 h-7 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          queuePage === pageNum
                            ? 'bg-brand-600 text-white shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-slate-700/70'
                        }`}
                      >
                        {pageNum}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => setQueuePage((prev) => Math.min(totalQueuePages, prev + 1))}
                    disabled={queuePage >= totalQueuePages}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </>
        );
      })()}

      {/* TAB 2: AUDITED TRANSPARENCY LEDGERS (DISBURSEMENTS + BANK REMITTANCES) */}
      {activeTab === "ledgers" && (() => {
        // Expenses (Disbursements) calculations
        const filteredExpenses = expenses.filter((e) => {
          if (selectedExpenseCategory !== "all" && e.category !== selectedExpenseCategory) {
            return false;
          }
          if (expenseSearch.trim()) {
            const q = expenseSearch.toLowerCase().trim();
            return (
              (e.title || "").toLowerCase().includes(q) ||
              (e.description || "").toLowerCase().includes(q) ||
              (e.category || "").toLowerCase().includes(q) ||
              (e.voucher_no || "").toLowerCase().includes(q) ||
              (e.payee || "").toLowerCase().includes(q) ||
              (e.date || "").includes(q) ||
              String(e.amount ?? "").includes(q)
            );
          }
          return true;
        });

        const sortedExpenses = [...filteredExpenses].sort((a, b) => {
          if (expenseSort.field === "date") {
            return expenseSort.order === "asc"
              ? a.date.localeCompare(b.date)
              : b.date.localeCompare(a.date);
          }
          return expenseSort.order === "asc"
            ? Number(a.amount) - Number(b.amount)
            : Number(b.amount) - Number(a.amount);
        });

        const totalExpensePages = Math.max(1, Math.ceil(sortedExpenses.length / EXPENSE_PAGE_SIZE));
        const currentExpensePage = Math.min(expensePage, totalExpensePages);
        const paginatedExpenses = sortedExpenses.slice(
          (currentExpensePage - 1) * EXPENSE_PAGE_SIZE,
          currentExpensePage * EXPENSE_PAGE_SIZE
        );
        const startExpenseIndex = sortedExpenses.length === 0 ? 0 : (currentExpensePage - 1) * EXPENSE_PAGE_SIZE + 1;
        const endExpenseIndex = Math.min(currentExpensePage * EXPENSE_PAGE_SIZE, sortedExpenses.length);
        const grandExpensesTotal = expenses.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);

        // Deposits (Bank Remittances) calculations
        const filteredDeposits = deposits.filter((d) => {
          if (!depositSearch.trim()) return true;
          const q = depositSearch.toLowerCase().trim();
          return (
            d.reference_no.toLowerCase().includes(q) ||
            d.source.toLowerCase().includes(q) ||
            (d.description && d.description.toLowerCase().includes(q)) ||
            d.date.includes(q) ||
            d.amount.toString().includes(q)
          );
        });

        const sortedDeposits = [...filteredDeposits].sort((a, b) => {
          if (depositSort.field === "date") {
            return depositSort.order === "asc"
              ? a.date.localeCompare(b.date)
              : b.date.localeCompare(a.date);
          }
          return depositSort.order === "asc"
            ? Number(a.amount) - Number(b.amount)
            : Number(b.amount) - Number(a.amount);
        });

        const grandDepositsTotal = deposits.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
        const totalDepositPages = Math.max(1, Math.ceil(sortedDeposits.length / DEPOSIT_PAGE_SIZE));
        const currentDepositPage = Math.min(depositPage, totalDepositPages);
        const paginatedDeposits = sortedDeposits.slice(
          (currentDepositPage - 1) * DEPOSIT_PAGE_SIZE,
          currentDepositPage * DEPOSIT_PAGE_SIZE
        );
        const startDepositIndex = sortedDeposits.length === 0 ? 0 : (currentDepositPage - 1) * DEPOSIT_PAGE_SIZE + 1;
        const endDepositIndex = Math.min(currentDepositPage * DEPOSIT_PAGE_SIZE, sortedDeposits.length);

        const activeSearch = activeLedger === "expenses" ? expenseSearch : depositSearch;

        return (
          <div className="bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden flex flex-col transition-all duration-150 md:h-[545px] md:min-h-[545px]">
            {/* Ledger Header: Title + Action Controls (hidden on mobile, visible on desktop) */}
            <div className="hidden md:block px-3.5 py-2 sm:px-6 sm:py-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
              <div className="flex items-center justify-between gap-2 sm:gap-2.5">
                <div className="min-w-0">
                  <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight leading-snug">
                    Audited Transparency Ledgers
                  </h2>
                </div>

                {/* Right Side Action Controls: Filter + Switchers + Search (Icons Only) */}
                <div className="flex items-center gap-1.5 ml-auto shrink-0 flex-wrap">
                  {/* Category Filter Button (Icon Only - opens native select dropdown) */}
                  {activeLedger === "expenses" && (
                    <div className="relative inline-flex items-center">
                      <div
                        className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl border flex items-center justify-center transition cursor-pointer shadow-2xs ${
                          selectedExpenseCategory !== "all"
                            ? "border-brand-500 bg-brand-50 dark:bg-brand-950/50 text-brand-700 dark:text-brand-400 font-bold"
                            : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                        }`}
                        title={selectedExpenseCategory !== "all" ? `Category: ${selectedExpenseCategory} (Click to change)` : "Filter by category"}
                        aria-label="Filter by category"
                      >
                        <Filter className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </div>
                      <select
                        value={selectedExpenseCategory}
                        onChange={(e) => {
                          setSelectedExpenseCategory(e.target.value);
                          setExpensePage(1);
                        }}
                        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer text-xs font-semibold"
                        title="Filter by category"
                        aria-label="Filter by category"
                      >
                        <option value="all">All Categories ({expenses.length})</option>
                        {dynamicExpenseCategories
                          .filter((cat) => cat !== "all")
                          .map((cat) => {
                            const count = expenses.filter((e) => e.category === cat).length;
                            return (
                              <option key={cat} value={cat}>
                                {cat} {count > 0 ? `(${count})` : ""}
                              </option>
                            );
                          })}
                      </select>
                    </div>
                  )}

                  {/* Disbursements & Remittances Switcher (Icons Only) */}
                  <div className="inline-flex p-1 bg-slate-100/90 dark:bg-slate-800/90 rounded-xl border border-slate-200 dark:border-slate-800 items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveLedger("expenses");
                        setExpensePage(1);
                      }}
                      title={`Disbursements (Expenses) • ${expenses.length} records`}
                      aria-label="Disbursements (Expenses)"
                      className={`w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg transition-all cursor-pointer ${
                        activeLedger === "expenses"
                          ? "bg-white dark:bg-slate-900 text-brand-900 dark:text-brand-200 shadow-xs border border-slate-200/70 dark:border-slate-800/80"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/50 dark:hover:bg-slate-700/60"
                      }`}
                    >
                      <FileCheck className={`w-4 h-4 ${activeLedger === "expenses" ? "text-brand-600 dark:text-brand-400" : "text-slate-400 dark:text-slate-500"}`} />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setActiveLedger("deposits");
                        setDepositPage(1);
                      }}
                      title={`Bank Remittances (Deposits) • ${deposits.length} records`}
                      aria-label="Bank Remittances (Deposits)"
                      className={`w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg transition-all cursor-pointer ${
                        activeLedger === "deposits"
                          ? "bg-white dark:bg-slate-900 text-indigo-950 dark:text-indigo-200 shadow-xs border border-slate-200/70 dark:border-slate-800/80"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/50 dark:hover:bg-slate-700/60"
                      }`}
                    >
                      <Landmark className={`w-4 h-4 ${activeLedger === "deposits" ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400 dark:text-slate-500"}`} />
                    </button>
                  </div>

                  {/* Search Button (Icon Only - opens Search Modal) */}
                  <button
                    type="button"
                    onClick={() => {
                      if (activeLedger === "expenses") {
                        setTempExpenseSearch(expenseSearch);
                        setShowExpenseSearchModal(true);
                      } else {
                        setTempDepositSearch(depositSearch);
                        setShowDepositSearchModal(true);
                      }
                    }}
                    className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl border flex items-center justify-center transition cursor-pointer shadow-2xs active:scale-95 ${
                      activeSearch
                        ? activeLedger === "expenses"
                          ? "border-brand-300 dark:border-brand-700/80 bg-brand-50 dark:bg-brand-950/50 text-brand-700 dark:text-brand-400 font-bold"
                          : "border-indigo-300 dark:border-indigo-700/80 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-bold"
                        : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                    }`}
                    title={
                      activeSearch
                        ? `Searching for "${activeSearch}" (Click to edit)`
                        : activeLedger === "expenses"
                          ? "Search transactions"
                          : "Search remittances"
                    }
                    aria-label={activeLedger === "expenses" ? "Search transactions" : "Search remittances"}
                  >
                    <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </button>

                  {/* Active Search Term Indicator with 1-click Clear */}
                  {activeSearch && (
                    <button
                      type="button"
                      onClick={() => {
                        if (activeLedger === "expenses") {
                          setExpenseSearch("");
                          setTempExpenseSearch("");
                          setExpensePage(1);
                        } else {
                          setDepositSearch("");
                          setTempDepositSearch("");
                          setDepositPage(1);
                        }
                      }}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 text-[11px] font-medium transition cursor-pointer"
                      title="Clear search filter"
                    >
                      <span className="max-w-[90px] sm:max-w-[130px] truncate">&ldquo;{activeSearch}&rdquo;</span>
                      <X className="w-3 h-3 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* ========================================================
                LEDGER 1: AUDITED EXPENSES (MOBILE CARDS + DESKTOP TABLE)
               ======================================================== */}
            {activeLedger === "expenses" && (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Mobile Card View (md:hidden) — Matches Transparency Ledger Tab */}
              <div className="md:hidden p-3 space-y-2.5 flex flex-col bg-slate-50/50 dark:bg-slate-800/50">
                {expensesLoading ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 dark:text-slate-500 text-xs py-12">
                    <div className="w-5 h-5 border-2 border-brand-600 border-t-transparent rounded-full animate-spin mb-2" />
                    Loading financial disbursements...
                  </div>
                ) : sortedExpenses.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 dark:text-slate-400 text-xs py-12 gap-2">
                    <p>No expense records found matching your filter.</p>
                    {(selectedExpenseCategory !== "all" || expenseSearch.trim() !== "") && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedExpenseCategory("all");
                          setExpenseSearch("");
                          setTempExpenseSearch("");
                          setExpensePage(1);
                        }}
                        className="px-3 py-1 text-xs font-semibold text-brand-700 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/50 hover:bg-brand-100 dark:hover:bg-brand-900/60 border border-brand-200 dark:border-brand-800/70 rounded-lg transition-colors cursor-pointer"
                      >
                        Reset filters
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    {paginatedExpenses.map((exp) => {
                      const catColor = categories.find((c) => c.name === exp.category)?.color;
                      const badgeClass = getCategoryBadge(exp.category, catColor);
                      const rowStyle = getCategoryRowStyle(exp.category, catColor);
                      const cleanPayee = cleanPayeeName(exp.payee);
                      return (
                        <div
                          key={exp.id}
                          className={`rounded-xl border p-3 sm:p-3.5 transition-all h-[154px] flex flex-col justify-between overflow-hidden shadow-2xs ${rowStyle.cardBg}`}
                        >
                          {/* Top: Category Badge + Date */}
                          <div className="flex items-center justify-between gap-2 shrink-0">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10.5px] font-bold border shadow-2xs truncate max-w-[68%] ${badgeClass}`}
                            >
                              {exp.category}
                            </span>
                            <span className="font-mono text-xs text-slate-500 dark:text-slate-400 font-semibold shrink-0">{exp.date}</span>
                          </div>

                          {/* Middle: Title & Description */}
                          <div className="min-w-0 my-0.5">
                            <p
                              className="font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-[13px] leading-snug break-words"
                              style={{
                                display: "-webkit-box",
                                WebkitLineClamp: 1,
                                WebkitBoxOrient: "vertical",
                                overflow: "hidden",
                              }}
                              title={exp.title}
                            >
                              {exp.title}
                            </p>
                            {exp.description && (
                              <p
                                className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug break-words"
                                style={{
                                  display: "-webkit-box",
                                  WebkitLineClamp: 1,
                                  WebkitBoxOrient: "vertical",
                                  overflow: "hidden",
                                }}
                                title={exp.description}
                              >
                                {exp.description}
                              </p>
                            )}
                          </div>

                          {/* Bottom Section: Payee Row + Amount/Action Row */}
                          <div className="pt-1.5 border-t border-slate-200/70 dark:border-slate-800/80 shrink-0 space-y-1">
                            {/* Row 1: Voucher Badge + Payee Name (Full Width) */}
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-[10px] bg-white/95 dark:bg-slate-900/95 px-1.5 py-0.5 rounded border border-slate-200/80 dark:border-slate-800/90 shadow-2xs shrink-0">
                                {exp.voucher_no || "DV"}
                              </span>
                              <span
                                className="text-slate-800 dark:text-slate-200 text-xs font-semibold truncate block min-w-0"
                                title={cleanPayee || "SK Barangay"}
                              >
                                {cleanPayee || "SK Barangay"}
                              </span>
                            </div>

                            {/* Row 2: Amount (Left) & Action Buttons (Right) */}
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-black text-slate-950 dark:text-slate-50 font-mono text-sm sm:text-[15px] leading-none">
                                ₱{Number(exp.amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                              </p>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedExpenseReceipt(exp);
                                    setCopiedExpenseVoucher(false);
                                  }}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white dark:bg-slate-900 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/80 transition-all cursor-pointer active:scale-95 shadow-2xs text-[11px] font-bold"
                                  title="View Full Details & Itemized Breakdown"
                                  aria-label="View Full Details & Itemized Breakdown"
                                >
                                  <Eye className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                                  <span>Details</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openEditExpenseModal(exp)}
                                  className="inline-flex items-center justify-center p-1 rounded-lg bg-white dark:bg-slate-900 hover:bg-brand-50 dark:hover:bg-brand-950/60 text-slate-600 dark:text-slate-300 hover:text-brand-700 dark:hover:text-brand-300 border border-slate-200/90 dark:border-slate-700 transition-all cursor-pointer active:scale-95 shadow-2xs"
                                  title="Edit expense"
                                  aria-label="Edit expense"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteExpense(exp.id)}
                                  className="inline-flex items-center justify-center p-1 rounded-lg bg-white dark:bg-slate-900 hover:bg-rose-50 dark:hover:bg-rose-950/60 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 border border-slate-200/90 dark:border-slate-700 transition-all cursor-pointer active:scale-95 shadow-2xs"
                                  title="Delete record"
                                  aria-label="Delete record"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* Filler cards on mobile to keep 3 slots constant */}
                    {sortedExpenses.length > 0 && paginatedExpenses.length < EXPENSE_PAGE_SIZE && (
                      Array.from({ length: EXPENSE_PAGE_SIZE - paginatedExpenses.length }).map((_, emptyIdx) => (
                        <div
                          key={`empty-mob-exp-${emptyIdx}`}
                          className="h-[154px] rounded-xl border border-dashed border-slate-200/70 dark:border-slate-800/80 select-none pointer-events-none opacity-40 bg-white/40 dark:bg-slate-900/40"
                        />
                      ))
                    )}
                  </>
                )}
              </div>

              {/* Desktop Table View (hidden md:flex) — High-Density Fixed-Height Grid */}
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
                      <th className="py-2.5 px-3 w-[45%]">Project / Particulars</th>
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
                      <th className="py-2.5 pl-2 pr-4 sm:pr-6 text-center w-[13%]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100/80 dark:divide-slate-800/80 text-xs h-full">
                    {expensesLoading ? (
                      <tr>
                        <td colSpan={5} className="h-full text-center text-slate-400 dark:text-slate-500 text-sm align-middle py-12">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
                            <span>Loading audited disbursements...</span>
                          </div>
                        </td>
                      </tr>
                    ) : sortedExpenses.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="h-full text-center text-slate-500 dark:text-slate-400 text-sm align-middle py-12">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <Receipt className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                            <p className="font-semibold text-slate-700 dark:text-slate-300">No expense records found</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500 max-w-sm">
                              Try adjusting your search query or selecting a different category from the category filter.
                            </p>
                            {(selectedExpenseCategory !== "all" || expenseSearch.trim() !== "") && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedExpenseCategory("all");
                                  setExpenseSearch("");
                                  setTempExpenseSearch("");
                                  setExpensePage(1);
                                }}
                                className="mt-1 px-3 py-1 text-xs font-semibold text-brand-700 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/50 hover:bg-brand-100 dark:hover:bg-brand-900/60 border border-brand-200 dark:border-brand-800/70 rounded-lg transition-colors cursor-pointer"
                              >
                                Reset all filters
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <>
                        {paginatedExpenses.map((exp) => {
                          const catColor = categories.find((c) => c.name === exp.category)?.color;
                          const badgeClass = getCategoryBadge(exp.category, catColor);
                          const rowStyle = getCategoryRowStyle(exp.category, catColor);
                          const breakdownItems = getExpenseBreakdown(exp.voucher_no, exp.title, exp.amount, exp.description);
                          return (
                            <tr
                              key={exp.id}
                              className={`transition-colors group h-1/3 ${rowStyle.rowBg}`}
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
                                  {breakdownItems.length > 0 && (
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

                              {/* Actions: Details + Edit + Delete */}
                              <td className="py-2.5 pl-2 pr-4 sm:pr-6 text-center align-middle min-w-0">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedExpenseReceipt(exp);
                                      setCopiedExpenseVoucher(false);
                                    }}
                                    className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-white dark:bg-slate-900 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 hover:text-emerald-950 dark:hover:text-emerald-200 border border-emerald-300 dark:border-emerald-700/80 transition-all shadow-2xs hover:shadow-xs active:scale-95 cursor-pointer"
                                    title="View Full Details & Itemized Breakdown"
                                    aria-label="View Full Details & Itemized Breakdown"
                                  >
                                    <Eye className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openEditExpenseModal(exp)}
                                    className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-white dark:bg-slate-900 hover:bg-brand-50 dark:hover:bg-brand-950/60 text-slate-600 dark:text-slate-300 hover:text-brand-700 dark:hover:text-brand-300 border border-slate-200/90 dark:border-slate-700 transition-all shadow-2xs hover:shadow-xs active:scale-95 cursor-pointer"
                                    title="Edit expense"
                                    aria-label="Edit expense"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteExpense(exp.id)}
                                    className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-white dark:bg-slate-900 hover:bg-rose-50 dark:hover:bg-rose-950/60 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 border border-slate-200/90 dark:border-slate-700 transition-all shadow-2xs hover:shadow-xs active:scale-95 cursor-pointer"
                                    title="Delete record"
                                    aria-label="Delete record"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}

                        {/* Fixed height empty filler rows to keep table grid size constant */}
                        {sortedExpenses.length > 0 && paginatedExpenses.length < EXPENSE_PAGE_SIZE && (
                          Array.from({ length: EXPENSE_PAGE_SIZE - paginatedExpenses.length }).map((_, emptyIdx) => (
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
            )}

            {/* ========================================================
                LEDGER 2: BANK REMITTANCES (MOBILE CARDS + DESKTOP TABLE)
               ======================================================== */}
            {activeLedger === "deposits" && (
              <div className="flex-1 flex flex-col min-h-0">
                {/* Mobile Card View (md:hidden) - Matches Transparency Ledger Bank Remittances */}
                <div className="md:hidden p-3 space-y-2.5 flex flex-col bg-slate-50/50 dark:bg-slate-800/50">
                  {depositsLoading ? (
                    <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 dark:text-slate-500 text-xs py-12">
                      <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mb-2" />
                      Loading bank remittances...
                    </div>
                  ) : sortedDeposits.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 dark:text-slate-400 text-xs py-12 gap-2">
                      <p>
                        {depositSearch ? `No remittances matching "${depositSearch}".` : "No monthly remittances recorded yet."}
                      </p>
                      {depositSearch && (
                        <button
                          type="button"
                          onClick={() => {
                            setDepositSearch("");
                            setTempDepositSearch("");
                            setDepositPage(1);
                          }}
                          className="px-3 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800/70 rounded-lg transition-colors cursor-pointer"
                        >
                          Clear search filter
                        </button>
                      )}
                    </div>
                  ) : (
                    <>
                      {paginatedDeposits.map((dep) => (
                        <div
                          key={dep.id}
                          className="rounded-xl border border-indigo-200/90 dark:border-indigo-800/70 bg-indigo-50/85 dark:bg-indigo-950/50 p-3 sm:p-3.5 transition-all shadow-2xs h-[154px] flex flex-col justify-between overflow-hidden"
                        >
                          {/* Top: Reference + Date */}
                          <div className="flex items-center justify-between gap-2 shrink-0">
                            <span className="font-mono text-[10.5px] font-bold text-indigo-900 dark:text-indigo-200 bg-white/90 dark:bg-slate-900/90 px-2 py-0.5 rounded border border-indigo-200/80 dark:border-indigo-800/70 shadow-2xs">
                              {dep.reference_no}
                            </span>
                            <span className="font-mono text-xs text-slate-500 dark:text-slate-400 font-semibold">{dep.date}</span>
                          </div>

                          {/* Middle: Source & Particulars */}
                          <div className="min-w-0 my-0.5">
                            <p
                              className="font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-[13px] leading-snug break-words"
                              style={{
                                display: "-webkit-box",
                                WebkitLineClamp: 1,
                                WebkitBoxOrient: "vertical",
                                overflow: "hidden",
                              }}
                              title={dep.source}
                            >
                              {dep.source}
                            </p>
                            <p
                              className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug break-words"
                              style={{
                                display: "-webkit-box",
                                WebkitLineClamp: 1,
                                WebkitBoxOrient: "vertical",
                                overflow: "hidden",
                              }}
                              title={dep.description || "10% Mandated SK Youth Fund remittance under RA 10742"}
                            >
                              {dep.description || "10% Mandated SK Youth Fund remittance under RA 10742"}
                            </p>
                          </div>

                          {/* Bottom Section: Depository Row + Amount/Action Row */}
                          <div className="pt-1.5 border-t border-indigo-200/70 dark:border-indigo-800/70 shrink-0 space-y-1">
                            {/* Row 1: Bank (Full Width) */}
                            <div className="flex items-center min-w-0">
                              <span className="text-slate-800 dark:text-slate-200 text-xs font-semibold truncate block min-w-0">
                                Land Bank of the Philippines
                              </span>
                            </div>

                            {/* Row 2: Amount (Left) & Slip/Edit/Delete Actions (Right) */}
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-black text-slate-950 dark:text-slate-50 font-mono text-sm sm:text-[15px] leading-none">
                                ₱{Number(dep.amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                              </p>
                              <div className="flex items-center gap-1 shrink-0">
                                {dep.attachment_url ? (
                                  <button
                                    type="button"
                                    onClick={() => setSelectedDepositSlip(dep)}
                                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-white dark:bg-slate-900 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/70 transition-all text-[11px] font-bold cursor-pointer active:scale-95 shadow-2xs"
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
                                <button
                                  type="button"
                                  onClick={() => openEditDepositModal(dep)}
                                  className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-white dark:bg-slate-900 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/70 transition-all cursor-pointer active:scale-95 shadow-2xs"
                                  title="Edit remittance"
                                  aria-label="Edit remittance"
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteDeposit(dep.id)}
                                  className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-white dark:bg-slate-900 hover:bg-rose-50 dark:hover:bg-rose-950/60 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 border border-indigo-200/80 dark:border-indigo-800/70 hover:border-rose-200 dark:hover:border-rose-800/70 transition-all cursor-pointer active:scale-95 shadow-2xs"
                                  title="Delete remittance"
                                  aria-label="Delete remittance"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}

                      {/* Filler cards on mobile to keep 3 slots constant */}
                      {sortedDeposits.length > 0 && paginatedDeposits.length < DEPOSIT_PAGE_SIZE && (
                        Array.from({ length: DEPOSIT_PAGE_SIZE - paginatedDeposits.length }).map((_, emptyIdx) => (
                          <div
                            key={`empty-mob-dep-${emptyIdx}`}
                            className="h-[154px] rounded-xl border border-dashed border-slate-200/70 dark:border-slate-800/80 select-none pointer-events-none opacity-40 bg-white/40 dark:bg-slate-900/40"
                          />
                        ))
                      )}
                    </>
                  )}
                </div>

                {/* Desktop Table View (hidden md:flex) - High-Density Fixed-Height Grid matching Transparency Ledger */}
                <div className="hidden md:flex flex-col flex-1 min-h-0 relative w-full overflow-hidden">
                  <table className="w-full h-full text-left border-collapse table-fixed">
                    <thead className="sticky top-0 z-10 bg-slate-50/95 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-800 shadow-2xs shrink-0">
                      <tr className="text-slate-600 dark:text-slate-400 text-[10.5px] font-bold uppercase tracking-wider select-none">
                        <th
                          onClick={() => toggleDepositSort("date")}
                          className="py-2.5 pl-4 sm:pl-6 pr-2 cursor-pointer hover:bg-slate-100/90 dark:hover:bg-slate-800/90 transition-colors w-[10%] group"
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
                        <th className="py-2.5 px-2.5 w-[15%]">Reference No.</th>
                        <th className="py-2.5 px-2.5 w-[22%]">Remitting Source</th>
                        <th className="py-2.5 px-3 w-[30%]">Particulars &amp; Legal Basis</th>
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
                        <th className="py-2.5 pl-2 pr-4 sm:pr-6 text-center w-[12%]">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100/80 dark:divide-slate-800/80 text-xs h-full">
                      {depositsLoading ? (
                        <tr>
                          <td colSpan={6} className="h-full text-center text-slate-400 dark:text-slate-500 text-sm align-middle py-12">
                            <div className="flex flex-col items-center justify-center gap-2">
                              <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                              <span>Loading bank remittances...</span>
                            </div>
                          </td>
                        </tr>
                      ) : sortedDeposits.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="h-full text-center text-slate-500 dark:text-slate-400 text-sm align-middle py-12">
                            <div className="flex flex-col items-center justify-center gap-2">
                              <Landmark className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                              <p className="font-semibold text-slate-700 dark:text-slate-300">
                                {depositSearch ? `No remittances matching "${depositSearch}"` : "No monthly remittances recorded yet"}
                              </p>
                              {depositSearch && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDepositSearch("");
                                    setTempDepositSearch("");
                                    setDepositPage(1);
                                  }}
                                  className="mt-1 px-3 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800/70 rounded-lg transition-colors cursor-pointer"
                                >
                                  Clear search filter
                                </button>
                              )}
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

                              {/* Actions: Slip Preview / Validated + Edit + Delete */}
                              <td className="py-2.5 pl-2 pr-4 sm:pr-6 text-center align-middle min-w-0">
                                <div className="flex items-center justify-center gap-1">
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
                                  <button
                                    type="button"
                                    onClick={() => openEditDepositModal(dep)}
                                    className="w-7 h-7 inline-flex items-center justify-center rounded-lg text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 border border-transparent hover:border-indigo-100 dark:hover:border-indigo-900/70 transition-all cursor-pointer"
                                    title="Edit remittance"
                                    aria-label="Edit remittance"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteDeposit(dep.id)}
                                    className="w-7 h-7 inline-flex items-center justify-center rounded-lg text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 border border-transparent hover:border-rose-100 dark:hover:border-rose-900/70 transition-all cursor-pointer"
                                    title="Delete remittance"
                                    aria-label="Delete remittance"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}

                          {/* Fixed height empty filler rows to keep table grid size constant */}
                          {sortedDeposits.length > 0 && paginatedDeposits.length < DEPOSIT_PAGE_SIZE && (
                            Array.from({ length: DEPOSIT_PAGE_SIZE - paginatedDeposits.length }).map((_, emptyIdx) => (
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
            )}

            {/* Unified Compact Ledger Footer / Page Navigation (Matches Transparency Ledger) */}
            <div className="px-3.5 py-2 sm:px-6 sm:py-2.5 bg-slate-50/80 dark:bg-slate-800/70 border-t border-slate-200 dark:border-slate-800 flex flex-row items-center justify-between gap-2 text-xs shrink-0 md:mt-auto">
              <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 text-xs min-w-0">
                <span>
                  Showing{" "}
                  <strong className="font-mono font-bold text-slate-900 dark:text-slate-100">
                    {activeLedger === "expenses" ? startExpenseIndex : startDepositIndex}
                  </strong>
                  {"–"}
                  <strong className="font-mono font-bold text-slate-900 dark:text-slate-100">
                    {activeLedger === "expenses" ? endExpenseIndex : endDepositIndex}
                  </strong>{" "}
                  of{" "}
                  <strong className="font-mono font-bold text-slate-900 dark:text-slate-100">
                    {activeLedger === "expenses" ? sortedExpenses.length : sortedDeposits.length}
                  </strong>
                </span>
                <span className="hidden sm:inline text-slate-300 dark:text-slate-600">•</span>
                <span className="hidden sm:inline">
                  Total:{" "}
                  <strong className="font-mono text-slate-950 dark:text-slate-50 font-bold">
                    ₱{(activeLedger === "expenses" ? grandExpensesTotal : grandDepositsTotal).toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                    })}
                  </strong>
                </span>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    if (activeLedger === "expenses") {
                      setExpensePage((p) => Math.max(1, p - 1));
                    } else {
                      setDepositPage((p) => Math.max(1, p - 1));
                    }
                  }}
                  disabled={(activeLedger === "expenses" ? currentExpensePage : currentDepositPage) <= 1}
                  className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-35 disabled:cursor-not-allowed transition-all shadow-2xs cursor-pointer shrink-0"
                  aria-label="Previous page"
                  title="Previous page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-1 shrink-0">
                  {(() => {
                    const currentPg = activeLedger === "expenses" ? currentExpensePage : currentDepositPage;
                    const availablePgs = activeLedger === "expenses" ? totalExpensePages : totalDepositPages;
                    const paginationItems = getPaginationItems(currentPg, availablePgs);

                    return paginationItems.map((item, idx) => {
                      if (item === "ellipsis") {
                        const isFirstEllipsis = idx === 1;
                        const jumpTarget = isFirstEllipsis
                          ? Math.max(1, currentPg - 5)
                          : Math.min(availablePgs, currentPg + 5);
                        return (
                          <button
                            key={`ledger-ellipsis-${idx}`}
                            type="button"
                            onClick={() => {
                              if (activeLedger === "expenses") {
                                setExpensePage(jumpTarget);
                              } else {
                                setDepositPage(jumpTarget);
                              }
                            }}
                            className="w-5 sm:w-6 h-7 sm:h-8 flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 font-bold text-xs transition-colors cursor-pointer select-none"
                            title={`Jump ${isFirstEllipsis ? "backward" : "forward"} 5 pages (Page ${jumpTarget})`}
                            aria-label={`Jump ${isFirstEllipsis ? "backward" : "forward"} 5 pages`}
                          >
                            …
                          </button>
                        );
                      }

                      const isCurrent = currentPg === item;
                      return (
                        <button
                          key={item}
                          type="button"
                          onClick={() => {
                            if (activeLedger === "expenses") {
                              setExpensePage(item);
                            } else {
                              setDepositPage(item);
                            }
                          }}
                          className={`min-w-7 h-7 sm:min-w-8 sm:h-8 px-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center shrink-0 ${
                            isCurrent
                              ? activeLedger === "expenses"
                                ? "bg-brand-600 text-white shadow-xs cursor-default font-extrabold"
                                : "bg-indigo-600 text-white shadow-xs cursor-default font-extrabold"
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
                  onClick={() => {
                    if (activeLedger === "expenses") {
                      setExpensePage((p) => Math.min(totalExpensePages, p + 1));
                    } else {
                      setDepositPage((p) => Math.min(totalDepositPages, p + 1));
                    }
                  }}
                  disabled={
                    (activeLedger === "expenses" ? currentExpensePage : currentDepositPage) >=
                    (activeLedger === "expenses" ? totalExpensePages : totalDepositPages)
                  }
                  className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-35 disabled:cursor-not-allowed transition-all shadow-2xs cursor-pointer shrink-0"
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

      {/* TAB 4: EXPENSE CATEGORIES */}
      {activeTab === "categories" && (() => {
        const totalCategoryPages = Math.max(1, Math.ceil(categories.length / CATEGORY_PAGE_SIZE));
        const currentPage = Math.min(categoryPage, totalCategoryPages);
        const paginatedCategories = categories.slice(
          (currentPage - 1) * CATEGORY_PAGE_SIZE,
          currentPage * CATEGORY_PAGE_SIZE
        );
        const startCategoryIndex = categories.length === 0 ? 0 : (currentPage - 1) * CATEGORY_PAGE_SIZE + 1;
        const endCategoryIndex = Math.min(currentPage * CATEGORY_PAGE_SIZE, categories.length);

        const totalAllocated = categories.reduce((sum, c) => sum + (Number(c.allocated_budget) || 0), 0);
        const totalDisbursed = categories.reduce((sum, c) => sum + (Number(c.total_spent) || 0), 0);
        const totalRemaining = Math.max(0, totalAllocated - totalDisbursed);
        const overallUtilPercent = totalAllocated > 0 ? ((totalDisbursed / totalAllocated) * 100).toFixed(1) : "0";
        const totalVouchers = categories.reduce((sum, c) => sum + (c.expense_count || 0), 0);

        return (
          <div className="bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5 sm:p-5 lg:p-6 shadow-xs flex flex-col justify-between min-h-[640px] md:min-h-0 space-y-3.5 sm:space-y-4">
            {/* Header */}
            <div className="flex flex-col gap-1.5 border-b border-slate-100 dark:border-slate-800 pb-3 shrink-0">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight leading-snug">
                  Statutory Committee Allocations
                </h2>
                <span className="text-[10px] sm:text-xs font-bold text-brand-800 dark:text-brand-300 bg-brand-50 dark:bg-brand-950/50 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full border border-brand-200 dark:border-brand-800/70 shrink-0">
                  {categories.length} Committees
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Approved statutory committee budget caps, actual disbursements, and remaining available funds.
              </p>
            </div>

            {/* Mobile High-Density Strip View (md:hidden) - Fixed Size & Height with Clean Spacing */}
            <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800 flex-1 flex flex-col justify-start">
              {categoriesLoading ? (
                <div className="h-[430px] flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
                  <Loader2 className="w-6 h-6 text-brand-600 dark:text-brand-400 animate-spin mb-2" />
                  <p className="font-semibold text-xs text-slate-500 dark:text-slate-400">Loading categories...</p>
                </div>
              ) : categories.length === 0 ? (
                <div className="h-[430px] flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 p-4 text-center">
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">No categories found</p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Click the &quot;+&quot; button to create one.</p>
                </div>
              ) : (
                <>
                  {paginatedCategories.map((cat) => {
                    const allocated = Number(cat.allocated_budget) || 0;
                    const catTotal = Number(cat.total_spent) || 0;
                    const remaining = Math.max(0, allocated - catTotal);
                    const utilPercent = allocated > 0 ? ((catTotal / allocated) * 100).toFixed(1) : "0";
                    const badgeClass = getCategoryBadge(cat.name, cat.color);
                    const theme = getCategoryCardTheme(cat.name, cat.color);

                    return (
                      <div key={cat.id} className="h-[86px] py-2 flex flex-col justify-between shrink-0">
                        {/* Top Row: Committee & Actions */}
                        <div className="flex items-center justify-between gap-2 shrink-0">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className={`w-2 h-2 rounded-full ${theme.bar} shrink-0`} />
                            <span className="font-bold text-slate-900 dark:text-slate-100 text-xs truncate leading-snug">{cat.name}</span>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium shrink-0">
                              ({cat.expense_count} vchr{cat.expense_count === 1 ? "" : "s"})
                            </span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0 font-mono ${badgeClass}`}>
                              {utilPercent}%
                            </span>
                            <button
                              type="button"
                              onClick={() => openEditCategoryModal(cat)}
                              className="p-1 rounded text-slate-400 dark:text-slate-500 hover:text-brand-600 dark:hover:text-brand-300 hover:bg-brand-50 dark:hover:bg-brand-950/70 transition-colors cursor-pointer"
                              title="Edit category"
                              aria-label="Edit category"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteCategory(cat.id, cat.name)}
                              className="p-1 rounded text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 transition-colors cursor-pointer"
                              title="Delete category"
                              aria-label="Delete category"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Progress Bar with dedicated track */}
                        <div className="w-full shrink-0 my-0.5">
                          <div className={`w-full ${theme.track} rounded-full h-1.5 overflow-hidden`}>
                            <div
                              className={`${theme.bar} h-1.5 rounded-full transition-all duration-500`}
                              style={{ width: `${Math.min(100, parseFloat(utilPercent))}%` }}
                            />
                          </div>
                        </div>

                        {/* Financial Metrics */}
                        <div className="flex items-center justify-between text-[11px] shrink-0 pt-0.5">
                          <div>
                            <span className="text-slate-400 dark:text-slate-500 text-[10px] block leading-normal">Disbursed</span>
                            <span className="font-mono font-bold text-slate-900 dark:text-slate-100 text-xs block leading-tight">
                              ₱{catTotal.toLocaleString("en-US", { minimumFractionDigits: 0 })}
                            </span>
                          </div>
                          <div className="text-center">
                            <span className="text-slate-400 dark:text-slate-500 text-[10px] block leading-normal">Budget Cap</span>
                            <span className="font-mono text-slate-600 dark:text-slate-400 text-[11px] block leading-tight">
                              ₱{allocated.toLocaleString("en-US", { minimumFractionDigits: 0 })}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-slate-400 dark:text-slate-500 text-[10px] block leading-normal">Remaining</span>
                            <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-400 text-[11px] block leading-tight">
                              ₱{remaining.toLocaleString("en-US", { minimumFractionDigits: 0 })}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Spacer slots so mobile card stays exactly 5 items tall on all pages */}
                  {paginatedCategories.length < CATEGORY_PAGE_SIZE && (
                    Array.from({ length: CATEGORY_PAGE_SIZE - paginatedCategories.length }).map((_, idx) => (
                      <div key={`mob-cat-spacer-${idx}`} className="h-[86px] pointer-events-none select-none" />
                    ))
                  )}
                </>
              )}
            </div>

            {/* Desktop High-Density Table View (hidden md:block) - Fits 100% at a single glance with zero horizontal scroll */}
            <div className="hidden md:block rounded-xl border border-slate-200/80 dark:border-slate-800/90 overflow-hidden bg-white dark:bg-slate-900">
              <table className="w-full text-left border-collapse table-fixed">
                <thead>
                  <tr className="bg-slate-50/90 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 select-none">
                    <th className="py-2.5 px-3 w-[26%]">Committee</th>
                    <th className="py-2.5 px-2.5 w-[22%]">Utilization</th>
                    <th className="py-2.5 px-2 text-center whitespace-nowrap w-[14%]">Disbursed</th>
                    <th className="py-2.5 px-2 text-center whitespace-nowrap w-[14%]">Budget Cap</th>
                    <th className="py-2.5 px-2 text-center whitespace-nowrap w-[14%]">Remaining</th>
                    <th className="py-2.5 px-2 text-center whitespace-nowrap w-[10%]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {categoriesLoading ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400 dark:text-slate-500">
                        <div className="flex flex-col items-center justify-center">
                          <Loader2 className="w-5 h-5 text-brand-600 dark:text-brand-400 animate-spin mb-1.5" />
                          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Loading categories...</span>
                        </div>
                      </td>
                    </tr>
                  ) : categories.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400 dark:text-slate-500">
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                          No categories found. Click the &quot;+&quot; button to create one.
                        </span>
                      </td>
                    </tr>
                  ) : (
                    <>
                      {paginatedCategories.map((cat) => {
                        const allocated = Number(cat.allocated_budget) || 0;
                        const catTotal = Number(cat.total_spent) || 0;
                        const remaining = Math.max(0, allocated - catTotal);
                        const utilPercent = allocated > 0 ? ((catTotal / allocated) * 100).toFixed(1) : "0";
                        const badgeClass = getCategoryBadge(cat.name, cat.color);
                        const theme = getCategoryCardTheme(cat.name, cat.color);

                        return (
                          <tr key={cat.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/60 transition-colors">
                            {/* Committee Name + Color Dot + Subline Voucher Count */}
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className={`w-2 h-2 rounded-full ${theme.bar} shrink-0`} />
                                <div className="min-w-0">
                                  <p className="font-bold text-slate-900 dark:text-slate-100 text-xs truncate leading-snug" title={cat.name}>
                                    {cat.name}
                                  </p>
                                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium leading-none mt-0.5 truncate">
                                    {cat.expense_count} voucher{cat.expense_count === 1 ? "" : "s"}{cat.description ? ` • ${cat.description}` : ""}
                                  </p>
                                </div>
                              </div>
                            </td>

                            {/* Utilization Progress Bar + % Pill */}
                            <td className="py-2.5 px-2.5">
                              <div className="flex items-center gap-1.5">
                                <div className={`flex-1 ${theme.track} rounded-full h-1.5 overflow-hidden min-w-[40px]`}>
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
                            <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-900 dark:text-slate-100 text-xs whitespace-nowrap">
                              ₱{catTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                            </td>

                            {/* Budget Cap */}
                            <td className="py-2.5 px-2 text-center font-mono text-slate-600 dark:text-slate-400 text-xs whitespace-nowrap">
                              ₱{allocated.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                            </td>

                            {/* Remaining */}
                            <td className="py-2.5 px-2 text-center font-mono font-semibold text-emerald-700 dark:text-emerald-400 text-xs whitespace-nowrap">
                              ₱{remaining.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                            </td>

                            {/* Actions */}
                            <td className="py-2.5 px-2 text-center whitespace-nowrap">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => openEditCategoryModal(cat)}
                                  className="p-1 rounded text-slate-400 dark:text-slate-500 hover:text-brand-600 dark:hover:text-brand-300 hover:bg-brand-50 dark:hover:bg-brand-950/70 transition-colors cursor-pointer"
                                  title="Edit category"
                                  aria-label="Edit category"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteCategory(cat.id, cat.name)}
                                  className="p-1 rounded text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 transition-colors cursor-pointer"
                                  title="Delete category"
                                  aria-label="Delete category"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}

                      {/* Spacer rows so table stays consistent on all pages */}
                      {paginatedCategories.length < CATEGORY_PAGE_SIZE && (
                        Array.from({ length: CATEGORY_PAGE_SIZE - paginatedCategories.length }).map((_, idx) => (
                          <tr key={`cat-spacer-${idx}`} className="h-[49px] pointer-events-none select-none">
                            <td colSpan={6} className="py-2 px-3 text-transparent opacity-0">&nbsp;</td>
                          </tr>
                        ))
                      )}
                    </>
                  )}
                </tbody>
                <tfoot className="bg-slate-50/90 dark:bg-slate-800/80 font-bold border-t border-slate-200 dark:border-slate-800 text-xs">
                  <tr>
                    <td className="py-2.5 px-3">
                      <p className="text-slate-900 dark:text-slate-100 text-xs font-bold leading-snug truncate">Total Allocation</p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium leading-none mt-0.5">
                        {categories.length} Committees • {totalVouchers} vouchers
                      </p>
                    </td>
                    <td className="py-2.5 px-2.5">
                      <div className="flex items-center gap-1.5">
                        <div className="flex-1 bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden min-w-[40px]">
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
                    <td className="py-2.5 px-2 text-center font-mono text-slate-900 dark:text-slate-100 text-xs whitespace-nowrap">
                      ₱{totalDisbursed.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2.5 px-2 text-center font-mono text-slate-700 dark:text-slate-300 text-xs whitespace-nowrap">
                      ₱{totalAllocated.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2.5 px-2 text-center font-mono text-emerald-700 dark:text-emerald-400 text-xs whitespace-nowrap">
                      ₱{totalRemaining.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2.5 px-2 text-center text-slate-400 dark:text-slate-500 text-[11px]">
                      —
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Fixed Pagination Bar */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-center sm:justify-between gap-2.5 sm:gap-3 text-xs shrink-0 mt-auto">
              <div className="flex items-center justify-center gap-1.5 font-medium text-slate-500 dark:text-slate-400 text-[11px] text-center sm:text-left">
                <span>Showing</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{startCategoryIndex}</span>
                <span>to</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{endCategoryIndex}</span>
                <span>of</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{categories.length}</span>
                <span>categories</span>
              </div>

              <div className="flex items-center justify-center gap-1.5 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setCategoryPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage <= 1}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center gap-1"
                  title="Previous page"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </button>

                {/* Page Number Pills */}
                <div className="flex items-center gap-1 px-1">
                  {getPaginationItems(currentPage, totalCategoryPages).map((item, idx) => {
                    if (item === "ellipsis") {
                      return (
                        <span key={`cat-ellipsis-${idx}`} className="w-5 text-center text-slate-400 dark:text-slate-500 font-bold select-none text-xs">
                          …
                        </span>
                      );
                    }
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setCategoryPage(item)}
                        className={`w-7 h-7 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          currentPage === item
                            ? 'bg-brand-600 text-white shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-slate-700/70'
                        }`}
                      >
                        {item}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => setCategoryPage((prev) => Math.min(totalCategoryPages, prev + 1))}
                  disabled={currentPage >= totalCategoryPages}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center gap-1"
                  title="Next page"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* TAB 5: PROGRAM SETTINGS */}
      {activeTab === "settings" && (
        <form onSubmit={handleSaveSettings} className="w-full space-y-4">
          {/* Configuration Controls & Switches Grid (Side-by-Side) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Free Printing Service Card */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 shadow-xs flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Free Printing Service
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9.5px] font-semibold border ${
                      settings.printing_active === "true"
                        ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200/80 dark:border-emerald-800/60"
                        : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200/80 dark:border-amber-800/60"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        settings.printing_active === "true"
                          ? "bg-emerald-500 animate-pulse"
                          : "bg-amber-500"
                      }`}
                    />
                    <span>{settings.printing_active === "true" ? "Active" : "Paused"}</span>
                  </span>
                </div>
                <p className="text-[10.5px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">
                  Allow student print request submissions through the portal
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  const nextVal = settings.printing_active === "true" ? "false" : "true";
                  const updated = { ...settings, printing_active: nextVal };
                  setSettings(updated);
                  saveSettingsPayload(updated);
                }}
                className={`p-0.5 transition-colors cursor-pointer shrink-0 ${
                  settings.printing_active === "true"
                    ? "text-brand-700 dark:text-brand-400"
                    : "text-slate-300 dark:text-slate-600 hover:text-slate-400"
                }`}
                title={settings.printing_active === "true" ? "Pause service" : "Activate service"}
                aria-label={settings.printing_active === "true" ? "Pause printing service" : "Activate printing service"}
              >
                {settings.printing_active === "true" ? (
                  <ToggleRight className="w-7 h-7" />
                ) : (
                  <ToggleLeft className="w-7 h-7" />
                )}
              </button>
            </div>

            {/* Total Barangay Budget Card */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 shadow-xs flex items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate block">
                  Total Barangay Budget (PHP)
                </span>
                <p className="text-[10.5px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">
                  10% SK statutory fund auto-allocated under RA 10742
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {settingsSaving && (
                  <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin text-brand-600 dark:text-brand-400" />
                    <span>Saving...</span>
                  </span>
                )}
                {settingsSuccess && !settingsSaving && (
                  <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 animate-in fade-in">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Saved</span>
                  </span>
                )}

                <div className="relative w-36 shrink-0">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 dark:text-slate-500 select-none">
                    ₱
                  </span>
                  <input
                    type="number"
                    value={settings.barangay_budget || "7000000"}
                    onChange={(e) => {
                      const bb = e.target.value;
                      const num = parseFloat(bb);
                      const ab = !isNaN(num) ? String(Math.round(num * 0.10 * 100) / 100) : "";
                      setSettings({ ...settings, barangay_budget: bb, annual_budget: ab });
                    }}
                    onBlur={() => {
                      if ((settings.barangay_budget ?? "") !== (savedSettings.barangay_budget ?? "")) {
                        saveSettingsPayload(settings);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        saveSettingsPayload(settings);
                        (e.target as HTMLInputElement).blur();
                      }
                    }}
                    className="w-full pl-6 pr-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-600 bg-white dark:bg-slate-900"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Infrastructure & Storage Section Label */}
          <div className="pt-2 px-1">
            <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Storage &amp; Infrastructure
            </span>
          </div>

          {/* 3-Column Responsive Grid for Storage Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
            {/* Cloud Database Status & Storage Monitor Card */}
            <CloudDatabaseStatusCard
              data={dbStatus}
              loading={dbStatusLoading}
              error={dbStatusError}
              onRefresh={loadDbStatus}
            />

            {/* Google Drive Status & Primary Storage Monitor Card */}
            <GoogleDriveStatusCard
              data={driveStatus}
              loading={driveStatusLoading}
              error={driveStatusError}
              onRefresh={loadDriveStatus}
            />

            {/* Vercel Blob Status & 90-Day Retention Monitor Card */}
            <VercelBlobStatusCard
              data={blobStatus}
              loading={blobStatusLoading}
              error={blobStatusError}
              onRefresh={loadBlobStatus}
              cleaningBlobs={cleaningBlobs}
              cleanupMessage={cleanupMessage}
              onManualCleanup={handleManualCleanup}
            />
          </div>
        </form>
      )}

      {/* TAB 6: OFFICIALS ACCOUNTS (TIERED HIERARCHY) */}
      {activeTab === "officials" && (() => {
        const officialAccounts = officials.filter((o) => isOfficialRole(o.role));
        const chairpersons = officialAccounts.filter((o) => o.role.toLowerCase().includes("chair"));
        const executiveOfficers = officialAccounts
          .filter((o) => {
            const r = o.role.toLowerCase();
            return (r.includes("secretary") || r.includes("treasurer")) && !r.includes("chair");
          })
          .sort((a, b) => {
            if (a.role.toLowerCase().includes("sec")) return -1;
            if (b.role.toLowerCase().includes("sec")) return 1;
            return 0;
          });
        const councilors = officialAccounts
          .filter((o) => {
            const r = o.role.toLowerCase();
            if (chairpersons.some((c) => c.id === o.id) || executiveOfficers.some((e) => e.id === o.id)) return false;
            return (
              r.includes("kagawad") ||
              r.includes("council") ||
              (!r.includes("staff") && !r.includes("custodian"))
            );
          })
          .sort((a, b) => {
            const isBabyA = a.name.toLowerCase().includes("baby") || a.name.toLowerCase().includes("picar");
            const isBabyB = b.name.toLowerCase().includes("baby") || b.name.toLowerCase().includes("picar");
            if (isBabyA && !isBabyB) return 1;
            if (!isBabyA && isBabyB) return -1;
            return 0;
          });
        const otherOfficials = officialAccounts.filter(
          (o) =>
            !chairpersons.some((c) => c.id === o.id) &&
            !councilors.some((c) => c.id === o.id) &&
            !executiveOfficers.some((e) => e.id === o.id)
        );

        const getOfficialAdminRoleStyle = (role: string) => {
          const r = role.toLowerCase();
          if (r.includes("chair")) {
            return {
              ring: "ring-brand-500/30",
              badge: "bg-brand-50 dark:bg-brand-950/50 text-brand-700 dark:text-brand-400 border-brand-200 dark:border-brand-800/70",
              avatarText: "text-brand-700 dark:text-brand-400",
            };
          }
          if (r.includes("secretary")) {
            return {
              ring: "ring-indigo-500/30",
              badge: "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/70",
              avatarText: "text-indigo-700 dark:text-indigo-300",
            };
          }
          if (r.includes("treasurer")) {
            return {
              ring: "ring-emerald-500/30",
              badge: "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/70",
              avatarText: "text-emerald-700 dark:text-emerald-400",
            };
          }
          return {
            ring: "ring-slate-200 dark:ring-slate-700",
            badge: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800",
            avatarText: "text-slate-700 dark:text-slate-300",
          };
        };

        const renderChairpersonCard = (user: User) => {
          const style = getOfficialAdminRoleStyle(user.role);
          return (
            <div
              key={user.id}
              className="relative group bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl border border-brand-200/90 dark:border-brand-800/70 ring-2 ring-brand-500/10 shadow-xs hover:shadow-sm transition-all flex flex-col items-center text-center gap-3 w-full"
            >
              {/* Quick Actions (Edit & Access / Delete) */}
              <div className="absolute top-3.5 right-3.5 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => openEditUserModal(user)}
                  className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-brand-700 dark:hover:text-brand-300 hover:bg-brand-50 dark:hover:bg-brand-950/70 transition-colors cursor-pointer"
                  title="Edit Official & Portal Access"
                  aria-label="Edit Official & Portal Access"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                {currentUser?.id !== user.id && (
                  <button
                    type="button"
                    onClick={() => handleDeleteUser(user.id, user.name)}
                    className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 transition-colors cursor-pointer"
                    title="Delete Official Account"
                    aria-label="Delete Official Account"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Centered Avatar */}
              <div className="relative flex items-center justify-center">
                <div
                  className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full ring-4 ${style.ring} p-0.5 bg-white dark:bg-slate-900 flex items-center justify-center overflow-hidden shadow-xs`}
                >
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt={user.name} className="w-full h-full object-cover rounded-full" />
                  ) : (
                    <span className={`font-bold text-lg sm:text-xl ${style.avatarText}`}>
                      {user.name.charAt(0)}
                    </span>
                  )}
                </div>
              </div>

              {/* Centered Details */}
              <div className="space-y-1.5 flex flex-col items-center text-center w-full">
                <div className="flex flex-col items-center justify-center gap-1">
                  <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-sm sm:text-base tracking-tight">
                    {user.name}
                  </h3>
                  <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold border shrink-0 ${style.badge}`}>
                    {user.role}
                  </span>
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400">
                  <a href={`mailto:${user.email}`} className="hover:text-brand-700 dark:hover:text-brand-300 transition-colors">
                    {user.email}
                  </a>
                </p>

                {user.contact_number && (
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    Contact:{" "}
                    <a href={`tel:${user.contact_number}`} className="hover:text-brand-700 dark:hover:text-brand-300 font-mono transition-colors">
                      {user.contact_number}
                    </a>
                  </p>
                )}
              </div>
            </div>
          );
        };

        const renderOfficialCard = (user: User, isCentered: boolean = false) => {
          const style = getOfficialAdminRoleStyle(user.role);
          return (
            <div
              key={user.id}
              className={`bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-all flex items-start gap-3.5 sm:gap-4 ${
                isCentered ? "sm:col-span-2 sm:w-[calc(50%-0.4375rem)] sm:mx-auto sm:justify-self-center" : ""
              }`}
            >
              <div
                className={`w-12 h-12 rounded-full ring-2 ${style.ring} flex items-center justify-center shrink-0 overflow-hidden bg-slate-100 dark:bg-slate-800`}
              >
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt={user.name} className="w-full h-full object-cover rounded-full" />
                ) : (
                  <span className={`font-bold text-sm ${style.avatarText}`}>
                    {user.name.charAt(0)}
                  </span>
                )}
              </div>
              <div className="flex-1 space-y-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-extrabold text-slate-900 dark:text-slate-100 text-xs sm:text-sm truncate" title={user.name}>
                    {user.name}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${style.badge}`}>
                      {user.role}
                    </span>
                    <button
                      type="button"
                      onClick={() => openEditUserModal(user)}
                      className="p-1 rounded-md text-slate-400 dark:text-slate-500 hover:text-brand-700 dark:hover:text-brand-300 hover:bg-brand-50 dark:hover:bg-brand-950/70 transition-colors cursor-pointer"
                      title="Edit Official & Portal Access"
                      aria-label="Edit Official & Portal Access"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    {currentUser?.id !== user.id && (
                      <button
                        type="button"
                        onClick={() => handleDeleteUser(user.id, user.name)}
                        className="p-1 rounded-md text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 transition-colors cursor-pointer"
                        title="Delete Official Account"
                        aria-label="Delete Official Account"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate" title={user.email}>
                  <a href={`mailto:${user.email}`} className="hover:text-brand-700 dark:hover:text-brand-300 transition-colors">
                    {user.email}
                  </a>
                </p>
                {user.contact_number && (
                  <p className="text-xs text-slate-400 dark:text-slate-500 truncate">
                    Contact:{" "}
                    <a href={`tel:${user.contact_number}`} className="hover:text-brand-700 dark:hover:text-brand-300 font-mono transition-colors">
                      {user.contact_number}
                    </a>
                  </p>
                )}
              </div>
            </div>
          );
        };

        return (
          <div className="space-y-6 w-full">
            {/* Top Bar: Count */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Registered Officials</span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                  {officialAccounts.length}
                </span>
              </div>
            </div>

            {/* Empty State */}
            {officialAccounts.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center text-slate-400 dark:text-slate-500">
                No official accounts registered yet.
              </div>
            ) : (
              <div className="space-y-6">
                {/* TIER 1: SK CHAIRPERSON */}
                {chairpersons.length > 0 && (
                  <div className="space-y-3">
                    <div className="relative flex items-center justify-center">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-slate-200/80 dark:border-slate-800/90" />
                      </div>
                      <div className="relative bg-slate-50 dark:bg-slate-800/70 px-3.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-800 text-[10.5px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5 shadow-2xs">
                        <span>SK Chairperson</span>
                      </div>
                    </div>

                    <div className="flex justify-center w-full">
                      <div className="w-full max-w-md sm:max-w-lg">
                        {chairpersons.map((user) => renderChairpersonCard(user))}
                      </div>
                    </div>
                  </div>
                )}

                {/* TIER 2: SK COUNCILORS & COMMITTEE CHAIRS (7 KAGAWADS) */}
                {councilors.length > 0 && (
                  <div className="space-y-3 pt-1">
                    <div className="relative flex items-center justify-center">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-slate-200/80 dark:border-slate-800/90" />
                      </div>
                      <div className="relative bg-slate-50 dark:bg-slate-800/70 px-3.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-800 text-[10.5px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5 shadow-2xs">
                        <span>SK Councilors &amp; Committee Chairs ({councilors.length})</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      {councilors.map((user, idx) => {
                        const isLastAndOdd = councilors.length % 2 === 1 && idx === councilors.length - 1;
                        return renderOfficialCard(user, isLastAndOdd);
                      })}
                    </div>
                  </div>
                )}

                {/* TIER 3: APPOINTED EXECUTIVE OFFICERS (SECRETARY & TREASURER) */}
                {executiveOfficers.length > 0 && (
                  <div className="space-y-3 pt-1">
                    <div className="relative flex items-center justify-center">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-slate-200/80 dark:border-slate-800/90" />
                      </div>
                      <div className="relative bg-slate-50 dark:bg-slate-800/70 px-3.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-800 text-[10.5px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5 shadow-2xs">
                        <span>Appointed Executive Officers ({executiveOfficers.length})</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      {executiveOfficers.map((user) => renderOfficialCard(user))}
                    </div>
                  </div>
                )}

                {/* OTHER / EXTRA OFFICIALS (IF ANY) */}
                {otherOfficials.length > 0 && (
                  <div className="space-y-3 pt-1">
                    <div className="relative flex items-center justify-center">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-slate-200/80 dark:border-slate-800/90" />
                      </div>
                      <div className="relative bg-slate-50 dark:bg-slate-800/70 px-3.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-800 text-[10.5px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5 shadow-2xs">
                        <span>Other Appointees &amp; Staff ({otherOfficials.length})</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      {otherOfficials.map((user, idx) => {
                        const isLastAndOdd = otherOfficials.length % 2 === 1 && idx === otherOfficials.length - 1;
                        return renderOfficialCard(user, isLastAndOdd);
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* TAB 7: ALL ACCOUNTS (REGISTERED STUDENTS & GUESTS) */}
      {activeTab === "accounts" && (() => {
        const rawAccounts = officials.filter((u) => !isOfficialRole(u.role));
        const q = studentSearch.trim().toLowerCase();
        const studentAccounts = q
          ? rawAccounts.filter((u) => {
              const name = (u.name || "").toLowerCase();
              const email = (u.email || "").toLowerCase();
              const contact = (u.contact_number || "").toLowerCase();
              const role = (u.role || "").toLowerCase();
              const provider = (u.auth_provider || "").toLowerCase();
              return (
                name.includes(q) ||
                email.includes(q) ||
                contact.includes(q) ||
                role.includes(q) ||
                provider.includes(q)
              );
            })
          : rawAccounts;

        // Desktop pagination: 5 accounts at a time
        const totalStudentPages = Math.max(1, Math.ceil(studentAccounts.length / STUDENT_PAGE_SIZE));
        const currentStudentPage = Math.min(studentPage, totalStudentPages);
        const paginatedAccounts = studentAccounts.slice((currentStudentPage - 1) * STUDENT_PAGE_SIZE, currentStudentPage * STUDENT_PAGE_SIZE);
        const startRecord = studentAccounts.length === 0 ? 0 : (currentStudentPage - 1) * STUDENT_PAGE_SIZE + 1;
        const endRecord = Math.min(currentStudentPage * STUDENT_PAGE_SIZE, studentAccounts.length);

        // Mobile pagination: exactly 3 accounts at a time (fixed height)
        const totalMobileStudentPages = Math.max(1, Math.ceil(studentAccounts.length / MOBILE_STUDENT_PAGE_SIZE));
        const currentMobileStudentPage = Math.min(mobileStudentPage, totalMobileStudentPages);
        const paginatedMobileAccounts = studentAccounts.slice((currentMobileStudentPage - 1) * MOBILE_STUDENT_PAGE_SIZE, currentMobileStudentPage * MOBILE_STUDENT_PAGE_SIZE);
        const startMobileRecord = studentAccounts.length === 0 ? 0 : (currentMobileStudentPage - 1) * MOBILE_STUDENT_PAGE_SIZE + 1;
        const endMobileRecord = Math.min(currentMobileStudentPage * MOBILE_STUDENT_PAGE_SIZE, studentAccounts.length);

        return (
          <div className="w-full">
            {/* Mobile Account Card: Fixed Height & Exactly 4 Slots (md:hidden) */}
            <div className="md:hidden bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden flex flex-col min-h-[366px]">
              {/* 4 Account Slots */}
              <div className="divide-y divide-slate-100 dark:divide-slate-800 flex-1 flex flex-col justify-start">
                {studentAccounts.length === 0 ? (
                  <div className="h-[328px] flex flex-col items-center justify-center p-5 text-center text-slate-400 dark:text-slate-500">
                    <Users className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-1.5 stroke-[1.5]" />
                    <p className="font-bold text-slate-700 dark:text-slate-300 text-xs sm:text-sm">
                      {studentSearch ? "No matching accounts found" : "No accounts registered"}
                    </p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 max-w-xs">
                      {studentSearch ? (
                        <>
                          No accounts match &ldquo;<span className="font-semibold text-slate-600 dark:text-slate-400">{studentSearch}</span>&rdquo;.
                          <button
                            type="button"
                            onClick={() => {
                              setStudentSearch("");
                              setTempStudentSearch("");
                              setStudentPage(1);
                              setMobileStudentPage(1);
                            }}
                            className="ml-1.5 text-brand-600 dark:text-brand-400 hover:underline font-semibold cursor-pointer"
                          >
                            Clear search
                          </button>
                        </>
                      ) : (
                        "No student or guest accounts have registered yet."
                      )}
                    </p>
                  </div>
                ) : (
                  <>
                    {paginatedMobileAccounts.map((user, index) => {
                      const rowNum = (currentMobileStudentPage - 1) * MOBILE_STUDENT_PAGE_SIZE + index + 1;
                      const isStudent = (user.role || "").toLowerCase() === "student";
                      const isGuest = (user.role || "").toLowerCase() === "guest";
                      const isGoogle = user.auth_provider === "google";

                      return (
                        <div
                          key={user.id}
                          className="px-3 py-2 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors h-[82px] flex flex-col justify-between"
                        >
                          {/* Row 1: Left = Avatar + Name + Row# + Role Badge; Right = Actions */}
                          <div className="flex items-center justify-between gap-2 shrink-0">
                            <div className="flex items-center gap-2.5 min-w-0">
                              {user.avatar_url ? (
                                <img
                                  src={user.avatar_url}
                                  alt={user.name}
                                  className="w-8 h-8 rounded-full object-cover ring-1 ring-slate-200 dark:ring-slate-700 shrink-0 shadow-2xs"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-600 to-brand-800 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                                  {(user.name || "U").charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div className="flex items-center gap-1.5 min-w-0">
                                <p
                                  className="font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-[13px] truncate leading-tight"
                                  title={user.name}
                                >
                                  {user.name}
                                </p>
                                <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 font-semibold shrink-0">
                                  #{rowNum}
                                </span>
                                {isStudent ? (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/70 shrink-0">
                                    Student
                                  </span>
                                ) : isGuest ? (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border border-sky-200/80 dark:border-sky-800/70 shrink-0">
                                    Guest
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shrink-0">
                                    {user.role}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Actions: Edit & Delete */}
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => openEditUserModal(user)}
                                className="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-brand-700 dark:hover:text-brand-400 hover:border-brand-300 dark:hover:border-brand-700 hover:bg-brand-50/60 dark:hover:bg-brand-950/40 flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95"
                                title="Edit Account Details"
                                aria-label="Edit Account Details"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                              {currentUser?.id !== user.id && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteUser(user.id, user.name)}
                                  className="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-300 dark:hover:border-rose-800 hover:bg-rose-50/60 dark:hover:bg-rose-950/40 flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95"
                                  title="Delete Account"
                                  aria-label="Delete Account"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Row 2: Left = Email & Contact / Right = Provider & Date */}
                          <div className="flex items-center justify-between gap-2 text-[10.5px] text-slate-500 dark:text-slate-400 pl-[42px]">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                              <a
                                href={`mailto:${user.email}`}
                                className="font-mono truncate hover:text-brand-700 dark:hover:text-brand-300"
                                title={user.email}
                              >
                                {user.email}
                              </a>
                              {user.contact_number && (
                                <>
                                  <span className="text-slate-300 dark:text-slate-600 shrink-0">•</span>
                                  <a
                                    href={`tel:${user.contact_number}`}
                                    className="font-mono truncate hover:text-brand-700 dark:hover:text-brand-300 shrink-0"
                                  >
                                    {user.contact_number}
                                  </a>
                                </>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0 text-[10px] text-slate-400 dark:text-slate-500">
                              {isGoogle ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/70 dark:border-slate-700 text-[10px] font-medium">
                                  <svg className="w-2.5 h-2.5 shrink-0" viewBox="0 0 24 24">
                                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                                  </svg>
                                  Google
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/70 dark:border-slate-700 text-[10px] font-medium">
                                  <Mail className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                                  Email
                                </span>
                              )}
                              {user.created_at && (
                                <span className="font-mono">
                                  {new Date(user.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* Spacer slots so mobile card stays exactly 3 items tall */}
                    {paginatedMobileAccounts.length < MOBILE_STUDENT_PAGE_SIZE && (
                      Array.from({ length: MOBILE_STUDENT_PAGE_SIZE - paginatedMobileAccounts.length }).map((_, idx) => (
                        <div key={`mob-acc-spacer-${idx}`} className="h-[82px] pointer-events-none select-none" />
                      ))
                    )}
                  </>
                )}
              </div>

              {/* Bottom: Fixed Mobile Pagination Bar */}
              <div className="px-3.5 py-2 bg-slate-50/80 dark:bg-slate-800/70 border-t border-slate-200/80 dark:border-slate-800/90 flex items-center justify-between text-xs shrink-0">
                <div className="text-slate-500 dark:text-slate-400 font-medium text-[11px] flex items-center gap-1">
                  <span>Showing </span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{startMobileRecord}</span>-
                  <span className="font-bold text-slate-800 dark:text-slate-200">{endMobileRecord}</span>
                  <span> of </span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{studentAccounts.length}</span>
                  {studentSearch && (
                    <button
                      type="button"
                      onClick={() => {
                        setStudentSearch("");
                        setTempStudentSearch("");
                        setStudentPage(1);
                        setMobileStudentPage(1);
                      }}
                      className="ml-1 text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                      title="Clear filter"
                    >
                      <X className="w-3 h-3 inline" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setMobileStudentPage((p) => Math.max(1, p - 1))}
                    disabled={currentMobileStudentPage <= 1}
                    className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-bold text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer flex items-center gap-0.5 text-[11px] shadow-2xs"
                  >
                    <ChevronLeft className="w-3 h-3" />
                    <span>Prev</span>
                  </button>

                  <span className="px-1.5 font-bold text-slate-800 dark:text-slate-200 text-[11px]">
                    {currentMobileStudentPage} / {totalMobileStudentPages}
                  </span>

                  <button
                    type="button"
                    onClick={() => setMobileStudentPage((p) => Math.min(totalMobileStudentPages, p + 1))}
                    disabled={currentMobileStudentPage >= totalMobileStudentPages}
                    className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-bold text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer flex items-center gap-0.5 text-[11px] shadow-2xs"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>

            {/* Desktop Table View (hidden md:flex flex-col) */}
            <div className="hidden md:flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
              <div className="w-full overflow-x-auto">
                <table className="w-full text-left border-collapse table-fixed min-w-[760px]">
                  <colgroup>
                    <col className="w-[6%]" />
                    <col className="w-[28%]" />
                    <col className="w-[26%]" />
                    <col className="w-[12%]" />
                    <col className="w-[12%]" />
                    <col className="w-[16%]" />
                    <col className="w-[10%]" />
                  </colgroup>
                  <thead>
                    <tr className="bg-slate-50/90 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 select-none">
                      <th className="py-3 px-3.5 sm:px-4 text-center">#</th>
                      <th className="py-3 px-3 sm:px-4">User Details</th>
                      <th className="py-3 px-3 sm:px-4">Email Address</th>
                      <th className="py-3 px-3 sm:px-4">Role</th>
                      <th className="py-3 px-3 sm:px-4">Provider</th>
                      <th className="py-3 px-3 sm:px-4">Date Joined</th>
                      <th className="py-3 px-3 sm:px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                    {studentAccounts.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="h-[290px] text-center text-slate-400 dark:text-slate-500">
                          <div className="flex flex-col items-center justify-center">
                            <Users className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-2 stroke-[1.5]" />
                            <p className="font-bold text-slate-700 dark:text-slate-300 text-sm">
                              {studentSearch ? "No matching accounts found" : "No accounts registered"}
                            </p>
                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                              {studentSearch ? (
                                <>
                                  No accounts match &ldquo;<span className="font-semibold text-slate-600 dark:text-slate-400">{studentSearch}</span>&rdquo;.
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setStudentSearch("");
                                      setTempStudentSearch("");
                                      setStudentPage(1);
                                      setMobileStudentPage(1);
                                    }}
                                    className="ml-2 text-brand-600 dark:text-brand-400 hover:underline font-semibold cursor-pointer"
                                  >
                                    Clear search
                                  </button>
                                </>
                              ) : (
                                "No student or guest accounts have registered yet."
                              )}
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <>
                        {paginatedAccounts.map((user, index) => {
                          const rowNum = (currentStudentPage - 1) * STUDENT_PAGE_SIZE + index + 1;
                          const isStudent = (user.role || "").toLowerCase() === "student";
                          const isGuest = (user.role || "").toLowerCase() === "guest";
                          const isGoogle = user.auth_provider === "google";

                          return (
                            <tr
                              key={user.id}
                              className="h-[58px] hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                            >
                            {/* # / Row Index */}
                            <td className="py-3.5 px-3.5 sm:px-4 text-center text-slate-400 dark:text-slate-500 font-mono text-xs font-semibold">
                              #{rowNum}
                            </td>

                            {/* User Details (Avatar / Initial + Name + Contact) */}
                            <td className="py-3.5 px-3 sm:px-4">
                              <div className="flex items-center gap-3 min-w-0">
                                {user.avatar_url ? (
                                  <img
                                    src={user.avatar_url}
                                    alt={user.name}
                                    className="w-9 h-9 rounded-full object-cover ring-1 ring-slate-200 dark:ring-slate-700 shrink-0 shadow-2xs"
                                  />
                                ) : (
                                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-600 to-brand-800 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                                    {(user.name || "U").charAt(0).toUpperCase()}
                                  </div>
                                )}
                                <div className="min-w-0 flex-1">
                                  <p
                                    className="font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-sm truncate leading-snug"
                                    title={user.name}
                                  >
                                    {user.name}
                                  </p>
                                  {user.contact_number ? (
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1 mt-0.5 truncate">
                                      <Phone className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                                      <a
                                        href={`tel:${user.contact_number}`}
                                        className="hover:text-brand-700 dark:hover:text-brand-300 font-mono transition-colors"
                                      >
                                        {user.contact_number}
                                      </a>
                                    </p>
                                  ) : (
                                    <p className="text-[10.5px] text-slate-400 dark:text-slate-500 mt-0.5">
                                      No phone listed
                                    </p>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Email Address */}
                            <td className="py-3.5 px-3 sm:px-4 min-w-0">
                              <a
                                href={`mailto:${user.email}`}
                                className="text-xs text-slate-700 dark:text-slate-300 hover:text-brand-700 dark:hover:text-brand-300 font-mono transition-colors truncate block"
                                title={user.email}
                              >
                                {user.email}
                              </a>
                            </td>

                            {/* Role Badge */}
                            <td className="py-3.5 px-3 sm:px-4">
                              {isStudent ? (
                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/70 shadow-xs">
                                  Student
                                </span>
                              ) : isGuest ? (
                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border border-sky-200/80 dark:border-sky-800/70 shadow-xs">
                                  Guest
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-xs">
                                  {user.role}
                                </span>
                              )}
                            </td>

                            {/* Provider Badge */}
                            <td className="py-3.5 px-3 sm:px-4">
                              {isGoogle ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-2xs">
                                  <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
                                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                                  </svg>
                                  Google
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-2xs">
                                  <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                                  Email
                                </span>
                              )}
                            </td>

                            {/* Registered Date & Time */}
                            <td className="py-3.5 px-3 sm:px-4">
                              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                                {user.created_at ? new Date(user.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "N/A"}
                              </p>
                              {user.created_at && (
                                <p className="text-[10.5px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">
                                  {new Date(user.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}
                                </p>
                              )}
                            </td>

                            {/* Actions */}
                            <td className="py-3.5 px-3 sm:px-4 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => openEditUserModal(user)}
                                  className="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-brand-700 dark:hover:text-brand-400 hover:border-brand-300 dark:hover:border-brand-700 hover:bg-brand-50/60 dark:hover:bg-brand-950/40 flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95"
                                  title="Edit Account Details"
                                  aria-label="Edit Account Details"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                {currentUser?.id !== user.id && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteUser(user.id, user.name)}
                                    className="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-300 dark:hover:border-rose-800 hover:bg-rose-50/60 dark:hover:bg-rose-950/40 flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95"
                                    title="Delete Account"
                                    aria-label="Delete Account"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}

                      {/* Spacer rows so card stays exactly 5 rows tall on all filters */}
                      {paginatedAccounts.length < STUDENT_PAGE_SIZE && (
                        Array.from({ length: STUDENT_PAGE_SIZE - paginatedAccounts.length }).map((_, idx) => (
                          <tr key={`spacer-${idx}`} className="h-[58px] pointer-events-none select-none">
                            <td colSpan={7} className="py-2.5 px-3 sm:px-4 text-transparent opacity-0">&nbsp;</td>
                          </tr>
                        ))
                      )}
                    </>
                  )}
                </tbody>
              </table>
            </div>

            {/* Desktop Table Footer: Fixed Pagination Bar */}
            <div className="px-4 py-3 sm:px-6 bg-slate-50/80 dark:bg-slate-800/70 border-t border-slate-200/80 dark:border-slate-800/90 flex items-center justify-between gap-3 text-xs shrink-0">
              <div className="flex items-center gap-1.5 font-medium text-slate-500 dark:text-slate-400 text-[11px] flex-wrap">
                <span>Showing</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{startRecord}</span>
                <span>to</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{endRecord}</span>
                <span>of</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{studentAccounts.length}</span>
                <span>{studentSearch ? "matching accounts" : "accounts"}</span>
                {studentSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setStudentSearch("");
                      setTempStudentSearch("");
                      setStudentPage(1);
                      setMobileStudentPage(1);
                    }}
                    className="ml-2 inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                  >
                    <span>Clear filter</span>
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setStudentPage((p) => Math.max(1, p - 1))}
                  disabled={currentStudentPage <= 1}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer flex items-center gap-1 text-xs shadow-2xs"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Prev</span>
                </button>

                <div className="flex items-center gap-1 px-1">
                  {Array.from({ length: totalStudentPages }, (_, i) => i + 1).map((pageNum) => (
                    <button
                      key={pageNum}
                      type="button"
                      onClick={() => setStudentPage(pageNum)}
                      className={`w-7 h-7 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        currentStudentPage === pageNum
                          ? "bg-brand-600 text-white shadow-xs"
                          : "text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-700"
                      }`}
                    >
                      {pageNum}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setStudentPage((p) => Math.min(totalStudentPages, p + 1))}
                  disabled={currentStudentPage >= totalStudentPages}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer flex items-center gap-1 text-xs shadow-2xs"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      );
      })()}
        </main>
      </div>
      </div>

      {/* MODAL 1: MANAGE & DETAILS PRINT JOB */}
      {selectedJob && (
        <>
          <div 
            className="fixed inset-0 !m-0 top-0 left-0 right-0 bottom-0 z-[100] bg-slate-900/60 dark:bg-black/75 backdrop-blur-sm animate-in fade-in duration-150 overscroll-contain touch-none"
            onClick={() => setSelectedJob(null)}
            aria-hidden="true"
          />
          <div className="fixed inset-0 !m-0 top-0 left-0 right-0 bottom-0 z-[101] pointer-events-none flex flex-col items-center justify-center p-2 sm:p-3 md:p-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-[max(0.5rem,env(safe-area-inset-top))] overscroll-contain">
            <div 
              style={{ maxHeight: "calc(100dvh - 1rem)" }}
              className="pointer-events-auto bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl max-w-lg md:max-w-3xl lg:max-w-4xl w-full shadow-2xl flex flex-col overflow-hidden my-auto overscroll-contain animate-in zoom-in-95 duration-150 border border-slate-200/80 dark:border-slate-800/90"
            >
              {/* Header (Pinned) */}
              <div className="p-4 sm:p-5 pb-3 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-3 shrink-0 bg-white dark:bg-slate-900">
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap mb-1">
                    <span className="font-mono font-bold text-xs text-brand-700 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/50 border border-brand-200/80 dark:border-brand-800/70 px-2 py-0.5 rounded-md">
                      {selectedJob.tracking_code.startsWith("SK") || selectedJob.tracking_code.startsWith("PRN")
                        ? selectedJob.tracking_code
                        : `SK${selectedJob.tracking_code}`}
                    </span>
                    {(Number(selectedJob.is_urgent) === 1 || selectedJob.is_urgent === true) && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/70">
                        <Zap className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400 fill-amber-500" /> Rush
                      </span>
                    )}
                    <PrintStatusBadge status={selectedJob.status} size="sm" />
                  </div>

                  <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 leading-tight">
                    {selectedJob.student_name}
                  </h3>

                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                    Submitted: {new Date(selectedJob.created_at).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit"
                    })}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedJob(null)}
                  className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  aria-label="Close modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable Body */}
              <div className="p-4 sm:p-5 pt-3 space-y-4 overflow-y-auto flex-1 min-h-0">
                {/* Main Content Grid: 2 columns on desktop (md+) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                  {/* Left Card: Student Information */}
                  <div className="bg-slate-50/70 dark:bg-slate-800/60 rounded-xl p-3.5 sm:p-4 border border-slate-200/70 dark:border-slate-800/80 flex flex-col justify-between gap-3 text-xs">
                    <div className="space-y-2.5">
                      <p className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px]">
                        Student Information
                      </p>

                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <span className="text-slate-400 dark:text-slate-500 text-[10px] block">Contact Number</span>
                          {selectedJob.contact_number ? (
                            <a
                              href={`tel:${selectedJob.contact_number}`}
                              className="font-semibold text-brand-700 dark:text-brand-400 hover:underline"
                            >
                              {selectedJob.contact_number}
                            </a>
                          ) : (
                            <span className="text-slate-500 dark:text-slate-400">—</span>
                          )}
                        </div>

                        <div>
                          <span className="text-slate-400 dark:text-slate-500 text-[10px] block mb-0.5">Facebook Account</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200 break-words block leading-snug">
                            {selectedJob.facebook_name || "—"}
                          </span>
                        </div>

                        <div>
                          <span className="text-slate-400 dark:text-slate-500 text-[10px] block mb-0.5">Purok</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200 break-words block leading-snug">
                            {selectedJob.purok || "—"}
                          </span>
                        </div>

                        <div>
                          <span className="text-slate-400 dark:text-slate-500 text-[10px] block mb-0.5">School &amp; Grade Level</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200 break-words block leading-snug">
                            {selectedJob.school ? `${selectedJob.school} (${selectedJob.grade_level})` : "—"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {selectedJob.notes && (
                      <div className="pt-2 border-t border-slate-200/70 dark:border-slate-800/80">
                        <span className="text-slate-400 dark:text-slate-500 text-[10px] block mb-1">Student Notes:</span>
                        <p className="text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200/70 dark:border-slate-800/80 text-xs italic break-words leading-relaxed">
                          &ldquo;{selectedJob.notes}&rdquo;
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Right Card: Print Specifications */}
                  <div className="bg-slate-50/70 dark:bg-slate-800/60 rounded-xl p-3.5 sm:p-4 border border-slate-200/70 dark:border-slate-800/80 flex flex-col justify-between gap-3 text-xs">
                    <div className="space-y-3">
                      <p className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px]">
                        Print Specifications
                      </p>

                      <div className="space-y-2.5">
                        {/* Document File */}
                        <div>
                          <span className="text-slate-400 dark:text-slate-500 text-[10px] block mb-0.5">Document File</span>
                          <p className="font-semibold text-slate-900 dark:text-slate-100 break-words leading-snug">
                            {selectedJob.file_name}
                            {selectedJob.file_size ? (
                              <span className="text-slate-400 dark:text-slate-500 font-normal text-[10.5px] ml-1.5 whitespace-nowrap">
                                ({(Number(selectedJob.file_size) / 1024).toFixed(0)} KB)
                              </span>
                            ) : null}
                          </p>
                        </div>

                        {/* Format & Copies (2 Columns) */}
                        <div className="grid grid-cols-2 gap-2.5 pt-0.5">
                          <div>
                            <span className="text-slate-400 dark:text-slate-500 text-[10px] block mb-0.5">Color &amp; Paper Size</span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200 break-words block leading-snug">
                              {selectedJob.print_type} • {selectedJob.paper_size}
                            </span>
                          </div>

                          <div>
                            <span className="text-slate-400 dark:text-slate-500 text-[10px] block mb-0.5">Copies &amp; Page Range</span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200 break-words block leading-snug">
                              {selectedJob.copies} cop{selectedJob.copies > 1 ? "ies" : "y"}
                              {selectedJob.page_range ? ` (${selectedJob.page_range})` : ""}
                            </span>
                          </div>
                        </div>

                        {/* Priority */}
                        <div>
                          <span className="text-slate-400 dark:text-slate-500 text-[10px] block mb-0.5">Priority</span>
                          {(Number(selectedJob.is_urgent) === 1 || selectedJob.is_urgent === true) ? (
                            <span className="font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-1">
                              <Zap className="w-3 h-3 text-amber-600 dark:text-amber-400 fill-amber-500" /> Rush Priority
                            </span>
                          ) : (
                            <span className="text-slate-700 dark:text-slate-300 font-medium">Standard (1–2 Days)</span>
                          )}
                        </div>

                        {/* Claim Station */}
                        <div>
                          <span className="text-slate-400 dark:text-slate-500 text-[10px] block mb-0.5">Claim Station</span>
                          <span className="font-semibold text-emerald-800 dark:text-emerald-300 break-words block leading-snug">
                            {selectedJob.pickup_station || "Barangay Station"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <a
                      href={selectedJob.file_path}
                      target="_blank"
                      rel="noopener noreferrer"
                      download={selectedJob.file_path.startsWith("http") ? undefined : selectedJob.file_name}
                      className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 font-semibold text-xs transition-colors shadow-2xs cursor-pointer mt-1"
                    >
                      <Download className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                      <span>{selectedJob.file_path.includes("drive.google.com") ? "Open in Google Drive" : selectedJob.file_path.startsWith("http") ? "Open Document (Cloud)" : "Download Document File"}</span>
                    </a>
                  </div>
                </div>

                {/* Status Stepper */}
                <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px]">
                      Update Queue Status
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">Click a step to advance</span>
                  </div>

                  <div className="bg-slate-50/70 dark:bg-slate-800/60 rounded-xl p-3 border border-slate-200/70 dark:border-slate-800/80">
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { name: "Pending Review", label: "Received", icon: Clock },
                        { name: "Printing In Progress", label: "Printing", icon: Loader2 },
                        { name: "Ready for Pickup", label: "Ready", icon: CheckCircle2 },
                        { name: "Completed", label: "Claimed", icon: Check },
                      ].map((step, idx) => {
                        const sequence = ["Pending Review", "Printing In Progress", "Ready for Pickup", "Completed"];
                        const currentIdx = sequence.indexOf(selectedJob.status);
                        const isCurrent = selectedJob.status === step.name;
                        const isPassed = currentIdx !== -1 && currentIdx > idx;
                        const Icon = step.icon;

                        return (
                          <button
                            key={step.name}
                            type="button"
                            onClick={() => updateJobStatus(selectedJob.id, step.name, adminNoteInput)}
                            className="flex flex-col items-center gap-1.5 group cursor-pointer focus:outline-none transition-all"
                            title={`Set status to ${step.name}`}
                          >
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                                isCurrent
                                  ? "bg-brand-600 text-white font-bold ring-2 ring-brand-200 dark:ring-brand-800/70 shadow-xs"
                                  : isPassed
                                  ? "bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/80 hover:bg-emerald-200 dark:hover:bg-emerald-900/70"
                                  : "bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-800 hover:text-slate-600 dark:hover:text-slate-300 shadow-2xs"
                              }`}
                            >
                              {isPassed ? (
                                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                              ) : (
                                <Icon className={`w-3.5 h-3.5 ${isCurrent && step.name === "Printing In Progress" ? "animate-spin" : ""}`} />
                              )}
                            </div>
                            <span
                              className={`text-[11px] font-semibold text-center transition-colors ${
                                isCurrent
                                  ? "text-slate-900 dark:text-slate-100 font-bold"
                                  : isPassed
                                  ? "text-emerald-800 dark:text-emerald-300"
                                  : "text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300"
                              }`}
                            >
                              {step.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Note for Student */}
                <div className="space-y-1.5 pt-1 border-t border-slate-100 dark:border-slate-800">
                  <label className="block font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px]">
                    Note for Student (Visible on their tracker)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Printed and ready at Desk 2 counter."
                    value={adminNoteInput}
                    onChange={(e) => setAdminNoteInput(e.target.value)}
                    onBlur={() => {
                      if (adminNoteInput !== (selectedJob.admin_notes || "")) {
                        updateJobStatus(selectedJob.id, selectedJob.status, adminNoteInput);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (adminNoteInput !== (selectedJob.admin_notes || "")) {
                          updateJobStatus(selectedJob.id, selectedJob.status, adminNoteInput);
                        }
                      }
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-brand-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                  />
                </div>
              </div>

              {/* Footer (Pinned) */}
              <div className="px-4 py-2.5 sm:px-5 sm:py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/60 flex items-center justify-between gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    if (selectedJob.status === "Declined") {
                      updateJobStatus(selectedJob.id, "Pending Review", adminNoteInput);
                    } else {
                      updateJobStatus(selectedJob.id, "Declined", adminNoteInput || "Exceeded educational guidelines");
                    }
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    selectedJob.status === "Declined"
                      ? "bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/70"
                      : "text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 border border-rose-200/80 dark:border-rose-800/70"
                  }`}
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>{selectedJob.status === "Declined" ? "Re-open" : "Decline Request"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (adminNoteInput !== (selectedJob.admin_notes || "")) {
                      updateJobStatus(selectedJob.id, selectedJob.status, adminNoteInput);
                    }
                    setSelectedJob(null);
                  }}
                  className="px-4 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white active:scale-95 text-white dark:text-slate-900 text-xs font-semibold transition-all cursor-pointer shadow-xs"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* MODAL 2: ADD EXPENSE */}
      {showAddExpenseModal && (
        <>
          <div 
            className="fixed inset-0 !m-0 top-0 left-0 right-0 bottom-0 z-[100] bg-slate-900/60 dark:bg-black/75 backdrop-blur-sm animate-in fade-in duration-150 overscroll-contain touch-none"
            onClick={() => setShowAddExpenseModal(false)}
            aria-hidden="true"
          />
          <div className="fixed inset-0 !m-0 top-0 left-0 right-0 bottom-0 z-[101] pointer-events-none flex items-center justify-center p-2.5 sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))] overscroll-contain">
            <form
              onSubmit={handleCreateExpense}
              style={{
                maxHeight: "calc(100dvh - 1.5rem - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))",
              }}
              className="pointer-events-auto bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl max-w-lg w-full shadow-2xl flex flex-col my-auto max-h-[calc(100dvh-1.5rem)] overflow-hidden overscroll-contain animate-in zoom-in-95 duration-150"
            >
              {/* Pinned Header */}
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800 p-4 sm:p-6 pb-3 shrink-0 bg-white dark:bg-slate-900">
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">Record New Expenditure</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Post an official disbursed expense to the public ledger</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddExpenseModal(false)}
                  className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable Form Content */}
              <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4 overscroll-contain">

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Project / Particulars Title <span className="text-rose-500 dark:text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Procurement of Bond Paper & Ink for Student Printing"
                value={expenseForm.title}
                onChange={(e) => setExpenseForm({ ...expenseForm, title: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-brand-600 bg-slate-50/50 dark:bg-slate-800/50"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Category <span className="text-rose-500 dark:text-rose-400">*</span>
                </label>
                <select
                  value={expenseForm.category}
                  onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-brand-600 bg-slate-50/50 dark:bg-slate-800/50 font-medium"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Amount in PHP <span className="text-rose-500 dark:text-rose-400">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-brand-600 bg-slate-50/50 dark:bg-slate-800/50"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Disbursement Date <span className="text-rose-500 dark:text-rose-400">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={expenseForm.date}
                  onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-brand-600 bg-slate-50/50 dark:bg-slate-800/50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Voucher / OR Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. DV-2026-10-045"
                  value={expenseForm.voucher_no}
                  onChange={(e) => setExpenseForm({ ...expenseForm, voucher_no: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-brand-600 bg-slate-50/50 dark:bg-slate-800/50 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Payee / Vendor / Supplier
              </label>
              <input
                type="text"
                placeholder="e.g. Dagupan School Supplies Depot"
                value={expenseForm.payee}
                onChange={(e) => setExpenseForm({ ...expenseForm, payee: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-brand-600 bg-slate-50/50 dark:bg-slate-800/50"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Description / Purpose
              </label>
              <textarea
                rows={2}
                placeholder="Detailed explanation of purchase..."
                value={expenseForm.description}
                onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-brand-600 bg-slate-50/50 dark:bg-slate-800/50"
              ></textarea>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Attach Official Receipt / Voucher Photo or PDF
              </label>
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.pdf"
                onChange={(e) => setReceiptFile(e.target.files ? e.target.files[0] : null)}
                className="w-full text-xs text-slate-500 dark:text-slate-400 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-brand-50 dark:file:bg-brand-950/60 file:text-brand-700 dark:file:text-brand-300 hover:file:bg-brand-100 dark:hover:file:bg-brand-900/70"
              />
            </div>

              </div>

              {/* Pinned Footer */}
              <div className="p-4 sm:p-6 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2 shrink-0 bg-white dark:bg-slate-900">
                <button
                  type="button"
                  onClick={() => setShowAddExpenseModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={expenseSubmitting}
                  className="px-5 py-2 rounded-xl bg-brand-700 hover:bg-brand-800 text-white text-xs font-bold shadow-md cursor-pointer transition-colors active:scale-95 disabled:opacity-50"
                >
                  {expenseSubmitting ? "Posting..." : "Publish to Transparency Portal"}
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* MODAL: EDIT EXPENSE */}
      {showEditExpenseModal && editingExpense && (
        <>
          <div 
            className="fixed inset-0 !m-0 top-0 left-0 right-0 bottom-0 z-[100] bg-slate-900/60 dark:bg-black/75 backdrop-blur-sm animate-in fade-in duration-150 overscroll-contain touch-none"
            onClick={() => {
              setShowEditExpenseModal(false);
              setEditingExpense(null);
            }}
            aria-hidden="true"
          />
          <div className="fixed inset-0 !m-0 top-0 left-0 right-0 bottom-0 z-[101] pointer-events-none flex items-center justify-center p-2.5 sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))] overscroll-contain">
            <form
              onSubmit={handleEditExpenseSubmit}
              style={{
                maxHeight: "calc(100dvh - 1.5rem - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))",
              }}
              className="pointer-events-auto bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl max-w-lg w-full shadow-2xl flex flex-col my-auto max-h-[calc(100dvh-1.5rem)] overflow-hidden overscroll-contain animate-in zoom-in-95 duration-150"
            >
              {/* Pinned Header */}
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800 p-4 sm:p-6 pb-3 shrink-0 bg-white dark:bg-slate-900">
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">Edit Expenditure Record</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Update particulars, committee, or amount</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowEditExpenseModal(false);
                    setEditingExpense(null);
                  }}
                  className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable Form Content */}
              <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4 overscroll-contain">

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Project / Particulars Title <span className="text-rose-500 dark:text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={editExpenseForm.title}
                onChange={(e) => setEditExpenseForm({ ...editExpenseForm, title: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-brand-600 bg-slate-50/50 dark:bg-slate-800/50"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Category <span className="text-rose-500 dark:text-rose-400">*</span>
                </label>
                <select
                  value={editExpenseForm.category}
                  onChange={(e) => setEditExpenseForm({ ...editExpenseForm, category: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-brand-600 bg-slate-50/50 dark:bg-slate-800/50 font-medium"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Amount in PHP <span className="text-rose-500 dark:text-rose-400">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={editExpenseForm.amount}
                  onChange={(e) => setEditExpenseForm({ ...editExpenseForm, amount: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-brand-600 bg-slate-50/50 dark:bg-slate-800/50"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Disbursement Date <span className="text-rose-500 dark:text-rose-400">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={editExpenseForm.date}
                  onChange={(e) => setEditExpenseForm({ ...editExpenseForm, date: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-brand-600 bg-slate-50/50 dark:bg-slate-800/50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Voucher / OR Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. DV-2026-10-045"
                  value={editExpenseForm.voucher_no}
                  onChange={(e) => setEditExpenseForm({ ...editExpenseForm, voucher_no: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-brand-600 bg-slate-50/50 dark:bg-slate-800/50 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Payee / Supplier
              </label>
              <input
                type="text"
                placeholder="e.g. Pangasinan School Depot"
                value={editExpenseForm.payee}
                onChange={(e) => setEditExpenseForm({ ...editExpenseForm, payee: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-brand-600 bg-slate-50/50 dark:bg-slate-800/50"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Detailed Scope / Description
              </label>
              <textarea
                rows={3}
                value={editExpenseForm.description}
                onChange={(e) => setEditExpenseForm({ ...editExpenseForm, description: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-brand-600 bg-slate-50/50 dark:bg-slate-800/50 resize-none"
              ></textarea>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Replace Receipt / Voucher Scan (Optional)
              </label>
              {editingExpense.receipt_url && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                  Current receipt:{" "}
                  <a
                    href={editingExpense.receipt_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-brand-600 dark:text-brand-400 underline font-semibold"
                  >
                    View existing attachment
                  </a>
                </p>
              )}
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.pdf"
                onChange={(e) => setEditReceiptFile(e.target.files?.[0] || null)}
                className="w-full text-xs text-slate-500 dark:text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-brand-50 dark:file:bg-brand-950/60 file:text-brand-700 dark:file:text-brand-300 hover:file:bg-brand-100 dark:hover:file:bg-brand-900/70"
              />
            </div>

              </div>

              {/* Pinned Footer */}
              <div className="p-4 sm:p-6 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2 shrink-0 bg-white dark:bg-slate-900">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditExpenseModal(false);
                    setEditingExpense(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editExpenseSubmitting}
                  className="px-5 py-2 rounded-xl bg-brand-700 hover:bg-brand-800 text-white text-xs font-bold shadow-md cursor-pointer transition-colors active:scale-95 disabled:opacity-50"
                >
                  {editExpenseSubmitting ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* MODAL 3: ADD / EDIT SK OFFICIAL */}
      {showAddUserModal && (
        <>
          <div 
            className="fixed inset-0 !m-0 top-0 left-0 right-0 bottom-0 z-[100] bg-slate-900/60 dark:bg-black/75 backdrop-blur-sm animate-in fade-in duration-150 overscroll-contain touch-none"
            onClick={() => {
              setShowAddUserModal(false);
              setEditingUser(null);
              setPendingCropFile(null);
            }}
            aria-hidden="true"
          />
          <div className="fixed inset-0 !m-0 top-0 left-0 right-0 bottom-0 z-[101] pointer-events-none flex items-center justify-center p-2.5 sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))] overscroll-contain">
            <form
              onSubmit={handleSaveUser}
              className="pointer-events-auto bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl max-w-lg md:max-w-3xl lg:max-w-4xl w-full shadow-2xl flex flex-col my-auto overflow-hidden animate-in zoom-in-95 duration-150"
              style={{
                maxHeight: "calc(100dvh - 1.5rem - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))",
              }}
            >
              {/* Pinned Header (shrink-0) */}
              <div className="shrink-0 border-b border-slate-100 dark:border-slate-800 p-4 sm:p-6 pb-3 sm:pb-4 bg-white dark:bg-slate-900">
                <h3 className="text-base sm:text-xl font-black text-slate-900 dark:text-slate-100 leading-tight">
                  {editingUser
                    ? isOfficialRole(editingUser.role)
                      ? "Edit Official & Access"
                      : "Edit User Account"
                    : isOfficialRole(userForm.role)
                      ? "Add SK Official Account"
                      : "Add Student / Guest Account"}
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                  {editingUser
                    ? isOfficialRole(editingUser.role)
                      ? `Update council profile and login credentials for ${editingUser.name}`
                      : `Update account profile and login credentials for ${editingUser.name}`
                    : isOfficialRole(userForm.role)
                      ? "Register an SK council member with login credentials"
                      : "Register a student or guest account with login credentials"}
                </p>
              </div>

              {/* Scrollable Middle Content Area (flex-1 min-h-0 overflow-y-auto) */}
              <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-5 overscroll-contain no-scrollbar">
                {/* Profile Photo (Left) + Basic Info (Right) */}
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6 pt-1">
                  {/* Left: Profile Picture */}
                  <div className="flex flex-col items-center justify-center shrink-0 sm:w-36">
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      className="hidden"
                      onChange={handleAvatarUpload}
                    />

                    <button
                      type="button"
                      disabled={avatarUploading}
                      onClick={() => avatarInputRef.current?.click()}
                      className="relative group w-24 h-24 sm:w-28 sm:h-28 rounded-full ring-4 ring-slate-100 dark:ring-slate-800 hover:ring-brand-500 p-0.5 bg-white dark:bg-slate-900 shrink-0 shadow-sm hover:shadow-md cursor-pointer transition-all disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-brand-600"
                      title="Click to choose a photo"
                    >
                      <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center bg-slate-100 dark:bg-slate-800">
                        {userForm.avatar_url ? (
                          <img
                            src={userForm.avatar_url}
                            alt={userForm.name || "Official avatar"}
                            className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                          />
                        ) : (
                          <div className="w-full h-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 font-black text-3xl">
                            {userForm.name ? userForm.name.charAt(0).toUpperCase() : <Camera className="w-8 h-8 text-slate-400 dark:text-slate-500" />}
                          </div>
                        )}
                      </div>

                      {/* Hover Overlay with Camera Icon */}
                      <div className="absolute inset-0.5 rounded-full bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white">
                        <Camera className="w-6 h-6 drop-shadow-sm mb-0.5" />
                        <span className="text-[10px] font-bold tracking-tight drop-shadow-sm">Change</span>
                      </div>

                      {/* Corner Camera Badge Button */}
                      <div className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-brand-700 text-white shadow-md flex items-center justify-center border-2 border-white dark:border-slate-900 group-hover:bg-brand-800 transition-colors">
                        {avatarUploading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Camera className="w-4 h-4" />
                        )}
                      </div>

                      {/* Loading Spinner during upload */}
                      {avatarUploading && (
                        <div className="absolute inset-0.5 bg-slate-900/60 dark:bg-black/75 flex flex-col items-center justify-center rounded-full text-white">
                          <Loader2 className="w-6 h-6 animate-spin mb-1 text-white" />
                          <span className="text-[10px] font-bold">Uploading...</span>
                        </div>
                      )}
                    </button>

                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-2 text-center">
                      {userForm.avatar_url ? "Click photo to change" : "Click photo to upload"}
                    </span>

                    {avatarUploadError && (
                      <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 flex items-center justify-center gap-1 mt-1 text-center">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        <span>{avatarUploadError}</span>
                      </p>
                    )}
                  </div>

                  {/* Right: Full Name, Role / Position, Contact Number */}
                  <div className="flex-1 min-w-0 w-full space-y-3.5">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                        Full Name
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Maria Santos"
                        value={userForm.name}
                        onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-brand-600 bg-slate-50/50 dark:bg-slate-800/50"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                          Role / Position
                        </label>
                        <select
                          value={userForm.role}
                          onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                          className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-brand-600 bg-slate-50/50 dark:bg-slate-800/50 font-medium cursor-pointer"
                        >
                          <option value="SK Chairperson">SK Chairperson</option>
                          <option value="SK Secretary">SK Secretary</option>
                          <option value="SK Treasurer">SK Treasurer</option>
                          <option value="SK Kagawad">SK Kagawad</option>
                          <option value="SK Staff / Custodian">SK Staff / Custodian</option>
                          <option value="Student">Student</option>
                          <option value="Guest">Guest</option>
                          {!["SK Chairperson", "SK Secretary", "SK Treasurer", "SK Kagawad", "SK Staff / Custodian", "Student", "Guest"].includes(userForm.role) && (
                            <option value={userForm.role}>{userForm.role}</option>
                          )}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                          Contact Number
                        </label>
                        <input
                          type="text"
                          placeholder="+63 912 ..."
                          value={userForm.contact_number}
                          onChange={(e) => setUserForm({ ...userForm, contact_number: e.target.value })}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-brand-600 bg-slate-50/50 dark:bg-slate-800/50"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* PORTAL ACCESS CREDENTIALS BOX */}
                <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/90 dark:border-slate-800">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                        {isOfficialRole(userForm.role) ? "Official Email (Login ID)" : "Email Address (Login ID)"}
                      </label>
                      <div className="relative">
                        <Mail className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                        <input
                          type="email"
                          required
                          placeholder={isOfficialRole(userForm.role) ? "e.g. maria.santos@sktocok.gov.ph" : "e.g. juan.delacruz@gmail.com"}
                          value={userForm.email}
                          onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                          className="w-full pl-8 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-brand-600 bg-white dark:bg-slate-900"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                        Password <span className="text-rose-500 dark:text-rose-400">*</span>
                      </label>
                      <div className="relative">
                        <Lock className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                        <input
                          type={showUserFormPassword ? "text" : "password"}
                          required
                          placeholder="Enter password (min 6 characters)"
                          value={userForm.password}
                          onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                          className="w-full pl-8 pr-9 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-brand-600 bg-white dark:bg-slate-900"
                        />
                        <button
                          type="button"
                          onClick={() => setShowUserFormPassword(!showUserFormPassword)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 p-1 cursor-pointer"
                        >
                          {showUserFormPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Pinned Footer (shrink-0) */}
              <div className="shrink-0 border-t border-slate-100 dark:border-slate-800 p-3.5 sm:p-5 bg-slate-50/80 dark:bg-slate-800/70 sm:bg-white dark:sm:bg-slate-900 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddUserModal(false);
                    setEditingUser(null);
                    setPendingCropFile(null);
                  }}
                  className="px-4 py-2 sm:py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={userSaving}
                  className="px-5 py-2 sm:py-2.5 rounded-xl bg-brand-700 hover:bg-brand-800 text-white text-xs font-bold shadow-md cursor-pointer disabled:opacity-50 transition-colors"
                >
                  {userSaving ? "Saving..." : editingUser ? "Save Changes" : "Create Account"}
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* MODAL 3B: CROP OFFICIAL AVATAR */}
      {showAddUserModal && pendingCropFile && (
        <AvatarCropModal
          file={pendingCropFile}
          applying={avatarUploading}
          error={avatarUploadError}
          onCancel={() => {
            setPendingCropFile(null);
            setAvatarUploadError(null);
          }}
          onChooseAnother={() => avatarInputRef.current?.click()}
          onApply={handleApplyCroppedAvatar}
        />
      )}

      {/* MODAL: ADD / EDIT CATEGORY */}
      {showCategoryModal && (
        <>
          <div 
            className="fixed inset-0 !m-0 top-0 left-0 right-0 bottom-0 z-[100] bg-slate-900/60 dark:bg-black/75 backdrop-blur-sm animate-in fade-in duration-150 overscroll-contain touch-none"
            onClick={() => {
              setShowCategoryModal(false);
              setEditingCategory(null);
            }}
            aria-hidden="true"
          />
          <div className="fixed inset-0 !m-0 top-0 left-0 right-0 bottom-0 z-[101] pointer-events-none flex items-center justify-center p-2.5 sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))] overscroll-contain">
            <form
              onSubmit={handleSaveCategory}
              style={{
                maxHeight: "calc(100dvh - 1.5rem - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))",
              }}
              className="pointer-events-auto bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl max-w-lg md:max-w-2xl lg:max-w-3xl xl:max-w-4xl w-full shadow-2xl flex flex-col my-auto max-h-[calc(100dvh-1.5rem)] overflow-hidden overscroll-contain animate-in zoom-in-95 duration-150"
            >
              {/* Pinned Header (shrink-0) */}
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800 p-4 sm:p-6 pb-3 sm:pb-4 shrink-0 bg-white dark:bg-slate-900">
                <div>
                  <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-slate-100">
                    {editingCategory ? "Edit Expense Category" : "Add New Expense Category"}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                    {editingCategory
                      ? "Updating the name will update all existing vouchers under this category"
                      : "Add a new youth development category for your expenses"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowCategoryModal(false);
                    setEditingCategory(null);
                  }}
                  className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable Middle Content Area (flex-1 min-h-0 overflow-y-auto) */}
              <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 md:p-8 space-y-4 md:space-y-6 overscroll-contain">
                {categoryError && (
                  <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/70 rounded-xl text-rose-700 dark:text-rose-300 text-xs font-medium">
                    {categoryError}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                  {/* Left Column: Form Details */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                        Category Name <span className="text-rose-500 dark:text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Livelihood &amp; Youth Entrepreneurship"
                        value={categoryForm.name}
                        onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-brand-600 bg-slate-50/50 dark:bg-slate-800/50"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                        Annual Budget Ceiling (ABYIP Allocation in PHP)
                      </label>
                      <input
                        type="number"
                        placeholder="e.g. 200000"
                        value={categoryForm.allocated_budget}
                        onChange={(e) => setCategoryForm({ ...categoryForm, allocated_budget: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-brand-600 bg-slate-50/50 dark:bg-slate-800/50 font-mono"
                      />
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Approved statutory committee budget ceiling under RA 10742</p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                        Description / Committee Scope
                      </label>
                      <textarea
                        rows={3}
                        placeholder="What projects and programs fall under this category?"
                        value={categoryForm.description}
                        onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-brand-600 bg-slate-50/50 dark:bg-slate-800/50 resize-none"
                      ></textarea>
                    </div>
                  </div>

                  {/* Right Column: Theme Color & Live Preview */}
                  <div className="space-y-4 flex flex-col justify-between">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                        Theme Color Badge
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { name: "blue", hex: "#548701", label: "Brand Green" },
                          { name: "amber", hex: "#d97706", label: "Amber" },
                          { name: "rose", hex: "#e11d48", label: "Rose" },
                          { name: "emerald", hex: "#059669", label: "Emerald" },
                          { name: "orange", hex: "#ea580c", label: "Orange" },
                          { name: "indigo", hex: "#4f46e5", label: "Indigo" },
                          { name: "purple", hex: "#9333ea", label: "Purple" },
                          { name: "teal", hex: "#0d9488", label: "Teal" },
                          { name: "cyan", hex: "#0891b2", label: "Cyan" },
                        ].map((c) => (
                          <button
                            type="button"
                            key={c.name}
                            onClick={() => setCategoryForm({ ...categoryForm, color: c.name })}
                            className={`flex items-center gap-1.5 p-2 rounded-lg border text-[11px] font-semibold transition-all cursor-pointer ${
                              categoryForm.color === c.name
                                ? "border-slate-800 bg-slate-100 dark:bg-slate-800 ring-2 ring-slate-800/20"
                                : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
                            }`}
                          >
                            <span
                              className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm"
                              style={{ backgroundColor: c.hex }}
                            ></span>
                            <span className="truncate">{c.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Ledger Preview Card */}
                    <div className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-800/90 space-y-2">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center justify-between">
                        <span>Ledger Preview</span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">Live preview</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs border border-white dark:border-slate-900"
                          style={{
                            backgroundColor:
                              categoryForm.color === "blue" || categoryForm.color === "brand" ? "#548701" :
                              categoryForm.color === "amber" ? "#d97706" :
                              categoryForm.color === "rose" ? "#e11d48" :
                              categoryForm.color === "emerald" ? "#059669" :
                              categoryForm.color === "orange" ? "#ea580c" :
                              categoryForm.color === "indigo" ? "#4f46e5" :
                              categoryForm.color === "purple" ? "#9333ea" :
                              categoryForm.color === "teal" ? "#0d9488" :
                              "#0891b2"
                          }}
                        />
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                          {categoryForm.name.trim() || "Category Name"}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 italic">
                        {categoryForm.description.trim() || "No scope description provided"}
                      </p>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between pt-1.5 border-t border-slate-200/60 dark:border-slate-700/70 font-mono">
                        <span className="text-slate-400 dark:text-slate-500 font-sans text-[10px] uppercase font-bold tracking-wider">Ceiling</span>
                        <span className="font-bold text-brand-700 dark:text-brand-400">
                          ₱{Number(categoryForm.allocated_budget || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Pinned Footer (shrink-0) */}
              <div className="p-4 sm:p-6 pt-3 sm:pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5 shrink-0 bg-white dark:bg-slate-900">
                <button
                  type="button"
                  onClick={() => {
                    setShowCategoryModal(false);
                    setEditingCategory(null);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={categorySubmitting}
                  className="px-6 py-2.5 rounded-xl bg-brand-700 hover:bg-brand-800 text-white text-xs font-bold shadow-md cursor-pointer transition-colors active:scale-95 disabled:opacity-50"
                >
                  {categorySubmitting ? "Saving..." : editingCategory ? "Update Category" : "Create Category"}
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* MODAL: RECORD NEW BANK DEPOSIT */}
      {showAddDepositModal && (
        <>
          <div 
            className="fixed inset-0 !m-0 top-0 left-0 right-0 bottom-0 z-[100] bg-slate-900/60 dark:bg-black/75 backdrop-blur-sm animate-in fade-in duration-150 overscroll-contain touch-none"
            onClick={() => setShowAddDepositModal(false)}
            aria-hidden="true"
          />
          <div className="fixed inset-0 !m-0 top-0 left-0 right-0 bottom-0 z-[101] pointer-events-none flex items-center justify-center p-2.5 sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))] overscroll-contain">
            <form
              onSubmit={handleCreateDeposit}
              style={{
                maxHeight: "calc(100dvh - 1.5rem - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))",
              }}
              className="pointer-events-auto bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl max-w-lg md:max-w-2xl lg:max-w-3xl xl:max-w-4xl w-full shadow-2xl flex flex-col my-auto max-h-[calc(100dvh-1.5rem)] overflow-hidden overscroll-contain animate-in zoom-in-95 duration-150"
            >
              {/* Pinned Header */}
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800 p-4 sm:p-6 pb-3 sm:pb-4 shrink-0 bg-white dark:bg-slate-900">
                <div>
                  <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-slate-100">Record Monthly Bank Remittance</h3>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">Record incoming 10% youth fund tranche from the Barangay</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddDepositModal(false)}
                  className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable Form Content */}
              <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 md:p-8 space-y-4 md:space-y-5 overscroll-contain">

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Reference / Deposit No. <span className="text-rose-500 dark:text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. DEP-2026-10-010"
                  value={depositForm.reference_no}
                  onChange={(e) => setDepositForm({ ...depositForm, reference_no: e.target.value })}
                  className="w-full px-3.5 py-2 sm:py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-indigo-600 bg-slate-50/50 dark:bg-slate-800/50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Deposit Date <span className="text-rose-500 dark:text-rose-400">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={depositForm.date}
                  onChange={(e) => setDepositForm({ ...depositForm, date: e.target.value })}
                  className="w-full px-3.5 py-2 sm:py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-600 bg-slate-50/50 dark:bg-slate-800/50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Remitting Source / LGU <span className="text-rose-500 dark:text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={depositForm.source}
                  onChange={(e) => setDepositForm({ ...depositForm, source: e.target.value })}
                  className="w-full px-3.5 py-2 sm:py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-600 bg-slate-50/50 dark:bg-slate-800/50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Remitted Amount (PHP) <span className="text-rose-500 dark:text-rose-400">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="55000.00"
                  value={depositForm.amount}
                  onChange={(e) => setDepositForm({ ...depositForm, amount: e.target.value })}
                  className="w-full px-3.5 py-2 sm:py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-600 bg-slate-50/50 dark:bg-slate-800/50"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Particulars / Remarks
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Barangay Tocok NTA 10% SK Share — October 2026 Monthly Tranche"
                  value={depositForm.description}
                  onChange={(e) => setDepositForm({ ...depositForm, description: e.target.value })}
                  className="w-full px-3.5 py-2 sm:py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-600 bg-slate-50/50 dark:bg-slate-800/50 resize-none"
                ></textarea>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Attach Land Bank Deposit Slip / Credit Memo
                </label>
                <input
                  type="file"
                  accept="image/*,.pdf,.svg"
                  onChange={(e) => setDepositAttachmentFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-500 dark:text-slate-400 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-50 dark:file:bg-indigo-950/60 file:text-indigo-700 dark:file:text-indigo-300 hover:file:bg-indigo-100 dark:hover:file:bg-indigo-900/70"
                />
              </div>
            </div>

              </div>

              {/* Pinned Footer */}
              <div className="p-4 sm:p-6 pt-3 sm:pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2 shrink-0 bg-white dark:bg-slate-900">
                <button
                  type="button"
                  onClick={() => setShowAddDepositModal(false)}
                  className="px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={depositSubmitting}
                  className="px-5 py-2 sm:px-6 sm:py-2.5 rounded-xl bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-bold shadow-md cursor-pointer transition-colors active:scale-95 disabled:opacity-50"
                >
                  {depositSubmitting ? "Saving..." : "Record Deposit"}
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* MODAL: EDIT BANK DEPOSIT */}
      {showEditDepositModal && editingDeposit && (
        <>
          <div 
            className="fixed inset-0 !m-0 top-0 left-0 right-0 bottom-0 z-[100] bg-slate-900/60 dark:bg-black/75 backdrop-blur-sm animate-in fade-in duration-150 overscroll-contain touch-none"
            onClick={() => {
              setShowEditDepositModal(false);
              setEditingDeposit(null);
            }}
            aria-hidden="true"
          />
          <div className="fixed inset-0 !m-0 top-0 left-0 right-0 bottom-0 z-[101] pointer-events-none flex items-center justify-center p-2.5 sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))] overscroll-contain">
            <form
              onSubmit={handleEditDepositSubmit}
              style={{
                maxHeight: "calc(100dvh - 1.5rem - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))",
              }}
              className="pointer-events-auto bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl max-w-lg md:max-w-2xl lg:max-w-3xl xl:max-w-4xl w-full shadow-2xl flex flex-col my-auto max-h-[calc(100dvh-1.5rem)] overflow-hidden overscroll-contain animate-in zoom-in-95 duration-150"
            >
              {/* Pinned Header */}
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800 p-4 sm:p-6 pb-3 sm:pb-4 shrink-0 bg-white dark:bg-slate-900">
                <div>
                  <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-slate-100">Edit Bank Remittance Record</h3>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">Update remittance particulars or validated deposit amount</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowEditDepositModal(false);
                    setEditingDeposit(null);
                  }}
                  className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable Form Content */}
              <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 md:p-8 space-y-4 md:space-y-5 overscroll-contain">

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Reference / Deposit No. <span className="text-rose-500 dark:text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editDepositForm.reference_no}
                  onChange={(e) => setEditDepositForm({ ...editDepositForm, reference_no: e.target.value })}
                  className="w-full px-3.5 py-2 sm:py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-indigo-600 bg-slate-50/50 dark:bg-slate-800/50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Deposit Date <span className="text-rose-500 dark:text-rose-400">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={editDepositForm.date}
                  onChange={(e) => setEditDepositForm({ ...editDepositForm, date: e.target.value })}
                  className="w-full px-3.5 py-2 sm:py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-600 bg-slate-50/50 dark:bg-slate-800/50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Remitting Source / LGU <span className="text-rose-500 dark:text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editDepositForm.source}
                  onChange={(e) => setEditDepositForm({ ...editDepositForm, source: e.target.value })}
                  className="w-full px-3.5 py-2 sm:py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-600 bg-slate-50/50 dark:bg-slate-800/50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Remitted Amount (PHP) <span className="text-rose-500 dark:text-rose-400">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={editDepositForm.amount}
                  onChange={(e) => setEditDepositForm({ ...editDepositForm, amount: e.target.value })}
                  className="w-full px-3.5 py-2 sm:py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-600 bg-slate-50/50 dark:bg-slate-800/50"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Particulars / Remarks
                </label>
                <textarea
                  rows={2}
                  value={editDepositForm.description}
                  onChange={(e) => setEditDepositForm({ ...editDepositForm, description: e.target.value })}
                  className="w-full px-3.5 py-2 sm:py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-600 bg-slate-50/50 dark:bg-slate-800/50 resize-none"
                ></textarea>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Replace Deposit Slip (Leave blank to keep existing)
                </label>
                <input
                  type="file"
                  accept="image/*,.pdf,.svg"
                  onChange={(e) => setEditDepositAttachmentFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-500 dark:text-slate-400 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-50 dark:file:bg-indigo-950/60 file:text-indigo-700 dark:file:text-indigo-300 hover:file:bg-indigo-100 dark:hover:file:bg-indigo-900/70"
                />
              </div>
            </div>

              </div>

              {/* Pinned Footer */}
              <div className="p-4 sm:p-6 pt-3 sm:pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2 shrink-0 bg-white dark:bg-slate-900">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditDepositModal(false);
                    setEditingDeposit(null);
                  }}
                  className="px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editDepositSubmitting}
                  className="px-5 py-2 sm:px-6 sm:py-2.5 rounded-xl bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-bold shadow-md cursor-pointer transition-colors active:scale-95 disabled:opacity-50"
                >
                  {editDepositSubmitting ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* MODAL: UNSAVED SETTINGS POPUP WINDOW */}
      {showUnsavedSettingsModal && (
        <>
          <div
            className="fixed inset-0 !m-0 top-0 left-0 right-0 bottom-0 z-[100] bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs animate-in fade-in duration-150 overscroll-contain"
            onClick={() => {
              setShowUnsavedSettingsModal(false);
              setPendingTab(null);
              setPendingHref(null);
              setPendingLogout(false);
            }}
          />
          <div className="fixed inset-0 !m-0 top-0 left-0 right-0 bottom-0 z-[101] flex items-center justify-center p-4 pointer-events-none">
            <div className="pointer-events-auto bg-white dark:bg-slate-900 rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 border border-slate-100 dark:border-slate-800 text-center animate-in zoom-in-95 duration-150">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto border border-amber-200 dark:border-amber-800/70">
                <AlertCircle className="w-6 h-6" />
              </div>
              
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Unsaved Settings
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  You made changes to Program Settings without saving. Would you like to save these changes now, or discard them?
                </p>
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="button"
                  disabled={settingsSaving}
                  onClick={async () => {
                    try {
                      setSettingsSaving(true);
                      const res = await fetch("/api/admin/settings", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(settings),
                      });
                      if (res.ok) {
                        setSavedSettings({ ...settings });
                        setSettingsSuccess(true);
                        setTimeout(() => setSettingsSuccess(false), 3000);
                      }
                    } catch (err) {
                      console.error(err);
                    } finally {
                      setSettingsSaving(false);
                      setShowUnsavedSettingsModal(false);
                      if (pendingTab) {
                        setActiveTab(pendingTab);
                        resetTabScroll();
                        setPendingTab(null);
                      } else if (pendingLogout) {
                        setPendingLogout(false);
                        await logout({ force: true });
                        router.replace("/");
                        router.refresh();
                      } else if (pendingHref) {
                        window.location.href = pendingHref;
                        setPendingHref(null);
                      }
                    }
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-brand-700 hover:bg-brand-800 text-white font-bold text-xs shadow-xs transition cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {settingsSaving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  <span>{settingsSaving ? "Saving..." : "Save & Continue"}</span>
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    setSettings({ ...savedSettings });
                    setShowUnsavedSettingsModal(false);
                    if (pendingTab) {
                      setActiveTab(pendingTab);
                      resetTabScroll();
                      setPendingTab(null);
                    } else if (pendingLogout) {
                      setPendingLogout(false);
                      await logout({ force: true });
                      router.replace("/");
                      router.refresh();
                    } else if (pendingHref) {
                      window.location.href = pendingHref;
                      setPendingHref(null);
                    }
                  }}
                  className="w-full py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  Discard Changes &amp; Leave
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowUnsavedSettingsModal(false);
                    setPendingTab(null);
                    setPendingHref(null);
                    setPendingLogout(false);
                  }}
                  className="w-full py-1 text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 font-medium transition cursor-pointer"
                >
                  Stay on Settings
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Minimalist Deposit Search Modal (Matches Transparency Ledger Search Modal) */}
      {showDepositSearchModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Search bank remittances"
          className="fixed inset-0 z-[100] bg-slate-950/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overscroll-contain select-none touch-none"
          style={{
            paddingTop: "max(0.75rem, env(safe-area-inset-top, 0px))",
            paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))",
            paddingLeft: "max(0.75rem, env(safe-area-inset-left, 0px))",
            paddingRight: "max(0.75rem, env(safe-area-inset-right, 0px))",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowDepositSearchModal(false);
          }}
          onWheel={(e) => {
            if (e.target === e.currentTarget) e.preventDefault();
          }}
          onTouchMove={(e) => {
            if (e.target === e.currentTarget) e.preventDefault();
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setDepositSearch(tempDepositSearch.trim());
              setDepositPage(1);
              setShowDepositSearchModal(false);
            }}
            className="relative bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200/90 dark:border-slate-800 overflow-hidden overscroll-contain select-text font-sans touch-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Minimalist Search Input Row */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 dark:border-slate-800">
              <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
              <input
                ref={depositSearchInputRef}
                type="text"
                autoFocus
                inputMode="search"
                placeholder="Search reference no., remitting source, particulars..."
                value={tempDepositSearch}
                onChange={(e) => setTempDepositSearch(e.target.value)}
                className="w-full bg-transparent text-sm [line-height:normal] py-0.5 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
              />
              {tempDepositSearch && (
                <button
                  type="button"
                  onClick={() => setTempDepositSearch("")}
                  className="p-1 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer shrink-0"
                  title="Clear input"
                  aria-label="Clear input"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Subtle Footer Bar */}
            <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-slate-50/70 dark:bg-slate-800/60">
              {depositSearch ? (
                <button
                  type="button"
                  onClick={() => {
                    setTempDepositSearch("");
                    setDepositSearch("");
                    setDepositPage(1);
                    setShowDepositSearchModal(false);
                  }}
                  className="text-xs font-medium text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 transition cursor-pointer"
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
                  onClick={() => setShowDepositSearchModal(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition cursor-pointer shadow-sm"
                >
                  Search
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Official Bank Deposit Slip Preview Modal (Matches Transparency Ledger Modal) */}
      {selectedDepositSlip && (
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
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-slate-800/90 bg-white dark:bg-slate-900 flex items-start justify-between gap-3 shrink-0">
              <div className="space-y-1 min-w-0 pr-2">
                <span className="text-[10px] sm:text-[10.5px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                  OFFICIAL REMITTANCE / DEPOSIT PARTICULARS:
                </span>
                <h3 className="font-serif font-black text-slate-900 dark:text-slate-100 text-base sm:text-lg lg:text-xl leading-snug tracking-tight">
                  {selectedDepositSlip.source} — {selectedDepositSlip.reference_no}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setSelectedDepositSlip(null)}
                className="p-1.5 sm:p-2 rounded-xl text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                title="Close Window (Esc)"
                aria-label="Close Window"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4 pr-3 sm:pr-5 themed-scrollbar overscroll-contain">
              {/* Financial Dossier Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
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

              {/* Bank Deposit Slip Preview */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <Landmark className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    Official Bank Deposit Slip / LBP Validation Record
                  </span>
                  {selectedDepositSlip.attachment_url && (
                    <a
                      href={selectedDepositSlip.attachment_url}
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
                      src={selectedDepositSlip.attachment_url}
                      alt="Official Bank Deposit Slip"
                      className="w-full max-w-xl h-auto rounded-lg shadow-xs bg-white mx-auto block"
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
                {selectedDepositSlip.attachment_url && (
                  <a
                    href={selectedDepositSlip.attachment_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold border border-slate-300 dark:border-slate-700 shadow-2xs transition-colors cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                    <span>Open in New Tab</span>
                  </a>
                )}

                <button
                  type="button"
                  onClick={() => setSelectedDepositSlip(null)}
                  className="px-5 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 font-bold transition-colors cursor-pointer shadow-xs active:scale-95"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* POPUP MODAL: DISBURSEMENT RECORDS SEARCH (MINIMALIST) */}
      {showExpenseSearchModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Search disbursement records"
          className="fixed inset-0 z-[100] bg-slate-950/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overscroll-contain select-none touch-none"
          style={{
            paddingTop: "max(0.75rem, env(safe-area-inset-top, 0px))",
            paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))",
            paddingLeft: "max(0.75rem, env(safe-area-inset-left, 0px))",
            paddingRight: "max(0.75rem, env(safe-area-inset-right, 0px))",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowExpenseSearchModal(false);
          }}
          onWheel={(e) => {
            if (e.target === e.currentTarget) e.preventDefault();
          }}
          onTouchMove={(e) => {
            if (e.target === e.currentTarget) e.preventDefault();
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setExpenseSearch(tempExpenseSearch.trim());
              setExpensePage(1);
              setShowExpenseSearchModal(false);
            }}
            className="relative bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200/90 dark:border-slate-800 overflow-hidden overscroll-contain select-text font-sans touch-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Minimalist Search Input Row */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 dark:border-slate-800">
              <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
              <input
                ref={expenseSearchInputRef}
                type="text"
                autoFocus
                inputMode="search"
                placeholder="Search project, voucher no., payee, or particulars..."
                value={tempExpenseSearch}
                onChange={(e) => setTempExpenseSearch(e.target.value)}
                className="w-full bg-transparent text-sm [line-height:normal] py-0.5 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
              />
              {tempExpenseSearch && (
                <button
                  type="button"
                  onClick={() => setTempExpenseSearch("")}
                  className="p-1 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer shrink-0"
                  title="Clear input"
                  aria-label="Clear input"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Subtle Footer Bar */}
            <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-slate-50/70 dark:bg-slate-800/60">
              {expenseSearch ? (
                <button
                  type="button"
                  onClick={() => {
                    setTempExpenseSearch("");
                    setExpenseSearch("");
                    setExpensePage(1);
                    setShowExpenseSearchModal(false);
                  }}
                  className="text-xs font-medium text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 transition cursor-pointer"
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
                  onClick={() => setShowExpenseSearchModal(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold transition cursor-pointer shadow-sm"
                >
                  Search
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* POPUP MODAL: PRINT QUEUE SEARCH (MINIMALIST) */}
      {showQueueSearchModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Search print queue requests"
          className="fixed inset-0 z-[100] bg-slate-950/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overscroll-contain select-none touch-none"
          style={{
            paddingTop: "max(0.75rem, env(safe-area-inset-top, 0px))",
            paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))",
            paddingLeft: "max(0.75rem, env(safe-area-inset-left, 0px))",
            paddingRight: "max(0.75rem, env(safe-area-inset-right, 0px))",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowQueueSearchModal(false);
          }}
          onWheel={(e) => {
            if (e.target === e.currentTarget) e.preventDefault();
          }}
          onTouchMove={(e) => {
            if (e.target === e.currentTarget) e.preventDefault();
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setJobSearch(tempQueueSearch.trim());
              setQueuePage(1);
              setMobileQueuePage(1);
              setShowQueueSearchModal(false);
            }}
            className="relative bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200/90 dark:border-slate-800 overflow-hidden overscroll-contain select-text font-sans touch-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Minimalist Search Input Row */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 dark:border-slate-800">
              <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
              <input
                ref={queueSearchInputRef}
                type="text"
                autoFocus
                inputMode="search"
                placeholder="Search student, tracking code, school, or file..."
                value={tempQueueSearch}
                onChange={(e) => setTempQueueSearch(e.target.value)}
                className="w-full bg-transparent text-sm [line-height:normal] py-0.5 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
              />
              {tempQueueSearch && (
                <button
                  type="button"
                  onClick={() => setTempQueueSearch("")}
                  className="p-1 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer shrink-0"
                  title="Clear input"
                  aria-label="Clear input"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Subtle Footer Bar */}
            <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-slate-50/70 dark:bg-slate-800/60">
              {jobSearch ? (
                <button
                  type="button"
                  onClick={() => {
                    setTempQueueSearch("");
                    setJobSearch("");
                    setQueuePage(1);
                    setMobileQueuePage(1);
                    setShowQueueSearchModal(false);
                  }}
                  className="text-xs font-medium text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 transition cursor-pointer"
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
                  onClick={() => setShowQueueSearchModal(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold transition cursor-pointer shadow-sm"
                >
                  Search
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: SEARCH STUDENT / GUEST ACCOUNTS */}
      {showStudentSearchModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Search student and guest accounts"
          className="fixed inset-0 z-[100] bg-slate-950/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overscroll-contain select-none touch-none"
          style={{
            paddingTop: "max(0.75rem, env(safe-area-inset-top, 0px))",
            paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))",
            paddingLeft: "max(0.75rem, env(safe-area-inset-left, 0px))",
            paddingRight: "max(0.75rem, env(safe-area-inset-right, 0px))",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowStudentSearchModal(false);
          }}
          onWheel={(e) => {
            if (e.target === e.currentTarget) e.preventDefault();
          }}
          onTouchMove={(e) => {
            if (e.target === e.currentTarget) e.preventDefault();
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setStudentSearch(tempStudentSearch.trim());
              setStudentPage(1);
              setMobileStudentPage(1);
              setShowStudentSearchModal(false);
            }}
            className="relative bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200/90 dark:border-slate-800 overflow-hidden overscroll-contain select-text font-sans touch-auto animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Minimalist Search Input Row */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 dark:border-slate-800">
              <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
              <input
                ref={studentSearchInputRef}
                type="text"
                autoFocus
                inputMode="search"
                placeholder="Search student by name, email, role, or contact..."
                value={tempStudentSearch}
                onChange={(e) => setTempStudentSearch(e.target.value)}
                className="w-full bg-transparent text-sm [line-height:normal] py-0.5 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
              />
              {tempStudentSearch && (
                <button
                  type="button"
                  onClick={() => setTempStudentSearch("")}
                  className="p-1 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer shrink-0"
                  title="Clear input"
                  aria-label="Clear input"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Subtle Footer Bar */}
            <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-slate-50/70 dark:bg-slate-800/60">
              {studentSearch ? (
                <button
                  type="button"
                  onClick={() => {
                    setTempStudentSearch("");
                    setStudentSearch("");
                    setStudentPage(1);
                    setMobileStudentPage(1);
                    setShowStudentSearchModal(false);
                  }}
                  className="text-xs font-medium text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 transition cursor-pointer"
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
                  onClick={() => setShowStudentSearchModal(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold transition cursor-pointer shadow-sm"
                >
                  Search
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: OFFICIAL DISBURSEMENT VOUCHER & ITEMIZATION SCHEDULE */}
      {selectedExpenseReceipt && (
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
            if (e.target === e.currentTarget) setSelectedExpenseReceipt(null);
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
            {/* Modal Header */}
            <div className="p-4 sm:px-6 sm:py-4 border-b border-slate-200/80 dark:border-slate-800/90 bg-white dark:bg-slate-900 shrink-0">
              <h3 className="font-serif font-black text-slate-900 dark:text-slate-100 text-base sm:text-lg lg:text-xl leading-snug tracking-tight break-words">
                {selectedExpenseReceipt.title}
              </h3>
            </div>

            {/* Modal Body */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4 pr-3 sm:pr-5 themed-scrollbar overscroll-contain">
              {/* Description */}
              {selectedExpenseReceipt.description && (
                <div className="space-y-1">
                  <p
                    ref={expenseDescRef}
                    className={`text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-normal break-words ${
                      isExpenseDescExpanded ? "" : "line-clamp-3"
                    }`}
                  >
                    {selectedExpenseReceipt.description}
                  </p>
                  {isExpenseDescClamped && (
                    <button
                      type="button"
                      onClick={() => setIsExpenseDescExpanded((prev) => !prev)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-300 transition-colors cursor-pointer"
                    >
                      <span>{isExpenseDescExpanded ? "Show less" : "Read more"}</span>
                    </button>
                  )}
                </div>
              )}

              {/* Financial & Metadata Dossier */}
              <div className="bg-slate-50/70 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-800/90 p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Left: Net Disbursed Amount */}
                <div className="shrink-0">
                  <span className="text-[10px] sm:text-[10.5px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                    Net Disbursed Amount
                  </span>
                  <p className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-3xl sm:text-4xl tracking-tight mt-0.5">
                    ₱{Number(selectedExpenseReceipt.amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </p>
                </div>

                {/* Right: Metadata + View Full Button */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs flex-1 min-w-0 md:pl-5 md:border-l md:border-slate-200/80 dark:md:border-slate-800">
                  <div className="grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1.5 text-xs text-slate-600 dark:text-slate-400 min-w-0">
                    <span className="text-slate-400 dark:text-slate-500 font-bold text-[10px] sm:text-[10.5px] uppercase tracking-wider whitespace-nowrap">Date:</span>
                    <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{selectedExpenseReceipt.date}</span>

                    <span className="text-slate-400 dark:text-slate-500 font-bold text-[10px] sm:text-[10.5px] uppercase tracking-wider whitespace-nowrap">Voucher:</span>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{selectedExpenseReceipt.voucher_no || "DV-ON-FILE"}</span>
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedExpenseReceipt.voucher_no) {
                            navigator.clipboard.writeText(selectedExpenseReceipt.voucher_no);
                            setCopiedExpenseVoucher(true);
                            setTimeout(() => setCopiedExpenseVoucher(false), 2000);
                          }
                        }}
                        className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors p-0.5 cursor-pointer active:scale-95 shrink-0"
                        title="Copy Voucher Reference Number"
                      >
                        {copiedExpenseVoucher ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>

                    <span className="text-slate-400 dark:text-slate-500 font-bold text-[10px] sm:text-[10.5px] uppercase tracking-wider whitespace-nowrap">Payee:</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100 break-words leading-snug">{cleanPayeeName(selectedExpenseReceipt.payee) || "Barangay Tocok SK"}</span>
                  </div>

                  {selectedExpenseReceipt.receipt_url && (
                    <a
                      href={selectedExpenseReceipt.receipt_url}
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
                  selectedExpenseReceipt.voucher_no,
                  selectedExpenseReceipt.title,
                  selectedExpenseReceipt.amount,
                  selectedExpenseReceipt.description
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
                      {/* Mobile Stacked Layout (< sm) */}
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
                            ₱{Number(selectedExpenseReceipt.amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
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
                              ₱{Number(selectedExpenseReceipt.amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
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
            <div className="px-4 py-3 sm:px-6 bg-slate-50 dark:bg-slate-800/70 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end text-xs shrink-0">
              <button
                type="button"
                onClick={() => setSelectedExpenseReceipt(null)}
                className="px-5 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 font-bold transition-colors cursor-pointer shadow-xs active:scale-95"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Floating Action Buttons for Primary Actions & Search */}
      {(() => {
        let fabConfig: {
          label: string;
          action: () => void;
          bg: string;
          ring: string;
          shadow: string;
        } | null = null;

        let searchFabConfig: {
          label: string;
          action: () => void;
          isActive: boolean;
        } | null = null;

        if (activeTab === "categories") {
          fabConfig = {
            label: "Add Category",
            action: openAddCategoryModal,
            bg: "bg-brand-700 hover:bg-brand-800",
            ring: "focus:ring-brand-500/30",
            shadow: "shadow-brand-950/25 hover:shadow-brand-900/35",
          };
        } else if (activeTab === "ledgers" && activeLedger === "expenses") {
          fabConfig = {
            label: "Add Expense",
            action: () => setShowAddExpenseModal(true),
            bg: "bg-brand-700 hover:bg-brand-800",
            ring: "focus:ring-brand-500/30",
            shadow: "shadow-brand-950/25 hover:shadow-brand-900/35",
          };
        } else if (activeTab === "ledgers" && activeLedger === "deposits") {
          fabConfig = {
            label: "Record Deposit",
            action: openAddDepositModal,
            bg: "bg-indigo-700 hover:bg-indigo-800",
            ring: "focus:ring-indigo-500/30",
            shadow: "shadow-indigo-950/25 hover:shadow-indigo-900/35",
          };
        } else if (activeTab === "officials") {
          fabConfig = {
            label: "Add Official",
            action: () => openAddUserModal("SK Kagawad"),
            bg: "bg-brand-700 hover:bg-brand-800",
            ring: "focus:ring-brand-500/30",
            shadow: "shadow-brand-950/25 hover:shadow-brand-900/35",
          };
        } else if (activeTab === "accounts") {
          fabConfig = {
            label: "Add Account",
            action: () => openAddUserModal("Student"),
            bg: "bg-brand-700 hover:bg-brand-800",
            ring: "focus:ring-brand-500/30",
            shadow: "shadow-brand-950/25 hover:shadow-brand-900/35",
          };
          searchFabConfig = {
            label: studentSearch ? `Search: "${studentSearch}"` : "Search Accounts",
            action: () => {
              setTempStudentSearch(studentSearch);
              setShowStudentSearchModal(true);
            },
            isActive: Boolean(studentSearch),
          };
        }

        if (!fabConfig && !searchFabConfig) return null;

        return (
          <div data-page-fab className="fixed right-4 sm:right-6 bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] md:bottom-6 md:right-6 z-30 pointer-events-auto flex items-center gap-2.5 sm:gap-3">
            {/* Floating Search Button (placed right beside the Add button) */}
            {searchFabConfig && (
              <button
                type="button"
                onClick={searchFabConfig.action}
                aria-label={searchFabConfig.label}
                title={searchFabConfig.label}
                className={`relative w-14 h-14 md:w-12 md:h-12 rounded-full ${
                  searchFabConfig.isActive
                    ? "bg-slate-900 dark:bg-slate-800 text-white ring-2 ring-brand-500 shadow-xl md:shadow-lg shadow-brand-950/25"
                    : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 shadow-xl md:shadow-lg shadow-slate-900/15 dark:shadow-black/40 border border-slate-200/90 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/80"
                } flex items-center justify-center cursor-pointer hover:scale-105 active:scale-90 transition-all duration-200 group focus:outline-none focus:ring-4 focus:ring-brand-500/30`}
              >
                <Search className="w-6 h-6 md:w-5 md:h-5 transition-transform duration-200 group-hover:scale-110" />

                {/* Active search dot indicator */}
                {searchFabConfig.isActive && (
                  <span className="absolute top-1 right-1 md:top-0.5 md:right-0.5 w-3 h-3 rounded-full bg-brand-500 border-2 border-white dark:border-slate-900" />
                )}

                {/* Tooltip on Desktop hover */}
                <span className="hidden md:group-hover:block absolute bottom-full mb-2.5 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-lg bg-slate-900 dark:bg-slate-800 dark:border dark:border-slate-700 text-white text-xs font-semibold whitespace-nowrap shadow-md pointer-events-none animate-in fade-in zoom-in-95 duration-150">
                  {searchFabConfig.label}
                </span>
              </button>
            )}

            {/* Floating Add Action Button */}
            {fabConfig && (
              <button
                type="button"
                onClick={fabConfig.action}
                aria-label={fabConfig.label}
                title={fabConfig.label}
                className={`relative w-14 h-14 md:w-12 md:h-12 rounded-full ${fabConfig.bg} text-white shadow-xl md:shadow-lg ${fabConfig.shadow} border border-white/20 flex items-center justify-center cursor-pointer hover:scale-105 active:scale-90 transition-all duration-200 group focus:outline-none focus:ring-4 ${fabConfig.ring}`}
              >
                <Plus className="w-6 h-6 md:w-5 md:h-5 stroke-[2.5] transition-transform duration-200 group-hover:rotate-90" />

                {/* Tooltip on Desktop hover */}
                <span className="hidden md:group-hover:block absolute bottom-full mb-2.5 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-lg bg-slate-900 dark:bg-slate-800 dark:border dark:border-slate-700 text-white text-xs font-semibold whitespace-nowrap shadow-md pointer-events-none animate-in fade-in zoom-in-95 duration-150">
                  {fabConfig.label}
                </span>
              </button>
            )}
          </div>
        );
      })()}

    </>
  );
}
