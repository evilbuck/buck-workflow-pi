import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdirSync,
  rmSync,
  writeFileSync,
  readFileSync,
  existsSync,
  chmodSync,
} from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import {
  HOOK_MARKER,
  resolveHooksDir,
  hooksInstall,
  hooksStatus,
  hooksRemove,
} from "./hooks.mjs";

const ROOT = join("/tmp", "hooks-test-" + process.pid);
const SOURCE = join(ROOT, "buck-workflow");

function git(repo, ...args) {
  return spawnSync("git", ["-C", repo, ...args], { encoding: "utf8" });
}

/** A minimal committed repo with the given extra files ({path: content}). */
function makeRepo(name, files = {}) {
  const repo = join(ROOT, name);
  mkdirSync(repo, { recursive: true });
  git(repo, "init", "-q", "--initial-branch=main");
  git(repo, "config", "user.email", "test@example.com");
  git(repo, "config", "user.name", "Test");
  writeFileSync(join(repo, "README.md"), "# clean\n");
  for (const [path, content] of Object.entries(files)) {
    const target = join(repo, path);
    mkdirSync(join(target, ".."), { recursive: true });
    writeFileSync(target, content);
  }
  git(repo, "add", ".");
  git(repo, "commit", "-qm", "init");
  return repo;
}

// ---------------------------------------------------------------------------
// resolveHooksDir
// ---------------------------------------------------------------------------

describe("resolveHooksDir", () => {
  beforeEach(() => {
    rmSync(ROOT, { recursive: true, force: true });
    mkdirSync(SOURCE, { recursive: true });
  });
  afterEach(() => rmSync(ROOT, { recursive: true, force: true }));

  it("defaults to <git-dir>/hooks", () => {
    const repo = makeRepo("plain");
    const dir = resolveHooksDir(repo);
    expect(dir).toBe(join(repo, ".git", "hooks"));
  });

  it("honours core.hooksPath when set", () => {
    const repo = makeRepo("custom");
    const custom = join(repo, ".githooks");
    mkdirSync(custom, { recursive: true });
    git(repo, "config", "core.hooksPath", ".githooks");
    expect(resolveHooksDir(repo)).toBe(custom);
  });
});

// ---------------------------------------------------------------------------
// install / status / remove lifecycle
// ---------------------------------------------------------------------------

describe("hooks lifecycle", () => {
  beforeEach(() => {
    rmSync(ROOT, { recursive: true, force: true });
    mkdirSync(join(SOURCE, "scripts"), { recursive: true });
    writeFileSync(join(SOURCE, "scripts", "security-audit.sh"), "#!/usr/bin/env bash\nexit 0\n");
  });
  afterEach(() => rmSync(ROOT, { recursive: true, force: true }));

  it("installs a managed pre-push launcher into a hook-less repo", () => {
    const repo = makeRepo("clean");
    const result = hooksInstall({ repo, source: SOURCE, profile: "full" });
    expect(result.ok).toBe(true);

    const hook = join(repo, ".git", "hooks", "pre-push");
    expect(existsSync(hook)).toBe(true);
    const content = readFileSync(hook, "utf8");
    expect(content).toContain(HOOK_MARKER);
    expect(content).toContain(SOURCE);
    // Executable bit set.
    const mode = spawnSync("stat", ["-c", "%a", hook], { encoding: "utf8" });
    expect(mode.stdout.trim()).toBe("755");
  });

  it("reports installed status with source and profile", () => {
    const repo = makeRepo("status");
    hooksInstall({ repo, source: SOURCE, profile: "fast" });
    const status = hooksStatus({ repo });
    expect(status.installed).toBe(true);
    expect(status.source).toBe(SOURCE);
    expect(status.profile).toBe("fast");
    expect(status.hooksDir).toBe(join(repo, ".git", "hooks"));
  });

  it("reinstall is idempotent — content unchanged", () => {
    const repo = makeRepo("idempotent");
    hooksInstall({ repo, source: SOURCE, profile: "full" });
    const hook = join(repo, ".git", "hooks", "pre-push");
    const before = readFileSync(hook, "utf8");
    const mtimeBefore = spawnSync("stat", ["-c", "%Y", hook], { encoding: "utf8" }).stdout;
    const result = hooksInstall({ repo, source: SOURCE, profile: "full" });
    expect(result.ok).toBe(true);
    expect(readFileSync(hook, "utf8")).toBe(before);
    const mtimeAfter = spawnSync("stat", ["-c", "%Y", hook], { encoding: "utf8" }).stdout;
    expect(mtimeAfter).toBe(mtimeBefore);
  });

  it("refuses to overwrite a foreign pre-push and leaves it untouched", () => {
    const repo = makeRepo("foreign");
    const hooksDir = join(repo, ".git", "hooks");
    mkdirSync(hooksDir, { recursive: true });
    const foreign = join(hooksDir, "pre-push");
    const original = "#!/bin/sh\nexec other-audit \"$@\"\n";
    writeFileSync(foreign, original);

    const result = hooksInstall({ repo, source: SOURCE, profile: "full" });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/pre-existing pre-push/i);
    expect(result.reason).toMatch(/--force|chain/i);
    expect(readFileSync(foreign, "utf8")).toBe(original);
  });

  it("installs into a configured core.hooksPath", () => {
    const repo = makeRepo("custompath");
    const custom = join(repo, ".githooks");
    mkdirSync(custom, { recursive: true });
    git(repo, "config", "core.hooksPath", ".githooks");

    const result = hooksInstall({ repo, source: SOURCE, profile: "full" });
    expect(result.ok).toBe(true);
    expect(existsSync(join(custom, "pre-push"))).toBe(true);
    expect(existsSync(join(repo, ".git", "hooks", "pre-push"))).toBe(false);
  });

  it("refuses on a foreign pre-push inside core.hooksPath", () => {
    const repo = makeRepo("customforeign");
    const custom = join(repo, ".githooks");
    mkdirSync(custom, { recursive: true });
    writeFileSync(join(custom, "pre-push"), "#!/bin/sh\nexit 0\n");
    git(repo, "config", "core.hooksPath", ".githooks");

    const result = hooksInstall({ repo, source: SOURCE, profile: "full" });
    expect(result.ok).toBe(false);
    expect(readFileSync(join(custom, "pre-push"), "utf8")).toBe("#!/bin/sh\nexit 0\n");
  });

  it("remove deletes a managed launcher and restores prior state", () => {
    const repo = makeRepo("removal");
    hooksInstall({ repo, source: SOURCE, profile: "full" });
    const hook = join(repo, ".git", "hooks", "pre-push");

    const result = hooksRemove({ repo });
    expect(result.ok).toBe(true);
    expect(existsSync(hook)).toBe(false);
    expect(hooksStatus({ repo }).installed).toBe(false);
  });

  it("remove refuses on a foreign pre-push", () => {
    const repo = makeRepo("removeforeign");
    const hooksDir = join(repo, ".git", "hooks");
    mkdirSync(hooksDir, { recursive: true });
    const foreign = join(hooksDir, "pre-push");
    writeFileSync(foreign, "#!/bin/sh\nexit 0\n");

    const result = hooksRemove({ repo });
    expect(result.ok).toBe(false);
    expect(existsSync(foreign)).toBe(true);
  });

  it("remove is a clean no-op when nothing is installed", () => {
    const repo = makeRepo("removenoop");
    const result = hooksRemove({ repo });
    expect(result.ok).toBe(true);
    expect(result.note).toMatch(/nothing installed/i);
  });
});

// ---------------------------------------------------------------------------
// launcher behavior — exit propagation through the real audit script
// ---------------------------------------------------------------------------

describe("pre-push launcher exit propagation", () => {
  beforeEach(() => {
    rmSync(ROOT, { recursive: true, force: true });
    // SOURCE = this repo's real scripts/ dir (durable audit script).
    mkdirSync(ROOT, { recursive: true });
  });
  afterEach(() => rmSync(ROOT, { recursive: true, force: true }));

  const REAL_SOURCE = join(import.meta.dirname, "..");

  it("a clean repo pushes: launcher exits 0", () => {
    const repo = makeRepo("pushclean");
    const result = hooksInstall({ repo, source: REAL_SOURCE, profile: "fast" });
    expect(result.ok).toBe(true);
    const hook = join(repo, ".git", "hooks", "pre-push");
    chmodSync(hook, 0o755);

    const run = spawnSync("bash", [hook], { encoding: "utf8", cwd: repo });
    expect(run.status).toBe(0);
  }, 120_000);

  it("a seeded finding blocks: launcher exits 1", () => {
    const repo = makeRepo("pushsecret", {
      "creds.txt": "aws_access_key_id = AKIABOGUSKEY123456XY\n",
    });
    const result = hooksInstall({ repo, source: REAL_SOURCE, profile: "fast" });
    expect(result.ok).toBe(true);
    const hook = join(repo, ".git", "hooks", "pre-push");
    chmodSync(hook, 0o755);

    const run = spawnSync("bash", [hook], { encoding: "utf8", cwd: repo });
    expect(run.status).toBe(1);
    expect(run.stdout + run.stderr).toMatch(/AKIA|secret/i);
  }, 120_000);
});

describe("CLI dispatch — node install.mjs hooks …", () => {
  beforeEach(() => rmSync(ROOT, { recursive: true, force: true }));
  afterEach(() => rmSync(ROOT, { recursive: true, force: true }));

  const CLI = join(import.meta.dirname, "install.mjs");

  function cli(...args) {
    return spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8" });
  }

  it("hooks status on a repo without hooks reports not installed (exit 0)", () => {
    const repo = makeRepo("cli-status");
    const proc = cli("hooks", "status", "--repo", repo);
    expect(proc.status).toBe(0);
    expect(proc.stdout).toContain("installed:    false");
  });

  it("hooks install then status round-trips through the CLI", () => {
    const repo = makeRepo("cli-roundtrip");
    const install = cli("hooks", "install", "--repo", repo, "--profile", "fast", "--source", import.meta.dirname + "/..");
    expect(install.status).toBe(0);
    expect(install.stdout).toContain("profile: fast");

    const status = cli("hooks", "status", "--repo", repo);
    expect(status.status).toBe(0);
    expect(status.stdout).toContain("installed:    true");
    expect(status.stdout).toContain("profile:      fast");
  });

  it("hooks install refuses a foreign hook with exit 1 and a chain hint", () => {
    const repo = makeRepo("cli-foreign");
    mkdirSync(join(repo, ".git", "hooks"), { recursive: true });
    writeFileSync(join(repo, ".git", "hooks", "pre-push"), "#!/bin/sh\nexit 0\n");

    const proc = cli("hooks", "install", "--repo", repo);
    expect(proc.status).toBe(1);
    expect(proc.stderr).toMatch(/pre-existing pre-push/);
  });

  it("hooks remove via CLI exits 0 and uninstalls", () => {
    const repo = makeRepo("cli-remove");
    expect(cli("hooks", "install", "--repo", repo, "--source", import.meta.dirname + "/..").status).toBe(0);
    const remove = cli("hooks", "remove", "--repo", repo);
    expect(remove.status).toBe(0);
    expect(cli("hooks", "status", "--repo", repo).stdout).toContain("installed:    false");
  });

  it("unknown hooks action exits 2", () => {
    const repo = makeRepo("cli-bogus");
    const proc = cli("hooks", "explode", "--repo", repo);
    expect(proc.status).toBe(2);
  });
});
