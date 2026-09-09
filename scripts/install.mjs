#!/usr/bin/env node

/**
 * buck-workflow install — multi-harness symlink installer.
 *
 * Detects installed agent harnesses and symlinks bootstrap instructions
 * + skill/command trees into each harness's expected locations.
 *
 * Usage:
 *   buck-workflow install [--dry-run] [--force] [--source <path>] [--harness <id>...] [--list] [--verify]
 */

import {
  existsSync,
  lstatSync,
  readlinkSync,
  symlinkSync,
  unlinkSync,
  mkdirSync,
  readdirSync,
  realpathSync,
} from "node:fs";
import { join, dirname, resolve, isAbsolute, sep } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// Harness Registry
// ---------------------------------------------------------------------------

/**
 * Each harness declares which surfaces it uses and where they go.
 * Paths in `dest` are relative to $HOME.
 * Paths in `src` are relative to the repo root.
 */
export const HARNESSES = [
  {
    id: "pi",
    name: "Pi",
    detectDir: ".pi/agent",
    surfaces: {
      bootstrap: { src: "GLOBAL_OR_PROJECT-AGENTS.md", dest: ".pi/agent/AGENTS.md" },
    },
  },
  {
    id: "omp",
    name: "OMP",
    detectDir: ".omp/agent",
    surfaces: {
      bootstrap: { src: "GLOBAL_OR_PROJECT-AGENTS.md", dest: ".omp/agent/AGENTS.md" },
    },
  },
  {
    id: "claude",
    name: "Claude Code",
    detectDir: ".claude",
    surfaces: {
      bootstrap: { src: "GLOBAL_OR_PROJECT-AGENTS.md", dest: ".claude/CLAUDE.md" },
      commands:  { src: "prompts", dest: ".claude/commands" },
      skills:    { src: "skills",  dest: ".claude/skills" },
    },
  },
  {
    id: "codex",
    name: "Codex",
    detectDir: ".codex",
    surfaces: {
      bootstrap: { src: "GLOBAL_OR_PROJECT-AGENTS.md", dest: ".codex/AGENTS.md" },
    },
  },
  {
    id: "opencode",
    name: "OpenCode",
    detectDir: ".config/opencode",
    surfaces: {
      bootstrap: { src: "GLOBAL_OR_PROJECT-AGENTS.md", dest: ".config/opencode/AGENTS.md" },
      commands:  { src: "prompts", dest: ".config/opencode/commands" },
      skills:    { src: "skills",  dest: ".config/opencode/skills" },
    },
  },
  {
    id: "cursor",
    name: "Cursor",
    detectDir: ".cursor",
    surfaces: {},
    note: "Cursor requires project-scoped .cursor/rules/ setup. No global install available.",
  },
  {
    id: "grok",
    name: "Grok Build",
    detectDir: ".grok",
    surfaces: {
      bootstrap: { src: "GLOBAL_OR_PROJECT-AGENTS.md", dest: ".grok/rules/buck-workflow.md" },
      commands:  { src: "prompts", dest: ".grok/commands" },
      skills:    { src: "skills",  dest: ".grok/skills" },
    },
  },
];

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

/**
 * Is `target` the source root itself, or a path beneath it?
 *
 * The separator guard is load-bearing: a bare `startsWith` would treat
 * `/x/repo-old/skills/b-plan` as living inside `/x/repo`.
 *
 * @param {string} target
 * @param {string} root
 * @returns {boolean}
 */
export function isInsideRoot(target, root) {
  const t = resolve(target);
  const r = resolve(root);
  return t === r || t.startsWith(r + sep);
}

/**
 * Best-effort source root for an existing link target.
 *
 * When the caller knows the repo-relative path the link should have
 * (`relPath`), stripping it off the end yields the exact foreign root.
 * Otherwise fall back to the target's parent directory.
 *
 * @param {string} target  - Absolute, already-resolved link target.
 * @param {string} [relPath] - Repo-relative path this link represents.
 * @returns {string}
 */
function inferSourceRoot(target, relPath) {
  if (relPath) {
    const suffix = sep + relPath;
    if (target.endsWith(suffix)) return target.slice(0, -suffix.length);
  }
  return dirname(target);
}

// ---------------------------------------------------------------------------
// ensureSymlink
// ---------------------------------------------------------------------------

/**
 * Replace `dest` with a fresh symlink to `src`.
 * @param {string} src
 * @param {string} dest
 * @param {boolean} dryRun
 */
function relink(src, dest, dryRun) {
  if (dryRun) return;
  unlinkSync(dest);
  symlinkSync(src, dest);
}

/**
 * Describe the symlink already sitting at `dest`.
 *
 * A relative target is stored verbatim, so resolve it against the link's own
 * directory before deciding which checkout it belongs to.
 *
 * @param {string} dest
 * @param {string} src
 * @param {{ sourceRoot: string|null, relPath: string|null }} opts
 * @returns {{ match: boolean, currentTarget?: string, crossRoot?: boolean, oldRoot?: string }}
 */
function classifyExistingLink(dest, src, { sourceRoot, relPath }) {
  const currentTarget = readlinkSync(dest);
  if (currentTarget === src) return { match: true };

  const resolvedTarget = isAbsolute(currentTarget)
    ? currentTarget
    : resolve(dirname(dest), currentTarget);
  const crossRoot =
    sourceRoot !== null && !isInsideRoot(resolvedTarget, sourceRoot);

  return {
    match: false,
    currentTarget,
    crossRoot,
    oldRoot: crossRoot ? inferSourceRoot(resolvedTarget, relPath) : undefined,
  };
}

/**
 * Ensure `dest` is a symlink pointing to `src`.
 *
 * @param {string} src  - Absolute path to link target.
 * @param {string} dest - Absolute path for the symlink.
 * @param {{ dryRun?: boolean, force?: boolean, sourceRoot?: string, relPath?: string }} opts
 *   `sourceRoot` + `relPath` enable cross-root reporting: when the existing
 *   link resolves outside `sourceRoot`, the result carries `crossRoot: true`
 *   and `oldRoot`. Omitting `sourceRoot` preserves the original behavior.
 * @returns {{ action: 'created'|'skipped'|'replaced'|'conflict', message: string, crossRoot?: boolean, oldRoot?: string }}
 */
export function ensureSymlink(src, dest, { dryRun = false, force = false, sourceRoot = null, relPath = null } = {}) {
  if (!existsSync(dest)) {
    if (!dryRun) {
      mkdirSync(dirname(dest), { recursive: true });
      symlinkSync(src, dest);
    }
    return { action: "created", message: `Linked ${dest} → ${src}` };
  }

  if (lstatSync(dest).isSymbolicLink()) {
    const link = classifyExistingLink(dest, src, { sourceRoot, relPath });
    if (link.match) {
      return { action: "skipped", message: `Already linked: ${dest}` };
    }

    relink(src, dest, dryRun);

    if (link.crossRoot) {
      return {
        action: "replaced",
        crossRoot: true,
        oldRoot: link.oldRoot,
        message: `Moved ${dest} to a different source root: ${link.oldRoot} → ${sourceRoot} (was ${link.currentTarget})`,
      };
    }

    return {
      action: "replaced",
      message: `Replaced stale link ${dest}: ${link.currentTarget} → ${src}`,
    };
  }

  // Real file or directory — a copy. Conflict unless --force.
  if (!force) {
    return {
      action: "conflict",
      message: `Conflict: ${dest} is a real file/dir. Use --force to replace it with a symlink.`,
    };
  }

  relink(src, dest, dryRun);
  return {
    action: "replaced",
    message: `Force-replaced ${dest} → ${src}`,
  };
}

// ---------------------------------------------------------------------------
// detectHarnesses
// ---------------------------------------------------------------------------

/**
 * Detect which harnesses are installed under `home`.
 * @param {string} home - Home directory (or test fixture).
 * @returns {Array<typeof HARNESSES[number]>}
 */
export function detectHarnesses(home) {
  return HARNESSES.filter((h) => existsSync(join(home, h.detectDir)));
}

// ---------------------------------------------------------------------------
// Surface enumeration
// ---------------------------------------------------------------------------

/**
 * Enumerate every (harness, surface, src, dest) pair the installer manages,
 * in output order. `install` and `verifySurfaces` share this walk so the two
 * can never disagree about what is supposed to exist.
 *
 * Items carrying `note` are informational only (a harness with no global
 * surfaces, or a missing source directory) — they have no destination state.
 *
 * @param {{ source: string, home: string, harnessIds?: string[]|null }} opts
 * @returns {{ detectedCount: number, items: Array<{ harness: string, surface: string, dest: string, src?: string, relPath?: string, note?: string }> }}
 */
function enumerateSurfaces({ source, home, harnessIds = null }) {
  let detected = detectHarnesses(home);

  // Filter to requested harnesses
  if (harnessIds) {
    const ids = new Set(harnessIds);
    detected = detected.filter((h) => ids.has(h.id));
  }

  const items = [];

  for (const harness of detected) {
    // Cursor: no global surfaces to wire
    if (Object.keys(harness.surfaces).length === 0) {
      items.push({
        harness: harness.id,
        surface: "(none)",
        dest: "",
        note: `${harness.name}: ${harness.note || "No global surfaces."}`,
      });
      continue;
    }

    for (const [surfaceName, surface] of Object.entries(harness.surfaces)) {
      const srcBase = join(source, surface.src);
      const destBase = join(home, surface.dest);

      // Single file symlink
      if (surfaceName === "bootstrap") {
        items.push({
          harness: harness.id,
          surface: surfaceName,
          src: srcBase,
          dest: destBase,
          relPath: surface.src,
        });
        continue;
      }

      if (!existsSync(srcBase)) {
        items.push({
          harness: harness.id,
          surface: surfaceName,
          dest: destBase,
          note: `Source dir missing: ${srcBase}`,
        });
        continue;
      }

      // commands: each .md file → one symlink. skills: each subdirectory.
      const names =
        surfaceName === "commands"
          ? readdirSync(srcBase).filter((f) => f.endsWith(".md"))
          : readdirSync(srcBase, { withFileTypes: true })
              .filter((d) => d.isDirectory())
              .map((d) => d.name);

      for (const name of names) {
        items.push({
          harness: harness.id,
          surface: surfaceName,
          src: join(srcBase, name),
          dest: join(destBase, name),
          relPath: join(surface.src, name),
        });
      }
    }
  }

  return { detectedCount: detected.length, items };
}

// ---------------------------------------------------------------------------
// install
// ---------------------------------------------------------------------------

/**
 * Run the full install.
 *
 * @param {{ source?: string, home?: string, dryRun?: boolean, force?: boolean, harnessIds?: string[]|null }} opts
 * @returns {{ results: Array<{ harness: string, surface: string, dest: string, action: string, message: string, crossRoot?: boolean, oldRoot?: string }>, exitCode: number }}
 */
export function install({
  source = REPO_ROOT,
  home = homedir(),
  dryRun = false,
  force = false,
  harnessIds = null,
} = {}) {
  const { detectedCount, items } = enumerateSurfaces({ source, home, harnessIds });

  if (detectedCount === 0) {
    return {
      results: [],
      exitCode: 1,
    };
  }

  const results = [];

  for (const item of items) {
    if (item.note) {
      results.push({
        harness: item.harness,
        surface: item.surface,
        dest: item.dest,
        action: "skipped",
        message: item.note,
      });
      continue;
    }

    const res = ensureSymlink(item.src, item.dest, {
      dryRun,
      force,
      sourceRoot: source,
      relPath: item.relPath,
    });

    // A real file where the bootstrap belongs is a copy. Say so explicitly —
    // the generic conflict message hides that a re-run will keep skipping it.
    const message =
      res.action === "conflict" && item.surface === "bootstrap"
        ? `Copied bootstrap detected at ${item.dest} — it does not track the repo. Re-run with --force to convert it to a symlink.`
        : res.message;

    results.push({
      harness: item.harness,
      surface: item.surface,
      dest: item.dest,
      action: res.action,
      message,
      ...(res.crossRoot ? { crossRoot: true, oldRoot: res.oldRoot } : {}),
    });
  }

  const hasConflict = results.some((r) => r.action === "conflict");
  return {
    results,
    exitCode: hasConflict ? 1 : 0,
  };
}

// ---------------------------------------------------------------------------
// verifySurfaces
// ---------------------------------------------------------------------------

/**
 * Report what each managed destination actually resolves to. Read-only: it
 * never links, never creates a parent directory.
 *
 * States: `linked-here` (symlink inside `source`), `linked-elsewhere`
 * (symlink into a different checkout), `dangling` (target gone), `real-file`
 * (a copy), `missing` (nothing installed).
 *
 * @param {{ source?: string, home?: string, harnessIds?: string[]|null }} opts
 * @returns {{ results: Array<{ harness: string, surface: string, dest: string, target: string|null, state: string, root: string|null }>, roots: string[], exitCode: number }}
 */
export function verifySurfaces({
  source = REPO_ROOT,
  home = homedir(),
  harnessIds = null,
} = {}) {
  const { detectedCount, items } = enumerateSurfaces({ source, home, harnessIds });

  if (detectedCount === 0) {
    return { results: [], roots: [], exitCode: 1 };
  }

  const results = [];
  const roots = [];

  for (const item of items) {
    if (item.note) continue;

    let stat = null;
    try {
      stat = lstatSync(item.dest);
    } catch {
      stat = null;
    }

    let state;
    let target = null;
    let root = null;

    if (stat === null) {
      state = "missing";
    } else if (stat.isSymbolicLink()) {
      const raw = readlinkSync(item.dest);
      target = isAbsolute(raw) ? raw : resolve(dirname(item.dest), raw);
      if (!existsSync(target)) {
        state = "dangling";
        root = inferSourceRoot(target, item.relPath);
      } else if (isInsideRoot(target, source)) {
        state = "linked-here";
        root = resolve(source);
      } else {
        state = "linked-elsewhere";
        root = inferSourceRoot(target, item.relPath);
      }
    } else {
      state = "real-file";
    }

    if (
      (state === "linked-here" || state === "linked-elsewhere") &&
      !roots.includes(root)
    ) {
      roots.push(root);
    }

    results.push({
      harness: item.harness,
      surface: item.surface,
      dest: item.dest,
      target,
      state,
      root,
    });
  }

  const broken = results.some(
    (r) =>
      r.state === "linked-elsewhere" ||
      r.state === "dangling" ||
      r.state === "real-file",
  );

  return { results, roots, exitCode: broken ? 1 : 0 };
}

// ---------------------------------------------------------------------------
// parseArgs
// ---------------------------------------------------------------------------

/**
 * Parse CLI arguments into an options bag.
 * @param {string[]} argv - process.argv.slice(2)
 */
export function parseArgs(argv) {
  const args = {
    dryRun: false,
    force: false,
    source: null,
    harnessIds: null,
    list: false,
    verify: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case "--dry-run":
        args.dryRun = true;
        break;
      case "--force":
        args.force = true;
        break;
      case "--source":
        args.source = argv[++i];
        break;
      case "--harness":
        args.harnessIds = argv[++i].split(",");
        break;
      case "--list":
        args.list = true;
        break;
      case "--verify":
        args.verify = true;
        break;
      case "--help":
        args.help = true;
        break;
    }
  }

  return args;
}

// ---------------------------------------------------------------------------
// summarize
// ---------------------------------------------------------------------------

/**
 * Tally install results by action. `moved` counts destinations pulled in from
 * a different source root — the number that matters after a split.
 *
 * @param {Array<{ action: string, crossRoot?: boolean }>} results
 * @returns {{ created: number, replaced: number, skipped: number, conflict: number, moved: number }}
 */
export function summarize(results) {
  const counts = { created: 0, replaced: 0, skipped: 0, conflict: 0, moved: 0 };
  for (const r of results) {
    if (r.action in counts) counts[r.action] += 1;
    if (r.crossRoot) counts.moved += 1;
  }
  return counts;
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

const HELP = `
buck-workflow install — multi-harness symlink installer

Usage:
  buck-workflow install [options]

Options:
  --dry-run              Print planned symlinks, write nothing
  --force                Replace real files at destination
  --source <path>        Repo root symlinks resolve from (default: auto-detect)
  --harness <id,...>     Wire only named harnesses (comma-separated)
  --list                 Print detected harnesses and exit
  --verify               Report what each harness resolves to; write nothing
  --help                 Show this help
`.trim();

/**
 * `--list`: print detected harnesses and the source they would resolve from.
 * @returns {number} exit code
 */
export function runList(home, source) {
  const detected = detectHarnesses(home);
  if (detected.length === 0) {
    console.log("No harnesses detected. Install at least one agent harness.");
    return 1;
  }

  console.log("Detected harnesses:\n");
  for (const h of detected) {
    const surfaces = Object.keys(h.surfaces);
    const detail =
      surfaces.length === 0 ? h.note : `surfaces: ${surfaces.join(", ")}`;
    console.log(`  ${h.name} (${h.id}) — ${detail}`);
  }
  console.log(`\nSource: ${source}`);
  return 0;
}

/** One-line description of a destination that is not linked into `source`. */
function describeProblem(r) {
  if (r.state === "real-file") return "real file — a copy, not a symlink";
  if (r.state === "missing") return "not installed";
  return `${r.state} → ${r.target}`;
}

/** Per-harness state tally, e.g. `claude    86 linked-here`. */
function printHarnessTallies(results) {
  const byHarness = new Map();
  for (const r of results) {
    if (!byHarness.has(r.harness)) byHarness.set(r.harness, {});
    const tally = byHarness.get(r.harness);
    tally[r.state] = (tally[r.state] || 0) + 1;
  }

  console.log("\nPer harness:");
  for (const [harness, tally] of byHarness) {
    const parts = Object.entries(tally).map(([state, n]) => `${n} ${state}`);
    console.log(`  ${harness.padEnd(9)} ${parts.join(", ")}`);
  }
}

/** Closing verdict for a verify run. */
function printVerifyVerdict(report) {
  if (report.roots.length > 1) {
    console.error(
      `\nSplit detected: harnesses resolve to more than one checkout. ` +
        `Re-run the installer from the checkout you want to be canonical.`,
    );
  } else if (report.exitCode !== 0) {
    console.error(
      `\nProblems found. Re-run the installer (add --force to replace copied files).`,
    );
  } else {
    console.log("\nOK — every managed surface resolves to this checkout.");
  }
}

/**
 * `--verify`: report what each managed destination resolves to. Writes nothing.
 * @returns {number} exit code
 */
export function runVerify(args, home, source) {
  const report = verifySurfaces({ source, home, harnessIds: args.harnessIds });

  if (report.results.length === 0) {
    console.error("No harnesses detected. Install at least one agent harness first.");
    return 1;
  }

  console.log(`Source: ${source}`);

  const problems = report.results.filter((r) => r.state !== "linked-here");
  if (problems.length > 0) {
    console.log("");
    for (const r of problems) {
      console.log(`! [${r.harness}:${r.surface}] ${r.dest} (${describeProblem(r)})`);
    }
  }

  printHarnessTallies(report.results);

  console.log(`\nSource roots in use: ${report.roots.length}`);
  for (const root of report.roots) {
    const n = report.results.filter((r) => r.root === root).length;
    console.log(`  ${root} (${n})`);
  }

  printVerifyVerdict(report);
  return report.exitCode;
}

const ACTION_TAGS = { created: "+", replaced: "~", skipped: "=" };

/**
 * Default command: wire every detected harness.
 * @returns {number} exit code
 */
export function runInstall(args, home, source) {
  const result = install({
    source,
    home,
    dryRun: args.dryRun,
    force: args.force,
    harnessIds: args.harnessIds,
  });

  if (result.results.length === 0 && result.exitCode === 1) {
    console.error("No harnesses detected. Install at least one agent harness first.");
    return 1;
  }

  const prefix = args.dryRun ? "[DRY RUN] " : "";
  for (const r of result.results) {
    const tag = ACTION_TAGS[r.action] || "!";
    console.log(`${prefix}${tag} [${r.harness}:${r.surface}] ${r.message}`);
  }

  const counts = summarize(result.results);
  const moved =
    counts.moved > 0 ? ` — ${counts.moved} moved from another source root` : "";

  if (result.exitCode !== 0) {
    console.error(`\nSome conflicts prevented installation. Re-run with --force to overwrite.`);
  } else if (!args.dryRun) {
    console.log(
      `\nDone. ${counts.created} linked, ${counts.replaced} relinked, ${counts.skipped} unchanged${moved}.`,
    );
  }

  return result.exitCode;
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(HELP);
    process.exit(0);
  }

  const home = homedir();
  const source = args.source ? resolve(args.source) : REPO_ROOT;

  if (args.list) process.exit(runList(home, source));
  if (args.verify) process.exit(runVerify(args, home, source));
  process.exit(runInstall(args, home, source));
}

/**
 * Was this file the script the user actually invoked?
 *
 * `process.argv[1]` and `import.meta.url` can disagree when the path
 * traverses a symlinked directory (`/tmp` → `/private/tmp` on macOS, a
 * symlinked home, a checkout reached through a link). Comparing the resolved
 * real paths keeps the CLI from exiting 0 having silently done nothing.
 *
 * @param {string|undefined} invokedPath - process.argv[1]
 * @param {string} modulePath - this module's own path
 * @returns {boolean}
 */
export function isMainModule(invokedPath, modulePath) {
  if (!invokedPath) return false;
  const real = (p) => {
    try {
      return realpathSync(resolve(p));
    } catch {
      return resolve(p);
    }
  };
  return real(invokedPath) === real(modulePath);
}

// Auto-run only when executed directly
if (isMainModule(process.argv[1], __filename)) {
  main();
}
