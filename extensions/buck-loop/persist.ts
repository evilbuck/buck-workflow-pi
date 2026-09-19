/**
 * persist — versioned `.context/workflow/buck-loop.json` plus resume
 * reconciliation. Artifacts win. The projection never overrides disk truth.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { scan, type ScanResult } from "./scan.js";
import type { AcceptedChoice, Choice, LoopState, Snapshot, TransitionRecord } from "./types.js";

export const PROJECTION_RELPATH = ".context/workflow/buck-loop.json";
export const PROJECTION_VERSION = 1 as const;
const DEFAULT_MAX_LOOPS = 12;

const LOOP_STATES: Record<LoopState, true> = {
  idle: true,
  resolving: true,
  building: true,
  reviewing: true,
  iterating: true,
  documenting: true,
  saving: true,
  committing: true,
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

export type Projection = {
  version: typeof PROJECTION_VERSION;
  state: LoopState;
  subject: string;
  planPath: string;
  phasePath: string | null;
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
    // Non-git projects still get a projection; commit verification will fail closed.
  }
}
export function writeProjection(projectRoot: string, projection: Projection): void {
  prepareProjectionPath(projectRoot);
  const abs = join(resolve(projectRoot), PROJECTION_RELPATH);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, `${JSON.stringify(projection, null, 2)}\n`, "utf8");
}

export function readProjection(projectRoot: string): Projection | null {
  const abs = join(resolve(projectRoot), PROJECTION_RELPATH);
  if (!existsSync(abs)) return null;
  try {
    return normalizeProjection(JSON.parse(readFileSync(abs, "utf8")));
  } catch {
    return null;
  }
}

export function resume(opts: ResumeOptions): Snapshot {
  const root = resolve(opts.projectRoot);
  const file = join(root, PROJECTION_RELPATH);
  if (!existsSync(file)) {
    if (!opts.path) return baseSnapshot("idle", "no projection to resume");
    return fromScan(scan({ projectRoot: root, path: opts.path, state: "resolving" }), {
      state: "resolving",
    });
  }
  const projection = readProjection(root);
  if (!projection) return baseSnapshot("blocked", "unreadable projection");
  return reconcile(root, projection, opts.path);
}

function reconcile(root: string, projection: Projection, pathOverride?: string): Snapshot {
  const subjectDir = join(root, ".context", projection.subject);
  if (!existsSync(subjectDir)) {
    return baseSnapshot("blocked", `subject vanished: ${projection.subject}`, {
      subject: projection.subject,
      planPath: projection.planPath,
      phasePath: projection.phasePath,
      ...counters(projection),
    });
  }
  const scanned = scan({
    projectRoot: root,
    path: pathOverride ?? resumePath(root, projection),
    state: projection.state,
  });
  if (projection.state === "done" && scanned.planFacts.kind === "phased-incomplete") {
    return fromScan(scanned, {
      state: "blocked",
      planFacts: { kind: "missing", reason: "projection claims done but an incomplete phase exists" },
      ...counters(projection),
    });
  }
  const iterateCyclesOnPhase =
    scanned.phasePath === projection.phasePath ? projection.iterateCyclesOnPhase : 0;
  return fromScan(scanned, {
    state: staleBuildingComplete(projection, scanned) ? "done" : projection.state,
    ...counters(projection),
    iterateCyclesOnPhase,
  });
}

function staleBuildingComplete(projection: Projection, scanned: ScanResult): boolean {
  return projection.state === "building" && scanned.planFacts.kind === "phased-complete";
}

function resumePath(root: string, projection: Projection): string {
  if (existsSync(resolve(root, projection.planPath))) return projection.planPath;
  return join(".context", projection.subject);
}

function counters(projection: Projection): Pick<
  Snapshot,
  "loopCount" | "maxLoops" | "iterateCyclesOnPhase" | "lastChoice" | "history"
> {
  return {
    loopCount: projection.loopCount,
    maxLoops: projection.maxLoops,
    iterateCyclesOnPhase: projection.iterateCyclesOnPhase,
    lastChoice: projection.lastChoice,
    history: projection.history,
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
  if (!identity || !counts || lastChoice === undefined || history === null) return null;
  return { version: PROJECTION_VERSION, ...identity, ...counts, lastChoice, history };
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
