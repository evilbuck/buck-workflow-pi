/**
 * Buck workflow policy over the generic pure evaluator.
 *
 * Named guards, outputs, and the compiled machine live here. The supervisor
 * in `loop.ts` is the only effect interpreter.
 */
import { defineMachine, MachineFailure, type AdvanceDecision } from "../state-machine.js";
import type { Choice, LoopState, Snapshot, Transition, WorkSkill, WorkState } from "./types.js";

/** Three iterate cycles on one phase is the hard ceiling before blocking. */
export const MAX_ITERATE_CYCLES_PER_PHASE = 3;

const WORK_SKILL: Record<WorkState, WorkSkill> = {
  building: "build",
  reviewing: "review",
  iterating: "iterate",
  documenting: "docs",
  saving: "save",
  committing: "commit",
};

export type BuckEvent = { type: "START" } | { type: "USER_CONFIRMED" } | { type: "STOP" };

export type BuckOutput = { effect: Transition["effect"]; why: string };

export function limitsExceeded(s: Snapshot): boolean {
  return s.loopCount >= s.maxLoops;
}

function iterateCeiling(s: Snapshot): boolean {
  return s.iterateCyclesOnPhase >= MAX_ITERATE_CYCLES_PER_PHASE;
}

function canRunWork(s: Snapshot): boolean {
  return !limitsExceeded(s);
}

function canRunIterate(s: Snapshot): boolean {
  return canRunWork(s) && !iterateCeiling(s);
}

function blocked(reason: string): BuckOutput {
  return { effect: { kind: "await-operator", reason }, why: reason };
}

function runSkill(skill: WorkSkill, why: string): BuckOutput {
  return { effect: { kind: "run-skill", skill }, why };
}

function none(why: string): BuckOutput {
  return { effect: { kind: "none" }, why };
}

function sessionPending(s: Snapshot): boolean {
  return s.workFacts.sessionOutcome === "pending";
}

function sessionFailed(s: Snapshot): boolean {
  return s.workFacts.sessionOutcome === "failed";
}

function sessionOk(s: Snapshot): boolean {
  return s.workFacts.sessionOutcome === "ok";
}

function retryExhausted(s: Snapshot): boolean {
  return s.workFacts.retriesUsed >= 1;
}

function postconditionAmbiguous(s: Snapshot): boolean {
  return sessionOk(s) && s.workFacts.postcondition === "ambiguous";
}

function postconditionConfirmed(s: Snapshot): boolean {
  return sessionOk(s) && s.workFacts.postcondition === "confirmed";
}

function postconditionMissing(s: Snapshot): boolean {
  return sessionOk(s) && s.workFacts.postcondition !== "ambiguous" && s.workFacts.postcondition !== "confirmed";
}

function report(s: Snapshot) {
  return s.reviewFacts.kind === "report" ? s.reviewFacts : null;
}

function iterateWins(s: Snapshot): boolean {
  return Boolean(report(s)?.iterateArtifact);
}

function docsWins(s: Snapshot): boolean {
  const r = report(s);
  return Boolean(r && !r.iterateArtifact && (r.docsImpact || r.howtoImpact));
}

function cleanSave(s: Snapshot): boolean {
  const r = report(s);
  return Boolean(r && !r.iterateArtifact && !r.docsImpact && !r.howtoImpact && r.parseable);
}

function reviewUnparseable(s: Snapshot): boolean {
  const r = report(s);
  return Boolean(r && !r.iterateArtifact && !r.docsImpact && !r.howtoImpact && !r.parseable);
}

function sessionAutomatic(state: WorkState, skill: WorkSkill) {
  return [
    {
      id: `${state}-session-pending`,
      when: (s: Snapshot) => sessionPending(s) && (skill === "iterate" ? canRunIterate(s) : canRunWork(s)),
      target: state,
      output: () => runSkill(skill, `${state} session has not run yet`),
    },
    {
      id: `${state}-session-pending-loop-limit`,
      when: (s: Snapshot) => sessionPending(s) && skill !== "iterate" && limitsExceeded(s),
      target: "blocked" as const,
      output: (s: Snapshot) =>
        blocked(`loop limit reached (${s.loopCount} >= ${s.maxLoops}); refusing further work`),
    },
    {
      id: `${state}-session-pending-iterate-limit`,
      when: (s: Snapshot) => sessionPending(s) && skill === "iterate" && !canRunIterate(s),
      target: "blocked" as const,
      output: (s: Snapshot) =>
        limitsExceeded(s)
          ? blocked(`loop limit reached (${s.loopCount} >= ${s.maxLoops}); refusing further work`)
          : blocked(
              `iterate limit reached on this phase (${s.iterateCyclesOnPhase} >= ${MAX_ITERATE_CYCLES_PER_PHASE})`,
            ),
    },
    {
      id: `${state}-session-retry`,
      when: (s: Snapshot) =>
        sessionFailed(s) && !retryExhausted(s) && (skill === "iterate" ? canRunIterate(s) : canRunWork(s)),
      target: state,
      output: () => runSkill(skill, `${state} session failed; retrying once`),
    },
    {
      id: `${state}-session-retry-loop-limit`,
      when: (s: Snapshot) => sessionFailed(s) && !retryExhausted(s) && skill !== "iterate" && limitsExceeded(s),
      target: "blocked" as const,
      output: (s: Snapshot) =>
        blocked(`loop limit reached (${s.loopCount} >= ${s.maxLoops}); refusing further work`),
    },
    {
      id: `${state}-session-retry-iterate-limit`,
      when: (s: Snapshot) => sessionFailed(s) && !retryExhausted(s) && skill === "iterate" && !canRunIterate(s),
      target: "blocked" as const,
      output: (s: Snapshot) =>
        limitsExceeded(s)
          ? blocked(`loop limit reached (${s.loopCount} >= ${s.maxLoops}); refusing further work`)
          : blocked(
              `iterate limit reached on this phase (${s.iterateCyclesOnPhase} >= ${MAX_ITERATE_CYCLES_PER_PHASE})`,
            ),
    },
    {
      id: `${state}-session-failed-again`,
      when: (s: Snapshot) => sessionFailed(s) && retryExhausted(s),
      target: "blocked" as const,
      output: () => blocked(`${state} session failed again after one retry`),
    },
  ];
}

function postconditionAutomatic(state: Exclude<WorkState, "reviewing">) {
  const skill = WORK_SKILL[state];
  return [
    ...sessionAutomatic(state, skill),
    {
      id: `${state}-postcondition-ambiguous-loop-limit`,
      when: (s: Snapshot) => postconditionAmbiguous(s) && limitsExceeded(s),
      target: "blocked" as const,
      output: () => blocked("postcondition ambiguous and no legal choice remains (limits exceeded)"),
    },
    {
      id: `${state}-postcondition-missing`,
      when: (s: Snapshot) => postconditionMissing(s),
      target: "blocked" as const,
      output: (s: Snapshot) =>
        blocked(`${state} session finished but postcondition is ${s.workFacts.postcondition} (scan defect)`),
    },
  ];
}

function stopEvent(from: LoopState) {
  return {
    id: `stop-from-${from}`,
    event: { type: "STOP" as const },
    when: () => true,
    target: "aborted" as const,
    output: () => none(`STOP requested by operator from ${from}`),
  };
}

function committingAutomatic() {
  return [
    ...postconditionAutomatic("committing"),
    {
      id: "committing-confirmed-loop-limit",
      when: (s: Snapshot) =>
        postconditionConfirmed(s) && limitsExceeded(s) && s.planFacts.kind === "phased-incomplete",
      target: "blocked" as const,
      output: (s: Snapshot) =>
        blocked(`loop limit reached (${s.loopCount} >= ${s.maxLoops}); refusing further work`),
    },
    {
      id: "committing-next-phase",
      when: (s: Snapshot) => postconditionConfirmed(s) && canRunWork(s) && s.planFacts.kind === "phased-incomplete",
      target: "building" as const,
      output: () => runSkill("build", "next incomplete phase"),
    },
    {
      id: "committing-phased-complete",
      when: (s: Snapshot) => postconditionConfirmed(s) && s.planFacts.kind === "phased-complete",
      target: "done" as const,
      output: () => none("no phases remain"),
    },
    {
      id: "committing-unphased-done",
      when: (s: Snapshot) => postconditionConfirmed(s) && s.planFacts.kind === "unphased",
      target: "done" as const,
      output: () => none("unphased plan completed its single cycle"),
    },
    {
      id: "committing-plan-missing",
      when: (s: Snapshot) => postconditionConfirmed(s) && s.planFacts.kind === "missing",
      target: "blocked" as const,
      output: (s: Snapshot) =>
        blocked(
          `plan vanished while committing: ${s.planFacts.kind === "missing" ? s.planFacts.reason : "unknown"}`,
        ),
    },
  ];
}

function buildingLike(state: "building" | "iterating") {
  return {
    automatic: [
      ...postconditionAutomatic(state),
      {
        id: `${state}-confirmed-loop-limit`,
        when: (s: Snapshot) => postconditionConfirmed(s) && limitsExceeded(s),
        target: "blocked" as const,
        output: (s: Snapshot) =>
          blocked(`loop limit reached (${s.loopCount} >= ${s.maxLoops}); refusing further work`),
      },
      {
        id: `${state}-confirmed-review`,
        when: (s: Snapshot) => postconditionConfirmed(s) && canRunWork(s),
        target: "reviewing" as const,
        output: () => runSkill("review", "work landed; reviewing it"),
      },
    ],
    choices: [
      {
        id: `${state}-choice-retry`,
        choice: { kind: "retry" as const },
        when: (s: Snapshot) => postconditionAmbiguous(s) && canRunWork(s),
        target: state,
        output: () => runSkill(WORK_SKILL[state], "accepted choice: retry the session"),
      },
      {
        id: `${state}-choice-advance`,
        choice: { kind: "advance" as const },
        when: (s: Snapshot) => postconditionAmbiguous(s) && canRunWork(s),
        target: "reviewing" as const,
        output: () => runSkill("review", "work landed; reviewing it"),
      },
      {
        id: `${state}-choice-block`,
        choice: { kind: "block" as const },
        when: (s: Snapshot) => postconditionAmbiguous(s) && canRunWork(s),
        target: "blocked" as const,
        output: () => blocked("accepted choice: block"),
      },
    ],
    events: [stopEvent(state)],
  };
}

function documentingState() {
  return {
    automatic: [
      ...postconditionAutomatic("documenting"),
      {
        id: "documenting-confirmed-loop-limit",
        when: (s: Snapshot) => postconditionConfirmed(s) && limitsExceeded(s),
        target: "blocked" as const,
        output: (s: Snapshot) =>
          blocked(`loop limit reached (${s.loopCount} >= ${s.maxLoops}); refusing further work`),
      },
      {
        id: "documenting-confirmed-save",
        when: (s: Snapshot) => postconditionConfirmed(s) && canRunWork(s),
        target: "saving" as const,
        output: () => runSkill("save", "docs updated; saving session state"),
      },
    ],
    choices: [
      {
        id: "documenting-choice-retry",
        choice: { kind: "retry" as const },
        when: (s: Snapshot) => postconditionAmbiguous(s) && canRunWork(s),
        target: "documenting" as const,
        output: () => runSkill("docs", "accepted choice: retry the session"),
      },
      {
        id: "documenting-choice-advance",
        choice: { kind: "advance" as const },
        when: (s: Snapshot) => postconditionAmbiguous(s) && canRunWork(s),
        target: "saving" as const,
        output: () => runSkill("save", "docs updated; saving session state"),
      },
      {
        id: "documenting-choice-block",
        choice: { kind: "block" as const },
        when: (s: Snapshot) => postconditionAmbiguous(s) && canRunWork(s),
        target: "blocked" as const,
        output: () => blocked("accepted choice: block"),
      },
    ],
    events: [stopEvent("documenting")],
  };
}

function savingState() {
  return {
    automatic: [
      ...postconditionAutomatic("saving"),
      {
        id: "saving-confirmed-loop-limit",
        when: (s: Snapshot) => postconditionConfirmed(s) && limitsExceeded(s),
        target: "blocked" as const,
        output: (s: Snapshot) =>
          blocked(`loop limit reached (${s.loopCount} >= ${s.maxLoops}); refusing further work`),
      },
      {
        id: "saving-confirmed-commit",
        when: (s: Snapshot) => postconditionConfirmed(s) && canRunWork(s),
        target: "committing" as const,
        output: () => runSkill("commit", "session state saved; committing"),
      },
    ],
    choices: [
      {
        id: "saving-choice-retry",
        choice: { kind: "retry" as const },
        when: (s: Snapshot) => postconditionAmbiguous(s) && canRunWork(s),
        target: "saving" as const,
        output: () => runSkill("save", "accepted choice: retry the session"),
      },
      {
        id: "saving-choice-advance",
        choice: { kind: "advance" as const },
        when: (s: Snapshot) => postconditionAmbiguous(s) && canRunWork(s),
        target: "committing" as const,
        output: () => runSkill("commit", "session state saved; committing"),
      },
      {
        id: "saving-choice-block",
        choice: { kind: "block" as const },
        when: (s: Snapshot) => postconditionAmbiguous(s) && canRunWork(s),
        target: "blocked" as const,
        output: () => blocked("accepted choice: block"),
      },
    ],
    events: [stopEvent("saving")],
  };
}

function committingChoices() {
  return [
    {
      id: "committing-choice-retry",
      choice: { kind: "retry" as const },
      when: (s: Snapshot) => postconditionAmbiguous(s) && canRunWork(s),
      target: "committing" as const,
      output: () => runSkill("commit", "accepted choice: retry the session"),
    },
    {
      id: "committing-choice-advance-next-phase",
      choice: { kind: "advance" as const },
      when: (s: Snapshot) =>
        postconditionAmbiguous(s) && canRunWork(s) && s.planFacts.kind === "phased-incomplete",
      target: "building" as const,
      output: () => runSkill("build", "next incomplete phase"),
    },
    {
      id: "committing-choice-advance-complete",
      choice: { kind: "advance" as const },
      when: (s: Snapshot) =>
        postconditionAmbiguous(s) && canRunWork(s) && s.planFacts.kind === "phased-complete",
      target: "done" as const,
      output: () => none("no phases remain"),
    },
    {
      id: "committing-choice-advance-unphased",
      choice: { kind: "advance" as const },
      when: (s: Snapshot) => postconditionAmbiguous(s) && canRunWork(s) && s.planFacts.kind === "unphased",
      target: "done" as const,
      output: () => none("unphased plan completed its single cycle"),
    },
    {
      id: "committing-choice-advance-missing",
      choice: { kind: "advance" as const },
      when: (s: Snapshot) => postconditionAmbiguous(s) && canRunWork(s) && s.planFacts.kind === "missing",
      target: "blocked" as const,
      output: (s: Snapshot) =>
        blocked(
          `plan vanished while committing: ${s.planFacts.kind === "missing" ? s.planFacts.reason : "unknown"}`,
        ),
    },
    {
      id: "committing-choice-block",
      choice: { kind: "block" as const },
      when: (s: Snapshot) => postconditionAmbiguous(s) && canRunWork(s),
      target: "blocked" as const,
      output: () => blocked("accepted choice: block"),
    },
  ];
}

function committingState() {
  return {
    automatic: committingAutomatic(),
    choices: committingChoices(),
    events: [stopEvent("committing")],
  };
}

function iterateLimitBlocked(s: Snapshot): BuckOutput {
  if (limitsExceeded(s)) {
    return blocked(`loop limit reached (${s.loopCount} >= ${s.maxLoops}); refusing further work`);
  }
  return blocked(
    `iterate limit reached on this phase (${s.iterateCyclesOnPhase} >= ${MAX_ITERATE_CYCLES_PER_PHASE})`,
  );
}

function reviewingSessionAutomatic() {
  return [
    ...sessionAutomatic("reviewing", "review"),
    {
      id: "reviewing-no-report",
      when: (s: Snapshot) => sessionOk(s) && s.reviewFacts.kind !== "report",
      target: "blocked" as const,
      output: () => blocked("review session finished but no report facts were scanned (scan defect)"),
    },
    {
      id: "reviewing-iterate",
      when: (s: Snapshot) => sessionOk(s) && iterateWins(s) && canRunIterate(s),
      target: "iterating" as const,
      output: () => runSkill("iterate", "iterate artifact present; in-plan issues win"),
    },
    {
      id: "reviewing-iterate-limit",
      when: (s: Snapshot) => sessionOk(s) && iterateWins(s) && !canRunIterate(s),
      target: "blocked" as const,
      output: iterateLimitBlocked,
    },
  ];
}

function reviewingPriorityAutomatic() {
  return [
    {
      id: "reviewing-docs",
      when: (s: Snapshot) => sessionOk(s) && docsWins(s) && canRunWork(s),
      target: "documenting" as const,
      output: () => runSkill("docs", "review flagged documentation impact"),
    },
    {
      id: "reviewing-docs-loop-limit",
      when: (s: Snapshot) => sessionOk(s) && docsWins(s) && limitsExceeded(s),
      target: "blocked" as const,
      output: (s: Snapshot) =>
        blocked(`loop limit reached (${s.loopCount} >= ${s.maxLoops}); refusing further work`),
    },
    {
      id: "reviewing-save",
      when: (s: Snapshot) => sessionOk(s) && cleanSave(s) && canRunWork(s),
      target: "saving" as const,
      output: () => runSkill("save", "clean review; saving"),
    },
    {
      id: "reviewing-save-loop-limit",
      when: (s: Snapshot) => sessionOk(s) && cleanSave(s) && limitsExceeded(s),
      target: "blocked" as const,
      output: (s: Snapshot) =>
        blocked(`loop limit reached (${s.loopCount} >= ${s.maxLoops}); refusing further work`),
    },
    {
      id: "reviewing-unparseable-loop-limit",
      when: (s: Snapshot) => sessionOk(s) && reviewUnparseable(s) && limitsExceeded(s),
      target: "blocked" as const,
      output: () => blocked("review report unparseable and no legal choice remains (limits exceeded)"),
    },
  ];
}

function reviewingChoices() {
  return [
    {
      id: "reviewing-choice-iterate",
      choice: { kind: "iterate" as const },
      when: (s: Snapshot) => sessionOk(s) && reviewUnparseable(s) && canRunIterate(s),
      target: "iterating" as const,
      output: () => runSkill("iterate", "accepted choice: iterate on in-plan issues"),
    },
    {
      id: "reviewing-choice-document",
      choice: { kind: "document" as const },
      when: (s: Snapshot) => sessionOk(s) && reviewUnparseable(s) && canRunWork(s),
      target: "documenting" as const,
      output: () => runSkill("docs", "accepted choice: document the impact"),
    },
    {
      id: "reviewing-choice-save",
      choice: { kind: "save" as const },
      when: (s: Snapshot) => sessionOk(s) && reviewUnparseable(s) && canRunWork(s),
      target: "saving" as const,
      output: () => runSkill("save", "accepted choice: treat the review as clean and save"),
    },
    {
      id: "reviewing-choice-block",
      choice: { kind: "block" as const },
      when: (s: Snapshot) => sessionOk(s) && reviewUnparseable(s) && canRunWork(s),
      target: "blocked" as const,
      output: () => blocked("accepted choice: block"),
    },
  ];
}

function reviewingState() {
  return {
    automatic: [...reviewingSessionAutomatic(), ...reviewingPriorityAutomatic()],
    choices: reviewingChoices(),
    events: [stopEvent("reviewing")],
  };
}

export const buckMachine = defineMachine<LoopState, Snapshot, Choice, BuckEvent, BuckOutput>({
  stateOf: (facts) => facts.state,
  choiceKey: (choice) => choice.kind,
  eventKey: (event) => event.type,
  states: {
    idle: {
      events: [
        {
          id: "start",
          event: { type: "START" },
          when: () => true,
          target: "resolving",
          output: () => none("START: operator supplied a path"),
        },
        stopEvent("idle"),
      ],
    },
    resolving: {
      automatic: [
        {
          id: "resolving-missing",
          when: (s) => s.planFacts.kind === "missing",
          target: "blocked",
          output: (s) =>
            blocked(`plan unresolved: ${s.planFacts.kind === "missing" ? s.planFacts.reason : "unknown"}`),
        },
        {
          id: "resolving-unphased",
          when: (s) => s.planFacts.kind === "unphased" && canRunWork(s),
          target: "building",
          output: () => runSkill("build", "unphased plan; running its single build cycle"),
        },
        {
          id: "resolving-unphased-loop-limit",
          when: (s) => s.planFacts.kind === "unphased" && limitsExceeded(s),
          target: "blocked",
          output: (s) => blocked(`loop limit reached (${s.loopCount} >= ${s.maxLoops}); refusing further work`),
        },
        {
          id: "resolving-incomplete",
          when: (s) => s.planFacts.kind === "phased-incomplete" && canRunWork(s),
          target: "building",
          output: () => runSkill("build", "active incomplete phase; running its build"),
        },
        {
          id: "resolving-incomplete-loop-limit",
          when: (s) => s.planFacts.kind === "phased-incomplete" && limitsExceeded(s),
          target: "blocked",
          output: (s) => blocked(`loop limit reached (${s.loopCount} >= ${s.maxLoops}); refusing further work`),
        },
        {
          id: "resolving-complete",
          when: (s) => s.planFacts.kind === "phased-complete",
          target: "done",
          output: () => none("all phases completed"),
        },
      ],
      events: [stopEvent("resolving")],
    },
    building: buildingLike("building"),
    iterating: buildingLike("iterating"),
    reviewing: reviewingState(),
    documenting: documentingState(),
    saving: savingState(),
    committing: committingState(),
    blocked: {
      events: [
        {
          id: "user-confirmed",
          event: { type: "USER_CONFIRMED" },
          when: () => true,
          target: "resolving",
          output: () => none("USER_CONFIRMED: operator resumed a blocked loop"),
        },
        stopEvent("blocked"),
      ],
    },
    done: { terminal: true },
    aborted: { terminal: true },
  },
});

function asTransition(to: LoopState, output: BuckOutput): Transition {
  return { to, effect: output.effect, why: output.why };
}

function fromDecision(decision: AdvanceDecision<LoopState, Choice, BuckOutput>, snapshot: Snapshot): Transition {
  if (decision.kind === "choices") {
    const why =
      snapshot.state === "reviewing"
        ? "review report unparseable; no iterate artifact"
        : "postcondition scan ambiguous";
    return {
      to: snapshot.state,
      effect: { kind: "choose", legal: decision.choices },
      why,
    };
  }
  return asTransition(decision.to, decision.output);
}

/** Deterministic automatic decision or closed choose effect. Command-owned states fail closed. */
export function next(s: Snapshot): Transition {
  return fromDecision(buckMachine.advance(s), s);
}

export function applyChoice(choice: Choice, s: Snapshot): Transition {
  const decision = buckMachine.choose(s, choice);
  return asTransition(decision.to, decision.output);
}

export function legalChoices(state: LoopState, s: Snapshot): readonly Choice[] {
  try {
    const decision = buckMachine.advance({ ...s, state });
    return decision.kind === "choices" ? decision.choices : [];
  } catch {
    return [];
  }
}

function stubFacts(state: LoopState): Snapshot {
  return {
    state,
    subject: null,
    planPath: null,
    phasePath: null,
    planFacts: { kind: "missing", reason: "operator edge" },
    workFacts: { sessionOutcome: "pending", retriesUsed: 0, postcondition: "pending" },
    reviewFacts: { kind: "pending" },
    loopCount: 0,
    maxLoops: 12,
    iterateCyclesOnPhase: 0,
    lastChoice: null,
    history: [],
  };
}

export function start(): Transition {
  const decision = buckMachine.send(stubFacts("idle"), { type: "START" });
  return asTransition(decision.to, decision.output);
}

export function userConfirmed(): Transition {
  const decision = buckMachine.send(stubFacts("blocked"), { type: "USER_CONFIRMED" });
  return asTransition(decision.to, decision.output);
}

export function stopFrom(from: LoopState): Transition {
  if (from === "done" || from === "aborted") {
    return { to: "aborted", effect: { kind: "none" }, why: `STOP requested by operator from ${from}` };
  }
  const decision = buckMachine.send(stubFacts(from), { type: "STOP" });
  return asTransition(decision.to, decision.output);
}

export { MachineFailure };
