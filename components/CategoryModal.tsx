"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Loader2, Check } from "lucide-react";
import { useModalAnimation } from "@/lib/useModalAnimation";

export interface CategoryModalData {
  id: number;
  name: string;
  description?: string | null;
  color?: string;
  allocated_budget?: number;
}

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingCategory?: CategoryModalData | null;
}

const COLOR_PALETTE = [
  { name: "blue", hex: "#2563eb", label: "Blue · Education" },
  { name: "orange", hex: "#ea580c", label: "Orange · Livelihood" },
  { name: "amber", hex: "#d97706", label: "Amber · Sports" },
  { name: "rose", hex: "#e11d48", label: "Rose · Health" },
  { name: "emerald", hex: "#059669", label: "Emerald · Environment" },
  { name: "purple", hex: "#9333ea", label: "Purple · GAD" },
  { name: "cyan", hex: "#0891b2", label: "Cyan · Peace & Order" },
  { name: "indigo", hex: "#4f46e5", label: "Indigo · Admin" },
  { name: "slate", hex: "#475569", label: "Slate · General" },
];

export default function CategoryModal({
  isOpen,
  onClose,
  onSuccess,
  editingCategory,
}: CategoryModalProps) {
  const [mounted, setMounted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { rendered, closing, handleClose } = useModalAnimation(isOpen, onClose);

  const [form, setForm] = useState({
    name: "",
    description: "",
    color: "blue",
    allocated_budget: "",
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      if (editingCategory) {
        setForm({
          name: editingCategory.name || "",
          description: editingCategory.description || "",
          color: editingCategory.color || "blue",
          allocated_budget:
            editingCategory.allocated_budget && Number(editingCategory.allocated_budget) > 0
              ? String(editingCategory.allocated_budget)
              : "",
        });
      } else {
        setForm({
          name: "",
          description: "",
          color: "blue",
          allocated_budget: "",
        });
      }
    }
  }, [isOpen, editingCategory]);

  useEffect(() => {
    if (!isOpen || closing) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) handleClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, closing, submitting, handleClose]);

  if (!rendered || !mounted) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const name = form.name.trim();
    if (!name) {
      setError("Category name is required.");
      return;
    }

    try {
      setSubmitting(true);
      const method = editingCategory ? "PUT" : "POST";
      const budgetValue = form.allocated_budget.trim() || "0";
      const payload = editingCategory
        ? { id: editingCategory.id, ...form, name, allocated_budget: budgetValue }
        : { ...form, name, allocated_budget: budgetValue };

      const res = await fetch("/api/categories", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save category.");
      }

      onSuccess();
      handleClose();
    } catch (err: unknown) {
      console.error("CategoryModal error:", err);
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedColor = COLOR_PALETTE.find((c) => c.name === form.color) || COLOR_PALETTE[0];

  return createPortal(
    <>
      <div
        className={`fixed inset-0 !m-0 top-0 left-0 right-0 bottom-0 z-[100] bg-slate-950/55 dark:bg-black/75 backdrop-blur-sm overscroll-contain touch-none ${
          closing ? "animate-modal-backdrop-out" : "animate-modal-backdrop-in"
        }`}
        onClick={() => !submitting && !closing && handleClose()}
        aria-hidden="true"
      />
      <div className="fixed inset-0 !m-0 top-0 left-0 right-0 bottom-0 z-[101] pointer-events-none flex items-end sm:items-center justify-center p-0 sm:p-4 sm:pt-[max(1rem,env(safe-area-inset-top))] sm:pb-[max(1rem,env(safe-area-inset-bottom))] overscroll-contain font-sans">
        <form
          onSubmit={handleSubmit}
          role="dialog"
          aria-modal="true"
          aria-labelledby="category-modal-title"
          style={{
            maxHeight: "calc(100dvh - 1.25rem - env(safe-area-inset-top, 0px))",
          }}
          className={`bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl max-w-[420px] w-full shadow-2xl border-t sm:border border-slate-200/80 dark:border-slate-800 flex flex-col overflow-hidden overscroll-contain ${
            closing ? "pointer-events-none animate-modal-card-out" : "pointer-events-auto animate-modal-card-in"
          }`}
        >
          {/* Mobile Drag Handle */}
          <div className="sm:hidden flex justify-center pt-1.5 pb-0 shrink-0" aria-hidden="true">
            <span className="w-8 h-1 rounded-full bg-slate-200 dark:bg-slate-700" />
          </div>

          {/* Minimalist Header */}
          <div className="flex items-center justify-between gap-2 px-3.5 py-2 sm:px-4 sm:py-2.5 border-b border-slate-100 dark:border-slate-800/80 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: selectedColor.hex }}
                aria-hidden="true"
              />
              <h3
                id="category-modal-title"
                className="text-sm sm:text-[15px] font-bold text-slate-900 dark:text-slate-100 tracking-tight truncate"
              >
                {editingCategory ? "Edit Category" : "New Category"}
              </h3>
            </div>
            <button
              type="button"
              onClick={handleClose}
              disabled={submitting || closing}
              className="w-7 h-7 flex items-center justify-center rounded-full text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0 transition-colors"
              aria-label="Close modal"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Form Content */}
          <div className="flex-1 min-h-0 overflow-y-auto px-3.5 py-2.5 sm:px-4 sm:py-3 space-y-2 overscroll-contain">
            {error && (
              <div className="px-2.5 py-1.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/70 rounded-xl text-rose-700 dark:text-rose-300 text-xs font-medium">
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor="category-name-input"
                className="block text-[10.5px] font-semibold leading-none text-slate-600 dark:text-slate-300 mb-1"
              >
                Name <span className="text-rose-500 dark:text-rose-400">*</span>
              </label>
              <input
                id="category-name-input"
                type="text"
                required
                placeholder="e.g. Livelihood & Entrepreneurship"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700/80 text-sm sm:text-[13px] font-medium focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-brand-500/30 focus:border-brand-600 bg-slate-50/70 dark:bg-slate-800/60 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 transition-all"
              />
            </div>

            <div>
              <label
                htmlFor="category-budget-input"
                className="block text-[10.5px] font-semibold leading-none text-slate-600 dark:text-slate-300 mb-1"
              >
                Annual Budget Cap
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm sm:text-[13px] font-semibold text-slate-400 dark:text-slate-500">
                  ₱
                </span>
                <input
                  id="category-budget-input"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={form.allocated_budget}
                  onChange={(e) => setForm({ ...form, allocated_budget: e.target.value })}
                  className="w-full pl-7 pr-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700/80 text-sm sm:text-[13px] font-semibold tabular-nums focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-brand-500/30 focus:border-brand-600 bg-slate-50/70 dark:bg-slate-800/60 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 transition-all"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label
                  htmlFor="category-scope-input"
                  className="text-[10.5px] font-semibold leading-none text-slate-600 dark:text-slate-300"
                >
                  Scope
                </label>
                <span className="text-[10px] leading-none text-slate-400 dark:text-slate-500">Optional</span>
              </div>
              <textarea
                id="category-scope-input"
                rows={2}
                placeholder="Programs or expenses covered by this committee..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700/80 text-sm sm:text-[13px] leading-snug focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-brand-500/30 focus:border-brand-600 bg-slate-50/70 dark:bg-slate-800/60 resize-none text-slate-900 dark:text-slate-100 placeholder:text-slate-400 transition-all"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10.5px] font-semibold leading-none text-slate-600 dark:text-slate-300">
                  Color
                </span>
                <span className="text-[10px] leading-none font-medium text-slate-400 dark:text-slate-500">
                  {selectedColor.label}
                </span>
              </div>
              <div className="flex items-center justify-between gap-1 py-0.5">
                {COLOR_PALETTE.map((c) => {
                  const isSelected = form.color === c.name;
                  return (
                    <button
                      type="button"
                      key={c.name}
                      onClick={() => setForm({ ...form, color: c.name })}
                      aria-label={c.label}
                      aria-pressed={isSelected}
                      title={c.label}
                      style={{ backgroundColor: c.hex }}
                      className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center shrink-0 transition-all cursor-pointer active:scale-90 ${
                        isSelected
                          ? "ring-2 ring-offset-2 ring-slate-900 dark:ring-white dark:ring-offset-slate-900 scale-110 shadow-xs"
                          : "opacity-85 hover:opacity-100 hover:scale-105"
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 stroke-[3] text-white" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Minimalist Footer */}
          <div className="px-3.5 pt-2 pb-[max(0.625rem,env(safe-area-inset-bottom))] sm:px-4 sm:py-2.5 border-t border-slate-100 dark:border-slate-800/80 grid grid-cols-2 sm:flex sm:items-center sm:justify-end gap-2 shrink-0 bg-white dark:bg-slate-900">
            <button
              type="button"
              onClick={handleClose}
              disabled={submitting || closing}
              className="py-1.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/80 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="py-1.5 px-3.5 rounded-xl bg-brand-700 hover:bg-brand-800 active:scale-[0.98] text-white text-xs font-semibold shadow-xs cursor-pointer transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>
                {submitting
                  ? "Saving..."
                  : editingCategory
                  ? "Save Changes"
                  : "Create Category"}
              </span>
            </button>
          </div>
        </form>
      </div>
    </>,
    document.body
  );
}
