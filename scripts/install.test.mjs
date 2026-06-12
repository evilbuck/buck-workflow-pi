import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdirSync,
  rmSync,
  writeFileSync,
  existsSync,
  readlinkSync,
  readFileSync,
  symlinkSync,
} from "node:fs";
import { join } from "node:path";
import {
  HARNESSES,
  ensureSymlink,
  detectHarnesses,
  install,
  parseArgs,
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

  // Home: all 6 harness dirs detected
  mkdirSync(join(home, ".pi", "agent"), { recursive: true });
  mkdirSync(join(home, ".omp", "agent"), { recursive: true });
  mkdirSync(join(home, ".claude"), { recursive: true });
  mkdirSync(join(home, ".codex"), { recursive: true });
  mkdirSync(join(home, ".config", "opencode"), { recursive: true });
  mkdirSync(join(home, ".cursor"), { recursive: true });

  return { repo, home };
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------
describe("HARNESSES registry", () => {
  it("has 6 harness entries", () => {
    expect(HARNESSES).toHaveLength(6);
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

  it("detects all six when all dirs present", () => {
    const home = join(TEST_ROOT, "home");
    mkdirSync(join(home, ".pi", "agent"), { recursive: true });
    mkdirSync(join(home, ".omp", "agent"), { recursive: true });
    mkdirSync(join(home, ".claude"), { recursive: true });
    mkdirSync(join(home, ".codex"), { recursive: true });
    mkdirSync(join(home, ".config", "opencode"), { recursive: true });
    mkdirSync(join(home, ".cursor"), { recursive: true });

    const detected = detectHarnesses(home);

    expect(detected).toHaveLength(6);
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
      help: false,
    });
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
