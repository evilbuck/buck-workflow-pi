/**
 * /buck-loop command surface. Parses args and delegates to the supervisor.
 * Does not invent orchestration.
 */
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { createActivity, type ActivityUI } from "../extension-activity.js";
import { handleLoop, statusOf, type LoopCommand } from "./loop.js";
import { formatFailureForAgent, serializeCallError, type AgentCallFailure } from "./call-failure.js";

export const USAGE =
  "Usage: /buck-loop <path-to-plan|phase|subject> | --resume | --status | --stop";

export type ParsedArgs =
  | { ok: true; command: "start"; path: string }
  | { ok: true; command: Exclude<LoopCommand, "start"> }
  | { ok: false; error: string };

const FLAGS = ["--resume", "--status", "--stop"] as const;

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

type BuckLoopUI = ActivityUI & {
  notify: (message: string, type?: "info" | "warning" | "error") => void;
};

function initialLabel(parsed: Extract<ParsedArgs, { ok: true }>): string {
  if (parsed.command === "start") return "Starting " + parsed.path;
  if (parsed.command === "resume") return "Resuming saved run";
  if (parsed.command === "status") return "Reading loop status";
  return "Stopping saved run";
}

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

function supervisorFailure(cwd: string, parsed: Extract<ParsedArgs, { ok: true }>, error: unknown): AgentCallFailure {
  let state: AgentCallFailure["state"] = "idle";
  try {
    state = statusOf(cwd).state;
  } catch {
    // The original supervisor error remains the actionable failure.
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
export function wireBuckLoop(pi: ExtensionAPI): void {
  pi.registerCommand("buck-loop", {
    description:
      "Run a Buck plan unattended through build → review → iterate/docs/save/commit. Existing plans only.",
    getArgumentCompletions(prefix: string) {
      return FLAGS.filter((flag) => flag.startsWith(prefix)).map((flag) => ({ value: flag, label: flag }));
    },
    handler: async (args: string, ctx: { cwd: string; ui: BuckLoopUI }) => {
      const parsed = parseArgs(args);
      if (!parsed.ok) {
        ctx.ui.notify(parsed.error, "error");
        return;
      }

      const activity = createActivity({ ui: ctx.ui, command: "buck-loop" });
      activity.phase(initialLabel(parsed));
      try {
        const result = await handleLoop({
          cwd: ctx.cwd,
          command: parsed.command,
          path: parsed.command === "start" ? parsed.path : undefined,
          deps: {
            onProgress: (progress) => activity.phase(progress.label),
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
