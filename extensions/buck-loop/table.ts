/**
 * table — the pure buck-loop transition contract.
 *
 * Encodes the legal edges of the buck-loop state graph as plain functions:
 * no filesystem, git, process, clock, or OMP SDK access. Snapshots are
 * semantic facts produced by scanning; effects describe work but never
 * perform it. Deterministic guards always win; only genuinely ambiguous
 * review/postcondition situations surface a closed `choose` effect, and a
 * raw model string can never mutate state — `applyChoice` validates
 * membership in `legalChoices` before producing a transition.
 *
 * Review priority is frozen: iterate artifact > documentation impact > save.
 * Operator-owned edges (START, USER_CONFIRMED, STOP) are exposed as pure
 * helpers; the command layer invokes them, `next` never self-serves them.
 */

import type { Choice, LoopState, Snapshot, Transition, WorkSkill, WorkState } from "./types.js";

/** Three iterate cycles on one phase is the hard ceiling before blocking. */
export const MAX_ITERATE_CYCLES_PER_PHASE = 3;

/** States whose stay is filled by one nested work session, and the skill that fills it. */
const WORK_SKILL: Partial<Record<LoopState, WorkSkill>> = {
  building: "build",
  reviewing: "review",
  iterating: "iterate",
  documenting: "docs",
  saving: "save",
  committing: "commit",
};

export class IllegalTransitionError extends Error {
  constructor(state: LoopState, detail: string) {
    super(`illegal transition from ${state}: ${detail}`);
    this.name = "IllegalTransitionError";
  }
}

export class IllegalChoiceError extends Error {
  constructor(choice: Choice["kind"], state: LoopState) {
    super(`choice ${choice} is not legal in ${state} for this snapshot`);
    this.name = "IllegalChoiceError";
  }
}

/** True when either safety counter has reached its ceiling. */
export function limitsExceeded(s: Snapshot): boolean {
  return s.loopCount >= s.maxLoops || s.iterateCyclesOnPhase >= MAX_ITERATE_CYCLES_PER_PHASE;
}

function blocked(reason: string): Transition {
  return { to: "blocked", effect: { kind: "await-operator", reason }, why: reason };
}

function runSkill(to: LoopState, skill: WorkSkill, why: string): Transition {
  return { to, effect: { kind: "run-skill", skill }, why };
}

function skillFor(state: LoopState): WorkSkill {
  const skill = WORK_SKILL[state];
  if (!skill) throw new IllegalTransitionError(state, "no work session runs in this state");
  return skill;
}

/**
 * Work-emitting transitions are gated by the safety counters: a loop at the
 * maximum, or three iterate cycles on one phase, blocks before another work
 * effect or choice is emitted. Transitions to `done`/`blocked` pass through.
 */
function gated(t: Transition, s: Snapshot): Transition {
  if (t.effect.kind !== "run-skill" && t.effect.kind !== "choose") return t;
  if (s.loopCount >= s.maxLoops) {
    return blocked(`loop limit reached (${s.loopCount} >= ${s.maxLoops}); refusing further work`);
  }
  if (s.iterateCyclesOnPhase >= MAX_ITERATE_CYCLES_PER_PHASE) {
    return blocked(
      `iterate limit reached on this phase (${s.iterateCyclesOnPhase} >= ${MAX_ITERATE_CYCLES_PER_PHASE})`,
    );
  }
  return t;
}

const REVIEW_CHOICE_SET: readonly Choice[] = [
  { kind: "iterate" },
  { kind: "document" },
  { kind: "save" },
  { kind: "block" },
];

const POSTCONDITION_CHOICE_SET: readonly Choice[] = [
  { kind: "retry" },
  { kind: "advance" },
  { kind: "block" },
];

/** Choices legal in `reviewing`: only when the report is unparseable and no artifact disambiguates. */
function reviewChoices(s: Snapshot): readonly Choice[] {
  if (s.workFacts.sessionOutcome !== "ok") return [];
  if (s.reviewFacts.kind !== "report") return [];
  const r = s.reviewFacts;
  if (r.iterateArtifact || r.docsImpact || r.howtoImpact || r.parseable) return [];
  return REVIEW_CHOICE_SET;
}

/** Choices legal in the postcondition states: only when the scan is ambiguous. */
function postconditionChoices(s: Snapshot): readonly Choice[] {
  if (s.workFacts.sessionOutcome !== "ok" || s.workFacts.postcondition !== "ambiguous") return [];
  return POSTCONDITION_CHOICE_SET;
}

/**
 * The closed set of machine actions an LLM may be offered for this state and
 * snapshot. Empty wherever a deterministic guard decides (or limits are
 * exceeded) — the supervisor only asks when this is non-empty.
 */
export function legalChoices(state: LoopState, s: Snapshot): readonly Choice[] {
  if (limitsExceeded(s)) return [];
  if (state === "reviewing") return reviewChoices(s);
  if (WORK_SKILL[state] !== undefined) return postconditionChoices(s);
  return [];
}

/** Handle the shared session lifecycle (not-yet-run / failed / retried) for a work state. Returns null when the session finished ok. */
function sessionPhase(state: LoopState, s: Snapshot): Transition | null {
  const skill = skillFor(state);
  const w = s.workFacts;
  if (w.sessionOutcome === "pending") {
    return gated(runSkill(state, skill, `${state} session has not run yet`), s);
  }
  if (w.sessionOutcome === "failed") {
    if (w.retriesUsed >= 1) return blocked(`${state} session failed again after one retry`);
    return gated(runSkill(state, skill, `${state} session failed; retrying once`), s);
  }
  return null;
}

/** The deterministic advance after a confirmed postcondition. */
function advanceFrom(state: LoopState, s: Snapshot): Transition {
  switch (state) {
    case "building":
    case "iterating":
      return runSkill("reviewing", "review", "work landed; reviewing it");
    case "documenting":
      return runSkill("saving", "save", "docs updated; saving session state");
    case "saving":
      return runSkill("committing", "commit", "session state saved; committing");
    case "committing":
      return advanceFromCommitting(s);
    default:
      throw new IllegalTransitionError(state, "no confirmed-postcondition advance from this state");
  }
}

function advanceFromCommitting(s: Snapshot): Transition {
  switch (s.planFacts.kind) {
    case "phased-incomplete":
      return runSkill("building", "build", "next incomplete phase");
    case "phased-complete":
      return { to: "done", effect: { kind: "none" }, why: "no phases remain" };
    case "unphased":
      return { to: "done", effect: { kind: "none" }, why: "unphased plan completed its single cycle" };
    case "missing":
      return blocked(`plan vanished while committing: ${s.planFacts.reason}`);
  }
}

function nextResolving(s: Snapshot): Transition {
  switch (s.planFacts.kind) {
    case "missing":
      return blocked(`plan unresolved: ${s.planFacts.reason}`);
    case "unphased":
      return gated(runSkill("building", "build", "unphased plan; running its single build cycle"), s);
    case "phased-incomplete":
      return gated(runSkill("building", "build", "active incomplete phase; running its build"), s);
    case "phased-complete":
      return { to: "done", effect: { kind: "none" }, why: "all phases completed" };
  }
}

function nextReviewing(s: Snapshot): Transition {
  const session = sessionPhase("reviewing", s);
  if (session) return session;
  if (s.reviewFacts.kind !== "report") {
    return blocked("review session finished but no report facts were scanned (scan defect)");
  }
  const r = s.reviewFacts;
  if (r.iterateArtifact) {
    return gated(runSkill("iterating", "iterate", "iterate artifact present; in-plan issues win"), s);
  }
  if (r.docsImpact || r.howtoImpact) {
    return gated(runSkill("documenting", "docs", "review flagged documentation impact"), s);
  }
  if (r.parseable) {
    return gated(runSkill("saving", "save", "clean review; saving"), s);
  }
  const legal = reviewChoices(s);
  if (legal.length === 0) {
    return blocked("review report unparseable and no legal choice remains (limits exceeded)");
  }
  return gated(
    { to: "reviewing", effect: { kind: "choose", legal }, why: "review report unparseable; no iterate artifact" },
    s,
  );
}

function nextWork(s: Snapshot): Transition {
  const state = s.state;
  const session = sessionPhase(state, s);
  if (session) return session;
  if (s.workFacts.postcondition === "ambiguous") {
    const legal = postconditionChoices(s);
    if (legal.length === 0) {
      return blocked("postcondition ambiguous and no legal choice remains (limits exceeded)");
    }
    return gated(
      { to: state, effect: { kind: "choose", legal }, why: "postcondition scan ambiguous" },
      s,
    );
  }
  if (s.workFacts.postcondition !== "confirmed") {
    return blocked(`${state} session finished but postcondition is ${s.workFacts.postcondition} (scan defect)`);
  }
  return gated(advanceFrom(state, s), s);
}

/**
 * The deterministic decision for a snapshot. Loop states only: `idle`
 * awaits START, `blocked` awaits USER_CONFIRMED, `done`/`aborted` are
 * terminal — those edges belong to the command layer, and asking `next`
 * from them is an explicit error, never a default advance.
 */
const NEXT_HANDLER: Record<LoopState, ((s: Snapshot) => Transition) | null> = {
  resolving: nextResolving,
  reviewing: nextReviewing,
  building: nextWork,
  iterating: nextWork,
  documenting: nextWork,
  saving: nextWork,
  committing: nextWork,
  idle: null,
  blocked: null,
  done: null,
  aborted: null,
};

function nonLoopDetail(state: LoopState): string {
  switch (state) {
    case "idle":
      return "awaiting START; the command layer owns this edge";
    case "blocked":
      return "awaiting USER_CONFIRMED; the command layer owns this edge";
    case "done":
    case "aborted":
      return "terminal state";
    default:
      return "not a loop state";
  }
}

export function next(s: Snapshot): Transition {
  const handler = NEXT_HANDLER[s.state];
  if (handler) return handler(s);
  throw new IllegalTransitionError(s.state, nonLoopDetail(s.state));
}

function applyReviewChoice(choice: Choice, s: Snapshot): Transition {
  switch (choice.kind) {
    case "iterate":
      return runSkill("iterating", "iterate", "accepted choice: iterate on in-plan issues");
    case "document":
      return runSkill("documenting", "docs", "accepted choice: document the impact");
    case "save":
      return runSkill("saving", "save", "accepted choice: treat the review as clean and save");
    case "block":
      return blocked("accepted choice: block");
    default:
      throw new IllegalChoiceError(choice.kind, s.state);
  }
}

function applyPostconditionChoice(choice: Choice, s: Snapshot): Transition {
  switch (choice.kind) {
    case "retry":
      return runSkill(s.state, skillFor(s.state), "accepted choice: retry the session");
    case "advance":
      return advanceFrom(s.state, s);
    case "block":
      return blocked("accepted choice: block");
    default:
      throw new IllegalChoiceError(choice.kind, s.state);
  }
}

/**
 * Apply a model-proposed choice. The choice must be a member of the closed
 * legal set for this snapshot; anything else throws and the machine stays
 * put — no raw model string can transition state. Because `legalChoices`
 * returns an empty set once limits are exceeded, accepted choices are never
 * limit-gated here.
 */
export function applyChoice(choice: Choice, s: Snapshot): Transition {
  const legal = legalChoices(s.state, s);
  if (!legal.some((c) => c.kind === choice.kind)) {
    throw new IllegalChoiceError(choice.kind, s.state);
  }
  if (s.state === "reviewing") return applyReviewChoice(choice, s);
  return applyPostconditionChoice(choice, s);
}

/** START: idle → resolving. Operator-supplied path; the command layer owns invocation. */
export function start(): Transition {
  return { to: "resolving", effect: { kind: "none" }, why: "START: operator supplied a path" };
}

/** USER_CONFIRMED: blocked → resolving. The operator explicitly resumed a blocked loop. */
export function userConfirmed(): Transition {
  return { to: "resolving", effect: { kind: "none" }, why: "USER_CONFIRMED: operator resumed a blocked loop" };
}

/** STOP: any state → aborted. */
export function stopFrom(from: LoopState): Transition {
  return { to: "aborted", effect: { kind: "none" }, why: `STOP requested by operator from ${from}` };
}
