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

const SAFE_HOST_TOKEN_RE = /^[a-zA-Z0-9.-]+(?::\d{1,5})?$/;

export function isLocalHostName(host: string): boolean {
  const lower = host.trim().toLowerCase();
  return (
    lower === "localhost" ||
    lower.startsWith("localhost:") ||
    lower === "127.0.0.1" ||
    lower.startsWith("127.0.0.1:") ||
    lower === "[::1]" ||
    lower.startsWith("[::1]:")
  );
}

/**
 * Returns the set of hostnames (host[:port], lowercase) explicitly trusted by deployment configuration.
 */
export function getConfiguredTrustedHosts(): Set<string> {
  const hosts = new Set<string>();
  for (const rawOrigin of getAllowedOrigins()) {
    try {
      hosts.add(new URL(rawOrigin).host.toLowerCase());
    } catch {
      // ignore
    }
  }
  for (const envUrl of [process.env.NEXT_PUBLIC_SITE_URL]) {
    const trimmed = envUrl?.trim();
    if (!trimmed) continue;
    try {
      hosts.add(new URL(trimmed).host.toLowerCase());
    } catch {
      // ignore
    }
  }
  for (const envHost of [process.env.VERCEL_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL]) {
    const trimmed = envHost?.trim().toLowerCase();
    if (trimmed && SAFE_HOST_TOKEN_RE.test(trimmed)) {
      hosts.add(trimmed);
    }
  }
  return hosts;
}

/**
 * Resolves a trusted canonical origin for security-sensitive links (password resets, OAuth redirects).
 * Never blindly trusts spoofable Host or X-Forwarded-Host headers in production.
 */
export function getTrustedSiteOrigin(request?: Request): string {
  const explicitSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicitSiteUrl) {
    try {
      const parsed = new URL(explicitSiteUrl);
      if (parsed.protocol === "https:" || parsed.protocol === "http:") {
        return parsed.origin;
      }
    } catch {
      // fall through
    }
  }

  const vercelProdHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercelProdHost && SAFE_HOST_TOKEN_RE.test(vercelProdHost)) {
    return `https://${vercelProdHost}`;
  }

  const vercelHost = process.env.VERCEL_URL?.trim();
  if (vercelHost && SAFE_HOST_TOKEN_RE.test(vercelHost)) {
    return `https://${vercelHost}`;
  }

  const allowedOrigins = getAllowedOrigins();
  if (request) {
    const rawForwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() || "";
    const rawHost = request.headers.get("host")?.trim() || "";
    const trustedHosts = getConfiguredTrustedHosts();

    let candidateHost = "";
    if (
      rawForwardedHost &&
      SAFE_HOST_TOKEN_RE.test(rawForwardedHost) &&
      (process.env.VERCEL === "1" || trustedHosts.has(rawForwardedHost.toLowerCase()))
    ) {
      candidateHost = rawForwardedHost;
    } else if (
      rawHost &&
      SAFE_HOST_TOKEN_RE.test(rawHost) &&
      (trustedHosts.has(rawHost.toLowerCase()) ||
        isLocalHostName(rawHost) ||
        process.env.NODE_ENV !== "production")
    ) {
      candidateHost = rawHost;
    }

    if (candidateHost) {
      const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
      const proto =
        isLocalHostName(candidateHost) && forwardedProto !== "https"
          ? "http"
          : forwardedProto === "http" || forwardedProto === "https"
          ? forwardedProto
          : "https";
      return `${proto}://${candidateHost}`;
    }

    try {
      const reqUrl = new URL(request.url);
      if (isLocalHostName(reqUrl.host) || process.env.NODE_ENV !== "production") {
        return reqUrl.origin;
      }
    } catch {
      // fall through
    }
  }

  if (allowedOrigins.length > 0) {
    return allowedOrigins[0];
  }

  return "http://localhost:3000";
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
