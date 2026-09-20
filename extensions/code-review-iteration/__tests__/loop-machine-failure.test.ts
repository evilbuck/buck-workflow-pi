import { afterEach, describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MachineFailure } from "../../state-machine.js";
import { runReviewLoop, type LoopDeps, type LoopOptions } from "../loop.js";
import { reviewMachine } from "../machine.js";

const OPTIONS: LoopOptions = {
  personaName: "balanced",
  minBlocking: "medium",
  maxPasses: 3,
  resume: false,
};

function makeCheckout(): string {
  const repo = mkdtempSync(join(tmpdir(), "review-machine-failure-"));
  execFileSync("git", ["init", "-q", "-b", "master", "."], { cwd: repo });
  execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: repo });
  execFileSync("git", ["config", "user.name", "Test"], { cwd: repo });
  writeFileSync(join(repo, "app.ts"), "export const value = 1;\n");
  execFileSync("git", ["add", "app.ts"], { cwd: repo });
  execFileSync("git", ["commit", "-qm", "initial"], { cwd: repo });
  return repo;
}

function unexpectedEffect(): never {
  throw new Error("machine failure should precede loop effects");
}

function deps(contextRoot: string): LoopDeps {
  return {
    runReviewerSession: unexpectedEffect,
    runFixerSession: unexpectedEffect,
    execReviewCommand: unexpectedEffect,
    runChecks: unexpectedEffect,
    availableSelectors: unexpectedEffect,
    loadCatalog: unexpectedEffect,
    fixerFallbackModel: () => null,
    baseGuidance: () => "",
    persona: () => null,
    untrackedSelection: unexpectedEffect,
    notify: () => undefined,
    contextDir: () => contextRoot,
  };
}

describe("runReviewLoop machine failure boundary", () => {
  const cleanup: string[] = [];

  afterEach(() => {
    vi.restoreAllMocks();
    for (const dir of cleanup.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  it("terminalizes a malformed projection with the evaluator code and context", async () => {
    const repo = makeCheckout();
    const contextRoot = mkdtempSync(join(tmpdir(), "review-machine-context-"));
    cleanup.push(repo, contextRoot);
    vi.spyOn(reviewMachine, "advance").mockImplementationOnce(() => {
      throw new MachineFailure("NO_ROUTE", { state: "reviewing", operation: "advance" });
    });

    const result = await runReviewLoop(deps(contextRoot), repo, OPTIONS);

    expect(result.status).toBe("failed");
    expect(result.reportPath).not.toBeNull();
    const report = readFileSync(result.reportPath!, "utf-8");
    expect(report).toContain("review machine NO_ROUTE");
    expect(report).toContain('"state":"reviewing"');
  });
});
