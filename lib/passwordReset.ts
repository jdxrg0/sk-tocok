import crypto from "crypto";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";
import { validatePasswordStrength } from "@/lib/validation";

export const RESET_TOKEN_TTL_MINUTES = 15;

let resetTablePromise: Promise<void> | null = null;

export function ensurePasswordResetTable(): Promise<void> {
  if (!resetTablePromise) {
    resetTablePromise = (async () => {
      try {
        await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 1`;
        await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE`;
        await sql`
          CREATE TABLE IF NOT EXISTS password_reset_tokens (
            id         SERIAL PRIMARY KEY,
            user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            token_hash TEXT UNIQUE NOT NULL,
            expires_at TIMESTAMPTZ NOT NULL,
            used_at    TIMESTAMPTZ,
            created_ip TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW()
          )
        `;
        await sql`CREATE INDEX IF NOT EXISTS idx_pwd_reset_user ON password_reset_tokens(user_id)`;
        await sql`CREATE INDEX IF NOT EXISTS idx_pwd_reset_expires ON password_reset_tokens(expires_at)`;
      } catch (err) {
        resetTablePromise = null;
        console.error("Failed to ensure password reset table:", err);
      }
    })();
  }
  return resetTablePromise;
}

function hashResetToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

export async function createPasswordResetToken(
  userId: number,
  ipAddress: string,
  ttlMinutes = RESET_TOKEN_TTL_MINUTES
): Promise<{ rawToken: string; expiresAt: string }> {
  await ensurePasswordResetTable();

  // Invalidate any previously issued unused tokens for this user
  await sql`
    UPDATE password_reset_tokens
    SET used_at = NOW()
    WHERE user_id = ${userId} AND used_at IS NULL
  `;

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashResetToken(rawToken);
  const safeTtlMinutes = Math.max(1, Math.min(ttlMinutes, 60));

  const rows = await sql`
    INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, created_ip)
    VALUES (
      ${userId},
      ${tokenHash},
      NOW() + (${safeTtlMinutes} * INTERVAL '1 minute'),
      ${ipAddress}
    )
    RETURNING expires_at
  `;

  return {
    rawToken,
    expiresAt: String((rows[0] as { expires_at: string }).expires_at),
  };
}

export async function verifyPasswordResetToken(rawToken: string): Promise<{
  tokenId: number;
  userId: number;
  email: string;
  name: string;
  expiresAt: string;
} | null> {
  if (!rawToken || !/^[a-f0-9]{64}$/i.test(rawToken.trim())) {
    return null;
  }

  await ensurePasswordResetTable();
  const tokenHash = hashResetToken(rawToken.trim());

  const rows = await sql`
    SELECT t.id AS token_id, t.user_id, t.expires_at, u.email, u.name
    FROM password_reset_tokens t
    JOIN users u ON u.id = t.user_id
    WHERE t.token_hash = ${tokenHash}
      AND t.used_at IS NULL
      AND t.expires_at > NOW()
    LIMIT 1
  `;

  if (rows.length === 0) return null;
  const row = rows[0] as {
    token_id: number;
    user_id: number;
    expires_at: string;
    email: string;
    name: string;
  };
  return {
    tokenId: Number(row.token_id),
    userId: Number(row.user_id),
    email: String(row.email),
    name: String(row.name),
    expiresAt: String(row.expires_at),
  };
}

export async function consumePasswordResetToken(
  rawToken: string,
  newPassword: string
): Promise<{ ok: true; userId: number; email: string } | { ok: false; error: string; status: number }> {
  const pwdError = validatePasswordStrength(newPassword);
  if (pwdError) {
    return { ok: false, error: pwdError, status: 400 };
  }

  if (!rawToken || !/^[a-f0-9]{64}$/i.test(rawToken.trim())) {
    return { ok: false, error: "Invalid or expired password reset link.", status: 400 };
  }

  await ensurePasswordResetTable();
  const tokenHash = hashResetToken(rawToken.trim());

  // Atomically mark token as used ONLY if unused and unexpired (prevents replay / race conditions)
  const consumed = await sql`
    UPDATE password_reset_tokens
    SET used_at = NOW()
    WHERE token_hash = ${tokenHash}
      AND used_at IS NULL
      AND expires_at > NOW()
    RETURNING user_id
  `;

  if (consumed.length === 0) {
    return { ok: false, error: "This password reset link is invalid, already used, or has expired.", status: 400 };
  }

  const userId = Number((consumed[0] as { user_id: number }).user_id);
  const newHash = bcrypt.hashSync(newPassword, 12);

  const updated = await sql`
    UPDATE users
    SET password_hash = ${newHash},
        must_change_password = FALSE,
        token_version = COALESCE(token_version, 1) + 1,
        auth_provider = COALESCE(auth_provider, 'email')
    WHERE id = ${userId}
    RETURNING id, email
  `;

  if (updated.length === 0) {
    return { ok: false, error: "User account no longer exists.", status: 404 };
  }

  return {
    ok: true,
    userId,
    email: String((updated[0] as { email: string }).email),
  };
}
