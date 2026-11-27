import { NextResponse } from "next/server";
import sharp from "sharp";
import { validatePublicExternalUrl } from "@/lib/urlSafety";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/rateLimit";
import { logSecurityEvent } from "@/lib/securityLogger";
import { snapThumbnailWidth } from "@/lib/validation";

export const dynamic = "force-dynamic";

const ALLOWED_IMAGE_HOSTS = [
  "api.dicebear.com",
  "lh3.googleusercontent.com",
  "drive.google.com",
  "public.blob.vercel-storage.com",
  "googleusercontent.com",
] as const;

const MAX_REMOTE_IMAGE_BYTES = 10 * 1024 * 1024;

export async function GET(request: Request) {
  try {
    const limit = await checkRateLimit({
      request,
      bucket: "thumb_proxy",
      max: 60,
      windowMs: 60 * 1000,
      persistToDb: true,
    });
    if (!limit.allowed) {
      return rateLimitExceededResponse(limit.retryAfterSeconds);
    }

    const { searchParams } = new URL(request.url);
    const targetUrl = (searchParams.get("url") || "").trim();
    const widthParam = searchParams.get("w") || searchParams.get("width");
    const targetWidth = snapThumbnailWidth(widthParam, [200, 400, 800, 1200]) || 400;

    if (!targetUrl) {
      return NextResponse.json(
        { error: "Missing image url parameter" },
        { status: 400 }
      );
    }

    let validatedUrl: URL;
    try {
      validatedUrl = await validatePublicExternalUrl(targetUrl, {
        allowedHosts: ALLOWED_IMAGE_HOSTS,
      });
    } catch (err) {
      await logSecurityEvent({
        eventType: "SSRF_BLOCKED_THUMB_PROXY",
        severity: "high",
        request,
        details: {
          targetUrl: targetUrl.slice(0, 200),
          reason: err instanceof Error ? err.message : "validation_failed",
        },
      });
      return NextResponse.json(
        { error: "Forbidden or untrusted image host" },
        { status: 403 }
      );
    }

    let res: Response;
    try {
      res = await fetch(validatedUrl.toString(), {
        method: "GET",
        redirect: "manual",
        signal: AbortSignal.timeout(6000),
        headers: {
          "User-Agent": "SK-Tocok-ImageOptimizer/1.0",
          Accept: "image/webp,image/png,image/jpeg,image/gif,*/*",
        },
      });
    } catch {
      return NextResponse.json(
        { error: "Unable to fetch upstream image" },
        { status: 502 }
      );
    }

    // Do not blindly follow redirects to untrusted or internal targets
    if (res.status >= 300 && res.status < 400) {
      return NextResponse.json(
        { error: "Upstream redirects are not permitted" },
        { status: 403 }
      );
    }

    if (!res.ok) {
      return NextResponse.json(
        { error: "Upstream image could not be loaded" },
        { status: 404 }
      );
    }

    const declaredLength = parseInt(res.headers.get("content-length") || "0", 10);
    if (Number.isFinite(declaredLength) && declaredLength > MAX_REMOTE_IMAGE_BYTES) {
      return NextResponse.json(
        { error: "Remote image exceeds maximum allowed size" },
        { status: 413 }
      );
    }

    const rawType = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    const rawBuffer = Buffer.from(await res.arrayBuffer());
    if (rawBuffer.length === 0 || rawBuffer.length > MAX_REMOTE_IMAGE_BYTES) {
      return NextResponse.json(
        { error: "Invalid or oversized remote image payload" },
        { status: 413 }
      );
    }

    // Never serve raw image/svg+xml (prevents stored/reflected SVG XSS).
    if (rawType.includes("svg") || validatedUrl.pathname.toLowerCase().endsWith(".svg")) {
      return NextResponse.json(
        { error: "Raw SVG image proxying is disabled for security" },
        { status: 415 }
      );
    }

    try {
      const resized = await sharp(rawBuffer)
        .rotate()
        .resize({ width: targetWidth, withoutEnlargement: true })
        .webp({ quality: 75 })
        .toBuffer();

      return new NextResponse(new Uint8Array(resized), {
        status: 200,
        headers: {
          "Content-Type": "image/webp",
          "Content-Length": String(resized.length),
          "Cache-Control": "public, max-age=86400",
          "X-Content-Type-Options": "nosniff",
          "Content-Security-Policy": "default-src 'none'",
        },
      });
    } catch {
      return NextResponse.json(
        { error: "Target resource is not a supported raster image" },
        { status: 415 }
      );
    }
  } catch (err) {
    console.error("Thumbnail proxy error:", err);
    return NextResponse.json(
      { error: "Failed to process thumbnail" },
      { status: 500 }
    );
  }
}
