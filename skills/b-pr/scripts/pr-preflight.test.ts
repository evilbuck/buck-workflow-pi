import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

// Direct import is safe: pr-preflight's main body runs only under
// `import.meta.main`, so importing the module never shells out to git.
import { artifactType } from "./pr-preflight";

const SCRIPT = resolve(import.meta.dirname, "pr-preflight.ts");

const SUBJECT = ".context/2026-06-11.b-pr-skill";

describe("artifactType", () => {
  it("classifies each typed artifact prefix", () => {
    expect(artifactType(`${SUBJECT}/plan-foo.md`)).toBe("plan");
    expect(artifactType(`${SUBJECT}/spec-foo.md`)).toBe("spec");
    expect(artifactType(`${SUBJECT}/brainstorm-foo.md`)).toBe("brainstorm");
    expect(artifactType(`${SUBJECT}/research-foo.md`)).toBe("research");
  });

  it("promotes plan files carrying the -phases marker to phase", () => {
    expect(artifactType(`${SUBJECT}/plan-foo-phases.md`)).toBe("phase");
    expect(artifactType(`${SUBJECT}/plan-foo.md`)).not.toBe("phase");
  });

  it("rejects paths outside a dated .context subject folder", () => {
    expect(artifactType("docs/plan-foo.md")).toBeNull();
    expect(artifactType(`${SUBJECT}/../plan-foo.md`)).toBeNull();
    expect(artifactType(".context/plan-foo.md")).toBeNull();
    expect(artifactType(".context/not-a-date/plan-foo.md")).toBeNull();
  });

  it("rejects untyped or non-markdown files", () => {
    expect(artifactType(`${SUBJECT}/notes.md`)).toBeNull();
    expect(artifactType(`${SUBJECT}/plan-foo.txt`)).toBeNull();
    expect(artifactType(`${SUBJECT}/nested/research-foo.md`)).toBeNull();
  });
});

// ---------- end-to-end characterization over the real script ----------
//
// These pin the contract b-pr-improved's extension and the skill prose both
// depend on: exit codes (0 candidates/success, 1 die, 2 dry-run rebase
// required, 3 rebase conflict) and the JSON each path prints on stdout.

const REPO_DIRS: string[] = [];
afterAll(() => {
  for (const dir of REPO_DIRS) rmSync(dir, { recursive: true, force: true });
});

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: "t",
  GIT_AUTHOR_EMAIL: "t@t",
  GIT_COMMITTER_NAME: "t",
  GIT_COMMITTER_EMAIL: "t@t",
};

/** Throwaway repo: one commit on `main`, checked-out `feature/x`. */
function makeRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), "pr-preflight-"));
  REPO_DIRS.push(dir);
  const g = (a: string[]) => execFileSync("git", a, { cwd: dir, encoding: "utf-8", env: GIT_ENV, stdio: ["pipe", "pipe", "pipe"] });
  g(["init", "-q", "-b", "main"]);
  writeFileSync(join(dir, "README.md"), "# test\n");
  g(["add", "-A"]);
  g(["commit", "-qm", "init"]);
  g(["checkout", "-q", "-b", "feature/x"]);
  return dir;
}

function g(dir: string, a: string[]): string {
  return execFileSync("git", a, { cwd: dir, encoding: "utf-8", env: GIT_ENV, stdio: ["pipe", "pipe", "pipe"] });
}

/** Advance main with a commit touching `file`, then return to feature/x. */
function advanceBase(dir: string, file: string, content: string): void {
  g(dir, ["checkout", "-q", "main"]);
  writeFileSync(join(dir, file), content);
  g(dir, ["add", "-A"]);
  g(dir, ["commit", "-qm", "base advance"]);
  g(dir, ["checkout", "-q", "feature/x"]);
}

type Run = { code: number; json: Record<string, unknown> | null; stderr: string };

function runPreflight(dir: string, args: string[]): Run {
  const r = spawnSync("bun", [SCRIPT, ...args], { cwd: dir, encoding: "utf-8", env: GIT_ENV });
  let json: Record<string, unknown> | null = null;
  try {
    json = r.stdout.trim() ? (JSON.parse(r.stdout) as Record<string, unknown>) : null;
  } catch {
    json = null;
  }
  return { code: r.status ?? -1, json, stderr: r.stderr };
}

describe("pr-preflight exit paths", () => {
  it("cache miss without --base lists candidates and exits 0", () => {
    const dir = makeRepo();
    const r = runPreflight(dir, []);
    expect(r.code).toBe(0);
    expect(r.json).not.toBeNull();
    expect(r.json!.base_source).toBe("candidates");
    expect(JSON.stringify(r.json!.base_candidates)).toContain("main");
  });

  it("--base with no value falls back to candidates", () => {
    const dir = makeRepo();
    const r = runPreflight(dir, ["--base"]);
    expect(r.code).toBe(0);
    expect(r.json!.base_source).toBe("candidates");
  });

  it("--base flag resolves, reports flag source, and caches the choice", () => {
    const dir = makeRepo();
    const r = runPreflight(dir, ["--base", "main"]);
    expect(r.code).toBe(0);
    expect(r.json!.chosen_base).toBe("main");
    expect(r.json!.base_source).toBe("flag");
    expect(existsSync(join(dir, ".git", "b-pr-base"))).toBe(true);
  });

  it("a live cached base is trusted on later runs", () => {
    const dir = makeRepo();
    writeFileSync(join(dir, ".git", "b-pr-base"), "main\n");
    const r = runPreflight(dir, []);
    expect(r.code).toBe(0);
    expect(r.json!.base_source).toBe("cache");
    expect(r.json!.chosen_base).toBe("main");
  });

  it("a stale cached base is dropped and candidates fall back", () => {
    const dir = makeRepo();
    const cache = join(dir, ".git", "b-pr-base");
    writeFileSync(cache, "gone-branch\n");
    const r = runPreflight(dir, []);
    expect(r.code).toBe(0);
    expect(r.json!.base_source).toBe("candidates");
    expect(existsSync(cache)).toBe(false);
  });

  it("an unknown base dies listing the candidates", () => {
    const dir = makeRepo();
    const r = runPreflight(dir, ["--base", "bogus"]);
    expect(r.code).toBe(1);
    expect(String(r.json!.error)).toContain("not found among candidates");
  });

  it("a non-candidate branch that exists is accepted as the base", () => {
    const dir = makeRepo();
    g(dir, ["branch", "scratch"]);
    const r = runPreflight(dir, ["--base", "scratch"]);
    expect(r.code).toBe(0);
    expect(r.json!.chosen_base).toBe("scratch");
  });

  it("dry-run reports the rebase requirement without mutating", () => {
    const dir = makeRepo();
    advanceBase(dir, "base.txt", "base advance\n");
    const r = runPreflight(dir, ["--base", "main", "--dry-run"]);
    expect(r.code).toBe(2);
    expect(r.json!.needs_rebase).toBe(true);
    expect(String(r.json!.error)).toContain("Rebase required");
    // No mutation: the feature tip must not have moved onto advanced main.
    expect(() => g(dir, ["merge-base", "--is-ancestor", "main", "HEAD"])).toThrow();
  });

  it("a rebase conflict exits 3 naming the conflicted files", () => {
    const dir = makeRepo();
    // Same file divergently edited on both sides guarantees a text conflict.
    advanceBase(dir, "README.md", "# base edit\n");
    writeFileSync(join(dir, "README.md"), "# feature edit\n");
    g(dir, ["add", "-A"]);
    g(dir, ["commit", "-qm", "feature edit"]);
    const r = runPreflight(dir, ["--base", "main"]);
    expect(r.code).toBe(3);
    expect(r.json!.rebase_conflict).toBe(true);
    expect(JSON.stringify(r.json!.conflicted_files)).toContain("README.md");
    expect(String(r.json!.error)).toContain("git rebase --continue");
  });

  it("a clean rebase replays the feature commits and reports rebased", () => {
    const dir = makeRepo();
    writeFileSync(join(dir, "feature.txt"), "feature\n");
    g(dir, ["add", "-A"]);
    g(dir, ["commit", "-qm", "feature"]);
    advanceBase(dir, "base.txt", "base advance\n");
    const r = runPreflight(dir, ["--base", "main"]);
    expect(r.code).toBe(0);
    expect(r.json!.rebased).toBe(true);
    expect(r.json!.behind_count).toBe(0);
    expect(() => g(dir, ["merge-base", "--is-ancestor", "main", "HEAD"])).not.toThrow();
  });
});
