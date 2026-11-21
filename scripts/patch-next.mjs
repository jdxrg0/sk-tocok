import fs from "fs";
import path from "path";

const targets = [
  "node_modules/next/dist/server/lib/find-page-file.js",
  "node_modules/next/dist/esm/server/lib/find-page-file.js",
];

const newPattern = `    function isRootNotFound(filePath) {
        if (!appDirPath) {
            return false;
        }
        const nFile = filePath.replace(/\\\\/g, '/');
        const nApp = appDirPath.replace(/\\\\/g, '/');
        const rest = nFile.startsWith(nApp + '/')
            ? nFile.slice(nApp.length + 1)
            : nFile.replace(/^.*[\\\\\\/]/, '');
        return rootNotFoundFileRegex.test(rest);
    }`;

for (const target of targets) {
  const filePath = path.resolve(target);
  if (!fs.existsSync(filePath)) continue;

  let content = fs.readFileSync(filePath, "utf8");
  const funcRegex = / {4}function isRootNotFound\(filePath\) {[\s\S]*?return rootNotFoundFileRegex\.test\(rest\);\s*}/;

  if (funcRegex.test(content)) {
    content = content.replace(funcRegex, newPattern);
    fs.writeFileSync(filePath, content, "utf8");
    console.log(`[patch-next] Patched isRootNotFound in ${target}`);
  }
}

// Windows path separator patch for normalizeAppPath
const appPathTargets = [
  "node_modules/next/dist/shared/lib/router/utils/app-paths.js",
  "node_modules/next/dist/esm/shared/lib/router/utils/app-paths.js",
];

for (const target of appPathTargets) {
  const filePath = path.resolve(target);
  if (!fs.existsSync(filePath)) continue;

  let content = fs.readFileSync(filePath, "utf8");
  let changed = false;
  if (!content.includes("route = route.replace(/\\\\/g, '/');")) {
    content = content.replace(
      "function normalizeAppPath(route) {",
      "function normalizeAppPath(route) {\n    route = route.replace(/\\\\/g, '/');"
    );
    changed = true;
    console.log(`[patch-next] Patched normalizeAppPath in ${target}`);
  }
  if (!content.includes("if (pathname === '/_not-found' || pathname.includes('not-found'))")) {
    content = content.replace(
      'if (entry === undefined) {\n        entry = appPaths.find((p) => p.includes(pathname) || p.replace(/\\\\/g, \'/\').includes(pathname)) || appPaths[0];\n    }\n    if (entry === undefined) {\n        throw new Error("Invariant: no direct app page entry found for " + pathname);',
      'if (entry === undefined) {\n        entry = appPaths.find((p) => p.includes(pathname) || p.replace(/\\\\/g, \'/\').includes(pathname)) || appPaths[0];\n    }\n    if (entry === undefined) {\n        if (pathname === \'/_not-found\' || pathname.includes(\'not-found\')) return \'/_not-found/page\';\n        throw new Error("Invariant: no direct app page entry found for " + pathname);'
    );
    changed = true;
    console.log(`[patch-next] Patched selectAppPageEntry in ${target}`);
  }
  if (changed) {
    fs.writeFileSync(filePath, content, "utf8");
  }
}

// Windows path separator patch for compiled server runtimes
const compiledTargets = [
  "node_modules/next/dist/compiled/next-server/server.runtime.prod.js",
  "node_modules/next/dist/compiled/next-server/app-page.runtime.dev.js",
  "node_modules/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js",
  "node_modules/next/dist/compiled/next-server/app-page-experimental.runtime.dev.js",
];

for (const target of compiledTargets) {
  const filePath = path.resolve(target);
  if (!fs.existsSync(filePath)) continue;

  let content = fs.readFileSync(filePath, "utf8");
  if (!content.includes('e=e.replace(/\\\\/g,"/");return tu(e.split("/"')) {
    content = content.replace(
      'td(e){return tu(e.split("/")',
      'td(e){e=e.replace(/\\\\/g,"/");return tu(e.split("/")'
    );
    fs.writeFileSync(filePath, content, "utf8");
    console.log(`[patch-next] Patched td in ${target}`);
  }
}

// Windows OneDrive ReparsePoint EINVAL readlink patch for recursive-delete
const deleteTargets = [
  "node_modules/next/dist/lib/recursive-delete.js",
  "node_modules/next/dist/esm/lib/recursive-delete.js",
];

for (const target of deleteTargets) {
  const filePath = path.resolve(target);
  if (!fs.existsSync(filePath)) continue;

  let content = fs.readFileSync(filePath, "utf8");
  // Wrap readlink in try-catch to prevent EINVAL when encountering OneDrive cloud files/reparse points
  if (content.includes("const isSymlink = part.isSymbolicLink();")) {
    content = content.replace("const isSymlink = part.isSymbolicLink();", "let isSymlink = part.isSymbolicLink();");
  }

  const cjsTarget = `if (isSymlink) {
            const linkPath = await _fs.promises.readlink(absolutePath);
            try {
                const stats = await _fs.promises.stat((0, _path.isAbsolute)(linkPath) ? linkPath : (0, _path.join)((0, _path.dirname)(absolutePath), linkPath));
                isDirectory = stats.isDirectory();
            } catch  {}
        }`;
  const cjsReplacement = `if (isSymlink) {
            try {
                const linkPath = await _fs.promises.readlink(absolutePath);
                try {
                    const stats = await _fs.promises.stat((0, _path.isAbsolute)(linkPath) ? linkPath : (0, _path.join)((0, _path.dirname)(absolutePath), linkPath));
                    isDirectory = stats.isDirectory();
                } catch  {}
            } catch {
                isSymlink = false;
            }
        }`;

  const esmTarget = `if (isSymlink) {
            const linkPath = await promises.readlink(absolutePath);
            try {
                const stats = await promises.stat(isAbsolute(linkPath) ? linkPath : join(dirname(absolutePath), linkPath));
                isDirectory = stats.isDirectory();
            } catch  {}
        }`;
  const esmReplacement = `if (isSymlink) {
            try {
                const linkPath = await promises.readlink(absolutePath);
                try {
                    const stats = await promises.stat(isAbsolute(linkPath) ? linkPath : join(dirname(absolutePath), linkPath));
                    isDirectory = stats.isDirectory();
                } catch  {}
            } catch {
                isSymlink = false;
            }
        }`;

  if (content.includes(cjsTarget)) {
    content = content.replace(cjsTarget, cjsReplacement);
    fs.writeFileSync(filePath, content, "utf8");
    console.log(`[patch-next] Patched recursiveDelete (CJS) in ${target}`);
  } else if (content.includes(esmTarget)) {
    content = content.replace(esmTarget, esmReplacement);
    fs.writeFileSync(filePath, content, "utf8");
    console.log(`[patch-next] Patched recursiveDelete (ESM) in ${target}`);
  }
}

// Fallback for missing/empty manifests in App Router-only projects and OneDrive environments
const manifestLoaderTargets = [
  "node_modules/next/dist/server/load-manifest.external.js",
  "node_modules/next/dist/esm/server/load-manifest.external.js",
];

for (const target of manifestLoaderTargets) {
  const filePath = path.resolve(target);
  if (!fs.existsSync(filePath)) continue;

  let content = fs.readFileSync(filePath, "utf8");
  if (!content.includes("/* patched fallback */")) {
    content = content.replace(
      "let manifest = (0, _fs.readFileSync)(/* turbopackIgnore: true */ path, 'utf8');\n    if (!skipParse) {\n        manifest = JSON.parse(manifest);",
      "/* patched fallback */\n    let manifest = '{}';\n    try {\n        if ((0, _fs.existsSync)(path)) {\n            manifest = (0, _fs.readFileSync)(/* turbopackIgnore: true */ path, 'utf8');\n        }\n    } catch {}\n    if (!skipParse) {\n        try {\n            manifest = manifest && manifest.trim() ? JSON.parse(manifest) : {};\n        } catch { manifest = {}; }"
    );
    content = content.replace(
      "let manifest = readFileSync(/* turbopackIgnore: true */ path, 'utf8');\n    if (!skipParse) {\n        manifest = JSON.parse(manifest);",
      "/* patched fallback */\n    let manifest = '{}';\n    try {\n        if (existsSync(path)) {\n            manifest = readFileSync(/* turbopackIgnore: true */ path, 'utf8');\n        }\n    } catch {}\n    if (!skipParse) {\n        try {\n            manifest = manifest && manifest.trim() ? JSON.parse(manifest) : {};\n        } catch { manifest = {}; }"
    );
    fs.writeFileSync(filePath, content, "utf8");
    console.log(`[patch-next] Patched loadManifest fallback in ${target}`);
  }
}

// Patch readManifest in build/index.js
const buildIndexTargets = [
  "node_modules/next/dist/build/index.js",
  "node_modules/next/dist/esm/build/index.js",
];

for (const target of buildIndexTargets) {
  const filePath = path.resolve(target);
  if (!fs.existsSync(filePath)) continue;

  let content = fs.readFileSync(filePath, "utf8");
  if (!content.includes("/* patched readManifest */")) {
    content = content.replace(
      "async function readManifest(filePath) {\n    return JSON.parse(await readFileUtf8(filePath));\n}",
      "/* patched readManifest */\nasync function readManifest(filePath) {\n    try {\n        const content = await readFileUtf8(filePath);\n        return content && content.trim() ? JSON.parse(content) : {};\n    } catch { return {}; }\n}"
    );
    fs.writeFileSync(filePath, content, "utf8");
    console.log(`[patch-next] Patched readManifest in ${target}`);
  }
}

// Patch route-module interceptionRoutePatterns for undefined beforeFiles
const routeModuleTargets = [
  "node_modules/next/dist/server/route-modules/route-module.js",
  "node_modules/next/dist/esm/server/route-modules/route-module.js",
];

for (const target of routeModuleTargets) {
  const filePath = path.resolve(target);
  if (!fs.existsSync(filePath)) continue;

  let content = fs.readFileSync(filePath, "utf8");
  if (!content.includes("/* patched interceptionRoutePatterns */")) {
    content = content.replace(
      "interceptionRoutePatterns: routesManifest.rewrites.beforeFiles.filter(_generateinterceptionroutesrewrites.isInterceptionRouteRewrite).map((rewrite)=>new RegExp(rewrite.regex))",
      "/* patched interceptionRoutePatterns */\n                interceptionRoutePatterns: ((Array.isArray(routesManifest == null ? void 0 : routesManifest.rewrites) ? [] : (routesManifest == null ? void 0 : routesManifest.rewrites?.beforeFiles) || []).filter(_generateinterceptionroutesrewrites.isInterceptionRouteRewrite).map((rewrite)=>new RegExp(rewrite.regex)))"
    );
    fs.writeFileSync(filePath, content, "utf8");
    console.log(`[patch-next] Patched interceptionRoutePatterns in ${target}`);
  }
}

// Patch render.js for dynamicCssManifest safe Set
const renderTargets = [
  "node_modules/next/dist/server/render.js",
  "node_modules/next/dist/esm/server/render.js",
];

for (const target of renderTargets) {
  const filePath = path.resolve(target);
  if (!fs.existsSync(filePath)) continue;

  let content = fs.readFileSync(filePath, "utf8");
  if (content.includes("dynamicCssManifest: new Set(renderOpts.dynamicCssManifest || [])")) {
    content = content.replace(
      "dynamicCssManifest: new Set(renderOpts.dynamicCssManifest || [])",
      "dynamicCssManifest: new Set(Array.isArray(renderOpts.dynamicCssManifest) ? renderOpts.dynamicCssManifest : (renderOpts.dynamicCssManifest instanceof Set ? renderOpts.dynamicCssManifest : []))"
    );
    fs.writeFileSync(filePath, content, "utf8");
    console.log(`[patch-next] Patched render.js dynamicCssManifest in ${target}`);
  }
}

// Patch checkIsOnDemandRevalidate for undefined previewProps
const apiUtilsTargets = [
  "node_modules/next/dist/server/api-utils/index.js",
  "node_modules/next/dist/esm/server/api-utils/index.js",
];

for (const target of apiUtilsTargets) {
  const filePath = path.resolve(target);
  if (!fs.existsSync(filePath)) continue;

  let content = fs.readFileSync(filePath, "utf8");
  if (!content.includes("/* patched checkIsOnDemandRevalidate */")) {
    content = content.replace(
      "const isOnDemandRevalidate = previewModeId === previewProps.previewModeId;",
      "/* patched checkIsOnDemandRevalidate */\n    const isOnDemandRevalidate = Boolean(previewProps && previewModeId && previewModeId === previewProps.previewModeId);"
    );
    fs.writeFileSync(filePath, content, "utf8");
    console.log(`[patch-next] Patched checkIsOnDemandRevalidate in ${target}`);
  }
}

// Patch collect-build-traces.js for missing .nft.json files
const traceTargets = [
  "node_modules/next/dist/build/collect-build-traces.js",
  "node_modules/next/dist/esm/build/collect-build-traces.js",
];

for (const target of traceTargets) {
  const filePath = path.resolve(target);
  if (!fs.existsSync(filePath)) continue;

  let content = fs.readFileSync(filePath, "utf8");
  let changed = false;
  if (!content.includes("/* patched safe nft.json read */")) {
    content = content.replace(
      /const existingTrace = JSON\.parse\(await [a-zA-Z0-9_.]+\.readFile\(traceOutputPath, 'utf8'\)\);/g,
      "/* patched safe nft.json read */\n                let existingTrace = { version: 1, files: [] };\n                try {\n                    existingTrace = JSON.parse(await fs.promises?.readFile ? await fs.promises.readFile(traceOutputPath, 'utf8') : await fs.readFile(traceOutputPath, 'utf8'));\n                } catch {}"
    );
    content = content.replace(
      /const selectedTrace = JSON\.parse\(await [a-zA-Z0-9_.]+\.readFile\(selectedTracePath, 'utf8'\)\);/g,
      "let selectedTrace = { version: 1, files: [] };\n                try {\n                    selectedTrace = JSON.parse(await fs.promises?.readFile ? await fs.promises.readFile(selectedTracePath, 'utf8') : await fs.readFile(selectedTracePath, 'utf8'));\n                } catch {}"
    );
    content = content.replace(
      /const trace = JSON\.parse\(await [a-zA-Z0-9_.]+\.readFile\(tracePath, 'utf8'\)\);/g,
      "let trace = { version: 1, files: [] };\n                    try {\n                        trace = JSON.parse(await fs.promises?.readFile ? await fs.promises.readFile(tracePath, 'utf8') : await fs.readFile(tracePath, 'utf8'));\n                    } catch {}"
    );
    content = content.replace(
      /const traceContent = JSON\.parse\(await [a-zA-Z0-9_.]+\.readFile\(traceFile, 'utf8'\)\);/g,
      "let traceContent = { version: 1, files: [] };\n            try {\n                traceContent = JSON.parse(await fs.promises?.readFile ? await fs.promises.readFile(traceFile, 'utf8') : await fs.readFile(traceFile, 'utf8'));\n            } catch {}"
    );
    changed = true;
  }
  if (changed) {
    fs.writeFileSync(filePath, content, "utf8");
    console.log(`[patch-next] Patched collect-build-traces in ${target}`);
  }
}

// Patch webpack bundle5.js for server chunks fallback
const bundle5Path = path.resolve("node_modules/next/dist/compiled/webpack/bundle5.js");
if (fs.existsSync(bundle5Path)) {
  let content = fs.readFileSync(bundle5Path, "utf8");
  const targetStr = "`installChunk(require(${JSON.stringify(Ze)} + ${R.getChunkScriptFilename}(chunkId)));`";
  const replacementStr = "`try { installChunk(require(${JSON.stringify(Ze)} + ${R.getChunkScriptFilename}(chunkId))); } catch(e) { if (e.code === 'MODULE_NOT_FOUND') { installChunk(require(${JSON.stringify(Ze)} + \"chunks/\" + ${R.getChunkScriptFilename}(chunkId))); } else throw e; }`";
  if (content.includes(targetStr)) {
    content = content.replace(targetStr, replacementStr);
    fs.writeFileSync(bundle5Path, content, "utf8");
    console.log(`[patch-next] Patched webpack server chunk fallback in bundle5.js`);
  }
}






