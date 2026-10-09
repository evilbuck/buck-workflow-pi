import { createHash } from "node:crypto";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { runOmpModelSession } from "../../extensions/omp-models.js";
import { createTypeSafeEvaluator } from "../../extensions/typed-output/evaluator.js";
import { captureTurnMemory } from "../../extensions/turn-memory/capture.js";
import type { CaptureDeps } from "../../extensions/turn-memory/capture.js";
import { isTurnMemoryEnabled } from "../../extensions/turn-memory/enable.js";
import { selectTurnMemoryWindow } from "../../extensions/turn-memory/window.js";

const TICK = "turn-memory-tick";

export interface TurnMemoryHookDeps {
  judge: CaptureDeps["judge"];
  extract: (text: string, signal: AbortSignal, cwd: string) => Promise<string>;
  remember: CaptureDeps["remember"];
  home?: string;
}

interface TickData {
  identity: string;
  userPrompt: string;
  assistantText: string;
  willContinue: false;
}

export function turnMemoryStatus(cwd: string, env: NodeJS.ProcessEnv = process.env, home?: string): string {
  if (!env.SQL_MEMORY_URL) return "turn-memory: off (no SQL_MEMORY_URL)";
  if (!isTurnMemoryEnabled(cwd, env, home ? { home } : {})) return "turn-memory: off (opt-out)";
  return "turn-memory: on";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function contentText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.flatMap((block) => {
    const record = asRecord(block);
    return record?.type === "text" && typeof record.text === "string" ? [record.text] : [];
  }).join("\n");
}

function readPrompt(message: unknown): { role: string; text: string; timestamp: number } | null {
  const record = asRecord(message);
  if (!record || (record.role !== "user" && record.role !== "assistant")) return null;
  return {
    role: String(record.role),
    text: contentText(record.content),
    timestamp: typeof record.timestamp === "number" ? record.timestamp : 0,
  };
}

function promptPair(messages: unknown[]): { user: string; assistant: string; timestamp: number } | null {
  let user = "";
  let assistant = "";
  let timestamp = 0;
  for (const message of messages) {
    const read = readPrompt(message);
    if (!read) continue;
    if (read.role === "user") {
      user = read.text;
      timestamp = read.timestamp || timestamp;
    } else {
      assistant = read.text;
    }
  }
  if (!user && !assistant) return null;
  return { user, assistant, timestamp };
}

export function tickIdentity(sessionFile: string | undefined, user: string, assistant: string, timestamp: number): string {
  const digest = createHash("sha256").update(user).update("\u0001").update(assistant).digest("hex").slice(0, 12);
  return `${sessionFile ?? "no-session"}:${timestamp}:${digest}`;
}

function tickIdentityOf(entry: unknown): string | null {
  const record = asRecord(entry);
  if (!record || record.type !== "custom" || record.customType !== TICK) return null;
  const data = asRecord(record.data);
  return data && typeof data.identity === "string" ? data.identity : null;
}

function existingTick(entries: unknown[], identity: string): boolean {
  return entries.some((entry) => tickIdentityOf(entry) === identity);
}

function continues(event: object): boolean {
  return "willContinue" in event && event.willContinue === true;
}

type PoolGetter = () => unknown;
let cachedPool: { url: string; get: PoolGetter } | null = null;

export function turnMemoryPool(url: string, create: (connectionString: string) => PoolGetter): PoolGetter {
  if (!cachedPool || cachedPool.url !== url) cachedPool = { url, get: create(url) };
  return cachedPool.get;
}

export function resetTurnMemoryPool(): void {
  cachedPool = null;
}

async function defaultRemember(input: Parameters<CaptureDeps["remember"]>[0]): Promise<string> {
  const url = process.env.SQL_MEMORY_URL;
  if (!url) throw new Error("SQL_MEMORY_URL is unset");
  // Static import would load pg from db.ts at factory load, even when SQL_MEMORY_URL is unset.
  const [{ createLazyPool }, { rememberSqlMemory }] = await Promise.all([
    import("../../extensions/sql-memory/db.js"),
    import("../../extensions/sql-memory/remember.js"),
  ]);
  return rememberSqlMemory({ pool: turnMemoryPool(url, createLazyPool)(), ...input });
}

function defaultJudge(text: string): Promise<unknown> {
  return createTypeSafeEvaluator()({
    state: text,
    questions: {
      durable: {
        type: "noul",
        instructions: "Does this window hold one durable decision, convention, pitfall, or correction that would still matter in a later session?",
        criteria: {
          yes: "One durable decision, convention, pitfall, or correction that would still matter in a later session.",
          no: "Chatter, status, a question, or nothing durable.",
        },
      },
    },
  });
}

function defaultExtract(text: string, signal: AbortSignal, cwd: string): Promise<string> {
  if (signal.aborted) return Promise.reject(new Error("aborted"));
  return runOmpModelSession({
    cwd,
    tools: [],
    prompt: `Return one sentence stating one durable fact from this window, or an empty string. Do not include secrets.\n\n${text}`,
    timeoutMs: 8_000,
    thinkingLevel: "off",
    signal,
  });
}

async function onAgentEnd(pi: ExtensionAPI, event: { messages: unknown[] }, ctx: ExtensionContext, deps: TurnMemoryHookDeps): Promise<void> {
  if (!isTurnMemoryEnabled(ctx.cwd, process.env, deps.home ? { home: deps.home } : {})) return;
  const pair = promptPair(event.messages);
  if (!pair) return;
  const identity = tickIdentity(ctx.sessionManager.getSessionFile(), pair.user, pair.assistant, pair.timestamp);
  const entries = ctx.sessionManager.getEntries();
  const tick: TickData | null = existingTick(entries, identity) ? null : {
    identity,
    userPrompt: pair.user,
    assistantText: pair.assistant,
    willContinue: false,
  };
  if (tick) pi.appendEntry(TICK, tick);
  const selected = selectTurnMemoryWindow(tick ? [...entries, { type: "custom", customType: TICK, data: tick }] : entries);
  if (!selected) return;
  pi.appendEntry("turn-memory-consumed", { windowId: selected.id });
  const result = await captureTurnMemory(
    { window: selected, cwd: ctx.cwd },
    {
      isConsumed: () => false,
      persistConsumed: () => undefined,
      judge: deps.judge,
      extract: (text, signal) => deps.extract(text, signal, ctx.cwd),
      remember: deps.remember,
    },
  );
  if (result.savedId && ctx.hasUI) ctx.ui.notify(`turn-memory: ${result.savedId}`, "info");
}

export function createTurnMemoryHook(deps: TurnMemoryHookDeps): (pi: ExtensionAPI) => void {
  return (pi) => {
    pi.on("session_start", (_event, ctx) => {
      if (!ctx.hasUI) return;
      ctx.ui.notify(turnMemoryStatus(ctx.cwd, process.env, deps.home), "info");
    });
    pi.on("agent_end", async (event, ctx) => {
      try {
        if (continues(event)) return;
        await onAgentEnd(pi, event, ctx, deps);
      } catch {
        // A hook failure must not escape the handler.
      }
    });
  };
}

export default createTurnMemoryHook({
  judge: defaultJudge,
  extract: defaultExtract,
  remember: defaultRemember,
});
