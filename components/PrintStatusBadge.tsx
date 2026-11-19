import { Clock, Loader2, CheckCircle2, Check, XCircle } from "lucide-react";

interface StatusBadgeProps {
  status: string;
  size?: "sm" | "md" | "lg";
  iconOnly?: boolean;
  className?: string;
}

export default function PrintStatusBadge({ 
  status, 
  size = "md",
  iconOnly = false,
  className = ""
}: StatusBadgeProps) {
  let badgeConfig = {
    bg: "bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700",
    icon: Clock,
    label: status,
    desc: "Awaiting review",
  };

  switch (status) {
    case "Pending Review":
      badgeConfig = {
        bg: "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/80",
        icon: Clock,
        label: "Pending Review",
        desc: "Request received, waiting for printer queue",
      };
      break;
    case "Printing In Progress":
      badgeConfig = {
        bg: "bg-sky-50 text-sky-800 border-sky-300 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800/80",
        icon: Loader2,
        label: "Printing In Progress",
        desc: "Being printed at the SK Hall",
      };
      break;
    case "Ready for Pickup":
      badgeConfig = {
        bg: "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/80",
        icon: CheckCircle2,
        label: "Ready for Pickup",
        desc: "Ready at SK Office front counter",
      };
      break;
    case "Completed":
      badgeConfig = {
        bg: "bg-indigo-50 text-indigo-800 border-indigo-300 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800/80",
        icon: Check,
        label: "Completed",
        desc: "Claimed by student",
      };
      break;
    case "Declined":
      badgeConfig = {
        bg: "bg-rose-50 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/80",
        icon: XCircle,
        label: "Declined",
        desc: "See reason in details",
      };
      break;
    case "Cancelled":
      badgeConfig = {
        bg: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
        icon: XCircle,
        label: "Cancelled",
        desc: "Cancelled by student",
      };
      break;
  }

  const Icon = badgeConfig.icon;
  const isSpinning = status === "Printing In Progress";

  const sizeClasses = {
    sm: iconOnly ? "w-5 h-5" : "px-2 py-0.5 text-xs font-semibold gap-1",
    md: iconOnly ? "w-6 h-6" : "px-3 py-1 text-xs font-bold gap-1.5",
    lg: iconOnly ? "w-7 h-7" : "px-4 py-2 text-sm font-bold gap-2",
  };

  const iconSizes = {
    sm: "w-3 h-3",
    md: "w-3.5 h-3.5",
    lg: "w-4 h-4",
  };

  return (
    <span
      title={badgeConfig.label}
      aria-label={badgeConfig.label}
      className={`inline-flex items-center justify-center rounded-full border shadow-xs shrink-0 ${badgeConfig.bg} ${sizeClasses[size]} ${className}`}
    >
      <Icon className={`${iconSizes[size]} ${isSpinning ? "animate-spin" : ""}`} />
      {!iconOnly && <span>{badgeConfig.label}</span>}
    </span>
  );
}
