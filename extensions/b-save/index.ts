import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createActor } from "xstate";
import { applyPatch, recoverApply, type ApplyResult } from "./apply.js";
import { runEffects, type EffectOutcome, type MemoryCtx } from "./effects.js";
import {
  evaluateSnapshot,
  NeedsJudgmentError,
  SchemaError,
  UserGateError,
  type Evaluation,
  type PatchPlan,
} from "./evaluate.js";
import { createBSaveMachine } from "./machine.js";
import {
  isScribeProposal,
  runEvidenceAuditor,
  runGoalClassifier,
  runScribe,
  type AuditorVerdicts,
  type GoalClassification,
  type RoleFailure,
  type ScribeProposal,
} from "./roles.js";
import { hashContent, takeSnapshot, type SaveSnapshot } from "./snapshot.js";
import {
  InvalidRunIdError,
  readRunManifest,
  runDir,
  writeRunManifest,
  type RunManifest,
} from "./types.js";

export type CommandFlags = {
  dryRun: boolean;
  subject: string | null;
  noRetain: boolean;
  model: string | null;
  archiveInferred: boolean;
  runId: string | null;
  extra: string;
};

export type CommandResult = {
  ok: boolean;
  runId: string;
  state: string;
  report: string;
  effects: EffectOutcome[];
};

export type RolesAdapter = {
  scribe: typeof runScribe;
  evidenceAuditor: typeof runEvidenceAuditor;
  goalClassifier: typeof runGoalClassifier;
};

const defaultRoles: RolesAdapter = {
  scribe: runScribe,
  evidenceAuditor: runEvidenceAuditor,
  goalClassifier: runGoalClassifier,
};

export type CommandCtx = {
  hasUI?: boolean;
  cwd: string;
  memory?: MemoryCtx | null;
  roles?: RolesAdapter;
};

const FLAG = /^(--dry-run|--no-retain|--archive-inferred|--subject|--model|--run-id)(?:=(.*))?$/;

function emptyFlags(): CommandFlags {
  return {
    dryRun: false,
    subject: null,
    noRetain: false,
    model: null,
    archiveInferred: false,
    runId: null,
    extra: "",
  };
}

function takeValue(name: string, inline: string | undefined, argv: string[], i: number) {
  const value = inline !== undefined ? inline : argv[i];
  if (!value || value.startsWith("--")) throw new Error(name + " requires a value");
  return value;
}

function applyFlag(flags: CommandFlags, name: string, inline: string | undefined, argv: string[], i: number) {
  if (name === "--dry-run") flags.dryRun = true;
  else if (name === "--no-retain") flags.noRetain = true;
  else if (name === "--archive-inferred") flags.archiveInferred = true;
  else if (name === "--subject") flags.subject = takeValue(name, inline, argv, i);
  else if (name === "--model") flags.model = takeValue(name, inline, argv, i);
  else flags.runId = takeValue(name, inline, argv, i);
}

export function parseFlags(argv: string[]): CommandFlags {
  const flags = emptyFlags();
  const extra: string[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const match = FLAG.exec(token);
    if (!match) {
      if (token.startsWith("--")) throw new Error("unknown flag: " + token);
      extra.push(token);
      continue;
    }
    const consumed = match[2] === undefined && match[1] !== "--dry-run" && match[1] !== "--no-retain" && match[1] !== "--archive-inferred";
    applyFlag(flags, match[1], match[2], argv, consumed ? i + 1 : i);
    if (consumed) i += 1;
  }
  flags.extra = extra.join(" ");
  return flags;
}

function recoveryLine(state: string, runId: string) {
  if (state === "awaiting_subject_choice") return "recovery: /b-save --run-id " + runId + " --subject <folder>";
  if (state === "awaiting_policy") return "recovery: /b-save --run-id " + runId + " --archive-inferred";
  if (state === "failed_apply") {
    return "recovery: /b-save --run-id " + runId + " (resumes the journaled apply)";
  }
  return null;
}

function appendLabeled(lines: string[], label: string, items: string[] | undefined) {
  for (const item of items ?? []) lines.push(label + item);
}

function effectLine(effect: EffectOutcome) {
  return "effect " + effect.name + ": " + effect.outcome + (effect.detail ? " (" + effect.detail + ")" : "");
}

export function formatReport(input: {
  runId: string;
  state: string;
  subject?: string | null;
  durableFiles?: string[];
  warnings?: string[];
  effects?: EffectOutcome[];
  resumed?: boolean;
}): string {
  const lines = [
    "run_id: " + input.runId,
    "state: " + input.state,
    "subject: " + (input.subject ?? "(none)"),
    "resumed: " + String(input.resumed === true),
  ];
  const recovery = recoveryLine(input.state, input.runId);
  if (recovery) lines.push(recovery);
  appendLabeled(lines, "durable: ", input.durableFiles);
  appendLabeled(lines, "warning: ", input.warnings);
  appendLabeled(lines, "", (input.effects ?? []).map(effectLine));
  return lines.join("\n") + "\n";
}


function commandOk(state: string) {
  return state !== "awaiting_subject_choice" && state !== "awaiting_policy" && state !== "failed_model" && state !== "failed_apply" && state !== "aborted";
}

type JournalSummary = { status: "idle" | "in-progress" | "completed" | "rolled-back"; files: string[] };

function manifestFor(args: {
  runId: string;
  state: string;
  flags: CommandFlags;
  effects: EffectOutcome[];
  ok: boolean;
  snapshot?: SaveSnapshot | null;
  proposals?: unknown[];
  userDecisions?: unknown[];
  patch?: PatchPlan | null;
  journal?: JournalSummary;
}): RunManifest {
  const manifest: RunManifest = {
    schema_version: 1,
    run_id: args.runId,
    state: args.state,
    flags: {
      dry_run: args.flags.dryRun,
      archive_inferred: args.flags.archiveInferred,
      no_retain: args.flags.noRetain,
      subject: args.flags.subject,
      model: args.flags.model,
    },
    subject: manifestSubject(args.snapshot ?? null, args.flags),
    session_evidence: { present: false, valid: false, stale_reasons: [], fields: {} },
    input_hashes: {},
    proposals: args.proposals ?? [],
    user_decisions: args.userDecisions ?? [],
    patch_set: args.patch ?? null,
    journal: args.journal ?? { status: "idle", files: [] },
    effects: args.effects,
    terminal_error: args.ok ? null : args.state,
  };
  // Snapshot truth beats defaults: a resolved subject carries status,
  // evidence, and hashes the fallbacks cannot know.
  if (args.snapshot) {
    manifest.subject = args.snapshot.subject;
    manifest.session_evidence = args.snapshot.session_evidence;
    manifest.input_hashes = args.snapshot.input_hashes;
  }
  return manifest;
}

function manifestSubject(snapshot: SaveSnapshot | null, flags: CommandFlags): RunManifest["subject"] {
  if (snapshot) return snapshot.subject;
  if (!flags.subject) return null;
  return { name: flags.subject, path: ".context/" + flags.subject, status: null, created: true };
}

const UNRESUMABLE: Record<string, true> = { completed: true, aborted: true, failed_model: true };
const WAITING_FLAG: Record<string, "subject" | "archiveInferred"> = {
  awaiting_subject_choice: "subject",
  awaiting_policy: "archiveInferred",
};
type ResumePlan =
  | { kind: "refuse"; runId: string; error: string }
  | { kind: "report"; runId: string; state: string; subject: string | null }
  | { kind: "continue"; runId: string; subject: string | null; recoverJournal: boolean };

function continueFrom(existing: RunManifest, flags: CommandFlags): ResumePlan {
  if (UNRESUMABLE[existing.state]) {
    return { kind: "refuse", runId: existing.run_id, error: "run is terminal (" + existing.state + "); start a new run" };
  }
  const subject = flags.subject ?? existing.subject?.name ?? null;
  // Still-waiting resumes without the required flag are report-only: no
  // effects fire and the manifest is left untouched until the human answers.
  const waitingFlag = WAITING_FLAG[existing.state];
  if (waitingFlag && !flags[waitingFlag]) {
    return { kind: "report", runId: existing.run_id, state: existing.state, subject };
  }
  return {
    kind: "continue",
    runId: existing.run_id,
    subject,
    recoverJournal: existing.state === "failed_apply" || existing.state === "applying",
  };
}

function resumeFailure(runId: string, subject: string | null, error: string, state = "aborted"): CommandResult {
  const report = formatReport({ runId, state, subject, resumed: true });
  return { ok: false, runId, state, report: report + "error: " + error + "\n", effects: [] };
}

function recoverJournalIfAny(cwd: string, runId: string): ApplyResult | null {
  if (!existsSync(join(runDir(cwd, runId), "apply-journal.json"))) return null;
  return recoverApply(cwd, runId, "resume");
}

function rehashInputs(cwd: string, expected: Record<string, string>): Record<string, string> {
  const current: Record<string, string> = {};
  for (const path of Object.keys(expected)) {
    const abs = join(cwd, path);
    current[path] = existsSync(abs) ? hashContent(readFileSync(abs, "utf8")) : "";
  }
  return current;
}

function snapshotSources(cwd: string, expected: Record<string, string>): Record<string, string> {
  const sources: Record<string, string> = {};
  for (const path of Object.keys(expected)) {
    const abs = join(cwd, path);
    if (existsSync(abs)) sources[path] = readFileSync(abs, "utf8");
  }
  return sources;
}

function userDecisionsFor(flags: CommandFlags, resumed: boolean): unknown[] {
  const decisions: unknown[] = [];
  if (flags.subject) decisions.push({ decision: "subject", value: flags.subject });
  if (flags.archiveInferred) decisions.push({ decision: "archive_inferred", value: true });
  if (resumed) decisions.push({ decision: "resume", value: true });
  return decisions;
}

function persistedScribe(manifest: RunManifest): ScribeProposal | null {
  const proposal = manifest.proposals[0];
  return isScribeProposal(proposal) ? proposal : null;
}

async function completeRecoveredApply(
  ctx: CommandCtx,
  flags: CommandFlags,
  existing: RunManifest,
  applied: ApplyResult,
): Promise<CommandResult> {
  const scribe = persistedScribe(existing);
  const subject = existing.subject?.name ?? flags.subject;
  if (!scribe || !subject) return resumeFailure(existing.run_id, subject, "persisted proposals cannot safely resume effects", "failed_apply");
  const effects = await runEffects({
    noRetain: flags.noRetain,
    memory: ctx.memory ?? null,
    facts: { run_id: existing.run_id, subject, scribe },
  });
  const durableFiles = applied.journal.ops.map((op) => op.path);
  const manifest: RunManifest = {
    ...existing,
    state: "completed",
    effects,
    user_decisions: [...existing.user_decisions, ...userDecisionsFor(flags, true)],
    journal: { status: applied.journal.status, files: durableFiles },
    terminal_error: null,
  };
  writeRunManifest(ctx.cwd, manifest);
  return {
    ok: true,
    runId: existing.run_id,
    state: "completed",
    report: formatReport({ runId: existing.run_id, state: "completed", subject, effects, durableFiles, resumed: true }),
    effects,
  };
}

function aggregateAuditor(verdicts: AuditorVerdicts) {
  return {
    complete: verdicts.length > 0 && verdicts.every((verdict) => verdict.verdict === "complete"),
    citations: [...new Set(verdicts.flatMap((verdict) => verdict.evidence.map((citation) => citation.id)))],
  };
}

function scribeForEval(proposal: ScribeProposal) {
  return {
    title: proposal.title.text,
    body: [proposal.summary.text, ...proposal.facts.map((fact) => "- " + fact.text)].join("\n"),
    domains: proposal.domains.map((item) => item.text),
    topics: proposal.topics.map((item) => item.text),
    priority: proposal.priority.value,
  };
}


type SnapshotOutcome =
  | { ok: true; snapshot: SaveSnapshot }
  | { ok: false; event: "AMBIGUOUS_SUBJECT" | "ABORT"; state: string; warnings: string[]; manifest: RunManifest };

function takeSnapshotPhase(cwd: string, flags: CommandFlags, runId: string, subject: string | null): SnapshotOutcome {
  try {
    const taken = takeSnapshot(cwd, { subject });
    if (taken.kind === "ambiguous") {
      return {
        ok: false,
        event: "AMBIGUOUS_SUBJECT",
        state: "awaiting_subject_choice",
        warnings: [
          "multiple active subjects: " + taken.candidates.map((c) => c.name).join(", "),
          "suggested subject: " + taken.suggested_subject,
        ],
        manifest: manifestFor({ runId, state: "awaiting_subject_choice", flags, effects: [], ok: false, snapshot: null }),
      };
    }
    return { ok: true, snapshot: taken.snapshot };
  } catch (error) {
    return {
      ok: false,
      event: "ABORT",
      state: "aborted",
      warnings: [String(error)],
      manifest: manifestFor({ runId, state: "aborted", flags, effects: [], ok: false, snapshot: null }),
    };
  }
}
function validateEvidenceCitations(snapshot: SaveSnapshot, scribe: ScribeProposal, audit: AuditorVerdicts, goal: GoalClassification) {
  const citations = [
    ...[scribe.title, scribe.summary, ...scribe.domains, ...scribe.topics, ...scribe.facts].flatMap((claim) => claim.evidence),
    ...scribe.priority.evidence,
    ...audit.flatMap((verdict) => verdict.evidence),
  ];
  for (const citation of citations) {
    if (!snapshot.redacted_text[citation.id]?.includes(citation.quote)) throw new SchemaError("citation does not quote snapshot evidence: " + citation.id);
  }
  if (!snapshot.redacted_text[goal.evidence_id]?.includes(goal.quote)) throw new SchemaError("goal citation does not quote snapshot evidence: " + goal.evidence_id);
}
type RolesPhase =
  | { ok: true; scribe: ScribeProposal; audit: AuditorVerdicts; goal: GoalClassification }
  | { ok: false; role: string; error: string };

async function runRolesPhase(
  roles: RolesAdapter,
  cwd: string,
  evidence: Record<string, string>,
  modelOverride?: string,
): Promise<RolesPhase> {
  const scribe = await roles.scribe({ cwd, evidence, modelOverride });
  if (!scribe.ok) return { ok: false, role: scribe.role, error: scribe.error };
  const audit = await roles.evidenceAuditor({ cwd, evidence, modelOverride });
  if (!audit.ok) return { ok: false, role: audit.role, error: audit.error };
  const goal = await roles.goalClassifier({ cwd, evidence, modelOverride });
  if (!goal.ok) return { ok: false, role: goal.role, error: goal.error };
  return { ok: true, scribe: scribe.value, audit: audit.value, goal: goal.value };
}

type EvalFailureState = "awaiting_policy" | "failed_model" | "aborted";

type EvalPhase = { ok: true; evaluation: Evaluation } | { ok: false; state: EvalFailureState; message: string };

const EVENT_BY_EVAL_FAILURE: Record<EvalFailureState, { type: "NEEDS_POLICY" } | { type: "MODEL_FAILED" } | { type: "ABORT" }> = {
  awaiting_policy: { type: "NEEDS_POLICY" },
  failed_model: { type: "MODEL_FAILED" },
  aborted: { type: "ABORT" },
};

function evaluatePhase(input: {
  cwd: string;
  flags: CommandFlags;
  snapshot: SaveSnapshot;
  scribe: ScribeProposal;
  audit: AuditorVerdicts;
  goal: GoalClassification;
}): EvalPhase {
  const { snapshot, scribe } = input;
  try {
    validateEvidenceCitations(snapshot, scribe, input.audit, input.goal);
    return {
      ok: true,
      evaluation: evaluateSnapshot({
        snapshot: { kind: "ok", snapshot },
        today: snapshot.subject.name.slice(0, 10),
        subjectResolved: input.flags.subject !== null,
        scribe: scribeForEval(scribe),
        goal: { classification: input.goal.classification === "missing" ? "missing" : "exact" },
        auditor: aggregateAuditor(input.audit),
        archiveInferred: input.flags.archiveInferred,
        inferredBacklog: scribe.backlog.complete_inferred.map((item) => item.slug),
        explicitCompleted: scribe.backlog.complete_explicit.map((item) => item.slug),
        expectedHashes: snapshot.input_hashes,
        currentHashes: rehashInputs(input.cwd, snapshot.input_hashes),
        checkpoint: { scribe, sources: snapshotSources(input.cwd, snapshot.input_hashes) },
      }),
    };
  } catch (error) {
    if (error instanceof UserGateError && error.gate === "backlog_inferred") {
      return { ok: false, state: "awaiting_policy", message: "inferred backlog completions need approval: " + error.options.join(", ") };
    }
    if (error instanceof SchemaError || error instanceof NeedsJudgmentError) {
      return { ok: false, state: "failed_model", message: String(error) };
    }
    return { ok: false, state: "aborted", message: String(error) };
  }
}

async function executeRun(
  ctx: CommandCtx,
  flags: CommandFlags,
  runId: string,
  subject: string | null,
  resume: { resumed: boolean },
): Promise<CommandResult> {
  const actor = createActor(createBSaveMachine(), { input: { runId, subject } });
  actor.start();
  const machineState = () => String(actor.getSnapshot().value);

  const finish = (args: {
    state: string;
    effects?: EffectOutcome[];
    warnings?: string[];
    durableFiles?: string[];
    manifest?: RunManifest;
  }): CommandResult => {
    const ok = commandOk(args.state);
    const report = formatReport({
      runId,
      state: args.state,
      subject,
      effects: args.effects,
      warnings: args.warnings,
      durableFiles: args.durableFiles,
      resumed: resume.resumed,
    });
    if (!flags.dryRun && args.manifest && existsSync(join(ctx.cwd, ".context"))) {
      writeRunManifest(ctx.cwd, args.manifest);
    }
    actor.stop();
    return { ok, runId, state: args.state, report, effects: args.effects ?? [] };
  };

  // --- snapshotting ---
  const snap = takeSnapshotPhase(ctx.cwd, flags, runId, subject);
  if (!snap.ok) {
    actor.send({ type: snap.event });
    return finish({ state: snap.state, warnings: snap.warnings, manifest: snap.manifest });
  }
  const snapshot = snap.snapshot;
  actor.send({ type: "SNAPSHOT_DONE" });

  // --- evaluating: bounded roles over redacted evidence ---
  const phase = await runRolesPhase(ctx.roles ?? defaultRoles, ctx.cwd, snapshot.redacted_text, flags.model ?? undefined);
  if (!phase.ok) {
    actor.send({ type: "MODEL_FAILED" });
    return finish({
      state: machineState(),
      warnings: [phase.role + " failed: " + phase.error],
      manifest: manifestFor({ runId, state: "failed_model", flags, effects: [], ok: false, snapshot, proposals: [] }),
    });
  }
  const proposals = [phase.scribe, phase.audit, phase.goal];

  const evaluated = evaluatePhase({ cwd: ctx.cwd, flags, snapshot, scribe: phase.scribe, audit: phase.audit, goal: phase.goal });
  if (!evaluated.ok) {
    actor.send(EVENT_BY_EVAL_FAILURE[evaluated.state]);
    return finish({
      state: machineState(),
      warnings: [evaluated.message],
      manifest: manifestFor({ runId, state: machineState(), flags, effects: [], ok: false, snapshot, proposals }),
    });
  }
  const patch = evaluated.evaluation.patch;
  const durableFiles = patch.ops.map((op) => op.path);
  actor.send({ type: "EVAL_DONE" });

  // --- applying ---
  if (flags.dryRun) {
    return finish({ state: "completed", durableFiles, warnings: ["dry-run: nothing applied or persisted"] });
  }
  let applied: ApplyResult;
  try {
    applied = applyPatch(ctx.cwd, patch, { runId, expectedHashes: snapshot.input_hashes });
  } catch (error) {
    actor.send({ type: "APPLY_FAILED" });
    return finish({
      state: machineState(),
      warnings: [String(error)],
      manifest: manifestFor({
        runId,
        state: "failed_apply",
        flags,
        effects: [],
        ok: false,
        snapshot,
        proposals,
        patch,
        journal: { status: "in-progress", files: durableFiles },
      }),
    });
  }
  actor.send({ type: "APPLY_DONE" });

  // --- effecting: only after durable apply succeeded ---
  const effects = await runEffects({
    noRetain: flags.noRetain,
    memory: ctx.memory ?? null,
    facts: { run_id: runId, subject: snapshot.subject.name, scribe: phase.scribe },
  });
  actor.send({ type: "EFFECTS_DONE" });
  return finish({
    state: machineState(),
    effects,
    durableFiles,
    manifest: manifestFor({
      runId,
      state: "completed",
      flags,
      effects,
      ok: true,
      snapshot,
      proposals,
      userDecisions: userDecisionsFor(flags, resume.resumed),
      patch,
      journal: { status: applied.journal.status, files: applied.journal.ops.map((op) => op.path) },
    }),
  });
}

async function resumeRun(ctx: CommandCtx, flags: CommandFlags): Promise<CommandResult> {
  const runId = flags.runId as string;
  let existing: RunManifest;
  try {
    existing = readRunManifest(ctx.cwd, runId);
  } catch (error) {
    const detail = error instanceof InvalidRunIdError ? error.message : "unknown run; start a new run";
    return resumeFailure(runId, flags.subject, detail);
  }
  const plan = continueFrom(existing, flags);
  if (plan.kind === "refuse") return resumeFailure(plan.runId, flags.subject, plan.error);
  if (plan.kind === "report") {
    // Report-only: re-report the waiting state and its recovery line. No
    // effects, no manifest rewrite — the run stays parked for human input.
    const report = formatReport({ runId: plan.runId, state: plan.state, subject: plan.subject, resumed: true });
    return { ok: false, runId: plan.runId, state: plan.state, report, effects: [] };
  }
  if (plan.recoverJournal) {
    try {
      const applied = recoverJournalIfAny(ctx.cwd, plan.runId);
      if (applied) return completeRecoveredApply(ctx, flags, existing, applied);
    } catch (error) {
      return resumeFailure(plan.runId, plan.subject, String(error), "failed_apply");
    }
  }
  return executeRun(ctx, flags, plan.runId, plan.subject, { resumed: true });
}

export async function runBSaveCommand(ctx: CommandCtx, argv: string[]): Promise<CommandResult> {
  const flags = parseFlags(argv);
  if (flags.runId) return resumeRun(ctx, flags);
  return executeRun(ctx, flags, flags.runId ?? randomUUID(), flags.subject, { resumed: false });
}

const ENGINE_FLAGS = ["--dry-run", "--no-retain", "--archive-inferred", "--subject", "--model", "--run-id"];

export function wire(pi: ExtensionAPI): void {
  pi.registerCommand("b-save", {
    description: "Deterministic session checkpoint: snapshot, roles, journaled apply, effects",
    getArgumentCompletions(prefix: string) {
      return ENGINE_FLAGS.filter((flag) => flag.startsWith(prefix)).map((flag) => ({ value: flag, label: flag }));
    },
    handler: async (args: string, ctx: CommandCtx) => {
      const argv = args.trim() ? args.trim().split(/\s+/) : [];
      const result = await runBSaveCommand(ctx, argv);
      if (result.report) console.log(result.report);
      if (!result.ok) throw new Error("b-save " + result.state);
    },
  });
}
