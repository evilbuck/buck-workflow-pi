import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { MemoryCtx } from "../effects.js";
import { formatReport, parseFlags, runBSaveCommand, wire, type CommandCtx, type RolesAdapter } from "../index.js";
import type { RunManifest } from "../types.js";

const SCRIBE_OK = {
  title: "Demo session",
  summary: "Wired the pipeline.",
  priority: "high" as const,
  domains: ["workflow"],
  topics: ["b-save"],
  facts: ["snapshot to apply"],
  backlog: { complete_explicit: [], complete_inferred: [], new_items: [] },
};

const AUDIT_OK = [{ path: "spec-demo.md", verdict: "complete" as const, evidence_ids: ["e1"] }];
const GOAL_OK = { classification: "present" as const, quote: "goal", evidence_id: "e1" };

function fakeRoles(overrides: Partial<RolesAdapter> = {}): RolesAdapter {
  return {
    scribe: vi.fn().mockResolvedValue({ ok: true, role: "scribe", value: SCRIBE_OK }),
    evidenceAuditor: vi.fn().mockResolvedValue({ ok: true, role: "evidence-auditor", value: AUDIT_OK }),
    goalClassifier: vi.fn().mockResolvedValue({ ok: true, role: "goal-classifier", value: GOAL_OK }),
    ...overrides,
  };
}

function fakeMemory() {
  return {
    status: vi.fn().mockResolvedValue({ enabled: true, backend: "local" }),
    save: vi.fn().mockResolvedValue({ stored: 1 }),
  };
}

function fixtureRepo(subjects: string[] = ["2026-09-11.demo"]) {
  const cwd = mkdtempSync(join(tmpdir(), "b-save-int-"));
  mkdirSync(join(cwd, ".context/memory"), { recursive: true });
  mkdirSync(join(cwd, ".context/workflow"), { recursive: true });
  for (const subject of subjects) {
    mkdirSync(join(cwd, ".context", subject), { recursive: true });
    writeFileSync(join(cwd, ".context", subject, "index.md"), "---\nstatus: active\n---\n# Demo\n");
  }
  writeFileSync(join(cwd, ".context/memory/index.md"), "- 2026-09-10 — [Old entry](old.md) — `completed`\n");
  writeFileSync(
    join(cwd, ".context/workflow/current-session.json"),
    JSON.stringify({
      started_at: "2026-09-11T00:00:00Z",
      mode: "session",
      commands_run: ["b-save"],
      implementation_happened: true,
      save_completed: false,
      files_modified: [],
      subject: subjects[0],
    }),
  );
  return { cwd, cleanup: () => rmSync(cwd, { recursive: true, force: true }) };
}

function ctxFor(cwd: string, roles: RolesAdapter, memory: MemoryCtx): CommandCtx {
  return { cwd, hasUI: false, memory, roles };
}

function readManifest(cwd: string, runId: string): RunManifest {
  return JSON.parse(
    readFileSync(join(cwd, ".context/workflow/b-save", runId, "manifest.json"), "utf8"),
  ) as RunManifest;
}

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
    const waiting = formatReport({ runId: "abc", state: "awaiting_subject_choice" });
    expect(waiting).toContain("run_id: abc");
    expect(waiting).toContain("recovery: /b-save --run-id abc --subject <folder>");
    const failed = formatReport({ runId: "x", state: "failed_model" });
    expect(failed).toContain("state: failed_model");
    expect(failed).not.toContain("state: completed");
    const applyFailed = formatReport({ runId: "y", state: "failed_apply" });
    expect(applyFailed).toContain("recovery: /b-save --run-id y");
    const done = formatReport({
      runId: "z",
      state: "completed",
      durableFiles: [".context/memory/a.md"],
      effects: [{ name: "native_memory", outcome: "unsupported", detail: "hindsight" }],
    });
    expect(done).toContain("durable: .context/memory/a.md");
    expect(done).toContain("effect native_memory: unsupported");
  });
});

describe("fresh /b-save run (issue #23 acceptance: durable writes)", () => {
  it("drives snapshot → roles → evaluate → apply → effects and persists a real manifest", async () => {
    const { cwd, cleanup } = fixtureRepo();
    try {
      const roles = fakeRoles();
      const memory = fakeMemory();
      const result = await runBSaveCommand(ctxFor(cwd, roles, memory), []);
      expect(result.ok).toBe(true);
      expect(result.state).toBe("completed");
      expect(result.effects[0]).toMatchObject({ name: "native_memory", outcome: "succeeded" });
      expect(memory.save).toHaveBeenCalledTimes(1);

      const memoryPath = join(cwd, ".context/2026-09-11.demo/memory-2026-09-11.md");
      expect(existsSync(memoryPath)).toBe(true);
      expect(readFileSync(memoryPath, "utf8")).toContain("# Demo session");
      expect(readFileSync(memoryPath, "utf8")).toContain("- snapshot to apply");

      const index = readFileSync(join(cwd, ".context/memory/index.md"), "utf8");
      expect(index).toContain("- 2026-09-10 — [Old entry](old.md) — `completed`");
      expect(index).toContain("- memory-2026-09-11.md");

      const manifest = readManifest(cwd, result.runId);
      expect(manifest.state).toBe("completed");
      expect(manifest.session_evidence.present).toBe(true);
      expect(Object.keys(manifest.input_hashes).length).toBeGreaterThan(0);
      expect(manifest.proposals).toHaveLength(3);
      expect(manifest.patch_set).not.toBeNull();
      expect(manifest.journal).toEqual({
        status: "completed",
        files: [".context/2026-09-11.demo/memory-2026-09-11.md", ".context/memory/index.md"],
      });
      expect(manifest.terminal_error).toBeNull();
    } finally {
      cleanup();
    }
  });

  it("dry-run evaluates but applies and persists nothing", async () => {
    const { cwd, cleanup } = fixtureRepo();
    try {
      const memory = fakeMemory();
      const result = await runBSaveCommand(ctxFor(cwd, fakeRoles(), memory), ["--dry-run"]);
      expect(result.state).toBe("completed");
      expect(result.report).toContain("dry-run: nothing applied or persisted");
      expect(existsSync(join(cwd, ".context/2026-09-11.demo/memory-2026-09-11.md"))).toBe(false);
      expect(existsSync(join(cwd, ".context/workflow/b-save", result.runId, "manifest.json"))).toBe(false);
      expect(memory.save).not.toHaveBeenCalled();
    } finally {
      cleanup();
    }
  });
});

describe("waiting resumes (issue #23 acceptance: no side effects)", () => {
  it("ambiguous subject parks the run; --run-id without --subject re-reports without effects", async () => {
    const { cwd, cleanup } = fixtureRepo(["2026-09-11.demo", "2026-09-11.other"]);
    try {
      const memory = fakeMemory();
      const first = await runBSaveCommand(ctxFor(cwd, fakeRoles(), memory), []);
      expect(first.ok).toBe(false);
      expect(first.state).toBe("awaiting_subject_choice");
      expect(first.report).toContain("2026-09-11.demo");
      expect(memory.save).not.toHaveBeenCalled();

      const parked = readManifest(cwd, first.runId);
      const again = await runBSaveCommand(ctxFor(cwd, fakeRoles(), memory), ["--run-id", first.runId]);
      expect(again.ok).toBe(false);
      expect(again.state).toBe("awaiting_subject_choice");
      expect(again.report).toContain("recovery: /b-save --run-id " + first.runId + " --subject <folder>");
      expect(memory.save).not.toHaveBeenCalled();
      // Report-only: the persisted manifest is untouched while parked.
      expect(readManifest(cwd, first.runId)).toEqual(parked);

      const resumed = await runBSaveCommand(
        ctxFor(cwd, fakeRoles(), memory),
        ["--run-id", first.runId, "--subject", "2026-09-11.demo"],
      );
      expect(resumed.ok).toBe(true);
      expect(resumed.state).toBe("completed");
      expect(resumed.report).toContain("resumed: true");
      expect(memory.save).toHaveBeenCalledTimes(1);
      expect(existsSync(join(cwd, ".context/2026-09-11.demo/memory-2026-09-11.md"))).toBe(true);
    } finally {
      cleanup();
    }
  });

  it("inferred backlog parks on awaiting_policy; --archive-inferred completes it", async () => {
    const { cwd, cleanup } = fixtureRepo();
    try {
      const memory = fakeMemory();
      const roles = fakeRoles({
        scribe: vi.fn().mockResolvedValue({
          ok: true,
          role: "scribe",
          value: {
            ...SCRIBE_OK,
            backlog: { complete_explicit: [], complete_inferred: ["items/thing.md"], new_items: [] },
          },
        }),
      });
      const first = await runBSaveCommand(ctxFor(cwd, roles, memory), []);
      expect(first.state).toBe("awaiting_policy");
      expect(first.report).toContain("items/thing.md");
      expect(memory.save).not.toHaveBeenCalled();

      const stillWaiting = await runBSaveCommand(ctxFor(cwd, roles, memory), ["--run-id", first.runId]);
      expect(stillWaiting.state).toBe("awaiting_policy");
      expect(memory.save).not.toHaveBeenCalled();

      const resumed = await runBSaveCommand(
        ctxFor(cwd, roles, memory),
        ["--run-id", first.runId, "--archive-inferred"],
      );
      expect(resumed.ok).toBe(true);
      expect(resumed.state).toBe("completed");
      expect(memory.save).toHaveBeenCalledTimes(1);
    } finally {
      cleanup();
    }
  });
});

describe("failed_apply resume (issue #23 acceptance: continue through effects)", () => {
  it("resumes a failed_apply run, re-applies, fires effects, and reports completed", async () => {
    const { cwd, cleanup } = fixtureRepo();
    try {
      // First run completes cleanly, then we tamper the manifest into
      // failed_apply to model a crash after a partial journal write.
      const memory = fakeMemory();
      const first = await runBSaveCommand(ctxFor(cwd, fakeRoles(), memory), []);
      expect(first.state).toBe("completed");
      const manifestPath = join(cwd, ".context/workflow/b-save", first.runId, "manifest.json");
      const tampered = { ...readManifest(cwd, first.runId), state: "failed_apply" };
      writeFileSync(manifestPath, JSON.stringify(tampered, null, 2) + "\n");

      const resumeMemory = fakeMemory();
      const resumed = await runBSaveCommand(
        ctxFor(cwd, fakeRoles(), resumeMemory),
        ["--run-id", first.runId],
      );
      expect(resumed.ok).toBe(true);
      expect(resumed.state).toBe("completed");
      // The resume must actually continue through effects, not just relabel
      // the recovered run as completed.
      expect(resumeMemory.save).toHaveBeenCalledTimes(1);
      expect(readManifest(cwd, first.runId).state).toBe("completed");
      expect(existsSync(join(cwd, ".context/2026-09-11.demo/memory-2026-09-11.md"))).toBe(true);
    } finally {
      cleanup();
    }
  });

  it("stays failed_apply when the journaled before-image drifted", async () => {
    const { cwd, cleanup } = fixtureRepo();
    try {
      const memory = fakeMemory();
      const first = await runBSaveCommand(ctxFor(cwd, fakeRoles(), memory), []);
      const runDirAbs = join(cwd, ".context/workflow/b-save", first.runId);
      const manifestPath = join(runDirAbs, "manifest.json");
      writeFileSync(
        manifestPath,
        JSON.stringify({ ...readManifest(cwd, first.runId), state: "failed_apply" }, null, 2) + "\n",
      );
      // Model an in-progress journal whose untouched op drifted underneath us.
      writeFileSync(
        join(runDirAbs, "apply-journal.json"),
        JSON.stringify({
          status: "in-progress",
          ops: [
            {
              path: ".context/2026-09-11.demo/memory-2026-09-11.md",
              before: "different content entirely",
              tmp: join(cwd, ".context/2026-09-11.demo/memory-2026-09-11.md.tmp-b-save"),
              done: false,
            },
          ],
        }),
      );
      const resumed = await runBSaveCommand(ctxFor(cwd, fakeRoles(), fakeMemory()), ["--run-id", first.runId]);
      expect(resumed.ok).toBe(false);
      expect(resumed.state).toBe("failed_apply");
      expect(resumed.report).toContain("before-image changed");
    } finally {
      cleanup();
    }
  });
});

describe("terminal and unknown runs", () => {
  it("refuses terminal runs and unknown run ids", async () => {
    const { cwd, cleanup } = fixtureRepo();
    try {
      const memory = fakeMemory();
      const done = await runBSaveCommand(ctxFor(cwd, fakeRoles(), memory), []);
      const refused = await runBSaveCommand(ctxFor(cwd, fakeRoles(), memory), ["--run-id", done.runId]);
      expect(refused.ok).toBe(false);
      expect(refused.report).toMatch(/terminal/);

      const missing = await runBSaveCommand(ctxFor(cwd, fakeRoles(), memory), ["--run-id", "missing-run"]);
      expect(missing.ok).toBe(false);
      expect(missing.report).toMatch(/unknown run|start a new run/);
    } finally {
      cleanup();
    }
  });

  it("aborts with a visible error outside a .context repo", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "b-save-norepo-"));
    try {
      const result = await runBSaveCommand(ctxFor(cwd, fakeRoles(), fakeMemory()), []);
      expect(result.ok).toBe(false);
      expect(result.state).toBe("aborted");
      expect(result.report).toContain("no .context directory");
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});

describe("role failure surfaces as failed_model", () => {
  it("reports failed_model when the scribe role fails", async () => {
    const { cwd, cleanup } = fixtureRepo();
    try {
      const roles = fakeRoles({
        scribe: vi.fn().mockResolvedValue({ ok: false, state: "failed_model", role: "scribe", error: "no model" }),
      });
      const result = await runBSaveCommand(ctxFor(cwd, roles, fakeMemory()), []);
      expect(result.ok).toBe(false);
      expect(result.state).toBe("failed_model");
      expect(result.report).toContain("scribe failed: no model");
      expect(existsSync(join(cwd, ".context/2026-09-11.demo/memory-2026-09-11.md"))).toBe(false);
    } finally {
      cleanup();
    }
  });
});

describe("wire", () => {
  it("registers /b-save completions", async () => {
    const registerCommand = vi.fn();
    wire({ registerCommand } as never);
    const spec = registerCommand.mock.calls[0][1] as {
      getArgumentCompletions: (prefix: string) => Array<{ value: string }>;
      handler: (args: string, ctx: CommandCtx) => Promise<void>;
    };
    expect(spec.getArgumentCompletions("--d").map((row) => row.value)).toContain("--dry-run");
    const { cwd, cleanup } = fixtureRepo();
    try {
      await spec.handler("", ctxFor(cwd, fakeRoles(), fakeMemory()));
    } finally {
      cleanup();
    }
  });
});
