export const dynamic = "force-dynamic";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  GOOGLE_OAUTH_STATE_COOKIE,
  getGoogleOAuthConfig,
  getGoogleRedirectUri,
  getRequestOrigin,
  sanitizeReturnTo,
  verifyGoogleIdToken,
  verifyGoogleAccessToken,
  upsertGoogleStudentUser,
  attachAuthCookie,
} from "@/lib/googleAuth";

const JWT_SECRET =
  process.env.JWT_SECRET || "sk-tocok-transparency-secret-key-2026";

function redirectWithError(
  origin: string,
  returnTo: string,
  message: string
): NextResponse {
  const target = new URL(returnTo, origin);
  target.searchParams.set("auth_error", message);
  const res = NextResponse.redirect(target);
  res.cookies.delete(GOOGLE_OAUTH_STATE_COOKIE);
  return res;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = getRequestOrigin(request);
  const cookieStore = await cookies();
  const stateCookie = cookieStore.get(GOOGLE_OAUTH_STATE_COOKIE)?.value;

  let expectedState = "";
  let returnTo = "/printing";

  if (stateCookie) {
    try {
      const decoded = jwt.verify(stateCookie, JWT_SECRET) as {
        state?: string;
        returnTo?: string;
      };
      expectedState = typeof decoded.state === "string" ? decoded.state : "";
      returnTo = sanitizeReturnTo(decoded.returnTo);
    } catch {
      return redirectWithError(
        origin,
        "/printing",
        "Google sign-in session expired. Please try again."
      );
    }
  }

  const oauthError = url.searchParams.get("error");
  if (oauthError) {
    const friendly =
      oauthError === "access_denied"
        ? "Google sign-in was cancelled."
        : "Google sign-in could not be completed. Please try again.";
    return redirectWithError(origin, returnTo, friendly);
  }

  const code = url.searchParams.get("code") || "";
  const state = url.searchParams.get("state") || "";

  if (
    !expectedState ||
    !state ||
    expectedState.length !== state.length ||
    !crypto.timingSafeEqual(Buffer.from(expectedState), Buffer.from(state))
  ) {
    return redirectWithError(
      origin,
      returnTo,
      "Invalid sign-in verification state. Please try again."
    );
  }

  if (!code) {
    return redirectWithError(
      origin,
      returnTo,
      "Missing authorization code from Google."
    );
  }

  const { clientId, clientSecret } = getGoogleOAuthConfig();
  if (!clientId || !clientSecret) {
    return redirectWithError(
      origin,
      returnTo,
      "Google Sign-In is not configured on the server."
    );
  }

  try {
    const redirectUri = getGoogleRedirectUri(request);
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
      cache: "no-store",
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || (!tokenData.id_token && !tokenData.access_token)) {
      console.error("Google OAuth token exchange failed:", tokenData);
      return redirectWithError(
        origin,
        returnTo,
        "Could not complete Google authentication. Please try again."
      );
    }

    const profile = tokenData.id_token
      ? await verifyGoogleIdToken(tokenData.id_token, clientId)
      : await verifyGoogleAccessToken(tokenData.access_token, clientId);

    const { token } = await upsertGoogleStudentUser(profile);

    const response = NextResponse.redirect(new URL(returnTo, origin));
    response.cookies.delete(GOOGLE_OAUTH_STATE_COOKIE);
    attachAuthCookie(response, token, request);
    return response;
  } catch (error: unknown) {
    console.error("Google OAuth callback error:", error);
    const message =
      error instanceof Error && error.message
        ? error.message
        : "An unexpected error occurred during Google sign-in.";
    return redirectWithError(origin, returnTo, message);
  }
}
