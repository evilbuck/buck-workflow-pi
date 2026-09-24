/**
 * Nested work session: spawn a **child** coding agent to run one Buck skill.
 *
 * This is how `/buck-loop` actually edits the repo. The supervisor
 * (`loop.ts`) never writes application code itself. Instead it calls
 * {@link runStep}, which:
 *
 * 1. Loads the canonical skill markdown (`skills/b-build/SKILL.md`, etc.).
 * 2. Starts a nested coding-agent session via `createAgentSession` — a
 *    host SDK call that creates a child agent with its own tools, model,
 *    and chat history, inside the same process.
 * 3. Sends the skill text plus the plan/phase path as the child's prompt.
 * 4. Aborts after {@link WORK_SESSION_IDLE_TIMEOUT_MS} without child activity; productive sessions keep running.
 * 5. Returns `{ ok, text }`. It does **not** decide the next loop state.
 *    The supervisor rescans disk to see what actually landed.
 *
 * Important host options (why they are set this way):
 *
 * - `disableExtensionDiscovery: true` — the child cannot see `/buck-loop`,
 *   so it cannot recurse.
 * - `restrictToolNames: true` plus a per-skill allowlist — the child only
 *   gets the tools that skill needs (review has `bash`, so it also gets
 *   `edit` to refine `iterate-*.md`; commit cannot `write` files).
 * - `enableMCP: false` / `enableLsp: false` — no extra plugins.
 * - `SessionManager.inMemory` — the child's transcript is not written to
 *   the operator's session history on disk.
 * - `modelPattern` and `thinkingLevel` come from the configured Buck stage
 *   via the parent-side picker. Difficulty does not select a model.
 *
 * The child is told it has no authority to choose the next loop state.
 */
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { AuthStorage, ModelRegistry, createAgentSession, SessionManager } from "@mariozechner/pi-coding-agent";
import { createBuckModelPicker, type BuckModelPick, type BuckModelPickInput } from "../buck-models/picker.js";
import { openHostModelRegistry } from "../code-review-iteration/model-registry.js";
import {
  EmptyModelResponseError,
  formatBuckStop,
  globalOmpConfigPath,
  lastAssistantText,
  normalizeActivityEvent,
  ompAgentDir,
  parseBuckModels,
  projectOmpConfigPath,
  resolveBuckStage,
  type ActivityEvent,
  type BuckModelsConfig,
  type BuckStageKey,
  type BuckThinking,
} from "../omp-models.js";
import { serializeCallError, type CallAgent, type CallFailureDetails } from "./call-failure.js";

/** Buck skill the child is assigned. `b-build-hard` is the same skill file as `b-build` with a harder prompt. */
export type NestedSkill =
  | "b-build"
  | "b-build-hard"
  | "b-review"
  | "b-iterate"
  | "b-docs"
  | "b-howto"
  | "b-save"
  | "b-commit";

/** Nested skill → pinned stage group. `b-build-hard` shares `build`; it is not a model tier. */
export const STAGE_BY_SKILL: Record<NestedSkill, BuckStageKey> = {
  "b-build": "build",
  "b-build-hard": "build",
  "b-review": "review",
  "b-iterate": "iterate",
  "b-docs": "docs",
  "b-howto": "docs",
  "b-save": "save",
  "b-commit": "commit",
};

export type BuckStageModelChoice =
  | { ok: true; id: string; thinking: BuckThinking }
  | { ok: false; message: string };

export type BuckStageModelRequest = {
  cwd: string;
  stage: BuckStageKey;
  skill: string;
  context: unknown;
  exclude?: readonly string[];
};

export type StageModelDeps = {
  readConfigs?: (cwd: string) => { project: BuckModelsConfig | null; global: BuckModelsConfig | null };
  availableIds?: () => Promise<ReadonlySet<string>>;
  pick?: (input: BuckModelPickInput) => Promise<BuckModelPick>;
};

/** Picker input for one nested attempt. `difficulty` is context only. */
export type WorkModelSelectInput = {
  cwd: string;
  stage: BuckStageKey;
  skill: NestedSkill;
  planOrPhasePath: string;
  body: string;
  difficulty?: string;
  exclude: readonly string[];
};

/** Outcome of one nested session. `text` is the child's last assistant message. */
export type RunStepResult = {
  ok: boolean;
  text: string;
  failure?: CallFailureDetails;
};

/** Abort after 15 minutes without SDK activity; productive sessions have no fixed wall-clock limit. */
export const WORK_SESSION_IDLE_TIMEOUT_MS = 15 * 60_000;

/** Skill markdown, relative to `skills/`. Commit uses `git-commit`, not a `b-commit` file. */
const skillPaths: Record<NestedSkill, string> = {
  "b-build": "b-build/SKILL.md",
  "b-build-hard": "b-build/SKILL.md",
  "b-review": "b-review/SKILL.md",
  "b-iterate": "b-iterate/SKILL.md",
  "b-docs": "b-docs/SKILL.md",
  "b-howto": "b-howto/SKILL.md",
  "b-save": "b-save/SKILL.md",
  "b-commit": "git-commit/SKILL.md",
};

/** Host tool names the child may call. Names match the coding-agent tool registry. */
const toolsBySkill: Record<NestedSkill, string[]> = {
  "b-build": ["read", "edit", "write", "grep", "bash"],
  "b-build-hard": ["read", "edit", "write", "grep", "bash"],
  "b-review": ["read", "edit", "write", "grep", "find", "ls", "bash"],
  "b-iterate": ["read", "edit", "write", "grep", "bash"],
  "b-docs": ["read", "edit", "write", "grep", "bash"],
  "b-howto": ["read", "edit", "write", "grep", "bash"],
  "b-save": ["read", "edit", "write", "grep", "bash"],
  "b-commit": ["read", "bash"],
};

/**
 * The subset of the host session object we touch.
 *
 * `createAgentSession` returns a live child agent. We only need:
 * - `prompt` — send the skill assignment and wait until the child finishes.
 * - `abort` — kill it on timeout.
 * - `subscribe` — stream tool/text events into the live progress widget.
 * - `dispose` — free the child when we are done (success or failure).
 * - `messages` — read the last assistant text and stop reason.
 */
type SessionHandle = {
  prompt: (text: string) => Promise<unknown>;
  abort: () => Promise<unknown> | unknown;
  subscribe: (listener: (event: unknown) => void) => () => void;
  dispose?: () => Promise<unknown> | unknown;
  messages: Array<{ role?: string; content?: unknown; stopReason?: unknown }>;
};

/** Read the skill file shipped in this repo. Empty file is a hard failure. */
function loadSkill(skill: NestedSkill): string {
  const path = fileURLToPath(new URL(`../../skills/${skillPaths[skill]}`, import.meta.url));
  const body = readFileSync(path, "utf8");
  if (!body.trim()) throw new Error(`Canonical skill is empty: ${path}`);
  return body;
}

/** Skill body first, then a hard boundary: the child may not choose the next loop state. */
function promptFor(skill: NestedSkill, skillBody: string, planOrPhasePath: string): string {
  const hardVariant = skill === "b-build-hard" ? "\nThis is the hard variant of b-build.\n" : "";
  const checkpointInstruction = skill === "b-commit"
    ? "\nThe operator invoked /buck-loop on a non-protected branch. Commit only the staged loop checkpoint. Do not use force and do not commit if the branch is protected.\n"
    : "\nBefore returning, stage only files you created or modified for this assignment. Never stage pre-existing or unrelated changes. Report a failure if your files cannot be staged.\n";
  return `${skillBody}\n\n---\n\nYou are executing nested work for the exact plan or phase path: ${planOrPhasePath}.\n${hardVariant}${checkpointInstruction}You have no authority to choose the next loop state. Complete only the assigned work and report the result to the supervisor.`;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function assistantStopReason(messages: SessionHandle["messages"]): unknown {
  return [...messages].reverse().find((message) => message.role === "assistant")?.stopReason;
}

/**
 * Run one nested skill session and return whether it finished with text.
 *
 * Model and thinking come from the stage picker. A failed host call excludes
 * that id and picks again. Recovered assistant text is kept. Difficulty is
 * picker context only.
 */
export async function runStep(opts: {
  cwd: string;
  skill: NestedSkill;
  planOrPhasePath: string;
  /** Present only when the plan or phase file has a `difficulty:` key. */
  difficulty?: string;
  onActivity?: (event: ActivityEvent) => void;
  select?: (input: WorkModelSelectInput) => Promise<BuckStageModelChoice>;
}): Promise<RunStepResult> {
  let skillBody: string;
  try {
    skillBody = loadSkill(opts.skill);
  } catch (error) {
    return {
      ok: false,
      text: errorText(error),
      failure: { prompt: null, agent: null, error: serializeCallError(error) },
    };
  }

  const prompt = promptFor(opts.skill, skillBody, opts.planOrPhasePath);
  const stage = STAGE_BY_SKILL[opts.skill];
  const body = planBody(opts.cwd, opts.planOrPhasePath);
  const excluded: string[] = [];
  let last: RunStepResult = {
    ok: false,
    text: `buckModels stage "${stage}" was not attempted`,
    failure: {
      prompt,
      agent: { kind: "work-session", id: "buck-loop-work-unstarted", role: opts.skill },
      error: serializeCallError({ name: "BuckModelStop", message: `buckModels stage "${stage}" was not attempted` }),
    },
  };

  for (let attempt = 0; attempt < 32; attempt += 1) {
    const picked = await (opts.select ?? defaultWorkSelect)({
      cwd: opts.cwd,
      stage,
      skill: opts.skill,
      planOrPhasePath: opts.planOrPhasePath,
      body,
      ...(opts.difficulty === undefined ? {} : { difficulty: opts.difficulty }),
      exclude: [...excluded],
    });
    if (!picked.ok) return stopResult(prompt, opts.skill, stage, withLast(picked.message, last));
    if (excluded.includes(picked.id)) {
      return stopResult(prompt, opts.skill, stage, withLast(`buckModels stage "${stage}" repeated failed model "${picked.id}"`, last));
    }
    const agent: CallAgent = {
      kind: "work-session",
      id: "buck-loop-work-" + randomUUID(),
      role: opts.skill,
      model: picked.id,
    };
    const ran = await runOneSession(opts, prompt, agent, picked);
    if (ran.retain) return ran.result;
    excluded.push(picked.id);
    last = ran.result;
  }
  return stopResult(prompt, opts.skill, stage, `buckModels stage "${stage}" exhausted model attempts; last: ${last.text}`);
}

function withLast(message: string, last: RunStepResult): string {
  if (last.text.includes("was not attempted")) return message;
  return `${message}; last session: ${last.text}`;
}

function stopResult(prompt: string, skill: NestedSkill, stage: BuckStageKey, message: string): RunStepResult {
  const named = message.includes(`"${stage}"`) ? message : `${message} (stage "${stage}")`;
  return {
    ok: false,
    text: named,
    failure: {
      prompt,
      agent: { kind: "work-session", id: "buck-loop-work-stopped", role: skill },
      error: serializeCallError({ name: "BuckModelStop", message: named }),
    },
  };
}

async function defaultWorkSelect(input: WorkModelSelectInput): Promise<BuckStageModelChoice> {
  return selectBuckStageModel({
    cwd: input.cwd,
    stage: input.stage,
    skill: input.skill,
    context: {
      planOrPhasePath: input.planOrPhasePath,
      body: input.body,
      ...(input.difficulty === undefined ? {} : { difficulty: input.difficulty }),
    },
    exclude: input.exclude,
  });
}

export async function selectBuckStageModel(
  request: BuckStageModelRequest,
  deps: StageModelDeps = {},
): Promise<BuckStageModelChoice> {
  const configs = (deps.readConfigs ?? readBuckConfigs)(request.cwd);
  const availableIds = await (deps.availableIds ?? currentAvailableIds)();
  const resolution = resolveBuckStage({
    project: configs.project,
    global: configs.global,
    stage: request.stage,
    availableIds,
  });
  if (!resolution.ok) return { ok: false, message: nameStage(request.stage, formatBuckStop(resolution.stop)) };
  const pick = await (deps.pick ?? ((input: BuckModelPickInput) => createBuckModelPicker().pick(input)))({
    resolution,
    skill: request.skill,
    context: request.context,
    exclude: request.exclude,
  });
  if (!pick.ok) return { ok: false, message: nameStage(request.stage, formatBuckStop(pick.stop)) };
  return { ok: true, id: pick.id, thinking: pick.thinking };
}

function nameStage(stage: string, message: string): string {
  return message.includes(`"${stage}"`) ? message : `${message} (stage "${stage}")`;
}

function readBuckConfigs(cwd: string): { project: BuckModelsConfig | null; global: BuckModelsConfig | null } {
  const read = (path: string): BuckModelsConfig | null => {
    if (!existsSync(path)) return null;
    return parseBuckModels(readFileSync(path, "utf8"));
  };
  return { project: read(projectOmpConfigPath(cwd)), global: read(globalOmpConfigPath()) };
}

async function currentAvailableIds(): Promise<ReadonlySet<string>> {
  const registry = await openHostModelRegistry(ModelRegistry, AuthStorage, ompAgentDir());
  if (!registry) return new Set();
  return new Set(registry.getAvailable().map((model) => `${model.provider}/${model.id}`));
}

function planBody(cwd: string, rel: string): string {
  const abs = resolve(cwd, rel);
  if (!existsSync(abs)) return "";
  return readFileSync(abs, "utf8");
}

type SessionAttempt = { retain: boolean; result: RunStepResult };

async function runOneSession(
  opts: { cwd: string; skill: NestedSkill; onActivity?: (event: ActivityEvent) => void },
  prompt: string,
  agent: CallAgent,
  picked: { id: string; thinking: BuckThinking },
): Promise<SessionAttempt> {
  const fail = (error: unknown, text = errorText(error)): RunStepResult => ({
    ok: false,
    text,
    failure: { prompt, agent, error: serializeCallError(error) },
  });
  let session: SessionHandle | undefined;
  let unsubscribe: (() => void) | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let outcome: RunStepResult;
  try {
    const sessionOpts: Parameters<typeof createAgentSession>[0] & {
      agentDir?: string;
      modelPattern?: string;
      toolNames?: string[];
      restrictToolNames?: boolean;
      disableExtensionDiscovery?: boolean;
      enableMCP?: boolean;
      enableLsp?: boolean;
      agentId?: string;
    } = {
      cwd: opts.cwd,
      agentDir: ompAgentDir(),
      modelPattern: picked.id,
      thinkingLevel: picked.thinking as NonNullable<Parameters<typeof createAgentSession>[0]["thinkingLevel"]>,
      tools: toolsBySkill[opts.skill],
      toolNames: toolsBySkill[opts.skill],
      restrictToolNames: true,
      disableExtensionDiscovery: true,
      enableMCP: false,
      enableLsp: false,
      agentId: agent.id,
      sessionManager: SessionManager.inMemory(opts.cwd),
    };
    const created = await createAgentSession(sessionOpts);
    session = created.session as SessionHandle;
    let timedOut = false;
    const resetIdleTimer = (): void => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        timedOut = true;
        void session?.abort();
      }, WORK_SESSION_IDLE_TIMEOUT_MS);
    };
    unsubscribe = session.subscribe((event) => {
      resetIdleTimer();
      const normalized = normalizeActivityEvent(event);
      if (normalized) opts.onActivity?.(normalized);
    });
    resetIdleTimer();
    await session.prompt(prompt);
    const text = lastAssistantText(session.messages);
    if (timedOut) {
      outcome = fail(
        { name: "TimeoutError", message: "Nested " + opts.skill + " session was inactive for " + WORK_SESSION_IDLE_TIMEOUT_MS + "ms." },
        text || "timed out",
      );
    } else if (assistantStopReason(session.messages) === "aborted") {
      outcome = fail({ name: "AbortError", message: text || "Nested " + opts.skill + " session aborted." }, text || "aborted");
    } else if (!text) {
      outcome = fail(new EmptyModelResponseError(session.messages));
    } else {
      outcome = { ok: true, text };
    }
  } catch (error) {
    outcome = fail(error);
  } finally {
    unsubscribe?.();
    clearTimeout(timer);
  }

  try {
    await session?.dispose?.();
  } catch (error) {
    if (outcome.ok) return { retain: true, result: fail(error) };
    const prior = outcome.failure ?? { prompt, agent, error: serializeCallError({ name: "NestedCallError", message: outcome.text }) };
    prior.error.details = { ...prior.error.details, disposeError: serializeCallError(error) };
    outcome.failure = prior;
  }
  return { retain: outcome.ok, result: outcome };
}
