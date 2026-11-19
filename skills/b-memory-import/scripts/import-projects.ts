#!/usr/bin/env bun
// skills/b-memory-import/scripts/import-projects.ts
//
// Bulk-import Buck `.context/memory/**/*.md` from many projects into OMP
// Hindsight, by calling import-context-memory.ts per project. Idempotent
// (manifest-based skip) and resumable (one project failure does not stop
// the rest).
//
// Run from any directory:
//
//   bun skills/b-memory-import/scripts/import-projects.ts \
//     --root ~/projects --include partypix qrpro --dry-run
//
//   bun skills/b-memory-import/scripts/import-projects.ts \
//     --root ~/projects --include partypix qrpro --sync --limit 5
//
// Stdout is a single JSON envelope (per-project results + a totals row),
// so callers can pipe to `jq` or feed a follow-up step.

import { spawn } from "bun";
import {
  existsSync,
  readdirSync,
  statSync,
} from "node:fs";
import { basename, join, resolve } from "node:path";

// ---------- constants ----------

const SKILL_DIR = resolve(import.meta.dir, "..");
const INNER = join(SKILL_DIR, "scripts", "import-context-memory.ts");
const DEFAULT_CONCURRENCY = 1; // Hindsight batch is 16; one project at a time avoids rate limits
const VALID_MODES = new Set(["include", "exclude", "all"]);

// ---------- types ----------

interface Project {
  root: string;          // absolute path to project dir
  label: string;         // basename
  hasMemoryDir: boolean; // sanity
  memoryDir: string;     // absolute path to .context/memory
}

interface ProjectResult {
  root: string;
  label: string;
  status: "ok" | "dry-run" | "error";
  scanned?: number;
  planned?: number;
  imported?: number;
  failed?: number;
  skipped_unchanged?: number;
  bank_id?: string;
  duration_ms: number;
  error?: string;
  raw?: unknown;
}

interface CliArgs {
  roots: string[];
  mode: "include" | "exclude" | "all";
  projects: string[];
  dryRun: boolean;
  sync: boolean;
  force: boolean;
  limit: number | null;
  concurrency: number;
  sourceDirs: string[];   // --source-dirs forwarded to inner script; empty = default
  apiUrl: string | null;
  apiToken: string | null;
  bankId: string | null;
  scoping: string | null;
  ompConfig: string | null;
  childArgs: string[];
  help: boolean;
}

interface Summary {
  inner_script: string;
  inner_script_exists: boolean;
  roots: string[];
  mode: "include" | "exclude" | "all";
  projects_requested: number;       // size of include/exclude list
  projects_discovered: number;      // total with .context/memory under all roots
  projects_matched: number;         // subset that passed include/exclude
  projects_skipped_no_memory: number; // had root, no .context/memory
  results: ProjectResult[];
  totals: {
    scanned: number;
    planned: number;
    imported: number;
    failed: number;
    skipped_unchanged: number;
    duration_ms: number;
  };
}

// ---------- CLI ----------

function usage(): string {
  return `import-projects.ts — bulk-import .context/memory from many projects into Hindsight

Usage:
  bun import-projects.ts [flags]

Discovery:
  --root <dir>         Project root to scan (repeatable). Default: ~/projects.
                        If <root> itself contains .context/memory, that single
                        project is used. Otherwise each immediate subdirectory
                        is a candidate (must contain <sub>/.context/memory/).
  --include <name>     Restrict to named project(s) (repeatable). Basename match.
  --exclude <name>     Skip named project(s) (repeatable). Applied after --include.
  --all                 Process every project under --root (default).

Pass-through (forwarded to import-context-memory.ts per project):
  --dry-run             Plan only; no HTTP, no manifest write.
  --sync                Retain with async=false (wait for extraction).
  --force               Re-import even when sha matches manifest.
  --limit <n>           Import at most n files per project.

Hindsight config (same precedence as the inner script):
  --api-url <url>       Hindsight base URL.
  --api-token <token>   Bearer token.
  --bank-id <id>        Bank base id (default: omp).
  --scoping <mode>      global | per-project | per-project-tagged.
  --omp-config <path>   OMP config.yml (default: ~/.omp/agent/config.yml).

Other:
  --source-dirs <list>  Source dirs under .context/ (comma-separated and
                        repeatable). Default: .context/memory.
  --concurrency <n>     Projects to run in parallel (finite integer >= 1; default: 1).
  -h, --help            Show this help.

Exit codes:
  0 = all projects ok (or nothing to do)
  1 = usage / config / discovery failure
  2 = one or more projects had retain errors`;
}

/**
 * Flags that consume every value up to the next flag. This is the shell
 * convention most users expect (`--include partypix qrpro` = two projects,
 * not one plus a stray arg).
 */
const greedyKeys = new Set(["--root", "--include", "--exclude"]);

/**
 * Apply one greedy flag: consume and record every following non-flag token.
 * Returns the index of the last consumed token so the caller can continue
 * the scan after them. Throws when no value follows the flag.
 */
function applyGreedyFlag(flag: string, argv: string[], start: number, out: CliArgs): number {
  let i = start;
  let consumed = false;
  while (i + 1 < argv.length && !argv[i + 1].startsWith("-")) {
    const v = argv[++i];
    if (flag === "--root") {
      out.roots.push(resolve(v));
    } else if (flag === "--include") {
      out.mode = "include";
      out.projects.push(v);
    } else {
      out.mode = "exclude";
      out.projects.push(v);
    }
    consumed = true;
  }
  if (!consumed) throw new Error(`missing value for ${flag}`);
  return i;
}

/**
 * `--source-dirs`: consume every following non-flag token, then split each
 * on commas, trim, and drop empties. Returns the index of the last consumed
 * token. Throws when no value follows the flag.
 */
function parseSourceDirs(argv: string[], start: number, flag: string, out: CliArgs): number {
  let i = start;
  const parts: string[] = [];
  while (i + 1 < argv.length && !argv[i + 1].startsWith("-")) {
    parts.push(argv[++i]);
  }
  if (parts.length === 0) throw new Error(`missing value for ${flag}`);
  out.sourceDirs.push(
    ...parts.flatMap((s) => s.split(",").map((p) => p.trim()).filter(Boolean)),
  );
  return i;
}

/** Parse and validate `--limit`: a finite number >= 0. */
function parseLimit(raw: string): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`--limit must be a non-negative number`);
  }
  return n;
}

/** Parse and validate `--concurrency`: a finite integer >= 1. */
function parseConcurrency(raw: string): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(`--concurrency must be a finite integer >= 1`);
  }
  return n;
}

/** Boolean flags and the effect each has on the parsed args. */
const BOOLEAN_SETTERS: Record<string, (out: CliArgs) => void> = {
  "-h": (o) => {
    o.help = true;
  },
  "--help": (o) => {
    o.help = true;
  },
  "--all": (o) => {
    o.mode = "all";
  },
  "--dry-run": (o) => {
    o.dryRun = true;
  },
  "--sync": (o) => {
    o.sync = true;
  },
  "--force": (o) => {
    o.force = true;
  },
};

/** Value flags: each consumes the next argv token via its parser. */
const VALUE_SETTERS: Record<string, (raw: string, out: CliArgs) => void> = {
  "--limit": (raw, o) => {
    o.limit = parseLimit(raw);
  },
  "--concurrency": (raw, o) => {
    o.concurrency = parseConcurrency(raw);
  },
  "--api-url": (raw, o) => {
    o.apiUrl = raw;
  },
  "--api-token": (raw, o) => {
    o.apiToken = raw;
  },
  "--bank-id": (raw, o) => {
    o.bankId = raw;
  },
  "--omp-config": (raw, o) => {
    o.ompConfig = raw;
  },
};

/** The argv token after index i, or a thrown error when absent. */
function requireValue(argv: string[], i: number, flag: string): string {
  const v = argv[i + 1];
  if (v === undefined) throw new Error(`missing value for ${flag}`);
  return v;
}

/** Post-parse defaults: mode validation and the ~/projects root fallback. */
function applyArgDefaults(out: CliArgs): void {
  if (!VALID_MODES.has(out.mode)) {
    throw new Error(`invalid mode: ${out.mode}`);
  }
  if (out.roots.length === 0) {
    out.roots.push(resolve(process.env.HOME ?? "~", "projects"));
  }
}

export function parseArgs(argv: string[]): CliArgs {
  const out: CliArgs = {
    roots: [],
    mode: "all",
    projects: [],
    dryRun: false,
    force: false,
    limit: null,
    sync: false,
    concurrency: DEFAULT_CONCURRENCY,
    sourceDirs: [],
    apiUrl: null,
    apiToken: null,
    bankId: null,
    scoping: null,
    ompConfig: null,
    childArgs: [],
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (greedyKeys.has(a)) {
      i = applyGreedyFlag(a, argv, i, out);
      continue;
    }
    const bool = BOOLEAN_SETTERS[a];
    if (bool) {
      bool(out);
      continue;
    }
    const val = VALUE_SETTERS[a];
    if (val) {
      val(requireValue(argv, i, a), out);
      i++;
      continue;
    }
    if (a === "--source-dirs") {
      i = parseSourceDirs(argv, i, a, out);
      continue;
    }
    // unknown flag — pass through to the child script
    out.childArgs.push(a);
  }
  applyArgDefaults(out);
  return out;
}

// ---------- discovery ----------

/** A project is any directory with a `.context/memory` subdirectory. */
function memoryProjectAt(dir: string, label: string): Project | null {
  const mem = join(dir, ".context", "memory");
  try {
    if (statSync(mem).isDirectory()) {
      return { root: dir, label, hasMemoryDir: true, memoryDir: mem };
    }
  } catch {
    // no memory dir
  }
  return null;
}

/** Multi-project root: scan immediate children for projects. */
function scanChildProjects(root: string, names: string[]): Project[] {
  const out: Project[] = [];
  for (const name of names.sort()) {
    if (name.startsWith(".")) continue;
    const sub = join(root, name);
    let st;
    try {
      st = statSync(sub);
    } catch {
      continue;
    }
    if (!st.isDirectory()) continue;
    const project = memoryProjectAt(sub, name);
    if (project) out.push(project);
  }
  return out;
}

function discoverProjects(root: string): Project[] {
  const out: Project[] = [];
  if (!existsSync(root)) return out;
  let st;
  try {
    st = statSync(root);
  } catch {
    return out;
  }
  if (!st.isDirectory()) return out;

  // Single-project root: <root>/.context/memory exists.
  const self = memoryProjectAt(root, basename(root));
  if (self) return [self];

  // Multi-project root: scan immediate children.
  let entries: string[];
  try {
    entries = readdirSync(root);
  } catch {
    return out;
  }
  return scanChildProjects(root, entries);
}

function matchProjects(projects: Project[], args: CliArgs): Project[] {
  if (args.mode === "all") return projects;
  const names = new Set(args.projects);
  if (args.mode === "include") {
    return projects.filter((p) => names.has(p.label));
  }
  return projects.filter((p) => !names.has(p.label));
}

// ---------- child invocation ----------
/**
 * Build the inner-script command line for one project: fixed root and
 * memory-dir args, every configured flag, then the wrapper's pass-through
 * flags in the order they were given.
 */
function buildChildArgs(project: Project, args: CliArgs): string[] {
  const childArgs: string[] = [INNER, "--root", project.root];

  // Resolve effective source dirs. Wrapper default + inner default are both
  // `.context/memory`, so passing it explicitly keeps the contract
  // single-sourced and makes the inner invocation log-readable.
  const sourceDirs = args.sourceDirs.length > 0 ? args.sourceDirs : [".context/memory"];
  childArgs.push("--source-dirs", ...sourceDirs);
  // Legacy: --memory-dir is still accepted by the inner script for the
  // canonical first source dir.
  childArgs.push("--memory-dir", project.memoryDir);

  childArgs.push(...optionalFlags(args));
  for (const passthrough of args.childArgs) childArgs.push(passthrough);
  return childArgs;
}

/** Every optional flag configured on the wrapper, in inner-script order. */
function optionalFlags(args: CliArgs): string[] {
  const flags: string[] = [];
  if (args.dryRun) flags.push("--dry-run");
  if (args.sync) flags.push("--sync");
  if (args.force) flags.push("--force");
  if (args.limit !== null) flags.push("--limit", String(args.limit));
  if (args.apiUrl) flags.push("--api-url", args.apiUrl);
  if (args.apiToken) flags.push("--api-token", args.apiToken);
  if (args.bankId) flags.push("--bank-id", args.bankId);
  if (args.scoping) flags.push("--scoping", args.scoping);
  if (args.ompConfig) flags.push("--omp-config", args.ompConfig);
  return flags;
}

async function runChild(project: Project, args: CliArgs): Promise<ProjectResult> {
  const start = Date.now();
  const childArgs = buildChildArgs(project, args);

  const proc = spawn({
    cmd: ["bun", ...childArgs],
    cwd: project.root,
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  const duration_ms = Date.now() - start;
  const base: ProjectResult = {
    root: project.root,
    label: project.label,
    status: args.dryRun ? "dry-run" : "ok",
    duration_ms,
  };

  if (exitCode !== 0) {
    return {
      ...base,
      status: "error",
      error: stderr.trim().slice(0, 800) || `exit ${exitCode}`,
    };
  }

  let parsed: any;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    return {
      ...base,
      status: "error",
      error: `child output not JSON: ${stdout.slice(0, 200)}`,
    };
  }
  if (parsed?.error) {
    return {
      ...base,
      status: "error",
      error: String(parsed.error),
    };
  }

  return {
    ...base,
    status: args.dryRun ? "dry-run" : "ok",
    scanned: parsed.scanned,
    planned: parsed.planned,
    imported: parsed.imported,
    failed: parsed.failed,
    skipped_unchanged: parsed.skipped_unchanged,
    bank_id: parsed.bank_id,
    raw: parsed,
  };
}

// ---------- main ----------

/** Fold one child result into the running summary and its totals. */
function accumulateResult(summary: Summary, result: ProjectResult): void {
  summary.results.push(result);
  if (typeof result.scanned === "number") summary.totals.scanned += result.scanned;
  if (typeof result.planned === "number") summary.totals.planned += result.planned;
  if (typeof result.imported === "number") summary.totals.imported += result.imported;
  if (typeof result.failed === "number") summary.totals.failed += result.failed;
  if (typeof result.skipped_unchanged === "number") {
    summary.totals.skipped_unchanged += result.skipped_unchanged;
  }
  summary.totals.duration_ms += result.duration_ms;
}

/** Parse argv, or exit: usage errors print to stderr with exit 1, --help to stdout with exit 0. */
function parseArgsOrExit(): CliArgs {
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
  return args;
}

async function main(): Promise<void> {
  const args = parseArgsOrExit();

  const innerExists = existsSync(INNER);
  if (!innerExists) {
    console.error(`inner script not found: ${INNER}`);
    process.exit(1);
  }

  // Discover
  const allDiscovered: Project[] = [];
  for (const r of args.roots) {
    allDiscovered.push(...discoverProjects(r));
  }
  // De-dupe by absolute path
  const seen = new Set<string>();
  const uniq: Project[] = [];
  for (const p of allDiscovered) {
    if (seen.has(p.root)) continue;
    seen.add(p.root);
    uniq.push(p);
  }

  const matched = matchProjects(uniq, args);

  const summary: Summary = {
    inner_script: INNER,
    inner_script_exists: innerExists,
    roots: args.roots,
    mode: args.mode,
    projects_requested: args.mode === "all" ? 0 : args.projects.length,
    projects_discovered: uniq.length,
    projects_matched: matched.length,
    projects_skipped_no_memory: uniq.length - matched.length,
    results: [],
    totals: {
      scanned: 0,
      planned: 0,
      imported: 0,
      failed: 0,
      skipped_unchanged: 0,
      duration_ms: 0,
    },
  };

  if (matched.length === 0) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  // Bounded-concurrency runner
  const queue = matched.slice();
  const workers: Array<Promise<void>> = [];
  for (let w = 0; w < args.concurrency; w++) {
    workers.push(
      (async () => {
        while (queue.length > 0) {
          const p = queue.shift();
          if (!p) break;
          const result = await runChild(p, args);
          accumulateResult(summary, result);
        }
      })(),
    );
  }
  await Promise.all(workers);

  // Stable order: matched order (alphabetical by root)
  summary.results.sort((a, b) => a.root.localeCompare(b.root));
  console.log(JSON.stringify(summary, null, 2));

  const anyFailed = summary.results.some(
    (r) => r.status === "error" || (r.failed ?? 0) > 0,
  );
  process.exit(anyFailed ? 2 : 0);
}

if (import.meta.main) {
  await main();
}
