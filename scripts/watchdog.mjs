import { spawn, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const nextBin = path.join(rootDir, 'node_modules', 'next', 'dist', 'bin', 'next');

let devProcess = null;
let consecutiveFailures = 0;
let isRestarting = false;

function log(msg) {
  const time = new Date().toLocaleTimeString();
  console.log(`[Watchdog ${time}] ${msg}`);
}

process.on('uncaughtException', (err) => {
  log(`Uncaught Exception in watchdog: ${err.message}\n${err.stack}`);
});

process.on('unhandledRejection', (reason) => {
  log(`Unhandled Rejection in watchdog: ${reason}`);
});

function killProcessTree(pid) {
  try {
    if (Number(pid) === process.pid || Number(pid) === process.ppid) return;
    execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore' });
  } catch (e) {}
}

function killPort(port) {
  try {
    const output = execSync(
      `powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess"`,
      { encoding: 'utf8' }
    ).trim();

    if (output) {
      const pids = output.split(/\r?\n/).map(p => p.trim()).filter(Boolean);
      for (const p of pids) {
        if (Number(p) === process.pid || Number(p) === process.ppid) continue;
        log(`Freeing port ${port} by terminating PID ${p}...`);
        killProcessTree(p);
      }
    }
  } catch (e) {}
}

function isBuildRunning() {
  try {
    const cmd = 'powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.Name -eq \'node.exe\' } | Select-Object -ExpandProperty CommandLine"';
    const output = execSync(cmd, { encoding: 'utf8' });
    return /(\b|[\\\/])next(\.js)?\s+build|npm\s+(run\s+)?build/i.test(output);
  } catch (e) {
    return false;
  }
}

function cleanNextDir() {
  try {
    const nextDir = path.join(rootDir, '.next');
    if (fs.existsSync(nextDir)) {
      log('Cleaning .next directory to prevent manifest corruption...');
      fs.rmSync(nextDir, { recursive: true, force: true });
    }
  } catch (e) {
    log(`Note: could not completely clean .next (${e.message})`);
  }
}

let isPrewarming = false;
let restartCount = 0;
let lastRestartTimestamp = 0;

function ensureBuild() {
  const isDevCommand = process.argv.includes('--dev') || process.env.npm_lifecycle_event?.startsWith('dev');
  if (isDevCommand) {
    return; // In dev mode, always run Next.js in development mode without running a blocking build
  }
  const hasProdBuild = fs.existsSync(path.join(rootDir, '.next', 'BUILD_ID'));
  if (!hasProdBuild) {
    log('No production build found in .next. Running "next build" to generate production assets...');
    try {
      execSync('npm run build', { cwd: rootDir, stdio: 'inherit' });
    } catch (e) {
      log(`Build encountered error (${e.message}), attempting fallback.`);
    }
  }
}

async function prewarmRoutes() {
  if (isPrewarming) return;
  isPrewarming = true;

  // Wait for Next.js server to start accepting TCP connections
  for (let i = 0; i < 30; i++) {
    if (isRestarting || !devProcess) {
      isPrewarming = false;
      return;
    }
    try {
      const res = await fetch('http://127.0.0.1:3000/api/health', {
        signal: AbortSignal.timeout(30000),
      });
      if (res.ok) break;
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  const routes = [
    '/',
    '/transparency',
    '/printing',
    '/admin',
    '/attendance',
    '/api/health',
    '/api/auth/me',
    '/api/categories',
    '/api/expenses',
    '/api/deposits',
    '/api/admin/settings',
  ];

  log('Pre-warming core pages and API routes so navigation is instant...');
  for (const route of routes) {
    if (isRestarting || !devProcess) break;
    try {
      await fetch(`http://127.0.0.1:3000${route}`, {
        signal: AbortSignal.timeout(30000),
      });
    } catch {
      // Ignore individual route warmup failures
    }
  }
  log('All core routes pre-warmed and cached in memory!');
  isPrewarming = false;
}

function startDevServer() {
  killPort(3000);
  
  ensureBuild();

  const isDevCommand = process.argv.includes('--dev') || process.env.npm_lifecycle_event?.startsWith('dev');
  const hasProdBuild = fs.existsSync(path.join(rootDir, '.next', 'BUILD_ID'));
  const mode = (hasProdBuild && !isDevCommand) ? 'start' : 'dev';

  log(`Starting Next.js server in [${mode.toUpperCase()}] mode on 0.0.0.0:3000...`);

  let nodeOptions = process.env.NODE_OPTIONS || '';
  if (!nodeOptions.includes('max-old-space-size')) {
    nodeOptions = `${nodeOptions} --max-old-space-size=4096`.trim();
  }
  if (!nodeOptions.includes('unhandled-rejections')) {
    nodeOptions = `${nodeOptions} --unhandled-rejections=warn`.trim();
  }

  const serverScript = path.join(rootDir, 'server.js');
  const args = [serverScript];

  devProcess = spawn(process.execPath, args, {
    cwd: rootDir,
    stdio: ['ignore', 'inherit', 'inherit'],
    env: { ...process.env, PORT: '3000', NODE_OPTIONS: nodeOptions, NODE_ENV: mode === 'dev' ? 'development' : 'production' }
  });

  devProcess.on('exit', (code, signal) => {
    log(`Next.js server exited (code: ${code}, signal: ${signal})`);
    devProcess = null;
    if (!isRestarting) {
      log('Next.js server stopped unexpectedly, triggering recovery...');
      restartDevServer();
    }
  });

  // Trigger background pre-warm after startup
  setTimeout(() => {
    prewarmRoutes();
  }, 3000);
}

async function restartDevServer() {
  if (isRestarting) return;
  isRestarting = true;

  const now = Date.now();
  if (now - lastRestartTimestamp < 5000) {
    restartCount++;
  } else {
    restartCount = 1;
  }
  lastRestartTimestamp = now;

  if (restartCount > 5) {
    log('Detected rapid restart cycle. Pausing 10s before retrying to prevent thrashing...');
    await new Promise(r => setTimeout(r, 10000));
    restartCount = 0;
  }

  log('Initiating server restart/recovery...');

  if (devProcess && devProcess.pid) {
    killProcessTree(devProcess.pid);
    devProcess = null;
  }
  killPort(3000);

  // If another agent is actively running a build, wait for it
  let waitCount = 0;
  while (isBuildRunning()) {
    waitCount++;
    log('Detected active "next build" process. Waiting for build to finish before restarting server...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    if (waitCount > 60) break; // Safety timeout after 2 minutes
  }

  // Small delay to ensure files unlocked
  await new Promise(resolve => setTimeout(resolve, 1500));

  startDevServer();
  consecutiveFailures = 0;
  isRestarting = false;
}

async function checkHealth() {
  if (isRestarting) return;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const res = await fetch('http://127.0.0.1:3000/api/health', {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    });
    clearTimeout(timeout);

    if (res.status === 200) {
      if (consecutiveFailures > 0) {
        log('Server health restored (HTTP 200).');
      }
      consecutiveFailures = 0;
    } else if (res.status >= 500) {
      consecutiveFailures++;
      log(`Server returned HTTP ${res.status} (failure count: ${consecutiveFailures})`);
      if (consecutiveFailures >= 6) {
        log('Persistent 500 errors detected across multiple minutes. Auto-restarting...');
        await restartDevServer();
      }
    }
  } catch (err) {
    // Only count as failure if connection refused (server not listening), NOT timeout during initial module compilation!
    const isConnRefused = err.cause?.code === 'ECONNREFUSED' || err.code === 'ECONNREFUSED';
    if (isConnRefused) {
      consecutiveFailures++;
      log(`Connection refused: server port not listening (count: ${consecutiveFailures})`);
      if (consecutiveFailures >= 10) {
        log('Server port dead for extended period. Auto-restarting dev server...');
        await restartDevServer();
      }
    } else {
      // Timeout/abort: dev server is busy compiling pages. Do not kill it!
    }
  }
}

// Initial start
startDevServer();

// Health check interval every 10 seconds
setInterval(checkHealth, 10000);

// Graceful exit
process.on('SIGINT', () => {
  log('Shutting down watchdog and dev server...');
  if (devProcess && devProcess.pid) {
    killProcessTree(devProcess.pid);
  }
  killPort(3000);
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('Shutting down watchdog and dev server...');
  if (devProcess && devProcess.pid) {
    killProcessTree(devProcess.pid);
  }
  killPort(3000);
  process.exit(0);
});
