#!/usr/bin/env bun
// skills/b-memory-import/scripts/import-context-memory.ts
//
// Deterministic import of published project memory/backlog revisions into OMP's
// Hindsight bank. The configured store owns source bytes and checkout-local
// cursors; local Markdown and manifest files are non-authoritative exports.
//
// Usage (from any project checkout, including one without `.context` exports):
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
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve, sep } from "node:path";
import { commitConsumerBatch, readConsumer } from "../../_shared/storage/consumers.js";
import type { ConsumerScope } from "../../_shared/storage/consumers.js";
import { resolveConsumerContext, withBoundStore } from "../../_shared/scripts/workflow-state.js";
import type { TrustedWorkflowContext } from "../../_shared/scripts/workflow-state.js";
import type { ArtifactRevision, StorageStore } from "../../_shared/storage/contract.js";
import { createRunId } from "../../_shared/storage/identity.js";
import {
  extractTitle,
  parseSimpleYaml,
  splitFrontmatter,
  unquote,
} from "../../_shared/scripts/context-helpers.js";

export { splitFrontmatter, parseSimpleYaml, extractTitle };

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
  /** Absolute export path, resolved at parse time; need not exist. */
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
        sourceDirsRaw.push(...parts.flatMap((s) => s.split(",").map((p) => p.trim()).filter(Boolean)));
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

function toPosix(p: string): string {
  return p.split(sep).join("/");
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
/** Parse only exact, publication-proven adapter revisions in the selected dirs. */
export function listMemoryMarkdown(
  sourceDirs: SourceDir[],
  root: string,
  revisions: readonly ArtifactRevision[],
  publishedRevisionIds: readonly string[],
  parseWarnings?: string[],
): MemoryFile[] {
  const published = new Set(publishedRevisionIds);
  const files: MemoryFile[] = [];
  for (const revision of revisions) {
    if (!published.has(revision.revision)) continue;
    const key = revision.key;
    if (key.subjectId !== key.kind || (key.kind !== "memory" && key.kind !== "backlog")) continue;
    const rel = `.context/${key.kind}/${key.logicalName}`;
    const sd = sourceDirs.find((dir) => rel.startsWith(`${dir.rel}/`));
    if (!sd || shouldSkipFileName(basename(rel))) continue;
    if (rel.split("/").some((part) => part === ".git" || part === "node_modules")) continue;
    const file = parseImportRevision(revision, sd, rel, root, parseWarnings);
    if (file) files.push(file);
  }
  return files.sort((a, b) => a.relPath.localeCompare(b.relPath));
}

function parseImportRevision(revision: ArtifactRevision, sourceDir: SourceDir, rel: string, root: string, warnings?: string[]): MemoryFile | null {
  const text = new TextDecoder("utf-8", { fatal: true }).decode(revision.bytes);
  const { frontmatter, body } = parseFrontmatter(text);
  if (Object.keys(frontmatter.raw).length === 0) {
    warnings?.push(sourceDir.kind === "memory" ? `skip: no frontmatter in ${rel}` : `skip: backlog item ${rel} has no frontmatter`);
    return null;
  }
  if (sourceDir.kind === "backlog" && (typeof frontmatter.raw.title !== "string" || typeof frontmatter.raw.status !== "string")) {
    warnings?.push(`skip: backlog item ${rel} missing required title/status`);
    return null;
  }
  return {
    absPath: join(root, rel), relPath: rel, sha256: revision.sha256,
    bytes: revision.bytes.byteLength, mtimeMs: Date.parse(revision.createdAt),
    frontmatter, body, title: extractTitle(body, basename(rel, ".md")),
    kind: sourceDir.kind, sourceDir: sourceDir.rel,
  };
}

function importerScope(context: TrustedWorkflowContext): ConsumerScope {
  if (!context.worktreeId || !context.runId) throw new Error("Importer requires a trusted checkout/run identity");
  return { ...context, worktreeId: context.worktreeId, runId: context.runId };
}

async function loadManifest(store: StorageStore, context: TrustedWorkflowContext): Promise<{ manifest: Manifest | null; revision: string | null }> {
  const retained = await readConsumer(store, importerScope(context), "audit", "memory-import", "manifest.json");
  if (!retained) return { manifest: null, revision: null };
  const manifest = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(retained.bytes)) as Manifest;
  if (manifest?.version !== 1 || !manifest.files || typeof manifest.files !== "object" || Array.isArray(manifest.files)) {
    throw new Error("Invalid retained importer manifest");
  }
  return { manifest, revision: retained.revision };
}

export async function saveManifest(
  path: string,
  manifest: Manifest,
  cwd: string,
  binding?: { context: TrustedWorkflowContext; expectedRevision: string | null },
): Promise<string> {
  const context = binding?.context ?? await resolveConsumerContext(cwd);
  const body = `${JSON.stringify(manifest, null, 2)}\n`;
  await withBoundStore(cwd, context, async (store) => {
    const receiptRun = createRunId();
    await commitConsumerBatch(store, importerScope(context), [{
      kind: "audit", subjectId: "memory-import", logicalName: "manifest.json",
      bytes: new TextEncoder().encode(body), expectedRevision: binding?.expectedRevision,
    }], { attemptId: receiptRun, runId: receiptRun, status: "attempted" });
  });
  // Export only after durable retention. It is never read to authorize a skip.
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, body, "utf-8");
  return context.runId!;
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
  const manifestPath = join(args.sourceDirs[0].abs, MANIFEST_NAME);
  const parseWarnings: string[] = [];
  // Capture checkout, workspace run, and destination before any external work.
  const context = await resolveConsumerContext(args.root);
  const { manifest: existing, revision: cursorRevision, files } = await withBoundStore(args.root, context, async (store) => {
    const cursor = await loadManifest(store, context);
    const publishedRevisionIds = context.publishedRevisionIds;
    const revisions = publishedRevisionIds.length === 0 ? [] : await store.list({
      projectId: context.projectId, branchId: context.branchId, publishedRevisionIds,
    });
    return { ...cursor, files: listMemoryMarkdown(args.sourceDirs, args.root, revisions, publishedRevisionIds, parseWarnings) };
  });
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
  await saveManifest(manifestPath, manifest, args.root, { context, expectedRevision: cursorRevision });

  if (baseResult.failed > 0) baseResult.code = 2;
  return baseResult;
}

function usage(): string {
  return `import-context-memory.ts — push published adapter memory/backlog revisions into Hindsight

Usage:
  bun import-context-memory.ts [flags]

Flags:
  --root <dir>          Project root (default: cwd)
  --source-dirs <list>  Select logical source paths under .context/ (exports
                        need not exist). Relative or absolute; repeatable.
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
