/**
 * /buck-loop command surface. Parses args and delegates to the supervisor.
 * Does not invent orchestration.
 */
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { handleLoop, type LoopCommand } from "./loop.js";

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

export function wireBuckLoop(pi: ExtensionAPI): void {
  pi.registerCommand("buck-loop", {
    description:
      "Run a Buck plan unattended through build → review → iterate/docs/save/commit. Existing plans only.",
    getArgumentCompletions(prefix: string) {
      return FLAGS.filter((flag) => flag.startsWith(prefix)).map((flag) => ({ value: flag, label: flag }));
    },
    handler: async (args: string, ctx: { cwd: string; ui: { notify: (message: string, type?: "info" | "warning" | "error") => void } }) => {
      const parsed = parseArgs(args);
      if (!parsed.ok) {
        ctx.ui.notify(parsed.error, "error");
        return;
      }
      const result = await handleLoop({
        cwd: ctx.cwd,
        command: parsed.command,
        path: parsed.command === "start" ? parsed.path : undefined,
      });
      const level = result.state === "blocked" || result.state === "aborted" ? "warning" : "info";
      ctx.ui.notify(`${result.state}: ${result.reason}`, level);
    },
  });
}
