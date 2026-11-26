"use client";

import React from "react";
import { Plus, Trash2, ListChecks } from "lucide-react";
import {
  type ExpenseLineItem,
  parseQuantityMultiplier,
} from "@/lib/expenseBreakdown";

interface ExpenseBreakdownEditorProps {
  items: ExpenseLineItem[];
  onChange: (items: ExpenseLineItem[]) => void;
  expenseAmount: string;
  onSyncAmount?: (formattedSum: string) => void;
}

export default function ExpenseBreakdownEditor({
  items,
  onChange,
  expenseAmount,
  onSyncAmount,
}: ExpenseBreakdownEditorProps) {
  const handleAddItem = () => {
    onChange([
      ...items,
      { name: "", quantity: "1 lot", unitPrice: 0, total: 0 },
    ]);
  };

  const handleRemoveItem = (idx: number) => {
    onChange(items.filter((_, i) => i !== idx));
  };

  const handleFieldChange = (
    idx: number,
    field: keyof ExpenseLineItem,
    rawValue: string
  ) => {
    const next = items.map((item, i) => {
      if (i !== idx) return item;

      if (field === "name") {
        return { ...item, name: rawValue };
      }

      if (field === "quantity") {
        const qtyMultiplier = parseQuantityMultiplier(rawValue);
        const autoTotal =
          qtyMultiplier !== null && item.unitPrice > 0
            ? Math.round(qtyMultiplier * item.unitPrice * 100) / 100
            : item.total;
        return { ...item, quantity: rawValue, total: autoTotal };
      }

      if (field === "unitPrice") {
        const parsed = parseFloat(rawValue);
        const unitPrice = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
        const qtyMultiplier = parseQuantityMultiplier(item.quantity);
        const autoTotal =
          qtyMultiplier !== null
            ? Math.round(qtyMultiplier * unitPrice * 100) / 100
            : unitPrice;
        return { ...item, unitPrice, total: autoTotal };
      }

      const parsedTotal = parseFloat(rawValue);
      const total = Number.isFinite(parsedTotal) && parsedTotal >= 0 ? parsedTotal : 0;
      return { ...item, total };
    });

    onChange(next);
  };

  const breakdownSum = items.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
  const currentAmount = parseFloat(expenseAmount) || 0;
  const amountDiffers = breakdownSum > 0 && Math.abs(breakdownSum - currentAmount) > 0.009;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <ListChecks className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400 shrink-0" />
          <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
            Itemized Breakdown
          </span>
          {items.length > 0 ? (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-brand-50 dark:bg-brand-950/50 text-brand-700 dark:text-brand-300 border border-brand-200/70 dark:border-brand-800/70">
              {items.length} {items.length === 1 ? "item" : "items"}
            </span>
          ) : (
            <span className="text-[10.5px] text-slate-400 dark:text-slate-500">
              Optional
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={handleAddItem}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-brand-50 dark:bg-brand-950/50 hover:bg-brand-100 dark:hover:bg-brand-900/60 text-brand-700 dark:text-brand-300 border border-brand-200/80 dark:border-brand-800/70 text-[11px] font-semibold transition-colors cursor-pointer"
        >
          <Plus className="w-3 h-3" />
          <span>Add Item</span>
        </button>
      </div>

      {items.length === 0 ? (
        <p className="text-[11px] text-slate-400 dark:text-slate-500 px-3 py-2 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
          No custom line items added. Defaults to a single 1-lot entry using Notes/Title and Amount.
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((item, idx) => (
            <div
              key={idx}
              className="p-2.5 rounded-xl border border-slate-200/90 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/50 space-y-2"
            >
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  placeholder={`Item ${idx + 1} description (e.g. Bond Paper A4)`}
                  value={item.name}
                  onChange={(e) => handleFieldChange(idx, "name", e.target.value)}
                  className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-600"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveItem(idx)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer shrink-0"
                  title="Remove item"
                  aria-label={`Remove item ${idx + 1}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-0.5">
                    Qty
                  </label>
                  <input
                    type="text"
                    placeholder="1 lot"
                    value={item.quantity}
                    onChange={(e) => handleFieldChange(idx, "quantity", e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-mono bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-600"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-0.5">
                    Unit Price (₱)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={item.unitPrice || ""}
                    placeholder="0.00"
                    onChange={(e) => handleFieldChange(idx, "unitPrice", e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-mono bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-600"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-0.5">
                    Total (₱)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={item.total || ""}
                    placeholder="0.00"
                    onChange={(e) => handleFieldChange(idx, "total", e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-mono font-semibold bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-600"
                  />
                </div>
              </div>
            </div>
          ))}

          <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-slate-100/80 dark:bg-slate-800/80 text-[11px]">
            <span className="text-slate-600 dark:text-slate-300 font-medium">
              Breakdown Sum:{" "}
              <strong className="font-mono text-slate-900 dark:text-slate-100">
                ₱{breakdownSum.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </strong>
            </span>
            {onSyncAmount && amountDiffers && (
              <button
                type="button"
                onClick={() => onSyncAmount(breakdownSum.toFixed(2))}
                className="text-[11px] font-semibold text-brand-700 dark:text-brand-400 hover:underline cursor-pointer shrink-0"
              >
                Use as Amount
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
