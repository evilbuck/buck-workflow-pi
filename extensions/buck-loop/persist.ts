/**
 * Adapter-backed bookmark and resume reconciliation.
 *
 * The retained checkpoint records subject, phase, counters and last choice.
 * On resume, visible plan/review artifacts win over that bookmark. Unsafe
 * disagreement (done versus incomplete, or a vanished subject) blocks.
 *
 * `.context/workflow/buck-loop.json` is an optional, gitignored export.
 * Missing rows and service failures never fall back to that local file.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, realpathSync, renameSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { consumerKey, scheduleConfiguredRetain } from "../../skills/_shared/storage/consumers.js";
import { resolveConsumerContext, withBoundStore } from "../../skills/_shared/scripts/workflow-state.js";
import { acceptanceCriteria, phaseIsDone } from "./phase-completion.js";
import { scan, scanDocuments, readLoopDocuments, type ScanResult } from "./scan.js";
import type { AcceptedChoice, Choice, CommitCheckpoint, LoopState, Snapshot, TransitionRecord } from "./types.js";
import { unphasedBlockReason } from "./machine.js";

export const PROJECTION_RELPATH = ".context/workflow/buck-loop.json";
export const PROJECTION_VERSION = 1 as const;
const DEFAULT_MAX_LOOPS = 12;

const LOOP_STATES: Record<LoopState, true> = {
  idle: true,
  resolving: true,
  building: true,
  reviewing: true,
  ranking: true,
  iterating: true,
  documenting: true,
  saving: true,
  committing: true,
  repairing: true,
  blocked: true,
  done: true,
  aborted: true,
};

const CHOICE_KINDS: Record<Choice["kind"], true> = {
  iterate: true,
  document: true,
  save: true,
  retry: true,
  advance: true,
  block: true,
};

/** Retained bookmark. `version` must equal {@link PROJECTION_VERSION} or resume treats it as unreadable. */
export type Projection = {
  version: typeof PROJECTION_VERSION;
  state: LoopState;
  subject: string;
  planPath: string;
  phasePath: string | null;
  saveAttemptId?: string | null;
  commitCheckpoint?: Snapshot["commitCheckpoint"];
  loopCount: number;
  iterateCyclesOnPhase: number;
  maxLoops: number;
  lastChoice: AcceptedChoice | null;
  history: TransitionRecord[];
};

export type ResumeOptions = {
  projectRoot: string;
  path?: string;
};

const preparedProjectionRoots = new Set<string>();

/**
 * Make the projection locally gitignored (`.git/info/exclude`) and drop it
 * from the index if it was ever tracked. Non-git trees still get a file.
 */
function prepareProjectionPath(projectRoot: string): void {
  const root = resolve(projectRoot);
  if (preparedProjectionRoots.has(root)) return;
  preparedProjectionRoots.add(root);
  try {
    const gitPath = execFileSync("git", ["rev-parse", "--git-path", "info/exclude"], {
      cwd: root,
      encoding: "utf8",
      timeout: 10_000,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    const excludePath = resolve(root, gitPath);
    mkdirSync(dirname(excludePath), { recursive: true });
    const existing = existsSync(excludePath) ? readFileSync(excludePath, "utf8") : "";
    if (!existing.split(/\r?\n/).includes(PROJECTION_RELPATH)) {
      appendFileSync(excludePath, (existing && !existing.endsWith("\n") ? "\n" : "") + PROJECTION_RELPATH + "\n");
    }
    execFileSync("git", ["rm", "--cached", "-f", "--quiet", "--ignore-unmatch", "--", PROJECTION_RELPATH], {
      cwd: root,
      encoding: "utf8",
      timeout: 10_000,
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch {
    process.stderr.write(
      `buck-loop: projection hygiene skipped for ${root}; ${PROJECTION_RELPATH} may be committed if staged\n`,
    );
  }
}

/** Retain the bookmark before writing its optional local export. */
export async function writeProjection(projectRoot: string, projection: Projection): Promise<void> {
  const body = `${JSON.stringify(projection, null, 2)}\n`;
  await scheduleConfiguredRetain({
    kind: "checkpoint", subjectId: "buck-loop", logicalName: "workflow/buck-loop.json",
    bytes: new TextEncoder().encode(body), cwd: resolve(projectRoot), source: "buck-loop",
  });
  prepareProjectionPath(projectRoot);
  const abs = join(resolve(projectRoot), PROJECTION_RELPATH);
  const temporary = `${abs}.${process.pid}.tmp`;
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(temporary, body, "utf8");
  renameSync(temporary, abs);
}

/** Missing row is absent; invalid retained bytes are unreadable. Never read an export. */
async function readProjectionBody(projectRoot: string): Promise<string | null> {
  const root = resolve(projectRoot);
  const context = await resolveConsumerContext(root);
  return withBoundStore(root, context, async (store) => {
    if (!context.worktreeId || !context.runId) throw new Error("Trusted worktree/run identity is not bound");
    const found = await store.read(consumerKey({ ...context, worktreeId: context.worktreeId, runId: context.runId }, "checkpoint", "buck-loop", "workflow/buck-loop.json"));
    return found ? new TextDecoder().decode(found.bytes) : null;
  });
}

export async function readProjection(projectRoot: string): Promise<Projection | null> {
  const raw = await readProjectionBody(projectRoot);
  if (raw === null) return null;
  try { return normalizeProjection(JSON.parse(raw)); }
  catch { return null; }
}


/**
 * Rebuild a {@link Snapshot} for `--resume`.
 *
 * No retained row → `idle` (or `resolving` with an explicit path). Invalid
 * retained bytes → `blocked`. Service failures propagate, never become idle.
 */
export async function resume(opts: ResumeOptions): Promise<Snapshot> {
  const root = resolve(opts.projectRoot);
  const raw = await readProjectionBody(root);
  if (raw === null) {
    if (!opts.path) return baseSnapshot("idle", "no projection to resume");
    return fromScan(await scan({ projectRoot: root, path: opts.path, state: "resolving" }), {
      state: "resolving",
    });
  }
  let projection: Projection | null;
  try { projection = normalizeProjection(JSON.parse(raw)); }
  catch { projection = null; }
  if (!projection) return baseSnapshot("blocked", "unreadable projection");
  return reconcile(root, projection, opts.path);
}

/**
 * Merge bookmark + live scan. Subject gone or "done vs incomplete phase"
 * is unsafe → `blocked`. Stale `building` + all phases complete → `done`.
 */
async function reconcile(root: string, projection: Projection, pathOverride?: string): Promise<Snapshot> {
  const documents = await readLoopDocuments(root);
  const subjectDir = join(root, ".context", projection.subject);
  if (![...documents.keys()].some((abs) => abs.startsWith(`${subjectDir}/`))) {
    return baseSnapshot("blocked", `subject vanished: ${projection.subject}`, {
      subject: projection.subject,
      planPath: projection.planPath,
      phasePath: projection.phasePath,
      ...counters(projection),
    });
  }
  const scanned = scanDocuments({
    projectRoot: root,
    path: projection.commitCheckpoint?.targetPath ?? pathOverride ?? (documents.has(resolve(root, projection.planPath)) ? projection.planPath : join(".context", projection.subject)),
    state: projection.state,
  }, documents);
  return reconcileCheckpointOrArtifacts(root, projection, scanned, documents);
}

function reconcileCheckpointOrArtifacts(root: string, projection: Projection, scanned: ScanResult, documents: ReadonlyMap<string, string>): Snapshot {
  return reconcileCommit(root, projection, scanned) ??
    reconcileCloseout(projection, scanned) ??
    keepCompletedProjectedPhase(root, projection, scanned, documents) ??
    reconcileScanned(projection, scanned);
}

function reconcileScanned(projection: Projection, scanned: ScanResult): Snapshot {
  return fromScan(scanned, {
    state: staleBuildingComplete(projection, scanned) ? "done" : projection.state,
    ...counters(projection),
    iterateCyclesOnPhase: scanned.phasePath === projection.phasePath ? projection.iterateCyclesOnPhase : 0,
  });
}

function interruptedCommit(projection: Projection): boolean {
  return projection.state === "committing" ||
    (projection.state === "blocked" && projection.history.at(-1)?.from === "committing");
}

function reconcileCommit(root: string, projection: Projection, scanned: ScanResult): Snapshot | null {
  if (!needsCommitRecovery(projection)) return null;
  const owned = projection.commitCheckpoint ? checkpointOwned(root, projection, scanned) : false;
  const why = owned ? "interrupted commit checkpoint; explicit resume required" : "missing or inconsistent commit checkpoint; manual recovery required";
  return fromScan(scanned, {
    ...counters(projection),
    subject: projection.subject,
    planPath: projection.planPath,
    phasePath: projection.phasePath,
    state: "blocked",
    planFacts: owned ? scanned.planFacts : { kind: "missing", reason: why },
    history: [...projection.history, { from: "committing", to: "blocked", at: projection.history.at(-1)?.at ?? new Date().toISOString(), why }],
  });
}

function needsCommitRecovery(projection: Projection): boolean {
  if (projection.commitCheckpoint) return true;
  return !isUnphasedCloseoutProjection(projection) && interruptedCommit(projection);
}

function checkpointOwned(root: string, projection: Projection, scanned: ScanResult): boolean {
  const checkpoint = projection.commitCheckpoint!;
  const prefix = `.context/${projection.subject}/`;
  const paths = [projection.planPath, checkpoint.targetPath];
  const canonical = paths.every((path) => path.startsWith(prefix) && path === join(".context", projection.subject, path.slice(prefix.length)) && !path.slice(prefix.length).includes("/"));
  return canonical && canonicalDiskPaths(root, paths) &&
    scanned.subject === projection.subject && scanned.planPath === projection.planPath;
}

function canonicalDiskPaths(root: string, paths: string[]): boolean {
  try {
    const realRoot = realpathSync(root);
    return paths.every((path) => !existsSync(resolve(root, path)) || realpathSync(resolve(root, path)) === resolve(realRoot, path));
  } catch { return false; }
}

/** Only terminal closeout attempts bypass ordinary blocked-work recovery. */
export function isUnphasedCloseoutProjection(projection: Pick<Projection, "state" | "history">): boolean {
  return projection.state === "done" ||
    (projection.state === "blocked" && (projection.history.at(-1)?.why ?? "").startsWith("unphased plan"));
}

function reconcileCloseout(projection: Projection, scanned: ScanResult): Snapshot | null {
  if (!isUnphasedCloseoutProjection(projection)) return null;
  if (scanned.planFacts.kind === "unphased" && !scanned.planFacts.closeEligible) {
    const snapshot = fromScan(scanned, { state: "blocked", ...counters(projection) });
    const why = unphasedBlockReason(snapshot);
    return { ...snapshot, history: [...snapshot.history, { from: projection.state, to: "blocked", at: projection.history.at(-1)?.at ?? new Date().toISOString(), why }] };
  }
  if (projection.state === "done" && scanned.planFacts.kind === "phased-incomplete") {
    return fromScan(scanned, {
      state: "blocked",
      planFacts: { kind: "missing", reason: "projection claims done but an incomplete phase exists" },
      ...counters(projection),
    });
  }
  return null;
}


function keepCompletedProjectedPhase(
  root: string,
  projection: Projection,
  scanned: ScanResult,
  documents: ReadonlyMap<string, string>,
): Snapshot | null {
  if (staleBuildingComplete(projection, scanned)) return null;
  if (scanned.phasePath === projection.phasePath) return null;
  if (!projection.phasePath) return null;
  const text = documents.get(resolve(root, projection.phasePath));
  if (text === undefined || !phaseIsDone(/^status:\s*(.*)$/m.exec(text)?.[1]?.trim() ?? null, acceptanceCriteria(text))) return null;
  return fromScan(scanned, {
    state: projection.state,
    phasePath: projection.phasePath,
    workFacts: { sessionOutcome: "ok", retriesUsed: 0, postcondition: "confirmed" },
    ...counters(projection),
    iterateCyclesOnPhase: projection.iterateCyclesOnPhase,
  });
}


function staleBuildingComplete(projection: Projection, scanned: ScanResult): boolean {
  return projection.state === "building" && scanned.planFacts.kind === "phased-complete";
}


function counters(projection: Projection): Pick<
  Snapshot,
  "loopCount" | "maxLoops" | "iterateCyclesOnPhase" | "lastChoice" | "history" | "saveAttemptId" | "commitCheckpoint"
> {
  return {
    loopCount: projection.loopCount,
    maxLoops: projection.maxLoops,
    iterateCyclesOnPhase: projection.iterateCyclesOnPhase,
    lastChoice: projection.lastChoice,
    history: projection.history,
    saveAttemptId: projection.saveAttemptId ?? null,
    commitCheckpoint: projection.commitCheckpoint ?? null,
  };
}

function fromScan(scanned: ScanResult, extra: Partial<Snapshot> & { state: LoopState }): Snapshot {
  return {
    ...blankSnapshot(extra.state),
    subject: scanned.subject,
    planPath: scanned.planPath,
    phasePath: scanned.phasePath,
    planFacts: scanned.planFacts,
    workFacts: scanned.workFacts,
    reviewFacts: scanned.reviewFacts,
    ...extra,
  };
}

function baseSnapshot(state: LoopState, reason: string, extra: Partial<Snapshot> = {}): Snapshot {
  return {
    ...blankSnapshot(state),
    planFacts: { kind: "missing", reason },
    ...extra,
  };
}

function blankSnapshot(state: LoopState): Snapshot {
  return {
    state,
    subject: null,
    planPath: null,
    phasePath: null,
    planFacts: { kind: "missing", reason: "uninitialized" },
    workFacts: { sessionOutcome: "pending", retriesUsed: 0, postcondition: "pending" },
    saveAttemptId: null,
    reviewFacts: { kind: "pending" },
    loopCount: 0,
    maxLoops: DEFAULT_MAX_LOOPS,
    iterateCyclesOnPhase: 0,
    lastChoice: null,
    history: [],
  };
}
function normalizeProjection(raw: unknown): Projection | null {
  const o = asObject(raw);
  if (!o || o.version !== PROJECTION_VERSION) return null;
  const identity = identityFields(o);
  const counts = countFields(o);
  const lastChoice = asLastChoice(o.lastChoice);
  const history = asHistory(o.history);
  const checkpoint = asCommitCheckpoint(o.commitCheckpoint, identity);
  if (!identity || !counts || lastChoice === undefined || history === null || checkpoint === undefined) return null;
  if (!validSaveAttemptId(o.saveAttemptId)) return null;
  return {
    version: PROJECTION_VERSION,
    ...identity,
    ...counts,
    lastChoice,
    history,
    saveAttemptId: (o.saveAttemptId ?? null) as string | null,
    commitCheckpoint: checkpoint,
  };
}

function validSaveAttemptId(value: unknown): boolean {
  return value === undefined || value === null || typeof value === "string";
}

function asCommitCheckpoint(raw: unknown, identity: {
  state: LoopState;
  subject: string;
  planPath: string;
  phasePath: string | null;
} | null): CommitCheckpoint | null | undefined {
  if (raw === undefined || raw === null) return null;
  const value = asObject(raw);
  if (!value || !identity || typeof value.targetPath !== "string") return undefined;
  if (value.targetPath !== (identity.phasePath ?? identity.planPath)) return undefined;
  if (!validCommitHead(value.baseHead)) return undefined;
  return { targetPath: value.targetPath, baseHead: value.baseHead as string | null };
}

function validCommitHead(value: unknown): boolean {
  return value === null || (typeof value === "string" && /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i.test(value));
}

function identityFields(o: Record<string, unknown>): {
  state: LoopState;
  subject: string;
  planPath: string;
  phasePath: string | null;
} | null {
  const state = asLoopState(o.state);
  if (!state || typeof o.subject !== "string" || typeof o.planPath !== "string") return null;
  const phasePath = asPhasePath(o.phasePath);
  if (phasePath === undefined) return null;
  return { state, subject: o.subject, planPath: o.planPath, phasePath };
}

function countFields(o: Record<string, unknown>): {
  loopCount: number;
  iterateCyclesOnPhase: number;
  maxLoops: number;
} | null {
  const loopCount = asInt(o.loopCount);
  const iterateCyclesOnPhase = asInt(o.iterateCyclesOnPhase);
  const maxLoops = o.maxLoops === undefined ? DEFAULT_MAX_LOOPS : asMaxLoops(o.maxLoops);
  if (loopCount === null || iterateCyclesOnPhase === null || maxLoops === null) return null;
  return { loopCount, iterateCyclesOnPhase, maxLoops };
}

function asObject(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object") return null;
  return raw as Record<string, unknown>;
}

function asLoopState(v: unknown): LoopState | null {
  return typeof v === "string" && Object.hasOwn(LOOP_STATES, v) ? (v as LoopState) : null;
}

function asPhasePath(v: unknown): string | null | undefined {
  if (v === null) return null;
  if (typeof v === "string") return v;
  return undefined;
}

/** Loop counters must be non-negative integers; anything else is a corrupted projection. */
function asInt(v: unknown): number | null {
  return typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : null;
}

/** The loop ceiling must be a positive integer or resumption is not safe. */
function asMaxLoops(v: unknown): number | null {
  return typeof v === "number" && Number.isInteger(v) && v > 0 ? v : null;
}

function asLastChoice(v: unknown): AcceptedChoice | null | undefined {
  if (v === undefined || v === null) return null;
  if (typeof v !== "object" || !("reason" in v) || !("choice" in v)) return undefined;
  if (typeof v.reason !== "string") return undefined;
  const choice = asChoice(v.choice);
  if (!choice) return undefined;
  return { choice, reason: v.reason };
}

function asChoice(v: unknown): Choice | null {
  if (!v || typeof v !== "object" || !("kind" in v) || typeof v.kind !== "string") return null;
  if (!Object.hasOwn(CHOICE_KINDS, v.kind)) return null;
  return { kind: v.kind as Choice["kind"] };
}

function asHistory(v: unknown): TransitionRecord[] | null {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) return null;
  const out: TransitionRecord[] = [];
  for (const item of v) {
    const rec = asTransition(item);
    if (!rec) return null;
    out.push(rec);
  }
  return out;
}

function asTransition(item: unknown): TransitionRecord | null {
  if (!item || typeof item !== "object") return null;
  return transitionFromObject(item);
}

function transitionFromObject(item: object): TransitionRecord | null {
  if (!("from" in item) || !("to" in item) || !("at" in item) || !("why" in item)) return null;
  return transitionFields(item.from, item.to, item.at, item.why);
}

function transitionFields(
  fromRaw: unknown,
  toRaw: unknown,
  at: unknown,
  why: unknown,
): TransitionRecord | null {
  const from = asLoopState(fromRaw);
  const to = asLoopState(toRaw);
  if (!from || !to || typeof at !== "string" || typeof why !== "string") return null;
  return { from, to, at, why };
}
