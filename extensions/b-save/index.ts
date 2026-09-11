import { randomUUID } from "node:crypto";
import { runEffects, type EffectOutcome, type MemoryCtx } from "./effects.js";
import { createBSaveMachine } from "./machine.js";
import { writeRunManifest, type RunManifest } from "./types.js";
import { createActor } from "xstate";

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

export type CommandCtx = {
  hasUI?: boolean;
  cwd: string;
  memory?: MemoryCtx | null;
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

function persist(cwd: string, manifest: RunManifest) {
  writeRunManifest(cwd, manifest);
}

function commandOk(state: string) {
  return state !== "awaiting_subject_choice" && state !== "awaiting_policy" && state !== "failed_model" && state !== "failed_apply" && state !== "aborted";
}

function manifestFor(runId: string, state: string, flags: CommandFlags, effects: EffectOutcome[], ok: boolean): RunManifest {
  return {
    schema_version: 1,
    run_id: runId,
    state,
    flags: {
      dry_run: flags.dryRun,
      archive_inferred: flags.archiveInferred,
      no_retain: flags.noRetain,
      subject: flags.subject,
      model: flags.model,
    },
    subject: flags.subject
      ? { name: flags.subject, path: ".context/" + flags.subject, status: null, created: false }
      : null,
    session_evidence: { present: false, valid: false, stale_reasons: [], fields: {} },
    input_hashes: {},
    proposals: [],
    user_decisions: [],
    patch_set: null,
    journal: { status: "idle", files: [] },
    effects,
    terminal_error: ok ? null : state,
  };
}

export async function runBSaveCommand(
  ctx: CommandCtx,
  argv: string[],
  opts: { effects?: EffectOutcome[]; state?: string } = {},
): Promise<CommandResult> {
  const flags = parseFlags(argv);
  const runId = flags.runId ?? randomUUID();
  const actor = createActor(createBSaveMachine(), { input: { runId, subject: flags.subject } });
  actor.start();
  const state = opts.state ?? String(actor.getSnapshot().value);
  const effects = opts.effects ?? (await runEffects({ noRetain: flags.dryRun || flags.noRetain, memory: ctx.memory }));
  const ok = commandOk(state);
  const report = formatReport({ runId, state, subject: flags.subject, effects, resumed: Boolean(flags.runId) });
  if (!flags.dryRun) persist(ctx.cwd, manifestFor(runId, state, flags, effects, ok));
  actor.stop();
  return { ok: Boolean(ctx.hasUI) ? ok : ok, runId, state, report, effects };
}
