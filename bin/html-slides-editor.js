#!/usr/bin/env node
"use strict";

const fs = require("fs");
const http = require("http");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SKILL_DIR = path.join(ROOT, ".codex", "skills", "html-slides-editor");
const ASSETS_DIR = path.join(SKILL_DIR, "assets");
const RUNTIME_NAME = "html-slides-editor-runtime.js";
const RUNTIME_VERSION = "20260612-paused-nav-repair";
const RUNTIME_SRC = `./assets/${RUNTIME_NAME}?v=${RUNTIME_VERSION}`;
const RUNTIME_TAG = `<script src="${RUNTIME_SRC}"></script>`;
const AUTOSAVE_NAME = "html-slides-editor-autosave.html";
const SERVER_NAME = "html-slides-editor-server.js";
const AUTOSAVE_START = "<!-- HTML Slides Editor autosave start -->";
const AUTOSAVE_END = "<!-- HTML Slides Editor autosave end -->";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};

function usage() {
  console.log(`HTML Slides Editor

Usage:
  html-slides-editor enable [--autosave] [--serve] [--port 8765] <path/to/index.html>
  html-slides-editor disable <path/to/index.html>
  html-slides-editor serve [--port 8765] <path/to/index.html>
  html-slides-editor status <path/to/index.html>

Examples:
  npx html-slides-editor enable --autosave --serve ./slides/index.html
  npx html-slides-editor disable ./slides/index.html
`);
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const command = args.shift();
  const options = { autosave: false, serve: false, port: 8765, html: null };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--autosave" || arg === "-a") {
      options.autosave = true;
    } else if (arg === "--serve") {
      options.serve = true;
      options.autosave = true;
    } else if (arg === "--port" || arg === "-p") {
      const next = args[++i];
      if (!next) throw new Error("--port requires a value");
      options.port = Number(next);
      if (!Number.isInteger(options.port) || options.port <= 0) throw new Error("Port must be a positive integer");
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (!options.html) {
      options.html = arg;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }

  return { command, options };
}

function resolveHtml(htmlArg) {
  if (!htmlArg) throw new Error("Missing HTML file path");
  const target = path.resolve(process.cwd(), htmlArg);
  const stat = fs.existsSync(target) ? fs.statSync(target) : null;
  const htmlPath = stat && stat.isDirectory() ? path.join(target, "index.html") : target;
  if (!fs.existsSync(htmlPath)) throw new Error(`HTML file not found: ${htmlPath}`);
  if (!fs.statSync(htmlPath).isFile()) throw new Error(`Not a file: ${htmlPath}`);
  return htmlPath;
}

function copyAsset(name, htmlPath) {
  const src = path.join(ASSETS_DIR, name);
  if (!fs.existsSync(src)) throw new Error(`Missing bundled asset: ${src}`);
  const assetsDir = path.join(path.dirname(htmlPath), "assets");
  fs.mkdirSync(assetsDir, { recursive: true });
  const dest = path.join(assetsDir, name);
  fs.copyFileSync(src, dest);
  return dest;
}

function copyServer(htmlPath) {
  const src = path.join(ASSETS_DIR, SERVER_NAME);
  if (!fs.existsSync(src)) throw new Error(`Missing bundled server: ${src}`);
  const dest = path.join(path.dirname(htmlPath), SERVER_NAME);
  fs.copyFileSync(src, dest);
  return dest;
}

function runtimePattern() {
  return /\n?\s*<script\s+src=["']\.?\/assets\/html-(?:slides|deck)-editor-runtime\.js(?:\?[^"']*)?["']>\s*<\/script>\s*/gi;
}

function autosavePattern() {
  return new RegExp(`\\n?\\s*${escapeRegExp(AUTOSAVE_START)}[\\s\\S]*?${escapeRegExp(AUTOSAVE_END)}\\s*`, "gi");
}

function legacyAutosavePattern() {
  return /\n?\s*<script>\s*\(function\s*\(\)\s*\{\s*var\s+saveTimer[\s\S]*?fetch\(["']\/save["'][\s\S]*?\}\)\(\);\s*<\/script>\s*/gi;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function insertBeforeBody(html, snippet) {
  return html.includes("</body>") ? html.replace("</body>", `${snippet}</body>`) : `${html.trimEnd()}\n${snippet}`;
}

function enableEditor(htmlPath, { autosave }) {
  const runtimePath = copyAsset(RUNTIME_NAME, htmlPath);
  let html = fs.readFileSync(htmlPath, "utf8");
  const original = html;
  let result = "enabled";

  if (html.includes(RUNTIME_TAG)) {
    result = "already-enabled";
  } else if (runtimePattern().test(html)) {
    html = html.replace(runtimePattern(), `\n${RUNTIME_TAG}\n`);
    result = "updated";
  } else {
    html = insertBeforeBody(html, `${RUNTIME_TAG}\n`);
  }

  let serverPath = null;
  if (autosave) {
    serverPath = copyServer(htmlPath);
    const autosaveSnippet = fs.readFileSync(path.join(ASSETS_DIR, AUTOSAVE_NAME), "utf8").trim() + "\n";
    html = html.replace(autosavePattern(), "\n").replace(legacyAutosavePattern(), "\n");
    html = insertBeforeBody(html, autosaveSnippet);
    if (result === "already-enabled") result = "autosave-enabled";
  }

  if (html !== original) fs.writeFileSync(htmlPath, html, "utf8");
  return { result, htmlPath, runtimePath, serverPath };
}

function disableEditor(htmlPath) {
  const html = fs.readFileSync(htmlPath, "utf8");
  const next = html.replace(runtimePattern(), "\n").replace(autosavePattern(), "\n").replace(legacyAutosavePattern(), "\n");
  if (next !== html) {
    fs.writeFileSync(htmlPath, next, "utf8");
    return "disabled";
  }
  return "already-disabled";
}

function statusEditor(htmlPath) {
  const html = fs.readFileSync(htmlPath, "utf8");
  return {
    htmlPath,
    enabled: runtimePattern().test(html),
    autosave: autosavePattern().test(html)
  };
}

function send(res, status, headers, body) {
  res.writeHead(status, headers);
  res.end(body);
}

function serveHtml(htmlPath, port) {
  const root = path.dirname(htmlPath);
  const indexName = path.basename(htmlPath);

  const server = http.createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      send(res, 204, {}, "");
      return;
    }

    if (req.method === "POST" && req.url === "/save") {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
      });
      req.on("end", () => {
        try {
          const payload = JSON.parse(body);
          if (!payload || typeof payload.html !== "string") throw new Error("Missing html payload");
          fs.writeFileSync(htmlPath, payload.html, "utf8");
          send(res, 200, { "Content-Type": "application/json" }, JSON.stringify({ ok: true }));
          console.log(`[html-slides] saved ${htmlPath}`);
        } catch (error) {
          send(res, 500, { "Content-Type": "application/json" }, JSON.stringify({ ok: false, error: String(error) }));
        }
      });
      return;
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      send(res, 405, { "Content-Type": "text/plain; charset=utf-8" }, "Method not allowed");
      return;
    }

    const urlPath = (req.url || "/").split("?")[0];
    const decoded = decodeURIComponent(urlPath === "/" ? indexName : urlPath.replace(/^\/+/, ""));
    const target = path.normalize(path.join(root, decoded));
    const relative = path.relative(root, target);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      send(res, 403, { "Content-Type": "text/plain; charset=utf-8" }, "Forbidden");
      return;
    }

    fs.readFile(target, (error, data) => {
      if (error) {
        send(res, 404, { "Content-Type": "text/plain; charset=utf-8" }, "Not found");
        return;
      }
      send(res, 200, { "Content-Type": MIME[path.extname(target).toLowerCase()] || "application/octet-stream" }, data);
    });
  });

  server.on("error", (error) => {
    console.error(`html-slides-editor: failed to serve on 127.0.0.1:${port}: ${error.message}`);
    process.exit(1);
  });

  server.listen(port, "127.0.0.1", () => {
    console.log(`[html-slides] serving ${htmlPath}`);
    console.log(`[html-slides] preview http://127.0.0.1:${port}/`);
  });
}

function main() {
  const { command, options } = parseArgs(process.argv);
  if (!command || options.help || command === "help" || command === "--help" || command === "-h") {
    usage();
    return;
  }

  const htmlPath = resolveHtml(options.html);
  if (command === "enable" || command === "on") {
    const result = enableEditor(htmlPath, options);
    console.log(`${result.result}: ${result.htmlPath}`);
    console.log(`runtime: ${result.runtimePath}`);
    if (result.serverPath) console.log(`save server: ${result.serverPath}`);
    if (options.serve) serveHtml(htmlPath, options.port);
    return;
  }

  if (command === "disable" || command === "off") {
    console.log(`${disableEditor(htmlPath)}: ${htmlPath}`);
    return;
  }

  if (command === "serve") {
    serveHtml(htmlPath, options.port);
    return;
  }

  if (command === "status") {
    console.log(JSON.stringify(statusEditor(htmlPath), null, 2));
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

try {
  main();
} catch (error) {
  console.error(`html-slides-editor: ${error.message}`);
  process.exit(1);
}
