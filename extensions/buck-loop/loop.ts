/**
 * Supervisor: the while-loop that drives `/buck-loop`.
 *
 * This file is the only one that **does work**. Everything else either
 * describes work (`table.ts`) or performs one isolated job (`run-step.ts`,
 * `choice.ts`, `scan.ts`, `persist.ts`).
 *
 * Each tick:
 *
 * 1. If the snapshot is already `done` / `blocked` / `aborted`, stop.
 * 2. Ask {@link next} (the pure table) for a {@link Transition}.
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
import type { ActivityEvent } from "../extension-activity.js";
import {
  PROJECTION_VERSION,
  readProjection,
  resume,
  writeProjection,
  type Projection,
} from "./persist.js";
import { runStep as defaultRunStep, type NestedSkill, type RunStepResult } from "./run-step.js";
import { serializeCallError, type AgentCallFailure, type CallFailureDetails } from "./call-failure.js";
import { scan } from "./scan.js";
import { applyChoice, next, start, stopFrom, userConfirmed } from "./table.js";
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

/** Hard cap on supervisor ticks in one invocation, independent of `maxLoops`. */
const SAFETY_TICK_CEILING = 64;

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
};

type EffectResult = {
  snapshot: Snapshot;
  lastFail: string | null;
  halt: LoopResult | null;
};

const DEFAULT_DEPS: LoopDeps = {
  runStep: defaultRunStep,
  choose: defaultChoose,
  now: () => new Date().toISOString(),
  onProgress: () => undefined,
  onFailure: () => undefined,
  onActivity: () => undefined,
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
  if (opts.command === "start") return startRun(cwd, opts.path, deps);
  return resumeRun(cwd, deps);
}

/** Read the saved run file. Missing → `idle`; unreadable → `blocked`. */
export function statusOf(cwd: string): LoopResult {
  const projectionFile = join(cwd, ".context/workflow/buck-loop.json");
  const projection = readProjection(cwd);
  if (!projection) return existsSync(projectionFile)
    ? { state: "blocked", reason: "unreadable projection" }
    : { state: "idle", reason: "no projection" };
  return { state: projection.state, reason: lastWhy(projection) ?? `projection is ${projection.state}` };
}

/** Mark the saved run `aborted`. No saved file → no-op `idle`. */
function stopRun(cwd: string, now: () => string): LoopResult {
  const projection = readProjection(cwd);
  if (!projection) return { state: "idle", reason: "no run to stop" };
  const t = stopFrom(projection.state);
  const snapshot = resume({ projectRoot: cwd });
  persist(cwd, withTransition(snapshot, t, now()));
  return { state: "aborted", reason: t.why };
}

/** Scan the operator's path, persist `resolving`, then enter {@link drive}. */
async function startRun(cwd: string, path: string | undefined, deps: LoopDeps): Promise<LoopResult> {
  const refused = refuseUnsafeWorkspace(cwd, "start");
  if (refused) return refused;
  const target = path?.trim() ?? "";
  if (!target) return { state: "idle", reason: "path is required to start" };
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
  const refused = refuseUnsafeWorkspace(cwd, "resume");
  if (refused) return refused;
  const projection = readProjection(cwd);
  if (!projection) return idleOrUnreadableProjection(cwd);
  let snapshot = resume({ projectRoot: cwd });
  snapshot = confirmBlockedResume(cwd, projection, snapshot, deps.now());
  const path = snapshot.phasePath ?? snapshot.planPath ?? join(".context", projection.subject);
  return drive(cwd, snapshot, path, deps);
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
  const confirmed = withTransition(snapshot, userConfirmed(), at);
  persistIfPossible(cwd, confirmed);
  return confirmed;
}


/**
 * The actual loop. Ask the table, persist, run the effect, rescan, repeat.
 * `SAFETY_TICK_CEILING` is a last-ditch halt if the table ever livelocks.
 */
async function drive(cwd: string, initial: Snapshot, path: string, deps: LoopDeps): Promise<LoopResult> {
  let snapshot = initial;
  let lastFail: string | null = null;
  for (let tick = 0; tick < SAFETY_TICK_CEILING; tick += 1) {
    const stopped = haltIfTerminal(cwd, snapshot);
    if (stopped) return stopped;
    const step = takeStep(snapshot, lastFail, deps.now());
    snapshot = step.snapshot;
    persistIfPossible(cwd, snapshot);
    if (step.halt) return step.halt;
    const ran = await runEffect(cwd, snapshot, path, step.transition, deps);
    snapshot = ran.snapshot;
    lastFail = ran.lastFail ?? lastFail;
    persistIfPossible(cwd, snapshot);
    if (ran.halt) return ran.halt;
  }
  const reason = `supervisor safety ceiling (${SAFETY_TICK_CEILING} ticks)`;
  snapshot = block(snapshot, reason, deps.now());
  persistIfPossible(cwd, snapshot);
  return { state: "blocked", reason };
}

function haltIfTerminal(cwd: string, snapshot: Snapshot): LoopResult | null {
  if (!isTerminal(snapshot.state)) return null;
  persistIfPossible(cwd, snapshot);
  return { state: snapshot.state, reason: lastWhyFromSnapshot(snapshot) };
}

/** Ask the table for the next edge. Illegal `next()` or `await-operator` halt the run. */
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
): Promise<EffectResult> {
  if (transition.effect.kind === "choose") {
    return runChoice(cwd, snapshot, path, transition.effect.legal, transition.why, deps);
  }
  if (transition.effect.kind !== "run-skill") return { snapshot, lastFail: null, halt: null };
  const ran = await executeSkill(cwd, snapshot, path, transition.effect.skill, deps);
  return { snapshot: ran.snapshot, lastFail: ran.failedText, halt: null };
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
): Promise<EffectResult> {
  const nextSnapshot = withTransition(snapshot, transition, deps.now());
  persistIfPossible(cwd, nextSnapshot);
  if (transition.effect.kind !== "run-skill") return { snapshot: nextSnapshot, lastFail: null, halt: null };
  const ran = await executeSkill(cwd, nextSnapshot, path, transition.effect.skill, deps);
  return { snapshot: ran.snapshot, lastFail: ran.failedText, halt: null };
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
 * Spawn the nested skill, then rescan. The child's last sentence is ignored;
 * disk facts in the rescan decide whether the session landed.
 */
async function executeSkill(
  cwd: string,
  snapshot: Snapshot,
  path: string,
  skill: WorkSkill,
  deps: LoopDeps,
): Promise<{ snapshot: Snapshot; failedText: string | null }> {
  const planOrPhasePath = snapshot.phasePath ?? snapshot.planPath ?? path;
  const nested = nestedSkill(cwd, skill, snapshot);
  const reviewArtifactsBefore = skill === "review" ? snapshotReviewArtifacts(cwd, snapshot) : null;
  emitProgress(deps, {
    state: snapshot.state,
    operation: "run-skill",
    label: progressLabel(snapshot.state, planOrPhasePath),
    target: planOrPhasePath,
  });

  const result = await runNestedSkill(cwd, snapshot, skill, nested, planOrPhasePath, deps);
  reportSkillFailure(snapshot, nested, planOrPhasePath, result, deps);
  recordReviewArtifact(cwd, snapshot, skill, result, deps.now(), reviewArtifactsBefore);
  const retriesUsed = nextRetries(snapshot, result.ok);
  const scanned = rescan(cwd, snapshot, path, {
    sessionOutcome: result.ok ? "ok" : "failed",
    retriesUsed,
  });
  return finishSkill(cwd, scanned, skill, planOrPhasePath, result.ok, result.text, retriesUsed);
}

async function runNestedSkill(
  cwd: string,
  snapshot: Snapshot,
  skill: WorkSkill,
  nested: NestedSkill,
  planOrPhasePath: string,
  deps: LoopDeps,
): Promise<RunStepResult> {
  try {
    if (skill === "commit") stageCommitWork(cwd);
    return await deps.runStep({
      cwd,
      skill: nested,
      planOrPhasePath,
      difficulty: difficultyOf(cwd, snapshot),
      onActivity: deps.onActivity,
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

function refuseUnsafeWorkspace(cwd: string, mode: "start" | "resume"): LoopResult | null {
  const branch = gitLine(cwd, "branch", "--show-current");
  if (PROTECTED_BRANCHES[branch]) {
    return { state: "blocked", reason: `refusing to ${mode} on protected branch ${branch}` };
  }
  const dirty = gitOutput(cwd, "status", "--porcelain")
    .split("\n")
    .filter((line) => {
      if (line.length < 4) return false;
      const path = (line.slice(3).split(" -> ").pop() ?? "").replace(/^\?\? /, "");
      return path !== ".context/workflow/buck-loop.json" && !path.startsWith(".context/");
    });
  if (dirty.length > 0) {
    return { state: "blocked", reason: "working tree is dirty; commit or stash unrelated changes before /buck-loop" };
  }
  return null;
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


function stageCommitWork(cwd: string): void {
  execFileSync("git", ["add", "-A"], {
    cwd,
    encoding: "utf8",
    timeout: 10_000,
    stdio: ["pipe", "pipe", "pipe"],
  });
}

function nextRetries(snapshot: Snapshot, ok: boolean): number {
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
): { snapshot: Snapshot; failedText: string | null } {
  if (ok && skill === "build" && builtPhaseLanded(cwd, planOrPhasePath, scanned.planFacts.kind)) {
    return {
      snapshot: { ...scanned, workFacts: { sessionOutcome: "ok", retriesUsed, postcondition: "confirmed" } },
      failedText: null,
    };
  }
  return { snapshot: scanned, failedText: ok ? null : text };
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
  work: { sessionOutcome: Snapshot["workFacts"]["sessionOutcome"]; retriesUsed: number },
): Snapshot {
  const scanPath = snapshot.phasePath ?? snapshot.planPath ?? path;
  const scanned = scan({
    projectRoot: cwd,
    path: scanPath,
    state: snapshot.state,
    sessionOutcome: work.sessionOutcome,
    retriesUsed: work.retriesUsed,
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

/** Map a table skill to the nested skill name, including build-hard and howto-only docs. */
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

/** Phase/plan `difficulty:` frontmatter, else `medium`. Selects the child's model. */
function difficultyOf(cwd: string, snapshot: Snapshot): "easy" | "medium" | "hard" {
  const rel = snapshot.phasePath ?? snapshot.planPath;
  if (!rel) return "medium";
  return readDifficulty(resolve(cwd, rel));
}

function readDifficulty(abs: string): "easy" | "medium" | "hard" {
  if (!abs || !existsSync(abs)) return "medium";
  const match = /^difficulty:\s*(easy|medium|hard)\s*$/m.exec(readFileSync(abs, "utf8"));
  return (match?.[1] as "easy" | "medium" | "hard" | undefined) ?? "medium";
}

function withTransition(snapshot: Snapshot, transition: Transition, at: string): Snapshot {
  const record: TransitionRecord = { from: snapshot.state, to: transition.to, at, why: transition.why };
  const loopCount =
    transition.to === "building" && snapshot.state !== "building" ? snapshot.loopCount + 1 : snapshot.loopCount;
  const iterateCyclesOnPhase =
    transition.to === "iterating" && snapshot.state !== "iterating"
      ? snapshot.iterateCyclesOnPhase + 1
      : snapshot.iterateCyclesOnPhase;
  return { ...snapshot, state: transition.to, loopCount, iterateCyclesOnPhase, history: [...snapshot.history, record] };
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
