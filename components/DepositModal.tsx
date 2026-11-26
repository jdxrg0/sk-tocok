"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X, Loader2, Upload, Landmark, FileText } from "lucide-react";
import { useModalAnimation } from "@/lib/useModalAnimation";

export interface DepositModalData {
  id: number;
  reference_no: string;
  source: string;
  amount: number;
  date: string;
  description: string | null;
  attachment_url: string | null;
  recorded_by?: string;
}

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingDeposit?: DepositModalData | null;
  defaultReferenceNo?: string;
}

export default function DepositModal({
  isOpen,
  onClose,
  onSuccess,
  editingDeposit,
  defaultReferenceNo,
}: DepositModalProps) {
  const [mounted, setMounted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { rendered, closing, handleClose } = useModalAnimation(isOpen, onClose);

  const [form, setForm] = useState({
    reference_no: "",
    source: "Barangay Tocok Internal Revenue Allotment",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    description: "",
  });
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setAttachmentFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      if (editingDeposit) {
        setForm({
          reference_no: editingDeposit.reference_no || "",
          source: editingDeposit.source || "Barangay Tocok Internal Revenue Allotment",
          amount: String(editingDeposit.amount || ""),
          date: editingDeposit.date || new Date().toISOString().split("T")[0],
          description: editingDeposit.description || "",
        });
      } else {
        const refNo =
          defaultReferenceNo ||
          `DEP-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-${Math.floor(
            100 + Math.random() * 900
          )}`;
        setForm({
          reference_no: refNo,
          source: "Barangay Tocok Internal Revenue Allotment",
          amount: "",
          date: new Date().toISOString().split("T")[0],
          description: "",
        });
      }
    }
  }, [isOpen, editingDeposit, defaultReferenceNo]);

  useEffect(() => {
    if (!isOpen || closing) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) handleClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, closing, submitting, handleClose]);

  if (!rendered || !mounted) return null;

  const handleClearFile = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setAttachmentFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const amountNum = parseFloat(form.amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError("Please enter a valid deposit amount greater than 0.");
      return;
    }

    try {
      setSubmitting(true);
      const formData = new FormData();
      formData.append("reference_no", form.reference_no.trim());
      formData.append("source", form.source.trim());
      formData.append("amount", form.amount);
      formData.append("date", form.date);
      formData.append("description", form.description.trim());

      if (attachmentFile) {
        formData.append("attachment_file", attachmentFile);
      }

      let res: Response;
      if (editingDeposit) {
        res = await fetch(`/api/deposits/${editingDeposit.id}`, {
          method: "PUT",
          body: formData,
        });
      } else {
        res = await fetch("/api/deposits", {
          method: "POST",
          body: formData,
        });
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save bank remittance record.");
      }

      onSuccess();
      handleClose();
    } catch (err: unknown) {
      console.error("DepositModal error:", err);
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

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
          aria-labelledby="deposit-modal-title"
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
              <Landmark className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" aria-hidden="true" />
              <h3
                id="deposit-modal-title"
                className="text-sm sm:text-[15px] font-bold text-slate-900 dark:text-slate-100 tracking-tight truncate"
              >
                {editingDeposit ? "Edit Deposit" : "New Deposit"}
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

            <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-2">
              <div>
                <label
                  htmlFor="deposit-amount-input"
                  className="block text-[10.5px] font-semibold leading-none text-slate-600 dark:text-slate-300 mb-1"
                >
                  Amount <span className="text-rose-500 dark:text-rose-400">*</span>
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm sm:text-[13px] font-semibold text-slate-400 dark:text-slate-500">
                    ₱
                  </span>
                  <input
                    id="deposit-amount-input"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    required
                    placeholder="55000.00"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    className="w-full pl-7 pr-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700/80 text-sm sm:text-[13px] font-semibold tabular-nums focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-600 bg-slate-50/70 dark:bg-slate-800/60 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 transition-all"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="deposit-date-input"
                  className="block text-[10.5px] font-semibold leading-none text-slate-600 dark:text-slate-300 mb-1"
                >
                  Date <span className="text-rose-500 dark:text-rose-400">*</span>
                </label>
                <input
                  id="deposit-date-input"
                  type="date"
                  required
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700/80 text-sm sm:text-[13px] font-medium focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-600 bg-slate-50/70 dark:bg-slate-800/60 text-slate-900 dark:text-slate-100 transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label
                  htmlFor="deposit-ref-input"
                  className="block text-[10.5px] font-semibold leading-none text-slate-600 dark:text-slate-300 mb-1"
                >
                  Reference No. <span className="text-rose-500 dark:text-rose-400">*</span>
                </label>
                <input
                  id="deposit-ref-input"
                  type="text"
                  required
                  placeholder="DEP-2026-10-010"
                  value={form.reference_no}
                  onChange={(e) => setForm({ ...form, reference_no: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700/80 text-sm sm:text-[13px] font-medium focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-600 bg-slate-50/70 dark:bg-slate-800/60 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 transition-all"
                />
              </div>

              <div>
                <label
                  htmlFor="deposit-source-input"
                  className="block text-[10.5px] font-semibold leading-none text-slate-600 dark:text-slate-300 mb-1"
                >
                  Source <span className="text-rose-500 dark:text-rose-400">*</span>
                </label>
                <input
                  id="deposit-source-input"
                  type="text"
                  required
                  value={form.source}
                  onChange={(e) => setForm({ ...form, source: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700/80 text-sm sm:text-[13px] font-medium focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-600 bg-slate-50/70 dark:bg-slate-800/60 text-slate-900 dark:text-slate-100 transition-all"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label
                  htmlFor="deposit-notes-input"
                  className="text-[10.5px] font-semibold leading-none text-slate-600 dark:text-slate-300"
                >
                  Notes
                </label>
                <span className="text-[10px] leading-none text-slate-400 dark:text-slate-500">Optional</span>
              </div>
              <textarea
                id="deposit-notes-input"
                rows={2}
                placeholder="e.g. Monthly 10% SK fund tranche..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700/80 text-sm sm:text-[13px] leading-snug focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-600 bg-slate-50/70 dark:bg-slate-800/60 resize-none text-slate-900 dark:text-slate-100 placeholder:text-slate-400 transition-all"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10.5px] font-semibold leading-none text-slate-600 dark:text-slate-300">
                  Deposit Slip
                </span>
                <span className="text-[10px] leading-none text-slate-400 dark:text-slate-500">
                  Photo or PDF
                </span>
              </div>
              <div
                className={`flex items-center justify-between gap-1 rounded-xl border border-dashed transition-colors ${
                  attachmentFile
                    ? "border-indigo-400 dark:border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/30"
                    : "border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 hover:bg-slate-100/80 dark:hover:bg-slate-800"
                }`}
              >
                <label
                  htmlFor="deposit-attachment-input"
                  className="flex-1 flex items-center justify-between gap-2 px-2.5 py-1.5 min-w-0 cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {attachmentFile ? (
                      <FileText className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    ) : (
                      <Upload className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                    )}
                    <span
                      className={`text-xs font-medium truncate ${
                        attachmentFile
                          ? "text-indigo-800 dark:text-indigo-300"
                          : "text-slate-500 dark:text-slate-400"
                      }`}
                    >
                      {attachmentFile
                        ? attachmentFile.name
                        : editingDeposit?.attachment_url
                        ? "Existing slip · Tap to replace"
                        : "Attach deposit slip or credit memo"}
                    </span>
                  </div>
                  {!attachmentFile && (
                    <span className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-400 shrink-0">
                      {editingDeposit?.attachment_url ? "Replace" : "Browse"}
                    </span>
                  )}
                </label>
                {attachmentFile && (
                  <button
                    type="button"
                    onClick={handleClearFile}
                    className="mr-1 p-1 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white/80 dark:hover:bg-slate-800 shrink-0 cursor-pointer transition-colors"
                    aria-label="Remove selected file"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <input
                ref={fileInputRef}
                id="deposit-attachment-input"
                type="file"
                accept="image/png,image/jpeg,image/webp,.pdf"
                onChange={(e) => setAttachmentFile(e.target.files?.[0] || null)}
                className="sr-only"
              />
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
              className="py-1.5 px-3.5 rounded-xl bg-indigo-700 hover:bg-indigo-800 active:scale-[0.98] text-white text-xs font-semibold shadow-xs cursor-pointer transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>
                {submitting
                  ? "Saving..."
                  : editingDeposit
                  ? "Save Changes"
                  : "Save Deposit"}
              </span>
            </button>
          </div>
        </form>
      </div>
    </>,
    document.body
  );
}
