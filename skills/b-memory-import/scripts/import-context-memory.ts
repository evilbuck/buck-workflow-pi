#!/usr/bin/env bun
// skills/b-memory-import/scripts/import-context-memory.ts
//
// Deterministic import of project `.context/memory/*.md` into OMP's Hindsight
// bank. No model calls. Source of truth is the filesystem (not qmd).
//
// Usage (from any project root that has `.context/memory`):
//   bun skills/b-memory-import/scripts/import-context-memory.ts --dry-run
//   bun <path-to-buck-workflow>/skills/b-memory-import/scripts/import-context-memory.ts
//
// Credentials (precedence: CLI > env > ~/.omp/agent/config.yml):
//   HINDSIGHT_API_URL / --api-url
//   HINDSIGHT_API_TOKEN / --api-token
//   HINDSIGHT_BANK_ID / --bank-id
//   HINDSIGHT_SCOPING / --scoping   (global | per-project | per-project-tagged)
//
// Exit codes:
//   0 = success (including dry-run / nothing-to-do)
//   1 = usage / config / IO failure
//   2 = one or more retain requests failed

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";

// ---------- constants ----------

const MANIFEST_NAME = ".omp-hindsight-import-manifest.json";
const DEFAULT_OMP_CONFIG = join(
  process.env.HOME ?? "",
  ".omp/agent/config.yml",
);
const DEFAULT_SCOPING = "per-project-tagged" as const;
const DEFAULT_BANK = "omp";
const BATCH_SIZE = 16;
const MAX_CONTENT_CHARS = 48_000;
const USER_AGENT = "buck-workflow-b-memory-import";
const SKIP_NAMES = new Set([
  "index.md",
  MANIFEST_NAME,
  ".gitkeep",
]);

const VALID_SCOPING = new Set([
  "global",
  "per-project",
  "per-project-tagged",
]);
/** Classify a repo-relative path to a SourceKind based on its source dir.
 *  Only paths inside one of the configured source dirs reach here; unknown
 *  relPath -> throw so misconfiguration surfaces loudly. */
export function classify(relPath: string, sourceDir: string): SourceKind {
  // normalize: strip leading "./"
  const r = relPath.replace(/^\.\//, "");
  if (r === sourceDir || r.startsWith(sourceDir + "/")) {
    if (sourceDir === ".context/memory") return "memory";
    if (sourceDir === ".context/backlog/items") return "backlog";
  }
  throw new Error(
    `classify: relPath "${relPath}" not under sourceDir "${sourceDir}"`,
  );
}

/** Per-kind framing for Hindsight's `context:` field. The framing tells the
 *  LLM extractor what kind of content this is, so facts get routed into
 *  the right mental models on recall. */
export function framingFor(kind: SourceKind): string {
  switch (kind) {
    case "memory":
      return "Third-party engineering session record from the Buck workflow `.context/memory` tree. Content is durable project knowledge (decisions, outcomes, conventions), not a first-person assistant diary. Prefer world facts about the repository and workflow.";
    case "backlog":
      return "Active engineering backlog item from the Buck workflow `.context/backlog/items` tree. Content describes a piece of scoped work: its acceptance criteria, related artifacts, and rationale. Prefer world facts about the project's planned engineering intent.";
  }
}

// ---------- types ----------

export type Scoping = "global" | "per-project" | "per-project-tagged";

export interface Frontmatter {
  date?: string;
  domains?: string[];
  topics?: string[];
  subject?: string;
  status?: string;
  priority?: string;
  related?: string[];
  artifacts?: string[];
  raw: Record<string, unknown>;
}

export type SourceKind = "memory" | "backlog";

export interface MemoryFile {
  absPath: string;
  relPath: string; // repo-root-relative, posix-ish
  sha256: string;
  bytes: number;
  mtimeMs: number;
  frontmatter: Frontmatter;
  body: string;
  title: string;
  kind: SourceKind;     // classified from relPath
  sourceDir: string;    // which --source-dir produced this file (e.g. ".context/memory")
}

export interface RetainItem {
  content: string;
  context: string;
  document_id: string;
  timestamp?: string;
  tags?: string[];
  metadata: Record<string, string>;
  update_mode: "replace";
}

export interface ManifestEntry {
  sha256: string;
  document_id: string;
  imported_at: string;
  bytes: number;
}

export interface Manifest {
  version: 1;
  bank_id: string;
  project_label: string;
  scoping: Scoping;
  files: Record<string, ManifestEntry>; // key = relPath
}

export interface BankScope {
  bankId: string;
  retainTags?: string[];
}

export interface SourceDir {
  /** Source dir relative to the project root, posix-style. e.g. ".context/memory" */
  rel: string;
  /** Absolute path on disk. Resolved at parse time. */
  abs: string;
  /** Inferred from the rel path. */
  kind: SourceKind;
}

export interface CliArgs {
  root: string;
  /** Always populated. If user passed --memory-dir (deprecated) or no flag,
   *  this is a single SourceDir for .context/memory. Otherwise one entry per
   *  --source-dirs value. */
  sourceDirs: SourceDir[];
  dryRun: boolean;
  force: boolean;
  limit: number | null;
  sync: boolean;
  apiUrl: string | null;
  apiToken: string | null;
  bankId: string | null;
  scoping: Scoping | null;
  ompConfig: string;
  /** Back-compat. When set, callers can still ask "which dir is THE memory dir?"
   *  — it's sourceDirs[0].abs. */
  memoryDir: string;
  help: boolean;
}

export interface ImportResult {
  code: 0 | 1 | 2;
  root: string;
  /** Back-compat: absolute path of the FIRST source dir. Always set. */
  memory_dir: string;
  /** Relative paths of all source dirs traversed. Newline-posix list. */
  source_dirs: string[];
  /** Files skipped during parse (no frontmatter or missing required fields). */
  parse_warnings: string[];
  bank_id: string;
  project_label: string;
  scoping: Scoping;
  dry_run: boolean;
  scanned: number;
  skipped_unchanged: number;
  planned: number;
  imported: number;
  failed: number;
  errors: string[];
  items?: Array<{
    relPath: string;
    kind: SourceKind;
    source_dir: string;
    document_id: string;
    sha256: string;
  }>;
}
/** Resolve a user-supplied source-dir string (relative or absolute) into a
 *  SourceDir, inferring kind from the canonical relative form. Throws if
 *  the dir is unrecognized. */
function resolveSourceDir(root: string, raw: string): SourceDir {
  // Normalize: strip trailing slash, leading "./"
  const trimmed = raw.replace(/\/+$/, "").replace(/^\.\//, "");
  let abs: string;
  let rel: string;
  if (trimmed.startsWith("/")) {
    abs = trimmed;
    // If absolute and lives under root, express rel. Otherwise force caller to pass relative.
    if (!abs.startsWith(root + "/") && abs !== root) {
      throw new Error(`--source-dirs: absolute path "${trimmed}" is not under project root "${root}"`);
    }
    rel = toPosix(abs.slice(root.length).replace(/^\/+/, ""));
  } else {
    abs = resolve(root, trimmed);
    rel = trimmed;
  }
  // kind inference (only the dirs we currently support)
  let kind: SourceKind;
  if (rel === ".context/memory") kind = "memory";
  else if (rel === ".context/backlog/items") kind = "backlog";
  else throw new Error(`--source-dirs: unrecognized source dir "${rel}" (supported: .context/memory, .context/backlog/items)`);
  return { rel, abs, kind };
}

export function parseArgs(argv: string[]): CliArgs {
  const out: CliArgs = {
    root: process.cwd(),
    sourceDirs: [],
    memoryDir: "",
    dryRun: false,
    force: false,
    limit: null,
    sync: false,
    apiUrl: null,
    apiToken: null,
    bankId: null,
    scoping: null,
    ompConfig: DEFAULT_OMP_CONFIG,
    help: false,
  };

  let sourceDirsRaw: string[] = [];
  let memoryDirOverride: string | null = null;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`missing value for ${a}`);
      return v;
    };
    switch (a) {
      case "-h":
      case "--help":
        out.help = true;
        break;
      case "--dry-run":
        out.dryRun = true;
        break;
      case "--force":
        out.force = true;
        break;
      case "--sync":
        out.sync = true;
        break;
      case "--root":
        out.root = resolve(next());
        break;
      case "--source-dirs": {
        // Greedy: consume all non-flag values and split on commas. Mirrors
        // the wrapper's --include/--exclude convention.
        const parts: string[] = [];
        while (i + 1 < argv.length && !argv[i + 1].startsWith("-")) {
          parts.push(argv[++i]);
        }
        if (parts.length === 0) throw new Error(`missing value for ${a}`);
        sourceDirsRaw = parts.flatMap((s) => s.split(",").map((p) => p.trim()).filter(Boolean));
        break;
      }
      case "--memory-dir":
        memoryDirOverride = resolve(next());
        break;
      case "--limit": {
        const n = Number.parseInt(next(), 10);
        if (!Number.isFinite(n) || n < 0) throw new Error("--limit must be >= 0");
        out.limit = n;
        break;
      }
      case "--api-url":
        out.apiUrl = next();
        break;
      case "--api-token":
        out.apiToken = next();
        break;
      case "--bank-id":
        out.bankId = next();
        break;
      case "--scoping": {
        const s = next();
        if (!VALID_SCOPING.has(s)) {
          throw new Error(`--scoping must be one of ${[...VALID_SCOPING].join("|")}`);
        }
        out.scoping = s as Scoping;
        break;
      }
      case "--omp-config":
        out.ompConfig = resolve(next());
        break;
      default:
        throw new Error(`unknown argument: ${a}`);
    }
  }

  // Resolve source dirs in priority order: explicit --source-dirs wins;
  // --memory-dir (deprecated) implies .context/memory; otherwise default
  // is just .context/memory.
  if (sourceDirsRaw.length > 0) {
    out.sourceDirs = sourceDirsRaw.map((s) => resolveSourceDir(out.root, s));
  } else if (memoryDirOverride !== null) {
    // Treat the override as a memory-dir; re-express as a SourceDir relative path.
    const trimmed = memoryDirOverride;
    if (trimmed.startsWith(out.root + "/")) {
      const rel = toPosix(trimmed.slice(out.root.length).replace(/^\/+/, ""));
      out.sourceDirs = [resolveSourceDir(out.root, rel)];
    } else {
      throw new Error(
        `--memory-dir "${memoryDirOverride}" is outside project root "${out.root}"; ` +
        `pass --source-dirs with a relative path instead`,
      );
    }
  } else {
    out.sourceDirs = [resolveSourceDir(out.root, ".context/memory")];
  }
  out.memoryDir = out.sourceDirs[0].abs;
  return out;
}
/** Minimal YAML frontmatter split — body after first --- pair. */
export function splitFrontmatter(text: string): { yaml: string | null; body: string } {
  if (!text.startsWith("---\n") && !text.startsWith("---\r\n")) {
    return { yaml: null, body: text };
  }
  const nl = text.startsWith("---\r\n") ? "\r\n" : "\n";
  const close = text.indexOf(`${nl}---`, 4);
  if (close === -1) return { yaml: null, body: text };
  const yaml = text.slice(4, close).replace(/^\r?\n/, "");
  let body = text.slice(close + nl.length + 3);
  if (body.startsWith("\r\n")) body = body.slice(2);
  else if (body.startsWith("\n")) body = body.slice(1);
  return { yaml, body };
}

/** Tiny YAML subset for memory frontmatter (scalars + string arrays). */
export function parseSimpleYaml(yaml: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  let currentKey: string | null = null;
  let currentList: string[] | null = null;

  const flushList = () => {
    if (currentKey && currentList) result[currentKey] = currentList;
    currentKey = null;
    currentList = null;
  };

  for (const rawLine of yaml.split(/\r?\n/)) {
    if (!rawLine.trim() || rawLine.trimStart().startsWith("#")) continue;

    const listItem = rawLine.match(/^\s+-\s+(.*)$/);
    if (listItem && currentList) {
      currentList.push(unquote(listItem[1].trim()));
      continue;
    }

    const kv = rawLine.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!kv) continue;

    flushList();
    const key = kv[1];
    const rest = kv[2].trim();
    if (rest === "" || rest === "|" || rest === ">") {
      currentKey = key;
      currentList = [];
      continue;
    }
    if (rest.startsWith("[") && rest.endsWith("]")) {
      const inner = rest.slice(1, -1).trim();
      result[key] = inner
        ? inner.split(",").map((s) => unquote(s.trim())).filter(Boolean)
        : [];
      continue;
    }
    result[key] = coerceScalar(unquote(rest));
  }
  flushList();
  return result;
}

function unquote(s: string): string {
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    return s.slice(1, -1);
  }
  return s;
}

function coerceScalar(s: string): string | number | boolean | null {
  if (s === "null" || s === "~") return null;
  if (s === "true") return true;
  if (s === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  return s;
}

function toPosix(p: string): string {
  return p.split(sep).join("/");
}

export function parseFrontmatter(text: string): { frontmatter: Frontmatter; body: string } {
  const { yaml, body } = splitFrontmatter(text);
  if (!yaml) {
    return { frontmatter: { raw: {} }, body: text };
  }
  const raw = parseSimpleYaml(yaml);
  const asStringList = (v: unknown): string[] | undefined => {
    if (Array.isArray(v)) return v.map(String);
    if (typeof v === "string" && v) return [v];
    return undefined;
  };
  return {
    frontmatter: {
      date: typeof raw.date === "string" ? raw.date : undefined,
      domains: asStringList(raw.domains),
      topics: asStringList(raw.topics),
      subject: typeof raw.subject === "string" ? raw.subject : undefined,
      status: typeof raw.status === "string" ? raw.status : undefined,
      priority: typeof raw.priority === "string" ? raw.priority : undefined,
      related: asStringList(raw.related),
      artifacts: asStringList(raw.artifacts),
      raw,
    },
    body,
  };
}

export function extractTitle(body: string, fallback: string): string {
  for (const line of body.split(/\r?\n/)) {
    const m = line.match(/^#\s+(.+)$/);
    if (m) return m[1].trim();
  }
  return fallback;
}

export function sha256Hex(content: string | Uint8Array): string {
  return createHash("sha256").update(content).digest("hex");
}

/** Stable document id for path — upsert on re-import of same file. */
export function documentIdFor(relPath: string): string {
  const norm = relPath.replace(/\\/g, "/").replace(/^\/+/, "");
  const digest = sha256Hex(norm).slice(0, 20);
  const base = basename(norm).replace(/\.md$/i, "").slice(0, 40);
  const safe = base.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "memory";
  return `buck-ctx-mem:${safe}:${digest}`;
}

export function projectLabelFromRoot(root: string): string {
  let labelRoot = root;
  try {
    const out = execFileSync("git", ["-C", root, "rev-parse", "--show-toplevel"], {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    if (out) labelRoot = out;
  } catch {
    // not a git repo
  }
  return basename(labelRoot) || "unknown";
}

export function computeBankScope(
  bankIdBase: string,
  scoping: Scoping,
  projectLabel: string,
): BankScope {
  const base = bankIdBase.trim() || DEFAULT_BANK;
  switch (scoping) {
    case "global":
      return { bankId: base };
    case "per-project":
      return { bankId: `${base}-${projectLabel}` };
    case "per-project-tagged":
      return { bankId: base, retainTags: [`project:${projectLabel}`] };
  }
}

export function buildRetainContent(file: MemoryFile): string {
  const fm = file.frontmatter;
  const header: string[] = [
    `Buck workflow session memory`,
    `path: ${file.relPath}`,
  ];
  if (fm.date) header.push(`date: ${fm.date}`);
  if (fm.subject) header.push(`subject: ${fm.subject}`);
  if (fm.status) header.push(`status: ${fm.status}`);
  if (fm.priority) header.push(`priority: ${fm.priority}`);
  if (fm.domains?.length) header.push(`domains: ${fm.domains.join(", ")}`);
  if (fm.topics?.length) header.push(`topics: ${fm.topics.join(", ")}`);
  if (fm.artifacts?.length) header.push(`artifacts: ${fm.artifacts.join(", ")}`);
  header.push(`title: ${file.title}`);
  header.push("");
  header.push(file.body.trim());

  let content = header.join("\n").trim() + "\n";
  if (content.length > MAX_CONTENT_CHARS) {
    content =
      content.slice(0, MAX_CONTENT_CHARS) +
      "\n\n[truncated by b-memory-import]\n";
  }
  return content;
}

export function buildRetainItem(file: MemoryFile, retainTags?: string[]): RetainItem {
  const content = buildRetainContent(file);
  const meta: Record<string, string> = {
    source: "buck-context-memory",
    path: file.relPath,
    sha256: file.sha256,
    importer: "b-memory-import",
  };
  if (file.frontmatter.subject) meta.subject = file.frontmatter.subject;
  if (file.frontmatter.status) meta.status = file.frontmatter.status;
  const item: RetainItem = {
    content,
    context: framingFor(file.kind),
    document_id: documentIdFor(file.relPath),
    metadata: meta,
    update_mode: "replace",
  };

  // per-kind timestamp strategy: memory files use the file's calendar date
  // (noon UTC keeps the day stable across offsets). backlog items have a
  // `created:` or `updated:` field; prefer updated if present.
  if (file.kind === "memory" && file.frontmatter.date && /^\d{4}-\d{2}-\d{2}/.test(file.frontmatter.date)) {
    item.timestamp = `${file.frontmatter.date.slice(0, 10)}T12:00:00Z`;
  } else if (file.kind === "backlog") {
    const raw = file.frontmatter.raw;
    const stamp =
      typeof raw.updated === "string" ? raw.updated :
      typeof raw.created === "string" ? raw.created :
      null;
    if (stamp && /^\d{4}-\d{2}-\d{2}/.test(stamp)) {
      item.timestamp = `${stamp.slice(0, 10)}T12:00:00Z`;
    }
  }
  if (retainTags?.length) item.tags = [...retainTags];
  return item;
}

export function shouldSkipFileName(name: string): boolean {
  if (!name.endsWith(".md")) return true;
  if (SKIP_NAMES.has(name)) return true;
  if (name.startsWith(".")) return true;
  return false;
}
/** Walk one source dir recursively and yield parsed files.
 *  `sourceDir.kind` discriminates how the file is framed downstream.
 *  Files without required frontmatter for their kind are skipped with
 *  a reason recorded in `parseWarnings`. */
export function listMemoryMarkdown(
  sourceDirs: SourceDir[],
  root: string,
  parseWarnings?: string[],
): MemoryFile[] {
  const files: MemoryFile[] = [];
  for (const sd of sourceDirs) {
    if (!existsSync(sd.abs)) continue;
    const walk = (dir: string) => {
      let entries;
      try {
        entries = readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const ent of entries) {
        const abs = join(dir, ent.name);
        if (ent.isDirectory()) {
          if (ent.name === ".git" || ent.name === "node_modules") continue;
          walk(abs);
          continue;
        }
        if (!ent.isFile() || shouldSkipFileName(ent.name)) continue;
        const text = readFileSync(abs, "utf-8");
        const { frontmatter, body } = parseFrontmatter(text);
        const rel = toPosix(relative(root, abs));
        const st = statSync(abs);

        const hasFrontmatter = Object.keys(frontmatter.raw).length > 0;
        if (sd.kind === "memory" && !hasFrontmatter) {
          parseWarnings?.push(`skip: no frontmatter in ${rel}`);
          continue;
        }
        if (sd.kind === "backlog") {
          if (!hasFrontmatter) {
            parseWarnings?.push(`skip: backlog item ${rel} has no frontmatter`);
            continue;
          }
          const r = frontmatter.raw;
          if (typeof r.title !== "string" || typeof r.status !== "string") {
            parseWarnings?.push(`skip: backlog item ${rel} missing required title/status`);
            continue;
          }
        }

        files.push({
          absPath: abs,
          relPath: rel,
          sha256: sha256Hex(text),
          bytes: st.size,
          mtimeMs: st.mtimeMs,
          frontmatter,
          body,
          title: extractTitle(body, basename(abs, ".md")),
          kind: sd.kind,
          sourceDir: sd.rel,
        });
      }
    };
    walk(sd.abs);
  }
  files.sort((a, b) => a.relPath.localeCompare(b.relPath));
  return files;
}

export function loadManifest(path: string): Manifest | null {
  if (!existsSync(path)) return null;
  try {
    const data = JSON.parse(readFileSync(path, "utf-8")) as Manifest;
    if (data?.version !== 1 || typeof data.files !== "object") return null;
    return data;
  } catch {
    return null;
  }
}

export function saveManifest(path: string, manifest: Manifest): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(manifest, null, 2) + "\n", "utf-8");
}

// ---------- config ----------

interface ResolvedConfig {
  apiUrl: string;
  apiToken: string | null;
  bankIdBase: string;
  scoping: Scoping;
}

export interface OmpHindsightFileConfig {
  apiUrl?: string;
  apiToken?: string;
  bankId?: string;
  scoping?: string;
}

export function parseOmpHindsightBlock(yamlText: string): OmpHindsightFileConfig {
  // Prefer structured parse when Bun.YAML exists at runtime; else line scrape.
  const bunGlobal = globalThis as { Bun?: { YAML?: { parse(s: string): unknown } } };
  try {
    const doc = bunGlobal.Bun?.YAML?.parse(yamlText);
    if (doc && typeof doc === "object" && !Array.isArray(doc)) {
      const record = doc as Record<string, unknown>;
      const h =
        record.hindsight && typeof record.hindsight === "object" && !Array.isArray(record.hindsight)
          ? (record.hindsight as Record<string, unknown>)
          : {};
      return {
        apiUrl: typeof h.apiUrl === "string" ? h.apiUrl : undefined,
        apiToken: typeof h.apiToken === "string" ? h.apiToken : undefined,
        bankId: typeof h.bankId === "string" ? h.bankId : undefined,
        scoping: typeof h.scoping === "string" ? h.scoping : undefined,
      };
    }
  } catch {
    // fall through to line scrape
  }

  const out: OmpHindsightFileConfig = {};
  let inBlock = false;
  for (const line of yamlText.split(/\r?\n/)) {
    if (/^hindsight:\s*$/.test(line)) {
      inBlock = true;
      continue;
    }
    if (inBlock) {
      if (/^\S/.test(line) && !line.startsWith(" ")) {
        inBlock = false;
        continue;
      }
      const m = line.match(/^\s+(apiUrl|apiToken|bankId|scoping):\s*(.+)$/);
      if (m) {
        const key = m[1] as keyof OmpHindsightFileConfig;
        out[key] = unquote(m[2].trim());
      }
    }
  }
  return out;
}

export function resolveConfig(args: CliArgs, env: NodeJS.ProcessEnv = process.env): ResolvedConfig {
  let file: OmpHindsightFileConfig = {};
  if (args.ompConfig && existsSync(args.ompConfig)) {
    file = parseOmpHindsightBlock(readFileSync(args.ompConfig, "utf-8"));
  }

  const apiUrl =
    args.apiUrl ||
    env.HINDSIGHT_API_URL ||
    file.apiUrl ||
    "http://localhost:8888";
  const apiToken =
    args.apiToken || env.HINDSIGHT_API_TOKEN || file.apiToken || null;
  const bankIdBase =
    args.bankId || env.HINDSIGHT_BANK_ID || file.bankId || DEFAULT_BANK;

  const scopingRaw =
    args.scoping ||
    env.HINDSIGHT_SCOPING ||
    file.scoping ||
    DEFAULT_SCOPING;
  if (!VALID_SCOPING.has(scopingRaw)) {
    throw new Error(`invalid scoping: ${scopingRaw}`);
  }

  return {
    apiUrl: apiUrl.replace(/\/+$/, ""),
    apiToken,
    bankIdBase,
    scoping: scopingRaw as Scoping,
  };
}

// ---------- HTTP ----------

async function retainBatch(
  apiUrl: string,
  apiToken: string | null,
  bankId: string,
  items: RetainItem[],
  asyncMode: boolean,
): Promise<void> {
  const url = `${apiUrl}/v1/default/banks/${encodeURIComponent(bankId)}/memories`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": USER_AGENT,
  };
  if (apiToken) headers.Authorization = `Bearer ${apiToken}`;

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ items, async: asyncMode }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `retain ${res.status} ${res.statusText}: ${text.slice(0, 400)}`,
    );
  }
}

async function ensureBank(
  apiUrl: string,
  apiToken: string | null,
  bankId: string,
): Promise<void> {
  const url = `${apiUrl}/v1/default/banks/${encodeURIComponent(bankId)}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": USER_AGENT,
  };
  if (apiToken) headers.Authorization = `Bearer ${apiToken}`;

  const res = await fetch(url, {
    method: "PUT",
    headers,
    body: JSON.stringify({}),
  });
  // 200/201 ok; some servers 409 if exists — treat 2xx/409 as fine
  if (!res.ok && res.status !== 409) {
    const text = await res.text().catch(() => "");
    throw new Error(`createBank ${res.status}: ${text.slice(0, 300)}`);
  }
}

// ---------- main pipeline ----------

export function planImport(
  files: MemoryFile[],
  manifest: Manifest | null,
  force: boolean,
  limit: number | null,
  retainTags?: string[],
): { toImport: MemoryFile[]; items: RetainItem[]; skipped: number } {
  const toImport: MemoryFile[] = [];
  let skipped = 0;
  for (const f of files) {
    const prev = manifest?.files[f.relPath];
    if (!force && prev && prev.sha256 === f.sha256) {
      skipped++;
      continue;
    }
    toImport.push(f);
  }
  const limited =
    limit !== null ? toImport.slice(0, limit) : toImport;
  return {
    toImport: limited,
    items: limited.map((f) => buildRetainItem(f, retainTags)),
    skipped,
  };
}

export async function runImport(args: CliArgs): Promise<ImportResult> {
  const cfg = resolveConfig(args);
  const projectLabel = projectLabelFromRoot(args.root);
  const scope = computeBankScope(cfg.bankIdBase, cfg.scoping, projectLabel);
  // Manifest lives in the first (canonical) source dir; back-compat single-dir
  // users continue to find it where they expect: <root>/.context/memory/.
  const manifestPath = join(args.sourceDirs[0].abs, MANIFEST_NAME);
  const existing = loadManifest(manifestPath);

  const parseWarnings: string[] = [];
  const files = listMemoryMarkdown(args.sourceDirs, args.root, parseWarnings);
  const { toImport, items, skipped } = planImport(
    files,
    existing,
    args.force,
    args.limit,
    scope.retainTags,
  );

  const baseResult: ImportResult = {
    code: 0,
    root: args.root,
    memory_dir: args.memoryDir,
    source_dirs: args.sourceDirs.map((sd) => sd.rel),
    parse_warnings: parseWarnings,
    bank_id: scope.bankId,
    project_label: projectLabel,
    scoping: cfg.scoping,
    dry_run: args.dryRun,
    scanned: files.length,
    skipped_unchanged: skipped,
    planned: items.length,
    imported: 0,
    failed: 0,
    errors: [],
    items: toImport.map((f) => ({
      relPath: f.relPath,
      kind: f.kind,
      source_dir: f.sourceDir,
      document_id: documentIdFor(f.relPath),
      sha256: f.sha256,
    })),
  };

  if (args.dryRun || items.length === 0) {
    return baseResult;
  }

  try {
    await ensureBank(cfg.apiUrl, cfg.apiToken, scope.bankId);
  } catch (e) {
    baseResult.code = 2;
    baseResult.errors.push(e instanceof Error ? e.message : String(e));
    return baseResult;
  }

  const now = new Date().toISOString();
  const nextFiles: Record<string, ManifestEntry> = {
    ...(existing?.files ?? {}),
  };

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    const batchFiles = toImport.slice(i, i + BATCH_SIZE);
    try {
      await retainBatch(
        cfg.apiUrl,
        cfg.apiToken,
        scope.bankId,
        batch,
        !args.sync,
      );
      baseResult.imported += batch.length;
      for (let j = 0; j < batchFiles.length; j++) {
        const f = batchFiles[j];
        nextFiles[f.relPath] = {
          sha256: f.sha256,
          document_id: batch[j].document_id,
          imported_at: now,
          bytes: f.bytes,
        };
      }
    } catch (e) {
      baseResult.failed += batch.length;
      baseResult.errors.push(e instanceof Error ? e.message : String(e));
    }
  }

  const manifest: Manifest = {
    version: 1,
    bank_id: scope.bankId,
    project_label: projectLabel,
    scoping: cfg.scoping,
    files: nextFiles,
  };
  saveManifest(manifestPath, manifest);

  if (baseResult.failed > 0) baseResult.code = 2;
  return baseResult;
}

function usage(): string {
  return `import-context-memory.ts — push .context/{memory,backlog/items}/*.md into Hindsight

Usage:
  bun import-context-memory.ts [flags]

Flags:
  --root <dir>          Project root (default: cwd)
  --source-dirs <list>  Comma-separated source dirs under .context/, relative
                        or absolute. Repeatable (greedy). Supported values:
                        .context/memory (kind=memory, default),
                        .context/backlog/items (kind=backlog).
                        Examples:
                          --source-dirs .context/memory
                          --source-dirs .context/memory,.context/backlog/items
  --memory-dir <dir>    Deprecated. Use --source-dirs instead. Overrides only
                        the .context/memory entry; provided for compatibility
                        with the older single-dir invocation.
  --dry-run             Plan only; no HTTP; no manifest write
  --force               Re-import even when sha matches manifest
  --limit <n>           Import at most n files (after skip filter)
  --sync                Retain with async=false (wait for extraction)
  --api-url <url>       Hindsight base URL
  --api-token <token>   Bearer token
  --bank-id <id>        Bank base id (OMP default bankId)
  --scoping <mode>      global | per-project | per-project-tagged
  --omp-config <path>   OMP config.yml (default: ~/.omp/agent/config.yml)
  -h, --help            Show this help

Credentials: CLI > env (HINDSIGHT_*) > omp config hindsight.*
`;
}

// ---------- entry ----------

async function main(): Promise<void> {
  let args: CliArgs;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    console.error(usage());
    process.exit(1);
  }

  if (args.help) {
    console.log(usage());
    process.exit(0);
  }

  // Helpful early-fail when no source dir exists on disk.
  // First source dir must exist (others are optional). Old single-dir UX
  // preserves the helpful "memory dir not found" message.
  const first = args.sourceDirs[0];
  try {
    if (!statSync(first.abs).isDirectory()) throw new Error("not a directory");
  } catch {
    console.log(
      JSON.stringify(
        {
          error: `source dir not found: ${first.abs}`,
          hint: "pass --root, or run from a project with .context/memory",
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }

  try {
    const result = await runImport(args);
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.code);
  } catch (e) {
    console.log(
      JSON.stringify(
        { error: e instanceof Error ? e.message : String(e) },
        null,
        2,
      ),
    );
    process.exit(1);
  }
}

if (import.meta.main) {
  await main();
}
