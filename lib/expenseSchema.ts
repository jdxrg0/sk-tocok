import { sql } from "@/lib/db";

let ensureColumnPromise: Promise<void> | null = null;

/**
 * Idempotently ensures the `expenses.line_items` JSONB column exists in Postgres.
 * Cached per server instance so it runs at most once after cold start.
 */
export async function ensureExpenseLineItemsColumn(): Promise<void> {
  if (!ensureColumnPromise) {
    ensureColumnPromise = (async () => {
      await sql`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS line_items JSONB`;
    })().catch((err) => {
      ensureColumnPromise = null;
      throw err;
    });
  }
  return ensureColumnPromise;
}
