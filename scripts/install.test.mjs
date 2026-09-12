import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  mkdirSync,
  rmSync,
  writeFileSync,
  existsSync,
  readlinkSync,
  readFileSync,
  readdirSync,
  symlinkSync,
  unlinkSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import {
  HARNESSES,
  ensureSymlink,
  detectHarnesses,
  install,
  parseArgs,
  isInsideRoot,
  verifySurfaces,
  summarize,
  isMainModule,
  runList,
  runVerify,
  runInstall,
} from "./install.mjs";

const TEST_ROOT = join("/tmp", "install-test-" + process.pid);

/**
 * Create fake repo + home fixtures.
 * Returns { repo, home } — callers can add/remove dirs.
 */
function setupFixtures() {
  const repo = join(TEST_ROOT, "repo");
  const home = join(TEST_ROOT, "home");

  // Repo: bootstrap + 2 prompts + 2 skill dirs
  mkdirSync(join(repo, "prompts"), { recursive: true });
  mkdirSync(join(repo, "skills", "b-build"), { recursive: true });
  mkdirSync(join(repo, "skills", "b-plan"), { recursive: true });
  writeFileSync(join(repo, "GLOBAL_OR_PROJECT-AGENTS.md"), "# Bootstrap\n");
  writeFileSync(join(repo, "prompts", "b-build.md"), "# Build prompt\n");
  writeFileSync(join(repo, "prompts", "b-plan.md"), "# Plan prompt\n");
  writeFileSync(
    join(repo, "skills", "b-build", "SKILL.md"),
    "# b-build skill\n",
  );
  writeFileSync(
    join(repo, "skills", "b-plan", "SKILL.md"),
    "# b-plan skill\n",
  );

  // Home: all 8 harness dirs detected
  mkdirSync(join(home, ".pi", "agent"), { recursive: true });
  mkdirSync(join(home, ".omp", "agent"), { recursive: true });
  mkdirSync(join(home, ".claude"), { recursive: true });
  mkdirSync(join(home, ".codex"), { recursive: true });
  mkdirSync(join(home, ".config", "opencode"), { recursive: true });
  mkdirSync(join(home, ".cursor"), { recursive: true });
  mkdirSync(join(home, ".grok"), { recursive: true });
  mkdirSync(join(home, ".zcode"), { recursive: true });

  return { repo, home };
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------
describe("HARNESSES registry", () => {
  it("has 8 harness entries", () => {
    expect(HARNESSES).toHaveLength(8);
  });

  it("has unique ids", () => {
    const ids = HARNESSES.map((h) => h.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("Pi is bootstrap-only", () => {
    const h = HARNESSES.find((h) => h.id === "pi");
    expect(Object.keys(h.surfaces)).toEqual(["bootstrap"]);
  });

  it("OMP is bootstrap-only", () => {
    const h = HARNESSES.find((h) => h.id === "omp");
    expect(Object.keys(h.surfaces)).toEqual(["bootstrap"]);
  });

  it("Claude has bootstrap + commands + skills", () => {
    const h = HARNESSES.find((h) => h.id === "claude");
    expect(Object.keys(h.surfaces).sort()).toEqual([
      "bootstrap",
      "commands",
      "skills",
    ]);
  });

  it("Codex is bootstrap-only", () => {
    const h = HARNESSES.find((h) => h.id === "codex");
    expect(Object.keys(h.surfaces)).toEqual(["bootstrap"]);
  });

  it("OpenCode has bootstrap + commands + skills", () => {
    const h = HARNESSES.find((h) => h.id === "opencode");
    expect(Object.keys(h.surfaces).sort()).toEqual([
      "bootstrap",
      "commands",
      "skills",
    ]);
  });

  it("Cursor has no surfaces (project-scoped only)", () => {
    const h = HARNESSES.find((h) => h.id === "cursor");
    expect(Object.keys(h.surfaces)).toHaveLength(0);
    expect(h.note).toBeDefined();
  });

  it("Grok Build has bootstrap + commands + skills", () => {
    const h = HARNESSES.find((h) => h.id === "grok");
    expect(Object.keys(h.surfaces).sort()).toEqual([
      "bootstrap",
      "commands",
      "skills",
    ]);
    expect(h.surfaces.bootstrap.dest).toBe(".grok/rules/buck-workflow.md");
  });

  it("ZCode has bootstrap + skills (skills are invoked as /<name>)", () => {
    const h = HARNESSES.find((h) => h.id === "zcode");
    expect(Object.keys(h.surfaces).sort()).toEqual(["bootstrap", "skills"]);
    expect(h.surfaces.bootstrap.dest).toBe(".zcode/AGENTS.md");
    expect(h.surfaces.skills.dest).toBe(".zcode/skills");
  });
});

// ---------------------------------------------------------------------------
// ensureSymlink
// ---------------------------------------------------------------------------
describe("ensureSymlink", () => {
  beforeEach(() => mkdirSync(TEST_ROOT, { recursive: true }));
  afterEach(() => rmSync(TEST_ROOT, { recursive: true, force: true }));

  it("creates symlink when dest does not exist", () => {
    const src = join(TEST_ROOT, "source.txt");
    const dest = join(TEST_ROOT, "link.txt");
    writeFileSync(src, "content");

    const result = ensureSymlink(src, dest);

    expect(result.action).toBe("created");
    expect(readlinkSync(dest)).toBe(src);
  });

  it("creates parent directories", () => {
    const src = join(TEST_ROOT, "source.txt");
    const dest = join(TEST_ROOT, "a", "b", "c", "link.txt");
    writeFileSync(src, "content");

    const result = ensureSymlink(src, dest);

    expect(result.action).toBe("created");
    expect(readlinkSync(dest)).toBe(src);
  });

  it("skips when dest already points to correct target", () => {
    const src = join(TEST_ROOT, "source.txt");
    const dest = join(TEST_ROOT, "link.txt");
    writeFileSync(src, "content");
    symlinkSync(src, dest);

    const result = ensureSymlink(src, dest);

    expect(result.action).toBe("skipped");
  });

  it("replaces when dest points to wrong target", () => {
    const src = join(TEST_ROOT, "source.txt");
    const wrong = join(TEST_ROOT, "wrong.txt");
    const dest = join(TEST_ROOT, "link.txt");
    writeFileSync(src, "content");
    writeFileSync(wrong, "wrong");
    symlinkSync(wrong, dest);

    const result = ensureSymlink(src, dest);

    expect(result.action).toBe("replaced");
    expect(readlinkSync(dest)).toBe(src);
  });

  it("replaces a dangling symlink instead of throwing EEXIST", () => {
    const src = join(TEST_ROOT, "source.txt");
    const dest = join(TEST_ROOT, "link.txt");
    writeFileSync(src, "content");
    symlinkSync(join(TEST_ROOT, "gone.txt"), dest);

    const result = ensureSymlink(src, dest);

    expect(result.action).toBe("replaced");
    expect(readlinkSync(dest)).toBe(src);
  });

  it("returns conflict when dest is a real file and force=false", () => {
    const src = join(TEST_ROOT, "source.txt");
    const dest = join(TEST_ROOT, "real.txt");
    writeFileSync(src, "content");
    writeFileSync(dest, "real content");

    const result = ensureSymlink(src, dest);

    expect(result.action).toBe("conflict");
    expect(readFileSync(dest, "utf8")).toBe("real content");
  });

  it("replaces real file when force=true", () => {
    const src = join(TEST_ROOT, "source.txt");
    const dest = join(TEST_ROOT, "real.txt");
    writeFileSync(src, "content");
    writeFileSync(dest, "real content");

    const result = ensureSymlink(src, dest, { force: true });

    expect(result.action).toBe("replaced");
    expect(readlinkSync(dest)).toBe(src);
  });

  it("dryRun reports created but does not write", () => {
    const src = join(TEST_ROOT, "source.txt");
    const dest = join(TEST_ROOT, "link.txt");
    writeFileSync(src, "content");

    const result = ensureSymlink(src, dest, { dryRun: true });

    expect(result.action).toBe("created");
    expect(existsSync(dest)).toBe(false);
  });

  it("dryRun reports replaced but does not change existing symlink", () => {
    const src = join(TEST_ROOT, "source.txt");
    const wrong = join(TEST_ROOT, "wrong.txt");
    const dest = join(TEST_ROOT, "link.txt");
    writeFileSync(src, "content");
    writeFileSync(wrong, "wrong");
    symlinkSync(wrong, dest);

    const result = ensureSymlink(src, dest, { dryRun: true });

    expect(result.action).toBe("replaced");
    expect(readlinkSync(dest)).toBe(wrong); // unchanged
  });

  it("returns conflict for directories without force", () => {
    const src = join(TEST_ROOT, "source.txt");
    const dest = join(TEST_ROOT, "adir");
    writeFileSync(src, "content");
    mkdirSync(dest);

    const result = ensureSymlink(src, dest);

    expect(result.action).toBe("conflict");
  });
});

// ---------------------------------------------------------------------------
// detectHarnesses
// ---------------------------------------------------------------------------
describe("detectHarnesses", () => {
  beforeEach(() => mkdirSync(TEST_ROOT, { recursive: true }));
  afterEach(() => rmSync(TEST_ROOT, { recursive: true, force: true }));

  it("detects harnesses whose detectDir exists under home", () => {
    const home = join(TEST_ROOT, "home");
    mkdirSync(join(home, ".pi", "agent"), { recursive: true });
    mkdirSync(join(home, ".claude"), { recursive: true });

    const detected = detectHarnesses(home);

    const ids = detected.map((h) => h.id);
    expect(ids).toContain("pi");
    expect(ids).toContain("claude");
    expect(ids).not.toContain("omp");
  });

  it("returns empty array when no harness dirs exist", () => {
    const home = join(TEST_ROOT, "empty-home");
    mkdirSync(home);

    const detected = detectHarnesses(home);

    expect(detected).toEqual([]);
  });

  it("detects all eight when all dirs present", () => {
    const home = join(TEST_ROOT, "home");
    mkdirSync(join(home, ".pi", "agent"), { recursive: true });
    mkdirSync(join(home, ".omp", "agent"), { recursive: true });
    mkdirSync(join(home, ".claude"), { recursive: true });
    mkdirSync(join(home, ".codex"), { recursive: true });
    mkdirSync(join(home, ".config", "opencode"), { recursive: true });
    mkdirSync(join(home, ".cursor"), { recursive: true });
    mkdirSync(join(home, ".grok"), { recursive: true });
    mkdirSync(join(home, ".zcode"), { recursive: true });

    const detected = detectHarnesses(home);

    expect(detected).toHaveLength(8);
  });
});

// ---------------------------------------------------------------------------
// install
// ---------------------------------------------------------------------------
describe("install", () => {
  beforeEach(() => mkdirSync(TEST_ROOT, { recursive: true }));
  afterEach(() => rmSync(TEST_ROOT, { recursive: true, force: true }));

  it("creates bootstrap symlink for Pi", () => {
    const { repo, home } = setupFixtures();

    const result = install({ source: repo, home });

    const link = join(home, ".pi", "agent", "AGENTS.md");
    expect(existsSync(link)).toBe(true);
    expect(readlinkSync(link)).toBe(join(repo, "GLOBAL_OR_PROJECT-AGENTS.md"));
    expect(result.exitCode).toBe(0);
  });

  it("Pi and OMP get bootstrap-only (no commands or skills)", () => {
    const { repo, home } = setupFixtures();

    install({ source: repo, home });

    // Pi: only AGENTS.md, no commands/skills dirs created
    expect(existsSync(join(home, ".pi", "agent", "AGENTS.md"))).toBe(true);
    expect(existsSync(join(home, ".pi", "commands"))).toBe(false);
    expect(existsSync(join(home, ".pi", "skills"))).toBe(false);

    // OMP: same
    expect(existsSync(join(home, ".omp", "agent", "AGENTS.md"))).toBe(true);
    expect(existsSync(join(home, ".omp", "commands"))).toBe(false);
    expect(existsSync(join(home, ".omp", "skills"))).toBe(false);
  });

  it("Claude gets bootstrap + commands + skills", () => {
    const { repo, home } = setupFixtures();

    install({ source: repo, home });

    // Bootstrap (renamed to CLAUDE.md)
    const claudeBootstrap = join(home, ".claude", "CLAUDE.md");
    expect(existsSync(claudeBootstrap)).toBe(true);
    expect(readlinkSync(claudeBootstrap)).toBe(
      join(repo, "GLOBAL_OR_PROJECT-AGENTS.md"),
    );

    // Commands
    expect(readlinkSync(join(home, ".claude", "commands", "b-build.md"))).toBe(
      join(repo, "prompts", "b-build.md"),
    );
    expect(readlinkSync(join(home, ".claude", "commands", "b-plan.md"))).toBe(
      join(repo, "prompts", "b-plan.md"),
    );

    // Skills
    expect(
      readlinkSync(join(home, ".claude", "skills", "b-build")),
    ).toBe(join(repo, "skills", "b-build"));
    expect(
      readlinkSync(join(home, ".claude", "skills", "b-plan")),
    ).toBe(join(repo, "skills", "b-plan"));
  });

  it("Grok Build gets bootstrap + commands + skills", () => {
    const { repo, home } = setupFixtures();

    install({ source: repo, home, harnessIds: ["grok"] });

    const grokBootstrap = join(home, ".grok", "rules", "buck-workflow.md");
    expect(existsSync(grokBootstrap)).toBe(true);
    expect(readlinkSync(grokBootstrap)).toBe(
      join(repo, "GLOBAL_OR_PROJECT-AGENTS.md"),
    );

    expect(readlinkSync(join(home, ".grok", "commands", "b-build.md"))).toBe(
      join(repo, "prompts", "b-build.md"),
    );
    expect(readlinkSync(join(home, ".grok", "commands", "b-plan.md"))).toBe(
      join(repo, "prompts", "b-plan.md"),
    );

    expect(readlinkSync(join(home, ".grok", "skills", "b-build"))).toBe(
      join(repo, "skills", "b-build"),
    );
    expect(readlinkSync(join(home, ".grok", "skills", "b-plan"))).toBe(
      join(repo, "skills", "b-plan"),
    );
  });

  it("ZCode gets bootstrap + per-skill links (no commands)", () => {
    const { repo, home } = setupFixtures();

    const result = install({ source: repo, home, harnessIds: ["zcode"] });

    const zcodeBootstrap = join(home, ".zcode", "AGENTS.md");
    expect(existsSync(zcodeBootstrap)).toBe(true);
    expect(readlinkSync(zcodeBootstrap)).toBe(
      join(repo, "GLOBAL_OR_PROJECT-AGENTS.md"),
    );

    expect(readlinkSync(join(home, ".zcode", "skills", "b-build"))).toBe(
      join(repo, "skills", "b-build"),
    );
    expect(readlinkSync(join(home, ".zcode", "skills", "b-plan"))).toBe(
      join(repo, "skills", "b-plan"),
    );
    expect(existsSync(join(home, ".zcode", "commands"))).toBe(false);
    expect(result.exitCode).toBe(0);
  });

  it("dryRun reports actions but writes nothing", () => {
    const { repo, home } = setupFixtures();

    const result = install({ source: repo, home, dryRun: true });

    expect(result.exitCode).toBe(0);
    // Nothing should be created
    expect(existsSync(join(home, ".pi", "agent", "AGENTS.md"))).toBe(false);
    expect(existsSync(join(home, ".claude", "CLAUDE.md"))).toBe(false);
    // But results should report planned actions
    expect(result.results.length).toBeGreaterThan(0);
  });

  it("idempotent: second run reports all skipped", () => {
    const { repo, home } = setupFixtures();

    install({ source: repo, home });
    const result2 = install({ source: repo, home });

    const actions = result2.results.map((r) => r.action);
    expect(actions.every((a) => a === "skipped")).toBe(true);
    expect(result2.exitCode).toBe(0);
  });

  it("returns exitCode 1 when zero harnesses detected", () => {
    const repo = join(TEST_ROOT, "repo");
    const home = join(TEST_ROOT, "empty-home");
    mkdirSync(join(repo, "prompts"), { recursive: true });
    mkdirSync(home, { recursive: true });
    writeFileSync(join(repo, "GLOBAL_OR_PROJECT-AGENTS.md"), "# Bootstrap\n");

    const result = install({ source: repo, home });

    expect(result.exitCode).toBe(1);
  });

  it("limits to --harness filter", () => {
    const { repo, home } = setupFixtures();

    const result = install({ source: repo, home, harnessIds: ["pi"] });

    // Only Pi should be wired
    expect(existsSync(join(home, ".pi", "agent", "AGENTS.md"))).toBe(true);
    expect(existsSync(join(home, ".omp", "agent", "AGENTS.md"))).toBe(false);
    expect(existsSync(join(home, ".claude", "CLAUDE.md"))).toBe(false);
    expect(result.exitCode).toBe(0);
  });

  it("reports a copied bootstrap as a copy, not a generic conflict", () => {
    const { repo, home } = setupFixtures();
    writeFileSync(join(home, ".pi", "agent", "AGENTS.md"), "# stale copy\n");

    const result = install({ source: repo, home, harnessIds: ["pi"] });
    const pi = result.results[0];

    expect(pi.action).toBe("conflict");
    expect(pi.message).toContain("Copied bootstrap detected");
    expect(pi.message).toContain("--force");
    expect(result.exitCode).toBe(1);
  });

  it("marks a relink from another checkout as cross-root", () => {
    const { repo, home } = setupFixtures();
    const repoB = join(TEST_ROOT, "repoB");
    mkdirSync(repoB, { recursive: true });
    writeFileSync(join(repoB, "GLOBAL_OR_PROJECT-AGENTS.md"), "# B\n");
    mkdirSync(join(home, ".pi", "agent"), { recursive: true });
    symlinkSync(
      join(repoB, "GLOBAL_OR_PROJECT-AGENTS.md"),
      join(home, ".pi", "agent", "AGENTS.md"),
    );

    const result = install({ source: repo, home, harnessIds: ["pi"] });
    const pi = result.results[0];

    expect(pi.action).toBe("replaced");
    expect(pi.crossRoot).toBe(true);
    expect(pi.oldRoot).toBe(repoB);
  });
});

// ---------------------------------------------------------------------------
// parseArgs
// ---------------------------------------------------------------------------
describe("parseArgs", () => {
  it("returns defaults with no args", () => {
    const args = parseArgs([]);
    expect(args).toEqual({
      dryRun: false,
      force: false,
      source: null,
      harnessIds: null,
      list: false,
      verify: false,
      help: false,
    });
  });

  it("parses --verify", () => {
    expect(parseArgs(["--verify"]).verify).toBe(true);
  });

  it("parses --dry-run", () => {
    expect(parseArgs(["--dry-run"]).dryRun).toBe(true);
  });

  it("parses --force", () => {
    expect(parseArgs(["--force"]).force).toBe(true);
  });

  it("parses --source <path>", () => {
    expect(parseArgs(["--source", "/foo/bar"]).source).toBe("/foo/bar");
  });

  it("parses --harness ids (comma-separated)", () => {
    expect(parseArgs(["--harness", "pi,claude"]).harnessIds).toEqual([
      "pi",
      "claude",
    ]);
  });

  it("parses --list", () => {
    expect(parseArgs(["--list"]).list).toBe(true);
  });

  it("parses --help", () => {
    expect(parseArgs(["--help"]).help).toBe(true);
  });

  it("parses combined flags", () => {
    const args = parseArgs(["--dry-run", "--force", "--harness", "opencode"]);
    expect(args).toMatchObject({
      dryRun: true,
      force: true,
      harnessIds: ["opencode"],
    });
  });
});

// ---------------------------------------------------------------------------
// isInsideRoot
// ---------------------------------------------------------------------------
describe("isInsideRoot", () => {
  it("treats the root itself as inside", () => {
    expect(isInsideRoot("/x/repo", "/x/repo")).toBe(true);
  });

  it("accepts a path under the root", () => {
    expect(isInsideRoot("/x/repo/skills/b-plan", "/x/repo")).toBe(true);
  });

  it("rejects a sibling that shares the root's name prefix", () => {
    expect(isInsideRoot("/x/repo-old/skills/b-plan", "/x/repo")).toBe(false);
  });

  it("normalizes both paths before comparing", () => {
    expect(isInsideRoot("/x/repo/../repo/prompts", "/x/repo")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// ensureSymlink — source-root awareness
// ---------------------------------------------------------------------------
describe("ensureSymlink source-root awareness", () => {
  beforeEach(() => mkdirSync(TEST_ROOT, { recursive: true }));
  afterEach(() => rmSync(TEST_ROOT, { recursive: true, force: true }));

  const BOOTSTRAP = "GLOBAL_OR_PROJECT-AGENTS.md";

  /** Create a repo fixture with a bootstrap file, return its root. */
  function makeRepo(name) {
    const root = join(TEST_ROOT, name);
    mkdirSync(root, { recursive: true });
    writeFileSync(join(root, BOOTSTRAP), `# ${name}\n`);
    return root;
  }

  it("does not flag a stale link that still points inside the same source root", () => {
    const root = makeRepo("repoA");
    writeFileSync(join(root, "OLD-BOOTSTRAP.md"), "# old\n");
    const dest = join(TEST_ROOT, "home", "AGENTS.md");

    ensureSymlink(join(root, "OLD-BOOTSTRAP.md"), dest, {});
    const res = ensureSymlink(join(root, BOOTSTRAP), dest, {
      sourceRoot: root,
      relPath: BOOTSTRAP,
    });

    expect(res.action).toBe("replaced");
    expect(res.crossRoot).toBeFalsy();
  });

  it("flags a link resolving to a different source root and names both roots", () => {
    const rootA = makeRepo("repoA");
    const rootB = makeRepo("repoB");
    const dest = join(TEST_ROOT, "home", "AGENTS.md");

    ensureSymlink(join(rootB, BOOTSTRAP), dest, {});
    const res = ensureSymlink(join(rootA, BOOTSTRAP), dest, {
      sourceRoot: rootA,
      relPath: BOOTSTRAP,
    });

    expect(res.action).toBe("replaced");
    expect(res.crossRoot).toBe(true);
    expect(res.oldRoot).toBe(rootB);
    expect(res.message).toContain(rootB);
    expect(res.message).toContain(rootA);
    expect(readlinkSync(dest)).toBe(join(rootA, BOOTSTRAP));
  });

  it("resolves a relative link target before classifying it", () => {
    const rootA = makeRepo("repoA");
    const rootB = makeRepo("repoB");
    const dest = join(TEST_ROOT, "home", "AGENTS.md");
    mkdirSync(join(TEST_ROOT, "home"), { recursive: true });
    symlinkSync(join("..", "repoB", BOOTSTRAP), dest);

    const res = ensureSymlink(join(rootA, BOOTSTRAP), dest, {
      sourceRoot: rootA,
      relPath: BOOTSTRAP,
    });

    expect(res.crossRoot).toBe(true);
    expect(res.oldRoot).toBe(rootB);
  });

  it("keeps the original behavior when no sourceRoot is supplied", () => {
    const rootA = makeRepo("repoA");
    const rootB = makeRepo("repoB");
    const dest = join(TEST_ROOT, "home", "AGENTS.md");

    ensureSymlink(join(rootB, BOOTSTRAP), dest, {});
    const res = ensureSymlink(join(rootA, BOOTSTRAP), dest, {});

    expect(res.action).toBe("replaced");
    expect(res.crossRoot).toBeFalsy();
    expect(res.message).toContain("Replaced stale link");
  });
});

// ---------------------------------------------------------------------------
// verifySurfaces
// ---------------------------------------------------------------------------
describe("verifySurfaces", () => {
  beforeEach(() => mkdirSync(TEST_ROOT, { recursive: true }));
  afterEach(() => rmSync(TEST_ROOT, { recursive: true, force: true }));

  const BOOTSTRAP = "GLOBAL_OR_PROJECT-AGENTS.md";

  /** Every entry under `dir`, with symlink targets, sorted — for write detection. */
  function snapshotTree(dir) {
    const out = [];
    const walk = (d, prefix) => {
      for (const entry of readdirSync(d, { withFileTypes: true })) {
        const full = join(d, entry.name);
        const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isSymbolicLink()) out.push(`${rel} -> ${readlinkSync(full)}`);
        else if (entry.isDirectory()) {
          out.push(`${rel}/`);
          walk(full, rel);
        } else out.push(rel);
      }
    };
    walk(dir, "");
    return out.sort();
  }

  it("reports every surface as linked-here after a clean install", () => {
    const { repo, home } = setupFixtures();
    install({ source: repo, home });

    const result = verifySurfaces({ source: repo, home });

    expect(result.results.length).toBeGreaterThan(0);
    expect(result.results.every((r) => r.state === "linked-here")).toBe(true);
    expect(result.roots).toEqual([repo]);
    expect(result.exitCode).toBe(0);
  });

  it("flags a harness pointed at a second checkout and names both roots", () => {
    const { repo, home } = setupFixtures();
    const repoB = join(TEST_ROOT, "repoB");
    mkdirSync(repoB, { recursive: true });
    writeFileSync(join(repoB, BOOTSTRAP), "# B\n");

    install({ source: repo, home });
    const codexDest = join(home, ".codex", "AGENTS.md");
    unlinkSync(codexDest);
    symlinkSync(join(repoB, BOOTSTRAP), codexDest);

    const result = verifySurfaces({ source: repo, home });
    const codex = result.results.find((r) => r.harness === "codex");

    expect(codex.state).toBe("linked-elsewhere");
    expect(codex.root).toBe(repoB);
    expect(result.roots.slice().sort()).toEqual([repo, repoB].sort());
    expect(result.exitCode).toBe(1);
  });

  it("flags a copied bootstrap as a real file", () => {
    const { repo, home } = setupFixtures();
    writeFileSync(join(home, ".pi", "agent", "AGENTS.md"), "# stale copy\n");

    const result = verifySurfaces({ source: repo, home, harnessIds: ["pi"] });

    expect(result.results).toHaveLength(1);
    expect(result.results[0].state).toBe("real-file");
    expect(result.exitCode).toBe(1);
  });

  it("flags a symlink whose target no longer exists", () => {
    const { repo, home } = setupFixtures();
    install({ source: repo, home, harnessIds: ["pi"] });
    rmSync(join(repo, BOOTSTRAP));

    const result = verifySurfaces({ source: repo, home, harnessIds: ["pi"] });

    expect(result.results[0].state).toBe("dangling");
    expect(result.exitCode).toBe(1);
  });

  it("install repairs a dangling link that verify reported", () => {
    const { repo, home } = setupFixtures();
    const dest = join(home, ".pi", "agent", "AGENTS.md");
    symlinkSync(join(TEST_ROOT, "gone.md"), dest);

    const verified = verifySurfaces({ source: repo, home, harnessIds: ["pi"] });
    expect(verified.results[0].state).toBe("dangling");
    expect(verified.exitCode).toBe(1);

    const result = install({ source: repo, home, harnessIds: ["pi"] });

    expect(result.exitCode).toBe(0);
    expect(readlinkSync(dest)).toBe(join(repo, "GLOBAL_OR_PROJECT-AGENTS.md"));
  });

  it("reports uninstalled surfaces as missing without failing", () => {
    const { repo, home } = setupFixtures();

    const result = verifySurfaces({ source: repo, home });

    expect(result.results.every((r) => r.state === "missing")).toBe(true);
    expect(result.roots).toEqual([]);
    expect(result.exitCode).toBe(0);
  });

  it("writes nothing — no links, no parent directories", () => {
    const { repo, home } = setupFixtures();
    const before = snapshotTree(home);

    verifySurfaces({ source: repo, home });

    expect(snapshotTree(home)).toEqual(before);
  });

  it("honors the harness filter", () => {
    const { repo, home } = setupFixtures();
    install({ source: repo, home });

    const result = verifySurfaces({ source: repo, home, harnessIds: ["pi"] });

    expect(result.results.map((r) => r.harness)).toEqual(["pi"]);
  });
});

// ---------------------------------------------------------------------------
// summarize
// ---------------------------------------------------------------------------
describe("summarize", () => {
  it("counts every action, not just created and skipped", () => {
    const counts = summarize([
      { action: "created" },
      { action: "replaced" },
      { action: "replaced", crossRoot: true },
      { action: "skipped" },
      { action: "skipped" },
      { action: "conflict" },
    ]);

    expect(counts).toEqual({
      created: 1,
      replaced: 2,
      skipped: 2,
      conflict: 1,
      moved: 1,
    });
  });

  it("returns zeros for an empty run", () => {
    expect(summarize([])).toEqual({
      created: 0,
      replaced: 0,
      skipped: 0,
      conflict: 0,
      moved: 0,
    });
  });
});

// ---------------------------------------------------------------------------
// isMainModule
// ---------------------------------------------------------------------------
describe("isMainModule", () => {
  beforeEach(() => mkdirSync(TEST_ROOT, { recursive: true }));
  afterEach(() => rmSync(TEST_ROOT, { recursive: true, force: true }));

  it("matches when the invoked path traverses a symlinked directory", () => {
    const real = join(TEST_ROOT, "realdir");
    mkdirSync(real, { recursive: true });
    const file = join(real, "install.mjs");
    writeFileSync(file, "// script\n");
    const linkDir = join(TEST_ROOT, "linkdir");
    symlinkSync(real, linkDir);

    expect(isMainModule(join(linkDir, "install.mjs"), file)).toBe(true);
  });

  it("does not match a different file", () => {
    expect(isMainModule("/x/a.mjs", "/x/b.mjs")).toBe(false);
  });

  it("returns false when there is no invoked path", () => {
    expect(isMainModule(undefined, "/x/a.mjs")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// CLI command handlers
// ---------------------------------------------------------------------------
describe("CLI handlers", () => {
  let out;

  beforeEach(() => {
    mkdirSync(TEST_ROOT, { recursive: true });
    out = [];
    vi.spyOn(console, "log").mockImplementation((...a) => out.push(a.join(" ")));
    vi.spyOn(console, "error").mockImplementation((...a) => out.push(a.join(" ")));
  });
  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(TEST_ROOT, { recursive: true, force: true });
  });

  const text = () => out.join("\n");

  /** Repoint one already-installed destination at a second checkout. */
  function splitOff(home, repoBName, relDest) {
    const repoB = join(TEST_ROOT, repoBName);
    mkdirSync(repoB, { recursive: true });
    writeFileSync(join(repoB, "GLOBAL_OR_PROJECT-AGENTS.md"), "# B\n");
    const dest = join(home, relDest);
    mkdirSync(dirname(dest), { recursive: true });
    if (existsSync(dest)) unlinkSync(dest);
    symlinkSync(join(repoB, "GLOBAL_OR_PROJECT-AGENTS.md"), dest);
    return repoB;
  }

  it("verify succeeds on a single-root install", () => {
    const { repo, home } = setupFixtures();
    install({ source: repo, home });

    expect(runVerify({ harnessIds: null }, home, repo)).toBe(0);
    expect(text()).toContain("Source roots in use: 1");
  });

  it("verify fails with a split verdict naming the foreign root", () => {
    const { repo, home } = setupFixtures();
    install({ source: repo, home });
    const repoB = splitOff(home, "repoB", ".codex/AGENTS.md");

    expect(runVerify({ harnessIds: null }, home, repo)).toBe(1);
    expect(text()).toContain("Source roots in use: 2");
    expect(text()).toContain("Split detected");
    expect(text()).toContain(repoB);
  });

  it("verify fails on a copied bootstrap and says it is a copy", () => {
    const { repo, home } = setupFixtures();
    writeFileSync(join(home, ".pi", "agent", "AGENTS.md"), "# copy\n");

    expect(runVerify({ harnessIds: ["pi"] }, home, repo)).toBe(1);
    expect(text()).toContain("real file");
  });

  it("install reports how many destinations moved between roots", () => {
    const { repo, home } = setupFixtures();
    const repoB = splitOff(home, "repoB", ".pi/agent/AGENTS.md");

    const code = runInstall({ harnessIds: ["pi"] }, home, repo);

    expect(code).toBe(0);
    expect(text()).toContain(repoB);
    expect(text()).toContain("1 moved from another source root");
  });

  it("both commands fail when no harness is installed", () => {
    const { repo } = setupFixtures();
    const home = join(TEST_ROOT, "empty-home");
    mkdirSync(home, { recursive: true });

    expect(runVerify({ harnessIds: null }, home, repo)).toBe(1);
    expect(runInstall({ harnessIds: null }, home, repo)).toBe(1);
  });

  it("list reports the source the links would resolve from", () => {
    const { repo, home } = setupFixtures();

    expect(runList(home, repo)).toBe(0);
    expect(text()).toContain(repo);
  });
});

// ---------------------------------------------------------------------------
// CLI end-to-end — the script must actually run when invoked
// ---------------------------------------------------------------------------
describe("CLI entry point", () => {
  beforeEach(() => mkdirSync(TEST_ROOT, { recursive: true }));
  afterEach(() => rmSync(TEST_ROOT, { recursive: true, force: true }));

  const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "install.mjs");

  it("runs when invoked through a symlinked directory", () => {
    // Regression guard: comparing argv[1] to import.meta.url without
    // resolving real paths made the CLI exit 0 having done nothing.
    const linkDir = join(TEST_ROOT, "linked-scripts");
    symlinkSync(dirname(SCRIPT), linkDir);
    const { home } = setupFixtures();

    const proc = spawnSync(process.execPath, [join(linkDir, "install.mjs"), "--list"], {
      env: { ...process.env, HOME: home },
      encoding: "utf8",
    });

    expect(proc.status).toBe(0);
    expect(proc.stdout).toContain("Detected harnesses");
  });
});
