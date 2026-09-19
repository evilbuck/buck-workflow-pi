/**
 * Pure transition-table tests. Fixture snapshots, no disk and no model.
 * Covers deterministic edges, closed `choose` sets, illegal choices, and
 * operator-owned START / USER_CONFIRMED / STOP helpers.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  IllegalChoiceError,
  IllegalTransitionError,
  MAX_ITERATE_CYCLES_PER_PHASE,
  applyChoice,
  legalChoices,
  limitsExceeded,
  next,
  start,
  stopFrom,
  userConfirmed,
} from "../table.js";
import type { Choice, LoopState, ReviewFacts, Snapshot, WorkFacts, WorkSkill, WorkState } from "../types.js";

const SUBJECT = "2026-09-18.demo-subject";
const PLAN_PATH = `.context/${SUBJECT}/plan-demo.md`;
const PHASE_PATH = `.context/${SUBJECT}/phase-1.md`;

type ReportFacts = Extract<ReviewFacts, { kind: "report" }>;

function snap(overrides: Partial<Snapshot> = {}): Snapshot {
  return {
    state: "resolving",
    subject: SUBJECT,
    planPath: PLAN_PATH,
    phasePath: PHASE_PATH,
    planFacts: { kind: "phased-incomplete" },
    workFacts: wf(),
    reviewFacts: { kind: "pending" },
    loopCount: 0,
    maxLoops: 12,
    iterateCyclesOnPhase: 0,
    lastChoice: null,
    history: [],
    ...overrides,
  };
}

function wf(overrides: Partial<WorkFacts> = {}): WorkFacts {
  return { sessionOutcome: "pending", retriesUsed: 0, postcondition: "pending", ...overrides };
}

function rf(overrides: Partial<ReportFacts> = {}): ReviewFacts {
  return {
    kind: "report",
    parseable: true,
    iterateArtifact: false,
    docsImpact: false,
    howtoImpact: false,
    ...overrides,
  };
}

const WORK_STATES: readonly WorkState[] = [
  "building",
  "reviewing",
  "iterating",
  "documenting",
  "saving",
  "committing",
];

const STATE_SKILL: Record<WorkState, WorkSkill> = {
  building: "build",
  reviewing: "review",
  iterating: "iterate",
  documenting: "docs",
  saving: "save",
  committing: "commit",
};

const POSTCONDITION_STATES: readonly Exclude<WorkState, "reviewing">[] = [
  "building",
  "iterating",
  "documenting",
  "saving",
  "committing",
];

function workSnap(
  state: Exclude<WorkState, "reviewing">,
  workOverrides: Partial<WorkFacts> = {},
  overrides: Partial<Snapshot> = {},
): Snapshot {
  return snap({
    state,
    workFacts: wf({ sessionOutcome: "ok", postcondition: "confirmed", ...workOverrides }),
    ...overrides,
  });
}

function reviewDone(report: Partial<ReportFacts> = {}, overrides: Partial<Snapshot> = {}): Snapshot {
  return snap({
    state: "reviewing",
    workFacts: wf({ sessionOutcome: "ok" }),
    reviewFacts: rf(report),
    ...overrides,
  });
}

describe("next: resolving", () => {
  it("blocks with the scan's reason when the plan is missing", () => {
    const t = next(
      snap({ planFacts: { kind: "missing", reason: "no plan file in subject folder" }, subject: null, planPath: null }),
    );
    expect(t.to).toBe("blocked");
    expect(t.effect.kind).toBe("await-operator");
    expect(t.why).toContain("no plan file in subject folder");
  });

  it("runs one build cycle for an unphased plan", () => {
    const t = next(snap({ planFacts: { kind: "unphased" }, phasePath: null }));
    expect(t).toEqual({ to: "building", effect: { kind: "run-skill", skill: "build" }, why: expect.any(String) });
  });

  it("builds the active incomplete phase", () => {
    const t = next(snap());
    expect(t).toEqual({ to: "building", effect: { kind: "run-skill", skill: "build" }, why: expect.any(String) });
  });

  it("completes when every phase is already done", () => {
    const t = next(snap({ planFacts: { kind: "phased-complete" }, phasePath: null }));
    expect(t).toEqual({ to: "done", effect: { kind: "none" }, why: expect.any(String) });
  });

  it("still completes at the loop limit — limits only gate further work", () => {
    const t = next(snap({ planFacts: { kind: "phased-complete" }, phasePath: null, loopCount: 12, maxLoops: 12 }));
    expect(t.to).toBe("done");
    expect(t.effect.kind).toBe("none");
  });
});

describe("safety limits", () => {
  it("blocks before emitting another build effect at the loop limit", () => {
    const t = next(snap({ loopCount: 12, maxLoops: 12 }));
    expect(t.to).toBe("blocked");
    expect(t.effect.kind).toBe("await-operator");
    expect(t.why).toContain("loop limit");
  });

  it("blocks instead of iterating a fourth time on one phase", () => {
    const t = next(
      reviewDone(
        { iterateArtifact: true },
        { iterateCyclesOnPhase: MAX_ITERATE_CYCLES_PER_PHASE },
      ),
    );
    expect(t.to).toBe("blocked");
    expect(t.effect.kind).toBe("await-operator");
    expect(t.why).toContain("iterate limit");
  });

  it("exposes limitsExceeded for both counters", () => {
    expect(limitsExceeded(snap({ loopCount: 5, maxLoops: 5 }))).toBe(true);
    expect(limitsExceeded(snap({ iterateCyclesOnPhase: MAX_ITERATE_CYCLES_PER_PHASE }))).toBe(true);
    expect(limitsExceeded(snap())).toBe(false);
  });
});

describe.each(WORK_STATES)("next: %s session", (state) => {
  const skill = STATE_SKILL[state];

  it("emits its own skill when the session has not run yet", () => {
    const t = next(snap({ state, workFacts: wf() }));
    expect(t).toEqual({ to: state, effect: { kind: "run-skill", skill }, why: expect.any(String) });
  });

  it("retries once after a failed session", () => {
    const t = next(snap({ state, workFacts: wf({ sessionOutcome: "failed", retriesUsed: 0 }) }));
    expect(t).toEqual({ to: state, effect: { kind: "run-skill", skill }, why: expect.any(String) });
  });

  it("blocks when the retry also failed", () => {
    const t = next(snap({ state, workFacts: wf({ sessionOutcome: "failed", retriesUsed: 1 }) }));
    expect(t.to).toBe("blocked");
    expect(t.effect.kind).toBe("await-operator");
  });
});

describe("next: confirmed postconditions advance deterministically", () => {
  it("building → reviewing runs the review", () => {
    const t = next(workSnap("building"));
    expect(t).toEqual({ to: "reviewing", effect: { kind: "run-skill", skill: "review" }, why: expect.any(String) });
  });

  it("iterating → reviewing re-runs the review", () => {
    const t = next(workSnap("iterating"));
    expect(t).toEqual({ to: "reviewing", effect: { kind: "run-skill", skill: "review" }, why: expect.any(String) });
  });

  it("documenting → saving runs the save", () => {
    const t = next(workSnap("documenting"));
    expect(t).toEqual({ to: "saving", effect: { kind: "run-skill", skill: "save" }, why: expect.any(String) });
  });

  it("saving → committing runs the commit", () => {
    const t = next(workSnap("saving"));
    expect(t).toEqual({ to: "committing", effect: { kind: "run-skill", skill: "commit" }, why: expect.any(String) });
  });

  it("committing → building starts the next incomplete phase", () => {
    const t = next(workSnap("committing"));
    expect(t).toEqual({ to: "building", effect: { kind: "run-skill", skill: "build" }, why: expect.any(String) });
  });

  it("committing → done when no phases remain", () => {
    const t = next(workSnap("committing", {}, { planFacts: { kind: "phased-complete" }, phasePath: null }));
    expect(t).toEqual({ to: "done", effect: { kind: "none" }, why: expect.any(String) });
  });

  it("committing → done for an unphased plan's single cycle", () => {
    const t = next(workSnap("committing", {}, { planFacts: { kind: "unphased" }, phasePath: null }));
    expect(t.to).toBe("done");
    expect(t.effect.kind).toBe("none");
  });

  it("committing blocks if the plan vanished mid-cycle", () => {
    const t = next(
      workSnap("committing", {}, { planFacts: { kind: "missing", reason: "subject folder deleted" } }),
    );
    expect(t.to).toBe("blocked");
  });

  it("blocks explicitly when a finished session has no postcondition verdict (scan defect)", () => {
    const t = next(workSnap("building", { postcondition: "pending" }));
    expect(t.to).toBe("blocked");
    expect(t.effect.kind).toBe("await-operator");
  });
});

describe("next: ambiguous postconditions defer to a closed choice", () => {
  it.each(POSTCONDITION_STATES)("stays in %s and offers retry|advance|block", (state) => {
    const t = next(workSnap(state, { postcondition: "ambiguous" }));
    expect(t.to).toBe(state);
    expect(t.effect).toEqual({
      kind: "choose",
      legal: [{ kind: "retry" }, { kind: "advance" }, { kind: "block" }],
    });
  });
});

describe("next: reviewing", () => {
  it("prioritizes the iterate artifact over documentation impact and save", () => {
    const t = next(reviewDone({ iterateArtifact: true, docsImpact: true }));
    expect(t).toEqual({ to: "iterating", effect: { kind: "run-skill", skill: "iterate" }, why: expect.any(String) });
  });

  it("iterates even when the report itself is unparseable", () => {
    const t = next(reviewDone({ iterateArtifact: true, parseable: false }));
    expect(t.to).toBe("iterating");
    expect(t.effect).toEqual({ kind: "run-skill", skill: "iterate" });
  });

  it("documents when docs impact is flagged and no iterate artifact exists", () => {
    const t = next(reviewDone({ docsImpact: true }));
    expect(t).toEqual({ to: "documenting", effect: { kind: "run-skill", skill: "docs" }, why: expect.any(String) });
  });

  it("documents for how-to impact alone", () => {
    const t = next(reviewDone({ howtoImpact: true }));
    expect(t).toEqual({ to: "documenting", effect: { kind: "run-skill", skill: "docs" }, why: expect.any(String) });
  });

  it("saves on a clean, parseable review", () => {
    const t = next(reviewDone());
    expect(t).toEqual({ to: "saving", effect: { kind: "run-skill", skill: "save" }, why: expect.any(String) });
  });

  it("asks a closed question when the report is unparseable and no artifact disambiguates", () => {
    const t = next(reviewDone({ parseable: false }));
    expect(t.to).toBe("reviewing");
    expect(t.effect).toEqual({
      kind: "choose",
      legal: [{ kind: "iterate" }, { kind: "document" }, { kind: "save" }, { kind: "block" }],
    });
  });

  it("blocks explicitly when a finished review produced no report facts (scan defect)", () => {
    const t = next(snap({ state: "reviewing", workFacts: wf({ sessionOutcome: "ok" }) }));
    expect(t.to).toBe("blocked");
    expect(t.effect.kind).toBe("await-operator");
  });
});

describe("legalChoices", () => {
  it("is empty wherever deterministic guards decide", () => {
    expect(legalChoices("resolving", snap())).toEqual([]);
    expect(legalChoices("building", workSnap("building"))).toEqual([]);
    expect(legalChoices("reviewing", reviewDone())).toEqual([]);
    expect(legalChoices("reviewing", reviewDone({ iterateArtifact: true }))).toEqual([]);
    expect(legalChoices("idle", snap({ state: "idle" }))).toEqual([]);
    expect(legalChoices("blocked", snap({ state: "blocked" }))).toEqual([]);
  });

  it("offers the review set exactly when the report is unparseable with no iterate artifact", () => {
    expect(legalChoices("reviewing", reviewDone({ parseable: false }))).toEqual([
      { kind: "iterate" },
      { kind: "document" },
      { kind: "save" },
      { kind: "block" },
    ]);
  });

  it("offers the postcondition set exactly when the scan is ambiguous", () => {
    expect(legalChoices("building", workSnap("building", { postcondition: "ambiguous" }))).toEqual([
      { kind: "retry" },
      { kind: "advance" },
      { kind: "block" },
    ]);
  });

  it("offers nothing once limits are exceeded — the deterministic block wins", () => {
    expect(legalChoices("reviewing", reviewDone({ parseable: false }, { loopCount: 12, maxLoops: 12 }))).toEqual([]);
    expect(
      legalChoices("building", workSnap("building", { postcondition: "ambiguous" }, { iterateCyclesOnPhase: 3 })),
    ).toEqual([]);
  });
});

describe("applyChoice", () => {
  it("takes the accepted review choice", () => {
    const s = reviewDone({ parseable: false });
    expect(applyChoice({ kind: "save" }, s)).toEqual({
      to: "saving",
      effect: { kind: "run-skill", skill: "save" },
      why: expect.any(String),
    });
    expect(applyChoice({ kind: "iterate" }, s).to).toBe("iterating");
    expect(applyChoice({ kind: "document" }, s).to).toBe("documenting");
    expect(applyChoice({ kind: "block" }, s).to).toBe("blocked");
  });

  it("takes the accepted postcondition choice", () => {
    const s = workSnap("building", { postcondition: "ambiguous" });
    expect(applyChoice({ kind: "advance" }, s)).toEqual({
      to: "reviewing",
      effect: { kind: "run-skill", skill: "review" },
      why: expect.any(String),
    });
    expect(applyChoice({ kind: "retry" }, s).to).toBe("building");
    expect(applyChoice({ kind: "block" }, s).to).toBe("blocked");
  });

  it("advances from committing per plan facts", () => {
    expect(
      applyChoice(
        { kind: "advance" },
        workSnap("committing", { postcondition: "ambiguous" }, { planFacts: { kind: "phased-complete" }, phasePath: null }),
      ).to,
    ).toBe("done");
    expect(applyChoice({ kind: "advance" }, workSnap("committing", { postcondition: "ambiguous" })).to).toBe("building");
  });

  it("rejects choices outside the current legal set — no model string transitions state", () => {
    const review = reviewDone({ parseable: false });
    expect(() => applyChoice({ kind: "advance" }, review)).toThrow(IllegalChoiceError);
    expect(() => applyChoice({ kind: "retry" }, review)).toThrow(IllegalChoiceError);
    const build = workSnap("building", { postcondition: "ambiguous" });
    expect(() => applyChoice({ kind: "save" }, build)).toThrow(IllegalChoiceError);
    expect(() => applyChoice({ kind: "iterate" }, build)).toThrow(IllegalChoiceError);
  });

  it("rejects every choice once limits are exceeded", () => {
    const s = reviewDone({ parseable: false }, { loopCount: 12, maxLoops: 12 });
    expect(() => applyChoice({ kind: "save" }, s)).toThrow(IllegalChoiceError);
  });

  it("rejects choices in deterministic situations entirely", () => {
    expect(() => applyChoice({ kind: "save" }, workSnap("building"))).toThrow(IllegalChoiceError);
    expect(() => applyChoice({ kind: "advance" }, snap())).toThrow(IllegalChoiceError);
  });
});

describe("next: non-loop states fail explicitly", () => {
  it.each(["idle", "blocked", "done", "aborted"] as const)("throws for %s", (state) => {
    expect(() => next(snap({ state }))).toThrow(IllegalTransitionError);
  });
});

describe("operator-owned edges", () => {
  it("START moves idle → resolving", () => {
    expect(start()).toEqual({ to: "resolving", effect: { kind: "none" }, why: expect.any(String) });
  });

  it("USER_CONFIRMED moves blocked → resolving", () => {
    expect(userConfirmed().to).toBe("resolving");
  });

  it("STOP aborts from any loop state", () => {
    expect(stopFrom("building").to).toBe("aborted");
    expect(stopFrom("idle").to).toBe("aborted");
  });
});

describe("contract purity", () => {
  it("types.ts imports nothing at all", () => {
    const src = readFileSync(new URL("../types.ts", import.meta.url), "utf8");
    expect(src.match(/^\s*import\b/m)).toBeNull();
    expect(src).not.toContain("require(");
  });

  it("table.ts stays free of xstate, node/platform, and OMP SDK dependencies", () => {
    const src = readFileSync(new URL("../table.ts", import.meta.url), "utf8");
    const forbidden = [
      /["']xstate["']/,
      /["']node:[\w.]+["']/,
      /\brequire\s*\(/,
      /["']\.\.\/omp-models/,
      /\bcreateAgentSession\b/,
      /\breadFileSync\b|\breaddirSync\b|\bexecSync\b|\bspawnSync\b/,
      /\bprocess\.\w/,
      /\bnew Date\b|\bDate\.now\b/,
    ];
    for (const pattern of forbidden) {
      expect(src.match(pattern), `table.ts must not match ${pattern}`).toBeNull();
    }
  });
});

// Choice exhaustiveness guard: the closed set is part of the frozen contract.
const ALL_CHOICES: readonly Choice["kind"][] = [
  "iterate",
  "document",
  "save",
  "retry",
  "advance",
  "block",
];
void ALL_CHOICES;
