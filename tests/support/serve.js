// Minimal static server for the tests: serves a build folder (default _site) under /ced/ (the site's pathPrefix), like GitHub Pages.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const port = Number(process.argv[2] || 8090);   // usage: node serve.js [port] [folder]
const root = path.resolve(process.argv[3] || "_site");
const prefix = "/ced/";
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".json": "application/json",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
  ".woff2": "font/woff2", ".ico": "image/x-icon", ".txt": "text/plain", ".yml": "text/yaml" };

http.createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (url === "/" || !url.startsWith(prefix)) { res.writeHead(404).end("Not found"); return; }
  let file = path.join(root, url.slice(prefix.length));
  const rel = path.relative(root, file);
  if (rel.startsWith("..") || path.isAbsolute(rel)) { res.writeHead(403).end(); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
  fs.readFile(file, (err, body) => {
    if (err) { res.writeHead(404).end("Not found"); return; }
    res.writeHead(200, { "content-type": types[path.extname(file)] || "application/octet-stream" }).end(body);
  });
}).listen(port, "localhost", () => console.log(`Serving ${path.basename(root)} at http://localhost:${port}${prefix}`));
