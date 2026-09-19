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
 * 4. Waits up to {@link WORK_SESSION_TIMEOUT_MS} (15 minutes), then aborts.
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
 * - `modelPattern` from `mappingFromOmpRoles` — pick the operator's
 *   easy/medium/hard model by the phase's `difficulty:` frontmatter.
 *
 * The child is told it has no authority to choose the next loop state.
 */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createAgentSession, SessionManager } from "@mariozechner/pi-coding-agent";
import {
  EmptyModelResponseError,
  lastAssistantText,
  mappingFromOmpRoles,
  normalizeActivityEvent,
  ompAgentDir,
  type ActivityEvent,
  type DifficultyTier,
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

/** Outcome of one nested session. `text` is the child's last assistant message. */
export type RunStepResult = {
  ok: boolean;
  text: string;
  failure?: CallFailureDetails;
};

/** Abort the child after 15 minutes. Matches the code-review-iteration precedent. */
export const WORK_SESSION_TIMEOUT_MS = 15 * 60_000;

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
  "b-howto": ["read", "edit", "write", "grep"],
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
  const commitAuthorization = skill === "b-commit" ? "\nThe operator explicitly invoked /buck-loop, authorizing this commit step. Treat this assignment as /b-commit force so the staged checkpoint is committed even on a protected branch.\n" : "";
  return `${skillBody}\n\n---\n\nYou are executing nested work for the exact plan or phase path: ${planOrPhasePath}.\n${hardVariant}${commitAuthorization}You have no authority to choose the next loop state. Complete only the assigned work and report the result to the supervisor.`;
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
 * @param opts.cwd - Project directory. The child inherits this as its workspace.
 * @param opts.skill - Which Buck skill to inject.
 * @param opts.planOrPhasePath - Exact plan or phase file the child must work on.
 * @param opts.difficulty - Selects the model via the operator's OMP role mapping.
 * @param opts.onActivity - Optional stream into the live progress widget.
 */
export async function runStep(opts: {
  cwd: string;
  skill: NestedSkill;
  planOrPhasePath: string;
  difficulty: DifficultyTier;
  onActivity?: (event: ActivityEvent) => void;
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
  const agent: CallAgent = {
    kind: "work-session",
    id: "buck-loop-work-" + randomUUID(),
    role: opts.skill,
  };
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
    const mapping = mappingFromOmpRoles(opts.cwd);
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
      thinkingLevel: "off",
      tools: toolsBySkill[opts.skill],
      toolNames: toolsBySkill[opts.skill],
      restrictToolNames: true,
      disableExtensionDiscovery: true,
      enableMCP: false,
      enableLsp: false,
      agentId: agent.id,
      sessionManager: SessionManager.inMemory(opts.cwd),
    };
    const modelPattern = mapping?.[opts.difficulty];
    if (modelPattern) {
      sessionOpts.modelPattern = modelPattern;
      agent.model = modelPattern;
    }

    // Host SDK: spawn a child coding agent in-process. Option reasons are in the file header.
    const created = await createAgentSession(sessionOpts);
    session = created.session as SessionHandle;
    if (opts.onActivity) {
      const onActivity = opts.onActivity;
      unsubscribe = session.subscribe((event) => {
        const normalized = normalizeActivityEvent(event);
        if (normalized) onActivity(normalized);
      });
    }

    let timedOut = false;
    timer = setTimeout(() => {
      timedOut = true;
      void session?.abort();
    }, WORK_SESSION_TIMEOUT_MS);
    // Blocks until the child finishes or abort() fires from the timer.
    await session.prompt(prompt);
    const text = lastAssistantText(session.messages);
    if (timedOut) {
      outcome = fail(
        { name: "TimeoutError", message: "Nested " + opts.skill + " session timed out after " + WORK_SESSION_TIMEOUT_MS + "ms." },
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
    if (timer) clearTimeout(timer);
  }

  try {
    await session?.dispose?.();
  } catch (error) {
    if (outcome.ok) return fail(error);
    const prior = outcome.failure ?? { prompt, agent, error: serializeCallError({ name: "NestedCallError", message: outcome.text }) };
    prior.error.details = {
      ...prior.error.details,
      disposeError: serializeCallError(error),
    };
    outcome.failure = prior;
  }
  return outcome;
}
