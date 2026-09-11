import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { ContainmentError, contextRootJoin, type PatchPlan } from "./evaluate.js";
import { hashContent } from "./snapshot.js";

export type JournalOp = {
  path: string;
  before: string | null;
  tmp: string;
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
  return join(root, ".context", "workflow", "runs", runId, "apply-journal.json");
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

function writeAtomic(abs: string, tmp: string, content: string) {
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(tmp, content);
  renameSync(tmp, abs);
}

export function applyPatch(
  root: string,
  plan: PatchPlan,
  opts: { runId: string; failAfter?: number; expectedHashes?: Record<string, string> } = { runId: "run" },
): ApplyResult {
  validatePatch(root, plan);
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
      tmp: abs + ".tmp-b-save",
      done: false,
    };
  });
  const journal: ApplyJournal = { status: "in-progress", ops };
  writeJournal(jPath, journal);
  let i = 0;
  for (const op of plan.ops) {
    if (opts.failAfter !== undefined && i === opts.failAfter) {
      throw new Error("injected apply failure");
    }
    const abs = contextRootJoin(root, op.path);
    writeAtomic(abs, ops[i].tmp, op.content);
    ops[i].done = true;
    writeJournal(jPath, journal);
    i += 1;
  }
  journal.status = "completed";
  writeJournal(jPath, journal);
  return { status: "applied", journal };
}

function abortIfBeforeChanged(root: string, op: JournalOp) {
  const abs = contextRootJoin(root, op.path);
  const now = beforeImage(abs);
  if (op.done) return;
  if (now !== op.before && existsSync(abs) && now !== null) {
    throw new Error("before-image changed: " + op.path);
  }
}

function resumeOps(root: string, journal: ApplyJournal) {
  for (const op of journal.ops) {
    abortIfBeforeChanged(root, op);
    if (op.done) continue;
    const abs = contextRootJoin(root, op.path);
    if (existsSync(op.tmp) && !existsSync(abs)) {
      renameSync(op.tmp, abs);
      op.done = true;
    }
  }
  journal.status = "completed";
}

function rollbackOps(root: string, journal: ApplyJournal) {
  for (const op of [...journal.ops].reverse()) {
    const abs = contextRootJoin(root, op.path);
    if (existsSync(op.tmp)) rmSync(op.tmp);
    if (op.before === null) {
      if (existsSync(abs)) rmSync(abs);
    } else {
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
  return { status: journal.status === "completed" ? "resumed" : "rolled-back", journal };
}

export function upsertIndexLine(existing: string, line: string) {
  const rows = existing.split("\n");
  if (rows.some((row) => row.trim() === line.trim())) return existing;
  const body = existing.endsWith("\n") || existing === "" ? existing : existing + "\n";
  return body + line + (line.endsWith("\n") ? "" : "\n");
}
