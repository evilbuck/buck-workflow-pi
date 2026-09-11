import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { createActor } from "xstate";
import { createProgress } from "../command-progress.js";
import { createPrManagerMachine } from "./machine.js";
import { listDirtyPaths } from "./git.js";
import { resumeCommand, defaultCliOptions, type CliOptions, type MergeMethod } from "./types.js";

export interface CommandUI {
  notify: (msg: string, level?: "info" | "warning" | "error") => void;
  setStatus?: (key: string, text?: string) => void;
  setWorkingMessage?: (message?: string) => void;
}

export interface ManagerRunDeps {
  cwd: string;
  ui: CommandUI;
  signal?: AbortSignal;
  ownedDirtyPaths?: string[];
  dirtyPaths?: string[];
}

const FLAGS = ["--resume", "--base", "--merge-method", "--initial-delay", "--backoff", "--max-delay", "--max-polls", "--model"];
const activeActors = new Set<{ stop: () => void; send: (event: { type: "CANCEL" }) => void }>();

export function parseManagerArgs(args: string): CliOptions {
  const tokens = args.trim().split(/\s+/).filter(Boolean);
  const overrides: Partial<CliOptions> = {};
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    if (token === "--resume") {
      overrides.resume = true;
      continue;
    }
    if (token === "--base") {
      overrides.base = tokens[++i];
      continue;
    }
    if (token === "--merge-method") {
      overrides.mergeMethod = tokens[++i] as MergeMethod;
      continue;
    }
    if (token === "--model") {
      overrides.model = tokens[++i];
      continue;
    }
    if (token === "--max-polls") {
      overrides.maxPolls = Number(tokens[++i]);
      continue;
    }
    if (!token.startsWith("-")) overrides.pr = token;
  }
  return defaultCliOptions(overrides);
}

export function resolveMergeMethod(input: {
  flag?: MergeMethod;
  saved?: MergeMethod;
  existingAutoMerge?: MergeMethod | null;
  enabled: { squash: boolean; rebase: boolean; merge: boolean };
}): MergeMethod | "ask" {
  if (input.flag) return input.flag;
  if (input.saved) return input.saved;
  if (input.existingAutoMerge) return input.existingAutoMerge;
  const enabled = (["squash", "rebase", "merge"] as const).filter((method) => input.enabled[method]);
  if (enabled.length === 1) return enabled[0]!;
  return "ask";
}

export function mergeMethodNeedsPrompt(choice: MergeMethod | "ask"): boolean {
  return choice === "ask";
}

export async function runPrManager(args: string, deps: ManagerRunDeps): Promise<{
  status: "blocked" | "paused" | "running" | "merged";
  resumeCommand?: string;
  reason?: string;
}> {
  const options = parseManagerArgs(args);
  const prNumber = Number(options.pr ?? 0);
  const blocked = dirtBlock(options, deps, prNumber);
  if (blocked) return blocked;
  return runActor(options, deps, prNumber);
}

function dirtBlock(
  options: CliOptions,
  deps: ManagerRunDeps,
  prNumber: number,
): { status: "blocked"; reason: string; resumeCommand?: string } | null {
  const dirty = deps.dirtyPaths ?? listDirtySafe(deps.cwd);
  const owned = new Set(deps.ownedDirtyPaths ?? []);
  if (!options.resume && dirty.length > 0) {
    deps.ui.notify("Dirty worktree blocks a fresh /b-pr-manager start. Commit, stash, or resume an owned run.", "warning");
    return { status: "blocked", reason: "dirty_worktree" };
  }
  if (options.resume && dirty.some((path) => !owned.has(path))) {
    deps.ui.notify("Unknown dirty paths block resume.", "warning");
    return { status: "blocked", reason: "unknown_dirty_paths", resumeCommand: resumeCommand(prNumber) };
  }
  return null;
}

async function runActor(options: CliOptions, deps: ManagerRunDeps, prNumber: number): Promise<{
  status: "blocked" | "paused" | "running" | "merged";
  resumeCommand?: string;
  reason?: string;
}> {
  const actor = createActor(createPrManagerMachine());
  activeActors.add(actor);
  const progress = createProgress({ ui: deps.ui }, "b-pr-manager");
  const onAbort = () => {
    actor.send({ type: "CANCEL" });
  };
  deps.signal?.addEventListener("abort", onAbort, { once: true });
  try {
    actor.start();
    actor.send({ type: "START", options });
    progress.step(`Managing PR ${options.pr ?? "(current branch)"}`);
    if (deps.signal?.aborted) actor.send({ type: "CANCEL" });
    if (String(actor.getSnapshot().value) !== "paused") return { status: "running" };
    const command = resumeCommand(prNumber);
    deps.ui.notify(`Paused. Resume with ${command}`, "info");
    return { status: "paused", resumeCommand: command };
  } finally {
    deps.signal?.removeEventListener("abort", onAbort);
    progress.clear();
  }
}


function listDirtySafe(cwd: string): string[] {
  try {
    return listDirtyPaths(cwd);
  } catch {
    return [];
  }
}


export function disposeActiveManagers(): void {
  for (const actor of activeActors) {
    actor.send({ type: "CANCEL" });
    actor.stop();
  }
  activeActors.clear();
}

export function wire(pi: ExtensionAPI): void {
  pi.registerCommand("b-pr-manager", {
    description: "Fix valid PR review feedback, rebase, push, auto-merge, and confirm GitHub MERGED",
    getArgumentCompletions(prefix: string) {
      return FLAGS.filter((flag) => flag.startsWith(prefix)).map((flag) => ({ value: flag, label: flag }));
    },
    handler: async (args: string, ctx: { cwd: string; ui: CommandUI; signal?: AbortSignal }) => {
      await runPrManager(args, { cwd: ctx.cwd, ui: ctx.ui, signal: ctx.signal });
    },
  });
}
