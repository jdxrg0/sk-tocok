export const dynamic = "force-dynamic";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";
import {
  GOOGLE_OAUTH_STATE_COOKIE,
  getGoogleOAuthConfig,
  getGoogleRedirectUri,
  getRequestOrigin,
  sanitizeReturnTo,
} from "@/lib/googleAuth";
import { isRequestSecure } from "@/lib/auth";
import { getJwtSecret } from "@/lib/env";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/rateLimit";

export async function GET(request: Request) {
  const limit = await checkRateLimit({
    request,
    bucket: "google_oauth_start",
    max: 30,
    windowMs: 15 * 60 * 1000,
  });
  if (!limit.allowed) {
    return rateLimitExceededResponse(limit.retryAfterSeconds);
  }

  const jwtSecret = getJwtSecret();
  const url = new URL(request.url);
  const returnTo = sanitizeReturnTo(url.searchParams.get("returnTo"));
  const origin = getRequestOrigin(request);

  const { clientId, clientSecret } = getGoogleOAuthConfig();

  if (!clientId || !clientSecret) {
    const errorUrl = new URL(returnTo, origin);
    errorUrl.searchParams.set(
      "auth_error",
      "Google Sign-In is not configured yet. Please add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET."
    );
    return NextResponse.redirect(errorUrl);
  }

  const state = crypto.randomBytes(24).toString("hex");
  const redirectUri = getGoogleRedirectUri(request);

  const signedState = jwt.sign({ state, returnTo }, jwtSecret, {
    algorithm: "HS256",
    expiresIn: "10m",
  });

  const googleAuthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  googleAuthUrl.searchParams.set("client_id", clientId);
  googleAuthUrl.searchParams.set("redirect_uri", redirectUri);
  googleAuthUrl.searchParams.set("response_type", "code");
  googleAuthUrl.searchParams.set("scope", "openid email profile");
  googleAuthUrl.searchParams.set("state", state);
  googleAuthUrl.searchParams.set("prompt", "select_account");

  const response = NextResponse.redirect(googleAuthUrl);
  response.cookies.set({
    name: GOOGLE_OAUTH_STATE_COOKIE,
    value: signedState,
    httpOnly: true,
    secure: isRequestSecure(request),
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 10,
  });

  return response;
}
