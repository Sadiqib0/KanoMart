/**
 * Local preview server — serves the built frontend (frontend/) and the API
 * (in-memory store) from one port, mirroring the Vercel rewrite layout:
 *   /api/*  → backend handler
 *   /*      → static files with SPA fallback to index.html
 *
 * Dev/preview only. Run `npm run build` first so frontend/dist exists.
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname, normalize, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createApp, createMemoryStore } from "../backend/server.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "frontend");
const port = Number(process.env.PORT ?? 4173);

const app = createApp({ store: createMemoryStore(), allowedOrigin: "*" });

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
};

const server = createServer(async (request, response) => {
  if (request.url?.startsWith("/api")) {
    request.url = request.url.slice(4) || "/";
    return app.handle(request, response);
  }
  const pathname = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
  const safePath = normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  let filePath = join(root, safePath);
  try {
    let body = await readFile(filePath);
    response.writeHead(200, { "content-type": MIME[extname(filePath)] ?? "application/octet-stream" });
    response.end(body);
  } catch {
    const html = await readFile(join(root, "index.html"));
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(html);
  }
});

server.listen(port, () => console.log(`Preview running at http://localhost:${port}`));
