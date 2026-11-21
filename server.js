const { createServer } = require('http');
const next = require('next');
const fs = require('fs');
const path = require('path');

const port = parseInt(process.env.PORT || '3000', 10);
const hostname = '0.0.0.0';

const hasBuild = fs.existsSync(path.join(__dirname, '.next', 'BUILD_ID'));
const dev = process.argv.includes('--dev') || process.env.NODE_ENV === 'development';

console.log(`[Server] Starting Next.js (mode: ${dev ? 'DEVELOPMENT' : 'PRODUCTION'}, port: ${port})...`);

const app = next({ dev, hostname, port, dir: __dirname });
const handle = app.getRequestHandler();

process.on('uncaughtException', (err) => {
  console.error('[Server UncaughtException]', err?.stack || err?.message || err);
});

process.on('unhandledRejection', (reason) => {
  console.warn('[Server UnhandledRejection]', reason?.stack || reason?.message || reason);
});

process.on('exit', (code) => {
  console.log(`[Server Process Exit] Code: ${code}`);
});

// Active keepalive heartbeat to prevent event loop exhaustion
setInterval(() => {}, 30000);

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      await handle(req, res);
    } catch (err) {
      console.error('[Request Error]', req.url, err?.stack || err);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(`<!DOCTYPE html><html><head><title>500 - Server Error</title><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0f172a;color:#f8fafc"><div style="text-align:center;padding:2rem"><h1 style="font-size:2rem;margin-bottom:0.5rem">500 - Server Error</h1><p style="color:#94a3b8">The server encountered an error processing your request. Please try refreshing.</p></div></body></html>`);
      }
    }
  });

  server.listen(port, hostname, () => {
    console.log(`✓ [Server Ready] Listening on http://localhost:${port} and http://${hostname}:${port}`);
  });
}).catch((err) => {
  console.error('[Server Preparation Error]', err?.stack || err);
  process.exit(1);
});
