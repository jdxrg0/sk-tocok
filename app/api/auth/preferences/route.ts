export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getCurrentUser, ensureUserAppearanceColumns } from "@/lib/auth";
import { isValidThemePreference, isValidAccentId } from "@/lib/themes";

export async function PATCH(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
    }

    const hasTheme = "theme_preference" in body;
    const hasAccent = "accent_preference" in body;

    if (!hasTheme && !hasAccent) {
      return NextResponse.json({ error: "No preference fields provided" }, { status: 400 });
    }

    const nextTheme = hasTheme ? body.theme_preference : user.theme_preference ?? "system";
    const nextAccent = hasAccent ? body.accent_preference : user.accent_preference ?? "sk-green";

    if (hasTheme && !isValidThemePreference(nextTheme)) {
      return NextResponse.json({ error: "Invalid theme preference" }, { status: 400 });
    }
    if (hasAccent && !isValidAccentId(nextAccent)) {
      return NextResponse.json({ error: "Invalid accent preference" }, { status: 400 });
    }

    await ensureUserAppearanceColumns();

    await sql`
      UPDATE users
      SET theme_preference = ${nextTheme},
          accent_preference = ${nextAccent}
      WHERE id = ${user.id}
    `;

    return NextResponse.json({
      success: true,
      theme_preference: nextTheme,
      accent_preference: nextAccent,
    });
  } catch (error) {
    console.error("Failed to save user appearance preferences:", error);
    return NextResponse.json(
      { error: "Failed to save appearance preferences" },
      { status: 500 }
    );
  }
}
