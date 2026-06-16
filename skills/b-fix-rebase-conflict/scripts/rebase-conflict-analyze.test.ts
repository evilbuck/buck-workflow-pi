import { afterEach, describe, expect, test } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const tempDirs: string[] = [];
const scriptPath = join(import.meta.dirname, "rebase-conflict-analyze.ts");

interface AnalyzeOutput {
  operation: "merge" | "rebase";
  sideSemantics: {
    ours: string;
    theirs: string;
  };
  conflictedFiles: Array<{
    path: string;
    hunks: Array<{
      oursLabel: string;
      theirsLabel: string;
      oursContent: string;
      theirsContent: string;
    }>;
    oursCommits: Array<{ subject: string }>;
    theirsCommits: Array<{ subject: string }>;
  }>;
  contextArtifacts: Array<{
    type: string;
    title?: string;
    goal?: string;
    topics: string[];
  }>;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

function runGit(repo: string, args: string[]): string {
  return execFileSync("git", ["-C", repo, ...args], {
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
  }).trim();
}

function makeRepo(prefix: string): string {
  const repo = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(repo);
  runGit(repo, ["init", "-q"]);
  runGit(repo, ["config", "user.name", "Test User"]);
  runGit(repo, ["config", "user.email", "test@example.com"]);
  return repo;
}

function writeRepoFile(repo: string, relativePath: string, content: string): void {
  const fullPath = join(repo, relativePath);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, content, "utf-8");
}

function runAnalyze(repo: string): AnalyzeOutput {
  return JSON.parse(execFileSync("bun", [scriptPath], {
    cwd: repo,
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
  }));
}

describe("rebase-conflict-analyze", () => {
  test("reports merge conflict hunks and context artifacts", () => {
    const repo = makeRepo("rebase-conflict-merge-");

    writeRepoFile(repo, "app.txt", "line1\nshared\nline3\n");
    runGit(repo, ["add", "app.txt"]);
    runGit(repo, ["commit", "-q", "-m", "base"]);

    writeRepoFile(repo, ".context/2026-06-16.merge-test/plan-merge-test.md", `---
status: active
topics: [merge, conflict]
---

# Plan: Merge Test

## User Goal
Preserve both sides of the merge.
`);
    writeRepoFile(repo, ".context/memory/merge-test-2026-06-16.md", `---
date: 2026-06-16
domains: [testing]
topics: [merge-test]
related: []
priority: medium
status: completed
---

# merge memory
`);

    runGit(repo, ["checkout", "-q", "-b", "feature"]);
    writeRepoFile(repo, "app.txt", "line1\nfeature change\nline3\n");
    runGit(repo, ["commit", "-qam", "feature edit"]);

    runGit(repo, ["checkout", "-q", "master"]);
    writeRepoFile(repo, "app.txt", "line1\nmain change\nline3\n");
    runGit(repo, ["commit", "-qam", "main edit"]);

    expect(() => runGit(repo, ["merge", "feature"])).toThrow();

    const output = runAnalyze(repo);
    expect(output.operation).toBe("merge");
    expect(output.sideSemantics.ours).toContain("current branch");
    expect(output.conflictedFiles).toHaveLength(1);
    expect(output.conflictedFiles[0].path).toBe("app.txt");
    expect(output.conflictedFiles[0].hunks).toHaveLength(1);
    expect(output.conflictedFiles[0].hunks[0]).toMatchObject({
      oursLabel: "HEAD",
      theirsLabel: "feature",
      oursContent: "main change",
      theirsContent: "feature change",
    });
    expect(output.conflictedFiles[0].oursCommits[0].subject).toBe("main edit");
    expect(output.conflictedFiles[0].theirsCommits[0].subject).toBe("feature edit");
    expect(output.contextArtifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "plan",
          title: "Plan: Merge Test",
          goal: "Preserve both sides of the merge.",
          topics: ["merge", "conflict"],
        }),
        expect.objectContaining({
          type: "memory",
          title: "merge memory",
          topics: ["merge-test"],
        }),
      ]),
    );
  });

  test("reports rebase side inversion correctly", () => {
    const repo = makeRepo("rebase-conflict-rebase-");

    writeRepoFile(repo, "app.txt", "line1\nshared\nline3\n");
    runGit(repo, ["add", "app.txt"]);
    runGit(repo, ["commit", "-q", "-m", "base"]);

    runGit(repo, ["checkout", "-q", "-b", "feature"]);
    writeRepoFile(repo, "app.txt", "line1\nfeature branch change\nline3\n");
    runGit(repo, ["commit", "-qam", "feature edit"]);

    runGit(repo, ["checkout", "-q", "master"]);
    writeRepoFile(repo, "app.txt", "line1\nupstream change\nline3\n");
    runGit(repo, ["commit", "-qam", "upstream edit"]);

    runGit(repo, ["checkout", "-q", "feature"]);
    expect(() => runGit(repo, ["rebase", "master"])).toThrow();

    const output = runAnalyze(repo);
    expect(output.operation).toBe("rebase");
    expect(output.sideSemantics.ours).toContain("upstream/base branch");
    expect(output.sideSemantics.theirs).toContain("commit being replayed");
    expect(output.conflictedFiles[0].hunks[0].oursLabel).toBe("HEAD");
    expect(output.conflictedFiles[0].hunks[0].oursContent).toBe("upstream change");
    expect(output.conflictedFiles[0].hunks[0].theirsLabel).toContain("feature edit");
    expect(output.conflictedFiles[0].hunks[0].theirsContent).toBe("feature branch change");
    expect(output.conflictedFiles[0].oursCommits[0].subject).toBe("upstream edit");
    expect(output.conflictedFiles[0].theirsCommits[0].subject).toBe("feature edit");
  });
});
