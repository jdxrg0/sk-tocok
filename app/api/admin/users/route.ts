import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";
import { getCurrentUser, isSuperAdminUser } from "@/lib/auth";
import { deleteStoredFileByUrl } from "@/lib/storage";
import {
  isValidEmail,
  OFFICIAL_ROLES,
  parsePositiveIntId,
  sanitizeText,
  validatePasswordStrength,
} from "@/lib/validation";
import { sanitizeSafeUrl } from "@/lib/urlSafety";
import { getTrustedSiteOrigin } from "@/lib/env";
import { extractClientIp, logSecurityEvent } from "@/lib/securityLogger";
import { createPasswordResetToken, RESET_TOKEN_TTL_MINUTES } from "@/lib/passwordReset";

export const dynamic = "force-dynamic";

const ALLOWED_ROLE_SET = new Set<string>(OFFICIAL_ROLES);

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }
    if (!isSuperAdminUser(user)) {
      return NextResponse.json({ error: "Forbidden: SK Chairperson privileges required" }, { status: 403 });
    }

    const users = await sql`
      SELECT id, name, email, role, contact_number, avatar_url, created_at, auth_provider,
             COALESCE(must_change_password, FALSE) AS must_change_password
      FROM users
      WHERE LOWER(TRIM(COALESCE(role, ''))) NOT IN ('student', 'guest', '')
      ORDER BY id ASC
    `;
    return NextResponse.json({ success: true, users });
  } catch (error) {
    console.error("Fetch users error:", error);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }
    if (!isSuperAdminUser(currentUser)) {
      return NextResponse.json({ error: "Forbidden: SK Chairperson privileges required" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const cleanName = sanitizeText(body?.name, 100);
    const cleanEmail = sanitizeText(body?.email, 254).toLowerCase();
    const password = typeof body?.password === "string" ? body.password : "";
    const cleanRole = sanitizeText(body?.role, 80);
    const cleanContact = sanitizeText(body?.contact_number, 40);
    const rawAvatar = typeof body?.avatar_url === "string" ? body.avatar_url.trim() : "";

    if (!cleanName || !cleanEmail || !password || !cleanRole) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }
    if (!isValidEmail(cleanEmail)) {
      return NextResponse.json({ error: "Invalid email address format" }, { status: 400 });
    }
    if (!ALLOWED_ROLE_SET.has(cleanRole)) {
      return NextResponse.json({ error: "Invalid official role specified" }, { status: 400 });
    }
    const pwdErr = validatePasswordStrength(password);
    if (pwdErr) {
      return NextResponse.json({ error: pwdErr }, { status: 400 });
    }
    const safeAvatarUrl = rawAvatar ? sanitizeSafeUrl(rawAvatar, { allowRelative: true }) : null;
    if (rawAvatar && !safeAvatarUrl) {
      return NextResponse.json({ error: "Invalid avatar URL format" }, { status: 400 });
    }

    const existing = await sql`SELECT id FROM users WHERE LOWER(email) = LOWER(${cleanEmail}) LIMIT 1`;
    if (existing.length > 0) {
      return NextResponse.json({ error: "An account with this email already exists" }, { status: 400 });
    }

    const hash = await bcrypt.hash(password, 12);
    const inserted = await sql`
      INSERT INTO users (name, email, password_hash, role, contact_number, avatar_url, token_version, must_change_password)
      VALUES (
        ${cleanName},
        ${cleanEmail},
        ${hash},
        ${cleanRole},
        ${cleanContact},
        ${safeAvatarUrl},
        1,
        FALSE
      )
      RETURNING id
    `;

    await logSecurityEvent({
      eventType: "ADMIN_USER_CREATED",
      severity: "info",
      request,
      userId: currentUser.id,
      email: currentUser.email,
      details: { targetId: inserted[0]?.id, targetRole: cleanRole },
    });

    return NextResponse.json({ success: true, message: "New SK Official account registered successfully." });
  } catch (error) {
    console.error("Create user error:", error);
    return NextResponse.json({ error: "Failed to create user account" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }
    if (!isSuperAdminUser(currentUser)) {
      return NextResponse.json({ error: "Forbidden: SK Chairperson privileges required" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const id = parsePositiveIntId(body?.id);
    const cleanName = sanitizeText(body?.name, 100);
    const cleanEmail = sanitizeText(body?.email, 254).toLowerCase();
    const cleanRole = sanitizeText(body?.role, 80);
    const cleanContact = sanitizeText(body?.contact_number, 40);
    const rawAvatar = typeof body?.avatar_url === "string" ? body.avatar_url.trim() : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!id || !cleanName || !cleanEmail || !cleanRole) {
      return NextResponse.json({ error: "ID, name, email, and role are required" }, { status: 400 });
    }
    if (!isValidEmail(cleanEmail)) {
      return NextResponse.json({ error: "Invalid email address format" }, { status: 400 });
    }

    const existing = await sql`SELECT id, avatar_url, role FROM users WHERE id = ${id} LIMIT 1`;
    if (existing.length === 0) {
      return NextResponse.json({ error: "Official account not found" }, { status: 404 });
    }
    const existingRow = existing[0] as { avatar_url?: string | null; role: string };
    const oldAvatarUrl = existingRow.avatar_url;

    const validRole =
      ALLOWED_ROLE_SET.has(cleanRole) ||
      (cleanRole === "Student" && existingRow.role === "Student");
    if (!validRole) {
      return NextResponse.json({ error: "Invalid user role specified" }, { status: 400 });
    }

    const nextAvatarUrl = rawAvatar ? sanitizeSafeUrl(rawAvatar, { allowRelative: true }) : null;
    if (rawAvatar && !nextAvatarUrl) {
      return NextResponse.json({ error: "Invalid avatar URL format" }, { status: 400 });
    }

    const conflict = await sql`SELECT id FROM users WHERE LOWER(email) = LOWER(${cleanEmail}) AND id != ${id} LIMIT 1`;
    if (conflict.length > 0) {
      return NextResponse.json({ error: "Another account already uses this email address" }, { status: 400 });
    }

    if (password.length > 0) {
      const pwdErr = validatePasswordStrength(password);
      if (pwdErr) {
        return NextResponse.json({ error: pwdErr }, { status: 400 });
      }
      const hash = await bcrypt.hash(password, 12);
      await sql`
        UPDATE users
        SET name = ${cleanName},
            email = ${cleanEmail},
            password_hash = ${hash},
            role = ${cleanRole},
            contact_number = ${cleanContact},
            avatar_url = ${nextAvatarUrl},
            must_change_password = FALSE,
            token_version = COALESCE(token_version, 1) + 1
        WHERE id = ${id}
      `;
    } else {
      await sql`
        UPDATE users
        SET name = ${cleanName},
            email = ${cleanEmail},
            role = ${cleanRole},
            contact_number = ${cleanContact},
            avatar_url = ${nextAvatarUrl}
        WHERE id = ${id}
      `;
    }

    if (oldAvatarUrl && oldAvatarUrl !== nextAvatarUrl) {
      await deleteStoredFileByUrl(oldAvatarUrl);
    }

    await logSecurityEvent({
      eventType: "ADMIN_USER_UPDATED",
      severity: "info",
      request,
      userId: currentUser.id,
      email: currentUser.email,
      details: { targetId: id, passwordChanged: password.length > 0, targetRole: cleanRole },
    });

    return NextResponse.json({ success: true, message: "Official account updated successfully." });
  } catch (error) {
    console.error("Update user error:", error);
    return NextResponse.json({ error: "Failed to update official account" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }
    if (!isSuperAdminUser(currentUser)) {
      return NextResponse.json({ error: "Forbidden: SK Chairperson privileges required" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const id = parsePositiveIntId(body?.id);
    if (!id) {
      return NextResponse.json({ error: "Valid user ID is required" }, { status: 400 });
    }

    const rows = await sql`SELECT id, email, name FROM users WHERE id = ${id} LIMIT 1`;
    if (rows.length === 0) {
      return NextResponse.json({ error: "User account not found" }, { status: 404 });
    }
    const target = rows[0] as { id: number; email: string; name: string };
    const { rawToken, expiresAt } = await createPasswordResetToken(
      target.id,
      extractClientIp(request),
      RESET_TOKEN_TTL_MINUTES
    );

    const origin = getTrustedSiteOrigin(request);
    const resetUrl = `${origin}/reset-password?token=${encodeURIComponent(rawToken)}`;

    let emailed = false;
    const resendKey = process.env.RESEND_API_KEY?.trim();
    if (resendKey) {
      const fromEmail =
        process.env.EMAIL_FROM?.trim() || "SK Tocok Portal <onboarding@resend.dev>";
      try {
        const mailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: fromEmail,
            to: [target.email],
            subject: "SK Tocok Portal - Password Reset (Expires in 15 minutes)",
            text: [
              `Hello ${target.name},`,
              "",
              "An SK Chairperson issued a password reset link for your SK Barangay Tocok Transparency Portal account.",
              `Open this link within ${RESET_TOKEN_TTL_MINUTES} minutes to set a new password:`,
              resetUrl,
              "",
              "This link can only be used once.",
            ].join("\n"),
          }),
        });
        emailed = mailRes.ok;
      } catch {
        emailed = false;
      }
    }

    await logSecurityEvent({
      eventType: "ADMIN_ISSUED_PASSWORD_RESET",
      severity: "info",
      request,
      userId: currentUser.id,
      email: currentUser.email,
      details: { targetUserId: target.id, expiresAt, emailed },
    });

    return NextResponse.json({
      success: true,
      emailed,
      ...(emailed ? {} : { resetUrl }),
      expiresAt,
      expiresInMinutes: RESET_TOKEN_TTL_MINUTES,
      message: emailed
        ? "Password reset link emailed to the user."
        : "No mailer configured — share this temporary 15-minute link securely with the user.",
    });
  } catch (error) {
    console.error("Generate reset link error:", error);
    return NextResponse.json({ error: "Failed to generate reset link" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }
    if (!isSuperAdminUser(currentUser)) {
      return NextResponse.json({ error: "Forbidden: SK Chairperson privileges required" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const id = parsePositiveIntId(body?.id);
    if (!id) {
      return NextResponse.json({ error: "Official ID is required" }, { status: 400 });
    }
    if (currentUser.id === id) {
      return NextResponse.json({ error: "You cannot delete your own logged-in account" }, { status: 400 });
    }

    const existing = await sql`SELECT id, email, avatar_url FROM users WHERE id = ${id} LIMIT 1`;
    if (existing.length === 0) {
      return NextResponse.json({ error: "Official account not found" }, { status: 404 });
    }
    const existingRow = existing[0] as { email: string; avatar_url?: string | null };

    await sql`DELETE FROM users WHERE id = ${id}`;
    if (existingRow.avatar_url) {
      await deleteStoredFileByUrl(existingRow.avatar_url);
    }

    await logSecurityEvent({
      eventType: "ADMIN_USER_DELETED",
      severity: "warning",
      request,
      userId: currentUser.id,
      email: currentUser.email,
      details: { targetId: id, targetEmail: existingRow.email },
    });

    return NextResponse.json({ success: true, message: "Official account deleted successfully." });
  } catch (error) {
    console.error("Delete user error:", error);
    return NextResponse.json({ error: "Failed to delete official account" }, { status: 500 });
  }
}
