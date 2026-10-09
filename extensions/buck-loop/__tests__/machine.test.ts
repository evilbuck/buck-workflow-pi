/**
 * Buck machine policy tests. Fixture snapshots, no disk and no model.
 * Covers deterministic edges, closed choice sets, illegal choices, and
 * operator-owned START / USER_CONFIRMED / STOP.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { IllegalTransitionError, UnknownStateError } from "../../state_machine/index.js";
import {
  BuckMachineError,
  buckMachine,
  MAX_ITERATE_CYCLES_PER_PHASE,
  applyChoice,
  legalChoices,
  limitsExceeded,
  next,
  start,
  stopFrom,
  userConfirmed,
} from "../machine.js";
import type { RankingFacts, ReviewFacts, Snapshot, WorkFacts, WorkSkill, WorkState } from "../types.js";

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

  it("ranks rather than blocking at the iterate ceiling; the limit applies once a rank is in (Q2)", () => {
    const t = next(
      reviewDone(
        { iterateArtifact: true },
        { iterateCyclesOnPhase: MAX_ITERATE_CYCLES_PER_PHASE },
      ),
    );
    expect(t).toEqual({
      to: "ranking",
      effect: { kind: "rank" },
      why: "unfinished iterate artifact; ranking in-plan issues before iterating",
    });
  });

  it("exposes limitsExceeded for the global loop ceiling only", () => {
    expect(limitsExceeded(snap({ loopCount: 5, maxLoops: 5 }))).toBe(true);
    expect(limitsExceeded(snap({ iterateCyclesOnPhase: MAX_ITERATE_CYCLES_PER_PHASE }))).toBe(false);
    expect(limitsExceeded(snap())).toBe(false);
  });

  it("still saves a clean review when the iterate ceiling is reached", () => {
    const t = next(reviewDone({ parseable: true }, { iterateCyclesOnPhase: MAX_ITERATE_CYCLES_PER_PHASE }));
    expect(t.to).toBe("saving");
    expect(t.effect).toEqual({ kind: "run-skill", skill: "save" });
  });

  it("still documents when review flags docs impact at the iterate ceiling", () => {
    const t = next(
      reviewDone({ parseable: true, docsImpact: true }, { iterateCyclesOnPhase: MAX_ITERATE_CYCLES_PER_PHASE }),
    );
    expect(t.to).toBe("documenting");
    expect(t.effect).toEqual({ kind: "run-skill", skill: "docs" });
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

  it("blocks unphased plans without completed closeout evidence", () => {
    const t = next(workSnap("committing", {}, {
      planFacts: { kind: "unphased", closeEligible: false, openAcceptanceLines: ["- [ ] All seven criteria"] },
      phasePath: null,
    }));
    expect(t.to).toBe("blocked");
    expect(t.effect).toMatchObject({ kind: "await-operator", reason: expect.stringContaining("All seven criteria") });
  });

  it("committing → done for an eligible unphased plan", () => {
    const t = next(workSnap("committing", {}, {
      planFacts: { kind: "unphased", closeEligible: true, openAcceptanceLines: [] },
      phasePath: null,
    }));
    expect(t.to).toBe("done");
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
  it.each(POSTCONDITION_STATES.filter((state) => state !== "committing"))("stays in %s and offers retry|advance in file mode", (state) => {
    const sqlUrl = process.env.SQL_MEMORY_URL;
    delete process.env.SQL_MEMORY_URL;
    try {
      const t = next(workSnap(state, { postcondition: "ambiguous" }));
      expect(t.to).toBe(state);
      expect(t.effect).toEqual({
        kind: "choose",
        legal: [{ kind: "retry" }, { kind: "advance" }],
      });
    } finally {
      if (sqlUrl !== undefined) process.env.SQL_MEMORY_URL = sqlUrl;
    }
  });
  it("blocks ambiguous committing outcomes without model-selected advance", () => {
    const snapshot = workSnap("committing", { sessionOutcome: "ok", postcondition: "ambiguous" });
    expect(next(snapshot)).toMatchObject({
      to: "blocked",
      effect: { kind: "await-operator" },
    });
    expect(legalChoices("committing", snapshot)).toEqual([]);
  });

  it("never offers advance on an unverified SQL save", () => {
    const previous = process.env.SQL_MEMORY_URL;
    process.env.SQL_MEMORY_URL = "postgres://unused";
    try {
      expect(next(workSnap("saving", { postcondition: "ambiguous" })).effect).toEqual({
        kind: "choose", legal: [{ kind: "retry" }],
      });
    } finally {
      if (previous === undefined) delete process.env.SQL_MEMORY_URL;
      else process.env.SQL_MEMORY_URL = previous;
    }
  });

  it.each(POSTCONDITION_STATES)("blocks a second ambiguous %s retry without asking", (state) => {
    const t = next(workSnap(state, { postcondition: "ambiguous", retriesUsed: 1 }));
    expect(t.to).toBe("blocked");
    expect(t.effect).toEqual({
      kind: "await-operator",
      reason: "postcondition still ambiguous after one retry; refusing another spin",
    });
    expect(legalChoices(state, workSnap(state, { postcondition: "ambiguous", retriesUsed: 1 }))).toEqual([]);
  });
});

describe("next: reviewing", () => {
  it("routes an unfinished iterate artifact to ranking, never straight to iterating", () => {
    const t = next(reviewDone({ iterateArtifact: true }));
    expect(t).toEqual({
      to: "ranking",
      effect: { kind: "rank" },
      why: "unfinished iterate artifact; ranking in-plan issues before iterating",
    });
  });

  it("ranks ahead of documentation impact and the save route", () => {
    const t = next(reviewDone({ iterateArtifact: true, docsImpact: true, howtoImpact: true }));
    expect(t.to).toBe("ranking");
    expect(t.effect).toEqual({ kind: "rank" });
  });

  it("ranks an unparseable report's artifact rather than iterating it unranked", () => {
    const t = next(reviewDone({ iterateArtifact: true, parseable: false }));
    expect(t.to).toBe("ranking");
    expect(t.effect).toEqual({ kind: "rank" });
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
      legal: [{ kind: "iterate" }, { kind: "document" }, { kind: "save" }],
    });
  });

  it("blocks explicitly when a finished review produced no report facts (scan defect)", () => {
    const t = next(snap({ state: "reviewing", workFacts: wf({ sessionOutcome: "ok" }) }));
    expect(t.to).toBe("blocked");
    expect(t.effect.kind).toBe("await-operator");
  });

  it("blocks an unranked artifact at the loop limit before spending a rank", () => {
    const t = next(reviewDone({ iterateArtifact: true }, { loopCount: 12 }));
    expect(t.to).toBe("blocked");
    expect(t.effect).toEqual({
      kind: "await-operator",
      reason: "loop limit reached (12 >= 12); refusing further work",
    });
  });
});

/** A snapshot parked in `ranking` carrying the verdict the `rank` effect reported back. */
function rankingDone(ranking: RankingFacts, overrides: Partial<Snapshot> = {}): Snapshot {
  return snap({
    state: "ranking",
    reviewFacts: rf({ iterateArtifact: true, ranking }),
    ...overrides,
  });
}

describe("next: ranking", () => {
  it("re-emits the rank effect while a garbled report has no docs verdict yet", () => {
    // A garbled report carries an ABSENT docsVerdict, not a "pending" one:
    // every DocsVerdict member is terminal, so absence is the only "not yet".
    const pending = snap({
      state: "ranking",
      reviewFacts: rf({
        iterateArtifact: true,
        parseable: false,
        ranking: { kind: "ranked", above: false },
      }),
    });
    const t = next(pending);
    expect(t).toEqual({ to: "ranking", effect: { kind: "rank" }, why: "review ranking still pending" });
    expect(legalChoices("ranking", pending)).toEqual([]);
  });

  it("iterates when an issue cleared the waterline and budget remains", () => {
    const t = next(rankingDone({ kind: "ranked", above: true }));
    expect(t).toEqual({
      to: "iterating",
      effect: { kind: "run-skill", skill: "iterate" },
      why: "issue above the severity waterline; in-plan issues win",
    });
  });

  it("uses the existing limit block when an issue is above the waterline with no budget", () => {
    const t = next(rankingDone({ kind: "ranked", above: true }, { iterateCyclesOnPhase: MAX_ITERATE_CYCLES_PER_PHASE }));
    expect(t).toEqual({
      to: "blocked",
      effect: { kind: "await-operator", reason: "iterate limit reached on this phase (6 >= 6)" },
      why: "iterate limit reached on this phase (6 >= 6)",
    });
  });

  it("pins the global limit when both ceilings are reached above the waterline", () => {
    const t = next(rankingDone({ kind: "ranked", above: true }, { loopCount: 12, iterateCyclesOnPhase: 6 }));
    expect(t.effect).toEqual({
      kind: "await-operator",
      reason: "loop limit reached (12 >= 12); refusing further work",
    });
  });

  it("documents when a clear report flags docs impact and nothing cleared the waterline", () => {
    const t = next(snap({
      state: "ranking",
      reviewFacts: rf({
        iterateArtifact: true,
        parseable: true,
        docsImpact: true,
        ranking: { kind: "ranked", above: false },
      }),
    }));
    expect(t).toEqual({
      to: "documenting",
      effect: { kind: "run-skill", skill: "docs" },
      why: "nothing above the waterline; documentation impact flagged",
    });
  });

  it("saves on a clear report with neither flag, including at the iterate ceiling (A-6)", () => {
    const t = next(snap({
      state: "ranking",
      reviewFacts: rf({ iterateArtifact: true, parseable: true, ranking: { kind: "ranked", above: false } }),
      iterateCyclesOnPhase: MAX_ITERATE_CYCLES_PER_PHASE,
    }));
    expect(t).toEqual({
      to: "saving",
      effect: { kind: "run-skill", skill: "save" },
      why: "nothing above the waterline; clean review; saving",
    });
  });

  it("routes a garbled report on the loop's own docs verdict rather than the report's flags", () => {
    const flagged = next(snap({
      state: "ranking",
      reviewFacts: rf({
        iterateArtifact: true,
        parseable: false,
        ranking: { kind: "ranked", above: false, docsVerdict: "flagged" },
      }),
    }));
    expect(flagged.to).toBe("documenting");

    const none = next(snap({
      state: "ranking",
      reviewFacts: rf({
        iterateArtifact: true,
        parseable: false,
        ranking: { kind: "ranked", above: false, docsVerdict: "none" },
      }),
    }));
    expect(none.to).toBe("saving");
  });

  it("opens the closed document/save choice when the docs evaluation fails twice (A-11)", () => {
    const s = snap({
      state: "ranking",
      reviewFacts: rf({
        iterateArtifact: true,
        parseable: false,
        ranking: { kind: "ranked", above: false, docsVerdict: "unresolved" },
      }),
    });
    const t = next(s);
    expect(t.to).toBe("ranking");
    expect(t.effect).toEqual({
      kind: "choose",
      legal: [{ kind: "document" }, { kind: "save" }],
    });
    expect(legalChoices("ranking", s)).toEqual([{ kind: "document" }, { kind: "save" }]);
    // Nothing cleared the waterline, so iterate is never on offer from ranking.
    expect(legalChoices("ranking", s).map((choice) => choice.kind)).not.toContain("iterate");
  });

  it("takes the operator's document or save answer for the unresolved verdict", () => {
    const s = snap({
      state: "ranking",
      reviewFacts: rf({
        iterateArtifact: true,
        parseable: false,
        ranking: { kind: "ranked", above: false, docsVerdict: "unresolved" },
      }),
    });
    expect(applyChoice({ kind: "document" }, s).to).toBe("documenting");
    expect(applyChoice({ kind: "save" }, s).to).toBe("saving");
    expect(() => applyChoice({ kind: "iterate" }, s)).toThrow(BuckMachineError);
  });

  it("blocks with the scan-defect reason when the rank failed (R-2)", () => {
    const t = next(rankingDone({ kind: "blocked", reason: "multiple unfinished iterate artifacts" }));
    expect(t).toEqual({
      to: "blocked",
      effect: { kind: "await-operator", reason: "review ranking failed (scan defect): multiple unfinished iterate artifacts" },
      why: "review ranking failed (scan defect): multiple unfinished iterate artifacts",
    });
  });

  it("blocks an artifact that parsed to zero issues instead of saving (R-2)", () => {
    const t = next(rankingDone({ kind: "blocked", reason: "unfinished iterate artifact contains no parseable issues" }));
    expect(t.to).toBe("blocked");
    expect(t.why).toContain("scan defect");
  });

  it("refuses a rank at the loop limit and blocks with the global reason", () => {
    const t = next(rankingDone({ kind: "ranked", above: false }, { loopCount: 12 }));
    expect(t.effect).toEqual({
      kind: "await-operator",
      reason: "loop limit reached (12 >= 12); refusing further work",
    });
  });

  it("never iterates from ranking when nothing cleared the waterline", () => {
    for (const docsVerdict of ["flagged", "none", "unresolved"] as const) {
      const targets = buckMachine.restore("ranking").available({
        ...rankingDone({ kind: "ranked", above: false, docsVerdict }),
        sqlMemoryConfigured: false,
      });
      expect(targets).not.toContain("iterating");
    }
    // …and the still-unjudged garbled case, which has no verdict at all.
    const unjudged = buckMachine.restore("ranking").available({
      ...snap({
        state: "ranking",
        reviewFacts: rf({ iterateArtifact: true, parseable: false, ranking: { kind: "ranked", above: false } }),
      }),
      sqlMemoryConfigured: false,
    });
    expect(unjudged).not.toContain("iterating");
  });

  it("exposes STOP from ranking as an operator-only edge", () => {
    expect(buckMachine.edge("ranking", "aborted").manual).toBe(true);
    expect(stopFrom("ranking")).toEqual({
      to: "aborted",
      effect: { kind: "none" },
      why: "STOP requested by operator from ranking",
    });
  });

  it("treats a garbled report with no recorded verdict as still owing a judgment", () => {
    // Guards a fail-open: a missing verdict must not read as a clean save.
    const t = next(snap({
      state: "ranking",
      reviewFacts: rf({ iterateArtifact: true, parseable: false, ranking: { kind: "ranked", above: false } }),
    }));
    expect(t).toEqual({ to: "ranking", effect: { kind: "rank" }, why: "review ranking still pending" });
  });

  it("trusts a clear report without a verdict rather than re-judging it (Q6)", () => {
    const t = next(snap({
      state: "ranking",
      reviewFacts: rf({ iterateArtifact: true, parseable: true, ranking: { kind: "ranked", above: false } }),
    }));
    expect(t.to).toBe("saving");
  });

  it("blocks an absent ranking outcome at the global loop limit", () => {
    const t = next(snap({
      state: "ranking",
      reviewFacts: rf({ iterateArtifact: true }),
      loopCount: 12,
    }));
    expect(t.to).toBe("blocked");
    expect(t.effect).toEqual({
      kind: "await-operator",
      reason: "loop limit reached (12 >= 12); refusing further work",
    });
  });

  it("blocks rather than dropping an unjudged garbled report at the loop limit", () => {
    const t = next(snap({
      state: "ranking",
      reviewFacts: rf({
        iterateArtifact: true,
        parseable: false,
        ranking: { kind: "ranked", above: false },
      }),
      loopCount: 12,
    }));
    expect(t.effect).toEqual({
      kind: "await-operator",
      reason: "loop limit reached (12 >= 12); refusing further work",
    });
  });

  it("offers no choice at the loop limit even when the verdict is unresolved", () => {
    const s = snap({
      state: "ranking",
      reviewFacts: rf({
        iterateArtifact: true,
        parseable: false,
        ranking: { kind: "ranked", above: false, docsVerdict: "unresolved" },
      }),
      loopCount: 12,
    });
    expect(legalChoices("ranking", s)).toEqual([]);
  });

  it("tells a verdict-less garbled rank from a verdict-less clear one by report.parseable", () => {
    // The absence of `docsVerdict` is ambiguous on its own — both snapshots
    // carry the identical RankingFacts. `scan.ts` owns `parseable`, and that
    // is what separates "unjudged" from "done, route on".
    const unjudged = { kind: "ranked", above: false } as const;
    const garbled = next(snap({
      state: "ranking",
      reviewFacts: rf({ iterateArtifact: true, parseable: false, ranking: unjudged }),
    }));
    const clear = next(snap({
      state: "ranking",
      reviewFacts: rf({ iterateArtifact: true, parseable: true, ranking: unjudged }),
    }));
    // Identical verdict, opposite routing — the split is the scan's to make.
    expect(garbled.effect).toEqual({ kind: "rank" });
    expect(clear.effect).toEqual({ kind: "run-skill", skill: "save" });
  });

  it.each(["flagged", "none", "unresolved"] as const)("trusts clear-report impact flags over a conflicting %s verdict", (docsVerdict) => {
    const ranked = { kind: "ranked" as const, above: false, docsVerdict };
    const clear = snap({ state: "ranking", reviewFacts: rf({ iterateArtifact: true, parseable: true, ranking: ranked }) });
    const flagged = snap({ state: "ranking", reviewFacts: rf({ iterateArtifact: true, parseable: true, docsImpact: true, ranking: ranked }) });
    expect(next(clear).effect).toEqual({ kind: "run-skill", skill: "save" });
    expect(next(flagged).effect).toEqual({ kind: "run-skill", skill: "docs" });
  });

  it("does not route stale impact flags from a garbled report before its judgment", () => {
    const s = snap({ state: "ranking", reviewFacts: rf({ iterateArtifact: true, parseable: false, docsImpact: true, ranking: { kind: "ranked", above: false } }) });
    expect(next(s).effect).toEqual({ kind: "rank" });
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
    ]);
  });

  it("offers the postcondition set exactly when the scan is ambiguous", () => {
    expect(legalChoices("building", workSnap("building", { postcondition: "ambiguous" }))).toEqual([
      { kind: "retry" },
      { kind: "advance" },
    ]);
  });

  it("keeps non-iterate choices at the iterate ceiling and empties only at the loop ceiling", () => {
    expect(legalChoices("reviewing", reviewDone({ parseable: false }, { loopCount: 12, maxLoops: 12 }))).toEqual([]);
    expect(
      legalChoices("building", workSnap("building", { postcondition: "ambiguous" }, { iterateCyclesOnPhase: MAX_ITERATE_CYCLES_PER_PHASE })),
    ).toEqual([{ kind: "retry" }, { kind: "advance" }]);
    expect(legalChoices("reviewing", reviewDone({ parseable: false }, { iterateCyclesOnPhase: MAX_ITERATE_CYCLES_PER_PHASE }))).toEqual([
      { kind: "document" },
      { kind: "save" },
    ]);
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
    expect(() => applyChoice({ kind: "block" }, s)).toThrow(BuckMachineError);
  });

  it("takes the accepted postcondition choice", () => {
    const s = workSnap("building", { postcondition: "ambiguous" });
    expect(applyChoice({ kind: "advance" }, s)).toEqual({
      to: "reviewing",
      effect: { kind: "run-skill", skill: "review" },
      why: expect.any(String),
    });
    expect(applyChoice({ kind: "retry" }, s).to).toBe("building");
    expect(() => applyChoice({ kind: "block" }, s)).toThrow(BuckMachineError);
  });

  it("does not allow an ambiguous commit to advance by choice", () => {
    const snapshot = workSnap("committing", { postcondition: "ambiguous" });
    expect(() => applyChoice({ kind: "advance" }, snapshot)).toThrow(BuckMachineError);
    expect(() => applyChoice({ kind: "retry" }, snapshot)).toThrow(BuckMachineError);
  });

  it("rejects choices outside the current legal set — no model string transitions state", () => {
    const review = reviewDone({ parseable: false });
    expect(() => applyChoice({ kind: "advance" }, review)).toThrow(BuckMachineError);
    expect(() => applyChoice({ kind: "retry" }, review)).toThrow(BuckMachineError);
    const build = workSnap("building", { postcondition: "ambiguous" });
    expect(() => applyChoice({ kind: "save" }, build)).toThrow(BuckMachineError);
    expect(() => applyChoice({ kind: "iterate" }, build)).toThrow(BuckMachineError);
  });

  it("rejects every choice once limits are exceeded", () => {
    const s = reviewDone({ parseable: false }, { loopCount: 12, maxLoops: 12 });
    expect(() => applyChoice({ kind: "save" }, s)).toThrow(BuckMachineError);
  });

  it("rejects choices in deterministic situations entirely", () => {
    expect(() => applyChoice({ kind: "save" }, workSnap("building"))).toThrow(BuckMachineError);
    expect(() => applyChoice({ kind: "advance" }, snap())).toThrow(BuckMachineError);
  });
});

describe("next: non-loop states fail explicitly", () => {
  it.each(["idle", "blocked", "done", "aborted"] as const)("throws for %s", (state) => {
    expect(() => next(snap({ state }))).toThrow(BuckMachineError);
  });
});

describe("operator-owned edges", () => {
  it("START moves idle → resolving", () => {
    expect(start()).toEqual({ to: "resolving", effect: { kind: "none" }, why: expect.any(String) });
  });

  it("USER_CONFIRMED moves blocked → resolving", () => {
    expect(userConfirmed(snap({ state: "blocked" })).to).toBe("resolving");
  });

  it("USER_CONFIRMED repairs a failed commit instead of resolving", () => {
    const failed = snap({
      state: "blocked",
      history: [{ from: "repairing", to: "blocked", at: "2026-10-06", why: "pin failed" }],
    });
    expect(userConfirmed(failed)).toEqual({
      to: "repairing",
      effect: { kind: "none" },
      why: "USER_CONFIRMED: repair the failed commit, then b-commit",
    });
    expect(next(snap({ state: "repairing" })).effect).toEqual({ kind: "repair" });
    expect(next(snap({
      state: "repairing",
      commitCheckpoint: { targetPath: PHASE_PATH, baseHead: "a".repeat(40) },
    }))).toMatchObject({ to: "committing", effect: { kind: "run-skill", skill: "commit" } });
  });

  it("STOP aborts from any loop state", () => {
    expect(stopFrom("building").to).toBe("aborted");
    expect(stopFrom("idle").to).toBe("aborted");
  });
});

describe("SQL save cannot vote past persistence", () => {
  const previous = process.env.SQL_MEMORY_URL;

  afterEach(() => {
    if (previous === undefined) delete process.env.SQL_MEMORY_URL;
    else process.env.SQL_MEMORY_URL = previous;
  });

  it("removes the saving advance choice when SQL memory is configured", () => {
    process.env.SQL_MEMORY_URL = "postgres://example.invalid/sql-save";
    const choices = legalChoices("saving", snap({
      state: "saving",
      workFacts: wf({ sessionOutcome: "ok", postcondition: "ambiguous", retriesUsed: 0 }),
    }));
    expect(choices.map((choice) => choice.kind)).toEqual(["retry"]);
  });

  it("keeps the saving advance choice in file mode", () => {
    delete process.env.SQL_MEMORY_URL;
    const choices = legalChoices("saving", snap({
      state: "saving",
      workFacts: wf({ sessionOutcome: "ok", postcondition: "ambiguous", retriesUsed: 0 }),
    }));
    expect(choices.map((choice) => choice.kind)).toEqual(["retry", "advance"]);
  });
});


// Literal transition fixtures captured from the legacy rules before the cutover.
// Tests enter the production adapters; no engine or model is mocked.
const LEGACY_ROWS = [
  {
    "id": "start",
    "overrides": {"state":"idle"},
    "event": "START",
    "expected": {"to":"resolving","effect":{"kind":"none"},"why":"START: operator supplied a path"},
  },
  {
    "id": "stop-from-idle",
    "overrides": {"state":"idle"},
    "event": "STOP",
    "expected": {"to":"aborted","effect":{"kind":"none"},"why":"STOP requested by operator from idle"},
  },
  {
    "id": "resolving-incomplete",
    "overrides": {},
    "expected": {"to":"building","effect":{"kind":"run-skill","skill":"build"},"why":"active incomplete phase; running its build"},
  },
  {
    "id": "stop-from-resolving",
    "overrides": {},
    "event": "STOP",
    "expected": {"to":"aborted","effect":{"kind":"none"},"why":"STOP requested by operator from resolving"},
  },
  {
    "id": "resolving-unphased",
    "overrides": {"planFacts":{"kind":"unphased"}},
    "expected": {"to":"building","effect":{"kind":"run-skill","skill":"build"},"why":"unphased plan; running its single build cycle"},
  },
  {
    "id": "resolving-complete",
    "overrides": {"planFacts":{"kind":"phased-complete"}},
    "expected": {"to":"done","effect":{"kind":"none"},"why":"all phases completed"},
  },
  {
    "id": "resolving-missing",
    "overrides": {"planFacts":{"kind":"missing","reason":"fixture missing"}},
    "expected": {"to":"blocked","effect":{"kind":"await-operator","reason":"plan unresolved: fixture missing"},"why":"plan unresolved: fixture missing"},
  },
  {
    "id": "resolving-incomplete-loop-limit",
    "overrides": {"loopCount":12},
    "expected": {"to":"blocked","effect":{"kind":"await-operator","reason":"loop limit reached (12 >= 12); refusing further work"},"why":"loop limit reached (12 >= 12); refusing further work"},
  },
  {
    "id": "resolving-unphased-loop-limit",
    "overrides": {"planFacts":{"kind":"unphased"},"loopCount":12},
    "expected": {"to":"blocked","effect":{"kind":"await-operator","reason":"loop limit reached (12 >= 12); refusing further work"},"why":"loop limit reached (12 >= 12); refusing further work"},
  },
  {
    "id": "building-session-pending",
    "overrides": {"state":"building"},
    "expected": {"to":"building","effect":{"kind":"run-skill","skill":"build"},"why":"building session has not run yet"},
  },
  {
    "id": "stop-from-building",
    "overrides": {"state":"building"},
    "event": "STOP",
    "expected": {"to":"aborted","effect":{"kind":"none"},"why":"STOP requested by operator from building"},
  },
  {
    "id": "building-session-pending-loop-limit",
    "overrides": {"state":"building","loopCount":12},
    "expected": {"to":"blocked","effect":{"kind":"await-operator","reason":"loop limit reached (12 >= 12); refusing further work"},"why":"loop limit reached (12 >= 12); refusing further work"},
  },
  {
    "id": "building-session-retry",
    "overrides": {"state":"building","workFacts":{"sessionOutcome":"failed","retriesUsed":0,"postcondition":"pending"}},
    "expected": {"to":"building","effect":{"kind":"run-skill","skill":"build"},"why":"building session failed; retrying once"},
  },
  {
    "id": "building-session-retry-loop-limit",
    "overrides": {"state":"building","workFacts":{"sessionOutcome":"failed","retriesUsed":0,"postcondition":"pending"},"loopCount":12},
    "expected": {"to":"blocked","effect":{"kind":"await-operator","reason":"loop limit reached (12 >= 12); refusing further work"},"why":"loop limit reached (12 >= 12); refusing further work"},
  },
  {
    "id": "building-session-failed-again",
    "overrides": {"state":"building","workFacts":{"sessionOutcome":"failed","retriesUsed":1,"postcondition":"pending"}},
    "expected": {"to":"blocked","effect":{"kind":"await-operator","reason":"building session failed again after one retry"},"why":"building session failed again after one retry"},
  },
  {
    "id": "building-postcondition-missing",
    "overrides": {"state":"building","workFacts":{"sessionOutcome":"ok","retriesUsed":0,"postcondition":"pending"}},
    "expected": {"to":"blocked","effect":{"kind":"await-operator","reason":"building session finished but postcondition is pending (scan defect)"},"why":"building session finished but postcondition is pending (scan defect)"},
  },
  {
    "id": "building-confirmed-review",
    "overrides": {"state":"building","workFacts":{"sessionOutcome":"ok","retriesUsed":0,"postcondition":"confirmed"}},
    "expected": {"to":"reviewing","effect":{"kind":"run-skill","skill":"review"},"why":"work landed; reviewing it"},
  },
  {
    "id": "building-confirmed-loop-limit",
    "overrides": {"state":"building","workFacts":{"sessionOutcome":"ok","retriesUsed":0,"postcondition":"confirmed"},"loopCount":12},
    "expected": {"to":"blocked","effect":{"kind":"await-operator","reason":"loop limit reached (12 >= 12); refusing further work"},"why":"loop limit reached (12 >= 12); refusing further work"},
  },
  {
    "id": "building-choice-retry",
    "overrides": {"state":"building","workFacts":{"sessionOutcome":"ok","retriesUsed":0,"postcondition":"ambiguous"}},
    "choice": {"kind":"retry"},
    "expected": {"to":"building","effect":{"kind":"run-skill","skill":"build"},"why":"accepted choice: retry the session"},
  },
  {
    "id": "building-choice-advance",
    "overrides": {"state":"building","workFacts":{"sessionOutcome":"ok","retriesUsed":0,"postcondition":"ambiguous"}},
    "choice": {"kind":"advance"},
    "expected": {"to":"reviewing","effect":{"kind":"run-skill","skill":"review"},"why":"work landed; reviewing it"},
  },
  {
    "id": "building-postcondition-ambiguous-loop-limit",
    "overrides": {"state":"building","workFacts":{"sessionOutcome":"ok","retriesUsed":0,"postcondition":"ambiguous"},"loopCount":12},
    "expected": {"to":"blocked","effect":{"kind":"await-operator","reason":"postcondition ambiguous and no legal choice remains (limits exceeded)"},"why":"postcondition ambiguous and no legal choice remains (limits exceeded)"},
  },
  {
    "id": "building-postcondition-ambiguous-retry-exhausted",
    "overrides": {"state":"building","workFacts":{"sessionOutcome":"ok","retriesUsed":1,"postcondition":"ambiguous"}},
    "expected": {"to":"blocked","effect":{"kind":"await-operator","reason":"postcondition still ambiguous after one retry; refusing another spin"},"why":"postcondition still ambiguous after one retry; refusing another spin"},
  },
  {
    "id": "iterating-session-pending",
    "overrides": {"state":"iterating"},
    "expected": {"to":"iterating","effect":{"kind":"run-skill","skill":"iterate"},"why":"iterating session has not run yet"},
  },
  {
    "id": "stop-from-iterating",
    "overrides": {"state":"iterating"},
    "event": "STOP",
    "expected": {"to":"aborted","effect":{"kind":"none"},"why":"STOP requested by operator from iterating"},
  },
  {
    "id": "iterating-session-pending-iterate-limit",
    "overrides": {"state":"iterating","iterateCyclesOnPhase":6},
    "expected": {"to":"blocked","effect":{"kind":"await-operator","reason":"iterate limit reached on this phase (6 >= 6)"},"why":"iterate limit reached on this phase (6 >= 6)"},
  },
  {
    "id": "iterating-session-retry",
    "overrides": {"state":"iterating","workFacts":{"sessionOutcome":"failed","retriesUsed":0,"postcondition":"pending"}},
    "expected": {"to":"iterating","effect":{"kind":"run-skill","skill":"iterate"},"why":"iterating session failed; retrying once"},
  },
  {
    "id": "iterating-session-retry-iterate-limit",
    "overrides": {"state":"iterating","workFacts":{"sessionOutcome":"failed","retriesUsed":0,"postcondition":"pending"},"iterateCyclesOnPhase":6},
    "expected": {"to":"blocked","effect":{"kind":"await-operator","reason":"iterate limit reached on this phase (6 >= 6)"},"why":"iterate limit reached on this phase (6 >= 6)"},
  },
  {
    "id": "iterating-session-failed-again",
    "overrides": {"state":"iterating","workFacts":{"sessionOutcome":"failed","retriesUsed":1,"postcondition":"pending"}},
    "expected": {"to":"blocked","effect":{"kind":"await-operator","reason":"iterating session failed again after one retry"},"why":"iterating session failed again after one retry"},
  },
  {
    "id": "iterating-postcondition-missing",
    "overrides": {"state":"iterating","workFacts":{"sessionOutcome":"ok","retriesUsed":0,"postcondition":"pending"}},
    "expected": {"to":"blocked","effect":{"kind":"await-operator","reason":"iterating session finished but postcondition is pending (scan defect)"},"why":"iterating session finished but postcondition is pending (scan defect)"},
  },
  {
    "id": "iterating-confirmed-review",
    "overrides": {"state":"iterating","workFacts":{"sessionOutcome":"ok","retriesUsed":0,"postcondition":"confirmed"}},
    "expected": {"to":"reviewing","effect":{"kind":"run-skill","skill":"review"},"why":"work landed; reviewing it"},
  },
  {
    "id": "iterating-confirmed-loop-limit",
    "overrides": {"state":"iterating","workFacts":{"sessionOutcome":"ok","retriesUsed":0,"postcondition":"confirmed"},"loopCount":12},
    "expected": {"to":"blocked","effect":{"kind":"await-operator","reason":"loop limit reached (12 >= 12); refusing further work"},"why":"loop limit reached (12 >= 12); refusing further work"},
  },
  {
    "id": "iterating-choice-retry",
    "overrides": {"state":"iterating","workFacts":{"sessionOutcome":"ok","retriesUsed":0,"postcondition":"ambiguous"}},
    "choice": {"kind":"retry"},
    "expected": {"to":"iterating","effect":{"kind":"run-skill","skill":"iterate"},"why":"accepted choice: retry the session"},
  },
  {
    "id": "iterating-choice-advance",
    "overrides": {"state":"iterating","workFacts":{"sessionOutcome":"ok","retriesUsed":0,"postcondition":"ambiguous"}},
    "choice": {"kind":"advance"},
    "expected": {"to":"reviewing","effect":{"kind":"run-skill","skill":"review"},"why":"work landed; reviewing it"},
  },
  {
    "id": "iterating-postcondition-ambiguous-loop-limit",
    "overrides": {"state":"iterating","workFacts":{"sessionOutcome":"ok","retriesUsed":0,"postcondition":"ambiguous"},"loopCount":12},
    "expected": {"to":"blocked","effect":{"kind":"await-operator","reason":"postcondition ambiguous and no legal choice remains (limits exceeded)"},"why":"postcondition ambiguous and no legal choice remains (limits exceeded)"},
  },
  {
    "id": "iterating-postcondition-ambiguous-retry-exhausted",
    "overrides": {"state":"iterating","workFacts":{"sessionOutcome":"ok","retriesUsed":1,"postcondition":"ambiguous"}},
    "expected": {"to":"blocked","effect":{"kind":"await-operator","reason":"postcondition still ambiguous after one retry; refusing another spin"},"why":"postcondition still ambiguous after one retry; refusing another spin"},
  },
  {
    "id": "reviewing-session-pending",
    "overrides": {"state":"reviewing"},
    "expected": {"to":"reviewing","effect":{"kind":"run-skill","skill":"review"},"why":"reviewing session has not run yet"},
  },
  {
    "id": "stop-from-reviewing",
    "overrides": {"state":"reviewing"},
    "event": "STOP",
    "expected": {"to":"aborted","effect":{"kind":"none"},"why":"STOP requested by operator from reviewing"},
  },
  {
    "id": "reviewing-session-pending-loop-limit",
    "overrides": {"state":"reviewing","loopCount":12},
    "expected": {"to":"blocked","effect":{"kind":"await-operator","reason":"loop limit reached (12 >= 12); refusing further work"},"why":"loop limit reached (12 >= 12); refusing further work"},
  },
  {
    "id": "reviewing-session-retry",
    "overrides": {"state":"reviewing","workFacts":{"sessionOutcome":"failed","retriesUsed":0,"postcondition":"pending"}},
    "expected": {"to":"reviewing","effect":{"kind":"run-skill","skill":"review"},"why":"reviewing session failed; retrying once"},
  },
  {
    "id": "reviewing-session-retry-loop-limit",
    "overrides": {"state":"reviewing","workFacts":{"sessionOutcome":"failed","retriesUsed":0,"postcondition":"pending"},"loopCount":12},
    "expected": {"to":"blocked","effect":{"kind":"await-operator","reason":"loop limit reached (12 >= 12); refusing further work"},"why":"loop limit reached (12 >= 12); refusing further work"},
  },
  {
    "id": "reviewing-session-failed-again",
    "overrides": {"state":"reviewing","workFacts":{"sessionOutcome":"failed","retriesUsed":1,"postcondition":"pending"}},
    "expected": {"to":"blocked","effect":{"kind":"await-operator","reason":"reviewing session failed again after one retry"},"why":"reviewing session failed again after one retry"},
  },
  {
    "id": "reviewing-no-report",
    "overrides": {"state":"reviewing","workFacts":{"sessionOutcome":"ok","retriesUsed":0,"postcondition":"pending"}},
    "expected": {"to":"blocked","effect":{"kind":"await-operator","reason":"review session finished but no report facts were scanned (scan defect)"},"why":"review session finished but no report facts were scanned (scan defect)"},
  },
  {
    "id": "reviewing-iterate",
    "note": "SUPERSEDED by the ranking edge. Pre-change this artifact won outright; now it is ranked first.",
    "overrides": {"state":"reviewing","workFacts":{"sessionOutcome":"ok","retriesUsed":0,"postcondition":"pending"},"reviewFacts":{"kind":"report","parseable":true,"iterateArtifact":true,"docsImpact":true,"howtoImpact":true}},
    "expected": {"to":"ranking","effect":{"kind":"rank"},"why":"unfinished iterate artifact; ranking in-plan issues before iterating"},
  },
  {
    "id": "reviewing-docs",
    "overrides": {"state":"reviewing","workFacts":{"sessionOutcome":"ok","retriesUsed":0,"postcondition":"pending"},"reviewFacts":{"kind":"report","parseable":true,"iterateArtifact":false,"docsImpact":true,"howtoImpact":true}},
    "expected": {"to":"documenting","effect":{"kind":"run-skill","skill":"docs"},"why":"review flagged documentation impact"},
  },
  {
    "id": "reviewing-save",
    "overrides": {"state":"reviewing","workFacts":{"sessionOutcome":"ok","retriesUsed":0,"postcondition":"pending"},"reviewFacts":{"kind":"report","parseable":true,"iterateArtifact":false,"docsImpact":false,"howtoImpact":false}},
    "expected": {"to":"saving","effect":{"kind":"run-skill","skill":"save"},"why":"clean review; saving"},
  },
  {
    "id": "reviewing-choice-iterate",
    "overrides": {"state":"reviewing","workFacts":{"sessionOutcome":"ok","retriesUsed":0,"postcondition":"pending"},"reviewFacts":{"kind":"report","parseable":false,"iterateArtifact":false,"docsImpact":false,"howtoImpact":false}},
    "choice": {"kind":"iterate"},
    "expected": {"to":"iterating","effect":{"kind":"run-skill","skill":"iterate"},"why":"accepted choice: iterate on in-plan issues"},
  },
  {
    "id": "reviewing-choice-document",
    "overrides": {"state":"reviewing","workFacts":{"sessionOutcome":"ok","retriesUsed":0,"postcondition":"pending"},"reviewFacts":{"kind":"report","parseable":false,"iterateArtifact":false,"docsImpact":false,"howtoImpact":false}},
    "choice": {"kind":"document"},
    "expected": {"to":"documenting","effect":{"kind":"run-skill","skill":"docs"},"why":"accepted choice: document the impact"},
  },
  {
    "id": "reviewing-choice-save",
    "overrides": {"state":"reviewing","workFacts":{"sessionOutcome":"ok","retriesUsed":0,"postcondition":"pending"},"reviewFacts":{"kind":"report","parseable":false,"iterateArtifact":false,"docsImpact":false,"howtoImpact":false}},
    "choice": {"kind":"save"},
    "expected": {"to":"saving","effect":{"kind":"run-skill","skill":"save"},"why":"accepted choice: treat the review as clean and save"},
  },
  {
    "id": "reviewing-iterate-limit",
    "note": "SUPERSEDED. The ceiling now applies in ranking after the waterline verdict, not before it (grill Q2).",
    "overrides": {"state":"reviewing","workFacts":{"sessionOutcome":"ok","retriesUsed":0,"postcondition":"pending"},"reviewFacts":{"kind":"report","parseable":true,"iterateArtifact":true,"docsImpact":true,"howtoImpact":true},"iterateCyclesOnPhase":6},
    "expected": {"to":"ranking","effect":{"kind":"rank"},"why":"unfinished iterate artifact; ranking in-plan issues before iterating"},
  },
  {
    "id": "ranking-above-waterline-iterate-limit",
    "note": "The relocated ceiling check: an above-waterline issue with no budget blocks (grill Q2).",
    "overrides": {"state":"ranking","reviewFacts":{"kind":"report","parseable":true,"iterateArtifact":true,"docsImpact":true,"howtoImpact":true,"ranking":{"kind":"ranked","above":true}},"iterateCyclesOnPhase":6},
    "expected": {"to":"blocked","effect":{"kind":"await-operator","reason":"iterate limit reached on this phase (6 >= 6)"},"why":"iterate limit reached on this phase (6 >= 6)"},
  },
  {
    "id": "ranking-none-above-iterate-ceiling-saves",
    "note": "Grill Q2: nothing worth fixing moves on even after six fix rounds.",
    "overrides": {"state":"ranking","reviewFacts":{"kind":"report","parseable":true,"iterateArtifact":true,"docsImpact":false,"howtoImpact":false,"ranking":{"kind":"ranked","above":false}},"iterateCyclesOnPhase":6},
    "expected": {"to":"saving","effect":{"kind":"run-skill","skill":"save"},"why":"nothing above the waterline; clean review; saving"},
  },
  {
    "id": "ranking-scan-defect-blocks",
    "note": "R-2: an artifact that parses to zero issues blocks, never saves.",
    "overrides": {"state":"ranking","reviewFacts":{"kind":"report","parseable":true,"iterateArtifact":true,"docsImpact":false,"howtoImpact":false,"ranking":{"kind":"blocked","reason":"unfinished iterate artifact contains no parseable issues"}}},
    "expected": {"to":"blocked","effect":{"kind":"await-operator","reason":"review ranking failed (scan defect): unfinished iterate artifact contains no parseable issues"},"why":"review ranking failed (scan defect): unfinished iterate artifact contains no parseable issues"},
  },
  {
    "id": "ranking-two-unfinished-artifacts-block",
    "note": "A-10: the loop does not pick one of two unfinished artifacts.",
    "overrides": {"state":"ranking","reviewFacts":{"kind":"report","parseable":true,"iterateArtifact":true,"docsImpact":false,"howtoImpact":false,"ranking":{"kind":"blocked","reason":"multiple unfinished iterate artifacts"}}},
    "expected": {"to":"blocked","effect":{"kind":"await-operator","reason":"review ranking failed (scan defect): multiple unfinished iterate artifacts"},"why":"review ranking failed (scan defect): multiple unfinished iterate artifacts"},
  },
  {
    "id": "reviewing-docs-loop-limit",
    "overrides": {"state":"reviewing","workFacts":{"sessionOutcome":"ok","retriesUsed":0,"postcondition":"pending"},"reviewFacts":{"kind":"report","parseable":true,"iterateArtifact":false,"docsImpact":true,"howtoImpact":true},"loopCount":12},
    "expected": {"to":"blocked","effect":{"kind":"await-operator","reason":"loop limit reached (12 >= 12); refusing further work"},"why":"loop limit reached (12 >= 12); refusing further work"},
  },
  {
    "id": "reviewing-save-loop-limit",
    "overrides": {"state":"reviewing","workFacts":{"sessionOutcome":"ok","retriesUsed":0,"postcondition":"pending"},"reviewFacts":{"kind":"report","parseable":true,"iterateArtifact":false,"docsImpact":false,"howtoImpact":false},"loopCount":12},
    "expected": {"to":"blocked","effect":{"kind":"await-operator","reason":"loop limit reached (12 >= 12); refusing further work"},"why":"loop limit reached (12 >= 12); refusing further work"},
  },
  {
    "id": "reviewing-unparseable-loop-limit",
    "overrides": {"state":"reviewing","workFacts":{"sessionOutcome":"ok","retriesUsed":0,"postcondition":"pending"},"reviewFacts":{"kind":"report","parseable":false,"iterateArtifact":false,"docsImpact":false,"howtoImpact":false},"loopCount":12},
    "expected": {"to":"blocked","effect":{"kind":"await-operator","reason":"review report unparseable and no legal choice remains (limits exceeded)"},"why":"review report unparseable and no legal choice remains (limits exceeded)"},
  },
  {
    "id": "documenting-session-pending",
    "overrides": {"state":"documenting"},
    "expected": {"to":"documenting","effect":{"kind":"run-skill","skill":"docs"},"why":"documenting session has not run yet"},
  },
  {
    "id": "stop-from-documenting",
    "overrides": {"state":"documenting"},
    "event": "STOP",
    "expected": {"to":"aborted","effect":{"kind":"none"},"why":"STOP requested by operator from documenting"},
  },
  {
    "id": "documenting-session-pending-loop-limit",
    "overrides": {"state":"documenting","loopCount":12},
    "expected": {"to":"blocked","effect":{"kind":"await-operator","reason":"loop limit reached (12 >= 12); refusing further work"},"why":"loop limit reached (12 >= 12); refusing further work"},
  },
  {
    "id": "documenting-session-retry",
    "overrides": {"state":"documenting","workFacts":{"sessionOutcome":"failed","retriesUsed":0,"postcondition":"pending"}},
    "expected": {"to":"documenting","effect":{"kind":"run-skill","skill":"docs"},"why":"documenting session failed; retrying once"},
  },
  {
    "id": "documenting-session-retry-loop-limit",
    "overrides": {"state":"documenting","workFacts":{"sessionOutcome":"failed","retriesUsed":0,"postcondition":"pending"},"loopCount":12},
    "expected": {"to":"blocked","effect":{"kind":"await-operator","reason":"loop limit reached (12 >= 12); refusing further work"},"why":"loop limit reached (12 >= 12); refusing further work"},
  },
  {
    "id": "documenting-session-failed-again",
    "overrides": {"state":"documenting","workFacts":{"sessionOutcome":"failed","retriesUsed":1,"postcondition":"pending"}},
    "expected": {"to":"blocked","effect":{"kind":"await-operator","reason":"documenting session failed again after one retry"},"why":"documenting session failed again after one retry"},
  },
  {
    "id": "documenting-postcondition-missing",
    "overrides": {"state":"documenting","workFacts":{"sessionOutcome":"ok","retriesUsed":0,"postcondition":"pending"}},
    "expected": {"to":"blocked","effect":{"kind":"await-operator","reason":"documenting session finished but postcondition is pending (scan defect)"},"why":"documenting session finished but postcondition is pending (scan defect)"},
  },
  {
    "id": "documenting-confirmed-save",
    "overrides": {"state":"documenting","workFacts":{"sessionOutcome":"ok","retriesUsed":0,"postcondition":"confirmed"}},
    "expected": {"to":"saving","effect":{"kind":"run-skill","skill":"save"},"why":"docs updated; saving session state"},
  },
  {
    "id": "documenting-confirmed-loop-limit",
    "overrides": {"state":"documenting","workFacts":{"sessionOutcome":"ok","retriesUsed":0,"postcondition":"confirmed"},"loopCount":12},
    "expected": {"to":"blocked","effect":{"kind":"await-operator","reason":"loop limit reached (12 >= 12); refusing further work"},"why":"loop limit reached (12 >= 12); refusing further work"},
  },
  {
    "id": "documenting-choice-retry",
    "overrides": {"state":"documenting","workFacts":{"sessionOutcome":"ok","retriesUsed":0,"postcondition":"ambiguous"}},
    "choice": {"kind":"retry"},
    "expected": {"to":"documenting","effect":{"kind":"run-skill","skill":"docs"},"why":"accepted choice: retry the session"},
  },
  {
    "id": "documenting-choice-advance",
    "overrides": {"state":"documenting","workFacts":{"sessionOutcome":"ok","retriesUsed":0,"postcondition":"ambiguous"}},
    "choice": {"kind":"advance"},
    "expected": {"to":"saving","effect":{"kind":"run-skill","skill":"save"},"why":"docs updated; saving session state"},
  },
  {
    "id": "documenting-postcondition-ambiguous-loop-limit",
    "overrides": {"state":"documenting","workFacts":{"sessionOutcome":"ok","retriesUsed":0,"postcondition":"ambiguous"},"loopCount":12},
    "expected": {"to":"blocked","effect":{"kind":"await-operator","reason":"postcondition ambiguous and no legal choice remains (limits exceeded)"},"why":"postcondition ambiguous and no legal choice remains (limits exceeded)"},
  },
  {
    "id": "documenting-postcondition-ambiguous-retry-exhausted",
    "overrides": {"state":"documenting","workFacts":{"sessionOutcome":"ok","retriesUsed":1,"postcondition":"ambiguous"}},
    "expected": {"to":"blocked","effect":{"kind":"await-operator","reason":"postcondition still ambiguous after one retry; refusing another spin"},"why":"postcondition still ambiguous after one retry; refusing another spin"},
  },
  {
    "id": "saving-session-pending",
    "overrides": {"state":"saving"},
    "expected": {"to":"saving","effect":{"kind":"run-skill","skill":"save"},"why":"saving session has not run yet"},
  },
  {
    "id": "stop-from-saving",
    "overrides": {"state":"saving"},
    "event": "STOP",
    "expected": {"to":"aborted","effect":{"kind":"none"},"why":"STOP requested by operator from saving"},
  },
  {
    "id": "saving-session-pending-loop-limit",
    "overrides": {"state":"saving","loopCount":12},
    "expected": {"to":"blocked","effect":{"kind":"await-operator","reason":"loop limit reached (12 >= 12); refusing further work"},"why":"loop limit reached (12 >= 12); refusing further work"},
  },
  {
    "id": "saving-session-retry",
    "overrides": {"state":"saving","workFacts":{"sessionOutcome":"failed","retriesUsed":0,"postcondition":"pending"}},
    "expected": {"to":"saving","effect":{"kind":"run-skill","skill":"save"},"why":"saving session failed; retrying once"},
  },
  {
    "id": "saving-session-retry-loop-limit",
    "overrides": {"state":"saving","workFacts":{"sessionOutcome":"failed","retriesUsed":0,"postcondition":"pending"},"loopCount":12},
    "expected": {"to":"blocked","effect":{"kind":"await-operator","reason":"loop limit reached (12 >= 12); refusing further work"},"why":"loop limit reached (12 >= 12); refusing further work"},
  },
  {
    "id": "saving-session-failed-again",
    "overrides": {"state":"saving","workFacts":{"sessionOutcome":"failed","retriesUsed":1,"postcondition":"pending"}},
    "expected": {"to":"blocked","effect":{"kind":"await-operator","reason":"saving session failed again after one retry"},"why":"saving session failed again after one retry"},
  },
  {
    "id": "saving-postcondition-missing",
    "overrides": {"state":"saving","workFacts":{"sessionOutcome":"ok","retriesUsed":0,"postcondition":"pending"}},
    "expected": {"to":"blocked","effect":{"kind":"await-operator","reason":"saving session finished but postcondition is pending (scan defect)"},"why":"saving session finished but postcondition is pending (scan defect)"},
  },
  {
    "id": "saving-confirmed-commit",
    "overrides": {"state":"saving","workFacts":{"sessionOutcome":"ok","retriesUsed":0,"postcondition":"confirmed"}},
    "expected": {"to":"committing","effect":{"kind":"run-skill","skill":"commit"},"why":"session state saved; committing"},
  },
  {
    "id": "saving-confirmed-loop-limit",
    "overrides": {"state":"saving","workFacts":{"sessionOutcome":"ok","retriesUsed":0,"postcondition":"confirmed"},"loopCount":12},
    "expected": {"to":"blocked","effect":{"kind":"await-operator","reason":"loop limit reached (12 >= 12); refusing further work"},"why":"loop limit reached (12 >= 12); refusing further work"},
  },
  {
    "id": "saving-choice-retry",
    "overrides": {"state":"saving","workFacts":{"sessionOutcome":"ok","retriesUsed":0,"postcondition":"ambiguous"}},
    "choice": {"kind":"retry"},
    "expected": {"to":"saving","effect":{"kind":"run-skill","skill":"save"},"why":"accepted choice: retry the session"},
  },
  {
    "id": "saving-choice-advance",
    "overrides": {"state":"saving","workFacts":{"sessionOutcome":"ok","retriesUsed":0,"postcondition":"ambiguous"}},
    "choice": {"kind":"advance"},
    "expected": {"to":"committing","effect":{"kind":"run-skill","skill":"commit"},"why":"session state saved; committing"},
  },
  {
    "id": "saving-postcondition-ambiguous-loop-limit",
    "overrides": {"state":"saving","workFacts":{"sessionOutcome":"ok","retriesUsed":0,"postcondition":"ambiguous"},"loopCount":12},
    "expected": {"to":"blocked","effect":{"kind":"await-operator","reason":"postcondition ambiguous and no legal choice remains (limits exceeded)"},"why":"postcondition ambiguous and no legal choice remains (limits exceeded)"},
  },
  {
    "id": "saving-postcondition-ambiguous-retry-exhausted",
    "overrides": {"state":"saving","workFacts":{"sessionOutcome":"ok","retriesUsed":1,"postcondition":"ambiguous"}},
    "expected": {"to":"blocked","effect":{"kind":"await-operator","reason":"postcondition still ambiguous after one retry; refusing another spin"},"why":"postcondition still ambiguous after one retry; refusing another spin"},
  },
  {
    "id": "committing-session-pending",
    "overrides": {"state":"committing"},
    "expected": {"to":"committing","effect":{"kind":"run-skill","skill":"commit"},"why":"committing session has not run yet"},
  },
  {
    "id": "stop-from-committing",
    "overrides": {"state":"committing"},
    "event": "STOP",
    "expected": {"to":"aborted","effect":{"kind":"none"},"why":"STOP requested by operator from committing"},
  },
  {
    "id": "committing-session-pending-loop-limit",
    "overrides": {"state":"committing","loopCount":12},
    "expected": {"to":"blocked","effect":{"kind":"await-operator","reason":"loop limit reached (12 >= 12); refusing further work"},"why":"loop limit reached (12 >= 12); refusing further work"},
  },
  {
    "id": "committing-session-retry",
    "overrides": {"state":"committing","workFacts":{"sessionOutcome":"failed","retriesUsed":0,"postcondition":"pending"}},
    "expected": {"to":"committing","effect":{"kind":"run-skill","skill":"commit"},"why":"committing session failed; retrying once"},
  },
  {
    "id": "committing-session-retry-loop-limit",
    "overrides": {"state":"committing","workFacts":{"sessionOutcome":"failed","retriesUsed":0,"postcondition":"pending"},"loopCount":12},
    "expected": {"to":"blocked","effect":{"kind":"await-operator","reason":"loop limit reached (12 >= 12); refusing further work"},"why":"loop limit reached (12 >= 12); refusing further work"},
  },
  {
    "id": "committing-session-failed-again",
    "overrides": {"state":"committing","workFacts":{"sessionOutcome":"failed","retriesUsed":1,"postcondition":"pending"}},
    "expected": {"to":"blocked","effect":{"kind":"await-operator","reason":"committing session failed again after one retry"},"why":"committing session failed again after one retry"},
  },
  {
    "id": "committing-postcondition-missing",
    "overrides": {"state":"committing","workFacts":{"sessionOutcome":"ok","retriesUsed":0,"postcondition":"pending"}},
    "expected": {"to":"blocked","effect":{"kind":"await-operator","reason":"committing session finished but postcondition is pending (scan defect)"},"why":"committing session finished but postcondition is pending (scan defect)"},
  },
  {
    "id": "committing-next-phase",
    "overrides": {"state":"committing","workFacts":{"sessionOutcome":"ok","retriesUsed":0,"postcondition":"confirmed"}},
    "expected": {"to":"building","effect":{"kind":"run-skill","skill":"build"},"why":"verified commit; next incomplete phase"},
  },
  {
    "id": "committing-unphased-done",
    "overrides": {"state":"committing","planFacts":{"kind":"unphased","closeEligible":true},"workFacts":{"sessionOutcome":"ok","retriesUsed":0,"postcondition":"confirmed"}},
    "expected": {"to":"done","effect":{"kind":"none"},"why":"unphased plan completed its single cycle"},
  },
  {
    "id": "committing-phased-complete",
    "overrides": {"state":"committing","planFacts":{"kind":"phased-complete"},"workFacts":{"sessionOutcome":"ok","retriesUsed":0,"postcondition":"confirmed"}},
    "expected": {"to":"done","effect":{"kind":"none"},"why":"no phases remain"},
  },
  {
    "id": "committing-plan-missing",
    "overrides": {"state":"committing","planFacts":{"kind":"missing","reason":"fixture missing"},"workFacts":{"sessionOutcome":"ok","retriesUsed":0,"postcondition":"confirmed"}},
    "expected": {"to":"blocked","effect":{"kind":"await-operator","reason":"plan vanished while committing: fixture missing"},"why":"plan vanished while committing: fixture missing"},
  },
  {
    "id": "committing-confirmed-loop-limit",
    "overrides": {"state":"committing","workFacts":{"sessionOutcome":"ok","retriesUsed":0,"postcondition":"confirmed"},"loopCount":12},
    "expected": {"to":"blocked","effect":{"kind":"await-operator","reason":"loop limit reached (12 >= 12); refusing further work"},"why":"loop limit reached (12 >= 12); refusing further work"},
  },
  {
    "id": "committing-postcondition-ambiguous-loop-limit",
    "overrides": {"state":"committing","workFacts":{"sessionOutcome":"ok","retriesUsed":0,"postcondition":"ambiguous"},"loopCount":12},
    "expected": {"to":"blocked","effect":{"kind":"await-operator","reason":"postcondition ambiguous and no legal choice remains (limits exceeded)"},"why":"postcondition ambiguous and no legal choice remains (limits exceeded)"},
  },
  {
    "id": "committing-postcondition-ambiguous-retry-exhausted",
    "overrides": {"state":"committing","workFacts":{"sessionOutcome":"ok","retriesUsed":1,"postcondition":"ambiguous"}},
    "expected": {"to":"blocked","effect":{"kind":"await-operator","reason":"postcondition still ambiguous after one retry; refusing another spin"},"why":"postcondition still ambiguous after one retry; refusing another spin"},
  },
  {
    "id": "user-confirmed",
    "overrides": {"state":"blocked"},
    "event": "USER_CONFIRMED",
    "expected": {"to":"resolving","effect":{"kind":"none"},"why":"USER_CONFIRMED: operator resumed a blocked loop"},
  },
  {
    "id": "stop-from-blocked",
    "overrides": {"state":"blocked"},
    "event": "STOP",
    "expected": {"to":"aborted","effect":{"kind":"none"},"why":"STOP requested by operator from blocked"},
  },
  {
    "id": "user-confirmed-completed-work",
    "overrides": {"state":"blocked","workFacts":{"sessionOutcome":"ok","retriesUsed":0,"postcondition":"confirmed"},"history":[{"from":"building","to":"blocked","why":"fixture"}]},
    "event": "USER_CONFIRMED",
    "expected": {"to":"reviewing","effect":{"kind":"none"},"why":"USER_CONFIRMED: completed blocked work; reviewing its phase"},
  },
] as const;

describe("legacy rule truth table", () => {
  it.each(LEGACY_ROWS)("$id", (row) => {
    const previous = process.env.SQL_MEMORY_URL;
    delete process.env.SQL_MEMORY_URL;
    try {
      const s = snap(row.overrides as Partial<Snapshot>);
      let actual;
      if ("choice" in row) actual = applyChoice(row.choice, s);
      else if ("event" in row) {
        if (row.event === "START") actual = start();
        else if (row.event === "STOP") actual = stopFrom(s.state);
        else actual = userConfirmed(s);
      } else actual = next(s);
      expect(actual).toEqual(row.expected);
    } finally {
      if (previous !== undefined) process.env.SQL_MEMORY_URL = previous;
    }
  });
});

describe("declarative operator graph", () => {
  it.each(["idle", "resolving", "ranking", "repairing", ...WORK_STATES, "blocked"] as const)("%s exposes STOP only as a manual edge", (state) => {
    expect(buckMachine.edge(state, "aborted").manual).toBe(true);
    expect(buckMachine.restore(state).available({...snap({state}), sqlMemoryConfigured: false})).not.toContain("aborted");
    expect(stopFrom(state)).toEqual({to: "aborted", effect: {kind: "none"}, why: `STOP requested by operator from ${state}`});
  });

  it("hides START and USER_CONFIRMED from ticks and enforces the resume guard", () => {
    expect(buckMachine.edge("idle", "resolving").manual).toBe(true);
    expect(buckMachine.edge("blocked", "resolving").manual).toBe(true);
    expect(buckMachine.edge("blocked", "reviewing").manual).toBe(true);
    expect(() => buckMachine.restore("blocked").transition("reviewing", {...snap({state: "blocked"}), sqlMemoryConfigured: false})).toThrow(IllegalTransitionError);
    expect(() => userConfirmed(snap({state: "building"}))).toThrow(IllegalTransitionError);
    expect(buckMachine.targets("done")).toEqual([]);
    expect(buckMachine.targets("aborted")).toEqual([]);
  });
});

describe("adapter safety boundaries", () => {
  it("keeps conflicting exhausted retries fail-closed but reports no legal choices", () => {
    const s = workSnap("building", { postcondition: "ambiguous", retriesUsed: 1 }, { loopCount: 12 });
    expect(() => next(s)).toThrow(BuckMachineError);
    expect(legalChoices("building", s)).toEqual([]);
  });

  it("rejects USER_CONFIRMED outside blocked even when a normal review edge exists", () => {
    const s = workSnap("building", {}, { history: [{ from: "building", to: "blocked", why: "fixture", at: "2026-10-01" }] });
    expect(() => userConfirmed(s)).toThrow(IllegalTransitionError);
  });

  it("keeps review routing independent of a work postcondition ambiguity", () => {
    expect(next(reviewDone({}, {workFacts: wf({sessionOutcome: "ok", postcondition: "ambiguous"})}))).toEqual({
      to: "saving", effect: {kind: "run-skill", skill: "save"}, why: "clean review; saving",
    });
  });
});


describe("routing and reason boundaries", () => {
  afterEach(() => vi.restoreAllMocks());

  it("names unexpected automatic overlap and rejects it", () => {
    // Simulate an overlapping graph at the adapter/module seam.
    const instance = buckMachine.restore("building");
    vi.spyOn(instance, "available").mockReturnValue(["building", "reviewing"]);
    vi.spyOn(buckMachine, "restore").mockReturnValue(instance);
    const s = snap({ state: "building" });
    expect(() => next(s)).toThrow("buck machine AMBIGUOUS_ROUTE: building -> [building, reviewing]");
    expect(() => next(s)).toThrow(BuckMachineError);
  });

  it("rejects an unrecognized persisted state with the module error", () => {
    expect(() => next(snap({state: "unknown" as Snapshot["state"]}))).toThrow(UnknownStateError);
  });

  it.each(WORK_STATES)("pins loop-limit wording for pending and failed %s sessions", (state) => {
    for (const sessionOutcome of ["pending", "failed"] as const) {
      expect(next(snap({state, loopCount: 12, workFacts: wf({sessionOutcome})}))).toEqual({
        to: "blocked", effect: {kind: "await-operator", reason: "loop limit reached (12 >= 12); refusing further work"},
        why: "loop limit reached (12 >= 12); refusing further work",
      });
    }
  });

  it.each(POSTCONDITION_STATES)("pins ambiguous loop-limit wording for %s", (state) => {
    expect(next(workSnap(state, {postcondition: "ambiguous"}, {loopCount: 12}))).toEqual({
      to: "blocked", effect: {kind: "await-operator", reason: "postcondition ambiguous and no legal choice remains (limits exceeded)"},
      why: "postcondition ambiguous and no legal choice remains (limits exceeded)",
    });
  });

  it("pins the global limit when both review iteration limits are exceeded", () => {
    expect(next(reviewDone({iterateArtifact: true}, {loopCount: 12, iterateCyclesOnPhase: 6}))).toEqual({
      to: "blocked", effect: {kind: "await-operator", reason: "loop limit reached (12 >= 12); refusing further work"},
      why: "loop limit reached (12 >= 12); refusing further work",
    });
  });

  it("keeps the environment outside the SQL guard and revalidates stale choices", () => {
    const previous = process.env.SQL_MEMORY_URL;
    const s = workSnap("saving", {postcondition: "ambiguous"});
    delete process.env.SQL_MEMORY_URL;
    try {
      expect(legalChoices("saving", s)).toEqual([{kind: "retry"}, {kind: "advance"}]);
      process.env.SQL_MEMORY_URL = "postgres://example.invalid/save";
      expect(buckMachine.restore("saving").available({...s, sqlMemoryConfigured: false})).toEqual(["saving", "committing"]);
      expect(() => applyChoice({kind: "advance"}, s)).toThrow(BuckMachineError);
      expect(applyChoice({kind: "retry"}, s)).toEqual({
        to: "saving", effect: {kind: "run-skill", skill: "save"}, why: "accepted choice: retry the session",
      });
    } finally {
      if (previous === undefined) delete process.env.SQL_MEMORY_URL;
      else process.env.SQL_MEMORY_URL = previous;
    }
  });

  it.each(["done", "aborted"] as const)("preserves STOP from terminal %s", (state) => {
    expect(stopFrom(state)).toEqual({to: "aborted", effect: {kind: "none"}, why: `STOP requested by operator from ${state}`});
  });
});
