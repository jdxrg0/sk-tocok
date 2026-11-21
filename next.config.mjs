import fs from 'fs';
import path from 'path';

/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,
  reactStrictMode: false,
  images: {
    unoptimized: true,
  },
  onDemandEntries: {
    maxInactiveAge: 60 * 60 * 1000,
    pagesBufferLength: 25,
  },
  allowedDevOrigins: [
    "192.168.100.151",
    "192.168.100.10",
    "localhost",
    "127.0.0.1",
    "*.trycloudflare.com",
    "trycloudflare.com",
  ],
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  webpack: (config, { isServer }) => {
    if (isServer && process.platform === 'win32') {
      config.plugins.push({
        apply(compiler) {
          compiler.hooks.afterEmit.tap('FixWebpackRuntime', () => {
            const runtimePath = path.join(compiler.outputPath, 'webpack-runtime.js');
            try {
              if (fs.existsSync(runtimePath)) {
                let content = fs.readFileSync(runtimePath, 'utf8');
                if (content.includes('installChunk(require("./" + __webpack_require__.u(chunkId)));')) {
                  content = content.replace(
                    'installChunk(require("./" + __webpack_require__.u(chunkId)));',
                    'try { installChunk(require("./" + __webpack_require__.u(chunkId))); } catch(e) { if (e.code === "MODULE_NOT_FOUND") { installChunk(require("./chunks/" + __webpack_require__.u(chunkId))); } else throw e; }'
                  );
                  fs.writeFileSync(runtimePath, content, 'utf8');
                }
              }
            } catch (err) {
              console.warn('[FixWebpackRuntime plugin warning]', err);
            }
          });
        },
      });
    }
    return config;
  },
};

export default nextConfig;
