import crypto from "crypto";
import { sql } from "@/lib/db";
import { ensureUserAppearanceColumns } from "@/lib/auth";
import { getTrustedSiteOrigin } from "@/lib/env";

export const EMAIL_VERIFY_TTL_HOURS = 24;

let verifyTablePromise: Promise<void> | null = null;

export function isEmailVerificationEnforced(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

export function ensureEmailVerificationTable(): Promise<void> {
  if (!verifyTablePromise) {
    verifyTablePromise = (async () => {
      try {
        await ensureUserAppearanceColumns();
        await sql`
          CREATE TABLE IF NOT EXISTS email_verification_tokens (
            id         SERIAL PRIMARY KEY,
            user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            token_hash TEXT UNIQUE NOT NULL,
            expires_at TIMESTAMPTZ NOT NULL,
            used_at    TIMESTAMPTZ,
            created_ip TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW()
          )
        `;
        await sql`CREATE INDEX IF NOT EXISTS idx_email_verify_user ON email_verification_tokens(user_id)`;
        await sql`CREATE INDEX IF NOT EXISTS idx_email_verify_expires ON email_verification_tokens(expires_at)`;
      } catch (err) {
        verifyTablePromise = null;
        console.error("Failed to ensure email verification table:", err);
      }
    })();
  }
  return verifyTablePromise;
}

function hashVerificationToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

async function sendVerificationEmail(params: {
  to: string;
  name: string;
  verifyUrl: string;
}): Promise<boolean> {
  const resendKey = process.env.RESEND_API_KEY?.trim();
  if (!resendKey) return false;

  const fromEmail =
    process.env.EMAIL_FROM?.trim() || "SK Tocok Portal <onboarding@resend.dev>";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [params.to],
      subject: "Verify your email — SK Barangay Tocok Transparency Portal",
      text: [
        `Hello ${params.name},`,
        "",
        "Thank you for registering with the SK Barangay Tocok Transparency Portal.",
        `Open this link within ${EMAIL_VERIFY_TTL_HOURS} hours to verify your email address:`,
        params.verifyUrl,
        "",
        "This link can only be used once. If you did not create this account, you can safely ignore this message.",
      ].join("\n"),
    }),
  });

  return res.ok;
}

/**
 * Creates a single-use SHA-256 hashed email verification token and sends the link via Resend when configured.
 */
export async function createAndSendVerificationEmail(params: {
  userId: number;
  email: string;
  name: string;
  ipAddress: string;
  request?: Request;
}): Promise<{ emailed: boolean; expiresAt: string }> {
  await ensureEmailVerificationTable();

  await sql`
    UPDATE email_verification_tokens
    SET used_at = NOW()
    WHERE user_id = ${params.userId} AND used_at IS NULL
  `;

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashVerificationToken(rawToken);

  const rows = await sql`
    INSERT INTO email_verification_tokens (user_id, token_hash, expires_at, created_ip)
    VALUES (
      ${params.userId},
      ${tokenHash},
      NOW() + (${EMAIL_VERIFY_TTL_HOURS} * INTERVAL '1 hour'),
      ${params.ipAddress}
    )
    RETURNING expires_at
  `;
  const expiresAt = String((rows[0] as { expires_at: string }).expires_at);

  const origin = getTrustedSiteOrigin(params.request);
  const verifyUrl = `${origin}/verify-email?token=${encodeURIComponent(rawToken)}`;

  const emailed = await sendVerificationEmail({
    to: params.email,
    name: params.name,
    verifyUrl,
  }).catch(() => false);

  return { emailed, expiresAt };
}

/**
 * Atomically consumes a verification token and marks the matching user account as email_verified = TRUE.
 */
export async function consumeEmailVerificationToken(
  rawToken: string
): Promise<
  | { ok: true; userId: number; email: string; name: string }
  | { ok: false; error: string; status: number }
> {
  if (!rawToken || !/^[a-f0-9]{64}$/i.test(rawToken.trim())) {
    return { ok: false, error: "Invalid or expired email verification link.", status: 400 };
  }

  await ensureEmailVerificationTable();
  const tokenHash = hashVerificationToken(rawToken.trim());

  const consumed = await sql`
    UPDATE email_verification_tokens
    SET used_at = NOW()
    WHERE token_hash = ${tokenHash}
      AND used_at IS NULL
      AND expires_at > NOW()
    RETURNING user_id
  `;

  if (consumed.length === 0) {
    return {
      ok: false,
      error: "This verification link is invalid, has already been used, or has expired.",
      status: 400,
    };
  }

  const userId = Number((consumed[0] as { user_id: number }).user_id);

  const updated = await sql`
    UPDATE users
    SET email_verified = TRUE
    WHERE id = ${userId}
    RETURNING id, email, name
  `;

  if (updated.length === 0) {
    return { ok: false, error: "User account no longer exists.", status: 404 };
  }

  const u = updated[0] as { id: number; email: string; name: string };
  return {
    ok: true,
    userId: Number(u.id),
    email: String(u.email),
    name: String(u.name),
  };
}
