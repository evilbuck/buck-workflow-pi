import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { ContainmentError, contextRootJoin, type PatchPlan } from "./evaluate.js";
import { hashContent } from "./snapshot.js";
import { runDir } from "./types.js";

export type JournalOp = {
  path: string;
  before: string | null;
  after: string | null;
  tmp: string | null;
  kind: "write" | "delete";
  done: boolean;
};

export type ApplyJournal = {
  status: "in-progress" | "completed" | "rolled-back";
  ops: JournalOp[];
};

export type ApplyResult = {
  status: "applied" | "resumed" | "rolled-back" | "conflict";
  journal: ApplyJournal;
};

function journalPath(root: string, runId: string) {
  return join(runDir(root, runId), "apply-journal.json");
}

function readJournal(path: string): ApplyJournal | null {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as ApplyJournal;
}

function writeJournal(path: string, journal: ApplyJournal) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(journal, null, 2) + "\n");
}

export function validatePatch(root: string, plan: PatchPlan) {
  for (const op of plan.ops) contextRootJoin(root, op.path);
  for (const move of plan.moves) {
    contextRootJoin(root, move.from);
    contextRootJoin(root, move.to);
  }
}

function beforeImage(abs: string) {
  return existsSync(abs) ? readFileSync(abs, "utf8") : null;
}

function stageAtomic(abs: string, tmp: string, content: string) {
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(tmp, content);
}

function assertNoHashDrift(root: string, expectedHashes: Record<string, string>) {
  for (const [path, hash] of Object.entries(expectedHashes)) {
    const abs = contextRootJoin(root, path);
    const now = existsSync(abs) ? hashContent(readFileSync(abs, "utf8")) : "";
    if (now !== hash) throw new Error("pre-apply hash drift: " + path);
  }
}

// Applies one journal op (delete vs promote staged temp) and persists the
// journal after it so a crash leaves the journal matching what landed.
function applyJournalOp(root: string, jPath: string, journal: ApplyJournal, jOp: JournalOp, content: string | null) {
  const abs = contextRootJoin(root, jOp.path);
  if (content === null) rmSync(abs, { force: true });
  else renameSync(jOp.tmp!, abs);
  jOp.after = content === null ? null : hashContent(content);
  jOp.done = true;
  writeJournal(jPath, journal);
}

export function applyPatch(
  root: string,
  plan: PatchPlan,
  opts: { runId: string; failAfter?: number; expectedHashes?: Record<string, string> } = { runId: "run" },
): ApplyResult {
  validatePatch(root, plan);
  if (plan.moves.length > 0) throw new Error("patch moves are not supported");
  if (opts.expectedHashes) assertNoHashDrift(root, opts.expectedHashes);
  const jPath = journalPath(root, opts.runId);
  const ops: JournalOp[] = plan.ops.map((op) => {
    const abs = contextRootJoin(root, op.path);
    return {
      path: op.path,
      before: beforeImage(abs),
      after: null,
      tmp: op.content === null ? null : abs + ".tmp-b-save",
      kind: op.content === null ? "delete" : "write",
      done: false,
    };
  });
  const journal: ApplyJournal = { status: "in-progress", ops };
  writeJournal(jPath, journal);
  for (let i = 0; i < plan.ops.length; i += 1) {
    const op = plan.ops[i];
    if (op.content !== null) stageAtomic(contextRootJoin(root, op.path), ops[i].tmp!, op.content);
  }
  for (let i = 0; i < plan.ops.length; i += 1) {
    if (opts.failAfter !== undefined && i === opts.failAfter) throw new Error("injected apply failure");
    applyJournalOp(root, jPath, journal, ops[i], plan.ops[i].content);
  }
  journal.status = "completed";
  writeJournal(jPath, journal);
  return { status: "applied", journal };
}

function abortIfBeforeChanged(root: string, op: JournalOp) {
  if (op.done) return;
  const abs = contextRootJoin(root, op.path);
  const now = beforeImage(abs);
  if (now !== op.before) throw new Error("before-image changed: " + op.path);
}

function resumeOps(root: string, journal: ApplyJournal, jPath: string) {
  for (const op of journal.ops) {
    abortIfBeforeChanged(root, op);
    if (op.done) continue;
    const abs = contextRootJoin(root, op.path);
    if (op.kind === "delete") rmSync(abs, { force: true });
    else {
      if (!op.tmp || !existsSync(op.tmp)) throw new Error("staged temp missing: " + op.path);
      renameSync(op.tmp, abs);
      op.after = hashContent(readFileSync(abs, "utf8"));
    }
    op.done = true;
    // Persist after each recovered op so a crash mid-resume leaves the
    // journal matching what actually landed (same pattern as applyPatch).
    writeJournal(jPath, journal);
  }
  journal.status = "completed";
}

// Reverts one applied delete op. Returns true when the target drifted.
function rollbackDelete(root: string, jPath: string, journal: ApplyJournal, op: JournalOp, now: string | null): boolean {
  const before = op.before;
  if (before === null) return false; // apply's delete was a no-op; nothing to revert
  if (now !== null) return true;
  const abs = contextRootJoin(root, op.path);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, before);
  op.done = false;
  writeJournal(jPath, journal);
  return false;
}

// Reverts one applied op in reverse-order fashion. Returns true when the
// target drifted so rollback cannot safely touch it.
function rollbackOne(root: string, jPath: string, journal: ApplyJournal, op: JournalOp): boolean {
  const abs = contextRootJoin(root, op.path);
  if (op.tmp && existsSync(op.tmp)) rmSync(op.tmp);
  if (!op.done) return false;
  const now = beforeImage(abs);
  if (op.kind === "delete") return rollbackDelete(root, jPath, journal, op, now);
  if (op.after === null || now === null || hashContent(now) !== op.after) return true;
  if (op.before === null) rmSync(abs);
  else {
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, op.before);
  }
  op.done = false;
  writeJournal(jPath, journal);
  return false;
}

function rollbackOps(root: string, journal: ApplyJournal, jPath: string): boolean {
  let drifted = false;
  for (const op of [...journal.ops].reverse()) {
    if (rollbackOne(root, jPath, journal, op)) drifted = true;
  }
  // A drifted target means the partial apply cannot be reverted: keep the
  // journal recoverable instead of labelling it rolled-back.
  if (drifted) return true;
  journal.status = "rolled-back";
  return false;
}

export function recoverApply(root: string, runId: string, mode: "resume" | "rollback"): ApplyResult {
  const jPath = journalPath(root, runId);
  const journal = readJournal(jPath);
  if (!journal) throw new ContainmentError("missing journal");
  if (journal.status === "completed") return { status: "resumed", journal };
  let drifted = false;
  if (mode === "resume") resumeOps(root, journal, jPath);
  else drifted = rollbackOps(root, journal, jPath);
  writeJournal(jPath, journal);
  if (drifted) return { status: "conflict", journal };
  return { status: mode === "resume" ? "resumed" : "rolled-back", journal };
}

