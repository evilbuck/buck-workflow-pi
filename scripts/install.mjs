#!/usr/bin/env node

/**
 * buck-workflow install — multi-harness symlink installer.
 *
 * Detects installed agent harnesses and symlinks bootstrap instructions
 * + skill/command trees into each harness's expected locations.
 *
 * Usage:
 *   buck-workflow install [--dry-run] [--force] [--source <path>] [--harness <id>...] [--list]
 */

import {
  existsSync,
  lstatSync,
  readlinkSync,
  symlinkSync,
  unlinkSync,
  mkdirSync,
  readdirSync,
} from "node:fs";
import { join, dirname, resolve } from "node:path";
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
];

// ---------------------------------------------------------------------------
// ensureSymlink
// ---------------------------------------------------------------------------

/**
 * Ensure `dest` is a symlink pointing to `src`.
 *
 * @param {string} src  - Absolute path to link target.
 * @param {string} dest - Absolute path for the symlink.
 * @param {{ dryRun?: boolean, force?: boolean }} opts
 * @returns {{ action: 'created'|'skipped'|'replaced'|'conflict', message: string }}
 */
export function ensureSymlink(src, dest, { dryRun = false, force = false } = {}) {
  // Parent directories
  const parent = dirname(dest);

  if (!existsSync(dest)) {
    if (!dryRun) {
      mkdirSync(parent, { recursive: true });
      symlinkSync(src, dest);
    }
    return { action: "created", message: `Linked ${dest} → ${src}` };
  }

  const stat = lstatSync(dest);

  if (stat.isSymbolicLink()) {
    const currentTarget = readlinkSync(dest);
    if (currentTarget === src) {
      return { action: "skipped", message: `Already linked: ${dest}` };
    }
    // Wrong target — replace
    if (!dryRun) {
      unlinkSync(dest);
      symlinkSync(src, dest);
    }
    return {
      action: "replaced",
      message: `Replaced stale link ${dest}: ${currentTarget} → ${src}`,
    };
  }

  // Real file or directory — conflict unless --force
  if (!force) {
    return {
      action: "conflict",
      message: `Conflict: ${dest} is a real file/dir. Use --force to replace.`,
    };
  }

  // force=true: remove and symlink
  if (!dryRun) {
    unlinkSync(dest);
    symlinkSync(src, dest);
  }
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
// install
// ---------------------------------------------------------------------------

/**
 * Run the full install.
 *
 * @param {{ source?: string, home?: string, dryRun?: boolean, force?: boolean, harnessIds?: string[]|null }} opts
 * @returns {{ results: Array<{ harness: string, surface: string, dest: string, action: string, message: string }>, exitCode: number }}
 */
export function install({
  source = REPO_ROOT,
  home = homedir(),
  dryRun = false,
  force = false,
  harnessIds = null,
} = {}) {
  let detected = detectHarnesses(home);

  // Filter to requested harnesses
  if (harnessIds) {
    const ids = new Set(harnessIds);
    detected = detected.filter((h) => ids.has(h.id));
  }

  if (detected.length === 0) {
    return {
      results: [],
      exitCode: 1,
    };
  }

  const results = [];

  for (const harness of detected) {
    // Cursor: no global surfaces to wire
    if (Object.keys(harness.surfaces).length === 0) {
      results.push({
        harness: harness.id,
        surface: "(none)",
        dest: "",
        action: "skipped",
        message: `${harness.name}: ${harness.note || "No global surfaces."}`,
      });
      continue;
    }

    for (const [surfaceName, surface] of Object.entries(harness.surfaces)) {
      const srcBase = join(source, surface.src);
      const destBase = join(home, surface.dest);

      if (surfaceName === "bootstrap") {
        // Single file symlink
        const res = ensureSymlink(srcBase, destBase, { dryRun, force });
        results.push({
          harness: harness.id,
          surface: surfaceName,
          dest: destBase,
          action: res.action,
          message: res.message,
        });
      } else if (surfaceName === "commands") {
        // Glob: each .md file in src dir → one symlink in dest dir
        if (!existsSync(srcBase)) {
          results.push({
            harness: harness.id,
            surface: surfaceName,
            dest: destBase,
            action: "skipped",
            message: `Source dir missing: ${srcBase}`,
          });
          continue;
        }
        const files = readdirSync(srcBase).filter((f) => f.endsWith(".md"));
        for (const file of files) {
          const src = join(srcBase, file);
          const dest = join(destBase, file);
          const res = ensureSymlink(src, dest, { dryRun, force });
          results.push({
            harness: harness.id,
            surface: surfaceName,
            dest,
            action: res.action,
            message: res.message,
          });
        }
      } else if (surfaceName === "skills") {
        // One symlink per subdirectory in skills/
        if (!existsSync(srcBase)) {
          results.push({
            harness: harness.id,
            surface: surfaceName,
            dest: destBase,
            action: "skipped",
            message: `Source dir missing: ${srcBase}`,
          });
          continue;
        }
        const entries = readdirSync(srcBase, { withFileTypes: true })
          .filter((d) => d.isDirectory());
        for (const dir of entries) {
          const src = join(srcBase, dir.name);
          const dest = join(destBase, dir.name);
          const res = ensureSymlink(src, dest, { dryRun, force });
          results.push({
            harness: harness.id,
            surface: surfaceName,
            dest,
            action: res.action,
            message: res.message,
          });
        }
      }
    }
  }

  const hasConflict = results.some((r) => r.action === "conflict");
  return {
    results,
    exitCode: hasConflict ? 1 : 0,
  };
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
      case "--help":
        args.help = true;
        break;
    }
  }

  return args;
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
  --help                 Show this help
`.trim();

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(HELP);
    process.exit(0);
  }

  const home = homedir();
  const source = args.source ? resolve(args.source) : REPO_ROOT;

  if (args.list) {
    const detected = detectHarnesses(home);
    if (detected.length === 0) {
      console.log("No harnesses detected. Install at least one agent harness.");
      process.exit(1);
    }
    console.log("Detected harnesses:\n");
    for (const h of detected) {
      const surfaces = Object.keys(h.surfaces);
      if (surfaces.length === 0) {
        console.log(`  ${h.name} (${h.id}) — ${h.note}`);
      } else {
        console.log(`  ${h.name} (${h.id}) — surfaces: ${surfaces.join(", ")}`);
      }
    }
    console.log(`\nSource: ${source}`);
    process.exit(0);
  }

  // Full install
  const result = install({
    source,
    home,
    dryRun: args.dryRun,
    force: args.force,
    harnessIds: args.harnessIds,
  });

  if (result.results.length === 0 && result.exitCode === 1) {
    console.error("No harnesses detected. Install at least one agent harness first.");
    process.exit(1);
  }

  const prefix = args.dryRun ? "[DRY RUN] " : "";
  for (const r of result.results) {
    const tag =
      r.action === "created" ? "+" :
      r.action === "replaced" ? "~" :
      r.action === "skipped" ? "=" :
      "!";
    console.log(`${prefix}${tag} [${r.harness}:${r.surface}] ${r.message}`);
  }

  if (result.exitCode !== 0) {
    console.error(`\nSome conflicts prevented installation. Re-run with --force to overwrite.`);
  } else if (!args.dryRun) {
    console.log(`\nDone. ${result.results.filter((r) => r.action === "created").length} linked, ${result.results.filter((r) => r.action === "skipped").length} skipped.`);
  }

  process.exit(result.exitCode);
}

// Auto-run only when executed directly
if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(__filename)
) {
  main();
}
