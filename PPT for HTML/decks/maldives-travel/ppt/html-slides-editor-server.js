#!/usr/bin/env node
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const PORT = Number(process.env.PORT || process.argv[2] || 8765);
const INDEX = path.join(ROOT, "index.html");

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

function send(res, status, headers, body) {
  res.writeHead(status, headers);
  res.end(body);
}

function resolvePath(url) {
  var pathname = url.split("?")[0];
  var decoded = decodeURIComponent(pathname === "/" ? "index.html" : pathname.replace(/^\/+/, ""));
  var target = path.normalize(path.join(ROOT, decoded));
  var relative = path.relative(ROOT, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
  return target;
}

function handleSave(req, res) {
  var body = "";
  req.on("data", function (chunk) {
    body += chunk;
  });
  req.on("end", function () {
    try {
      var payload = JSON.parse(body);
      if (!payload || typeof payload.html !== "string") {
        throw new Error("Missing html payload");
      }
      fs.writeFileSync(INDEX, payload.html, "utf8");
      send(res, 200, { "Content-Type": "application/json" }, JSON.stringify({ ok: true }));
      console.log("[html-slides] saved index.html");
    } catch (error) {
      send(res, 500, { "Content-Type": "application/json" }, JSON.stringify({ ok: false, error: String(error) }));
    }
  });
}

function handleStatic(req, res) {
  var filePath = resolvePath(req.url || "/");
  if (!filePath) {
    send(res, 403, { "Content-Type": "text/plain; charset=utf-8" }, "Forbidden");
    return;
  }
  fs.readFile(filePath, function (error, data) {
    if (error) {
      send(res, 404, { "Content-Type": "text/plain; charset=utf-8" }, "Not found");
      return;
    }
    var ext = path.extname(filePath).toLowerCase();
    send(res, 200, { "Content-Type": MIME[ext] || "application/octet-stream" }, data);
  });
}

http.createServer(function (req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    send(res, 204, {}, "");
    return;
  }

  if (req.method === "POST" && req.url === "/save") {
    handleSave(req, res);
    return;
  }

  if (req.method === "GET" || req.method === "HEAD") {
    handleStatic(req, res);
    return;
  }

  send(res, 405, { "Content-Type": "text/plain; charset=utf-8" }, "Method not allowed");
}).listen(PORT, "127.0.0.1", function () {
  console.log("[html-slides] serving " + INDEX + " at http://127.0.0.1:" + PORT);
});
