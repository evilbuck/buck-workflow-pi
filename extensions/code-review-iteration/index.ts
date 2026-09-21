/**
 * code-review-iteration — OMP command wiring.
 *
 * `/code-review` runs the bounded isolated review loop (see loop.ts) with
 * real OMP model sessions: the Reviewer gets read/search tools plus the
 * policy-gated `review_exec` custom tool in a disposable detached worktree;
 * the Fixer gets read/edit/search tools in the mutable checkout. Progress
 * streams through the shared activity surface. The user's main agent
 * context is never filled with review transcripts.
 */

import { readFileSync, existsSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { AuthStorage, ModelRegistry, type ExtensionAPI, type ToolDefinition } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { createActivity, type Activity, type ActivityUI } from "../extension-activity.js";
import {
  DIFFICULTY_TO_ROLE,
  ompAgentDir,
  readOmpModelRoles,
  resolveOmpRole,
  runOmpModelSession,
  type ActivityEvent,
} from "../omp-models.js";
import { loadCatalog, type CatalogLoad } from "./catalog.js";
import { loadPersonas, resolveReviewerModel, resolveTemperature, type Persona } from "./prompts.js";
import { runReviewLoop, type LoopDeps, type LoopOptions, type LoopResult } from "./loop.js";
import type { Hardness } from "./rubric.js";
import { execFileCaptured } from "../subprocess.js";
import {
  runReviewCommand,
  parseExecPolicy,
  readOnlyGitCommands,
  checkContractCommands,
  type CommandRecord,
  type ExecPolicy,
  type ReviewExecRequest,
} from "./policy.js";
import { currentBranch, gitCommonDir } from "./git-ops.js";
import { listRuns } from "./run-state.js";
import { openHostModelRegistry, type HostAuthStorage, type HostModelRegistry } from "./model-registry.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const MODELS_DIR = join(HERE, "models");
const PERSONAS_DIR = join(HERE, "personas");
const REVIEWER_GUIDANCE = join(HERE, "prompts", "reviewer.md");
const EXEC_POLICY_FILE = join(HERE, "review-exec-policy.md");

const REVIEWER_TOOLS = ["read", "grep", "find", "ls", "review_exec"];
const FIXER_TOOLS = ["read", "edit", "grep", "find", "ls"];
const SESSION_TIMEOUT_MS = 15 * 60_000;

interface CommandUI extends ActivityUI {
  notify: (message: string, level?: "info" | "warning" | "error") => void;
  select?: (title: string, options: string[]) => Promise<string | undefined>;
}

export interface ParsedArgs {
  base?: string;
  persona?: string;
  reviewerModel?: string;
  reviewerRole?: string;
  reviewerTemperature?: number;
  fixerModel?: string;
  fixerRole?: string;
  context?: string;
  replaceReviewerPrompt?: string;
  minBlocking: "medium" | "high" | "critical";
  maxPasses: number;
  resume: boolean;
  prune: boolean;
}

function argumentTokens(args: string): string[] {
  return args
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .flatMap((token) => {
      const eq = token.match(/^(--[a-z-]+)=(.*)$/);
      return eq ? [eq[1], eq[2]] : [token];
    });
}

function argumentValue(tokens: string[], flag: string): string | undefined {
  const index = tokens.indexOf(`--${flag}`);
  const value = tokens[index + 1];
  return index === -1 || !value || value.startsWith("--") ? undefined : value;
}

function textArgument(tokens: string[], flag: string): string | undefined {
  const value = argumentValue(tokens, flag);
  if (!value || !value.startsWith("@")) return value;
  try {
    return readFileSync(value.slice(1), "utf-8");
  } catch {
    throw new Error(`--${flag}: cannot read ${value}`);
  }
}

function boundedNumber(value: string | undefined, flag: string, lower: number, upper: number, integer = false): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < lower || parsed > upper || (integer && !Number.isInteger(parsed))) {
    throw new Error(`--${flag} must be ${integer ? "an integer " : ""}${lower}–${upper}`);
  }
  return parsed;
}

function blockingValue(value: string | undefined): ParsedArgs["minBlocking"] {
  if (value === undefined) return "medium";
  if (!["medium", "high", "critical"].includes(value)) throw new Error("--min-blocking must be medium, high, or critical");
  return value as ParsedArgs["minBlocking"];
}

/** `--flag value`, `--flag=value`, `--text`/`@file` for long strings. */
export function parseArgs(args: string): ParsedArgs {
  const tokens = argumentTokens(args);
  return {
    base: argumentValue(tokens, "base"),
    persona: argumentValue(tokens, "persona"),
    reviewerModel: argumentValue(tokens, "reviewer-model"),
    reviewerRole: argumentValue(tokens, "reviewer-role"),
    reviewerTemperature: boundedNumber(argumentValue(tokens, "reviewer-temperature"), "reviewer-temperature", 0, 2),
    fixerModel: argumentValue(tokens, "fixer-model"),
    fixerRole: argumentValue(tokens, "fixer-role"),
    context: textArgument(tokens, "context"),
    replaceReviewerPrompt: textArgument(tokens, "replace-reviewer-prompt"),
    minBlocking: blockingValue(argumentValue(tokens, "min-blocking")),
    maxPasses: boundedNumber(argumentValue(tokens, "max-passes"), "max-passes", 1, 10, true) ?? 3,
    resume: !tokens.includes("--no-resume") && !tokens.includes("--fresh"),
    prune: tokens.includes("--prune"),
  };
}

function loadExecPolicyWithBuiltins(cwd: string): { policy: ExecPolicy; skipped: string[] } {
  const file = existsSync(EXEC_POLICY_FILE)
    ? parseExecPolicy(readFileSync(EXEC_POLICY_FILE, "utf-8"))
    : { defaultTimeoutMs: 120_000, defaultMaxOutputBytes: 65_536, allowNetwork: true, commands: [] };
  const contract = readCheckContractCommands(cwd);
  const { entries, skipped } = checkContractCommands(contract);
  return {
    policy: { ...file, commands: [...file.commands, ...readOnlyGitCommands(), ...entries] },
    skipped,
  };
}

/** Deterministic check contract (guardrails.json ecosystems), repo-local. */
export function readCheckContractCommands(cwd: string): string[] {
  const path = join(cwd, "guardrails.json");
  if (!existsSync(path)) return ["npm test"];
  try {
    const parsed = JSON.parse(readFileSync(path, "utf-8")) as {
      ecosystems?: Array<{ test_runner?: string | null; functional_test_cmd?: string | null }>;
    };
    if (!parsed.ecosystems) return ["npm test"];
    const commands: string[] = [];
    for (const ecosystem of parsed.ecosystems) {
      if (ecosystem.test_runner) commands.push(ecosystem.test_runner);
      if (ecosystem.functional_test_cmd) commands.push(ecosystem.functional_test_cmd);
    }
    return commands;
  } catch {
    return ["npm test"];
  }
}

const ReviewExecParams = Type.Object({
  id: Type.String({ description: "policy command id, e.g. git-status" }),
  argv: Type.Array(Type.String({ description: "full argv including the executable as argv[0]" })),
  cwd: Type.Optional(Type.String({ description: "repo-relative working directory" })),
});

export function reviewExecTool(
  onCommand: (request: ReviewExecRequest) => Promise<CommandRecord>,
): ToolDefinition<typeof ReviewExecParams> {
  return {
    name: "review_exec",
    label: "review_exec",
    description:
      "Run one allowlisted command for reproduction evidence. Provide a policy command id, the FULL argv (argv[0] must be the policy executable), and an optional repo-relative cwd. Returns a bounded record with an evidence_id you may cite in findings.",
    promptSnippet: "review_exec: run allowlisted reproduction commands (id, argv, cwd).",
    parameters: ReviewExecParams,
    async execute(_toolCallId, params) {
      const request: ReviewExecRequest = { id: params.id, argv: params.argv, cwd: params.cwd };
      const record = await onCommand(request);
      const summary = {
        evidence_id: record.evidence_id,
        command_id: record.command_id,
        exit_code: record.exit_code,
        signal: record.signal,
        timed_out: record.timed_out,
        denied_reason: record.denied_reason,
        stdout_excerpt: record.stdout_excerpt,
        stderr_excerpt: record.stderr_excerpt,
        stdout_truncated: record.stdout_truncated,
        stderr_truncated: record.stderr_truncated,
        network_exposed: record.network_exposed,
      };
      return { content: [{ type: "text", text: JSON.stringify(summary) }], details: summary };
    },
  };
}

function selectedPersona(personas: Map<string, Persona>, requested: string | undefined): Persona | null {
  return personas.get(requested ?? "balanced") ?? null;
}

function reportConfigurationWarnings(
  errors: string[],
  skipped: string[],
  requestedPersona: string | undefined,
  persona: Persona | null,
  notify: CommandUI["notify"],
): void {
  for (const error of errors) notify(`persona: ${error}`, "error");
  if (skipped.length > 0) notify(`check-contract commands skipped (shell syntax): ${skipped.join(", ")}`, "warning");
  if (!requestedPersona && !persona) notify("No --persona given and no balanced persona found; using replacement-style prompt.", "warning");
}

async function selectUntracked(ui: CommandUI, paths: string[]): Promise<string[]> {
  if (paths.length === 0) {
    ui.notify("No untracked files.", "info");
    return [];
  }
  if (!ui.select) {
    ui.notify(`Untracked files included in the reviewed checkpoint (non-interactive): ${paths.join(", ")}`, "info");
    return paths;
  }
  const included: string[] = [];
  for (const path of paths) {
    const choice = await ui.select(`Include untracked file in the reviewed checkpoint?\n${path}`, [
      "Include (preselected)",
      "Exclude",
    ]);
    if (choice !== "Exclude") included.push(path);
  }
  ui.notify(`Untracked files included in the reviewed checkpoint: ${included.length}/${paths.length}`, "info");
  return included;
}

function fallbackModel(cwd: string, tier: Hardness): string | null {
  for (const role of DIFFICULTY_TO_ROLE[tier]) {
    const model = resolveOmpRole(cwd, role);
    if (model) return model;
  }
  return resolveOmpRole(cwd, "default") ?? null;
}

async function registeredModelSelectors(): Promise<{ selectors: Set<string>; enumerated: boolean }> {
  // Pi types declare static create; OMP's aliased class only has a constructor.
  const hostModelRegistry = ModelRegistry as unknown as HostModelRegistry;
  const hostAuthStorage = AuthStorage as unknown as HostAuthStorage;
  const registry = await openHostModelRegistry(hostModelRegistry, hostAuthStorage, ompAgentDir());
  if (!registry) return { selectors: new Set(), enumerated: false };
  return {
    selectors: new Set(registry.getAvailable().map((model) => `${model.provider}/${model.id}`)),
    enumerated: true,
  };
}

async function intersectCatalogSelectors(catalog: CatalogLoad, notify: CommandUI["notify"]): Promise<Set<string>> {
  const { selectors: registered, enumerated } = await registeredModelSelectors();
  if (!enumerated) {
    notify("Could not enumerate registered models; role fallbacks remain available.", "warning");
    return new Set();
  }
  const selectors = new Set(catalog.entries.map((entry) => entry.selector).filter((selector) => registered.has(selector)));
  if (selectors.size === 0) notify("No catalog model has configured live authentication; role fallbacks remain available.", "warning");
  return selectors;
}

function makeDeps(cwd: string, parsed: ParsedArgs, activity: Activity, ui: CommandUI): LoopDeps {
  const notify = ui.notify;
  const personaLoad = loadPersonas(PERSONAS_DIR);
  const baseGuidanceText = existsSync(REVIEWER_GUIDANCE)
    ? readFileSync(REVIEWER_GUIDANCE, "utf-8")
    : "";
  const persona = selectedPersona(personaLoad.personas, parsed.persona);
  const catalog = loadCatalog(MODELS_DIR);
  const { policy, skipped } = loadExecPolicyWithBuiltins(cwd);
  reportConfigurationWarnings(personaLoad.errors, skipped, parsed.persona, persona, notify);

  return {
    async runReviewerSession(opts) {
      return runOmpModelSession({
        cwd: opts.cwd,
        tools: REVIEWER_TOOLS,
        prompt: opts.prompt,
        modelOverride: opts.model ?? undefined,
        temperature: opts.temperature ?? undefined,
        thinkingLevel: opts.thinkingLevel ?? undefined,
        timeoutMs: SESSION_TIMEOUT_MS,
        agentPrefix: "code-review-reviewer",
        customTools: [reviewExecTool(opts.onCommand)],
        onActivity: (event: ActivityEvent) => activity.ingest(event),
      });
    },
    async runFixerSession(opts) {
      return runOmpModelSession({
        cwd: opts.cwd,
        tools: FIXER_TOOLS,
        prompt: opts.prompt,
        modelOverride: opts.model ?? undefined,
        thinkingLevel: opts.thinkingLevel ?? undefined,
        timeoutMs: SESSION_TIMEOUT_MS,
        agentPrefix: "code-review-fixer",
        onActivity: (event: ActivityEvent) => activity.ingest(event),
      });
    },
    async execReviewCommand(root, request, seq) {
      const record = await runReviewCommand(policy, root, request);
      record.evidence_id = `c${seq}`;
      return record;
    },
    async runChecks(checkCwd) {
      // Same filter as the Reviewer policy: shell-syntax command strings are
      // skipped with a warning, never guessed at with a whitespace split.
      const { entries, skipped } = checkContractCommands(readCheckContractCommands(checkCwd));
      for (const raw of skipped) notify(`Check command skipped (shell syntax is not auto-mapped): ${raw}`, "warning");
      const entry = entries[0];
      if (!entry) return { command: "(no runnable check command)", exitCode: null, passed: true };
      const result = await execFileCaptured(entry.executable, [...entry.argvPrefix], checkCwd);
      return { command: [entry.executable, ...entry.argvPrefix].join(" "), exitCode: result.code, passed: result.code === 0 };
    },
    async availableSelectors() {
      return intersectCatalogSelectors(catalog, notify);
    },
    fixerFallbackModel(tier: Hardness): string | null {
      return fallbackModel(cwd, tier);
    },
    loadCatalog: () => catalog,
    baseGuidance: () => baseGuidanceText,
    persona: () => persona,
    untrackedSelection(paths) {
      return selectUntracked(ui, paths);
    },
    notify,
    contextDir(checkCwd) {
      return join(checkCwd, ".context");
    },
  };
}

function pruneRuntime(cwd: string, notify: CommandUI["notify"]): void {
  const runs = listRuns(gitCommonDir(cwd), currentBranch(cwd));
  const active = runs.filter((run) => run.state.status === "running");
  if (active.length > 0) {
    notify(`Refusing to prune ${active.length} running review run(s); resume or cancel them first.`, "warning");
    return;
  }
  for (const run of runs) rmSync(run.dir, { recursive: true, force: true });
  notify(runs.length === 0 ? "No code-review runtime artifacts to prune." : `Pruned ${runs.length} code-review runtime artifact(s).`, "info");
}

function initialLoopOptions(parsed: ParsedArgs): LoopOptions {
  return {
    base: parsed.base,
    reviewerModel: undefined,
    reviewerRole: parsed.reviewerRole,
    reviewerTemperature: parsed.reviewerTemperature,
    fixerModel: parsed.fixerModel,
    personaName: parsed.persona ?? "balanced",
    appendContext: parsed.context,
    replacementGuidance: parsed.replaceReviewerPrompt,
    minBlocking: parsed.minBlocking,
    maxPasses: parsed.maxPasses,
    resume: parsed.resume,
  };
}

function resolveLoopOptions(
  cwd: string,
  parsed: ParsedArgs,
  deps: LoopDeps,
  options: LoopOptions,
  notify: CommandUI["notify"],
): string {
  const persona = deps.persona();
  const resolution = resolveReviewerModel({
    explicitModel: parsed.reviewerModel,
    explicitRole: parsed.reviewerRole,
    personaDefault: persona?.defaultModel ?? null,
    ompRoles: readOmpModelRoles(cwd),
  });
  if (resolution.model) options.reviewerModel = resolution.model;
  if (!options.fixerModel && parsed.fixerRole) {
    const fixerModel = resolveOmpRole(cwd, parsed.fixerRole);
    if (fixerModel) options.fixerModel = fixerModel;
    else notify(`No OMP model role ${parsed.fixerRole} is configured; fixer fallback selection will apply.`, "warning");
  }
  const temperature = resolveTemperature(parsed.reviewerTemperature, persona);
  if (temperature !== null) options.reviewerTemperature = temperature;
  return `Reviewer: ${resolution.model ?? "session default"} (${resolution.source})${temperature !== null ? ` @ ${temperature}` : ""} · persona ${options.personaName}`;
}

function reportLoopResult(activity: Activity, result: LoopResult): void {
  if (result.status === "clean") {
    activity.succeed(`✅ Review loop clean — report: ${result.reportPath ?? "(write failed)"}`);
    return;
  }
  activity.fail(`Review loop ended ${result.status}; runtime retained for resume. Report: ${result.reportPath ?? "(write failed)"}`);
}

async function runCodeReview(args: string, ctx: { cwd: string; ui: CommandUI }): Promise<void> {
  const activity = createActivity({ ui: ctx.ui, command: "code-review" });
  let parsed: ParsedArgs;
  try {
    parsed = parseArgs(args);
  } catch (e: unknown) {
    ctx.ui.notify(`Invalid arguments: ${(e as Error).message}`, "error");
    activity.dispose();
    return;
  }
  try {
    if (parsed.prune) {
      pruneRuntime(ctx.cwd, ctx.ui.notify);
      return;
    }
    const options = initialLoopOptions(parsed);
    const deps = makeDeps(ctx.cwd, parsed, activity, ctx.ui);
    ctx.ui.notify(resolveLoopOptions(ctx.cwd, parsed, deps, options, ctx.ui.notify), "info");
    reportLoopResult(activity, await runReviewLoop(deps, ctx.cwd, options));
  } catch (e: unknown) {
    activity.fail(`Review loop crashed: ${(e as Error).message}`);
  } finally {
    activity.dispose();
  }
}

export function wire(pi: ExtensionAPI): void {
  pi.registerCommand("code-review", {
    description:
      "Isolated review→fix→re-review loop: fresh Reviewer + Fixer sessions, policy-gated reproduction, checkpoint commits, bounded passes",
    getArgumentCompletions(prefix: string) {
      return [
        "--persona", "--reviewer-model", "--reviewer-role", "--reviewer-temperature",
        "--fixer-model", "--fixer-role", "--base", "--context", "--replace-reviewer-prompt",
        "--min-blocking", "--max-passes", "--no-resume", "--prune",
      ]
        .filter((option) => option.startsWith(prefix))
        .map((option) => ({ value: option, label: option }));
    },
    handler: async (args: string, ctx: { cwd: string; ui: CommandUI }) => {
      await runCodeReview(args, ctx);
    },
  });
}
