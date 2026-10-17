import { describe, expect, it } from "vitest";
import type { ArtifactRevision } from "../storage/contract.js";
import { isRevisionVisible } from "../storage/visibility.js";

function artifact(revision: string, branchId: string, run?: { worktreeId: string; runId: string }): ArtifactRevision {
  return {
    key: { projectId: "project", subjectId: "subject", kind: "memory", logicalName: "note.md", branchId, ...(run ? { worktreeId: run.worktreeId, runId: run.runId } : {}) },
    revision, bytes: new Uint8Array(), sha256: "hash", author: "test", source: "test", createdAt: "2026-01-01T00:00:00Z", links: [],
  };
}

describe("artifact visibility contract", () => {
  const context = { projectId: "project", branchId: "branch-a", publishedRevisionIds: new Set(["published"]) };

  it("admits branch overlays and published revisions but excludes other private branches", () => {
    expect(isRevisionVisible(artifact("draft-a", "branch-a"), context)).toBe(true);
    expect(isRevisionVisible(artifact("published", "branch-main"), context)).toBe(true);
    expect(isRevisionVisible(artifact("private-b", "branch-b"), context)).toBe(false);
  });

  it("keeps run-scoped revisions private to the exact run and worktree", () => {
    const run = { worktreeId: "worktree-a", runId: "run-a" };
    expect(isRevisionVisible(artifact("run-a", "branch-a", run), { ...context, ...run })).toBe(true);
    expect(isRevisionVisible(artifact("run-a", "branch-a", run), { ...context, worktreeId: "worktree-b", runId: "run-a" })).toBe(false);
    expect(isRevisionVisible(artifact("run-a", "branch-a", run), context)).toBe(false);
  });
});
