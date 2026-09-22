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
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createActivity, type ActivityUI } from "../extension-activity.js";
import { handleLoop, statusOf, type DirtyTreeRequest, type LoopCommand } from "./loop.js";
import { formatFailureForAgent, serializeCallError, type AgentCallFailure } from "./call-failure.js";

/** Printed when the operator types `/buck-loop` with no args, or mixed flags. */
export const USAGE =
  "Usage: /buck-loop <path-to-plan|phase|subject> | --resume | --status | --stop";

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
  | { ok: false; error: string };

/** The only flags `/buck-loop` accepts. Used for tab-completion and parsing. */
const FLAGS = ["--resume", "--status", "--stop"] as const;

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
 * `ActivityUI` is our own adapter around the host's status line and
 * above-editor widget (`notify`, `setStatus`, `setWidget`). `notify` is
 * required here because we toast parse errors and sendMessage failures
 * even when the live widget is not up.
 */
type BuckLoopUI = ActivityUI & {
  notify: (message: string, type?: "info" | "warning" | "error") => void;
  confirm?: (title: string, message: string, opts?: ExtensionUIDialogOptions) => Promise<boolean>;
};

/** Longest list of paths shown in the confirm dialog before it is elided. */
const DIRTY_SAMPLE = 10;
/** Dirty-tree dialogs fail closed if an RPC client never answers. */
const DIRTY_CONFIRM_TIMEOUT_MS = 30_000;


/**
 * Ask the operator whether the loop may run over uncommitted work.
 *
 * The loop's own `b-commit` step stages everything (`git add -A`), so anything
 * listed here ends up in the loop's commit — that is the consequence the
 * operator is being asked to accept. Print/JSON modes have no UI and deny.
 * RPC exposes a UI proxy, so its dialog must be bounded and fail closed when
 * the client does not implement the dialog-response sub-protocol.
 */
function confirmDirtyTree(ctx: { hasUI?: boolean; ui: BuckLoopUI }) {
  return async ({ mode, paths }: DirtyTreeRequest): Promise<boolean> => {
    if (!ctx.hasUI || !ctx.ui.confirm) return false;
    const shown = paths.slice(0, DIRTY_SAMPLE).map((path) => "  " + path).join("\n");
    const more = paths.length > DIRTY_SAMPLE ? `\n  …and ${paths.length - DIRTY_SAMPLE} more` : "";
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DIRTY_CONFIRM_TIMEOUT_MS);
    try {
      return await ctx.ui.confirm(
        "Uncommitted changes",
        `${paths.length} uncommitted path(s) outside .context/:\n${shown}${more}\n\n` +
          `The loop stages everything before it commits, so these will be included ` +
          `in its commit. ${mode === "resume" ? "Resume" : "Start"} anyway?`,
        { signal: controller.signal, timeout: DIRTY_CONFIRM_TIMEOUT_MS },
      );
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  };
}

/** Short label shown in the progress widget for the current command. */
function initialLabel(parsed: Extract<ParsedArgs, { ok: true }>): string {
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
 * not `console.log`. Options:
 * - `triggerTurn: true` — ask the parent agent to start a new turn.
 * - `deliverAs: "nextTurn"` — deliver as the next user-visible turn,
 *   not as a silent system note.
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
      { triggerTurn: true, deliverAs: "nextTurn" },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    ui.notify("buck-loop could not return the failure to the agent: " + message, "error");
  }
}

/**
 * Build a failure record when `handleLoop` itself throws (not a nested
 * work/choice session). Best-effort: if even reading saved status fails,
 * keep `idle` and still report the original error.
 */
function supervisorFailure(cwd: string, parsed: Extract<ParsedArgs, { ok: true }>, error: unknown): AgentCallFailure {
  let state: AgentCallFailure["state"] = "idle";
  try {
    state = statusOf(cwd).state;
  } catch {
    if (existsSync(join(cwd, ".context/workflow/buck-loop.json"))) state = "blocked";
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

/**
 * Register `/buck-loop` with the coding-agent host.
 *
 * `pi.registerCommand(name, spec)` is how extensions add slash commands.
 * After this returns, typing `/buck-loop` in chat runs `spec.handler`.
 *
 * @param pi - Host plugin API. Created by OMP/Pi, passed in from `extensions/index.ts`.
 */
export function wireBuckLoop(pi: ExtensionAPI): void {
  pi.registerCommand("buck-loop", {
    description:
      "Run a Buck plan unattended through build → review → iterate/docs/save/commit. Existing plans only.",
    /**
     * Tab-completion for the argument box. The host calls this as the
     * operator types; we only complete the three flags, not filesystem paths.
     */
    getArgumentCompletions(prefix: string) {
      return FLAGS.filter((flag) => flag.startsWith(prefix)).map((flag) => ({ value: flag, label: flag }));
    },
    /**
     * Runs once per `/buck-loop` invocation.
     *
     * @param args - Raw text after `/buck-loop` (not pre-parsed).
     * @param ctx.cwd - Project directory the operator's session is in.
     * @param ctx.hasUI - True for interactive and RPC UI proxies; false in print/JSON mode.
     * @param ctx.ui - Host UI: toasts, status pill, live widget, confirm dialog.
     */
    handler: async (args: string, ctx: { cwd: string; hasUI?: boolean; ui: BuckLoopUI }) => {
      const parsed = parseArgs(args);
      if (!parsed.ok) {
        ctx.ui.notify(parsed.error, "error");
        return;
      }

      // Live 6-line progress footer in the chat. `phase` sets the spinner
      // label; `ingest` appends nested-session tool/text events; `succeed` /
      // `fail` freeze the widget; `dispose` always runs so the spinner cannot leak.
      const activity = createActivity({ ui: ctx.ui, command: "buck-loop", maxActivityLines: 6, maxLineWidth: 64 });
      activity.phase(initialLabel(parsed));
      try {
        const result = await handleLoop({
          cwd: ctx.cwd,
          command: parsed.command,
          path: parsed.command === "start" ? parsed.path : undefined,
          deps: {
            onProgress: (progress) => activity.phase(progress.label),
            onActivity: activity.ingest,
            confirmDirty: confirmDirtyTree(ctx),
            onFailure: (failure) => {
              activity.ingest({
                kind: "toolEnd",
                tool: failure.agent?.role ?? failure.operation,
                ok: false,
                message: failure.error.message,
              });
              returnFailureToAgent(pi, ctx.ui, failure);
            },
          },
        });
        const terminal = result.state + ": " + result.reason;
        if (result.state === "blocked" || result.state === "aborted") activity.fail(terminal);
        else activity.succeed(terminal);
      } catch (error) {
        const failure = supervisorFailure(ctx.cwd, parsed, error);
        returnFailureToAgent(pi, ctx.ui, failure);
        activity.fail(failure.state + ": " + failure.error.message);
      } finally {
        activity.dispose();
      }
    },
  });
}
