import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { RepoFilesStorageStore } from "../../skills/_shared/storage/file-store.js";
import type { TrustedWorkflowContext } from "../../skills/_shared/scripts/workflow-state.js";
import { workflowStateTool } from "./index.js";

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

function fixture(): { cwd: string; store: RepoFilesStorageStore; context: TrustedWorkflowContext } {
  const cwd = mkdtempSync(join(tmpdir(), "wf-tool-"));
  roots.push(cwd);
  const manifest = join(cwd, ".context", "workflow", "storage");
  return {
    cwd,
    store: new RepoFilesStorageStore({ root: manifest, contextRoot: join(cwd, ".context"), manifestRoot: manifest }),
    context: { projectId: "project-1", branchId: "branch-1", publishedRevisionIds: [] },
  };
}

describe("workflow_state tool permissions", () => {
  it("rejects caller project scope and denies inspect to a restricted child", async () => {
    const bound = fixture();
    const child = workflowStateTool({ ...bound, role: "write" });
    await expect(child.execute("id", { operation: "list", projectId: "other" } as never, undefined as never, undefined as never, {} as never)).rejects.toThrow(/cannot supply projectId/);
    await expect(child.execute("id", { operation: "inspect", branchRef: "refs/heads/other" }, undefined as never, undefined as never, {} as never)).rejects.toThrow(/write role/);
  });

  it("rejects a real persistence conflict rather than returning an error-shaped success", async () => {
    const tool = workflowStateTool({ ...fixture(), role: "write" });
    await expect(tool.execute("conflict", { operation: "write", subjectId: "s", kind: "plan", logicalName: "plan.md", body: "must not persist", expectedRevision: "nonexistent" }, undefined as never, undefined as never, {} as never)).rejects.toThrow(/stale revision/);
  });

  it("returns an artifact token from a permitted write", async () => {
    const bound = fixture();
    const tool = workflowStateTool({ ...bound, role: "write" });
    const written = await tool.execute("id", { operation: "write", subjectId: "2026-10-12.demo", kind: "plan", logicalName: "plan-demo.md", body: "token\n" }, undefined as never, undefined as never, {} as never);
    expect(written.details).toMatchObject({ token: expect.stringMatching(/^workflow-artifact:/), logicalName: "plan-demo.md" });
    expect(written.details).not.toHaveProperty("path");
  });
});
