export interface ExpenseLineItem {
  name: string;
  quantity: string;
  unitPrice: number;
  total: number;
}

/**
 * Safely parses stored or submitted line_items JSON into normalized ExpenseLineItem[].
 * Drops empty rows without an item name.
 */
export function parseExpenseLineItems(raw: unknown): ExpenseLineItem[] {
  if (!raw) return [];

  let parsed: unknown = raw;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(parsed)) return [];

  const items: ExpenseLineItem[] = [];
  for (const entry of parsed) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const name = typeof record.name === "string" ? record.name.trim() : "";
    if (!name) continue;

    const quantityRaw =
      typeof record.quantity === "string"
        ? record.quantity.trim()
        : record.quantity != null
        ? String(record.quantity).trim()
        : "";
    const quantity = quantityRaw || "1 lot";

    const unitPriceNum = Number(record.unitPrice);
    const totalNum = Number(record.total);
    const unitPrice = Number.isFinite(unitPriceNum) && unitPriceNum >= 0 ? unitPriceNum : 0;
    const total = Number.isFinite(totalNum) && totalNum >= 0 ? totalNum : 0;

    items.push({
      name,
      quantity,
      unitPrice: Math.round(unitPrice * 100) / 100,
      total: Math.round(total * 100) / 100,
    });
  }

  return items;
}

/**
 * Extracts a leading numeric multiplier from a quantity label (e.g. "50 reams" -> 50).
 * Returns null if the quantity does not start with a valid positive number.
 */
export function parseQuantityMultiplier(quantity: string): number | null {
  const match = quantity.trim().match(/^(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * Returns line items for an expenditure record.
 * Uses persisted `lineItems` when present; otherwise falls back cleanly to
 * the disbursement's own title/description and total amount.
 */
export function getExpenseBreakdown(
  _voucherNo: string | null,
  title: string,
  amount: number,
  description?: string | null,
  lineItems?: unknown
): ExpenseLineItem[] {
  const customItems = parseExpenseLineItems(lineItems);
  if (customItems.length > 0) {
    return customItems;
  }

  return [
    {
      name: description || title,
      quantity: "1 lot",
      unitPrice: amount,
      total: amount,
    },
  ];
}
