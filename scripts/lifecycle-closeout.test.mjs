import { describe, expect, it } from "vitest";
import { closeAcceptedUnit } from "./lifecycle-artifacts.mjs";

const target = ".context/2026-07-10.fixture/phase-1-example.md";

function baseState() {
  return {
    date: "2026-07-10",
    target: {
      path: target,
      kind: "phase",
      status: "in-progress",
      acceptance: [false, false],
    },
    reviewPass: {
      status: "active",
      target,
      verdict: "pass",
      fingerprint: "sha256:accepted",
      completed: null,
    },
    currentFingerprint: "sha256:accepted",
    iterates: [],
    phases: [
      {
        path: target,
        order: 1,
        status: "in-progress",
        dependsOn: [],
        backlogPath: ".context/backlog/items/phase-1-example.md",
      },
      {
        path: ".context/2026-07-10.fixture/phase-2-next.md",
        order: 2,
        status: "pending",
        dependsOn: [1],
        backlogPath: ".context/backlog/items/phase-2-next.md",
      },
    ],
    overview: {
      status: "active",
      rows: [
        { phase: 1, status: "in-progress" },
        { phase: 2, status: "pending" },
      ],
    },
    parents: [{ kind: "plan", status: "active" }],
    otherUnits: [],
    subject: { status: "active" },
    memory: { status: "active" },
    backlog: {
      todo: [".context/backlog/items/phase-1-example.md"],
      archived: [],
      items: {
        ".context/backlog/items/phase-1-example.md": {
          status: "active",
          completed: null,
        },
        ".context/backlog/items/phase-2-next.md": {
          status: "active",
          completed: null,
        },
      },
    },
  };
}

describe("closeAcceptedUnit", () => {
  it("closes an accepted intermediate phase and promotes exactly the next phase", () => {
    const input = baseState();
    const result = closeAcceptedUnit(input);

    expect(result.status).toBe("applied");
    expect(result.reason).toBe("intermediate-phase-closed");
    expect(result.state.target).toMatchObject({
      status: "completed",
      acceptance: [true, true],
    });
    expect(result.state.phases.map((phase) => phase.status)).toEqual([
      "completed",
      "pending",
    ]);
    expect(result.state.overview).toEqual({
      status: "active",
      rows: [
        { phase: 1, status: "completed" },
        { phase: 2, status: "pending" },
      ],
    });
    expect(result.state.backlog.todo).toEqual([
      ".context/backlog/items/phase-2-next.md",
    ]);
    expect(result.state.backlog.archived).toEqual([
      ".context/backlog/items/phase-1-example.md",
    ]);
    expect(result.state.backlog.items[".context/backlog/items/phase-1-example.md"]).toEqual({
      status: "completed",
      completed: "2026-07-10",
    });
    expect(result.state.memory.status).toBe("completed");
    expect(result.state.reviewPass).toMatchObject({
      status: "completed",
      completed: "2026-07-10",
    });
    expect(result.state.parents[0].status).toBe("active");
    expect(result.state.subject.status).toBe("active");
    expect(result.nextPhase?.order).toBe(2);
    expect(input.target.status).toBe("in-progress");
    expect(input.backlog.archived).toEqual([]);
  });

  it("closes final phase, overview, parents, subject, memory, and pass", () => {
    const state = baseState();
    const finalTarget = state.phases[1].path;
    state.target.path = finalTarget;
    state.reviewPass.target = finalTarget;
    state.phases[0].status = "completed";
    state.phases[1].status = "in-progress";
    state.overview.rows[0].status = "completed";
    state.overview.rows[1].status = "in-progress";
    state.backlog.todo = [state.phases[1].backlogPath];
    state.backlog.archived = [state.phases[0].backlogPath];

    const result = closeAcceptedUnit(state);

    expect(result.status).toBe("applied");
    expect(result.reason).toBe("final-phase-closed");
    expect(result.nextPhase).toBeNull();
    expect(result.state.overview.status).toBe("completed");
    expect(result.state.parents).toEqual([
      { kind: "plan", status: "completed" },
    ]);
    expect(result.state.subject.status).toBe("completed");
    expect(result.state.memory.status).toBe("completed");
    expect(result.state.reviewPass.status).toBe("completed");
    expect(result.state.backlog.todo).toEqual([]);
    expect(result.state.backlog.archived).toEqual([
      state.phases[0].backlogPath,
      state.phases[1].backlogPath,
    ]);
  });

  it("keeps the subject active when another workflow unit remains active", () => {
    const state = baseState();
    const finalTarget = state.phases[1].path;
    state.target.path = finalTarget;
    state.reviewPass.target = finalTarget;
    state.phases[0].status = "completed";
    state.phases[1].status = "in-progress";
    state.overview.rows[0].status = "completed";
    state.overview.rows[1].status = "in-progress";
    state.backlog.todo = [state.phases[1].backlogPath];
    state.backlog.archived = [state.phases[0].backlogPath];
    state.otherUnits = [{ kind: "plan", status: "active" }];

    const result = closeAcceptedUnit(state);

    expect(result.status).toBe("applied");
    expect(result.reason).toBe("final-phase-closed");
    expect(result.state.parents[0].status).toBe("completed");
    expect(result.state.subject.status).toBe("active");
  });

  it("closes accepted non-phased work without inventing a phase promotion", () => {
    const state = baseState();
    state.target = {
      path: ".context/2026-07-10.fixture/plan-example.md",
      kind: "plan",
      status: "active",
      acceptance: [false],
    };
    state.reviewPass.target = state.target.path;
    state.phases = [];
    state.overview = null;
    state.parents = [{ kind: "spec", status: "active" }];
    state.backlog = { todo: [], archived: [], items: {} };

    const result = closeAcceptedUnit(state);

    expect(result.status).toBe("applied");
    expect(result.reason).toBe("non-phased-closed");
    expect(result.nextPhase).toBeNull();
    expect(result.state.target).toMatchObject({
      status: "completed",
      acceptance: [true],
    });
    expect(result.state.parents[0].status).toBe("completed");
    expect(result.state.subject.status).toBe("completed");
    expect(result.state.memory.status).toBe("completed");
    expect(result.state.reviewPass.status).toBe("completed");
    expect(result.state.backlog).toEqual({
      todo: [],
      archived: [],
      items: {},
    });
  });

  it("refuses closeout without a review-pass and leaves all state unchanged", () => {
    const state = baseState();
    state.reviewPass = null;

    const result = closeAcceptedUnit(state);

    expect(result).toEqual({
      status: "refused",
      reason: "missing-review-pass",
      state,
      nextPhase: null,
    });
  });

  it("refuses a stale review-pass fingerprint without mutating state", () => {
    const state = baseState();
    state.currentFingerprint = "sha256:drifted";

    const result = closeAcceptedUnit(state);

    expect(result).toEqual({
      status: "refused",
      reason: "stale-review-pass",
      state,
      nextPhase: null,
    });
  });

  it("refuses closeout while an active iterate addresses the same target", () => {
    const state = baseState();
    state.iterates = [{ status: "active", addresses: target }];

    const result = closeAcceptedUnit(state);

    expect(result).toEqual({
      status: "refused",
      reason: "active-iterate",
      state,
      nextPhase: null,
    });
  });

  it.each([
    [
      "inactive-review-pass",
      (state) => {
        state.reviewPass.status = "completed";
      },
    ],
    [
      "review-pass-target-mismatch",
      (state) => {
        state.reviewPass.target = ".context/other/phase.md";
      },
    ],
    [
      "invalid-review-verdict",
      (state) => {
        state.reviewPass.verdict = "needs-work";
      },
    ],
  ])("requires a matching valid review-pass: %s", (reason, mutate) => {
    const state = baseState();
    mutate(state);

    const result = closeAcceptedUnit(state);

    expect(result).toEqual({
      status: "refused",
      reason,
      state,
      nextPhase: null,
    });
  });


  it("refuses a phase target absent from the overview transaction", () => {
    const state = baseState();
    state.target.path = ".context/2026-07-10.fixture/phase-9-missing.md";
    state.reviewPass.target = state.target.path;

    const result = closeAcceptedUnit(state);

    expect(result).toEqual({
      status: "refused",
      reason: "phase-target-not-found",
      state,
      nextPhase: null,
    });
  });
  it("is idempotent when save reruns after a completed closeout", () => {
    const first = closeAcceptedUnit(baseState());
    const second = closeAcceptedUnit(first.state);

    expect(second).toEqual({
      status: "noop",
      reason: "already-closed",
      state: first.state,
      nextPhase: null,
    });
  });
});
