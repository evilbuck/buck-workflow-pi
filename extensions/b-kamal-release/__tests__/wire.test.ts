import { describe, it, expect, vi } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import {
  parseArgs,
  parseSemver,
  bumpSemver,
  formatSemver,
  detectDefaultBump,
  proposeVersion,
  detectKamalEnv,
  isDirty,
  dirtySummary,
  latestTag,
  commitsSince,
  tagExists,
  wire,
  runKamalRelease,
} from "../index.js";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

// ---------- pure logic ----------

describe("parseArgs", () => {
  it("parses all flags and ignores unknown --bump values", () => {
    const o = parseArgs("--tag 1.2.3 --bump minor -d production --allow-dirty --skip-tag --no-push --no-version --force --dry-run");
    expect(o).toEqual({
      tag: "1.2.3",
      bump: "minor",
      destination: "production",
      allowDirty: true,
      skipTag: true,
      noPush: true,
      noVersion: true,
      force: true,
      dryRun: true,
    });
  });

  it("accepts --destination long form", () => {
    expect(parseArgs("--destination staging").destination).toBe("staging");
  });

  it("rejects an invalid --bump", () => {
    expect(parseArgs("--bump huge").bump).toBeUndefined();
  });

  it("defaults", () => {
    const o = parseArgs("");
    expect(o.allowDirty).toBe(false);
    expect(o.tag).toBeUndefined();
  });
  it("does not let a value-flag eat a following flag (--tag --release)", () => {
    expect(parseArgs("--tag --release").tag).toBeUndefined();
    expect(parseArgs("--tag").tag).toBeUndefined();
    expect(parseArgs("--destination --no-push").destination).toBeUndefined();
  });

});

describe("semver", () => {
  it("parses v-prefixed and prerelease tags", () => {
    expect(parseSemver("v1.2.3")).toEqual({ major: 1, minor: 2, patch: 3 });
    expect(parseSemver("1.2.3-rc.1")).toEqual({ major: 1, minor: 2, patch: 3 });
    expect(parseSemver("not-a-version")).toBeNull();
  });

  it("bumps independently of prefix", () => {
    const base = parseSemver("v1.2.3")!;
    expect(bumpSemver(base, "patch")).toEqual({ major: 1, minor: 2, patch: 4 });
    expect(bumpSemver(base, "minor")).toEqual({ major: 1, minor: 3, patch: 0 });
    expect(bumpSemver(base, "major")).toEqual({ major: 2, minor: 0, patch: 0 });
  });

  it("formatSemver applies prefix", () => {
    expect(formatSemver({ major: 0, minor: 1, patch: 0 }, "v")).toBe("v0.1.0");
    expect(formatSemver({ major: 0, minor: 1, patch: 0 }, "")).toBe("0.1.0");
  });
});

describe("detectDefaultBump", () => {
  it("first release defaults to minor", () => {
    expect(detectDefaultBump([])).toBe("minor");
  });

  it("BREAKING CHANGE / bang-colon → major", () => {
    expect(detectDefaultBump(["feat: x", "BREAKING CHANGE: drops api"])).toBe("major");
    expect(detectDefaultBump(["refactor(api)!: rewrite"])).toBe("major");
  });

  it("feat: → minor", () => {
    expect(detectDefaultBump(["feat: add thing", "fix: a bug"])).toBe("minor");
    expect(detectDefaultBump(["feat(scope): add thing"])).toBe("minor");
  });

  it("everything else → patch", () => {
    expect(detectDefaultBump(["fix: a bug", "docs: readme"])).toBe("patch");
  });
});

describe("proposeVersion", () => {
  it("bumps from latest tag and preserves prefix", () => {
    const p = proposeVersion("v1.2.3", ["fix: a bug"]);
    expect(p.bump).toBe("patch");
    expect(p.tag).toBe("v1.2.4");
    expect(p.prefix).toBe("v");
    expect(p.minor).toBe("v1.3.0");
    expect(p.major).toBe("v2.0.0");
  });

  it("first release proposes 0.1.0 with no prefix", () => {
    const p = proposeVersion(null, ["feat: initial"]);
    expect(p.tag).toBe("0.1.0");
    expect(p.prefix).toBe("");
    expect(p.latest).toBeNull();
  });

  it("respects explicit bump override", () => {
    const p = proposeVersion("v1.2.3", ["fix: a bug"], "major");
    expect(p.tag).toBe("v2.0.0");
    expect(p.bump).toBe("major");
  });

  it("unprefixed latest yields unprefixed next", () => {
    const p = proposeVersion("2.0.0", ["feat: x"]);
    expect(p.tag).toBe("2.1.0");
  });
});

// ---------- kamal env detection (filesystem) ----------

describe("detectKamalEnv", () => {
  it("reports unconfigured when no deploy.yml", () => {
    const dir = mkdtempSync(join(tmpdir(), "kamal-env-"));
    try {
      const env = detectKamalEnv(dir);
      expect(env.configured).toBe(false);
      expect(env.destinations).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("detects destinations from deploy.<name>.yml", () => {
    const dir = mkdtempSync(join(tmpdir(), "kamal-env-"));
    try {
      mkdirSync(join(dir, "config"));
      writeFileSync(join(dir, "config", "deploy.yml"), "service: app\n");
      writeFileSync(join(dir, "config", "deploy.staging.yml"), "x: 1\n");
      writeFileSync(join(dir, "config", "deploy.production.yml"), "x: 1\n");
      writeFileSync(join(dir, "config", "deploy.yaml"), "x: 1\n"); // alt ext for main only
      const env = detectKamalEnv(dir);
      expect(env.configured).toBe(true);
      expect(env.destinations).toEqual(["production", "staging"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---------- git helpers against a throwaway repo ----------

function makeRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), "kamal-rel-"));
  const env = { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" };
  const g = (a: string[]) => execFileSync("git", a, { cwd: dir, encoding: "utf-8", env, stdio: ["pipe", "pipe", "pipe"] });
  g(["init", "-q", "-b", "main"]);
  execFileSync("git", ["config", "user.email", "t@t"], { cwd: dir });
  execFileSync("git", ["config", "user.name", "t"], { cwd: dir });
  writeFileSync(join(dir, "README.md"), "# test\n");
  g(["add", "-A"]);
  g(["commit", "-qm", "init"]);
  return dir;
}

function makeKamalRepo(destinations: string[] = []): string {
  const dir = makeRepo();
  mkdirSync(join(dir, "config"), { recursive: true });
  writeFileSync(join(dir, "config", "deploy.yml"), "service: app\nimage: app\n");
  for (const d of destinations) writeFileSync(join(dir, "config", `deploy.${d}.yml`), "x: 1\n");
  execFileSync("git", ["add", "-A"], { cwd: dir });
  execFileSync("git", ["commit", "-qm", "add kamal config"], { cwd: dir });
  return dir;
}

describe("git helpers", () => {
  it("latestTag/commitsSince/tagExists track history", () => {
    const dir = makeRepo();
    try {
      expect(latestTag(dir)).toBeNull();
      execFileSync("git", ["tag", "-a", "v1.0.0", "-m", "r"], { cwd: dir });
      writeFileSync(join(dir, "a.txt"), "a\n");
      execFileSync("git", ["add", "-A"], { cwd: dir });
      execFileSync("git", ["commit", "-qm", "feat: add a"], { cwd: dir });
      expect(latestTag(dir)).toBe("v1.0.0");
      expect(commitsSince("v1.0.0", dir)).toEqual(["feat: add a"]);
      expect(tagExists("v1.0.0", dir)).toBe(true);
      expect(tagExists("v9.9.9", dir)).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("isDirty/dirtySummary reflect working tree", () => {
    const dir = makeRepo();
    try {
      expect(isDirty(dir)).toBe(false);
      writeFileSync(join(dir, "b.txt"), "b\n");
      expect(isDirty(dir)).toBe(true);
      const s = dirtySummary(dir);
      expect(s.count).toBe(1);
      expect(s.sample[0]).toContain("b.txt");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---------- wire ----------

function createMockApi(): { api: ExtensionAPI; commands: Map<string, Record<string, unknown>> } {
  const commands = new Map<string, Record<string, unknown>>();
  const api = {
    on: vi.fn(),
    registerCommand: vi.fn((name: string, opts: Record<string, unknown>) => {
      commands.set(name, opts);
    }),
    registerTool: vi.fn(),
  } as unknown as ExtensionAPI;
  return { api, commands };
}

describe("wire", () => {
  it("registers b-kamal-release with handler, description, and flag completions", () => {
    const { api, commands } = createMockApi();
    wire(api);
    expect(commands.has("b-kamal-release")).toBe(true);
    const cmd = commands.get("b-kamal-release") as { handler: Function; description?: string; getArgumentCompletions: (p: string) => Array<{ value: string }> };
    expect(typeof cmd.handler).toBe("function");
    expect(cmd.description).toBeTruthy();
    const longFlags = cmd.getArgumentCompletions("--").map((c) => c.value);
    expect(longFlags).toContain("--tag");
    expect(longFlags).toContain("--allow-dirty");
    expect(longFlags).toContain("--dry-run");
    expect(cmd.getArgumentCompletions("-").map((c) => c.value)).toContain("-d");
  });
});

// ---------- orchestrator deterministic paths ----------


describe("runKamalRelease deterministic paths", () => {
  it("errors when not a git repo", async () => {
    const dir = mkdtempSync(join(tmpdir(), "kamal-nogit-"));
    try {
      const calls: Array<[string, string?]> = [];
      await runKamalRelease("", { cwd: dir, hasUI: false, ui: { notify: (m, l) => calls.push([m, l]) } });
      expect(calls.some(([m, l]) => l === "error" && /not a git repository/i.test(m))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("errors when not a kamal project", async () => {
    const dir = makeRepo();
    try {
      const calls: Array<[string, string?]> = [];
      await runKamalRelease("", { cwd: dir, hasUI: false, ui: { notify: (m, l) => calls.push([m, l]) } });
      expect(calls.some(([m, l]) => l === "error" && /isn't a Kamal project/i.test(m))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("dry-run prints the release plan and does not deploy", async () => {
    const dir = makeKamalRepo();
    try {
      const calls: Array<[string, string?]> = [];
      await runKamalRelease("--tag 1.0.0 --dry-run", { cwd: dir, hasUI: false, ui: { notify: (m, l) => calls.push([m, l]) } });
      const joined = calls.map((c) => c[0]).join("\n");
      expect(joined).toMatch(/Release plan/);
      expect(joined).toMatch(/tag: 1\.0\.0/);
      expect(joined).toMatch(/kamal deploy.*--version=1\.0\.0/);
      expect(joined).toMatch(/\[dry-run\]/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("aborts on a dirty tree when headless and no --allow-dirty", async () => {
    const dir = makeKamalRepo();
    writeFileSync(join(dir, "dirty.txt"), "x\n"); // uncommitted
    try {
      const calls: Array<[string, string?]> = [];
      await runKamalRelease("--tag 1.0.0 --dry-run", { cwd: dir, hasUI: false, ui: { notify: (m, l) => calls.push([m, l]) } });
      expect(calls.some(([m, l]) => l === "warning" && /Aborted/i.test(m))).toBe(true);
      const joined = calls.map((c) => c[0]).join("\n");
      expect(joined).not.toMatch(/Release plan/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("proceeds past dirty tree with --allow-dirty", async () => {
    const dir = makeKamalRepo();
    writeFileSync(join(dir, "dirty.txt"), "x\n");
    try {
      const calls: Array<[string, string?]> = [];
      await runKamalRelease("--tag 1.0.0 --allow-dirty --dry-run", { cwd: dir, hasUI: false, ui: { notify: (m, l) => calls.push([m, l]) } });
      expect(calls.map((c) => c[0]).join("\n")).toMatch(/Release plan/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("errors on ambiguous destination when headless", async () => {
    const dir = makeKamalRepo(["staging", "production"]);
    try {
      const calls: Array<[string, string?]> = [];
      await runKamalRelease("--tag 1.0.0 --dry-run", { cwd: dir, hasUI: false, ui: { notify: (m, l) => calls.push([m, l]) } });
      expect(calls.some(([m, l]) => l === "error" && /Multiple Kamal destinations/i.test(m))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("accepts --destination and --no-version in the dry-run plan", async () => {
    const dir = makeKamalRepo(["staging"]);
    try {
      const calls: Array<[string, string?]> = [];
      await runKamalRelease("--tag 1.0.0 -d staging --no-version --dry-run", { cwd: dir, hasUI: false, ui: { notify: (m, l) => calls.push([m, l]) } });
      const joined = calls.map((c) => c[0]).join("\n");
      expect(joined).toMatch(/kamal deploy -d staging/);
      expect(joined).not.toMatch(/--version=/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
