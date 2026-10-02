/**
 * Buck workflow policy over the portable state machine.
 *
 * Named guards, outputs, and the declarative graph live here. The supervisor
 * in `loop.ts` is the only effect interpreter.
 */
import { defineMachine, IllegalTransitionError, type MachineInstance } from "../state_machine/index.js";
import type { Choice, LoopState, Snapshot, Transition, WorkSkill, WorkState } from "./types.js";

/** Six iterate cycles on one phase is the hard ceiling before blocking. */
export const MAX_ITERATE_CYCLES_PER_PHASE = 6;

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

type BuckFacts = Snapshot & { sqlMemoryConfigured: boolean };

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

function ambiguousChoiceOpen(s: Snapshot): boolean {
  return postconditionAmbiguous(s) && canRunWork(s) && !retryExhausted(s);
}

function postconditionAmbiguous(s: Snapshot): boolean {
  return sessionOk(s) && s.workFacts.postcondition === "ambiguous";
}

function postconditionConfirmed(s: Snapshot): boolean {
  return sessionOk(s) && s.workFacts.postcondition === "confirmed";
}

function completedBlockedWork(s: Snapshot): boolean {
  const previous = s.history.at(-1)?.from;
  return (previous === "building" || previous === "iterating") && postconditionConfirmed(s);
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

export class BuckMachineError extends Error {
  constructor(
    readonly code: "NO_ROUTE" | "AMBIGUOUS_ROUTE" | "ILLEGAL_CHOICE",
    readonly state: LoopState,
    readonly targets: readonly LoopState[],
  ) {
    super(`buck machine ${code}: ${state} -> [${targets.join(", ")}]`);
    this.name = "BuckMachineError";
  }
}

export function unphasedBlockReason(s: Snapshot): string {
  const lines = s.planFacts.kind === "unphased" ? s.planFacts.openAcceptanceLines ?? [] : [];
  const details = lines.length > 0 ? `; unchecked acceptance: ${lines.join("; ")}` : "";
  return `unphased plan remains open${details}`;
}

function loopLimitReason(s: Snapshot): string {
  return `loop limit reached (${s.loopCount} >= ${s.maxLoops}); refusing further work`;
}

function iterateLimitReason(s: Snapshot): string {
  return `iterate limit reached on this phase (${s.iterateCyclesOnPhase} >= ${MAX_ITERATE_CYCLES_PER_PHASE})`;
}

function sessionBlockReason(state: WorkState, s: Snapshot): string | null {
  if (sessionFailed(s) && retryExhausted(s)) return `${state} session failed again after one retry`;
  if (!sessionPending(s) && !sessionFailed(s)) return null;
  if (limitsExceeded(s)) return loopLimitReason(s);
  if (state === "iterating" && iterateCeiling(s)) return iterateLimitReason(s);
  return null;
}

function postconditionBlockReason(state: WorkState, s: Snapshot): string | null {
  if (postconditionAmbiguous(s)) {
    // The former two automatic rules overlap here. Keep that invalid input fail-closed.
    if (retryExhausted(s) && limitsExceeded(s)) {
      throw new BuckMachineError("AMBIGUOUS_ROUTE", state, ["blocked"]);
    }
    if (retryExhausted(s)) return "postcondition still ambiguous after one retry; refusing another spin";
    if (limitsExceeded(s)) return "postcondition ambiguous and no legal choice remains (limits exceeded)";
  }
  if (postconditionMissing(s)) return `${state} session finished but postcondition is ${s.workFacts.postcondition} (scan defect)`;
  return null;
}

function reviewPriority(s: Snapshot): boolean {
  return docsWins(s) || cleanSave(s);
}

function reviewBlockReason(s: Snapshot): string | null {
  if (!sessionOk(s)) return null;
  if (s.reviewFacts.kind !== "report") return "review session finished but no report facts were scanned (scan defect)";
  if (iterateWins(s) && !canRunIterate(s)) return limitsExceeded(s) ? loopLimitReason(s) : iterateLimitReason(s);
  if (reviewPriority(s) && limitsExceeded(s)) return loopLimitReason(s);
  if (reviewUnparseable(s) && limitsExceeded(s)) return "review report unparseable and no legal choice remains (limits exceeded)";
  return null;
}

function commitBlockReason(s: Snapshot): string | null {
  if (!postconditionConfirmed(s) && !ambiguousChoiceOpen(s)) return null;
  if (s.planFacts.kind === "unphased" && !s.planFacts.closeEligible) return unphasedBlockReason(s);
  if (s.planFacts.kind === "missing") return `plan vanished while committing: ${s.planFacts.reason}`;
  if (postconditionConfirmed(s) && s.planFacts.kind === "phased-incomplete" && limitsExceeded(s)) return loopLimitReason(s);
  return null;
}

function blockReason(state: WorkState, s: Snapshot): string | null {
  const session = sessionBlockReason(state, s);
  if (session !== null) return session;
  if (state === "reviewing") return reviewBlockReason(s);
  const postcondition = postconditionBlockReason(state, s);
  if (postcondition !== null) return postcondition;
  if (state === "committing") return commitBlockReason(s);
  if (postconditionConfirmed(s) && limitsExceeded(s)) return loopLimitReason(s);
  return null;
}

function rerunReason(state: WorkState, s: Snapshot): string | null {
  const canRun = state === "iterating" ? canRunIterate(s) : canRunWork(s);
  if (sessionPending(s) && canRun) return `${state} session has not run yet`;
  if (sessionFailed(s) && !retryExhausted(s) && canRun) return `${state} session failed; retrying once`;
  if (state !== "reviewing" && ambiguousChoiceOpen(s)) return "accepted choice: retry the session";
  return null;
}

function workEdges(state: WorkState) {
  return [
    {
      name: state,
      guard: (s: BuckFacts) => rerunReason(state, s) !== null,
      effect: (s: BuckFacts) => runSkill(WORK_SKILL[state], rerunReason(state, s)!),
    },
    {
      name: "blocked" as const,
      guard: (s: BuckFacts) => blockReason(state, s) !== null,
      effect: (s: BuckFacts) => blocked(blockReason(state, s)!),
    },
    { ...STOP, effect: () => none(`STOP requested by operator from ${state}`) },
  ];
}

const STOP = { name: "aborted", manual: true } as const;

function confirmedOrAmbiguous(s: Snapshot): boolean {
  return (postconditionConfirmed(s) && canRunWork(s)) || ambiguousChoiceOpen(s);
}

function reviewRoute(s: Snapshot, predicate: (s: Snapshot) => boolean): boolean {
  return sessionOk(s) && predicate(s) && canRunWork(s);
}

function resolvingBlockReason(s: Snapshot): string | null {
  if (s.planFacts.kind === "missing") return `plan unresolved: ${s.planFacts.reason}`;
  if (s.planFacts.kind !== "phased-complete" && limitsExceeded(s)) return loopLimitReason(s);
  return null;
}

function commitDoneReason(s: Snapshot): string | null {
  if (!postconditionConfirmed(s) && !ambiguousChoiceOpen(s)) return null;
  if (s.planFacts.kind === "phased-complete") return "no phases remain";
  if (s.planFacts.kind === "unphased" && s.planFacts.closeEligible === true) return "unphased plan completed its single cycle";
  return null;
}

export const buckMachine = defineMachine<BuckFacts, BuckOutput>()({
  initial: "idle",
  states: {
    idle: {
      targets: [
        { name: "resolving", manual: true, effect: () => none("START: operator supplied a path") },
        { ...STOP, effect: () => none("STOP requested by operator from idle") },
      ],
    },
    resolving: {
      targets: [
        {
          name: "building",
          guard: (s) => (s.planFacts.kind === "unphased" || s.planFacts.kind === "phased-incomplete") && canRunWork(s),
          effect: (s) => runSkill("build", s.planFacts.kind === "unphased"
            ? "unphased plan; running its single build cycle"
            : "active incomplete phase; running its build"),
        },
        {
          name: "blocked",
          guard: (s) => resolvingBlockReason(s) !== null,
          effect: (s) => blocked(resolvingBlockReason(s)!),
        },
        { name: "done", guard: (s) => s.planFacts.kind === "phased-complete", effect: () => none("all phases completed") },
        { ...STOP, effect: () => none("STOP requested by operator from resolving") },
      ],
    },
    building: {
      targets: [
        ...workEdges("building"),
        { name: "reviewing", guard: confirmedOrAmbiguous, effect: () => runSkill("review", "work landed; reviewing it") },
      ],
    },
    iterating: {
      targets: [
        ...workEdges("iterating"),
        { name: "reviewing", guard: confirmedOrAmbiguous, effect: () => runSkill("review", "work landed; reviewing it") },
      ],
    },
    reviewing: {
      targets: [
        ...workEdges("reviewing"),
        {
          name: "iterating",
          guard: (s) => sessionOk(s) && (iterateWins(s) || reviewUnparseable(s)) && canRunIterate(s),
          effect: (s) => runSkill("iterate", iterateWins(s)
            ? "iterate artifact present; in-plan issues win"
            : "accepted choice: iterate on in-plan issues"),
        },
        {
          name: "documenting",
          guard: (s) => reviewRoute(s, docsWins) || reviewRoute(s, reviewUnparseable),
          effect: (s) => runSkill("docs", docsWins(s)
            ? "review flagged documentation impact"
            : "accepted choice: document the impact"),
        },
        {
          name: "saving",
          guard: (s) => reviewRoute(s, cleanSave) || reviewRoute(s, reviewUnparseable),
          effect: (s) => runSkill("save", cleanSave(s)
            ? "clean review; saving"
            : "accepted choice: treat the review as clean and save"),
        },
      ],
    },
    documenting: {
      targets: [
        ...workEdges("documenting"),
        { name: "saving", guard: confirmedOrAmbiguous, effect: () => runSkill("save", "docs updated; saving session state") },
      ],
    },
    saving: {
      targets: [
        ...workEdges("saving"),
        {
          name: "committing",
          guard: (s) => (postconditionConfirmed(s) && canRunWork(s)) || (ambiguousChoiceOpen(s) && !s.sqlMemoryConfigured),
          effect: () => runSkill("commit", "session state saved; committing"),
        },
      ],
    },
    committing: {
      targets: [
        ...workEdges("committing"),
        {
          name: "building",
          guard: (s) => confirmedOrAmbiguous(s) && s.planFacts.kind === "phased-incomplete",
          effect: () => runSkill("build", "next incomplete phase"),
        },
        { name: "done", guard: (s) => commitDoneReason(s) !== null, effect: (s) => none(commitDoneReason(s)!) },
      ],
    },
    blocked: {
      targets: [
        {
          name: "reviewing", manual: true, guard: completedBlockedWork,
          effect: () => none("USER_CONFIRMED: completed blocked work; reviewing its phase"),
        },
        {
          name: "resolving", manual: true, guard: (s) => !completedBlockedWork(s),
          effect: () => none("USER_CONFIRMED: operator resumed a blocked loop"),
        },
        { ...STOP, effect: () => none("STOP requested by operator from blocked") },
      ],
    },
    done: { final: true, targets: [] },
    aborted: { final: true, targets: [] },
  },
});

function facts(s: Snapshot): BuckFacts {
  return { ...s, sqlMemoryConfigured: Boolean(process.env.SQL_MEMORY_URL) };
}

function asTransition(to: LoopState, output: BuckOutput): Transition {
  return { to, effect: output.effect, why: output.why };
}

function take(instance: MachineInstance<LoopState, BuckFacts, BuckOutput>, to: LoopState, s: BuckFacts): Transition {
  const transition = instance.transition(to, s);
  return asTransition(transition.to, transition.effect!);
}

function decisionOpen(s: Snapshot): boolean {
  if (s.state === "reviewing") return reviewRoute(s, reviewUnparseable);
  if (!Object.hasOwn(WORK_SKILL, s.state)) return false;
  return ambiguousChoiceOpen(s);
}

function choiceFor(state: LoopState, to: LoopState): Choice {
  if (to === state) return { kind: "retry" };
  if (state !== "reviewing") return { kind: "advance" };
  const kind = { iterating: "iterate", documenting: "document", saving: "save" } as const;
  return { kind: kind[to as keyof typeof kind] };
}

/** Deterministic transition or closed choose effect. Command-owned states fail closed. */
export function next(s: Snapshot): Transition {
  const f = facts(s);
  const instance = buckMachine.restore(s.state);
  const targets = instance.available(f);
  if (targets.length === 0) throw new BuckMachineError("NO_ROUTE", s.state, targets);
  // Preserve the SQL-save decision boundary even when only retry is legal.
  const singleSqlChoice = s.state === "saving" && f.sqlMemoryConfigured && decisionOpen(s);
  if (targets.length === 1 && !singleSqlChoice) return take(instance, targets[0]!, f);
  if (!decisionOpen(s)) throw new BuckMachineError("AMBIGUOUS_ROUTE", s.state, targets);
  return {
    to: s.state,
    effect: { kind: "choose", legal: targets.map((to) => choiceFor(s.state, to)) },
    why: s.state === "reviewing" ? "review report unparseable; no iterate artifact" : "postcondition scan ambiguous",
  };
}

export function applyChoice(choice: Choice, s: Snapshot): Transition {
  const f = facts(s);
  const instance = buckMachine.restore(s.state);
  const targets = instance.available(f);
  const to = targets.find((target) => choiceFor(s.state, target).kind === choice.kind);
  if (!decisionOpen(s) || to === undefined) throw new BuckMachineError("ILLEGAL_CHOICE", s.state, targets);
  return take(instance, to, f);
}

export function legalChoices(state: LoopState, s: Snapshot): readonly Choice[] {
  const f = facts({ ...s, state });
  if (!decisionOpen(f)) return [];
  return buckMachine.restore(state).available(f).map((to) => choiceFor(state, to));
}

function stubFacts(state: LoopState): Snapshot {
  return {
    state, subject: null, planPath: null, phasePath: null,
    planFacts: { kind: "missing", reason: "operator edge" },
    workFacts: { sessionOutcome: "pending", retriesUsed: 0, postcondition: "pending" },
    reviewFacts: { kind: "pending" }, loopCount: 0, maxLoops: 12,
    iterateCyclesOnPhase: 0, lastChoice: null, history: [],
  };
}

export function start(): Transition {
  return take(buckMachine.start(), "resolving", facts(stubFacts("idle")));
}

export function userConfirmed(s: Snapshot): Transition {
  const to = completedBlockedWork(s) ? "reviewing" : "resolving";
  if (s.state !== "blocked") throw new IllegalTransitionError(s.state, to, "not-a-target");
  return take(buckMachine.restore(s.state), to, facts(s));
}

export function stopFrom(from: LoopState): Transition {
  if (from === "done" || from === "aborted") {
    return { to: "aborted", effect: { kind: "none" }, why: `STOP requested by operator from ${from}` };
  }
  return take(buckMachine.restore(from), "aborted", facts(stubFacts(from)));
}
