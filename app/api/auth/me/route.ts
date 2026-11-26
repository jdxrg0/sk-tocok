export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json(
      { authenticated: false, user: null },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }

  const safeUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    contact_number: user.contact_number,
    avatar_url: user.avatar_url ?? null,
    theme_preference: user.theme_preference ?? null,
    accent_preference: user.accent_preference ?? null,
  };

  return NextResponse.json(
    {
      authenticated: true,
      user: safeUser,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
