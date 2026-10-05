/**
 * Supervisor tests. `runStep` and `choose` are fakes so CI never calls a
 * live model. Real `scan` + `machine` + `persist` still run against a temp
 * git repo. The child's last sentence is never parsed for the next state.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cleanupRepos, git, phaseMd, phaseMdWithFiles, planMd, repo, writeTree } from "./fixtures.js";
import { handleLoop, prepareCommitCheckpoint, productionClassifyRepair } from "../loop.js";
import { runJev } from "../../jev-tool/index.js";
vi.mock("../../jev-tool/index.js", () => ({ runJev: vi.fn() }));
const judge = vi.mocked(runJev);
import { readProjection, writeProjection } from "../persist.js";
import { applySubjectLifecycleIntent, inspectSubjectLifecycle } from "../../../skills/_shared/scripts/subject-lifecycle.js";
import { completeSaveAttempt, prepareSaveAttempt, writeReceipt } from "../sql-save.js";
import type { ChooseResult } from "../choice.js";
import type { NestedSkill, RunStepResult } from "../run-step.js";
import type { ActivityEvent } from "../../extension-activity.js";
import type { Choice } from "../types.js";
import type { RankAttempt } from "../ranking.js";

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

const TELEPORT_REVIEW = `# Review

### Documentation Impact
- No Phase 2 living-document impact; the implementation follows existing conventions.

### How-to Impact
- How-to coverage is deferred to Phase 5.
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

function stampDifficulty(cwd: string, n: number, value: string): void {
  const abs = join(cwd, `.context/${SUBJECT}/phase-${n}-p${n}.md`);
  writeFileSync(abs, readFileSync(abs, "utf8").replace(/^---\n/, `---\ndifficulty: ${value}\n`));
}
function workDeps(
  runStep: (opts: {
    cwd: string;
    skill: NestedSkill;
    planOrPhasePath: string;
    difficulty?: string;
    onActivity?: (event: ActivityEvent) => void;
  }) => Promise<RunStepResult>,
  choose: (opts: {
    cwd: string;
    subject: string;
    legal: readonly Choice[];
    context?: string;
    onActivity?: (event: ActivityEvent) => void;
  }) => Promise<ChooseResult> = async () => ({ status: "blocked", reason: "choose not expected" }),
  classifyRepair: (_input: { cwd: string; sessionText: string }) => Promise<{ lift: "light" | "medium" | "heavy"; reason: string; diagnosis: string }> = async () => ({
    lift: "heavy",
    reason: "test default: heavy lift",
    diagnosis: "test diagnosis",
  }),
  ask: (state: unknown, questions: Record<string, { type: string; instructions: string; criteria?: Record<string, string> | string[] }>) => Promise<RankAttempt> = async () => ratingAnswer(4),
) {
  return {
    runStep: vi.fn(runStep),
    choose: vi.fn(choose),
    classifyRepair: vi.fn(classifyRepair),
    ask: vi.fn(ask),
    now: () => NOW,
  };
}

function mutatePhase(cwd: string, rel: string, status: string): void {
  const abs = join(cwd, rel);
  writeFileSync(abs, readFileSync(abs, "utf8").replace(/^status: .+$/m, `status: ${status}`));
}

function landingWork() {
  let saves = 0;
  return async (opts: { cwd: string; skill: NestedSkill; planOrPhasePath: string; difficulty?: string }) => {
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

const originalSqlUrl = process.env.SQL_MEMORY_URL;
beforeEach(() => { delete process.env.SQL_MEMORY_URL; });
afterEach(() => {
  cleanupRepos();
  if (originalSqlUrl === undefined) delete process.env.SQL_MEMORY_URL;
  else process.env.SQL_MEMORY_URL = originalSqlUrl;
});

/**
 * A real `iterate-*.md` the ranking parser accepts, naming `src/a.ts` so the
 * `ask` seam receives the same file text `rankIssues` sends to Jev.
 */
const RANKED_ITERATE = `---
status: active
---
# Iteration: demo
## Critical Issues
### 1. Critical defect
- **File**: src/a.ts
- **Problem**: Invalid transition admits unsafe progress.
- **Proposed fix**: Reject the transition.
## Warnings
### 1. Warning title
- **File**: src/a.ts
- **Problem**: Parsing may miss a finding.
- **Suggested approach**: Add parser coverage.
`;

/** One `ask` answer: `impact` 4 with `likelihood` 4 is High, impact 0 is below. */
function ratingAnswer(impact = 4): RankAttempt {
  return {
    raw: "bounded answer",
    details: { answers: {
      scope: { type: "choice", choice: "in_scope" },
      real: { type: "noul", noul: 0.9 },
      impact: { type: "score", score: impact },
      likelihood: { type: "score", score: 4 },
      regression: { type: "choice", choice: "pre_existing" },
    } },
  };
}

/** Native binary answers for the garbled-report gate. */
function docsAnswer(docs = "no", howto = "no"): RankAttempt {
  return { raw: "docs verdict", details: { answers: { docs: { type: "choice", choice: docs }, howto: { type: "choice", choice: howto } } } };
}

/** Route per-issue rating by title so one call can clear only the critical. */
function rankingByTitle(above: readonly string[]): (state: unknown, questions: Record<string, unknown>) => Promise<RankAttempt> {
  return async (state) => {
    const title = state && typeof state === "object" && "title" in state ? String(state.title) : "";
    return ratingAnswer(above.includes(title) ? 4 : 0);
  };
}

/**
 * Commit the file the iterate artifact names. The rank sends its current text
 * to Jev, and `/buck-loop` refuses to start on an unstaged tree.
 */
function rankedSubject(cwd: string): void {
  writeTree(cwd, { "src/a.ts": "export const current = true;\n" });
  git(cwd, ["add", "-f", "src/a.ts"]);
  git(cwd, ["commit", "-qm", "subject under review"]);
}

describe("unphased closeout resume", () => {
  function fixture(state: "done" | "blocked", criteria: string, status = "active"): string {
    const cwd = repo();
    writeTree(cwd, { [PLAN]: `---\nstatus: active\n---\n# Plan\n\n## Acceptance criteria\n${criteria}\n` });
    const subjectDir = join(cwd, ".context", SUBJECT);
    applySubjectLifecycleIntent({ kind: "initialize", subjectDir });
    applySubjectLifecycleIntent({ kind: "activate", subjectDir });
    mutatePhase(cwd, PLAN, status);
    writeProjection(cwd, {
      version: 1, state, subject: SUBJECT, planPath: PLAN, phasePath: null,
      loopCount: 1, maxLoops: 12, iterateCyclesOnPhase: 0, lastChoice: null,
      history: [{ from: "saving", to: "committing", at: NOW, why: "saved" },
        { from: "committing", to: state, at: NOW, why: state === "done" ? "unphased plan completed its single cycle" : "unphased plan remains open" }],
    });
    git(cwd, ["add", "."]);
    git(cwd, ["commit", "-qm", "implementation"]);
    return cwd;
  }

  it.each(["done", "blocked"] as const)("holds %s without work and names unchecked evidence", async (state) => {
    const cwd = fixture(state, "- [ ] Observed evidence");
    const deps = workDeps(async () => ({ ok: false, text: "unexpected work" }));
    const result = await handleLoop({ cwd, command: "resume", deps });
    expect(result.state).toBe("blocked");
    expect(result.reason).toContain("- [ ] Observed evidence");
    expect(deps.runStep).not.toHaveBeenCalled();
  });

  it.each(["\n## Acceptance criteria\n- [ ] Implementation not yet verified\n", ""])(
    "resumes ordinary unfinished unphased work with acceptance section %j",
    async (acceptance) => {
      const cwd = fixture("blocked", "- [ ] Implementation not yet verified");
      writeFileSync(join(cwd, PLAN), `---\nstatus: active\n---\n# Interrupted plan\n${acceptance}`);
      git(cwd, ["add", "."]);
      git(cwd, ["commit", "-qm", "unfinished plan"]);
      writeProjection(cwd, {
        ...readProjection(cwd)!,
        history: [{ from: "building", to: "blocked", at: NOW, why: "nested build interrupted; environment repaired" }],
      });
      const deps = workDeps(async () => ({ ok: false, text: "observed resumed build boundary" }));
      const result = await handleLoop({ cwd, command: "resume", deps });
      expect(deps.runStep.mock.calls[0]?.[0]).toMatchObject({ skill: "b-build", planOrPhasePath: PLAN });
      expect(result.state).toBe("blocked");
      expect(result.reason).not.toContain("unphased plan remains open");
      expect(readFileSync(join(cwd, PLAN), "utf8")).toContain("status: active");
      expect(inspectSubjectLifecycle(join(cwd, ".context", SUBJECT)).state).toBe("active");
    },
  );

  it.each(["done", "blocked"] as const)("repairs eligible %s with verified closeout and no work", async (state) => {
    const cwd = fixture(state, "- [x] Observed evidence");
    const deps = workDeps(async () => ({ ok: false, text: "unexpected work" }));
    const result = await handleLoop({ cwd, command: "resume", deps });
    expect(result.state).toBe("done");
    expect(deps.runStep).not.toHaveBeenCalled();
    expect(readFileSync(join(cwd, PLAN), "utf8")).toContain("status: completed");
    expect(inspectSubjectLifecycle(join(cwd, ".context", SUBJECT)).state).toBe("completed");
    expect(readProjection(cwd)?.state).toBe("done");
  });

  it("preserves lifecycle refusal without starting work", async () => {
    const cwd = fixture("done", "- [x] Observed evidence");
    writeTree(cwd, { [`.context/${SUBJECT}/plan-other.md`]: "---\nstatus: active\n---\n# Other\n" });
    git(cwd, ["add", "."]);
    git(cwd, ["commit", "-qm", "other plan"]);
    const deps = workDeps(async () => ({ ok: false, text: "unexpected work" }));
    const result = await handleLoop({ cwd, command: "resume", deps });
    expect(result.state).toBe("blocked");
    expect(result.reason).toContain("plan-other.md: unphased plan remains open");
    expect(deps.runStep).not.toHaveBeenCalled();
    expect(inspectSubjectLifecycle(join(cwd, ".context", SUBJECT)).state).toBe("active");
  });

  it("holds eligible repair on a dirty context tree", async () => {
    const cwd = fixture("done", "- [x] Observed evidence");
    writeTree(cwd, { [`.context/${SUBJECT}/note.md`]: "# Uncommitted\n" });
    const deps = workDeps(async () => ({ ok: false, text: "unexpected work" }));
    const result = await handleLoop({ cwd, command: "resume", deps });
    expect(result.state).toBe("blocked");
    expect(result.reason).toContain("clean worktree");
    expect(deps.runStep).not.toHaveBeenCalled();
  });

  it.each(["active", "completed"])("uses status-only evidence for a no-list %s plan", async (status) => {
    const cwd = fixture("done", "", status);
    writeFileSync(join(cwd, PLAN), `---\nstatus: ${status}\n---\n# No acceptance list\n`);
    git(cwd, ["add", "."]);
    git(cwd, ["commit", "-qm", "status-only evidence"]);
    const deps = workDeps(async () => ({ ok: false, text: "unexpected work" }));
    const result = await handleLoop({ cwd, command: "resume", deps });
    expect(result.state).toBe(status === "completed" ? "done" : "blocked");
    if (status === "active") expect(result.reason).toContain("unphased plan remains open");
    expect(deps.runStep).not.toHaveBeenCalled();
  });

  it("requires committing history for eligible repair", async () => {
    const cwd = fixture("done", "- [x] Observed evidence", "completed");
    const projection = readProjection(cwd)!;
    writeProjection(cwd, { ...projection, history: [] });
    const deps = workDeps(async () => ({ ok: false, text: "unexpected work" }));
    const result = await handleLoop({ cwd, command: "resume", deps });
    expect(result.state).toBe("blocked");
    expect(result.reason).toContain("committing history");
    expect(deps.runStep).not.toHaveBeenCalled();
    expect(inspectSubjectLifecycle(join(cwd, ".context", SUBJECT)).state).toBe("active");
  });
});

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

  it("warns and asks before starting over unrelated dirty files", async () => {
    const cwd = repo();
    phased(cwd, ["pending"]);
    writeTree(cwd, { "src/unrelated.ts": "export {}\n" });
    const deps = workDeps(async () => ({ ok: true, text: "landed" }));
    const confirmDirty = vi.fn(async () => true);
    const onWarning = vi.fn();
    const result = await handleLoop({ cwd, command: "start", path: PLAN, deps: { ...deps, confirmDirty, onWarning } });
    expect(confirmDirty).toHaveBeenCalledWith(expect.arrayContaining([expect.stringContaining("src/unrelated.ts")]));
    expect(onWarning).toHaveBeenCalled();
    expect(deps.runStep).toHaveBeenCalled();
    expect(result.reason).not.toMatch(/dirty/);
  });

  it("asks about unstaged dirt and continues when the operator does", async () => {
    const cwd = repo();
    phased(cwd, ["pending"]);
    writeTree(cwd, { "src/unrelated.ts": "export {}\n" });
    const deps = workDeps(async () => ({ ok: true, text: "landed" }));
    const confirmDirty = vi.fn(async () => true);
    const result = await handleLoop({ cwd, command: "start", path: PLAN, deps: { ...deps, confirmDirty } });
    expect(confirmDirty).toHaveBeenCalled();
    expect(deps.runStep).toHaveBeenCalled();
    expect(result.reason).not.toMatch(/dirty/);
  });

  it("stops a dirty tree when the operator declines without persisting blocked", async () => {
    const cwd = repo();
    phased(cwd, ["pending"]);
    writeTree(cwd, { "src/unrelated.ts": "export {}\n" });
    const deps = workDeps(async () => ({ ok: true, text: "nope" }));
    const confirmDirty = vi.fn(async () => false);
    const result = await handleLoop({ cwd, command: "start", path: PLAN, deps: { ...deps, confirmDirty } });
    expect(result).toEqual({ state: "aborted", reason: "working tree is dirty; operator did not continue" });
    expect(deps.runStep).not.toHaveBeenCalled();
    expect(readProjection(cwd)?.state).not.toBe("blocked");
  });


  it("asks before resuming a non-blocked run with staged dirt", async () => {
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
    git(cwd, ["add", "src/unrelated.ts"]);
    const deps = workDeps(async () => ({ ok: true, text: "nope" }));
    const confirmDirty = vi.fn(async () => false);
    const result = await handleLoop({ cwd, command: "resume", deps: { ...deps, confirmDirty } });
    expect(confirmDirty).toHaveBeenCalled();
    expect(result.state).toBe("aborted");
    expect(result.reason).toMatch(/dirty/);
    expect(deps.runStep).not.toHaveBeenCalled();
  });

  it("refuses resume on a protected branch before nested work", async () => {
    const cwd = repo();
    phased(cwd, ["pending"]);
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
    git(cwd, ["checkout", "-q", "-b", "master"]);
    const deps = workDeps(async () => ({ ok: true, text: "nope" }));
    const result = await handleLoop({ cwd, command: "resume", deps });
    expect(result.state).toBe("blocked");
    expect(result.reason).toMatch(/protected branch master/);
    expect(deps.runStep).not.toHaveBeenCalled();
  });

  it("refuses an unreadable resume projection before nested work", async () => {
    const cwd = repo();
    writeTree(cwd, { ".context/workflow/buck-loop.json": "{not-json\n" });
    const deps = workDeps(async () => ({ ok: true, text: "nope" }));
    const result = await handleLoop({ cwd, command: "resume", deps });
    expect(result).toEqual({ state: "blocked", reason: "unreadable projection" });
    expect(deps.runStep).not.toHaveBeenCalled();
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

  it("writes status from checked criteria and reviews instead of retrying the build", async () => {
    const cwd = repo();
    phased(cwd, ["pending"]);
    const phase = join(cwd, `.context/${SUBJECT}/phase-1-p1.md`);
    writeFileSync(phase, readFileSync(phase, "utf8").replace(
      "dependency_type: NONE\n",
      "dependency_type: NONE\nacceptance_criteria:\n- \"[ ] landed\"\ncompleted_at: null\n",
    ));
    const deps = workDeps(async (opts) => {
      if (opts.skill === "b-build") {
        const abs = join(opts.cwd, opts.planOrPhasePath);
        writeFileSync(abs, readFileSync(abs, "utf8").replace("[ ] landed", "[x] landed"));
        return { ok: true, text: "built" };
      }
      return landingWork()(opts);
    });
    const result = await handleLoop({ cwd, command: "start", path: PLAN, deps });
    expect(result.state, result.reason).toBe("done");
    const text = readFileSync(phase, "utf8");
    expect(text).toMatch(/^status: completed$/m);
    expect(text).toMatch(/^completed_at: 2026-09-18$/m);
    expect(deps.runStep.mock.calls.map((call) => call[0].skill)).toContain("b-review");
    expect(deps.choose).not.toHaveBeenCalled();
  });

  it("uses difficulty only to select the hard build prompt skill", async () => {
    const cwd = repo();
    phased(cwd, ["pending", "pending", "pending", "pending"]);
    stampDifficulty(cwd, 1, "hard");
    stampDifficulty(cwd, 2, "not-hard");
    stampDifficulty(cwd, 3, "easy");
    const deps = workDeps(landingWork());
    const result = await handleLoop({ cwd, command: "start", path: PLAN, deps });
    expect(result.state, result.reason).toBe("done");
    const builds = deps.runStep.mock.calls
      .map((call) => call[0])
      .filter((call) => call.skill === "b-build" || call.skill === "b-build-hard");
    expect(builds.map((call) => [call.skill, call.difficulty])).toEqual([
      ["b-build-hard", "hard"],
      ["b-build", "not-hard"],
      ["b-build", "easy"],
      ["b-build", undefined],
    ]);
    expect(builds.every((call) => !("modelPattern" in call))).toBe(true);
  });

  it("records a named-stage profile stop on the loop block", async () => {
    const cwd = repo();
    phased(cwd, ["pending"]);
    const stop = 'buckModels profile "work" is missing stage "build"';
    const deps = workDeps(async (opts) => {
      if (opts.skill === "b-build" || opts.skill === "b-build-hard") {
        return { ok: false, text: stop, failure: { prompt: "prompt", agent: { kind: "work-session", id: "stopped", role: opts.skill }, error: { name: "BuckModelStop", message: stop } } };
      }
      return landingWork()(opts);
    });
    const result = await handleLoop({ cwd, command: "start", path: PLAN, deps });
    expect(result.state).toBe("blocked");
    expect(result.reason).toContain('stage "build"');
    expect(readProjection(cwd)?.history.at(-1)?.why).toContain('stage "build"');
  });

  it("ranks the review artifact before iterating, then re-reviews", async () => {
    const cwd = repo();
    phased(cwd, ["pending"]);
    rankedSubject(cwd);
    let reviews = 0;
    const ask = vi.fn(rankingByTitle(["Critical defect"]));
    const deps = workDeps(async (opts) => {
      if (opts.skill === "b-review") {
        reviews += 1;
        if (reviews === 1) {
          writeTree(cwd, { [`.context/${SUBJECT}/iterate-x.md`]: RANKED_ITERATE });
          return { ok: true, text: CLEAN_REVIEW };
        }
      }
      return landingWork()(opts);
    }, undefined, undefined, ask);
    const result = await handleLoop({ cwd, command: "start", path: PLAN, deps });
    expect(result.state, result.reason).toBe("done");
    const skills = deps.runStep.mock.calls.map((call) => call[0].skill);
    expect(skills).toContain("b-iterate");
    expect(skills.filter((s) => s === "b-review").length).toBeGreaterThan(1);
    // Ranking happens in-process: no nested session, no chooser.
    expect(ask).toHaveBeenCalled();
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

  it("routes the Teleport deferred-impact report directly to save", async () => {
    const cwd = repo();
    phased(cwd, ["completed", "pending"]);
    const choose = vi.fn(async () => ({ status: "blocked" as const, reason: "chooser must not run" }));
    const deps = workDeps(async (opts) => {
      if (opts.skill === "b-review") return { ok: true, text: TELEPORT_REVIEW };
      return landingWork()(opts);
    }, choose);
    const result = await handleLoop({ cwd, command: "start", path: PLAN, deps });
    expect(result.state, result.reason).toBe("done");
    const skills = deps.runStep.mock.calls.map((call) => call[0].skill);
    expect(skills).toContain("b-save");
    expect(skills).not.toContain("b-docs");
    expect(skills).not.toContain("b-howto");
    expect(choose).not.toHaveBeenCalled();
  });

  it("advances stale documenting work when corrected review facts are clean", async () => {
    const cwd = repo();
    phased(cwd, ["pending"]);
    const choose = vi.fn(async () => ({ status: "blocked" as const, reason: "chooser must not run" }));
    const deps = workDeps(async (opts) => {
      if (opts.skill === "b-review") return { ok: true, text: DOCS_REVIEW };
      if (opts.skill === "b-docs") {
        writeTree(cwd, { [`.context/${SUBJECT}/review-zzz-corrected.md`]: CLEAN_REVIEW });
        return { ok: true, text: "No current impact after correction." };
      }
      return landingWork()(opts);
    }, choose);
    const result = await handleLoop({ cwd, command: "start", path: PLAN, deps });
    expect(result.state, result.reason).toBe("done");
    expect(deps.runStep.mock.calls.map((call) => call[0].skill)).toContain("b-save");
    expect(choose).not.toHaveBeenCalled();
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

  it("retries once when the supervisor can fix an ambiguous build", async () => {
    const cwd = repo();
    phased(cwd, ["pending"]);
    let builds = 0;
    const classifyRepair = vi.fn(async (opts: { snapshot: { planPath: string | null; phasePath: string | null; workFacts: { postcondition: string; sessionOutcome: string; retriesUsed: number } }; why: string }) => {
      expect(opts.snapshot.planPath).toBe(PLAN);
      expect(opts.snapshot.phasePath).toBe(`.context/${SUBJECT}/phase-1-p1.md`);
      expect(opts.snapshot.workFacts).toMatchObject({ postcondition: "ambiguous", sessionOutcome: "ok", retriesUsed: 0 });
      expect(opts.why).toMatch(/ambiguous/i);
      return { lift: "light" as const, reason: "agent can finish", diagnosis: "finish the unchecked retrieval" };
    });
    const deps = workDeps(
      async (opts) => {
        if (opts.skill === "b-build" || opts.skill === "b-build-hard") {
          builds += 1;
          return { ok: true, text: "held" };
        }
        return landingWork()(opts);
      },
      async () => ({ status: "blocked", reason: "choose not expected" }),
      classifyRepair,
    );
    const result = await handleLoop({ cwd, command: "start", path: PLAN, deps });
    expect(result.state).toBe("blocked");
    expect(builds).toBe(2);
    expect(deps.choose).not.toHaveBeenCalled();
    expect(result.reason).toMatch(/still ambiguous after one retry/i);
  });

  it("passes bounded ambiguity evidence to Jev and audits a light retry before work", async () => {
    const cwd = repo();
    phased(cwd, ["pending"]);
    vi.mocked(runJev).mockResolvedValueOnce({
      raw: "light", details: { answers: { lift: { choice: "light" } } },
    });
    const deps = workDeps(async () => ({ ok: true, text: "Runtime SQL retrieval is not implemented." }));
    const result = await handleLoop({
      cwd, command: "start", path: PLAN,
      deps: { runStep: deps.runStep, choose: deps.choose, now: deps.now },
    });
    expect(result.state).toBe("blocked");
    const state = vi.mocked(runJev).mock.calls[0]?.[1].state;
    expect(state).toContain(`plan=${PLAN} phase=.context/${SUBJECT}/phase-1-p1.md`);
    expect(state).toContain("postcondition=ambiguous");
    expect(state).toContain("Child report: Runtime SQL retrieval is not implemented.");
    const audits = readdirSync(join(cwd, `.context/${SUBJECT}/transition-audits`));
    const audit = JSON.parse(readFileSync(join(cwd, `.context/${SUBJECT}/transition-audits`, audits[0]!), "utf8"));
    expect(audit).toMatchObject({ source: "repair-lift", accepted: true, lift: "light", context: state });
    expect(readProjection(cwd)?.history.some((entry) => entry.why.includes("Jev classified the repair as light"))).toBe(true);
    vi.mocked(runJev).mockReset();
  });

  it("audits an illegal ambiguity lift and hands it to the operator without retry", async () => {
    const cwd = repo();
    phased(cwd, ["pending"]);
    vi.mocked(runJev).mockResolvedValueOnce({
      raw: "invented", details: { answers: { lift: { choice: "invented" } } },
    });
    const deps = workDeps(async () => ({ ok: true, text: "Missing disposable database." }));
    const result = await handleLoop({
      cwd, command: "start", path: PLAN,
      deps: { runStep: deps.runStep, choose: deps.choose, now: deps.now },
    });
    expect(result.state).toBe("blocked");
    expect(deps.runStep).toHaveBeenCalledTimes(1);
    const audits = readdirSync(join(cwd, `.context/${SUBJECT}/transition-audits`));
    const audit = JSON.parse(readFileSync(join(cwd, `.context/${SUBJECT}/transition-audits`, audits[0]!), "utf8"));
    expect(audit).toMatchObject({ source: "repair-lift", accepted: false, lift: "heavy" });
    expect(audit.context).toContain("Missing disposable database.");
    vi.mocked(runJev).mockReset();
  });

  it("blocks without retry when the ambiguity audit cannot be written", async () => {
    const cwd = repo();
    phased(cwd, ["pending"]);
    writeFileSync(join(cwd, `.context/${SUBJECT}/transition-audits`), "not a directory");
    vi.mocked(runJev).mockResolvedValueOnce({
      raw: "medium", details: { answers: { lift: { choice: "medium" } } },
    });
    const deps = workDeps(async () => ({ ok: true, text: "Same phase remains unfinished." }));
    const result = await handleLoop({
      cwd, command: "start", path: PLAN,
      deps: { runStep: deps.runStep, choose: deps.choose, now: deps.now },
    });
    expect(result.state).toBe("blocked");
    expect(result.reason).toContain("could not audit ambiguity lift");
    expect(deps.runStep).toHaveBeenCalledTimes(1);
    expect(readProjection(cwd)?.history.at(-1)?.why).toContain("could not audit ambiguity lift");
    vi.mocked(runJev).mockReset();
  });

  it("does not treat pre-existing loop-extension dirt as a repair from the retry", async () => {
    const cwd = repo();
    phased(cwd, ["pending"]);
    writeTree(cwd, { "extensions/buck-loop/prior.ts": "before\n" });
    git(cwd, ["add", "extensions/buck-loop/prior.ts"]);
    const deps = workDeps(
      async () => ({ ok: true, text: "held" }),
      async () => ({ status: "blocked", reason: "choose not expected" }),
      async () => ({ lift: "light" as const, reason: "can retry", diagnosis: "finish the same slice" }),
    );
    const result = await handleLoop({ cwd, command: "start", path: PLAN, deps: { ...deps, confirmDirty: async () => true } });
    expect(deps.runStep).toHaveBeenCalledTimes(2);
    expect(result.reason).toMatch(/still ambiguous after one retry/i);
    expect(result.reason).not.toMatch(/Restart OMP/);
  });

  it("detects a repair to a loop-extension file that was already dirty", async () => {
    const cwd = repo();
    phased(cwd, ["pending"]);
    writeTree(cwd, { "extensions/buck-loop/prior.ts": "before\n" });
    git(cwd, ["add", "extensions/buck-loop/prior.ts"]);
    let builds = 0;
    const deps = workDeps(
      async () => {
        builds += 1;
        if (builds === 2) writeTree(cwd, { "extensions/buck-loop/prior.ts": "after\n" });
        return { ok: true, text: "held" };
      },
      async () => ({ status: "blocked", reason: "choose not expected" }),
      async () => ({ lift: "medium" as const, reason: "can retry", diagnosis: "finish the same slice" }),
    );
    const result = await handleLoop({ cwd, command: "start", path: PLAN, deps: { ...deps, confirmDirty: async () => true } });
    expect(result.reason).toMatch(/Restart OMP before continuing/);
    expect(result.reason).toContain("extensions/buck-loop/prior.ts");
  });

  it("stops after repairing the running buck-loop extension", async () => {
    const cwd = repo();
    phased(cwd, ["pending"]);
    let builds = 0;
    const deps = workDeps(
      async (opts) => {
        if (opts.skill === "b-build" || opts.skill === "b-build-hard") {
          builds += 1;
          if (builds === 2) writeTree(cwd, { "extensions/buck-loop/touched.ts": "export const touched = true;\n" });
          return { ok: true, text: "repaired extension" };
        }
        return landingWork()(opts);
      },
      async () => ({ status: "blocked", reason: "choose not expected" }),
      async () => ({ lift: "light" as const, reason: "agent can finish", diagnosis: "finish the unchecked retrieval" }),
    );
    const warnings: string[] = [];
    const result = await handleLoop({
      cwd,
      command: "start",
      path: PLAN,
      deps: { ...deps, onWarning: (message) => warnings.push(message), confirmContinue: vi.fn(async () => true) },
    });
    expect(deps.runStep.mock.calls.map((call) => call[0].skill)).not.toContain("b-review");
    expect(result.state).toBe("blocked");
    expect(result.reason).toMatch(/Restart OMP before continuing/);
    expect(result.reason).toContain("extensions/buck-loop/touched.ts");
    expect(warnings.join("\n")).toMatch(/Restart OMP before continuing/);
    expect(deps.runStep).toHaveBeenCalledTimes(2);
    for (const command of ["resume", "start"] as const) {
      const again = await handleLoop({ cwd, command, path: PLAN, deps: { ...deps, confirmDirty: async () => true } });
      expect(again).toEqual({ state: "blocked", reason: result.reason });
    }
    expect(deps.runStep).toHaveBeenCalledTimes(2);
  });

  it("stops an ambiguous build that needs the operator", async () => {
    const cwd = repo();
    phased(cwd, ["pending"]);
    const phase = join(cwd, `.context/${SUBJECT}/phase-1-p1.md`);
    writeFileSync(phase, readFileSync(phase, "utf8").replace(
      "dependency_type: NONE\n",
      "dependency_type: NONE\nacceptance_criteria:\n  - \"[ ] Live SELECT against disposable DB\"\n",
    ) + "\n## Execution checkpoint\nDisposable target has not been supplied. Child proof has not run.\n");
    let builds = 0;
    const deps = workDeps(async (opts) => {
      if (opts.skill === "b-build" || opts.skill === "b-build-hard") {
        builds += 1;
        return { ok: true, text: "held" };
      }
      return landingWork()(opts);
    });
    const confirmContinue = vi.fn(async () => true);
    const result = await handleLoop({ cwd, command: "start", path: PLAN, deps: { ...deps, confirmContinue } });
    expect(builds).toBe(1);
    expect(deps.choose).not.toHaveBeenCalled();
    expect(confirmContinue).not.toHaveBeenCalled();
    expect(result.state).toBe("blocked");
    expect(result.reason).toMatch(/heavy lift/i);
    expect(result.reason).toContain("phase status is pending, not completed");
    expect(result.reason).toContain("[ ] Live SELECT against disposable DB");
    expect(result.reason).toContain("Disposable target has not been supplied.");
  });

  it("hands the child report to the lift call and the diagnosis to the automatic retry", async () => {
    const cwd = repo();
    phased(cwd, ["pending"]);
    const deps = workDeps(
      async () => ({ ok: true, text: "Runtime SQL retrieval is not implemented." }),
      async () => ({ status: "blocked", reason: "choose not expected" }),
      async ({ sessionText }) => ({
        lift: "light",
        reason: "same assignment",
        diagnosis: `finish retrieval after: ${sessionText}`,
      }),
    );
    await handleLoop({ cwd, command: "start", path: PLAN, deps });
    expect(deps.classifyRepair).toHaveBeenCalledWith(expect.objectContaining({
      sessionText: "Runtime SQL retrieval is not implemented.",
    }));
    const retryHandoff = deps.runStep.mock.calls[1]?.[0].handoff;
    expect(retryHandoff).toContain("finish retrieval after: Runtime SQL retrieval is not implemented.");
  });


  it("marks a phase completed when every acceptance box is already checked", async () => {
    const cwd = repo();
    phased(cwd, ["in-progress"]);
    const phase = join(cwd, `.context/${SUBJECT}/phase-1-p1.md`);
    writeFileSync(phase, readFileSync(phase, "utf8").replace(
      "dependency_type: NONE\n",
      "dependency_type: NONE\nacceptance_criteria:\n  - \"[x] landed\"\n",
    ));
    const deps = workDeps(async (opts) => {
      if (opts.skill === "b-build" || opts.skill === "b-build-hard") return { ok: true, text: "held" };
      return landingWork()(opts);
    });
    const result = await handleLoop({ cwd, command: "start", path: PLAN, deps });
    expect(readFileSync(phase, "utf8")).toMatch(/^status: completed$/m);
    expect(deps.classifyRepair).not.toHaveBeenCalled();
    expect(result.state).toBe("done");
  });

  it("retries a first review failure after a confirmed build", async () => {
    const cwd = repo();
    phased(cwd, ["pending"]);
    let reviews = 0;
    const deps = workDeps(async (opts) => {
      if (opts.skill === "b-build" || opts.skill === "b-build-hard") {
        mutatePhase(cwd, opts.planOrPhasePath, "completed");
        return { ok: true, text: "landed" };
      }
      if (opts.skill === "b-review") {
        reviews += 1;
        return { ok: false, text: `review-fail-${reviews}` };
      }
      return landingWork()(opts);
    });
    const result = await handleLoop({ cwd, command: "start", path: PLAN, deps });
    expect(reviews).toBe(2);
    expect(result.state).toBe("blocked");
    expect(result.reason).toMatch(/failed again after one retry/i);
  });

  it("blocks when closed-set choice is rejected", async () => {
    const cwd = repo();
    phased(cwd, ["pending"]);
    const choose = vi.fn(async (opts: { context?: string }) => {
      expect(opts.context).toContain(`plan=${PLAN}`);
      expect(opts.context).toContain(`phase=.context/${SUBJECT}/phase-1-p1.md`);
      expect(opts.context).toContain("state=reviewing");
      expect(opts.context).toContain("why=");
      expect(opts.context).toContain("parseable=false");
      expect(opts.context).toContain("sessionOutcome=ok");
      expect(opts.context).toContain("postcondition=confirmed");
      return { status: "blocked" as const, reason: "illegal twice" };
    });
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

  it("stops iterating at the ceiling when a ranked issue is still above the waterline", async () => {
    const cwd = repo();
    phased(cwd, ["pending"]);
    rankedSubject(cwd);
    const deps = workDeps(async (opts) => {
      if (opts.skill === "b-review") {
        writeTree(cwd, { [`.context/${SUBJECT}/iterate-x.md`]: RANKED_ITERATE });
        return { ok: true, text: CLEAN_REVIEW };
      }
      return landingWork()(opts);
    });
    const result = await handleLoop({ cwd, command: "start", path: PLAN, deps });
    expect(result.state).toBe("blocked");
    expect(result.reason).toMatch(/iterate limit reached/i);
    expect(deps.runStep.mock.calls.map((call) => call[0].skill).filter((s) => s === "b-iterate")).toHaveLength(6);
  });

  it("moves past the iterate ceiling when nothing is above the waterline (grill Q2)", async () => {
    const cwd = repo();
    phased(cwd, ["pending"]);
    rankedSubject(cwd);
    const deps = workDeps(async (opts) => {
      if (opts.skill === "b-review") {
        writeTree(cwd, { [`.context/${SUBJECT}/iterate-x.md`]: RANKED_ITERATE });
        return { ok: true, text: CLEAN_REVIEW };
      }
      return landingWork()(opts);
    }, undefined, undefined, rankingByTitle([]));
    const result = await handleLoop({ cwd, command: "start", path: PLAN, deps });
    expect(result.state, result.reason).toBe("done");
    expect(deps.runStep.mock.calls.map((call) => call[0].skill)).not.toContain("b-iterate");
  });
});

describe("in-process rank effect", () => {
  /**
   * One review that leaves an iterate artifact, then the ordinary landing tail.
   * `report` is the worker's review text; `ask` is the judgment seam. Only the
   * first review writes the artifact, so the re-review after an iterate finds
   * a clean phase instead of re-opening the same finding forever.
   */
  function rankedRun(
    ask: (state: unknown, questions: Record<string, unknown>) => Promise<RankAttempt>,
    report = CLEAN_REVIEW,
    iterate = RANKED_ITERATE,
    choose: (opts: { cwd: string; subject: string; legal: readonly Choice[] }) => Promise<ChooseResult> = async () => ({ status: "blocked", reason: "choose not expected" }),
  ) {
    const cwd = repo();
    phased(cwd, ["pending"]);
    rankedSubject(cwd);
    let reviews = 0;
    const deps = workDeps(async (opts) => {
      if (opts.skill === "b-review") {
        reviews += 1;
        if (reviews === 1) writeTree(cwd, { [`.context/${SUBJECT}/iterate-x.md`]: iterate });
        return { ok: true, text: report };
      }
      return landingWork()(opts);
    }, choose, undefined, ask);
    return { cwd, deps };
  }

  /** Chooser that takes the first legal continuation, so the A-11 choice can run. */
  const acceptFirst = async (opts: { legal: readonly Choice[] }): Promise<ChooseResult> => ({
    status: "accepted",
    accepted: { choice: opts.legal[0]!, reason: "test chooser" },
  });

  it("ranks in-process: no nested session, no choose, and no counter moves for the rank call", async () => {
    const { cwd, deps } = rankedRun(rankingByTitle(["Critical defect"]));
    const result = await handleLoop({ cwd, command: "start", path: PLAN, deps });
    expect(result.state, result.reason).toBe("done");

    const beforeRank = readProjection(cwd);
    expect(beforeRank).not.toBeNull();
    // The rank transition is a supervisor hop, not a build loop or an iterate cycle.
    const rankHop = beforeRank!.history.find((entry) => entry.to === "ranking");
    expect(rankHop?.from).toBe("reviewing");
    expect(beforeRank!.loopCount).toBe(1);
    expect(beforeRank!.iterateCyclesOnPhase).toBe(0);

    const rankHistory = readProjection(cwd)!.history;
    const rankIndex = rankHistory.findIndex((entry) => entry.to === "ranking");
    const iterateIndex = rankHistory.findIndex((entry) => entry.to === "iterating");
    expect(iterateIndex).toBeGreaterThan(rankIndex);
  });

  it("spawns no nested skill session and never calls choose while ranking", async () => {
    const { cwd, deps } = rankedRun(rankingByTitle(["Critical defect"]));
    await handleLoop({ cwd, command: "start", path: PLAN, deps });
    // b-iterate only runs after the rank; no b-review or b-iterate is spawned
    // from inside the rank call itself, and the chooser stays untouched.
    const skills = deps.runStep.mock.calls.map((call) => call[0].skill);
    expect(skills.indexOf("b-iterate")).toBeGreaterThan(0);
    expect(deps.choose).not.toHaveBeenCalled();
  });

  it("keeps only above-waterline ids in the iterate artifact and writes the audit first", async () => {
    const { cwd, deps } = rankedRun(rankingByTitle(["Critical defect"]));
    const result = await handleLoop({ cwd, command: "start", path: PLAN, deps });
    expect(result.state, result.reason).toBe("done");

    const artifact = readFileSync(join(cwd, `.context/${SUBJECT}/iterate-x.md`), "utf8");
    expect(artifact).toContain("Critical defect");
    expect(artifact).not.toContain("Warning title");

    const audit = readdirSync(join(cwd, ".context", SUBJECT)).filter((name) => /^ranking-.*\.md$/.test(name));
    expect(audit).toHaveLength(1);
    const auditText = readFileSync(join(cwd, ".context", SUBJECT, audit[0]!), "utf8");
    expect(auditText).toContain("## critical:1");
    expect(auditText).toContain("above waterline");
    expect(auditText).toContain("below waterline");
  });

  it("marks the artifact below-waterline and skips docs/save choice when nothing clears", async () => {
    const { cwd, deps } = rankedRun(rankingByTitle([]));
    const result = await handleLoop({ cwd, command: "start", path: PLAN, deps });
    expect(result.state, result.reason).toBe("done");
    const artifact = readFileSync(join(cwd, `.context/${SUBJECT}/iterate-x.md`), "utf8");
    expect(artifact).toContain("status: below-waterline");
    // A clear report states its own impact, so no docs judgment is spent.
    const questions = deps.ask.mock.calls.flatMap((call) => Object.keys(call[1] as Record<string, unknown>));
    expect(questions).not.toContain("docs");
    expect(deps.choose).not.toHaveBeenCalled();
  });

  it("judges a garbled report once and routes to documenting when docs impact clears", async () => {
    const { cwd, deps } = rankedRun(
      (_state, questions) => Promise.resolve("docs" in (questions as Record<string, unknown>) ? docsAnswer("yes") : ratingAnswer(0)),
      UNPARSEABLE_REVIEW,
    );
    const result = await handleLoop({ cwd, command: "start", path: PLAN, deps });
    expect(result.state, result.reason).toBe("done");
    const skills = deps.runStep.mock.calls.map((call) => call[0].skill);
    expect(skills).toContain("b-docs");
    const docsCalls = deps.ask.mock.calls.filter((call) => "docs" in (call[1] as Record<string, unknown>));
    expect(docsCalls).toHaveLength(1);
  });

  it("retries a failed docs evaluation once with the same seam, then saves on the retry", async () => {
    let attempts = 0;
    const { cwd, deps } = rankedRun((state, questions) => {
      if ("docs" in (questions as Record<string, unknown>)) {
        attempts += 1;
        if (attempts === 1) return Promise.reject(new Error("Jev unavailable"));
        return Promise.resolve(docsAnswer());
      }
      return Promise.resolve(ratingAnswer(0));
    }, UNPARSEABLE_REVIEW);
    const result = await handleLoop({ cwd, command: "start", path: PLAN, deps });
    expect(result.state, result.reason).toBe("done");
    expect(attempts).toBe(2);
    const skills = deps.runStep.mock.calls.map((call) => call[0].skill);
    expect(skills).not.toContain("b-docs");
    expect(skills).toContain("b-save");
  });

  it("retries incomplete documentation answers instead of silently treating them as no impact", async () => {
    let attempts = 0;
    const { cwd, deps } = rankedRun((_state, questions) => {
      if (!("docs" in questions)) return Promise.resolve(ratingAnswer(0));
      attempts += 1;
      return Promise.resolve(attempts === 1
        ? { raw: "partial", details: { answers: { docs: { type: "choice", choice: "no" } } } }
        : docsAnswer("no", "yes"));
    }, UNPARSEABLE_REVIEW);
    const result = await handleLoop({ cwd, command: "start", path: PLAN, deps });
    expect(result.state, result.reason).toBe("done");
    expect(attempts).toBe(2);
    expect(deps.runStep.mock.calls.map((call) => call[0].skill)).toContain("b-docs");
  });

  it("opens the closed document/save choice when the docs evaluation fails twice (A-11)", async () => {
    const { cwd, deps } = rankedRun((state, questions) => {
      if ("docs" in (questions as Record<string, unknown>)) return Promise.reject(new Error("Jev unavailable"));
      return Promise.resolve(ratingAnswer(0));
    }, UNPARSEABLE_REVIEW, RANKED_ITERATE, acceptFirst);
    const result = await handleLoop({ cwd, command: "start", path: PLAN, deps });
    expect(result.state, result.reason).toBe("done");
    // A-11: the choice offers document or save, never iterate.
    const legal = deps.choose.mock.calls.flatMap((call) => (call[0].legal as readonly Choice[]).map((choice) => choice.kind));
    expect(legal.length).toBeGreaterThan(0);
    expect(new Set(legal)).toEqual(new Set(["document", "save"]));
    const skills = deps.runStep.mock.calls.map((call) => call[0].skill);
    expect(skills).not.toContain("b-iterate");
  });

  it("retries a per-issue rating once through the same ask seam and records the note (A-4/R-1)", async () => {
    const seen: string[] = [];
    const { cwd, deps } = rankedRun((state, questions) => {
      const title = state && typeof state === "object" && "title" in state ? String(state.title) : "";
      if ("scope" in (questions as Record<string, unknown>)) {
        seen.push(title);
        if (title === "Warning title" && seen.filter((t) => t === "Warning title").length === 1) {
          return Promise.reject(new Error("Jev unavailable"));
        }
      }
      return Promise.resolve(ratingAnswer(0));
    });
    const result = await handleLoop({ cwd, command: "start", path: PLAN, deps });
    expect(result.state, result.reason).toBe("done");
    expect(seen.filter((title) => title === "Warning title")).toHaveLength(2);
    const audit = readdirSync(join(cwd, ".context", SUBJECT)).filter((name) => /^ranking-.*\.md$/.test(name));
    const auditText = readFileSync(join(cwd, ".context", SUBJECT, audit[0]!), "utf8");
    expect(auditText).toContain("Jev failure");
  });

  it("blocks with a scan-defect reason when the artifact parses to zero issues (R-2)", async () => {
    const empty = "---\nstatus: active\n---\n# Iterate\n## Critical Issues\n";
    const { cwd, deps } = rankedRun(rankingByTitle([]), CLEAN_REVIEW, empty);
    const result = await handleLoop({ cwd, command: "start", path: PLAN, deps });
    expect(result.state).toBe("blocked");
    expect(result.reason).toMatch(/scan defect/i);
    const skills = deps.runStep.mock.calls.map((call) => call[0].skill);
    expect(skills).not.toContain("b-save");
    expect(skills).not.toContain("b-iterate");
  });

  it("blocks rather than picking one when two iterate artifacts are unfinished (A-10)", async () => {
    const { cwd, deps } = rankedRun(rankingByTitle([]));
    writeTree(cwd, { [`.context/${SUBJECT}/iterate-y.md`]: RANKED_ITERATE });
    const result = await handleLoop({ cwd, command: "start", path: PLAN, deps });
    expect(result.state).toBe("blocked");
    expect(result.reason).toMatch(/multiple unfinished iterate artifacts/i);
    const skills = deps.runStep.mock.calls.map((call) => call[0].skill);
    expect(skills).not.toContain("b-iterate");
    expect(skills).not.toContain("b-save");
  });

  it("finishes a garbled review after one rating pass and one docs judgment", async () => {
    const { cwd, deps } = rankedRun(
      (_state, questions) => Promise.resolve("docs" in questions ? docsAnswer() : ratingAnswer(0)),
      UNPARSEABLE_REVIEW,
    );
    const result = await handleLoop({ cwd, command: "start", path: PLAN, deps });
    expect(result.state, result.reason).toBe("done");
    // One rank and one docs evaluation, not one per rescan tick.
    const ranking = deps.ask.mock.calls.filter((call) => "scope" in (call[1] as Record<string, unknown>));
    expect(ranking).toHaveLength(2);
    const docs = deps.ask.mock.calls.filter((call) => "docs" in (call[1] as Record<string, unknown>));
    expect(docs).toHaveLength(1);
  });

  it("does not re-spend judgment when the machine re-emits rank for a recorded verdict", async () => {
    // A docs evaluation that always fails leaves an `unresolved` verdict, so
    // the machine keeps re-entering `ranking` until a continuation is taken.
    // Total judgment spend must stay flat across those hops: one per-issue
    // rating pass plus one docs evaluation (two failed attempts). If the rank
    // ever re-judged a recorded verdict, these counts would scale with the
    // hop count instead of staying at 2 and 2.
    const { cwd, deps } = rankedRun(
      (_state, questions) => "docs" in (questions as Record<string, unknown>)
        ? Promise.reject(new Error("Jev unavailable"))
        : Promise.resolve(ratingAnswer(0)),
      UNPARSEABLE_REVIEW, RANKED_ITERATE, acceptFirst,
    );
    const result = await handleLoop({ cwd, command: "start", path: PLAN, deps });
    expect(result.state, result.reason).toBe("done");
    const ranking = deps.ask.mock.calls.filter((call) => "scope" in (call[1] as Record<string, unknown>));
    expect(ranking).toHaveLength(2);
    const docs = deps.ask.mock.calls.filter((call) => "docs" in (call[1] as Record<string, unknown>));
    expect(docs).toHaveLength(2);
    // More than one hop into `ranking`, so the flat spend is meaningful.
    const rankHops = readProjection(cwd)!.history.filter((entry) => entry.to === "ranking");
    expect(rankHops.length).toBeGreaterThan(1);
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
  it.skipIf(!process.env.SQL_MEMORY_TEST_URL)("commits a verified interrupted SQL save without running save again", async () => {
    process.env.SQL_MEMORY_URL = process.env.SQL_MEMORY_TEST_URL;
    const cwd = repo();
    phased(cwd, ["completed"]);
    git(cwd, ["add", "-f", PLAN, `.context/${SUBJECT}/phase-1-p1.md`]);
    const prepared = prepareSaveAttempt(cwd, SUBJECT);
    if ("error" in prepared) throw new Error(prepared.error);
    writeReceipt(cwd, prepared, { kind: "no-fact", ids: [] });
    completeSaveAttempt(cwd, prepared);
    writeTree(cwd, {
      ".context/workflow/buck-loop.json": JSON.stringify({
        version: 1, state: "saving", subject: SUBJECT, planPath: PLAN, saveAttemptId: prepared.attemptId,
        phasePath: `.context/${SUBJECT}/phase-1-p1.md`, loopCount: 4,
        iterateCyclesOnPhase: 0, maxLoops: 12, lastChoice: null, history: [],
      }),
    });
    const deps = workDeps(async (opts) => {
      if (opts.skill === "b-save") throw new Error("verified save must not rerun");
      if (opts.skill === "b-commit") git(cwd, ["commit", "-qm", "saved"]);
      return { ok: true, text: opts.skill };
    });
    const result = await handleLoop({ cwd, command: "resume", deps });
    expect(result.state, result.reason).toBe("done");
    expect(deps.runStep.mock.calls.map(([opts]) => opts.skill)).toEqual(["b-commit"]);
  });
  it.skipIf(!process.env.SQL_MEMORY_TEST_URL)("rejects a later receipt for an interrupted projected save", async () => {
    process.env.SQL_MEMORY_URL = process.env.SQL_MEMORY_TEST_URL;
    const cwd = repo();
    phased(cwd, ["completed"]);
    git(cwd, ["add", "-f", PLAN, `.context/${SUBJECT}/phase-1-p1.md`]);
    const first = prepareSaveAttempt(cwd, SUBJECT);
    if ("error" in first) throw new Error(first.error);
    writeTree(cwd, {
      ".context/workflow/buck-loop.json": JSON.stringify({
        version: 1, state: "committing", subject: SUBJECT, planPath: PLAN,
        saveAttemptId: first.attemptId, phasePath: `.context/${SUBJECT}/phase-1-p1.md`,
        loopCount: 4, iterateCyclesOnPhase: 0, maxLoops: 12, lastChoice: null, history: [],
      }),
    });
    const later = prepareSaveAttempt(cwd, SUBJECT);
    if ("error" in later) throw new Error(later.error);
    writeReceipt(cwd, later, { kind: "no-fact", ids: [] });
    completeSaveAttempt(cwd, later);
    const deps = workDeps(async () => { throw new Error("wrong attempt cannot authorize commit"); });
    const result = await handleLoop({ cwd, command: "resume", deps });
    expect(result.state).toBe("blocked");
    expect(result.reason).toContain("does not match");
    expect(deps.runStep).not.toHaveBeenCalled();
  });


  it.skipIf(!process.env.SQL_MEMORY_TEST_URL)("does not commit an interrupted save whose metadata never completed", async () => {
    process.env.SQL_MEMORY_URL = process.env.SQL_MEMORY_TEST_URL;
    const cwd = repo();
    phased(cwd, ["completed"]);
    git(cwd, ["add", "-f", PLAN, `.context/${SUBJECT}/phase-1-p1.md`]);
    const prepared = prepareSaveAttempt(cwd, SUBJECT);
    if ("error" in prepared) throw new Error(prepared.error);
    writeReceipt(cwd, prepared, { kind: "no-fact", ids: [] });
    writeTree(cwd, {
      ".context/workflow/buck-loop.json": JSON.stringify({
        version: 1, state: "saving", subject: SUBJECT, planPath: PLAN, saveAttemptId: prepared.attemptId,
        phasePath: `.context/${SUBJECT}/phase-1-p1.md`, loopCount: 4,
        iterateCyclesOnPhase: 0, maxLoops: 12, lastChoice: null, history: [],
      }),
    });
    const deps = workDeps(async (opts) => {
      if (opts.skill === "b-commit") throw new Error("metadata-incomplete save cannot commit");
      return { ok: false, text: "apply failed" };
    });
    const result = await handleLoop({ cwd, command: "resume", deps });
    expect(result.state).toBe("blocked");
    expect(deps.runStep.mock.calls.some(([opts]) => opts.skill === "b-save")).toBe(true);
    expect(deps.runStep.mock.calls.some(([opts]) => opts.skill === "b-commit")).toBe(false);
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

  it("reviews a completed projected phase after a blocked build instead of rebuilding it", async () => {
    const cwd = repo();
    phased(cwd, ["completed", "pending"]);
    const firstPhase = ".context/" + SUBJECT + "/phase-1-p1.md";
    writeTree(cwd, {
      ".context/workflow/buck-loop.json": JSON.stringify({
        version: 1,
        state: "blocked",
        subject: SUBJECT,
        planPath: PLAN,
        phasePath: firstPhase,
        loopCount: 1,
        iterateCyclesOnPhase: 0,
        maxLoops: 12,
        lastChoice: null,
        history: [{ from: "building", to: "blocked", at: NOW, why: "incomplete checklist" }],
      }),
    });
    const deps = workDeps(async () => ({ ok: false, text: "stop after observing the review" }));
    const result = await handleLoop({ cwd, command: "resume", deps });

    expect(deps.runStep.mock.calls[0]?.[0]).toMatchObject({ skill: "b-review", planOrPhasePath: firstPhase });
    expect(deps.runStep.mock.calls.some(([opts]) => opts.skill === "b-build" || opts.skill === "b-build-hard")).toBe(false);
    expect(readProjection(cwd)?.loopCount).toBe(1);
    expect(result.state).toBe("blocked");
  });

  it("preserves staged in-cycle work before blocking and resumes without a commit", async () => {
    const cwd = repo();
    phased(cwd, ["pending"]);
    const failing = workDeps(async (opts) => {
      if (opts.skill === "b-build") {
        writeTree(cwd, { "src/owned.ts": "export const owned = true;\n" });
        git(cwd, ["add", "src/owned.ts"]);
        return { ok: false, text: "boom" };
      }
      return landingWork()(opts);
    });
    const blocked = await handleLoop({ cwd, command: "start", path: PLAN, deps: failing });
    expect(blocked.state).toBe("blocked");
    expect(execFileSync("git", ["status", "--porcelain", "--untracked-files=all"], {
      cwd,
      encoding: "utf8",
    })).toContain("A  src/owned.ts");

    const resumed = workDeps(landingWork());
    const result = await handleLoop({ cwd, command: "resume", deps: resumed });
    expect(result.state, result.reason).toBe("done");
    expect(resumed.runStep).toHaveBeenCalled();
  });

  it("does not adopt unrelated dirt created during failed in-cycle work", async () => {
    const cwd = repo();
    phased(cwd, ["pending"]);
    const failing = workDeps(async (opts) => {
      if (opts.skill === "b-build") {
        writeTree(cwd, {
          "src/owned.ts": "export const owned = true;\n",
          "src/unrelated.ts": "export const unrelated = true;\n",
        });
        git(cwd, ["add", "src/owned.ts"]);
        return { ok: false, text: "boom" };
      }
      return landingWork()(opts);
    });

    const blocked = await handleLoop({ cwd, command: "start", path: PLAN, deps: failing });
    const status = execFileSync("git", ["status", "--porcelain", "--untracked-files=all"], {
      cwd,
      encoding: "utf8",
    });

    expect(blocked.state).toBe("blocked");
    expect(status).toContain("A  src/owned.ts");
    expect(status).toContain("?? src/unrelated.ts");

    const resumed = workDeps(landingWork());
    const result = await handleLoop({ cwd, command: "resume", deps: resumed });
    expect(result.state).toBe("aborted");
    expect(result.reason).toMatch(/dirty/);
    expect(resumed.runStep).not.toHaveBeenCalled();
  });

  it("resumes staged in-cycle work after unrelated unstaged dirt is removed", async () => {
    const cwd = repo();
    phased(cwd, ["pending"]);
    const failing = workDeps(async (opts) => {
      if (opts.skill === "b-build") {
        writeTree(cwd, {
          "src/owned.ts": "export const owned = true;\n",
          "src/unrelated.ts": "export const unrelated = true;\n",
        });
        git(cwd, ["add", "src/owned.ts"]);
        return { ok: false, text: "boom" };
      }
      return landingWork()(opts);
    });

    const blocked = await handleLoop({ cwd, command: "start", path: PLAN, deps: failing });
    expect(blocked.state).toBe("blocked");
    expect(blocked.reason).toMatch(/left unstaged.*src\/unrelated\.ts/i);

    const history = readProjection(cwd)?.history ?? [];
    const blockedHops = history.filter((hop) => hop.to === "blocked");
    expect(blockedHops).toHaveLength(1);
    expect(blockedHops[0].from).toBe("building");
    expect(blockedHops[0].why).toMatch(/left unstaged.*src\/unrelated\.ts/i);

    rmSync(join(cwd, "src/unrelated.ts"));
    const resumed = workDeps(landingWork());
    const result = await handleLoop({ cwd, command: "resume", deps: resumed });
    expect(result.state, result.reason).toBe("done");
    expect(resumed.runStep).toHaveBeenCalled();
  });

  it("persists and returns a blocked result when nested work remains unstaged", async () => {
    const cwd = repo();
    phased(cwd, ["pending"]);
    const failing = workDeps(async (opts) => {
      if (opts.skill === "b-build") {
        writeTree(cwd, { "src/owned.ts": "export const owned = true;\n" });
        return { ok: false, text: "boom" };
      }
      return landingWork()(opts);
    });

    const result = await handleLoop({ cwd, command: "start", path: PLAN, deps: failing });

    expect(result.state).toBe("blocked");
    expect(result.reason).toMatch(/left unstaged.*src\/owned\.ts/i);
    expect(readProjection(cwd)?.history.at(-1)?.why).toMatch(/left unstaged.*src\/owned\.ts/i);
    expect(execFileSync("git", ["status", "--porcelain", "--untracked-files=all"], { cwd, encoding: "utf8" }))
      .toContain("?? src/owned.ts");
  });

  it("asks instead of blocking resume when an unrelated untracked path appears after the block", async () => {
    const cwd = repo();
    phased(cwd, ["pending"]);
    const failing = workDeps(async (opts) => {
      if (opts.skill === "b-build") {
        writeTree(cwd, { "src/owned.ts": "export const owned = true;\n" });
        git(cwd, ["add", "src/owned.ts"]);
        return { ok: false, text: "boom" };
      }
      return landingWork()(opts);
    });
    await handleLoop({ cwd, command: "start", path: PLAN, deps: failing });
    writeTree(cwd, { "src/unrelated.ts": "export const unrelated = true;\n" });

    const resumed = workDeps(landingWork());
    const result = await handleLoop({ cwd, command: "resume", deps: resumed });
    expect(result.state).toBe("aborted");
    expect(result.reason).toMatch(/dirty/);
    expect(resumed.runStep).not.toHaveBeenCalled();
  });

  it("asks instead of blocking resume when an unrelated tracked path is modified after the block", async () => {
    const cwd = repo();
    writeTree(cwd, { "src/tracked.ts": "export const tracked = true;\n" });
    git(cwd, ["add", "src/tracked.ts"]);
    git(cwd, ["commit", "-qm", "tracked fixture"]);
    phased(cwd, ["pending"]);
    const failing = workDeps(async (opts) => {
      if (opts.skill === "b-build") {
        writeTree(cwd, { "src/owned.ts": "export const owned = true;\n" });
        git(cwd, ["add", "src/owned.ts"]);
        return { ok: false, text: "boom" };
      }
      return landingWork()(opts);
    });
    await handleLoop({ cwd, command: "start", path: PLAN, deps: failing });
    writeTree(cwd, { "src/tracked.ts": "export const tracked = false;\n" });

    const resumed = workDeps(landingWork());
    const result = await handleLoop({ cwd, command: "resume", deps: resumed });
    expect(result.state).toBe("aborted");
    expect(result.reason).toMatch(/dirty/);
    expect(resumed.runStep).not.toHaveBeenCalled();
  });

  it("asks instead of blocking resume when loop-owned staged work is modified again", async () => {
    const cwd = repo();
    phased(cwd, ["pending"]);
    const failing = workDeps(async (opts) => {
      if (opts.skill === "b-build") {
        writeTree(cwd, { "src/owned.ts": "export const owned = true;\n" });
        git(cwd, ["add", "src/owned.ts"]);
        return { ok: false, text: "boom" };
      }
      return landingWork()(opts);
    });
    await handleLoop({ cwd, command: "start", path: PLAN, deps: failing });
    writeTree(cwd, { "src/owned.ts": "export const owned = false;\n" });

    const resumed = workDeps(landingWork());
    const result = await handleLoop({ cwd, command: "resume", deps: resumed });
    expect(result.state).toBe("aborted");
    expect(result.reason).toMatch(/dirty/);
    expect(resumed.runStep).not.toHaveBeenCalled();
  });

  it("does not USER_CONFIRM a blocked resume when the scanned phase moved", async () => {
    const cwd = repo();
    phased(cwd, ["pending"]);
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

const recallResult = vi.hoisted(() => ({ current: undefined as RecallOutcome | undefined }));
vi.mock("../project-memory.js", async () => {
  const actual = await vi.importActual<typeof import("../project-memory.js")>("../project-memory.js");
  const passThrough = actual.recallProjectMemories;
  return {
    ...actual,
    recallProjectMemories: async (cwd: string, stagePath: string) => {
      if (recallResult.current !== undefined) return recallResult.current;
      return passThrough(cwd, stagePath);
    },
  };
});
import type { RecallOutcome } from "../project-memory.js";

describe("configured SQL memory recall contract", () => {
  beforeEach(() => {
    recallResult.current = undefined;
    delete process.env.SQL_MEMORY_URL;
  });
  afterEach(() => {
    recallResult.current = undefined;
    delete process.env.SQL_MEMORY_URL;
  });

  it("refuses to spawn the child when recall returns failure", async () => {
    process.env.SQL_MEMORY_URL = "postgres://unused";
    const cwd = repo();
    phased(cwd, ["pending"]);
    recallResult.current = { kind: "failure", reason: "Shared SQL memory query failed (not an empty result): database unavailable." };

    const deps = workDeps(landingWork());
    const result = await handleLoop({ cwd, command: "start", path: PLAN, deps });

    expect(result.state).toBe("blocked");
    expect(result.reason).toContain("Shared SQL memory query failed");
    expect(deps.runStep).not.toHaveBeenCalled();
  });

  it("refuses to spawn the child when project identity cannot be established", async () => {
    process.env.SQL_MEMORY_URL = "postgres://unused";
    const cwd = repo();
    phased(cwd, ["pending"]);
    recallResult.current = { kind: "identity-missing", reason: "Shared SQL memory is configured, but project identity could not be established; no memory query was made." };

    const deps = workDeps(landingWork());
    const result = await handleLoop({ cwd, command: "start", path: PLAN, deps });

    expect(result.state).toBe("blocked");
    expect(result.reason).toContain("project identity could not be established");
    expect(deps.runStep).not.toHaveBeenCalled();
  });

  it("still runs the child when recall succeeds with zero rows", async () => {
    process.env.SQL_MEMORY_URL = "postgres://unused";
    const cwd = repo();
    phased(cwd, ["pending"]);
    recallResult.current = {
      kind: "success-empty",
      identity: { project: "https://example.test/acme/project.git", branch: "main", sha: "a".repeat(40) },
    };

    const deps = workDeps(landingWork());
    const result = await handleLoop({ cwd, command: "start", path: PLAN, deps });

    expect(result.state).toBe("blocked");
    expect(result.reason).toMatch(/SQL save|SQL memory/i);
    expect(deps.runStep).toHaveBeenCalled();
  });
});

describe("single unfinished iterate artifact closeout", () => {
  const TODAY = NOW.slice(0, 10);
  const ITERATE_BODY = "---\n\n# Iteration: demo\n\n- Critical: fix the seam\n";

  function iteratePath(cwd: string, name = "iterate-x.md"): string {
    return join(cwd, `.context/${SUBJECT}/${name}`);
  }

  /** Review writes an artifact the iterate child leaves `active` — the incident shape. */
  function writeIterate(cwd: string, name = "iterate-x.md", front = "---\nstatus: active\ncompleted: null\n"): string {
    writeTree(cwd, { [`.context/${SUBJECT}/${name}`]: `${front}${ITERATE_BODY}` });
    return iteratePath(cwd, name);
  }

  it("closes the artifact after a completed phase and reviews the result", async () => {
    const cwd = repo();
    phased(cwd, ["pending"]);
    const landing = landingWork();
    const deps = workDeps(async (opts) => {
      if (opts.skill === "b-review" && !existsSync(iteratePath(cwd))) {
        writeIterate(cwd);
        return { ok: true, text: CLEAN_REVIEW };
      }
      if (opts.skill === "b-iterate") return { ok: true, text: "applied the fix" };
      return landing({ ...opts, difficulty: "standard" });
    });
    const result = await handleLoop({ cwd, command: "start", path: PLAN, deps });
    const text = readFileSync(iteratePath(cwd), "utf8");
    expect(deps.classifyRepair).not.toHaveBeenCalled();
    expect(text).toMatch(/^status: completed$/m);
    expect(text).toMatch(new RegExp(`^completed: ${TODAY}$`, "m"));
    expect(text).toMatch(new RegExp(`^updated: ${TODAY}$`, "m"));
    expect(text).not.toContain("completed: null");
    expect(text).toContain("- Critical: fix the seam");
    expect(text.endsWith(ITERATE_BODY)).toBe(true);
    const skills = deps.runStep.mock.calls.map((call) => call[0].skill);
    expect(skills.lastIndexOf("b-iterate")).toBeLessThan(skills.lastIndexOf("b-review"));
    expect(result.state).toBe("done");
  });

  it("closes the artifact for an unphased open plan without touching the plan", async () => {
    const cwd = repo();
    // The open box lives under a body `## Acceptance criteria` heading, which is
    // what `planAcceptanceCriteria` reads; the plan must stay open for this
    // fixture to be meaningful.
    const planBody = "---\nstatus: active\n---\n# Plan\n\n## Acceptance criteria\n- [ ] ship the closeout\n";
    writeTree(cwd, { [PLAN]: planBody });
    const planText = readFileSync(join(cwd, PLAN), "utf8");
    const landing = landingWork();
    const deps = workDeps(async (opts) => {
      // The shared build fake would mark an unphased plan completed; that would
      // hide whether the close, not the harness, is what leaves the plan alone.
      if (opts.skill === "b-build" || opts.skill === "b-build-hard") return { ok: true, text: "built" };
      if (opts.skill === "b-review" && !existsSync(iteratePath(cwd))) {
        writeIterate(cwd);
        return { ok: true, text: CLEAN_REVIEW };
      }
      if (opts.skill === "b-iterate") return { ok: true, text: "applied" };
      return landing({ ...opts, difficulty: "standard" });
    });
    await handleLoop({ cwd, command: "start", path: PLAN, deps });
    expect(deps.classifyRepair).not.toHaveBeenCalled();
    expect(readFileSync(iteratePath(cwd), "utf8")).toMatch(/^status: completed$/m);
    expect(readFileSync(join(cwd, PLAN), "utf8")).toBe(planText);
    expect(readFileSync(join(cwd, PLAN), "utf8")).toMatch(/^status: active$/m);
  });

  it("leaves two unfinished artifacts untouched and names both in the diagnosis", async () => {
    const cwd = repo();
    phased(cwd, ["pending"]);
    const first = writeIterate(cwd, "iterate-a.md", "---\nstatus: active\n");
    const second = writeIterate(cwd, "iterate-b.md", "---\nstatus: in-progress\n");
    const before = [readFileSync(first, "utf8"), readFileSync(second, "utf8")];
    const landing = landingWork();
    // No `classifyRepair` override: the production default runs, with Jev
    // mocked to answer "heavy". The assertion then covers the shipped
    // diagnosis, not a hardcoded string from a fake.
    judge.mockResolvedValueOnce({ raw: "", details: { answers: { lift: { type: "choice", choice: "heavy", confidence: 0.9 } } } });
    const deps = workDeps(
      async (opts) => (opts.skill === "b-iterate" ? { ok: true, text: "handled" } : landing({ ...opts, difficulty: "standard" })),
      async () => ({ status: "blocked", reason: "choose not expected" }),
    );
    const result = await handleLoop({ cwd, command: "start", path: PLAN, deps: { ...deps, classifyRepair: productionClassifyRepair } });
    expect(judge).toHaveBeenCalled();
    expect(readFileSync(first, "utf8")).toBe(before[0]);
    expect(readFileSync(second, "utf8")).toBe(before[1]);
    expect(result.state).toBe("blocked");
    expect(result.reason).toContain("iterate-a.md (status active)");
    expect(result.reason).toContain("iterate-b.md (status in-progress)");
  });

  it("does not close after a failed iterate session", async () => {
    const cwd = repo();
    phased(cwd, ["pending"]);
    const abs = writeIterate(cwd);
    const before = readFileSync(abs, "utf8");
    let iterates = 0;
    const landing = landingWork();
    const deps = workDeps(async (opts) => {
      if (opts.skill === "b-iterate") {
        iterates += 1;
        return { ok: false, text: `iterate-fail-${iterates}` };
      }
      return landing({ ...opts, difficulty: "standard" });
    });
    const result = await handleLoop({ cwd, command: "start", path: PLAN, deps });
    expect(readFileSync(abs, "utf8")).toBe(before);
    expect(deps.classifyRepair).not.toHaveBeenCalled();
    expect(result.state).toBe("blocked");
    expect(result.reason).toMatch(/failed again after one retry/i);
  });

  it("closes after an ok retry too, leaving loop and iterate counters alone", async () => {
    const cwd = repo();
    phased(cwd, ["pending"]);
    let iterates = 0;
    const landing = landingWork();
    const deps = workDeps(async (opts) => {
      if (opts.skill === "b-iterate") {
        iterates += 1;
        return { ok: iterates > 1, text: iterates > 1 ? "applied" : "transient" };
      }
      if (opts.skill === "b-review" && !existsSync(iteratePath(cwd))) {
        writeIterate(cwd);
        return { ok: true, text: CLEAN_REVIEW };
      }
      return landing({ ...opts, difficulty: "standard" });
    });
    await handleLoop({ cwd, command: "start", path: PLAN, deps });
    const projection = readProjection(cwd);
    expect(iterates).toBe(2);
    expect(deps.classifyRepair).not.toHaveBeenCalled();
    expect(readFileSync(iteratePath(cwd), "utf8")).toMatch(/^status: completed$/m);
    // The retry stayed inside one iterate cycle: the close and the retry must
    // not each consume a crossing of the same edge.
    const crossings = (projection?.history ?? []).filter((entry) => entry.to === "iterating" && entry.from !== "iterating");
    expect(crossings).toHaveLength(1);
    expect(projection?.loopCount).toBe(1);
  });

  it("closes after a retry that bypasses the ambiguity choice", async () => {
    const cwd = repo();
    phased(cwd, ["pending"]);
    // Two artifacts make the first ok session ambiguous, so the machine opens
    // the retry/advance choice instead of routing straight to review. The retry
    // child finishes one artifact, leaving exactly one active: the only place
    // that can close it is the successful-iterate path, because a used retry
    // never reaches the ambiguity choice again.
    const first = writeIterate(cwd, "iterate-a.md");
    const second = writeIterate(cwd, "iterate-b.md");
    const landing = landingWork();
    let iterates = 0;
    const classifyRepair = vi.fn(async () => ({ lift: "light" as const, reason: "same assignment", diagnosis: "finish the second artifact" }));
    const deps = workDeps(
      async (opts) => {
        if (opts.skill === "b-iterate") {
          iterates += 1;
          if (iterates === 1) return { ok: true, text: "held both open" };
          writeTree(cwd, { [`.context/${SUBJECT}/iterate-a.md`]: "---\nstatus: completed\ncompleted: 2026-09-18\n---\n# Iteration: demo\n" });
          return { ok: true, text: "closed the first" };
        }
        return landing({ ...opts, difficulty: "standard" });
      },
      async () => ({ status: "blocked", reason: "choose not expected" }),
      classifyRepair,
    );
    const result = await handleLoop({ cwd, command: "start", path: PLAN, deps });
    expect(classifyRepair).toHaveBeenCalledTimes(1);
    expect(iterates).toBe(2);
    expect(readFileSync(first, "utf8")).toMatch(/^status: completed$/m);
    expect(readFileSync(second, "utf8")).toMatch(/^status: completed$/m);
    expect(deps.classifyRepair).toHaveBeenCalledTimes(1);
    expect(result.state).toBe("done");
  });

  it("closes the new artifact a later review writes, leaving the earlier one alone", async () => {
    const cwd = repo();
    phased(cwd, ["pending"]);
    let reviews = 0;
    const landing = landingWork();
    const deps = workDeps(async (opts) => {
      if (opts.skill === "b-review") {
        reviews += 1;
        if (reviews === 1) writeIterate(cwd);
        if (reviews === 2) writeIterate(cwd, "iterate-y.md");
        return { ok: true, text: CLEAN_REVIEW };
      }
      if (opts.skill === "b-iterate") return { ok: true, text: "applied" };
      return landing({ ...opts, difficulty: "standard" });
    });
    const result = await handleLoop({ cwd, command: "start", path: PLAN, deps });
    expect(result.state).toBe("done");
    expect(reviews).toBe(3);
    expect(deps.classifyRepair).not.toHaveBeenCalled();
    expect(readFileSync(iteratePath(cwd, "iterate-x.md"), "utf8")).toMatch(/^status: completed$/m);
    expect(readFileSync(iteratePath(cwd, "iterate-y.md"), "utf8")).toMatch(/^status: completed$/m);
  });
});

describe("prepareCommitCheckpoint phase-scope staging", () => {
  beforeEach(cleanupRepos);
  afterEach(cleanupRepos);

  function setupPhaseRepo(extra: { phaseStatus?: string; files?: string[]; unstaged?: Record<string, string>; staged?: Record<string, string> } = {}): string {
    const cwd = repo();
    const files = extra.files ?? ["skills/b-build/SKILL.md", "plugins/buck-workflow/skills/b-save/SKILL.md"];
    writeTree(cwd, {
      [PLAN]: planMd(),
      [`.context/${SUBJECT}/plan-demo-phases.md`]: "---\nstatus: active\n---\n# Phases\n",
      [`.context/${SUBJECT}/phase-1-p1.md`]: phaseMdWithFiles(1, files, extra.phaseStatus ?? "pending"),
    });
    if (extra.staged) {
      for (const [rel, content] of Object.entries(extra.staged)) writeTree(cwd, { [rel]: content });
      for (const rel of Object.keys(extra.staged)) git(cwd, ["add", rel]);
    }
    if (extra.unstaged) {
      writeTree(cwd, extra.unstaged);
    }
    return cwd;
  }

  it("auto-stages paths declared in the phase files: list before the commit guard runs", async () => {
    const cwd = setupPhaseRepo({
      unstaged: { "skills/b-build/SKILL.md": "phase 1 content\n" },
    });
    const phasePath = `.context/${SUBJECT}/phase-1-p1.md`;
    prepareCommitCheckpoint(cwd, phasePath);
    const status = execFileSync("git", ["-C", cwd, "status", "--porcelain", "--untracked-files=all"], { encoding: "utf8" });
    expect(status).toContain("A  skills/b-build/SKILL.md");
    expect(status).not.toContain("?? skills/b-build/SKILL.md");
  });

  it("still refuses unstaged paths outside the phase files: list with the existing error shape", async () => {
    const cwd = setupPhaseRepo({
      unstaged: { "extensions/sql-memory/unrelated.ts": "not a declared deliverable\n" },
    });
    const phasePath = `.context/${SUBJECT}/phase-1-p1.md`;
    expect(() => prepareCommitCheckpoint(cwd, phasePath)).toThrow(
      /refuses to commit unstaged non-\.context changes.*extensions\/sql-memory\/unrelated\.ts/,
    );
  });

  it("accepts a single-string files: frontmatter as one declared path", async () => {
    const cwd = repo();
    writeTree(cwd, {
      [PLAN]: planMd(),
      [`.context/${SUBJECT}/plan-demo-phases.md`]: "---\nstatus: active\n---\n# Phases\n",
      [`.context/${SUBJECT}/phase-1-p1.md`]: ["---", "status: pending", "files: skills/b-build/SKILL.md", "---", "# Phase 1"].join(String.fromCharCode(10)),
      "skills/b-build/SKILL.md": "single-string file\n",
    });
    const phasePath = `.context/${SUBJECT}/phase-1-p1.md`;
    prepareCommitCheckpoint(cwd, phasePath);
    const status = execFileSync("git", ["-C", cwd, "status", "--porcelain", "--untracked-files=all"], { encoding: "utf8" });
    expect(status).toContain("A  skills/b-build/SKILL.md");
  });

  it("falls back to the legacy throw-on-any-unstaged guard when the phase has no files: frontmatter", async () => {
    const cwd = repo();
    writeTree(cwd, {
      [PLAN]: planMd(),
      [`.context/${SUBJECT}/plan-demo-phases.md`]: "---\nstatus: active\n---\n# Phases\n",
      [`.context/${SUBJECT}/phase-1-p1.md`]: phaseMd(1, "pending"),
      "skills/b-build/SKILL.md": "phase without files: key\n",
    });
    const phasePath = `.context/${SUBJECT}/phase-1-p1.md`;
    expect(() => prepareCommitCheckpoint(cwd, phasePath)).toThrow(
      /refuses to commit unstaged non-\.context changes.*skills\/b-build\/SKILL\.md/,
    );
  });
  it("stages files beneath a declared mirror directory but not adjacent prefixes", () => {
    const cwd = setupPhaseRepo({ files: ["plugins/buck-workflow/skills/b-build/"], unstaged: {
      "plugins/buck-workflow/skills/b-build/SKILL.md": "mirror",
    } });
    prepareCommitCheckpoint(cwd, `.context/${SUBJECT}/phase-1-p1.md`);
    expect(execFileSync("git", ["-C", cwd, "diff", "--cached", "--name-only"], { encoding: "utf8" }))
      .toContain("plugins/buck-workflow/skills/b-build/SKILL.md");
    writeTree(cwd, { "plugins/buck-workflow/skills/b-build-extra/SKILL.md": "unrelated" });
    expect(() => prepareCommitCheckpoint(cwd, `.context/${SUBJECT}/phase-1-p1.md`))
      .toThrow(/refuses to commit unstaged non-\.context changes.*b-build-extra/);
  });

  it("refuses a rename from an undeclared source even when its destination is declared", () => {
    const cwd = setupPhaseRepo({ files: ["skills/b-build/SKILL.md"], staged: { "outside.txt": "source" } });
    git(cwd, ["commit", "-qm", "initial"]);
    rmSync(join(cwd, "outside.txt"));
    writeTree(cwd, { "skills/b-build/SKILL.md": "source" });
    git(cwd, ["add", "-N", "skills/b-build/SKILL.md"]);
    expect(() => prepareCommitCheckpoint(cwd, `.context/${SUBJECT}/phase-1-p1.md`))
      .toThrow(/refuses to commit unstaged non-\.context changes.*outside\.txt/);
    expect(execFileSync("git", ["-C", cwd, "diff", "--cached", "--name-only"], { encoding: "utf8" })).toBe("");
  });
});

