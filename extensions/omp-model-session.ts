import { createAgentSession, SessionManager } from "@mariozechner/pi-coding-agent";
import { randomUUID } from "node:crypto";
import { EmptyModelResponseError, lastAssistantText, normalizeActivityEvent, ompAgentDir, type ActivityEvent } from "./omp-models.js";

function isolationExtras(opts) {
  const extra: Record<string, unknown> = { enableIrc: false };
  if (opts.systemPrompt !== undefined) extra.systemPrompt = opts.systemPrompt;
  if (opts.outputSchema !== undefined) {
    extra.outputSchema = opts.outputSchema;
    extra.outputSchemaMode = "strict";
  }
  if (opts.skills) extra.skills = opts.skills;
  if (opts.rules) extra.rules = opts.rules;
  if (opts.contextFiles) extra.contextFiles = opts.contextFiles;
  if (opts.promptTemplates) extra.promptTemplates = opts.promptTemplates;
  if (opts.slashCommands) extra.slashCommands = opts.slashCommands;
  return extra;
}
export async function runOmpModelSession(opts: {
  cwd: string;
  tools: string[];
  prompt: string;
  modelOverride?: string;
  timeoutMs?: number;
  onActivity?: (event: ActivityEvent) => void;
  systemPrompt?: string | string[];
  outputSchema?: unknown;
  roleId?: string;
  skills?: unknown[];
  rules?: unknown[];
  contextFiles?: unknown[];
  promptTemplates?: unknown[];
  slashCommands?: unknown[];
  enableIrc?: boolean;
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
    tools,
    toolNames: tools,
    restrictToolNames: true,
    disableExtensionDiscovery: true,
    enableMCP: false,
    enableLsp: false,
    agentId: opts.roleId
      ? "b-save-" + opts.roleId + "-" + randomUUID()
      : "b-save-model-" + randomUUID(),
    sessionManager: SessionManager.inMemory(cwd),
  };
  if (modelOverride) sessionOpts.modelPattern = modelOverride;
  Object.assign(sessionOpts, isolationExtras(opts));
  const created = await createAgentSession(sessionOpts);
  const session = created.session;
  let unsubscribe: (() => void) | null = null;
  if (onActivity) {
    const bridge = (rawEvent: unknown): void => {
      const normalized = normalizeActivityEvent(rawEvent);
      if (normalized) onActivity(normalized);
    };
    unsubscribe = session.subscribe(bridge);
  }
  const timer = setTimeout(() => {
    void session.abort();
  }, timeoutMs);
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
