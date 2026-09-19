/**
 * types — the frozen buck-loop vocabulary.
 *
 * Pure data only: no filesystem, git, process, clock, or OMP SDK access.
 * `Snapshot` carries semantic facts produced by scanning artifacts; the
 * transition table in `table.ts` consumes them and emits `Effect`s that
 * describe work without performing it. This module is the schema gate for
 * every later phase (scan, choice, work sessions, supervisor) — extend it
 * deliberately, never locally.
 */

/** User-visible states only. Scanning, classifying, and verifying are functions inside a state, not states. */
export type LoopState =
  | "idle"
  | "resolving"
  | "building"
  | "reviewing"
  | "iterating"
  | "documenting"
  | "saving"
  | "committing"
  | "blocked"
  | "done"
  | "aborted";

/** States whose stay is filled by one nested work session. */
export type WorkState = Exclude<LoopState, "idle" | "resolving" | "blocked" | "done" | "aborted">;

/**
 * What the plan scan found. Domain facts, not filesystem mechanics:
 * the scan (Phase 2) resolves subject ambiguity, phase ordering, and
 * completion status before producing these.
 *
 * - `missing` covers no plan, no subject, and multiple subjects without a path,
 *   plus a phased plan where no incomplete phase is dependency-ready or a
 *   phase's `depends_on` is malformed; `reason` says which.
 * - `phased-incomplete` means at least one non-completed phase file exists;
 *   the active one is `Snapshot.phasePath`.
 * - `phased-complete` means every discrete phase file reports completion.
 */
export type PlanFacts =
  | { kind: "missing"; reason: string }
  | { kind: "unphased" }
  | { kind: "phased-incomplete" }
  | { kind: "phased-complete" };

/**
 * Facts about the nested work session of the current state. Reset to
 * `pending` by the scan whenever a new session starts (state entry or retry).
 *
 * Scan contract: when `sessionOutcome` is `"ok"` for a non-review session,
 * `postcondition` is `"confirmed"` (rescan verified the expected artifact
 * change) or `"ambiguous"` (e.g. files changed but phase status unchanged).
 * Review sessions decide through `ReviewFacts` instead; their postcondition
 * stays `"confirmed"` and is ignored by the table.
 */
export interface WorkFacts {
  sessionOutcome: "pending" | "ok" | "failed";
  retriesUsed: number;
  postcondition: "pending" | "confirmed" | "ambiguous";
}

/**
 * Facts from scanning the review artifacts of the current phase cycle.
 * Reset to `pending` when a new cycle begins (new phase, or iterating
 * re-enters reviewing).
 *
 * Scan contract: an unparseable report yields `parseable: false` with all
 * impact flags `false` — untrustworthy content is treated as absent, so the
 * deterministic priority tree degrades to the closed `choose` effect rather
 * than acting on garbage.
 */
export type ReviewFacts =
  | { kind: "pending" }
  | {
      kind: "report";
      parseable: boolean;
      iterateArtifact: boolean;
      docsImpact: boolean;
      howtoImpact: boolean;
    };

/**
 * A closed machine action an LLM may propose. The model can only ever name
 * one of these variants; `table.applyChoice` validates membership in the
 * current legal set before any transition is produced. No free text
 * transitions state.
 */
export type Choice =
  | { kind: "iterate" }
  | { kind: "document" }
  | { kind: "save" }
  | { kind: "retry" }
  | { kind: "advance" }
  | { kind: "block" };

/** A choice the machine accepted, with the model's stated reason for the audit trail. */
export interface AcceptedChoice {
  choice: Choice;
  reason: string;
}

/** One recorded hop; `at` is an ISO timestamp supplied by the supervisor — the table never reads a clock. */
export interface TransitionRecord {
  from: LoopState;
  to: LoopState;
  at: string;
  why: string;
}

/**
 * The single input to the transition table: a projection of identity,
 * safety counters, and artifact facts. The persisted file
 * `.context/workflow/buck-loop.json` serializes a subset; artifacts win on
 * disagreement.
 */
export interface Snapshot {
  state: LoopState;
  /** Resolved subject folder name, or null before resolution. */
  subject: string | null;
  /** Resolved plan file path, or null before resolution. */
  planPath: string | null;
  /** Active discrete phase file, or null for unphased plans / before resolution. */
  phasePath: string | null;
  planFacts: PlanFacts;
  workFacts: WorkFacts;
  reviewFacts: ReviewFacts;
  /** Completed supervisor iterations. */
  loopCount: number;
  /** Operator-configured ceiling; a loop at the maximum blocks before further work. */
  maxLoops: number;
  /** Iterate cycles spent on the current phase; resets when the phase changes. */
  iterateCyclesOnPhase: number;
  /** Last accepted LLM choice, if any. Diagnostic; the table does not read it. */
  lastChoice: AcceptedChoice | null;
  /** Transition history. Diagnostic; the table does not read it. */
  history: TransitionRecord[];
}

/** A skill the supervisor must run in a nested work session. Which variant (e.g. build vs build-hard) is the runner's call. */
export type WorkSkill = "build" | "review" | "iterate" | "docs" | "save" | "commit";

/**
 * Work effects and choice effects are separate closed variants: execution
 * code cannot smuggle a transition through free text. `run-skill` carries
 * only a `WorkSkill`; `choose` carries only machine-declared legal choices.
 */
export type Effect =
  | { kind: "none" }
  | { kind: "run-skill"; skill: WorkSkill }
  | { kind: "choose"; legal: readonly Choice[] }
  | { kind: "await-operator"; reason: string };

/** One edge of the state graph: target state, the effect to perform, and why. */
export interface Transition {
  to: LoopState;
  effect: Effect;
  why: string;
}
