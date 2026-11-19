import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";
import { getCurrentUser, isOfficialUser } from "@/lib/auth";
import { deleteStoredFileByUrl } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }
    if (!isOfficialUser(user)) {
      return NextResponse.json({ error: "Forbidden: SK Officials only" }, { status: 403 });
    }

    const users = await sql`
      SELECT id, name, email, role, contact_number, avatar_url, created_at, auth_provider
      FROM users
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
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }
    if (!isOfficialUser(currentUser)) {
      return NextResponse.json({ error: "Forbidden: SK Officials only" }, { status: 403 });
    }

    const { name, email, password, role, contact_number, avatar_url } = await request.json();
    if (!name || !email || !password || !role) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }
    if (password.trim().length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    const existing = await sql`SELECT id FROM users WHERE LOWER(email) = LOWER(${email.trim()})`;
    if (existing.length > 0) {
      return NextResponse.json({ error: "An account with this email already exists" }, { status: 400 });
    }

    const hash = bcrypt.hashSync(password.trim(), 10);
    await sql`
      INSERT INTO users (name, email, password_hash, role, contact_number, avatar_url)
      VALUES (
        ${name.trim()},
        ${email.trim()},
        ${hash},
        ${role.trim()},
        ${(contact_number || "").trim()},
        ${(avatar_url || "").trim() || null}
      )
    `;

    return NextResponse.json({ success: true, message: "New SK Official account registered successfully." });
  } catch (error) {
    console.error("Create user error:", error);
    return NextResponse.json({ error: "Failed to create user account" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }
    if (!isOfficialUser(currentUser)) {
      return NextResponse.json({ error: "Forbidden: SK Officials only" }, { status: 403 });
    }

    const { id, name, email, role, contact_number, avatar_url, password } = await request.json();
    if (!id || !name || !email || !role) {
      return NextResponse.json({ error: "ID, name, email, and role are required" }, { status: 400 });
    }

    const existing = await sql`SELECT id, avatar_url FROM users WHERE id = ${id}`;
    if (existing.length === 0) {
      return NextResponse.json({ error: "Official account not found" }, { status: 404 });
    }
    const oldAvatarUrl = (existing[0] as { avatar_url?: string | null }).avatar_url;

    const conflict = await sql`SELECT id FROM users WHERE LOWER(email) = LOWER(${email.trim()}) AND id != ${id}`;
    if (conflict.length > 0) {
      return NextResponse.json({ error: "Another account already uses this email address" }, { status: 400 });
    }

    if (!password || password.trim().length === 0) {
      return NextResponse.json({ error: "Password is required to save changes" }, { status: 400 });
    }
    if (password.trim().length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    const hash = bcrypt.hashSync(password.trim(), 10);
    const nextAvatarUrl = (avatar_url || "").trim() || null;
    await sql`
      UPDATE users
      SET name = ${name.trim()}, email = ${email.trim()}, password_hash = ${hash},
          role = ${role.trim()}, contact_number = ${(contact_number || "").trim()},
          avatar_url = ${nextAvatarUrl}
      WHERE id = ${id}
    `;

    if (oldAvatarUrl && oldAvatarUrl !== nextAvatarUrl) {
      await deleteStoredFileByUrl(oldAvatarUrl);
    }

    return NextResponse.json({ success: true, message: "Official account updated successfully." });
  } catch (error) {
    console.error("Update user error:", error);
    return NextResponse.json({ error: "Failed to update official account" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }
    if (!isOfficialUser(currentUser)) {
      return NextResponse.json({ error: "Forbidden: SK Officials only" }, { status: 403 });
    }

    const { id } = await request.json();
    if (!id) {
      return NextResponse.json({ error: "Official ID is required" }, { status: 400 });
    }
    if (currentUser.id === id) {
      return NextResponse.json({ error: "You cannot delete your own logged-in account" }, { status: 400 });
    }

    const existing = await sql`SELECT id, avatar_url FROM users WHERE id = ${id}`;
    if (existing.length === 0) {
      return NextResponse.json({ error: "Official account not found" }, { status: 404 });
    }
    const oldAvatarUrl = (existing[0] as { avatar_url?: string | null }).avatar_url;

    await sql`DELETE FROM users WHERE id = ${id}`;
    if (oldAvatarUrl) {
      await deleteStoredFileByUrl(oldAvatarUrl);
    }
    return NextResponse.json({ success: true, message: "Official account deleted successfully." });
  } catch (error) {
    console.error("Delete user error:", error);
    return NextResponse.json({ error: "Failed to delete official account" }, { status: 500 });
  }
}
