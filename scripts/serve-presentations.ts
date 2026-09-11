#!/usr/bin/env bun
/**
 * Static preview server for `presentations/`.
 *
 * Binds 0.0.0.0 by default so a package rendered on an SSH host is reachable from
 * the machine you are sitting at (LAN or tailnet). Pass `--host 127.0.0.1` to keep
 * it loopback-only and reach it through `ssh -L`.
 *
 *   bun scripts/serve-presentations.ts
 *   bun scripts/serve-presentations.ts --port 8080 --host 127.0.0.1
 *   bun scripts/serve-presentations.ts --dir presentations
 *
 * Request routing is exported as pure functions so it is testable without binding a port.
 */
import { existsSync, readFileSync, realpathSync, readdirSync, statSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { join, normalize, resolve, sep } from "node:path";

export const DEFAULT_PORT = 4321;
export const DEFAULT_HOST = "0.0.0.0";
export const DEFAULT_ROOT = "presentations";

/** Preferred entry files, in order. `b-present` writes index.html; `b-blueprint` writes blueprint.html. */
const ENTRY_CANDIDATES = ["index.html", "blueprint.html"];

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
};

export interface PresentationEntry {
  slug: string;
  entry: string;
  modified: number;
}

export interface CliOptions {
  root: string;
  port: number;
  host: string;
  help: boolean;
}

export interface HostEntry {
  label: string;
  host: string;
}

// ── filesystem ────────────────────────────────────────────────────────────────

function safeReaddir(dir: string): string[] {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

/** Entry HTML file for a presentation directory, or null when it holds none. */
export function firstEntryFile(dir: string): string | null {
  for (const candidate of ENTRY_CANDIDATES) {
    if (existsSync(join(dir, candidate))) return candidate;
  }
  const html = safeReaddir(dir).filter((name) => name.endsWith(".html")).sort();
  return html[0] ?? null;
}

/** Presentation directories under `root` that have an entry file, newest first. */
export function listPresentations(root: string): PresentationEntry[] {
  const rootAbs = resolve(root);
  const found: PresentationEntry[] = [];
  for (const name of safeReaddir(rootAbs)) {
    const dir = join(rootAbs, name);
    if (!isDirectory(dir)) continue;
    const entry = firstEntryFile(dir);
    if (!entry) continue;
    found.push({ slug: name, entry, modified: statSync(join(dir, entry)).mtimeMs });
  }
  return found.sort((a, b) => b.modified - a.modified);
}

// ── request handling ──────────────────────────────────────────────────────────

export function contentType(path: string): string {
  const dot = path.lastIndexOf(".");
  const ext = dot === -1 ? "" : path.slice(dot).toLowerCase();
  return MIME[ext] ?? "application/octet-stream";
}

/** Absolute on-disk path for a request path, or null when it escapes `root`. */
export function resolveRequestPath(root: string, pathname: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (decoded.includes("\0")) return null;
  const rootAbs = resolve(root);
  const relative = normalize(decoded).replace(/^[/\\]+/, "");
  const target = resolve(rootAbs, relative);
  let real = target;
  try {
    real = realpathSync(target);
  } catch {
    // Nonexistent path: lexical check already passed; fileResponse 404s later.
  }
  if (real !== rootAbs && !real.startsWith(rootAbs + sep)) return null;
  return real;
}

function textResponse(body: string, status: number): Response {
  return new Response(body, { status, headers: { "content-type": "text/plain; charset=utf-8" } });
}

function fileResponse(path: string): Response {
  if (!existsSync(path) || isDirectory(path)) return textResponse("404 not found", 404);
  return new Response(new Uint8Array(readFileSync(path)), {
    headers: { "content-type": contentType(path), "cache-control": "no-store" },
  });
}

function directoryResponse(pathname: string, dir: string): Response {
  // Redirect so relative asset URLs inside the page resolve against the directory.
  if (!pathname.endsWith("/")) {
    return new Response(null, { status: 302, headers: { location: `${pathname}/` } });
  }
  const entry = firstEntryFile(dir);
  if (!entry) return textResponse("404 no entry file in this directory", 404);
  return fileResponse(join(dir, entry));
}

export function handleRequest(url: URL, root: string): Response {
  if (url.pathname === "/") {
    return new Response(renderIndex(listPresentations(root)), {
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
    });
  }
  const target = resolveRequestPath(root, url.pathname);
  if (!target) return textResponse("403 forbidden", 403);
  if (isDirectory(target)) return directoryResponse(url.pathname, target);
  return fileResponse(target);
}

// ── index page ────────────────────────────────────────────────────────────────

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}

function renderRow(item: PresentationEntry): string {
  const when = new Date(item.modified).toISOString().slice(0, 16).replace("T", " ");
  return `<li><a href="/${encodeURIComponent(item.slug)}/">${escapeHtml(item.slug)}</a>`
    + `<span class="meta">${escapeHtml(item.entry)} · ${when}</span></li>`;
}

export function renderIndex(items: PresentationEntry[]): string {
  const body = items.length === 0
    ? '<p class="empty">No presentations yet. Run <code>/b-present</code> or <code>/b-blueprint</code>.</p>'
    : `<ul>${items.map(renderRow).join("")}</ul>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>presentations</title><style>
:root{color-scheme:dark}
body{margin:0;background:#0d1117;color:#e6edf3;font:15px/1.6 ui-sans-serif,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:820px;margin:0 auto;padding:56px 24px}
h1{font:700 26px/1.2 ui-serif,Georgia,serif;margin:0 0 4px}
.sub{color:#8b949e;font:500 12px/1 ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase;margin:0 0 28px}
ul{list-style:none;margin:0;padding:0;border:1px solid #262d36;border-radius:10px;overflow:hidden}
li{display:flex;justify-content:space-between;align-items:baseline;gap:16px;padding:13px 18px;border-bottom:1px solid #262d36}
li:last-child{border-bottom:none}
li:hover{background:#161b22}
a{color:#79c0ff;text-decoration:none;font-weight:600}
a:hover{text-decoration:underline}
.meta{color:#6e7781;font:400 12px/1 ui-monospace,monospace;white-space:nowrap}
.empty{color:#8b949e}
code{background:#1b2230;border:1px solid #262d36;border-radius:4px;padding:1px 5px;font-size:.9em}
</style></head><body><main>
<h1>presentations</h1><p class="sub">buck-workflow · ${items.length} package${items.length === 1 ? "" : "s"}</p>
${body}</main></body></html>`;
}

// ── cli ───────────────────────────────────────────────────────────────────────

/** Applies one argv token. Returns how many extra tokens it consumed. */
function applyArg(opts: CliOptions, arg: string, next: string | undefined): number {
  if (arg === "-h" || arg === "--help") return (opts.help = true), 0;
  if (arg === "-p" || arg === "--port") return (opts.port = Number(next)), 1;
  if (arg === "--host") return (opts.host = String(next)), 1;
  if (arg === "--dir") return (opts.root = String(next)), 1;
  opts.root = arg;
  return 0;
}

export function parseArgs(argv: string[], env: Record<string, string | undefined> = process.env): CliOptions {
  const opts: CliOptions = {
    root: env.PRESENTATIONS_DIR ?? DEFAULT_ROOT,
    port: Number(env.PORT ?? DEFAULT_PORT),
    host: env.HOST ?? DEFAULT_HOST,
    help: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    i += applyArg(opts, argv[i], argv[i + 1]);
  }
  return opts;
}

function ipv4Interfaces(): { name: string; address: string }[] {
  const found: { name: string; address: string }[] = [];
  for (const [name, addresses] of Object.entries(networkInterfaces())) {
    for (const addr of addresses ?? []) {
      if (addr.family === "IPv4" && !addr.internal) found.push({ name, address: addr.address });
    }
  }
  return found;
}

/** Tailscale hands out CGNAT-range addresses (100.64.0.0/10). */
export function isTailscaleAddress(address: string): boolean {
  const [a, b] = address.split(".").map(Number);
  return a === 100 && b >= 64 && b <= 127;
}

export function reachableHosts(bindHost: string): HostEntry[] {
  if (bindHost !== "0.0.0.0" && bindHost !== "::") return [{ label: "bound", host: bindHost }];
  const interfaces = ipv4Interfaces().map((i) => ({
    label: isTailscaleAddress(i.address) ? "tailscale" : "lan",
    host: i.address,
  }));
  return [{ label: "local", host: "127.0.0.1" }, ...interfaces];
}

export function helpLines(): string[] {
  return [
    "Usage:",
    "  bun scripts/serve-presentations.ts [dir] [options]",
    "",
    "Options:",
    `  -p, --port <n>   Listen port (default ${DEFAULT_PORT}, or $PORT)`,
    `      --host <h>   Bind address (default ${DEFAULT_HOST}, or $HOST)`,
    `      --dir <p>    Directory to serve (default ${DEFAULT_ROOT}, or $PRESENTATIONS_DIR)`,
    "  -h, --help       Show this message",
    "",
    "Remote viewing:",
    "  Default 0.0.0.0 makes the server reachable over LAN/tailnet.",
    `  For loopback-only, use --host 127.0.0.1 and \`ssh -L ${DEFAULT_PORT}:localhost:${DEFAULT_PORT} user@host\`.`,
  ];
}

export function bannerLines(root: string, host: string, port: number, count: number): string[] {
  const lines = [
    "",
    `buck-workflow presentations — ${count} package${count === 1 ? "" : "s"}`,
    `  root  ${root}`,
  ];
  for (const entry of reachableHosts(host)) {
    lines.push(`  ${entry.label.padEnd(10)}http://${entry.host}:${port}/`);
  }
  if (host === "0.0.0.0" || host === "::") {
    lines.push("", `  bound to ${host} — anything that can reach this host on ${port} can read ${root}`);
    lines.push(`  loopback only:  --host 127.0.0.1  +  ssh -L ${port}:localhost:${port} <user>@<host>`);
  }
  lines.push("  ctrl-c to stop", "");
  return lines;
}

export function main(argv: string[] = process.argv.slice(2)): void {
  const opts = parseArgs(argv);
  if (opts.help) return console.log(helpLines().join("\n"));

  const root = resolve(opts.root);
  if (!isDirectory(root)) {
    console.error(`serve-presentations: not a directory: ${root}`);
    process.exit(1);
  }

  try {
    const server = Bun.serve({
      port: opts.port,
      hostname: opts.host,
      fetch: (req: Request) => handleRequest(new URL(req.url), root),
    });
    console.log(bannerLines(root, opts.host, server.port, listPresentations(root).length).join("\n"));
  } catch (error) {
    console.error(`serve-presentations: cannot bind ${opts.host}:${opts.port} — ${(error as Error).message}`);
    process.exit(1);
  }
}

const isMain = import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("serve-presentations.ts");
if (isMain) main();
