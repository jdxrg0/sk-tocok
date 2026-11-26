export interface EnvAuditItem {
  key: string;
  configured: boolean;
  valid: boolean;
  note: string;
}

const MIN_SECRET_LENGTH = 32;

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim() || "";
  if (!secret) {
    throw new Error(
      "JWT_SECRET environment variable is not set. Refusing to sign or verify tokens without a strong secret."
    );
  }
  if (secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `JWT_SECRET must be at least ${MIN_SECRET_LENGTH} characters long.`
    );
  }
  return secret;
}

export function getCronSecret(): string | null {
  const secret = process.env.CRON_SECRET?.trim() || "";
  return secret.length >= 16 ? secret : null;
}

export function getAppsScriptWebhookSecret(): string | null {
  const secret = process.env.APPS_SCRIPT_WEBHOOK_SECRET?.trim() || "";
  return secret.length >= 16 ? secret : null;
}

export function getAllowedOrigins(): string[] {
  const raw = process.env.ALLOWED_ORIGINS || "";
  const origins: string[] = [];
  for (const part of raw.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol === "https:" || parsed.protocol === "http:") {
        origins.push(parsed.origin);
      }
    } catch {
      // Ignore malformed origin entry
    }
  }
  return origins;
}

export function auditEnvironmentConfig(): {
  healthy: boolean;
  items: EnvAuditItem[];
} {
  const items: EnvAuditItem[] = [];

  const dbUrl = process.env.DATABASE_URL?.trim() || "";
  let dbSslValid = false;
  if (dbUrl) {
    try {
      const parsed = new URL(dbUrl);
      dbSslValid =
        parsed.protocol.startsWith("postgres") &&
        (parsed.searchParams.get("sslmode") === "require" ||
          parsed.searchParams.get("sslmode") === "verify-full" ||
          parsed.hostname.includes("neon.tech"));
    } catch {
      dbSslValid = false;
    }
  }
  items.push({
    key: "DATABASE_URL",
    configured: Boolean(dbUrl),
    valid: dbSslValid,
    note: dbSslValid ? "SSL-enforced Postgres URL" : "Missing or SSL not enforced",
  });

  const jwt = process.env.JWT_SECRET?.trim() || "";
  items.push({
    key: "JWT_SECRET",
    configured: Boolean(jwt),
    valid: jwt.length >= MIN_SECRET_LENGTH,
    note: jwt.length >= MIN_SECRET_LENGTH ? "Strong secret configured" : "Missing or shorter than 32 chars",
  });

  const cron = process.env.CRON_SECRET?.trim() || "";
  items.push({
    key: "CRON_SECRET",
    configured: Boolean(cron),
    valid: cron.length >= 16,
    note: cron.length >= 16 ? "Cron bearer secret configured" : "Missing or weak",
  });

  const googleId = process.env.GOOGLE_CLIENT_ID?.trim() || "";
  const googleSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() || "";
  items.push({
    key: "GOOGLE_OAUTH",
    configured: Boolean(googleId),
    valid: Boolean(googleId && googleSecret),
    note: googleId && googleSecret ? "OAuth client ID + secret configured" : "Partial or unconfigured",
  });

  return {
    healthy: items.slice(0, 2).every((i) => i.configured && i.valid),
    items,
  };
}
