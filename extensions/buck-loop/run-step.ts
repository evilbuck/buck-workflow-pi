import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createAgentSession, SessionManager } from "@mariozechner/pi-coding-agent";
import {
  EmptyModelResponseError,
  lastAssistantText,
  mappingFromOmpRoles,
  ompAgentDir,
  type DifficultyTier,
} from "../omp-models.js";
import { serializeCallError, type CallAgent, type CallFailureDetails } from "./call-failure.js";

export type NestedSkill =
  | "b-build"
  | "b-build-hard"
  | "b-review"
  | "b-iterate"
  | "b-docs"
  | "b-howto"
  | "b-save"
  | "b-commit";
export type RunStepResult = {
  ok: boolean;
  text: string;
  failure?: CallFailureDetails;
};

export const WORK_SESSION_TIMEOUT_MS = 15 * 60_000;

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

const toolsBySkill: Record<NestedSkill, string[]> = {
  "b-build": ["read", "edit", "write", "grep", "bash"],
  "b-build-hard": ["read", "edit", "write", "grep", "bash"],
  "b-review": ["read", "grep", "find", "ls", "bash", "write"],
  "b-iterate": ["read", "edit", "write", "grep", "bash"],
  "b-docs": ["read", "edit", "write", "grep", "bash"],
  "b-howto": ["read", "edit", "write", "grep"],
  "b-save": ["read", "edit", "write", "grep", "bash"],
  "b-commit": ["read", "bash"],
};

type SessionHandle = {
  prompt: (text: string) => Promise<unknown>;
  abort: () => Promise<unknown> | unknown;
  dispose?: () => Promise<unknown> | unknown;
  messages: Array<{ role?: string; content?: unknown; stopReason?: unknown }>;
};

function loadSkill(skill: NestedSkill): string {
  const path = fileURLToPath(new URL(`../../skills/${skillPaths[skill]}`, import.meta.url));
  const body = readFileSync(path, "utf8");
  if (!body.trim()) throw new Error(`Canonical skill is empty: ${path}`);
  return body;
}

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

export async function runStep(opts: {
  cwd: string;
  skill: NestedSkill;
  planOrPhasePath: string;
  difficulty: DifficultyTier;
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

    const created = await createAgentSession(sessionOpts);
    session = created.session as SessionHandle;

    let timedOut = false;
    timer = setTimeout(() => {
      timedOut = true;
      void session?.abort();
    }, WORK_SESSION_TIMEOUT_MS);
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
