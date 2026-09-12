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
  status: "applied" | "resumed" | "rolled-back";
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

export function applyPatch(
  root: string,
  plan: PatchPlan,
  opts: { runId: string; failAfter?: number; expectedHashes?: Record<string, string> } = { runId: "run" },
): ApplyResult {
  validatePatch(root, plan);
  if (plan.moves.length > 0) throw new Error("patch moves are not supported");
  if (opts.expectedHashes) {
    for (const [path, hash] of Object.entries(opts.expectedHashes)) {
      const abs = contextRootJoin(root, path);
      const now = existsSync(abs) ? hashContent(readFileSync(abs, "utf8")) : "";
      if (now !== hash) throw new Error("pre-apply hash drift: " + path);
    }
  }
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
    const op = plan.ops[i];
    const abs = contextRootJoin(root, op.path);
    if (op.content === null) rmSync(abs, { force: true });
    else renameSync(ops[i].tmp!, abs);
    ops[i].after = op.content === null ? null : hashContent(op.content);
    ops[i].done = true;
    writeJournal(jPath, journal);
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

function resumeOps(root: string, journal: ApplyJournal) {
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
  }
  journal.status = "completed";
}

function rollbackOps(root: string, journal: ApplyJournal) {
  for (const op of [...journal.ops].reverse()) {
    const abs = contextRootJoin(root, op.path);
    if (op.tmp && existsSync(op.tmp)) rmSync(op.tmp);
    if (!op.done) continue;
    const now = beforeImage(abs);
    if (op.kind === "delete") {
      const before = op.before;
      if (now !== null || before === null) continue;
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, before);
      op.done = false;
      continue;
    }
    if (op.after === null || now === null || hashContent(now) !== op.after) continue;
    if (op.before === null) rmSync(abs);
    else {
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, op.before);
    }
    op.done = false;
  }
  journal.status = "rolled-back";
}

export function recoverApply(root: string, runId: string, mode: "resume" | "rollback"): ApplyResult {
  const jPath = journalPath(root, runId);
  const journal = readJournal(jPath);
  if (!journal) throw new ContainmentError("missing journal");
  if (journal.status === "completed") return { status: "resumed", journal };
  if (mode === "resume") resumeOps(root, journal);
  else rollbackOps(root, journal);
  writeJournal(jPath, journal);
  return { status: mode === "resume" ? "resumed" : "rolled-back", journal };
}

