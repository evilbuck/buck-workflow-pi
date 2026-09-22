/**
 * Supervisor tests. `runStep` and `choose` are fakes so CI never calls a
 * live model. Real `scan` + `machine` + `persist` still run against a temp
 * git repo. The child's last sentence is never parsed for the next state.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cleanupRepos, git, phaseMd, planMd, repo, writeTree } from "./fixtures.js";
import { handleLoop } from "../loop.js";
import { readProjection } from "../persist.js";
import type { ChooseResult } from "../choice.js";
import type { NestedSkill, RunStepResult } from "../run-step.js";
import type { ActivityEvent } from "../../extension-activity.js";
import type { Choice } from "../types.js";

const SUBJECT = "2026-09-18.demo";
const PLAN = `.context/${SUBJECT}/plan-demo.md`;
const NOW = "2026-09-18T00:00:00.000Z";

const CLEAN_REVIEW = `# Review

### Documentation Impact
- No documentation impact

### How-to Impact
- No how-to impact
`;

const DOCS_REVIEW = `# Review

### Documentation Impact
- CONTEXT.md needs a term

### How-to Impact
- No how-to impact
`;

const UNPARSEABLE_REVIEW = `# Review

Something went wrong.
`;

function phased(root: string, statuses: string[]): void {
  const files: Record<string, string> = {
    [PLAN]: planMd(),
    [`.context/${SUBJECT}/plan-demo-phases.md`]: "---\nstatus: active\n---\n# Phases\n",
  };
  statuses.forEach((status, i) => {
    const n = i + 1;
    files[`.context/${SUBJECT}/phase-${n}-p${n}.md`] = phaseMd(n, status);
  });
  writeTree(root, files);
}
function workDeps(
  runStep: (opts: {
    cwd: string;
    skill: NestedSkill;
    planOrPhasePath: string;
    difficulty: string;
    onActivity?: (event: ActivityEvent) => void;
  }) => Promise<RunStepResult>,
  choose: (opts: {
    cwd: string;
    subject: string;
    legal: readonly Choice[];
    context?: string;
    onActivity?: (event: ActivityEvent) => void;
  }) => Promise<ChooseResult> = async () => ({ status: "blocked", reason: "choose not expected" }),
) {
  return {
    runStep: vi.fn(runStep),
    choose: vi.fn(choose),
    now: () => NOW,
  };
}

function mutatePhase(cwd: string, rel: string, status: string): void {
  const abs = join(cwd, rel);
  writeFileSync(abs, readFileSync(abs, "utf8").replace(/^status: .+$/m, `status: ${status}`));
}

function landingWork() {
  let saves = 0;
  return async (opts: { cwd: string; skill: NestedSkill; planOrPhasePath: string; difficulty: string }) => {
    const cwd = opts.cwd;
    if (opts.skill === "b-build" || opts.skill === "b-build-hard") {
      mutatePhase(cwd, opts.planOrPhasePath, "completed");
    }
    if (opts.skill === "b-review") {
      return { ok: true, text: CLEAN_REVIEW };
    }
    if (opts.skill === "b-iterate") {
      const iterate = join(cwd, `.context/${SUBJECT}/iterate-x.md`);
      if (existsSync(iterate)) mutatePhase(cwd, `.context/${SUBJECT}/iterate-x.md`, "completed");
    }
    if (opts.skill === "b-docs" || opts.skill === "b-howto") {
      writeTree(cwd, { "docs/architecture.md": "# Architecture\n" });
      git(cwd, ["add", "-f", "docs/architecture.md"]);
    }
    if (opts.skill === "b-save") {
      saves += 1;
      const rel = `.context/memory/note-${saves}.md`;
      writeTree(cwd, { [rel]: `# Memory ${saves}\n` });
      git(cwd, ["add", "-f", rel]);
    }
    if (opts.skill === "b-commit") {
      git(cwd, ["commit", "-qm", "loop"]);
    }
    return { ok: true, text: opts.skill };
  };
}

afterEach(cleanupRepos);

describe("handleLoop commands", () => {
  it("status with no projection is idle and launches no work", async () => {
    const cwd = repo();
    const deps = workDeps(async () => ({ ok: true, text: "nope" }));
    await expect(handleLoop({ cwd, command: "status", deps })).resolves.toEqual({
      state: "idle",
      reason: "no projection",
    });
    expect(deps.runStep).not.toHaveBeenCalled();
  });

  it("stop with no run is a no-op", async () => {
    const cwd = repo();
    await expect(handleLoop({ cwd, command: "stop" })).resolves.toEqual({
      state: "idle",
      reason: "no run to stop",
    });
    expect(readProjection(cwd)).toBeNull();
  });
  it("does not ask about dirty files when there is no saved run to resume", async () => {
    const cwd = repo();
    writeTree(cwd, { "src/unrelated.ts": "export {}\n" });
    const confirmDirty = vi.fn(async () => true);
    const deps = { ...workDeps(async () => ({ ok: true, text: "nope" })), confirmDirty };

    await expect(handleLoop({ cwd, command: "resume", deps })).resolves.toEqual({
      state: "idle",
      reason: "no projection to resume",
    });
    expect(confirmDirty).not.toHaveBeenCalled();
    expect(deps.runStep).not.toHaveBeenCalled();
  });


  it("stop persists aborted and does not run work", async () => {
    const cwd = repo();
    phased(cwd, ["pending"]);
    const deps = workDeps(landingWork());
    await handleLoop({ cwd, command: "start", path: PLAN, deps });
    const deps2 = workDeps(async () => ({ ok: true, text: "nope" }));
    const result = await handleLoop({ cwd, command: "stop", deps: deps2 });
    expect(result.state).toBe("aborted");
    expect(readProjection(cwd)?.state).toBe("aborted");
    expect(deps2.runStep).not.toHaveBeenCalled();
  });

  it("missing plan blocks without nested work", async () => {
    const cwd = repo();
    const deps = workDeps(async () => ({ ok: true, text: "nope" }));
    const result = await handleLoop({ cwd, command: "start", path: "missing.md", deps });
    expect(result.state).toBe("blocked");
    expect(deps.runStep).not.toHaveBeenCalled();
  });

  it("refuses to start on a protected branch", async () => {
    const cwd = repo();
    git(cwd, ["checkout", "-q", "-b", "master"]);
    phased(cwd, ["pending"]);
    const deps = workDeps(async () => ({ ok: true, text: "nope" }));
    const result = await handleLoop({ cwd, command: "start", path: PLAN, deps });
    expect(result.state).toBe("blocked");
    expect(result.reason).toMatch(/protected branch master/);
    expect(deps.runStep).not.toHaveBeenCalled();
  });

  it("blocks a dirty start when there is nobody to approve it", async () => {
    const cwd = repo();
    phased(cwd, ["pending"]);
    writeTree(cwd, { "src/unrelated.ts": "export {}\n" });
    const deps = workDeps(async () => ({ ok: true, text: "nope" }));
    const result = await handleLoop({ cwd, command: "start", path: PLAN, deps });
    expect(result.state).toBe("blocked");
    expect(result.reason).toMatch(/dirty/);
    expect(deps.runStep).not.toHaveBeenCalled();
  });

  it("blocks a dirty resume when there is nobody to approve it", async () => {
    const cwd = repo();
    phased(cwd, ["pending"]);
    writeTree(cwd, {
      ".context/workflow/buck-loop.json": JSON.stringify({
        version: 1,
        state: "building",
        subject: SUBJECT,
        planPath: PLAN,
        phasePath: `.context/${SUBJECT}/phase-1-p1.md`,
        loopCount: 1,
        iterateCyclesOnPhase: 0,
        maxLoops: 12,
        lastChoice: null,
        history: [{ from: "resolving", to: "building", at: NOW, why: "start" }],
      }, null, 2),
      "src/unrelated.ts": "export {}\n",
    });
    const deps = workDeps(async () => ({ ok: true, text: "nope" }));
    const result = await handleLoop({ cwd, command: "resume", deps });
    expect(result.state).toBe("blocked");
    expect(result.reason).toMatch(/dirty/);
    expect(deps.runStep).not.toHaveBeenCalled();
  });
  it("asks before starting over dirty files and starts once approved", async () => {
    const cwd = repo();
    phased(cwd, ["pending"]);
    writeTree(cwd, { "src/unrelated.ts": "export {}\n" });
    const confirmDirty = vi.fn(async () => true);
    const deps = { ...workDeps(landingWork()), confirmDirty };
    const result = await handleLoop({ cwd, command: "start", path: PLAN, deps });
    expect(confirmDirty).toHaveBeenCalledWith({ mode: "start", paths: ["src/unrelated.ts"] });
    expect(result.state).toBe("done");
  });

  it("resumes a run whose only dirt is its own child output, once approved", async () => {
    const cwd = repo();
    phased(cwd, ["pending"]);
    // The child writes its deliverable outside .context/ but cannot complete
    // the phase, so the loop blocks before it ever reaches `committing`.
    const stalledBuild = async (opts: { cwd: string; skill: NestedSkill }) => {
      if (opts.skill === "b-build") writeTree(opts.cwd, { "docs/cycles/note.md": "# Note\n" });
      return { ok: true, text: opts.skill };
    };
    const blockChoice = async (): Promise<ChooseResult> => ({
      status: "accepted",
      accepted: { choice: { kind: "block" }, reason: "outstanding criteria are human-gated" },
    });
    const first = await handleLoop({
      cwd,
      command: "start",
      path: PLAN,
      deps: workDeps(stalledBuild, blockChoice),
    });
    expect(first.state).toBe("blocked");

    const confirmDirty = vi.fn(async () => true);
    const deps = { ...workDeps(landingWork()), confirmDirty };
    const result = await handleLoop({ cwd, command: "resume", deps });
    expect(confirmDirty).toHaveBeenCalledWith({ mode: "resume", paths: ["docs/cycles/note.md"] });
    expect(deps.runStep).toHaveBeenCalled();
    expect(result.state).not.toBe("blocked");
  });

  it("never asks about a protected branch", async () => {
    const cwd = repo();
    git(cwd, ["checkout", "-q", "-b", "master"]);
    phased(cwd, ["pending"]);
    writeTree(cwd, { "src/unrelated.ts": "export {}\n" });
    const confirmDirty = vi.fn(async () => true);
    const deps = { ...workDeps(landingWork()), confirmDirty };
    const result = await handleLoop({ cwd, command: "start", path: PLAN, deps });
    expect(result.reason).toMatch(/protected branch master/);
    expect(confirmDirty).not.toHaveBeenCalled();
  });


});

describe("happy path", () => {
  it("runs build → review → save → commit → next phase → done", async () => {
    const cwd = repo();
    phased(cwd, ["pending", "pending"]);
    const onProgress = vi.fn();
    const deps = { ...workDeps(landingWork()), onProgress };
    const result = await handleLoop({ cwd, command: "start", path: PLAN, deps });
    expect(result.state, result.reason).toBe("done");
    const calls = deps.runStep.mock.calls.map((call) => call[0]);
    const skills = calls.map((call) => call.skill);
    expect(skills.filter((s) => s === "b-build")).toHaveLength(2);
    expect(skills).toContain("b-review");
    expect(skills).toContain("b-save");
    expect(skills).toContain("b-commit");
    expect(skills).not.toContain("b-iterate");
    const reviews = calls.filter((call) => call.skill === "b-review");
    const saves = calls.filter((call) => call.skill === "b-save");
    const commits = calls.filter((call) => call.skill === "b-commit");
    expect(reviews[0]?.planOrPhasePath).toContain("phase-1-p1.md");
    expect(saves[0]?.planOrPhasePath).toContain("phase-1-p1.md");
    expect(commits[0]?.planOrPhasePath).toContain("phase-1-p1.md");
    expect(reviews[1]?.planOrPhasePath).toContain("phase-2-p2.md");
    expect(calls.filter((call) => call.skill === "b-build")[1]?.planOrPhasePath).toContain("phase-2-p2.md");
    expect(readProjection(cwd)?.state).toBe("done");
    expect(readProjection(cwd)?.history.some((h) => h.to === "building")).toBe(true);
    const labels = onProgress.mock.calls.map((call) => call[0].label);
    expect(labels).toContain("Building phase-1-p1.md");
    expect(labels).toContain("Reviewing phase-1-p1.md");
    expect(labels).toContain("Saving session state");
    expect(labels).toContain("Committing completed work");
    expect(execFileSync("git", ["status", "--porcelain"], { cwd, encoding: "utf8" })).toBe("");
  });

  it("routes iterate when the review artifact exists, then re-reviews", async () => {
    const cwd = repo();
    phased(cwd, ["pending"]);
    let reviews = 0;
    const deps = workDeps(async (opts) => {
      if (opts.skill === "b-review") {
        reviews += 1;
        if (reviews === 1) {
          writeTree(cwd, {
            [`.context/${SUBJECT}/iterate-x.md`]: "---\nstatus: active\n---\n# Iterate\n",
          });
          return { ok: true, text: CLEAN_REVIEW };
        }
      }
      return landingWork()(opts);
    });
    const result = await handleLoop({ cwd, command: "start", path: PLAN, deps });
    expect(result.state).toBe("done");
    const skills = deps.runStep.mock.calls.map((call) => call[0].skill);
    expect(skills).toContain("b-iterate");
    expect(skills.filter((s) => s === "b-review").length).toBeGreaterThan(1);
  });

  it("routes documentation when review flags docs impact", async () => {
    const cwd = repo();
    phased(cwd, ["pending"]);
    const deps = workDeps(async (opts) => {
      if (opts.skill === "b-review") return { ok: true, text: DOCS_REVIEW };
      return landingWork()(opts);
    });
    const result = await handleLoop({ cwd, command: "start", path: PLAN, deps });
    expect(result.state).toBe("done");
    expect(deps.runStep.mock.calls.map((call) => call[0].skill)).toContain("b-docs");
  });

  it("uses a newly written review artifact when the worker summary omits impact headings", async () => {
    const cwd = repo();
    phased(cwd, ["pending"]);
    const choose = vi.fn(async () => ({ status: "blocked" as const, reason: "choose not expected" }));
    const deps = workDeps(async (opts) => {
      if (opts.skill === "b-review") {
        writeTree(cwd, { [`.context/${SUBJECT}/review-phase-1.md`]: CLEAN_REVIEW });
        return { ok: true, text: "Review passed; continue to save." };
      }
      return landingWork()(opts);
    }, choose);
    const result = await handleLoop({ cwd, command: "start", path: PLAN, deps });
    expect(result.state, result.reason).toBe("done");
    expect(choose).not.toHaveBeenCalled();
    expect(deps.runStep.mock.calls.map((call) => call[0].skill)).toContain("b-save");
  });

  it("saves a clean H2 review instead of asking the chooser to block", async () => {
    const cwd = repo();
    phased(cwd, ["pending"]);
    const choose = vi.fn(async () => ({ status: "blocked" as const, reason: "chooser must not run" }));
    const deps = workDeps(async (opts) => {
      if (opts.skill === "b-review") {
        writeTree(cwd, {
          [`.context/${SUBJECT}/review-phase-1.md`]: `# Review

## Documentation Impact
- No documentation impact

## How-to Impact
- No how-to impact
`,
        });
        return { ok: true, text: "Review passed." };
      }
      return landingWork()(opts);
    }, choose);
    const result = await handleLoop({ cwd, command: "start", path: PLAN, deps });
    expect(result.state, result.reason).toBe("done");
    expect(choose).not.toHaveBeenCalled();
    expect(deps.runStep.mock.calls.map((call) => call[0].skill)).toContain("b-save");
  });

  it("does not persist a whitespace-only review report", async () => {
    const cwd = repo();
    phased(cwd, ["pending"]);
    const deps = workDeps(async (opts) => {
      if (opts.skill === "b-review") return { ok: true, text: "\n  \n" };
      return landingWork()(opts);
    });
    await handleLoop({ cwd, command: "start", path: PLAN, deps });
    const names = readdirSync(join(cwd, `.context/${SUBJECT}`)).filter((name) =>
      name.startsWith("review-zz-buck-loop-"),
    );
    expect(names).toEqual([]);
  });



  it("uses the loop-written review report even when an older conventional review file exists", async () => {
    const cwd = repo();
    phased(cwd, ["pending"]);
    writeTree(cwd, {
      [`.context/${SUBJECT}/review-phase-1.md`]: DOCS_REVIEW,
    });
    const deps = workDeps(landingWork());
    const result = await handleLoop({ cwd, command: "start", path: PLAN, deps });
    expect(result.state).toBe("done");
    expect(deps.runStep.mock.calls.map((call) => call[0].skill)).not.toContain("b-docs");
    expect(deps.runStep.mock.calls.map((call) => call[0].skill)).toContain("b-save");
  });
});

describe("failure and choice", () => {
  it("retries a failed work session once, reports each structured failure, then blocks", async () => {
    const cwd = repo();
    phased(cwd, ["pending"]);
    let builds = 0;
    const onFailure = vi.fn();
    const deps = {
      ...workDeps(async (opts) => {
        if (opts.skill === "b-build") {
          builds += 1;
          return {
            ok: false,
            text: `fail-${builds}`,
            failure: {
              prompt: `prompt-${builds}`,
              agent: {
                kind: "work-session" as const,
                id: `buck-loop-work-${builds}`,
                role: "b-build",
                model: "provider/model",
              },
              error: { name: "ProviderError", message: `fail-${builds}` },
            },
          };
        }
        return landingWork()(opts);
      }),
      onFailure,
    };
    const result = await handleLoop({ cwd, command: "start", path: PLAN, deps });
    expect(result.state).toBe("blocked");
    expect(builds).toBe(2);
    expect(result.reason).toMatch(/failed again after one retry/i);
    expect(result.reason).toContain("fail-2");
    expect(readProjection(cwd)?.history.at(-1)?.why).toContain("fail-2");
    expect(onFailure).toHaveBeenCalledTimes(2);
    expect(onFailure).toHaveBeenLastCalledWith(expect.objectContaining({
      state: "building",
      operation: "run-skill",
      trying: expect.stringContaining("b-build"),
      prompt: "prompt-2",
      agent: expect.objectContaining({ id: "buck-loop-work-2", model: "provider/model" }),
      error: { name: "ProviderError", message: "fail-2" },
    }));
  });

  it("blocks when closed-set choice is rejected", async () => {
    const cwd = repo();
    phased(cwd, ["pending"]);
    const choose = vi.fn(async () => ({ status: "blocked" as const, reason: "illegal twice" }));
    const deps = workDeps(async (opts) => {
      if (opts.skill === "b-review") return { ok: true, text: UNPARSEABLE_REVIEW };
      return landingWork()(opts);
    }, choose);
    const result = await handleLoop({ cwd, command: "start", path: PLAN, deps });
    expect(result.state).toBe("blocked");
    expect(choose).toHaveBeenCalled();
    expect(deps.runStep.mock.calls.map((call) => call[0].skill)).not.toContain("b-save");
  });

  it("forwards one activity sink through work and choice calls", async () => {
    const cwd = repo();
    phased(cwd, ["pending"]);
    const onActivity = vi.fn();
    const choose = vi.fn(async (opts: { onActivity?: (event: ActivityEvent) => void }) => {
      opts.onActivity?.({ kind: "text", delta: "choice output" });
      return {
        status: "accepted" as const,
        accepted: { choice: { kind: "save" } as Choice, reason: "treat as clean" },
      };
    });
    const deps = {
      ...workDeps(async (opts) => {
        opts.onActivity?.({ kind: "text", delta: `${opts.skill} output` });
        if (opts.skill === "b-review") return { ok: true, text: UNPARSEABLE_REVIEW };
        return landingWork()(opts);
      }, choose),
      onActivity,
    };

    await expect(handleLoop({ cwd, command: "start", path: PLAN, deps })).resolves.toMatchObject({ state: "done" });
    expect(onActivity).toHaveBeenCalledWith({ kind: "text", delta: "b-build output" });
    expect(onActivity).toHaveBeenCalledWith({ kind: "text", delta: "choice output" });
  });

  it("applies only an accepted legal choice", async () => {
    const cwd = repo();
    phased(cwd, ["pending"]);
    const choose = vi.fn(async () => ({
      status: "accepted" as const,
      accepted: { choice: { kind: "save" } as Choice, reason: "treat as clean" },
    }));
    const deps = workDeps(async (opts) => {
      if (opts.skill === "b-review") return { ok: true, text: UNPARSEABLE_REVIEW };
      return landingWork()(opts);
    }, choose);
    const result = await handleLoop({ cwd, command: "start", path: PLAN, deps });
    expect(result.state).toBe("done");
    expect(readProjection(cwd)?.lastChoice).toEqual({ choice: { kind: "save" }, reason: "treat as clean" });
    expect(deps.runStep.mock.calls.map((call) => call[0].skill)).toContain("b-save");
  });

  it("blocks further work once loopCount hits maxLoops", async () => {
    const cwd = repo();
    phased(cwd, ["pending"]);
    const deps = workDeps(landingWork());
    await handleLoop({ cwd, command: "start", path: PLAN, deps });
    const projection = readProjection(cwd);
    expect(projection).not.toBeNull();
    writeFileSync(
      join(cwd, ".context/workflow/buck-loop.json"),
      JSON.stringify({ ...projection, state: "resolving", loopCount: 12, history: projection!.history }, null, 2),
    );
    mutatePhase(cwd, `.context/${SUBJECT}/phase-1-p1.md`, "pending");
    const deps2 = workDeps(landingWork());
    const result = await handleLoop({ cwd, command: "resume", deps: deps2 });
    expect(result.state).toBe("blocked");
    expect(result.reason).toMatch(/loop limit reached/i);
    expect(deps2.runStep).not.toHaveBeenCalled();
  });

  it("blocks after six iterate cycles on one phase", async () => {
    const cwd = repo();
    phased(cwd, ["pending"]);
    const deps = workDeps(async (opts) => {
      if (opts.skill === "b-review") {
        writeTree(cwd, {
          [`.context/${SUBJECT}/iterate-x.md`]: "---\nstatus: active\n---\n# Iterate\n",
        });
        return { ok: true, text: CLEAN_REVIEW };
      }
      return landingWork()(opts);
    });
    const result = await handleLoop({ cwd, command: "start", path: PLAN, deps });
    expect(result.state).toBe("blocked");
    expect(result.reason).toMatch(/iterate limit reached/i);
    expect(deps.runStep.mock.calls.map((call) => call[0].skill).filter((s) => s === "b-iterate")).toHaveLength(6);
  });
});


describe("resume", () => {
  it("artifact-wins: projection building + completed phases is done without nested work", async () => {
    const cwd = repo();
    phased(cwd, ["completed"]);
    writeTree(cwd, {
      ".context/workflow/buck-loop.json": JSON.stringify({
        version: 1,
        state: "building",
        subject: SUBJECT,
        planPath: PLAN,
        phasePath: `.context/${SUBJECT}/phase-1-p1.md`,
        loopCount: 1,
        iterateCyclesOnPhase: 0,
        maxLoops: 12,
        lastChoice: null,
        history: [{ from: "resolving", to: "building", at: NOW, why: "start" }],
      }, null, 2),
    });
    const deps = workDeps(async () => ({ ok: true, text: "nope" }));
    const result = await handleLoop({ cwd, command: "resume", deps });
    expect(result.state).toBe("done");
    expect(deps.runStep).not.toHaveBeenCalled();
  });

  it("resumes a previously blocked run through USER_CONFIRMED", async () => {
    const cwd = repo();
    phased(cwd, ["pending"]);
    const failing = workDeps(async (opts) => {
      if (opts.skill === "b-build") return { ok: false, text: "boom" };
      return landingWork()(opts);
    });
    const blocked = await handleLoop({ cwd, command: "start", path: PLAN, deps: failing });
    expect(blocked.state).toBe("blocked");
    const deps = workDeps(landingWork());
    const result = await handleLoop({ cwd, command: "resume", deps });
    expect(result.state).toBe("done");
    expect(deps.runStep).toHaveBeenCalled();
  });

  it("does not USER_CONFIRM a blocked resume when the scanned phase moved", async () => {
    const cwd = repo();
    phased(cwd, ["pending", "pending"]);
    writeTree(cwd, {
      ".context/workflow/buck-loop.json": JSON.stringify({
        version: 1,
        state: "blocked",
        subject: SUBJECT,
        planPath: PLAN,
        phasePath: `.context/${SUBJECT}/phase-1-p1.md`,
        loopCount: 1,
        iterateCyclesOnPhase: 0,
        maxLoops: 12,
        lastChoice: null,
        history: [{ from: "building", to: "blocked", at: NOW, why: "build failed twice" }],
      }, null, 2),
    });
    rmSync(join(cwd, `.context/${SUBJECT}/phase-1-p1.md`));
    const deps = workDeps(async () => ({ ok: true, text: "nope" }));
    const result = await handleLoop({ cwd, command: "resume", deps });
    expect(result.state).toBe("blocked");
    expect(deps.runStep).not.toHaveBeenCalled();
  });

});
