export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { COOKIE_NAME, getAuthCookieOptions, getCurrentUser } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const currentUser = await getCurrentUser(request);
    if (currentUser) {
      await sql`
        UPDATE users
        SET token_version = COALESCE(token_version, 1) + 1
        WHERE id = ${currentUser.id}
      `;
    }
  } catch (err) {
    console.warn("[Logout] Failed to revoke token_version in DB:", err);
  }

  const response = NextResponse.json({ success: true, message: "Logged out successfully" });
  response.cookies.set({
    ...getAuthCookieOptions(request),
    name: COOKIE_NAME,
    value: "",
    maxAge: 0,
    expires: new Date(0),
  });
  return response;
}
