export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { COOKIE_NAME, getAuthCookieOptions } from "@/lib/auth";

export async function POST(request: Request) {
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
