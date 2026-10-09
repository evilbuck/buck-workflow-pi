/**
 * `/buck-loop` command surface — the only file that talks to the coding-agent host.
 *
 * Start here. Every other file in this folder is host-agnostic: they take
 * plain data and return plain data. This file is the adapter that turns a
 * chat slash-command into those calls.
 *
 * ## What the host is
 *
 * Oh My Pi (OMP) and Pi are coding-agent applications. They load TypeScript
 * "extensions" (plugins) at startup. An extension can register slash
 * commands, show status in the UI, and send messages back into the chat.
 * The host hands us an `ExtensionAPI` object (the `pi` argument below). We
 * never construct it.
 *
 * `wireBuckLoop(pi)` is called once from `extensions/index.ts` during
 * startup. After that this module sits idle until the operator types
 * `/buck-loop …` in chat.
 *
 * ## What happens on `/buck-loop`
 *
 * 1. Parse the arguments (`parseArgs`). Bad grammar → toast an error and stop.
 * 2. Open a live progress widget so the operator can see the current step.
 * 3. Delegate to {@link handleLoop} in `loop.ts`. That function owns the workflow.
 * 4. If a nested agent call fails, inject a structured failure into the
 *    parent chat so the parent agent can diagnose it. The state machine
 *    still decides the next state; the parent must not invent a transition.
 *
 * ## Command grammar
 *
 * ```
 * /buck-loop <path-to-plan|phase|subject>
 * /buck-loop --resume | --status | --stop
 * ```
 *
 * Flags and a path cannot be mixed. One flag or one path, never both.
 *
 * ## File map (read in this order)
 *
 * - {@link ./types.ts}        — states, snapshot, effects (the vocabulary)
 * - {@link ./machine.ts}      — Buck definition over the pure evaluator (no I/O)
 * - {@link ./scan.ts}         — read plan/review files from disk into a snapshot
 * - {@link ./persist.ts}      — save/resume `.context/workflow/buck-loop.json`
 * - {@link ./choice.ts}       — ask a model to pick from a closed enum
 * - {@link ./run-step.ts}     — spawn a nested coding session to run one skill
 * - {@link ./loop.ts}         — the while-loop that drives the machine
 * - {@link ./call-failure.ts} — JSON we inject into the parent chat on failure
 */
import type { ExtensionAPI, ExtensionUIDialogOptions } from "@mariozechner/pi-coding-agent";
import type { ActivityEvent } from "../extension-activity.js";
import { createActivityCard, type ActivityCard, type ActivityCardUI } from "./activity-widget.js";
import type { Profile } from "./activity-view.js";
import { createBuckLoopActivityLog, type BuckLoopActivityLog } from "./activity-log.js";
import { handleLoop, statusOf, type LoopCommand, type LoopDeps, type LoopResult } from "./loop.js";
import { formatFailureForAgent, serializeCallError, type AgentCallFailure } from "./call-failure.js";
/** Printed when the operator types `/buck-loop` with no args, or mixed flags. */
export const USAGE =
  "Usage: /buck-loop <path-to-plan|phase|subject> | --resume | --status | --stop | --profile compact|standard|verbose";

/**
 * Result of {@link parseArgs}.
 *
 * - `ok: true, command: "start"` — operator named a plan, phase, or subject folder.
 * - `ok: true` with `--resume` / `--status` / `--stop` — no path; the saved
 *   run file (`.context/workflow/buck-loop.json`) is the input.
 * - `ok: false` — show `error` as a toast and do not start the loop.
 */
export type ParsedArgs =
  | { ok: true; command: "start"; path: string }
  | { ok: true; command: Exclude<LoopCommand, "start"> }
  | { ok: true; command: "profile"; profile: Profile }
  | { ok: false; error: string };

/** The only flags `/buck-loop` accepts. Used for tab-completion and parsing. */
const FLAGS = ["--resume", "--status", "--stop", "--profile compact", "--profile standard", "--profile verbose"] as const;

function profileCommand(tokens: string[]): Extract<ParsedArgs, { command: "profile" }> | undefined {
  if (tokens[0] !== "--profile" || tokens.length !== 2) return undefined;
  const profile = tokens[1];
  if (profile !== "compact" && profile !== "standard" && profile !== "verbose") return undefined;
  return { ok: true, command: "profile", profile };
}

/**
 * Split the raw argument string the host passes to the command handler.
 *
 * The host does **not** parse flags for us. `args` is everything after
 * `/buck-loop`, as a single string (e.g. `"--status"` or
 * `".context/2026-09-18.todo/plan-todo.md"`).
 *
 * Rejects mixed flags+path, unknown flags, and extra positionals. Does not
 * look at disk — a well-formed path that does not exist is still `ok: true`.
 */
export function parseArgs(raw: string): ParsedArgs {
  const tokens = raw.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return { ok: false, error: USAGE };
  const density = profileCommand(tokens);
  if (density) return density;

  const flags = tokens.filter((token) => token.startsWith("-"));
  const positionals = tokens.filter((token) => !token.startsWith("-"));

  if (flags.length > 0 && positionals.length > 0) {
    return { ok: false, error: `conflicting arguments\n${USAGE}` };
  }
  if (flags.length > 1) return { ok: false, error: `conflicting arguments\n${USAGE}` };
  if (positionals.length > 1) return { ok: false, error: `extra arguments\n${USAGE}` };

  if (flags.length === 1) {
    const flag = flags[0];
    if (flag === "--resume") return { ok: true, command: "resume" };
    if (flag === "--status") return { ok: true, command: "status" };
    if (flag === "--stop") return { ok: true, command: "stop" };
    return { ok: false, error: `unknown flag: ${flag}\n${USAGE}` };
  }

  return { ok: true, command: "start", path: positionals[0]! };
}

/**
 * Host UI the command handler receives as `ctx.ui`.
 *
 * The component factory is optional in non-interactive hosts. Notifications
 * remain available for parser errors, terminal results and failures.
 */
type BuckLoopUI = ActivityCardUI & {
  notify: (message: string, type?: "info" | "warning" | "error") => void;
  confirm?: (title: string, message: string, opts?: ExtensionUIDialogOptions) => Promise<boolean>;
};

/** Short label shown in the progress widget for the current command. */
function initialLabel(parsed: Extract<ParsedArgs, { ok: true; command: LoopCommand }>): string {
  if (parsed.command === "start") return "Starting " + parsed.path;
  if (parsed.command === "resume") return "Resuming saved run";
  if (parsed.command === "status") return "Reading loop status";
  return "Stopping saved run";
}

/**
 * Push a structured failure into the **parent** chat so the operator's
 * main agent can read it on the next turn.
 *
 * `pi.sendMessage` is a host API: it appends a custom chat item, it is
 * not `console.log`. `triggerTurn: true` with the default `deliverAs`
 * ("steer") starts a parent turn when idle and steers into the live turn
 * when streaming. `deliverAs: "nextTurn"` would NOT work here: the host
 * short-circuits on it and ignores `triggerTurn`, holding the failure in
 * memory until the operator types something.
 *
 * If the host refuses the message (session gone, API mismatch), we toast
 * instead of throwing — the loop has already recorded the durable failure.
 */
function returnFailureToAgent(pi: ExtensionAPI, ui: BuckLoopUI, failure: AgentCallFailure): void {
  try {
    pi.sendMessage(
      {
        customType: "buck-loop-call-failure",
        content: formatFailureForAgent(failure),
        display: true,
        details: failure,
      },
      { triggerTurn: true },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    ui.notify("buck-loop could not return the failure to the agent: " + message, "error");
  }
}

/**
 * Build a failure record when `handleLoop` itself throws (not a nested
 * work/choice session). Best-effort: if even reading saved status fails,
 * report blocked and preserve the original error.
 */
function supervisorFailure(cwd: string, parsed: Extract<ParsedArgs, { ok: true }>, error: unknown): AgentCallFailure {
  let state: AgentCallFailure["state"] = "blocked";
  try {
    if (statusOf(cwd).state === "aborted") state = "aborted";
  } catch {
    // A missing or unreadable projection cannot make an exception successful.
  }
  return {
    state,
    operation: "supervise",
    trying: initialLabel(parsed),
    prompt: null,
    agent: { kind: "supervisor", id: "buck-loop-supervisor", role: "supervisor" },
    error: serializeCallError(error),
  };
}

const DIRTY_CONFIRM_MS = 60_000;

/** Yes continues. Timeout, cancel, throw, or a missing dialog means no. */
async function confirmChoice(ui: BuckLoopUI, title: string, body: string): Promise<boolean> {
  if (!ui.confirm) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DIRTY_CONFIRM_MS);
  try {
    const answer = await ui.confirm(title, body, { timeout: DIRTY_CONFIRM_MS, signal: controller.signal });
    return answer === true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function confirmDirty(ui: BuckLoopUI, paths: string[]): Promise<boolean> {
  const shown = paths.slice(0, 12);
  const extra = paths.length - shown.length;
  const list = shown.join("\n") + (extra > 0 ? `\n…and ${extra} more` : "");
  return confirmChoice(
    ui,
    "Working tree is dirty",
    `${paths.length} change(s) outside .context/:\n${list}\n\nContinue? A later commit runs git add -A, so these files can be staged.`,
  );
}



/**
 * Register `/buck-loop` with the coding-agent host.
 *
 * `pi.registerCommand(name, spec)` is how extensions add slash commands.
 * After this returns, typing `/buck-loop` in chat runs `spec.handler`.
 *
 * @param pi - Host plugin API. Created by OMP/Pi, passed in from `extensions/index.ts`.
 */
type RunArgs = Extract<ParsedArgs, { ok: true; command: LoopCommand }>;
type CommandContext = { cwd: string; ui: BuckLoopUI; modelRegistry?: { getAvailable(): Array<{ provider: string; id: string }> } };
type CardState = { profile: Profile; active?: ActivityCard };

function liveDeps(pi: ExtensionAPI, ctx: CommandContext, card: ActivityCard, log: BuckLoopActivityLog): Partial<LoopDeps> {
  const ingest = (event: ActivityEvent): void => { card.ingest(event); log.activity(event); };
  return {
    onProgress: progress => { card.phase(progress.label); log.progress(progress); },
    onActivity: ingest,
    onSnapshot: snapshot => card.snapshot(snapshot),
    onDecision: snapshot => card.decision(snapshot),
    onSessionEvent: (event, model) => card.session(event, model),
    onContextUsage: usage => card.context(usage),
    onFailure: failure => {
      ingest({ kind: "toolEnd", tool: failure.agent?.role ?? failure.operation, ok: false, message: failure.error.message });
      returnFailureToAgent(pi, ctx.ui, failure);
    },
    onWarning: message => ctx.ui.notify(message, "warning"),
    confirmDirty: paths => confirmDirty(ctx.ui, paths),
    confirmContinue: reason => confirmChoice(ctx.ui, "Buck loop would stop", `${reason}\n\nContinue anyway?`),
    availableIds: async () => new Set((ctx.modelRegistry?.getAvailable() ?? []).map(model => `${model.provider}/${model.id}`)),
  };
}

async function showResult(result: LoopResult, parsed: RunArgs, card: ActivityCard, log: BuckLoopActivityLog): Promise<void> {
  const terminal = result.state === "aborted" ? result.reason : result.state + ": " + result.reason;
  const ok = result.state !== "blocked" && result.state !== "aborted";
  log.terminal({ state: result.state, reason: result.reason, ok });
  await log.flush();
  if (ok || parsed.command === "status" || result.state === "aborted") card.succeed(terminal);
  else card.fail(terminal);
}

async function executeCommand(pi: ExtensionAPI, ctx: CommandContext, parsed: RunArgs, state: CardState): Promise<void> {
  const ownsCard = !state.active;
  const card = state.active ?? createActivityCard(ctx.ui, state.profile);
  if (ownsCard) { state.active = card; card.phase(initialLabel(parsed)); }
  const log = createBuckLoopActivityLog({
    cwd: ctx.cwd, command: parsed.command, path: parsed.command === "start" ? parsed.path : undefined,
    onWarning: message => ctx.ui.notify(message, "warning"),
  });
  try {
    const result = await handleLoop({
      cwd: ctx.cwd, command: parsed.command, path: parsed.command === "start" ? parsed.path : undefined,
      deps: liveDeps(pi, ctx, card, log),
    });
    await showResult(result, parsed, card, log);
  } catch (error) {
    const failure = supervisorFailure(ctx.cwd, parsed, error);
    log.terminal({ state: failure.state, reason: failure.error.message, ok: false });
    await log.flush();
    returnFailureToAgent(pi, ctx.ui, failure);
    card.fail(failure.state + ": " + failure.error.message);
  } finally {
    try { await log.close(); }
    finally {
      if (ownsCard || parsed.command === "stop") {
        card.dispose();
        if (state.active === card) state.active = undefined;
      }
    }
  }
}

async function dispatchCommand(pi: ExtensionAPI, ctx: CommandContext, raw: string, state: CardState): Promise<void> {
  const parsed = parseArgs(raw);
  if (!parsed.ok) { ctx.ui.notify(parsed.error, "error"); return; }
  if (parsed.command === "profile") {
    state.profile = parsed.profile;
    state.active?.setProfile(parsed.profile);
    ctx.ui.notify(`buck-loop density: ${parsed.profile}`, "info");
    return;
  }
  await executeCommand(pi, ctx, parsed, state);
}

export function wireBuckLoop(pi: ExtensionAPI): void {
  const state: CardState = { profile: "standard" };
  pi.registerCommand("buck-loop", {
    description: "Run a Buck plan unattended through build → review → iterate/docs/save/commit. Existing plans only.",
    getArgumentCompletions(prefix: string) {
      return FLAGS.filter(flag => flag.startsWith(prefix)).map(flag => ({ value: flag, label: flag }));
    },
    handler: (args: string, ctx: CommandContext) => dispatchCommand(pi, ctx, args, state),
  });
}
