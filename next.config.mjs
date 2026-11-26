import fs from "fs";
import path from "path";

const isProd = process.env.NODE_ENV === "production";

const cspDirectives = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"} https://accounts.google.com/gsi/client`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://api.dicebear.com https://lh3.googleusercontent.com https://*.googleusercontent.com https://drive.google.com https://*.public.blob.vercel-storage.com",
  "font-src 'self' data:",
  "connect-src 'self' https://accounts.google.com https://oauth2.googleapis.com https://www.googleapis.com",
  "frame-src https://accounts.google.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://accounts.google.com",
  "frame-ancestors 'none'",
  ...(isProd ? ["upgrade-insecure-requests"] : []),
];

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Content-Security-Policy", value: cspDirectives.join("; ") },
  ...(isProd
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]
    : []),
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  devIndicators: false,
  reactStrictMode: false,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  images: {
    unoptimized: true,
  },
  onDemandEntries: {
    maxInactiveAge: 60 * 60 * 1000,
    pagesBufferLength: 25,
  },
  ...(isProd
    ? {}
    : {
        allowedDevOrigins: [
          "localhost",
          "127.0.0.1",
        ],
      }),
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
  webpack: (config, { isServer }) => {
    if (isServer && process.platform === "win32") {
      config.plugins.push({
        apply(compiler) {
          compiler.hooks.afterEmit.tap("FixWebpackRuntime", () => {
            const runtimePath = path.join(compiler.outputPath, "webpack-runtime.js");
            try {
              if (fs.existsSync(runtimePath)) {
                let content = fs.readFileSync(runtimePath, "utf8");
                if (content.includes('installChunk(require("./" + __webpack_require__.u(chunkId)));')) {
                  content = content.replace(
                    'installChunk(require("./" + __webpack_require__.u(chunkId)));',
                    'var u = __webpack_require__.u(chunkId); try { installChunk(require("./" + u)); } catch(e) { if (e.code === "MODULE_NOT_FOUND" && !u.startsWith("chunks/")) { installChunk(require("./chunks/" + u)); } else throw e; }'
                  );
                  fs.writeFileSync(runtimePath, content, "utf8");
                }
              }
            } catch (err) {
              console.warn("[FixWebpackRuntime plugin warning]", err);
            }

            // Ensure server pages-manifest.json registers default pages (_app, _document, _error)
            try {
              const pagesManifestPath = path.join(compiler.outputPath, "pages-manifest.json");
              let manifest = {};
              if (fs.existsSync(pagesManifestPath)) {
                try {
                  manifest = JSON.parse(fs.readFileSync(pagesManifestPath, "utf8"));
                } catch {
                  manifest = {};
                }
              }
              const defaultPages = ["_app", "_document", "_error"];
              let updated = false;
              for (const p of defaultPages) {
                const route = `/${p}`;
                if (!manifest[route] && fs.existsSync(path.join(compiler.outputPath, "pages", `${p}.js`))) {
                  manifest[route] = `pages/${p}.js`;
                  updated = true;
                }
              }
              if (updated) {
                fs.writeFileSync(pagesManifestPath, JSON.stringify(manifest, null, 2), "utf8");
              }
            } catch (err) {
              console.warn("[FixWebpackRuntime pages-manifest warning]", err);
            }
          });
        },
      });
    }
    return config;
  },
};

export default nextConfig;
