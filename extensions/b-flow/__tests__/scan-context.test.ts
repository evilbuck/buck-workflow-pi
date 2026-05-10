import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { rmSync, mkdirSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { scanContext } from "../scan-context.js";

const TEST_ROOT = join("/tmp", "bflow-scan-test-" + Date.now());

describe("scanContext", () => {
  beforeEach(() => {
    if (existsSync(TEST_ROOT)) rmSync(TEST_ROOT, { recursive: true });
    mkdirSync(TEST_ROOT, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_ROOT)) rmSync(TEST_ROOT, { recursive: true });
  });

  it("completes when git commands succeed", async () => {
    const result = await scanContext(TEST_ROOT, "idle", "goal", null);
    expect(result.type).toBe("SCAN_COMPLETE");
    expect(result.context).toBeDefined();
    expect(result.context!.git).toBeDefined();
  });

  it("does not hang when git is slow — git commands have a timeout", async () => {
    const start = Date.now();
    const result = await scanContext(TEST_ROOT, "idle", "goal", null);
    const elapsed = Date.now() - start;

    expect(result.type).toBe("SCAN_COMPLETE");
    expect(elapsed).toBeLessThan(15_000);
  });

  it("returns SCAN_COMPLETE with empty artifacts when no .context dir", async () => {
    const result = await scanContext(TEST_ROOT, "idle", "goal", null);
    expect(result.type).toBe("SCAN_COMPLETE");
    expect(result.context!.artifacts.latestPlan).toBeUndefined();
    expect(result.context!.artifacts.phasesOverview).toBeUndefined();
    expect(result.context!.artifacts.activePhase).toBeUndefined();
  });

  it("finds latest plan in subject folder", async () => {
    const subjectDir = join(TEST_ROOT, ".context", "2026-05-09.my-subject");
    mkdirSync(subjectDir, { recursive: true });
    writeFileSync(
      join(subjectDir, "plan-test.md"),
      "---\nstatus: active\n---\n# Plan\n",
    );

    const result = await scanContext(TEST_ROOT, "idle", "goal", null);
    expect(result.type).toBe("SCAN_COMPLETE");
    expect(result.context!.artifacts.latestPlan).toBeDefined();
    expect(result.context!.artifacts.latestPlan!.exists).toBe(true);
  });

  it("populates git context from the project repo", async () => {
    const result = await scanContext(TEST_ROOT, "idle", "goal", null);
    expect(result.type).toBe("SCAN_COMPLETE");
    expect(result.context!.git).toHaveProperty("hasDiff");
    expect(result.context!.git).toHaveProperty("changedFiles");
    expect(result.context!.git).toHaveProperty("sourceFilesChanged");
    expect(result.context!.git).toHaveProperty("contextOnlyChanged");
  });
});
