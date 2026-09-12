/**
 * OMP catalog helpers for nested createAgentSession() calls.
 *
 * Nested sessions must use OMP's agentDir + modelPattern. Pi's getModel()
 * and ~/.pi/agent/settings.json are the wrong catalog under OMP.
 */
import { createAgentSession, SessionManager } from "@mariozechner/pi-coding-agent";
import { existsSync, readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";

export type ActivityEvent =
  | { kind: "text"; delta: string }
  | { kind: "toolStart"; tool: string; target?: string }
  | { kind: "toolEnd"; tool: string; ok: boolean; message?: string }
  | { kind: "retry"; message: string }
  | { kind: "complete"; ok: boolean; message?: string };

const TOOL_ARG_KEYS = ["path", "filePath", "filepath", "command", "query", "pattern"] as const;

function extractToolTarget(args: unknown): string | undefined {
  if (!args || typeof args !== "object") return undefined;
  for (const key of TOOL_ARG_KEYS) {
    const value = (args as Record<string, unknown>)[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return undefined;
}

function extractErrorMessage(result: unknown): string | undefined {
  if (result && typeof result === "object") {
    const record = result as { error?: unknown; message?: unknown };
    if (typeof record.message === "string") return record.message;
    if (record.error && typeof record.error === "object" && "message" in record.error) {
      const message = (record.error as { message?: unknown }).message;
      if (typeof message === "string") return message;
    }
    if (typeof record.error === "string") return record.error;
  }
  if (typeof result === "string") return result;
  return undefined;
}

function asTextDelta(raw: unknown): ActivityEvent | null {
  const update = raw as {
    assistantMessageEvent?: { type?: unknown; delta?: unknown };
  };
  if (update.assistantMessageEvent?.type !== "text_delta") return null;
  const delta = update.assistantMessageEvent.delta;
  return typeof delta === "string" && delta.length > 0 ? { kind: "text", delta } : null;
}

function asToolStart(raw: unknown): ActivityEvent | null {
  const start = raw as { toolName?: unknown; args?: unknown };
  if (typeof start.toolName !== "string") return null;
  const target = extractToolTarget(start.args);
  return target === undefined
    ? { kind: "toolStart", tool: start.toolName }
    : { kind: "toolStart", tool: start.toolName, target };
}

function asToolEnd(raw: unknown): ActivityEvent | null {
  const end = raw as { toolName?: unknown; isError?: unknown; result?: unknown };
  if (typeof end.toolName !== "string") return null;
  const ok = end.isError !== true;
  const message = ok ? undefined : extractErrorMessage(end.result);
  if (ok) return { kind: "toolEnd", tool: end.toolName, ok: true };
  return message === undefined
    ? { kind: "toolEnd", tool: end.toolName, ok: false }
    : { kind: "toolEnd", tool: end.toolName, ok: false, message };
}

function asRetry(raw: unknown): ActivityEvent | null {
  const retry = raw as { errorMessage?: unknown };
  const message =
    typeof retry.errorMessage === "string" && retry.errorMessage
      ? retry.errorMessage
      : "model retry";
  return { kind: "retry", message };
}

function asComplete(): ActivityEvent {
  return { kind: "complete", ok: true, message: "agent finished" };
}

export function normalizeActivityEvent(raw: unknown): ActivityEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const type = (raw as { type?: unknown }).type;
  switch (type) {
    case "message_update":
      return asTextDelta(raw);
    case "tool_execution_start":
      return asToolStart(raw);
    case "tool_execution_end":
      return asToolEnd(raw);
    case "auto_retry_start":
      return asRetry(raw);
    case "agent_end":
      return asComplete();
    default:
      return null;
  }
}

export function ompAgentDir(): string {
  return process.env.OMP_AGENT_DIR || join(homedir(), ".omp", "agent");
}

export type DifficultyTier = "easy" | "medium" | "hard";

export interface OmpModelMapping {
  easy: string;
  medium: string;
  hard: string;
}

/** Phase difficulty → OMP modelRoles keys, first hit wins, then `default`. */
export const DIFFICULTY_TO_ROLE: Record<DifficultyTier, readonly string[]> = {
  easy: ["smol", "tiny", "task"],
  medium: ["slow", "task", "default"],
  hard: ["default", "plan", "slow"],
};

export function parseModelRoles(text: string): Record<string, string> {
  const roles: Record<string, string> = {};
  let inBlock = false;
  for (const line of text.split(/\r?\n/)) {
    if (/^modelRoles:\s*$/.test(line)) {
      inBlock = true;
      continue;
    }
    if (!inBlock) continue;
    if (/^\S/.test(line)) break;
    const match = line.match(/^\s+([A-Za-z][\w-]*)\s*:\s*(\S+)\s*$/);
    if (match) roles[match[1]] = match[2];
  }
  return roles;
}

export function readOmpModelRoles(cwd: string): Record<string, string> {
  for (const path of [join(cwd, ".omp", "config.yml"), join(ompAgentDir(), "config.yml")]) {
    try {
      if (!existsSync(path)) continue;
      const roles = parseModelRoles(readFileSync(path, "utf8"));
      if (Object.keys(roles).length > 0) return roles;
    } catch {
      // ignore unreadable config
    }
  }
  return {};
}

export function resolveOmpRole(cwd: string, role: string): string | undefined {
  const roles = readOmpModelRoles(cwd);
  return roles[role] ?? roles.default;
}

export function mappingFromOmpRoles(cwd: string): OmpModelMapping | null {
  const roles = readOmpModelRoles(cwd);
  const pick = (keys: readonly string[]): string | undefined => {
    for (const key of keys) {
      if (roles[key]) return roles[key];
    }
    return roles.default;
  };
  const easy = pick(DIFFICULTY_TO_ROLE.easy);
  const medium = pick(DIFFICULTY_TO_ROLE.medium);
  const hard = pick(DIFFICULTY_TO_ROLE.hard);
  if (!easy || !medium || !hard) return null;
  return { easy, medium, hard };
}

export function contentToText(content: unknown): string {
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";
  const parts: string[] = [];
  for (const block of content) {
    if (!block || typeof block !== "object") continue;
    const rec = block as { type?: unknown; text?: unknown };
    if (rec.type === "text" && typeof rec.text === "string") parts.push(rec.text);
  }
  return parts.join("").trim();
}

export function lastAssistantText(messages: Array<{ role?: string; content?: unknown }>): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role !== "assistant") continue;
    const text = contentToText(message.content);
    if (text) return text;
  }
  return "";
}

export class EmptyModelResponseError extends Error {
  constructor(messages: Array<{ role?: string; content?: unknown; stopReason?: unknown; errorMessage?: unknown }>) {
    const assistant = [...messages].reverse().find((message) => message.role === "assistant");
    if (!assistant) {
      super("Model completed without an assistant message.");
      this.name = "EmptyModelResponseError";
      return;
    }
    const details = [
      typeof assistant.stopReason === "string" ? `stop reason: ${assistant.stopReason}` : "",
      typeof assistant.errorMessage === "string" ? `error: ${assistant.errorMessage}` : "",
      Array.isArray(assistant.content)
        ? `content blocks: ${assistant.content.map((block) =>
          block && typeof block === "object" && "type" in block ? String(block.type) : typeof block,
        ).join(", ")}`
        : "",
    ].filter(Boolean);
    super(`Model returned no text${details.length > 0 ? ` (${details.join("; ")})` : ""}.`);
    this.name = "EmptyModelResponseError";
  }
}

export async function runOmpModelSession(opts: {
  cwd: string;
  tools: string[];
  prompt: string;
  modelOverride?: string;
  timeoutMs?: number;
  onActivity?: (event: ActivityEvent) => void;
}): Promise<string> {
  const { cwd, tools, prompt, modelOverride, timeoutMs = 60_000, onActivity } = opts;
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
    cwd,
    agentDir: ompAgentDir(),
    thinkingLevel: "off",
    // `tools` is Pi's legacy allowlist; OMP 18 uses `toolNames`.
    tools,
    toolNames: tools,
    restrictToolNames: true,
    disableExtensionDiscovery: true,
    enableMCP: false,
    enableLsp: false,
    agentId: `b-save-improved-model-${randomUUID()}`,
    sessionManager: SessionManager.inMemory(cwd),
  };
  if (modelOverride) sessionOpts.modelPattern = modelOverride;
  const created = await createAgentSession(sessionOpts);
  const session = created.session;
  const timer = setTimeout(() => {
    void session.abort();
  }, timeoutMs);
  let unsubscribe: (() => void) | null = null;
  if (onActivity) {
    const bridge = (rawEvent: unknown): void => {
      const normalized = normalizeActivityEvent(rawEvent);
      if (normalized) onActivity(normalized);
    };
    unsubscribe = session.subscribe(bridge);
  }
  try {
    await session.prompt(prompt);
    const messages = session.messages as Array<{
      role?: string;
      content?: unknown;
      stopReason?: unknown;
      errorMessage?: unknown;
    }>;
    const text = lastAssistantText(messages);
    if (!text) throw new EmptyModelResponseError(messages);
    return text;
  } finally {
    if (unsubscribe) unsubscribe();
    clearTimeout(timer);
    session.dispose();
  }
}
