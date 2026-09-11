import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { formatReport, parseFlags, runBSaveCommand } from "../index.js";

describe("parseFlags", () => {
  it("parses known flags and rejects unknown ones", () => {
    expect(parseFlags(["--dry-run", "--subject", "2026-09-10.demo", "note"])).toMatchObject({
      dryRun: true,
      subject: "2026-09-10.demo",
      extra: "note",
    });
    expect(() => parseFlags(["--explode"])).toThrow(/unknown flag/);
  });
});

describe("formatReport", () => {
  it("distinguishes waiting, failed, unsupported, and completed outcomes", () => {
    const waiting = formatReport({
      runId: "abc",
      state: "awaiting_subject_choice",
      subject: null,
    });
    expect(waiting).toContain("run_id: abc");
    expect(waiting).toContain("recovery: /b-save --run-id abc --subject <folder>");
    const failed = formatReport({ runId: "x", state: "failed_model" });
    expect(failed).toContain("state: failed_model");
    expect(failed).not.toContain("state: completed");
    const done = formatReport({
      runId: "y",
      state: "completed",
      subject: "2026-09-10.demo",
      durableFiles: [".context/memory/a.md"],
      effects: [{ name: "native_memory", outcome: "unsupported", detail: "hindsight" }],
    });
    expect(done).toContain("durable: .context/memory/a.md");
    expect(done).toContain("effect native_memory: unsupported");
  });
});

describe("runBSaveCommand", () => {
  it("fails closed in headless subject waits and still prints the run id", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "b-save-cmd-"));
    try {
      const result = await runBSaveCommand(
        { cwd, hasUI: false },
        ["--dry-run"],
        { state: "awaiting_subject_choice" },
      );
      expect(result.ok).toBe(false);
      expect(result.report).toContain("run_id: " + result.runId);
      expect(result.report).toContain("state: awaiting_subject_choice");
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
