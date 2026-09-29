/**
 * Supervisor: the while-loop that drives `/buck-loop`.
 *
 * This file is the only one that **does work**. Everything else either
 * describes work (`machine.ts`) or performs one isolated job (`run-step.ts`,
 * `choice.ts`, `scan.ts`, `persist.ts`).
 *
 * Each tick:
 *
 * 1. If the snapshot is already `done` / `blocked` / `aborted`, stop.
 * 2. Ask {@link next} (the compiled Buck machine) for a {@link Transition}.
 * 3. Persist the new state to `.context/workflow/buck-loop.json`.
 * 4. Perform the effect:
 *    - `run-skill` → spawn a nested coding session (`run-step.ts`).
 *    - `choose` → ask a model for one legal action (`choice.ts`).
 *    - `await-operator` → halt and wait for the human.
 *    - `none` → nothing to do this tick.
 * 5. Rescan disk. Artifacts win over whatever the child *said* it did.
 * 6. Repeat, up to {@link SAFETY_TICK_CEILING} ticks.
 *
 * Nested-session prose is diagnostic only. The child's last sentence never
 * picks the next state. The operator talks to this module through
 * {@link handleLoop}: `start` / `resume` / `status` / `stop`.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { choose as defaultChoose, type ChooseResult } from "./choice.js";
import {
  askRepairLift,
  changedLoopExtensionFiles,
  diagnoseAmbiguity,
  explainAmbiguity,
  loopExtensionFiles,
  phaseAbs,
  repairCheckedPhase,
  type RepairPlan,
} from "./ambiguity.js";
import type { ActivityEvent } from "../extension-activity.js";
import {
  PROJECTION_VERSION,
  readProjection,
  resume,
  writeProjection,
  type Projection,
} from "./persist.js";
import { parsePhaseDifficulty, type PhaseDifficulty } from "../omp-models.js";
import { runStep as defaultRunStep, type NestedSkill, type RunStepResult } from "./run-step.js";
import { serializeCallError, type AgentCallFailure, type CallFailureDetails } from "./call-failure.js";
import { scan } from "./scan.js";
import { syncCheckedPhasesAt } from "./phase-completion.js";
import { recallProjectMemories, formatRecall } from "./project-memory.js";
import { prepareSaveAttempt, probeSql, resumeSaveDecision, saveDirective, sqlMode, verifySqlSave } from "./sql-save.js";
import { applyChoice, next, start, stopFrom, userConfirmed } from "./machine.js";
import type {
  AcceptedChoice,
  Choice,
  LoopState,
  Snapshot,
  Transition,
  TransitionRecord,
  WorkSkill,
} from "./types.js";

const PROTECTED_BRANCHES: Record<string, true> = {
  main: true,
  master: true,
  dev: true,
  develop: true,
};

const IN_CYCLE_WORK_STATES: Partial<Record<LoopState, true>> = {
  building: true,
  reviewing: true,
  iterating: true,
  documenting: true,
  saving: true,
  committing: true,
};

/** Hard cap on supervisor ticks in one invocation, independent of `maxLoops`. */
const SAFETY_TICK_CEILING = 64;
/** Process-local: only a fresh OMP module can clear a restart stop. */
const restartRequired = new Map<string, string>();

/**
 * While we are inside a phase's mini-cycle, keep the same `phasePath` even
 * if a rescan would pick a different incomplete phase (e.g. after a commit).
 */
const FROZEN_PHASE: ReadonlySet<LoopState> = new Set([
  "building",
  "reviewing",
  "iterating",
  "documenting",
  "saving",
]);

/** Public commands the slash-command layer may send. */
export type LoopCommand = "start" | "resume" | "status" | "stop";

/** What one `/buck-loop` invocation returns to the command handler. */
export type LoopResult = {
  state: LoopState;
  reason: string;
};

/** Live progress event for the chat widget (`onProgress`). */
export type LoopProgress = {
  state: LoopState;
  operation: "run-skill" | "choose";
  label: string;
  target: string;
};

/**
 * Injectable seams. Production uses the defaults; tests swap `runStep` /
 * `choose` / `now` so CI never calls a live model.
 *
 * - `onProgress` — update the spinner label.
 * - `onActivity` — stream nested-session tokens/tools into the widget.
 * - `onFailure` — structured failure for the parent chat (`index.ts`).
 */
export type LoopDeps = {
  runStep: typeof defaultRunStep;
  choose: typeof defaultChoose;
  now: () => string;
  onProgress: (progress: LoopProgress) => void;
  onFailure: (failure: AgentCallFailure) => void;
  onActivity: (event: ActivityEvent) => void;
  /** Warning the operator can read without stopping the run. */
  onWarning: (message: string) => void;
  /** Yes continues despite non-context dirt. No stops this invocation; it does not persist `blocked`. */
  confirmDirty: (paths: string[]) => Promise<boolean>;
  /** Yes keeps a run going instead of landing in `blocked`. No keeps the machine stop. */
  confirmContinue: (reason: string) => Promise<boolean>;
  /** Diagnosed lift of an ambiguous postcondition. Light and medium continue; heavy is handed to the operator. */
  classifyRepair: (input: { cwd: string; snapshot: Snapshot; why: string; sessionText: string }) => Promise<RepairPlan>;
  /** Ids from the live host registry, the same list `/buck-models` offers. */
  availableIds?: () => Promise<ReadonlySet<string>>;
};

type EffectResult = {
  snapshot: Snapshot;
  lastFail: string | null;
  halt: LoopResult | null;
  /** Mandatory stops cannot be overridden by the generic continue prompt. */
  mandatoryStop?: true;
  sessionText?: string;
};

const DEFAULT_DEPS: LoopDeps = {
  runStep: defaultRunStep,
  choose: defaultChoose,
  now: () => new Date().toISOString(),
  onProgress: () => undefined,
  onFailure: () => undefined,
  onActivity: () => undefined,
  onWarning: () => undefined,
  confirmDirty: async () => false,
  confirmContinue: async () => false,
  classifyRepair: async ({ cwd, snapshot, why, sessionText }) => {
    const abs = phaseAbs(cwd, snapshot.phasePath ?? snapshot.planPath);
    return askRepairLift(diagnoseAmbiguity({ abs, sessionText, why }));
  },
};

/**
 * Entry point used by `index.ts`.
 *
 * @param opts.cwd - Project directory (the operator's workspace).
 * @param opts.command - `start` needs `path`; the others read the saved run file.
 * @param opts.path - Plan, phase, or subject path. Ignored unless `command` is `start`.
 * @param opts.deps - Optional test doubles and UI callbacks.
 */
export async function handleLoop(opts: {
  cwd: string;
  command: LoopCommand;
  path?: string;
  deps?: Partial<LoopDeps>;
}): Promise<LoopResult> {
  const cwd = resolve(opts.cwd);
  const deps: LoopDeps = { ...DEFAULT_DEPS, ...opts.deps };
  if (opts.command === "status") return statusOf(cwd);
  if (opts.command === "stop") return stopRun(cwd, deps.now);
  const restartReason = restartRequired.get(cwd);
  if (restartReason) return { state: "blocked", reason: restartReason };
  if (opts.command === "start") return startRun(cwd, opts.path, deps);
  return resumeRun(cwd, deps);
}

/** Read the saved run file. Missing → idle; unreadable → blocked. */
export function statusOf(cwd: string): LoopResult {
  const projectionFile = join(cwd, ".context/workflow/buck-loop.json");
  const projection = readProjection(cwd);
  if (!projection) return existsSync(projectionFile)
    ? { state: "blocked", reason: "unreadable projection; repair it or start with an explicit plan path" }
    : { state: "idle", reason: "no projection" };
  const last = projection.history.at(-1);
  if (projection.state === "blocked") {
    const cause = lastWhy(projection) ?? "reason unavailable";
    return { state: "blocked", reason: `${cause}. ${recoveryFor(projection, last?.from)}` };
  }
  if (projection.state === "aborted") return stoppedStatus(projection, last);
  return { state: projection.state, reason: lastWhy(projection) ?? `projection is ${projection.state}` };
}

function stoppedStatus(projection: Projection, last: TransitionRecord | undefined): LoopResult {
  const stoppedBlock = last?.from === "blocked" ? projection.history.at(-2) : undefined;
  const historical = stoppedBlock?.to === "blocked" ? ` Previous blocker (historical): ${stoppedBlock.why}.` : "";
  return { state: "aborted", reason: `Run stopped.${historical} ${recoveryFor(projection, stoppedBlock?.from)}` };
}

function recoveryFor(projection: Projection, from: LoopState | undefined): string {
  const target = projection.phasePath ?? projection.planPath;
  if (from === "committing") {
    return `Commit checkpoint interrupted. Check the last commit and staged changes; if the previous phase is not committed, stage only intended changes and run /b-commit. Then run /buck-loop ${target}.`;
  }
  if (projection.state === "blocked") {
    return "Resolve the cause (stage only intended changes if unstaged), then /buck-loop --resume.";
  }
  return `To continue, run /buck-loop ${target}.`;
}

/** Mark the saved run aborted. No saved file → no-op idle. */
function stopRun(cwd: string, now: () => string): LoopResult {
  const projection = readProjection(cwd);
  if (!projection) return { state: "idle", reason: "no run to stop" };
  if (projection.state === "aborted") return statusOf(cwd);
  const t = stopFrom(projection.state);
  const snapshot = resume({ projectRoot: cwd });
  persist(cwd, withTransition({
    ...snapshot,
    subject: snapshot.subject ?? projection.subject,
    planPath: snapshot.planPath ?? projection.planPath,
    phasePath: snapshot.phasePath ?? projection.phasePath,
  }, t, now()));
  return statusOf(cwd);
}

/** Scan the operator's path, persist `resolving`, then enter {@link drive}. */
async function startRun(cwd: string, path: string | undefined, deps: LoopDeps): Promise<LoopResult> {
  const refused = refuseProtectedBranch(cwd, "start") ?? await refuseDirtyWorkspace(cwd, "start", deps);
  if (refused) return refused;
  const target = path?.trim() ?? "";
  if (!target) return { state: "idle", reason: "path is required to start" };
  syncCheckedPhasesAt(cwd, target, deps.now().slice(0, 10));
  const scanned = scan({ projectRoot: cwd, path: target, state: "resolving" });
  const snapshot: Snapshot = {
    state: "resolving",
    subject: scanned.subject,
    planPath: scanned.planPath,
    phasePath: scanned.phasePath,
    planFacts: scanned.planFacts,
    workFacts: scanned.workFacts,
    reviewFacts: scanned.reviewFacts,
    loopCount: 0,
    maxLoops: 12,
    iterateCyclesOnPhase: 0,
    lastChoice: null,
    history: [{ from: "idle", to: "resolving", at: deps.now(), why: start().why }],
  };
  persistIfPossible(cwd, snapshot);
  return drive(cwd, snapshot, target, deps);
}

/**
 * Reload the saved run, rescan disk (artifacts win), and continue.
 * A blocked run whose plan is still present is treated as USER_CONFIRMED.
 */
async function resumeRun(cwd: string, deps: LoopDeps): Promise<LoopResult> {
  const protectedBranch = refuseProtectedBranch(cwd, "resume");
  if (protectedBranch) return protectedBranch;
  const projection = readProjection(cwd);
  if (!projection) return idleOrUnreadableProjection(cwd);
  if (projection.state === "aborted") return statusOf(cwd);
  const dirty = await refuseDirtyWorkspace(cwd, "resume", deps, projection);
  if (dirty) return dirty;
  const resumeTarget = resumePath(projection, projection.subject);
  syncCheckedPhasesAt(cwd, resumeTarget, deps.now().slice(0, 10));
  let snapshot = resume({ projectRoot: cwd });
  snapshot = confirmBlockedResume(cwd, projection, snapshot, deps.now());
  const checked = await checkedResume(cwd, snapshot, deps.now());
  if ("result" in checked) return checked.result;
  snapshot = checked.snapshot;
  const path = resumePath(snapshot, projection.subject);
  return drive(cwd, snapshot, path, deps);
}

function resumePath(snapshot: Pick<Snapshot, "phasePath" | "planPath">, subject: string): string {
  return snapshot.phasePath ?? snapshot.planPath ?? join(".context", subject);
}

async function checkedResume(cwd: string, snapshot: Snapshot, at: string): Promise<{ snapshot: Snapshot } | { result: LoopResult }> {
  const reconciled = await reconcileSqlSave(cwd, snapshot, at);
  if (reconciled.state !== "blocked" || snapshot.state === "blocked") return { snapshot: reconciled };
  persistIfPossible(cwd, reconciled);
  return { result: { state: "blocked", reason: reconciled.history.at(-1)?.why ?? "SQL save was not verified" } };
}

function idleOrUnreadableProjection(cwd: string): LoopResult {
  if (existsSync(join(cwd, ".context/workflow/buck-loop.json"))) {
    return { state: "blocked", reason: "unreadable projection" };
  }
  return { state: "idle", reason: "no projection to resume" };
}

function confirmBlockedResume(cwd: string, projection: Projection, snapshot: Snapshot, at: string): Snapshot {
  if (projection.state !== "blocked" || snapshot.state !== "blocked") {
    return snapshot;
  }
  if (
    snapshot.planFacts.kind === "missing" ||
    snapshot.planPath !== projection.planPath ||
    snapshot.phasePath !== projection.phasePath
  ) {
    persistIfPossible(cwd, snapshot);
    return snapshot;
  }
  const confirmed = withTransition(snapshot, userConfirmed(snapshot), at);
  persistIfPossible(cwd, confirmed);
  return confirmed;
}


/**
 * The actual loop. Ask the machine, persist, run the effect, rescan, repeat.
 * `SAFETY_TICK_CEILING` is a last-ditch halt if the machine ever livelocks.
 */
async function drive(cwd: string, initial: Snapshot, path: string, deps: LoopDeps): Promise<LoopResult> {
  let snapshot = initial;
  let lastFail: string | null = null;
  let lastReport = "";
  for (let tick = 0; tick < SAFETY_TICK_CEILING; tick += 1) {
    const stopped = haltIfTerminal(cwd, snapshot);
    if (stopped) return stopped;
    const wasSaving = snapshot.state === "saving";
    const step = takeStep(snapshot, lastFail, deps.now());
    snapshot = step.snapshot;
    const preparationFailure = persistSaveTransition(cwd, snapshot, step.transition, wasSaving);
    if (preparationFailure) return preparationFailure;
    if (step.halt) {
      const recovered = await recoverBlocked(cwd, snapshot, step.halt, deps);
      if (recovered.halt) return haltInCycleBlock(cwd, snapshot, recovered.halt);
      snapshot = recovered.snapshot;
      continue;
    }
    const ran = await runEffect(cwd, snapshot, path, step.transition, deps, lastReport);
    snapshot = ran.snapshot;
    lastFail = ran.lastFail ?? lastFail;
    lastReport = ran.sessionText;
    persistIfPossible(cwd, snapshot);
    if (ran.halt) {
      const handled = await handleEffectHalt(cwd, snapshot, ran, deps);
      if (handled.result) return handled.result;
      snapshot = handled.snapshot;
      continue;
    }
  }
  const reason = `supervisor safety ceiling (${SAFETY_TICK_CEILING} ticks)`;
  snapshot = block(snapshot, reason, deps.now());
  return haltInCycleBlock(cwd, snapshot, { state: "blocked", reason });
}

async function handleEffectHalt(cwd: string, snapshot: Snapshot, ran: EffectResult, deps: LoopDeps): Promise<{ snapshot: Snapshot; result: LoopResult | null }> {
  if (ran.mandatoryStop) return { snapshot, result: ran.halt };
  const recovered = await recoverBlocked(cwd, snapshot, ran.halt!, deps);
  if (recovered.halt) return { snapshot, result: haltInCycleBlock(cwd, snapshot, recovered.halt) };
  return { snapshot: recovered.snapshot, result: null };
}

function persistSaveTransition(cwd: string, snapshot: Snapshot, transition: Transition, retry: boolean): LoopResult | null {
  const reason = prepareProjectedSave(cwd, transition, snapshot, retry);
  if (reason) return haltInCycleBlock(cwd, snapshot, { state: "blocked", reason });
  persistIfPossible(cwd, snapshot);
  return null;
}

function haltIfTerminal(cwd: string, snapshot: Snapshot): LoopResult | null {
  if (!isTerminal(snapshot.state)) return null;
  persistIfPossible(cwd, snapshot);
  return { state: snapshot.state, reason: lastWhyFromSnapshot(snapshot) };
}

/** Ask the machine for the next edge. Illegal `next()` or `await-operator` halt the run. */
function takeStep(
  snapshot: Snapshot,
  lastFail: string | null,
  at: string,
): { snapshot: Snapshot; transition: Transition; halt: LoopResult | null } {
  let transition: Transition;
  try {
    transition = next(snapshot);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { snapshot: block(snapshot, reason, at), transition: unusedTransition(), halt: { state: "blocked", reason } };
  }
  transition = annotateFailure(transition, lastFail);
  const nextSnapshot = withTransition(snapshot, transition, at);
  if (transition.effect.kind === "await-operator") {
    return { snapshot: nextSnapshot, transition, halt: { state: "blocked", reason: transition.effect.reason } };
  }
  return { snapshot: nextSnapshot, transition, halt: null };
}

function annotateFailure(transition: Transition, lastFail: string | null): Transition {
  if (transition.effect.kind !== "await-operator" || !lastFail) return transition;
  const reason = `${transition.why} (${lastFail})`;
  return { ...transition, why: reason, effect: { kind: "await-operator", reason } };
}

function unusedTransition(): Transition {
  return { to: "blocked", effect: { kind: "none" }, why: "unused" };
}

/** Perform `choose` or `run-skill`. `none` is a no-op this tick. */
async function runEffect(
  cwd: string,
  snapshot: Snapshot,
  path: string,
  transition: Transition,
  deps: LoopDeps,
  sessionText: string,
): Promise<EffectResult & { sessionText: string }> {
  if (transition.effect.kind === "choose") {
    if (ambiguousWorkChoice(snapshot, transition.effect.legal)) {
      return carryReport(await resolveAmbiguity(cwd, snapshot, path, transition, deps, sessionText), sessionText);
    }
    return carryReport(await runChoice(cwd, snapshot, path, transition.effect.legal, transition.why, deps), sessionText);
  }
  if (transition.effect.kind !== "run-skill") return carryReport({ snapshot, lastFail: null, halt: null }, sessionText);
  const ran = await executeSkill(cwd, snapshot, path, transition.effect.skill, deps);
  return { snapshot: ran.snapshot, lastFail: ran.failedText, halt: null, sessionText: ran.sessionText };
}

function carryReport(result: EffectResult, sessionText: string): EffectResult & { sessionText: string } {
  return result.sessionText === undefined ? { ...result, sessionText } : { ...result, sessionText: result.sessionText };
}

function ambiguousWorkChoice(snapshot: Snapshot, legal: readonly Choice[]): boolean {
  return snapshot.workFacts.postcondition === "ambiguous"
    && legal.some((choice) => choice.kind === "retry")
    && legal.some((choice) => choice.kind === "advance");
}

async function resolveAmbiguity(
  cwd: string,
  snapshot: Snapshot,
  path: string,
  transition: Transition,
  deps: LoopDeps,
  sessionText: string,
): Promise<EffectResult> {
  const abs = phaseAbs(cwd, snapshot.phasePath ?? snapshot.planPath);
  if (abs && repairCheckedPhase(abs, deps.now())) {
    return { snapshot: rescan(cwd, snapshot, path, { sessionOutcome: "ok", retriesUsed: 0 }), lastFail: null, halt: null };
  }
  const plan = await deps.classifyRepair({ cwd, snapshot, why: transition.why, sessionText });
  if (plan.lift === "heavy") return stopForOperator(cwd, snapshot, plan, abs, deps);
  return retryRepair(cwd, snapshot, path, plan.diagnosis, deps);
}

async function retryRepair(
  cwd: string,
  snapshot: Snapshot,
  path: string,
  diagnosis: string,
  deps: LoopDeps,
): Promise<EffectResult> {
  const beforeRetry = loopExtensionFiles(cwd);
  const retry = applyChoice({ kind: "retry" }, snapshot);
  const ran = await continueChoice(cwd, snapshot, path, retry, deps, diagnosis);
  const changed = changedLoopExtensionFiles(cwd, beforeRetry);
  if (changed.length === 0) return ran;
  return stopForExtensionRestart(cwd, ran.snapshot, changed, deps);
}

function stopForOperator(
  cwd: string,
  snapshot: Snapshot,
  plan: RepairPlan,
  abs: string | null,
  deps: LoopDeps,
): EffectResult {
  const disk = abs ? explainAmbiguity(abs) : transitionWhy(snapshot);
  const reason = `heavy lift: ${plan.reason}. ${plan.diagnosis} ${disk}`;
  deps.onWarning(reason);
  const blocked = block(snapshot, reason, deps.now());
  persistIfPossible(cwd, blocked);
  return { snapshot: blocked, lastFail: null, halt: { state: "blocked", reason }, mandatoryStop: true };
}

const LOOP_EXTENSION_RESTART = "Restart OMP before continuing:";

function stopForExtensionRestart(
  cwd: string,
  snapshot: Snapshot,
  changed: readonly string[],
  deps: LoopDeps,
): EffectResult {
  const reason = `${LOOP_EXTENSION_RESTART} repaired the buck-loop extension, and this session is still running the previous code. Changed: ${changed.join(", ")}`;
  restartRequired.set(cwd, reason);
  deps.onWarning(reason);
  const blocked = block(snapshot, reason, deps.now());
  persistIfPossible(cwd, blocked);
  return { snapshot: blocked, lastFail: null, halt: { state: "blocked", reason }, mandatoryStop: true };
}

function transitionWhy(snapshot: Snapshot): string {
  return snapshot.history.at(-1)?.why ?? "postcondition is ambiguous";
}

async function runChoice(
  cwd: string,
  snapshot: Snapshot,
  path: string,
  legal: readonly Choice[],
  why: string,
  deps: LoopDeps,
): Promise<EffectResult> {
  emitProgress(deps, {
    state: snapshot.state,
    operation: "choose",
    label: "Resolving " + snapshot.state + " decision",
    target: snapshot.phasePath ?? snapshot.planPath ?? path,
  });
  const chosen = await chooseSafely(cwd, snapshot, legal, why, deps);
  reportChoiceFailure(snapshot, chosen, deps);
  const applied = applyChosen(snapshot, chosen, deps.now());
  persistIfPossible(cwd, applied.snapshot);
  if (applied.stop) {
    return { snapshot: applied.snapshot, lastFail: null, halt: { state: applied.snapshot.state, reason: applied.reason } };
  }
  return continueChoice(cwd, applied.snapshot, path, applied.next, deps);
}

async function chooseSafely(
  cwd: string,
  snapshot: Snapshot,
  legal: readonly Choice[],
  why: string,
  deps: LoopDeps,
): Promise<ChooseResult> {
  try {
    return await deps.choose({
      cwd,
      subject: snapshot.subject ?? "unknown",
      legal,
      context: decisionContext(snapshot, why),
      onActivity: deps.onActivity,
      ...(deps.availableIds ? { availableIds: deps.availableIds } : {}),
    });
  } catch (error) {
    return {
      status: "blocked",
      reason: error instanceof Error ? error.message : String(error),
      failure: { prompt: null, agent: null, error: serializeCallError(error) },
    };
  }
}

function reportChoiceFailure(snapshot: Snapshot, chosen: ChooseResult, deps: LoopDeps): void {
  if (chosen.status !== "blocked" || !chosen.failure) return;
  emitFailure(deps, enrichFailure(snapshot, "choose", "Choose the next legal transition", chosen.failure));
}

async function continueChoice(
  cwd: string,
  snapshot: Snapshot,
  path: string,
  transition: Transition,
  deps: LoopDeps,
  handoff?: string,
): Promise<EffectResult> {
  const nextSnapshot = withTransition(snapshot, transition, deps.now());
  const savePreparation = prepareProjectedSave(cwd, transition, nextSnapshot, snapshot.state === "saving");
  if (savePreparation) {
    const blocked = block(nextSnapshot, savePreparation, deps.now());
    persistIfPossible(cwd, blocked);
    return { snapshot: blocked, lastFail: savePreparation, halt: { state: "blocked", reason: savePreparation } };
  }
  persistIfPossible(cwd, nextSnapshot);
  if (transition.effect.kind !== "run-skill") return { snapshot: nextSnapshot, lastFail: null, halt: null };
  const ran = await executeSkill(cwd, nextSnapshot, path, transition.effect.skill, deps, handoff);
  return { snapshot: ran.snapshot, lastFail: ran.failedText, halt: null, sessionText: ran.sessionText };
}

function applyChosen(
  snapshot: Snapshot,
  chosen: ChooseResult,
  at: string,
): { snapshot: Snapshot; stop: boolean; reason: string; next: Transition } {
  if (chosen.status !== "accepted") {
    const reason = chosen.reason;
    return {
      snapshot: block(snapshot, reason, at),
      stop: true,
      reason,
      next: unusedTransition(),
    };
  }
  const accepted: AcceptedChoice = chosen.accepted;
  const withChoice = { ...snapshot, lastChoice: accepted };
  try {
    const transition = applyChoice(accepted.choice, withChoice);
    return { snapshot: withChoice, stop: false, reason: transition.why, next: transition };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { snapshot: block(snapshot, reason, at), stop: true, reason, next: unusedTransition() };
  }
}

/**
 * Spawn the nested skill, then rescan. Disk facts decide whether the session
 * landed. The child report is kept so an ambiguous stop can be diagnosed.
 */
async function executeSkill(
  cwd: string,
  snapshot: Snapshot,
  path: string,
  skill: WorkSkill,
  deps: LoopDeps,
  handoff?: string,
): Promise<{ snapshot: Snapshot; failedText: string | null; sessionText: string }> {
  const planOrPhasePath = snapshot.phasePath ?? snapshot.planPath ?? path;
  const nested = nestedSkill(cwd, skill, snapshot);
  const reviewArtifactsBefore = skill === "review" ? snapshotReviewArtifacts(cwd, snapshot) : null;
  emitProgress(deps, {
    state: snapshot.state,
    operation: "run-skill",
    label: progressLabel(snapshot.state, planOrPhasePath),
    target: planOrPhasePath,
  });

  const opened = await openSqlSave(cwd, snapshot, skill);
  if (opened.block) {
    return { snapshot: block(snapshot, opened.block, deps.now()), failedText: opened.block, sessionText: opened.block };
  }
  const result = await runNestedSkill(cwd, snapshot, skill, nested, planOrPhasePath, deps, handoff, opened.directive);
  reportSkillFailure(snapshot, nested, planOrPhasePath, result, deps);
  recordReviewArtifact(cwd, snapshot, skill, result, deps.now(), reviewArtifactsBefore);
  const retriesUsed = nextRetries(snapshot, result.ok);
  const saveCheck = await finishSqlSave(cwd, snapshot, skill);
  if (saveCheck.status === "block") {
    return { snapshot: block(snapshot, saveCheck.reason, deps.now()), failedText: saveCheck.reason, sessionText: result.text };
  }
  syncCheckedPhasesAt(cwd, planOrPhasePath, deps.now().slice(0, 10));
  const scanned = rescan(cwd, snapshot, path, {
    sessionOutcome: result.ok ? "ok" : "failed",
    retriesUsed,
    sqlSaveVerified: saveCheck.status === "verified",
  });
  return finishSkill(cwd, scanned, skill, planOrPhasePath, result.ok, result.text, retriesUsed);
}

async function openSqlSave(cwd: string, snapshot: Snapshot, skill: WorkSkill): Promise<{ directive?: string; block?: string }> {
  if (skill !== "save" || !sqlMode()) return {};
  const probe = await probeSql();
  if (probe.status === "block") return { block: probe.reason };
  if (!snapshot.subject) return { block: "SQL save has no subject; refusing to save." };
  const prepared = prepareSaveAttempt(cwd, snapshot.subject, true, snapshot.phasePath);
  if ("error" in prepared) return { block: prepared.error };
  if (prepared.attemptId !== snapshot.saveAttemptId) return { block: "SQL save attempt differs from the projected transition." };
  return { directive: saveDirective(prepared) };
}

/** Attempt creation precedes the durable saving transition; retries keep the run source key. */
function prepareProjectedSave(cwd: string, transition: Transition, snapshot: Snapshot, retry: boolean): string | null {
  if (!sqlMode() || transition.to !== "saving" || transition.effect.kind !== "run-skill"
    || transition.effect.skill !== "save") return null;
  if (!snapshot.subject) return "SQL save has no subject; refusing to save.";
  const attempt = prepareSaveAttempt(cwd, snapshot.subject, retry, snapshot.phasePath);
  if ("error" in attempt) return attempt.error;
  snapshot.saveAttemptId = attempt.attemptId;
  return null;
}

async function finishSqlSave(cwd: string, snapshot: Snapshot, skill: WorkSkill) {
  if (skill !== "save" || !sqlMode()) return { status: "skip" as const };
  return verifySqlSave(cwd, snapshot.subject, undefined, true, snapshot.saveAttemptId);
}

async function reconcileSqlSave(cwd: string, snapshot: Snapshot, at: string): Promise<Snapshot> {
  if (!sqlMode() || (snapshot.state !== "saving" && snapshot.state !== "committing")) return snapshot;
  const check = await verifySqlSave(cwd, snapshot.subject, undefined, true, snapshot.saveAttemptId);
  if (resumeSaveDecision(snapshot.state, check) === "block") {
    const reason = check.status === "block"
      ? check.reason
      : "SQL save receipt does not match the current attempt; refusing to commit.";
    return block(snapshot, reason, at);
  }
  if (check.status !== "verified") return {
    ...snapshot,
    workFacts: { sessionOutcome: "pending", retriesUsed: 0, postcondition: "pending" },
  };
  return confirmedResume(cwd, snapshot);
}

function confirmedResume(cwd: string, snapshot: Snapshot): Snapshot {
  if (snapshot.state === "saving") {
    return { ...snapshot, workFacts: { sessionOutcome: "ok", retriesUsed: 0, postcondition: "confirmed" } };
  }
  const path = snapshot.phasePath ?? snapshot.planPath;
  if (!path) return snapshot;
  const scanned = rescan(cwd, snapshot, path, { sessionOutcome: "ok", retriesUsed: 0 });
  return scanned.workFacts.postcondition === "confirmed" ? scanned : snapshot;
}

async function runNestedSkill(
  cwd: string,
  snapshot: Snapshot,
  skill: WorkSkill,
  nested: NestedSkill,
  planOrPhasePath: string,
  deps: LoopDeps,
  handoff?: string,
  directive?: string,
): Promise<RunStepResult> {
  try {
    if (skill === "commit") prepareCommitCheckpoint(cwd);
    const difficulty = difficultyLabel(cwd, snapshot);
    const memoryContext = skill === "commit" ? null : await recallProjectMemories(cwd, planOrPhasePath);
    if (memoryContext?.kind === "failure") {
      throw new Error(memoryContext.reason);
    }
    if (memoryContext?.kind === "identity-missing") {
      throw new Error(memoryContext.reason);
    }
    const recallHandoff = memoryContext && memoryContext.kind !== "unavailable"
      ? [handoff, formatRecall(memoryContext)].filter(Boolean).join("\n\n")
      : handoff;
    return await deps.runStep({
      cwd,
      skill: nested,
      planOrPhasePath,
      ...(difficulty ? { difficulty } : {}),
      ...(recallHandoff ? { handoff: recallHandoff } : {}),
      ...(directive ? { directive } : {}),
      ...(deps.onActivity ? { onActivity: deps.onActivity } : {}),
      ...(deps.availableIds ? { availableIds: deps.availableIds } : {}),
    });
  } catch (error) {
    return {
      ok: false,
      text: error instanceof Error ? error.message : String(error),
      failure: { prompt: null, agent: null, error: serializeCallError(error) },
    };
  }
}

function reportSkillFailure(
  snapshot: Snapshot,
  nested: NestedSkill,
  planOrPhasePath: string,
  result: RunStepResult,
  deps: LoopDeps,
): void {
  if (result.ok) return;
  const failure = result.failure ?? {
    prompt: null,
    agent: null,
    error: serializeCallError({ name: "NestedCallError", message: result.text }),
  };
  emitFailure(deps, enrichFailure(snapshot, "run-skill", "Run " + nested + " for " + planOrPhasePath, failure));
}

function recordReviewArtifact(
  cwd: string,
  snapshot: Snapshot,
  skill: WorkSkill,
  result: RunStepResult,
  at: string,
  before: ReviewArtifactSnapshot | null,
): void {
  if (!result.ok || skill !== "review" || !result.text.trim()) return;
  persistReviewArtifact(cwd, snapshot, result.text, at, before);
}
function progressLabel(state: LoopState, target: string): string {
  const name = basename(target);
  switch (state) {
    case "building": return "Building " + name;
    case "reviewing": return "Reviewing " + name;
    case "iterating": return "Iterating " + name;
    case "documenting": return "Documenting " + name;
    case "saving": return "Saving session state";
    case "committing": return "Committing completed work";
    default: return "Running " + name;
  }
}

function emitProgress(deps: LoopDeps, progress: LoopProgress): void {
  try {
    deps.onProgress(progress);
  } catch {
    // Progress surfaces never control the state machine.
  }
}

function emitFailure(deps: LoopDeps, failure: AgentCallFailure): void {
  try {
    deps.onFailure(failure);
  } catch {
    // Parent-agent handoff is best-effort; the durable blocked state still wins.
  }
}

function enrichFailure(
  snapshot: Snapshot,
  operation: AgentCallFailure["operation"],
  trying: string,
  details: CallFailureDetails,
): AgentCallFailure {
  return { state: snapshot.state, operation, trying, ...details };
}

function refuseProtectedBranch(cwd: string, mode: "start" | "resume"): LoopResult | null {
  const branch = gitLine(cwd, "branch", "--show-current");
  return PROTECTED_BRANCHES[branch]
    ? { state: "blocked", reason: `refusing to ${mode} on protected branch ${branch}` }
    : null;
}

async function refuseDirtyWorkspace(
  cwd: string,
  mode: "start" | "resume",
  deps: LoopDeps,
  projection?: Projection,
): Promise<LoopResult | null> {
  const dirty = nonContextStatus(cwd);
  if (dirty.length === 0) return null;
  if (mode === "resume" && projection && permitsBlockedStagedResume(projection, dirty)) return null;
  deps.onWarning(
    `Working tree has ${dirty.length} change(s) outside .context/. A later commit can stage them.`,
  );
  if (await deps.confirmDirty(dirty)) return null;
  return { state: "aborted", reason: "working tree is dirty; operator did not continue" };
}

async function recoverBlocked(
  cwd: string,
  snapshot: Snapshot,
  halt: LoopResult,
  deps: LoopDeps,
): Promise<{ snapshot: Snapshot; halt: LoopResult | null }> {
  if (halt.state !== "blocked") return { snapshot, halt };
  deps.onWarning(halt.reason);
  if (!(await deps.confirmContinue(halt.reason))) return { snapshot, halt };
  const parked = snapshot.state === "blocked" ? snapshot : block(snapshot, halt.reason, deps.now());
  const continued = withTransition(parked, userConfirmed(parked), deps.now());
  persistIfPossible(cwd, continued);
  return { snapshot: continued, halt: null };
}

function nonContextStatus(cwd: string): string[] {
  return gitOutput(cwd, "status", "--porcelain", "--untracked-files=all")
    .split("\n")
    .filter((line) => line.length >= 4 && !isContextStatus(line));
}

function isContextStatus(line: string): boolean {
  const path = (line.slice(3).split(" -> ").pop() ?? "").replace(/^"|"$/g, "");
  return path === ".context/workflow/buck-loop.json" || path.startsWith(".context/");
}

function permitsBlockedStagedResume(projection: Projection, dirty: readonly string[]): boolean {
  const last = projection.history.at(-1);
  return (
    projection.state === "blocked" &&
    last?.to === "blocked" &&
    IN_CYCLE_WORK_STATES[last.from] === true &&
    dirty.every(isStagedOnly)
  );
}

function isStagedOnly(line: string): boolean {
  const [index, worktree] = line;
  return index !== " " && index !== "?" && worktree === " ";
}

function gitOutput(cwd: string, ...args: string[]): string {
  try {
    return execFileSync("git", ["-C", cwd, ...args], {
      encoding: "utf8",
      timeout: 10_000,
      stdio: ["pipe", "pipe", "pipe"],
    }).replace(/\s+$/, "");
  } catch {
    return "";
  }
}

function gitLine(cwd: string, ...args: string[]): string {
  return gitOutput(cwd, ...args).trim();
}

function decisionContext(snapshot: Snapshot, why: string): string {
  const review = snapshot.reviewFacts.kind === "report"
    ? `parseable=${snapshot.reviewFacts.parseable} docsImpact=${snapshot.reviewFacts.docsImpact} howtoImpact=${snapshot.reviewFacts.howtoImpact}`
    : `review=${snapshot.reviewFacts.kind}`;
  return [
    `state=${snapshot.state}`,
    `phase=${snapshot.phasePath ?? snapshot.planPath ?? ""}`,
    `why=${why}`,
    review,
    `postcondition=${snapshot.workFacts.postcondition}`,
  ].join(" ");
}


function unstagedNonContextStatus(cwd: string): string[] {
  return nonContextStatus(cwd).filter((line) => !isStagedOnly(line));
}

function prepareCommitCheckpoint(cwd: string): void {
  const unstaged = unstagedNonContextStatus(cwd);
  if (unstaged.length > 0) {
    throw new Error(
      "/buck-loop refuses to commit unstaged non-.context changes: " + unstaged.join(", "),
    );
  }
  execFileSync("git", ["add", "-A", "--", ".context"], {
    cwd,
    encoding: "utf8",
    timeout: 10_000,
    stdio: ["pipe", "pipe", "pipe"],
  });
}

function haltInCycleBlock(cwd: string, snapshot: Snapshot, result: LoopResult): LoopResult {
  const last = snapshot.history.at(-1);
  if (snapshot.state === "blocked" && last?.to === "blocked" && IN_CYCLE_WORK_STATES[last.from] === true) {
    const unstaged = unstagedNonContextStatus(cwd);
    if (unstaged.length > 0) {
      const reason = "nested skill left unstaged non-.context changes: " + unstaged.join(", ");
      // Amend the existing in-cycle → blocked transition instead of appending a
      // second blocked → blocked hop: permitsBlockedStagedResume requires the
      // latest transition to start in an in-cycle state, so an extra hop here
      // would permanently strand the staged in-cycle work behind a dirty tree.
      persistIfPossible(cwd, { ...snapshot, history: [...snapshot.history.slice(0, -1), { ...last, why: reason }] });
      return { state: "blocked", reason };
    }
  }
  persistIfPossible(cwd, snapshot);
  return result;
}

function nextRetries(snapshot: Snapshot, ok: boolean): number {
  // Same-state retry keeps the ambiguous facts. A cross-state advance resets them first.
  if (snapshot.workFacts.postcondition === "ambiguous") return snapshot.workFacts.retriesUsed + 1;
  if (ok) return snapshot.workFacts.retriesUsed;
  return snapshot.workFacts.sessionOutcome === "failed" ? snapshot.workFacts.retriesUsed + 1 : 0;
}

function finishSkill(
  cwd: string,
  scanned: Snapshot,
  skill: WorkSkill,
  planOrPhasePath: string,
  ok: boolean,
  text: string,
  retriesUsed: number,
): { snapshot: Snapshot; failedText: string | null; sessionText: string } {
  if (ok && skill === "build" && builtPhaseLanded(cwd, planOrPhasePath, scanned.planFacts.kind)) {
    return {
      snapshot: { ...scanned, workFacts: { sessionOutcome: "ok", retriesUsed, postcondition: "confirmed" } },
      failedText: null,
      sessionText: text,
    };
  }
  return { snapshot: scanned, failedText: ok ? null : text, sessionText: text };
}

type ReviewArtifactSnapshot = Map<string, { text: string; mtimeMs: number }>;

function snapshotReviewArtifacts(cwd: string, snapshot: Snapshot): ReviewArtifactSnapshot {
  const artifacts: ReviewArtifactSnapshot = new Map();
  if (!snapshot.subject) return artifacts;
  const dir = join(cwd, ".context", snapshot.subject);
  if (!existsSync(dir)) return artifacts;
  for (const name of readdirSync(dir).filter((entry) => /^review-(?!zz-buck-loop-).*\.md$/.test(entry)).sort()) {
    const abs = join(dir, name);
    artifacts.set(name, { text: readFileSync(abs, "utf8"), mtimeMs: statSync(abs).mtimeMs });
  }
  return artifacts;
}

function persistReviewArtifact(
  cwd: string,
  snapshot: Snapshot,
  text: string,
  at: string,
  before: ReviewArtifactSnapshot | null,
): void {
  if (!snapshot.subject || !text.trim()) return;
  const dir = join(cwd, ".context", snapshot.subject);
  mkdirSync(dir, { recursive: true });
  const changedArtifact = before
    ? [...snapshotReviewArtifacts(cwd, snapshot)].filter(([name, current]) => {
        const previous = before.get(name);
        return !previous || previous.text !== current.text || previous.mtimeMs !== current.mtimeMs;
      }).at(-1)?.[1].text
    : undefined;
  const authoritative = changedArtifact ?? text;
  if (!authoritative.trim()) return;
  const stamp = at.replace(/[:.]/g, "-");
  writeFileSync(join(dir, `review-zz-buck-loop-${stamp}.md`), authoritative.endsWith("\n") ? authoritative : `${authoritative}\n`);
}

function builtPhaseLanded(cwd: string, planOrPhasePath: string, planKind: Snapshot["planFacts"]["kind"]): boolean {
  if (planKind === "phased-complete" || planKind === "unphased") return true;
  const abs = resolve(cwd, planOrPhasePath);
  return existsSync(abs) && /^status:\s*completed\s*$/m.test(readFileSync(abs, "utf8"));
}

/**
 * Re-read plan/review files after a nested session. While `FROZEN_PHASE`
 * holds, keep the same `phasePath` so a mid-cycle rescan cannot jump phases.
 */
function rescan(
  cwd: string,
  snapshot: Snapshot,
  path: string,
  work: { sessionOutcome: Snapshot["workFacts"]["sessionOutcome"]; retriesUsed: number; sqlSaveVerified?: boolean },
): Snapshot {
  const scanPath = snapshot.phasePath ?? snapshot.planPath ?? path;
  const scanned = scan({
    projectRoot: cwd,
    path: scanPath,
    state: snapshot.state,
    sessionOutcome: work.sessionOutcome,
    retriesUsed: work.retriesUsed,
    ...(work.sqlSaveVerified ? { sqlSaveVerified: true } : {}),
  });
  const phasePath = FROZEN_PHASE.has(snapshot.state) ? snapshot.phasePath ?? scanned.phasePath : scanned.phasePath;
  return {
    ...snapshot,
    subject: scanned.subject,
    planPath: scanned.planPath,
    phasePath,
    planFacts: scanned.planFacts,
    workFacts: scanned.workFacts,
    reviewFacts: scanned.reviewFacts,
    iterateCyclesOnPhase: phasePath === snapshot.phasePath ? snapshot.iterateCyclesOnPhase : 0,
  };
}

/** Map a machine skill to the nested skill name, including build-hard and howto-only docs. */
function nestedSkill(cwd: string, skill: WorkSkill, snapshot: Snapshot): NestedSkill {
  if (skill === "build") return difficultyOf(cwd, snapshot) === "hard" ? "b-build-hard" : "b-build";
  if (skill === "review") return "b-review";
  if (skill === "iterate") return "b-iterate";
  if (skill === "save") return "b-save";
  if (skill === "commit") return "b-commit";
  const howtoOnly =
    snapshot.reviewFacts.kind === "report" && snapshot.reviewFacts.howtoImpact && !snapshot.reviewFacts.docsImpact;
  return howtoOnly ? "b-howto" : "b-docs";
}

/** Phase/plan `difficulty:` frontmatter, else `not-hard`. Selects the nested skill only. */
function difficultyOf(cwd: string, snapshot: Snapshot): PhaseDifficulty {
  return parsePhaseDifficulty(difficultyLabel(cwd, snapshot));
}

/** Raw `difficulty:` value when the key is present. Absent keys are omitted from picker context. */
function difficultyLabel(cwd: string, snapshot: Snapshot): string | undefined {
  const rel = snapshot.phasePath ?? snapshot.planPath;
  if (!rel) return undefined;
  const abs = resolve(cwd, rel);
  if (!existsSync(abs)) return undefined;
  const match = /^difficulty:\s*(.+)\s*$/m.exec(readFileSync(abs, "utf8"));
  const value = match?.[1]?.trim();
  return value ? value : undefined;
}



function withTransition(snapshot: Snapshot, transition: Transition, at: string): Snapshot {
  const record: TransitionRecord = { from: snapshot.state, to: transition.to, at, why: transition.why };
  const crossed = transition.to !== snapshot.state;
  const loopCount =
    transition.to === "building" && crossed ? snapshot.loopCount + 1 : snapshot.loopCount;
  const iterateCyclesOnPhase =
    transition.to === "iterating" && crossed
      ? snapshot.iterateCyclesOnPhase + 1
      : snapshot.iterateCyclesOnPhase;
  return {
    ...snapshot,
    state: transition.to,
    workFacts: crossed
      ? { sessionOutcome: "pending", retriesUsed: 0, postcondition: "pending" }
      : snapshot.workFacts,
    loopCount,
    iterateCyclesOnPhase,
    history: [...snapshot.history, record],
  };
}

function block(snapshot: Snapshot, reason: string, at: string): Snapshot {
  return withTransition(snapshot, { to: "blocked", effect: { kind: "await-operator", reason }, why: reason }, at);
}

function persistIfPossible(cwd: string, snapshot: Snapshot): void {
  if (snapshot.subject && snapshot.planPath) persist(cwd, snapshot);
}

function persist(cwd: string, snapshot: Snapshot): void {
  if (!snapshot.subject || !snapshot.planPath) return;
  const projection: Projection = {
    version: PROJECTION_VERSION,
    state: snapshot.state,
    subject: snapshot.subject,
    planPath: snapshot.planPath,
    phasePath: snapshot.phasePath,
    saveAttemptId: snapshot.saveAttemptId ?? null,
    loopCount: snapshot.loopCount,
    iterateCyclesOnPhase: snapshot.iterateCyclesOnPhase,
    maxLoops: snapshot.maxLoops,
    lastChoice: snapshot.lastChoice,
    history: snapshot.history,
  };
  writeProjection(cwd, projection);
}

function isTerminal(state: LoopState): boolean {
  return state === "done" || state === "blocked" || state === "aborted";
}

function lastWhy(projection: Projection): string | undefined {
  return projection.history[projection.history.length - 1]?.why;
}

function lastWhyFromSnapshot(snapshot: Snapshot): string {
  return snapshot.history[snapshot.history.length - 1]?.why ?? snapshot.state;
}
