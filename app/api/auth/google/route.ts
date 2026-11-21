export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import {
  getGoogleOAuthConfig,
  verifyGoogleIdToken,
  verifyGoogleAccessToken,
  upsertGoogleStudentUser,
  attachAuthCookie,
} from "@/lib/googleAuth";

export async function GET() {
  const { configured, clientId, mode } = getGoogleOAuthConfig();
  return NextResponse.json({
    configured,
    clientId,
    mode,
  });
}

export async function POST(request: Request) {
  try {
    const { clientId } = getGoogleOAuthConfig();
    if (!clientId) {
      return NextResponse.json(
        {
          error:
            "Google Sign-In is not configured on the server yet. Please set GOOGLE_CLIENT_ID in your environment variables.",
        },
        { status: 503 }
      );
    }

    const body = await request.json();
    const credential =
      typeof body?.credential === "string" ? body.credential.trim() : "";
    const accessToken =
      typeof body?.accessToken === "string" ? body.accessToken.trim() : "";

    if (!credential && !accessToken) {
      return NextResponse.json(
        { error: "Missing Google authorization credential." },
        { status: 400 }
      );
    }

    const profile = credential
      ? await verifyGoogleIdToken(credential, clientId)
      : await verifyGoogleAccessToken(accessToken, clientId);

    const { user, token } = await upsertGoogleStudentUser(profile);

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar_url: user.avatar_url ?? null,
        theme_preference: user.theme_preference ?? null,
        accent_preference: user.accent_preference ?? null,
      },
    });

    attachAuthCookie(response, token, request);
    return response;
  } catch (error: unknown) {
    console.error("Google auth error:", error);
    const err = error as Error & { status?: number };
    const status = typeof err?.status === "number" ? err.status : 401;
    const message =
      err instanceof Error && err.message
        ? err.message
        : "An unexpected error occurred during Google sign-in.";
    return NextResponse.json({ error: message }, { status });
  }
}
