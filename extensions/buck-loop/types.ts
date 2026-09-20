/**
 * Frozen vocabulary for the unattended Buck workflow runner.
 *
 * This file is **data only**. It does not import the coding-agent host,
 * does not read disk, and does not call a model. Every other file in
 * this folder speaks this vocabulary:
 *
 * 1. `scan.ts` looks at plan/review files and fills a {@link Snapshot}.
 * 2. `machine.ts` reads that snapshot and returns a {@link Transition}
 *    ("go to this state and do this {@link Effect}").
 * 3. `loop.ts` performs the effect (run a skill, ask a model, or wait),
 *    then rescans. Worker prose never chooses the next state.
 *
 * Extend types here, never by inventing a parallel shape in a later file.
 */

/**
 * User-visible states of one `/buck-loop` run.
 *
 * Scanning, classifying, and verifying are **functions inside a state**,
 * not states of their own. The operator sees these eleven:
 *
 * - `idle` — nothing saved; waiting for `/buck-loop <path>`.
 * - `resolving` — we have a path; looking up the plan/phase on disk.
 * - `building` — nested session is implementing the current phase (`b-build`).
 * - `reviewing` — nested session is reviewing the implementation (`b-review`).
 * - `iterating` — nested session is fixing in-plan review issues (`b-iterate`).
 * - `documenting` — nested session is updating living docs (`b-docs` / `b-howto`).
 * - `saving` — nested session is writing session memory (`b-save`).
 * - `committing` — nested session is creating a git commit (`b-commit`).
 * - `blocked` — cannot continue safely; waiting for the operator.
 * - `done` — every phase completed; the run is finished.
 * - `aborted` — the operator typed `/buck-loop --stop`.
 */
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

/**
 * States whose stay is filled by one nested coding session (a child agent
 * that runs a skill). `idle` / `resolving` / `blocked` / `done` / `aborted`
 * do not spawn a child.
 */
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
 * stays `"confirmed"` and is ignored by the machine.
 */
export interface WorkFacts {
  /** Has the nested session for this state run yet, succeeded, or failed? */
  sessionOutcome: "pending" | "ok" | "failed";
  /** Failures already retried in this state. One retry is the ceiling. */
  retriesUsed: number;
  /**
   * After a successful session, did a rescan confirm the expected disk change?
   * `ambiguous` is the only case that may ask a model (`retry` / `advance` / `block`).
   */
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
      /** False when the review markdown is missing required impact sections. */
      parseable: boolean;
      /** True when an unfinished `iterate-*.md` exists in the subject folder. */
      iterateArtifact: boolean;
      /** True when the report's Documentation Impact section is flagged. */
      docsImpact: boolean;
      /** True when the report's How-to Impact section is flagged. */
      howtoImpact: boolean;
    };

/**
 * A closed machine action a language model may propose.
 *
 * The model can only ever name one of these six words. `machine.applyChoice`
 * checks membership in the current legal set before any transition is
 * produced. Free-text answers never move the loop.
 *
 * Review-time (`reviewing`, report unparseable): `iterate` | `document` | `save` | `block`.
 * Postcondition-time (work finished but disk looks ambiguous): `retry` | `advance` | `block`.
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

/** One recorded hop; `at` is an ISO timestamp supplied by the supervisor — the machine never reads a clock. */
export interface TransitionRecord {
  from: LoopState;
  to: LoopState;
  at: string;
  why: string;
}

/**
 * The single input to the machine: a projection of identity,
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
  /** Last accepted LLM choice, if any. Diagnostic; the machine does not read it. */
  lastChoice: AcceptedChoice | null;
  /** Transition history. Diagnostic; the machine does not read it. */
  history: TransitionRecord[];
}

/**
 * A skill the supervisor must run in a nested coding session.
 * Which variant (e.g. `b-build` vs `b-build-hard`) is chosen in `loop.ts`,
 * not here.
 */
export type WorkSkill = "build" | "review" | "iterate" | "docs" | "save" | "commit";

/**
 * What the supervisor must **do** after arriving in `Transition.to`.
 *
 * - `none` — just sit in that state (START, STOP, arriving at `done`).
 * - `run-skill` — spawn a nested coding session for this skill.
 * - `choose` — ask a model to pick from `legal` (already closed by the machine).
 * - `await-operator` — stop and wait; the human must `--resume` or `--stop`.
 *
 * Work and choice are separate variants so execution code cannot smuggle a
 * transition through free text.
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
