import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import {
  isGitCheckout,
  currentBranch,
  detectBaseBranch,
  fetchBase,
  rebaseOntoFetched,
  continueRebase,
  resolveAndContinue,
  capturePreRun,
  listUntracked,
  checkpointCommit,
  createDetachedWorktree,
  removeWorktree,
  worktreeFingerprint,
  gitCommonDir,
  hasOngoingGitOperation,
  resolveHead,
  git,
} from "../git-ops.js";

const USER_ENV = {
  GIT_AUTHOR_NAME: "t",
  GIT_AUTHOR_EMAIL: "t@t",
  GIT_COMMITTER_NAME: "t",
  GIT_COMMITTER_EMAIL: "t@t",
};

/** origin (bare) + clone with a feature branch; helper `g` runs git in dir. */
function makeOriginClone(): { origin: string; clone: string } {
  const origin = mkdtempSync(join(tmpdir(), "cr-origin-"));
  const clone = mkdtempSync(join(tmpdir(), "cr-clone-"));
  const g = (dir: string, args: string[]) =>
    execFileSync("git", args, { cwd: dir, encoding: "utf-8", env: { ...process.env, ...USER_ENV }, stdio: ["pipe", "pipe", "pipe"] });
  g(origin, ["init", "-q", "--bare", "-b", "master", "."]);
  g(clone, ["init", "-q", "-b", "master", "."]);
  g(clone, ["config", "user.email", "t@t"]);
  g(clone, ["config", "user.name", "t"]);
  writeFileSync(join(clone, "base.txt"), "base\n");
  g(clone, ["add", "-A"]);
  g(clone, ["commit", "-qm", "base"]);
  g(clone, ["remote", "add", "origin", origin]);
  g(clone, ["push", "-q", "-u", "origin", "master"]);
  g(clone, ["branch", "--set-upstream-to=origin/master", "master"]);
  g(clone, ["checkout", "-q", "-b", "feature/x"]);
  writeFileSync(join(clone, "feature.txt"), "feature\n");
  g(clone, ["add", "-A"]);
  g(clone, ["commit", "-qm", "feature work"]);
  return { origin, clone };
}

/** Advance origin/master with a commit touching base.txt. */
function advanceOrigin(origin: string, content: string): void {
  const work = mkdtempSync(join(tmpdir(), "cr-adv-"));
  execFileSync("git", ["clone", "-q", origin, work], { encoding: "utf-8", env: { ...process.env, ...USER_ENV }, stdio: ["pipe", "pipe", "pipe"] });
  appendFileSync(join(work, "base.txt"), content);
  execFileSync("git", ["add", "-A"], { cwd: work });
  execFileSync("git", ["commit", "-qm", "advance"], { cwd: work, env: { ...process.env, ...USER_ENV } });
  execFileSync("git", ["push", "-q", "origin", "master"], { cwd: work, env: { ...process.env, ...USER_ENV }, stdio: ["pipe", "pipe", "pipe"] });
  rmSync(work, { recursive: true, force: true });
}

describe("git-ops", () => {
  let dirs: string[] = [];

  beforeEach(() => {
    dirs = [];
  });

  afterEach(() => {
    for (const dir of dirs) {
      // worktrees must be pruned before their repos can be removed
      try {
        execFileSync("git", ["worktree", "prune"], { cwd: dir, stdio: "ignore" });
      } catch {
        // already gone
      }
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("recognizes checkouts, branches, and the detected base", () => {
    const { origin, clone } = makeOriginClone();
    dirs.push(origin, clone);
    expect(isGitCheckout(clone)).toBe(true);
    expect(isGitCheckout(origin)).toBe(false);
    expect(currentBranch(clone)).toBe("feature/x");
    expect(detectBaseBranch(clone)).toBe("master");
  });

  it("fetches and pins the exact fetched base commit", () => {
    const { origin, clone } = makeOriginClone();
    dirs.push(origin, clone);
    advanceOrigin(origin, "new upstream line\n");
    const fetched = fetchBase(clone, "master");
    expect(fetched.ok).toBe(true);
    expect(fetched.commit).toMatch(/^[0-9a-f]{40}$/);
    const failed = fetchBase(clone, "no-such-branch");
    expect(failed.ok).toBe(false);
    expect(failed.error).toBeTruthy();
  });

  it("rebases onto the fetched commit with autostash preserving dirty work", () => {
    const { origin, clone } = makeOriginClone();
    dirs.push(origin, clone);
    advanceOrigin(origin, "upstream change\n");
    writeFileSync(join(clone, "dirty.txt"), "uncommitted\n");
    expect(fetchBase(clone, "master").ok).toBe(true);
    const result = rebaseOntoFetched(clone);
    expect(result.status).toBe("ok");
    expect(git(clone, ["log", "--oneline"])).toMatch(/advance/);
    expect(git(clone, ["cat-file", "-p", "HEAD:base.txt"])).toContain("upstream change");
    // autostash popped the dirty file back
    expect(listUntracked(clone)).toContain("dirty.txt");
  });

  it("reports conflicts for Fixer routing and continues after resolution", () => {
    const { origin, clone } = makeOriginClone();
    dirs.push(origin, clone);
    // same line diverged on both sides → textual conflict
    writeFileSync(join(clone, "base.txt"), "feature version\n");
    git(clone, ["add", "-A"]);
    execFileSync("git", ["commit", "-qm", "diverge"], { cwd: clone, env: { ...process.env, ...USER_ENV } });
    const work = mkdtempSync(join(tmpdir(), "cr-adv2-"));
    execFileSync("git", ["clone", "-q", origin, work], { encoding: "utf-8", env: { ...process.env, ...USER_ENV }, stdio: ["pipe", "pipe", "pipe"] });
    writeFileSync(join(work, "base.txt"), "origin version\n");
    execFileSync("git", ["add", "-A"], { cwd: work });
    execFileSync("git", ["commit", "-qm", "diverge upstream"], { cwd: work, env: { ...process.env, ...USER_ENV } });
    execFileSync("git", ["push", "-q", "origin", "master"], { cwd: work, env: { ...process.env, ...USER_ENV }, stdio: ["pipe", "pipe", "pipe"] });
    rmSync(work, { recursive: true, force: true });

    expect(fetchBase(clone, "master").ok).toBe(true);
    const conflict = rebaseOntoFetched(clone);
    expect(conflict.status).toBe("conflict");
    expect(conflict.files).toContain("base.txt");
    expect(hasOngoingGitOperation(clone)).toBe(true);

    // simulate the Fixer resolving the file, then deterministic continuation
    writeFileSync(join(clone, "base.txt"), "merged version\n");
    const done = resolveAndContinue(clone, ["base.txt"]);
    expect(done.status).toBe("ok");
    expect(hasOngoingGitOperation(clone)).toBe(false);
    expect(git(clone, ["log", "--oneline", "-3"])).toMatch(/diverge/);
    // No rebase in progress: continuation fails cleanly instead of guessing.
    expect(continueRebase(clone).status).toBe("failed");
  });

  it("captures pre-run state, lists untracked, and checkpoints dirty trees", () => {
    const { origin, clone } = makeOriginClone();
    dirs.push(origin, clone);
    const clean = capturePreRun(clone);
    expect(clean.dirty).toBe(false);
    expect(clean.untracked).toEqual([]);

    writeFileSync(join(clone, "untracked-a.txt"), "a\n");
    writeFileSync(join(clone, "untracked-b.txt"), "b\n");
    appendFileSync(join(clone, "feature.txt"), "more\n");
    const dirty = capturePreRun(clone);
    expect(dirty.dirty).toBe(true);
    expect(dirty.untracked.sort()).toEqual(["untracked-a.txt", "untracked-b.txt"]);

    // exclude untracked-b from the reviewed scope
    const sha = checkpointCommit(clone, ["untracked-a.txt"], "chore(code-review): pre-review checkpoint");
    expect(sha).toBe(resolveHead(clone));
    expect(git(clone, ["show", "--name-only", "--format=", "HEAD"]).split("\n")).toEqual(
      expect.arrayContaining(["feature.txt", "untracked-a.txt"]),
    );
    const after = capturePreRun(clone);
    expect(after.untracked).toEqual(["untracked-b.txt"]);
    expect(checkpointCommit(clone, [], "chore(code-review): empty")).toBeNull();
  });

  it("creates a disposable detached worktree and removes it only when clean", () => {
    const { origin, clone } = makeOriginClone();
    dirs.push(origin, clone);
    const sha = resolveHead(clone);
    const wt = join(tmpdir(), `cr-wt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    const created = createDetachedWorktree(clone, sha, wt);
    expect(created.ok).toBe(true);
    expect(currentBranch(wt)).toBeNull();
    expect(resolveHead(wt)).toBe(sha);
    expect(gitCommonDir(wt)).toBe(gitCommonDir(clone));

    writeFileSync(join(wt, "stray.txt"), "mutation from reproduction\n");
    const retained = removeWorktree(clone, wt);
    expect(retained.ok).toBe(false);
    execFileSync("git", ["clean", "-qfd"], { cwd: wt });
    const removed = removeWorktree(clone, wt);
    expect(removed.ok).toBe(true);
  });

  it("worktree fingerprint reflects head and status", () => {
    const { origin, clone } = makeOriginClone();
    dirs.push(origin, clone);
    const before = worktreeFingerprint(clone);
    writeFileSync(join(clone, "new.txt"), "x\n");
    expect(worktreeFingerprint(clone)).not.toBe(before);
    expect(worktreeFingerprint(clone)).toContain(before.split(":")[0]); // same head
  });
});
