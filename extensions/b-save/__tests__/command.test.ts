import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { formatReport, parseFlags, runBSaveCommand, wire } from "../index.js";

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

  it("resumes a waiting run with --run-id and --subject, and refuses unknown ids", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "b-save-resume-"));
    try {
      const first = await runBSaveCommand({ cwd, hasUI: false }, [], { state: "awaiting_subject_choice" });
      expect(first.ok).toBe(false);
      const resumed = await runBSaveCommand(
        { cwd, hasUI: false },
        ["--run-id", first.runId, "--subject", "2026-09-10.demo"],
      );
      expect(resumed.report).toContain("resumed: true");
      expect(resumed.state).toBe("snapshotting");
      expect(resumed.report).toContain("subject: 2026-09-10.demo");
      const missing = await runBSaveCommand({ cwd, hasUI: false }, ["--run-id", "missing-run"]);
      expect(missing.ok).toBe(false);
      expect(missing.report).toMatch(/unknown run|start a new run/);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});

describe("resume policy and wire", () => {
  it("resumes awaiting_policy with --archive-inferred and refuses terminal runs", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "b-save-policy-"));
    try {
      const waiting = await runBSaveCommand({ cwd, hasUI: false }, [], { state: "awaiting_policy" });
      const resumed = await runBSaveCommand(
        { cwd, hasUI: false },
        ["--run-id", waiting.runId, "--archive-inferred"],
      );
      expect(resumed.state).toBe("evaluating");
      const done = await runBSaveCommand({ cwd, hasUI: false }, [], { state: "completed" });
      const refused = await runBSaveCommand({ cwd, hasUI: false }, ["--run-id", done.runId]);
      expect(refused.ok).toBe(false);
      expect(refused.report).toMatch(/terminal/);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("registers /b-save completions", async () => {
    const registerCommand = vi.fn();
    wire({ registerCommand } as never);
    const spec = registerCommand.mock.calls[0][1] as {
      getArgumentCompletions: (prefix: string) => Array<{ value: string }>;
      handler: (args: string, ctx: { cwd: string }) => Promise<void>;
    };
    expect(spec.getArgumentCompletions("--d").map((row) => row.value)).toContain("--dry-run");
    const cwd = mkdtempSync(join(tmpdir(), "b-save-wire-"));
    try {
      await spec.handler("--dry-run", { cwd });
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
