import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let _sql: NeonQueryFunction<false, false> | null = null;

function getSql(): NeonQueryFunction<false, false> {
  if (!_sql) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error(
        "DATABASE_URL is not set. Please add it to your environment variables in Vercel or in .env.local."
      );
    }
    _sql = neon(url);
  }
  return _sql;
}

export const sql: NeonQueryFunction<false, false> = ((
  strings: TemplateStringsArray,
  ...values: unknown[]
) => {
  return (getSql() as unknown as (s: TemplateStringsArray, ...v: unknown[]) => unknown)(
    strings,
    ...values
  );
}) as NeonQueryFunction<false, false>;

export type Row = Record<string, unknown>;

/**
 * Run a raw SQL string with positional $1..$N parameters against Neon Postgres.
 */
export async function query<T = Row>(text: string, values?: unknown[]): Promise<T[]> {
  const runner = getSql() as unknown as {
    query?: (t: string, v?: unknown[]) => Promise<unknown>;
    (t: string, v?: unknown[]): Promise<unknown>;
  };
  if (typeof runner.query === "function") {
    const rows = await runner.query(text, values);
    return rows as T[];
  }
  const rows = await runner(text, values);
  return rows as T[];
}

export default sql;
