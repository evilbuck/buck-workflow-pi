import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import {
  cachedBaseStatus,
  clearBaseCache,
  continueRebase,
  listBaseCandidates,
  listConflictPaths,
  pushBranchIfAhead,
  readBaseCache,
  readOid,
  readRemoteOid,
  rebaseInProgress,
  startRebase,
  writeBaseCache,
} from "./pr-git.js";
const env = {
  ...process.env,
  GIT_AUTHOR_NAME: "t",
  GIT_AUTHOR_EMAIL: "t@t",
  GIT_COMMITTER_NAME: "t",
  GIT_COMMITTER_EMAIL: "t@t",
};

function git(dir: string, args: string[]): string {
  return execFileSync("git", args, { cwd: dir, encoding: "utf-8", env, stdio: ["pipe", "pipe", "pipe"] });
}

function makeRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), "pr-git-"));
  git(dir, ["init", "-q", "-b", "main"]);
  execFileSync("git", ["config", "user.email", "t@t"], { cwd: dir });
  execFileSync("git", ["config", "user.name", "t"], { cwd: dir });
  writeFileSync(join(dir, "README.md"), "# test\n");
  git(dir, ["add", "-A"]);
  git(dir, ["commit", "-qm", "init"]);
  git(dir, ["checkout", "-q", "-b", "feature/x"]);
  return dir;
}

describe("pr-git cache", () => {
  it("reports miss, hit, and mismatch against .git/b-pr-base", () => {
    const dir = makeRepo();
    try {
      expect(cachedBaseStatus(dir)).toBe("miss");
      expect(cachedBaseStatus(dir, "main")).toBe("miss");
      writeBaseCache(dir, "main");
      expect(readBaseCache(dir)).toBe("main");
      expect(cachedBaseStatus(dir, "main")).toBe("hit");
      expect(cachedBaseStatus(dir, "develop")).toBe("mismatch");
      const stored = readFileSync(join(dir, ".git", "b-pr-base"), "utf-8");
      expect(stored).toBe("main\n");
      clearBaseCache(dir);
      expect(readBaseCache(dir)).toBeNull();
      expect(cachedBaseStatus(dir)).toBe("miss");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });


  it("does not mutate git history while listing candidates on a cache miss", () => {
    const dir = makeRepo();
    try {
      const head = readOid(dir, "HEAD");
      const candidates = listBaseCandidates(dir, "main");
      expect(candidates[0]?.name).toBe("main");
      expect(cachedBaseStatus(dir)).toBe("miss");
      expect(readOid(dir, "HEAD")).toBe(head);
      expect(git(dir, ["status", "--porcelain"]).trim()).toBe("");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("pr-git rebase", () => {
  it("rebases a dirty tree with --autostash and restores local edits", () => {
    const dir = makeRepo();
    try {
      writeFileSync(join(dir, "feature.txt"), "feature\n");
      git(dir, ["add", "feature.txt"]);
      git(dir, ["commit", "-qm", "feature"]);
      git(dir, ["checkout", "-q", "main"]);
      writeFileSync(join(dir, "base.txt"), "base advance\n");
      git(dir, ["add", "base.txt"]);
      git(dir, ["commit", "-qm", "base advance"]);
      git(dir, ["checkout", "-q", "feature/x"]);
      writeFileSync(join(dir, "README.md"), "# test\nWIP local edit\n");

      const result = startRebase(dir, "main");
      expect(result.ok).toBe(true);
      expect(readFileSync(join(dir, "README.md"), "utf-8")).toContain("WIP local edit");
      expect(() => git(dir, ["merge-base", "--is-ancestor", "main", "HEAD"])).not.toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("enumerates conflicts and resumes an in-progress rebase without aborting", () => {
    const dir = makeRepo();
    try {
      writeFileSync(join(dir, "clash.txt"), "feature side\n");
      git(dir, ["add", "clash.txt"]);
      git(dir, ["commit", "-qm", "feature clash"]);
      git(dir, ["checkout", "-q", "main"]);
      writeFileSync(join(dir, "clash.txt"), "main side\n");
      git(dir, ["add", "clash.txt"]);
      git(dir, ["commit", "-qm", "main clash"]);
      git(dir, ["checkout", "-q", "feature/x"]);

      const started = startRebase(dir, "main");
      expect(started.ok).toBe(false);
      expect(started.conflicts).toContain("clash.txt");
      expect(rebaseInProgress(dir)).toBe(true);
      expect(listConflictPaths(dir)).toEqual(["clash.txt"]);

      writeFileSync(join(dir, "clash.txt"), "merged\n");
      git(dir, ["add", "clash.txt"]);
      const continued = continueRebase(dir);
      expect(continued.done).toBe(true);
      expect(rebaseInProgress(dir)).toBe(false);
      expect(readFileSync(join(dir, "clash.txt"), "utf-8")).toBe("merged\n");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("continueRebase is a no-op when idle and stays conflicted if unresolved", () => {
    const dir = makeRepo();
    try {
      expect(continueRebase(dir).done).toBe(true);

      writeFileSync(join(dir, "clash.txt"), "feature side\n");
      git(dir, ["add", "clash.txt"]);
      git(dir, ["commit", "-qm", "feature clash"]);
      git(dir, ["checkout", "-q", "main"]);
      writeFileSync(join(dir, "clash.txt"), "main side\n");
      git(dir, ["add", "clash.txt"]);
      git(dir, ["commit", "-qm", "main clash"]);
      git(dir, ["checkout", "-q", "feature/x"]);
      startRebase(dir, "main");
      const blocked = continueRebase(dir);
      expect(blocked.done).toBe(false);
      expect(blocked.conflicts).toContain("clash.txt");
      expect(rebaseInProgress(dir)).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

});

describe("pr-git push", () => {
  it("uses a normal push, lease-protected rewrite, and refuses overwrite without lease", async () => {
    const dir = makeRepo();
    const origin = mkdtempSync(join(tmpdir(), "pr-git-origin-"));
    try {
      execFileSync("git", ["init", "-q", "--bare", origin]);
      git(dir, ["remote", "add", "origin", origin]);

      expect(await pushBranchIfAhead("feature/x", dir)).toBe(true);
      expect(readRemoteOid(dir, "feature/x")).toBe(readOid(dir, "HEAD"));
      expect(await pushBranchIfAhead("feature/x", dir)).toBe(false);

      writeFileSync(join(dir, "feature.txt"), "changed\n");
      git(dir, ["add", "feature.txt"]);
      git(dir, ["commit", "-qm", "feature"]);
      expect(await pushBranchIfAhead("feature/x", dir)).toBe(true);

      git(dir, ["commit", "--amend", "-qm", "feature rebased"]);
      await expect(pushBranchIfAhead("feature/x", dir)).rejects.toThrow(/refusing to overwrite/);
      expect(await pushBranchIfAhead("feature/x", dir, true)).toBe(true);
      expect(readRemoteOid(dir, "feature/x")).toBe(readOid(dir, "HEAD"));
    } finally {
      rmSync(dir, { recursive: true, force: true });
      rmSync(origin, { recursive: true, force: true });
    }
  });

  it("never emits --force without lease", () => {
    const src = readFileSync(new URL("./pr-git.ts", import.meta.url), "utf-8");
    expect(src).not.toMatch(/"--force"(?!-with-lease)/);
    expect(src).toContain("--force-with-lease");
  });
});
