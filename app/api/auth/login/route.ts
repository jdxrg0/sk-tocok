import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";
import { signToken, getAuthCookieOptions, ensureUserAppearanceColumns } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    await ensureUserAppearanceColumns();

    const rows = await sql`
      SELECT id, name, email, password_hash, role, contact_number, avatar_url, auth_provider, theme_preference, accent_preference
      FROM users WHERE LOWER(email) = LOWER(${email.trim()})
    `;

    const user = rows[0] as {
      id: number; name: string; email: string;
      password_hash: string; role: string;
      contact_number?: string; avatar_url?: string | null; auth_provider?: string;
      theme_preference?: string | null; accent_preference?: string | null;
    } | undefined;

    if (!user) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    if (!user.password_hash && user.auth_provider === "google") {
      return NextResponse.json({ error: "This account was created with Google. Please use 'Continue with Google'." }, { status: 400 });
    }

    const isValid = bcrypt.compareSync(password, user.password_hash);
    if (!isValid) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const token = signToken({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      contact_number: user.contact_number,
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        contact_number: user.contact_number,
        avatar_url: user.avatar_url,
        theme_preference: user.theme_preference ?? null,
        accent_preference: user.accent_preference ?? null,
      },
    });

    response.cookies.set({
      ...getAuthCookieOptions(request),
      value: token,
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "An unexpected error occurred during login" }, { status: 500 });
  }
}
