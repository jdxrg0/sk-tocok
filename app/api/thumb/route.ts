import { NextResponse } from "next/server";
import sharp from "sharp";

export const dynamic = "force-dynamic";

function isPrivateIpOrHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (
    h === "localhost" ||
    h === "127.0.0.1" ||
    h === "0.0.0.0" ||
    h === "::1" ||
    h.endsWith(".local") ||
    h.endsWith(".internal")
  ) {
    return true;
  }

  // Check IPv4 private ranges: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16
  const parts = h.split(".").map(Number);
  if (parts.length === 4 && parts.every((p) => !Number.isNaN(p) && p >= 0 && p <= 255)) {
    if (parts[0] === 10) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 127) return true;
  }

  return false;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const targetUrl = searchParams.get("url") || "";
    const widthParam = searchParams.get("w") || searchParams.get("width");
    const targetWidth = Math.min(Math.max(parseInt(widthParam || "400", 10) || 400, 50), 1200);

    if (!targetUrl) {
      return NextResponse.json({ error: "Missing image url parameter" }, { status: 400 });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(targetUrl);
    } catch {
      return NextResponse.json({ error: "Invalid target URL" }, { status: 400 });
    }

    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return NextResponse.json({ error: "Only http and https protocols are supported" }, { status: 400 });
    }

    if (isPrivateIpOrHost(parsedUrl.hostname)) {
      return NextResponse.json({ error: "Forbidden target host" }, { status: 403 });
    }

    // Fetch original image with timeout
    let res: Response;
    try {
      res = await fetch(parsedUrl.toString(), {
        signal: AbortSignal.timeout(6000),
        headers: {
          "User-Agent": "SK-Tocok-ImageOptimizer/1.0",
          Accept: "image/webp,image/png,image/jpeg,*/*",
        },
      });
    } catch {
      // On connection blip, redirect to original URL
      return NextResponse.redirect(targetUrl, 302);
    }

    if (!res.ok) {
      return NextResponse.redirect(targetUrl, 302);
    }

    const rawBuffer = Buffer.from(await res.arrayBuffer());
    const rawType = res.headers.get("content-type") || "";

    // If SVG, return as is
    if (rawType.includes("svg") || targetUrl.endsWith(".svg")) {
      return new NextResponse(new Uint8Array(rawBuffer), {
        status: 200,
        headers: {
          "Content-Type": "image/svg+xml",
          "Cache-Control": "public, max-age=31536000, immutable",
          "X-Content-Type-Options": "nosniff",
        },
      });
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
          "Cache-Control": "public, max-age=31536000, immutable",
          "X-Content-Type-Options": "nosniff",
        },
      });
    } catch (sharpErr) {
      console.warn("Universal thumbnail resize fallback:", sharpErr);
      return NextResponse.redirect(targetUrl, 302);
    }
  } catch (err) {
    console.error("Thumbnail proxy error:", err);
    return NextResponse.json({ error: "Failed to process thumbnail" }, { status: 500 });
  }
}
