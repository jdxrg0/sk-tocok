export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";
import { signToken, getAuthCookieOptions } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const { name, email, password } = await request.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: "Name, email, and password are required." }, { status: 400 });
    }

    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return NextResponse.json({ error: "Please provide a valid email address." }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters long." }, { status: 400 });
    }

    const existing = await sql`SELECT id FROM users WHERE LOWER(email) = LOWER(${trimmedEmail})`;
    if (existing.length > 0) {
      return NextResponse.json(
        { error: "An account with this email already exists. Please sign in instead." },
        { status: 409 }
      );
    }

    const passwordHash = bcrypt.hashSync(password, 10);

    const result = await sql`
      INSERT INTO users (name, email, password_hash, role, auth_provider)
      VALUES (${trimmedName}, ${trimmedEmail}, ${passwordHash}, 'Student', 'email')
      RETURNING id
    `;
    const userId = Number((result[0] as { id: number }).id);

    const token = signToken({ id: userId, name: trimmedName, email: trimmedEmail, role: "Student" });

    const response = NextResponse.json({
      success: true,
      user: { id: userId, name: trimmedName, email: trimmedEmail, role: "Student" },
    });

    response.cookies.set({
      ...getAuthCookieOptions(request),
      value: token,
    });

    return response;
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json({ error: "An unexpected error occurred during account creation." }, { status: 500 });
  }
}
