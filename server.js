const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const fs = require('fs');
const path = require('path');

const port = parseInt(process.env.PORT || '3000', 10);
const hostname = '0.0.0.0';

// Check if production build exists
const hasBuild = fs.existsSync(path.join(__dirname, '.next', 'BUILD_ID'));
const dev = !hasBuild && process.env.NODE_ENV !== 'production';

console.log(`[Server] Starting Next.js (mode: ${dev ? 'DEVELOPMENT' : 'PRODUCTION'})...`);

const app = next({ dev });
const handle = app.getRequestHandler();

process.on('uncaughtException', (err) => {
  console.error('[Server UncaughtException]', err?.message || err);
});

process.on('unhandledRejection', (reason) => {
  console.warn('[Server UnhandledRejection]', reason?.message || reason);
});

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('[Request Error]', req.url, err?.message || err);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.end('Internal Server Error');
      }
    }
  });

  server.listen(port, hostname, () => {
    console.log(`✓ [Server Ready] Listening on http://localhost:${port} and http://${hostname}:${port}`);
  });
}).catch((err) => {
  console.error('[Server Preparation Error]', err);
  process.exit(1);
});
